# Phantom Wallet Integration

Complete patterns for Phantom wallet integration in Solana web apps.

## Provider Detection

```javascript
const getProvider = () => {
  if ('phantom' in window) {
    const provider = window.phantom?.solana;
    if (provider?.isPhantom) {
      return provider;
    }
  }
  return null;
};

const isPhantomInstalled = () => getProvider() !== null;
```

## Connection Flow

### Basic Connect
```javascript
const connectWallet = async () => {
  const provider = getProvider();
  if (!provider) {
    window.open('https://phantom.app/', '_blank');
    return null;
  }
  
  try {
    const response = await provider.connect();
    return response.publicKey.toString();
  } catch (err) {
    if (err.code === 4001) {
      console.log('User rejected connection');
    }
    return null;
  }
};
```

### Connect with Auto-Reconnect
```javascript
// Eager connect - reconnects if previously approved
const eagerConnect = async () => {
  const provider = getProvider();
  if (!provider) return null;
  
  try {
    const response = await provider.connect({ onlyIfTrusted: true });
    return response.publicKey.toString();
  } catch {
    return null; // User hasn't approved before
  }
};

// Call on page load
window.addEventListener('load', eagerConnect);
```

### Disconnect
```javascript
const disconnectWallet = async () => {
  const provider = getProvider();
  if (provider) {
    await provider.disconnect();
  }
};
```

## Event Listeners

```javascript
const setupWalletListeners = (onConnect, onDisconnect, onChange) => {
  const provider = getProvider();
  if (!provider) return;

  provider.on('connect', (publicKey) => {
    onConnect(publicKey.toString());
  });

  provider.on('disconnect', () => {
    onDisconnect();
  });

  provider.on('accountChanged', (publicKey) => {
    if (publicKey) {
      onChange(publicKey.toString());
    } else {
      // User switched to an account not connected to the app
      onDisconnect();
    }
  });
};

// Cleanup
const removeWalletListeners = () => {
  const provider = getProvider();
  if (provider) {
    provider.removeAllListeners('connect');
    provider.removeAllListeners('disconnect');
    provider.removeAllListeners('accountChanged');
  }
};
```

## Signing Messages

```javascript
const signMessage = async (message) => {
  const provider = getProvider();
  if (!provider?.publicKey) {
    throw new Error('Wallet not connected');
  }

  const encodedMessage = new TextEncoder().encode(message);
  const { signature } = await provider.signMessage(encodedMessage, 'utf8');
  
  return {
    signature: Buffer.from(signature).toString('base64'),
    publicKey: provider.publicKey.toString()
  };
};
```

## Signing Transactions

```javascript
import { Transaction, SystemProgram, PublicKey, Connection } from '@solana/web3.js';

const signAndSendTransaction = async (transaction) => {
  const provider = getProvider();
  if (!provider?.publicKey) {
    throw new Error('Wallet not connected');
  }

  const connection = new Connection('https://api.mainnet-beta.solana.com');
  
  // Get recent blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = provider.publicKey;

  // Sign and send
  const { signature } = await provider.signAndSendTransaction(transaction);
  
  // Confirm
  await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight
  });

  return signature;
};

// Example: Send SOL
const sendSol = async (toAddress, lamports) => {
  const provider = getProvider();
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: provider.publicKey,
      toPubkey: new PublicKey(toAddress),
      lamports
    })
  );
  
  return signAndSendTransaction(transaction);
};
```

## React Hook Pattern

```javascript
import { useState, useEffect, useCallback } from 'react';

export const usePhantom = () => {
  const [publicKey, setPublicKey] = useState(null);
  const [connecting, setConnecting] = useState(false);

  const getProvider = useCallback(() => {
    if ('phantom' in window) {
      return window.phantom?.solana;
    }
    return null;
  }, []);

  // Eager connect on mount
  useEffect(() => {
    const provider = getProvider();
    if (provider) {
      provider.connect({ onlyIfTrusted: true })
        .then(({ publicKey }) => setPublicKey(publicKey.toString()))
        .catch(() => {});
    }
  }, [getProvider]);

  // Event listeners
  useEffect(() => {
    const provider = getProvider();
    if (!provider) return;

    const handleConnect = (pk) => setPublicKey(pk.toString());
    const handleDisconnect = () => setPublicKey(null);
    const handleChange = (pk) => pk ? setPublicKey(pk.toString()) : setPublicKey(null);

    provider.on('connect', handleConnect);
    provider.on('disconnect', handleDisconnect);
    provider.on('accountChanged', handleChange);

    return () => {
      provider.removeAllListeners('connect');
      provider.removeAllListeners('disconnect');
      provider.removeAllListeners('accountChanged');
    };
  }, [getProvider]);

  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      window.open('https://phantom.app/', '_blank');
      return;
    }

    setConnecting(true);
    try {
      const { publicKey } = await provider.connect();
      setPublicKey(publicKey.toString());
    } catch (err) {
      console.error('Connection failed:', err);
    } finally {
      setConnecting(false);
    }
  }, [getProvider]);

  const disconnect = useCallback(async () => {
    const provider = getProvider();
    if (provider) {
      await provider.disconnect();
      setPublicKey(null);
    }
  }, [getProvider]);

  return {
    publicKey,
    connected: !!publicKey,
    connecting,
    connect,
    disconnect,
    provider: getProvider()
  };
};
```

## UI Component Pattern

```javascript
const WalletButton = () => {
  const { publicKey, connected, connecting, connect, disconnect } = usePhantom();

  const truncateAddress = (address) => 
    `${address.slice(0, 4)}...${address.slice(-4)}`;

  if (connecting) {
    return <button disabled>Connecting...</button>;
  }

  if (connected) {
    return (
      <button onClick={disconnect}>
        {truncateAddress(publicKey)}
      </button>
    );
  }

  return <button onClick={connect}>Connect Wallet</button>;
};
```

## Error Codes

| Code | Meaning |
|------|---------|
| 4001 | User rejected the request |
| 4100 | Unauthorized - wallet not connected |
| 4900 | Disconnected |
| -32603 | Internal error |

## Security Notes

- Never store private keys
- Always show transaction details before signing
- Validate all addresses before transactions
- Use `onlyIfTrusted: true` for auto-reconnect
- Handle all error cases gracefully
