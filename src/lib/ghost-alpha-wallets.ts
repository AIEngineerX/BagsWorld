/**
 * Ghost Alpha Wallets - On-Chain Intelligence Module
 * Loads tracked smart money wallets for Ghost's trading decisions.
 * Data file (data/alpha-wallets.json) is gitignored — never committed.
 *
 * Isomorphic: works on both server (reads file) and client (returns empty).
 * The actual wallet data only loads server-side.
 *
 * Used by:
 * - Agent Economy brain (server): Ghost's follow_whales strategy cross-references alpha wallets
 * - Alpha Finder (server): ChadGhost flags transactions from known smart money
 */

const isServer = typeof window === "undefined";

// ============================================================================
// TYPES
// ============================================================================

interface RawWalletEntry {
  trackedWalletAddress: string;
  name: string;
  emoji: string;
  groups: string[];
  alertsOnToast?: boolean;
  alertsOnBubble?: boolean;
  alertsOnFeed?: boolean;
}

export interface AlphaWallet {
  address: string;
  name: string;
  emoji: string;
  groups: string[];
  /** Higher tier = stronger signal. Alpha > Gergo Tracked > Main > BAN */
  tier: 1 | 2 | 3 | 4;
}

// ============================================================================
// LOADING
// ============================================================================

let walletCache: AlphaWallet[] | null = null;
let walletLookup: Map<string, AlphaWallet> | null = null;

function getTier(groups: string[]): AlphaWallet["tier"] {
  if (groups.includes("Alpha")) return 1; // Highest conviction
  if (groups.includes("Gergo Tracked")) return 2;
  if (groups.includes("Main")) return 3;
  return 4; // BAN or unknown
}

function loadWallets(): AlphaWallet[] {
  if (walletCache) return walletCache;

  // Client-side: no filesystem access, return empty
  if (!isServer) {
    walletCache = [];
    return walletCache;
  }

  try {
    // Dynamic require to avoid bundling fs/path in client builds
    const fs = require("fs");
    const nodePath = require("path");

    const filePath =
      process.env.GHOST_ALPHA_WALLETS_PATH ||
      nodePath.resolve(process.cwd(), "data", "alpha-wallets.json");

    const raw = fs.readFileSync(filePath, "utf-8");
    const entries: RawWalletEntry[] = JSON.parse(raw);

    walletCache = entries.map((e: RawWalletEntry) => ({
      address: e.trackedWalletAddress,
      name: e.name,
      emoji: e.emoji,
      groups: e.groups || [],
      tier: getTier(e.groups || []),
    }));

    console.log(`[GhostAlpha] Loaded ${walletCache.length} alpha wallets`);
    return walletCache;
  } catch {
    console.warn("[GhostAlpha] Alpha wallets not found — Ghost runs without on-chain intel");
    walletCache = [];
    return walletCache;
  }
}

function getLookup(): Map<string, AlphaWallet> {
  if (walletLookup) return walletLookup;

  const wallets = loadWallets();
  walletLookup = new Map();
  for (const w of wallets) {
    walletLookup.set(w.address, w);
  }
  return walletLookup;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/** Check if a wallet is in the alpha list */
export function isAlphaWallet(address: string): boolean {
  return getLookup().has(address);
}

/** Get alpha wallet details (or null) */
export function getAlphaWallet(address: string): AlphaWallet | null {
  return getLookup().get(address) || null;
}

/** Get all wallets, optionally filtered by group */
export function getAlphaWallets(group?: string): AlphaWallet[] {
  const wallets = loadWallets();
  if (!group) return wallets;
  return wallets.filter((w) => w.groups.includes(group));
}

/** Get all unique wallet addresses as a Set (fast membership checks) */
export function getAlphaWalletSet(): Set<string> {
  return new Set(getLookup().keys());
}

/** Get wallet count by group */
export function getAlphaStats(): Record<string, number> {
  const wallets = loadWallets();
  const stats: Record<string, number> = { total: wallets.length };
  for (const w of wallets) {
    for (const g of w.groups) {
      stats[g] = (stats[g] || 0) + 1;
    }
  }
  return stats;
}

/**
 * Ghost's on-chain confidence signal.
 * Returns a 0-1 score based on how many alpha wallets are involved
 * in a given set of wallet addresses (e.g., token holders/traders).
 */
export function getAlphaSignal(walletAddresses: string[]): {
  score: number;
  matchCount: number;
  topMatches: AlphaWallet[];
} {
  const lookup = getLookup();
  const matches: AlphaWallet[] = [];

  for (const addr of walletAddresses) {
    const alpha = lookup.get(addr);
    if (alpha) matches.push(alpha);
  }

  if (matches.length === 0) {
    return { score: 0, matchCount: 0, topMatches: [] };
  }

  // Score: weighted by tier (tier 1 = 4 points, tier 4 = 1 point)
  const totalWeight = matches.reduce((sum, m) => sum + (5 - m.tier), 0);
  // Normalize: 1 tier-1 match = ~0.3 score, 5+ high-tier matches = ~1.0
  const score = Math.min(1, totalWeight / 15);

  // Sort by tier (best first)
  matches.sort((a, b) => a.tier - b.tier);

  return {
    score,
    matchCount: matches.length,
    topMatches: matches.slice(0, 5),
  };
}

/** Force reload (useful if the file is updated at runtime) */
export function reloadAlphaWallets(): void {
  walletCache = null;
  walletLookup = null;
  loadWallets();
}
