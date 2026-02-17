import 'dotenv/config';
import { query } from '../src/config/db.js';

async function main() {
  await query(
    `CREATE TABLE IF NOT EXISTS deal_documents (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
      uploaded_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
      doc_type text NULL,
      filename text NOT NULL,
      url text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
    [],
  );

  await query(`ALTER TABLE deal_documents ADD COLUMN IF NOT EXISTS doc_type text NULL`, []);
  await query(`ALTER TABLE deal_documents DROP CONSTRAINT IF EXISTS deal_documents_type_check`, []);
  await query(
    `ALTER TABLE deal_documents ADD CONSTRAINT deal_documents_type_check
     CHECK (doc_type IS NULL OR doc_type IN ('id_proof','agreement','payment_proof','invoice'))`,
    [],
  );

  await query(`CREATE INDEX IF NOT EXISTS idx_deal_documents_deal ON deal_documents (deal_id)`, []);

  console.log('✅ Phase 5 migration complete: deal_documents table updated');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Phase 5 deal documents migration failed');
    console.error(err);
    process.exit(1);
  });
