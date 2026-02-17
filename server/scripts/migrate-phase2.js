import dotenv from 'dotenv';

dotenv.config({ path: new URL('../.env', import.meta.url) });

const { query, pool } = await import('../src/config/db.js');

async function exec(sql) {
  await query(sql);
}

async function main() {
  // 1) Rename owner_user_id -> seller_id if needed
  await exec(`DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'properties'
      AND column_name = 'owner_user_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'properties'
      AND column_name = 'seller_id'
  ) THEN
    ALTER TABLE properties RENAME COLUMN owner_user_id TO seller_id;
  END IF;
END $$;`);

  // 2) Ensure all Phase 2 columns exist
  await exec(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS seller_id uuid;`);
  await exec(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS area numeric;`);
  await exec(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS location text;`);
  await exec(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS latitude numeric;`);
  await exec(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS longitude numeric;`);
  await exec(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS property_type text;`);
  await exec(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS bedrooms int;`);
  await exec(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS bathrooms int;`);
  await exec(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS amenities jsonb DEFAULT '[]'::jsonb;`);
  await exec(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS rejection_reason text;`);
  await exec(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS view_count int NOT NULL DEFAULT 0;`);

  // 3) Images + logs tables
  await exec(`CREATE TABLE IF NOT EXISTS property_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    image_url text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  );`);

  await exec(`CREATE INDEX IF NOT EXISTS idx_property_images_property_id ON property_images(property_id);`);

  await exec(`CREATE TABLE IF NOT EXISTS property_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    action_type text NOT NULL,
    performed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  );`);

  await exec(`CREATE INDEX IF NOT EXISTS idx_property_logs_property_id ON property_logs(property_id);`);

  // eslint-disable-next-line no-console
  console.log('Phase 2 migration applied (idempotent).');
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Migration failed:', err?.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
