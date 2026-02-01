# Perception Layer Patterns

## Browser Automation (Playwright)

```javascript
import { chromium } from "playwright";

class BrowserPerception {
  async init(headless = true) {
    this.browser = await chromium.launch({ headless });
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();
  }

  async navigate(url) {
    await this.page.goto(url, { waitUntil: "networkidle" });
    return this.page.url();
  }

  async getPageContent() {
    return {
      url: this.page.url(),
      title: await this.page.title(),
      text: await this.page.innerText("body"),
    };
  }

  async screenshot() {
    return await this.page.screenshot({ encoding: "base64" });
  }

  async waitForSelector(selector, timeout = 5000) {
    await this.page.waitForSelector(selector, { timeout });
  }

  async cleanup() {
    await this.browser?.close();
  }
}
```

## API Polling

```javascript
class APIPerception {
  constructor(baseUrl, headers = {}) {
    this.baseUrl = baseUrl;
    this.headers = headers;
  }

  async fetch(endpoint, options = {}) {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: { ...this.headers, ...options.headers },
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }

  async poll(endpoint, interval = 5000, callback) {
    const check = async () => {
      const data = await this.fetch(endpoint);
      callback(data);
    };
    check();
    return setInterval(check, interval);
  }
}
```

## WebSocket Real-time

```javascript
class WebSocketPerception {
  constructor(url) {
    this.url = url;
    this.handlers = new Map();
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const handler = this.handlers.get(data.type);
      if (handler) handler(data);
    };

    return new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
  }

  subscribe(type, handler) {
    this.handlers.set(type, handler);
  }

  send(data) {
    this.ws.send(JSON.stringify(data));
  }
}
```

## Solana Blockchain

```javascript
import { Connection, PublicKey } from "@solana/web3.js";

class SolanaPerception {
  constructor(rpc = "https://api.mainnet-beta.solana.com") {
    this.connection = new Connection(rpc);
  }

  async getBalance(address) {
    const pubkey = new PublicKey(address);
    return this.connection.getBalance(pubkey);
  }

  async getTokenAccounts(address) {
    const pubkey = new PublicKey(address);
    return this.connection.getParsedTokenAccountsByOwner(pubkey, {
      programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    });
  }

  subscribeToAccount(address, callback) {
    const pubkey = new PublicKey(address);
    return this.connection.onAccountChange(pubkey, callback);
  }
}
```

## DexScreener API (Price Data)

```javascript
const getDexScreenerData = async (tokenAddress) => {
  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
  const data = await res.json();
  const pair = data.pairs?.[0];

  return pair
    ? {
        price: pair.priceUsd,
        priceChange24h: pair.priceChange?.h24,
        volume24h: pair.volume?.h24,
        liquidity: pair.liquidity?.usd,
        fdv: pair.fdv,
        pairAddress: pair.pairAddress,
      }
    : null;
};
```
