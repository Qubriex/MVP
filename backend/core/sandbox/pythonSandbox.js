// core/sandbox/pythonSandbox.js — objective grading for Python mastery checks
//
// Runs learner-submitted code against hidden test cases in a subprocess and
// reports pass/fail per test. This replaces "the LLM says it's correct" with
// "it actually ran and produced the right output" for the pilot's Python
// bundle — the single highest-leverage fix from the Sep 2026 technical audit.
//
// WHAT THIS DOES guard against: runaway/infinite loops (hard timeout +
// SIGKILL), output flooding (maxBuffer), and secrets leaking into the child
// via environment variables (only PATH is passed through — no JWT_SECRET,
// GEMINI_API_KEY, or DB_PATH).
//
// WHAT THIS DOES NOT guard against: a learner deliberately trying to break
// out of the sandbox. The child process runs as the SAME OS user as the
// backend (no container, VM, or namespace isolation — none of that
// infrastructure exists in this repo), so filesystem/network access from
// Python is only as restricted as the host process's own permissions are.
// That is adequate for a small, known pilot cohort; it is NOT adequate once
// this is exposed to an adversarial or anonymous audience. Before scaling
// past the pilot, replace this with a real isolation layer (nsjail, gVisor,
// Firecracker microVMs, or a hosted execution API such as Judge0/Piston).
// Operationally: never run the backend process itself as root — that alone
// meaningfully limits what a sandbox escape could reach.
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';

// Defense-in-depth only — not a security boundary by itself (trivially
// bypassable by a determined adversary), but it turns "accidentally imports
// os to check the platform" into an immediate, clear rejection instead of a
// silent sandbox-adjacent operation.
const BLOCKED_PATTERNS = [
  /\bimport\s+os\b/, /\bimport\s+subprocess\b/, /\bimport\s+socket\b/,
  /\bimport\s+sys\b/, /\bimport\s+shutil\b/, /\b__import__\s*\(/,
  /\bopen\s*\(/, /\beval\s*\(/, /\bexec\s*\(/
];

function buildHarness(functionName, tests) {
  return `
import json

results = []
try:
    import solution
except Exception as e:
    print(json.dumps({"importError": str(e), "results": []}))
    raise SystemExit(0)

fn = getattr(solution, ${JSON.stringify(functionName)}, None)
if fn is None:
    print(json.dumps({"importError": "function " + ${JSON.stringify(functionName)} + " not found", "results": []}))
    raise SystemExit(0)

tests = json.loads(${JSON.stringify(JSON.stringify(tests))})

for t in tests:
    try:
        actual = fn(*t.get("args", []))
        results.append({"passed": actual == t.get("expected"), "expected": t.get("expected"), "actual": actual})
    except Exception as e:
        results.append({"passed": False, "expected": t.get("expected"), "error": str(e)})

print(json.dumps({"importError": None, "results": results}))
`;
}

/**
 * Run `code` (must define a function named `functionName`) against `tests`,
 * an array of { args: [...], expected: <json-serializable> }.
 * Returns { testsRun, testsPassed, details: [{passed, expected, actual?, error?}], sandboxError }.
 * sandboxError is set (and details empty) if the code never ran at all —
 * import failure, missing function, timeout, or a blocked pattern.
 */
async function runPythonTests({ code, functionName, tests, timeoutMs = 5000 }) {
  if (!functionName) return { testsRun: tests.length, testsPassed: 0, details: [], sandboxError: 'No function name configured for this challenge.' };

  const blocked = BLOCKED_PATTERNS.find(p => p.test(code || ''));
  if (blocked) {
    return { testsRun: tests.length, testsPassed: 0, details: [], sandboxError: 'Submission uses a disallowed operation (file, process, or network access).' };
  }

  const tmpDir = path.join(os.tmpdir(), `qubirex-py-${crypto.randomBytes(8).toString('hex')}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    fs.writeFileSync(path.join(tmpDir, 'solution.py'), code || '');
    fs.writeFileSync(path.join(tmpDir, 'harness.py'), buildHarness(functionName, tests));

    const stdout = await new Promise((resolve, reject) => {
      execFile(
        PYTHON_BIN,
        ['harness.py'],
        {
          cwd: tmpDir,
          timeout: timeoutMs,
          killSignal: 'SIGKILL',
          maxBuffer: 1024 * 1024,
          env: { PATH: process.env.PATH }
        },
        (err, out) => {
          if (err) return reject(err);
          resolve(out);
        }
      );
    });

    const parsed = JSON.parse(stdout.trim().split('\n').pop());
    if (parsed.importError) {
      return { testsRun: tests.length, testsPassed: 0, details: [], sandboxError: parsed.importError };
    }

    const details = parsed.results || [];
    return { testsRun: details.length, testsPassed: details.filter(d => d.passed).length, details, sandboxError: null };
  } catch (err) {
    const timedOut = err.killed || err.signal === 'SIGKILL';
    return {
      testsRun: tests.length, testsPassed: 0, details: [],
      sandboxError: timedOut ? `Execution timed out after ${timeoutMs}ms (possible infinite loop).` : `Sandbox error: ${err.message}`
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

module.exports = { runPythonTests };
