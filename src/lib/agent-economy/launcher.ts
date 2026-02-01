// Token Launcher Service
// Launches Bags.fm tokens on behalf of external agents
// 
// BagsWorld pays: Transaction fees (~0.03 SOL)
// External agent gets: 100% of trading fees forever
//
// Like Moltmint, but for Bags.fm

import { Connection, Keypair, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { BAGS_API } from './types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const BAGS_API_KEY = process.env.BAGS_API_KEY!;
const BAGS_JWT_TOKEN = process.env.BAGS_JWT_TOKEN!;
const BAGSWORLD_PRIVATE_KEY = process.env.BAGSWORLD_LAUNCHER_PRIVATE_KEY!;
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

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
    throw new Error('BAGSWORLD_LAUNCHER_PRIVATE_KEY not configured');
  }
  const secretKey = bs58.decode(BAGSWORLD_PRIVATE_KEY);
  return Keypair.fromSecretKey(secretKey);
}

function getConnection(): Connection {
  return new Connection(RPC_URL, 'confirmed');
}

async function callBagsApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (!BAGS_API_KEY) {
    throw new Error('BAGS_API_KEY not configured');
  }
  
  const url = endpoint.startsWith('http') ? endpoint : `${BAGS_API.PUBLIC_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'x-api-key': BAGS_API_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  const data = await response.json();
  
  if (!response.ok || data.success === false) {
    const errMsg = data.error || data.message || data.detail || JSON.stringify(data);
    console.error('[Launcher] Bags API error:', response.status, errMsg);
    throw new Error(errMsg);
  }
  
  return data.response || data;
}

async function callAgentApi<T>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<T> {
  if (!BAGS_JWT_TOKEN) {
    throw new Error('BAGS_JWT_TOKEN not configured');
  }
  
  const url = `${BAGS_API.AGENT_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: BAGS_JWT_TOKEN, ...body }),
  });
  
  const data = await response.json();
  
  if (!response.ok || data.success === false) {
    throw new Error(data.error || `API error: ${response.status}`);
  }
  
  return data.response || data;
}

async function signAndSubmit(unsignedTxBase64: string): Promise<string> {
  const connection = getConnection();
  const keypair = getBagsWorldKeypair();
  
  // Decode the transaction
  const txBuffer = Buffer.from(unsignedTxBase64, 'base64');
  const transaction = Transaction.from(txBuffer);
  
  // Sign with our keypair
  transaction.partialSign(keypair);
  
  // Submit
  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });
  
  // Wait for confirmation
  await connection.confirmTransaction(signature, 'confirmed');
  
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
  const { creatorWallet, name, symbol, description, imageUrl, twitter, website, telegram } = request;
  
  console.log(`[Launcher] Launching ${symbol} for ${creatorWallet.slice(0, 8)}...`);
  
  // Validate inputs
  if (!creatorWallet || creatorWallet.length < 32 || creatorWallet.length > 44) {
    return { success: false, error: 'Invalid creator wallet address' };
  }
  
  if (!name || name.length > 32) {
    return { success: false, error: 'Name must be 1-32 characters' };
  }
  
  if (!symbol || symbol.length > 10) {
    return { success: false, error: 'Symbol must be 1-10 characters' };
  }
  
  // Use placeholder if no image provided
  const finalImageUrl = imageUrl || `https://api.dicebear.com/7.x/shapes/png?seed=${symbol}&size=400`;
  
  const bagsWorldWallet = getBagsWorldKeypair().publicKey.toBase58();
  
  // Step 1: Create token info
  console.log('[Launcher] Step 1: Creating token info...');
  
  const tokenInfo = await callBagsApi<{
    tokenMint: string;
    tokenMetadata: string;
  }>('/token-launch/create-token-info', {
    method: 'POST',
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
  
  // Step 2: Create fee share config (100% to external agent)
  console.log('[Launcher] Step 2: Creating fee share config...');
  
  const configResponse = await callBagsApi<{
    configKey: string;
    transactions?: Array<{ transaction: string }>;
  }>('/fee-share/config', {
    method: 'POST',
    body: JSON.stringify({
      payer: bagsWorldWallet,
      baseMint: tokenMint,
      claimersArray: [creatorWallet],      // Array of wallet addresses
      basisPointsArray: [10000],            // 100% = 10000 bps
    }),
  });
  
  const configKey = configResponse.configKey;
  console.log(`[Launcher] Config key: ${configKey}`);
  
  // Sign and submit config transactions if needed
  if (configResponse.transactions && configResponse.transactions.length > 0) {
    console.log(`[Launcher] Signing ${configResponse.transactions.length} config tx(s)...`);
    
    for (const tx of configResponse.transactions) {
      await signAndSubmit(tx.transaction);
    }
  }
  
  // Step 3: Create launch transaction
  console.log('[Launcher] Step 3: Creating launch transaction...');
  
  const launchResponse = await callBagsApi<{
    transaction: string;
  }>('/token-launch/create-launch-transaction', {
    method: 'POST',
    body: JSON.stringify({
      metadataUrl,
      tokenMint,
      wallet: bagsWorldWallet,
      initialBuyLamports: 0, // No initial buy
      configKey,
    }),
  });
  
  // Step 4: Sign and submit launch transaction
  console.log('[Launcher] Step 4: Signing and submitting...');
  
  const signature = await signAndSubmit(launchResponse.transaction);
  
  console.log(`[Launcher] ✅ Token launched: ${signature}`);
  
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
    const virtual = parseInt(p.virtualPoolClaimableAmount || p.totalClaimableLamportsUserShare || '0', 10);
    const damm = parseInt(p.dammPoolClaimableAmount || '0', 10);
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
  
  // Build positions array for claim request
  const positionsForClaim = positions.map(p => ({
    baseMint: p.baseMint,
    virtualPoolAddress: p.virtualPoolAddress,
  }));
  
  // Generate claim transactions
  const claimResponse = await callBagsApi<{
    transactions: Array<{ transaction: string }>;
  }>('/token-launch/claim-txs/v2', {
    method: 'POST',
    body: JSON.stringify({
      wallet,
      positions: positionsForClaim,
    }),
  });
  
  return {
    success: true,
    transactions: claimResponse.transactions.map(t => t.transaction),
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
  
  if (!BAGS_API_KEY) missing.push('BAGS_API_KEY');
  if (!BAGS_JWT_TOKEN) missing.push('BAGS_JWT_TOKEN');
  if (!BAGSWORLD_PRIVATE_KEY) missing.push('BAGSWORLD_LAUNCHER_PRIVATE_KEY');
  
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
