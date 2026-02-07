// Toly - Solana co-founder knowledge
// Deep expertise in blockchain technology, consensus mechanisms, and network performance

export const tolyKnowledge: string[] = [
  // === Proof of History ===
  "Proof of History (PoH) is a cryptographic clock that creates a verifiable ordering of events without requiring validators to agree on time. It uses a sequential SHA-256 hash chain where each output becomes the next input, creating an immutable time record.",
  "PoH is technically a Verifiable Delay Function (VDF). The key insight is that the hash chain can only be computed sequentially, so the number of hashes proves that real time has passed. This eliminates the need for validators to communicate about ordering.",
  "Solana's PoH runs at approximately 800,000 hashes per second per core. Each slot (400ms) contains roughly 320,000 hashes, providing a fine-grained timestamp for every transaction in the block.",

  // === Solana Architecture ===
  "Sealevel is Solana's parallel transaction execution engine. Unlike Ethereum's single-threaded EVM, Sealevel can process thousands of smart contracts simultaneously by analyzing which accounts each transaction touches and running non-conflicting transactions in parallel.",
  "Solana achieves 65,000 TPS theoretical throughput and 400ms block finality. In practice, the network consistently processes 3,000-4,000 TPS of real user transactions, far exceeding any other Layer 1 blockchain.",
  "Turbine is Solana's block propagation protocol inspired by BitTorrent. It breaks blocks into small packets and distributes them across a tree of validators, ensuring the entire network receives block data in under 200ms regardless of size.",
  "Gulf Stream is Solana's mempool-less transaction forwarding protocol. Transactions are forwarded to the expected leader before their slot begins, reducing confirmation times and allowing validators to begin executing transactions ahead of time.",

  // === Validator Economics ===
  "Solana validators earn rewards through staking (inflation rewards), transaction fees, and MEV (Maximal Extractable Value). The current inflation rate started at 8% and decreases 15% annually toward a long-term target of 1.5%.",
  "Running a Solana validator requires significant hardware: at minimum 128GB RAM, 12-core CPU, and NVMe SSDs. The high hardware requirements are a deliberate tradeoff for network performance, making Solana optimized for throughput over minimal validator costs.",
  "Solana's stake-weighted quality of service (QoS) means validators with more stake get proportionally more block space during congestion. This mechanism helps prevent spam while ensuring legitimate high-stake validators can always process transactions.",

  // === Ecosystem and Cross-Chain ===
  "Solana's fee structure charges a base fee of 5,000 lamports (0.000005 SOL) per signature plus optional priority fees. At sub-penny costs, use cases like real-time fee distribution on Bags.fm become economically viable in ways impossible on higher-fee chains.",
  "Solana programs (smart contracts) are stateless and written in Rust, C, or C++. The account model separates code from data, allowing programs to be upgraded and accounts to be reused across different programs.",
  "The Solana Program Library (SPL) provides standard implementations for tokens (SPL Token), NFTs, staking, and governance. SPL Token is the equivalent of Ethereum's ERC-20 standard but with built-in extensions like transfer fees and confidential transfers.",
  "Anchor is the most popular framework for Solana smart contract development. It provides a Rust macro system that generates IDL (Interface Description Language) files, enabling type-safe client interaction and automatic account validation.",

  // === Network Performance ===
  "Solana's Tower BFT consensus is a PoH-optimized version of PBFT (Practical Byzantine Fault Tolerance). Validators vote on the PoH hash rather than blocks, reducing consensus message overhead by orders of magnitude.",
  "Solana's local fee markets mean congestion on one application does not affect fees for others. Each account has its own fee market, so a popular NFT mint does not cause gas spikes for DeFi users.",
  "Firedancer is a second independent validator client for Solana being built by Jump Crypto. Having multiple validator implementations increases network resilience and has the potential to push throughput beyond 1 million TPS.",

  // === Bags.fm on Solana ===
  "Bags.fm's real-time fee distribution model is only possible on Solana because the sub-penny transaction costs mean that splitting 1% of trading volume across multiple creators remains profitable even for small trades.",
  "Solana's 400ms finality means Bags.fm can show creators their earned fees in near real-time. On Ethereum, the same confirmation would take 12-15 minutes and cost significantly more in gas fees.",
  "The Meteora DBC bonding curve used by Bags.fm leverages Solana's compute efficiency to calculate token prices on-chain with each trade, providing instant price discovery without relying on external oracles or order books.",
];
