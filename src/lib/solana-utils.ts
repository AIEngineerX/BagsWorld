/**
 * Solana Utility Functions
 *
 * Provides consistent conversion between lamports and SOL,
 * as well as formatting utilities for displaying SOL amounts.
 *
 * 1 SOL = 1,000,000,000 lamports (10^9)
 */

export const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * Convert lamports to SOL
 * @param lamports - Amount in lamports (smallest unit)
 * @returns Amount in SOL
 */
export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

/**
 * Convert SOL to lamports
 * @param sol - Amount in SOL
 * @returns Amount in lamports (smallest unit)
 */
export function solToLamports(sol: number): number {
  return Math.round(sol * LAMPORTS_PER_SOL);
}

/**
 * Format SOL amount for display with appropriate precision
 *
 * - >= 1000: "1.2K SOL"
 * - >= 1: "5.00 SOL"
 * - >= 0.01: "0.050 SOL"
 * - < 0.01: "0.0001 SOL"
 *
 * @param sol - Amount in SOL
 * @param includeSuffix - Whether to append " SOL" (default: true)
 * @returns Formatted string
 */
export function formatSol(sol: number, includeSuffix: boolean = true): string {
  const suffix = includeSuffix ? " SOL" : "";

  // Handle invalid inputs
  if (sol === null || sol === undefined || isNaN(sol)) {
    return `0${suffix}`;
  }

  if (sol >= 1_000_000) {
    return `${(sol / 1_000_000).toFixed(1)}M${suffix}`;
  }
  if (sol >= 1_000) {
    return `${(sol / 1_000).toFixed(1)}K${suffix}`;
  }
  if (sol >= 1) {
    return `${sol.toFixed(2)}${suffix}`;
  }
  if (sol >= 0.01) {
    return `${sol.toFixed(3)}${suffix}`;
  }
  if (sol >= 0.0001) {
    return `${sol.toFixed(4)}${suffix}`;
  }
  if (sol > 0) {
    return `${sol.toFixed(6)}${suffix}`;
  }
  return `0${suffix}`;
}

/**
 * Format lamports directly to display string
 * Convenience function that combines conversion and formatting
 *
 * @param lamports - Amount in lamports
 * @param includeSuffix - Whether to append " SOL" (default: true)
 * @returns Formatted string
 */
export function formatLamports(lamports: number, includeSuffix: boolean = true): string {
  return formatSol(lamportsToSol(lamports), includeSuffix);
}

/**
 * Format a SOL amount for compact display (no suffix, minimal decimals)
 * Used in feeds and tight UI spaces
 *
 * @param sol - Amount in SOL
 * @returns Compact formatted string like "1.5" or "0.05"
 */
export function formatSolCompact(sol: number): string {
  if (sol >= 1_000_000) {
    return `${(sol / 1_000_000).toFixed(1)}M`;
  }
  if (sol >= 1_000) {
    return `${(sol / 1_000).toFixed(1)}K`;
  }
  if (sol >= 10) {
    return sol.toFixed(1);
  }
  if (sol >= 1) {
    return sol.toFixed(2);
  }
  if (sol >= 0.1) {
    return sol.toFixed(2);
  }
  if (sol >= 0.01) {
    return sol.toFixed(3);
  }
  if (sol > 0) {
    return sol.toFixed(4);
  }
  return "0";
}

/**
 * Parse a SOL string back to a number
 * Handles K/M suffixes
 *
 * @param str - String like "1.5K SOL" or "0.05"
 * @returns Number in SOL
 */
export function parseSolString(str: string): number {
  const cleaned = str
    .replace(/\s*SOL\s*/i, "")
    .trim()
    .toUpperCase();

  if (cleaned.endsWith("M")) {
    return parseFloat(cleaned.slice(0, -1)) * 1_000_000;
  }
  if (cleaned.endsWith("K")) {
    return parseFloat(cleaned.slice(0, -1)) * 1_000;
  }
  return parseFloat(cleaned) || 0;
}
