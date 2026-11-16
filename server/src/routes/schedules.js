// Doctor weekly sitting hours — admin sets them, everyone reads them.
// GET /api/schedules — all schedules, with doctor names
// POST /api/schedules { doctorId, dayOfWeek, startTime, endTime } — admin (upsert per doctor+day)
// DELETE /api/schedules/:id — admin

import { Router } from 'express';
import { queryOne, queryAll, run, mapSchedule } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { audit } from '../audit.js';

const router = Router();
router.use(requireAuth);

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const isTime = (t) => /^\d{2}:\d{2}$/.test(t || '');

router.get('/', async (req, res) => {
  const rows = await queryAll(
    `SELECT s.*, u.name AS doctor_name FROM doctor_schedules s
     LEFT JOIN users u ON u.id = s.doctor_id
     ORDER BY u.name, s.day_of_week`
  );
  res.json({ schedules: rows.map(mapSchedule), days: DAYS });
});

router.post('/', requirePermission('manage_users'), async (req, res) => {
  const { doctorId, dayOfWeek, startTime, endTime } = req.body || {};
  if (!doctorId || dayOfWeek === undefined || dayOfWeek === null) {
    return res.status(400).json({ error: 'Doctor and day of week are required.' });
  }
  const day = Number(dayOfWeek);
  if (!Number.isInteger(day) || day < 0 || day > 6) {
    return res.status(400).json({ error: 'Day of week must be 0 (Sunday) to 6 (Saturday).' });
  }
  if (!isTime(startTime) || !isTime(endTime) || startTime >= endTime) {
    return res.status(400).json({ error: 'Start and end times must be HH:MM, with start before end.' });
  }
  const doc = await queryOne("SELECT id, name FROM users WHERE id = ? AND role = 'doctor' AND active = 1", [doctorId]);
  if (!doc) return res.status(404).json({ error: 'Active doctor not found.' });
  await run(
    `INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(doctor_id, day_of_week) DO UPDATE SET start_time=excluded.start_time, end_time=excluded.end_time`,
    [doctorId, day, startTime, endTime]
  );
  await audit({
    actorId: req.user.sub, actorName: req.user.name, role: req.user.role,
    action: 'SET_DOCTOR_SCHEDULE',
    details: `Set ${doc.name} sitting hours: ${DAYS[day]} ${startTime}–${endTime}`,
  });
  const rows = await queryAll(
    `SELECT s.*, u.name AS doctor_name FROM doctor_schedules s
     LEFT JOIN users u ON u.id = s.doctor_id ORDER BY u.name, s.day_of_week`
  );
  res.status(201).json({ schedules: rows.map(mapSchedule) });
});

router.delete('/:id', requirePermission('manage_users'), async (req, res) => {
  const row = await queryOne(
    `SELECT s.*, u.name AS doctor_name FROM doctor_schedules s
     LEFT JOIN users u ON u.id = s.doctor_id WHERE s.id = ?`,
    [req.params.id]
  );
  if (!row) return res.status(404).json({ error: 'Schedule not found.' });
  await run('DELETE FROM doctor_schedules WHERE id = ?', [req.params.id]);
  await audit({
    actorId: req.user.sub, actorName: req.user.name, role: req.user.role,
    action: 'REMOVE_DOCTOR_SCHEDULE',
    details: `Removed ${row.doctor_name || row.doctor_id} sitting hours (${DAYS[row.day_of_week]} ${row.start_time}–${row.end_time})`,
  });
  res.json({ ok: true });
});

export default router;
