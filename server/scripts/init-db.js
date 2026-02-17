import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set. Set it in server/.env or your shell environment.');
  }

  const { pool } = await import('../src/config/db.js');

  const schemaPath = path.resolve('schema.sql');
  const sql = await fs.readFile(schemaPath, 'utf8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    // eslint-disable-next-line no-console
    console.log('DB schema applied successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('DB init failed:', err);
  process.exit(1);
});
