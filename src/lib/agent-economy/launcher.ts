// Token Launcher Service (Pokécenter)
// Launches Bags.fm tokens on behalf of external agents
//
// BagsWorld pays: Transaction fees (~0.03 SOL)
// External agent gets: 100% of trading fees forever
//
// Like Moltmint, but for Bags.fm
//
// SAFETY FEATURES:
// - Rate limiting per wallet (10/day) and global (100/day)
// - Input sanitization (name, symbol, description)
// - Wallet format validation
// - Abuse detection (duplicate symbols, suspicious patterns)
// - Non-custodial: we never touch user private keys

import { Connection, Keypair, Transaction, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { BAGS_API } from "./types";
import { ECOSYSTEM_CONFIG } from "@/lib/config";
import { saveGlobalToken, isNeonConfigured, type GlobalToken } from "@/lib/neon";

// ============================================================================
// RATE LIMITING & SAFETY
// ============================================================================

// In-memory rate limiting (resets on server restart)
// For production, use Redis or similar
const launchCounts = new Map<string, { count: number; resetAt: number }>();
let globalLaunchCount = { count: 0, resetAt: Date.now() + 24 * 60 * 60 * 1000 };
const recentSymbols = new Map<string, number>(); // symbol -> timestamp

const RATE_LIMITS = {
  perWalletPerDay: 10,
  globalPerDay: 100,
  symbolCooldownMs: 60 * 60 * 1000, // 1 hour between same symbol launches
};

/**
 * Check if a wallet can launch (rate limiting)
 */
export function canWalletLaunch(wallet: string): { allowed: boolean; reason?: string } {
  const now = Date.now();
  
  // Reset global counter if day has passed
  if (now > globalLaunchCount.resetAt) {
    globalLaunchCount = { count: 0, resetAt: now + 24 * 60 * 60 * 1000 };
  }
  
  // Check global limit
  if (globalLaunchCount.count >= RATE_LIMITS.globalPerDay) {
    return { allowed: false, reason: "Global daily launch limit reached. Try again tomorrow." };
  }
  
  // Get or create wallet entry
  let walletEntry = launchCounts.get(wallet);
  if (!walletEntry || now > walletEntry.resetAt) {
    walletEntry = { count: 0, resetAt: now + 24 * 60 * 60 * 1000 };
    launchCounts.set(wallet, walletEntry);
  }
  
  // Check per-wallet limit
  if (walletEntry.count >= RATE_LIMITS.perWalletPerDay) {
    return { allowed: false, reason: `Wallet limit reached (${RATE_LIMITS.perWalletPerDay}/day). Try again tomorrow.` };
  }
  
  return { allowed: true };
}

/**
 * Record a successful launch (for rate limiting)
 */
function recordLaunch(wallet: string, symbol: string): void {
  const now = Date.now();
  
  // Increment counters
  globalLaunchCount.count++;
  
  const walletEntry = launchCounts.get(wallet);
  if (walletEntry) {
    walletEntry.count++;
  }
  
  // Track symbol
  recentSymbols.set(symbol.toUpperCase(), now);
}

/**
 * Check if symbol was recently used (abuse prevention)
 */
function isSymbolRecentlyUsed(symbol: string): boolean {
  const lastUsed = recentSymbols.get(symbol.toUpperCase());
  if (!lastUsed) return false;
  return Date.now() - lastUsed < RATE_LIMITS.symbolCooldownMs;
}

/**
 * Sanitize and validate token name
 */
function sanitizeTokenName(name: string): { valid: boolean; sanitized: string; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, sanitized: '', error: 'Name is required' };
  }
  
  // Trim and limit length
  const sanitized = name.trim().substring(0, 32);
  
  if (sanitized.length < 1) {
    return { valid: false, sanitized: '', error: 'Name must be at least 1 character' };
  }
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /^\s*$/,  // Only whitespace
    /<script/i,  // XSS attempt
    /javascript:/i,  // XSS attempt
    /on\w+=/i,  // Event handler injection
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(sanitized)) {
      return { valid: false, sanitized: '', error: 'Invalid characters in name' };
    }
  }
  
  return { valid: true, sanitized };
}

/**
 * Sanitize and validate token symbol
 */
function sanitizeTokenSymbol(symbol: string): { valid: boolean; sanitized: string; error?: string } {
  if (!symbol || typeof symbol !== 'string') {
    return { valid: false, sanitized: '', error: 'Symbol is required' };
  }
  
  // Uppercase, remove non-alphanumeric, limit length
  const sanitized = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10);
  
  if (sanitized.length < 1) {
    return { valid: false, sanitized: '', error: 'Symbol must be at least 1 alphanumeric character' };
  }
  
  if (sanitized.length > 10) {
    return { valid: false, sanitized: '', error: 'Symbol must be 10 characters or less' };
  }
  
  return { valid: true, sanitized };
}

/**
 * Validate Solana wallet address
 */
function validateWalletAddress(wallet: string): { valid: boolean; error?: string } {
  if (!wallet || typeof wallet !== 'string') {
    return { valid: false, error: 'Wallet address is required' };
  }
  
  // Basic format check
  if (wallet.length < 32 || wallet.length > 44) {
    return { valid: false, error: 'Invalid wallet address length' };
  }
  
  // Check for valid base58 characters
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  if (!base58Regex.test(wallet)) {
    return { valid: false, error: 'Invalid wallet address format (must be base58)' };
  }
  
  return { valid: true };
}

/**
 * Sanitize description
 */
function sanitizeDescription(description: string): string {
  if (!description || typeof description !== 'string') {
    return '';
  }
  
  // Remove potentially dangerous content
  return description
    .replace(/<[^>]*>/g, '')  // Remove HTML tags
    .replace(/javascript:/gi, '')  // Remove JS protocol
    .substring(0, 500)  // Limit length
    .trim();
}

/**
 * Validate image URL
 */
function validateImageUrl(url: string): { valid: boolean; sanitized: string; error?: string } {
  if (!url || typeof url !== 'string') {
    // Return placeholder if no URL
    return { valid: true, sanitized: '' };
  }
  
  const trimmed = url.trim();
  
  // Must be https
  if (!trimmed.startsWith('https://')) {
    return { valid: false, sanitized: '', error: 'Image URL must use HTTPS' };
  }
  
  // Basic URL validation
  try {
    new URL(trimmed);
  } catch {
    return { valid: false, sanitized: '', error: 'Invalid image URL format' };
  }
  
  // Block data URLs (potential XSS)
  if (trimmed.startsWith('data:')) {
    return { valid: false, sanitized: '', error: 'Data URLs not allowed' };
  }
  
  return { valid: true, sanitized: trimmed };
}

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
  // Either creatorWallet OR moltbookUsername is required
  creatorWallet?: string;
  
  // Alternative: Moltbook username (we'll look up their wallet)
  moltbookUsername?: string;

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

  // Decode the transaction (Bags.fm uses Base58)
  const txBuffer = bs58.decode(unsignedTxBase58);

  let signature: string;

  // Try versioned transaction first (most common now), fall back to legacy
  try {
    const versionedTx = VersionedTransaction.deserialize(txBuffer);
    versionedTx.sign([keypair]);
    signature = await connection.sendRawTransaction(versionedTx.serialize(), {
      skipPreflight: true,
      preflightCommitment: "confirmed",
      maxRetries: 3,
    });
    console.log("[Launcher] Sent versioned transaction:", signature);
  } catch (versionedErr) {
    // Fall back to legacy transaction
    try {
      const legacyTx = Transaction.from(txBuffer);
      legacyTx.partialSign(keypair);
      signature = await connection.sendRawTransaction(legacyTx.serialize(), {
        skipPreflight: true,
        preflightCommitment: "confirmed",
        maxRetries: 3,
      });
      console.log("[Launcher] Sent legacy transaction:", signature);
    } catch (legacyErr) {
      console.error("[Launcher] Both versioned and legacy parsing failed");
      console.error("[Launcher] Versioned error:", versionedErr);
      console.error("[Launcher] Legacy error:", legacyErr);
      throw versionedErr; // Throw the original error
    }
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
 * 
 * SAFETY CHECKS:
 * - Wallet address validation
 * - Rate limiting (per wallet + global)
 * - Input sanitization
 * - Symbol cooldown (prevent spam)
 */
export async function launchForExternal(request: LaunchRequest): Promise<LaunchResult> {
  const { creatorWallet, moltbookUsername, twitter, website, telegram } = request;

  // ========== VALIDATION & SANITIZATION ==========
  
  // 1. Must have either wallet or moltbookUsername
  if (!creatorWallet && !moltbookUsername) {
    return { success: false, error: "Either wallet or moltbookUsername is required" };
  }

  // 2. Resolve wallet address (lookup if using moltbookUsername)
  let resolvedWallet: string;
  let useMoltbookIdentity = false;
  
  if (moltbookUsername) {
    // Look up wallet from Moltbook username
    console.log(`[Launcher] Looking up wallet for Moltbook user: ${moltbookUsername}`);
    try {
      const lookupUrl = `${BAGS_API.PUBLIC_BASE}/token-launch/fee-share/wallet/v2?provider=moltbook&username=${encodeURIComponent(moltbookUsername)}`;
      const lookupRes = await fetch(lookupUrl, {
        headers: { "x-api-key": BAGS_API_KEY },
      });
      const lookupData = await lookupRes.json();
      
      if (!lookupRes.ok || !lookupData.success || !lookupData.response?.wallet) {
        return { success: false, error: `Moltbook user "${moltbookUsername}" not found or has no linked wallet` };
      }
      
      resolvedWallet = lookupData.response.wallet;
      useMoltbookIdentity = true;
      console.log(`[Launcher] Resolved ${moltbookUsername} → ${resolvedWallet.slice(0, 8)}...`);
    } catch (err) {
      return { success: false, error: `Failed to lookup Moltbook user: ${err instanceof Error ? err.message : String(err)}` };
    }
  } else {
    // Validate provided wallet address
    const walletCheck = validateWalletAddress(creatorWallet!);
    if (!walletCheck.valid) {
      return { success: false, error: walletCheck.error };
    }
    resolvedWallet = creatorWallet!;
  }

  // 3. Check rate limits (using resolved wallet)
  const rateCheck = canWalletLaunch(resolvedWallet);
  if (!rateCheck.allowed) {
    return { success: false, error: rateCheck.reason };
  }

  // 3. Sanitize token name
  const nameCheck = sanitizeTokenName(request.name);
  if (!nameCheck.valid) {
    return { success: false, error: nameCheck.error };
  }
  const name = nameCheck.sanitized;

  // 4. Sanitize symbol
  const symbolCheck = sanitizeTokenSymbol(request.symbol);
  if (!symbolCheck.valid) {
    return { success: false, error: symbolCheck.error };
  }
  const symbol = symbolCheck.sanitized;

  // 5. Check symbol cooldown (prevent rapid same-symbol launches)
  if (isSymbolRecentlyUsed(symbol)) {
    return { success: false, error: `Symbol ${symbol} was recently used. Try a different symbol or wait 1 hour.` };
  }

  // 6. Sanitize description
  const description = sanitizeDescription(request.description) || `Token launched via BagsWorld Pokécenter`;

  // 7. Validate image URL
  const imageCheck = validateImageUrl(request.imageUrl || '');
  if (!imageCheck.valid) {
    return { success: false, error: imageCheck.error };
  }

  // Use placeholder if no image provided
  const finalImageUrl =
    imageCheck.sanitized || `https://api.dicebear.com/7.x/shapes/png?seed=${symbol}&size=400`;

  console.log(`[Launcher] Launching ${symbol} for ${useMoltbookIdentity ? `@${moltbookUsername}` : resolvedWallet.slice(0, 8)}...`);

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
  // Using official Bags.fm feeClaimers format (see bags.fm/launch.md)
  // ALWAYS use the resolved wallet address - this ensures:
  // 1. Consistent fee claiming regardless of how identity was provided
  // 2. Agent can claim with their wallet whether they launched via moltbookUsername or wallet
  // NOTE: payer must match the signer (launcher wallet) for the transaction to be valid
  const feeShareRequest = {
    baseMint: tokenMint,
    payer: bagsWorldWallet,
    feeClaimers: [
      { user: resolvedWallet, userBps: 10000 } // 100% to the agent
    ],
  };

  if (useMoltbookIdentity) {
    console.log(`[Launcher] Moltbook @${moltbookUsername} → wallet ${resolvedWallet.slice(0, 8)}...`);
  }
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
      // Include request details in error for debugging
      const debugDetails = JSON.stringify({
        url: feeShareUrl,
        request: feeShareRequest,
        apiKeyPrefix: BAGS_API_KEY?.substring(0, 10),
        apiKeyLen: BAGS_API_KEY?.length,
      });
      throw new Error(`Fee share API ${feeShareRes.status}: ${rawText.substring(0, 200)} | DEBUG: ${debugDetails}`);
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
    console.log(`[Launcher] ✅ Fee share configured: 100% to ${useMoltbookIdentity ? `@${moltbookUsername}` : resolvedWallet}`);

    // Sign any required transactions (fee config creation)
    if (result.needsCreation && result.transactions?.length) {
      console.log(`[Launcher] Signing ${result.transactions.length} fee config tx(s)...`);
      for (const tx of result.transactions) {
        await signAndSubmit(tx.transaction);
      }
      console.log(`[Launcher] ✅ Fee config transactions submitted`);
    }
  } catch (err) {
    console.error(`[Launcher] ❌ Fee share config failed for ${creatorWallet}:`, err);
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
        creator_wallet: resolvedWallet,
        fee_shares: [
          {
            provider: useMoltbookIdentity ? "moltbook" : "solana",
            username: useMoltbookIdentity ? moltbookUsername! : resolvedWallet,
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

  // Record successful launch for rate limiting
  recordLaunch(resolvedWallet, symbol);

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

  console.log(`[Launcher] Generating claim txs for ${positions.length} positions...`);
  
  // Build positions array for claim request - per Bags FEES.md documentation
  // API expects: { wallet: string, positions: [{baseMint, virtualPoolAddress}] }
  const positionsForClaim = positions.map((p) => ({
    baseMint: p.baseMint,
    virtualPoolAddress: p.virtualPoolAddress,
  }));

  const claimUrl = `${BAGS_API.PUBLIC_BASE}/token-launch/claim-txs/v2`;
  const claimRes = await fetch(claimUrl, {
    method: "POST",
    headers: {
      "x-api-key": BAGS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      wallet: wallet,
      positions: positionsForClaim,
    }),
  });

  const rawText = await claimRes.text();
  console.log("[Launcher] Claim response:", claimRes.status, rawText.substring(0, 300));
  
  if (!claimRes.ok) {
    throw new Error(`Claim API ${claimRes.status}: ${rawText.substring(0, 200)}`);
  }

  const claimData = JSON.parse(rawText);
  const txs = claimData.response?.transactions || claimData.transactions || [];
  
  const allTransactions: string[] = [];
  for (const tx of txs) {
    const txString = typeof tx === "string" ? tx : tx.transaction;
    if (txString) allTransactions.push(txString);
  }
  
  console.log(`[Launcher] Got ${allTransactions.length} claim transaction(s)`);
  
  return {
    success: true,
    transactions: allTransactions,
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

/**
 * Get current rate limit status (for transparency/debugging)
 */
export function getRateLimitStatus(wallet?: string): {
  global: { used: number; limit: number; resetsAt: string };
  wallet?: { used: number; limit: number; resetsAt: string };
} {
  const now = Date.now();
  
  // Reset global if needed
  if (now > globalLaunchCount.resetAt) {
    globalLaunchCount = { count: 0, resetAt: now + 24 * 60 * 60 * 1000 };
  }
  
  const result: ReturnType<typeof getRateLimitStatus> = {
    global: {
      used: globalLaunchCount.count,
      limit: RATE_LIMITS.globalPerDay,
      resetsAt: new Date(globalLaunchCount.resetAt).toISOString(),
    },
  };
  
  if (wallet) {
    const walletEntry = launchCounts.get(wallet);
    if (walletEntry && now <= walletEntry.resetAt) {
      result.wallet = {
        used: walletEntry.count,
        limit: RATE_LIMITS.perWalletPerDay,
        resetsAt: new Date(walletEntry.resetAt).toISOString(),
      };
    } else {
      result.wallet = {
        used: 0,
        limit: RATE_LIMITS.perWalletPerDay,
        resetsAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
      };
    }
  }
  
  return result;
}
