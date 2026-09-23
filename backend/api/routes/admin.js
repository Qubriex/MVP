// api/routes/admin.js — Inferexaa admin portal (Qubirex platform)
const express = require('express');
const { getDb } = require('../../db/init');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { getMasteryLog } = require('../../core/masteryLog');

const router = express.Router();

// The first admin account is created via `node scripts/seed-admin.js`
// (server shell access only) — never as an HTTP route. An HTTP bootstrap
// route, even one gated by comparing a request-body value to JWT_SECRET,
// means anyone who can guess or intercept that secret can mint themselves
// an admin account over the network.

router.use(authenticateToken);
router.use(requireRole('admin'));

// ─── Dashboard stats ──────────────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  const db = getDb();
  const stats = {
    institutions: db.prepare('SELECT COUNT(*) as cnt FROM institutions').get().cnt,
    learners: db.prepare('SELECT COUNT(*) as cnt FROM learners').get().cnt,
    engagements: db.prepare('SELECT COUNT(*) as cnt FROM engagements').get().cnt,
    active_engagements: db.prepare("SELECT COUNT(*) as cnt FROM engagements WHERE status = 'active'").get().cnt,
    mastery_logs_produced: db.prepare('SELECT COUNT(*) as cnt FROM mastery_logs').get().cnt,
    sessions_total: db.prepare('SELECT COUNT(*) as cnt FROM learning_sessions').get().cnt,
    checks_passed: db.prepare("SELECT COUNT(*) as cnt FROM mastery_checks WHERE passed = 1").get().cnt,
    checks_failed: db.prepare("SELECT COUNT(*) as cnt FROM mastery_checks WHERE passed = 0").get().cnt,
    avg_mastery: db.prepare('SELECT AVG(mastery_attainment) as avg FROM node_mastery WHERE mastery_attainment IS NOT NULL').get().avg,
    avg_loops: db.prepare('SELECT AVG(loop_count) as avg FROM learning_sessions').get().avg
  };
  db.close();
  res.json(stats);
});

// ─── List all institutions ────────────────────────────────────────────────────
router.get('/institutions', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT i.*, COUNT(DISTINCT e.id) as engagement_count, COUNT(DISTINCT l.id) as learner_count
    FROM institutions i
    LEFT JOIN engagements e ON e.institution_id = i.id
    LEFT JOIN learners l ON l.institution_id = i.id
    GROUP BY i.id ORDER BY i.created_at DESC
  `).all();
  db.close();
  res.json(rows);
});

// ─── Get a Mastery Log ────────────────────────────────────────────────────────
router.get('/mastery-logs/:id', (req, res) => {
  const log = getMasteryLog(req.params.id);
  if (!log) return res.status(404).json({ error: 'Not found' });
  res.json(log);
});

// ─── Instruction quality report ───────────────────────────────────────────────
router.get('/quality-report', (req, res) => {
  const db = getDb();
  const nodeStats = db.prepare(`
    SELECT sn.node_label, sc.cluster_label,
      COUNT(DISTINCT nm.engagement_learner_id) as learners_attempted,
      AVG(nm.mastery_attainment) as avg_mastery,
      AVG(nm.attempt_count) as avg_attempts,
      AVG(nm.time_to_mastery_minutes) as avg_time_minutes,
      AVG(nm.confidence_indicator) as avg_confidence
    FROM node_mastery nm
    JOIN skill_nodes sn ON sn.id = nm.skill_node_id
    JOIN skill_clusters sc ON sc.id = sn.cluster_id
    GROUP BY nm.skill_node_id
    ORDER BY avg_attempts DESC
  `).all();

  const loopStats = db.prepare(`
    SELECT current_approach, COUNT(*) as usage_count,
      AVG(loop_count) as avg_loops
    FROM learning_sessions GROUP BY current_approach
  `).all();

  db.close();
  res.json({
    node_difficulty_ranking: nodeStats,
    approach_effectiveness: loopStats,
    note: 'High avg_attempts on a node signals a potential explanation-architecture issue, not learner failure'
  });
});

// ─── Cost / latency report ─────────────────────────────────────────────────────
// Every callAI() call is logged to ai_call_log (see instructionEngine.js).
// learner_turns counts DISTINCT turn_id — one row per orchestrator.processMessage()
// call — so cost_per_learner_turn_usd is a real average, not a guess.
// estimated_cost_usd is 0 unless GEMINI_INPUT_PRICE_PER_1K_USD /
// GEMINI_OUTPUT_PRICE_PER_1K_USD are set in the environment: an honest "not
// configured" rather than a fabricated number.
router.get('/cost-report', (req, res) => {
  const db = getDb();

  const overall = db.prepare(`
    SELECT
      COUNT(*) as total_calls,
      SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) as failed_calls,
      SUM(prompt_tokens) as total_prompt_tokens,
      SUM(completion_tokens) as total_completion_tokens,
      SUM(total_tokens) as total_tokens,
      SUM(estimated_cost_usd) as total_estimated_cost_usd,
      AVG(latency_ms) as avg_latency_ms,
      COUNT(DISTINCT CASE WHEN turn_id IS NOT NULL THEN turn_id END) as learner_turns
    FROM ai_call_log
    WHERE created_at >= datetime('now', ?)
  `).get(`-${parseInt(req.query.days, 10) || 30} days`);

  const byBrain = db.prepare(`
    SELECT brain,
      COUNT(*) as calls,
      SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) as failed_calls,
      SUM(total_tokens) as total_tokens,
      SUM(estimated_cost_usd) as estimated_cost_usd,
      AVG(latency_ms) as avg_latency_ms
    FROM ai_call_log
    WHERE created_at >= datetime('now', ?)
    GROUP BY brain ORDER BY total_tokens DESC
  `).all(`-${parseInt(req.query.days, 10) || 30} days`);

  db.close();

  const learnerTurns = overall.learner_turns || 0;
  res.json({
    window_days: parseInt(req.query.days, 10) || 30,
    pricing_configured: parseFloat(process.env.GEMINI_INPUT_PRICE_PER_1K_USD || '0') > 0
      || parseFloat(process.env.GEMINI_OUTPUT_PRICE_PER_1K_USD || '0') > 0,
    total_calls: overall.total_calls || 0,
    failed_calls: overall.failed_calls || 0,
    total_prompt_tokens: overall.total_prompt_tokens || 0,
    total_completion_tokens: overall.total_completion_tokens || 0,
    total_tokens: overall.total_tokens || 0,
    total_estimated_cost_usd: overall.total_estimated_cost_usd || 0,
    avg_latency_ms: overall.avg_latency_ms || 0,
    learner_turns: learnerTurns,
    cost_per_learner_turn_usd: learnerTurns > 0 ? (overall.total_estimated_cost_usd || 0) / learnerTurns : null,
    by_brain: byBrain
  });
});

module.exports = router;
