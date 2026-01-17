# BagsWorld Development Notes

## Code Review Summary - Jan 17, 2026

### Recent Updates (5 commits)
- PokeCenter Hub modal with world stats and claim integration
- Building position stability via mint-based caching
- Duplicate name/symbol warnings in LaunchModal
- Treasury tooltip with accurate 5% ecosystem fee breakdown
- Dynamic day/night sky colors and star visibility
- Daytime sun appears during 6AM-6PM EST regardless of weather

### Wallet & Launch Security Audit

**Wallet Connection: PASS**
- Using latest Solana wallet-adapter packages (v0.15-0.19)
- Phantom + Solflare adapters configured correctly
- autoConnect enabled, proper provider nesting

**Token Launch Flow: PASS**
- Transactions signed client-side (keys never leave wallet)
- API key protected server-side only
- Input validation on required fields and BPS limits
- Uses modern VersionedTransaction format
- Preflight checks enabled, reasonable retry limits

**Protocol Versions: UP TO DATE**
- @solana/web3.js: 1.98.4
- Bags.fm API: v2 (public-api-v2.bags.fm)
- Wallet Adapter: 0.15-0.19 range

**Minor Recommendations:**
1. Add API rate limiting for production
2. Remove/gate console.log debug statements
3. Consider image size limits before base64 processing

**OWASP Status:** No vulnerabilities found (Injection, XSS, CSRF, Auth - all safe)

---

## Trading Terminal Tab Research - Jan 17, 2026

### Competitor Analysis

**Axiom (axiom.trade)** - Market Leader
- Y Combinator backed, $10M/month revenue
- ~400ms execution (next block on Solana)
- Features: Sniper mode, Buy/Sell on Migration, Limit Orders, Copy Trading
- MEV protection built-in, non-custodial (Turnkey wallets)
- Multi-chain expanding (Solana, Ethereum, Base, BNB)
- Fiat on-ramp via Coinbase (no KYC up to $500/week)

**Photon (photon-sol.tinyastro.io)** - Speed Focus
- Sub-0.3 second execution
- Data updates 5-10x faster than Dexscreener
- One-click buy/sell, multi-wallet support (up to 5)
- Smart-MEV toggles (Fast/Secure modes)
- Token safety checks (mint authority, LP burned, top holders)
- 1% fee per transaction

**Padre/Terminal (trade.padre.gg)** - Acquired by Pump.fun Oct 2025
- ~5% Solana bot market share
- Multi-chain: Solana, Ethereum, Base, BNB
- Trenches view for bonding curve tokens (Pump.fun, Four.Meme)
- Limit orders, trailing stop loss, buy dip, copy trading
- Now integrated into Pump.fun ecosystem

### BagsWorld Trading Terminal Proposal

**Location:** Top header bar (expandable panel below header)
**Style:** Pokemon/Game Boy aesthetic - pixel buttons, retro UI

**UI Concept (Pokemon-style):**

```
┌──────────────────────────────────────────────────────────────────────────┐
│ BAGSWORLD                    [TERMINAL ▼]              🎮 WALLET  LAUNCH │
├──────────────────────────────────────────────────────────────────────────┤
│ ╔════════════════════════════════════════════════════════════════════╗   │
│ ║  🔴 TRENDING        🟢 NEW PAIRS        🔵 QUICK TRADE             ║   │
│ ╠════════════════════════════════════════════════════════════════════╣   │
│ ║  ┌─────────────────────────────────────────────────────────────┐   ║   │
│ ║  │ $BAGS    ▲125%   MC:$2.1M   VOL:$500K   [A] BUY  [B] INFO │   ║   │
│ ║  │ $WORLD   ▲85%    MC:$890K   VOL:$120K   [A] BUY  [B] INFO │   ║   │
│ ║  │ $PIXEL   ▲42%    MC:$450K   VOL:$80K    [A] BUY  [B] INFO │   ║   │
│ ║  └─────────────────────────────────────────────────────────────┘   ║   │
│ ╠════════════════════════════════════════════════════════════════════╣   │
│ ║  QUICK BUY: [0.1�Pokemon Ball] [0.5] [1.0] [5.0] SOL               ║   │
│ ║  SLIPPAGE:  [1%] [5%] [10%] [AUTO]                                 ║   │
│ ╚════════════════════════════════════════════════════════════════════╝   │
└──────────────────────────────────────────────────────────────────────────┘
```

**Button Style Guide:**
- [A] BUY = Green pixel button (like Game Boy A button)
- [B] INFO = Red pixel button (like Game Boy B button)
- Tab buttons = Pokemon menu style (red/green/blue pokeballs)
- Amount buttons = Pixel art pokeball icons

**Key Features to Implement:**

1. **Live Pairs Feed**
   - WebSocket connection to Bags API or Jupiter
   - Safety indicators (LP burned, mint frozen, top holder %)
   - Age indicator (just launched, minutes, hours)

2. **Quick Trade Buttons**
   - Pre-set SOL amounts (0.1, 0.5, 1, 5)
   - Adjustable slippage presets
   - One-click execution using existing TradeModal logic

3. **Trending/Hot Tokens**
   - Pull from world buildings sorted by volume
   - Show 24h price change
   - Quick buy buttons inline

4. **Token Safety Checks** (like Photon)
   - Mint authority status
   - LP burn status
   - Top 10 holder concentration
   - Dev wallet activity

**Technical Implementation:**

```typescript
// New component: src/components/TradingTerminal.tsx
// Reuses: /api/trade endpoint, TradeModal logic
// New API: /api/terminal (created!)
// State: Add to Zustand store for selected pair
```

---

### Backend API (COMPLETED)

**Endpoint:** `/api/terminal`

**Actions:**

1. **trending** - Get trending tokens by volume
   ```bash
   # GET
   curl /api/terminal?action=trending&limit=10

   # POST
   curl -X POST /api/terminal -d '{"action":"trending","data":{"limit":10}}'
   ```
   Returns: `{ trending: TrendingToken[], total, limit, offset }`

2. **new-pairs** - Get newly launched tokens with safety scores
   ```bash
   curl /api/terminal?action=new-pairs&limit=10
   ```
   Returns: `{ pairs: NewPair[], total }`

3. **token-safety** - Get detailed safety check for a token
   ```bash
   curl /api/terminal?action=token-safety&mint=<TOKEN_MINT>
   ```
   Returns: `{ mint, safety: TokenSafety }`

4. **quick-quote** - Get quick trade quote
   ```bash
   curl -X POST /api/terminal -d '{
     "action":"quick-quote",
     "data":{"outputMint":"<TOKEN>","amountSol":1.0}
   }'
   ```
   Returns: `{ quote, inputAmount, inputSymbol }`

**Safety Check Features:**
- Mint authority status (can mint more tokens?)
- Freeze authority status (can freeze accounts?)
- Top 10 holder concentration %
- Rug risk assessment
- Warning messages array

**Types Added:** `src/lib/types.ts`
- `TrendingToken`
- `NewPair`
- `TokenSafety`

---

### Next Steps (Frontend)

1. Create `TradingTerminal.tsx` component
2. Add terminal toggle button to header
3. Implement Pokemon-style pixel buttons
4. Connect to `/api/terminal` endpoints
5. Add quick trade execution flow
