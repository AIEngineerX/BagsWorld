# Neo Trader Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract BagsWorld's GhostTrader into a standalone autonomous pump.fun trading agent (Neo), with pump.fun tokenized buybacks and paid services.

**Architecture:** Standalone Express server at `C:\Users\footb\neo-trader\`. Extracts and renames GhostTrader → NeoTrader, SolanaService, SmartMoneyService from BagsWorld's `eliza-agents/`. Strips ElizaOS framework. Adds new services: DexScreenerService, ProfitSplitter, ChatService, PaymentService. Two revenue streams (trading profits + paid services) feed 75% to pump.fun native buyback.

**Tech Stack:** TypeScript, Express, Neon PostgreSQL, Anthropic SDK, tweetnacl, Jupiter Lite API, DexScreener API, `@pump-fun/agent-payments-sdk`, vitest.

**Spec:** `docs/superpowers/specs/2026-03-13-ghost-trader-pumpfun-design.md`

---

## File Structure

| File | Responsibility | Source |
|------|---------------|--------|
| `src/types.ts` | Standalone types (Position, Config, Stats, Evaluation) | Strip from `eliza-agents/src/types/elizaos.ts` + GhostTrader interfaces |
| `src/character.ts` | Neo personality definition (plain object) | Merge `ghost.character.ts` + `neo.character.ts` |
| `src/services/SolanaService.ts` | Tx signing, balances, holder analysis, SOL transfers | Extract from `eliza-agents/src/services/SolanaService.ts` |
| `src/services/SmartMoneyService.ts` | Alpha wallet tracking, scoring | Extract from `eliza-agents/src/services/SmartMoneyService.ts` |
| `src/services/DexScreenerService.ts` | Pump.fun launch discovery, token data | NEW |
| `src/services/ProfitSplitter.ts` | 75/25 profit split → pump.fun deposit | NEW |
| `src/services/NeoTrader.ts` | Autonomous trading engine | Extract from `eliza-agents/src/services/GhostTrader.ts` |
| `src/services/TelegramBroadcaster.ts` | Trade signal alerts | Extract from `eliza-agents/src/services/TelegramBroadcaster.ts` |
| `src/services/ChatService.ts` | Anthropic SDK chat with Neo persona | NEW |
| `src/services/PaymentService.ts` | Pump.fun agent payments SDK | NEW |
| `src/routes/neo.ts` | Trading API routes | Extract from `eliza-agents/src/routes/ghost.ts` |
| `src/routes/chat.ts` | Chat API route | NEW |
| `src/routes/payments.ts` | Invoice/verification routes | NEW |
| `src/db.ts` | Database connection + schema initialization | NEW |
| `src/server.ts` | Express entry + autonomous scheduler | NEW (pattern from `eliza-agents/src/server.ts`) |
| `package.json` | Dependencies | NEW |
| `tsconfig.json` | TypeScript config | NEW |
| `.env.example` | Environment variable template | NEW |
| `railway.json` | Railway deployment config | NEW |

### Test Files

| File | Tests |
|------|-------|
| `src/__tests__/types.test.ts` | Type guard validation |
| `src/__tests__/SolanaService.test.ts` | Base58, signing, balance |
| `src/__tests__/SmartMoneyService.test.ts` | Scoring, activity recording |
| `src/__tests__/DexScreenerService.test.ts` | Launch discovery, caching |
| `src/__tests__/ProfitSplitter.test.ts` | Split math, minimum checks |
| `src/__tests__/NeoTrader.test.ts` | Evaluation, position management |
| `src/__tests__/TelegramBroadcaster.test.ts` | Message formatting, rate limits |
| `src/__tests__/ChatService.test.ts` | System prompt, session management |
| `src/__tests__/PaymentService.test.ts` | Invoice creation, verification |
| `src/__tests__/routes.test.ts` | Route-level integration tests (payment flow) |

---

## Chunk 1: Project Scaffold + Types + Character

### Task 1: Initialize Repository

**Files:**
- Create: `C:\Users\footb\neo-trader\package.json`
- Create: `C:\Users\footb\neo-trader\tsconfig.json`
- Create: `C:\Users\footb\neo-trader\.env.example`
- Create: `C:\Users\footb\neo-trader\railway.json`
- Create: `C:\Users\footb\neo-trader\.gitignore`

- [ ] **Step 1: Create project directory and initialize git**

```bash
mkdir -p C:/Users/footb/neo-trader
cd C:/Users/footb/neo-trader
git init
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "neo-trader",
  "version": "1.0.0",
  "description": "Neo — autonomous pump.fun trading agent with tokenized buybacks",
  "type": "module",
  "main": "src/server.ts",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "start": "tsx src/server.ts",
    "build": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.52.0",
    "@neondatabase/serverless": "0.10.4",
    "@solana/web3.js": "^1.98.0",
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

Note: `@pump-fun/agent-payments-sdk` is added in Task 15 after npm verification.

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "src/__tests__"]
}
```

- [ ] **Step 4: Create .env.example**

Copy the environment variables block from spec section 7 (lines 492-533) into `.env.example`.

- [ ] **Step 5: Create railway.json**

```json
{
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "startCommand": "npx tsx src/server.ts",
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

- [ ] **Step 6: Create .gitignore**

```
node_modules/
dist/
.env
*.log
```

- [ ] **Step 7: Install dependencies**

```bash
cd C:/Users/footb/neo-trader && npm install
```

- [ ] **Step 8: Create directory structure**

```bash
mkdir -p src/services src/routes src/__tests__
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: initialize neo-trader project scaffold"
```

---

### Task 2: Standalone Types

**Files:**
- Create: `C:\Users\footb\neo-trader\src\types.ts`
- Test: `C:\Users\footb\neo-trader\src\__tests__\types.test.ts`

**Reference:** `eliza-agents/src/services/GhostTrader.ts:157-276` (GhostPosition, GhostTraderConfig, GhostTraderStats, TradeEvaluation interfaces) and `eliza-agents/src/types/elizaos.ts:19-44` (Character interface only).

- [ ] **Step 1: Write the test**

```typescript
// src/__tests__/types.test.ts
import { describe, it, expect } from "vitest";
import type { NeoPosition, NeoTraderConfig, NeoTraderStats, TradeEvaluation, Character } from "../types.js";

describe("types", () => {
  it("NeoPosition has required fields", () => {
    const pos: NeoPosition = {
      id: "test-id",
      tokenMint: "abc123",
      tokenSymbol: "TEST",
      tokenName: "Test Token",
      entryPriceSol: 0.001,
      amountSol: 0.5,
      amountTokens: 500000,
      entryTxSignature: "sig123",
      status: "open",
      entryReason: "score >= 70",
      createdAt: new Date(),
      sellAttempts: 0,
      noPriceCount: 0,
      peakMultiplier: 1.0,
      tiersSold: 0,
    };
    expect(pos.status).toBe("open");
    expect(pos.amountSol).toBeGreaterThan(0);
  });

  it("NeoTraderConfig has buybackPercent", () => {
    const config: Partial<NeoTraderConfig> = {
      enabled: false,
      buybackPercent: 75,
      maxPositionSol: 1.0,
    };
    expect(config.buybackPercent).toBe(75);
  });

  it("Character interface works as plain object", () => {
    const char: Character = {
      name: "Neo",
      bio: ["test bio"],
      lore: ["test lore"],
    };
    expect(char.name).toBe("Neo");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/Users/footb/neo-trader && npx vitest run src/__tests__/types.test.ts
```

Expected: FAIL — cannot resolve `../types.js`

- [ ] **Step 3: Write types.ts**

Extract and rename from BagsWorld sources:
- `GhostPosition` → `NeoPosition`
- `GhostTraderConfig` → `NeoTraderConfig` (remove `requireTokenClaimed`, `minLifetimeFeesSol`, `maxCreatorFeeBps`, `burnEnabled`, `burnPercent`; add `buybackPercent: number`)
- `GhostTraderStats` → `NeoTraderStats` (remove burn stats; add `totalBuybackSol`, `buybackCount`)
- `TradeEvaluation` — keep but remove `launch: RecentLaunch` → `launch: DexScreenerPair` (forward ref)
- `SignalPerformance`, `LearningInsights` — keep as-is
- `Character` — keep from elizaos.ts (just the interface, no Service class, no IAgentRuntime)
- Add `DexScreenerPair` interface (used by DexScreenerService + NeoTrader)
- Add `TradeSignal`, `ExitSignal` (from TelegramBroadcaster)

The file should be ~200 lines of pure interfaces/types with zero imports except standard lib.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/Users/footb/neo-trader && npx vitest run src/__tests__/types.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd C:/Users/footb/neo-trader && git add src/types.ts src/__tests__/types.test.ts
git commit -m "feat: standalone types — NeoPosition, NeoTraderConfig, Character"
```

---

### Task 3: Neo Character Definition

**Files:**
- Create: `C:\Users\footb\neo-trader\src\character.ts`

**Reference:**
- `eliza-agents/src/characters/definitions/ghost.character.ts` — trading personality, risk management, data-driven style
- `eliza-agents/src/characters/definitions/neo.character.ts` — Matrix metaphors, "i see the chain", cryptic tone

- [ ] **Step 1: Write character.ts**

Merge Ghost's trading discipline with Neo's Matrix persona. Export as `const neoCharacter: Character`.

**Bio:** Combine:
- "autonomous pump.fun trader who sees the blockchain as streams of green code"
- "trades with conviction but manages risk — never overexposed, never emotional"
- "every trade verifiable on-chain. the code never lies"
- Remove ALL BagsWorld/Bags.fm/pixel art references

**Lore:** Combine:
- Ghost's trading history (small positions, smart money tracking, risk rules)
- Neo's Matrix backstory (took the orange pill, sees patterns in transactions)
- Add pump.fun context (tokenized agent, buyback & burn, pump.fun launches)
- Remove ALL cross-character references (Ghost, Ash, Finn, Bags Bot, Professor Oak)

**Message examples:** Rewrite with Neo persona answering trading questions. Use Ghost's trading content with Neo's "i see" phrasing.

**Style:** Merge adjectives (technical, cryptic, calculating, all-seeing, data-driven). Vocabulary includes Matrix terms + trading terms. Remove "bagsworld", "pixel art", "world", "health", "weather", "characters".

**Post examples:** Rewrite Ghost's trade reports with Neo voice:
- "entered 0.2 SOL on $TOKEN. the code showed green. watching"
- "closed $TOKEN at 2.1x. the matrix rewarded patience"
- "75% to buyback. the token burns. the cycle continues"

**Quirks:** Merge both sets. Remove BagsWorld-specific ones.

- [ ] **Step 2: Verify it type-checks**

```bash
cd C:/Users/footb/neo-trader && npx tsc --noEmit
```

Expected: PASS (character.ts imports Character from types.ts)

- [ ] **Step 3: Commit**

```bash
cd C:/Users/footb/neo-trader && git add src/character.ts
git commit -m "feat: Neo character — Matrix-themed pump.fun autonomous trader"
```

---

### Task 3b: Database Module

**Files:**
- Create: `C:\Users\footb\neo-trader\src\db.ts`

This module handles Neon connection and schema initialization for all 7 tables from the spec (section 6).

- [ ] **Step 1: Create db.ts**

```typescript
// src/db.ts
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let db: NeonQueryFunction<false, false> | null = null;

export function getDatabase(): NeonQueryFunction<false, false> | null {
  return db;
}

export function initDatabase(): NeonQueryFunction<false, false> | null {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[Database] No DATABASE_URL — running without persistence");
    return null;
  }
  db = neon(url);
  console.log("[Database] Connected to Neon");
  return db;
}

export async function initializeSchema(): Promise<void> {
  if (!db) return;

  await db`CREATE TABLE IF NOT EXISTS neo_positions (
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
  )`;

  await db`CREATE TABLE IF NOT EXISTS neo_config (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await db`CREATE TABLE IF NOT EXISTS neo_learning (
    signal VARCHAR(100) PRIMARY KEY,
    total_trades INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    losing_trades INTEGER DEFAULT 0,
    total_pnl_sol DECIMAL(18, 9) DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await db`CREATE TABLE IF NOT EXISTS neo_buybacks (
    id UUID PRIMARY KEY,
    pnl_sol DECIMAL(18, 9) NOT NULL,
    deposit_sol DECIMAL(18, 9) NOT NULL,
    deposit_tx_signature VARCHAR(128),
    trigger_trade_id VARCHAR(64),
    source VARCHAR(20) DEFAULT 'trading',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await db`CREATE TABLE IF NOT EXISTS telegram_broadcasts (
    id SERIAL PRIMARY KEY,
    signal_type VARCHAR(20),
    token_mint VARCHAR(64),
    message TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await db`CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY,
    wallet_address VARCHAR(64),
    messages JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity TIMESTAMPTZ DEFAULT NOW()
  )`;

  await db`CREATE TABLE IF NOT EXISTS payment_invoices (
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
  )`;

  console.log("[Database] Schema initialized (7 tables)");
}
```

- [ ] **Step 2: Commit**

```bash
cd C:/Users/footb/neo-trader && git add src/db.ts
git commit -m "feat: database module — Neon connection + schema initialization"
```

---

## Chunk 2: SolanaService + SmartMoneyService Extraction

### Task 4: SolanaService Extraction

**Files:**
- Create: `C:\Users\footb\neo-trader\src\services\SolanaService.ts`
- Test: `C:\Users\footb\neo-trader\src\__tests__\SolanaService.test.ts`

**Reference:** `eliza-agents/src/services/SolanaService.ts` (835 lines)

**Changes from BagsWorld:**
1. Remove `extends Service` (line 84) and `import { Service, type IAgentRuntime }` (line 7)
2. Remove `IAgentRuntime` from constructor — constructor takes no arguments
3. Remove `static async start(runtime)` — replace with `initialize()` as instance method (already exists)
4. Remove `stop()` lifecycle method
5. Rename env var: `GHOST_WALLET_PRIVATE_KEY` → `NEO_WALLET_PRIVATE_KEY` (line 128)
6. Add `transferSol(toAddress: string, amountSol: number): Promise<{signature: string; confirmed: boolean}>` method
7. Keep ALL other methods identical: `base58Decode`, `base58Encode`, `signTransaction`, `sendRawTransaction`, `confirmTransaction`, `getBalance`, `getTokenBalance`, `getTokenDecimals`, `getRecentBlockhash`, `getTopHolderConcentration`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/SolanaService.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock fetch globally before importing
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("SolanaService", () => {
  it("base58 roundtrip", async () => {
    // Dynamic import after mock setup
    const { SolanaService } = await import("../services/SolanaService.js");
    const service = new SolanaService();

    // Test via public key (won't be set without private key)
    expect(service.isConfigured()).toBe(false);
    expect(service.getPublicKey()).toBeNull();
  });

  it("getBalance returns 0 when not configured", async () => {
    const { SolanaService } = await import("../services/SolanaService.js");
    const service = new SolanaService();
    const balance = await service.getBalance();
    expect(balance).toBe(0);
  });

  it("signAndSendTransaction fails when not configured", async () => {
    const { SolanaService } = await import("../services/SolanaService.js");
    const service = new SolanaService();
    const result = await service.signAndSendTransaction("dGVzdA==");
    expect(result.confirmed).toBe(false);
    expect(result.error).toContain("not configured");
  });

  it("constructor reads NEO_WALLET_PRIVATE_KEY", async () => {
    const { SolanaService } = await import("../services/SolanaService.js");
    // Just verify the class exists and takes no constructor args
    const service = new SolanaService();
    expect(service).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/Users/footb/neo-trader && npx vitest run src/__tests__/SolanaService.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Extract SolanaService**

Copy `eliza-agents/src/services/SolanaService.ts` to `neo-trader/src/services/SolanaService.ts` and apply these changes:

1. **Line 7:** Replace `import { Service, type IAgentRuntime } from "../types/elizaos.js";` with nothing (remove line)
2. **Line 84:** Replace `export class SolanaService extends Service {` with `export class SolanaService {`
3. **Lines 85-86:** Remove `static readonly serviceType` and `readonly capabilityDescription` (Service class fields)
4. **Line 97:** Replace `constructor(runtime?: IAgentRuntime) { super(runtime);` with `constructor() {`
5. **Lines 113-119:** Remove `static async start(runtime)` method entirely
6. **Lines 121-125:** Remove `async stop()` method entirely
7. **Line 128:** Replace `GHOST_WALLET_PRIVATE_KEY` with `NEO_WALLET_PRIVATE_KEY`
8. **Line 132:** Update log message from `[SolanaService] GHOST_WALLET_PRIVATE_KEY` to `[SolanaService] NEO_WALLET_PRIVATE_KEY`
9. **Add** `transferSol` method after `getTopHolderConcentration`:

```typescript
async transferSol(toAddress: string, amountSol: number): Promise<{ signature: string; confirmed: boolean; error?: string }> {
  if (!this.isConfigured() || !this.keypair || !this.publicKeyBytes) {
    return { signature: "", confirmed: false, error: "Wallet not configured" };
  }

  const lamports = Math.floor(amountSol * 1_000_000_000);
  const fromPubkey = base58Encode(this.publicKeyBytes);

  try {
    // Get recent blockhash
    const blockhash = await this.getRecentBlockhash();
    if (!blockhash) {
      return { signature: "", confirmed: false, error: "Failed to get blockhash" };
    }

    // Build legacy transfer transaction manually
    // System Program Transfer instruction: program_id index, from, to, lamports (LE u64)
    const toPubkeyBytes = base58Decode(toAddress);
    const systemProgramId = new Uint8Array(32); // 11111111111111111111111111111111

    // Transaction message header: numRequiredSignatures, numReadonlySignedAccounts, numReadonlyUnsignedAccounts
    const header = new Uint8Array([1, 0, 1]); // 1 signer (from), 0 readonly-signed, 1 readonly-unsigned (system program)

    // Account keys: [from, to, system_program]
    const accountKeys = new Uint8Array(32 * 3);
    accountKeys.set(this.publicKeyBytes, 0);
    accountKeys.set(toPubkeyBytes, 32);
    accountKeys.set(systemProgramId, 64);

    // Recent blockhash (32 bytes)
    const blockhashBytes = base58Decode(blockhash);

    // Instructions: 1 instruction
    // Compact-u16: 1
    const numInstructions = new Uint8Array([1]);
    // Instruction: program_id_index=2, accounts=[0,1], data=transfer(lamports)
    const programIdIndex = new Uint8Array([2]);
    const accountIndicesLen = new Uint8Array([2]); // compact-u16: 2
    const accountIndices = new Uint8Array([0, 1]); // from, to
    // Transfer instruction data: u32 instruction index (2 = Transfer) + u64 lamports
    const dataLen = new Uint8Array([12]); // compact-u16: 12 bytes
    const data = new Uint8Array(12);
    const view = new DataView(data.buffer);
    view.setUint32(0, 2, true); // instruction index 2 = Transfer
    // Write u64 lamports as two u32s (little-endian)
    view.setUint32(4, lamports & 0xFFFFFFFF, true);
    view.setUint32(8, Math.floor(lamports / 0x100000000), true);

    // Compact-u16 for 3 account keys
    const numAccountKeys = new Uint8Array([3]);

    // Assemble message
    const message = new Uint8Array([
      ...header,
      ...numAccountKeys,
      ...accountKeys,
      ...blockhashBytes,
      ...numInstructions,
      ...programIdIndex,
      ...accountIndicesLen,
      ...accountIndices,
      ...dataLen,
      ...data,
    ]);

    // Sign
    const signature = nacl.sign.detached(message, this.keypair.secretKey);

    // Assemble full transaction: [compact-u16: 1 sig] [64-byte sig] [message]
    const tx = new Uint8Array(1 + 64 + message.length);
    tx[0] = 1; // 1 signature
    tx.set(signature, 1);
    tx.set(message, 65);

    // Send
    const sigStr = await this.sendRawTransaction(tx);

    const confirmed = await this.confirmTransaction(sigStr);
    return { signature: sigStr, confirmed };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[SolanaService] transferSol failed:", msg);
    return { signature: "", confirmed: false, error: msg };
  }
}
```

10. Update singleton pattern: keep `getSolanaService()` export.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/Users/footb/neo-trader && npx vitest run src/__tests__/SolanaService.test.ts
```

Expected: PASS

- [ ] **Step 5: Type check**

```bash
cd C:/Users/footb/neo-trader && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
cd C:/Users/footb/neo-trader && git add src/services/SolanaService.ts src/__tests__/SolanaService.test.ts
git commit -m "feat: extract SolanaService — strip ElizaOS, add transferSol"
```

---

### Task 5: SmartMoneyService Extraction

**Files:**
- Create: `C:\Users\footb\neo-trader\src\services\SmartMoneyService.ts`
- Test: `C:\Users\footb\neo-trader\src\__tests__\SmartMoneyService.test.ts`

**Reference:** `eliza-agents/src/services/SmartMoneyService.ts` (396 lines)

**Changes from BagsWorld:**
1. Remove `import { Service, type IAgentRuntime } from "../types/elizaos.js";`
2. Replace `export class SmartMoneyService extends Service {` with `export class SmartMoneyService {`
3. Remove `static readonly serviceType`, `readonly capabilityDescription`
4. Replace `constructor(runtime?: IAgentRuntime) { super(runtime);` with `constructor() {`
5. Remove `static async start(runtime)` method
6. Remove `async stop()` method
7. Replace `refreshSmartMoneyList()` body with no-op: `console.log("[SmartMoneyService] Wallet discovery deferred — using default wallets");`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/SmartMoneyService.test.ts
import { describe, it, expect } from "vitest";
import { SmartMoneyService, getSmartMoneyService } from "../services/SmartMoneyService.js";

describe("SmartMoneyService", () => {
  it("initializes with default wallets", () => {
    const service = new SmartMoneyService();
    const wallets = service.getAllWallets();
    expect(wallets.length).toBeGreaterThanOrEqual(7);
  });

  it("scores token with no activity as 0", async () => {
    const service = new SmartMoneyService();
    const result = await service.getSmartMoneyScore("unknownMint123");
    expect(result.score).toBe(0);
    expect(result.buyers).toHaveLength(0);
  });

  it("records activity and updates score", async () => {
    const service = new SmartMoneyService();
    const wallets = service.getWalletAddresses();
    const trackedWallet = wallets[0];

    service.recordActivity("testMint", trackedWallet, "buy", 0.5);
    const result = await service.getSmartMoneyScore("testMint");
    expect(result.score).toBeGreaterThan(0);
  });

  it("isSmartMoney returns true for tracked wallets", () => {
    const service = new SmartMoneyService();
    const wallets = service.getWalletAddresses();
    expect(service.isSmartMoney(wallets[0])).toBe(true);
    expect(service.isSmartMoney("randomWallet")).toBe(false);
  });

  it("singleton getter works", () => {
    const a = getSmartMoneyService();
    const b = getSmartMoneyService();
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/Users/footb/neo-trader && npx vitest run src/__tests__/SmartMoneyService.test.ts
```

- [ ] **Step 3: Extract SmartMoneyService**

Copy `eliza-agents/src/services/SmartMoneyService.ts` to `neo-trader/src/services/SmartMoneyService.ts`. Apply the 7 changes listed above. Remove the `import("./WalletDiscoveryService.js")` dynamic import inside `refreshSmartMoneyList`.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:/Users/footb/neo-trader && npx vitest run src/__tests__/SmartMoneyService.test.ts
```

- [ ] **Step 5: Commit**

```bash
cd C:/Users/footb/neo-trader && git add src/services/SmartMoneyService.ts src/__tests__/SmartMoneyService.test.ts
git commit -m "feat: extract SmartMoneyService — strip ElizaOS, defer wallet discovery"
```

---

## Chunk 3: DexScreenerService + ProfitSplitter

### Task 6: DexScreenerService

**Files:**
- Create: `C:\Users\footb\neo-trader\src\services\DexScreenerService.ts`
- Test: `C:\Users\footb\neo-trader\src\__tests__\DexScreenerService.test.ts`

**New service.** Replaces BagsApiService for pump.fun launch sourcing.

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/DexScreenerService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("DexScreenerService", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("getPumpFunLaunches returns filtered pairs", async () => {
    const { DexScreenerService } = await import("../services/DexScreenerService.js");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        {
          chainId: "solana",
          dexId: "pumpswap",
          pairAddress: "pair1",
          baseToken: { address: "mint1", name: "Test", symbol: "TEST" },
          quoteToken: { address: "So11111111111111111111111111111111111111112" },
          priceUsd: "0.001",
          liquidity: { usd: 5000 },
          volume: { h24: 2000 },
          marketCap: 10000,
          pairCreatedAt: Date.now() - 60000,
          txns: { h24: { buys: 50, sells: 30 } },
        },
      ]),
    });

    const service = new DexScreenerService();
    const launches = await service.getPumpFunLaunches();
    expect(launches.length).toBe(1);
    expect(launches[0].baseToken.symbol).toBe("TEST");
  });

  it("getTokenProfile returns token data", async () => {
    const { DexScreenerService } = await import("../services/DexScreenerService.js");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        {
          chainId: "solana",
          dexId: "pumpswap",
          pairAddress: "pair1",
          baseToken: { address: "mint1", name: "Test", symbol: "TEST" },
          quoteToken: { address: "So11111111111111111111111111111111111111112" },
          priceUsd: "0.005",
          priceNative: "0.00003",
          liquidity: { usd: 8000 },
          volume: { h24: 3000 },
          marketCap: 20000,
          pairCreatedAt: Date.now() - 120000,
          txns: { h24: { buys: 80, sells: 40 } },
        },
      ]),
    });

    const service = new DexScreenerService();
    const profile = await service.getTokenProfile("mint1");
    expect(profile).not.toBeNull();
    expect(profile!.priceUsd).toBe(0.005);
    expect(profile!.liquidityUsd).toBe(8000);
  });

  it("caches results for TTL duration", async () => {
    const { DexScreenerService } = await import("../services/DexScreenerService.js");

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ([]),
    });

    const service = new DexScreenerService();
    await service.getPumpFunLaunches();
    await service.getPumpFunLaunches();

    // Should only fetch once due to 30s cache
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/Users/footb/neo-trader && npx vitest run src/__tests__/DexScreenerService.test.ts
```

- [ ] **Step 3: Implement DexScreenerService**

```typescript
// src/services/DexScreenerService.ts
import type { DexScreenerPair } from "../types.js";

// Parsed token profile for NeoTrader evaluation
export interface TokenProfile {
  mint: string;
  symbol: string;
  name: string;
  priceUsd: number;
  priceSol: number;
  liquidityUsd: number;
  volume24hUsd: number;
  marketCapUsd: number;
  buys24h: number;
  sells24h: number;
  buySellRatio: number;
  pairCreatedAt: number;
  ageSeconds: number;
  dexId: string;
}

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

let dexScreenerServiceInstance: DexScreenerService | null = null;

export class DexScreenerService {
  private launchCache: CacheEntry<DexScreenerPair[]> | null = null;
  private profileCache: Map<string, CacheEntry<TokenProfile | null>> = new Map();

  private static readonly LAUNCH_CACHE_TTL = 30_000; // 30 seconds
  private static readonly PROFILE_CACHE_TTL = 60_000; // 60 seconds
  private static readonly BASE_URL = "https://api.dexscreener.com";

  async getPumpFunLaunches(): Promise<DexScreenerPair[]> {
    // Check cache
    if (this.launchCache && Date.now() < this.launchCache.expiry) {
      return this.launchCache.data;
    }

    try {
      // Primary: search for pump.fun pairs
      // Primary: search for pump.fun pairs
      let raw: DexScreenerPair[] = [];
      const primaryRes = await fetch(
        `${DexScreenerService.BASE_URL}/tokens/v1/solana/search?q=pump.fun`,
        { signal: AbortSignal.timeout(10000) }
      );

      if (primaryRes.ok) {
        raw = await primaryRes.json();
      } else {
        console.warn(`[DexScreenerService] Primary search returned ${primaryRes.status}, trying fallback`);
        // Fallback: latest Solana pairs
        const fallbackRes = await fetch(
          `${DexScreenerService.BASE_URL}/latest/dex/pairs/solana`,
          { signal: AbortSignal.timeout(10000) }
        );
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          raw = fallbackData.pairs || fallbackData || [];
        }
      }

      // Filter for pump.fun DEX pairs with SOL quote
      const filtered = raw.filter((pair) => {
        const isPumpFun = pair.dexId === "pumpswap" || pair.dexId === "pump.fun" || pair.dexId === "pumpfun";
        const isSolQuote = pair.quoteToken?.address === "So11111111111111111111111111111111111111112";
        return isPumpFun && isSolQuote;
      });

      this.launchCache = {
        data: filtered,
        expiry: Date.now() + DexScreenerService.LAUNCH_CACHE_TTL,
      };

      return filtered;
    } catch (error) {
      console.error("[DexScreenerService] getPumpFunLaunches error:", error);
      return [];
    }
  }

  async getTokenProfile(mint: string): Promise<TokenProfile | null> {
    // Check cache
    const cached = this.profileCache.get(mint);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }

    try {
      const response = await fetch(
        `${DexScreenerService.BASE_URL}/tokens/v1/solana/${mint}`,
        { signal: AbortSignal.timeout(10000) }
      );

      if (!response.ok) return null;

      const pairs: DexScreenerPair[] = await response.json();
      if (!pairs.length) return null;

      // Use the most liquid pair
      const pair = pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
      const buys = pair.txns?.h24?.buys || 0;
      const sells = pair.txns?.h24?.sells || 1;

      const profile: TokenProfile = {
        mint: pair.baseToken.address,
        symbol: pair.baseToken.symbol,
        name: pair.baseToken.name,
        priceUsd: parseFloat(pair.priceUsd || "0"),
        priceSol: parseFloat(pair.priceNative || "0"),
        liquidityUsd: pair.liquidity?.usd || 0,
        volume24hUsd: pair.volume?.h24 || 0,
        marketCapUsd: pair.marketCap || 0,
        buys24h: buys,
        sells24h: sells,
        buySellRatio: sells > 0 ? buys / sells : buys,
        pairCreatedAt: pair.pairCreatedAt || 0,
        ageSeconds: pair.pairCreatedAt ? Math.floor((Date.now() - pair.pairCreatedAt) / 1000) : 0,
        dexId: pair.dexId,
      };

      this.profileCache.set(mint, {
        data: profile,
        expiry: Date.now() + DexScreenerService.PROFILE_CACHE_TTL,
      });

      return profile;
    } catch (error) {
      console.error(`[DexScreenerService] getTokenProfile(${mint}) error:`, error);
      return null;
    }
  }

  clearCache(): void {
    this.launchCache = null;
    this.profileCache.clear();
  }
}

export function getDexScreenerService(): DexScreenerService {
  if (!dexScreenerServiceInstance) {
    dexScreenerServiceInstance = new DexScreenerService();
  }
  return dexScreenerServiceInstance;
}
```

- [ ] **Step 4: Add DexScreenerPair type to types.ts**

Add to `src/types.ts`:

```typescript
export interface DexScreenerPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name?: string; symbol?: string };
  priceUsd?: string;
  priceNative?: string;
  liquidity?: { usd: number };
  volume?: { h24: number };
  marketCap?: number;
  pairCreatedAt?: number;
  txns?: { h24?: { buys: number; sells: number } };
}
```

- [ ] **Step 5: Run tests**

```bash
cd C:/Users/footb/neo-trader && npx vitest run src/__tests__/DexScreenerService.test.ts
```

- [ ] **Step 6: Commit**

```bash
cd C:/Users/footb/neo-trader && git add src/services/DexScreenerService.ts src/__tests__/DexScreenerService.test.ts src/types.ts
git commit -m "feat: DexScreenerService — pump.fun launch discovery via DexScreener API"
```

---

### Task 7: ProfitSplitter

**Files:**
- Create: `C:\Users\footb\neo-trader\src\services\ProfitSplitter.ts`
- Test: `C:\Users\footb\neo-trader\src\__tests__\ProfitSplitter.test.ts`

**New service.** Handles 75/25 split after winning trades.

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/ProfitSplitter.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("ProfitSplitter", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.PUMPFUN_DEPOSIT_ADDRESS;
    delete process.env.NEO_BUYBACK_PERCENT;
  });

  it("calculates 75/25 split correctly", async () => {
    const { ProfitSplitter } = await import("../services/ProfitSplitter.js");
    const splitter = new ProfitSplitter();
    const result = splitter.calculateSplit(1.0);
    expect(result.buybackSol).toBeCloseTo(0.75);
    expect(result.keepSol).toBeCloseTo(0.25);
  });

  it("respects custom buyback percent from env", async () => {
    process.env.NEO_BUYBACK_PERCENT = "50";
    const { ProfitSplitter } = await import("../services/ProfitSplitter.js");
    const splitter = new ProfitSplitter();
    const result = splitter.calculateSplit(1.0);
    expect(result.buybackSol).toBeCloseTo(0.50);
    expect(result.keepSol).toBeCloseTo(0.50);
  });

  it("skips deposit below minimum (0.01 SOL)", async () => {
    const { ProfitSplitter } = await import("../services/ProfitSplitter.js");
    const splitter = new ProfitSplitter();
    const result = splitter.calculateSplit(0.005);
    // 75% of 0.005 = 0.00375, below 0.01 minimum
    expect(result.buybackSol).toBe(0);
    expect(result.keepSol).toBeCloseTo(0.005);
  });

  it("logs warning when deposit address not set", async () => {
    const consoleSpy = vi.spyOn(console, "warn");
    const { ProfitSplitter } = await import("../services/ProfitSplitter.js");
    const splitter = new ProfitSplitter();
    expect(splitter.isConfigured()).toBe(false);
    consoleSpy.mockRestore();
  });

  it("isConfigured returns true when deposit address set", async () => {
    process.env.PUMPFUN_DEPOSIT_ADDRESS = "someAddress123";
    const { ProfitSplitter } = await import("../services/ProfitSplitter.js");
    const splitter = new ProfitSplitter();
    expect(splitter.isConfigured()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/Users/footb/neo-trader && npx vitest run src/__tests__/ProfitSplitter.test.ts
```

- [ ] **Step 3: Implement ProfitSplitter**

```typescript
// src/services/ProfitSplitter.ts
import { SolanaService, getSolanaService } from "./SolanaService.js";

const DEFAULT_BUYBACK_PERCENT = 75;
const MIN_DEPOSIT_SOL = 0.01;

interface SplitResult {
  buybackSol: number;
  keepSol: number;
}

interface DepositResult {
  deposited: boolean;
  signature?: string;
  buybackSol: number;
  keepSol: number;
  error?: string;
}

let profitSplitterInstance: ProfitSplitter | null = null;

export class ProfitSplitter {
  private depositAddress: string | null;
  private buybackPercent: number;
  private solanaService: SolanaService | null = null;
  // In-memory tracking (DB logging done by caller)
  private totalDeposited = 0;
  private depositCount = 0;

  constructor() {
    this.depositAddress = process.env.PUMPFUN_DEPOSIT_ADDRESS || null;
    this.buybackPercent = parseInt(process.env.NEO_BUYBACK_PERCENT || "", 10) || DEFAULT_BUYBACK_PERCENT;
  }

  isConfigured(): boolean {
    return !!this.depositAddress;
  }

  calculateSplit(pnlSol: number): SplitResult {
    if (pnlSol <= 0) {
      return { buybackSol: 0, keepSol: pnlSol };
    }

    const rawBuyback = pnlSol * (this.buybackPercent / 100);

    if (rawBuyback < MIN_DEPOSIT_SOL) {
      // Below minimum — keep everything
      return { buybackSol: 0, keepSol: pnlSol };
    }

    return {
      buybackSol: rawBuyback,
      keepSol: pnlSol - rawBuyback,
    };
  }

  async splitProfit(pnlSol: number, tradeId?: string): Promise<DepositResult> {
    const split = this.calculateSplit(pnlSol);

    if (split.buybackSol === 0) {
      return { deposited: false, buybackSol: 0, keepSol: split.keepSol };
    }

    if (!this.depositAddress) {
      console.warn(
        `[ProfitSplitter] PUMPFUN_DEPOSIT_ADDRESS not set — ${split.buybackSol.toFixed(4)} SOL buyback pending`
      );
      return { deposited: false, buybackSol: split.buybackSol, keepSol: split.keepSol };
    }

    // Initialize SolanaService lazily
    if (!this.solanaService) {
      this.solanaService = getSolanaService();
    }

    try {
      const result = await this.solanaService.transferSol(this.depositAddress, split.buybackSol);

      if (result.confirmed) {
        this.totalDeposited += split.buybackSol;
        this.depositCount++;
        console.log(
          `[ProfitSplitter] Deposited ${split.buybackSol.toFixed(4)} SOL to pump.fun buyback ` +
          `(tx: ${result.signature.slice(0, 16)}..., total: ${this.totalDeposited.toFixed(4)} SOL)`
        );
        return { deposited: true, signature: result.signature, buybackSol: split.buybackSol, keepSol: split.keepSol };
      } else {
        return { deposited: false, buybackSol: split.buybackSol, keepSol: split.keepSol, error: result.error };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.error(`[ProfitSplitter] Deposit failed: ${msg}`);
      return { deposited: false, buybackSol: split.buybackSol, keepSol: split.keepSol, error: msg };
    }
  }

  getStats() {
    return { totalDeposited: this.totalDeposited, depositCount: this.depositCount };
  }
}

export function getProfitSplitter(): ProfitSplitter {
  if (!profitSplitterInstance) {
    profitSplitterInstance = new ProfitSplitter();
  }
  return profitSplitterInstance;
}
```

- [ ] **Step 4: Run tests**

```bash
cd C:/Users/footb/neo-trader && npx vitest run src/__tests__/ProfitSplitter.test.ts
```

- [ ] **Step 5: Commit**

```bash
cd C:/Users/footb/neo-trader && git add src/services/ProfitSplitter.ts src/__tests__/ProfitSplitter.test.ts
git commit -m "feat: ProfitSplitter — 75/25 profit split for pump.fun buyback deposits"
```

---

## Chunk 4: TelegramBroadcaster + NeoTrader Extraction

### Task 8: TelegramBroadcaster Extraction

**Files:**
- Create: `C:\Users\footb\neo-trader\src\services\TelegramBroadcaster.ts`
- Test: `C:\Users\footb\neo-trader\src\__tests__\TelegramBroadcaster.test.ts`

**Reference:** `eliza-agents/src/services/TelegramBroadcaster.ts` (515 lines)

**Changes from BagsWorld:**
1. Remove `import { Bot } from "grammy"` — replace with raw `fetch` to Telegram Bot API
2. Remove `NeonQueryFunction` import — DB logging deferred (pass `db` as optional constructor param of type `(strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>`)
3. Replace `this.bot = new Bot(...)` with storing bot token string
4. Replace `this.bot.api.sendMessage(...)` with `fetch("https://api.telegram.org/bot${token}/sendMessage", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({chat_id, text, parse_mode}) })`
5. Remove `includeBagsLink` config and all `bags.fm` link references
6. Rename "GHOST ENTRY" → "NEO ENTRY", "GHOST EXIT" → "NEO EXIT" in message templates
7. Add buyback signal formatting method: `broadcastBuyback(amount, cumulative)`
8. Add `TELEGRAM_BROADCAST_ENABLED` env check (already exists but verify)
9. Move `TradeSignal` and `ExitSignal` types to `types.ts` (import from there)

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/TelegramBroadcaster.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("TelegramBroadcaster", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.resetModules();
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.TELEGRAM_CHANNEL_ID = "@testchannel";
    process.env.TELEGRAM_BROADCAST_ENABLED = "true";
  });

  it("sends entry signal via raw fetch", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 1 } }),
    });

    const { TelegramBroadcaster } = await import("../services/TelegramBroadcaster.js");
    const broadcaster = new TelegramBroadcaster();

    const sent = await broadcaster.broadcastEntry({
      type: "entry",
      tokenSymbol: "TEST",
      tokenName: "Test Token",
      tokenMint: "mint123",
      amountSol: 0.5,
      score: 75,
      reasons: ["good liquidity"],
      metrics: { marketCapUsd: 10000, liquidityUsd: 5000, volume24hUsd: 2000, buySellRatio: 1.5 },
    });

    expect(sent).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("api.telegram.org/bottest-token/sendMessage"),
      expect.any(Object)
    );
  });

  it("does not include bags.fm links", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 1 } }),
    });

    const { TelegramBroadcaster } = await import("../services/TelegramBroadcaster.js");
    const broadcaster = new TelegramBroadcaster();

    await broadcaster.broadcastEntry({
      type: "entry",
      tokenSymbol: "TEST",
      tokenName: "Test Token",
      tokenMint: "mint123",
      amountSol: 0.5,
      score: 75,
      reasons: ["test"],
      metrics: { marketCapUsd: 10000, liquidityUsd: 5000, volume24hUsd: 2000, buySellRatio: 1.5 },
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).not.toContain("bags.fm");
    expect(body.text).toContain("NEO ENTRY");
  });

  it("rate limits messages", async () => {
    const { TelegramBroadcaster } = await import("../services/TelegramBroadcaster.js");
    const broadcaster = new TelegramBroadcaster();
    // isEnabled but rate-limited by min interval
    expect(broadcaster.isEnabled()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/Users/footb/neo-trader && npx vitest run src/__tests__/TelegramBroadcaster.test.ts
```

- [ ] **Step 3: Extract and rewrite TelegramBroadcaster**

Copy from BagsWorld, then:
- Replace `grammy` Bot with raw `fetch` calls
- Remove Bags.fm links
- Rename Ghost → Neo in message formatting
- Import `TradeSignal`, `ExitSignal` from `../types.js`
- Add `broadcastBuyback` method

- [ ] **Step 4: Run tests**

```bash
cd C:/Users/footb/neo-trader && npx vitest run src/__tests__/TelegramBroadcaster.test.ts
```

- [ ] **Step 5: Commit**

```bash
cd C:/Users/footb/neo-trader && git add src/services/TelegramBroadcaster.ts src/__tests__/TelegramBroadcaster.test.ts src/types.ts
git commit -m "feat: TelegramBroadcaster — raw fetch, no grammy, Neo branding"
```

---

### Task 9: NeoTrader Extraction (Core Engine)

**Files:**
- Create: `C:\Users\footb\neo-trader\src\services\NeoTrader.ts`
- Test: `C:\Users\footb\neo-trader\src\__tests__\NeoTrader.test.ts`

**Reference:** `eliza-agents/src/services/GhostTrader.ts` (~3000 lines)

This is the largest extraction. The approach:
1. Copy GhostTrader.ts → NeoTrader.ts
2. Rename class `GhostTrader` → `NeoTrader`, all `ghost` → `neo` in variable/function names
3. Remove BagsWorld-specific imports and replace with new services
4. Rewrite `evaluateLaunch()` to use DexScreenerService instead of BagsApiService
5. Rewrite trade execution to use Jupiter Lite API instead of Bags.fm swap
6. Replace Sol Incinerator burn with ProfitSplitter
7. Remove WorldSyncService, AgentCoordinator, MemoryService dependencies
8. Rename DB tables: `ghost_positions` → `neo_positions`, `ghost_config` → `neo_config`, `ghost_learning` → `neo_learning`, `ghost_burns` → `neo_buybacks`
9. Rename env vars: `GHOST_*` → `NEO_*`
10. Remove Bags-specific config fields: `requireTokenClaimed`, `minLifetimeFeesSol`, `maxCreatorFeeBps`, `burnEnabled`, `burnPercent`
11. Add `buybackPercent` config field
12. Remove chatter/speech bubble logic (WorldSync references)

**Key method changes:**
- `evaluateLaunches()`: `bagsApi.getRecentLaunches()` → `dexScreenerService.getPumpFunLaunches()`
- `evaluateLaunch()`: `bagsApi.getTokenInfo(mint)` → `dexScreenerService.getTokenProfile(mint)`. Remove `lifetimeFeesSol`, `hasFeeClaims` scoring. Keep liquidity, volume, mcap, holders, buy/sell ratio, concentration, smart money scoring.
- `executeBuy()`: Replace `bagsApi.getQuote()` + `bagsApi.executeTrade()` with Jupiter Lite API (`GET /swap/v1/quote` + `POST /swap/v1/swap`). Sign returned base64 transaction via SolanaService.
- `executeSell()`: Same Jupiter swap but selling tokens for SOL.
- `closePosition()`: After calculating P&L, if profitable call `profitSplitter.splitProfit(pnl)` instead of Sol Incinerator burn.
- Remove `executeBuyAndBurn()`, `refreshBurnStatsCache()` methods entirely.
- Import from local services instead of BagsWorld services.

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/NeoTrader.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("NeoTrader", () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    // Ensure trading is disabled by default
    delete process.env.NEO_TRADING_ENABLED;
  });

  it("initializes with trading disabled", async () => {
    const { getNeoTrader } = await import("../services/NeoTrader.js");
    const trader = getNeoTrader();
    const stats = trader.getStats();
    expect(stats.enabled).toBe(false);
  });

  it("default config matches spec", async () => {
    const { getNeoTrader } = await import("../services/NeoTrader.js");
    const trader = getNeoTrader();
    const config = trader.getConfig();
    expect(config.minPositionSol).toBe(0.2);
    expect(config.maxPositionSol).toBe(1.0);
    expect(config.maxTotalExposureSol).toBe(3.0);
    expect(config.maxOpenPositions).toBe(3);
    expect(config.takeProfitTiers).toEqual([1.5, 2.0, 3.0]);
    expect(config.stopLossPercent).toBe(15);
    expect(config.buybackPercent).toBe(75);
  });

  it("does not have Bags-specific config fields", async () => {
    const { getNeoTrader } = await import("../services/NeoTrader.js");
    const trader = getNeoTrader();
    const config = trader.getConfig();
    expect((config as any).requireTokenClaimed).toBeUndefined();
    expect((config as any).minLifetimeFeesSol).toBeUndefined();
    expect((config as any).maxCreatorFeeBps).toBeUndefined();
    expect((config as any).burnEnabled).toBeUndefined();
    expect((config as any).burnPercent).toBeUndefined();
  });

  it("respects NEO_MAX_POSITION_SOL env override", async () => {
    process.env.NEO_MAX_POSITION_SOL = "0.5";
    const { getNeoTrader } = await import("../services/NeoTrader.js");
    const trader = getNeoTrader();
    expect(trader.getConfig().maxPositionSol).toBe(0.5);
    delete process.env.NEO_MAX_POSITION_SOL;
  });

  it("getOpenPositions returns empty initially", async () => {
    const { getNeoTrader } = await import("../services/NeoTrader.js");
    const trader = getNeoTrader();
    expect(trader.getOpenPositions()).toEqual([]);
  });

  it("getStats returns correct defaults", async () => {
    const { getNeoTrader } = await import("../services/NeoTrader.js");
    const trader = getNeoTrader();
    const stats = trader.getStats();
    expect(stats.openPositions).toBe(0);
    expect(stats.totalExposureSol).toBe(0);
    expect(stats.totalBuybackSol).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/Users/footb/neo-trader && npx vitest run src/__tests__/NeoTrader.test.ts
```

- [ ] **Step 3: Extract NeoTrader**

This is the largest step. Copy `GhostTrader.ts` and apply the renames and dependency swaps listed above. Key structural changes:

1. **Imports:** Replace all BagsWorld service imports with local ones:
   ```typescript
   import { SolanaService, getSolanaService } from "./SolanaService.js";
   import { SmartMoneyService, getSmartMoneyService } from "./SmartMoneyService.js";
   import { DexScreenerService, getDexScreenerService, type TokenProfile } from "./DexScreenerService.js";
   import { ProfitSplitter, getProfitSplitter } from "./ProfitSplitter.js";
   import { TelegramBroadcaster, getTelegramBroadcaster } from "./TelegramBroadcaster.js";
   import type { NeoPosition, NeoTraderConfig, NeoTraderStats, TradeEvaluation, DexScreenerPair } from "../types.js";
   ```

2. **Remove imports:** `BagsApiService`, `AgentCoordinator`, `WorldSyncService`, `MemoryService`, `DexScreenerCache`, `envBool` (inline it)

3. **Class rename:** `GhostTrader` → `NeoTrader`

4. **Config changes:** Remove `requireTokenClaimed`, `minLifetimeFeesSol`, `maxCreatorFeeBps`, `burnEnabled`, `burnPercent`. Add `buybackPercent: 75`. Keep `minVolumeToHoldUsd` (500) and `deadPositionDecayPercent` (25) for dead position detection.

5. **Constructor:** Remove `bagsApi`, `coordinator`, `worldSync` initialization. Add `dexScreenerService`, `profitSplitter`. Rename `ghostWalletPrivateKey` → `neoWalletPrivateKey`. Read from `NEO_*` env vars.

6. **evaluateLaunches():** Call `this.dexScreenerService.getPumpFunLaunches()` instead of `this.bagsApi.getRecentLaunches()`.

7. **evaluateLaunch():** Call `this.dexScreenerService.getTokenProfile(mint)` instead of `this.bagsApi.getTokenInfo()`. Remove lifetime fees scoring. Keep all other scoring logic.

8. **executeBuy():** Replace Bags.fm swap with Jupiter Lite API:
   ```typescript
   // Get quote
   const quoteUrl = `https://lite-api.jup.ag/swap/v1/quote?inputMint=${SOL_MINT}&outputMint=${tokenMint}&amount=${lamports}&slippageBps=${this.config.slippageBps}`;
   const quoteRes = await fetch(quoteUrl);
   const quote = await quoteRes.json();

   // Get swap transaction
   const swapRes = await fetch("https://lite-api.jup.ag/swap/v1/swap", {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({
       quoteResponse: quote,
       userPublicKey: this.neoWalletPublicKey,
     }),
   });
   const { swapTransaction } = await swapRes.json();

   // Sign and send
   const result = await this.solanaService.signAndSendTransaction(swapTransaction);
   ```

9. **executeSell():** Same pattern but `inputMint=tokenMint, outputMint=SOL_MINT`.

10. **closePosition():** On profitable close, call `this.profitSplitter.splitProfit(pnl, position.id)` instead of `executeBuyAndBurn()`.

11. **Remove methods:** `executeBuyAndBurn()`, `refreshBurnStatsCache()`, `broadcastChatter()` (WorldSync speech bubbles).

12. **DB tables:** Rename `ghost_positions` → `neo_positions`, `ghost_config` → `neo_config`, `ghost_learning` → `neo_learning`, `ghost_burns` → `neo_buybacks` (schema from spec section 6).

13. **Singleton:** `getGhostTrader()` → `getNeoTrader()`, `ghostTraderInstance` → `neoTraderInstance`.

- [ ] **Step 4: Run tests**

```bash
cd C:/Users/footb/neo-trader && npx vitest run src/__tests__/NeoTrader.test.ts
```

- [ ] **Step 5: Type check**

```bash
cd C:/Users/footb/neo-trader && npx tsc --noEmit
```

Fix any type errors from the extraction.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/footb/neo-trader && git add src/services/NeoTrader.ts src/__tests__/NeoTrader.test.ts
git commit -m "feat: NeoTrader — extract GhostTrader, Jupiter swaps, pump.fun buyback"
```

---

## Chunk 5: ChatService + PaymentService

### Task 10: ChatService

**Files:**
- Create: `C:\Users\footb\neo-trader\src\services\ChatService.ts`
- Test: `C:\Users\footb\neo-trader\src\__tests__\ChatService.test.ts`

**New service.** Anthropic SDK chat with live trading context.

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/ChatService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "i see the chain. the code shows green." }],
      }),
    };
  },
}));

describe("ChatService", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  it("builds system prompt with character info", async () => {
    const { ChatService } = await import("../services/ChatService.js");
    const service = new ChatService();
    const prompt = service.buildSystemPrompt();
    expect(prompt).toContain("Neo");
    expect(prompt).not.toContain("BagsWorld");
    expect(prompt).not.toContain("Ghost");
  });

  it("generates response with session tracking", async () => {
    const { ChatService } = await import("../services/ChatService.js");
    const service = new ChatService();
    const result = await service.chat("what do you see?", "session-1");
    expect(result.response).toContain("i see");
    expect(result.sessionId).toBe("session-1");
  });

  it("creates new session if not provided", async () => {
    const { ChatService } = await import("../services/ChatService.js");
    const service = new ChatService();
    const result = await service.chat("hello");
    expect(result.sessionId).toBeDefined();
    expect(result.sessionId.length).toBeGreaterThan(0);
  });

  it("maintains message history per session", async () => {
    const { ChatService } = await import("../services/ChatService.js");
    const service = new ChatService();
    await service.chat("first message", "sess-1");
    await service.chat("second message", "sess-1");
    const history = service.getSessionHistory("sess-1");
    expect(history.length).toBe(4); // 2 user + 2 assistant
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:/Users/footb/neo-trader && npx vitest run src/__tests__/ChatService.test.ts
```

- [ ] **Step 3: Implement ChatService**

Key design:
- Imports `Anthropic` from `@anthropic-ai/sdk`
- Imports `neoCharacter` from `../character.js`
- Imports `getNeoTrader` for live trading context (same pattern as `ghostTradingProvider`)
- System prompt = character bio + lore + style + live trading context (status, positions, recent trades, performance)
- Session Map: `sessionId → { messages: Array<{role, content}>, createdAt, lastActivity }`
- Max 20 messages per session context window (trim oldest)
- Model: `claude-sonnet-4-20250514`
- `buildSystemPrompt()` is a public method for testing
- `chat(message, sessionId?)` returns `{ response, sessionId }`
- `getSessionHistory(sessionId)` returns message array
- `cleanupSessions()` prunes sessions older than 24h

- [ ] **Step 4: Run tests**

```bash
cd C:/Users/footb/neo-trader && npx vitest run src/__tests__/ChatService.test.ts
```

- [ ] **Step 5: Commit**

```bash
cd C:/Users/footb/neo-trader && git add src/services/ChatService.ts src/__tests__/ChatService.test.ts
git commit -m "feat: ChatService — Anthropic SDK chat with Neo persona + trading context"
```

---

### Task 11: PaymentService

**Files:**
- Create: `C:\Users\footb\neo-trader\src\services\PaymentService.ts`
- Test: `C:\Users\footb\neo-trader\src\__tests__\PaymentService.test.ts`

**New service.** Integrates `@pump-fun/agent-payments-sdk`.

**Important:** Before implementing, verify the SDK exists and check its API:

```bash
npm info @pump-fun/agent-payments-sdk
```

If the package doesn't exist or has a different name, implement a stub that:
- Creates invoices with memo + time window
- Returns unsigned transaction instructions (SOL transfer to agent wallet)
- Verifies payment by checking tx signature on-chain via SolanaService
- Logs to `payment_invoices` table

- [ ] **Step 1: Verify SDK package**

```bash
cd C:/Users/footb/neo-trader && npm info @pump-fun/agent-payments-sdk 2>&1 | head -20
```

If the package exists, install it:
```bash
cd C:/Users/footb/neo-trader && npm install @pump-fun/agent-payments-sdk
```

If not, proceed with the stub implementation. Either way, ensure the dependency is in `package.json` (add manually if using stub).

- [ ] **Step 2: Write the failing test**

```typescript
// src/__tests__/PaymentService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("PaymentService", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.AGENT_TOKEN_MINT = "testMint123";
    process.env.NEO_CHAT_PRICE = "5000000";
    process.env.NEO_EVAL_PRICE = "10000000";
    process.env.NEO_FEED_PRICE = "20000000";
  });

  it("returns correct prices for each service", async () => {
    const { PaymentService } = await import("../services/PaymentService.js");
    const service = new PaymentService();
    const prices = service.getPrices();
    expect(prices.chat).toBe(5000000);
    expect(prices.eval).toBe(10000000);
    expect(prices.feed).toBe(20000000);
  });

  it("creates invoice with unique memo and time window", async () => {
    const { PaymentService } = await import("../services/PaymentService.js");
    const service = new PaymentService();
    const invoice = await service.createInvoice("walletAddr", "chat");
    expect(invoice.memo).toBeDefined();
    expect(invoice.memo.length).toBeGreaterThan(0);
    expect(invoice.startTime).toBeLessThanOrEqual(Date.now());
    expect(invoice.endTime).toBeGreaterThan(invoice.startTime);
    expect(invoice.amountLamports).toBe(5000000);
  });

  it("creates invoices with unique memos", async () => {
    const { PaymentService } = await import("../services/PaymentService.js");
    const service = new PaymentService();
    const inv1 = await service.createInvoice("wallet1", "chat");
    const inv2 = await service.createInvoice("wallet2", "chat");
    expect(inv1.memo).not.toBe(inv2.memo);
  });

  it("isConfigured returns false without AGENT_TOKEN_MINT", async () => {
    delete process.env.AGENT_TOKEN_MINT;
    const { PaymentService } = await import("../services/PaymentService.js");
    const service = new PaymentService();
    expect(service.isConfigured()).toBe(false);
  });
});
```

- [ ] **Step 3: Implement PaymentService**

Key design:
- If `@pump-fun/agent-payments-sdk` is available, use `PumpAgent.buildAcceptPaymentInstructions()` and `validateInvoicePayment()`
- If not, implement manual invoice creation: unique memo (random 8-char hex), time window (24h), SOL amount per service type
- `createInvoice(walletAddress, service)` → `{ id, memo, startTime, endTime, amountLamports, transaction? }`
- `verifyPayment(invoiceId, txSignature)` → `{ verified: boolean }`
- Invoice persistence requires DB — return 503 if no DB
- `getPrices()` returns `{ chat, eval, feed }` lamport amounts
- `isConfigured()` checks `AGENT_TOKEN_MINT` is set

- [ ] **Step 4: Run tests**

```bash
cd C:/Users/footb/neo-trader && npx vitest run src/__tests__/PaymentService.test.ts
```

- [ ] **Step 5: Commit**

```bash
cd C:/Users/footb/neo-trader && git add src/services/PaymentService.ts src/__tests__/PaymentService.test.ts
git commit -m "feat: PaymentService — pump.fun agent payments for paid services"
```

---

## Chunk 6: Routes

### Task 12: Trading Routes (neo.ts)

**Files:**
- Create: `C:\Users\footb\neo-trader\src\routes\neo.ts`

**Reference:** `eliza-agents/src/routes/ghost.ts`

- [ ] **Step 1: Extract and rename routes**

Copy `ghost.ts` → `neo.ts`. Apply:
1. Rename `GHOST_ADMIN_KEY` → `NEO_ADMIN_KEY`, header `x-ghost-admin-key` → `x-neo-admin-key`
2. Replace `getGhostTrader()` → `getNeoTrader()`
3. Remove HeliusService, CopyTraderService imports (not extracted)
4. Remove study-wallet, copy-trader, wallet-analysis routes
5. Keep: status, positions, positions/open, learning, enable, disable, config, evaluate, check-positions, learning/reset
6. Remove Bags-specific response fields

Routes:
- `GET /learning` — public
- `GET /status` — public
- `GET /positions` — public
- `GET /positions/open` — public
- `POST /enable` — admin (requires confirmation phrase)
- `POST /disable` — admin
- `POST /config` — admin
- `POST /evaluate` — admin
- `POST /check-positions` — admin
- `POST /learning/reset` — admin
- `POST /positions/:id/mark-closed` — admin

- [ ] **Step 2: Type check**

```bash
cd C:/Users/footb/neo-trader && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd C:/Users/footb/neo-trader && git add src/routes/neo.ts
git commit -m "feat: trading routes — /api/neo/* endpoints"
```

---

### Task 13: Chat Routes

**Files:**
- Create: `C:\Users\footb\neo-trader\src\routes\chat.ts`

- [ ] **Step 1: Implement chat route**

```typescript
// src/routes/chat.ts
import { Router, Request, Response } from "express";
import { getChatService } from "../services/ChatService.js";
import { getPaymentService } from "../services/PaymentService.js";

const router = Router();

// POST /api/chat — chat with Neo
router.post("/", async (req: Request, res: Response) => {
  try {
    const { message, sessionId, walletAddress } = req.body;

    if (!message || typeof message !== "string") {
      res.status(400).json({ success: false, error: "message is required" });
      return;
    }

    if (!walletAddress || typeof walletAddress !== "string") {
      res.status(400).json({ success: false, error: "walletAddress is required" });
      return;
    }

    // Payment verification: check if wallet has a verified invoice for "chat" service
    // If PaymentService is configured, require payment. If not configured, allow free access.
    const paymentService = getPaymentService();
    if (paymentService.isConfigured()) {
      const hasAccess = await paymentService.hasVerifiedAccess(walletAddress, "chat");
      if (!hasAccess) {
        res.status(402).json({ success: false, error: "Payment required. Create an invoice first." });
        return;
      }
    }

    const chatService = getChatService();
    const result = await chatService.chat(message, sessionId);

    res.json({
      success: true,
      response: result.response,
      sessionId: result.sessionId,
    });
  } catch (error) {
    console.error("[ChatRoute] Error:", error);
    res.status(500).json({ success: false, error: "Chat service error" });
  }
});

export default router;
```

The chat route checks payment access via `PaymentService.hasVerifiedAccess(walletAddress, service)` — returns true if wallet has a verified invoice within the last 24h for that service type. If PaymentService is not configured (no `AGENT_TOKEN_MINT`), chat is free.

- [ ] **Step 2: Commit**

```bash
cd C:/Users/footb/neo-trader && git add src/routes/chat.ts
git commit -m "feat: chat route — POST /api/chat with Neo"
```

---

### Task 14: Payment Routes

**Files:**
- Create: `C:\Users\footb\neo-trader\src\routes\payments.ts`

- [ ] **Step 1: Implement payment routes**

```typescript
// src/routes/payments.ts
import { Router, Request, Response } from "express";
import { getPaymentService } from "../services/PaymentService.js";

const router = Router();

// POST /api/payments/create-invoice
router.post("/create-invoice", async (req: Request, res: Response) => {
  try {
    const { walletAddress, service } = req.body;

    if (!walletAddress || !service) {
      res.status(400).json({ success: false, error: "walletAddress and service are required" });
      return;
    }

    if (!["chat", "eval", "feed"].includes(service)) {
      res.status(400).json({ success: false, error: "service must be chat, eval, or feed" });
      return;
    }

    const paymentService = getPaymentService();
    if (!paymentService.isConfigured()) {
      res.status(503).json({ success: false, error: "Payment service not configured" });
      return;
    }

    const invoice = await paymentService.createInvoice(walletAddress, service);
    res.json({ success: true, invoice });
  } catch (error) {
    console.error("[PaymentsRoute] create-invoice error:", error);
    res.status(500).json({ success: false, error: "Failed to create invoice" });
  }
});

// POST /api/payments/verify
router.post("/verify", async (req: Request, res: Response) => {
  try {
    const { invoiceId, txSignature } = req.body;

    if (!invoiceId || !txSignature) {
      res.status(400).json({ success: false, error: "invoiceId and txSignature are required" });
      return;
    }

    const paymentService = getPaymentService();
    const result = await paymentService.verifyPayment(invoiceId, txSignature);
    res.json({ success: true, verified: result.verified });
  } catch (error) {
    console.error("[PaymentsRoute] verify error:", error);
    res.status(500).json({ success: false, error: "Verification failed" });
  }
});

// GET /api/payments/prices
router.get("/prices", (_req: Request, res: Response) => {
  const paymentService = getPaymentService();
  res.json({ success: true, prices: paymentService.getPrices() });
});

export default router;
```

- [ ] **Step 2: Commit**

```bash
cd C:/Users/footb/neo-trader && git add src/routes/payments.ts
git commit -m "feat: payment routes — create-invoice, verify, prices"
```

---

## Chunk 7: Server + Integration

### Task 15: Express Server with Autonomous Scheduler

**Files:**
- Create: `C:\Users\footb\neo-trader\src\server.ts`

**Reference:** `eliza-agents/src/server.ts` (initialization pattern)

- [ ] **Step 1: Implement server.ts**

```typescript
// src/server.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { initDatabase, initializeSchema, getDatabase } from "./db.js";

// Import services
import { getNeoTrader } from "./services/NeoTrader.js";
import { getSolanaService } from "./services/SolanaService.js";
import { getSmartMoneyService } from "./services/SmartMoneyService.js";
import { getProfitSplitter } from "./services/ProfitSplitter.js";
import { getChatService } from "./services/ChatService.js";

// Import routes
import neoRoutes from "./routes/neo.js";
import chatRoutes from "./routes/chat.js";
import paymentRoutes from "./routes/payments.js";

const PORT = parseInt(process.env.PORT || "3001", 10);
const HOST = process.env.HOST || "0.0.0.0";
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(",") || ["http://localhost:3000"];

// Database
const db = initDatabase();

// Express app
const app = express();

app.use(cors({ origin: CORS_ORIGINS }));
app.use(express.json());

// Rate limiting
const generalLimiter = rateLimit({ windowMs: 60_000, max: 100 });
const chatLimiter = rateLimit({ windowMs: 60_000, max: 20 });
const tradingLimiter = rateLimit({ windowMs: 60_000, max: 60 });
const paymentLimiter = rateLimit({ windowMs: 60_000, max: 30 });

// Health check
app.get("/health", (_req, res) => {
  const trader = getNeoTrader();
  res.json({
    status: "ok",
    service: "neo-trader",
    timestamp: new Date().toISOString(),
    db: !!db,
    wallet: getSolanaService().isConfigured(),
    trading: trader.getConfig().enabled,
    openPositions: trader.getOpenPositions().length,
  });
});

// Mount routes
app.use("/api/neo", tradingLimiter, neoRoutes);
app.use("/api/chat", chatLimiter, chatRoutes);
app.use("/api/payments", paymentLimiter, paymentRoutes);

// Startup
async function start() {
  console.log("=== NEO TRADER ===");
  console.log("the code never lies. i see the chain.");
  console.log("");

  // Initialize database schema
  await initializeSchema();

  // Initialize services
  const solana = getSolanaService();
  await solana.initialize();
  console.log(`[SolanaService] Wallet: ${solana.isConfigured() ? solana.getPublicKey()?.slice(0, 8) + "..." : "NOT configured"}`);

  const smartMoney = getSmartMoneyService();
  console.log(`[SmartMoneyService] Tracking ${smartMoney.getAllWallets().length} wallets`);

  const trader = getNeoTrader();
  // Pass db reference to trader for initialization
  await trader.initialize(db);
  console.log(`[NeoTrader] Trading: ${trader.getConfig().enabled ? "ENABLED" : "DISABLED"}`);

  const splitter = getProfitSplitter();
  console.log(`[ProfitSplitter] Configured: ${splitter.isConfigured()}`);

  // Start autonomous loops
  // Evaluate new launches every 5 minutes
  setInterval(async () => {
    try {
      await trader.evaluateLaunches();
    } catch (err) {
      console.error("[Scheduler] evaluateLaunches error:", err);
    }
  }, 5 * 60 * 1000);

  // Check open positions every 60 seconds
  setInterval(async () => {
    try {
      await trader.checkPositions();
    } catch (err) {
      console.error("[Scheduler] checkPositions error:", err);
    }
  }, 60 * 1000);

  // Cleanup stale data every 10 minutes
  setInterval(() => {
    smartMoney.cleanup();
    getChatService().cleanupSessions();
  }, 10 * 60 * 1000);

  // Start server
  app.listen(PORT, HOST, () => {
    console.log(`\n[Server] Neo Trader listening on ${HOST}:${PORT}`);
    console.log(`[Server] Health: http://localhost:${PORT}/health`);
    console.log(`[Server] Trading: http://localhost:${PORT}/api/neo/status`);
  });
}

start().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Type check the entire project**

```bash
cd C:/Users/footb/neo-trader && npx tsc --noEmit
```

Fix any remaining type errors across all files.

- [ ] **Step 3: Run all tests**

```bash
cd C:/Users/footb/neo-trader && npx vitest run
```

Fix any failing tests.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/footb/neo-trader && git add src/server.ts
git commit -m "feat: Express server with autonomous trading scheduler"
```

---

### Task 16: Final Integration Check

- [ ] **Step 1: Run full type check**

```bash
cd C:/Users/footb/neo-trader && npx tsc --noEmit
```

- [ ] **Step 2: Run all tests**

```bash
cd C:/Users/footb/neo-trader && npx vitest run
```

- [ ] **Step 3: Verify dev server starts**

```bash
cd C:/Users/footb/neo-trader && timeout 10 npx tsx src/server.ts 2>&1 || true
```

Expected: Server starts, prints initialization messages, no crashes. Will warn about missing env vars (expected).

- [ ] **Step 4: Verify .env.example is complete**

Cross-check `.env.example` against all `process.env.*` references in the codebase.

- [ ] **Step 5: Final commit**

```bash
cd C:/Users/footb/neo-trader && git add -A
git commit -m "chore: integration check — all types pass, tests pass"
```

---

### Task 16b: Route Integration Tests

**Files:**
- Create: `C:\Users\footb\neo-trader\src\__tests__\routes.test.ts`

- [ ] **Step 1: Write payment flow integration test**

```typescript
// src/__tests__/routes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Payment flow integration", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.AGENT_TOKEN_MINT = "testMint";
    process.env.NEO_CHAT_PRICE = "5000000";
  });

  it("create-invoice returns invoice with unique memo", async () => {
    const { PaymentService } = await import("../services/PaymentService.js");
    const service = new PaymentService();

    const inv1 = await service.createInvoice("wallet1", "chat");
    const inv2 = await service.createInvoice("wallet1", "chat");

    expect(inv1.id).toBeDefined();
    expect(inv2.id).toBeDefined();
    expect(inv1.memo).not.toBe(inv2.memo);
    expect(inv1.amountLamports).toBe(5000000);
  });

  it("verify rejects unknown invoice ID", async () => {
    const { PaymentService } = await import("../services/PaymentService.js");
    const service = new PaymentService();

    const result = await service.verifyPayment("nonexistent-id", "fakeSig");
    expect(result.verified).toBe(false);
  });
});
```

- [ ] **Step 2: Run test**

```bash
cd C:/Users/footb/neo-trader && npx vitest run src/__tests__/routes.test.ts
```

- [ ] **Step 3: Commit**

```bash
cd C:/Users/footb/neo-trader && git add src/__tests__/routes.test.ts
git commit -m "test: route-level integration tests for payment flow"
```

---

## Task Dependency Graph

```
Task 1 (scaffold)
  ├── Task 2 (types)
  │     ├── Task 3 (character)
  │     └── Task 3b (db.ts)
  ├── Task 4 (SolanaService)
  │     └── Task 7 (ProfitSplitter) ──┐
  ├── Task 5 (SmartMoneyService)      │
  ├── Task 6 (DexScreenerService)     │
  │                                    ├── Task 9 (NeoTrader) ──┬── Task 12 (neo routes)
  ├── Task 8 (TelegramBroadcaster) ──┘                         │
  │                                                              └── Task 10 (ChatService) → Task 13 (chat route)
  ├── Task 11 (PaymentService) ─────────── Task 14 (payment routes)
  └── Task 15 (server.ts) ← depends on all services + routes
       ├── Task 16 (integration check)
       └── Task 16b (route integration tests)
```

**Parallelizable tasks (after Task 1-2-3b):**
- Tasks 4, 5, 6, 8 can run in parallel (independent services, no cross-dependencies)
- Task 11 (PaymentService) can run in parallel with Tasks 4-9 (independent)
- Tasks 12, 14 can run in parallel (independent routes)
- Task 10 (ChatService) depends on Task 9 (NeoTrader) — NOT parallelizable with Task 9
- Task 13 (chat route) depends on Tasks 10 + 11 (payment gating)
