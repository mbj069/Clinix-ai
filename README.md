# Clinix AI — Patient-Record Prototype

**By Nexus-Tech Solutions** · React prototype for a healthcare client.

A patient-record management prototype demonstrating **authentication**, **role-based access control (RBAC)**, and **audit logging** for sensitive health data.

> ⚠️ **Prototype only.** All patient data is synthetic and fictional. Authentication uses demo credentials, and audit logs are stored in the browser. This is **not** HIPAA-compliant and must not be used with real patient data. A production build needs a secure backend, hashed credentials, encrypted storage, and a tamper-evident audit store.

## Features

- **Authentication** — login with demo accounts; session persisted in the browser
- **Role-based access control** — 4 roles with distinct permissions:
  | Role | Access |
  |---|---|
  | Administrator | Full access + audit log + user management |
  | Doctor | Patient records, sensitive clinical data, notes |
  | Nurse | Patient records, vitals editing |
  | Receptionist | Basic demographics only (sensitive data redacted) |
- **Audit logging** — every login, record view, vitals update, note, and AI interaction is logged with actor, role, and timestamp; viewable/filterable by admins
- **Patient records** — demographics, vitals, allergies, conditions, medications, clinical notes

## AI integration (Phase 1)

Bring-your-own-AI via any **OpenAI-compatible** provider (OpenAI, Azure OpenAI, Ollama, vLLM, OpenRouter, …). An administrator configures the base URL, API key, and model in **Settings → AI**; swapping vendors needs no code changes.

**Design guarantees:**
- The AI only ever sees what the signed-in user's role permits — patient data is RBAC-filtered *before* it reaches the provider
- Every AI request is written to the audit log (`AI_SUMMARY`, `AI_SCRIBE`, `AI_SEARCH`, …)

**Features:**
| Feature | Route | Who |
|---|---|---|
| Clinical summarizer — one-click patient summary | Patient record → ✨ AI summary | Doctor, Nurse, Admin |
| AI scribe — rough notes → reviewed SOAP draft | AI scribe | Doctor, Admin |
| Natural-language search — tool-calling patient search | AI search | All roles (results RBAC-filtered) |

## Demo accounts

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | Administrator |
| `doctor` | `doctor123` | Doctor |
| `nurse` | `nurse123` | Nurse |
| `reception` | `reception123` | Receptionist |

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:5173 and sign in with a demo account above.

## Build

```bash
npm run build
```

## Project structure

```
src/
├── main.jsx                 # entry point
├── App.jsx                  # routes + shell layout
├── context/AuthContext.jsx  # session + permission checks
├── data/mockData.js         # synthetic users, roles, patients
├── utils/auditLogger.js     # audit trail (localStorage)
├── ai/
│   ├── aiService.js         # orchestration: RBAC + audit + agentic loop
│   ├── prompts.js           # clinical system prompts per feature
│   ├── tools.js             # RBAC-filtered patient context + tool defs
│   ├── useAI.js             # React hook (loading/error/result)
│   └── providers/
│       └── openaiCompatible.js  # chat/completions adapter + key config
├── components/
│   ├── Login.jsx
│   ├── Dashboard.jsx
│   ├── PatientList.jsx
│   ├── PatientDetail.jsx    # RBAC-gated sensitive sections + AI summary
│   ├── AuditLog.jsx
│   ├── AISearch.jsx         # natural-language patient search
│   ├── AIScribe.jsx         # rough notes → reviewed SOAP draft
│   ├── AISettings.jsx       # admin provider configuration
│   └── ProtectedRoute.jsx
└── styles/index.css
```

## Production hardening checklist

- [ ] Server-side auth with hashed passwords (bcrypt/argon2) + MFA
- [ ] HTTPS everywhere; encrypted data at rest
- [ ] Append-only, tamper-evident audit store (not browser storage)
- [ ] Field-level encryption for SSN/PHI
- [ ] Session timeout + automatic logout
- [ ] HIPAA / local healthcare compliance review
