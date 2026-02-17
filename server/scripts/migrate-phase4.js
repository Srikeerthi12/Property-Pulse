import 'dotenv/config';
import { query } from '../src/config/db.js';

async function main() {
  // Ensure base table exists (older installs may have it already)
  await query(
    `CREATE TABLE IF NOT EXISTS visits (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      buyer_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
      scheduled_at timestamptz NULL,
      status text NOT NULL DEFAULT 'scheduled',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,
    [],
  );

  // Phase 4 columns
  await query(`ALTER TABLE visits ADD COLUMN IF NOT EXISTS inquiry_id uuid NULL REFERENCES property_inquiries(id) ON DELETE CASCADE`, []);
  await query(`ALTER TABLE visits ADD COLUMN IF NOT EXISTS agent_id uuid NULL REFERENCES users(id) ON DELETE SET NULL`, []);
  await query(`ALTER TABLE visits ADD COLUMN IF NOT EXISTS visit_date date NULL`, []);
  await query(`ALTER TABLE visits ADD COLUMN IF NOT EXISTS visit_time time NULL`, []);
  await query(`ALTER TABLE visits ADD COLUMN IF NOT EXISTS notes text NULL`, []);

  // Helpful indexes
  await query(`CREATE INDEX IF NOT EXISTS idx_visits_property ON visits (property_id)`, []);
  await query(`CREATE INDEX IF NOT EXISTS idx_visits_inquiry ON visits (inquiry_id)`, []);
  await query(`CREATE INDEX IF NOT EXISTS idx_visits_agent ON visits (agent_id)`, []);
  await query(`CREATE INDEX IF NOT EXISTS idx_visits_buyer ON visits (buyer_id)`, []);

  // Trigger (keep consistent with schema.sql)
  await query(`DROP TRIGGER IF EXISTS trg_visits_updated_at ON visits`, []);
  await query(
    `CREATE TRIGGER trg_visits_updated_at
     BEFORE UPDATE ON visits
     FOR EACH ROW
     EXECUTE FUNCTION set_updated_at()`,
    [],
  );

  console.log('✅ Phase 4 migration complete: visits table updated');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Phase 4 migration failed');
    console.error(err);
    process.exit(1);
  });
