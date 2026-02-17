import 'dotenv/config';
import { query } from '../src/config/db.js';

async function main() {
  // Ensure base table exists (older installs may have it already)
  await query(
    `CREATE TABLE IF NOT EXISTS deals (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      buyer_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
      seller_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
      agent_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
      status text NOT NULL DEFAULT 'open',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,
    [],
  );

  // Phase 5 columns
  await query(
    `ALTER TABLE deals ADD COLUMN IF NOT EXISTS inquiry_id uuid NULL REFERENCES property_inquiries(id) ON DELETE CASCADE`,
    [],
  );
  await query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS offer_price numeric(14,2) NULL`, []);
  await query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS final_price numeric(14,2) NULL`, []);
  await query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS notes text NULL`, []);

  // Status pipeline constraint
  await query(`ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_status_check`, []);
  await query(
    `ALTER TABLE deals ADD CONSTRAINT deals_status_check
     CHECK (status IN ('open','negotiation','agreement_pending','closed_won','closed_lost','cancelled'))`,
    [],
  );

  // Helpful indexes
  await query(`CREATE INDEX IF NOT EXISTS idx_deals_property ON deals (property_id)`, []);
  await query(`CREATE INDEX IF NOT EXISTS idx_deals_inquiry ON deals (inquiry_id)`, []);
  await query(`CREATE INDEX IF NOT EXISTS idx_deals_agent ON deals (agent_id)`, []);
  await query(`CREATE INDEX IF NOT EXISTS idx_deals_buyer ON deals (buyer_id)`, []);

  // Prevent multiple ACTIVE deals per inquiry (allows historical closed deals)
  await query(`DROP INDEX IF EXISTS uniq_deals_inquiry`, []);
  await query(
    `CREATE UNIQUE INDEX IF NOT EXISTS uniq_deals_active_inquiry
     ON deals (inquiry_id)
     WHERE inquiry_id IS NOT NULL
       AND status NOT IN ('closed_won','closed_lost','cancelled')`,
    [],
  );

  // Buyer can submit offer before deal exists
  await query(`ALTER TABLE property_inquiries ADD COLUMN IF NOT EXISTS offer_price numeric(14,2) NULL`, []);
  await query(`ALTER TABLE property_inquiries ADD COLUMN IF NOT EXISTS offer_message text NULL`, []);
  await query(`ALTER TABLE property_inquiries ADD COLUMN IF NOT EXISTS offer_updated_at timestamptz NULL`, []);

  // Deal notes (author + timestamp)
  await query(
    `CREATE TABLE IF NOT EXISTS deal_notes (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
      author_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
      content text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
    [],
  );
  await query(`CREATE INDEX IF NOT EXISTS idx_deal_notes_deal ON deal_notes (deal_id)`, []);

  // Deal audit log (critical actions)
  await query(
    `CREATE TABLE IF NOT EXISTS deal_audit_logs (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
      actor_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
      action_type text NOT NULL,
      metadata jsonb NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
    [],
  );
  await query(`CREATE INDEX IF NOT EXISTS idx_deal_audit_deal ON deal_audit_logs (deal_id, created_at DESC)`, []);

  // Trigger (keep consistent with schema.sql)
  await query(`DROP TRIGGER IF EXISTS trg_deals_updated_at ON deals`, []);
  await query(
    `CREATE TRIGGER trg_deals_updated_at
     BEFORE UPDATE ON deals
     FOR EACH ROW
     EXECUTE FUNCTION set_updated_at()`,
    [],
  );

  console.log('✅ Phase 5 migration complete: deals table updated');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Phase 5 migration failed');
    console.error(err);
    process.exit(1);
  });
