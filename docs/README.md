# QUBIREX — MVP Codebase

**Inferexaa Private Limited · Receive. Build. Return.**

The only platform that teaches technical skills in Telugu, and proves they were
learned — with a Mastery Log, not a certificate. Qubirex constructs
explanations natively in Telugu or Hindi (never translated from English) via
Professor Qubirex, its AI teaching persona, and returns a verified Mastery Log
per learner to the commissioning institution.

---

## THE THREE-VERB MODEL

| Verb | What It Means |
|---|---|
| **RECEIVE** | Accept a capability brief from any institution, in any format |
| **BUILD** | Construct capability natively in the learner's language through an adaptive AI instruction cycle |
| **RETURN** | Produce a clean, structured Mastery Log as evidence |

---

## ARCHITECTURE — RAG MULTI-BRAIN V2

Six AI brains are dispatched in parallel (`Promise.all()`) at every learner
interaction. No learner interacts with any brain directly — they only ever
see output from TEACH.

| Brain | File | Role |
|---|---|---|
| ORCH | `core/orchestrator.js` | Central coordinator — classifies the request, dispatches brains, assembles the response |
| TEACH | `core/brains/teachBrain.js` | RAG-grounded native-language instruction engine |
| MEM | `core/brains/memBrain.js` | Learner memory — reads before TEACH, writes after every turn |
| CULT | `core/brains/cultBrain.js` | Cultural Knowledge Base — retrieves curated examples before every explanation |
| EVAL | `core/brains/evalBrain.js` | Mastery evaluator — calibrated rubric scoring, temperature 0.3 |
| CURR | `core/brains/currBrain.js` | Curriculum brain — brief ingestion, node decomposition, node spec retrieval |

Four knowledge stores back the brains: `learnerMemoryStore`, `culturalStore`
(the CKB), `rubricStore`, and `briefStore` (curriculum store).

AI engine: **Google Gemini 1.5 Flash**. Database: **SQLite** (better-sqlite3,
WAL mode, foreign keys on).

---

## PROJECT STRUCTURE

```
backend/
├── server.js                      # Express entry point
├── .env.example                   # Environment template — copy to .env
├── package.json
├── db/
│   └── init.js                    # SQLite schema — V1 core tables + V2 multi-brain tables
├── core/
│   ├── orchestrator.js            # ORCH
│   ├── instructionEngine.js       # Shared utilities + Gemini wrapper
│   ├── masteryLog.js              # Mastery Log production logic
│   ├── brains/
│   │   ├── teachBrain.js
│   │   ├── memBrain.js
│   │   ├── cultBrain.js
│   │   ├── evalBrain.js
│   │   └── currBrain.js
│   └── stores/
│       ├── learnerMemoryStore.js
│       ├── culturalStore.js
│       ├── rubricStore.js
│       └── briefStore.js
└── api/
    ├── middleware/auth.js
    └── routes/
        ├── auth.js
        ├── institution.js
        ├── learner.js
        └── admin.js

frontend/
├── package.json
├── public/index.html
└── src/
    ├── App.js
    ├── context/AuthContext.js
    ├── utils/api.js
    └── pages/
        ├── LandingPage.js
        ├── InstitutionLogin.js / LearnerLogin.js
        ├── InstitutionDashboard.js
        ├── CapabilityTargetUpload.js
        ├── EngagementSetup.js / EngagementDetail.js
        ├── MasteryLogView.js
        ├── LearnerDashboard.js
        └── LearningSession.js

docs/
├── README.md
├── MVP_DESIGN_LIST.md
└── API_REFERENCE.md
```

---

## QUICK START

### Prerequisites
- Node.js 18+
- A Google Gemini API key (https://aistudio.google.com/app/apikey)

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env — add your GEMINI_API_KEY and JWT_SECRET
node server.js
```

Backend runs on http://localhost:3001

### Frontend Setup

```bash
cd frontend
npm install
npm start
```

Frontend runs on http://localhost:3000

### Seed Admin User

```bash
curl -X POST http://localhost:3001/api/admin/seed-admin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@inferexaa.com","password":"your_password","secret":"your_jwt_secret"}'
```

---

## FIVE REQUEST TYPES / FIVE TEACHING STATES / FIVE APPROACHES

- **Request types**: `SESSION_START` · `DIAGNOSIS_RESPONSE` · `LEARNER_MESSAGE` · `CHECK_RESPONSE` · `DOUBT_QUERY`
- **Teaching states**: `DIAGNOSE` → `EXPLAIN (CONTINUE)` → `CHECK` → `ADVANCE` or `LOOP`
- **Explanation approaches** (tried in order, never repeated at the same node): `native_concept` → `analogy` → `worked_example` → `decomposition` → `socratic`

---

## MASTERY GATES PROGRESSION — NOT TIME

`evalBrain.evaluate()` scores responses on **quality of understanding**.
Score ≥ 0.70 = ADVANCE. Exception: loop count ≥ 5 and score ≥ 0.60 = ADVANCE
(persistence credit). A learner who submits ANY response without
demonstrating understanding does NOT advance.

**Mastery increment on ADVANCE** (rewards prompt mastery):

| Loop count | Increment |
|---|---|
| 0 (first attempt) | 22–25 |
| 1–2 | 15–18 |
| 3–4 | 10–13 |
| 5+ | 7–10 |

---

## DATA PRIVACY ARCHITECTURE

**Never shown to institutions**: `session_messages`, `doubts`, `study_plans`,
`streaks`, `learner_memory`, `learner_behaviour_fingerprint`. These are
learner-private under all circumstances.

**The only learner-specific document shared with institutions is the Mastery
Log.** It contains skill node mastery percentages, time to mastery, attempt
counts, confidence indicators, and simulation readiness flags — never session
content, struggle details, or behavioural patterns.

### The Two Blank Fields

`readiness_classification` and `external_score` are **ALWAYS NULL** in every
Mastery Log. These fields are present in every log output — their intentional
blankness is a structural design statement. Qubirex produces evidence and
stops there; readiness and scoring belong to the commissioning client.

---

## PHASE 1 LANGUAGES
- **Telugu** (తెలుగు) — Telangana / Andhra Pradesh learner profile
- **Hindi** (हिंदी) — North Indian learner profile

---

*Inferexaa Private Limited · Confidential · Qubirex MVP Codebase v2.0*
