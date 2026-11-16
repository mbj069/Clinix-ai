// Role-based access control. Mirrors the frontend permission model —
// but the server is the real gate; frontend checks are UX only.
//
// The model follows the patient journey:
//   Reception registers → books (inside the doctor's sitting hours)
//     → checks in
//   Doctor consults their own patients, prescribes, orders labs
//   Nurse records vitals, works the ward task list
//   Admin manages staff + sitting hours, sees everything, audit log
//
// A patient becomes a doctor's when reception books them an appointment
// (or a consultation / prescription / lab order links them). Doctors only
// ever see their own patients — enforced here, not just in the UI.

import { queryOne } from '../db.js';

export const ROLES = {
  admin: ['view_patients', 'view_sensitive', 'view_clinical', 'add_patients', 'edit_demographics', 'edit_patients', 'manage_users', 'view_audit_log', 'schedule', 'edit_vitals', 'ai_config', 'ai_search', 'consult', 'prescribe', 'order_lab', 'manage_tasks'],
  doctor: ['view_patients', 'view_sensitive', 'edit_patients', 'ai_search', 'consult', 'prescribe', 'order_lab'],
  nurse: ['view_patients', 'view_clinical', 'edit_vitals', 'ai_search', 'manage_tasks'],
  receptionist: ['view_patients_basic', 'add_patients', 'edit_demographics', 'schedule'],
};

export function can(role, permission) {
  return (ROLES[role] || []).includes(permission);
}

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Missing credentials.' });
    if (!can(req.user.role, permission)) {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }
    next();
  };
}

/** Three-tier patient visibility.
 *  - view_sensitive (admin, doctor): the full record, SSN included.
 *  - view_clinical (nurse): clinical data (allergies, conditions,
 *    medications, notes, vitals) but never the SSN — a nurse must know
 *    allergies to care safely.
 *  - everyone else who may view patients (reception): demographics only —
 *    no clinical data, no vitals, no SSN. */
export function filterPatientFor(role, patient) {
  if (!patient) return null;
  if (can(role, 'view_sensitive')) return patient;
  const { ssn, ...noSsn } = patient;
  if (can(role, 'view_clinical')) return noSsn;
  const { allergies, conditions, medications, notes, vitals, ...basic } = noSsn;
  return { ...basic, _redacted: true };
}

/** The link that makes a patient a doctor's: an appointment, a
 *  consultation, a prescription or a lab order with that doctor. */
const OWN_PATIENT_SQL = `EXISTS (SELECT 1 FROM appointments WHERE patient_id = patients.id AND doctor_id = ?)
     OR EXISTS (SELECT 1 FROM consultations WHERE patient_id = patients.id AND doctor_id = ?)
     OR EXISTS (SELECT 1 FROM prescriptions WHERE patient_id = patients.id AND doctor_id = ?)
     OR EXISTS (SELECT 1 FROM lab_orders WHERE patient_id = patients.id AND doctor_id = ?)`;

export async function isOwnPatient(doctorId, patientId) {
  const row = await queryOne(
    `SELECT 1 AS ok FROM patients WHERE id = ? AND (${OWN_PATIENT_SQL})`,
    [patientId, doctorId, doctorId, doctorId, doctorId]
  );
  return !!row;
}

/** SQL fragment + args to restrict a patient list to one doctor's own. */
export function ownPatientsWhere(doctorId) {
  return { sql: OWN_PATIENT_SQL, args: [doctorId, doctorId, doctorId, doctorId] };
}

/** Middleware: doctors may only touch their own patients (route param
 *  holds the patient id). Other roles pass through. */
export function requireOwnPatient(param = 'id') {
  return async (req, res, next) => {
    if (req.user.role !== 'doctor') return next();
    if (await isOwnPatient(req.user.sub, req.params[param])) return next();
    return res.status(403).json({ error: 'This patient is not assigned to you.' });
  };
}
