// Neo - Scout Agent knowledge
// Launch detection, token analysis, liquidity evaluation, smart money patterns, alpha signals

export const neoKnowledge: string[] = [
  // === Launch Detection ===
  "Neo monitors the Bags.fm API continuously for new token launches. Each new token is evaluated within seconds of deployment, checking creator history, initial liquidity, and early holder patterns.",
  "The scout system uses the Bags.fm token-launch API endpoints to detect new mints. When a new token appears, Neo queries /token-launch/creator/v3 and /token-launch/lifetime-fees to build an initial profile.",
  "Launch velocity matters: tokens that accumulate 50+ unique holders in the first hour show stronger community backing than those with concentrated early accumulation by a few wallets.",
  "Neo tracks launch frequency by creator address. Creators who launch multiple tokens in quick succession are flagged as potential serial launchers, reducing confidence in any single token's longevity.",

  // === Token Analysis ===
  "Initial liquidity is the first filter: tokens with less than $25K USD in liquidity at launch are considered too thin for safe entry. Low liquidity means high slippage and easier manipulation.",
  "The buy/sell ratio in the first 6 hours reveals organic interest versus manufactured activity. A ratio above 1.2 (more buys than sells) suggests genuine demand rather than a coordinated pump.",
  "Token contract analysis checks for common red flags: revoked mint authority is good, active mint authority is a risk. Freeze authority should be revoked. Metadata should be immutable after launch.",
  "Market cap to liquidity ratio reveals pricing health. A token with $1M market cap but only $10K liquidity is fragile. Healthy tokens maintain at least a 10:1 ratio of liquidity to market cap.",

  // === Liquidity Evaluation ===
  "Deep liquidity protects against price manipulation. Neo evaluates the full order book depth, not just the top-of-book price. A token needs sufficient liquidity at multiple price levels to be considered safe.",
  "The Meteora DBC bonding curve used by Bags.fm provides deterministic pricing based on supply. Neo can calculate the exact price impact of any trade size, revealing whether large buys or sells would cause dangerous slippage.",
  "Liquidity lock status and duration are key indicators. Permanently locked liquidity signals long-term commitment from the creator, while unlocked or short-duration locks suggest potential for liquidity removal.",

  // === Smart Money Patterns ===
  "Neo maintains a watch list of wallets that consistently identify winning tokens early. When three or more tracked wallets buy the same token within a 30-minute window, it generates a high-confidence alpha signal.",
  "Front-running patterns are detectable on-chain: when a new wallet buys immediately before a known KOL wallet, it suggests insider knowledge of an upcoming callout. Neo flags these patterns as manipulation.",
  "Whale wallet clustering analysis reveals coordinated activity. When multiple wallets with similar funding sources or transaction timing buy the same token, it suggests a single entity rather than organic demand.",

  // === Alpha Signals ===
  "The strongest alpha signal is convergence: high liquidity, organic buy pressure, smart money accumulation, and creator engagement all present simultaneously. Any single signal can be faked, but the combination is hard to manufacture.",
  "Neo distinguishes between noise and signal using time-weighted analysis. A brief volume spike could be anything, but sustained volume growth over 12-24 hours with increasing holder count indicates genuine momentum.",
  "Creator engagement is a leading indicator: tokens where the creator is actively building community, sharing updates, and engaging with holders consistently outperform tokens from absent creators.",

  // === Blockchain Scanning ===
  "The blockchain is the ultimate source of truth. Charts can be manipulated, social sentiment can be manufactured, but on-chain transactions cannot be faked. Neo always defers to what the code reveals.",
  "Transaction pattern analysis reveals true activity: organic trading shows varied transaction sizes at irregular intervals, while bot activity shows uniform sizes at regular intervals. Neo can differentiate instantly.",
  "Real-time mempool monitoring through Solana's Gulf Stream allows Neo to see pending transactions before they are confirmed, providing an early warning system for large incoming buys or sells.",
];
