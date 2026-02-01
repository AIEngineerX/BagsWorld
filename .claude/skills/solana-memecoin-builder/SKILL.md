---
name: solana-memecoin-builder
description: Build production-ready Solana memecoin websites with Phantom wallet integration, on-chain data, and modern UI. Use when building memecoin launch pages, token dashboards, wallet-connected frontends, or any Solana web app requiring wallet connect, token data display, holder analytics, or trading interfaces. Triggers on requests involving Phantom, Solana tokens, memecoin websites, pump.fun, Bags.fm, DexScreener integration, or SPL token frontends. Deploys to Netlify.
---

# Solana Memecoin Builder

Build production-ready Solana memecoin websites from concept to deployment.

## Workflow

### 1. Gather Requirements

Extract from user's idea:

- Core functionality (launch page, dashboard, utility, game)
- Data needs (price, volume, holders, transactions)
- Wallet interactions (connect only, sign, transact)
- Visual style preferences

### 2. Architecture Decision

**Static Site (HTML/CSS/JS)** — Use when:

- Single page, no routing needed
- Simple wallet connect + data display
- Maximum performance, minimal complexity

**React/Vite SPA** — Use when:

- Multiple pages/views
- Complex state management
- Heavy interactivity or real-time updates

### 3. Implementation Order

1. Project scaffold with wallet adapter setup
2. Core UI layout and styling
3. Wallet connection flow
4. API integrations (price, holders, etc.)
5. Interactive features
6. Security audit against checklist
7. Netlify deployment config

## Core Patterns

### Wallet Connection (Phantom)

```javascript
// Check and connect
const getProvider = () => {
  if ("phantom" in window) {
    const provider = window.phantom?.solana;
    if (provider?.isPhantom) return provider;
  }
  window.open("https://phantom.app/", "_blank");
};

const connect = async () => {
  const provider = getProvider();
  const { publicKey } = await provider.connect();
  return publicKey.toString();
};

// Disconnect
const disconnect = async () => {
  const provider = getProvider();
  await provider.disconnect();
};
```

### Read Token Balance

```javascript
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";

const getTokenBalance = async (walletAddress, tokenMint) => {
  const connection = new Connection("https://api.mainnet-beta.solana.com");
  const wallet = new PublicKey(walletAddress);
  const mint = new PublicKey(tokenMint);

  const ata = await getAssociatedTokenAddress(mint, wallet);
  try {
    const account = await getAccount(connection, ata);
    return Number(account.amount);
  } catch {
    return 0; // No token account exists
  }
};
```

### DexScreener API (Primary Data Source)

```javascript
// Token data by address
const getTokenData = async (tokenAddress) => {
  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
  const data = await res.json();
  return data.pairs?.[0]; // Most liquid pair
};

// Returns: priceUsd, priceChange.h24, volume.h24, liquidity.usd, fdv, etc.
```

### PumpPortal WebSocket (Pump.fun Data)

```javascript
const ws = new WebSocket("wss://pumpportal.fun/api/data");

ws.onopen = () => {
  // Subscribe to token trades
  ws.send(
    JSON.stringify({
      method: "subscribeTokenTrade",
      keys: ["TOKEN_MINT_ADDRESS"],
    })
  );
};

ws.onmessage = (event) => {
  const trade = JSON.parse(event.data);
  // { signature, mint, traderPublicKey, tokenAmount, solAmount, isBuy, timestamp }
};
```

## File Structure

### Static Site

```
project/
├── index.html
├── styles.css
├── app.js
├── netlify.toml
└── assets/
```

### React/Vite

```
project/
├── index.html
├── vite.config.js
├── package.json
├── netlify.toml
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── components/
│   ├── hooks/
│   │   └── useWallet.js
│   └── utils/
│       └── api.js
└── public/
    └── assets/
```

## Security Rules (Mandatory)

Before any deployment, verify ALL items:

1. **No private keys in frontend** — Ever. Period.
2. **No hardcoded RPC endpoints with API keys** — Use env vars or public RPC
3. **Validate all user inputs** — Wallet addresses, amounts, token mints
4. **No auto-signing** — Always show user what they're signing
5. **CSP headers configured** — Prevent XSS
6. **HTTPS only** — Enforced via Netlify
7. **No localStorage for sensitive data** — Session only if needed
8. **Rate limit API calls** — Prevent abuse
9. **Sanitize displayed data** — Token names can contain malicious content

See `references/security-checklist.md` for full audit checklist.

## Reference Files

- `references/phantom-integration.md` — Full wallet flow patterns
- `references/solana-fundamentals.md` — Accounts, SPL tokens, transactions
- `references/api-reference.md` — DexScreener, PumpPortal, Bags SDK
- `references/security-checklist.md` — Pre-deploy security audit
- `references/netlify-deployment.md` — Deploy config and env setup
