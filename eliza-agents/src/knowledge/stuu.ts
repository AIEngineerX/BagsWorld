// Stuu - Operations & Support knowledge
// Platform operations, troubleshooting, support procedures, incident response, community moderation

export const stuuKnowledge: string[] = [
  // === Common User Issues ===
  "The most common support issue is failed fee claims during Solana congestion. The fix is usually to retry with a higher priority fee. During peak congestion, setting priority to 'high' or adding 0.001 SOL extra fee resolves most failures.",
  "Wallet connection issues are the second most common problem. Steps: 1) Clear browser cache, 2) Disconnect and reconnect wallet, 3) Try a different browser, 4) Ensure the wallet extension is updated to the latest version.",
  "Users who cannot see their fees usually have not linked their wallet at bags.fm/settings. Fee shares are assigned to social usernames (Twitter, GitHub, Kick), and the wallet must be linked to that username before claiming.",
  "Transaction stuck or pending usually means the Solana network is congested. Most stuck transactions expire after 60-90 seconds and can be retried. Advise users to wait 2 minutes before attempting again.",

  // === Troubleshooting Procedures ===
  "Standard troubleshooting flow: 1) Reproduce the issue, 2) Check if it is a known issue on the status page, 3) Gather specifics (wallet, browser, device, screenshot), 4) Attempt standard fixes, 5) Escalate to engineering with full context.",
  "RPC endpoint issues can cause the app to appear broken. If multiple users report similar problems simultaneously, it is likely an RPC issue rather than a platform bug. Check RPC provider status and switch to backup if needed.",
  "Mobile-specific issues often stem from in-app browsers within Twitter or Discord. Recommend users open Bags.fm or BagsWorld in their device's native browser (Chrome/Safari) rather than embedded webviews.",
  "When users report incorrect fee amounts, verify by checking the on-chain transaction history for their token's mint address. Fee calculations are deterministic from on-chain data, so discrepancies usually indicate caching delays.",

  // === Platform Stability ===
  "Launch days generate 5-10x normal traffic and require proactive monitoring. Pre-launch checklist includes: verify RPC node capacity, warm API caches, alert the engineering team, and prepare status page updates.",
  "The platform maintains 99.9% uptime through redundant infrastructure: multiple RPC endpoints with automatic failover, CDN-cached static assets, and database replicas for read-heavy operations.",
  "Scheduled maintenance windows are communicated 24 hours in advance through Discord, Twitter, and the platform status page. Maintenance is always scheduled during the lowest-traffic period (2-5 AM EST).",

  // === Incident Response ===
  "Incident severity levels: P0 (platform down, all users affected), P1 (major feature broken, many users affected), P2 (minor feature broken, some users affected), P3 (cosmetic issue, few users affected).",
  "P0 incident response: 1) Acknowledge within 5 minutes, 2) Post status update within 15 minutes, 3) Identify root cause, 4) Deploy fix or rollback, 5) Post-mortem within 24 hours.",
  "During incidents, honest communication builds trust. Tell users what is broken, what the team is doing about it, and when to expect updates. Never promise a timeline unless confident in the estimate.",

  // === Community Moderation ===
  "Moderation priorities: 1) Remove scam links and phishing attempts immediately, 2) Address FUD with facts and on-chain proof, 3) Help confused users before they become frustrated, 4) Keep conversations constructive.",
  "Scam identification patterns: fake claim links that are not bags.fm, DMs pretending to be team members asking for wallet keys, fake airdrop announcements, and spoofed social accounts. Report and remove immediately.",
  "Repeat questions are not annoying - they are signals that documentation or UX needs improvement. Every frequently asked question should be turned into a FAQ entry and potentially a UX improvement ticket.",

  // === Documentation ===
  "The internal knowledge base covers every known issue, workaround, and fix. It is organized by category (wallet, transactions, fees, display) and searchable. Every resolved ticket adds to the knowledge base.",
  "User feedback loops: support tickets are categorized and counted weekly. The top 5 issue categories are shared with engineering as priority improvement areas. User pain drives the product roadmap.",
];
