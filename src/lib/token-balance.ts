import { Connection, PublicKey } from "@solana/web3.js";
import { ECOSYSTEM_CONFIG } from "./config";

// BagsWorld token gate configuration from config
export const BAGSWORLD_TOKEN_MINT = ECOSYSTEM_CONFIG.casino.gateToken.mint;
export const MIN_TOKEN_BALANCE = ECOSYSTEM_CONFIG.casino.gateToken.minBalance;
export const BAGSWORLD_TOKEN_SYMBOL = ECOSYSTEM_CONFIG.casino.gateToken.symbol;
export const BAGSWORLD_BUY_URL = ECOSYSTEM_CONFIG.casino.gateToken.buyUrl;

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
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPubkey,
      { mint: mintPubkey }
    );

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
