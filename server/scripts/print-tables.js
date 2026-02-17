import dotenv from 'dotenv';

dotenv.config({ path: new URL('../.env', import.meta.url) });

const { query, pool } = await import('../src/config/db.js');

try {
  const result = await query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
  );
  for (const row of result.rows) {
    // eslint-disable-next-line no-console
    console.log(row.table_name);
  }
} finally {
  await pool.end();
}
