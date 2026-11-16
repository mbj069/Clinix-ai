// Server-side audit writer. Append-only — no update/delete path exists.

import { run } from './db.js';

export async function audit({ actorId, actorName, role, action, patientId = null, details = '' }) {
  try {
    await run(
      `INSERT INTO audit_log (actor_id, actor_name, role, action, patient_id, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [actorId, actorName, role, action, patientId, details]
    );
  } catch (e) {
    console.error('audit write failed:', e.message);
  }
}
