// Vitals history — every recording is kept as a row; the patient record
// holds the latest values for quick display.
// GET /api/patients/:id/vitals — history, newest first
// POST /api/patients/:id/vitals { bp, hr, temp, spo2 } — record (nurse+)

import { Router } from 'express';
import { queryOne, queryAll, run, mapVitals, mapPatient } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission, can, filterPatientFor } from '../middleware/rbac.js';
import { audit } from '../audit.js';

const router = Router();
router.use(requireAuth);

router.get('/patients/:id/vitals', async (req, res) => {
  if (!can(req.user.role, 'view_patients') && !can(req.user.role, 'view_patients_basic')) {
    return res.status(403).json({ error: 'Insufficient permissions.' });
  }
  const patient = await queryOne('SELECT id FROM patients WHERE id = ?', [req.params.id]);
  if (!patient) return res.status(404).json({ error: 'Patient not found.' });
  const rows = await queryAll(
    'SELECT * FROM vitals_history WHERE patient_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 50',
    [req.params.id]
  );
  res.json({ vitals: rows.map(mapVitals) });
});

router.post('/patients/:id/vitals', requirePermission('edit_vitals'), async (req, res) => {
  const { bp, hr, temp, spo2 } = req.body || {};
  if (!bp && !hr && !temp && !spo2) {
    return res.status(400).json({ error: 'At least one vital sign is required.' });
  }
  const row = await queryOne('SELECT * FROM patients WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Patient not found.' });
  await run(
    `INSERT INTO vitals_history (patient_id, recorded_by, recorded_by_name, bp, hr, temp, spo2)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [row.id, req.user.sub, req.user.name, bp || '', hr || null, temp || '', spo2 || '']
  );
  const current = JSON.parse(row.vitals || '{}');
  const next = { ...current };
  if (bp) next.bp = bp;
  if (hr) next.hr = hr;
  if (temp) next.temp = temp;
  if (spo2) next.spo2 = spo2;
  await run("UPDATE patients SET vitals = ?, updated_at = datetime('now') WHERE id = ?",
    [JSON.stringify(next), row.id]);
  const patient = mapPatient(await queryOne('SELECT * FROM patients WHERE id = ?', [row.id]));
  await audit({
    actorId: req.user.sub, actorName: req.user.name, role: req.user.role,
    action: 'UPDATE_VITALS', patientId: patient.id,
    details: `Recorded vitals for ${patient.name}: BP ${next.bp || '—'}, HR ${next.hr || '—'}`,
  });
  res.status(201).json({ patient: filterPatientFor(req.user.role, patient) });
});

export default router;
