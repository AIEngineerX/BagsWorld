---
name: bags-ecosystem-builder
description: Build CT-native products for the BAGS ecosystem on Solana. Use when building launchpad infrastructure, flywheel mechanics, holder-gated utilities, trench tools, or any product that integrates with Bags.fm. Triggers on "BAGS", "Bags.fm", "flywheel", "buy and burn", "holder gate", "trench utility", "CT tool", "degen app", or building products for the Bags ecosystem.
---

# BAGS Ecosystem Builder

Build CT-native products that fit the BAGS ecosystem meta.

## What Fits BAGS

Products that provide real utility to trenchers:
- **Launchpads/Flywheels** — Fee mechanisms that burn $BAGS
- **Trench Utilities** — Scanners, trackers, alpha tools
- **Holder-Gated Features** — Token-gate content, Discord, utilities
- **Social Tools** — CT engagement, raid coordination, community

## CT-Native Design Principles

1. **Fast** — No loading spinners, instant feedback
2. **Dark Mode** — Always. No light mode option needed
3. **Mobile-First** — Trenchers are on phones
4. **Degen-Friendly** — Speak the language, skip corporate feel
5. **Wallet-First** — Connect wallet is primary CTA
6. **Real-Time** — Live data, WebSocket updates

## Flywheel Mechanics

Core pattern: Fees → Buy $BAGS → Burn

```javascript
const BAGS_TOKEN = 'BAGSxQcgw5N1BHRdFvFLsSTQGKpPLonUd57g8hoUF2ep';
const FEE_WALLET = 'YOUR_FEE_WALLET';

async function registerWithFee(connection, payer, registrationData) {
  const feeAmount = 0.1 * LAMPORTS_PER_SOL; // 0.1 SOL fee
  
  // 1. Collect fee
  const feeIx = SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: new PublicKey(FEE_WALLET),
    lamports: feeAmount,
  });
  
  // 2. Backend: Use collected fees to buy $BAGS on Jupiter
  // 3. Backend: Burn purchased $BAGS
  
  return await sendTransaction(connection, [feeIx], payer);
}
```

See `references/flywheel-mechanics.md` for full patterns.

## Bags.fm SDK Integration

```javascript
const BAGS_API = 'https://api.bags.fm';

async function getBagsToken(mint) {
  const res = await fetch(`${BAGS_API}/token/${mint}`);
  return res.json();
}

async function getHolders(mint) {
  const res = await fetch(`${BAGS_API}/holders/${mint}`);
  return res.json();
}

async function getTrending() {
  const res = await fetch(`${BAGS_API}/trending`);
  return res.json();
}
```

See `references/bags-sdk.md` for full API reference.

## Holder Gating

Token-gate features based on $BAGS holdings:

```javascript
const MINIMUM_BAGS = 1000;

async function checkHolderAccess(walletAddress) {
  const connection = new Connection(RPC_URL);
  const wallet = new PublicKey(walletAddress);
  const mint = new PublicKey(BAGS_TOKEN);
  
  const ata = await getAssociatedTokenAddress(mint, wallet);
  
  try {
    const account = await getAccount(connection, ata);
    const balance = Number(account.amount) / 1e6;
    return balance >= MINIMUM_BAGS;
  } catch {
    return false;
  }
}

async function accessPremiumFeature(wallet) {
  const hasAccess = await checkHolderAccess(wallet);
  if (!hasAccess) {
    throw new Error(`Hold ${MINIMUM_BAGS}+ $BAGS to access`);
  }
}
```

See `references/holder-gating.md` for tiered access patterns.

## Trench Utility Patterns

### Whale Tracker

```javascript
async function trackWhales(tokenMint, threshold = 100000) {
  const holders = await getHolders(tokenMint);
  return holders
    .filter(h => h.balance >= threshold)
    .sort((a, b) => b.balance - a.balance);
}
```

### New Token Scanner

```javascript
const ws = new WebSocket('wss://pumpportal.fun/api/data');

ws.onopen = () => {
  ws.send(JSON.stringify({ method: 'subscribeNewToken' }));
};

ws.onmessage = (event) => {
  const token = JSON.parse(event.data);
  if (meetsYourCriteria(token)) {
    sendAlert(token);
  }
};
```

### Holder Analysis

```javascript
async function analyzeHolders(tokenMint) {
  const holders = await getHolders(tokenMint);
  
  return {
    total: holders.length,
    top10Pct: holders.slice(0, Math.ceil(holders.length * 0.1))
      .reduce((sum, h) => sum + h.balance, 0) / getTotalSupply(),
    whales: holders.filter(h => h.balance > 50000).length,
  };
}
```

## CT-Native UX

### Dark Theme Base

```css
:root {
  --bg-primary: #0a0a0a;
  --bg-secondary: #141414;
  --bg-card: #1a1a1a;
  --text-primary: #ffffff;
  --text-secondary: #888888;
  --accent: #00ff88;
  --danger: #ff4444;
}

body {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: 'Inter', -apple-system, sans-serif;
}
```

### Connect Wallet Button

```css
.connect-btn {
  background: linear-gradient(135deg, #00ff88 0%, #00cc6a 100%);
  border: none;
  border-radius: 12px;
  color: #000;
  font-weight: 600;
  padding: 14px 28px;
  cursor: pointer;
}

.connect-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 255, 136, 0.3);
}
```

## File Structure

```
project/
├── index.html
├── styles.css
├── app.js
├── utils/
│   ├── wallet.js
│   ├── bags-api.js
│   └── gates.js
├── netlify.toml
└── .env.example
```

## Deployment (Netlify)

```toml
[build]
  publish = "."

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    Content-Security-Policy = "default-src 'self'; connect-src 'self' https://*.solana.com wss://*.solana.com https://api.dexscreener.com https://api.bags.fm wss://pumpportal.fun;"
```

## Reference Files

- `references/bags-sdk.md` — Bags.fm API reference
- `references/flywheel-mechanics.md` — Fee routing, buy+burn
- `references/holder-gating.md` — Tiered access patterns
- `references/trench-utilities.md` — Scanner, tracker patterns
- `references/ct-ux-patterns.md` — CT-native UI/UX
