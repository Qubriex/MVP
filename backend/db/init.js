// db/init.js — Database schema initialisation
const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './vak.db';

function getDb() {
  const db = new Database(path.resolve(DB_PATH));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function initDb() {
  const db = getDb();

  db.exec(`
    -- ─── INSTITUTIONS ─────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS institutions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN (
        'coding_bootcamp','engineering_college','corporate_ld',
        'government_skilling','ngo','vocational','other'
      )),
      contact_name TEXT,
      contact_email TEXT NOT NULL UNIQUE,
      contact_phone TEXT,
      city TEXT DEFAULT 'Hyderabad',
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      is_active INTEGER DEFAULT 1
    );

    -- ─── LEARNERS ─────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS learners (
      id TEXT PRIMARY KEY,
      institution_id TEXT NOT NULL REFERENCES institutions(id),
      name TEXT NOT NULL,
      email TEXT,
      learner_ref TEXT NOT NULL,
      language TEXT NOT NULL CHECK(language IN ('hindi','telugu')),
      profile_type TEXT CHECK(profile_type IN (
        'college_student','working_professional','bootcamp_participant',
        'skilling_program','career_switcher'
      )),
      current_capability_level TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      is_active INTEGER DEFAULT 1,
      UNIQUE(institution_id, learner_ref)
    );

    -- ─── CAPABILITY TARGET DOCUMENTS ─────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS capability_targets (
      id TEXT PRIMARY KEY,
      institution_id TEXT NOT NULL REFERENCES institutions(id),
      version TEXT NOT NULL,
      title TEXT NOT NULL,
      path TEXT NOT NULL CHECK(path IN ('A','B')),
      raw_input TEXT,
      extracted_targets TEXT,        -- JSON
      confirmed INTEGER DEFAULT 0,
      confirmed_at TEXT,
      time_window_weeks INTEGER,
      cohort_size INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      status TEXT DEFAULT 'pending' CHECK(status IN (
        'pending','confirmed','active','completed'
      ))
    );

    -- ─── SKILL CLUSTERS ───────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS skill_clusters (
      id TEXT PRIMARY KEY,
      capability_target_id TEXT NOT NULL REFERENCES capability_targets(id),
      cluster_label TEXT NOT NULL,
      cluster_ref TEXT,              -- institution's own label/number
      required_proficiency TEXT,
      mastery_threshold REAL DEFAULT 0.75,
      priority TEXT DEFAULT 'normal',
      evidence_type TEXT,
      sequence_order INTEGER DEFAULT 0
    );

    -- ─── SKILL NODES ──────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS skill_nodes (
      id TEXT PRIMARY KEY,
      cluster_id TEXT NOT NULL REFERENCES skill_clusters(id),
      node_label TEXT NOT NULL,
      description TEXT,
      prerequisite_node_ids TEXT,    -- JSON array of node IDs
      sequence_order INTEGER DEFAULT 0,
      difficulty_level INTEGER DEFAULT 1 CHECK(difficulty_level BETWEEN 1 AND 5),
      node_type TEXT DEFAULT 'concept' CHECK(node_type IN (
        'concept','applied','procedural','analytical'
      ))
    );

    -- ─── ENGAGEMENTS ──────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS engagements (
      id TEXT PRIMARY KEY,
      institution_id TEXT NOT NULL REFERENCES institutions(id),
      capability_target_id TEXT NOT NULL REFERENCES capability_targets(id),
      title TEXT NOT NULL,
      language TEXT NOT NULL CHECK(language IN ('hindi','telugu')),
      status TEXT DEFAULT 'setup' CHECK(status IN (
        'setup','active','completed','on_hold'
      )),
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- ─── ENGAGEMENT_LEARNERS ──────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS engagement_learners (
      id TEXT PRIMARY KEY,
      engagement_id TEXT NOT NULL REFERENCES engagements(id),
      learner_id TEXT NOT NULL REFERENCES learners(id),
      current_node_id TEXT,
      current_cluster_id TEXT,
      overall_status TEXT DEFAULT 'in_progress' CHECK(overall_status IN (
        'in_progress','completed','paused'
      )),
      enrolled_at TEXT DEFAULT (datetime('now')),
      UNIQUE(engagement_id, learner_id)
    );

    -- ─── LEARNING SESSIONS ────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS learning_sessions (
      id TEXT PRIMARY KEY,
      engagement_learner_id TEXT NOT NULL REFERENCES engagement_learners(id),
      skill_node_id TEXT NOT NULL REFERENCES skill_nodes(id),
      session_number INTEGER DEFAULT 1,
      language TEXT NOT NULL,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','completed')),
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      active_minutes REAL DEFAULT 0,
      loop_count INTEGER DEFAULT 0,
      explanation_approach TEXT DEFAULT 'native_concept'
        CHECK(explanation_approach IN (
          'native_concept','analogy','worked_example',
          'decomposition','simplified'
        ))
    );

    -- ─── SESSION MESSAGES ─────────────────────────────────────────────────────
    -- Full interaction log — Vak's proprietary data, never shared
    CREATE TABLE IF NOT EXISTS session_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES learning_sessions(id),
      role TEXT NOT NULL CHECK(role IN ('ai','learner')),
      content TEXT NOT NULL,
      message_type TEXT DEFAULT 'instruction' CHECK(message_type IN (
        'instruction','question','response','mastery_check',
        'feedback','loop_trigger','advance_trigger'
      )),
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- ─── MASTERY CHECKS ───────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS mastery_checks (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES learning_sessions(id),
      skill_node_id TEXT NOT NULL REFERENCES skill_nodes(id),
      engagement_learner_id TEXT NOT NULL REFERENCES engagement_learners(id),
      check_number INTEGER DEFAULT 1,
      question_text TEXT NOT NULL,
      learner_response TEXT,
      passed INTEGER,               -- 1 = advance, 0 = loop, NULL = pending
      score REAL,                   -- 0.0 to 1.0
      ai_evaluation TEXT,           -- AI's evaluation reasoning
      evaluated_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- ─── NODE MASTERY RECORDS ─────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS node_mastery (
      id TEXT PRIMARY KEY,
      engagement_learner_id TEXT NOT NULL REFERENCES engagement_learners(id),
      skill_node_id TEXT NOT NULL REFERENCES skill_nodes(id),
      mastery_attainment REAL,       -- 0.0 to 1.0
      time_to_mastery_minutes REAL,
      attempt_count INTEGER DEFAULT 0,
      confidence_indicator REAL,     -- 0.0 to 1.0 — stability measure
      advanced_at TEXT,
      UNIQUE(engagement_learner_id, skill_node_id)
    );

    -- ─── MASTERY LOGS ─────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS mastery_logs (
      id TEXT PRIMARY KEY,
      engagement_id TEXT NOT NULL REFERENCES engagements(id),
      learner_id TEXT NOT NULL REFERENCES learners(id),
      capability_target_ref TEXT NOT NULL,
      produced_at TEXT DEFAULT (datetime('now')),
      -- These two fields are ALWAYS blank — owned by commissioning client
      readiness_classification TEXT DEFAULT NULL,
      external_score TEXT DEFAULT NULL,
      log_data TEXT,                 -- JSON: full structured log
      delivered INTEGER DEFAULT 0,
      delivered_at TEXT
    );

    -- ─── ADMIN USERS ──────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'admin',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  console.log('✅ Database initialised at:', DB_PATH);
  db.close();
}

module.exports = { getDb, initDb };
