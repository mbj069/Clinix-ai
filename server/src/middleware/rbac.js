// Role-based access control. Mirrors the frontend permission model —
// but the server is the real gate; frontend checks are UX only.

export const ROLES = {
  admin: ['view_patients', 'edit_patients', 'view_sensitive', 'manage_users', 'view_audit_log', 'schedule', 'edit_vitals', 'ai_config'],
  doctor: ['view_patients', 'edit_patients', 'view_sensitive', 'schedule', 'edit_vitals'],
  nurse: ['view_patients', 'edit_vitals', 'schedule'],
  receptionist: ['view_patients_basic', 'schedule'],
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

/** Strip sensitive clinical fields unless the role may view them. */
export function filterPatientFor(role, patient) {
  if (!patient) return null;
  if (can(role, 'view_sensitive')) return patient;
  const { allergies, conditions, medications, notes, ssn, ...basic } = patient;
  return { ...basic, _redacted: true };
}
