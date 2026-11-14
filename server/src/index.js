// Clinix AI backend — Express API.
// Run: npm run seed (first time), then npm run dev
// In production (Render) this same process also serves the built Vite
// frontend from ../dist, so one URL covers app + API. On first boot with
// an empty database it seeds the demo users/patients automatically.

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initSchema, db } from './db.js';
import authRoutes from './routes/auth.js';
import patientRoutes from './routes/patients.js';
import auditRoutes from './routes/audit.js';
import aiRoutes from './routes/ai.js';

initSchema();

// First boot on a fresh (ephemeral) disk: seed demo data so the app is
// usable immediately. Seed is idempotent (INSERT ... ON CONFLICT).
const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get()?.n ?? 0;
if (userCount === 0) {
  console.log('Empty database — seeding demo users and patients...');
  await import('./seed.js');
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'clinix-ai-server' }));

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/ai', aiRoutes);

// Serve the built frontend (npm run build) when present, with an SPA
// fallback so client-side routes (e.g. /patients) load on refresh.
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

app.listen(PORT, () => {
  console.log(`Clinix AI server listening on http://localhost:${PORT}`);
});
