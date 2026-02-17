-- PropertyPulse minimal schema (PostgreSQL)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- updated_at helper
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('buyer', 'seller', 'agent', 'admin')),
  is_active boolean NOT NULL DEFAULT true,
  activated_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NULL,
  price numeric(14,2) NULL,
  area numeric(14,2) NULL,
  location text NULL,
  latitude numeric(10,7) NULL,
  longitude numeric(10,7) NULL,
  property_type text NULL,
  bedrooms int NULL,
  bathrooms int NULL,
  amenities jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  rejection_reason text NULL,
  view_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotent migration helpers for existing DBs
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'owner_user_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'seller_id'
  ) THEN
    ALTER TABLE properties RENAME COLUMN owner_user_id TO seller_id;
  END IF;
END $$;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS area numeric(14,2) NULL;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS location text NULL;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS latitude numeric(10,7) NULL;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS longitude numeric(10,7) NULL;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS property_type text NULL;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS bedrooms int NULL;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS bathrooms int NULL;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS amenities jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS rejection_reason text NULL;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS view_count int NOT NULL DEFAULT 0;

ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_status_check;
ALTER TABLE properties ADD CONSTRAINT properties_status_check
  CHECK (status IN ('draft','pending','approved','rejected','sold','inactive'));

CREATE INDEX IF NOT EXISTS idx_properties_seller ON properties (seller_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties (status);
CREATE INDEX IF NOT EXISTS idx_properties_price ON properties (price);
CREATE INDEX IF NOT EXISTS idx_properties_location ON properties (location);
CREATE INDEX IF NOT EXISTS idx_properties_created_at ON properties (created_at);

DROP TRIGGER IF EXISTS trg_properties_updated_at ON properties;
CREATE TRIGGER trg_properties_updated_at
BEFORE UPDATE ON properties
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS property_images (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_images_property ON property_images (property_id);

CREATE TABLE IF NOT EXISTS property_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  performed_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_logs_property ON property_logs (property_id);
CREATE INDEX IF NOT EXISTS idx_property_logs_action ON property_logs (action_type);

CREATE TABLE IF NOT EXISTS requirements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location text NULL,
  min_price numeric(14,2) NULL,
  max_price numeric(14,2) NULL,
  bedrooms int NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_requirements_user ON requirements (user_id);

DROP TRIGGER IF EXISTS trg_requirements_updated_at ON requirements;
CREATE TRIGGER trg_requirements_updated_at
BEFORE UPDATE ON requirements
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS deals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  inquiry_id uuid NULL REFERENCES property_inquiries(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  buyer_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  seller_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  agent_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  offer_price numeric(14,2) NULL,
  final_price numeric(14,2) NULL,
  status text NOT NULL DEFAULT 'open',
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Phase 5 columns/constraints for existing DBs
ALTER TABLE deals ADD COLUMN IF NOT EXISTS inquiry_id uuid NULL REFERENCES property_inquiries(id) ON DELETE CASCADE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS offer_price numeric(14,2) NULL;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS final_price numeric(14,2) NULL;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS notes text NULL;

ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_status_check;
ALTER TABLE deals ADD CONSTRAINT deals_status_check
  CHECK (status IN ('open','negotiation','agreement_pending','closed_won','closed_lost','cancelled'));

CREATE INDEX IF NOT EXISTS idx_deals_property ON deals (property_id);
CREATE INDEX IF NOT EXISTS idx_deals_inquiry ON deals (inquiry_id);
CREATE INDEX IF NOT EXISTS idx_deals_agent ON deals (agent_id);
CREATE INDEX IF NOT EXISTS idx_deals_buyer ON deals (buyer_id);

DROP INDEX IF EXISTS uniq_deals_inquiry;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_deals_active_inquiry
  ON deals (inquiry_id)
  WHERE inquiry_id IS NOT NULL
    AND status NOT IN ('closed_won','closed_lost','cancelled');

DROP TRIGGER IF EXISTS trg_deals_updated_at ON deals;
CREATE TRIGGER trg_deals_updated_at
BEFORE UPDATE ON deals
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS deal_documents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  uploaded_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  doc_type text NULL,
  filename text NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_documents_deal ON deal_documents (deal_id);

ALTER TABLE deal_documents DROP CONSTRAINT IF EXISTS deal_documents_type_check;
ALTER TABLE deal_documents ADD CONSTRAINT deal_documents_type_check
  CHECK (doc_type IS NULL OR doc_type IN ('id_proof','agreement','payment_proof','invoice'));

CREATE TABLE IF NOT EXISTS deal_notes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  author_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_notes_deal ON deal_notes (deal_id);

CREATE TABLE IF NOT EXISTS deal_audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  actor_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_audit_deal ON deal_audit_logs (deal_id, created_at DESC);

CREATE TABLE IF NOT EXISTS visits (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  inquiry_id uuid NULL REFERENCES property_inquiries(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  buyer_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  agent_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  visit_date date NULL,
  visit_time time NULL,
  scheduled_at timestamptz NULL,
  status text NOT NULL DEFAULT 'scheduled',
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visits_property ON visits (property_id);
CREATE INDEX IF NOT EXISTS idx_visits_inquiry ON visits (inquiry_id);
CREATE INDEX IF NOT EXISTS idx_visits_agent ON visits (agent_id);
CREATE INDEX IF NOT EXISTS idx_visits_buyer ON visits (buyer_id);

DROP TRIGGER IF EXISTS trg_visits_updated_at ON visits;
CREATE TRIGGER trg_visits_updated_at
BEFORE UPDATE ON visits
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Simple chat model
CREATE TABLE IF NOT EXISTS chat_threads (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id uuid NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  sender_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages (thread_id);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id);

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  author_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_property ON reviews (property_id);

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  uploaded_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  filename text NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_property ON documents (property_id);

-- Phase 3: Leads/CRM core

CREATE TABLE IF NOT EXISTS property_inquiries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'new',
  message text NULL,
  offer_price numeric(14,2) NULL,
  offer_message text NULL,
  offer_updated_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE property_inquiries DROP CONSTRAINT IF EXISTS property_inquiries_status_check;
ALTER TABLE property_inquiries ADD CONSTRAINT property_inquiries_status_check
  CHECK (status IN ('new','contacted','visit_scheduled','negotiation','closed','dropped'));

CREATE UNIQUE INDEX IF NOT EXISTS uniq_property_inquiries_property_buyer
  ON property_inquiries (property_id, buyer_id);

CREATE INDEX IF NOT EXISTS idx_property_inquiries_property ON property_inquiries (property_id);
CREATE INDEX IF NOT EXISTS idx_property_inquiries_buyer ON property_inquiries (buyer_id);
CREATE INDEX IF NOT EXISTS idx_property_inquiries_agent ON property_inquiries (agent_id);
CREATE INDEX IF NOT EXISTS idx_property_inquiries_status ON property_inquiries (status);
CREATE INDEX IF NOT EXISTS idx_property_inquiries_created_at ON property_inquiries (created_at);

DROP TRIGGER IF EXISTS trg_property_inquiries_updated_at ON property_inquiries;
CREATE TRIGGER trg_property_inquiries_updated_at
BEFORE UPDATE ON property_inquiries
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS inquiry_notes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  inquiry_id uuid NOT NULL REFERENCES property_inquiries(id) ON DELETE CASCADE,
  agent_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inquiry_notes_inquiry ON inquiry_notes (inquiry_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_notes_agent ON inquiry_notes (agent_id);

CREATE TABLE IF NOT EXISTS favorites (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_favorites_buyer_property
  ON favorites (buyer_id, property_id);

CREATE INDEX IF NOT EXISTS idx_favorites_buyer ON favorites (buyer_id);
CREATE INDEX IF NOT EXISTS idx_favorites_property ON favorites (property_id);
