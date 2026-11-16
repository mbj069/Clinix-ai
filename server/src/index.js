// Clinix AI backend — local entry.
// Run: npm run seed (first time), then npm run dev
// On Vercel this file is the server service entrypoint (see vercel.json).

import 'dotenv/config';
import app from './app.js';
import { queryOne } from './db.js';
import { seedDatabase } from './seed.js';

// First boot on a fresh (empty) database: seed demo data.
const userCount = await queryOne('SELECT COUNT(*) AS n FROM users');
if (!userCount?.n) {
  console.log('Empty database — seeding demo users and patients...');
  await seedDatabase();
  console.log('Seed complete.');
}

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Clinix AI server listening on http://localhost:${PORT}`);
});
