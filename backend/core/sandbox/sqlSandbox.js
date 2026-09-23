// core/sandbox/sqlSandbox.js — objective grading for SQL mastery checks
//
// Runs the learner's SELECT against a fresh in-memory SQLite database seeded
// only with the challenge's fixture tables — never the real qubirex.db, so
// there is no path from a learner's query to any real institution or
// learner data. Read-only by construction (query_only pragma), so this
// carries none of the process-isolation caveats pythonSandbox.js documents.
//
// Known limitation: better-sqlite3 executes synchronously on the Node event
// loop, so there is no way to hard-kill a single slow query the way the
// Python sandbox can SIGKILL a subprocess. A pathological query (e.g. an
// unconstrained cross join) can block the process for its duration. Query
// fixtures are small and authored by the content team, not learners, which
// keeps this low-risk for a pilot; if abuse becomes a concern, move this
// into the same subprocess-with-timeout model the Python sandbox uses.
const Database = require('better-sqlite3');

function isSelectOnly(query) {
  const trimmed = (query || '').trim();
  if (!/^select\b/i.test(trimmed)) return false;
  // Reject statement-chaining and anything that touches state or other DBs.
  if (/;\s*\S/.test(trimmed)) return false; // more content after a semicolon
  if (/\b(attach|detach|pragma|insert|update|delete|drop|create|alter)\b/i.test(trimmed)) return false;
  return true;
}

function rowsEqual(a, b) {
  if (a.length !== b.length) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Run `learnerQuery` against a scratch DB seeded with `fixtureSql`, and
 * compare its result rows to each test's `expected_rows`. Usually a SQL
 * challenge has exactly one test (the fixture already encodes the scenario),
 * but multiple are supported for query variants.
 * Returns the same shape as runPythonTests(): { testsRun, testsPassed, details, sandboxError }.
 */
function runSqlTests({ fixtureSql, learnerQuery, tests }) {
  if (!isSelectOnly(learnerQuery)) {
    return { testsRun: tests.length, testsPassed: 0, details: [], sandboxError: 'Only a single SELECT statement is allowed.' };
  }

  let db;
  try {
    db = new Database(':memory:');
    db.pragma('query_only = OFF'); // fixture setup needs writes; flipped to ON before running the learner's query
    db.exec(fixtureSql);
    db.pragma('query_only = ON');

    const details = tests.map(t => {
      try {
        const actual = db.prepare(learnerQuery).all();
        return { passed: rowsEqual(actual, t.expected_rows || []), expected: t.expected_rows, actual };
      } catch (err) {
        return { passed: false, expected: t.expected_rows, error: err.message };
      }
    });

    return { testsRun: details.length, testsPassed: details.filter(d => d.passed).length, details, sandboxError: null };
  } catch (err) {
    return { testsRun: tests.length, testsPassed: 0, details: [], sandboxError: `Sandbox error: ${err.message}` };
  } finally {
    if (db) db.close();
  }
}

module.exports = { runSqlTests };
