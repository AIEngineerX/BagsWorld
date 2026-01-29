# Holder Gating Patterns

## Basic Token Gate

```javascript
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';

const BAGS_TOKEN = 'BAGSxQcgw5N1BHRdFvFLsSTQGKpPLonUd57g8hoUF2ep';
const BAGS_DECIMALS = 6;

async function getTokenBalance(walletAddress, tokenMint = BAGS_TOKEN) {
  const connection = new Connection(process.env.RPC_URL);
  const wallet = new PublicKey(walletAddress);
  const mint = new PublicKey(tokenMint);
  
  const ata = await getAssociatedTokenAddress(mint, wallet);
  
  try {
    const account = await getAccount(connection, ata);
    return Number(account.amount) / (10 ** BAGS_DECIMALS);
  } catch {
    return 0;
  }
}

async function hasMinimumBalance(walletAddress, minimum) {
  const balance = await getTokenBalance(walletAddress);
  return balance >= minimum;
}
```

## Tiered Access

```javascript
const ACCESS_TIERS = {
  free: { min: 0, features: ['basic_scanner'] },
  holder: { min: 1000, features: ['basic_scanner', 'alerts'] },
  whale: { min: 10000, features: ['basic_scanner', 'alerts', 'whale_tracker', 'early_access'] },
  og: { min: 100000, features: ['all'] },
};

async function getUserTier(walletAddress) {
  const balance = await getTokenBalance(walletAddress);
  
  if (balance >= ACCESS_TIERS.og.min) return 'og';
  if (balance >= ACCESS_TIERS.whale.min) return 'whale';
  if (balance >= ACCESS_TIERS.holder.min) return 'holder';
  return 'free';
}

async function canAccessFeature(walletAddress, feature) {
  const tier = await getUserTier(walletAddress);
  const tierConfig = ACCESS_TIERS[tier];
  
  return tierConfig.features.includes('all') || tierConfig.features.includes(feature);
}
```

## React Hook

```javascript
import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

function useHolderAccess(minBalance = 0) {
  const { publicKey } = useWallet();
  const [access, setAccess] = useState({ loading: true, hasAccess: false, balance: 0, tier: 'free' });

  useEffect(() => {
    if (!publicKey) {
      setAccess({ loading: false, hasAccess: false, balance: 0, tier: 'free' });
      return;
    }

    async function check() {
      const balance = await getTokenBalance(publicKey.toString());
      const tier = await getUserTier(publicKey.toString());
      
      setAccess({
        loading: false,
        hasAccess: balance >= minBalance,
        balance,
        tier,
      });
    }

    check();
  }, [publicKey, minBalance]);

  return access;
}

// Usage
function PremiumFeature() {
  const { loading, hasAccess, balance, tier } = useHolderAccess(1000);

  if (loading) return <div>Checking access...</div>;
  
  if (!hasAccess) {
    return (
      <div className="gate-message">
        <p>Hold 1,000+ $BAGS to access this feature</p>
        <p>Your balance: {balance.toLocaleString()} $BAGS</p>
        <a href="https://jup.ag/swap/SOL-BAGS" target="_blank">Buy $BAGS</a>
      </div>
    );
  }

  return <div>Premium content here</div>;
}
```

## Server-Side Verification

Don't trust client-side only. Always verify on server:

```javascript
// API endpoint
app.post('/api/premium-action', async (req, res) => {
  const { wallet, signature, message } = req.body;
  
  // 1. Verify wallet signature
  const isValid = verifySignature(wallet, signature, message);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // 2. Check token balance on-chain
  const balance = await getTokenBalance(wallet);
  if (balance < 1000) {
    return res.status(403).json({ error: 'Insufficient BAGS balance', required: 1000, current: balance });
  }
  
  // 3. Proceed with action
  const result = await performPremiumAction(wallet);
  res.json(result);
});
```

## Signature Verification

```javascript
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';

function verifySignature(walletAddress, signature, message) {
  try {
    const publicKey = new PublicKey(walletAddress);
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = Buffer.from(signature, 'base64');
    
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey.toBytes());
  } catch {
    return false;
  }
}

// Client-side signing
async function signMessage(message) {
  const provider = window.phantom?.solana;
  const encodedMessage = new TextEncoder().encode(message);
  const { signature } = await provider.signMessage(encodedMessage, 'utf8');
  return Buffer.from(signature).toString('base64');
}
```

## Discord Integration

Gate Discord roles based on holdings:

```javascript
// Discord bot command
async function verifyHolder(discordUserId, walletAddress) {
  // 1. Store wallet-discord link
  await db.links.upsert({
    discordId: discordUserId,
    wallet: walletAddress,
  });
  
  // 2. Check balance
  const balance = await getTokenBalance(walletAddress);
  const tier = await getUserTier(walletAddress);
  
  // 3. Assign Discord roles
  const guild = await client.guilds.fetch(GUILD_ID);
  const member = await guild.members.fetch(discordUserId);
  
  const roleMap = {
    holder: 'HOLDER_ROLE_ID',
    whale: 'WHALE_ROLE_ID',
    og: 'OG_ROLE_ID',
  };
  
  // Remove old roles, add new one
  for (const [t, roleId] of Object.entries(roleMap)) {
    if (t === tier) {
      await member.roles.add(roleId);
    } else {
      await member.roles.remove(roleId).catch(() => {});
    }
  }
  
  return { tier, balance };
}
```

## Gate UI Component

```jsx
function TokenGate({ minBalance, children, fallback }) {
  const { loading, hasAccess, balance } = useHolderAccess(minBalance);

  if (loading) {
    return (
      <div className="gate-loading">
        <div className="spinner"></div>
        <p>Verifying holdings...</p>
      </div>
    );
  }

  if (!hasAccess) {
    return fallback || (
      <div className="gate-locked">
        <div className="lock-icon">🔒</div>
        <h3>Holder-Gated Content</h3>
        <p>Hold {minBalance.toLocaleString()}+ $BAGS to unlock</p>
        <p className="balance">Your balance: {balance.toLocaleString()}</p>
        <a 
          href={`https://jup.ag/swap/SOL-${BAGS_TOKEN}`}
          target="_blank"
          className="buy-btn"
        >
          Buy $BAGS on Jupiter
        </a>
      </div>
    );
  }

  return children;
}

// Usage
<TokenGate minBalance={1000}>
  <WhaleTracker />
</TokenGate>
```
