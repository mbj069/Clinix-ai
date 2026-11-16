// Clinix AI Express app — shared by the local server (server/src/index.js)
// and the Vercel server service. No listen() here.

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/auth.js';
import patientRoutes from './routes/patients.js';
import auditRoutes from './routes/audit.js';
import aiRoutes from './routes/ai.js';

const app = express();

// Behind Vercel's proxy (and any reverse proxy), trust the first proxy hop
// so rate limiting sees the real client IP.
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Rate limits — brute-force protection on login, abuse protection on the API.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Try again in 15 minutes.' },
});
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again shortly.' },
});

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'clinix-ai-server' }));

app.use('/api/auth', loginLimiter, authRoutes);
app.use('/api', apiLimiter);
app.use('/api/patients', patientRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/ai', aiRoutes);

// Serve the built frontend (npm run build) when present — local dev and
// single-host deploys. On Vercel the static files are served by the
// platform, so this block is skipped (no dist/ inside the function).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../../dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found.' });
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

export default app;
