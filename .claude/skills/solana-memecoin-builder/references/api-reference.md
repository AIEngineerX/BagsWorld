# API Reference

Data APIs for Solana memecoin applications.

## DexScreener (Primary)

Free, no auth required. Best for price, volume, liquidity data.

### Base URL
```
https://api.dexscreener.com
```

### Get Token Data
```javascript
const getTokenData = async (tokenAddress) => {
  const res = await fetch(
    `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`
  );
  const data = await res.json();
  return data.pairs?.[0]; // Returns most liquid pair
};

// Response shape
{
  chainId: 'solana',
  dexId: 'raydium',
  pairAddress: '...',
  baseToken: { address, name, symbol },
  quoteToken: { address, name, symbol },
  priceNative: '0.00001234',
  priceUsd: '0.00234',
  txns: {
    h24: { buys: 1234, sells: 567 },
    h6: { buys: 234, sells: 123 },
    h1: { buys: 45, sells: 23 },
    m5: { buys: 5, sells: 3 }
  },
  volume: { h24: 123456, h6: 23456, h1: 3456, m5: 456 },
  priceChange: { h24: 12.5, h6: 3.2, h1: 1.1, m5: 0.3 },
  liquidity: { usd: 50000, base: 1000000, quote: 25 },
  fdv: 1000000,
  marketCap: 800000,
  info: { imageUrl, websites, socials }
}
```

### Search Tokens
```javascript
const searchTokens = async (query) => {
  const res = await fetch(
    `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`
  );
  const data = await res.json();
  return data.pairs;
};
```

### Get Multiple Tokens
```javascript
const getMultipleTokens = async (addresses) => {
  // Max 30 addresses per request
  const res = await fetch(
    `https://api.dexscreener.com/latest/dex/tokens/${addresses.join(',')}`
  );
  const data = await res.json();
  return data.pairs;
};
```

### Rate Limits
- 300 requests per minute
- No auth required

---

## PumpPortal (Pump.fun Data)

Free WebSocket API for real-time pump.fun data. Trading API has 0.5% fee.

### WebSocket Connection
```javascript
const connectPumpPortal = (onMessage) => {
  const ws = new WebSocket('wss://pumpportal.fun/api/data');
  
  ws.onopen = () => console.log('PumpPortal connected');
  ws.onmessage = (event) => onMessage(JSON.parse(event.data));
  ws.onerror = (err) => console.error('PumpPortal error:', err);
  ws.onclose = () => {
    console.log('PumpPortal disconnected, reconnecting...');
    setTimeout(() => connectPumpPortal(onMessage), 3000);
  };
  
  return ws;
};
```

### Subscribe to New Tokens
```javascript
ws.send(JSON.stringify({
  method: 'subscribeNewToken'
}));

// Response
{
  signature: '...',
  mint: 'TOKEN_MINT_ADDRESS',
  traderPublicKey: 'CREATOR_ADDRESS',
  initialBuy: 1000000,
  bondingCurveKey: '...',
  name: 'Token Name',
  symbol: 'TKN',
  uri: 'https://...'
}
```

### Subscribe to Token Trades
```javascript
ws.send(JSON.stringify({
  method: 'subscribeTokenTrade',
  keys: ['TOKEN_MINT_1', 'TOKEN_MINT_2']
}));

// Response
{
  signature: '...',
  mint: 'TOKEN_MINT',
  traderPublicKey: 'TRADER_ADDRESS',
  tokenAmount: 1000000,
  solAmount: 100000000, // lamports
  isBuy: true,
  timestamp: 1699999999
}
```

### Subscribe to Account Trades
```javascript
ws.send(JSON.stringify({
  method: 'subscribeAccountTrade',
  keys: ['WALLET_ADDRESS_1', 'WALLET_ADDRESS_2']
}));
```

### Unsubscribe
```javascript
ws.send(JSON.stringify({
  method: 'unsubscribeNewToken'
}));

ws.send(JSON.stringify({
  method: 'unsubscribeTokenTrade',
  keys: ['TOKEN_MINT']
}));
```

---

## Bags.fm SDK

Official SDK for Bags.fm launchpad integration. Requires API key from `dev.bags.fm`.

### Installation
```bash
npm install @bagsfm/bags-sdk @solana/web3.js
```

### Setup
```javascript
import { BagsSDK } from '@bagsfm/bags-sdk';
import { Connection, PublicKey } from '@solana/web3.js';

const connection = new Connection('https://api.mainnet-beta.solana.com');
const sdk = new BagsSDK(
  process.env.BAGS_API_KEY,
  connection,
  'processed'
);
```

### Get Token Creators
```javascript
const getTokenCreators = async (mintAddress) => {
  const mint = new PublicKey(mintAddress);
  const creators = await sdk.state.getTokenCreators(mint);
  return creators;
};
```

### REST API (Alternative)
```javascript
const bagsApiCall = async (endpoint) => {
  const res = await fetch(`https://public-api-v2.bags.fm/api/v1/${endpoint}`, {
    headers: {
      'x-api-key': process.env.BAGS_API_KEY
    }
  });
  return res.json();
};
```

### Rate Limits
- Varies by endpoint
- Implement exponential backoff

---

## Utility Functions

### Price Formatting
```javascript
const formatPrice = (price) => {
  const num = parseFloat(price);
  if (num < 0.00001) return num.toExponential(2);
  if (num < 0.01) return num.toFixed(6);
  if (num < 1) return num.toFixed(4);
  if (num < 1000) return num.toFixed(2);
  return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
};
```

### Volume Formatting
```javascript
const formatVolume = (volume) => {
  if (volume >= 1e9) return `$${(volume / 1e9).toFixed(2)}B`;
  if (volume >= 1e6) return `$${(volume / 1e6).toFixed(2)}M`;
  if (volume >= 1e3) return `$${(volume / 1e3).toFixed(2)}K`;
  return `$${volume.toFixed(2)}`;
};
```

### Percentage Change
```javascript
const formatChange = (change) => {
  const num = parseFloat(change);
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
};

const getChangeColor = (change) => {
  return parseFloat(change) >= 0 ? '#00ff88' : '#ff4444';
};
```

### Polling Pattern
```javascript
const createPoller = (fetchFn, intervalMs = 10000) => {
  let timer = null;
  let subscribers = [];

  const poll = async () => {
    try {
      const data = await fetchFn();
      subscribers.forEach(cb => cb(data));
    } catch (err) {
      console.error('Poll error:', err);
    }
  };

  return {
    subscribe: (callback) => {
      subscribers.push(callback);
      if (!timer) {
        poll(); // Initial fetch
        timer = setInterval(poll, intervalMs);
      }
      return () => {
        subscribers = subscribers.filter(cb => cb !== callback);
        if (subscribers.length === 0) {
          clearInterval(timer);
          timer = null;
        }
      };
    }
  };
};

// Usage
const pricePoller = createPoller(() => getTokenData(TOKEN_ADDRESS), 15000);
const unsubscribe = pricePoller.subscribe((data) => {
  console.log('New price:', data.priceUsd);
});
```

---

## Combined Data Fetching

```javascript
const getFullTokenData = async (tokenAddress) => {
  const [dexData, holders] = await Promise.all([
    getTokenData(tokenAddress),
    getTopHolders(tokenAddress)
  ]);

  return {
    price: dexData?.priceUsd,
    priceChange24h: dexData?.priceChange?.h24,
    volume24h: dexData?.volume?.h24,
    liquidity: dexData?.liquidity?.usd,
    marketCap: dexData?.marketCap,
    fdv: dexData?.fdv,
    buys24h: dexData?.txns?.h24?.buys,
    sells24h: dexData?.txns?.h24?.sells,
    topHolders: holders,
    image: dexData?.info?.imageUrl
  };
};
```
