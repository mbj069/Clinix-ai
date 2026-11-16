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
└── server/               # Express backend (Node 20+)
    └── src/
        ├── index.js      # app entry (local dev + Vercel server service)
        ├── app.js        # Express app (shared by local + Vercel)
        ├── db.js         # libSQL/Turso client + schema
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

Prerequisites: Node.js ≥ 20.

```bash
# Backend
cd server
cp .env.example .env        # then set JWT_SECRET and AI_API_KEY
npm install
npm run seed                # creates server/data/clinix.db with demo users + patients
npm run dev                 # http://localhost:3001

# Frontend (new terminal, repo root)
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :3001)
```

To enable AI features, set `AI_API_KEY` in `server/.env` (or configure it in the app as admin via Settings → AI).

## Deploying (Vercel services + Turso, free)

One Vercel project, two services (see `vercel.json`): the `app` service is the Vite frontend, the `server` service is the Express API, backed by a Turso database (libSQL over HTTP). One domain, shared env vars. No credit card needed on either free tier.

1. In [Vercel](https://vercel.com/new) → **Import** the `Clinix-ai` repo (Hobby plan, no card).
2. Create the database manually at [turso.tech](https://turso.tech): Databases → Create Database, name it `clinix-ai`, region Mumbai (aws-ap-south-1). Open it, copy the URL, create a token and copy that too — then set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in the Vercel project's env vars. Don't use Vercel's one-click Turso integration: it provisions the database inside Vercel's own Turso organization, where it is invisible in your dashboard and its credentials are sealed — the same failure hit NexusLMS and NexusCRM.
3. Add one more env var: `JWT_SECRET` — any long random string (e.g. `openssl rand -hex 32`). The demo works without it, but sessions would share a public fallback secret, so don't skip this. The server refuses to start in production without it.
4. Trial/demo deployment only: set `SEED_DEMO_DATA=true` so the first visit seeds the demo users/patients (same logins as above). A deployment for a real client leaves this unset — it starts empty, with no demo accounts.
5. Deploy.

Notes for a client demo: cold starts add a few seconds on the first request after idle, and the AI features stay off until an admin adds a provider key in Settings → AI. Local dev still works offline — with no Turso vars set, the server uses a local SQLite file (`server/data/clinix.db`).

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

- [x] Turso (libSQL) instead of a local SQLite file; demo seeding gated behind `SEED_DEMO_DATA` so real-client deployments start empty
- [x] `JWT_SECRET` required in production — the server refuses to start without it (fail-closed, no public fallback)
- [x] AI provider key encrypted at rest (AES-256-GCM; key from `ENCRYPTION_KEY` or derived from `JWT_SECRET`)
- [x] Rate limiting on sign-in (10 / 15 min) and the API (300 / 15 min)
- [ ] Short token TTL + refresh rotation; session timeout + automatic logout
- [ ] Field-level encryption for PHI at rest
- [ ] Encrypted backups (Turso PITR / export)
- [ ] HTTPS everywhere (TLS termination), HSTS — provided by Vercel by default
- [ ] HIPAA / local healthcare compliance review
