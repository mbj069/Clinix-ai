import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, mapUser } from '../db.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { audit } from '../audit.js';

const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  const user = mapUser(row);
  audit({ actorId: user.id, actorName: user.name, role: user.role, action: 'LOGIN', details: 'User signed in' });
  res.json({ token: signToken(user), user });
});

router.post('/logout', requireAuth, (req, res) => {
  audit({ actorId: req.user.sub, actorName: req.user.name, role: req.user.role, action: 'LOGOUT', details: 'User signed out' });
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.sub);
  if (!row) return res.status(401).json({ error: 'User no longer exists.' });
  res.json({ user: mapUser(row) });
});

export default router;
