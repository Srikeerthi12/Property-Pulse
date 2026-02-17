import dotenv from 'dotenv';

dotenv.config({ path: new URL('../.env', import.meta.url) });

const { query, pool } = await import('../src/config/db.js');

async function exec(sql) {
  await query(sql);
}

async function main() {
  await exec(`CREATE TABLE IF NOT EXISTS property_inquiries (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    buyer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'new',
    message text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );`);

  await exec(`ALTER TABLE property_inquiries DROP CONSTRAINT IF EXISTS property_inquiries_status_check;`);
  await exec(`ALTER TABLE property_inquiries ADD CONSTRAINT property_inquiries_status_check
    CHECK (status IN ('new','contacted','visit_scheduled','negotiation','closed','dropped'));`);

  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_property_inquiries_property_buyer
    ON property_inquiries (property_id, buyer_id);`);

  await exec(`CREATE INDEX IF NOT EXISTS idx_property_inquiries_property ON property_inquiries (property_id);`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_property_inquiries_buyer ON property_inquiries (buyer_id);`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_property_inquiries_agent ON property_inquiries (agent_id);`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_property_inquiries_status ON property_inquiries (status);`);

  await exec(`DROP TRIGGER IF EXISTS trg_property_inquiries_updated_at ON property_inquiries;`);
  await exec(`CREATE TRIGGER trg_property_inquiries_updated_at
    BEFORE UPDATE ON property_inquiries
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();`);

  await exec(`CREATE TABLE IF NOT EXISTS inquiry_notes (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    inquiry_id uuid NOT NULL REFERENCES property_inquiries(id) ON DELETE CASCADE,
    agent_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
    note text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  );`);

  await exec(`CREATE INDEX IF NOT EXISTS idx_inquiry_notes_inquiry ON inquiry_notes (inquiry_id);`);

  await exec(`CREATE TABLE IF NOT EXISTS favorites (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    buyer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
  );`);

  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_favorites_buyer_property
    ON favorites (buyer_id, property_id);`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_favorites_buyer ON favorites (buyer_id);`);

  // eslint-disable-next-line no-console
  console.log('Phase 3 migration applied (idempotent).');
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
