# VAK AI TECHNOLOGIES — MVP Codebase

**Receive. Build. Return.**

Native-language AI instruction engine. Builds real capability in Hindi and Telugu — constructed natively, never translated from English.

---

## THE THREE LAWS

| Law | What It Means |
|---|---|
| **RECEIVE** | Accept a capability target from any institution in any format |
| **BUILD** | Construct capability natively in the learner's language through an adaptive AI instruction cycle |
| **RETURN** | Produce a clean, structured Mastery Log as evidence |

---

## PROJECT STRUCTURE

```
vak_mvp/
├── backend/
│   ├── server.js              # Express entry point
│   ├── .env.example           # Environment template — copy to .env
│   ├── package.json
│   ├── db/
│   │   └── init.js            # SQLite schema — all tables
│   ├── core/
│   │   ├── instructionEngine.js   # THE CORE — instruction, evaluation, pathway
│   │   └── masteryLog.js          # Mastery Log production logic
│   └── api/
│       ├── middleware/
│       │   └── auth.js        # JWT auth middleware
│       └── routes/
│           ├── auth.js        # Login for institution, learner, admin
│           ├── institution.js # Target upload, engagement, learner management
│           ├── learner.js     # Session start, messages, mastery check
│           └── admin.js       # Admin dashboard, quality reports
│
├── frontend/
│   ├── package.json
│   ├── public/index.html
│   └── src/
│       ├── App.js             # Routes
│       ├── index.js
│       ├── context/
│       │   └── AuthContext.js # Shared auth state
│       ├── utils/
│       │   └── api.js         # Axios instance with auth
│       └── pages/
│           ├── LandingPage.js
│           ├── InstitutionLogin.js
│           ├── LearnerLogin.js
│           ├── InstitutionDashboard.js
│           ├── CapabilityTargetUpload.js  # Path A + Path B ingestion
│           ├── EngagementSetup.js
│           ├── EngagementDetail.js        # Cohort progress + log production
│           ├── MasteryLogView.js          # Structured evidence output
│           ├── LearnerDashboard.js
│           └── LearningSession.js        # CORE: instruction + mastery check
│
└── docs/
    ├── README.md              # This file
    ├── MVP_DESIGN_LIST.md     # Complete feature + design specification
    ├── API_REFERENCE.md       # Full API endpoint documentation
    └── ARCHITECTURE.md       # System architecture decisions
```

---

## QUICK START

### Prerequisites
- Node.js 18+
- An Anthropic API key (get from https://console.anthropic.com)

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env — add your ANTHROPIC_API_KEY and JWT_SECRET
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
  -d '{"email":"sasi@vak.ai","password":"your_password","secret":"your_jwt_secret"}'
```

---

## USER FLOWS

### Institution Flow

1. Register at `/login` → Institution Dashboard
2. Upload Capability Target (Path B — any format, or Path A — structured)
3. AI extracts clusters → Institution confirms
4. System builds skill node graph
5. Add learner cohort → Start engagement
6. Share **Engagement ID** with learners
7. Monitor progress from dashboard
8. Produce Mastery Logs when instruction complete

### Learner Flow

1. Login at `/learner-login` with learner reference + engagement ID
2. Learner Dashboard shows current node + progress
3. Enter learning session
4. AI teaches in Hindi or Telugu — natively constructed
5. Learner converses, asks questions
6. When ready: request mastery check
7. Submit answer → AI evaluates
8. **ADVANCE** (score ≥ 0.70) → next skill node
9. **LOOP** (score < 0.70) → different explanation approach

---

## CORE DESIGN CONSTRAINTS (NON-NEGOTIABLE)

### 1. Native Construction — Not Translation
The AI constructs explanations FROM SCRATCH in Hindi/Telugu. It does NOT translate from English. If the AI is generating an English explanation and converting it, that is the wrong architecture.

### 2. Mastery Gates Progression — Not Time
The `evaluateMasteryResponse()` function in `instructionEngine.js` scores responses on **quality of understanding**. Score ≥ 0.70 = ADVANCE. Score < 0.70 = LOOP. A learner who submits ANY response without demonstrating understanding does NOT advance.

### 3. Loop Uses a Different Approach Every Time
The `selectNextApproach()` function ensures the engine never repeats the same explanation. Loop approaches cycle through: `native_concept → analogy → worked_example → decomposition → simplified`.

### 4. Clean Output Boundary
The Mastery Log's `readiness_classification` and `external_score` fields are **ALWAYS NULL**. These fields are present in every log output — their intentional blankness is a structural design statement. Vak produces evidence and stops there.

### 5. Data Sovereignty
Session interaction logs (`session_messages` table) are Vak's proprietary data. They are never returned to institutions directly. Only the compiled Mastery Log is returned.

---

## DATABASE SCHEMA — KEY TABLES

| Table | Purpose |
|---|---|
| `institutions` | Registered institutions (bootcamps, colleges, corporates) |
| `learners` | Learner roster per institution |
| `capability_targets` | Uploaded briefs — Path A (structured) or Path B (any format) |
| `skill_clusters` | Extracted/confirmed skill clusters from capability target |
| `skill_nodes` | AI-decomposed micro-skills within each cluster |
| `engagements` | Active instruction runs (institution + target + cohort) |
| `learning_sessions` | Per-learner per-node instruction sessions |
| `session_messages` | Full interaction log — Vak proprietary, not shared |
| `mastery_checks` | Mastery check attempts with AI evaluation |
| `node_mastery` | Confirmed mastery records per learner per node |
| `mastery_logs` | Produced Mastery Logs — Vak's output document |

---

## MASTERY LOG FIELD REFERENCE

| Field | Populated By | Notes |
|---|---|---|
| learner_reference | Shared | Links to institution's own learner record |
| capability_target_document_reference | Vak | Audit trail |
| cluster / skill_node | Vak | Using institution's own labels |
| mastery_attainment | Vak | Recency-weighted check performance |
| time_to_mastery_minutes | Vak | Active instruction time only |
| attempt_count | Vak | Check cycles before threshold |
| confidence_indicator | Vak | Stability of mastery (not readiness) |
| simulation_readiness_flag | Vak | Binary signal based on mastery pattern |
| **readiness_classification** | **ALWAYS BLANK** | **Owned by commissioning institution** |
| **external_score** | **ALWAYS BLANK** | **Owned by assessment platform** |

---

## PILOT PARAMETERS (MVP)

- Cohort: 10–30 learners
- Languages: Hindi OR Telugu (one per cohort)
- Duration: 4–6 weeks
- Format: AI-driven text sessions
- Mastery Log: Single document at programme end
- Path B: Human-assisted at MVP stage

---

## PHASE 1 LANGUAGES
- **Hindi** (हिंदी) — North Indian learner profile
- **Telugu** (తెలుగు) — Telangana / Andhra learner profile

Phase 2 languages (post-pilot validation): Tamil, Bengali, Marathi, Kannada

---

*Vak AI Technologies Pvt Ltd · Confidential · MVP Codebase v1.0 · March 2026*
