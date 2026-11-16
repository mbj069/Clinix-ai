// Appointments — reception books, everyone sees the queue.
// GET /api/appointments?date=YYYY-MM-DD&status=&doctor=
// POST /api/appointments { patientId, doctorId, date, time, reason }
// PATCH /api/appointments/:id { status }

import { Router } from 'express';
import { queryOne, queryAll, run, mapAppointment } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission, can } from '../middleware/rbac.js';
import { audit } from '../audit.js';

const router = Router();
router.use(requireAuth);

const STATUSES = ['scheduled', 'checked_in', 'completed', 'cancelled', 'no_show'];

// The queue belongs to reception (and admin). Doctors may read it only
// for themselves — their own appointments, forced server-side, whatever
// the query asks for. Nurses have no business with the booking queue.
router.get('/', async (req, res) => {
  if (!can(req.user.role, 'schedule') && !can(req.user.role, 'consult')) {
    return res.status(403).json({ error: 'Insufficient permissions.' });
  }
  const { date, status, doctor, patient } = req.query;
  const where = [];
  const args = [];
  if (req.user.role === 'doctor') {
    where.push('a.doctor_id = ?'); args.push(req.user.sub);
  } else if (doctor) {
    where.push('a.doctor_id = ?'); args.push(doctor);
  }
  if (date) { where.push('a.date = ?'); args.push(date); }
  if (status && STATUSES.includes(status)) { where.push('a.status = ?'); args.push(status); }
  if (patient) { where.push('a.patient_id = ?'); args.push(patient); }
  const rows = await queryAll(
    `SELECT a.*, p.name AS patient_name FROM appointments a
     LEFT JOIN patients p ON p.id = a.patient_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY a.date, a.time`,
    args
  );
  res.json({ appointments: rows.map(mapAppointment) });
});

router.post('/', requirePermission('schedule'), async (req, res) => {
  const { patientId, doctorId, date, time, reason } = req.body || {};
  if (!patientId || !date || !time) {
    return res.status(400).json({ error: 'Patient, date and time are required.' });
  }
  const patient = await queryOne('SELECT id, name FROM patients WHERE id = ?', [patientId]);
  if (!patient) return res.status(404).json({ error: 'Patient not found.' });
  let doctorName = '';
  if (doctorId) {
    const doc = await queryOne("SELECT id, name FROM users WHERE id = ? AND role = 'doctor'", [doctorId]);
    if (!doc) return res.status(404).json({ error: 'Doctor not found.' });
    doctorName = doc.name;
  }
  await run(
    `INSERT INTO appointments (patient_id, doctor_id, doctor_name, date, time, reason, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [patientId, doctorId || '', doctorName, date, time, reason || '', req.user.sub]
  );
  // NOTE: last_insert_rowid() is connection-scoped and unreliable over
  // Turso HTTP (each execute may use a fresh connection), so re-read the
  // newest row instead.
  const row = await queryOne('SELECT a.*, p.name AS patient_name FROM appointments a LEFT JOIN patients p ON p.id = a.patient_id WHERE a.id = (SELECT MAX(id) FROM appointments)');
  await audit({
    actorId: req.user.sub, actorName: req.user.name, role: req.user.role,
    action: 'BOOK_APPOINTMENT', patientId,
    details: `Booked appointment for ${patient.name} on ${date} ${time}`,
  });
  res.status(201).json({ appointment: mapAppointment(row) });
});

router.patch('/:id', requirePermission('schedule'), async (req, res) => {
  const { status } = req.body || {};
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${STATUSES.join(', ')}.` });
  }
  const row = await queryOne('SELECT a.*, p.name AS patient_name FROM appointments a LEFT JOIN patients p ON p.id = a.patient_id WHERE a.id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Appointment not found.' });
  await run('UPDATE appointments SET status = ? WHERE id = ?', [status, req.params.id]);
  await audit({
    actorId: req.user.sub, actorName: req.user.name, role: req.user.role,
    action: 'UPDATE_APPOINTMENT', patientId: row.patient_id,
    details: `Appointment for ${row.patient_name || row.patient_id} on ${row.date} ${row.time} → ${status}`,
  });
  const updated = await queryOne('SELECT a.*, p.name AS patient_name FROM appointments a LEFT JOIN patients p ON p.id = a.patient_id WHERE a.id = ?', [req.params.id]);
  res.json({ appointment: mapAppointment(updated) });
});

export default router;
