// Clinix AI backend — Express API.
// Run: npm run seed (first time), then npm run dev

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initSchema } from './db.js';
import authRoutes from './routes/auth.js';
import patientRoutes from './routes/patients.js';
import auditRoutes from './routes/audit.js';
import aiRoutes from './routes/ai.js';

initSchema();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'clinix-ai-server' }));

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/ai', aiRoutes);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Clinix AI server listening on http://localhost:${PORT}`);
});
