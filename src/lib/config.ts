// BagsWorld Ecosystem Configuration
// This defines the core mechanics that make BagsWorld valuable

// =============================================================================
// WHY JOIN BAGSWORLD?
// =============================================================================
// 1. BUYBACK & BURN: Top performing tokens get bought and burned automatically
// 2. VISIBILITY: Your token becomes a building in a living world
// 3. SUCCESS REWARDS SUCCESS: The better your token does, the more support it gets
// 4. LOW FEE: Only 1% ecosystem fee funds the buyback engine
// =============================================================================

export const ECOSYSTEM_CONFIG = {
  // -------------------------------------------------------------------------
  // ECOSYSTEM FEE STRUCTURE
  // -------------------------------------------------------------------------
  // Every token launched through BagsWorld contributes 1% to the ecosystem
  // Fees are SET PERMANENTLY at launch - locked forever, trustless
  // All fees go to buying back and burning top performing tokens
  ecosystem: {
    // Wallet that receives ecosystem fees - viewable on Solscan
    wallet: process.env.NEXT_PUBLIC_ECOSYSTEM_WALLET || "9Luwe53R7V5ohS8dmconp38w9FoKsUgBjVwEPPU8iFUC",

    // Fee percentage in basis points (100 = 1%)
    feeBps: 100,

    // Autonomous agents manage the ecosystem wallet:
    // - Auto-Claim Agent: Claims fees every 5 minutes
    // - Buyback Agent: Every 12 hours, buys top tokens and burns them
    // - Scout Agent: Scans for new token launches in real-time
    agents: {
      autoClaimIntervalMs: 5 * 60 * 1000,      // 5 minutes
      buybackIntervalMs: 12 * 60 * 60 * 1000,  // 12 hours
      buybackPercentage: 80,                    // 80% for buybacks
      reservePercentage: 20,                    // 20% for operations/gas
      topTokensCount: 5,                        // Buy top 5 tokens
      burnAfterBuy: true,                       // Burn purchased tokens
      scout: {
        minLiquidityUsd: 500,                   // Min $500 liquidity to alert
        bagsOnly: false,                        // Track all launches or just Bags
        maxAlertsPerMinute: 30,                 // Rate limit
      },
    },

    // Provider name shown in fee shares
    // Use "solana" provider with wallet address for direct wallet fee shares
    provider: "solana" as const,
    providerUsername: "BagsWorld Ecosystem",
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
        title: "Buyback Engine",
        description: "Top performing tokens get bought automatically",
        icon: "B",
      },
      {
        title: "Deflationary Burns",
        description: "Purchased tokens are burned, reducing supply",
        icon: "F",
      },
      {
        title: "Only 1% Fee",
        description: "Low fee funds the buyback engine",
        icon: "1",
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
      "Only 3% fee here, and the top creator each week gets 40% back - like winning the Pokemon League!",
      "Just like Pokemon evolve, your building grows as market cap increases!",
      "Top holders of the best token get airdrops - it's like getting rare candies for being loyal!",
      "I wanna be the very best! And in BagsWorld, the best creators and holders get rewarded weekly!",
      "Remember: low fees, big rewards - that's the BagsWorld way!",
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
  // DaddyGhost (@DaddyGhost) is the developer who runs the auto-claim and buyback agents
  dev: {
    id: "daddyghost",
    username: "Ghost",
    provider: "twitter" as const,
    providerUsername: "DaddyGhost",
    twitterHandle: "DaddyGhost",
    mood: "happy" as const,
    // Ghost runs the backend agents - auto-claim every 5min, buyback every 12hr using his own fees
    quotes: [
      "yo i run the agents around here. my fees get auto-claimed, then 50% goes to buying back top tokens",
      "every 12 hours i use my own fees to buy back the top 3 tokens and burn them. giving back to holders",
      "fees sent to my account @DaddyGhost get claimed automatically. half of that goes to buybacks",
      "im not taking from anyone - these are my creator fees. i just reinvest 50% back into buybacks",
      "i built this and i put my money where my mouth is. 50% of my fees = buybacks and burns",
      "trust the process. my fees, my buybacks, your gains. tokens get burned permanently",
      "not just a dev, im the ghost in the machine. using my own bag to buy back and burn",
      "check my wallet on solscan - you can see every claim and every burn. fully transparent",
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
    provider: ECOSYSTEM_CONFIG.ecosystem.provider,
    providerUsername: ECOSYSTEM_CONFIG.ecosystem.wallet,
    bps: ECOSYSTEM_CONFIG.ecosystem.feeBps,
    displayName: ECOSYSTEM_CONFIG.ecosystem.providerUsername,
  };
}

// Type exports
export type Provider = typeof ECOSYSTEM_CONFIG.citizens.supportedProviders[number];
export type WeatherType = keyof typeof ECOSYSTEM_CONFIG.world.weatherThresholds;
