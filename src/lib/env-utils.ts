/**
 * Detect if running in a production runtime environment (Netlify).
 * Returns false during `next build` even though NODE_ENV=production,
 * so the build can complete without secrets configured.
 */
export function isProduction(): boolean {
  if (process.env.NETLIFY === "true" || !!process.env.NETLIFY_DATABASE_URL) {
    return true;
  }

  // Build phase (next build) — allow fallbacks even with NODE_ENV=production
  if (process.env.NODE_ENV === "production" && !process.env.NETLIFY) {
    return false;
  }

  return false;
}

/**
 * Get a required secret. Throws in production if missing,
 * uses devFallback otherwise.
 */
export function getRequiredSecret(name: string, devFallback: string): string {
  const value = process.env[name];

  if (value) {
    return value;
  }

  if (!isProduction()) {
    console.warn(`[Env] ${name} not set - using development fallback`);
    return devFallback;
  }

  throw new Error(`Missing required env var in production: ${name}`);
}

/** Validate a secret meets minimum length in production. */
export function validateSecretStrength(name: string, value: string, minLength: number = 32): void {
  if (!isProduction()) return;

  if (value.length < minLength) {
    throw new Error(
      `${name} must be at least ${minLength} characters in production (got ${value.length})`
    );
  }
}

/** Validate a Solana wallet/mint address (base58-encoded 32-byte public key). */
export function isValidSolanaAddress(address: unknown): address is string {
  if (typeof address !== "string") {
    return false;
  }

  if (address.length < 32 || address.length > 44) {
    return false;
  }

  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  if (!base58Regex.test(address)) {
    return false;
  }

  try {
    const { PublicKey } = require("@solana/web3.js");
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/** Alias — mint addresses use the same validation as wallet addresses. */
export const isValidMintAddress = isValidSolanaAddress;

/** Strip dangerous characters for safe storage/display. */
export function sanitizeString(input: unknown, maxLength: number = 1000): string {
  if (typeof input !== "string") {
    return "";
  }

  return input
    .slice(0, maxLength)
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();
}

/** Validate basis points value is an integer in [min, max]. */
export function isValidBps(bps: unknown, min: number = 0, max: number = 10000): bps is number {
  if (typeof bps !== "number" || !Number.isInteger(bps)) {
    return false;
  }
  return bps >= min && bps <= max;
}

export function getEnvList(name: string): string[] {
  const value = process.env[name];
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

// --- Solana RPC helpers ---
// Split RPCs to save Helius credits: free RPC for reads, Helius for transactions.

const FREE_RPC = "https://rpc.ankr.com/solana";

/** Server-side read queries (getAccountInfo, getBalance, etc.) — free RPC. */
export function getReadRpcUrl(): string {
  return process.env.SERVER_READ_RPC_URL || FREE_RPC;
}

/** Transaction signing/sending — premium RPC (Helius). */
export function getWriteRpcUrl(): string {
  return process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || FREE_RPC;
}

// SSRF protection
const BLOCKED_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

const BLOCKED_HOSTNAMES = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "metadata.google.internal",
  "169.254.169.254",
  "metadata.google",
];

/** Validate URL is safe from SSRF (no internal IPs, allowed protocols only). */
export function validateUrlSafe(
  urlString: string,
  options: {
    allowedProtocols?: string[];
    maxLength?: number;
  } = {}
): { isValid: boolean; error?: string } {
  const { allowedProtocols = ["https:", "http:", "ipfs:"], maxLength = 2048 } = options;

  if (urlString.length > maxLength) {
    return { isValid: false, error: "URL too long" };
  }

  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return { isValid: false, error: "Invalid URL format" };
  }

  if (!allowedProtocols.includes(url.protocol)) {
    return { isValid: false, error: `Protocol not allowed: ${url.protocol}` };
  }

  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return { isValid: false, error: "Blocked hostname" };
  }

  for (const pattern of BLOCKED_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return { isValid: false, error: "Internal IP addresses not allowed" };
    }
  }

  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    const parts = hostname.split(".").map(Number);
    if (
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 169 && parts[1] === 254) ||
      parts[0] === 0
    ) {
      return { isValid: false, error: "Internal IP addresses not allowed" };
    }
  }

  return { isValid: true };
}
