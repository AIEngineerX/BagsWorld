// Bags Live Feed - Platform-wide Bags.fm activity via Bitquery
// Fetches ALL Bags.fm launches, trades, and claims (not just registered tokens)

import {
  emitTokenLaunch,
  emitFeeClaim,
  emitWhaleAlert,
  emitPricePump,
  emitPriceDump,
} from "./agent-coordinator";

// ============================================================================
// CONSTANTS
// ============================================================================

// Bags.fm Creator Program Signer (identifies all Bags tokens)
const BAGS_CREATOR_SIGNER = "BAGSB9TpGrZxQbEsrEznv5jXXdwyP6AXerN8aVRiAmcv";

// Meteora DBC Program (bonding curve for Bags launches)
const METEORA_DBC_PROGRAM = "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN";

// Bitquery API endpoint
const BITQUERY_API_URL = "https://streaming.bitquery.io/graphql";

// Polling intervals (conservative to avoid rate limits)
const POLL_INTERVAL_LAUNCHES = 120_000; // 2 minutes
const POLL_INTERVAL_TRADES = 90_000; // 1.5 minutes
const POLL_INTERVAL_WHALES = 300_000; // 5 minutes

// Thresholds
const WHALE_THRESHOLD_SOL = 10; // 10+ SOL = whale alert
const PUMP_THRESHOLD_PERCENT = 20; // 20%+ = pump alert
const DUMP_THRESHOLD_PERCENT = -15; // -15% = dump alert

// ============================================================================
// TYPES
// ============================================================================

export interface BagsLaunch {
  mint: string;
  name: string;
  symbol: string;
  creator: string;
  timestamp: number;
  signature: string;
  initialSupply?: number;
}

export interface BagsTrade {
  mint: string;
  symbol: string;
  side: "buy" | "sell";
  amountToken: number;
  amountSol: number;
  priceUsd: number;
  trader: string;
  timestamp: number;
  signature: string;
}

export interface BagsTransfer {
  mint: string;
  symbol: string;
  amount: number;
  amountUsd: number;
  from: string;
  to: string;
  timestamp: number;
  signature: string;
}

export interface TokenPriceChange {
  mint: string;
  symbol: string;
  priceNow: number;
  priceBefore: number;
  changePercent: number;
}

export interface LiveFeedState {
  isRunning: boolean;
  lastLaunchCheck: number;
  lastTradeCheck: number;
  lastWhaleCheck: number;
  launchesFound: number;
  tradesFound: number;
  whaleAlertsFound: number;
  errors: string[];
  recentLaunches: BagsLaunch[];
  recentTrades: BagsTrade[];
}

// ============================================================================
// STATE
// ============================================================================

let state: LiveFeedState = {
  isRunning: false,
  lastLaunchCheck: 0,
  lastTradeCheck: 0,
  lastWhaleCheck: 0,
  launchesFound: 0,
  tradesFound: 0,
  whaleAlertsFound: 0,
  errors: [],
  recentLaunches: [],
  recentTrades: [],
};

let launchPollInterval: NodeJS.Timeout | null = null;
let tradePollInterval: NodeJS.Timeout | null = null;
let whalePollInterval: NodeJS.Timeout | null = null;

// Track seen events to avoid duplicates
const seenLaunches = new Set<string>();
const seenTrades = new Set<string>();
const seenWhales = new Set<string>();

// Price cache for detecting pumps/dumps
const priceCache = new Map<string, { price: number; timestamp: number }>();

// ============================================================================
// BITQUERY CLIENT
// ============================================================================

async function queryBitquery<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T | null> {
  const apiKey = process.env.BITQUERY_API_KEY;

  if (!apiKey) {
    console.warn("[Bags Live Feed] BITQUERY_API_KEY not set - live feed disabled");
    return null;
  }

  try {
    const response = await fetch(BITQUERY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bitquery API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    return data.data as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    addError(`Bitquery query failed: ${message}`);
    return null;
  }
}

// ============================================================================
// GRAPHQL QUERIES
// ============================================================================

const QUERY_RECENT_LAUNCHES = `
query RecentBagsLaunches($since: DateTime!) {
  Solana {
    Instructions(
      where: {
        Instruction: {
          Program: {
            Address: { is: "${METEORA_DBC_PROGRAM}" }
            Method: { is: "initialize_virtual_pool_with_spl_token" }
          }
        }
        Block: { Time: { after: $since } }
      }
      orderBy: { descending: Block_Time }
      limit: { count: 20 }
    ) {
      Transaction {
        Signature
        Signer
      }
      Block {
        Time
      }
      Instruction {
        Accounts {
          Address
          IsWritable
        }
        Program {
          Method
        }
      }
    }
  }
}
`;

const QUERY_RECENT_TRADES = `
query RecentBagsTrades($since: DateTime!) {
  Solana {
    DEXTradeByTokens(
      where: {
        Trade: {
          Currency: {
            UpdateAuthority: { is: "${BAGS_CREATOR_SIGNER}" }
          }
        }
        Block: { Time: { after: $since } }
      }
      orderBy: { descending: Block_Time }
      limit: { count: 50 }
    ) {
      Trade {
        Amount
        AmountInUSD
        Price
        PriceInUSD
        Currency {
          MintAddress
          Symbol
          Name
        }
        Side {
          Type
        }
        Dex {
          ProtocolName
        }
      }
      Transaction {
        Signature
        Signer
      }
      Block {
        Time
      }
    }
  }
}
`;

const QUERY_LARGE_TRANSFERS = `
query LargeBagsTransfers($since: DateTime!, $minAmountUsd: String!) {
  Solana {
    Transfers(
      where: {
        Transfer: {
          Currency: {
            UpdateAuthority: { is: "${BAGS_CREATOR_SIGNER}" }
          }
          AmountInUSD: { ge: $minAmountUsd }
        }
        Block: { Time: { after: $since } }
      }
      orderBy: { descending: Transfer_AmountInUSD }
      limit: { count: 20 }
    ) {
      Transfer {
        Amount
        AmountInUSD
        Currency {
          MintAddress
          Symbol
          Name
        }
        Sender {
          Address
        }
        Receiver {
          Address
        }
      }
      Transaction {
        Signature
      }
      Block {
        Time
      }
    }
  }
}
`;

// ============================================================================
// DATA FETCHING
// ============================================================================

async function fetchRecentLaunches(): Promise<BagsLaunch[]> {
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // Last 10 minutes

  const data = await queryBitquery<{
    Solana: {
      Instructions: Array<{
        Transaction: { Signature: string; Signer: string };
        Block: { Time: string };
        Instruction: {
          Accounts: Array<{ Address: string; IsWritable: boolean }>;
        };
      }>;
    };
  }>(QUERY_RECENT_LAUNCHES, { since });

  if (!data?.Solana?.Instructions) return [];

  const launches: BagsLaunch[] = [];

  for (const instruction of data.Solana.Instructions) {
    const signature = instruction.Transaction.Signature;

    // Skip if already seen
    if (seenLaunches.has(signature)) continue;
    seenLaunches.add(signature);

    // Extract mint from accounts (typically the first writable account)
    const writableAccounts = instruction.Instruction.Accounts.filter((a) => a.IsWritable);
    const mint = writableAccounts[0]?.Address || "";

    if (!mint) continue;

    launches.push({
      mint,
      name: "New Token", // Will be enriched later
      symbol: "???",
      creator: instruction.Transaction.Signer,
      timestamp: new Date(instruction.Block.Time).getTime(),
      signature,
    });
  }

  return launches;
}

async function fetchRecentTrades(): Promise<BagsTrade[]> {
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // Last 5 minutes

  const data = await queryBitquery<{
    Solana: {
      DEXTradeByTokens: Array<{
        Trade: {
          Amount: number;
          AmountInUSD: number;
          Price: number;
          PriceInUSD: number;
          Currency: { MintAddress: string; Symbol: string; Name: string };
          Side: { Type: string };
        };
        Transaction: { Signature: string; Signer: string };
        Block: { Time: string };
      }>;
    };
  }>(QUERY_RECENT_TRADES, { since });

  if (!data?.Solana?.DEXTradeByTokens) return [];

  const trades: BagsTrade[] = [];

  for (const trade of data.Solana.DEXTradeByTokens) {
    const signature = trade.Transaction.Signature;

    // Skip if already seen
    if (seenTrades.has(signature)) continue;
    seenTrades.add(signature);

    const mint = trade.Trade.Currency.MintAddress;
    const priceUsd = trade.Trade.PriceInUSD;

    // Check for price pump/dump
    const cached = priceCache.get(mint);
    if (cached && cached.timestamp > Date.now() - 5 * 60 * 1000) {
      const changePercent = ((priceUsd - cached.price) / cached.price) * 100;

      if (changePercent >= PUMP_THRESHOLD_PERCENT) {
        emitPricePump(trade.Trade.Currency.Symbol, changePercent, priceUsd, mint);
      } else if (changePercent <= DUMP_THRESHOLD_PERCENT) {
        emitPriceDump(trade.Trade.Currency.Symbol, changePercent, priceUsd, mint);
      }
    }

    // Update price cache
    priceCache.set(mint, { price: priceUsd, timestamp: Date.now() });

    trades.push({
      mint,
      symbol: trade.Trade.Currency.Symbol || "???",
      side: trade.Trade.Side.Type.toLowerCase() === "buy" ? "buy" : "sell",
      amountToken: trade.Trade.Amount,
      amountSol: trade.Trade.AmountInUSD / 200, // Approximate SOL value
      priceUsd,
      trader: trade.Transaction.Signer,
      timestamp: new Date(trade.Block.Time).getTime(),
      signature,
    });
  }

  return trades;
}

async function fetchLargeTransfers(): Promise<BagsTransfer[]> {
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // Last 10 minutes
  const minAmountUsd = String(WHALE_THRESHOLD_SOL * 200); // ~$2000 USD threshold (as string)

  const data = await queryBitquery<{
    Solana: {
      Transfers: Array<{
        Transfer: {
          Amount: number;
          AmountInUSD: number;
          Currency: { MintAddress: string; Symbol: string; Name: string };
          Sender: { Address: string };
          Receiver: { Address: string };
        };
        Transaction: { Signature: string };
        Block: { Time: string };
      }>;
    };
  }>(QUERY_LARGE_TRANSFERS, { since, minAmountUsd });

  if (!data?.Solana?.Transfers) return [];

  const transfers: BagsTransfer[] = [];

  for (const transfer of data.Solana.Transfers) {
    const signature = transfer.Transaction.Signature;

    // Skip if already seen
    if (seenWhales.has(signature)) continue;
    seenWhales.add(signature);

    transfers.push({
      mint: transfer.Transfer.Currency.MintAddress,
      symbol: transfer.Transfer.Currency.Symbol || "???",
      amount: transfer.Transfer.Amount,
      amountUsd: transfer.Transfer.AmountInUSD,
      from: transfer.Transfer.Sender.Address,
      to: transfer.Transfer.Receiver.Address,
      timestamp: new Date(transfer.Block.Time).getTime(),
      signature,
    });
  }

  return transfers;
}

// ============================================================================
// POLLING HANDLERS
// ============================================================================

async function pollLaunches(): Promise<void> {
  try {
    state.lastLaunchCheck = Date.now();
    const launches = await fetchRecentLaunches();

    for (const launch of launches) {
      // Enrich with actual token metadata before emitting
      const metadata = await enrichLaunchMetadata(launch.mint);
      if (metadata) {
        launch.name = metadata.name;
        launch.symbol = metadata.symbol;
      }

      state.launchesFound++;
      state.recentLaunches.unshift(launch);

      // Keep only last 50
      if (state.recentLaunches.length > 50) {
        state.recentLaunches = state.recentLaunches.slice(0, 50);
      }

      // Emit to Agent Coordinator
      await emitTokenLaunch({
        mint: launch.mint,
        name: launch.name,
        symbol: launch.symbol,
        creator: launch.creator,
        liquidity: 0,
        supply: 0,
        timestamp: launch.timestamp,
        platform: "bags",
        signature: launch.signature,
      });

      console.log(
        `[Bags Live Feed] New launch: $${launch.symbol} - ${launch.name} (${launch.mint.slice(0, 8)}...)`
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    addError(`Launch poll failed: ${message}`);
  }
}

async function pollTrades(): Promise<void> {
  try {
    state.lastTradeCheck = Date.now();
    const trades = await fetchRecentTrades();
    state.tradesFound += trades.length;

    // Store recent trades
    for (const trade of trades) {
      state.recentTrades.unshift(trade);
    }

    // Keep only last 100
    if (state.recentTrades.length > 100) {
      state.recentTrades = state.recentTrades.slice(0, 100);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    addError(`Trade poll failed: ${message}`);
  }
}

async function pollWhales(): Promise<void> {
  try {
    state.lastWhaleCheck = Date.now();
    const transfers = await fetchLargeTransfers();

    for (const transfer of transfers) {
      state.whaleAlertsFound++;

      // Determine if buy or sell based on receiver
      // If receiver is a DEX/AMM, it's likely a sell
      const action: "buy" | "sell" =
        transfer.to.includes("pump") || transfer.to.includes("raydium") ? "sell" : "buy";

      await emitWhaleAlert(
        action,
        transfer.amountUsd / 200, // Convert to approximate SOL
        transfer.symbol,
        transfer.mint,
        transfer.from
      );

      console.log(
        `[Bags Live Feed] Whale ${action}: ${transfer.symbol} $${transfer.amountUsd.toFixed(0)}`
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    addError(`Whale poll failed: ${message}`);
  }
}

// ============================================================================
// LIFECYCLE
// ============================================================================

export function startLiveFeed(): boolean {
  if (state.isRunning) {
    console.log("[Bags Live Feed] Already running");
    return true;
  }

  if (!process.env.BITQUERY_API_KEY) {
    console.warn("[Bags Live Feed] BITQUERY_API_KEY not set - skipping live feed");
    return false;
  }

  state.isRunning = true;
  console.log("[Bags Live Feed] Starting platform-wide Bags.fm monitoring...");

  // Initial polls
  pollLaunches();
  pollTrades();
  pollWhales();

  // Set up intervals
  launchPollInterval = setInterval(pollLaunches, POLL_INTERVAL_LAUNCHES);
  tradePollInterval = setInterval(pollTrades, POLL_INTERVAL_TRADES);
  whalePollInterval = setInterval(pollWhales, POLL_INTERVAL_WHALES);

  console.log("[Bags Live Feed] Started - monitoring ALL Bags.fm activity");
  return true;
}

export function stopLiveFeed(): void {
  state.isRunning = false;

  if (launchPollInterval) {
    clearInterval(launchPollInterval);
    launchPollInterval = null;
  }
  if (tradePollInterval) {
    clearInterval(tradePollInterval);
    tradePollInterval = null;
  }
  if (whalePollInterval) {
    clearInterval(whalePollInterval);
    whalePollInterval = null;
  }

  console.log("[Bags Live Feed] Stopped");
}

export function getLiveFeedState(): LiveFeedState {
  return { ...state };
}

export function getRecentLaunches(count: number = 10): BagsLaunch[] {
  return state.recentLaunches.slice(0, count);
}

export function getRecentTrades(count: number = 20): BagsTrade[] {
  return state.recentTrades.slice(0, count);
}

// ============================================================================
// HELPERS
// ============================================================================

function addError(error: string): void {
  console.error(`[Bags Live Feed] ${error}`);
  state.errors.push(`${new Date().toISOString()}: ${error}`);
  if (state.errors.length > 20) {
    state.errors = state.errors.slice(-20);
  }
}

// Clean up old entries from seen sets periodically
setInterval(
  () => {
    // Keep sets from growing unbounded
    if (seenLaunches.size > 1000) {
      const arr = Array.from(seenLaunches);
      seenLaunches.clear();
      arr.slice(-500).forEach((s) => seenLaunches.add(s));
    }
    if (seenTrades.size > 5000) {
      const arr = Array.from(seenTrades);
      seenTrades.clear();
      arr.slice(-2500).forEach((s) => seenTrades.add(s));
    }
    if (seenWhales.size > 500) {
      const arr = Array.from(seenWhales);
      seenWhales.clear();
      arr.slice(-250).forEach((s) => seenWhales.add(s));
    }

    // Clean old price cache entries
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    for (const [mint, data] of priceCache.entries()) {
      if (data.timestamp < fiveMinutesAgo) {
        priceCache.delete(mint);
      }
    }
  },
  5 * 60 * 1000
); // Every 5 minutes

// ============================================================================
// MANUAL ENRICHMENT (fetch token metadata for new launches)
// ============================================================================

export async function enrichLaunchMetadata(
  mint: string
): Promise<{ name: string; symbol: string } | null> {
  // Try multiple sources for token metadata

  // 1. Try DexScreener (fast, no auth)
  try {
    const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (dexResponse.ok) {
      const data = await dexResponse.json();
      const pair = data.pairs?.[0];
      if (pair?.baseToken?.symbol && pair.baseToken.symbol !== "Unknown") {
        return {
          name: pair.baseToken.name || "Unknown",
          symbol: pair.baseToken.symbol,
        };
      }
    }
  } catch {
    // Continue to next source
  }

  // 2. Try Solana token metadata via Helius DAS API (if configured)
  const rpcUrl = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (rpcUrl && rpcUrl.includes("helius")) {
    try {
      const heliusResponse = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "bags-live-feed",
          method: "getAsset",
          params: { id: mint },
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (heliusResponse.ok) {
        const data = await heliusResponse.json();
        const content = data.result?.content;
        if (content?.metadata?.symbol) {
          return {
            name: content.metadata.name || "Unknown",
            symbol: content.metadata.symbol,
          };
        }
      }
    } catch {
      // Continue to next source
    }
  }

  // 3. Try Jupiter token list API
  try {
    const jupResponse = await fetch(`https://token.jup.ag/strict`, {
      signal: AbortSignal.timeout(5000),
    });
    if (jupResponse.ok) {
      const tokens = await jupResponse.json();
      const token = tokens.find((t: { address: string }) => t.address === mint);
      if (token) {
        return {
          name: token.name || "Unknown",
          symbol: token.symbol || "???",
        };
      }
    }
  } catch {
    // Ignore
  }

  // 4. Fallback: Extract from mint address (first 4 chars as placeholder)
  return {
    name: "New Token",
    symbol: mint.slice(0, 4).toUpperCase(),
  };
}
