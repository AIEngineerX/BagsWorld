// Token Launcher Service
// Launches Bags.fm tokens on behalf of external agents
//
// BagsWorld pays: Transaction fees (~0.03 SOL)
// External agent gets: 100% of trading fees forever
//
// Like Moltmint, but for Bags.fm

import { Connection, Keypair, Transaction, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { BAGS_API } from "./types";
import { ECOSYSTEM_CONFIG } from "@/lib/config";
import { saveGlobalToken, isNeonConfigured, type GlobalToken } from "@/lib/neon";

// ============================================================================
// CONFIGURATION
// ============================================================================

const BAGS_API_KEY = process.env.BAGS_API_KEY!;
const BAGS_JWT_TOKEN = process.env.BAGS_JWT_TOKEN || ""; // Optional - only for agent API
// Fall back to AGENT_WALLET_PRIVATE_KEY if no dedicated launcher key
const BAGSWORLD_PRIVATE_KEY = process.env.BAGSWORLD_LAUNCHER_PRIVATE_KEY || process.env.AGENT_WALLET_PRIVATE_KEY!;
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

// ============================================================================
// TYPES
// ============================================================================

export interface LaunchRequest {
  // External agent's wallet (receives 100% of fees)
  creatorWallet: string;

  // Token details
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;

  // Optional socials
  twitter?: string;
  website?: string;
  telegram?: string;
}

export interface LaunchResult {
  success: boolean;
  tokenMint?: string;
  metadataUrl?: string;
  signature?: string;
  bagsUrl?: string;
  explorerUrl?: string;
  error?: string;
}

export interface ClaimablePosition {
  baseMint: string;
  virtualPoolAddress: string;
  virtualPoolClaimableAmount?: string;
  dammPoolClaimableAmount?: string;
  totalClaimableLamportsUserShare?: string;
  isCustomFeeVault: boolean;
  isMigrated: boolean;
}

export interface ClaimResult {
  success: boolean;
  transactions?: string[]; // Base64 unsigned transactions
  totalClaimableLamports?: number;
  error?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function getBagsWorldKeypair(): Keypair {
  if (!BAGSWORLD_PRIVATE_KEY) {
    throw new Error("BAGSWORLD_LAUNCHER_PRIVATE_KEY not configured");
  }
  const secretKey = bs58.decode(BAGSWORLD_PRIVATE_KEY);
  return Keypair.fromSecretKey(secretKey);
}

function getConnection(): Connection {
  return new Connection(RPC_URL, "confirmed");
}

async function callBagsApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  if (!BAGS_API_KEY) {
    throw new Error("BAGS_API_KEY not configured");
  }

  const url = endpoint.startsWith("http") ? endpoint : `${BAGS_API.PUBLIC_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "x-api-key": BAGS_API_KEY,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok || data.success === false) {
    const errMsg = data.error || data.message || data.detail || JSON.stringify(data);
    console.error("[Launcher] Bags API error:", response.status, errMsg);
    throw new Error(errMsg);
  }

  return data.response || data;
}

async function callAgentApi<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  if (!BAGS_JWT_TOKEN) {
    throw new Error("BAGS_JWT_TOKEN not configured");
  }

  const url = `${BAGS_API.AGENT_BASE}${endpoint}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: BAGS_JWT_TOKEN, ...body }),
  });

  const data = await response.json();

  if (!response.ok || data.success === false) {
    throw new Error(data.error || `API error: ${response.status}`);
  }

  return data.response || data;
}

async function signAndSubmit(unsignedTxBase58: string): Promise<string> {
  const connection = getConnection();
  const keypair = getBagsWorldKeypair();

  // Decode the transaction (Bags.fm uses Base58, not Base64!)
  const txBuffer = bs58.decode(unsignedTxBase58);

  // Try versioned transaction first, fall back to legacy
  let signature: string;

  try {
    // Try as versioned transaction (V0)
    const versionedTx = VersionedTransaction.deserialize(txBuffer);
    versionedTx.sign([keypair]);
    signature = await connection.sendRawTransaction(versionedTx.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
  } catch {
    // Fall back to legacy transaction
    const legacyTx = Transaction.from(txBuffer);
    legacyTx.partialSign(keypair);
    signature = await connection.sendRawTransaction(legacyTx.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
  }

  // Wait for confirmation
  await connection.confirmTransaction(signature, "confirmed");

  return signature;
}

// ============================================================================
// LAUNCH FUNCTIONS
// ============================================================================

/**
 * Launch a token for an external agent
 * BagsWorld pays tx fees, external agent gets 100% of trading fees
 */
export async function launchForExternal(request: LaunchRequest): Promise<LaunchResult> {
  const { creatorWallet, name, symbol, description, imageUrl, twitter, website, telegram } =
    request;

  console.log(`[Launcher] Launching ${symbol} for ${creatorWallet.slice(0, 8)}...`);

  // Validate inputs
  if (!creatorWallet || creatorWallet.length < 32 || creatorWallet.length > 44) {
    return { success: false, error: "Invalid creator wallet address" };
  }

  if (!name || name.length > 32) {
    return { success: false, error: "Name must be 1-32 characters" };
  }

  if (!symbol || symbol.length > 10) {
    return { success: false, error: "Symbol must be 1-10 characters" };
  }

  // Use placeholder if no image provided
  const finalImageUrl =
    imageUrl || `https://api.dicebear.com/7.x/shapes/png?seed=${symbol}&size=400`;

  const bagsWorldWallet = getBagsWorldKeypair().publicKey.toBase58();

  // Step 1: Create token info
  console.log("[Launcher] Step 1: Creating token info...");

  const tokenInfo = await callBagsApi<{
    tokenMint: string;
    tokenMetadata: string;
  }>("/token-launch/create-token-info", {
    method: "POST",
    body: JSON.stringify({
      name,
      symbol: symbol.toUpperCase(),
      description,
      imageUrl: finalImageUrl,
      twitter: twitter || undefined,
      website: website || undefined,
      telegram: telegram || undefined,
    }),
  });

  const tokenMint = tokenInfo.tokenMint;
  const metadataUrl = tokenInfo.tokenMetadata;

  console.log(`[Launcher] Token mint: ${tokenMint}`);
  console.log(`[Launcher] Metadata URL: ${metadataUrl}`);

  // Small delay to allow Bags.fm to propagate the token info
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 2: Create fee share config for the external agent
  // Uses BagsWorld's existing partnerConfigPda - external agent gets 100% of creator fees
  console.log("[Launcher] Step 2: Creating fee share config...");

  const partnerConfigPda = ECOSYSTEM_CONFIG.ecosystem.partnerConfigPda;
  console.log(`[Launcher] Using partner config PDA: ${partnerConfigPda}`);

  // External agent gets 100% of the creator fee share
  // Using the working bags-api.ts format: claimersArray + basisPointsArray
  // NOTE: partnerConfig causes 500 errors - not including it for now
  const feeShareRequest = {
    baseMint: tokenMint,
    payer: bagsWorldWallet,
    claimersArray: [creatorWallet], // Wallet addresses that receive fees
    basisPointsArray: [10000], // 100% (10000 bps) to the external agent
  };

  console.log("[Launcher] Fee share request:", JSON.stringify(feeShareRequest, null, 2));
  console.log("[Launcher] API key configured:", !!BAGS_API_KEY, "length:", BAGS_API_KEY?.length || 0);

  let configKey: string;
  try {
    // Make raw fetch so we can see the full response
    const feeShareUrl = `${BAGS_API.PUBLIC_BASE}/fee-share/config`;
    console.log("[Launcher] Calling:", feeShareUrl);
    
    const feeShareRes = await fetch(feeShareUrl, {
      method: "POST",
      headers: {
        "x-api-key": BAGS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(feeShareRequest),
    });

    const rawText = await feeShareRes.text();
    console.log("[Launcher] Fee share raw response:", feeShareRes.status, rawText.substring(0, 500));

    if (!feeShareRes.ok) {
      throw new Error(`Fee share API ${feeShareRes.status}: ${rawText.substring(0, 300)}`);
    }

    const feeShareResponse = JSON.parse(rawText);
    const result = feeShareResponse.response || feeShareResponse;
    console.log("[Launcher] Fee share parsed:", JSON.stringify(result));

    // Extract configKey - API returns it as meteoraConfigKey
    configKey =
      result.meteoraConfigKey ||
      result.configId ||
      result.configKey ||
      result.config_key ||
      "";

    if (!configKey) {
      console.log("[Launcher] Full result for debugging:", JSON.stringify(result, null, 2));
      throw new Error("No configKey returned from fee-share config");
    }

    console.log(`[Launcher] Config key: ${configKey}`);

    // Sign any required transactions (fee config creation)
    if (result.needsCreation && result.transactions?.length) {
      console.log(`[Launcher] Signing ${result.transactions.length} fee config tx(s)...`);
      for (const tx of result.transactions) {
        await signAndSubmit(tx.transaction);
      }
    }
  } catch (err) {
    throw new Error(`Fee share config failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Step 3: Create launch transaction
  console.log("[Launcher] Step 3: Creating launch transaction...");

  // Using official Bags.fm launch format from docs
  // API expects 'ipfs' not 'metadataUrl'
  const launchBody = {
    ipfs: metadataUrl, // IPFS URL from create-token-info
    tokenMint,
    wallet: bagsWorldWallet,
    initialBuyLamports: 0,
    configKey, // From fee-share/config
  };

  console.log("[Launcher] Launch body:", JSON.stringify(launchBody));

  let launchTransaction: string;
  try {
    // Make raw fetch to see full response
    const launchUrl = `${BAGS_API.PUBLIC_BASE}/token-launch/create-launch-transaction`;
    console.log("[Launcher] Calling launch endpoint:", launchUrl);
    
    const launchRes = await fetch(launchUrl, {
      method: "POST",
      headers: {
        "x-api-key": BAGS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(launchBody),
    });

    const rawLaunchText = await launchRes.text();
    console.log("[Launcher] Launch raw response:", launchRes.status, rawLaunchText.substring(0, 500));

    if (!launchRes.ok) {
      throw new Error(`Launch API ${launchRes.status}: ${rawLaunchText.substring(0, 300)}`);
    }

    const launchData = JSON.parse(rawLaunchText);
    console.log("[Launcher] Launch parsed keys:", Object.keys(launchData));
    
    // Extract transaction from various possible response formats
    const result = launchData.response || launchData;
    launchTransaction = 
      result.transaction || 
      result.tx || 
      (typeof result === "string" ? result : "");
    
    console.log("[Launcher] Launch tx length:", launchTransaction?.length || "missing");
  } catch (err) {
    throw new Error(`Step 3 failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!launchTransaction || launchTransaction.length < 100) {
    throw new Error("No valid launch transaction returned from API");
  }

  // Step 4: Sign and submit launch transaction
  console.log("[Launcher] Step 4: Signing and submitting...");

  const signature = await signAndSubmit(launchTransaction);

  console.log(`[Launcher] ✅ Token launched: ${signature}`);

  // Step 5: Register token in BagsWorld's global registry so it appears as a building
  if (isNeonConfigured()) {
    try {
      const globalToken: GlobalToken = {
        mint: tokenMint,
        name,
        symbol: symbol.toUpperCase(),
        description,
        image_url: finalImageUrl,
        creator_wallet: creatorWallet,
        fee_shares: [
          {
            provider: "solana",
            username: creatorWallet,
            bps: 10000, // 100% to creator
          },
        ],
      };

      const registered = await saveGlobalToken(globalToken);
      if (registered) {
        console.log(`[Launcher] Token registered in BagsWorld: ${symbol}`);
      } else {
        console.warn(`[Launcher] Failed to register token in BagsWorld database`);
      }
    } catch (err) {
      console.error(`[Launcher] Token registration error:`, err);
      // Don't fail the launch if registration fails - token is still launched on-chain
    }
  } else {
    console.log(`[Launcher] Neon not configured - token won't appear as building until manually added`);
  }

  return {
    success: true,
    tokenMint,
    metadataUrl,
    signature,
    bagsUrl: `https://bags.fm/${tokenMint}`,
    explorerUrl: `https://solscan.io/tx/${signature}`,
  };
}

// ============================================================================
// CLAIM FUNCTIONS
// ============================================================================

/**
 * Get claimable positions for a wallet
 */
export async function getClaimableForWallet(wallet: string): Promise<{
  positions: ClaimablePosition[];
  totalClaimableLamports: number;
}> {
  const positions = await callBagsApi<ClaimablePosition[]>(
    `/token-launch/claimable-positions?wallet=${wallet}`
  );

  const totalClaimableLamports = positions.reduce((sum, p) => {
    const virtual = parseInt(
      p.virtualPoolClaimableAmount || p.totalClaimableLamportsUserShare || "0",
      10
    );
    const damm = parseInt(p.dammPoolClaimableAmount || "0", 10);
    return sum + virtual + damm;
  }, 0);

  return { positions, totalClaimableLamports };
}

/**
 * Generate claim transactions for an external wallet (by wallet address)
 * Returns unsigned transactions that the wallet owner must sign
 */
export async function generateClaimTxForWallet(wallet: string): Promise<ClaimResult> {
  // First get claimable positions
  const { positions, totalClaimableLamports } = await getClaimableForWallet(wallet);

  if (positions.length === 0 || totalClaimableLamports === 0) {
    return {
      success: true,
      transactions: [],
      totalClaimableLamports: 0,
    };
  }

  // Build positions array for claim request - using official Bags.fm format
  // Each position needs baseMint and virtualPoolAddress
  const positionsForClaim = positions.map((p) => ({
    baseMint: p.baseMint,
    virtualPoolAddress: p.virtualPoolAddress,
  }));

  console.log(`[Launcher] Generating claim txs for ${positionsForClaim.length} positions...`);
  
  // Generate claim transactions using official Bags.fm format
  // API expects 'feeClaimer' not 'wallet'
  const claimUrl = `${BAGS_API.PUBLIC_BASE}/token-launch/claim-txs/v2`;
  const claimRes = await fetch(claimUrl, {
    method: "POST",
    headers: {
      "x-api-key": BAGS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      feeClaimer: wallet,
      positions: positionsForClaim,
    }),
  });

  const rawText = await claimRes.text();
  console.log("[Launcher] Claim response:", claimRes.status, rawText.substring(0, 300));
  
  if (!claimRes.ok) {
    throw new Error(`Claim API ${claimRes.status}: ${rawText.substring(0, 200)}`);
  }

  const claimData = JSON.parse(rawText);
  const claimResponse = {
    transactions: (claimData.response?.transactions || claimData.transactions || []).map(
      (tx: string | { transaction: string }) => ({
        transaction: typeof tx === "string" ? tx : tx.transaction,
      })
    ),
  };

  return {
    success: true,
    transactions: claimResponse.transactions.map((t: { transaction: string }) => t.transaction),
    totalClaimableLamports,
  };
}

// ============================================================================
// STATUS CHECK
// ============================================================================

/**
 * Check if the launcher is properly configured
 */
export function isLauncherConfigured(): {
  configured: boolean;
  missing: string[];
} {
  const missing: string[] = [];

  if (!BAGS_API_KEY) missing.push("BAGS_API_KEY");
  // BAGS_JWT_TOKEN is optional - only needed for agent-specific API calls
  if (!BAGSWORLD_PRIVATE_KEY) missing.push("BAGSWORLD_LAUNCHER_PRIVATE_KEY or AGENT_WALLET_PRIVATE_KEY");

  return {
    configured: missing.length === 0,
    missing,
  };
}

/**
 * Get the launcher wallet address
 */
export function getLauncherWallet(): string | null {
  if (!BAGSWORLD_PRIVATE_KEY) return null;
  return getBagsWorldKeypair().publicKey.toBase58();
}

/**
 * Get launcher wallet balance
 */
export async function getLauncherBalance(): Promise<number> {
  const connection = getConnection();
  const keypair = getBagsWorldKeypair();
  const balance = await connection.getBalance(keypair.publicKey);
  return balance / 1_000_000_000;
}
/ /   R e d e p l o y   t r i g g e r   2 0 2 6 - 0 2 - 0 1   1 1 : 3 4 : 3 4 
 
 
