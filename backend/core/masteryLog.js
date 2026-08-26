// core/masteryLog.js
// ─────────────────────────────────────────────────────────────────────────────
// MASTERY LOG PRODUCTION LOGIC
//
// The Mastery Log is Vak's complete output document. It is structured
// evidence of capability movement — no more, no less.
//
// CRITICAL BOUNDARY RULE:
// - readiness_classification: ALWAYS NULL — owned by commissioning client
// - external_score: ALWAYS NULL — owned by assessment platform/employer
// These two fields are ALWAYS BLANK in every version of the Mastery Log.
// ─────────────────────────────────────────────────────────────────────────────

const { getDb } = require('../db/init');
const { calculateSimulationReadiness } = require('./instructionEngine');
const { v4: uuidv4 } = require('uuid');

/**
 * Produce the Mastery Log for a learner in an engagement
 */
function produceLearnerMasteryLog(engagementId, learnerId) {
  const db = getDb();

  // ─── Fetch core data ─────────────────────────────────────────────────────
  const engagement = db.prepare(`
    SELECT e.*, ct.version as ct_version, ct.title as ct_title,
           ct.extracted_targets, i.name as institution_name
    FROM engagements e
    JOIN capability_targets ct ON e.capability_target_id = ct.id
    JOIN institutions i ON e.institution_id = i.id
    WHERE e.id = ?
  `).get(engagementId);

  const learner = db.prepare(`
    SELECT l.*, el.id as el_id, el.overall_status
    FROM learners l
    JOIN engagement_learners el ON el.learner_id = l.id
    WHERE l.id = ? AND el.engagement_id = ?
  `).get(learnerId, engagementId);

  if (!engagement || !learner) {
    db.close();
    throw new Error('Engagement or learner not found');
  }

  // ─── Fetch clusters for this engagement ──────────────────────────────────
  const clusters = db.prepare(`
    SELECT sc.* FROM skill_clusters sc
    WHERE sc.capability_target_id = ?
    ORDER BY sc.sequence_order
  `).all(engagement.capability_target_id);

  const clusterLogs = [];

  for (const cluster of clusters) {
    // ─── Fetch skill nodes for this cluster ────────────────────────────────
    const nodes = db.prepare(`
      SELECT sn.* FROM skill_nodes sn
      WHERE sn.cluster_id = ?
      ORDER BY sn.sequence_order
    `).all(cluster.id);

    const nodeLogs = [];

    for (const node of nodes) {
      // ─── Fetch mastery record for this learner+node ─────────────────────
      const masteryRecord = db.prepare(`
        SELECT nm.* FROM node_mastery nm
        WHERE nm.engagement_learner_id = ? AND nm.skill_node_id = ?
      `).get(learner.el_id, node.id);

      // ─── Fetch all mastery check results ────────────────────────────────
      const checkResults = db.prepare(`
        SELECT mc.* FROM mastery_checks mc
        WHERE mc.engagement_learner_id = ? AND mc.skill_node_id = ?
        ORDER BY mc.created_at
      `).all(learner.el_id, node.id);

      nodeLogs.push({
        skill_node: node.node_label,
        node_type: node.node_type,
        difficulty_level: node.difficulty_level,
        // ─── Vak's proprietary evidence fields ──────────────────────────
        mastery_attainment: masteryRecord ? Math.round((masteryRecord.mastery_attainment || 0) * 100) : null,
        time_to_mastery_minutes: masteryRecord ? Math.round(masteryRecord.time_to_mastery_minutes || 0) : null,
        attempt_count: masteryRecord ? (masteryRecord.attempt_count || 0) : (checkResults.length || 0),
        confidence_indicator: masteryRecord ? parseFloat((masteryRecord.confidence_indicator || 0).toFixed(2)) : null,
        node_status: masteryRecord && masteryRecord.advanced_at ? 'mastered' : 'in_progress',
        mastered_at: masteryRecord ? masteryRecord.advanced_at : null
      });
    }

    // ─── Simulation readiness for this cluster ──────────────────────────
    const nodeMasteryForCluster = nodeLogs.map(n => ({
      mastery_attainment: (n.mastery_attainment || 0) / 100,
      confidence_indicator: n.confidence_indicator || 0
    }));
    const simulationReadiness = calculateSimulationReadiness(nodeMasteryForCluster);

    const avgMastery = nodeLogs.filter(n => n.mastery_attainment !== null).length > 0
      ? nodeLogs.reduce((s, n) => s + (n.mastery_attainment || 0), 0) / nodeLogs.length
      : null;

    clusterLogs.push({
      cluster: cluster.cluster_label,
      cluster_ref: cluster.cluster_ref,
      required_proficiency: cluster.required_proficiency,
      mastery_threshold_pct: Math.round((cluster.mastery_threshold || 0.75) * 100),
      nodes_total: nodes.length,
      nodes_mastered: nodeLogs.filter(n => n.node_status === 'mastered').length,
      average_mastery_attainment: avgMastery ? Math.round(avgMastery) : null,
      simulation_readiness_flag: simulationReadiness,
      // ─── BLANK FIELDS — always present, always blank ─────────────────
      readiness_classification: null,  // OWNED BY COMMISSIONING CLIENT — ALWAYS BLANK
      external_score: null,            // OWNED BY ASSESSMENT PLATFORM — ALWAYS BLANK
      skill_nodes: nodeLogs
    });
  }

  // ─── Compile full Mastery Log ─────────────────────────────────────────────
  const masteryLog = {
    // Header
    document_type: 'Vak Mastery Log',
    version: '1.0',
    produced_by: 'Vak AI Technologies',
    produced_at: new Date().toISOString(),

    // Reference fields
    learner_reference: learner.learner_ref,
    learner_name: learner.name,
    capability_target_document_reference: `${engagement.ct_title} v${engagement.ct_version}`,
    engagement_id: engagementId,
    institution: engagement.institution_name,
    language_of_instruction: learner.language,

    // Summary
    total_clusters: clusterLogs.length,
    clusters_completed: clusterLogs.filter(c => c.nodes_mastered === c.nodes_total).length,
    overall_completion: clusterLogs.length > 0
      ? Math.round((clusterLogs.filter(c => c.nodes_mastered === c.nodes_total).length / clusterLogs.length) * 100)
      : 0,

    // Cluster-level evidence
    clusters: clusterLogs,

    // ─── PERMANENT BLANK FIELDS ─────────────────────────────────────────
    // These fields are ALWAYS BLANK — presence is intentional.
    // They signal that Vak produces evidence and stops there.
    // Readiness and scoring belong to the commissioning client.
    readiness_classification: null,  // ALWAYS BLANK — OWNED BY COMMISSIONING CLIENT
    external_score: null,            // ALWAYS BLANK — OWNED BY ASSESSMENT PLATFORM

    // Footer
    boundary_statement: 'This Mastery Log records capability movement and instruction evidence only. Readiness classification and external scoring are owned by the commissioning institution and are not populated by Vak AI Technologies under any circumstances.'
  };

  db.close();
  return masteryLog;
}

/**
 * Save a completed Mastery Log to the database
 */
function saveMasteryLog(engagementId, learnerId, logData) {
  const db = getDb();

  const engagement = db.prepare('SELECT capability_target_id FROM engagements WHERE id = ?').get(engagementId);
  const ct = db.prepare('SELECT title, version FROM capability_targets WHERE id = ?').get(engagement.capability_target_id);

  const id = uuidv4();
  db.prepare(`
    INSERT INTO mastery_logs (id, engagement_id, learner_id, capability_target_ref, log_data)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, engagementId, learnerId, `${ct.title} v${ct.version}`, JSON.stringify(logData));

  db.close();
  return id;
}

/**
 * Produce Mastery Logs for ALL learners in an engagement
 */
function produceEngagementMasteryLogs(engagementId) {
  const db = getDb();

  const engagementLearners = db.prepare(`
    SELECT el.learner_id FROM engagement_learners el WHERE el.engagement_id = ?
  `).all(engagementId);

  const logs = [];
  for (const el of engagementLearners) {
    const log = produceLearnerMasteryLog(engagementId, el.learner_id);
    const logId = saveMasteryLog(engagementId, el.learner_id, log);
    logs.push({ learner_id: el.learner_id, log_id: logId, log });
  }

  // Mark engagement as completed
  db.prepare(`UPDATE engagements SET status = 'completed', completed_at = datetime('now') WHERE id = ?`)
    .run(engagementId);

  db.close();
  return logs;
}

/**
 * Get a saved Mastery Log
 */
function getMasteryLog(logId) {
  const db = getDb();
  const record = db.prepare('SELECT * FROM mastery_logs WHERE id = ?').get(logId);
  db.close();
  if (!record) return null;
  return { ...record, log_data: JSON.parse(record.log_data) };
}

module.exports = {
  produceLearnerMasteryLog,
  saveMasteryLog,
  produceEngagementMasteryLogs,
  getMasteryLog
};
