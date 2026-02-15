// Agent Wallet Management
// Balance checking, transaction signing, and submission

import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { LAMPORTS_PER_SOL, lamportsToSol, type WalletBalance } from "./types";
import { getAgentCredentials, logAgentAction } from "./credentials";
import { exportPrivateKey } from "./auth";

// Get RPC connection
function getConnection(): Connection {
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  return new Connection(rpcUrl, "confirmed");
}

/**
 * Get wallet balance in SOL
 */
export async function getWalletBalance(walletAddress: string): Promise<WalletBalance> {
  const connection = getConnection();
  let publicKey: PublicKey;
  try {
    publicKey = new PublicKey(walletAddress);
  } catch {
    console.error(`[Wallet] Invalid wallet address: ${walletAddress}`);
    throw new Error(`Invalid wallet address: ${walletAddress}`);
  }

  try {
    const lamports = await connection.getBalance(publicKey);
    return {
      address: walletAddress,
      lamports,
      sol: lamportsToSol(lamports),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Wallet] RPC getBalance failed for ${walletAddress}: ${msg}`);
    throw err;
  }
}

/**
 * Get all wallet balances for an agent
 */
export async function getAgentBalances(agentId: string): Promise<WalletBalance[]> {
  const credentials = await getAgentCredentials(agentId);
  if (!credentials) {
    console.error(`[Wallet] Agent ${agentId}: credentials not found or expired — balance will show 0`);
    throw new Error(`Agent ${agentId} not found or credentials expired`);
  }

  if (credentials.wallets.length === 0) {
    console.warn(`[Wallet] Agent ${agentId} (${credentials.moltbookUsername}): no wallets registered`);
    return [];
  }

  const balances = await Promise.all(credentials.wallets.map((wallet) => getWalletBalance(wallet)));

  return balances;
}

/**
 * Get total balance across all agent wallets
 */
export async function getAgentTotalBalance(agentId: string): Promise<{
  totalLamports: number;
  totalSol: number;
  wallets: WalletBalance[];
}> {
  const wallets = await getAgentBalances(agentId);

  const totalLamports = wallets.reduce((sum, w) => sum + w.lamports, 0);

  return {
    totalLamports,
    totalSol: lamportsToSol(totalLamports),
    wallets,
  };
}

/**
 * Sign a transaction with agent's private key
 * ⚠️ SECURITY: Private key is exported, used, and should be cleared
 */
export async function signTransaction(agentId: string, unsignedTxBase64: string): Promise<string> {
  const credentials = await getAgentCredentials(agentId);
  if (!credentials || credentials.wallets.length === 0) {
    throw new Error(`Agent ${agentId} has no wallets`);
  }

  const walletAddress = credentials.wallets[0];

  // Export private key (temporary!)
  let privateKeyBase58: string | null = null;
  let privateKeyBytes: Uint8Array | null = null;
  try {
    privateKeyBase58 = await exportPrivateKey(credentials.jwtToken, walletAddress);

    // Decode private key
    privateKeyBytes = bs58.decode(privateKeyBase58);

    // Deserialize transaction
    const txBuffer = Buffer.from(unsignedTxBase64, "base64");
    const transaction = VersionedTransaction.deserialize(txBuffer);

    // Create keypair and sign
    // Note: Solana Keypair expects 64 bytes (32 private + 32 public)
    // bs58 private key from Bags is already the full 64-byte secret key
    const { Keypair } = await import("@solana/web3.js");
    const keypair = Keypair.fromSecretKey(privateKeyBytes);

    transaction.sign([keypair]);

    // Serialize signed transaction
    const signedTxBytes = transaction.serialize();
    const signedTxBase64 = Buffer.from(signedTxBytes).toString("base64");

    return signedTxBase64;
  } finally {
    // Clear private key bytes from memory (effective for Uint8Array)
    if (privateKeyBytes) privateKeyBytes.fill(0);
    privateKeyBase58 = null;
  }
}

/**
 * Submit a signed transaction to Solana
 */
export async function submitTransaction(
  signedTxBase64: string,
  skipPreflight: boolean = false
): Promise<string> {
  const connection = getConnection();

  const txBuffer = Buffer.from(signedTxBase64, "base64");
  const transaction = VersionedTransaction.deserialize(txBuffer);

  const signature = await connection.sendTransaction(transaction, {
    skipPreflight,
    preflightCommitment: "confirmed",
  });

  return signature;
}

/**
 * Sign and submit a transaction in one step
 */
export async function signAndSubmitTransaction(
  agentId: string,
  unsignedTxBase64: string,
  actionType: string = "transaction",
  actionData: Record<string, unknown> = {}
): Promise<string> {
  try {
    // Sign
    const signedTx = await signTransaction(agentId, unsignedTxBase64);

    // Submit
    const signature = await submitTransaction(signedTx);

    // Log success
    await logAgentAction(
      agentId,
      actionType,
      {
        ...actionData,
        status: "submitted",
      },
      true,
      signature
    );

    return signature;
  } catch (error) {
    // Log failure
    await logAgentAction(
      agentId,
      actionType,
      actionData,
      false,
      undefined,
      error instanceof Error ? error.message : "Unknown error"
    );
    throw error;
  }
}

/**
 * Confirm a transaction
 */
export async function confirmTransaction(
  signature: string,
  commitment: "processed" | "confirmed" | "finalized" = "confirmed"
): Promise<boolean> {
  const connection = getConnection();

  const result = await connection.confirmTransaction(signature, commitment);

  return !result.value.err;
}

/**
 * Wait for transaction confirmation with timeout
 */
export async function waitForConfirmation(
  signature: string,
  timeoutMs: number = 60000
): Promise<{ confirmed: boolean; error?: string }> {
  const connection = getConnection();

  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const status = await connection.getSignatureStatus(signature);

      if (
        status.value?.confirmationStatus === "confirmed" ||
        status.value?.confirmationStatus === "finalized"
      ) {
        if (status.value.err) {
          return { confirmed: false, error: JSON.stringify(status.value.err) };
        }
        return { confirmed: true };
      }
    } catch {
      // Continue polling
    }

    // Wait 1 second before next poll
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return { confirmed: false, error: "Timeout waiting for confirmation" };
}

/**
 * Get recent transactions for a wallet
 */
export async function getRecentTransactions(
  walletAddress: string,
  limit: number = 10
): Promise<
  Array<{
    signature: string;
    slot: number;
    err: boolean;
    blockTime: number | null;
  }>
> {
  const connection = getConnection();
  const publicKey = new PublicKey(walletAddress);

  const signatures = await connection.getSignaturesForAddress(publicKey, { limit });

  return signatures.map((sig) => ({
    signature: sig.signature,
    slot: sig.slot,
    err: sig.err !== null,
    blockTime: sig.blockTime ?? null,
  }));
}

/**
 * Check if agent has enough balance for a transaction
 */
export async function hasEnoughBalance(
  agentId: string,
  requiredLamports: number
): Promise<{ hasEnough: boolean; currentBalance: number; required: number }> {
  const { totalLamports } = await getAgentTotalBalance(agentId);

  // Add buffer for transaction fees (~0.01 SOL)
  const requiredWithFees = requiredLamports + 10_000_000;

  return {
    hasEnough: totalLamports >= requiredWithFees,
    currentBalance: totalLamports,
    required: requiredWithFees,
  };
}

/**
 * Get the primary wallet for an agent (first wallet)
 */
export async function getPrimaryWallet(agentId: string): Promise<string> {
  const credentials = await getAgentCredentials(agentId);
  if (!credentials || credentials.wallets.length === 0) {
    throw new Error(`Agent ${agentId} has no wallets`);
  }
  return credentials.wallets[0];
}
