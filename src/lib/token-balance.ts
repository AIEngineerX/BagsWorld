import { Connection, PublicKey } from "@solana/web3.js";
import { getMint } from "@solana/spl-token";
import { ECOSYSTEM_CONFIG } from "./config";

// Cache token decimals to avoid repeated RPC calls
const decimalsCache = new Map<string, number>();

/**
 * Get the decimals for a token mint
 * @param connection Solana connection
 * @param tokenMint Token mint address
 * @returns Number of decimals (default 6 if fetch fails)
 */
export async function getTokenDecimals(connection: Connection, tokenMint: string): Promise<number> {
  // Check cache first
  if (decimalsCache.has(tokenMint)) {
    return decimalsCache.get(tokenMint)!;
  }

  // SOL has 9 decimals
  if (tokenMint === "So11111111111111111111111111111111111111112") {
    decimalsCache.set(tokenMint, 9);
    return 9;
  }

  const mintPubkey = new PublicKey(tokenMint);
  const mintInfo = await getMint(connection, mintPubkey);
  const decimals = mintInfo.decimals;

  // Cache the result
  decimalsCache.set(tokenMint, decimals);
  return decimals;
}

// BagsWorld token gate configuration from config
export const BAGSWORLD_TOKEN_MINT = ECOSYSTEM_CONFIG.casino.gateToken.mint;
export const MIN_TOKEN_BALANCE = ECOSYSTEM_CONFIG.casino.gateToken.minBalance;
export const BAGSWORLD_TOKEN_SYMBOL = ECOSYSTEM_CONFIG.casino.gateToken.symbol;
export const BAGSWORLD_BUY_URL = ECOSYSTEM_CONFIG.casino.gateToken.buyUrl;

// Oracle-specific token gate (higher requirement than casino)
export const ORACLE_MIN_BALANCE = ECOSYSTEM_CONFIG.oracle.gateToken.minBalance;
export const ORACLE_PRIZE_CONFIG = ECOSYSTEM_CONFIG.oracle.prizePool;

/**
 * Get the balance of a specific SPL token for a wallet
 * @param connection Solana connection
 * @param walletPubkey Wallet public key
 * @param tokenMint Token mint address
 * @returns Token balance (adjusted for decimals)
 */
export async function getTokenBalance(
  connection: Connection,
  walletPubkey: PublicKey,
  tokenMint: string
): Promise<number> {
  try {
    const mintPubkey = new PublicKey(tokenMint);

    // Get all token accounts owned by this wallet for the specific mint
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(walletPubkey, {
      mint: mintPubkey,
    });

    if (tokenAccounts.value.length === 0) {
      return 0;
    }

    // Sum up all token account balances (usually there's only one)
    let totalBalance = 0;
    for (const account of tokenAccounts.value) {
      const parsedInfo = account.account.data.parsed?.info;
      if (parsedInfo?.tokenAmount?.uiAmount) {
        totalBalance += parsedInfo.tokenAmount.uiAmount;
      }
    }

    return totalBalance;
  } catch (error) {
    console.error("Error fetching token balance:", error);
    return 0;
  }
}

/**
 * Check if a wallet has enough tokens to access the casino
 * @param connection Solana connection
 * @param walletPubkey Wallet public key
 * @returns True if wallet has minimum required tokens
 */
export async function hasCasinoAccess(
  connection: Connection,
  walletPubkey: PublicKey
): Promise<boolean> {
  const balance = await getTokenBalance(connection, walletPubkey, BAGSWORLD_TOKEN_MINT);
  return balance >= MIN_TOKEN_BALANCE;
}

/**
 * Get casino access info including balance and access status
 * @param connection Solana connection
 * @param walletPubkey Wallet public key
 * @returns Object with balance, hasAccess, and minRequired
 */
export async function getCasinoAccessInfo(
  connection: Connection,
  walletPubkey: PublicKey
): Promise<{
  balance: number;
  hasAccess: boolean;
  minRequired: number;
}> {
  const balance = await getTokenBalance(connection, walletPubkey, BAGSWORLD_TOKEN_MINT);
  return {
    balance,
    hasAccess: balance >= MIN_TOKEN_BALANCE,
    minRequired: MIN_TOKEN_BALANCE,
  };
}

/**
 * Check if a wallet has enough tokens to access Oracle predictions
 * @param connection Solana connection
 * @param walletPubkey Wallet public key
 * @returns True if wallet has minimum required tokens (2M)
 */
export async function hasOracleAccess(
  connection: Connection,
  walletPubkey: PublicKey
): Promise<boolean> {
  const balance = await getTokenBalance(connection, walletPubkey, BAGSWORLD_TOKEN_MINT);
  return balance >= ORACLE_MIN_BALANCE;
}

/**
 * Get Oracle access info including balance and access status
 * @param connection Solana connection
 * @param walletPubkey Wallet public key
 * @returns Object with balance, hasAccess, and minRequired
 */
export async function getOracleAccessInfo(
  connection: Connection,
  walletPubkey: PublicKey
): Promise<{
  balance: number;
  hasAccess: boolean;
  minRequired: number;
}> {
  const balance = await getTokenBalance(connection, walletPubkey, BAGSWORLD_TOKEN_MINT);
  return {
    balance,
    hasAccess: balance >= ORACLE_MIN_BALANCE,
    minRequired: ORACLE_MIN_BALANCE,
  };
}
