import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { queryOne, mapUser } from '../db.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { audit } from '../audit.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  const row = await queryOne('SELECT * FROM users WHERE username = ?', [username]);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  if (row.active === 0) {
    return res.status(403).json({ error: 'This account has been deactivated. Contact an administrator.' });
  }
  const user = mapUser(row);
  await audit({ actorId: user.id, actorName: user.name, role: user.role, action: 'LOGIN', details: 'User signed in' });
  res.json({ token: signToken(user), user });
});

router.post('/logout', requireAuth, async (req, res) => {
  await audit({ actorId: req.user.sub, actorName: req.user.name, role: req.user.role, action: 'LOGOUT', details: 'User signed out' });
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const row = await queryOne('SELECT * FROM users WHERE id = ?', [req.user.sub]);
  if (!row) return res.status(401).json({ error: 'User no longer exists.' });
  res.json({ user: mapUser(row) });
});

export default router;
