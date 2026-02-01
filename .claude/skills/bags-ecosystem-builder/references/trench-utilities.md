# Trench Utility Patterns

## New Token Scanner

Real-time monitoring of new token launches on pump.fun:

```javascript
class TokenScanner {
  constructor(filters = {}) {
    this.filters = filters;
    this.ws = null;
    this.callbacks = [];
  }

  connect() {
    this.ws = new WebSocket("wss://pumpportal.fun/api/data");

    this.ws.onopen = () => {
      console.log("Scanner connected");
      this.ws.send(JSON.stringify({ method: "subscribeNewToken" }));
    };

    this.ws.onmessage = (event) => {
      const token = JSON.parse(event.data);
      if (this.passesFilters(token)) {
        this.callbacks.forEach((cb) => cb(token));
      }
    };

    this.ws.onerror = (e) => console.error("Scanner error:", e);
    this.ws.onclose = () => setTimeout(() => this.connect(), 5000);
  }

  passesFilters(token) {
    const { minLiquidity, maxSupply, nameContains, creatorNotIn } = this.filters;

    if (minLiquidity && token.liquidity < minLiquidity) return false;
    if (maxSupply && token.supply > maxSupply) return false;
    if (nameContains && !token.name.toLowerCase().includes(nameContains.toLowerCase()))
      return false;
    if (creatorNotIn && creatorNotIn.includes(token.creator)) return false;

    return true;
  }

  onToken(callback) {
    this.callbacks.push(callback);
  }

  disconnect() {
    this.ws?.close();
  }
}

// Usage
const scanner = new TokenScanner({
  minLiquidity: 1000,
  creatorNotIn: ["known_rugger_wallet_1", "known_rugger_wallet_2"],
});

scanner.onToken((token) => {
  console.log("New token:", token.name, token.mint);
  sendTelegramAlert(`🆕 ${token.name}\n${token.mint}\nLiq: $${token.liquidity}`);
});

scanner.connect();
```

## Whale Tracker

Monitor large holders and their movements:

```javascript
class WhaleTracker {
  constructor(tokenMint, threshold = 50000) {
    this.tokenMint = tokenMint;
    this.threshold = threshold;
    this.whales = new Map();
  }

  async loadWhales() {
    const holders = await this.fetchHolders();

    for (const holder of holders) {
      if (holder.balance >= this.threshold) {
        this.whales.set(holder.address, {
          balance: holder.balance,
          lastSeen: Date.now(),
        });
      }
    }

    return this.getWhaleList();
  }

  async fetchHolders() {
    // Use Helius or similar API
    const res = await fetch(`https://api.helius.xyz/v0/token-metadata?api-key=${HELIUS_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mintAccounts: [this.tokenMint] }),
    });
    return res.json();
  }

  getWhaleList() {
    return Array.from(this.whales.entries())
      .map(([address, data]) => ({ address, ...data }))
      .sort((a, b) => b.balance - a.balance);
  }

  async trackMovement(wallet) {
    const connection = new Connection(RPC_URL);

    return connection.onAccountChange(new PublicKey(wallet), async (accountInfo) => {
      const newBalance = await this.getBalance(wallet);
      const oldBalance = this.whales.get(wallet)?.balance || 0;

      if (newBalance !== oldBalance) {
        const change = newBalance - oldBalance;
        this.emit("whale_move", {
          wallet,
          oldBalance,
          newBalance,
          change,
          type: change > 0 ? "buy" : "sell",
        });
      }

      this.whales.set(wallet, { balance: newBalance, lastSeen: Date.now() });
    });
  }
}
```

## Trade Feed

Real-time trade monitoring:

```javascript
class TradeFeed {
  constructor(tokenMint) {
    this.tokenMint = tokenMint;
    this.ws = null;
  }

  connect() {
    this.ws = new WebSocket("wss://pumpportal.fun/api/data");

    this.ws.onopen = () => {
      this.ws.send(
        JSON.stringify({
          method: "subscribeTokenTrade",
          keys: [this.tokenMint],
        })
      );
    };

    this.ws.onmessage = (event) => {
      const trade = JSON.parse(event.data);
      this.handleTrade(trade);
    };
  }

  handleTrade(trade) {
    const { signature, traderPublicKey, tokenAmount, solAmount, isBuy, timestamp } = trade;

    // Format for display
    const formatted = {
      type: isBuy ? "BUY" : "SELL",
      amount: tokenAmount,
      sol: solAmount,
      trader: traderPublicKey.slice(0, 4) + "..." + traderPublicKey.slice(-4),
      time: new Date(timestamp).toLocaleTimeString(),
      txLink: `https://solscan.io/tx/${signature}`,
    };

    this.onTrade?.(formatted);
  }
}

// React component
function LiveTrades({ tokenMint }) {
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    const feed = new TradeFeed(tokenMint);

    feed.onTrade = (trade) => {
      setTrades((prev) => [trade, ...prev].slice(0, 50));
    };

    feed.connect();
    return () => feed.disconnect();
  }, [tokenMint]);

  return (
    <div className="trade-feed">
      {trades.map((trade, i) => (
        <div key={i} className={`trade ${trade.type.toLowerCase()}`}>
          <span className="type">{trade.type}</span>
          <span className="amount">{trade.amount.toLocaleString()}</span>
          <span className="sol">{trade.sol.toFixed(4)} SOL</span>
          <span className="trader">{trade.trader}</span>
          <a href={trade.txLink} target="_blank">
            🔗
          </a>
        </div>
      ))}
    </div>
  );
}
```

## Holder Distribution Chart

```javascript
async function getHolderDistribution(tokenMint) {
  const holders = await fetchAllHolders(tokenMint);
  const totalSupply = holders.reduce((sum, h) => sum + h.balance, 0);

  const brackets = [
    { label: "Dust (<100)", min: 0, max: 100 },
    { label: "Small (100-1k)", min: 100, max: 1000 },
    { label: "Medium (1k-10k)", min: 1000, max: 10000 },
    { label: "Large (10k-100k)", min: 10000, max: 100000 },
    { label: "Whale (100k+)", min: 100000, max: Infinity },
  ];

  return brackets.map((bracket) => {
    const holdersInBracket = holders.filter(
      (h) => h.balance >= bracket.min && h.balance < bracket.max
    );
    const totalInBracket = holdersInBracket.reduce((sum, h) => sum + h.balance, 0);

    return {
      label: bracket.label,
      count: holdersInBracket.length,
      totalBalance: totalInBracket,
      percentage: (totalInBracket / totalSupply) * 100,
    };
  });
}
```

## Telegram Alert Bot

```javascript
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendAlert(message, options = {}) {
  const { parseMode = "HTML", disablePreview = true } = options;

  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: message,
      parse_mode: parseMode,
      disable_web_page_preview: disablePreview,
    }),
  });
}

// Alert templates
const alerts = {
  newToken: (token) => `
🆕 <b>New Token</b>
Name: ${token.name}
CA: <code>${token.mint}</code>
Liq: $${token.liquidity.toLocaleString()}
<a href="https://pump.fun/${token.mint}">Pump</a> | <a href="https://dexscreener.com/solana/${token.mint}">DexS</a>
  `,

  whaleMove: (move) => `
🐋 <b>Whale ${move.type}</b>
${move.type === "buy" ? "🟢" : "🔴"} ${Math.abs(move.change).toLocaleString()} tokens
Wallet: <code>${move.wallet}</code>
New Balance: ${move.newBalance.toLocaleString()}
  `,

  priceAlert: (token, price, change) => `
💰 <b>Price Alert</b>
${token.name}: $${price.toFixed(8)}
${change >= 0 ? "📈" : "📉"} ${change.toFixed(2)}% (24h)
  `,
};
```
