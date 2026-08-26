# VAK API REFERENCE

Base URL: `http://localhost:3001/api`

All protected routes require: `Authorization: Bearer <token>`

---

## AUTH

| Method | Endpoint | Body | Description |
|---|---|---|---|
| POST | `/auth/institution/login` | `{email, password}` | Institution login |
| POST | `/auth/institution/register` | `{name, type, contact_email, password, city?}` | Register institution |
| POST | `/auth/learner/login` | `{learner_ref, engagement_id}` | Learner login |
| POST | `/auth/admin/login` | `{email, password}` | Admin login |

---

## INSTITUTION (requires institution token)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/institution/profile` | Get institution profile |
| GET | `/institution/learners` | List all learners |
| POST | `/institution/learners` | Add single learner |
| POST | `/institution/learners/bulk` | `{learners:[]}` — Bulk add |
| POST | `/institution/capability-targets` | Upload target (path A or B) |
| POST | `/institution/capability-targets/:id/confirm` | Confirm Path B extraction |
| POST | `/institution/capability-targets/:id/build-pathway` | `{language}` — Build skill nodes |
| POST | `/institution/engagements` | `{capability_target_id, title, language, learner_ids}` |
| GET | `/institution/engagements` | List engagements |
| GET | `/institution/engagements/:id` | Engagement detail + cohort progress |
| POST | `/institution/engagements/:id/produce-mastery-logs` | Compile all Mastery Logs |
| GET | `/institution/engagements/:id/mastery-logs` | Get produced logs |

---

## LEARNER (requires learner token)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/learner/dashboard` | Dashboard + progress |
| POST | `/learner/session/start` | Start or resume session for current node |
| POST | `/learner/session/:id/message` | `{content, request_mastery_check}` — Send message |
| POST | `/learner/session/:id/mastery-check` | `{question, learner_response}` — Submit check |
| GET | `/learner/session/:id/history` | Full session message history |
| GET | `/learner/mastery-record` | All mastered nodes |

### Mastery Check Response

**ADVANCE:**
```json
{
  "result": "advance",
  "passed": true,
  "score": 0.85,
  "feedback": "...",
  "mastery_attainment": 87,
  "confidence_indicator": 0.76,
  "next_node": { "id": "...", "label": "..." },
  "programme_complete": false
}
```

**LOOP:**
```json
{
  "result": "loop",
  "passed": false,
  "score": 0.55,
  "feedback": "...",
  "understanding_gaps": ["..."],
  "new_session_id": "...",
  "next_approach": "analogy",
  "loop_count": 2
}
```

---

## ADMIN (requires admin token)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/admin/stats` | System-wide statistics |
| GET | `/admin/institutions` | All institutions |
| GET | `/admin/mastery-logs/:id` | Get specific Mastery Log |
| GET | `/admin/quality-report` | Node difficulty + approach effectiveness |
| POST | `/admin/seed-admin` | `{email, password, secret}` — Create admin |

---

*Vak AI Technologies · API Reference v1.0*
