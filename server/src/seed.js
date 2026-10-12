// Seed demo users + patients. Safe to re-run (uses INSERT OR REPLACE).
// Run: npm run seed

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db, initSchema } from './db.js';

initSchema();

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

const upsertUser = db.prepare(`
  INSERT INTO users (id, username, password_hash, name, role)
  VALUES (@id, @username, @password_hash, @name, @role)
  ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash, name=excluded.name, role=excluded.role
`);

for (const u of USERS) {
  upsertUser.run({
    id: u.id,
    username: u.username,
    password_hash: bcrypt.hashSync(u.password, 10),
    name: u.name,
    role: u.role,
  });
  console.log(`user: ${u.username} (${u.role})`);
}

const upsertPatient = db.prepare(`
  INSERT INTO patients (id, name, dob, gender, phone, blood_type, allergies, conditions, medications, vitals, notes, ssn_last4)
  VALUES (@id, @name, @dob, @gender, @phone, @blood_type, @allergies, @conditions, @medications, @vitals, @notes, @ssn_last4)
  ON CONFLICT(id) DO UPDATE SET
    name=excluded.name, dob=excluded.dob, gender=excluded.gender, phone=excluded.phone,
    blood_type=excluded.blood_type, allergies=excluded.allergies, conditions=excluded.conditions,
    medications=excluded.medications, vitals=excluded.vitals, notes=excluded.notes,
    ssn_last4=excluded.ssn_last4, updated_at=datetime('now')
`);

for (const p of PATIENTS) {
  upsertPatient.run({
    ...p,
    allergies: JSON.stringify(p.allergies),
    conditions: JSON.stringify(p.conditions),
    medications: JSON.stringify(p.medications),
    vitals: JSON.stringify(p.vitals),
  });
  console.log(`patient: ${p.name} (${p.id})`);
}

console.log('Seed complete.');
