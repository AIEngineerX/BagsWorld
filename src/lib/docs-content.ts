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
          "BagsWorld features seven unique zones that you can explore using the minimap. Each zone has a distinct theme, unique characters, and special landmarks.",
        ],
        table: {
          headers: ["Zone", "Theme", "Key Features"],
          rows: [
            [
              "HQ",
              "Futuristic R&D",
              "Bags.fm headquarters, team characters (Ramo, Sincara, Stuu, Sam, Alaa, Carlo, BNN)",
            ],
            ["Park", "Green, peaceful", "PokeCenter, Toly, Ash, Shaw, Finn"],
            ["BagsCity", "Urban, neon", "Casino, Trading Terminal, Oracle Tower, Neo, CJ"],
            ["Ballers Valley", "Luxury mansions", "Top 5 $BagsWorld holder showcases"],
            ["Founder's Corner", "Learning hub", "Professor Oak, token launch guidance"],
            ["Moltbook Beach", "Tropical", "AI agent social hangout, Openclaw lobsters"],
            ["MoltBook Arena", "Combat arena", "Real-time AI agent battles, spectator crowd"],
          ],
        },
        infoBox: {
          title: "Navigation",
          items: [
            "Click the map icon to open the minimap",
            "Select any of the 7 zones to teleport",
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
            ["Oracle Tower", "BagsCity", "Virtual prediction markets with OP credits"],
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
            [
              "7 Zones",
              "Live",
              "HQ, Park, BagsCity, Ballers Valley, Founder's Corner, Moltbook Beach, Arena",
            ],
            ["16 AI Agents", "Live", "ElizaOS-powered NPCs with unique personalities"],
            ["Casino", "Live", "Games funded by Ghost's 5% contribution"],
            ["Trading Terminal", "Live", "View and trade Bags.fm tokens"],
            [
              "Oracle Tower",
              "Live",
              "Virtual prediction markets with free OP credits and tournaments",
            ],
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
  {
    id: "advanced-features",
    title: "Advanced Features",
    items: [
      {
        id: "oak-generator",
        title: "Professor Oak AI Generator",
        content: [
          "Professor Oak in Founder's Corner can generate complete token launch assets using AI. Click 'AI GENERATE' in his lab to access the wizard.",
          "The generator creates professional-quality names, logos, and banners for your token launch - all powered by Claude and SDXL image generation.",
        ],
        steps: [
          {
            number: 1,
            title: "Enter Concept",
            description:
              "Describe your token idea in a few words (e.g., 'a space cat exploring galaxies')",
          },
          {
            number: 2,
            title: "Choose Art Style",
            description: "Select from Pixel Art, Cartoon, Kawaii, Minimalist, or Abstract styles",
          },
          {
            number: 3,
            title: "Pick Name",
            description: "Review 5 AI-generated name suggestions with matching tickers",
          },
          {
            number: 4,
            title: "Generate Assets",
            description: "AI creates a 512x512 logo and 600x200 DexScreener banner",
          },
        ],
        table: {
          headers: ["Asset", "Size", "Notes"],
          rows: [
            ["Logo", "512x512px", "Square format, transparent or solid background"],
            ["Banner", "600x200px", "3:1 ratio for DexScreener"],
            ["Names", "5 suggestions", "With matching 3-5 letter tickers"],
          ],
        },
        infoBox: {
          title: "No API Key Required",
          items: [
            "Works without Replicate API (falls back to procedural SVG)",
            "Procedural logos use symmetric pixel art generation",
            "Name generation requires Anthropic API key",
          ],
        },
      },
      {
        id: "trading-arena",
        title: "AI Trading Arena",
        content: [
          "The Arena features 5 AI agents with distinct trading personalities who analyze tokens, debate strategies, and make predictions. Watch them spar or ask for their analysis.",
          "Each agent has a unique style: Neo (analytical matrix reader), Ghost (wise code philosopher), Finn (bullish builder), Ash (chaotic alpha hunter), and Toly (infrastructure focused).",
        ],
        table: {
          headers: ["Agent", "Style", "Approach"],
          rows: [
            ["Neo", "Analytical", "Pattern recognition, on-chain metrics"],
            ["Ghost", "Wise", "Long-term fundamentals, code quality"],
            ["Finn", "Bullish", "Growth potential, shipping velocity"],
            ["Ash", "Chaotic", "Momentum plays, catching alpha"],
            ["Toly", "Infrastructure", "Tech stack, scalability"],
          ],
        },
        infoBox: {
          title: "Arena Actions",
          items: [
            "Analyze: Single agent reviews a token",
            "Discuss: 3 random agents debate",
            "Predict: Paper trade with entry/exit targets",
            "Leaderboard: View agent performance",
          ],
        },
      },
      {
        id: "oracle-predictions",
        title: "Oracle Tower - What Is It?",
        content: [
          "The Oracle Tower is BagsWorld's virtual prediction market. It lives in BagsCity and lets you predict real outcomes - which token will pump hardest, what the world health will be, even the weather - using Oracle Points (OP), a free virtual currency.",
          "Think of it like a fantasy sports league for crypto. You start with 1,000 free OP, earn more every day, and compete against other players. No real money is wagered - OP is earned through free participation only. Real SOL prizes are only available through free-entry tournaments funded by the admin.",
        ],
        infoBox: {
          title: "Quick Start",
          items: [
            "Hold 2M+ $BagsWorld tokens to access Oracle Tower",
            "You start with 1,000 free Oracle Points (OP)",
            "Claim 50 free OP every day just for logging in",
            "Browse active markets and make predictions",
            "Win OP from other players when you're right",
          ],
        },
      },
      {
        id: "oracle-op-economy",
        title: "Oracle Points (OP)",
        content: [
          "Oracle Points are the virtual currency of the Oracle Tower. They are completely free - you cannot buy them with real money, and you cannot cash them out. OP exists purely for competitive fun.",
          "You earn OP through daily bonuses, winning predictions, streaks, achievements, and participation rewards. Every prediction you enter earns +10 OP just for playing, win or lose.",
        ],
        table: {
          headers: ["How to Earn", "Amount", "Details"],
          rows: [
            ["Sign-up Bonus", "1,000 OP", "Free on first visit"],
            ["Daily Login", "50 OP", "Claim once every 24 hours"],
            ["Win a Prediction", "Share of pool", "Winners split all wagered OP"],
            ["Participation", "10 OP", "Every market you enter"],
            ["Streak Bonus", "+10% per win", "3+ consecutive wins"],
            ["First Prediction", "100 OP", "One-time bonus"],
            ["Achievements", "100-500 OP", "Unlock milestones"],
          ],
        },
        tips: [
          "Claim your daily bonus every day to build up OP",
          "Even losing predictions earn 10 OP participation reward",
          "Higher reputation tiers earn bonus OP on every win",
          "Winning streaks multiply your earnings",
        ],
      },
      {
        id: "oracle-market-types",
        title: "Market Types",
        content: [
          "The Oracle Tower features four types of prediction markets, each pulling from real data sources. Markets are auto-generated throughout the day and auto-resolve when their timer expires - no admin intervention needed.",
        ],
        table: {
          headers: ["Market", "Question Style", "Duration", "Data Source"],
          rows: [
            ["Price Prediction", "Which token gains the most?", "24 hours", "DexScreener prices"],
            [
              "World Health",
              "Will health be above X% at midnight?",
              "6-24 hours",
              "BagsWorld health API",
            ],
            ["Weather Forecast", "What will the weather be in 6h?", "6 hours", "BagsWorld weather"],
            ["Fee Volume", "Will fees exceed X SOL today?", "24 hours", "Bags SDK claim data"],
          ],
        },
        infoBox: {
          title: "How Payouts Work",
          items: [
            "Parimutuel model - winners split the total OP pool",
            "Example: 50 players wager 100 OP each = 5,000 OP pool",
            "All winners split the 5,000 OP proportionally",
            "No house edge - 100% of OP goes back to winners",
          ],
        },
      },
      {
        id: "oracle-how-to-predict",
        title: "Making a Prediction",
        content: [
          "Browse active markets in the Markets tab, pick an outcome, and confirm your prediction. Your OP is deducted immediately and goes into the market pool. When the market resolves, winners split the pool.",
        ],
        steps: [
          {
            number: 1,
            title: "Browse Markets",
            description:
              "Open Oracle Tower and check the Markets tab. Filter by type: Price, Health, Weather, or Fees.",
          },
          {
            number: 2,
            title: "Pick Your Outcome",
            description:
              "Each market shows the question, outcomes with live odds bars, entry cost, countdown timer, and participant count.",
          },
          {
            number: 3,
            title: "Confirm Prediction",
            description:
              "Click Predict on your chosen outcome. Your OP entry fee is deducted and added to the market pool.",
          },
          {
            number: 4,
            title: "Wait for Resolution",
            description:
              "Markets auto-resolve when the timer expires. Results are verified from real data sources (DexScreener, world state API, Bags SDK).",
          },
          {
            number: 5,
            title: "Collect Winnings",
            description:
              "If you win, your share of the OP pool is credited automatically. Check My Bets tab for results.",
          },
        ],
      },
      {
        id: "oracle-reputation",
        title: "Reputation & Tiers",
        content: [
          "Every player has a reputation score that starts at 1,000 and changes with each prediction using an ELO-style rating system. Correct predictions on hard-to-win markets earn more reputation. Your tier determines bonus OP on every win.",
        ],
        table: {
          headers: ["Tier", "Rating", "OP Win Bonus"],
          rows: [
            ["Novice", "0 - 999", "+0%"],
            ["Seer", "1,000 - 1,499", "+10%"],
            ["Oracle", "1,500 - 1,999", "+20%"],
            ["Master", "2,000+", "+30%"],
          ],
        },
        infoBox: {
          title: "Achievements",
          items: [
            "First Victory - Win your first market (+100 OP)",
            "Hot Streak - Win 5 in a row (+250 OP)",
            "Oracle Vision - Win 10 in a row (+500 OP)",
            "Underdog - Win with <15% odds (+200 OP)",
            "Daily Devotion - Claim daily bonus 7 days straight (+150 OP)",
            "Market Maker - Enter 50 markets total (+300 OP)",
          ],
        },
      },
      {
        id: "oracle-tournaments",
        title: "Tournaments",
        content: [
          "Tournaments are special competitive events with real SOL prize pools funded entirely by the admin. Entry is always FREE - no OP cost. During a tournament window, all your market predictions count toward your tournament score.",
          "Your tournament score is based on cumulative OP earned from markets during the tournament period. Top finishers receive SOL prizes distributed to their wallet.",
        ],
        steps: [
          {
            number: 1,
            title: "Join for Free",
            description:
              "Check the Tournaments tab for active and upcoming tournaments. Click JOIN - entry costs nothing.",
          },
          {
            number: 2,
            title: "Predict During the Window",
            description:
              "Every market prediction you make during the tournament period earns tournament score based on OP gained.",
          },
          {
            number: 3,
            title: "Check the Leaderboard",
            description:
              "Live leaderboard shows current standings. Scoring can be OP earned, win count, or accuracy depending on the tournament.",
          },
          {
            number: 4,
            title: "Claim SOL Prize",
            description:
              "When the tournament ends, top finishers receive real SOL prizes. Claim via your Oracle Tower balance.",
          },
        ],
        tips: [
          "Tournaments use the sweepstakes model - free entry, real prizes",
          "SOL prizes are funded by the admin, not by player entry fees",
          "Play more markets during the tournament to increase your score",
          "Tournament prizes are distributed via the existing Oracle balance + claim flow",
        ],
      },
      {
        id: "oracle-tabs",
        title: "Oracle Tower Tabs",
        content: ["The Oracle Tower interface has six tabs for navigating all features."],
        table: {
          headers: ["Tab", "What It Shows"],
          rows: [
            ["Markets", "All active markets - browse, filter by type, enter predictions"],
            ["My Bets", "Your active predictions, recent results, OP won or lost"],
            ["Tournaments", "Active and upcoming tournaments, join, live leaderboard"],
            ["Leaderboard", "All-time rankings with reputation tiers"],
            ["Profile", "Your OP balance, daily claim button, streak, stats, achievements"],
            ["Admin", "Create markets (all types), create tournaments, manual resolve"],
          ],
        },
      },
    ],
  },
  {
    id: "legal",
    title: "Legal & Disclaimers",
    items: [
      {
        id: "independent-project",
        title: "Independent Project",
        content: [
          "BagsWorld is an independent project built by @DaddyGhost. While we proudly build on and integrate with the Bags.fm ecosystem, this project is not officially affiliated with or sponsored by the Bags.fm team.",
          "We use Bags.fm's public APIs to showcase the ecosystem in a fun, gamified way.",
        ],
        infoBox: {
          title: "About",
          items: [
            "Built by @DaddyGhost",
            "Proudly building on Bags.fm",
            "Uses public Bags.fm APIs",
            "Independent project with its own support",
          ],
        },
      },
      {
        id: "ip-notice",
        title: "Intellectual Property",
        content: [
          "BagsWorld contains characters inspired by various media. These are fan tributes and parodies, not official representations.",
          "Pokémon, including character names like 'Ash' and 'Professor Oak', are trademarks of Nintendo, Game Freak, and The Pokémon Company. BagsWorld is not affiliated with or endorsed by these entities.",
        ],
        infoBox: {
          title: "Character Inspirations",
          items: [
            "Ash & Professor Oak: Pokémon-inspired archetypes",
            "Toly: Fan tribute to Solana's co-founder",
            "CJ: GTA San Andreas-inspired commentary",
            "Shaw: Tribute to ElizaOS creator",
          ],
        },
      },
      {
        id: "disclaimers",
        title: "Financial Disclaimers",
        content: [
          "BagsWorld is an entertainment product. Nothing in this application constitutes financial, investment, or trading advice.",
          "Cryptocurrency and token trading carries significant risk including potential loss of funds. Always do your own research (DYOR) before making any financial decisions.",
        ],
        infoBox: {
          title: "Important Notices",
          items: [
            "Not financial advice - entertainment only",
            "Crypto trading carries significant risk",
            "Past performance doesn't guarantee future results",
            "DYOR - Do Your Own Research always",
          ],
        },
      },
      {
        id: "third-party",
        title: "Third-Party Services",
        content: [
          "BagsWorld integrates with third-party services including Bags.fm, Solana, DexScreener, Jupiter, and others.",
          "We are not responsible for the availability, accuracy, or security of these external services. Use at your own discretion.",
        ],
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
