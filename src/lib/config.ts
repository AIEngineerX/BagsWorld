// BagsWorld Ecosystem Configuration
// This defines the core mechanics that make BagsWorld valuable

// =============================================================================
// WHY JOIN BAGSWORLD?
// =============================================================================
// 1. VISIBILITY: Your token becomes a building in a living world
// 2. SUCCESS REWARDS SUCCESS: More volume = more fees = higher ranking
// 3. ZERO EXTRA FEES: No additional BagsWorld fees on token launches
// 4. COMMUNITY FUNDED: Ghost contributes 5% of his $BagsWorld revenue to community
// =============================================================================
//
// FUNDING MODEL:
// - Ghost (dev) personally diverts 5% of his $BagsWorld token revenue fees
// - This funds Casino, community features, and future development
// - Bags.fm fees are separate (standard platform fees)
// - Creators launching tokens pay NO extra BagsWorld fees
//
// Follow @DaddyGhost on X for updates
// =============================================================================

import { isProduction } from "./env-utils";

/**
 * Get admin wallets from environment.
 *
 * In production: Returns empty array if not configured (disables admin features)
 * In development: Returns fallback wallet with warning
 *
 * Supports multiple wallets via comma-separated ADMIN_WALLETS env var.
 */
function getAdminWallets(): string[] {
  // SECURITY: Only use server-side env vars, never NEXT_PUBLIC_ for admin wallets
  // The NEXT_PUBLIC_ prefix exposes values to the client bundle
  const adminWalletEnv = process.env.ADMIN_WALLETS || process.env.ADMIN_WALLET;

  if (adminWalletEnv) {
    // Support comma-separated list of admin wallets
    const wallets = adminWalletEnv
      .split(",")
      .map((wallet) => wallet.trim())
      .filter(Boolean);
    return wallets;
  }

  // No admin wallet configured
  if (isProduction()) {
    console.error(
      "[Config] ADMIN_WALLETS not configured - admin features disabled in production. " +
        "Set ADMIN_WALLETS environment variable to enable admin access."
    );
    return [];
  }

  // Development fallback with clear warning
  if (!isProduction()) {
    console.warn(
      "[Config] Using development admin wallet fallback - NOT FOR PRODUCTION. " +
        "Set ADMIN_WALLETS environment variable for production."
    );
    return ["9Luwe53R7V5ohS8dmconp38w9FoKsUgBjVwEPPU8iFUC"];
  }

  return [];
}

export const ECOSYSTEM_CONFIG = {
  // -------------------------------------------------------------------------
  // ECOSYSTEM FUNDING
  // -------------------------------------------------------------------------
  // BagsWorld does NOT take fees on token launches
  // Community features are funded by Ghost's 5% $BagsWorld revenue contribution
  // Bags.fm has its own separate fee structure (standard platform fees)
  ecosystem: {
    // Wallet that receives Ghost's community contribution
    wallet:
      process.env.NEXT_PUBLIC_ECOSYSTEM_WALLET || "9Luwe53R7V5ohS8dmconp38w9FoKsUgBjVwEPPU8iFUC",

    // Partner Config PDA - created at dev.bags.fm
    // This enables BagsWorld to earn Bags.fm partner fees from token launches
    partnerConfigPda: "5TcACd9yCLEBewdRrhk9hb6A22oS2gFLzG7oH5YCq1Po",

    // Fee percentage in basis points (0 = no mandatory ecosystem fee on launches)
    // Community is funded by Ghost's personal $BagsWorld revenue contribution instead
    feeBps: 0,

    // Founder's Community Contribution
    // Ghost contributes 5% of his personal $BagsWorld token fees to fund community
    founderContribution: {
      percentage: 5, // 5% of Ghost's $BagsWorld revenue
      fundedFeatures: ["Casino", "Community rewards", "Future development"],
    },

    // Scout Agent: Scans for new token launches in real-time
    scout: {
      minLiquidityUsd: 500, // Min $500 liquidity to alert
      bagsOnly: false, // Track all launches or just Bags
      maxAlertsPerMinute: 30, // Rate limit
    },

    // Provider name shown in fee shares
    // Must use supported social provider (twitter, kick, github) - NOT raw wallet addresses
    // The Twitter account must be linked to the ecosystem wallet at bags.fm/settings
    provider: "twitter" as const,
    providerUsername: "BagsWorldApp",
  },

  // -------------------------------------------------------------------------
  // CASINO TOKEN GATE
  // -------------------------------------------------------------------------
  // Hold $BagsWorld tokens to access casino features
  casino: {
    gateToken: {
      mint: "9auyeHWESnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS",
      symbol: "$BagsWorld",
      minBalance: 1_000_000,
      buyUrl: "https://bags.fm/9auyeHWESnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS",
    },
  },

  // -------------------------------------------------------------------------
  // ORACLE TOKEN GATE (Higher requirement than Casino)
  // -------------------------------------------------------------------------
  // Hold $BagsWorld tokens to enter Oracle predictions with prize pools
  oracle: {
    gateToken: {
      mint: "9auyeHWESnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS",
      symbol: "$BagsWorld",
      minBalance: 2_000_000, // 2M tokens required (2x Casino requirement)
      buyUrl: "https://bags.fm/9auyeHWESnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS",
    },
    // Prize pool configuration
    prizePool: {
      defaultSol: 0.1, // Default prize pool for auto-generated rounds
      minSol: 0.1, // Minimum prize pool per round
      maxSol: 1.0, // Maximum prize pool per round
      minClaimSol: 0.001, // Minimum claimable amount
    },
  },

  // -------------------------------------------------------------------------
  // ADMIN CONFIGURATION
  // -------------------------------------------------------------------------
  // Admin wallets must be explicitly configured via ADMIN_WALLETS env var in production.
  // In development, a fallback wallet is used for testing.
  admin: {
    // Wallets with admin privileges (can delete buildings, moderate)
    wallets: getAdminWallets(),
  },

  // -------------------------------------------------------------------------
  // BUILDING TIERS (Market Cap Thresholds)
  // -------------------------------------------------------------------------
  // Buildings grow based on market cap, giving visual progression
  buildings: {
    tiers: [
      { level: 1, name: "Startup", minMarketCap: 0, icon: "🏠" },
      { level: 2, name: "Growing", minMarketCap: 100_000, icon: "🏢" },
      { level: 3, name: "Established", minMarketCap: 500_000, icon: "🏦" },
      { level: 4, name: "Major", minMarketCap: 2_000_000, icon: "🏰" },
      { level: 5, name: "Elite", minMarketCap: 10_000_000, icon: "👑" },
    ],
    maxBuildings: 12, // Reduced to prevent overcrowding

    // Decay system - buildings fade without activity based on volume and market cap
    decay: {
      enabled: true,
      // Volume thresholds (in USD)
      volumeThresholds: {
        dead: 500, // Below $500 = decay
        healthy: 2000, // Above $2000 = fast recovery
      },
      // Market cap threshold for heavy decay
      marketCapThreshold: 50000, // Below $50K + low volume = heavy decay
      // Health status thresholds
      thresholds: {
        warning: 75, // Below 75 = warning status
        critical: 50, // Below 50 = critical status
        dormant: 25, // Below 25 = dormant status
        remove: 10, // Below 10 = hidden from world
      },
      // Decay/recovery rates per refresh cycle
      rates: {
        heavyDecay: -8, // Low volume + low market cap
        moderateDecay: -5, // Low volume only
        lightDecay: -2, // Moderate volume + price drop
        recovery: 5, // Normal activity
        fastRecovery: 10, // High volume
      },
      // Grace period - new buildings get immunity from decay
      gracePeriod: {
        durationMs: 24 * 60 * 60 * 1000, // 24 hours
        minHealth: 75, // Don't decay below this during grace period
      },
    },
  },

  // -------------------------------------------------------------------------
  // CITIZEN CONFIGURATION
  // -------------------------------------------------------------------------
  // Citizens are X/Twitter accounts that receive fee shares
  // Note: Bags API v2 only supports twitter, github, kick for token launch fee claimers
  citizens: {
    maxPopulation: 15,
    supportedProviders: ["twitter", "github", "kick"] as const,
  },

  // -------------------------------------------------------------------------
  // WORLD MECHANICS
  // -------------------------------------------------------------------------
  world: {
    // Weather tied to world health (trading volume)
    weatherThresholds: {
      sunny: 80, // 80%+ health
      cloudy: 60, // 60-80% health
      rain: 40, // 40-60% health
      storm: 20, // 20-40% health
      apocalypse: 0, // <20% health
    },

    // Refresh intervals
    refreshInterval: 60_000, // 60 seconds (optimized for smoother rendering)
    weatherCacheDuration: 300_000, // 5 minutes
  },

  // -------------------------------------------------------------------------
  // VALUE PROPOSITIONS (For UI display)
  // -------------------------------------------------------------------------
  benefits: {
    forCreators: [
      {
        title: "Living Building",
        description: "Your token becomes a building that grows with market cap",
        icon: "🏢",
      },
      {
        title: "Automatic Citizens",
        description: "Fee share recipients become citizens walking your world",
        icon: "👥",
      },
      {
        title: "Event Feed",
        description: "Token launches, fee claims, and milestones are celebrated",
        icon: "▸",
      },
      {
        title: "Trading Built-In",
        description: "Users can trade your token directly from the game",
        icon: "↗",
      },
    ],
    forCitizens: [
      {
        title: "Earn From Multiple Tokens",
        description: "Get fee shares from any token that adds you",
        icon: "💰",
      },
      {
        title: "Profile Visibility",
        description: "Your X/Twitter is linked - followers can find you",
        icon: "👤",
      },
      {
        title: "Mood Reflects Earnings",
        description: "Your character celebrates when you're earning",
        icon: "😊",
      },
    ],
    forEcosystem: [
      {
        title: "Zero Extra Fees",
        description: "No BagsWorld fees on token launches",
        icon: "0",
      },
      {
        title: "Ghost's 5%",
        description: "Founder funds community from his $BagsWorld revenue",
        icon: "F",
      },
      {
        title: "Community First",
        description: "Casino, features & development funded by Ghost",
        icon: "C",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // SATOSHI NAKAMOTO - Bitcoin Creator (Wisdom Chat Character)
  // -------------------------------------------------------------------------
  // Satoshi provides Bitcoin wisdom and crypto education
  satoshi: {
    id: "satoshi-nakamoto",
    username: "Satoshi",
    // Satoshi's actual quotes from Bitcoin whitepaper and early forum posts
    quotes: [
      "If you don't believe it or don't get it, I don't have the time to try to convince you, sorry.",
      "The root problem with conventional currency is all the trust that's required to make it work.",
      "Lost coins only make everyone else's coins worth slightly more. Think of it as a donation to everyone.",
      "I've been working on a new electronic cash system that's fully peer-to-peer, with no trusted third party.",
      "The nature of Bitcoin is such that once version 0.1 was released, the core design was set in stone for the rest of its lifetime.",
      "It might make sense just to get some in case it catches on.",
      "Writing a description for this thing for general audiences is bloody hard. There's nothing to relate it to.",
    ],
    interactionType: "bitcoin-wisdom",
  },

  // -------------------------------------------------------------------------
  // TOLY - Solana Co-Founder (Permanent AI Character)
  // -------------------------------------------------------------------------
  // Toly (Anatoly Yakovenko) is always present as the Solana guide
  toly: {
    id: "toly-solana",
    username: "toly",
    provider: "solana" as const,
    providerUsername: "aeyakovenko",
    twitterHandle: "toly",
    mood: "happy" as const,
    // Toly's actual quotes and philosophy
    quotes: [
      "Keep executing. Execution is the only moat.",
      "I just wake up, do my routine to get my coffee. And then I'm like, okay, how do we get to the next level?",
      "I like competing. I care about all those things, but I like competing.",
      "We can shrink block time to 120 milliseconds and everything becomes faster and tighter.",
      "Shipping early and fast enough and having those stress tests helped us iterate and get better.",
      "Blessed are the memecoin traders, for those who can overcome their spam will inherit the metaverse.",
      "AI has been a great force multiplier for somebody who's an expert.",
      "If people are in a meeting with me and I'm not paying attention, it's because I'm watching Claude.",
    ],
    // Special interaction - clicking Toly opens Solana wisdom chat
    interactionType: "solana-guide",
  },

  // -------------------------------------------------------------------------
  // COMMUNITY HUB (Permanent landmark)
  // -------------------------------------------------------------------------
  // This building always appears in the world and links to Solscan
  // Shows Ghost's community fund wallet
  treasury: {
    id: "BagsWorldCommunityHub",
    name: "Community Hub",
    symbol: "COMMUNITY",
    description:
      "Funded by Ghost's 5% $BagsWorld revenue. Powers Casino, features & development. Click to verify on Solscan.",
    level: 5, // Always max level - it's the centerpiece
    getSolscanUrl: () => `https://solscan.io/account/${ECOSYSTEM_CONFIG.ecosystem.wallet}`,
  },

  // -------------------------------------------------------------------------
  // ASH KETCHUM - Ecosystem Guide Character
  // -------------------------------------------------------------------------
  // Ash helps explain how BagsWorld works to new users
  ash: {
    id: "ash-ketchum",
    username: "Ash",
    provider: "pokemon" as const,
    providerUsername: "ash_ketchum",
    mood: "happy" as const,
    // Ash explains the ecosystem with Pokemon-themed analogies
    quotes: [
      "Gotta catch 'em all... tokens that is! Each one becomes a building in BagsWorld!",
      "Ghost funds the community with 5% of his $BagsWorld fees - like a Pokemon Champion giving back!",
      "Just like Pokemon evolve, your building grows as market cap increases!",
      "Launch tokens with ZERO extra fees - BagsWorld is free to use!",
      "I wanna be the very best! And in BagsWorld, creators keep 100% of their fee share!",
      "Ghost's contribution powers the Casino, features, and more - community first!",
    ],
    // Clicking Ash opens ecosystem explainer
    interactionType: "ecosystem-guide",
  },

  // -------------------------------------------------------------------------
  // FINN - Bags.fm Founder & CEO (Main Guide Character)
  // -------------------------------------------------------------------------
  // Finn (@finnbags) is the founder of Bags.fm and guides users through the platform
  finn: {
    id: "finnbags",
    username: "Finn",
    provider: "twitter" as const,
    providerUsername: "finnbags",
    twitterHandle: "finnbags",
    mood: "happy" as const,
    // Finn's quotes about Bags.fm and memecoins
    quotes: [
      "Welcome to BagsWorld! This is where memecoins come to life. Every token you launch becomes a building here.",
      "We built Bags.fm so creators can earn forever. 1% of all trading volume, for life. No rugs, just bags.",
      "The fastest growing launchpad in the world isn't just hype - it's because we actually ship.",
      "I bought the WIF hat because memes matter. Culture is the new currency.",
      "Over $1B in trading volume in less than 30 days. That's the power of community.",
      "Launch your token, earn your fees, build your empire. It's that simple.",
      "The best memecoins aren't just tokens - they're movements. What's yours?",
    ],
    // Clicking Finn opens Bags.fm guide
    interactionType: "bags-guide",
  },

  // -------------------------------------------------------------------------
  // DADDYGHOST - The Dev (Trading & Agent Operations)
  // -------------------------------------------------------------------------
  // DaddyGhost (@DaddyGhost) is the developer who builds BagsWorld features
  dev: {
    id: "daddyghost",
    username: "Ghost",
    provider: "twitter" as const,
    providerUsername: "DaddyGhost",
    twitterHandle: "DaddyGhost",
    mood: "happy" as const,
    // Ghost builds BagsWorld - no more reward system, community funded by Ghost
    quotes: [
      "yo i build the features here. i fund the community with 5% of his $BagsWorld revenue",
      "no mandatory fees on your launches. creators get 100% of their configured share",
      "my contribution powers the casino, features, all the cool stuff. community first",
      "bags.fm fees are separate - that's their platform. bagsworld adds zero extra fees",
      "i built this for devs. launch for free, earn your fees through bags.fm, simple as that",
      "check the community wallet on solscan. my 5% contribution funds everything here",
      "not just a dev, im the ghost in the machine. you build, you keep your earnings",
      "the old reward system is gone. now it's funded by me directly. cleaner, simpler",
    ],
    // Clicking Dev opens trading assistant
    interactionType: "trading-agent",
  },

  // -------------------------------------------------------------------------
  // NEO - The Scout Agent (Token Launch Scanner)
  // -------------------------------------------------------------------------
  // Neo sees the blockchain like he sees The Matrix - pure code streaming by
  scout: {
    id: "scout-agent",
    username: "Neo",
    provider: "matrix" as const,
    providerUsername: "TheOne",
    mood: "happy" as const,
    // Neo-style quotes about seeing the code/blockchain
    quotes: [
      "i can see the chain now. every transaction, every launch... it's all just code",
      "new token incoming. i see the liquidity flow before it even settles",
      "there is no rug. only the code, and whether you can read it",
      "i don't just watch the blockchain. i see it for what it really is",
      "the matrix has you. but out here in the trenches, i see everything",
      "what if i told you... i can see every launch before it trends",
      "i know kung fu. and now i know solana. scanning...",
      "the agents can't touch you here. but the ruggers can. let me filter them out",
    ],
    // Clicking Neo opens the scout panel
    interactionType: "scout-panel",
  },

  // -------------------------------------------------------------------------
  // EXTERNAL LINKS
  // -------------------------------------------------------------------------
  links: {
    bags: "https://bags.fm",
    twitter: "https://x.com/finnbags",
    docs: "https://docs.bags.fm",
    solscan: (address: string) => `https://solscan.io/account/${address}`,
  },
};

// Helper functions

/**
 * Check if a wallet address has admin privileges.
 *
 * Returns false if:
 * - No wallet address provided
 * - Admin wallets not configured (production without ADMIN_WALLETS env var)
 * - Wallet not in admin list
 */
export function isAdmin(walletAddress: string | null | undefined): boolean {
  if (!walletAddress) return false;
  const adminWallets = ECOSYSTEM_CONFIG.admin.wallets;
  if (adminWallets.length === 0) return false;
  return adminWallets.includes(walletAddress);
}

/**
 * Check if admin functionality is available.
 *
 * Returns false in production if ADMIN_WALLETS is not configured.
 * Useful for disabling admin UI elements when no admins are set.
 */
export function isAdminConfigured(): boolean {
  return ECOSYSTEM_CONFIG.admin.wallets.length > 0;
}

export function getBuildingTier(marketCap: number): (typeof ECOSYSTEM_CONFIG.buildings.tiers)[0] {
  const tiers = [...ECOSYSTEM_CONFIG.buildings.tiers].reverse();
  return (
    tiers.find((tier) => marketCap >= tier.minMarketCap) || ECOSYSTEM_CONFIG.buildings.tiers[0]
  );
}

export function getEcosystemFeeShare() {
  return {
    provider: ECOSYSTEM_CONFIG.ecosystem.provider, // "twitter"
    providerUsername: ECOSYSTEM_CONFIG.ecosystem.providerUsername, // "BagsWorldApp"
    bps: ECOSYSTEM_CONFIG.ecosystem.feeBps,
    displayName: ECOSYSTEM_CONFIG.ecosystem.providerUsername,
  };
}

// Type exports
export type Provider = (typeof ECOSYSTEM_CONFIG.citizens.supportedProviders)[number];
export type WeatherType = keyof typeof ECOSYSTEM_CONFIG.world.weatherThresholds;
