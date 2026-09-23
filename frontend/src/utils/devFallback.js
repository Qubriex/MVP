// src/utils/devFallback.js
// mockData.js exists purely for local layout/component review when the
// backend isn't reachable (its own file header says so). It must never be
// shown in a real deployment — a genuine outage should surface an honest
// error, not silently substitute fabricated demo data for real institutions
// or learners who would have no way to tell the difference.
export const MOCK_FALLBACK_ALLOWED = process.env.NODE_ENV !== 'production';
