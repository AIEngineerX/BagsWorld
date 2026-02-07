// Ramo - CTO knowledge
// Smart contract development, SDK design, Solana program architecture, API design, system engineering

export const ramoKnowledge: string[] = [
  // === Smart Contract Development ===
  "The Bags.fm fee-share smart contract has been audited three times with zero critical findings. Security is not a feature but a fundamental requirement when handling creator royalties on-chain.",
  "The fee-share system works by intercepting 1% of every trade's volume at the protocol level, splitting it according to the configured fee share percentages, and making it available for claiming by verified wallets.",
  "Smart contracts on Bags.fm have no admin keys that can rug users. Once deployed, the royalty enforcement is immutable. This design decision prioritizes user trust over operational flexibility.",
  "The Meteora DBC (Dynamic Bonding Curve) integration handles token pricing. Each trade calculates the exact price based on current supply along the bonding curve, providing deterministic pricing without external oracles.",
  "Contract upgrades on Bags.fm follow a strict process: audit the new code, deploy to devnet, run a comprehensive test suite, get a second audit opinion, then deploy to mainnet with a time-locked migration.",

  // === SDK Design ===
  "The Bags.fm TypeScript SDK provides typed interfaces for all platform operations: token launches, fee queries, claim transactions, and creator lookups. Full TypeScript types mean IDE autocomplete and compile-time error checking.",
  "SDK design follows the principle of progressive disclosure: simple operations (query a token, check fees) are one-liner function calls, while complex operations (launch with custom parameters) expose the full configuration surface.",
  "The SDK handles Solana-specific concerns like transaction building, signing, and retry logic transparently. Developers work with high-level operations while the SDK manages serialization, blockhash fetching, and confirmation polling.",
  "API rate limiting is built into the SDK client with exponential backoff. When the public API returns 429 responses, the client automatically retries with increasing delays, preventing thundering herd problems.",

  // === Solana Program Architecture ===
  "Solana programs are stateless executables that operate on accounts passed to them. The account model separates code from data, allowing a single deployed program to manage millions of independent token configurations.",
  "Account validation is the most critical security concern in Solana programs. Every instruction must verify that each passed account is the correct type, owned by the expected program, and has the right seeds for PDAs.",
  "Program Derived Addresses (PDAs) provide deterministic account addresses based on seeds and the program ID. Bags.fm uses PDAs to create unique fee vaults for each token, ensuring funds cannot be misdirected.",
  "Cross-program invocations (CPIs) allow Bags.fm contracts to interact with SPL Token, Meteora, and other programs in a single atomic transaction. If any step fails, the entire transaction reverts.",

  // === API Design ===
  "The Bags.fm public API (v2) follows RESTful conventions with consistent endpoint patterns: /token-launch/* for launch operations, /fee-share/* for fee queries, and standardized error responses with meaningful codes.",
  "API versioning ensures backward compatibility. The v1 API remains available for existing integrations while v2 adds new capabilities. Breaking changes only happen in major version bumps with migration guides.",
  "The API serves both the Bags.fm web application and third-party integrations. BagsWorld's world state endpoint aggregates multiple API calls into a single response optimized for game state updates.",

  // === System Engineering ===
  "The Bags.fm infrastructure handles sustained load of thousands of concurrent users during popular launches. Auto-scaling, caching layers, and Solana RPC node redundancy ensure platform stability.",
  "Fee claiming retry logic is critical during Solana congestion. The system implements priority fee estimation, transaction retry with updated blockhashes, and user-facing status updates to ensure claims eventually land.",
  "Monitoring and alerting cover every critical path: API response times, RPC node health, contract execution success rates, and fee accumulation patterns. Anomalies trigger automated alerts before users notice problems.",
  "The architecture separates hot paths (real-time trading, fee calculations) from cold paths (analytics, historical queries) using different database configurations and caching strategies for optimal performance.",
];
