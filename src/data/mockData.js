// ------------------------------------------------------------------
// Role definitions (mirrors the backend RBAC model in server/src/middleware/rbac.js).
// Users and patient records now come from the API; demo credentials are
// documented in the README.
// ------------------------------------------------------------------

export const ROLES = {
  admin: {
    label: 'Administrator',
    permissions: ['view_patients', 'edit_patients', 'view_sensitive', 'manage_users', 'view_audit_log', 'schedule', 'edit_vitals', 'ai_config'],
  },
  doctor: {
    label: 'Doctor',
    permissions: ['view_patients', 'edit_patients', 'view_sensitive', 'schedule', 'edit_vitals'],
  },
  nurse: {
    label: 'Nurse',
    permissions: ['view_patients', 'edit_vitals', 'schedule'],
  },
  receptionist: {
    label: 'Receptionist',
    permissions: ['view_patients_basic', 'schedule'],
  },
};
