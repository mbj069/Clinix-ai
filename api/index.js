// Vercel serverless entry — the Express app as a function.
// First cold start against an empty Turso database seeds the demo data,
// so the app is usable immediately after deploy.

import app from '../server/src/app.js';
import { queryOne } from '../server/src/db.js';
import { seedDatabase } from '../server/src/seed.js';

const userCount = await queryOne('SELECT COUNT(*) AS n FROM users');
if (!userCount?.n) {
  console.log('Empty database — seeding demo users and patients...');
  await seedDatabase();
}

export default app;
