-- BagsWorld Global Tokens Schema
-- Run this in your Supabase SQL Editor to create the tokens table

-- Create the tokens table
CREATE TABLE IF NOT EXISTS tokens (
  id SERIAL PRIMARY KEY,
  mint TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  creator_wallet TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Fee shares stored as JSONB array
  fee_shares JSONB DEFAULT '[]',

  -- Live data (updated by world-state API)
  lifetime_fees DECIMAL DEFAULT 0,
  market_cap DECIMAL DEFAULT 0,
  volume_24h DECIMAL DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE,

  -- Metadata
  is_featured BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_tokens_mint ON tokens(mint);
CREATE INDEX IF NOT EXISTS idx_tokens_creator ON tokens(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_tokens_featured ON tokens(is_featured);
CREATE INDEX IF NOT EXISTS idx_tokens_created ON tokens(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read tokens (public visibility)
CREATE POLICY "Tokens are viewable by everyone" ON tokens
  FOR SELECT USING (true);

-- Policy: Anyone can insert tokens (for now - could restrict later)
CREATE POLICY "Anyone can insert tokens" ON tokens
  FOR INSERT WITH CHECK (true);

-- Policy: Only the creator can update their token (or admin)
CREATE POLICY "Users can update own tokens" ON tokens
  FOR UPDATE USING (true);  -- Simplified for now

-- ============================================
-- OPTIONAL: Insert some featured tokens
-- Uncomment and modify these to add starter tokens
-- ============================================

-- INSERT INTO tokens (mint, name, symbol, description, creator_wallet, is_featured) VALUES
-- ('ExampleMint123...', 'Example Token', 'EX', 'An example featured token', 'CreatorWallet...', true);

-- ============================================
-- GRANT PERMISSIONS
-- Make sure your anon key can read/write
-- ============================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant permissions on tokens table
GRANT SELECT, INSERT, UPDATE ON tokens TO anon;
GRANT SELECT, INSERT, UPDATE ON tokens TO authenticated;

-- Grant usage on sequence
GRANT USAGE, SELECT ON SEQUENCE tokens_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE tokens_id_seq TO authenticated;
