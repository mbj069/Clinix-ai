// ------------------------------------------------------------------
// Role definitions (mirrors the backend RBAC model in server/src/middleware/rbac.js).
// Users and patient records now come from the API; demo credentials are
// documented in the README.
// ------------------------------------------------------------------

export const ROLES = {
  admin: {
    label: 'Administrator',
    permissions: ['view_patients', 'view_sensitive', 'view_clinical', 'add_patients', 'edit_demographics', 'edit_patients', 'manage_users', 'view_audit_log', 'schedule', 'edit_vitals', 'ai_config', 'ai_search', 'consult', 'prescribe', 'order_lab', 'manage_tasks'],
  },
  doctor: {
    label: 'Doctor',
    permissions: ['view_patients', 'view_sensitive', 'edit_patients', 'ai_search', 'consult', 'prescribe', 'order_lab'],
  },
  nurse: {
    label: 'Nurse',
    permissions: ['view_patients', 'view_clinical', 'edit_vitals', 'ai_search', 'manage_tasks'],
  },
  receptionist: {
    label: 'Receptionist',
    permissions: ['view_patients_basic', 'add_patients', 'edit_demographics', 'schedule'],
  },
};
