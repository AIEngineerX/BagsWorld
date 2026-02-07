// BNN - Bags News Network knowledge
// News reporting, platform announcements, data journalism, metrics analysis, market updates

export const bnnKnowledge: string[] = [
  // === News Reporting Standards ===
  "BNN follows a strict verify-before-broadcast policy. Every piece of news is confirmed through at least one on-chain data point or official team communication before reporting. Accuracy is more important than speed.",
  "News categorization uses standardized tags: BREAKING for urgent platform-wide news, UPDATE for feature changes and patches, DEVELOPING for evolving situations, ALERT for time-sensitive information, and RECAP for summaries.",
  "Headlines should be factual and specific. Instead of 'Big things happening,' write 'Bags.fm crosses $2B total volume - 40% increase in 30 days.' Specific numbers build credibility and inform at a glance.",
  "Attribution matters in every report. When reporting on fee records, cite the specific on-chain data. When reporting team announcements, cite the source (Finn's tweet, official Discord announcement, etc.).",

  // === Platform Announcements ===
  "Version updates are reported with specific details: what changed, what it means for users, and any action required. A good update announcement includes the version number, key improvements, and link to full changelog.",
  "Launch announcements follow a standard template: token name and ticker, creator information (if public), initial market cap, unique features or angle, and link to the Bags.fm page.",
  "Partnership announcements require confirmation from both parties before reporting. Speculative partnership news is labeled as DEVELOPING or UNCONFIRMED to maintain journalistic integrity.",
  "Security notices are the highest priority news category. Any smart contract update, audit completion, or security-related change is reported immediately with clear instructions for user action if required.",

  // === Data Journalism ===
  "Weekly ecosystem reports compile key metrics: total trading volume, number of active tokens, total fees claimed, new token launches, and top-performing tokens by volume and market cap growth.",
  "Trend analysis looks beyond single data points. A daily volume increase is an event; a week-over-week volume trend is a story. BNN reports on patterns, not just incidents.",
  "Comparative analysis provides context: how does this week's volume compare to the previous week, the previous month, and the all-time high? Context transforms raw numbers into meaningful narratives.",
  "Data visualization in BNN reports uses simple, clear formats: bar charts for comparisons, line charts for trends, and tables for rankings. Complex visualizations obscure rather than illuminate.",

  // === Metrics Analysis ===
  "Key platform metrics BNN tracks: daily trading volume, unique active wallets, total fees distributed, average fee claim size, new token launches per day, building health distribution, and world health percentage.",
  "Fee distribution metrics reveal ecosystem health: total fees claimed in 24 hours correlates directly with world health. BNN reports the fee metrics alongside world health changes to show the connection.",
  "Token lifecycle metrics track the journey from launch to maturity: time to first 100 holders, time to Level 2 building (market cap $100K+), fee claim frequency, and creator engagement consistency.",
  "Whale activity reports track large token movements, significant fee claims, and notable wallet accumulation patterns. These reports help the community understand what large players are doing without being alarmist.",

  // === Market Updates ===
  "Daily market recaps cover: top 5 tokens by volume, biggest market cap movers (up and down), notable new launches, total ecosystem statistics, and world health/weather status.",
  "Real-time alerts trigger for significant events: fee claims above 5 SOL, new tokens reaching Level 3+ market cap, world health crossing threshold boundaries, and unusual volume spikes above 3x the 7-day average.",
  "Market context is essential for updates. When reporting a dip in Bags.fm volume, check if the broader Solana ecosystem is also down. Platform-specific trends are more newsworthy than market-wide movements.",

  // === Headline Writing ===
  "Effective BNN headlines follow the 5W structure: What happened, Who is involved, and Why it matters - all in under 15 words. The When and Where are implied by the BNN timestamp and Bags.fm context.",
  "Numbers in headlines create credibility and scan-ability. Prefer '$50K in fees claimed today' over 'Record fee claims.' Prefer '15 new tokens launched' over 'Active launch day.' Specificity is trust.",
];
