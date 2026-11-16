// Dashboard stats — operational counts, no patient details.
// GET /api/stats/dashboard?date=YYYY-MM-DD&dayOfWeek=0-6
// The caller passes its own local date/day (the server runs in UTC, the
// hospital in its local timezone). Availability ("on duty now") is computed
// by the frontend from scheduleToday + the local clock.
//
// The response is shaped per role — each role only gets the numbers its
// job needs:
//   admin      — everything, incl. per-doctor counts
//   doctor     — only MY appointments / consultations / patients, and only
//                MY row in the doctors list (with counts)
//   nurse      — ward numbers (patients, appointments, consultations,
//                open tasks) + doctors on duty (hours + status, no counts)
//   reception  — queue numbers (appointments, checked in, patients) +
//                doctors on duty (hours + status, no counts)

import { Router } from 'express';
import { queryOne, queryAll } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { ownPatientsWhere } from '../middleware/rbac.js';

const router = Router();
router.use(requireAuth);

router.get('/dashboard', async (req, res) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '')
    ? req.query.date
    : new Date().toISOString().slice(0, 10);
  const dayOfWeek = [0, 1, 2, 3, 4, 5, 6].includes(Number(req.query.dayOfWeek))
    ? Number(req.query.dayOfWeek)
    : new Date(`${date}T12:00:00Z`).getUTCDay();

  const role = req.user.role;
  const me = req.user.sub;

  const doctors = await queryAll(
    "SELECT id, name FROM users WHERE role = 'doctor' AND active = 1 ORDER BY name"
  );

  // Per-doctor rows. Counts only for admin, and for a doctor looking at
  // themself. Everyone else sees sitting hours + availability only.
  const doctorRows = [];
  for (const d of doctors) {
    const sched = await queryOne(
      'SELECT start_time, end_time FROM doctor_schedules WHERE doctor_id = ? AND day_of_week = ?',
      [d.id, dayOfWeek]
    );
    const row = {
      id: d.id,
      name: d.name,
      scheduleToday: sched ? { startTime: sched.start_time, endTime: sched.end_time } : null,
    };
    if (role === 'admin' || (role === 'doctor' && d.id === me)) {
      row.appointmentsToday = (await queryOne(
        'SELECT COUNT(*) AS n FROM appointments WHERE doctor_id = ? AND date = ?', [d.id, date]
      )).n;
      row.consultationsToday = (await queryOne(
        'SELECT COUNT(*) AS n FROM consultations WHERE doctor_id = ? AND date = ?', [d.id, date]
      )).n;
      row.consultationsTotal = (await queryOne(
        'SELECT COUNT(*) AS n FROM consultations WHERE doctor_id = ?', [d.id]
      )).n;
    }
    doctorRows.push(row);
  }

  const totals = {};
  if (role === 'doctor') {
    totals.myAppointmentsToday = (await queryOne(
      'SELECT COUNT(*) AS n FROM appointments WHERE doctor_id = ? AND date = ?', [me, date]
    )).n;
    totals.myConsultationsToday = (await queryOne(
      'SELECT COUNT(*) AS n FROM consultations WHERE doctor_id = ? AND date = ?', [me, date]
    )).n;
    totals.myConsultationsTotal = (await queryOne(
      'SELECT COUNT(*) AS n FROM consultations WHERE doctor_id = ?', [me]
    )).n;
    const { sql, args } = ownPatientsWhere(me);
    totals.myPatients = (await queryOne(
      `SELECT COUNT(*) AS n FROM patients WHERE ${sql}`, args
    )).n;
    return res.json({ date, dayOfWeek, totals, doctors: doctorRows.filter((d) => d.id === me) });
  }

  totals.patients = (await queryOne('SELECT COUNT(*) AS n FROM patients')).n;
  totals.appointmentsToday = (await queryOne('SELECT COUNT(*) AS n FROM appointments WHERE date = ?', [date])).n;
  totals.consultationsToday = (await queryOne('SELECT COUNT(*) AS n FROM consultations WHERE date = ?', [date])).n;
  totals.checkedInToday = (await queryOne(
    "SELECT COUNT(*) AS n FROM appointments WHERE date = ? AND status = 'checked_in'", [date]
  )).n;
  if (role === 'admin') {
    totals.doctors = doctors.length;
    totals.openTasks = (await queryOne("SELECT COUNT(*) AS n FROM nursing_tasks WHERE status = 'open'")).n;
  }
  if (role === 'nurse') {
    totals.openTasks = (await queryOne("SELECT COUNT(*) AS n FROM nursing_tasks WHERE status = 'open'")).n;
  }

  res.json({ date, dayOfWeek, totals, doctors: doctorRows });
});

export default router;
