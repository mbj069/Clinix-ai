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
}

// Run directly: `npm run seed`. Imported: the caller decides when to seed.
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  await seedDatabase();
  console.log('Seed complete.');
}
