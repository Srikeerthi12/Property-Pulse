import dotenv from 'dotenv';

dotenv.config({ path: new URL('../.env', import.meta.url) });

const { query, pool } = await import('../src/config/db.js');

try {
  const res = await query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'properties'
     ORDER BY ordinal_position`,
  );
  // eslint-disable-next-line no-console
  console.table(res.rows);
} finally {
  await pool.end();
}
