// User administration — admin only.
// GET /api/users — list (no password hashes)
// POST /api/users { username, password, name, role } — create
// PATCH /api/users/:id { active } — deactivate / reactivate

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { queryOne, queryAll, run, mapUser } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { audit } from '../audit.js';

const router = Router();
router.use(requireAuth);

const VALID_ROLES = ['admin', 'doctor', 'nurse', 'receptionist'];

// Directory of doctors (id + name only) — used by the appointment booking
// form. Any signed-in user may read it; full user admin stays admin-only.
router.get('/doctors', async (req, res) => {
  const rows = await queryAll("SELECT id, name FROM users WHERE role = 'doctor' AND active = 1 ORDER BY name");
  res.json({ doctors: rows });
});

router.get('/', requirePermission('manage_users'), async (req, res) => {
  const rows = await queryAll('SELECT * FROM users ORDER BY role, name');
  res.json({ users: rows.map(mapUser) });
});

router.post('/', requirePermission('manage_users'), async (req, res) => {
  const { username, password, name, role } = req.body || {};
  if (!username || !username.trim() || !password || password.length < 6 || !name || !name.trim()) {
    return res.status(400).json({ error: 'Username, name and a password of 6+ characters are required.' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `Role must be one of: ${VALID_ROLES.join(', ')}.` });
  }
  const existing = await queryOne('SELECT id FROM users WHERE username = ?', [username.trim()]);
  if (existing) return res.status(409).json({ error: 'That username is already taken.' });
  const id = `u-${role}-${Date.now().toString(36)}`;
  await run(
    'INSERT INTO users (id, username, password_hash, name, role) VALUES (?, ?, ?, ?, ?)',
    [id, username.trim(), bcrypt.hashSync(password, 10), name.trim(), role]
  );
  await audit({
    actorId: req.user.sub, actorName: req.user.name, role: req.user.role,
    action: 'CREATE_USER', details: `Created user ${username.trim()} (${role})`,
  });
  const row = await queryOne('SELECT * FROM users WHERE id = ?', [id]);
  res.status(201).json({ user: mapUser(row) });
});

router.patch('/:id', requirePermission('manage_users'), async (req, res) => {
  const { active } = req.body || {};
  if (typeof active !== 'boolean') {
    return res.status(400).json({ error: 'active must be true or false.' });
  }
  if (req.params.id === req.user.sub) {
    return res.status(400).json({ error: 'You cannot deactivate your own account.' });
  }
  const row = await queryOne('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'User not found.' });
  await run('UPDATE users SET active = ? WHERE id = ?', [active ? 1 : 0, req.params.id]);
  await audit({
    actorId: req.user.sub, actorName: req.user.name, role: req.user.role,
    action: active ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
    details: `${active ? 'Activated' : 'Deactivated'} user ${row.username} (${row.role})`,
  });
  const updated = await queryOne('SELECT * FROM users WHERE id = ?', [req.params.id]);
  res.json({ user: mapUser(updated) });
});

export default router;
