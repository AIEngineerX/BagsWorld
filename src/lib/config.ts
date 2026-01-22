// BagsWorld Ecosystem Configuration
// This defines the core mechanics that make BagsWorld valuable

// =============================================================================
// WHY JOIN BAGSWORLD?
// =============================================================================
// 1. CREATOR REWARDS: Top 3 creators get paid directly from ecosystem fees
// 2. VISIBILITY: Your token becomes a building in a living world
// 3. SUCCESS REWARDS SUCCESS: More volume = more fees = higher ranking = bigger rewards
// 4. LOW FEE: Only 1% ecosystem fee funds rewards, casino, and future features
// =============================================================================
//
// ECOSYSTEM FEE ALLOCATION:
// - Creator Rewards Pool: Top 3 creators by fee generation
// - Casino Rewards: Wheel spins, raffles, and jackpots (coming soon)
// - Future Features: New game mechanics and community rewards
//
// Follow @DaddyGhost on X for updates
// =============================================================================

export const ECOSYSTEM_CONFIG = {
  // -------------------------------------------------------------------------
  // ECOSYSTEM FEE STRUCTURE
  // -------------------------------------------------------------------------
  // Every token launched through BagsWorld contributes 1% to the ecosystem
  // Fees are SET PERMANENTLY at launch - locked forever, trustless
  // All fees go to rewarding top 3 creators based on fee contribution
  ecosystem: {
    // Wallet that receives ecosystem fees - viewable on Solscan
    wallet: process.env.NEXT_PUBLIC_ECOSYSTEM_WALLET || "9Luwe53R7V5ohS8dmconp38w9FoKsUgBjVwEPPU8iFUC",

    // Partner Config PDA - created at dev.bags.fm
    // This enables BagsWorld to earn Bags.fm partner fees from token launches
    // Partner fees are SEPARATE from the 1% ecosystem fee
    partnerConfigPda: "5TcACd9yCLEBewdRrhk9hb6A22oS2gFLzG7oH5YCq1Po",

    // Fee percentage in basis points (100 = 1%)
    // 1% goes to @BagsWorldApp for ecosystem rewards
    feeBps: 100,

    // Creator Rewards System
    // - Rewards top 3 token creators based on fee contribution
    // - Distributes when threshold hit OR backup timer expires
    // - Direct SOL payments to creator wallets
    rewards: {
      thresholdSol: 5.0,                        // Distribute when 5+ SOL accumulated
      backupTimerDays: 3,                       // Or distribute after 3 days
      minimumDistributionSol: 2.0,              // Minimum SOL required for timer-based distribution
      checkIntervalMs: 15 * 60 * 1000,          // Check every 15 minutes
      reservePercentage: 10,                    // 10% reserved for gas/operations
      topCreatorsCount: 3,                      // Reward top 3 creators
      distribution: {
        first: 50,                              // 1st place: 50% of pot
        second: 30,                             // 2nd place: 30% of pot
        third: 20,                              // 3rd place: 20% of pot
      },
    },

    // Scout Agent: Scans for new token launches in real-time
    scout: {
      minLiquidityUsd: 500,                     // Min $500 liquidity to alert
      bagsOnly: false,                          // Track all launches or just Bags
      maxAlertsPerMinute: 30,                   // Rate limit
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
      buyUrl: "https://bags.fm/token/9auyeHWESnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS",
    },
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
      { level: 1, name: "Startup", minMarketCap: 0, icon: "🏠" },
      { level: 2, name: "Growing", minMarketCap: 100_000, icon: "🏢" },
      { level: 3, name: "Established", minMarketCap: 500_000, icon: "🏦" },
      { level: 4, name: "Major", minMarketCap: 2_000_000, icon: "🏰" },
      { level: 5, name: "Elite", minMarketCap: 10_000_000, icon: "👑" },
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
    refreshInterval: 60_000,  // 60 seconds (optimized for smoother rendering)
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
        title: "5 SOL Threshold",
        description: "Fees accumulate until 5 SOL or 3 days pass",
        icon: "5",
      },
      {
        title: "Top 3 Creators",
        description: "Top 3 token creators by fees get rewarded",
        icon: "3",
      },
      {
        title: "Direct Rewards",
        description: "SOL sent directly to creator wallets (50/30/20 split)",
        icon: "S",
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
  // CREATOR REWARDS HUB (Permanent landmark)
  // -------------------------------------------------------------------------
  // This building always appears in the world and links to Solscan
  // Shows the creator rewards system: top 3 creators get paid
  treasury: {
    id: "BagsWorldRewardsHub",
    name: "Creator Rewards Hub",
    symbol: "REWARDS",
    description: "Ecosystem fees reward top 3 creators. 5 SOL threshold or 3 days. 50/30/20 split. Click to verify on Solscan.",
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
      "Top 3 creators get rewarded from the ecosystem pool - like winning the Pokemon League!",
      "Just like Pokemon evolve, your building grows as market cap increases!",
      "Drive volume, earn fees, climb the leaderboard - top 3 get paid directly!",
      "I wanna be the very best! And in BagsWorld, the best creators get rewarded!",
      "Remember: 1% ecosystem fee, top 3 creators split the pot. 50/30/20!",
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
  // DaddyGhost (@DaddyGhost) is the developer who runs the creator rewards system
  dev: {
    id: "daddyghost",
    username: "Ghost",
    provider: "twitter" as const,
    providerUsername: "DaddyGhost",
    twitterHandle: "DaddyGhost",
    mood: "happy" as const,
    // Ghost runs the creator rewards system: fees accumulate, distribute to top 3 creators
    quotes: [
      "yo i run the rewards system. fees stack up, hit 10 SOL or 5 days, top 3 creators get paid",
      "no middleman. ecosystem fees go directly to creator wallets. 50/30/20 split for top 3",
      "threshold-based rewards are efficient. bigger payouts, less gas waste, real money to devs",
      "the system tracks fee contribution. top 3 tokens by volume = top 3 creators get rewarded",
      "i built this to reward good devs. stack fees -> hit threshold -> claim -> pay creators directly",
      "check the wallet on solscan. fees accumulate, then boom - SOL to the top 3 creators",
      "not just a dev, im the ghost in the machine. you build, you earn. simple as that",
      "90% of claimed fees go to creators. top 3 by fee contribution. no burn, just rewards",
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
    provider: ECOSYSTEM_CONFIG.ecosystem.provider,  // "twitter"
    providerUsername: ECOSYSTEM_CONFIG.ecosystem.providerUsername,  // "BagsWorldApp"
    bps: ECOSYSTEM_CONFIG.ecosystem.feeBps,
    displayName: ECOSYSTEM_CONFIG.ecosystem.providerUsername,
  };
}

// Type exports
export type Provider = typeof ECOSYSTEM_CONFIG.citizens.supportedProviders[number];
export type WeatherType = keyof typeof ECOSYSTEM_CONFIG.world.weatherThresholds;
