-- BagsWorld Global Tokens Schema (Neon)
-- The app auto-creates tables on first connection, but you can run this manually if needed

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
  is_verified BOOLEAN DEFAULT FALSE,

  -- Admin controls
  level_override INTEGER  -- Override building level (1-5), null = use market cap
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_tokens_mint ON tokens(mint);
CREATE INDEX IF NOT EXISTS idx_tokens_creator ON tokens(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_tokens_featured ON tokens(is_featured);
CREATE INDEX IF NOT EXISTS idx_tokens_created ON tokens(created_at DESC);

-- ============================================
-- Creator Rewards State Persistence
-- ============================================
-- Stores the rewards agent state so it persists across server restarts

CREATE TABLE IF NOT EXISTS rewards_state (
  id SERIAL PRIMARY KEY,
  cycle_start_time BIGINT NOT NULL,           -- Unix timestamp when current cycle started
  total_distributed DECIMAL DEFAULT 0,         -- Total SOL ever distributed
  distribution_count INTEGER DEFAULT 0,        -- Number of distributions completed
  last_distribution BIGINT DEFAULT 0,          -- Unix timestamp of last distribution
  recent_distributions JSONB DEFAULT '[]',     -- Recent distribution history (last 10)
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial row if empty
INSERT INTO rewards_state (cycle_start_time, total_distributed, distribution_count, last_distribution, recent_distributions)
SELECT extract(epoch from now()) * 1000, 0, 0, 0, '[]'
WHERE NOT EXISTS (SELECT 1 FROM rewards_state);
