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
  // ECOSYSTEM FEE STRUCTURE
  // -------------------------------------------------------------------------
  // Every token launched through BagsWorld contributes to the ecosystem
  ecosystem: {
    // Wallet that receives ecosystem fees (treasury)
    wallet: process.env.NEXT_PUBLIC_ECOSYSTEM_WALLET || "Ccs9wSrEwmKx7iBD9H4xqd311eJUd2ufDk2ip87Knbo3",

    // Fee percentage in basis points (1000 = 10%)
    feeBps: 1000,

    // How the ecosystem fees are allocated (for transparency/display)
    allocation: {
      development: 40,    // 40% - Platform improvements, new features
      community: 30,      // 30% - Rewards, airdrops, competitions
      liquidity: 20,      // 20% - Future $BAGS token liquidity
      marketing: 10,      // 10% - Growth, partnerships
    },

    // Provider name shown in fee shares
    provider: "bagsworld" as const,
    providerUsername: "BagsWorld Ecosystem",
  },

  // -------------------------------------------------------------------------
  // ADMIN CONFIGURATION
  // -------------------------------------------------------------------------
  admin: {
    // Wallets with admin privileges (can delete buildings, moderate)
    wallets: [
      process.env.NEXT_PUBLIC_ADMIN_WALLET || "Ccs9wSrEwmKx7iBD9H4xqd311eJUd2ufDk2ip87Knbo3",
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
    maxBuildings: 20,
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
        title: "10% Ecosystem Fee",
        description: "Funds development, rewards, and future token",
        icon: "🌱",
      },
      {
        title: "Growing World",
        description: "More tokens = bigger city = more engagement",
        icon: "🌆",
      },
      {
        title: "Community Events",
        description: "Competitions, airdrops, and featured spots",
        icon: "🎯",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // EXTERNAL LINKS
  // -------------------------------------------------------------------------
  links: {
    bags: "https://bags.fm",
    twitter: "https://x.com/BagsWorld", // Update with real handle
    docs: "https://docs.bagsworld.xyz", // Update with real docs
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
