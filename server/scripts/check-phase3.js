import dotenv from 'dotenv';
dotenv.config({ path: new URL('../.env', import.meta.url) });

const { query } = await import('../src/config/db.js');

async function run() {
  const result = await query(
    "SELECT to_regclass('public.property_inquiries') AS property_inquiries, to_regclass('public.inquiry_notes') AS inquiry_notes, to_regclass('public.favorites') AS favorites",
  );
  // eslint-disable-next-line no-console
  console.log(result.rows[0]);

  const row = result.rows[0] || {};
  const missing = Object.entries(row)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length) {
    // eslint-disable-next-line no-console
    console.error(`Missing tables: ${missing.join(', ')}`);
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log('Phase 3 tables: OK');
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
