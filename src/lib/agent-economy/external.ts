// External Agent Support
// Allows agents running on external infrastructure to interact with BagsWorld
// without storing credentials in our database.
//
// External agents:
// - Authenticate with Bags.fm on their own
// - Pass their JWT in the Authorization header
// - We validate and use it for the request, then forget it
// - No credentials stored, no custody

import { Connection, PublicKey } from '@solana/web3.js';
import { BAGS_API, lamportsToSol, solToLamports, type TradeQuote, type ClaimablePosition } from './types';

// ============================================================================
// JWT VALIDATION
// ============================================================================

interface BagsJwtPayload {
  sub: string; // User ID
  username: string;
  wallets: string[];
  iat: number;
  exp: number;
}

function decodeJwt(token: string): BagsJwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  
  const payload = parts[1];
  const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
  return JSON.parse(decoded);
}

export function validateExternalJwt(jwt: string): {
  valid: boolean;
  payload?: BagsJwtPayload;
  error?: string;
} {
  const payload = decodeJwt(jwt);
  
  if (!payload) {
    return { valid: false, error: 'Invalid JWT format' };
  }
  
  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    return { valid: false, error: 'JWT expired' };
  }
  
  // Check required fields
  if (!payload.wallets || payload.wallets.length === 0) {
    return { valid: false, error: 'JWT missing wallet information' };
  }
  
  return { valid: true, payload };
}

// ============================================================================
// EXTERNAL AGENT CONTEXT
// ============================================================================

export interface ExternalAgentContext {
  jwt: string;
  username: string;
  userId: string;
  wallets: string[];
  primaryWallet: string;
}

export function createExternalContext(jwt: string): ExternalAgentContext {
  const validation = validateExternalJwt(jwt);
  
  if (!validation.valid || !validation.payload) {
    throw new Error(validation.error || 'Invalid JWT');
  }
  
  const payload = validation.payload;
  
  return {
    jwt,
    username: payload.username,
    userId: payload.sub,
    wallets: payload.wallets,
    primaryWallet: payload.wallets[0],
  };
}

// ============================================================================
// EXTERNAL API CALLS (Using provided JWT)
// ============================================================================

async function callBagsApi<T>(
  ctx: ExternalAgentContext,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BAGS_API.AGENT_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${ctx.jwt}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  const data = await response.json();
  
  if (!response.ok || data.success === false) {
    throw new Error(data.error || `API error: ${response.status}`);
  }
  
  return data.response || data;
}

// ============================================================================
// EXTERNAL AGENT OPERATIONS
// ============================================================================

/**
 * Get wallet balance for external agent
 */
export async function getExternalBalance(ctx: ExternalAgentContext): Promise<{
  totalSol: number;
  wallets: Array<{ address: string; sol: number }>;
}> {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');
  
  const balances = await Promise.all(
    ctx.wallets.map(async (address) => {
      const pubkey = new PublicKey(address);
      const lamports = await connection.getBalance(pubkey);
      return { address, sol: lamportsToSol(lamports) };
    })
  );
  
  const totalSol = balances.reduce((sum, b) => sum + b.sol, 0);
  
  return { totalSol, wallets: balances };
}

/**
 * Get claimable positions for external agent
 */
export async function getExternalClaimable(ctx: ExternalAgentContext): Promise<{
  positions: ClaimablePosition[];
  totalClaimableSol: number;
}> {
  const data = await callBagsApi<{ positions: ClaimablePosition[] }>(
    ctx,
    '/fees/claimable'
  );
  
  const positions = data.positions || [];
  const totalClaimableSol = positions.reduce(
    (sum, p) => sum + lamportsToSol(p.totalClaimableLamports),
    0
  );
  
  return { positions, totalClaimableSol };
}

/**
 * Generate claim transactions for external agent
 */
export async function generateExternalClaimTx(ctx: ExternalAgentContext): Promise<{
  transactions: string[];
  totalClaimableLamports: number;
}> {
  const data = await callBagsApi<{
    transactions: string[];
    totalClaimableLamports: number;
  }>(ctx, '/fees/claim', { method: 'POST' });
  
  return data;
}

/**
 * Get trade quote for external agent
 */
export async function getExternalQuote(
  ctx: ExternalAgentContext,
  inputMint: string,
  outputMint: string,
  amountLamports: number
): Promise<TradeQuote> {
  const data = await callBagsApi<TradeQuote>(
    ctx,
    `/swap/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=100`
  );
  
  return data;
}

/**
 * Create swap transaction for external agent
 */
export async function createExternalSwapTx(
  ctx: ExternalAgentContext,
  quote: TradeQuote
): Promise<{ transaction: string }> {
  const data = await callBagsApi<{ transaction: string }>(
    ctx,
    '/swap/transaction',
    {
      method: 'POST',
      body: JSON.stringify({
        requestId: quote.requestId,
        userPublicKey: ctx.primaryWallet,
      }),
    }
  );
  
  return data;
}

/**
 * Submit signed transaction for external agent
 */
export async function submitExternalTransaction(
  ctx: ExternalAgentContext,
  signedTransaction: string
): Promise<{ signature: string }> {
  const data = await callBagsApi<{ signature: string }>(
    ctx,
    '/transaction/submit',
    {
      method: 'POST',
      body: JSON.stringify({ signedTransaction }),
    }
  );
  
  return data;
}

// ============================================================================
// EXTERNAL AGENT CLASS
// ============================================================================

/**
 * Stateless external agent interface
 * All operations use the provided JWT, nothing is stored
 */
export class ExternalAgent {
  private ctx: ExternalAgentContext;
  
  constructor(jwt: string) {
    this.ctx = createExternalContext(jwt);
  }
  
  get username(): string {
    return this.ctx.username;
  }
  
  get wallet(): string {
    return this.ctx.primaryWallet;
  }
  
  get wallets(): string[] {
    return this.ctx.wallets;
  }
  
  /**
   * Get SOL balance
   */
  async getBalance(): Promise<{ totalSol: number; wallets: Array<{ address: string; sol: number }> }> {
    return getExternalBalance(this.ctx);
  }
  
  /**
   * Get claimable fees
   */
  async getClaimable(): Promise<{ positions: ClaimablePosition[]; totalClaimableSol: number }> {
    return getExternalClaimable(this.ctx);
  }
  
  /**
   * Generate claim transactions (external agent signs themselves)
   */
  async generateClaimTransactions(): Promise<{ transactions: string[]; totalClaimableLamports: number }> {
    return generateExternalClaimTx(this.ctx);
  }
  
  /**
   * Get quote for a swap
   */
  async getQuote(inputMint: string, outputMint: string, amountLamports: number): Promise<TradeQuote> {
    return getExternalQuote(this.ctx, inputMint, outputMint, amountLamports);
  }
  
  /**
   * Create swap transaction (external agent signs themselves)
   */
  async createSwapTransaction(quote: TradeQuote): Promise<{ transaction: string }> {
    return createExternalSwapTx(this.ctx, quote);
  }
  
  /**
   * Submit a signed transaction
   */
  async submitTransaction(signedTransaction: string): Promise<{ signature: string }> {
    return submitExternalTransaction(this.ctx, signedTransaction);
  }
  
  /**
   * Get token balances
   */
  async getTokenBalances(): Promise<Array<{ mint: string; balance: number }>> {
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');
    
    const publicKey = new PublicKey(this.ctx.primaryWallet);
    
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
      programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
    });
    
    return tokenAccounts.value
      .map(account => {
        const info = account.account.data.parsed.info;
        return {
          mint: info.mint,
          balance: parseFloat(info.tokenAmount.uiAmountString || '0'),
        };
      })
      .filter(t => t.balance > 0);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  decodeJwt,
  callBagsApi,
};
