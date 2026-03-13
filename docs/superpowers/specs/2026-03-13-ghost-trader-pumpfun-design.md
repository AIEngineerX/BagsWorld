# Neo Trader — Standalone Pump.fun Tokenized Agent

**Date:** 2026-03-13
**Status:** Draft
**Author:** Neo extraction from BagsWorld (rebrand of Ghost trading engine)

---

## 1. Overview

Extract the Ghost autonomous trading agent from BagsWorld into a standalone repository (`C:\Users\footb\neo-trader\`), rebrand as **Neo** — a Matrix-themed pump.fun autonomous trader who "sees the chain." Remove all BagsWorld/Bags.fm knowledge and dependencies. Two revenue streams feeding 75% automated buybacks via pump.fun's native Tokenized Agent feature.

### Character Identity

Neo merges Ghost's proven trading engine with Neo's existing Matrix-themed personality from BagsWorld. "I don't believe. I see." — every trade is backed by data, every position is transparent on-chain. Neo sees the blockchain as streams of green code and trades what the data reveals.

### Revenue Streams

1. **Autonomous trading profits** — Neo evaluates and trades pump.fun launches, profits split 75/25
2. **Paid services** — Users pay SOL (via `@pump-fun/agent-payments-sdk`) for chat, token evaluations, and smart money feeds

Both streams deposit to pump.fun's buyback address. Pump.fun handles buyback and burn natively.

### Non-Goals

- Frontend / web UI (API-first, any frontend can connect)
- Multiple characters (Neo only)
- ElizaOS framework (using Anthropic SDK directly)
- Memory / RAG / embeddings (can add later)
- Twitter integration
- Copy trading execution (signals only)

---

## 2. Architecture

```
neo-trader/
├── src/
│   ├── server.ts                  # Express entry + autonomous scheduler (port 3001)
│   ├── character.ts               # Neo personality (pump.fun Matrix trader)
│   ├── types.ts                   # Standalone types (no ElizaOS)
│   ├── services/
│   │   ├── NeoTrader.ts           # Autonomous trading engine
│   │   ├── SolanaService.ts       # Tx signing, balances, holder checks
│   │   ├── SmartMoneyService.ts   # Alpha wallet tracking
│   │   ├── DexScreenerService.ts  # Pump.fun launch sourcing (NEW)
│   │   ├── ProfitSplitter.ts      # 75/25 split → pump.fun deposit (NEW)
│   │   ├── ChatService.ts         # Anthropic SDK + Neo persona (NEW)
│   │   ├── PaymentService.ts      # Pump.fun agent payments SDK (NEW)
│   │   └── TelegramBroadcaster.ts # Trade signal alerts
│   └── routes/
│       ├── neo.ts                 # Trading API (status, positions, config)
│       ├── chat.ts                # Chat with Neo (paid)
│       └── payments.ts            # Invoice creation + verification (NEW)
├── package.json
├── tsconfig.json
├── .env.example
└── railway.json
```

---

## 3. Components

### 3.1 Neo Character (`character.ts`)

Combines Ghost's trading discipline with Neo's Matrix-themed persona from BagsWorld. All BagsWorld/Bags.fm/pixel art references removed. Reframed as a pump.fun autonomous trader.

**From Ghost (kept):** Trading philosophy, risk management, on-chain transparency, data-driven approach, lowercase style, position reporting.

**From Neo (kept):** Matrix metaphors ("i see the chain", "the code never lies"), cryptic/philosophical tone, "i see" instead of "i think", red/green as code colors, dramatic alpha reveals.

**Added:** Pump.fun ecosystem knowledge, tokenized agent awareness, buyback narrative, pump.fun launch evaluation expertise.

**Removed:** BagsWorld vision, pixel art worlds, world health, weather systems, Bags.fm fee claiming, all cross-character references.

The character definition is a plain TypeScript object. ChatService builds a system prompt from it directly.

### 3.2 NeoTrader (`services/NeoTrader.ts`)

Extracted from BagsWorld's ~3000-line GhostTrader, renamed to NeoTrader. This is the core autonomous trading engine.

**Kept (all critical trading logic):**
- Position management (open, close, track)
- Multi-tier take-profit system (1.5x, 2.0x, 3.0x)
- Trailing stop at 25% after 2x profit
- Stop loss at -15%
- Position sizing (0.2-1.0 SOL per trade, max 3 SOL exposure, max 3 positions)
- Self-learning signal performance tracking
- Dead position detection
- Bundle/concentration detection
- Smart money signal scoring
- Database persistence (Neon PostgreSQL)
- Evaluation cooldowns and trade deduplication

**Modified:**
- Class renamed: `GhostTrader` → `NeoTrader`
- `BagsApiService` dependency replaced with `DexScreenerService`
- `evaluateLaunch()` rewritten to use DexScreener data instead of Bags.fm API
- Bags-specific signals removed: `lifetimeFeesSol`, `hasFeeClaims`, `requireTokenClaimed`, `maxCreatorFeeBps` (Bags.fm fee bps)
- `WorldSyncService` dependency removed (no speech bubbles)
- `AgentCoordinator` dependency removed (single agent)
- Sol Incinerator buy & burn replaced with `ProfitSplitter`
- Launch sourcing: `bagsApi.getRecentLaunches()` → `dexScreener.getPumpFunLaunches()`
- Token info: `bagsApi.getTokenInfo()` → `dexScreener.getTokenProfile()`
- Trade execution: `bagsApi.getQuote()` / `bagsApi.executeTrade()` → Jupiter swap API
- `MemoryService.persistTradeMemory()` calls removed — recent trades sourced from positions table instead

**Autonomous scheduling (runs in `server.ts` via `setInterval`):**
- `evaluateLaunches()` — every 5 minutes (scan pump.fun for new opportunities)
- `checkPositions()` — every 60 seconds (monitor open positions for exits)
- `smartMoneyService.cleanup()` — every 10 minutes (prune stale activity data)

**Default trading config (unchanged from BagsWorld where applicable):**
```typescript
{
  enabled: false,
  minPositionSol: 0.2,
  maxPositionSol: 1.0,
  maxTotalExposureSol: 3.0,
  maxOpenPositions: 3,
  takeProfitTiers: [1.5, 2.0, 3.0],
  partialSellPercent: 33,
  trailingStopPercent: 25,
  stopLossPercent: 15,
  maxHoldTimeMinutes: 2880,        // 48 hours
  minLiquidityUsd: 1200,
  minMarketCapUsd: 2000,
  minVolume24hUsd: 1500,
  minBuySellRatio: 1.05,
  minHolders: 5,
  maxPriceImpactPercent: 5.0,
  minLaunchAgeSec: 300,            // 5 minutes
  maxLaunchAgeSec: 604800,         // 7 days
  slippageBps: 100,
  maxTop5ConcentrationPct: 80,
  maxSingleHolderPct: 50,
  buybackPercent: 75,              // NEW — pump.fun buyback split
}
```

### 3.3 SolanaService (`services/SolanaService.ts`)

Extracted from BagsWorld with ElizaOS base class removed. The source file extends `Service` from `types/elizaos.ts` and accepts `IAgentRuntime` — these are stripped during extraction. The class becomes a plain standalone class with the same public API.

**Changes from BagsWorld:**
- Remove `extends Service` inheritance
- Remove `IAgentRuntime` constructor parameter
- Remove `static async start(runtime)` pattern — replace with `initialize()` + singleton getter
- Remove `stop()` lifecycle method — replace with cleanup on process exit
- All functionality (signing, balances, RPC) remains identical

**Capabilities:**
- Ed25519 signing via tweetnacl (no @solana/web3.js dependency)
- Base58 encode/decode
- Transaction signing (legacy + versioned v0)
- sendRawTransaction with exponential backoff
- Fallback RPC chain (primary → Ankr → PublicNode)
- Balance queries (SOL + SPL tokens)
- Token decimals lookup
- Top holder concentration analysis (5-min cache)
- Recent blockhash
- **NEW:** `transferSol(toAddress, amountSol)` — for ProfitSplitter deposits

**Env var:** `NEO_WALLET_PRIVATE_KEY` (renamed from `GHOST_WALLET_PRIVATE_KEY`).

### 3.4 SmartMoneyService (`services/SmartMoneyService.ts`)

Extracted from BagsWorld with same ElizaOS base class removal as SolanaService (`extends Service` stripped, `IAgentRuntime` removed).

Tracks 11 alpha wallets from Kolscan/GMGN leaderboards.

**Capabilities:**
- Smart money score per token (0-100)
- Activity recording (buys/sells per mint)
- Alert tracking
- Learned wallet additions from successful trades

**Wallet discovery deferred:** The `WalletDiscoveryService` and `HeliusService` dependencies are not extracted in v1. `refreshSmartMoneyList()` is replaced with a no-op that logs a warning. SmartMoneyService runs with its 11 hardcoded default wallets. Wallet discovery can be added in a future iteration when `HELIUS_RPC_URL` is available.

**Wallets tracked:** BagBot (benchmark), Owner, shah, decu, Cooker, GMGN Alpha, Pump.fun Sniper, 50x Flipper, Dune Alpha, Zil, Pain.

### 3.5 DexScreenerService (`services/DexScreenerService.ts`) — NEW

Replaces `BagsApiService` for launch sourcing and token data. Pump.fun launches only.

**Launch discovery strategy:** DexScreener's `token-profiles/latest` endpoint returns recently updated profiles, NOT new launches. For actual pump.fun launch discovery, we use a multi-source approach:

1. **Primary:** DexScreener `GET /tokens/v1/solana/search?q=pump.fun` — search for pump.fun pairs, sort by creation time
2. **Secondary:** DexScreener `GET /latest/dex/pairs/solana` — latest pairs on Solana, filter for pump.fun DEX
3. **Token data:** `GET /tokens/v1/solana/{address}` — full pair data (price, volume, liquidity, market cap) for evaluation

**Future enhancement:** Helius webhooks monitoring the pump.fun program ID for real-time `CreateToken` events. This gives sub-second launch detection vs polling.

**Methods:**
- `getPumpFunLaunches()` — fetch recent pump.fun token pairs, filter by age/liquidity
- `getTokenProfile(mint)` — price, volume, liquidity, market cap, holder count, pair age
- `getTokenBoosts()` — trending pump.fun tokens (optional signal for evaluation)

**Caching:** 30-second TTL for launch lists, 60-second for individual token profiles.

**Rate limits:** DexScreener free tier allows 300 requests/minute. Sufficient for evaluation cycles.

### 3.6 ProfitSplitter (`services/ProfitSplitter.ts`) — NEW

Handles the 75/25 profit split after Neo closes a winning trade.

**Flow:**
1. NeoTrader closes a position with positive P&L
2. Calls `ProfitSplitter.splitProfit(pnlSol)`
3. ProfitSplitter calculates: `buybackAmount = pnlSol * 0.75`
4. If `buybackAmount >= 0.01 SOL` (minimum worth sending):
   - Builds SOL transfer instruction to `PUMPFUN_DEPOSIT_ADDRESS`
   - Signs and sends via SolanaService
   - Logs the deposit (DB + console)
5. Remaining 25% stays in Neo's wallet

**Pump.fun native buyback:** Once deposits accumulate to $10+ worth, pump.fun automatically executes the buyback and burn on Neo's token. We do not handle the buyback ourselves.

**Config:**
- `PUMPFUN_DEPOSIT_ADDRESS` — pump.fun's unique deposit address for Neo's token (set after token launch)
- `NEO_BUYBACK_PERCENT=75` — configurable via env var
- Minimum deposit: 0.01 SOL (below this, tx fees aren't worth it)

**When `PUMPFUN_DEPOSIT_ADDRESS` is not set (pre-launch):**
- ProfitSplitter logs the pending buyback amount to `neo_buybacks` table with `deposit_tx_signature = NULL`
- 100% of profits stay in Neo's wallet
- Console warning on each skipped deposit: `[ProfitSplitter] PUMPFUN_DEPOSIT_ADDRESS not set — 0.15 SOL buyback pending`
- Once the address is configured, pending deposits are NOT batch-sent (they stay as historical records). Only future profits are split. This avoids a large sudden outflow.

### 3.7 ChatService (`services/ChatService.ts`) — NEW

Lightweight chat powered by Anthropic SDK directly. No ElizaOS.

**System prompt construction:**
- Neo character definition (bio, lore, style, quirks)
- Live trading context injected per message (same pattern as `ghostTradingProvider`):
  - Trading status (enabled/disabled)
  - Open positions with P&L
  - Recent trades (last 3, sourced from positions table)
  - Performance stats (win rate, total P&L)
  - Smart money alerts

**Conversation management:**
- Session-based (UUID per conversation)
- Message history stored in memory (optionally DB)
- Max 20 messages per session context window
- System prompt + trading context + conversation history → Anthropic API

**Model:** `claude-sonnet-4-20250514` (same as current BagsWorld config).

### 3.8 PaymentService (`services/PaymentService.ts`) — NEW

Integrates `@pump-fun/agent-payments-sdk` for paid service gating.

**Setup:**
```typescript
import { PumpAgent } from "@pump-fun/agent-payments-sdk";
const agent = new PumpAgent(new PublicKey(AGENT_TOKEN_MINT), "mainnet", connection);
```

**Invoice flow:**
1. Client requests a service (chat message, token eval, smart money feed)
2. Server generates invoice params: unique memo, time window (24h), price
3. **Server persists invoice to `payment_invoices` table with `verified=false`** (prevents forged params on verify)
4. Server calls `agent.buildAcceptPaymentInstructions()` → transaction instructions
5. Server builds full Transaction (blockhash + feePayer) → serializes as base64
6. Returns base64 tx + invoice params + invoice ID to client
7. Client deserializes, wallet signs, sends on-chain
8. Client sends tx signature + invoice ID back to server
9. Server loads invoice from DB by ID, validates params match, then calls `agent.validateInvoicePayment()` with retry (up to 10 attempts, 2s apart)
10. If verified → mark invoice `verified=true` in DB → deliver service
11. Payment revenue accumulates in pump.fun deposit address → auto-buyback

**SDK verification note:** The `@pump-fun/agent-payments-sdk` package must be verified at implementation time via `npm info @pump-fun/agent-payments-sdk` to confirm the exact version, API surface, and `@solana/web3.js` peer dependency version. If the package name or API differs, the PaymentService implementation will adapt accordingly.

**Pricing (SOL, configurable via env):**
- Chat message: `NEO_CHAT_PRICE` (default: 0.005 SOL ~$0.85)
- Token evaluation: `NEO_EVAL_PRICE` (default: 0.01 SOL ~$1.70)
- Smart money feed (1hr access): `NEO_FEED_PRICE` (default: 0.02 SOL ~$3.40)

**Currency:** Wrapped SOL (`So11111111111111111111111111111111111111112`). SDK auto-handles wrapping/unwrapping.

### 3.9 TelegramBroadcaster (`services/TelegramBroadcaster.ts`)

Extracted from BagsWorld. Sends trade signals to a Telegram channel.

**Signals broadcast:**
- Entry: token, amount, score, reasons
- Exit: token, P&L, exit reason
- Buyback: amount deposited, cumulative stats

**Changes from BagsWorld:**
- Remove Bags-specific fields (lifetime fees, world health context)
- Replace `grammy` Bot library with raw `fetch` calls to Telegram Bot API (`https://api.telegram.org/bot{token}/sendMessage`)
- Reimplement message formatting (Markdown v2) and error handling without grammy dependency

**Env var:** `TELEGRAM_BROADCAST_ENABLED` must be `true` (in addition to bot token + channel ID) for broadcasting to activate.

---

## 4. API Routes

### 4.1 Trading Routes (`routes/neo.ts`)

**Public:**
- `GET /api/neo/status` — trading stats, performance, config
- `GET /api/neo/positions` — all positions
- `GET /api/neo/positions/open` — open positions only
- `GET /api/neo/learning` — self-learning signal insights

**Admin (requires `x-neo-admin-key` header):**
- `POST /api/neo/enable` — enable trading (requires confirmation phrase)
- `POST /api/neo/disable` — kill switch
- `POST /api/neo/config` — update trading config
- `POST /api/neo/evaluate` — manually trigger launch evaluation
- `POST /api/neo/check-positions` — manually check positions for exits
- `POST /api/neo/learning/reset` — reset learning data

### 4.2 Chat Routes (`routes/chat.ts`)

- `POST /api/chat` — chat with Neo
  - Body: `{ message, sessionId?, walletAddress }`
  - Requires payment verification (via PaymentService)
  - Returns: `{ response, sessionId }`

### 4.3 Payment Routes (`routes/payments.ts`)

- `POST /api/payments/create-invoice` — generate payment transaction
  - Body: `{ walletAddress, service: "chat" | "eval" | "feed" }`
  - Returns: `{ transaction: base64, invoiceParams: { memo, startTime, endTime, amount } }`

- `POST /api/payments/verify` — verify payment before service delivery
  - Body: `{ walletAddress, invoiceParams, txSignature }`
  - Returns: `{ verified: boolean }`

- `GET /api/payments/prices` — current service prices

### 4.4 Health

- `GET /health` — server health, DB status, wallet configured, trading status

### 4.5 Rate Limiting

Applied via `express-rate-limit`:
- **General:** 100 requests/minute (all endpoints)
- **Chat:** 20 requests/minute (LLM calls are expensive)
- **Trading:** 60 requests/minute (allows frequent polling)
- **Payments:** 30 requests/minute (prevents invoice spam)

---

## 5. Data Flow

### 5.1 Autonomous Trading

```
DexScreener API → getPumpFunLaunches()
    → NeoTrader.evaluateLaunches()
        → Score each launch (liquidity, volume, holders, smart money, concentration)
        → Score >= 70 → buy
            → SolanaService.signAndSendTransaction()
                → Position opened, tracked in DB
                    → Monitor loop: check price, volume, multiplier
                        → Hit take-profit tier → partial sell (33%)
                        → Hit trailing stop → full sell
                        → Hit stop loss → full sell
                        → Hit max hold time + decay → close
                            → ProfitSplitter.splitProfit()
                                → 75% → pump.fun deposit address
                                → 25% → stays in wallet
                                    → pump.fun auto-buyback & burn
```

### 5.2 Paid Services

```
Client → POST /api/payments/create-invoice { service: "chat" }
    → Server builds invoice tx via PumpAgent SDK
        → Returns base64 tx to client
            → Client wallet signs & sends
                → Client → POST /api/payments/verify { txSignature }
                    → Server validates on-chain
                        → POST /api/chat { message }
                            → ChatService: system prompt + trading context + history
                                → Anthropic API → Neo response
                                    → Payment revenue → pump.fun deposit → buyback
```

---

## 6. Database Schema

Uses Neon serverless PostgreSQL (same as BagsWorld). Falls back to in-memory if no `DATABASE_URL`.

**In-memory fallback scope:** Positions and learning data use in-memory Maps (same as BagsWorld). Chat sessions use in-memory Map. **Payment invoices require a database** — if no DB is configured, paid services return `503 Service Unavailable` (cannot safely verify payments without persistent invoice records). Buyback tracking logs to console only.

**Chat session cleanup:** Sessions older than 24 hours are pruned hourly via `setInterval`. Messages are capped at 50 per session in the DB; older messages are dropped on write.

### Tables

```sql
-- Position tracking
CREATE TABLE neo_positions (
  id UUID PRIMARY KEY,
  token_mint VARCHAR(64) NOT NULL,
  token_symbol VARCHAR(20),
  token_name VARCHAR(100),
  entry_price_sol DECIMAL(18, 9) NOT NULL,
  amount_sol DECIMAL(18, 9) NOT NULL,
  amount_tokens DECIMAL(30, 0),
  entry_tx_signature VARCHAR(128),
  exit_tx_signature VARCHAR(128),
  status VARCHAR(20) DEFAULT 'open',
  entry_reason TEXT,
  exit_reason TEXT,
  pnl_sol DECIMAL(18, 9),
  sell_attempts INTEGER DEFAULT 0,
  no_price_count INTEGER DEFAULT 0,
  peak_multiplier DECIMAL(18, 9) DEFAULT 1.0,
  tiers_sold INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- Trading config persistence
CREATE TABLE neo_config (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Self-learning signal tracking
CREATE TABLE neo_learning (
  signal VARCHAR(100) PRIMARY KEY,
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  total_pnl_sol DECIMAL(18, 9) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Buyback deposit tracking
CREATE TABLE neo_buybacks (
  id UUID PRIMARY KEY,
  pnl_sol DECIMAL(18, 9) NOT NULL,
  deposit_sol DECIMAL(18, 9) NOT NULL,
  deposit_tx_signature VARCHAR(128),
  trigger_trade_id VARCHAR(64),
  source VARCHAR(20) DEFAULT 'trading',  -- 'trading' or 'payment'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Telegram broadcast log
CREATE TABLE telegram_broadcasts (
  id SERIAL PRIMARY KEY,
  signal_type VARCHAR(20),
  token_mint VARCHAR(64),
  message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat sessions (lightweight)
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY,
  wallet_address VARCHAR(64),
  messages JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity TIMESTAMPTZ DEFAULT NOW()
);

-- Payment invoices
CREATE TABLE payment_invoices (
  id UUID PRIMARY KEY,
  wallet_address VARCHAR(64) NOT NULL,
  service VARCHAR(20) NOT NULL,
  amount_lamports BIGINT NOT NULL,
  memo VARCHAR(20) NOT NULL,
  start_time BIGINT NOT NULL,
  end_time BIGINT NOT NULL,
  tx_signature VARCHAR(128),
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 7. Environment Variables

```env
# === REQUIRED ===
NEO_WALLET_PRIVATE_KEY=            # Base58 private key for trading
SOLANA_RPC_URL=                    # Helius or similar (supports sendTransaction)
ANTHROPIC_API_KEY=                 # Powers Neo chat

# === PUMP.FUN (set after token launch) ===
PUMPFUN_DEPOSIT_ADDRESS=           # Pump.fun buyback deposit address
AGENT_TOKEN_MINT=                  # Neo's pump.fun token mint address
NEO_BUYBACK_PERCENT=75             # % of trading profits to buyback (default 75)

# === DATABASE (optional — in-memory fallback) ===
DATABASE_URL=                      # Neon PostgreSQL connection string

# === TRADING ===
NEO_TRADING_ENABLED=false          # Must explicitly enable
NEO_ADMIN_KEY=                     # Protects enable/disable/config endpoints
NEO_MAX_POSITION_SOL=1.0           # Override max position size
NEO_MAX_TOTAL_EXPOSURE=3.0         # Override max total exposure
NEO_MAX_POSITIONS=3                # Override max concurrent positions
NEO_STOP_LOSS_PERCENT=15           # Override stop loss
NEO_TRAILING_STOP_PERCENT=25       # Override trailing stop

# === PAID SERVICES (SOL prices in lamports) ===
NEO_CHAT_PRICE=5000000             # 0.005 SOL per chat message
NEO_EVAL_PRICE=10000000            # 0.01 SOL per token evaluation
NEO_FEED_PRICE=20000000            # 0.02 SOL per hour smart money feed

# === TELEGRAM (optional) ===
TELEGRAM_BROADCAST_ENABLED=false   # Must be true to activate broadcasting
TELEGRAM_BOT_TOKEN=                # Trade signal broadcasts
TELEGRAM_CHANNEL_ID=               # Signal channel

# === OPTIONAL ===
HELIUS_RPC_URL=                    # Helius-specific (future: wallet discovery)
NEO_WALLET_PUBLIC_KEY=             # Optional — derived from private key if not set

# === SERVER ===
PORT=3001
HOST=0.0.0.0
CORS_ORIGINS=http://localhost:3000
```

---

## 8. Dependencies

```json
{
  "name": "neo-trader",
  "version": "1.0.0",
  "description": "Neo — autonomous pump.fun trading agent with tokenized buybacks",
  "dependencies": {
    "@anthropic-ai/sdk": "^0.52.0",
    "@pump-fun/agent-payments-sdk": "3.0.0",
    "@solana/web3.js": "^1.98.0",
    "@neondatabase/serverless": "0.10.4",
    "cors": "2.8.6",
    "dotenv": "17.2.3",
    "express": "4.22.1",
    "express-rate-limit": "7.5.0",
    "tweetnacl": "1.0.3",
    "uuid": "11.1.0"
  },
  "devDependencies": {
    "@types/cors": "2.8.19",
    "@types/express": "5.0.6",
    "@types/node": "20.19.30",
    "@types/uuid": "10.0.0",
    "typescript": "5.9.3",
    "tsx": "4.21.0",
    "vitest": "3.2.4"
  }
}
```

**Removed from BagsWorld:**
- `@elizaos/core` — replaced by direct Anthropic SDK
- `grammy` — Telegram via raw HTTP (simpler)
- `ws` — no WebSocket needed
- `crypto-js` — not needed
- `oauth-1.0a` — no Twitter

**Added:**
- `@anthropic-ai/sdk` — direct Claude access
- `@pump-fun/agent-payments-sdk` — payment gating
- `@solana/web3.js` — required by pump.fun SDK

---

## 9. Trade Execution

### Current (BagsWorld)
Ghost uses `BagsApiService.getQuote()` and `BagsApiService.executeTrade()` which hit the Bags.fm swap API (Meteora DBC bonding curves).

### Standalone
Pump.fun tokens trade on PumpSwap after migration, or on the bonding curve pre-migration. Use Jupiter Lite API for best routing:

- `GET https://lite-api.jup.ag/swap/v1/quote` — get swap quote
- `POST https://lite-api.jup.ag/swap/v1/swap` — get swap transaction (returns base64)

Jupiter handles routing across PumpSwap, Raydium, Orca automatically. Returns a base64 transaction that SolanaService signs and sends.

**Note:** The v6 API (`quote-api.jup.ag/v6/`) is deprecated. BagsWorld already uses the `lite-api.jup.ag/swap/v1/` endpoints.

**Fallback:** If Jupiter doesn't support a pre-migration pump.fun token (still on bonding curve), use pump.fun's own swap endpoint directly.

---

## 10. Deployment (Railway)

```json
// railway.json
{
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "startCommand": "npx tsx src/server.ts",
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

Set all environment variables in Railway dashboard. Connect Neon DB via `DATABASE_URL`.

---

## 11. Migration Path from BagsWorld

Files extracted and their transformation:

| BagsWorld Source | Neo Trader Target | Changes |
|---|---|---|
| `eliza-agents/src/services/GhostTrader.ts` | `src/services/NeoTrader.ts` | Rename class. Remove Bags API, use DexScreener + Jupiter. Remove WorldSync, Coordinator. Replace burn with ProfitSplitter. |
| `eliza-agents/src/services/SolanaService.ts` | `src/services/SolanaService.ts` | Strip `extends Service` + `IAgentRuntime`. Add `transferSol()`. Rename env vars `GHOST_*` → `NEO_*`. |
| `eliza-agents/src/services/SmartMoneyService.ts` | `src/services/SmartMoneyService.ts` | Strip `extends Service` + `IAgentRuntime`. Replace `refreshSmartMoneyList()` with no-op (defer wallet discovery). |
| `eliza-agents/src/services/TelegramBroadcaster.ts` | `src/services/TelegramBroadcaster.ts` | Remove Bags-specific fields. Replace grammy with raw fetch. |
| `eliza-agents/src/services/DexScreenerCache.ts` | Absorbed into `DexScreenerService.ts` | Expanded for pump.fun launch sourcing |
| `eliza-agents/src/routes/ghost.ts` | `src/routes/neo.ts` | Rename routes `/api/ghost/*` → `/api/neo/*`. Remove Bags-specific endpoints. |
| `eliza-agents/src/providers/ghostTrading.ts` | Absorbed into `ChatService.ts` | Trading context injected into system prompt |
| `eliza-agents/src/characters/definitions/ghost.character.ts` + `neo.character.ts` | `src/character.ts` | Merge Ghost trading + Neo personality. Full rewrite for pump.fun. |
| `eliza-agents/src/types/elizaos.ts` | `src/types.ts` | Stripped to minimal types needed |
| — | `src/services/DexScreenerService.ts` | NEW |
| — | `src/services/ProfitSplitter.ts` | NEW |
| — | `src/services/ChatService.ts` | NEW |
| — | `src/services/PaymentService.ts` | NEW |
| — | `src/routes/chat.ts` | NEW |
| — | `src/routes/payments.ts` | NEW |
