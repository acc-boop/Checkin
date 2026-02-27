-- ============================================================
-- Accountable — Supabase Setup
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Create the key-value store table
CREATE TABLE IF NOT EXISTS kv_store (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable Row Level Security
ALTER TABLE kv_store ENABLE ROW LEVEL SECURITY;

-- 3. Allow all operations for anonymous users (using anon key)
--    This matches the app's current auth model (app-level auth, not Supabase auth)
CREATE POLICY "Allow all access" ON kv_store
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. Create an index for prefix-based listing
CREATE INDEX IF NOT EXISTS idx_kv_store_key ON kv_store (key);

-- 5. Auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kv_store_updated_at
  BEFORE UPDATE ON kv_store
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
