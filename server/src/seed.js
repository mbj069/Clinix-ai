// Seed demo users + patients. Safe to re-run (uses INSERT ... ON CONFLICT).
// Run: npm run seed — or imported by the server entries, which seed an
// empty database automatically on first boot.

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './db.js';

const USERS = [
  { id: 'u-admin-1', username: 'admin', password: 'admin123', name: 'Ava Admin', role: 'admin' },
  { id: 'u-doc-1', username: 'doctor', password: 'doctor123', name: 'Dr. Daniel Reed', role: 'doctor' },
  { id: 'u-nurse-1', username: 'nurse', password: 'nurse123', name: 'Nina Cole, RN', role: 'nurse' },
  { id: 'u-recep-1', username: 'reception', password: 'reception123', name: 'Ravi Patel', role: 'receptionist' },
];

const PATIENTS = [
  {
    id: 'p-1001', name: 'Elena Marsh', dob: '1988-04-12', gender: 'Female',
    phone: '+1 (555) 014-2281', blood_type: 'O+',
    allergies: ['Penicillin', 'Latex'], conditions: ['Type 2 Diabetes', 'Hypertension'],
    medications: [
      { name: 'Metformin', dosage: '500mg', frequency: 'Twice daily' },
      { name: 'Lisinopril', dosage: '10mg', frequency: 'Once daily' },
    ],
    vitals: { bp: '128/84', hr: 72, temp: '98.6°F', spo2: '98%' },
    notes: 'Follow-up in 3 months. HbA1c trending down.', ssn_last4: '4401',
  },
  {
    id: 'p-1002', name: 'Marcus Bell', dob: '1975-09-30', gender: 'Male',
    phone: '+1 (555) 019-7734', blood_type: 'A-',
    allergies: ['Sulfa drugs'], conditions: ['Asthma'],
    medications: [{ name: 'Albuterol', dosage: '90mcg', frequency: 'As needed' }],
    vitals: { bp: '118/76', hr: 68, temp: '98.2°F', spo2: '99%' },
    notes: 'Inhaler technique reviewed. Annual spirometry due.', ssn_last4: '8817',
  },
  {
    id: 'p-1003', name: 'Priya Nair', dob: '2001-01-22', gender: 'Female',
    phone: '+1 (555) 011-9023', blood_type: 'B+',
    allergies: [], conditions: ['Migraine'],
    medications: [{ name: 'Sumatriptan', dosage: '50mg', frequency: 'As needed' }],
    vitals: { bp: '110/70', hr: 64, temp: '98.4°F', spo2: '99%' },
    notes: 'Trigger diary recommended.', ssn_last4: '2309',
  },
  {
    id: 'p-1004', name: 'Tom Okafor', dob: '1962-07-08', gender: 'Male',
    phone: '+1 (555) 017-4456', blood_type: 'AB+',
    allergies: ['Aspirin'], conditions: ['Coronary artery disease', 'Hyperlipidemia'],
    medications: [
      { name: 'Atorvastatin', dosage: '40mg', frequency: 'Once daily' },
      { name: 'Clopidogrel', dosage: '75mg', frequency: 'Once daily' },
    ],
    vitals: { bp: '132/86', hr: 70, temp: '98.1°F', spo2: '97%' },
    notes: 'Cardiology referral sent. Stress test scheduled.', ssn_last4: '7712',
  },
  {
    id: 'p-1005', name: 'Sara Lindqvist', dob: '1995-11-17', gender: 'Female',
    phone: '+1 (555) 013-5567', blood_type: 'O-',
    allergies: ['None known'], conditions: [], medications: [],
    vitals: { bp: '112/72', hr: 66, temp: '98.6°F', spo2: '99%' },
    notes: 'Annual physical — all clear.', ssn_last4: '3398',
  },
];

const isoDay = (offsetDays) => {
  const t = new Date(Date.now() + offsetDays * 864e5);
  return t.toISOString().slice(0, 10);
};

const APPOINTMENTS = [
  { id: 1, patient_id: 'p-1001', doctor_id: 'u-doc-1', doctor_name: 'Dr. Daniel Reed', day: 0, time: '09:00', reason: 'Diabetes follow-up', status: 'checked_in' },
  { id: 2, patient_id: 'p-1004', doctor_id: 'u-doc-1', doctor_name: 'Dr. Daniel Reed', day: 0, time: '10:30', reason: 'Cardiology review', status: 'scheduled' },
  { id: 3, patient_id: 'p-1002', doctor_id: 'u-doc-1', doctor_name: 'Dr. Daniel Reed', day: 0, time: '11:15', reason: 'Asthma review', status: 'completed' },
  { id: 4, patient_id: 'p-1003', doctor_id: 'u-doc-1', doctor_name: 'Dr. Daniel Reed', day: 1, time: '09:30', reason: 'Migraine follow-up', status: 'scheduled' },
  { id: 5, patient_id: 'p-1005', doctor_id: 'u-doc-1', doctor_name: 'Dr. Daniel Reed', day: 1, time: '14:00', reason: 'Annual physical', status: 'scheduled' },
];

const CONSULTATIONS = [
  { id: 1, patient_id: 'p-1001', doctor_id: 'u-doc-1', doctor_name: 'Dr. Daniel Reed', day: -7, diagnosis: 'Type 2 Diabetes — controlled', plan: 'Continue Metformin 500mg twice daily. HbA1c in 3 months. Diet review.' },
  { id: 2, patient_id: 'p-1004', doctor_id: 'u-doc-1', doctor_name: 'Dr. Daniel Reed', day: -14, diagnosis: 'Coronary artery disease — stable', plan: 'Continue Atorvastatin + Clopidogrel. Stress test scheduled. Low-salt diet.' },
  { id: 3, patient_id: 'p-1002', doctor_id: 'u-doc-1', doctor_name: 'Dr. Daniel Reed', day: -3, diagnosis: 'Asthma — mild, intermittent', plan: 'Albuterol as needed. Inhaler technique reviewed.' },
];

const PRESCRIPTIONS = [
  { id: 1, patient_id: 'p-1001', doctor_id: 'u-doc-1', doctor_name: 'Dr. Daniel Reed', medication: 'Metformin', dosage: '500mg', frequency: 'Twice daily', duration: '90 days', notes: '', status: 'active' },
  { id: 2, patient_id: 'p-1001', doctor_id: 'u-doc-1', doctor_name: 'Dr. Daniel Reed', medication: 'Lisinopril', dosage: '10mg', frequency: 'Once daily', duration: '90 days', notes: 'Monitor BP.', status: 'active' },
  { id: 3, patient_id: 'p-1004', doctor_id: 'u-doc-1', doctor_name: 'Dr. Daniel Reed', medication: 'Atorvastatin', dosage: '40mg', frequency: 'Once daily', duration: '90 days', notes: '', status: 'active' },
  { id: 4, patient_id: 'p-1002', doctor_id: 'u-doc-1', doctor_name: 'Dr. Daniel Reed', medication: 'Albuterol', dosage: '90mcg', frequency: 'As needed', duration: '30 days', notes: '', status: 'active' },
];

const LAB_ORDERS = [
  { id: 1, patient_id: 'p-1001', doctor_id: 'u-doc-1', doctor_name: 'Dr. Daniel Reed', test_name: 'HbA1c', status: 'completed', notes: 'Quarterly diabetes panel.' },
  { id: 2, patient_id: 'p-1004', doctor_id: 'u-doc-1', doctor_name: 'Dr. Daniel Reed', test_name: 'Lipid panel', status: 'ordered', notes: 'Fasting sample.' },
  { id: 3, patient_id: 'p-1003', doctor_id: 'u-doc-1', doctor_name: 'Dr. Daniel Reed', test_name: 'Complete blood count (CBC)', status: 'collected', notes: '' },
];

const VITALS_HISTORY = [
  { id: 1, patient_id: 'p-1001', recorded_by: 'u-nurse-1', recorded_by_name: 'Nina Cole, RN', bp: '130/85', hr: 74, temp: '98.7°F', spo2: '98%', day: -7 },
  { id: 2, patient_id: 'p-1001', recorded_by: 'u-nurse-1', recorded_by_name: 'Nina Cole, RN', bp: '128/84', hr: 72, temp: '98.6°F', spo2: '98%', day: -1 },
  { id: 3, patient_id: 'p-1004', recorded_by: 'u-nurse-1', recorded_by_name: 'Nina Cole, RN', bp: '134/88', hr: 72, temp: '98.2°F', spo2: '97%', day: -14 },
  { id: 4, patient_id: 'p-1002', recorded_by: 'u-nurse-1', recorded_by_name: 'Nina Cole, RN', bp: '118/76', hr: 68, temp: '98.2°F', spo2: '99%', day: -3 },
];

const NURSING_TASKS = [
  { id: 1, patient_id: 'p-1001', task: 'Check fasting blood sugar before breakfast', due: 'Today, 07:00', status: 'open' },
  { id: 2, patient_id: 'p-1004', task: 'Dressing change — post-procedure site', due: 'Today, 10:00', status: 'open' },
  { id: 3, patient_id: 'p-1002', task: 'Demonstrate inhaler technique to patient', due: 'Today, 12:00', status: 'open' },
  { id: 4, patient_id: 'p-1005', task: 'Discharge paperwork and follow-up booking', due: 'Yesterday', status: 'done' },
];

export async function seedDatabase() {
  for (const u of USERS) {
    await run(
      `INSERT INTO users (id, username, password_hash, name, role)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash, name=excluded.name, role=excluded.role`,
      [u.id, u.username, bcrypt.hashSync(u.password, 10), u.name, u.role]
    );
    console.log(`user: ${u.username} (${u.role})`);
  }

  for (const p of PATIENTS) {
    await run(
      `INSERT INTO patients (id, name, dob, gender, phone, blood_type, allergies, conditions, medications, vitals, notes, ssn_last4)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name, dob=excluded.dob, gender=excluded.gender, phone=excluded.phone,
         blood_type=excluded.blood_type, allergies=excluded.allergies, conditions=excluded.conditions,
         medications=excluded.medications, vitals=excluded.vitals, notes=excluded.notes,
         ssn_last4=excluded.ssn_last4, updated_at=datetime('now')`,
      [
        p.id, p.name, p.dob, p.gender, p.phone, p.blood_type,
        JSON.stringify(p.allergies), JSON.stringify(p.conditions),
        JSON.stringify(p.medications), JSON.stringify(p.vitals),
        p.notes, p.ssn_last4,
      ]
    );
    console.log(`patient: ${p.name} (${p.id})`);
  }

  await seedClinical();
}

// Demo rows for the v2 modules (appointments, consultations, prescriptions,
// lab orders, vitals history, nursing tasks). Idempotent (INSERT OR IGNORE
// with fixed ids) so it is safe to run on every boot of a trial deployment —
// an existing live DB gains the demo rows without touching real data.
export async function seedClinical() {
  for (const a of APPOINTMENTS) {
    await run(
      `INSERT OR IGNORE INTO appointments (id, patient_id, doctor_id, doctor_name, date, time, reason, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'u-recep-1')`,
      [a.id, a.patient_id, a.doctor_id, a.doctor_name, isoDay(a.day), a.time, a.reason, a.status]
    );
  }
  console.log(`appointments: ${APPOINTMENTS.length} seeded`);

  for (const c of CONSULTATIONS) {
    await run(
      `INSERT OR IGNORE INTO consultations (id, patient_id, doctor_id, doctor_name, date, diagnosis, plan)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [c.id, c.patient_id, c.doctor_id, c.doctor_name, isoDay(c.day), c.diagnosis, c.plan]
    );
  }

  for (const p of PRESCRIPTIONS) {
    await run(
      `INSERT OR IGNORE INTO prescriptions (id, patient_id, doctor_id, doctor_name, medication, dosage, frequency, duration, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.id, p.patient_id, p.doctor_id, p.doctor_name, p.medication, p.dosage, p.frequency, p.duration, p.notes, p.status]
    );
  }

  for (const l of LAB_ORDERS) {
    await run(
      `INSERT OR IGNORE INTO lab_orders (id, patient_id, doctor_id, doctor_name, test_name, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [l.id, l.patient_id, l.doctor_id, l.doctor_name, l.test_name, l.status, l.notes]
    );
  }

  for (const v of VITALS_HISTORY) {
    await run(
      `INSERT OR IGNORE INTO vitals_history (id, patient_id, recorded_by, recorded_by_name, bp, hr, temp, spo2, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ? || ' days'))`,
      [v.id, v.patient_id, v.recorded_by, v.recorded_by_name, v.bp, v.hr, v.temp, v.spo2, String(v.day)]
    );
  }

  for (const t of NURSING_TASKS) {
    await run(
      `INSERT OR IGNORE INTO nursing_tasks (id, patient_id, task, due, status, created_by, created_by_name)
       VALUES (?, ?, ?, ?, ?, 'u-nurse-1', 'Nina Cole, RN')`,
      [t.id, t.patient_id, t.task, t.due, t.status]
    );
  }
  console.log('clinical seed: consultations, prescriptions, lab orders, vitals, tasks');
}

// Run directly: `npm run seed`. Imported: the caller decides when to seed.
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  await seedDatabase();
  console.log('Seed complete.');
}
