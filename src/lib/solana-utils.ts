export const LAMPORTS_PER_SOL = 1_000_000_000;

export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

export function solToLamports(sol: number): number {
  return Math.round(sol * LAMPORTS_PER_SOL);
}

/**
 * Format SOL amount for display with appropriate precision.
 * >= 1000: "1.2K SOL", >= 1: "5.00 SOL", < 1: up to 6 decimals.
 */
export function formatSol(sol: number, includeSuffix: boolean = true): string {
  const suffix = includeSuffix ? " SOL" : "";

  if (!Number.isFinite(sol) || sol <= 0) {
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
  return `${sol.toFixed(6)}${suffix}`;
}

/** Format lamports directly to display string. */
export function formatLamports(lamports: number, includeSuffix: boolean = true): string {
  return formatSol(lamportsToSol(lamports), includeSuffix);
}

/** Compact format for feeds and tight UI spaces (no suffix, minimal decimals). */
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

/** Parse a SOL string back to a number (handles K/M suffixes). */
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
