import { Router } from 'express';
import { queryOne, queryAll, run, mapPatient } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission, can, filterPatientFor } from '../middleware/rbac.js';
import { audit } from '../audit.js';

const router = Router();
router.use(requireAuth);

const mayViewFull = (role) => can(role, 'view_patients') || can(role, 'view_patients_basic');

// GET /api/patients?q= — list, RBAC-filtered
router.get('/', async (req, res) => {
  if (!mayViewFull(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions.' });
  const q = (req.query.q || '').toLowerCase();
  const rows = await queryAll('SELECT * FROM patients ORDER BY name');
  let patients = rows.map(mapPatient);
  if (q) {
    patients = patients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.conditions.some((c) => c.toLowerCase().includes(q))
    );
  }
  res.json({ patients: patients.map((p) => filterPatientFor(req.user.role, p)) });
});

// GET /api/patients/:id — detail, RBAC-filtered + audited
router.get('/:id', async (req, res) => {
  if (!mayViewFull(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions.' });
  const row = await queryOne('SELECT * FROM patients WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Patient not found.' });
  const patient = mapPatient(row);
  const filtered = filterPatientFor(req.user.role, patient);
  await audit({
    actorId: req.user.sub, actorName: req.user.name, role: req.user.role,
    action: 'VIEW_PATIENT_RECORD', patientId: patient.id,
    details: `Viewed record of ${patient.name} (${patient.id})${filtered._redacted ? ' (sensitive fields redacted)' : ''}`,
  });
  res.json({ patient: filtered });
});

// POST /api/patients — register a new patient (reception, doctor, admin)
router.post('/', requirePermission('add_patients'), async (req, res) => {
  const { name, dob, gender, phone, bloodType, allergies, conditions, medications, notes, ssnLast4 } = req.body || {};
  if (!name || !name.trim() || !dob || !gender || !phone || !phone.trim() || !bloodType) {
    return res.status(400).json({ error: 'Name, date of birth, gender, phone and blood type are required.' });
  }
  const maxRow = await queryOne("SELECT MAX(CAST(SUBSTR(id, 3) AS INTEGER)) AS m FROM patients WHERE id LIKE 'p-%'");
  const nextNum = (maxRow?.m || 1000) + 1;
  const id = `p-${nextNum}`;
  const list = (v) => (Array.isArray(v) ? v : typeof v === 'string' && v.trim() ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);
  await run(
    `INSERT INTO patients (id, name, dob, gender, phone, blood_type, allergies, conditions, medications, vitals, notes, ssn_last4)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, ?)`,
    [id, name.trim(), dob, gender, phone.trim(), bloodType,
     JSON.stringify(list(allergies)), JSON.stringify(list(conditions)),
     JSON.stringify(list(medications)), (notes || '').trim(), (ssnLast4 || '').trim().slice(-4)]
  );
  const patient = mapPatient(await queryOne('SELECT * FROM patients WHERE id = ?', [id]));
  await audit({
    actorId: req.user.sub, actorName: req.user.name, role: req.user.role,
    action: 'REGISTER_PATIENT', patientId: id,
    details: `Registered patient ${patient.name} (${id})`,
  });
  res.status(201).json({ patient: filterPatientFor(req.user.role, patient) });
});

// PATCH /api/patients/:id — edit demographics (doctor, admin)
router.patch('/:id', requirePermission('edit_patients'), async (req, res) => {
  const row = await queryOne('SELECT * FROM patients WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Patient not found.' });
  const { name, dob, gender, phone, bloodType, allergies, conditions, medications, notes, ssnLast4 } = req.body || {};
  const list = (v, cur) => (v === undefined ? cur : JSON.stringify(Array.isArray(v) ? v : typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : []));
  await run(
    `UPDATE patients SET name = ?, dob = ?, gender = ?, phone = ?, blood_type = ?,
       allergies = ?, conditions = ?, medications = ?, notes = ?, ssn_last4 = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [
      name?.trim() || row.name, dob || row.dob, gender || row.gender,
      phone?.trim() || row.phone, bloodType || row.blood_type,
      list(allergies, row.allergies), list(conditions, row.conditions),
      list(medications, row.medications),
      notes === undefined ? row.notes : notes.trim(),
      ssnLast4 === undefined ? row.ssn_last4 : String(ssnLast4).trim().slice(-4),
      req.params.id,
    ]
  );
  const patient = mapPatient(await queryOne('SELECT * FROM patients WHERE id = ?', [req.params.id]));
  await audit({
    actorId: req.user.sub, actorName: req.user.name, role: req.user.role,
    action: 'UPDATE_PATIENT', patientId: patient.id,
    details: `Updated record of ${patient.name} (${patient.id})`,
  });
  res.json({ patient: filterPatientFor(req.user.role, patient) });
});

// PATCH /api/patients/:id/vitals — nurse, doctor, admin
router.patch('/:id/vitals', requirePermission('edit_vitals'), async (req, res) => {
  const row = await queryOne('SELECT * FROM patients WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Patient not found.' });
  const current = JSON.parse(row.vitals || '{}');
  const next = { ...current, ...req.body };
  await run("UPDATE patients SET vitals = ?, updated_at = datetime('now') WHERE id = ?",
    [JSON.stringify(next), req.params.id]);
  // Keep a history row too (the vitals endpoint is the primary recorder now).
  await run(
    `INSERT INTO vitals_history (patient_id, recorded_by, recorded_by_name, bp, hr, temp, spo2)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.params.id, req.user.sub, req.user.name, next.bp || '', next.hr || null, next.temp || '', next.spo2 || '']
  );
  const patient = mapPatient(await queryOne('SELECT * FROM patients WHERE id = ?', [req.params.id]));
  await audit({
    actorId: req.user.sub, actorName: req.user.name, role: req.user.role,
    action: 'UPDATE_VITALS', patientId: patient.id,
    details: `Updated vitals for ${patient.name}: BP ${next.bp}, HR ${next.hr}`,
  });
  res.json({ patient: filterPatientFor(req.user.role, patient) });
});

// POST /api/patients/:id/notes — doctor, admin
router.post('/:id/notes', requirePermission('edit_patients'), async (req, res) => {
  const { note } = req.body || {};
  if (!note || !note.trim()) return res.status(400).json({ error: 'Note text is required.' });
  const row = await queryOne('SELECT * FROM patients WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Patient not found.' });
  const stamped = `[${new Date().toLocaleDateString()}] ${note.trim()}`;
  const notes = row.notes ? `${row.notes}\n${stamped}` : stamped;
  await run("UPDATE patients SET notes = ?, updated_at = datetime('now') WHERE id = ?",
    [notes, req.params.id]);
  const patient = mapPatient(await queryOne('SELECT * FROM patients WHERE id = ?', [req.params.id]));
  await audit({
    actorId: req.user.sub, actorName: req.user.name, role: req.user.role,
    action: 'ADD_CLINICAL_NOTE', patientId: patient.id,
    details: `Added clinical note for ${patient.name}`,
  });
  res.json({ patient: filterPatientFor(req.user.role, patient) });
});

export default router;
