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

    -- Appointments (reception books, doctor/nurse see the day's queue).
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id TEXT NOT NULL,
      doctor_id TEXT NOT NULL DEFAULT '',
      doctor_name TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','checked_in','completed','cancelled','no_show')),
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_appt_date ON appointments(date);
    CREATE INDEX IF NOT EXISTS idx_appt_patient ON appointments(patient_id);

    -- Doctor consultations (diagnosis + plan, per patient).
    CREATE TABLE IF NOT EXISTS consultations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id TEXT NOT NULL,
      doctor_id TEXT NOT NULL,
      doctor_name TEXT NOT NULL,
      date TEXT NOT NULL DEFAULT (date('now')),
      diagnosis TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_cons_patient ON consultations(patient_id);

    -- Prescriptions (doctor writes; pharmacy dispenses in phase 2).
    CREATE TABLE IF NOT EXISTS prescriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id TEXT NOT NULL,
      doctor_id TEXT NOT NULL,
      doctor_name TEXT NOT NULL,
      medication TEXT NOT NULL,
      dosage TEXT NOT NULL,
      frequency TEXT NOT NULL,
      duration TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_rx_patient ON prescriptions(patient_id);

    -- Lab test orders (doctor orders; lab module fulfils in phase 2).
    CREATE TABLE IF NOT EXISTS lab_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id TEXT NOT NULL,
      doctor_id TEXT NOT NULL,
      doctor_name TEXT NOT NULL,
      test_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered','collected','completed','cancelled')),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_lab_patient ON lab_orders(patient_id);

    -- Vitals history (every recording kept; patients.vitals holds the latest).
    CREATE TABLE IF NOT EXISTS vitals_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id TEXT NOT NULL,
      recorded_by TEXT NOT NULL,
      recorded_by_name TEXT NOT NULL,
      bp TEXT NOT NULL DEFAULT '',
      hr INTEGER,
      temp TEXT NOT NULL DEFAULT '',
      spo2 TEXT NOT NULL DEFAULT '',
      recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_vitals_patient ON vitals_history(patient_id, recorded_at DESC);

    -- Nursing / ward tasks.
    CREATE TABLE IF NOT EXISTS nursing_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id TEXT NOT NULL,
      task TEXT NOT NULL,
      due TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done')),
      created_by TEXT NOT NULL,
      created_by_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    -- Doctor weekly sitting hours (0 = Sunday … 6 = Saturday).
    -- One row per doctor per weekday; admin sets them, reception and the
    -- dashboard read them. Times are HH:MM in the hospital's local time.
    CREATE TABLE IF NOT EXISTS doctor_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id TEXT NOT NULL,
      day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(doctor_id, day_of_week)
    );
    CREATE INDEX IF NOT EXISTS idx_sched_doctor ON doctor_schedules(doctor_id);
  `);
  // INSERT OR IGNORE can't be in the same executeMultiple reliably across drivers — separate step.
  await client.execute('INSERT OR IGNORE INTO ai_config (id) VALUES (1)');
  // Lightweight migration: user accounts can be deactivated (added in v2).
  try {
    await client.execute("ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1");
  } catch {
    // Column already exists — nothing to do.
  }
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

export function mapAppointment(row) {
  if (!row) return null;
  return {
    id: row.id, patientId: row.patient_id, patientName: row.patient_name || '',
    doctorId: row.doctor_id, doctorName: row.doctor_name || '',
    date: row.date, time: row.time, reason: row.reason,
    status: row.status, createdBy: row.created_by, createdAt: row.created_at,
  };
}

export function mapConsultation(row) {
  if (!row) return null;
  return {
    id: row.id, patientId: row.patient_id, doctorId: row.doctor_id,
    doctorName: row.doctor_name, date: row.date,
    diagnosis: row.diagnosis, plan: row.plan, createdAt: row.created_at,
  };
}

export function mapPrescription(row) {
  if (!row) return null;
  return {
    id: row.id, patientId: row.patient_id, doctorId: row.doctor_id,
    doctorName: row.doctor_name, medication: row.medication, dosage: row.dosage,
    frequency: row.frequency, duration: row.duration, notes: row.notes,
    status: row.status, createdAt: row.created_at,
  };
}

export function mapLabOrder(row) {
  if (!row) return null;
  return {
    id: row.id, patientId: row.patient_id, doctorId: row.doctor_id,
    doctorName: row.doctor_name, testName: row.test_name,
    status: row.status, notes: row.notes, createdAt: row.created_at,
  };
}

export function mapVitals(row) {
  if (!row) return null;
  return {
    id: row.id, patientId: row.patient_id, recordedBy: row.recorded_by,
    recordedByName: row.recorded_by_name, bp: row.bp, hr: row.hr,
    temp: row.temp, spo2: row.spo2, recordedAt: row.recorded_at,
  };
}

export function mapTask(row) {
  if (!row) return null;
  return {
    id: row.id, patientId: row.patient_id, patientName: row.patient_name || '',
    task: row.task, due: row.due, status: row.status,
    createdBy: row.created_by, createdByName: row.created_by_name,
    createdAt: row.created_at,
  };
}

export function mapSchedule(row) {
  if (!row) return null;
  return {
    id: row.id, doctorId: row.doctor_id, doctorName: row.doctor_name || '',
    dayOfWeek: row.day_of_week, startTime: row.start_time, endTime: row.end_time,
  };
}
