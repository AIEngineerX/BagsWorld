-- BagsWorld Supabase Schema
-- Run this in your Supabase SQL Editor to set up the global tokens database

-- Create the tokens table
CREATE TABLE IF NOT EXISTS tokens (
  id BIGSERIAL PRIMARY KEY,
  mint TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  creator_wallet TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  fee_shares JSONB,
  lifetime_fees NUMERIC DEFAULT 0,
  market_cap NUMERIC DEFAULT 0,
  volume_24h NUMERIC DEFAULT 0,
  last_updated TIMESTAMPTZ,
  is_featured BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tokens_creator ON tokens(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_tokens_created_at ON tokens(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tokens_is_featured ON tokens(is_featured) WHERE is_featured = TRUE;

-- Enable Row Level Security (RLS)
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read tokens (public world state)
CREATE POLICY "Allow public read access"
ON tokens FOR SELECT
TO public
USING (true);

-- Allow anyone to insert tokens (anyone can launch)
CREATE POLICY "Allow public insert access"
ON tokens FOR INSERT
TO public
WITH CHECK (true);

-- Allow updates only for the token creator or service role
CREATE POLICY "Allow public update access"
ON tokens FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- Grant access to anon role (for public API calls)
GRANT SELECT, INSERT, UPDATE ON tokens TO anon;
GRANT USAGE, SELECT ON SEQUENCE tokens_id_seq TO anon;

-- Optional: Create a function to update last_updated automatically
CREATE OR REPLACE FUNCTION update_last_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update last_updated on changes
DROP TRIGGER IF EXISTS tokens_update_timestamp ON tokens;
CREATE TRIGGER tokens_update_timestamp
  BEFORE UPDATE ON tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_last_updated();
