// BagsWorld Ecosystem Configuration
// This defines the core mechanics that make BagsWorld valuable

// =============================================================================
// WHY JOIN BAGSWORLD?
// =============================================================================
// 1. VISIBILITY: Your token becomes a building in a living world
// 2. COMMUNITY: Citizens (X/Twitter accounts) earn fees across multiple tokens
// 3. ECOSYSTEM GROWTH: 10% of all fees fuel the ecosystem, benefiting everyone
// 4. SOCIAL PROOF: Leaderboards, events, and activity feed showcase success
// =============================================================================

export const ECOSYSTEM_CONFIG = {
  // -------------------------------------------------------------------------
  // ECOSYSTEM FEE STRUCTURE - COMMUNITY REWARDS
  // -------------------------------------------------------------------------
  // Every token launched through BagsWorld contributes to community rewards
  // Fees are SET PERMANENTLY at launch - they cannot be changed later
  // This is why launching through BagsWorld ensures your community grows
  ecosystem: {
    // Wallet that receives ecosystem fees - viewable on Solscan
    wallet: process.env.NEXT_PUBLIC_ECOSYSTEM_WALLET || "9Luwe53R7V5ohS8dmconp38w9FoKsUgBjVwEPPU8iFUC",

    // Fee percentage in basis points (1000 = 10%)
    feeBps: 1000,

    // How the ecosystem fees are allocated - COMMUNITY FIRST
    allocation: {
      communityRewards: 50, // 50% - Rewards for top earners & active communities
      weeklyAirdrops: 25,   // 25% - Weekly airdrops to engaged holders
      creatorBonus: 15,     // 15% - Bonus rewards for top performing tokens
      development: 10,      // 10% - Platform improvements
    },

    // Provider name shown in fee shares
    provider: "bagsworld" as const,
    providerUsername: "BagsWorld Community Rewards",
  },

  // -------------------------------------------------------------------------
  // ADMIN CONFIGURATION
  // -------------------------------------------------------------------------
  admin: {
    // Wallets with admin privileges (can delete buildings, moderate)
    wallets: [
      process.env.NEXT_PUBLIC_ADMIN_WALLET || "9Luwe53R7V5ohS8dmconp38w9FoKsUgBjVwEPPU8iFUC",
    ],
  },

  // -------------------------------------------------------------------------
  // BUILDING TIERS (Market Cap Thresholds)
  // -------------------------------------------------------------------------
  // Buildings grow based on market cap, giving visual progression
  buildings: {
    tiers: [
      { level: 1, name: "Startup Shop", minMarketCap: 0, icon: "🏪" },
      { level: 2, name: "Growing Office", minMarketCap: 100_000, icon: "🏢" },
      { level: 3, name: "Corporate HQ", minMarketCap: 500_000, icon: "🏛️" },
      { level: 4, name: "Tower", minMarketCap: 2_000_000, icon: "🗼" },
      { level: 5, name: "Skyscraper", minMarketCap: 10_000_000, icon: "🏙️" },
    ],
    maxBuildings: 12, // Reduced to prevent overcrowding

    // Decay system - buildings fade without activity
    decay: {
      enabled: true,
      minVolume24h: 100, // Minimum 24h volume to stay healthy (in USD)
      healthyThreshold: 50, // Buildings with health > 50 are displayed prominently
      removeThreshold: 10, // Buildings with health < 10 are removed
      decayRate: 5, // Health points lost per check when inactive
      recoverRate: 10, // Health points gained when active
    },
  },

  // -------------------------------------------------------------------------
  // CITIZEN CONFIGURATION
  // -------------------------------------------------------------------------
  // Citizens are X/Twitter accounts that receive fee shares
  citizens: {
    maxPopulation: 15,
    supportedProviders: ["twitter", "tiktok", "instagram", "github", "kick"] as const,
  },

  // -------------------------------------------------------------------------
  // WORLD MECHANICS
  // -------------------------------------------------------------------------
  world: {
    // Weather tied to world health (trading volume)
    weatherThresholds: {
      sunny: 80,      // 80%+ health
      cloudy: 60,     // 60-80% health
      rain: 40,       // 40-60% health
      storm: 20,      // 20-40% health
      apocalypse: 0,  // <20% health
    },

    // Refresh intervals
    refreshInterval: 30_000,  // 30 seconds
    weatherCacheDuration: 300_000,  // 5 minutes
  },

  // -------------------------------------------------------------------------
  // VALUE PROPOSITIONS (For UI display)
  // -------------------------------------------------------------------------
  benefits: {
    forCreators: [
      {
        title: "Living Building",
        description: "Your token becomes a building that grows with market cap",
        icon: "🏗️",
      },
      {
        title: "Automatic Citizens",
        description: "Fee share recipients become citizens walking your world",
        icon: "👥",
      },
      {
        title: "Event Feed",
        description: "Token launches, fee claims, and milestones are celebrated",
        icon: "📢",
      },
      {
        title: "Trading Built-In",
        description: "Users can trade your token directly from the game",
        icon: "💱",
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
        icon: "🔗",
      },
      {
        title: "Mood Reflects Earnings",
        description: "Your character celebrates when you're earning",
        icon: "🎉",
      },
    ],
    forEcosystem: [
      {
        title: "10% Community Rewards",
        description: "Fees go back to the strongest communities",
        icon: "🏆",
      },
      {
        title: "Weekly Airdrops",
        description: "Top earners and active holders get rewarded",
        icon: "🎁",
      },
      {
        title: "Growing World",
        description: "More tokens = bigger city = stronger network",
        icon: "🌆",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // SATOSHI - Permanent AI Character
  // -------------------------------------------------------------------------
  // Satoshi is always present in the world as a guide and AI companion
  satoshi: {
    id: "satoshi-nakamoto",
    username: "Satoshi",
    provider: "bitcoin" as const,
    providerUsername: "satoshi",
    mood: "neutral" as const,
    // Satoshi walks around giving wisdom about crypto
    quotes: [
      "If you don't believe it or don't get it, I don't have the time to try to convince you, sorry.",
      "The root problem with conventional currency is all the trust that's required to make it work.",
      "Lost coins only make everyone else's coins worth slightly more.",
      "I've been working on a new electronic cash system that's fully peer-to-peer, with no trusted third party.",
      "The nature of Bitcoin is such that once version 0.1 was released, the core design was set in stone for the rest of its lifetime.",
      "It might make sense just to get some in case it catches on.",
    ],
    // Special interaction - clicking Satoshi opens AI chat
    interactionType: "ai-chat",
  },

  // -------------------------------------------------------------------------
  // REWARDS HUB BUILDING (Permanent landmark)
  // -------------------------------------------------------------------------
  // This building always appears in the world and links to Solscan
  // so users can verify and monitor community rewards transparently
  treasury: {
    id: "BagsWorldRewardsHub",
    name: "Community Rewards Hub",
    symbol: "REWARDS",
    description: "Where fees become rewards - distributed weekly to the strongest communities. Click to verify on Solscan.",
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
      "A good trainer takes care of their team. Here, 10% of fees go back to the strongest communities!",
      "Just like Pokemon evolve, your building grows as market cap increases!",
      "Every citizen here earns fees from trading. It's like getting badges for battling!",
      "I wanna be the very best! And in BagsWorld, the best communities get weekly airdrops!",
      "Remember: the ecosystem rewards those who believe in their tokens!",
    ],
    // Clicking Ash opens ecosystem explainer
    interactionType: "ecosystem-guide",
  },

  // -------------------------------------------------------------------------
  // EXTERNAL LINKS
  // -------------------------------------------------------------------------
  links: {
    bags: "https://bags.fm",
    twitter: "https://x.com/BagsWorld", // Update with real handle
    docs: "https://docs.bagsworld.xyz", // Update with real docs
    solscan: (address: string) => `https://solscan.io/account/${address}`,
  },
};

// Helper functions
export function isAdmin(walletAddress: string | null | undefined): boolean {
  if (!walletAddress) return false;
  return ECOSYSTEM_CONFIG.admin.wallets.includes(walletAddress);
}

export function getBuildingTier(marketCap: number): typeof ECOSYSTEM_CONFIG.buildings.tiers[0] {
  const tiers = [...ECOSYSTEM_CONFIG.buildings.tiers].reverse();
  return tiers.find(tier => marketCap >= tier.minMarketCap) || ECOSYSTEM_CONFIG.buildings.tiers[0];
}

export function getEcosystemFeeShare() {
  return {
    provider: ECOSYSTEM_CONFIG.ecosystem.provider,
    providerUsername: ECOSYSTEM_CONFIG.ecosystem.wallet,
    bps: ECOSYSTEM_CONFIG.ecosystem.feeBps,
    displayName: ECOSYSTEM_CONFIG.ecosystem.providerUsername,
  };
}

// Type exports
export type Provider = typeof ECOSYSTEM_CONFIG.citizens.supportedProviders[number];
export type WeatherType = keyof typeof ECOSYSTEM_CONFIG.world.weatherThresholds;
