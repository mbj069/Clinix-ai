// Clinical records — consultations, prescriptions, lab orders.
// All patient-scoped: /api/patients/:id/consultations etc.
// Doctors (and admins) write; anyone who can view patients can read.

import { Router } from 'express';
import { queryOne, queryAll, run, mapConsultation, mapPrescription, mapLabOrder } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission, can } from '../middleware/rbac.js';
import { audit } from '../audit.js';

const router = Router();
router.use(requireAuth);

const mayView = (role) => can(role, 'view_patients') || can(role, 'view_patients_basic');

async function patientOr404(req, res) {
  const row = await queryOne('SELECT * FROM patients WHERE id = ?', [req.params.id]);
  if (!row) {
    res.status(404).json({ error: 'Patient not found.' });
    return null;
  }
  return row;
}

// --- Consultations ---------------------------------------------------------

router.get('/patients/:id/consultations', async (req, res) => {
  if (!mayView(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions.' });
  if (!(await patientOr404(req, res))) return;
  const rows = await queryAll(
    'SELECT * FROM consultations WHERE patient_id = ? ORDER BY date DESC, id DESC',
    [req.params.id]
  );
  res.json({ consultations: rows.map(mapConsultation) });
});

router.post('/patients/:id/consultations', requirePermission('consult'), async (req, res) => {
  const { diagnosis, plan, date } = req.body || {};
  if (!diagnosis || !diagnosis.trim()) {
    return res.status(400).json({ error: 'Diagnosis is required.' });
  }
  const patient = await patientOr404(req, res);
  if (!patient) return;
  await run(
    `INSERT INTO consultations (patient_id, doctor_id, doctor_name, date, diagnosis, plan)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [patient.id, req.user.sub, req.user.name, date || new Date().toISOString().slice(0, 10), diagnosis.trim(), (plan || '').trim()]
  );
  await audit({
    actorId: req.user.sub, actorName: req.user.name, role: req.user.role,
    action: 'ADD_CONSULTATION', patientId: patient.id,
    details: `Consultation for ${patient.name}: ${diagnosis.trim()}`,
  });
  const rows = await queryAll('SELECT * FROM consultations WHERE patient_id = ? ORDER BY date DESC, id DESC', [patient.id]);
  res.status(201).json({ consultations: rows.map(mapConsultation) });
});

// --- Prescriptions ---------------------------------------------------------

router.get('/patients/:id/prescriptions', async (req, res) => {
  if (!mayView(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions.' });
  if (!(await patientOr404(req, res))) return;
  const rows = await queryAll(
    'SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY created_at DESC, id DESC',
    [req.params.id]
  );
  res.json({ prescriptions: rows.map(mapPrescription) });
});

router.post('/patients/:id/prescriptions', requirePermission('prescribe'), async (req, res) => {
  const { medication, dosage, frequency, duration, notes } = req.body || {};
  if (!medication || !medication.trim() || !dosage || !dosage.trim() || !frequency || !frequency.trim()) {
    return res.status(400).json({ error: 'Medication, dosage and frequency are required.' });
  }
  const patient = await patientOr404(req, res);
  if (!patient) return;
  await run(
    `INSERT INTO prescriptions (patient_id, doctor_id, doctor_name, medication, dosage, frequency, duration, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [patient.id, req.user.sub, req.user.name, medication.trim(), dosage.trim(), frequency.trim(), (duration || '').trim(), (notes || '').trim()]
  );
  await audit({
    actorId: req.user.sub, actorName: req.user.name, role: req.user.role,
    action: 'ADD_PRESCRIPTION', patientId: patient.id,
    details: `Prescribed ${medication.trim()} ${dosage.trim()} for ${patient.name}`,
  });
  const rows = await queryAll('SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY created_at DESC, id DESC', [patient.id]);
  res.status(201).json({ prescriptions: rows.map(mapPrescription) });
});

router.patch('/prescriptions/:id', requirePermission('prescribe'), async (req, res) => {
  const { status } = req.body || {};
  if (!['active', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Status must be active, completed or cancelled.' });
  }
  const row = await queryOne('SELECT * FROM prescriptions WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Prescription not found.' });
  await run('UPDATE prescriptions SET status = ? WHERE id = ?', [status, req.params.id]);
  const updated = await queryOne('SELECT * FROM prescriptions WHERE id = ?', [req.params.id]);
  res.json({ prescription: mapPrescription(updated) });
});

// --- Lab orders ------------------------------------------------------------

router.get('/patients/:id/lab-orders', async (req, res) => {
  if (!mayView(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions.' });
  if (!(await patientOr404(req, res))) return;
  const rows = await queryAll(
    'SELECT * FROM lab_orders WHERE patient_id = ? ORDER BY created_at DESC, id DESC',
    [req.params.id]
  );
  res.json({ labOrders: rows.map(mapLabOrder) });
});

router.post('/patients/:id/lab-orders', requirePermission('order_lab'), async (req, res) => {
  const { testName, notes } = req.body || {};
  if (!testName || !testName.trim()) {
    return res.status(400).json({ error: 'Test name is required.' });
  }
  const patient = await patientOr404(req, res);
  if (!patient) return;
  await run(
    `INSERT INTO lab_orders (patient_id, doctor_id, doctor_name, test_name, notes)
     VALUES (?, ?, ?, ?, ?)`,
    [patient.id, req.user.sub, req.user.name, testName.trim(), (notes || '').trim()]
  );
  await audit({
    actorId: req.user.sub, actorName: req.user.name, role: req.user.role,
    action: 'ORDER_LAB_TEST', patientId: patient.id,
    details: `Ordered ${testName.trim()} for ${patient.name}`,
  });
  const rows = await queryAll('SELECT * FROM lab_orders WHERE patient_id = ? ORDER BY created_at DESC, id DESC', [patient.id]);
  res.status(201).json({ labOrders: rows.map(mapLabOrder) });
});

router.patch('/lab-orders/:id', requirePermission('order_lab'), async (req, res) => {
  const { status } = req.body || {};
  if (!['ordered', 'collected', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Status must be ordered, collected, completed or cancelled.' });
  }
  const row = await queryOne('SELECT * FROM lab_orders WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Lab order not found.' });
  await run('UPDATE lab_orders SET status = ? WHERE id = ?', [status, req.params.id]);
  const updated = await queryOne('SELECT * FROM lab_orders WHERE id = ?', [req.params.id]);
  res.json({ labOrder: mapLabOrder(updated) });
});

export default router;
