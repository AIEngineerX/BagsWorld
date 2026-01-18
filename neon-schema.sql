-- BagsWorld Global Tokens Schema (Neon)
-- Run this in your Neon SQL console after enabling Neon on Netlify

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
  -- Format: [{"provider": "twitter", "username": "user", "bps": 500}, ...]
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

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_tokens_mint ON tokens(mint);
CREATE INDEX IF NOT EXISTS idx_tokens_creator ON tokens(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_tokens_featured ON tokens(is_featured);
CREATE INDEX IF NOT EXISTS idx_tokens_created ON tokens(created_at DESC);
