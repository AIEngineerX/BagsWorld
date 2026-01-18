/**
 * Bags SDK Wrapper - Read-Only State Queries
 *
 * This module wraps the official @bagsfm/bags-sdk for READ operations.
 * Used for fetching token data, creators, claim events, and wallet lookups.
 *
 * WHY THIS EXISTS (vs bags-api.ts):
 * - Graceful error handling: Returns defaults (0, [], null) on failure
 * - Used for building world state where partial data is acceptable
 * - SDK handles PublicKey conversion internally
 *
 * WHEN TO USE THIS:
 * - Fetching token lifetime fees
 * - Getting token creators
 * - Reading claim events/stats
 * - Wallet lookups for display purposes
 *
 * WHEN TO USE bags-api.ts INSTEAD:
 * - Creating tokens (requires FormData/file upload)
 * - Building transactions (trading, claiming, launching)
 * - Any write operation where failures must propagate
 *
 * @see bags-api.ts for write operations and transaction building
 */
import { Connection, PublicKey } from "@solana/web3.js";

// Types from the SDK
export interface TokenLaunchCreator {
  username: string;
  pfp: string;
  royaltyBps: number;
  isCreator: boolean;
  wallet: string;
  provider: string | null;
  providerUsername: string | null;
}

export interface TokenClaimEvent {
  wallet: string;
  isCreator: boolean;
  amount: string;
  signature: string;
  timestamp: number;
}

export interface BagsSocialProviderUserData {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
}

export interface WalletLookupResult {
  provider: string;
  platformData: BagsSocialProviderUserData | null;
  wallet: string | null;
}

// Lazy load the SDK to avoid issues with server components
let sdkInstance: any = null;

async function getSDK() {
  if (!sdkInstance) {
    const { BagsSDK } = await import("@bagsfm/bags-sdk");
    const apiKey = process.env.BAGS_API_KEY;
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

    if (!apiKey) {
      throw new Error("BAGS_API_KEY environment variable is required");
    }

    const connection = new Connection(rpcUrl, "confirmed");
    sdkInstance = new BagsSDK(apiKey, connection, "confirmed");
  }
  return sdkInstance;
}

// SDK wrapper functions
export async function getTokenLifetimeFees(tokenMint: string): Promise<number> {
  try {
    const sdk = await getSDK();
    const mintPubkey = new PublicKey(tokenMint);
    return await sdk.state.getTokenLifetimeFees(mintPubkey);
  } catch (error) {
    console.error(`Error fetching lifetime fees for ${tokenMint}:`, error);
    return 0;
  }
}

export async function getTokenCreators(tokenMint: string): Promise<TokenLaunchCreator[]> {
  try {
    const sdk = await getSDK();
    const mintPubkey = new PublicKey(tokenMint);
    return await sdk.state.getTokenCreators(mintPubkey);
  } catch (error) {
    console.error(`Error fetching creators for ${tokenMint}:`, error);
    return [];
  }
}

export async function getTokenClaimEvents(
  tokenMint: string,
  options?: { limit?: number; offset?: number }
): Promise<TokenClaimEvent[]> {
  try {
    const sdk = await getSDK();
    const mintPubkey = new PublicKey(tokenMint);
    return await sdk.state.getTokenClaimEvents(mintPubkey, options);
  } catch (error) {
    console.error(`Error fetching claim events for ${tokenMint}:`, error);
    return [];
  }
}

/**
 * Get claim events for the last 24 hours using time-based filtering
 * Uses Bags API v1.2.0+ time mode for accurate 24h earnings calculation
 */
export async function getTokenClaimEvents24h(
  tokenMint: string
): Promise<TokenClaimEvent[]> {
  try {
    const sdk = await getSDK();
    const mintPubkey = new PublicKey(tokenMint);
    const now = Math.floor(Date.now() / 1000);
    const twentyFourHoursAgo = now - 24 * 60 * 60;

    return await sdk.state.getTokenClaimEvents(mintPubkey, {
      mode: "time",
      from: twentyFourHoursAgo,
      to: now,
    });
  } catch (error) {
    console.error(`Error fetching 24h claim events for ${tokenMint}:`, error);
    return [];
  }
}

export async function getTokenClaimStats(tokenMint: string): Promise<any[]> {
  try {
    const sdk = await getSDK();
    const mintPubkey = new PublicKey(tokenMint);
    return await sdk.state.getTokenClaimStats(mintPubkey);
  } catch (error) {
    console.error(`Error fetching claim stats for ${tokenMint}:`, error);
    return [];
  }
}

export async function getLaunchWallet(
  username: string,
  provider: "twitter" | "tiktok" | "kick" | "github"
): Promise<WalletLookupResult | null> {
  try {
    const sdk = await getSDK();
    const result = await sdk.state.getLaunchWalletV2(username, provider);
    return {
      provider: result.provider,
      platformData: result.platformData,
      wallet: result.wallet?.toBase58() || null,
    };
  } catch (error) {
    console.error(`Error fetching wallet for ${username}:`, error);
    return null;
  }
}

export async function getLaunchWalletBulk(
  items: Array<{ username: string; provider: "twitter" | "tiktok" | "kick" | "github" }>
): Promise<WalletLookupResult[]> {
  try {
    const sdk = await getSDK();
    const results = await sdk.state.getLaunchWalletV2Bulk(items);
    return results.map((r: any) => ({
      provider: r.provider,
      platformData: r.platformData,
      wallet: r.wallet?.toBase58() || null,
    }));
  } catch (error) {
    console.error("Error fetching wallets in bulk:", error);
    return [];
  }
}

// Check if SDK is properly configured
export function isSDKConfigured(): boolean {
  return !!process.env.BAGS_API_KEY;
}
