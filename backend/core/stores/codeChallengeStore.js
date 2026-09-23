// core/stores/codeChallengeStore.js — EVAL brain's code-execution challenge store
// Table: code_challenges (schema owned by db/init.js). Seed/retrieval mirror
// culturalStore.js's concept_tag pattern so one seeded challenge is reusable
// across every node, in every engagement, that teaches the same concept.
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../../db/init');

// ─── Seed challenges — pilot bundle is Python + SQL (audit Section 9 ICP) ────
// Kept deliberately small: only concept tags where "hidden test case" grading
// is unambiguous. Concepts like git/inheritance/api_json stay LLM-evaluated —
// forcing every concept into this shape would trade one kind of dishonesty
// (an AI grading itself) for another (a challenge that doesn't really test
// the concept it claims to).
const SEED_CHALLENGES = [
  {
    tag: 'loops', language: 'python', functionName: 'sum_to_n',
    prompt: 'Write a Python function named sum_to_n(n) that returns the sum of all integers from 1 to n (inclusive), using a loop.',
    tests: [{ args: [5], expected: 15 }, { args: [1], expected: 1 }, { args: [10], expected: 55 }]
  },
  {
    tag: 'conditionals', language: 'python', functionName: 'grade_for',
    prompt: 'Write a Python function named grade_for(marks) that returns "pass" if marks >= 40, else "fail".',
    tests: [{ args: [72], expected: 'pass' }, { args: [40], expected: 'pass' }, { args: [39], expected: 'fail' }]
  },
  {
    tag: 'functions', language: 'python', functionName: 'celsius_to_fahrenheit',
    prompt: 'Write a Python function named celsius_to_fahrenheit(c) that converts Celsius to Fahrenheit: F = C * 9/5 + 32.',
    tests: [{ args: [0], expected: 32 }, { args: [100], expected: 212 }, { args: [37], expected: 98.6 }]
  },
  {
    tag: 'lists', language: 'python', functionName: 'second_largest',
    prompt: 'Write a Python function named second_largest(nums) that returns the second-largest distinct value in a list of integers.',
    tests: [{ args: [[3, 1, 4, 1, 5, 9, 2]], expected: 5 }, { args: [[10, 20]], expected: 10 }]
  },
  {
    tag: 'strings', language: 'python', functionName: 'count_vowels',
    prompt: 'Write a Python function named count_vowels(s) that returns the number of vowels (a, e, i, o, u — case-insensitive) in a string.',
    tests: [{ args: ['hello world'], expected: 3 }, { args: ['xyz'], expected: 0 }, { args: ['AEIOU'], expected: 5 }]
  },
  {
    tag: 'sql_select', language: 'sql',
    prompt: 'Write a single SELECT statement that returns the name and marks of every student in the "students" table who scored more than 50, ordered by name.',
    sqlFixture: `
      CREATE TABLE students (id INTEGER, name TEXT, marks INTEGER);
      INSERT INTO students VALUES (1,'Asha',88),(2,'Ravi',45),(3,'Priya',92),(4,'Kiran',30);
    `,
    tests: [{ expected_rows: [{ name: 'Asha', marks: 88 }, { name: 'Priya', marks: 92 }] }]
  },
  {
    tag: 'sql_joins', language: 'sql',
    prompt: 'Write a single SELECT statement that returns each student\'s name alongside their course title, by joining the "students" and "enrollments" tables on student id, ordered by student name.',
    sqlFixture: `
      CREATE TABLE students (id INTEGER, name TEXT);
      CREATE TABLE enrollments (student_id INTEGER, course_title TEXT);
      INSERT INTO students VALUES (1,'Asha'),(2,'Ravi');
      INSERT INTO enrollments VALUES (1,'Python Basics'),(2,'SQL Fundamentals');
    `,
    tests: [{ expected_rows: [{ name: 'Asha', course_title: 'Python Basics' }, { name: 'Ravi', course_title: 'SQL Fundamentals' }] }]
  }
];

function seedChallenges(db) {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM code_challenges').get().cnt;
  if (count > 0) return; // already seeded

  const insert = db.prepare(`
    INSERT INTO code_challenges (id, concept_tag, language, prompt, function_name, sql_fixture, hidden_tests)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMany = db.transaction(rows => rows.forEach(r =>
    insert.run(uuidv4(), r.tag, r.language, r.prompt, r.functionName || null, r.sqlFixture || null, JSON.stringify(r.tests))
  ));
  insertMany(SEED_CHALLENGES);
}

// ─── getChallengeForConceptTag() ─────────────────────────────────────────────
// language filter is optional — pass it when you already know which runtime
// the node's mastery check should target (e.g. evalBrain doesn't know in
// advance, so it checks both).
function getChallengeForConceptTag(conceptTag, language) {
  const db = getDb();
  const row = language
    ? db.prepare('SELECT * FROM code_challenges WHERE concept_tag = ? AND language = ?').get(conceptTag, language)
    : db.prepare('SELECT * FROM code_challenges WHERE concept_tag = ?').get(conceptTag);
  db.close();
  if (!row) return null;
  return { ...row, hidden_tests: JSON.parse(row.hidden_tests || '[]') };
}

module.exports = { seedChallenges, getChallengeForConceptTag };
