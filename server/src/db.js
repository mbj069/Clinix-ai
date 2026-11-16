// ------------------------------------------------------------------
// Database — @libsql/client (libSQL / Turso).
//
// One driver for both environments:
//   - Local dev: a SQLite file (no TURSO_DATABASE_URL → server/data/clinix.db)
//   - Production (Vercel): Turso over HTTP (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN)
// All SQL here is portable SQLite, and every query goes through the
// queryOne / queryAll / run helpers below.
// ------------------------------------------------------------------

import { createClient } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// DB_PATH (optional, local file) keeps the old override working; otherwise
// the file lives next to the server code, independent of the working dir.
const defaultFile = path.join(__dirname, '..', 'data', 'clinix.db');
const url =
  process.env.TURSO_DATABASE_URL ||
  (process.env.DB_PATH ? `file:${process.env.DB_PATH}` : `file:${defaultFile}`);
const isLocalFile = url.startsWith('file:');

if (isLocalFile) {
  const dir = path.dirname(url.slice('file:'.length));
  if (dir && dir !== '.') fs.mkdirSync(dir, { recursive: true });
}

export const client = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export async function queryOne(sql, args = []) {
  const r = await client.execute({ sql, args });
  return r.rows[0] ?? null;
}

export async function queryAll(sql, args = []) {
  const r = await client.execute({ sql, args });
  return r.rows;
}

export async function run(sql, args = []) {
  await client.execute({ sql, args });
}

export async function initSchema() {
  if (isLocalFile) {
    await client.execute('PRAGMA journal_mode = WAL;');
    await client.execute('PRAGMA foreign_keys = ON;');
  }
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin','doctor','nurse','receptionist')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      dob TEXT NOT NULL,
      gender TEXT NOT NULL,
      phone TEXT NOT NULL,
      blood_type TEXT NOT NULL,
      allergies TEXT NOT NULL DEFAULT '[]',
      conditions TEXT NOT NULL DEFAULT '[]',
      medications TEXT NOT NULL DEFAULT '[]',
      vitals TEXT NOT NULL DEFAULT '{}',
      notes TEXT NOT NULL DEFAULT '',
      ssn_last4 TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Append-only audit trail. No UPDATE/DELETE API exists for this table.
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      actor_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      role TEXT NOT NULL,
      action TEXT NOT NULL,
      patient_id TEXT,
      details TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_patient ON audit_log(patient_id);

    -- Single-row AI provider config (id = 1). API key lives in env by
    -- default; an admin-set key here overrides it (encrypt at rest in prod).
    CREATE TABLE IF NOT EXISTS ai_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      base_url TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
      api_key TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  // INSERT OR IGNORE can't be in the same executeMultiple reliably across drivers — separate step.
  await client.execute('INSERT OR IGNORE INTO ai_config (id) VALUES (1)');
}

// Schema ready before any query: run at import (top-level await).
// Idempotent, so explicit initSchema() calls elsewhere stay harmless.
await initSchema();

// --- Row mappers ------------------------------------------------------------

const J = (s, fallback) => {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
};

export function mapPatient(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    dob: row.dob,
    gender: row.gender,
    phone: row.phone,
    bloodType: row.blood_type,
    allergies: J(row.allergies, []),
    conditions: J(row.conditions, []),
    medications: J(row.medications, []),
    vitals: J(row.vitals, {}),
    notes: row.notes,
    ssn: row.ssn_last4 ? `***-**-${row.ssn_last4}` : '',
  };
}

export function mapUser(row) {
  if (!row) return null;
  const { password_hash, ...safe } = row;
  return safe;
}
