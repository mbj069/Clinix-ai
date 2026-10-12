import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { audit } from '../audit.js';

const router = Router();
router.use(requireAuth, requirePermission('view_audit_log'));

// GET /api/audit?q=&limit= — admin only, newest first
router.get('/', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
  const q = (req.query.q || '').toLowerCase();
  let rows = db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?').all(limit);
  if (q) {
    rows = rows.filter(
      (r) =>
        r.actor_name.toLowerCase().includes(q) ||
        (r.patient_id || '').toLowerCase().includes(q) ||
        r.action.toLowerCase().includes(q)
    );
  }
  res.json({ entries: rows });
});

// DELETE /api/audit — deliberately NOT provided. The trail is append-only.
// (The prototype allowed clearing; the real backend does not.)

export default router;
