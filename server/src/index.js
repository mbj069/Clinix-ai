// Clinix AI backend — local entry.
// Run: npm run seed (first time), then npm run dev
// On Vercel this file is the server service entrypoint (see vercel.json).

import 'dotenv/config';
import app from './app.js';
import { queryOne } from './db.js';
import { seedDatabase, seedClinical } from './seed.js';

// First boot on a fresh (empty) database: seed demo data ONLY when the
// trial/demo deployment opts in. A copied deployment for a real client
// must never auto-seed demo accounts with public passwords — it starts
// empty and the client onboards real users. Manual seeding still works:
// `npm run seed` (server/src/seed.js) is explicit and unaffected.
if (process.env.SEED_DEMO_DATA === 'true') {
  const userCount = await queryOne('SELECT COUNT(*) AS n FROM users');
  if (!userCount?.n) {
    console.log('Empty database — seeding demo users and patients...');
    await seedDatabase();
    console.log('Seed complete.');
  } else {
    // Existing trial DB: top up the v2 demo rows (appointments, consultations,
    // prescriptions, lab orders, vitals, tasks). seedClinical is idempotent,
    // so re-boots are no-ops and real data is never touched.
    await seedClinical();
  }
} else {
  const userCount = await queryOne('SELECT COUNT(*) AS n FROM users');
  if (!userCount?.n) {
    console.log('Empty database — demo seeding is OFF (set SEED_DEMO_DATA=true for a trial/demo deployment).');
  }
}

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Clinix AI server listening on http://localhost:${PORT}`);
});
