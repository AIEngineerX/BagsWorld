# Flywheel Mechanics

## Core Concept

Flywheel = Fee collection → Buy $BAGS → Burn $BAGS

This creates constant buy pressure and deflation for $BAGS.

## Fee Collection Patterns

### 1. Registration Fee

```javascript
// User pays SOL to register/list something
async function collectRegistrationFee(connection, payer, amount = 0.1) {
  const feeIx = SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: new PublicKey(FEE_WALLET),
    lamports: amount * LAMPORTS_PER_SOL,
  });

  const tx = new Transaction().add(feeIx);
  return await sendAndConfirmTransaction(connection, tx, [payer]);
}
```

### 2. Transaction Fee (Percentage)

```javascript
// Take X% of each transaction
async function collectTxFee(connection, payer, txAmount, feePercent = 1) {
  const feeAmount = txAmount * (feePercent / 100);

  const feeIx = SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: new PublicKey(FEE_WALLET),
    lamports: feeAmount,
  });

  return feeIx;
}
```

### 3. Subscription Fee

```javascript
// Monthly/weekly subscription in SOL
const SUBSCRIPTION_TIERS = {
  basic: { price: 0.5, duration: 30 * 24 * 60 * 60 * 1000 },
  pro: { price: 1.5, duration: 30 * 24 * 60 * 60 * 1000 },
  whale: { price: 5, duration: 30 * 24 * 60 * 60 * 1000 },
};

async function subscribe(connection, payer, tier) {
  const { price, duration } = SUBSCRIPTION_TIERS[tier];

  const feeIx = SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: new PublicKey(FEE_WALLET),
    lamports: price * LAMPORTS_PER_SOL,
  });

  const tx = new Transaction().add(feeIx);
  const sig = await sendAndConfirmTransaction(connection, tx, [payer]);

  // Store subscription in DB
  await db.subscriptions.create({
    wallet: payer.publicKey.toString(),
    tier,
    expiresAt: Date.now() + duration,
    txSignature: sig,
  });

  return sig;
}
```

## Buy + Burn Backend

Run this as a cron job or when fee wallet reaches threshold:

```javascript
import { Jupiter } from "@jup-ag/api";

const BAGS_MINT = "BAGSxQcgw5N1BHRdFvFLsSTQGKpPLonUd57g8hoUF2ep";
const BURN_ADDRESS = "1nc1nerator11111111111111111111111111111111"; // Or actual burn

async function buyAndBurn() {
  const connection = new Connection(RPC_URL);
  const feeWallet = Keypair.fromSecretKey(/* your fee wallet key */);

  // 1. Check fee wallet balance
  const balance = await connection.getBalance(feeWallet.publicKey);
  const threshold = 1 * LAMPORTS_PER_SOL; // Min 1 SOL to trigger

  if (balance < threshold) {
    console.log("Below threshold, skipping");
    return;
  }

  // 2. Keep some SOL for gas
  const buyAmount = balance - 0.01 * LAMPORTS_PER_SOL;

  // 3. Get Jupiter quote
  const jupiter = await Jupiter.load({ connection });
  const routes = await jupiter.computeRoutes({
    inputMint: new PublicKey("So11111111111111111111111111111111111111112"), // SOL
    outputMint: new PublicKey(BAGS_MINT),
    amount: buyAmount,
    slippageBps: 100, // 1%
  });

  // 4. Execute swap
  const { execute } = await jupiter.exchange({ routeInfo: routes.routesInfos[0] });
  const swapResult = await execute();

  console.log(`Bought BAGS: ${swapResult.outputAmount}`);

  // 5. Burn the BAGS (send to burn address or use SPL burn)
  // Option A: Send to burn address
  // Option B: Use token burn instruction

  return swapResult;
}
```

## Transparency Dashboard

Show users where fees go:

```javascript
async function getFlywheelStats() {
  // Track all fee transactions
  const feeHistory = await db.fees.findAll();
  const burnHistory = await db.burns.findAll();

  return {
    totalFeesCollected: feeHistory.reduce((sum, f) => sum + f.amount, 0),
    totalBagsBurned: burnHistory.reduce((sum, b) => sum + b.amount, 0),
    last24hFees: feeHistory
      .filter((f) => f.timestamp > Date.now() - 86400000)
      .reduce((sum, f) => sum + f.amount, 0),
    burnTransactions: burnHistory.map((b) => ({
      signature: b.txSignature,
      amount: b.amount,
      timestamp: b.timestamp,
    })),
  };
}
```

## Frontend Display

```html
<div class="flywheel-stats">
  <div class="stat">
    <span class="label">Total Fees Collected</span>
    <span class="value" id="total-fees">--</span>
  </div>
  <div class="stat">
    <span class="label">$BAGS Burned</span>
    <span class="value" id="bags-burned">--</span>
  </div>
  <div class="stat">
    <span class="label">24h Volume</span>
    <span class="value" id="daily-volume">--</span>
  </div>
</div>

<script>
  async function loadFlywheelStats() {
    const stats = await fetch("/api/flywheel-stats").then((r) => r.json());
    document.getElementById("total-fees").textContent =
      `${stats.totalFeesCollected.toFixed(2)} SOL`;
    document.getElementById("bags-burned").textContent =
      `${stats.totalBagsBurned.toLocaleString()} BAGS`;
    document.getElementById("daily-volume").textContent = `${stats.last24hFees.toFixed(2)} SOL`;
  }
  loadFlywheelStats();
</script>
```
