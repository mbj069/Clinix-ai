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

// PATCH /api/patients/:id/vitals — nurse, doctor, admin
router.patch('/:id/vitals', requirePermission('edit_vitals'), async (req, res) => {
  const row = await queryOne('SELECT * FROM patients WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Patient not found.' });
  const current = JSON.parse(row.vitals || '{}');
  const next = { ...current, ...req.body };
  await run("UPDATE patients SET vitals = ?, updated_at = datetime('now') WHERE id = ?",
    [JSON.stringify(next), req.params.id]);
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
