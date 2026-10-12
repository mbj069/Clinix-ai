# Clinix AI — Patient-Record Application

**By Nexus-Tech Solutions** · Full-stack patient-record application for a healthcare client.

Authentication, role-based access control (RBAC), server-side audit logging for sensitive health data, and a bring-your-own-AI gateway.

> ⚠️ **All demo data is synthetic and fictional.** This is not HIPAA-compliant out of the box — see *Production hardening* below before handling real patient data.

## Architecture

```
clinix-ai/
├── src/                  # React frontend (Vite)
│   ├── ai/               # AI client (calls backend; no provider keys in browser)
│   ├── components/       # Login, Dashboard, Patients, AuditLog, AI pages
│   ├── context/          # Auth (JWT)
│   └── utils/api.js      # API client
└── server/               # Express backend (Node 22.5+)
    └── src/
        ├── index.js      # app entry
        ├── db.js         # SQLite (node:sqlite) + schema
        ├── seed.js       # demo users + patients
        ├── audit.js      # append-only audit writer
        ├── middleware/   # JWT auth, RBAC
        └── routes/       # auth, patients, audit, ai
```

## Features

- **Authentication** — bcrypt-hashed passwords, JWT sessions (8h), 4 demo roles
- **RBAC, enforced server-side** — the API filters every response to the caller's role; frontend checks are UX only
  | Role | Access |
  |---|---|
  | Administrator | Full access + audit log + AI config |
  | Doctor | Records, sensitive data, notes, scribe |
  | Nurse | Records, vitals editing |
  | Receptionist | Basic demographics only (clinical data redacted + 403 on sensitive routes) |
- **Audit logging** — append-only server table; no delete/update API exists
- **AI gateway** — provider API keys stay on the server; admin configures any OpenAI-compatible provider in Settings → AI
  - Clinical summarizer (patient record → ✨ AI summary)
  - AI scribe (rough notes → clinician-approved SOAP draft)
  - Natural-language patient search (agentic tool loop, RBAC-filtered)

## Demo accounts

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | Administrator |
| `doctor` | `doctor123` | Doctor |
| `nurse` | `nurse123` | Nurse |
| `reception` | `reception123` | Receptionist |

## Getting started

Prerequisites: Node.js ≥ 22.5.

```bash
# Backend
cd server
cp .env.example .env        # then set JWT_SECRET and AI_API_KEY
npm install
npm run seed                # creates data/clinix.db with demo users + patients
npm run dev                 # http://localhost:3001

# Frontend (new terminal, repo root)
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :3001)
```

To enable AI features, set `AI_API_KEY` in `server/.env` (or configure it in the app as admin via Settings → AI).

## API reference

| Method | Path | Auth | Permission |
|---|---|---|---|
| POST | `/api/auth/login` | — | — |
| GET | `/api/auth/me` | JWT | — |
| GET | `/api/patients?q=` | JWT | view basic |
| GET | `/api/patients/:id` | JWT | view basic (fields filtered) |
| PATCH | `/api/patients/:id/vitals` | JWT | edit_vitals |
| POST | `/api/patients/:id/notes` | JWT | edit_patients |
| GET | `/api/audit` | JWT | view_audit_log |
| POST | `/api/ai/summary` | JWT | view_sensitive |
| POST | `/api/ai/scribe` | JWT | edit_patients |
| POST | `/api/ai/search` | JWT | any signed-in |
| GET/PUT | `/api/ai/config` | JWT | ai_config |

## Production hardening checklist

- [ ] PostgreSQL instead of SQLite; encrypted backups
- [ ] `JWT_SECRET` from a secrets manager; short token TTL + refresh rotation
- [ ] Encrypt the AI provider key at rest (KMS/vault)
- [ ] HTTPS everywhere (TLS termination), HSTS
- [ ] Rate limiting + request validation hardening
- [ ] Field-level encryption for PHI at rest
- [ ] Session timeout + automatic logout
- [ ] HIPAA / local healthcare compliance review
