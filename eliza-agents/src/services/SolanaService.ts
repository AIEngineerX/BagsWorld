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
  private fallbackRpcUrls: string[];
  private keypair: nacl.SignKeyPair | null = null;
  private publicKeyBytes: Uint8Array | null = null;

  // Cache for getTopHolderConcentration — avoids redundant RPC bursts
  private concentrationCache: Map<string, { data: { top5Pct: number; top10Pct: number; largestPct: number } | null; expiry: number }> = new Map();
  private static readonly CONCENTRATION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(runtime?: IAgentRuntime) {
    super(runtime);

    this.rpcUrl =
      process.env.SOLANA_RPC_URL ||
      process.env.HELIUS_RPC_URL ||
      "https://api.mainnet-beta.solana.com";

    // Build fallback RPC list — public endpoints for when Helius is rate-limited.
    // These are only used after the primary RPC has been exhausted on retries.
    this.fallbackRpcUrls = [
      "https://api.mainnet-beta.solana.com",
      "https://solana-rpc.publicnode.com",
    ].filter((url) => url !== this.rpcUrl); // Don't duplicate the primary
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
   * Send raw transaction to a specific RPC URL.
   * Returns the signature string on success, or throws on error.
   */
  private async sendRawTransactionToRpc(
    rpcUrl: string,
    base64Tx: string,
    options?: SendTransactionOptions
  ): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout for transaction submission

    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
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

    clearTimeout(timeout);
    const result = await response.json();

    if (result.error) {
      const msg = result.error.message || JSON.stringify(result.error);
      const isRateLimit = msg.includes("max usage") || msg.includes("429") || response.status === 429;
      if (isRateLimit) {
        throw Object.assign(new Error(msg), { isRateLimit: true });
      }
      throw new Error(msg);
    }

    return result.result;
  }

  /**
   * Send raw transaction to RPC with exponential backoff retries on the primary
   * RPC, then fall back to public RPCs if the primary is rate-limited.
   */
  private async sendRawTransaction(
    signedTransaction: Uint8Array,
    options?: SendTransactionOptions
  ): Promise<string> {
    const base64Tx = btoa(String.fromCharCode(...signedTransaction));

    // Phase 1: Retry on primary RPC with exponential backoff
    const maxPrimaryAttempts = 5;
    let lastError: Error | null = null;
    let hitRateLimit = false;

    for (let attempt = 1; attempt <= maxPrimaryAttempts; attempt++) {
      try {
        return await this.sendRawTransactionToRpc(this.rpcUrl, base64Tx, options);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const isRateLimit = (err as { isRateLimit?: boolean }).isRateLimit === true;

        if (isRateLimit && attempt < maxPrimaryAttempts) {
          const delayMs = Math.min(2000 * Math.pow(2, attempt - 1), 16000); // 2s, 4s, 8s, 16s
          console.warn(
            `[SolanaService] sendTransaction rate limited on primary (attempt ${attempt}/${maxPrimaryAttempts}), retrying in ${delayMs / 1000}s...`
          );
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        if (isRateLimit) {
          hitRateLimit = true;
          console.warn(
            `[SolanaService] Primary RPC exhausted after ${maxPrimaryAttempts} attempts, trying fallback RPCs...`
          );
          break;
        }

        // Non-rate-limit error — don't retry, throw immediately
        throw lastError;
      }
    }

    // Phase 2: Try fallback RPCs (only reached on rate-limit exhaustion)
    if (hitRateLimit) {
      for (const fallbackUrl of this.fallbackRpcUrls) {
        try {
          console.log(
            `[SolanaService] Trying fallback RPC: ${fallbackUrl.replace(/https?:\/\//, "").slice(0, 30)}...`
          );
          const sig = await this.sendRawTransactionToRpc(fallbackUrl, base64Tx, options);
          console.log(`[SolanaService] sendTransaction succeeded on fallback RPC`);
          return sig;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[SolanaService] Fallback RPC failed: ${msg}`);
          lastError = err instanceof Error ? err : new Error(msg);
        }
      }
    }

    throw lastError || new Error("sendTransaction failed after all retry attempts");
  }

  /**
   * Check signature status against a single RPC URL.
   * Returns "confirmed" | "finalized" | "processing" | "error" | "rpc_error".
   */
  private async checkSignatureStatus(
    rpcUrl: string,
    signature: string
  ): Promise<{ state: "confirmed" | "finalized" | "processing" | "error" | "rpc_error"; err?: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getSignatureStatuses",
        params: [[signature]],
      }),
    });

    clearTimeout(timeout);
    const result = await response.json();

    if (result.error) {
      return { state: "rpc_error", err: result.error.message || JSON.stringify(result.error) };
    }

    const status = result.result?.value?.[0];
    if (!status) {
      return { state: "processing" };
    }
    if (status.err) {
      return { state: "error", err: JSON.stringify(status.err) };
    }
    if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") {
      return { state: status.confirmationStatus };
    }
    return { state: "processing" };
  }

  /**
   * Confirm transaction by polling signature status.
   * Uses primary RPC first, falls back to public RPCs on rate-limit errors.
   */
  private async confirmTransaction(signature: string, maxRetries: number = 30): Promise<boolean> {
    const rpcUrls = [this.rpcUrl, ...this.fallbackRpcUrls];
    let currentRpcIndex = 0;
    let consecutiveRpcErrors = 0;

    for (let i = 0; i < maxRetries; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const url = rpcUrls[currentRpcIndex];

      try {
        const result = await this.checkSignatureStatus(url, signature);

        switch (result.state) {
          case "confirmed":
          case "finalized":
            return true;
          case "error":
            throw new Error(`Transaction failed: ${result.err}`);
          case "rpc_error":
            consecutiveRpcErrors++;
            // Switch to next RPC after 2 consecutive errors on the current one
            if (consecutiveRpcErrors >= 2 && currentRpcIndex < rpcUrls.length - 1) {
              currentRpcIndex++;
              consecutiveRpcErrors = 0;
              console.warn(
                `[SolanaService] confirmTransaction: switching to RPC #${currentRpcIndex + 1} after errors`
              );
            }
            break;
          case "processing":
            consecutiveRpcErrors = 0;
            break;
        }
      } catch (err) {
        // Network/abort errors — try next RPC
        consecutiveRpcErrors++;
        if (consecutiveRpcErrors >= 2 && currentRpcIndex < rpcUrls.length - 1) {
          currentRpcIndex++;
          consecutiveRpcErrors = 0;
          console.warn(
            `[SolanaService] confirmTransaction: switching to RPC #${currentRpcIndex + 1} after fetch error`
          );
        }
      }
    }

    return false;
  }

  /**
   * Get SOL balance — tries primary RPC, falls back to public RPCs on rate limit
   */
  async getBalance(): Promise<number> {
    if (!this.publicKeyBytes) return 0;

    const publicKey = base58Encode(this.publicKeyBytes);

    const rpcUrls = [this.rpcUrl, ...this.fallbackRpcUrls];

    for (const url of rpcUrls) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getBalance",
            params: [publicKey],
          }),
        });

        clearTimeout(timeout);
        const result = await response.json();

        if (result.error) {
          console.warn(`[SolanaService] getBalance RPC error from ${url === this.rpcUrl ? "primary" : "fallback"}:`, result.error);
          continue; // Try next RPC
        }

        return (result.result?.value || 0) / 1_000_000_000;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[SolanaService] getBalance failed on ${url === this.rpcUrl ? "primary" : "fallback"} RPC: ${msg}`);
        continue; // Try next RPC
      }
    }

    throw new Error("All RPC endpoints failed for getBalance");
  }

  /**
   * Get SPL token balance for a specific mint.
   * Returns raw token amount (not decimal-adjusted), matching how amountTokens
   * is stored from parseFloat(quote.outAmount) during buys.
   * Tries primary RPC, falls back to public RPCs on error.
   */
  async getTokenBalance(tokenMint: string): Promise<number> {
    if (!this.publicKeyBytes) return 0;

    const publicKey = base58Encode(this.publicKeyBytes);
    const rpcUrls = [this.rpcUrl, ...this.fallbackRpcUrls];

    for (const url of rpcUrls) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
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

        clearTimeout(timeout);
        const result = await response.json();

        if (result.error) {
          console.warn(
            `[SolanaService] getTokenBalance RPC error from ${url === this.rpcUrl ? "primary" : "fallback"}:`,
            result.error
          );
          continue;
        }

        const accounts = result.result?.value;

        if (!accounts || accounts.length === 0) {
          return 0;
        }

        // Sum balances across all token accounts for this mint (usually just one)
        let totalAmount = 0;
        for (const account of accounts) {
          const tokenAmount = account.account?.data?.parsed?.info?.tokenAmount;
          if (tokenAmount) {
            const parsed = parseFloat(tokenAmount.amount);
            if (!isNaN(parsed)) {
              totalAmount += parsed;
            }
          }
        }

        return totalAmount;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[SolanaService] getTokenBalance failed on ${url === this.rpcUrl ? "primary" : "fallback"} RPC: ${msg}`);
        continue;
      }
    }

    throw new Error("All RPC endpoints failed for getTokenBalance");
  }

  /**
   * Get the number of decimals for a token mint.
   * Uses getTokenSupply RPC call. Tries primary RPC, falls back to public RPCs,
   * then defaults to 6 (standard for Bags.fm tokens) if all RPCs fail.
   */
  async getTokenDecimals(tokenMint: string): Promise<number> {
    const rpcUrls = [this.rpcUrl, ...this.fallbackRpcUrls];

    for (const url of rpcUrls) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getTokenSupply",
            params: [tokenMint],
          }),
        });

        clearTimeout(timeout);
        const result = await response.json();

        if (result.error) {
          console.warn(`[SolanaService] getTokenDecimals RPC error for ${tokenMint} from ${url === this.rpcUrl ? "primary" : "fallback"}:`, result.error);
          continue;
        }

        const decimals = result.result?.value?.decimals;
        return typeof decimals === "number" ? decimals : 6;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[SolanaService] getTokenDecimals failed on ${url === this.rpcUrl ? "primary" : "fallback"} RPC: ${msg}`);
        continue;
      }
    }

    console.warn(`[SolanaService] All RPCs failed for getTokenDecimals(${tokenMint}), defaulting to 6`);
    return 6;
  }

  /**
   * Get the associated token account address for a specific mint.
   * Returns the account pubkey or null if no account exists.
   */
  async getTokenAccountAddress(tokenMint: string): Promise<string | null> {
    if (!this.publicKeyBytes) return null;

    const publicKey = base58Encode(this.publicKeyBytes);

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

    if (result.error) {
      throw new Error(result.error.message || JSON.stringify(result.error));
    }

    const accounts = result.result?.value;

    if (!accounts || accounts.length === 0) {
      return null;
    }

    // Return the first (primary) token account address
    return accounts[0].pubkey || null;
  }

  /**
   * Get top holder concentration for a token mint.
   * Uses getTokenLargestAccounts + getTokenSupply to detect bundled tokens.
   * Results are cached for CONCENTRATION_CACHE_TTL_MS to avoid burst RPC calls
   * when evaluating multiple launches in rapid succession.
   * Returns null on any error (graceful degradation - never blocks trading).
   */
  async getTopHolderConcentration(
    mint: string
  ): Promise<{ top5Pct: number; top10Pct: number; largestPct: number } | null> {
    // Check cache first
    const cached = this.concentrationCache.get(mint);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }

    // Evict expired entries periodically (keep cache bounded)
    if (this.concentrationCache.size > 100) {
      const now = Date.now();
      for (const [key, entry] of this.concentrationCache) {
        if (now >= entry.expiry) this.concentrationCache.delete(key);
      }
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const [largestRes, supplyRes] = await Promise.all([
        fetch(this.rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getTokenLargestAccounts",
            params: [mint],
          }),
        }),
        fetch(this.rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "getTokenSupply",
            params: [mint],
          }),
        }),
      ]);

      clearTimeout(timeout);

      const largestData = await largestRes.json();
      const supplyData = await supplyRes.json();

      if (largestData.error || supplyData.error) {
        console.warn("[SolanaService] Concentration RPC error:", largestData.error || supplyData.error);
        // Cache null result too — avoids re-hitting a failing RPC for the same mint
        this.concentrationCache.set(mint, { data: null, expiry: Date.now() + SolanaService.CONCENTRATION_CACHE_TTL_MS });
        return null;
      }

      const accounts = largestData.result?.value;
      const totalSupply = parseFloat(supplyData.result?.value?.amount || "0");

      if (!accounts || accounts.length === 0 || totalSupply === 0) {
        this.concentrationCache.set(mint, { data: null, expiry: Date.now() + SolanaService.CONCENTRATION_CACHE_TTL_MS });
        return null;
      }

      // Sort by amount descending (should already be sorted, but be safe)
      const sorted = accounts
        .map((a: { amount: string }) => parseFloat(a.amount || "0"))
        .sort((a: number, b: number) => b - a);

      const top5Sum = sorted.slice(0, 5).reduce((s: number, v: number) => s + v, 0);
      const top10Sum = sorted.slice(0, 10).reduce((s: number, v: number) => s + v, 0);
      const largest = sorted[0] || 0;

      const result = {
        top5Pct: (top5Sum / totalSupply) * 100,
        top10Pct: (top10Sum / totalSupply) * 100,
        largestPct: (largest / totalSupply) * 100,
      };

      this.concentrationCache.set(mint, { data: result, expiry: Date.now() + SolanaService.CONCENTRATION_CACHE_TTL_MS });
      return result;
    } catch (error) {
      console.warn("[SolanaService] Concentration check failed (continuing):", error instanceof Error ? error.message : "unknown");
      // Cache the failure to avoid immediately retrying a timed-out/rate-limited mint
      this.concentrationCache.set(mint, { data: null, expiry: Date.now() + SolanaService.CONCENTRATION_CACHE_TTL_MS });
      return null;
    }
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
