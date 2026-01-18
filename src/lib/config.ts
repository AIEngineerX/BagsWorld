// BagsWorld Ecosystem Configuration
// This defines the core mechanics that make BagsWorld valuable

// =============================================================================
// WHY JOIN BAGSWORLD?
// =============================================================================
// 1. VISIBILITY: Your token becomes a building in a living world
// 2. COMMUNITY: Citizens (X/Twitter accounts) earn fees across multiple tokens
// 3. ECOSYSTEM GROWTH: 5% of all fees fuel the ecosystem, benefiting everyone
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

    // Fee percentage in basis points (500 = 5%)
    feeBps: 500,

    // How the ecosystem fees are allocated - COMMUNITY FIRST
    allocation: {
      communityRewards: 50, // 50% - Rewards for top earners & active communities
      weeklyAirdrops: 25,   // 25% - Weekly airdrops to engaged holders
      creatorBonus: 15,     // 15% - Bonus rewards for top performing tokens
      development: 10,      // 10% - Platform improvements
    },

    // Provider name shown in fee shares
    // Bags API v2 only supports twitter, github, kick - NOT direct wallet addresses
    provider: "twitter" as const,
    providerUsername: "DaddyGhost",
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
        title: "5% Community Rewards",
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
      "A good trainer takes care of their team. Here, 5% of fees go back to the strongest communities!",
      "Just like Pokemon evolve, your building grows as market cap increases!",
      "Every citizen here earns fees from trading. It's like getting badges for battling!",
      "I wanna be the very best! And in BagsWorld, the best communities get weekly airdrops!",
      "Remember: the ecosystem rewards those who believe in their tokens!",
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
  // DADDYGHOST - The Dev (Trading Agent Character)
  // -------------------------------------------------------------------------
  // DaddyGhost (@DaddyGhost) is the developer/trencher who can execute trades
  dev: {
    id: "daddyghost",
    username: "The Dev",
    provider: "twitter" as const,
    providerUsername: "DaddyGhost",
    twitterHandle: "DaddyGhost",
    mood: "happy" as const,
    // Trencher personality - in the trenches, making calls, trading
    quotes: [
      "yo, you want me to ape into something? just say the word fam",
      "been in the trenches all day. found some gems. wanna see?",
      "i can check any token for you - just drop the CA or name",
      "the dev does not mass dm. the dev builds and trades.",
      "let's get this bread. what are we buying today?",
      "i built this whole world. now let me help you trade in it.",
      "trust the process. i've been doing this since the bear market.",
      "not financial advice but... *proceeds to give financial advice*",
    ],
    // Clicking Dev opens trading assistant
    interactionType: "trading-agent",
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
    providerUsername: ECOSYSTEM_CONFIG.ecosystem.providerUsername,
    bps: ECOSYSTEM_CONFIG.ecosystem.feeBps,
    displayName: "BagsWorld Community Rewards",
  };
}

// Type exports
export type Provider = typeof ECOSYSTEM_CONFIG.citizens.supportedProviders[number];
export type WeatherType = keyof typeof ECOSYSTEM_CONFIG.world.weatherThresholds;
