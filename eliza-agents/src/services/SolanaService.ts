// SolanaService - Transaction signing and submission for Ghost trading

import { Service, type IAgentRuntime } from "../types/elizaos.js";

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

// Ed25519 support varies by runtime - falls back to simulation if unavailable
let ed25519Available = false;

async function checkEd25519Support(): Promise<boolean> {
  try {
    const subtle = crypto.subtle as any;
    const testKey = new Uint8Array(32).fill(1);
    await subtle.importKey("raw", testKey, { name: "Ed25519" }, false, ["sign"]);
    return true;
  } catch {
    return false;
  }
}

async function importEd25519PrivateKey(privateKeyBytes: Uint8Array): Promise<CryptoKey | null> {
  if (!ed25519Available) return null;

  const keyBytes = privateKeyBytes.slice(0, 32);
  try {
    const subtle = crypto.subtle as any;
    return await subtle.importKey("raw", keyBytes, { name: "Ed25519" }, false, ["sign"]);
  } catch (error) {
    console.warn("[SolanaService] Ed25519 import failed:", error);
    return null;
  }
}

async function signMessage(privateKey: CryptoKey, message: Uint8Array): Promise<Uint8Array> {
  const subtle = crypto.subtle as any;
  const signature = await subtle.sign("Ed25519", privateKey, message);
  return new Uint8Array(signature);
}

let solanaServiceInstance: SolanaService | null = null;

export class SolanaService extends Service {
  static readonly serviceType = "solana";
  readonly capabilityDescription = "Solana transaction signing and submission";

  private rpcUrl: string;
  private privateKeyBytes: Uint8Array | null = null;
  private publicKeyBytes: Uint8Array | null = null;
  private cryptoKey: CryptoKey | null = null;

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
    this.privateKeyBytes = null;
    this.publicKeyBytes = null;
    this.cryptoKey = null;
    solanaServiceInstance = null;
  }

  async initialize(): Promise<void> {
    ed25519Available = await checkEd25519Support();
    if (!ed25519Available) {
      console.warn("[SolanaService] Ed25519 not available in this runtime");
      console.warn("[SolanaService] Real signing requires @solana/web3.js or tweetnacl");
      console.warn("[SolanaService] Transactions will be simulated");
    }

    const privateKeyBase58 = process.env.GHOST_WALLET_PRIVATE_KEY;

    // Debug: check if env var exists (length only, not the value)
    console.log(`[SolanaService] GHOST_WALLET_PRIVATE_KEY exists: ${!!privateKeyBase58}, length: ${privateKeyBase58?.length || 0}`);

    if (!privateKeyBase58) {
      console.warn("[SolanaService] No GHOST_WALLET_PRIVATE_KEY configured");
      return;
    }

    try {
      this.privateKeyBytes = base58Decode(privateKeyBase58);

      if (this.privateKeyBytes.length === 64) {
        this.publicKeyBytes = this.privateKeyBytes.slice(32);
      } else if (this.privateKeyBytes.length === 32) {
        console.warn("[SolanaService] 32-byte key detected. Use full 64-byte keypair.");
        return;
      } else {
        throw new Error(`Invalid private key length: ${this.privateKeyBytes.length}`);
      }

      if (ed25519Available) {
        this.cryptoKey = await importEd25519PrivateKey(this.privateKeyBytes);
      }

      const publicKeyBase58 = base58Encode(this.publicKeyBytes);
      console.log(`[SolanaService] Wallet loaded: ${publicKeyBase58.slice(0, 8)}...`);

      if (!ed25519Available) {
        console.log("[SolanaService] Note: Signing will be simulated (add @solana/web3.js for real signing)");
      }
    } catch (error) {
      console.error("[SolanaService] Failed to load wallet:", error);
      this.privateKeyBytes = null;
      this.publicKeyBytes = null;
    }
  }

  isConfigured(): boolean {
    return this.cryptoKey !== null && this.publicKeyBytes !== null;
  }

  getPublicKey(): string | null {
    if (!this.publicKeyBytes) return null;
    return base58Encode(this.publicKeyBytes);
  }

  async signAndSendTransaction(
    base64Transaction: string,
    options?: SendTransactionOptions
  ): Promise<TransactionSignature> {
    if (!this.isConfigured()) {
      return {
        signature: "",
        confirmed: false,
        error: "Wallet not configured",
      };
    }

    // Check if real signing is available
    if (!ed25519Available || !this.cryptoKey) {
      console.warn("[SolanaService] Ed25519 not available - transaction NOT executed");
      return {
        signature: `sim_${crypto.randomUUID().slice(0, 16)}`,
        confirmed: false, // IMPORTANT: Simulation means nothing happened on-chain
        error: "Simulated - Ed25519 signing not available in this runtime",
      };
    }

    try {
      // Decode base64 transaction
      const transactionBytes = Uint8Array.from(atob(base64Transaction), (c) => c.charCodeAt(0));

      // Sign the transaction
      const signedTransaction = await this.signTransaction(transactionBytes);

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
   * Sign a transaction (add signature to transaction bytes)
   */
  private async signTransaction(transactionBytes: Uint8Array): Promise<Uint8Array> {
    if (!this.publicKeyBytes) {
      throw new Error("Wallet not initialized");
    }

    // If Ed25519 not available, return null to trigger simulation
    if (!this.cryptoKey || !ed25519Available) {
      throw new Error("Ed25519 signing not available - use simulation mode");
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

    // Sign the message
    const signature = await signMessage(this.cryptoKey, message);

    // Create new transaction with signature inserted
    const signedTx = new Uint8Array(transactionBytes.length);
    signedTx.set(transactionBytes);

    // Insert signature at first signature slot
    signedTx.set(signature, signatureOffset);

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
  private async confirmTransaction(
    signature: string,
    maxRetries: number = 30
  ): Promise<boolean> {
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
        if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") {
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
