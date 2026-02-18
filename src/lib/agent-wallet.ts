// Server-side wallet for autonomous agent operations
import {
  Keypair,
  Connection,
  Transaction,
  VersionedTransaction,
  sendAndConfirmTransaction,
  PublicKey,
} from "@solana/web3.js";
import bs58 from "bs58";

let agentKeypair: Keypair | null = null;
let connection: Connection | null = null;

export interface AgentWalletConfig {
  privateKey: string; // Base58 encoded private key
  rpcUrl: string;
}

export interface AgentWalletStatus {
  configured: boolean;
  publicKey: string | null;
  balance: number;
  lastChecked: number;
}

// Initialize the agent wallet from environment
export function initAgentWallet(): Keypair | null {
  const privateKey = process.env.AGENT_WALLET_PRIVATE_KEY;
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://rpc.ankr.com/solana";

  if (!privateKey) {
    console.warn("AGENT_WALLET_PRIVATE_KEY not set - autonomous operations disabled");
    return null;
  }

  try {
    const secretKey = bs58.decode(privateKey);
    agentKeypair = Keypair.fromSecretKey(secretKey);
    connection = new Connection(rpcUrl, "confirmed");

    console.log(`Agent wallet initialized: ${agentKeypair.publicKey.toBase58()}`);
    return agentKeypair;
  } catch (error) {
    console.error("Failed to initialize agent wallet:", error);
    return null;
  }
}

export function getAgentWallet(): Keypair | null {
  if (!agentKeypair) {
    return initAgentWallet();
  }
  return agentKeypair;
}

export function getAgentConnection(): Connection {
  if (!connection) {
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://rpc.ankr.com/solana";
    connection = new Connection(rpcUrl, "confirmed");
  }
  return connection;
}

export function isAgentWalletConfigured(): boolean {
  return !!process.env.AGENT_WALLET_PRIVATE_KEY;
}

export function getAgentPublicKey(): string | null {
  const wallet = getAgentWallet();
  return wallet?.publicKey.toBase58() || null;
}

export async function getAgentBalance(): Promise<number> {
  const wallet = getAgentWallet();
  if (!wallet) return 0;

  const conn = getAgentConnection();
  try {
    const balance = await conn.getBalance(wallet.publicKey);
    return balance / 1e9; // Convert lamports to SOL
  } catch (error) {
    console.error("Failed to get agent balance:", error);
    return 0;
  }
}

export async function getAgentWalletStatus(): Promise<AgentWalletStatus> {
  const wallet = getAgentWallet();
  const balance = await getAgentBalance();

  return {
    configured: !!wallet,
    publicKey: wallet?.publicKey.toBase58() || null,
    balance,
    lastChecked: Date.now(),
  };
}

export async function signTransaction(transaction: Transaction): Promise<Transaction> {
  const wallet = getAgentWallet();
  if (!wallet) {
    throw new Error("Agent wallet not configured");
  }

  const conn = getAgentConnection();

  if (!transaction.recentBlockhash) {
    const { blockhash } = await conn.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
  }

  if (!transaction.feePayer) {
    transaction.feePayer = wallet.publicKey;
  }

  transaction.sign(wallet);
  return transaction;
}

export async function signAndSendTransaction(
  transaction: Transaction,
  options?: { skipPreflight?: boolean; maxRetries?: number }
): Promise<string> {
  const wallet = getAgentWallet();
  if (!wallet) {
    throw new Error("Agent wallet not configured");
  }

  const conn = getAgentConnection();

  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  transaction.sign(wallet);

  const signature = await conn.sendRawTransaction(transaction.serialize(), {
    skipPreflight: options?.skipPreflight ?? false,
    maxRetries: options?.maxRetries ?? 3,
  });

  await conn.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  });

  return signature;
}

export async function signAndSendBase64Transaction(
  txBase64: string,
  options?: { skipPreflight?: boolean; maxRetries?: number }
): Promise<string> {
  const wallet = getAgentWallet();
  if (!wallet) {
    throw new Error("Agent wallet not configured");
  }

  const conn = getAgentConnection();

  const txBuffer = Buffer.from(txBase64, "base64");
  const transaction = Transaction.from(txBuffer);

  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;

  transaction.signatures = [];
  transaction.feePayer = wallet.publicKey;
  transaction.sign(wallet);

  const signature = await conn.sendRawTransaction(transaction.serialize(), {
    skipPreflight: options?.skipPreflight ?? false,
    maxRetries: options?.maxRetries ?? 3,
  });

  await conn.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  });

  return signature;
}
