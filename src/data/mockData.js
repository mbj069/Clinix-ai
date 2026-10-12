// ------------------------------------------------------------------
// Mock data for the Clinix AI prototype.
// ALL data here is synthetic and fictional — no real patient information.
// ------------------------------------------------------------------

export const USERS = [
  {
    id: 'u-admin-1',
    username: 'admin',
    // NOTE (prototype only): plain-text demo passwords. A production build
    // must hash passwords server-side and never ship credentials in the client.
    password: 'admin123',
    name: 'Ava Admin',
    role: 'admin',
  },
  {
    id: 'u-doc-1',
    username: 'doctor',
    password: 'doctor123',
    name: 'Dr. Daniel Reed',
    role: 'doctor',
  },
  {
    id: 'u-nurse-1',
    username: 'nurse',
    password: 'nurse123',
    name: 'Nina Cole, RN',
    role: 'nurse',
  },
  {
    id: 'u-recep-1',
    username: 'reception',
    password: 'reception123',
    name: 'Ravi Patel',
    role: 'receptionist',
  },
];

export const ROLES = {
  admin: {
    label: 'Administrator',
    permissions: ['view_patients', 'edit_patients', 'view_sensitive', 'manage_users', 'view_audit_log', 'schedule'],
  },
  doctor: {
    label: 'Doctor',
    permissions: ['view_patients', 'edit_patients', 'view_sensitive', 'schedule'],
  },
  nurse: {
    label: 'Nurse',
    permissions: ['view_patients', 'edit_vitals', 'schedule'],
  },
  receptionist: {
    label: 'Receptionist',
    permissions: ['view_patients_basic', 'schedule'],
  },
};

export const PATIENTS = [
  {
    id: 'p-1001',
    name: 'Elena Marsh',
    dob: '1988-04-12',
    gender: 'Female',
    phone: '+1 (555) 014-2281',
    bloodType: 'O+',
    allergies: ['Penicillin', 'Latex'],
    conditions: ['Type 2 Diabetes', 'Hypertension'],
    medications: [
      { name: 'Metformin', dosage: '500mg', frequency: 'Twice daily' },
      { name: 'Lisinopril', dosage: '10mg', frequency: 'Once daily' },
    ],
    vitals: { bp: '128/84', hr: 72, temp: '98.6°F', spo2: '98%' },
    notes: 'Follow-up in 3 months. HbA1c trending down.',
    ssn: '***-**-4401',
  },
  {
    id: 'p-1002',
    name: 'Marcus Bell',
    dob: '1975-09-30',
    gender: 'Male',
    phone: '+1 (555) 019-7734',
    bloodType: 'A-',
    allergies: ['Sulfa drugs'],
    conditions: ['Asthma'],
    medications: [{ name: 'Albuterol', dosage: '90mcg', frequency: 'As needed' }],
    vitals: { bp: '118/76', hr: 68, temp: '98.2°F', spo2: '99%' },
    notes: 'Inhaler technique reviewed. Annual spirometry due.',
    ssn: '***-**-8817',
  },
  {
    id: 'p-1003',
    name: 'Priya Nair',
    dob: '2001-01-22',
    gender: 'Female',
    phone: '+1 (555) 011-9023',
    bloodType: 'B+',
    allergies: [],
    conditions: ['Migraine'],
    medications: [{ name: 'Sumatriptan', dosage: '50mg', frequency: 'As needed' }],
    vitals: { bp: '110/70', hr: 64, temp: '98.4°F', spo2: '99%' },
    notes: 'Trigger diary recommended.',
    ssn: '***-**-2309',
  },
  {
    id: 'p-1004',
    name: 'Tom Okafor',
    dob: '1962-07-08',
    gender: 'Male',
    phone: '+1 (555) 017-4456',
    bloodType: 'AB+',
    allergies: ['Aspirin'],
    conditions: ['Coronary artery disease', 'Hyperlipidemia'],
    medications: [
      { name: 'Atorvastatin', dosage: '40mg', frequency: 'Once daily' },
      { name: 'Clopidogrel', dosage: '75mg', frequency: 'Once daily' },
    ],
    vitals: { bp: '132/86', hr: 70, temp: '98.1°F', spo2: '97%' },
    notes: 'Cardiology referral sent. Stress test scheduled.',
    ssn: '***-**-7712',
  },
  {
    id: 'p-1005',
    name: 'Sara Lindqvist',
    dob: '1995-11-17',
    gender: 'Female',
    phone: '+1 (555) 013-5567',
    bloodType: 'O-',
    allergies: ['None known'],
    conditions: [],
    medications: [],
    vitals: { bp: '112/72', hr: 66, temp: '98.6°F', spo2: '99%' },
    notes: 'Annual physical — all clear.',
    ssn: '***-**-3398',
  },
];
