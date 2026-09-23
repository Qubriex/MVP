// core/instructionEngine.js
// ─────────────────────────────────────────────────────────────────────────────
// QUBIREX INSTRUCTION ENGINE — shared utilities used across all six brains.
//
// This module holds NO teaching logic of its own. It exports:
//   - callAI(): the single Gemini API wrapper every brain calls through
//   - getMasteryIncrement(): mastery scoring on ADVANCE
//   - selectNextApproach(): loop approach rotation — never repeat at a node
//   - calculateMasteryAttainment() / calculateConfidenceIndicator() /
//     calculateSimulationReadiness(): Mastery Log math
//   - safeParseJSON(): defensive parsing of every AI response
//
// Three-verb model: RECEIVE the brief -> BUILD the capability -> RETURN the
// Mastery Log. Mastery gates progression, never elapsed time.
// ─────────────────────────────────────────────────────────────────────────────

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/init');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL_NAME = 'gemini-3.6-flash';

// Per-1K-token pricing is intentionally unset by default (0), not guessed —
// a cost report reading $0.00 is an honest "not configured yet", never a
// fabricated number. Set these once real Gemini pricing for this model is
// confirmed, to get real estimates out of /admin's cost report.
const INPUT_PRICE_PER_1K_USD = parseFloat(process.env.GEMINI_INPUT_PRICE_PER_1K_USD || '0');
const OUTPUT_PRICE_PER_1K_USD = parseFloat(process.env.GEMINI_OUTPUT_PRICE_PER_1K_USD || '0');

// ─── ai_call_log instrumentation ──────────────────────────────────────────────
function logAICall({ brain, meta = {}, usage, latencyMs, error }) {
  try {
    const db = getDb();
    const promptTokens = usage ? usage.promptTokenCount : null;
    const completionTokens = usage ? usage.candidatesTokenCount : null;
    const totalTokens = usage ? usage.totalTokenCount : null;
    const estimatedCostUsd = usage
      ? (promptTokens / 1000) * INPUT_PRICE_PER_1K_USD + (completionTokens / 1000) * OUTPUT_PRICE_PER_1K_USD
      : null;

    db.prepare(`
      INSERT INTO ai_call_log (id, brain, turn_id, session_id, learner_id, node_id, model, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd, latency_ms, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(), brain || 'unknown', meta.turnId || null, meta.sessionId || null, meta.learnerId || null, meta.nodeId || null,
      MODEL_NAME, promptTokens, completionTokens, totalTokens, estimatedCostUsd, latencyMs, error || null
    );
    db.close();
  } catch (logErr) {
    // Instrumentation must never take down the AI call it's observing.
    console.error('ai_call_log write failed:', logErr.message);
  }
}

// ─── Five explanation approaches — tried in order, never repeated at a node ──
const EXPLANATION_APPROACHES = [
  'native_concept',   // Default: cultural example is the PRIMARY entry point
  'analogy',          // One powerful everyday analogy — market, cricket, cooking, transport, family
  'worked_example',   // Show the complete example first, then reverse-engineer
  'decomposition',    // Missing prerequisite — teach it first via a familiar example
  'socratic'          // No explanation — questions that guide the learner to the concept
];

// ─── Gemini API wrapper ───────────────────────────────────────────────────────
// systemInstruction and userMessage are kept as two separate arguments —
// callers assemble RAG context into userMessage; system holds the persona
// and response-format rules.
//
// meta is optional attribution for instrumentation: { brain, turnId,
// sessionId, learnerId, nodeId }. Every call — success or failure — writes
// one row to ai_call_log with token counts, latency, and (if pricing is
// configured) an estimated cost; a failure is logged with the error message
// and null token counts, then rethrown unchanged so existing error handling
// at every call site is untouched.
async function callAI({ system, userMessage, maxTokens = 1024, temperature = 0.7, meta = {} }) {
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: system,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      responseMimeType: 'text/plain'
    }
  });

  const startedAt = Date.now();
  try {
    const result = await model.generateContent(userMessage);
    logAICall({ brain: meta.brain, meta, usage: result.response.usageMetadata, latencyMs: Date.now() - startedAt });
    return result.response.text();
  } catch (err) {
    logAICall({ brain: meta.brain, meta, usage: null, latencyMs: Date.now() - startedAt, error: err.message });
    throw err;
  }
}

// ─── safeParseJSON() ──────────────────────────────────────────────────────────
// All AI responses go through this. Strips markdown fences before parsing.
// Returns the fallback object on any parse error — the system never crashes
// on a malformed AI response.
function safeParseJSON(text, fallback = {}) {
  if (!text) return fallback;
  try {
    const stripped = text.trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/```\s*$/, '');
    return JSON.parse(stripped);
  } catch {
    return fallback;
  }
}

// ─── getMasteryIncrement() ────────────────────────────────────────────────────
// Increment decreases with more loops — rewards prompt mastery.
// Random range within each tier prevents exact patterns.
function getMasteryIncrement(loopCount) {
  if (loopCount === 0) return 22 + Math.floor(Math.random() * 4);   // 22-25
  if (loopCount <= 2) return 15 + Math.floor(Math.random() * 4);    // 15-18
  if (loopCount <= 4) return 10 + Math.floor(Math.random() * 4);    // 10-13
  return 7 + Math.floor(Math.random() * 4);                        // 7-10
}

// ─── selectNextApproach() ─────────────────────────────────────────────────────
// Returns first approach from EXPLANATION_APPROACHES not in usedApproaches.
// If all 5 have been used, returns any approach not equal to the last one used.
// Never returns undefined — always a valid approach.
function selectNextApproach(usedApproaches = []) {
  const next = EXPLANATION_APPROACHES.find(a => !usedApproaches.includes(a));
  if (next) return next;
  const lastUsed = usedApproaches[usedApproaches.length - 1];
  return EXPLANATION_APPROACHES.find(a => a !== lastUsed) || EXPLANATION_APPROACHES[0];
}

// ─── calculateMasteryAttainment() ─────────────────────────────────────────────
// Weighted average of mastery check scores across all attempts at a node.
// Recent attempts are weighted more heavily using exponential weights (1.5^i).
function calculateMasteryAttainment(checkResults) {
  if (!checkResults || checkResults.length === 0) return 0;

  const weights = checkResults.map((_, i) => Math.pow(1.5, i));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const weightedScore = checkResults.reduce((sum, check, i) => {
    return sum + (check.score || 0) * weights[i];
  }, 0);

  return Math.min(1.0, weightedScore / totalWeight);
}

// ─── calculateConfidenceIndicator() ───────────────────────────────────────────
// Composite: passRate x 0.5 + loopPenalty x 0.3 + consistencyBonus x 0.2
function calculateConfidenceIndicator(checkResults, loopCount) {
  if (!checkResults || checkResults.length === 0) return 0;

  const passedChecks = checkResults.filter(c => c.passed);
  const passRate = passedChecks.length / checkResults.length;
  const loopPenalty = Math.max(0, 1 - (loopCount * 0.1));
  const scoreVariance = computeVariance(checkResults.map(c => c.score || 0));
  const consistencyBonus = Math.max(0, 1 - scoreVariance * 2);

  return Math.min(1.0, passRate * 0.5 + loopPenalty * 0.3 + consistencyBonus * 0.2);
}

function computeVariance(arr) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
}

// ─── calculateSimulationReadiness() ───────────────────────────────────────────
// true if ALL: every node mastery >= 0.70, avg mastery >= 0.75, avg confidence >= 0.60
function calculateSimulationReadiness(nodeMasteryRecords) {
  if (!nodeMasteryRecords || nodeMasteryRecords.length === 0) return false;

  const avgMastery = nodeMasteryRecords.reduce((s, n) => s + (n.mastery_attainment || 0), 0) / nodeMasteryRecords.length;
  const avgConfidence = nodeMasteryRecords.reduce((s, n) => s + (n.confidence_indicator || 0), 0) / nodeMasteryRecords.length;
  const allNodesComplete = nodeMasteryRecords.every(n => n.mastery_attainment >= 0.70);

  return allNodesComplete && avgMastery >= 0.75 && avgConfidence >= 0.60;
}

module.exports = {
  callAI,
  safeParseJSON,
  getMasteryIncrement,
  selectNextApproach,
  calculateMasteryAttainment,
  calculateConfidenceIndicator,
  calculateSimulationReadiness,
  EXPLANATION_APPROACHES
};
