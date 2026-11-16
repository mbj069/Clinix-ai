// Nursing / ward tasks.
// GET /api/tasks?status=open|done&patient=
// POST /api/tasks { patientId, task, due }
// PATCH /api/tasks/:id { status }

import { Router } from 'express';
import { queryOne, queryAll, run, mapTask } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission, can } from '../middleware/rbac.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  if (!can(req.user.role, 'view_patients') && !can(req.user.role, 'view_patients_basic')) {
    return res.status(403).json({ error: 'Insufficient permissions.' });
  }
  const { status, patient } = req.query;
  const where = [];
  const args = [];
  if (status === 'open' || status === 'done') { where.push('t.status = ?'); args.push(status); }
  if (patient) { where.push('t.patient_id = ?'); args.push(patient); }
  const rows = await queryAll(
    `SELECT t.*, p.name AS patient_name FROM nursing_tasks t
     LEFT JOIN patients p ON p.id = t.patient_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY t.status, t.created_at DESC`,
    args
  );
  res.json({ tasks: rows.map(mapTask) });
});

router.post('/', requirePermission('manage_tasks'), async (req, res) => {
  const { patientId, task, due } = req.body || {};
  if (!patientId || !task || !task.trim()) {
    return res.status(400).json({ error: 'Patient and task text are required.' });
  }
  const patient = await queryOne('SELECT id FROM patients WHERE id = ?', [patientId]);
  if (!patient) return res.status(404).json({ error: 'Patient not found.' });
  await run(
    `INSERT INTO nursing_tasks (patient_id, task, due, created_by, created_by_name)
     VALUES (?, ?, ?, ?, ?)`,
    [patientId, task.trim(), (due || '').trim(), req.user.sub, req.user.name]
  );
  // NOTE: last_insert_rowid() is connection-scoped and unreliable over
  // Turso HTTP (each execute may use a fresh connection), so re-read the
  // newest row instead.
  const row = await queryOne('SELECT t.*, p.name AS patient_name FROM nursing_tasks t LEFT JOIN patients p ON p.id = t.patient_id WHERE t.id = (SELECT MAX(id) FROM nursing_tasks)');
  res.status(201).json({ task: mapTask(row) });
});

router.patch('/:id', requirePermission('manage_tasks'), async (req, res) => {
  const { status } = req.body || {};
  if (!['open', 'done'].includes(status)) {
    return res.status(400).json({ error: 'Status must be open or done.' });
  }
  const row = await queryOne('SELECT * FROM nursing_tasks WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Task not found.' });
  await run('UPDATE nursing_tasks SET status = ? WHERE id = ?', [status, req.params.id]);
  const updated = await queryOne('SELECT t.*, p.name AS patient_name FROM nursing_tasks t LEFT JOIN patients p ON p.id = t.patient_id WHERE t.id = ?', [req.params.id]);
  res.json({ task: mapTask(updated) });
});

export default router;
