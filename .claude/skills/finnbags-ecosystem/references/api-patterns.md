# Bags.fm API Patterns

Complete code examples for common Bags.fm operations.

## Authentication

All requests require `x-api-key` header:

```typescript
const headers = { "x-api-key": process.env.BAGS_API_KEY };

// REST API call
const response = await fetch("https://public-api-v2.bags.fm/api/v1/endpoint", { headers });

// SDK initialization
import { BagsSDK } from "@bagsfm/bags-sdk";
import { Connection } from "@solana/web3.js";

const connection = new Connection(process.env.SOLANA_RPC_URL);
const sdk = new BagsSDK(process.env.BAGS_API_KEY, connection, "processed");
```

## Token Launch Flow

### Step 1: Create Token Info (Upload Metadata)

```typescript
const tokenInfo = {
  name: "My Token",
  symbol: "MTK",
  description: "Token description",
  image: "https://example.com/logo.png", // or upload file
  initialBuy: 0.1, // Optional: SOL to buy at launch
  feeShares: [{ wallet: "creator_wallet_address", percentage: 50 }],
};

const tokenInfoResponse = await sdk.tokenLaunch.createTokenInfo(tokenInfo);
// Returns: { tokenMint, tokenMetadata (IPFS URL) }
```

### Step 2: Create Fee Share Config

```typescript
const feeClaimers = [
  { provider: "twitter", username: "creatorhandle", royaltyBps: 10000 }, // 100%
];

const configKey = await sdk.tokenLaunch.createBagsFeeShareConfig(
  pair.publicKey,
  keypair,
  feeClaimers,
  partner, // optional
  partnerConfig // optional
);
```

### Step 3: Create & Sign Launch Transaction

```typescript
const launchTx = await sdk.tokenLaunch.createLaunchTransaction({
  metadataUrl: tokenInfoResponse.tokenMetadata,
  tokenMint: tokenMint,
  launchWallet: keypair.publicKey,
  initialBuyLamports: 100000000, // 0.1 SOL
  configKey: configKey,
});

const signature = await signAndSendTransaction(connection, "processed", launchTx, keypair);
```

## Get Token Creators

```typescript
async function getTokenCreators(tokenMint: string) {
  const creators = await sdk.state.getTokenCreators(new PublicKey(tokenMint));

  const primaryCreator = creators.find((c) => c.isCreator);

  return {
    displayName: primaryCreator.providerUsername,
    provider: primaryCreator.provider, // twitter, kick, github
    wallet: primaryCreator.wallet,
    royaltyBps: primaryCreator.royaltyBps, // 10000 = 100%
    pfp: primaryCreator.pfp,
  };
}
```

## Get Lifetime Fees

```typescript
async function getTokenLifetimeFees(tokenMint: string) {
  const response = await fetch(
    `https://public-api-v2.bags.fm/api/v1/token-launch/lifetime-fees?tokenMint=${tokenMint}`,
    { headers: { "x-api-key": BAGS_API_KEY } }
  );
  return response.json();
}
```

## Claim Fees

```typescript
// Get all claimable positions
const positions = await sdk.fee.getAllClaimablePositions(walletPublicKey);

// Claim from bonding curve positions
const bondingCurveClaims = positions.bondingCurve.filter((p) => p.claimableAmount > 0);
for (const position of bondingCurveClaims) {
  const tx = await sdk.fee.createClaimBondingCurveFeeTx(position);
  await signAndSendTransaction(connection, "processed", tx, keypair);
}

// Claim from graduated pool positions
const poolClaims = positions.pool.filter((p) => p.claimableAmount > 0);
for (const position of poolClaims) {
  const tx = await sdk.fee.createClaimPoolFeeTx(position);
  await signAndSendTransaction(connection, "processed", tx, keypair);
}
```

## Trading Tokens

```typescript
async function executeSwap(inputMint: PublicKey, outputMint: PublicKey, amount: number) {
  // Get quote
  const quote = await sdk.trade.getTradeQuote({
    inputMint,
    outputMint,
    amount,
    slippageMode: "auto", // or 'manual' with slippageBps
  });

  console.log(`Expected output: ${quote.expectedOutput}`);
  console.log(`Price impact: ${quote.priceImpact}%`);

  // Execute swap
  const swapTx = await sdk.trade.createSwapTransaction(quote, keypair.publicKey);
  const signature = await signAndSendTransaction(connection, "processed", swapTx, keypair);

  return signature;
}

// SOL mint address for buying tokens with SOL
const SOL_MINT = "So11111111111111111111111111111111111111112";
```

## Partner Integration

Partners can earn fees from tokens launched through their platform:

### Create Partner Key

```typescript
const partnerConfig = await sdk.partner.createPartnerConfig({
  partnerWallet: partnerKeypair.publicKey,
  partnerFeeBps: 500, // 5% of creator fees
});
```

### Include Partner in Token Launch

```typescript
const configKey = await sdk.tokenLaunch.createBagsFeeShareConfig(
  pair.publicKey,
  keypair,
  feeClaimers,
  partnerPublicKey, // Partner wallet
  partnerConfigKey // Partner config
);
```

### Claim Partner Fees

```typescript
const partnerStats = await sdk.partner.getPartnerStats(partnerPublicKey);
const claimTx = await sdk.partner.createPartnerClaimTransaction(partnerPublicKey);
```

## Bitquery Integration (Alternative)

For on-chain analytics without Bags API key:

### Track New Token Launches

```graphql
{
  Solana {
    Instructions(
      where: {
        Instruction: { Program: { Address: { is: "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN" } } }
        Transaction: { Signer: { is: "BAGSB9TpGrZxQbEsrEznv5jXXdwyP6AXerN8aVRiAmcv" } }
      }
      orderBy: { descending: Block_Time }
      limit: { count: 10 }
    ) {
      Transaction {
        Signature
      }
      Block {
        Time
      }
    }
  }
}
```

### Track Token Trades

```graphql
{
  Solana {
    DEXTradeByTokens(
      where: { Trade: { Currency: { MintAddress: { is: "TOKEN_MINT_ADDRESS" } } } }
      limit: { count: 50 }
    ) {
      Trade {
        Amount
        Price
        Side
      }
    }
  }
}
```

## Error Handling

```typescript
try {
  const result = await sdk.tokenLaunch.createLaunchTransaction(params);
} catch (error) {
  if (error.response?.status === 429) {
    // Rate limited - implement exponential backoff
    await delay(Math.pow(2, retryCount) * 1000);
  } else if (error.response?.status === 400) {
    // Invalid parameters - check error.response.data
    console.error("Invalid request:", error.response.data);
  } else if (error.response?.status === 401) {
    // Invalid API key
    console.error("Check BAGS_API_KEY");
  }
}
```

## Useful Constants

```typescript
// SOL mint
const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");

// Bags creator signer (for tracking Bags launches on-chain)
const BAGS_SIGNER = "BAGSB9TpGrZxQbEsrEznv5jXXdwyP6AXerN8aVRiAmcv";

// DBC Program (bonding curve)
const METEORA_DBC = "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN";

// Fee share programs
const FEE_SHARE_V1 = "FEEhPbKVKnco9EXnaY3i4R5rQVUx91wgVfu8qokixywi";
const FEE_SHARE_V2 = "FEE2tBhCKAt7shrod19QttSVREUYPiyMzoku1mL1gqVK";
```

## SDK Services Reference

```typescript
const sdk = new BagsSDK(apiKey, connection, commitment);

// Available services
sdk.bagsApiClient; // HTTP API client
sdk.tokenLaunch; // Token launch management
sdk.state; // State queries (creators, positions)
sdk.config; // Configuration
sdk.fee; // Fee claiming
sdk.trade; // Trading operations
sdk.partner; // Partner management
```
