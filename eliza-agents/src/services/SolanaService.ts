/**
 * SolanaService - Transaction signing and submission for GhostTrader (ElizaOS)
 * Runs on: Railway (deployed alongside GhostTrader)
 * NOT related to ChadGhost (MoltBook alpha-posting agent on Mac mini)
 */

import { Service, type IAgentRuntime } from "../types/elizaos.js";
import nacl from "tweetnacl";

interface TransactionSignature {
  signature: string;
  confirmed: boolean;
  slot?: number;
  error?: string;
}

interface SendTransactionOptions {
  skipPreflight?: boolean;
  preflightCommitment?: "processed" | "confirmed" | "finalized";
  maxRetries?: number;
}

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Decode(str: string): Uint8Array {
  const bytes: number[] = [0];

  for (const char of str) {
    let carry = BASE58_ALPHABET.indexOf(char);
    if (carry === -1) {
      throw new Error(`Invalid base58 character: ${char}`);
    }

    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry % 256;
      carry = Math.floor(carry / 256);
    }

    while (carry > 0) {
      bytes.push(carry % 256);
      carry = Math.floor(carry / 256);
    }
  }

  // Handle leading zeros
  for (const char of str) {
    if (char !== "1") break;
    bytes.push(0);
  }

  return new Uint8Array(bytes.reverse());
}

function base58Encode(bytes: Uint8Array): string {
  const digits: number[] = [0];

  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] * 256;
      digits[i] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  for (const byte of bytes) {
    if (byte !== 0) break;
    digits.push(0);
  }

  return digits
    .reverse()
    .map((d) => BASE58_ALPHABET[d])
    .join("");
}

let solanaServiceInstance: SolanaService | null = null;

export class SolanaService extends Service {
  static readonly serviceType = "solana";
  readonly capabilityDescription = "Solana transaction signing and submission";

  private rpcUrl: string;
  private keypair: nacl.SignKeyPair | null = null;
  private publicKeyBytes: Uint8Array | null = null;

  constructor(runtime?: IAgentRuntime) {
    super(runtime);

    this.rpcUrl =
      process.env.SOLANA_RPC_URL ||
      process.env.HELIUS_RPC_URL ||
      "https://api.mainnet-beta.solana.com";
  }

  static async start(runtime: IAgentRuntime): Promise<SolanaService> {
    console.log("[SolanaService] Starting service...");
    const service = new SolanaService(runtime);
    await service.initialize();
    solanaServiceInstance = service;
    return service;
  }

  async stop(): Promise<void> {
    this.keypair = null;
    this.publicKeyBytes = null;
    solanaServiceInstance = null;
  }

  async initialize(): Promise<void> {
    const privateKeyBase58 = process.env.GHOST_WALLET_PRIVATE_KEY;

    // Debug: check if env var exists (length only, not the value)
    console.log(
      `[SolanaService] GHOST_WALLET_PRIVATE_KEY exists: ${!!privateKeyBase58}, length: ${privateKeyBase58?.length || 0}`
    );

    if (!privateKeyBase58) {
      console.warn("[SolanaService] No GHOST_WALLET_PRIVATE_KEY configured");
      return;
    }

    try {
      const privateKeyBytes = base58Decode(privateKeyBase58);

      if (privateKeyBytes.length === 64) {
        // Full 64-byte keypair (secret + public)
        this.keypair = {
          secretKey: privateKeyBytes,
          publicKey: privateKeyBytes.slice(32),
        };
        this.publicKeyBytes = privateKeyBytes.slice(32);
      } else if (privateKeyBytes.length === 32) {
        // 32-byte seed - generate keypair from seed
        this.keypair = nacl.sign.keyPair.fromSeed(privateKeyBytes);
        this.publicKeyBytes = this.keypair.publicKey;
      } else {
        throw new Error(`Invalid private key length: ${privateKeyBytes.length}`);
      }

      const publicKeyBase58 = base58Encode(this.publicKeyBytes);
      console.log(`[SolanaService] Wallet loaded: ${publicKeyBase58.slice(0, 8)}...`);
      console.log("[SolanaService] Using tweetnacl for Ed25519 signing");
    } catch (error) {
      console.error("[SolanaService] Failed to load wallet:", error);
      this.keypair = null;
      this.publicKeyBytes = null;
    }
  }

  isConfigured(): boolean {
    return this.keypair !== null && this.publicKeyBytes !== null;
  }

  getPublicKey(): string | null {
    if (!this.publicKeyBytes) return null;
    return base58Encode(this.publicKeyBytes);
  }

  async signAndSendTransaction(
    base64Transaction: string,
    options?: SendTransactionOptions
  ): Promise<TransactionSignature> {
    if (!this.isConfigured() || !this.keypair) {
      return {
        signature: "",
        confirmed: false,
        error: "Wallet not configured",
      };
    }

    try {
      // Decode base64 transaction
      const transactionBytes = Uint8Array.from(atob(base64Transaction), (c) => c.charCodeAt(0));

      // Sign the transaction using tweetnacl
      const signedTransaction = this.signTransaction(transactionBytes);

      // Submit to RPC
      const signature = await this.sendRawTransaction(signedTransaction, options);

      // Wait for confirmation
      const confirmed = await this.confirmTransaction(signature);

      return {
        signature,
        confirmed,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[SolanaService] Transaction failed:", errorMessage);
      return {
        signature: "",
        confirmed: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Sign a transaction using tweetnacl
   */
  private signTransaction(transactionBytes: Uint8Array): Uint8Array {
    if (!this.keypair) {
      throw new Error("Wallet not initialized");
    }

    // Solana transaction format:
    // - First byte: number of signatures required
    // - Next 64*n bytes: signatures (initially empty)
    // - Rest: message to sign

    const numSignatures = transactionBytes[0];
    const signatureOffset = 1;
    const messageOffset = 1 + numSignatures * 64;

    // Extract the message portion to sign
    const message = transactionBytes.slice(messageOffset);

    // Sign the message using tweetnacl
    const signature = nacl.sign.detached(message, this.keypair.secretKey);

    // Create new transaction with signature inserted
    const signedTx = new Uint8Array(transactionBytes.length);
    signedTx.set(transactionBytes);

    // Insert signature at first signature slot
    signedTx.set(signature, signatureOffset);

    console.log(
      `[SolanaService] Transaction signed (sig: ${base58Encode(signature).slice(0, 16)}...)`
    );

    return signedTx;
  }

  /**
   * Send raw transaction to RPC
   */
  private async sendRawTransaction(
    signedTransaction: Uint8Array,
    options?: SendTransactionOptions
  ): Promise<string> {
    const base64Tx = btoa(String.fromCharCode(...signedTransaction));

    const response = await fetch(this.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sendTransaction",
        params: [
          base64Tx,
          {
            encoding: "base64",
            skipPreflight: options?.skipPreflight ?? false,
            preflightCommitment: options?.preflightCommitment ?? "confirmed",
            maxRetries: options?.maxRetries ?? 3,
          },
        ],
      }),
    });

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error.message || JSON.stringify(result.error));
    }

    return result.result;
  }

  /**
   * Confirm transaction
   */
  private async confirmTransaction(signature: string, maxRetries: number = 30): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const response = await fetch(this.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getSignatureStatuses",
          params: [[signature]],
        }),
      });

      const result = await response.json();
      const status = result.result?.value?.[0];

      if (status) {
        if (status.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
        }
        if (
          status.confirmationStatus === "confirmed" ||
          status.confirmationStatus === "finalized"
        ) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get SOL balance
   */
  async getBalance(): Promise<number> {
    if (!this.publicKeyBytes) return 0;

    const publicKey = base58Encode(this.publicKeyBytes);

    const response = await fetch(this.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [publicKey],
      }),
    });

    const result = await response.json();
    return (result.result?.value || 0) / 1_000_000_000;
  }

  /**
   * Get SPL token balance for a specific mint.
   * Returns raw token amount (not decimal-adjusted), matching how amountTokens
   * is stored from parseFloat(quote.outAmount) during buys.
   */
  async getTokenBalance(tokenMint: string): Promise<number> {
    if (!this.publicKeyBytes) return 0;

    const publicKey = base58Encode(this.publicKeyBytes);
    const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

    const response = await fetch(this.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [
          publicKey,
          { mint: tokenMint },
          { encoding: "jsonParsed", commitment: "confirmed" },
        ],
      }),
    });

    const result = await response.json();
    const accounts = result.result?.value;

    if (!accounts || accounts.length === 0) {
      return 0;
    }

    // Sum balances across all token accounts for this mint (usually just one)
    let totalAmount = 0;
    for (const account of accounts) {
      const tokenAmount = account.account?.data?.parsed?.info?.tokenAmount;
      if (tokenAmount) {
        // Use the raw string amount to preserve precision
        totalAmount += parseFloat(tokenAmount.amount);
      }
    }

    return totalAmount;
  }

  /**
   * Get recent blockhash
   */
  async getRecentBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
    const response = await fetch(this.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getLatestBlockhash",
        params: [{ commitment: "confirmed" }],
      }),
    });

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error.message);
    }

    return {
      blockhash: result.result.value.blockhash,
      lastValidBlockHeight: result.result.value.lastValidBlockHeight,
    };
  }
}

// ============================================================================
// Singleton Access
// ============================================================================

export function getSolanaService(): SolanaService {
  if (!solanaServiceInstance) {
    solanaServiceInstance = new SolanaService();
  }
  return solanaServiceInstance;
}

export default SolanaService;
