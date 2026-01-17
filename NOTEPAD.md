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

**Location Options:**
1. **Sidebar Tab** - Replace or add tab alongside Leaderboard (recommended)
2. **Dedicated Page** - /terminal route with full-screen trading
3. **Expandable Panel** - Slide-out from right side

**Proposed Features (MVP):**

```
┌─────────────────────────────────────┐
│ 📊 TERMINAL │ 🏆 LEADERBOARD │ 📰  │  ← Tab switcher
├─────────────────────────────────────┤
│ 🔥 TRENDING TOKENS                  │
│ ┌─────┬────────┬────────┬────────┐  │
│ │ #1  │ $BAGS  │ +125%  │ [BUY]  │  │
│ │ #2  │ $WORLD │ +85%   │ [BUY]  │  │
│ │ #3  │ $PIXEL │ +42%   │ [BUY]  │  │
│ └─────┴────────┴────────┴────────┘  │
├─────────────────────────────────────┤
│ 🆕 NEW PAIRS (Live)                 │
│ ┌─────────────────────────────────┐ │
│ │ $NEW │ 2s ago │ ✓Safe │ [SNIPE]│ │
│ │ $HOT │ 15s ago│ ⚠Dev  │ [VIEW] │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ ⚡ QUICK TRADE                      │
│ [0.1] [0.5] [1] [5] SOL            │
│ Slippage: [1%] [5%] [10%]          │
└─────────────────────────────────────┘
```

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
// New API: /api/live-pairs (WebSocket or polling)
// State: Add to Zustand store for selected pair
```

**Packages to Consider:**
- `@jup-ag/api` - Jupiter aggregator for best routes
- `socket.io-client` - Real-time pair updates
- Existing Bags API for token data

**Estimated Scope:** Medium (1-2 weeks for MVP)
