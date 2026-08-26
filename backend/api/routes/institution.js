// api/routes/institution.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../../db/init');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { extractCapabilityTargets, decomposeClusterToNodes } = require('../../core/instructionEngine');

const router = express.Router();
router.use(authenticateToken);
router.use(requireRole('institution', 'admin'));

// ─── GET institution profile ──────────────────────────────────────────────────
router.get('/profile', (req, res) => {
  const db = getDb();
  const inst = db.prepare('SELECT id, name, type, contact_name, contact_email, contact_phone, city, created_at FROM institutions WHERE id = ?').get(req.user.id);
  db.close();
  if (!inst) return res.status(404).json({ error: 'Not found' });
  res.json(inst);
});

// ─── List learners ────────────────────────────────────────────────────────────
router.get('/learners', (req, res) => {
  const db = getDb();
  const learners = db.prepare('SELECT * FROM learners WHERE institution_id = ? ORDER BY created_at DESC').all(req.user.id);
  db.close();
  res.json(learners);
});

// ─── Add learner ──────────────────────────────────────────────────────────────
router.post('/learners', (req, res) => {
  const { name, email, learner_ref, language, profile_type, current_capability_level } = req.body;
  if (!name || !learner_ref || !language) {
    return res.status(400).json({ error: 'name, learner_ref, and language required' });
  }
  const db = getDb();
  const id = uuidv4();
  db.prepare(`
    INSERT INTO learners (id, institution_id, name, email, learner_ref, language, profile_type, current_capability_level)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, name, email, learner_ref, language, profile_type, current_capability_level);
  db.close();
  res.status(201).json({ id, message: 'Learner added' });
});

// ─── Bulk add learners ────────────────────────────────────────────────────────
router.post('/learners/bulk', (req, res) => {
  const { learners } = req.body;
  if (!Array.isArray(learners)) return res.status(400).json({ error: 'learners array required' });
  const db = getDb();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO learners (id, institution_id, name, email, learner_ref, language, profile_type)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMany = db.transaction((rows) => rows.forEach(l =>
    insert.run(uuidv4(), req.user.id, l.name, l.email || null, l.learner_ref, l.language || 'telugu', l.profile_type || 'college_student')
  ));
  insertMany(learners);
  db.close();
  res.status(201).json({ message: `${learners.length} learners processed` });
});

// ─── Upload / submit capability target ───────────────────────────────────────
router.post('/capability-targets', async (req, res) => {
  const { title, path, raw_input, time_window_weeks, cohort_size } = req.body;
  if (!raw_input) return res.status(400).json({ error: 'raw_input required' });

  const db = getDb();
  const id = uuidv4();

  if (path === 'A') {
    // Structured input — store directly
    db.prepare(`
      INSERT INTO capability_targets (id, institution_id, version, title, path, raw_input, time_window_weeks, cohort_size)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.user.id, '1.0', title || 'Capability Target', 'A', raw_input, time_window_weeks, cohort_size);
    db.close();
    return res.status(201).json({ id, path: 'A', message: 'Capability target stored' });
  }

  // Path B — AI extraction
  try {
    const extracted = await extractCapabilityTargets(raw_input);
    db.prepare(`
      INSERT INTO capability_targets (id, institution_id, version, title, path, raw_input, extracted_targets, time_window_weeks, cohort_size)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.user.id, '1.0', title || extracted.title || 'Capability Target',
      'B', raw_input, JSON.stringify(extracted), time_window_weeks, cohort_size);
    db.close();
    return res.status(201).json({
      id,
      path: 'B',
      extraction: extracted,
      message: 'Targets extracted. Please review and confirm before instruction begins.'
    });
  } catch (err) {
    db.close();
    return res.status(500).json({ error: 'Extraction failed', detail: err.message });
  }
});

// ─── Confirm Path B target ────────────────────────────────────────────────────
router.post('/capability-targets/:id/confirm', (req, res) => {
  const db = getDb();
  db.prepare(`
    UPDATE capability_targets SET confirmed = 1, confirmed_at = datetime('now'), status = 'confirmed'
    WHERE id = ? AND institution_id = ?
  `).run(req.params.id, req.user.id);
  db.close();
  res.json({ message: 'Capability target confirmed. Instruction can now begin.' });
});

// ─── Build skill nodes from clusters (pathway design) ────────────────────────
router.post('/capability-targets/:id/build-pathway', async (req, res) => {
  const { language } = req.body;
  const db = getDb();
  const ct = db.prepare('SELECT * FROM capability_targets WHERE id = ? AND institution_id = ?').get(req.params.id, req.user.id);
  if (!ct) { db.close(); return res.status(404).json({ error: 'Capability target not found' }); }

  const extracted = ct.extracted_targets ? JSON.parse(ct.extracted_targets) : null;
  const clusters = extracted ? extracted.clusters : [];

  if (clusters.length === 0) { db.close(); return res.status(400).json({ error: 'No clusters found. Run extraction first.' }); }

  const insertCluster = db.prepare(`
    INSERT OR IGNORE INTO skill_clusters (id, capability_target_id, cluster_label, cluster_ref, required_proficiency, mastery_threshold, priority, evidence_type, sequence_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertNode = db.prepare(`
    INSERT OR IGNORE INTO skill_nodes (id, cluster_id, node_label, description, prerequisite_node_ids, sequence_order, difficulty_level, node_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const results = [];
  for (let i = 0; i < clusters.length; i++) {
    const c = clusters[i];
    const clusterId = uuidv4();
    insertCluster.run(clusterId, ct.id, c.label, c.cluster_ref || null, c.required_proficiency, c.mastery_threshold || 0.75, c.priority || 'normal', c.evidence_type || null, i);

    try {
      const decomposed = await decomposeClusterToNodes({
        clusterLabel: c.label,
        clusterDescription: c.description,
        proficiencyLevel: c.required_proficiency,
        language: language || 'telugu'
      });

      const nodeIds = [];
      for (let j = 0; j < decomposed.nodes.length; j++) {
        const n = decomposed.nodes[j];
        const nodeId = uuidv4();
        nodeIds.push(nodeId);
        const prereqIds = (n.prerequisite_indices || []).map(pi => nodeIds[pi]).filter(Boolean);
        insertNode.run(nodeId, clusterId, n.label, n.description, JSON.stringify(prereqIds), j, n.difficulty_level || 1, n.node_type || 'concept');
      }
      results.push({ cluster: c.label, nodes_created: decomposed.nodes.length });
    } catch (err) {
      results.push({ cluster: c.label, error: err.message });
    }
  }

  db.close();
  res.json({ message: 'Pathway built', results });
});

// ─── Create engagement ────────────────────────────────────────────────────────
router.post('/engagements', (req, res) => {
  const { capability_target_id, title, language, learner_ids } = req.body;
  if (!capability_target_id || !language) return res.status(400).json({ error: 'capability_target_id and language required' });

  const db = getDb();
  const ct = db.prepare('SELECT * FROM capability_targets WHERE id = ? AND (confirmed = 1 OR path = ?)').get(capability_target_id, 'A');
  if (!ct) { db.close(); return res.status(400).json({ error: 'Capability target not confirmed' }); }

  const engId = uuidv4();
  db.prepare(`
    INSERT INTO engagements (id, institution_id, capability_target_id, title, language, status, started_at)
    VALUES (?, ?, ?, ?, ?, 'active', datetime('now'))
  `).run(engId, req.user.id, capability_target_id, title || ct.title, language);

  // Get first skill node for each learner
  const firstCluster = db.prepare('SELECT id FROM skill_clusters WHERE capability_target_id = ? ORDER BY sequence_order LIMIT 1').get(capability_target_id);
  const firstNode = firstCluster
    ? db.prepare('SELECT id FROM skill_nodes WHERE cluster_id = ? ORDER BY sequence_order LIMIT 1').get(firstCluster.id)
    : null;

  if (Array.isArray(learner_ids)) {
    const insertEl = db.prepare(`
      INSERT OR IGNORE INTO engagement_learners (id, engagement_id, learner_id, current_node_id, current_cluster_id)
      VALUES (?, ?, ?, ?, ?)
    `);
    learner_ids.forEach(lid => insertEl.run(uuidv4(), engId, lid, firstNode ? firstNode.id : null, firstCluster ? firstCluster.id : null));
  }

  db.close();
  res.status(201).json({ engagement_id: engId, message: 'Engagement started' });
});

// ─── List engagements ─────────────────────────────────────────────────────────
router.get('/engagements', (req, res) => {
  const db = getDb();
  const engagements = db.prepare(`
    SELECT e.*, ct.title as ct_title,
      (SELECT COUNT(*) FROM engagement_learners WHERE engagement_id = e.id) as learner_count,
      (SELECT COUNT(*) FROM engagement_learners WHERE engagement_id = e.id AND overall_status = 'completed') as completed_count
    FROM engagements e
    JOIN capability_targets ct ON e.capability_target_id = ct.id
    WHERE e.institution_id = ? ORDER BY e.created_at DESC
  `).all(req.user.id);
  db.close();
  res.json(engagements);
});

// ─── Get engagement detail + cohort progress ──────────────────────────────────
router.get('/engagements/:id', (req, res) => {
  const db = getDb();
  const engagement = db.prepare(`
    SELECT e.*, ct.title as ct_title, ct.extracted_targets
    FROM engagements e JOIN capability_targets ct ON e.capability_target_id = ct.id
    WHERE e.id = ? AND e.institution_id = ?
  `).get(req.params.id, req.user.id);
  if (!engagement) { db.close(); return res.status(404).json({ error: 'Not found' }); }

  const learners = db.prepare(`
    SELECT l.name, l.learner_ref, l.language, el.overall_status, el.current_node_id,
      (SELECT sn.node_label FROM skill_nodes sn WHERE sn.id = el.current_node_id) as current_node_label,
      (SELECT COUNT(*) FROM node_mastery nm WHERE nm.engagement_learner_id = el.id AND nm.advanced_at IS NOT NULL) as nodes_mastered
    FROM engagement_learners el
    JOIN learners l ON l.id = el.learner_id
    WHERE el.engagement_id = ?
  `).all(req.params.id);

  db.close();
  res.json({ ...engagement, learners });
});

// ─── Produce Mastery Logs ─────────────────────────────────────────────────────
router.post('/engagements/:id/produce-mastery-logs', (req, res) => {
  const { produceEngagementMasteryLogs } = require('../../core/masteryLog');
  try {
    const logs = produceEngagementMasteryLogs(req.params.id);
    res.json({ message: `${logs.length} Mastery Logs produced`, log_ids: logs.map(l => l.log_id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Get Mastery Logs for engagement ─────────────────────────────────────────
router.get('/engagements/:id/mastery-logs', (req, res) => {
  const db = getDb();
  const logs = db.prepare(`
    SELECT ml.*, l.name as learner_name, l.learner_ref
    FROM mastery_logs ml
    JOIN learners l ON l.id = ml.learner_id
    WHERE ml.engagement_id = ?
  `).all(req.params.id);
  db.close();
  res.json(logs.map(log => ({ ...log, log_data: JSON.parse(log.log_data || '{}') })));
});

module.exports = router;
