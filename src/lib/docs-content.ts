// Documentation content for BagsWorld /docs page

export interface DocSection {
  id: string;
  title: string;
  items: DocItem[];
}

export interface DocItem {
  id: string;
  title: string;
  content: string[];
  infoBox?: {
    title: string;
    items: string[];
  };
  table?: {
    headers: string[];
    rows: string[][];
  };
  codeBlock?: {
    title: string;
    code: string;
  };
  steps?: {
    number: number;
    title: string;
    description: string;
  }[];
  tips?: string[];
}

export const docsContent: DocSection[] = [
  {
    id: "launch-tokens",
    title: "Launch Tokens",
    items: [
      {
        id: "getting-started",
        title: "Getting Started",
        content: [
          "BagsWorld lets you launch tokens directly on Bags.fm. Your token becomes a living building in the game world that grows based on trading activity.",
          "Before launching, you need a Solana wallet (Phantom recommended) with SOL for transaction fees. The launch process is simple - upload an image, enter details, set fee splits, and confirm.",
        ],
        infoBox: {
          title: "Requirements",
          items: [
            "Solana wallet (Phantom, Solflare, etc.)",
            "Small amount of SOL for fees (~0.02 SOL)",
            "Token image (PNG or JPG)",
            "X (Twitter), GitHub, or Kick account linked at bags.fm/settings",
          ],
        },
      },
      {
        id: "token-creation",
        title: "Token Creation Wizard",
        content: [
          "The launch wizard guides you through three steps to create your token on Bags.fm.",
        ],
        steps: [
          {
            number: 1,
            title: "Token Info",
            description:
              "Upload image, enter name/symbol/description, add optional X (Twitter), Telegram, and website links",
          },
          {
            number: 2,
            title: "Fee Sharing",
            description:
              "Configure who earns from trades. Add X (Twitter), GitHub, or Kick accounts. Total must equal 100%",
          },
          {
            number: 3,
            title: "Confirm & Launch",
            description:
              "Review details, optionally buy tokens at launch, sign transaction in wallet",
          },
        ],
      },
      {
        id: "fee-configuration",
        title: "Fee Configuration",
        content: [
          "On Bags.fm, every trade generates fees that are split among fee claimers. These splits are PERMANENT and locked at launch.",
          "BagsWorld does not take additional fees - 100% of the fee share goes to accounts you specify (X, GitHub, or Kick usernames).",
        ],
        infoBox: {
          title: "Important",
          items: [
            "Fee shares CANNOT be changed after launch",
            "Fee claimers must link wallet at bags.fm/settings",
            "Total fee shares must equal exactly 100%",
            "No extra BagsWorld fees - creators get full share",
          ],
        },
        table: {
          headers: ["Fee Type", "Percentage", "Purpose"],
          rows: [
            ["Creator Share", "100%", "Your earnings from trades"],
            ["Bags.fm Fee", "Standard", "Platform fee (separate)"],
          ],
        },
      },
      {
        id: "launch-tips",
        title: "Launch Tips",
        content: ["Follow these best practices to maximize your token's success in BagsWorld."],
        tips: [
          "Use a unique, memorable name and symbol",
          "High-quality pixel art images fit the aesthetic",
          "Write a clear description explaining your token",
          "Add your Twitter for community building",
          "Consider initial buy to show confidence",
          "Check duplicate warnings before launching",
        ],
      },
    ],
  },
  {
    id: "world-mechanics",
    title: "World Mechanics",
    items: [
      {
        id: "health-system",
        title: "Health System",
        content: [
          "World health reflects the overall activity of the BagsWorld ecosystem. It's calculated from real Bags.fm data: claim volume, lifetime fees, and active tokens.",
          "Higher health means better weather, happier characters, and a more vibrant world. When activity is low, the world becomes stormy and buildings may dim.",
        ],
        table: {
          headers: ["24h Claims", "Health Score", "Status"],
          rows: [
            ["50+ SOL", "90-100%", "THRIVING"],
            ["20-50 SOL", "70-90%", "HEALTHY"],
            ["5-20 SOL", "50-70%", "GROWING"],
            ["1-5 SOL", "25-50%", "QUIET"],
            ["<1 SOL", "10-25%", "DORMANT"],
            ["No activity", "<10%", "DYING"],
          ],
        },
        infoBox: {
          title: "Baseline Health",
          items: [
            "25% base + 3% per building (max 40%)",
            "Buildings provide passive health",
            "Fee claims boost health significantly",
          ],
        },
      },
      {
        id: "buildings",
        title: "Building Levels",
        content: [
          "Each token in BagsWorld appears as a building. The building level reflects the token's market cap from DexScreener data.",
          "Buildings glow when they have recent fee activity. Higher-level buildings are larger and more prominent in the world.",
        ],
        table: {
          headers: ["Level", "Market Cap", "Appearance"],
          rows: [
            ["1", "< $100K", "Small structure"],
            ["2", "$100K - $500K", "Medium building"],
            ["3", "$500K - $2M", "Large building"],
            ["4", "$2M - $10M", "Tower"],
            ["5", "$10M+", "Landmark"],
          ],
        },
      },
      {
        id: "weather-system",
        title: "Weather System",
        content: [
          "Weather in BagsWorld is directly tied to world health. Higher health brings sunshine, while low health brings storms.",
        ],
        table: {
          headers: ["Health", "Weather", "Visual Effect"],
          rows: [
            ["80%+", "Sunny", "Bright skies, happy mood"],
            ["60-80%", "Cloudy", "Overcast, neutral mood"],
            ["40-60%", "Rain", "Light rain, cautious mood"],
            ["20-40%", "Storm", "Heavy rain, worried mood"],
            ["<20%", "Apocalypse", "Dark skies, panic mood"],
          ],
        },
      },
      {
        id: "day-night-cycle",
        title: "Day/Night Cycle",
        content: [
          "BagsWorld syncs its day/night cycle to Eastern Standard Time (EST). The world transitions through dawn, day, dusk, and night based on real-world time.",
          "Some events and visual effects vary between day and night.",
        ],
      },
      {
        id: "zones",
        title: "World Zones",
        content: [
          "BagsWorld features five unique zones that you can explore using the minimap. Each zone has a distinct theme, unique characters, and special landmarks.",
        ],
        table: {
          headers: ["Zone", "Theme", "Key Features"],
          rows: [
            ["HQ", "Futuristic R&D", "Bags.fm headquarters, team characters (Ramo, Sincara, Stuu, Sam, Alaa, Carlo, BNN)"],
            ["Park", "Green, peaceful", "PokeCenter, Toly, Ash, Shaw, Finn"],
            ["BagsCity", "Urban, neon", "Casino, Trading Terminal, Neo, CJ"],
            ["Ballers Valley", "Luxury mansions", "Top 5 $BagsWorld holder showcases"],
            ["Founder's Corner", "Learning hub", "Professor Oak, token launch guidance"],
          ],
        },
        infoBox: {
          title: "Navigation",
          items: [
            "Click the map icon to open the minimap",
            "Select any of the 5 zones to teleport",
            "Click landmarks to interact with buildings",
            "Each zone has unique AI characters",
          ],
        },
      },
      {
        id: "locations",
        title: "Landmark Buildings",
        content: [
          "BagsWorld features special landmark buildings with unique functionality. These are permanent fixtures that provide services to all players.",
        ],
        table: {
          headers: ["Building", "Zone", "Function"],
          rows: [
            ["PokeCenter", "Park", "Information hub and world status"],
            ["Community Fund", "Park", "View Ghost's community contributions"],
            ["Casino", "BagsCity", "Raffles, wheel spins, win SOL prizes"],
            ["Trading Terminal", "BagsCity", "Professional trading with charts"],
            ["Bags HQ", "HQ", "Bags.fm team headquarters"],
          ],
        },
      },
      {
        id: "characters",
        title: "AI Agents (ElizaOS)",
        content: [
          "BagsWorld features 16 AI-powered agents running on ElizaOS - Shaw's open-source TypeScript framework for autonomous agents. Each has a unique personality and expertise defined by character files.",
          "Click on any character walking in the world to start a conversation. Agents have persistent memory and can coordinate with each other through multi-agent events.",
        ],
        table: {
          headers: ["Agent", "Role", "Expertise"],
          rows: [
            ["Toly", "Blockchain Expert", "Solana co-founder, technical questions, PoH"],
            ["Ash", "Ecosystem Guide", "Pokemon-themed tips, how BagsWorld works"],
            ["Finn", "Bags.fm Founder", "Platform mechanics, Bags.fm features"],
            ["Ghost/Dev", "The Dev (@DaddyGhost)", "Community funding (5%), on-chain transparency"],
            ["Neo", "Scout Agent", "On-chain patterns, launch detection"],
            ["CJ", "Hood Rat", "GTA San Andreas vibes, market commentary"],
            ["Shaw", "ElizaOS Creator", "AI agents, character files, plugins"],
            ["Bags Bot", "World Guide", "Commands, effects, friendly helper"],
            ["Professor Oak", "Launch Wizard", "Token launch guidance, DexScreener specs"],
            ["Ramo", "CTO", "Smart contracts, SDK, backend"],
            ["Sincara", "Frontend Engineer", "UI/UX, React, animations"],
            ["Stuu", "Operations", "Support, troubleshooting"],
            ["Sam", "Growth", "Marketing, community growth"],
            ["Alaa", "Skunk Works", "R&D, experimental features"],
            ["Carlo", "Ambassador", "Community onboarding"],
            ["BNN", "News Network", "Platform announcements, updates"],
          ],
        },
        infoBox: {
          title: "ElizaOS Infrastructure",
          items: [
            "Framework: ElizaOS (github.com/elizaOS/eliza)",
            "Model: Claude Sonnet 4 (claude-sonnet-4-20250514)",
            "Memory: Persistent conversation history (Neon DB)",
            "Coordination: Multi-agent event system",
          ],
        },
      },
      {
        id: "bot-commands",
        title: "Bags Bot Commands",
        content: [
          "The Bags Bot can execute special commands that trigger visual effects in the world. Simply chat with the bot and mention what you want.",
        ],
        table: {
          headers: ["Command Type", "Examples", "Effect"],
          rows: [
            ["Animals", "pet dog, call cat, scare bird", "Interact with world animals"],
            ["Fireworks", "fireworks, celebration", "Launch fireworks display"],
            ["Particles", "coins, confetti, stars, hearts", "Spray particle effects"],
            ["Special", "ufo", "Trigger special animations"],
          ],
        },
      },
    ],
  },
  {
    id: "bags-integration",
    title: "Bags.fm Integration",
    items: [
      {
        id: "fee-claims",
        title: "Fee Claims",
        content: [
          "When trades happen on your token, fees accumulate for claimers. Visit Bags.fm to claim your earned fees to your wallet.",
          "Fee earnings depend on trading volume and your percentage share. Active tokens with more trading generate more fees.",
        ],
        infoBox: {
          title: "How to Claim",
          items: [
            "Go to bags.fm/portfolio",
            "Connect your wallet",
            "View unclaimed fees",
            "Click Claim to receive SOL",
          ],
        },
      },
      {
        id: "creator-rewards",
        title: "Community Fund",
        content: [
          "BagsWorld charges zero extra fees on token launches. Creators keep 100% of their configured fee share.",
          "Ghost (@DaddyGhost) personally contributes 5% of his $BagsWorld token revenue to fund community features - Casino prizes, development, and new features.",
        ],
        table: {
          headers: ["Feature", "Funding Source", "Status"],
          rows: [
            ["Casino Prizes", "Ghost's 5% contribution", "Live"],
            ["Community Raffles", "Ghost's 5% contribution", "Live"],
            ["New Features", "Ghost's 5% contribution", "Ongoing"],
          ],
        },
        infoBox: {
          title: "Why This Model?",
          items: [
            "Zero extra fees for creators - keep 100%",
            "Ghost funds community himself",
            "All contributions verifiable on-chain",
            "Sustainable as long as $BagsWorld trades",
          ],
        },
      },
      {
        id: "ecosystem-features",
        title: "BagsWorld Features",
        content: [
          "BagsWorld provides visibility and gamification for your Bags.fm token - no extra fees required.",
          "Follow @DaddyGhost on X for updates on new features.",
        ],
        table: {
          headers: ["Feature", "Status", "Description"],
          rows: [
            ["Token Buildings", "Live", "Your token becomes a building in the world"],
            ["5 Zones", "Live", "HQ, Park, BagsCity, Ballers Valley, Founder's Corner"],
            ["16 AI Agents", "Live", "ElizaOS-powered NPCs with unique personalities"],
            ["Casino", "Live", "Games funded by Ghost's 5% contribution"],
            ["Trading Terminal", "Live", "View and trade Bags.fm tokens"],
            ["Pokemon Music", "Live", "3 original pixel art soundtrack tracks"],
          ],
        },
      },
      {
        id: "api-endpoints",
        title: "API Endpoints",
        content: [
          "Developers can integrate with Bags.fm using their public API. BagsWorld uses these endpoints to display real-time data.",
        ],
        codeBlock: {
          title: "Key Endpoints",
          code: `# Get token creators
GET /token-launch/creator/v3?mint={mint}

# Get lifetime fees
GET /token-launch/lifetime-fees?mint={mint}

# Get claim events
GET /fee-share/token/claim-events?mint={mint}

# Create token info
POST /token-launch/create-token-info

# Create launch transaction
POST /token-launch/create-launch-transaction`,
        },
      },
      {
        id: "token-registry",
        title: "Token Registry",
        content: [
          "BagsWorld tracks launched tokens in two ways: local storage for your personal launches and a global database so all players see all tokens.",
          "When you launch a token, it's saved locally immediately and synced to the global database. This ensures your building appears even if the database is temporarily unavailable.",
        ],
        infoBox: {
          title: "Storage",
          items: [
            "Local: Your browser's localStorage",
            "Global: Neon PostgreSQL database",
            "Sync: Automatic on launch",
            "Refresh: Every 30 seconds",
          ],
        },
      },
    ],
  },
];

// Navigation structure for sidebar
export const docsNavigation = docsContent.map((section) => ({
  id: section.id,
  title: section.title,
  items: section.items.map((item) => ({
    id: item.id,
    title: item.title,
  })),
}));
