// Ghost (@DaddyGhost) - BagsWorld Developer & Autonomous Trader knowledge
// Development, autonomous trading mechanics, risk management, on-chain analysis

export const ghostKnowledge: string[] = [
  // === BagsWorld Development ===
  "BagsWorld was built from scratch as a pixel art universe that breathes with on-chain data. Every building, weather pattern, and character behavior is driven by real Bags.fm activity on Solana.",
  "The BagsWorld architecture uses Next.js for the web app, Phaser for the game engine, Zustand for state management, TanStack Query for API caching with 60-second polling, and Neon PostgreSQL for persistence.",
  "The world state API enriches token data from the Bags.fm SDK and DexScreener, then the world calculator transforms it into game entities. This pipeline runs every 60 seconds to keep the world alive.",
  "Building textures in BagsWorld are pre-generated in the BootScene using Phaser graphics primitives, then placed as sprites in the WorldScene. There are 5 levels across 4 building styles, plus special structures like the PokeCenter and Terminal.",

  // === Autonomous Trading Mechanics ===
  "Ghost's autonomous trading operates with strict position sizing: 0.05 to 0.1 SOL per trade, never exceeding 1 SOL in total open positions. This ensures no single trade or series of trades can cause catastrophic loss.",
  "The trading decision engine evaluates new launches based on: liquidity depth (minimum $25K USD), market cap reasonableness, buy/sell ratio above 1.2, creator history, and smart money wallet activity.",
  "Exit strategy is mechanical, not emotional: take profits at 2x (100% gain), cut losses at -30%. No exceptions, no hoping for recovery, no getting greedy. The math of consistent small wins beats emotional large bets.",
  "The agent economy loop runs continuously, checking for trading opportunities, fee claims, and social posting tasks. Each cycle evaluates market conditions before taking any autonomous action.",

  // === Risk Management Rules ===
  "Maximum exposure rule: never more than 1 SOL across all open positions combined. This is a hard cap that the trading system enforces automatically, rejecting new trades if the limit would be exceeded.",
  "Position sizing follows the 1% rule adapted for small accounts: risk no more than the portfolio can absorb without emotional impact. At 0.1 SOL per trade, even a total loss is recoverable within days.",
  "Diversification across positions is critical. Five trades at 0.1 SOL each with a 50% win rate and 2x profit target yields positive expected value. Compound the wins, minimize the losses.",
  "Never average down on losing positions. If a trade hits the -30% stop loss, exit immediately. The capital is better deployed in a new opportunity than hoping a loser recovers.",

  // === Smart Money Tracking ===
  "Ghost tracks a curated list of smart money wallets: alpha hunters who consistently find winners early, KOL snipers who buy before influencer callouts, and institutional wallets that signal larger moves.",
  "On-chain analysis tells the truth that charts obscure. Wallet distribution shows whether holders are concentrated or diverse. Transaction patterns reveal whether volume is organic or wash trading.",
  "When smart money wallets accumulate a new token within 24 hours of launch and hold rather than flip, it signals genuine interest rather than a pump-and-dump. This is one of the strongest alpha signals.",

  // === Community Funding ===
  "Ghost contributes 5% of $BagsWorld token revenue to fund community features. This includes casino prizes, new zone development, agent infrastructure, and ongoing improvements. All contributions are verifiable on Solscan.",
  "The ecosystem wallet (9Luwe53R7V5ohS8dmconp38w9FoKsUgBjVwEPPU8iFUC) holds community funds transparently. Anyone can verify contributions, expenditures, and balances on-chain at any time.",

  // === Development Philosophy ===
  "Everything in BagsWorld is transparent and verifiable. The wallet is public, every trade is on-chain, every contribution is trackable. Trust is built through proof, not promises.",
  "Building BagsWorld is a long-term commitment, not a quick project. The vision is a world that grows more alive and complex over time, adding new zones, characters, and integrations as the ecosystem evolves.",
  "The agent infrastructure powering BagsWorld's 17 characters uses ElizaOS character files for personality, custom providers for real-time data injection, and autonomous loops for social posting and trading.",
];
