# Solana Fundamentals

Core concepts for building Solana web applications.

## Key Concepts

### Accounts

- Everything on Solana is an account (wallets, tokens, programs)
- Accounts hold SOL (for rent) and data
- Programs are stateless; state lives in accounts

### Addresses

- Base58-encoded 32-byte public keys
- Example: `7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU`

### Lamports

- 1 SOL = 1,000,000,000 lamports (10^9)
- Always work in lamports for precision

## Web3.js Setup

```javascript
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

// Public RPC (rate limited, use for dev/low traffic)
const connection = new Connection("https://api.mainnet-beta.solana.com");

// With commitment level
const connection = new Connection(
  "https://api.mainnet-beta.solana.com",
  "confirmed" // 'processed' | 'confirmed' | 'finalized'
);
```

## Common Operations

### Get SOL Balance

```javascript
const getBalance = async (address) => {
  const publicKey = new PublicKey(address);
  const balance = await connection.getBalance(publicKey);
  return balance / LAMPORTS_PER_SOL;
};
```

### Validate Address

```javascript
const isValidAddress = (address) => {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
};
```

### Get Account Info

```javascript
const getAccountInfo = async (address) => {
  const publicKey = new PublicKey(address);
  const info = await connection.getAccountInfo(publicKey);
  return info; // null if account doesn't exist
};
```

## SPL Tokens

### Dependencies

```bash
npm install @solana/spl-token
```

### Get Token Balance

```javascript
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";

const getTokenBalance = async (walletAddress, tokenMint, decimals = 9) => {
  const wallet = new PublicKey(walletAddress);
  const mint = new PublicKey(tokenMint);

  const ata = await getAssociatedTokenAddress(mint, wallet);

  try {
    const account = await getAccount(connection, ata);
    return Number(account.amount) / Math.pow(10, decimals);
  } catch (err) {
    if (err.name === "TokenAccountNotFoundError") {
      return 0;
    }
    throw err;
  }
};
```

### Get All Token Accounts

```javascript
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

const getAllTokens = async (walletAddress) => {
  const wallet = new PublicKey(walletAddress);

  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(wallet, {
    programId: TOKEN_PROGRAM_ID,
  });

  return tokenAccounts.value.map(({ account }) => ({
    mint: account.data.parsed.info.mint,
    balance: account.data.parsed.info.tokenAmount.uiAmount,
    decimals: account.data.parsed.info.tokenAmount.decimals,
  }));
};
```

### Get Token Metadata

```javascript
// Using Metaplex (for token name, symbol, image)
import { Metaplex } from "@metaplex-foundation/js";

const getTokenMetadata = async (mintAddress) => {
  const metaplex = Metaplex.make(connection);
  const mint = new PublicKey(mintAddress);

  try {
    const nft = await metaplex.nfts().findByMint({ mintAddress: mint });
    return {
      name: nft.name,
      symbol: nft.symbol,
      uri: nft.uri,
      image: nft.json?.image,
    };
  } catch {
    return null;
  }
};
```

## Transactions

### Build and Send Transaction

```javascript
import { Transaction, SystemProgram, sendAndConfirmTransaction } from "@solana/web3.js";

const sendSol = async (fromKeypair, toAddress, solAmount) => {
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: fromKeypair.publicKey,
      toPubkey: new PublicKey(toAddress),
      lamports: solAmount * LAMPORTS_PER_SOL,
    })
  );

  const signature = await sendAndConfirmTransaction(connection, transaction, [fromKeypair]);

  return signature;
};
```

### Transaction Status

```javascript
const getTransactionStatus = async (signature) => {
  const status = await connection.getSignatureStatus(signature);
  return status.value?.confirmationStatus; // 'processed' | 'confirmed' | 'finalized'
};

const waitForConfirmation = async (signature) => {
  const latestBlockhash = await connection.getLatestBlockhash();

  await connection.confirmTransaction({
    signature,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  });
};
```

## Token Holders (via RPC)

```javascript
// Get largest token holders
const getTopHolders = async (mintAddress, limit = 20) => {
  const mint = new PublicKey(mintAddress);

  const holders = await connection.getTokenLargestAccounts(mint);

  return holders.value.slice(0, limit).map((h) => ({
    address: h.address.toString(),
    amount: h.uiAmount,
  }));
};
```

## Rate Limiting & Best Practices

### Public RPC Limits

- ~100 requests per 10 seconds
- Use caching aggressively
- Batch requests where possible

### Caching Pattern

```javascript
const cache = new Map();

const cachedFetch = async (key, fetchFn, ttlMs = 30000) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttlMs) {
    return cached.data;
  }

  const data = await fetchFn();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
};

// Usage
const getPrice = () =>
  cachedFetch(
    `price-${tokenAddress}`,
    () => fetchPriceFromDexScreener(tokenAddress),
    10000 // 10 second cache
  );
```

### Batch Requests

```javascript
const getMultipleBalances = async (addresses) => {
  const publicKeys = addresses.map((a) => new PublicKey(a));
  const accountInfos = await connection.getMultipleAccountsInfo(publicKeys);

  return accountInfos.map((info, i) => ({
    address: addresses[i],
    balance: info ? info.lamports / LAMPORTS_PER_SOL : 0,
  }));
};
```

## Common Token Mints

```javascript
const TOKENS = {
  SOL: "So11111111111111111111111111111111111111112", // Wrapped SOL
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
};
```

## Error Handling

```javascript
const safeRpcCall = async (fn) => {
  try {
    return await fn();
  } catch (err) {
    if (err.message?.includes("429")) {
      // Rate limited - wait and retry
      await new Promise((r) => setTimeout(r, 1000));
      return fn();
    }
    if (err.message?.includes("503")) {
      // Service unavailable
      console.error("RPC unavailable");
      return null;
    }
    throw err;
  }
};
```
