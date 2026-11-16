// JWT authentication middleware.

import jwt from 'jsonwebtoken';

// Fail closed in production: a deployment without its own JWT_SECRET must
// not start with a public fallback secret. Local dev keeps the fallback
// (with a loud warning) so `npm run dev` works out of the box.
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
if (!process.env.JWT_SECRET && isProduction) {
  throw new Error('JWT_SECRET is required in production — set it in the environment.');
}
if (!process.env.JWT_SECRET) {
  console.warn('[clinix-ai] WARNING: JWT_SECRET is not set — using the insecure dev fallback. Never use this in production.');
}
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, name: user.name, role: user.role },
    SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing credentials.' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}
