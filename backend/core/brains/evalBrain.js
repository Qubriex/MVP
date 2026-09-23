// core/brains/evalBrain.js — EVAL: Mastery Evaluator
// The only brain that does NOT activate during instruction. Activates ONLY
// when the learner responds to a mastery check question. Temperature 0.3 —
// lower than TEACH — for deterministic evaluation.
const rubricStore = require('../stores/rubricStore');
const codeChallengeStore = require('../stores/codeChallengeStore');
const { getConceptTag } = require('./cultBrain');
const pythonSandbox = require('../sandbox/pythonSandbox');
const sqlSandbox = require('../sandbox/sqlSandbox');
const { callAI, safeParseJSON } = require('../instructionEngine');

const ADVANCE_THRESHOLD = 0.70;
const PERSISTENCE_LOOP_COUNT = 5;
const PERSISTENCE_THRESHOLD = 0.60;

function buildLLMOnlySystemPrompt(nodeLabel, language, rubric, passingExamples, failingExamples) {
  const passingBlock = passingExamples.length
    ? passingExamples.map((e, i) => `${i + 1}. "${e.response_text}" — scored ${e.score}`).join('\n')
    : 'None recorded yet.';
  const failingBlock = failingExamples.length
    ? failingExamples.map((e, i) => `${i + 1}. "${e.response_text}" — scored ${e.score}, gaps: ${e.gaps_identified}`).join('\n')
    : 'None recorded yet.';

  return `You are Professor Qubirex's mastery evaluator for the skill node "${nodeLabel}" (language of instruction: ${language}).

EVALUATION INTEGRITY RULE: Evaluate the QUALITY of understanding, not the fact of submission. A one-word or copied response scores 0.

RUBRIC — PASSING CRITERIA:
${rubric.passingCriteria.map(c => `- ${c}`).join('\n')}

RUBRIC — FAILING INDICATORS:
${rubric.failingIndicators.map(c => `- ${c}`).join('\n')}

EXAMPLES OF PASSING RESPONSES:
${passingBlock}

EXAMPLES OF FAILING RESPONSES:
${failingBlock}

SCORING RUBRIC:
0.9-1.0 -> ADVANCE (confident, correct application)
0.7-0.89 -> ADVANCE (understanding with minor gaps — log gaps)
0.5-0.69 -> LOOP (partial understanding)
0.0-0.49 -> LOOP (fundamental misunderstanding or no meaningful response)

THRESHOLD: score >= 0.70 -> passed=true. Exception: if loopCount >= 5 AND score >= 0.60 -> passed=true (learner has worked hard at a functional level).

GAP TAXONOMY (pick the gap type that most explains failure, and its recommended next approach):
${Object.entries(rubric.gapTaxonomy).map(([gap, v]) => `- ${gap} -> ${v.approach}: ${v.description}`).join('\n')}

Respond ONLY with this JSON:
{
  "passed": true | false,
  "score": 0.0,
  "evaluation": "what the learner understood and what they missed",
  "feedbackForLearner": "constructive feedback in the learner's language",
  "loopApproachIfFailed": "gap type that most explains failure",
  "recommendedApproach": "analogy | worked_example | decomposition | socratic | native_concept",
  "understandingGaps": ["specific gap 1", "specific gap 2"]
}`;
}

// ─── evaluateWithLLMOnly() ───────────────────────────────────────────────────
// The original path — used for every conceptual node that has no hidden-
// test-case challenge registered. The AI both scores and explains.
async function evaluateWithLLMOnly({ nodeLabel, language, question, learnerResponse, loopCount, meta = {} }) {
  const rubric = rubricStore.retrieveRubric(nodeLabel, language);
  const [passingExamples, failingExamples] = await Promise.all([
    Promise.resolve(rubricStore.retrieveExampleResponses(nodeLabel, language, 'pass', 2)),
    Promise.resolve(rubricStore.retrieveExampleResponses(nodeLabel, language, 'fail', 2))
  ]);

  const system = buildLLMOnlySystemPrompt(nodeLabel, language, rubric, passingExamples, failingExamples);
  const userMessage = `Mastery check question: "${question}"\n\nLearner's response: "${learnerResponse}"\n\nEvaluate this response for the skill node "${nodeLabel}".`;

  const text = await callAI({ system, userMessage, maxTokens: 1200, temperature: 0.3, meta: { ...meta, brain: 'EVAL' } });
  const parsed = safeParseJSON(text, {
    passed: false, score: 0.5, evaluation: text, feedbackForLearner: text,
    loopApproachIfFailed: 'concept_not_understood', recommendedApproach: 'native_concept', understandingGaps: []
  });

  const score = typeof parsed.score === 'number' ? parsed.score : 0.5;
  // Threshold is enforced here, authoritatively — never trusted blindly from the model.
  const passed = score >= ADVANCE_THRESHOLD || (loopCount >= PERSISTENCE_LOOP_COUNT && score >= PERSISTENCE_THRESHOLD);

  const result = { ...parsed, passed, score, gradedBy: 'llm_only', sandboxResult: null };

  rubricStore.writeEvaluation(nodeLabel, language, learnerResponse, passed ? 'pass' : 'fail', score, result.understandingGaps || []);

  return result;
}

// ─── buildSandboxFeedbackSystemPrompt() ──────────────────────────────────────
// Correctness is no longer the LLM's call for a code-execution node — the
// sandbox already ran the submission against hidden tests. The LLM's only
// job here is to explain the (already-known) result in the learner's
// language and, on failure, name which gap the failing tests point to.
function buildSandboxFeedbackSystemPrompt(nodeLabel, language, challenge, sandboxResult, gapTaxonomy) {
  const failedDetails = (sandboxResult.details || [])
    .filter(d => !d.passed)
    .map((d, i) => `${i + 1}. expected ${JSON.stringify(d.expected)}, got ${JSON.stringify(d.actual ?? null)}${d.error ? ` (error: ${d.error})` : ''}`)
    .join('\n') || 'None — all tests passed.';

  return `You are Professor Qubirex's mastery evaluator for the skill node "${nodeLabel}" (language of instruction: ${language}), a ${challenge.language === 'python' ? 'Python' : 'SQL'} code challenge.

CORRECTNESS HAS ALREADY BEEN DETERMINED OBJECTIVELY — ${sandboxResult.testsPassed}/${sandboxResult.testsRun} hidden tests passed by actually running the learner's code. Do NOT re-judge whether the answer is correct; that is not your job here. Your job is only to:
1. Explain, in ${language}, what the test results mean for this learner — what worked, what didn't.
2. If tests failed, identify the gap type that best explains WHY, from the taxonomy below.

TASK THE LEARNER WAS ASKED TO SOLVE:
${challenge.prompt}
${sandboxResult.sandboxError ? `\nSANDBOX ERROR (the code didn't run at all): ${sandboxResult.sandboxError}` : ''}

FAILED TEST DETAILS:
${failedDetails}

GAP TAXONOMY (pick the gap type that most explains failure, and its recommended next approach):
${Object.entries(gapTaxonomy).map(([gap, v]) => `- ${gap} -> ${v.approach}: ${v.description}`).join('\n')}

Respond ONLY with this JSON:
{
  "evaluation": "factual summary of what passed/failed and why",
  "feedbackForLearner": "constructive feedback in ${language}, referencing the actual test outcome",
  "loopApproachIfFailed": "gap type that most explains failure — ignored if all tests passed",
  "recommendedApproach": "analogy | worked_example | decomposition | socratic | native_concept",
  "understandingGaps": ["specific gap 1", "specific gap 2"]
}`;
}

// ─── evaluateWithSandbox() ────────────────────────────────────────────────────
async function evaluateWithSandbox({ challenge, nodeLabel, language, learnerResponse, loopCount, meta = {} }) {
  const tests = challenge.hidden_tests;
  const sandboxResult = challenge.language === 'python'
    ? await pythonSandbox.runPythonTests({ code: learnerResponse, functionName: challenge.function_name, tests, timeoutMs: challenge.timeout_ms })
    : sqlSandbox.runSqlTests({ fixtureSql: challenge.sql_fixture, learnerQuery: learnerResponse, tests });

  // The objective pass fraction IS the score — nothing the LLM says can move
  // a failing submission over threshold. This is the change the audit asked
  // for: an AI opinion layered on top of a fact, not standing in for one.
  const score = sandboxResult.testsRun > 0 ? sandboxResult.testsPassed / sandboxResult.testsRun : 0;
  const passed = score >= ADVANCE_THRESHOLD || (loopCount >= PERSISTENCE_LOOP_COUNT && score >= PERSISTENCE_THRESHOLD);

  const rubric = rubricStore.retrieveRubric(nodeLabel, language); // reuse its gap taxonomy only
  const system = buildSandboxFeedbackSystemPrompt(nodeLabel, language, challenge, sandboxResult, rubric.gapTaxonomy);
  const userMessage = `Learner's submission:\n\n${learnerResponse}`;

  const text = await callAI({ system, userMessage, maxTokens: 800, temperature: 0.3, meta: { ...meta, brain: 'EVAL' } });
  const parsed = safeParseJSON(text, {
    evaluation: `${sandboxResult.testsPassed}/${sandboxResult.testsRun} hidden tests passed.`,
    feedbackForLearner: text, loopApproachIfFailed: 'application_missing',
    recommendedApproach: 'worked_example', understandingGaps: []
  });

  const result = {
    ...parsed, passed, score, gradedBy: 'sandbox',
    sandboxResult: {
      testsRun: sandboxResult.testsRun, testsPassed: sandboxResult.testsPassed,
      details: sandboxResult.details, sandboxError: sandboxResult.sandboxError
    }
  };

  rubricStore.writeEvaluation(nodeLabel, language, learnerResponse, passed ? 'pass' : 'fail', score, result.understandingGaps || []);

  return result;
}

// ─── evaluate() ─────────────────────────────────────────────────────────────────
// Routes to the sandbox path when the node's concept tag has a registered
// code_challenges entry, else falls back to the original LLM-only path.
async function evaluate({ nodeLabel, language, question, learnerResponse, loopCount = 0, meta = {} }) {
  const conceptTag = getConceptTag(nodeLabel);
  const challenge = codeChallengeStore.getChallengeForConceptTag(conceptTag);

  if (challenge) {
    return evaluateWithSandbox({ challenge, nodeLabel, language, learnerResponse, loopCount, meta });
  }
  return evaluateWithLLMOnly({ nodeLabel, language, question, learnerResponse, loopCount, meta });
}

module.exports = { evaluate };
