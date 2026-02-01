# Solana Plugin Reference

Blockchain integration patterns for elizaOS agents.

## Installation

```bash
bun add @elizaos/plugin-solana
```

## Character Configuration

```json
{
  "plugins": ["@elizaos/plugin-solana"],
  "settings": {
    "secrets": {
      "SOLANA_PRIVATE_KEY": "{{SOLANA_PRIVATE_KEY}}",
      "SOLANA_PUBLIC_KEY": "{{SOLANA_PUBLIC_KEY}}"
    }
  }
}
```

## Environment Variables

```bash
# Required
SOLANA_PRIVATE_KEY=your_base58_private_key
SOLANA_PUBLIC_KEY=your_public_key

# Optional
RPC_URL=https://api.mainnet-beta.solana.com
HELIUS_API_KEY=your_helius_key
```

## Built-in Actions

### Transfer SOL

```typescript
// Triggered by: "send 1 SOL to <address>"
// Action: SEND_SOL
```

### Transfer Tokens

```typescript
// Triggered by: "send 100 USDC to <address>"
// Action: SEND_TOKEN
```

### Swap Tokens

```typescript
// Triggered by: "swap 1 SOL for USDC"
// Action: SWAP_TOKENS
// Uses Jupiter aggregator
```

### Check Balance

```typescript
// Triggered by: "what's my balance?"
// Action: CHECK_BALANCE
```

## Built-in Providers

### Wallet Provider

Injects current wallet state into context:

```
Wallet Address: 7xKXtg...
SOL Balance: 5.234 SOL ($523.40)
Token Balances:
- USDC: 1,000 ($1,000)
- BONK: 5,000,000 ($50)
```

### Token Price Provider

Injects token prices when mentioned:

```
Token Prices:
- SOL: $100.00 (+5.2% 24h)
- BONK: $0.00001 (-2.1% 24h)
```

## Custom Solana Actions

```typescript
import { Action, IAgentRuntime } from "@elizaos/core";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";

const customSolanaAction: Action = {
  name: "STAKE_SOL",
  description: "Stake SOL with a validator",
  similes: ["stake", "delegate"],

  validate: async (runtime) => {
    return !!runtime.getSetting("SOLANA_PRIVATE_KEY");
  },

  handler: async (runtime, message, state, options, callback) => {
    const connection = new Connection(
      runtime.getSetting("RPC_URL") || "https://api.mainnet-beta.solana.com"
    );

    // Parse amount from message
    const amount = extractAmount(message.content.text);

    // Build staking transaction
    const tx = await buildStakeTransaction(connection, amount);

    // Sign and send
    const wallet = getWalletFromRuntime(runtime);
    const signature = await sendAndConfirmTransaction(connection, tx, [wallet]);

    callback?.({
      text: `Staked ${amount} SOL! Tx: ${signature}`,
      action: "STAKE_SOL",
    });

    return true;
  },

  examples: [
    [
      { user: "{{user1}}", content: { text: "stake 5 SOL" } },
      { user: "{{agentName}}", content: { text: "Staking 5 SOL...", action: "STAKE_SOL" } },
    ],
  ],
};
```

## Using Jupiter for Swaps

```typescript
import { Jupiter } from "@jup-ag/api";

async function executeSwap(
  connection: Connection,
  wallet: Keypair,
  inputMint: string,
  outputMint: string,
  amount: number
) {
  const jupiter = await Jupiter.load({ connection });

  const routes = await jupiter.computeRoutes({
    inputMint: new PublicKey(inputMint),
    outputMint: new PublicKey(outputMint),
    amount,
    slippageBps: 50, // 0.5%
  });

  const { execute } = await jupiter.exchange({
    routeInfo: routes.routesInfos[0],
  });

  const result = await execute();
  return result;
}
```

## Using Helius for Enhanced Data

```typescript
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

// Get token metadata
async function getTokenMetadata(mint: string) {
  const response = await fetch(
    `https://api.helius.xyz/v0/token-metadata?api-key=${HELIUS_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mintAccounts: [mint] }),
    }
  );
  return response.json();
}

// Get wallet token accounts
async function getWalletTokens(wallet: string) {
  const response = await fetch(
    `https://api.helius.xyz/v0/addresses/${wallet}/balances?api-key=${HELIUS_API_KEY}`
  );
  return response.json();
}

// Subscribe to transactions
function subscribeToWallet(wallet: string, callback: (tx: any) => void) {
  const ws = new WebSocket(`wss://atlas-mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`);

  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "transactionSubscribe",
        params: [{ accountInclude: [wallet] }, { commitment: "confirmed" }],
      })
    );
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.params?.result) {
      callback(data.params.result);
    }
  };

  return ws;
}
```

## Trust Engine

elizaOS includes a trust scoring system for trading:

```typescript
// Trust is built through:
// 1. Successful trades recommended by trusted wallets
// 2. Accurate market predictions
// 3. Community endorsements

// Access trust scores
const trustScore = await runtime.getTrustScore(walletAddress);

// Recommend based on trust
if (trustScore > 0.7) {
  // High trust - can recommend larger positions
} else if (trustScore > 0.3) {
  // Medium trust - recommend smaller positions
} else {
  // Low trust - be cautious
}
```

## Security Best Practices

1. **Never log private keys** — Use environment variables
2. **Simulate first** — Test transactions before sending
3. **Set limits** — Max transaction amounts per action
4. **Rate limit** — Prevent rapid-fire transactions
5. **Confirm large transactions** — Ask user before executing
6. **Use burner wallets** — For testing and small amounts

```typescript
// Good: Require confirmation for large amounts
if (amount > 1) {
  // > 1 SOL
  callback?.({
    text: `This will send ${amount} SOL ($${amount * solPrice}). Reply "confirm" to proceed.`,
    action: "CONFIRM_REQUIRED",
  });
  return false; // Wait for confirmation
}
```
