// Server-side audit writer. Append-only — no update/delete path exists.

import { db } from './db.js';

const insert = db.prepare(`
  INSERT INTO audit_log (actor_id, actor_name, role, action, patient_id, details)
  VALUES (@actor_id, @actor_name, @role, @action, @patient_id, @details)
`);

export function audit({ actorId, actorName, role, action, patientId = null, details = '' }) {
  try {
    insert.run({ actor_id: actorId, actor_name: actorName, role, action, patient_id: patientId, details });
  } catch (e) {
    console.error('audit write failed:', e.message);
  }
}
