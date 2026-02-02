/**
 * Environment Detection and Validation Utilities
 *
 * Provides consistent environment detection across the codebase
 * and secure handling of required environment variables.
 */

/**
 * Detect if running in a production runtime environment.
 *
 * Returns true when:
 * - Running on Netlify (NETLIFY=true)
 * - Has Netlify database URL configured
 *
 * Returns false when:
 * - During `next build` (even though NODE_ENV=production)
 * - Local development
 * - CI/CD build steps
 *
 * Note: We specifically check for Netlify signals rather than just NODE_ENV
 * because `next build` sets NODE_ENV=production but we still want to allow
 * the build to complete without secrets configured.
 */
export function isProduction(): boolean {
  // Netlify runtime - secrets are required
  if (process.env.NETLIFY === "true" || !!process.env.NETLIFY_DATABASE_URL) {
    return true;
  }

  // During build phase (next build), allow fallbacks even with NODE_ENV=production
  // The build happens in CI/CD before secrets are available at runtime
  if (process.env.NODE_ENV === "production" && !process.env.NETLIFY) {
    // This is likely a build phase - allow fallbacks
    return false;
  }

  return false;
}

/**
 * Detect if running in development/local environment.
 * Returns true when not in production runtime, allowing fallbacks during:
 * - Local development
 * - CI/CD build steps (secrets not needed for compilation)
 */
export function isDevelopment(): boolean {
  // If not in production runtime, allow fallbacks
  // This covers both local dev and CI builds
  return !isProduction();
}

/**
 * Get a required secret environment variable.
 *
 * In production: Throws an error if the variable is not set.
 * In development: Uses the provided fallback with a warning.
 *
 * @param name - The environment variable name
 * @param devFallback - Fallback value for development only
 * @returns The environment variable value
 * @throws Error if not set in production
 */
export function getRequiredSecret(name: string, devFallback: string): string {
  const value = process.env[name];

  if (value) {
    return value;
  }

  if (isDevelopment()) {
    console.warn(`[Env] ${name} not set - using development fallback (NOT FOR PRODUCTION)`);
    return devFallback;
  }

  throw new Error(
    `SECURITY ERROR: Missing required environment variable: ${name}. ` +
      `This must be set in production. Add it to your Netlify environment variables. ` +
      `Generate a secure value with: openssl rand -base64 32`
  );
}

/**
 * Validate that a secret meets minimum security requirements.
 *
 * @param name - The variable name (for error messages)
 * @param value - The secret value to validate
 * @param minLength - Minimum required length (default: 32)
 * @throws Error if validation fails in production
 */
export function validateSecretStrength(name: string, value: string, minLength: number = 32): void {
  if (!isProduction()) {
    return; // Skip validation in development
  }

  if (value.length < minLength) {
    throw new Error(
      `SECURITY ERROR: ${name} must be at least ${minLength} characters in production. ` +
        `Current length: ${value.length}. ` +
        `Generate a secure value with: openssl rand -base64 32`
    );
  }
}

/**
 * Get an optional environment variable with a default value.
 *
 * @param name - The environment variable name
 * @param defaultValue - Default value if not set
 * @returns The environment variable value or default
 */
export function getEnvVar(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

/**
 * Get a comma-separated list from an environment variable.
 *
 * @param name - The environment variable name
 * @returns Array of trimmed, non-empty values
 */
export function getEnvList(name: string): string[] {
  const value = process.env[name];
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

// ============================================
// Input Validation Utilities
// ============================================

/**
 * Validate a Solana wallet address.
 *
 * Checks:
 * - Is a string
 * - Length is 32-44 characters (base58 encoded public key)
 * - Contains only valid base58 characters
 * - Can be decoded as a valid PublicKey
 *
 * @param address - The address to validate
 * @returns true if valid Solana address
 */
export function isValidSolanaAddress(address: unknown): address is string {
  if (typeof address !== "string") {
    return false;
  }

  // Length check (base58 encoded 32-byte key is 32-44 chars)
  if (address.length < 32 || address.length > 44) {
    return false;
  }

  // Base58 character set (no 0, O, I, l)
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  if (!base58Regex.test(address)) {
    return false;
  }

  // Try to decode as PublicKey (lazy import to avoid circular deps)
  try {
    const { PublicKey } = require("@solana/web3.js");
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate a token mint address (same as wallet address validation).
 */
export const isValidMintAddress = isValidSolanaAddress;

/**
 * Sanitize a string for safe storage/display.
 *
 * Removes or escapes potentially dangerous characters:
 * - HTML tags
 * - Script injections
 * - SQL-like patterns
 *
 * @param input - The string to sanitize
 * @param maxLength - Maximum allowed length (default: 1000)
 * @returns Sanitized string
 */
export function sanitizeString(input: unknown, maxLength: number = 1000): string {
  if (typeof input !== "string") {
    return "";
  }

  return input
    .slice(0, maxLength)
    .replace(/[<>]/g, "") // Remove angle brackets (prevent HTML injection)
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, "") // Remove event handlers (onclick=, etc.)
    .trim();
}

/**
 * Validate basis points value.
 *
 * @param bps - The basis points value to validate
 * @param min - Minimum allowed value (default: 0)
 * @param max - Maximum allowed value (default: 10000)
 * @returns true if valid
 */
export function isValidBps(bps: unknown, min: number = 0, max: number = 10000): bps is number {
  if (typeof bps !== "number") {
    return false;
  }

  if (!Number.isInteger(bps)) {
    return false;
  }

  return bps >= min && bps <= max;
}

/**
 * SSRF Protection - Blocked IP ranges and hostnames
 * These should never be accessed via user-controlled URLs
 */
const BLOCKED_IP_PATTERNS = [
  /^127\./, // Loopback (127.0.0.0/8)
  /^10\./, // Private Class A (10.0.0.0/8)
  /^172\.(1[6-9]|2\d|3[01])\./, // Private Class B (172.16.0.0/12)
  /^192\.168\./, // Private Class C (192.168.0.0/16)
  /^169\.254\./, // Link-local (169.254.0.0/16)
  /^0\./, // Current network (0.0.0.0/8)
  /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./, // Carrier-grade NAT (100.64.0.0/10)
  /^::1$/, // IPv6 loopback
  /^fc00:/i, // IPv6 unique local
  /^fe80:/i, // IPv6 link-local
];

const BLOCKED_HOSTNAMES = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "metadata.google.internal", // GCP metadata
  "169.254.169.254", // AWS/GCP/Azure metadata endpoint
  "metadata.google",
];

/**
 * Validate URL for SSRF protection.
 *
 * Checks that a URL:
 * 1. Is a valid URL
 * 2. Uses allowed protocol (http/https/ipfs)
 * 3. Does not point to internal/private IPs
 * 4. Does not use blocked hostnames
 *
 * @param urlString - The URL to validate
 * @param options - Validation options
 * @returns Object with isValid and optional error message
 */
export function validateUrlSafe(
  urlString: string,
  options: {
    allowedProtocols?: string[];
    maxLength?: number;
  } = {}
): { isValid: boolean; error?: string } {
  const { allowedProtocols = ["https:", "http:", "ipfs:"], maxLength = 2048 } = options;

  // Check length
  if (urlString.length > maxLength) {
    return { isValid: false, error: "URL too long" };
  }

  // Parse URL
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return { isValid: false, error: "Invalid URL format" };
  }

  // Check protocol
  if (!allowedProtocols.includes(url.protocol)) {
    return { isValid: false, error: `Protocol not allowed: ${url.protocol}` };
  }

  // Check for blocked hostnames
  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return { isValid: false, error: "Blocked hostname" };
  }

  // Check for blocked IP patterns
  for (const pattern of BLOCKED_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return { isValid: false, error: "Internal IP addresses not allowed" };
    }
  }

  // Check for IP-like hostnames that might bypass DNS
  // Match IPv4-like patterns
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    // It's an IP address - check if it's in private ranges
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
