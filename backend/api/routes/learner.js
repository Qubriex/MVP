// api/routes/learner.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../../db/init');
const { authenticateToken, requireRole } = require('../middleware/auth');
const {
  generateInstruction,
  generateMasteryCheck,
  evaluateMasteryResponse,
  calculateMasteryAttainment,
  calculateConfidenceIndicator,
  selectNextApproach
} = require('../../core/instructionEngine');

const router = express.Router();
router.use(authenticateToken);
router.use(requireRole('learner', 'admin'));

// ─── Get learner dashboard ────────────────────────────────────────────────────
router.get('/dashboard', (req, res) => {
  const db = getDb();
  const el = db.prepare(`
    SELECT el.*, e.title as engagement_title, e.language,
      (SELECT COUNT(*) FROM node_mastery nm WHERE nm.engagement_learner_id = el.id AND nm.advanced_at IS NOT NULL) as nodes_mastered,
      sn.node_label as current_node_label,
      sc.cluster_label as current_cluster_label
    FROM engagement_learners el
    JOIN engagements e ON e.id = el.engagement_id
    LEFT JOIN skill_nodes sn ON sn.id = el.current_node_id
    LEFT JOIN skill_clusters sc ON sc.id = el.current_cluster_id
    WHERE el.id = ?
  `).get(req.user.el_id);
  if (!el) { db.close(); return res.status(404).json({ error: 'Not found' }); }

  const totalNodes = db.prepare(`
    SELECT COUNT(*) as cnt FROM skill_nodes sn
    JOIN skill_clusters sc ON sc.id = sn.cluster_id
    JOIN capability_targets ct ON ct.id = sc.capability_target_id
    JOIN engagements e ON e.capability_target_id = ct.id
    WHERE e.id = ?
  `).get(req.user.engagement_id);

  db.close();
  res.json({
    ...el,
    total_nodes: totalNodes.cnt,
    progress_pct: totalNodes.cnt > 0 ? Math.round((el.nodes_mastered / totalNodes.cnt) * 100) : 0
  });
});

// ─── Start or resume a session for current node ───────────────────────────────
router.post('/session/start', async (req, res) => {
  const db = getDb();
  const el = db.prepare('SELECT * FROM engagement_learners WHERE id = ?').get(req.user.el_id);
  if (!el || !el.current_node_id) { db.close(); return res.status(400).json({ error: 'No active skill node' }); }

  const node = db.prepare(`
    SELECT sn.*, sc.cluster_label FROM skill_nodes sn
    JOIN skill_clusters sc ON sc.id = sn.cluster_id
    WHERE sn.id = ?
  `).get(el.current_node_id);

  // Check for existing active session
  let session = db.prepare(`
    SELECT * FROM learning_sessions
    WHERE engagement_learner_id = ? AND skill_node_id = ? AND status = 'active'
    ORDER BY started_at DESC LIMIT 1
  `).get(el.id, el.current_node_id);

  if (!session) {
    const loopCount = db.prepare(`
      SELECT COUNT(*) as cnt FROM learning_sessions
      WHERE engagement_learner_id = ? AND skill_node_id = ?
    `).get(el.id, el.current_node_id).cnt;

    const sessionId = uuidv4();
    const approach = loopCount === 0 ? 'native_concept' :
      selectNextApproach('native_concept', []);

    db.prepare(`
      INSERT INTO learning_sessions (id, engagement_learner_id, skill_node_id, session_number, language, loop_count, explanation_approach)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(sessionId, el.id, el.current_node_id, loopCount + 1, el.language || req.user.language, loopCount, approach);

    session = db.prepare('SELECT * FROM learning_sessions WHERE id = ?').get(sessionId);
  }

  // Load conversation history
  const history = db.prepare(`
    SELECT role, content, message_type FROM session_messages
    WHERE session_id = ? ORDER BY created_at
  `).all(session.id);

  db.close();

  // Generate first instruction if no history
  if (history.length === 0) {
    try {
      const instruction = await generateInstruction({
        nodeLabel: node.node_label,
        clusterLabel: node.cluster_label,
        language: req.user.language,
        approach: session.explanation_approach,
        conversationHistory: [],
        loopCount: session.loop_count
      });

      const msgDb = getDb();
      msgDb.prepare(`
        INSERT INTO session_messages (id, session_id, role, content, message_type)
        VALUES (?, ?, ?, ?, ?)
      `).run(uuidv4(), session.id, 'ai', instruction.message, 'instruction');
      msgDb.close();

      return res.json({
        session_id: session.id,
        node_label: node.node_label,
        cluster_label: node.cluster_label,
        language: req.user.language,
        approach: session.explanation_approach,
        loop_count: session.loop_count,
        message: instruction.message,
        message_type: 'instruction',
        history: [{ role: 'ai', content: instruction.message, message_type: 'instruction' }]
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to generate instruction', detail: err.message });
    }
  }

  res.json({
    session_id: session.id,
    node_label: node.node_label,
    cluster_label: node.cluster_label,
    language: req.user.language,
    approach: session.explanation_approach,
    loop_count: session.loop_count,
    history
  });
});

// ─── Send a learner message and get AI response ───────────────────────────────
router.post('/session/:sessionId/message', async (req, res) => {
  const { content, request_mastery_check } = req.body;
  if (!content) return res.status(400).json({ error: 'content required' });

  const db = getDb();
  const session = db.prepare('SELECT * FROM learning_sessions WHERE id = ? AND engagement_learner_id = ?').get(req.params.sessionId, req.user.el_id);
  if (!session) { db.close(); return res.status(404).json({ error: 'Session not found' }); }

  const node = db.prepare(`
    SELECT sn.*, sc.cluster_label FROM skill_nodes sn
    JOIN skill_clusters sc ON sc.id = sn.cluster_id WHERE sn.id = ?
  `).get(session.skill_node_id);

  const history = db.prepare(`
    SELECT role, content, message_type FROM session_messages WHERE session_id = ? ORDER BY created_at
  `).all(session.id);

  // Log learner message
  db.prepare(`
    INSERT INTO session_messages (id, session_id, role, content, message_type)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), session.id, 'learner', content, 'response');
  db.close();

  try {
    let aiResponse;

    if (request_mastery_check) {
      // Learner is ready to be checked
      aiResponse = await generateMasteryCheck({
        nodeLabel: node.node_label,
        clusterLabel: node.cluster_label,
        language: req.user.language,
        conversationHistory: [...history, { role: 'learner', content }]
      });
    } else {
      // Continue instruction
      aiResponse = await generateInstruction({
        nodeLabel: node.node_label,
        clusterLabel: node.cluster_label,
        language: req.user.language,
        approach: session.explanation_approach,
        conversationHistory: [...history, { role: 'learner', content }],
        loopCount: session.loop_count
      });
    }

    const msgDb = getDb();
    msgDb.prepare(`
      INSERT INTO session_messages (id, session_id, role, content, message_type)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), session.id, 'ai', aiResponse.message, aiResponse.message_type || 'instruction');
    msgDb.close();

    res.json({
      message: aiResponse.message,
      message_type: aiResponse.message_type,
      mastery_check_question: aiResponse.mastery_check_question || null,
      session_id: session.id
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Submit mastery check answer ──────────────────────────────────────────────
router.post('/session/:sessionId/mastery-check', async (req, res) => {
  const { question, learner_response } = req.body;
  if (!question || !learner_response) {
    return res.status(400).json({ error: 'question and learner_response required' });
  }

  const db = getDb();
  const session = db.prepare('SELECT * FROM learning_sessions WHERE id = ? AND engagement_learner_id = ?').get(req.params.sessionId, req.user.el_id);
  if (!session) { db.close(); return res.status(404).json({ error: 'Session not found' }); }

  const node = db.prepare(`
    SELECT sn.*, sc.cluster_label FROM skill_nodes sn
    JOIN skill_clusters sc ON sc.id = sn.cluster_id WHERE sn.id = ?
  `).get(session.skill_node_id);

  const checkCount = db.prepare('SELECT COUNT(*) as cnt FROM mastery_checks WHERE session_id = ?').get(session.id).cnt;
  db.close();

  try {
    const evaluation = await evaluateMasteryResponse({
      nodeLabel: node.node_label,
      language: req.user.language,
      question,
      learnerResponse: learner_response
    });

    const checkDb = getDb();

    // Log the mastery check
    const checkId = uuidv4();
    checkDb.prepare(`
      INSERT INTO mastery_checks (id, session_id, skill_node_id, engagement_learner_id, check_number, question_text, learner_response, passed, score, ai_evaluation, evaluated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(checkId, session.id, session.skill_node_id, req.user.el_id, checkCount + 1, question, learner_response, evaluation.passed ? 1 : 0, evaluation.score, evaluation.evaluation);

    if (evaluation.passed) {
      // ─── ADVANCE ──────────────────────────────────────────────────────
      const allChecks = checkDb.prepare(`
        SELECT score, passed FROM mastery_checks WHERE engagement_learner_id = ? AND skill_node_id = ? ORDER BY created_at
      `).all(req.user.el_id, session.skill_node_id);

      const masteryAttainment = calculateMasteryAttainment(allChecks);
      const sessionLoopCount = checkDb.prepare('SELECT loop_count FROM learning_sessions WHERE id = ?').get(session.id).loop_count;
      const confidenceIndicator = calculateConfidenceIndicator(allChecks, sessionLoopCount);

      // Calculate time to mastery
      const sessionStart = checkDb.prepare('SELECT started_at FROM learning_sessions WHERE id = ?').get(session.id);
      const startTime = new Date(sessionStart.started_at).getTime();
      const timeToMastery = (Date.now() - startTime) / 60000;

      // Upsert node mastery record
      checkDb.prepare(`
        INSERT INTO node_mastery (id, engagement_learner_id, skill_node_id, mastery_attainment, time_to_mastery_minutes, attempt_count, confidence_indicator, advanced_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(engagement_learner_id, skill_node_id) DO UPDATE SET
          mastery_attainment = excluded.mastery_attainment,
          time_to_mastery_minutes = excluded.time_to_mastery_minutes,
          attempt_count = excluded.attempt_count,
          confidence_indicator = excluded.confidence_indicator,
          advanced_at = datetime('now')
      `).run(uuidv4(), req.user.el_id, session.skill_node_id, masteryAttainment, timeToMastery, allChecks.length, confidenceIndicator);

      // Mark session complete
      checkDb.prepare(`
        UPDATE learning_sessions SET status = 'completed', completed_at = datetime('now') WHERE id = ?
      `).run(session.id);

      // Find next node
      const nextNode = checkDb.prepare(`
        SELECT sn.*, sc.cluster_label FROM skill_nodes sn
        JOIN skill_clusters sc ON sc.id = sn.cluster_id
        WHERE sn.cluster_id = (SELECT cluster_id FROM skill_nodes WHERE id = ?)
        AND sn.sequence_order > (SELECT sequence_order FROM skill_nodes WHERE id = ?)
        ORDER BY sn.sequence_order LIMIT 1
      `).get(session.skill_node_id, session.skill_node_id);

      let nextClusterNode = null;
      if (!nextNode) {
        // Current cluster done — find first node of next cluster
        const currentCluster = checkDb.prepare('SELECT cluster_id, sequence_order FROM skill_nodes WHERE id = ?').get(session.skill_node_id);
        const nextCluster = checkDb.prepare(`
          SELECT sc.id FROM skill_clusters sc
          JOIN skill_nodes sn ON sn.cluster_id = sc.id
          WHERE sc.capability_target_id = (SELECT capability_target_id FROM skill_clusters WHERE id = ?)
          AND sc.sequence_order > (SELECT sequence_order FROM skill_clusters WHERE id = ?)
          ORDER BY sc.sequence_order LIMIT 1
        `).get(currentCluster.cluster_id, currentCluster.cluster_id);

        if (nextCluster) {
          nextClusterNode = checkDb.prepare('SELECT * FROM skill_nodes WHERE cluster_id = ? ORDER BY sequence_order LIMIT 1').get(nextCluster.id);
        }
      }

      const advanceTo = nextNode || nextClusterNode;
      if (advanceTo) {
        checkDb.prepare(`
          UPDATE engagement_learners SET current_node_id = ?, current_cluster_id = (SELECT cluster_id FROM skill_nodes WHERE id = ?)
          WHERE id = ?
        `).run(advanceTo.id, advanceTo.id, req.user.el_id);
      } else {
        // All nodes complete
        checkDb.prepare(`UPDATE engagement_learners SET overall_status = 'completed' WHERE id = ?`).run(req.user.el_id);
      }

      checkDb.close();
      return res.json({
        result: 'advance',
        passed: true,
        score: evaluation.score,
        feedback: evaluation.feedback_for_learner,
        mastery_attainment: Math.round(masteryAttainment * 100),
        confidence_indicator: parseFloat(confidenceIndicator.toFixed(2)),
        next_node: advanceTo ? { id: advanceTo.id, label: advanceTo.node_label } : null,
        programme_complete: !advanceTo
      });

    } else {
      // ─── LOOP — try a different approach ──────────────────────────────
      const prevApproaches = checkDb.prepare(`
        SELECT explanation_approach FROM learning_sessions
        WHERE engagement_learner_id = ? AND skill_node_id = ?
      `).all(req.user.el_id, session.skill_node_id).map(s => s.explanation_approach);

      const nextApproach = evaluation.loop_approach_if_failed ||
        selectNextApproach(session.explanation_approach, prevApproaches);

      const newLoopCount = (session.loop_count || 0) + 1;
      const newSessionId = uuidv4();

      // Create new session with new approach
      checkDb.prepare(`
        INSERT INTO learning_sessions (id, engagement_learner_id, skill_node_id, session_number, language, loop_count, explanation_approach)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(newSessionId, req.user.el_id, session.skill_node_id, newLoopCount + 1, req.user.language, newLoopCount, nextApproach);

      // Close current session
      checkDb.prepare(`UPDATE learning_sessions SET status = 'completed', completed_at = datetime('now') WHERE id = ?`).run(session.id);

      checkDb.close();
      return res.json({
        result: 'loop',
        passed: false,
        score: evaluation.score,
        feedback: evaluation.feedback_for_learner,
        understanding_gaps: evaluation.understanding_gaps,
        new_session_id: newSessionId,
        next_approach: nextApproach,
        loop_count: newLoopCount,
        message: `Let\'s try understanding this differently. New approach: ${nextApproach}`
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Get session history ──────────────────────────────────────────────────────
router.get('/session/:sessionId/history', (req, res) => {
  const db = getDb();
  const messages = db.prepare(`
    SELECT * FROM session_messages WHERE session_id = ? ORDER BY created_at
  `).all(req.params.sessionId);
  db.close();
  res.json(messages);
});

// ─── Get learner's full mastery record ────────────────────────────────────────
router.get('/mastery-record', (req, res) => {
  const db = getDb();
  const records = db.prepare(`
    SELECT nm.*, sn.node_label, sc.cluster_label
    FROM node_mastery nm
    JOIN skill_nodes sn ON sn.id = nm.skill_node_id
    JOIN skill_clusters sc ON sc.id = sn.cluster_id
    WHERE nm.engagement_learner_id = ?
    ORDER BY nm.advanced_at
  `).all(req.user.el_id);
  db.close();
  res.json(records);
});

module.exports = router;
