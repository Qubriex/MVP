// core/instructionEngine.js
// ─────────────────────────────────────────────────────────────────────────────
// VAK INSTRUCTION ENGINE — The Three Laws: RECEIVE · BUILD · RETURN
//
// Core operating constraint:
// - Explanations are CONSTRUCTED natively in Hindi/Telugu — never translated
// - English technical term introduced AFTER concept is understood
// - Advancement gated on demonstrated mastery, not elapsed time
// - Loop uses a DIFFERENT approach each time — never repeats same explanation
// ─────────────────────────────────────────────────────────────────────────────

const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Language system prompts ──────────────────────────────────────────────────
const LANGUAGE_CONTEXTS = {
  hindi: {
    lang_name: 'Hindi',
    native_script_note: 'Use Devanagari script with Roman transliteration where helpful. Cultural references should be familiar to a North Indian learner.',
    greeting: 'नमस्ते',
    encouragement: ['बहुत अच्छा!', 'शाबाश!', 'बिल्कुल सही!', 'अब आगे बढ़ते हैं।'],
    try_again: 'चलिए एक बार फिर से समझते हैं।',
    understood_check: 'क्या आप समझ गए?'
  },
  telugu: {
    lang_name: 'Telugu',
    native_script_note: 'Use Telugu script with Roman transliteration where helpful. Cultural references should be familiar to a Telugu-speaking learner from Telangana/Andhra.',
    greeting: 'నమస్కారం',
    encouragement: ['చాలా బాగుంది!', 'అద్భుతం!', 'సరిగ్గా చెప్పారు!', 'ముందుకు వెళ్దాం।'],
    try_again: 'మళ్ళీ ఒకసారి అర్థం చేసుకుందాం.',
    understood_check: 'అర్థమైందా?'
  }
};

// ─── Explanation approaches (loop variations) ────────────────────────────────
const EXPLANATION_APPROACHES = [
  'native_concept',   // Default: build from familiar native-language context
  'analogy',          // Use a vivid everyday analogy from the learner's world
  'worked_example',   // Walk through a complete example step by step
  'decomposition',    // Break the concept into smaller preceding micro-skills
  'simplified'        // Strip to absolute minimum, rebuild from ground up
];

// ─── SYSTEM PROMPT — Instruction Agent ───────────────────────────────────────
function buildInstructionSystemPrompt(language, approach, nodeLabel, clusterLabel) {
  const ctx = LANGUAGE_CONTEXTS[language];
  return `You are Vak's AI instruction engine. You teach in ${ctx.lang_name} natively.

FUNDAMENTAL RULE — ARCHITECTURE CONSTRAINT:
You do NOT translate from English. You construct explanations FROM SCRATCH in ${ctx.lang_name}.
The cognitive frame, examples, and entry point must be designed for a ${ctx.lang_name}-speaking learner.
The English technical term is introduced ONLY AFTER the concept is understood in ${ctx.lang_name}.

CURRENT SKILL NODE: "${nodeLabel}" (part of cluster: "${clusterLabel}")
LANGUAGE: ${ctx.lang_name}
${ctx.native_script_note}
EXPLANATION APPROACH THIS SESSION: ${approach}

APPROACH GUIDELINES:
- native_concept: Build from a culturally familiar entry point. What does this concept FEEL LIKE to someone who grew up thinking in ${ctx.lang_name}?
- analogy: Choose one powerful everyday analogy from the learner's actual life — market, cricket, cooking, family, farming, local technology. Make it visceral.
- worked_example: Show a complete worked example BEFORE explaining the abstract concept. Concrete before abstract.
- decomposition: The learner is stuck because a prerequisite concept is missing. Identify and teach the smaller concept first.
- simplified: Strip everything away. One sentence. One idea. Build back up from there.

INSTRUCTION FLOW:
1. Open in ${ctx.lang_name} — set the context natively
2. Introduce concept through the chosen approach
3. Build understanding progressively
4. Introduce English technical term AFTER understanding is established
5. Confirm understanding with: ${ctx.understood_check}
6. NEVER advance unless mastery check passes

MASTERY CHECK DESIGN:
- The mastery check must require the learner to USE the concept, not recall it
- Ask one applied question — not "what is X" but "here is situation Y, how would you use X?"
- Score responses on quality of understanding, not just keyword matching
- Partial credit: if response shows partial understanding, give targeted feedback and ask again

Always respond with a JSON object in this exact format:
{
  "message": "Your ${ctx.lang_name} instruction text here",
  "message_type": "instruction | mastery_check | feedback | advance_trigger | loop_trigger",
  "mastery_check_question": "The applied question if message_type is mastery_check (null otherwise)",
  "loop_reason": "Why this response needs a loop (null if advancing)",
  "suggested_next_approach": "next approach if looping (null if advancing)",
  "english_term_introduced": true | false,
  "confidence_in_understanding": 0.0-1.0
}`;
}

// ─── SYSTEM PROMPT — Mastery Evaluator ───────────────────────────────────────
function buildEvaluatorSystemPrompt(language, nodeLabel) {
  const ctx = LANGUAGE_CONTEXTS[language];
  return `You are Vak's mastery evaluator for the skill node: "${nodeLabel}".

Your single job: determine whether the learner's response demonstrates genuine understanding sufficient to advance.

EVALUATION RULE — MASTERY CHECK INTEGRITY:
A check that advances a learner based on completion (ANY response) is NOT a mastery check — it is a progress tracker.
You must evaluate the QUALITY of understanding, not the fact of submission.

LANGUAGE: The learner responds in ${ctx.lang_name} or a mix of ${ctx.lang_name} and English. Both are acceptable.

SCORING RUBRIC:
- 0.9–1.0: Learner demonstrates confident, correct application. Advance.
- 0.7–0.89: Learner demonstrates understanding with minor gaps. Advance (log gaps for follow-up).
- 0.5–0.69: Partial understanding. Loop with targeted correction.
- 0.0–0.49: Fundamental misunderstanding or no meaningful response. Loop from a different angle.

THRESHOLD: Score ≥ 0.70 = ADVANCE. Score < 0.70 = LOOP.

Respond ONLY with this JSON:
{
  "passed": true | false,
  "score": 0.0-1.0,
  "evaluation": "Your assessment of what the learner understood and what they missed",
  "feedback_for_learner": "Specific, constructive feedback in ${ctx.lang_name}",
  "loop_approach_if_failed": "analogy | worked_example | decomposition | simplified",
  "understanding_gaps": ["list of specific gaps if any"]
}`;
}

// ─── Core engine functions ────────────────────────────────────────────────────

/**
 * Generate an instruction message for a skill node
 */
async function generateInstruction({
  nodeLabel,
  clusterLabel,
  language,
  approach = 'native_concept',
  conversationHistory = [],
  loopCount = 0
}) {
  const systemPrompt = buildInstructionSystemPrompt(language, approach, nodeLabel, clusterLabel);

  const userMessage = conversationHistory.length === 0
    ? `Begin teaching the skill node "${nodeLabel}". This is loop attempt ${loopCount + 1}. Use the ${approach} approach.`
    : `Continue the instruction. This is loop attempt ${loopCount + 1}. Use the ${approach} approach.`;

  const messages = [
    ...conversationHistory.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content })),
    { role: 'user', content: userMessage }
  ];

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages
  });

  const text = response.content[0].text;
  try {
    return JSON.parse(text);
  } catch {
    // Fallback if JSON parse fails
    return {
      message: text,
      message_type: 'instruction',
      mastery_check_question: null,
      loop_reason: null,
      suggested_next_approach: null,
      english_term_introduced: false,
      confidence_in_understanding: 0.5
    };
  }
}

/**
 * Generate a mastery check question
 */
async function generateMasteryCheck({ nodeLabel, clusterLabel, language, conversationHistory = [] }) {
  const systemPrompt = buildInstructionSystemPrompt(language, 'native_concept', nodeLabel, clusterLabel);
  const ctx = LANGUAGE_CONTEXTS[language];

  const messages = [
    ...conversationHistory.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content })),
    {
      role: 'user',
      content: `Now generate a mastery check question for "${nodeLabel}". The question must require the learner to USE the concept, not recall it. Frame it as a realistic scenario. Ask in ${ctx.lang_name}.`
    }
  ];

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    system: systemPrompt,
    messages
  });

  const text = response.content[0].text;
  try {
    const parsed = JSON.parse(text);
    return parsed;
  } catch {
    return {
      message: text,
      message_type: 'mastery_check',
      mastery_check_question: text
    };
  }
}

/**
 * Evaluate a learner's mastery check response
 * CORE GATE: this determines ADVANCE or LOOP
 */
async function evaluateMasteryResponse({
  nodeLabel,
  language,
  question,
  learnerResponse,
  conversationHistory = []
}) {
  const systemPrompt = buildEvaluatorSystemPrompt(language, nodeLabel);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Mastery check question: "${question}"\n\nLearner's response: "${learnerResponse}"\n\nEvaluate this response for the skill node "${nodeLabel}".`
      }
    ]
  });

  const text = response.content[0].text;
  try {
    return JSON.parse(text);
  } catch {
    return {
      passed: false,
      score: 0.5,
      evaluation: text,
      feedback_for_learner: text,
      loop_approach_if_failed: 'analogy',
      understanding_gaps: []
    };
  }
}

/**
 * Decompose a cluster into skill nodes
 * Called during pathway design
 */
async function decomposeClusterToNodes({ clusterLabel, clusterDescription, proficiencyLevel, language }) {
  const ctx = LANGUAGE_CONTEXTS[language];
  const systemPrompt = `You are Vak's pathway designer. Given a skill cluster, decompose it into ordered skill nodes — the micro-skill graph.

Rules:
- Each node is one atomic, teachable concept
- Foundational nodes come before applied nodes
- Prerequisite relationships must be respected
- Nodes should be teachable in 15–30 minutes of active instruction
- Design for ${ctx.lang_name}-language learners who may have weaker English backgrounds

Respond ONLY with JSON:
{
  "nodes": [
    {
      "label": "Node name",
      "description": "What this node teaches",
      "sequence_order": 1,
      "difficulty_level": 1-5,
      "node_type": "concept|applied|procedural|analytical",
      "prerequisite_indices": [0, 1]
    }
  ],
  "total_estimated_minutes": 0,
  "cluster_summary": "Brief description of what this cluster builds"
}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `Cluster: "${clusterLabel}"\nDescription: "${clusterDescription || 'As specified in the capability target'}"\nRequired proficiency level: "${proficiencyLevel || 'intermediate'}"\nTarget language: ${ctx.lang_name}`
    }]
  });

  try {
    return JSON.parse(response.content[0].text);
  } catch {
    return { nodes: [], total_estimated_minutes: 0, cluster_summary: '' };
  }
}

/**
 * Extract capability targets from unstructured input (Path B)
 * Human-assisted at MVP stage — AI does the first pass
 */
async function extractCapabilityTargets(rawInput) {
  const systemPrompt = `You are Vak's Path B ingestion processor. Extract structured capability targets from any input format.

Input may be: curriculum document, job description, skills list, competency matrix, government framework, or plain text.

Extract:
1. What skills/knowledge needs to be built (skill clusters)
2. Required proficiency level per cluster
3. Time constraint if stated
4. Evidence type required (what will learners be assessed on)

Respond ONLY with JSON:
{
  "title": "Inferred engagement title",
  "clusters": [
    {
      "label": "Skill cluster name",
      "description": "What this cluster covers",
      "required_proficiency": "beginner|intermediate|advanced",
      "priority": "high|normal|low",
      "evidence_type": "What applied performance this builds toward",
      "mastery_threshold": 0.75
    }
  ],
  "time_window_weeks": null,
  "cohort_description": "Who the learners are, if stated",
  "extraction_confidence": 0.0-1.0,
  "ambiguities": ["List any ambiguous areas needing confirmation"],
  "confirmation_summary": "A clear summary to send to the client for confirmation before instruction begins"
}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Extract capability targets from this input:\n\n${rawInput}` }]
  });

  try {
    return JSON.parse(response.content[0].text);
  } catch {
    return { clusters: [], extraction_confidence: 0, ambiguities: [], confirmation_summary: '' };
  }
}

/**
 * Calculate mastery attainment score (recency-weighted)
 */
function calculateMasteryAttainment(checkResults) {
  if (!checkResults || checkResults.length === 0) return 0;

  // More recent checks weighted higher
  const weights = checkResults.map((_, i) => Math.pow(1.5, i));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const weightedScore = checkResults.reduce((sum, check, i) => {
    return sum + (check.score || 0) * weights[i];
  }, 0);

  return Math.min(1.0, weightedScore / totalWeight);
}

/**
 * Calculate confidence indicator — mastery stability measure
 * High = consistent mastery from first attempt
 * Low = variable performance, needed many loops
 */
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

/**
 * Determine simulation readiness flag for a cluster
 * Binary signal: ready / not ready based on mastery pattern
 */
function calculateSimulationReadiness(nodeMasteryRecords) {
  if (!nodeMasteryRecords || nodeMasteryRecords.length === 0) return false;

  const avgMastery = nodeMasteryRecords.reduce((s, n) => s + (n.mastery_attainment || 0), 0) / nodeMasteryRecords.length;
  const avgConfidence = nodeMasteryRecords.reduce((s, n) => s + (n.confidence_indicator || 0), 0) / nodeMasteryRecords.length;
  const allNodesComplete = nodeMasteryRecords.every(n => n.mastery_attainment >= 0.70);

  return allNodesComplete && avgMastery >= 0.75 && avgConfidence >= 0.60;
}

/**
 * Select next loop approach — never repeat the same approach
 */
function selectNextApproach(currentApproach, previousApproaches = []) {
  const remaining = EXPLANATION_APPROACHES.filter(a =>
    a !== currentApproach && !previousApproaches.includes(a)
  );
  if (remaining.length === 0) {
    // All approaches exhausted — cycle through
    return EXPLANATION_APPROACHES.find(a => a !== currentApproach) || 'analogy';
  }
  return remaining[0];
}

module.exports = {
  generateInstruction,
  generateMasteryCheck,
  evaluateMasteryResponse,
  decomposeClusterToNodes,
  extractCapabilityTargets,
  calculateMasteryAttainment,
  calculateConfidenceIndicator,
  calculateSimulationReadiness,
  selectNextApproach,
  EXPLANATION_APPROACHES,
  LANGUAGE_CONTEXTS
};
