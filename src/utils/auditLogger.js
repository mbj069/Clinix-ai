// ------------------------------------------------------------------
// Audit logger (prototype).
// Every sensitive action is recorded with actor, role, timestamp and details.
// Prototype stores entries in localStorage; production must use an
// append-only, tamper-evident server-side store.
// ------------------------------------------------------------------

const KEY = 'clinix_audit_log';
const MAX_ENTRIES = 500;

export function logAudit({ actorId, actorName, role, action, details, patientId = null }) {
  try {
    const raw = localStorage.getItem(KEY);
    const entries = raw ? JSON.parse(raw) : [];
    entries.unshift({
      id: `a-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      timestamp: new Date().toISOString(),
      actorId,
      actorName,
      role,
      action,
      details,
      patientId,
    });
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* storage unavailable — prototype no-op */
  }
}

export function getAuditLog() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearAuditLog() {
  localStorage.removeItem(KEY);
}
