import { NextRequest, NextResponse } from "next/server";
import { getAllWorldTokensAsync, type LaunchedToken } from "@/lib/token-registry";
import { initBagsApi } from "@/lib/bags-api";

interface TokenWithMetrics {
  mint: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  price: number;
  marketCap: number;
  volume24h: number;
  change24h: number;
  lifetimeFees: number;
  createdAt?: number;
  poolAddress?: string;
}

interface TokenDetailedInfo {
  mint: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  price: number;
  marketCap: number;
  fdv: number;
  volume24h: number;
  volume6h: number;
  volume1h: number;
  liquidity: number;
  change5m: number;
  change1h: number;
  change6h: number;
  change24h: number;
  holders?: number;
  txns24h: { buys: number; sells: number };
  pairAddress?: string;
  dexId?: string;
  priceNative?: string;
  supply?: number;
}

interface RecentTrade {
  signature: string;
  type: "buy" | "sell";
  amount: number;
  priceUsd: number;
  totalUsd: number;
  maker: string;
  timestamp: number;
}

interface TokenHolder {
  address: string;
  balance: number;
  percentage: number;
  rank: number;
}

interface OHLCVCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ClaimEvent {
  signature: string;
  claimer: string;
  claimerUsername?: string;
  amount: number;
  timestamp: number;
  tokenMint: string;
  tokenSymbol?: string;
}

interface TraderStats {
  wallet: string;
  username?: string;
  totalVolume: number;
  tradeCount: number;
}

// Cache for expensive operations
let tokensCache: { data: TokenWithMetrics[]; timestamp: number } | null = null;
let historyCache: { data: ClaimEvent[]; timestamp: number } | null = null;
let leaderboardCache: { data: TraderStats[]; timestamp: number } | null = null;
const poolCache = new Map<string, { pool: string | null; timestamp: number }>();
const ohlcvCache = new Map<string, { candles: OHLCVCandle[]; timestamp: number }>();
const dexScreenerCache = new Map<
  string,
  {
    data: { priceUsd: number; marketCap: number; volume24h: number; priceChange24h: number } | null;
    timestamp: number;
  }
>();
const tokenDetailCache = new Map<string, { data: TokenDetailedInfo | null; timestamp: number }>();
const tradesCache = new Map<string, { data: RecentTrade[]; timestamp: number }>();
const holdersCache = new Map<string, { data: TokenHolder[]; timestamp: number }>();

const TOKENS_CACHE_TTL = 30000; // 30 seconds
const HISTORY_CACHE_TTL = 15000; // 15 seconds
const LEADERBOARD_CACHE_TTL = 60000; // 60 seconds
const POOL_CACHE_TTL = 300000; // 5 minutes (pools don't change)
const OHLCV_CACHE_TTL = 15000; // 15 seconds for faster chart updates
const DEX_CACHE_TTL = 20000; // 20 seconds for price data
const TOKEN_DETAIL_CACHE_TTL = 10000; // 10 seconds for detailed info
const TRADES_CACHE_TTL = 5000; // 5 seconds for recent trades
const HOLDERS_CACHE_TTL = 60000; // 60 seconds for holders

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const sortBy = searchParams.get("sortBy") || "volume";
  const wallet = searchParams.get("wallet");
  const mint = searchParams.get("mint");
  const interval = searchParams.get("interval") || "1h";
  const query = searchParams.get("query");

  switch (action) {
    case "tokens":
      return handleTokens(sortBy);
    case "search":
      return handleSearch(query || "");
    case "tokenInfo":
      if (!mint) {
        return NextResponse.json({ error: "mint parameter required" }, { status: 400 });
      }
      return handleTokenInfo(mint);
    case "trades":
      if (!mint) {
        return NextResponse.json({ error: "mint parameter required" }, { status: 400 });
      }
      return handleTokenTrades(mint);
    case "holders":
      if (!mint) {
        return NextResponse.json({ error: "mint parameter required" }, { status: 400 });
      }
      return handleTokenHolders(mint);
    case "ohlcv":
      if (!mint) {
        return NextResponse.json({ error: "mint parameter required" }, { status: 400 });
      }
      return handleOHLCV(mint, interval);
    case "pool":
      if (!mint) {
        return NextResponse.json({ error: "mint parameter required" }, { status: 400 });
      }
      return handlePoolDiscovery(mint);
    case "history":
      return handleHistory();
    case "leaderboard":
      return handleLeaderboard();
    case "fees":
      if (!mint) {
        return NextResponse.json({ error: "mint parameter required" }, { status: 400 });
      }
      return handleFees(mint);
    case "portfolio":
      if (!wallet) {
        return NextResponse.json({ error: "wallet parameter required" }, { status: 400 });
      }
      return handlePortfolio(wallet);
    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
}

async function handleTokens(sortBy: string): Promise<NextResponse> {
  // Check cache first
  if (tokensCache && Date.now() - tokensCache.timestamp < TOKENS_CACHE_TTL) {
    const sorted = sortTokens(tokensCache.data, sortBy);
    return NextResponse.json({ tokens: sorted, total: sorted.length, cached: true });
  }

  // Get registered tokens from registry
  const registeredTokens = await getAllWorldTokensAsync();

  if (registeredTokens.length === 0) {
    return NextResponse.json({ tokens: [], total: 0 });
  }

  // Enrich tokens with data from DexScreener (parallel for speed)
  const enrichedTokens = await Promise.all(
    registeredTokens.map(async (token): Promise<TokenWithMetrics> => {
      const dexData = await fetchDexScreenerData(token.mint);

      return {
        mint: token.mint,
        name: token.name,
        symbol: token.symbol,
        imageUrl: token.imageUrl,
        price: dexData?.priceUsd || 0,
        marketCap: dexData?.marketCap || 0,
        volume24h: dexData?.volume24h || 0,
        change24h: dexData?.priceChange24h || 0,
        lifetimeFees: token.lifetimeFees || 0,
        createdAt: token.createdAt,
      };
    })
  );

  // Update cache
  tokensCache = { data: enrichedTokens, timestamp: Date.now() };

  const sorted = sortTokens(enrichedTokens, sortBy);
  return NextResponse.json({ tokens: sorted, total: sorted.length });
}

async function handleSearch(query: string): Promise<NextResponse> {
  if (!query || query.length < 2) {
    return NextResponse.json({ tokens: [] });
  }

  // Search GeckoTerminal for any Solana token
  const geckoResponse = await fetch(
    `https://api.geckoterminal.com/api/v2/search/pools?query=${encodeURIComponent(query)}&network=solana&page=1`,
    {
      headers: { Accept: "application/json" },
    }
  );

  if (!geckoResponse.ok) {
    return NextResponse.json({ tokens: [], error: "Search failed" });
  }

  const geckoData = await geckoResponse.json();
  const pools = geckoData.data || [];

  // Transform to our token format
  const tokens: TokenWithMetrics[] = pools.slice(0, 20).map((pool: any) => {
    const attrs = pool.attributes || {};
    const baseToken = attrs.base_token_price_usd
      ? {
          name: attrs.name?.split(" / ")[0] || "Unknown",
          symbol: attrs.name?.split(" / ")[0]?.replace(/\s+/g, "") || "???",
        }
      : { name: "Unknown", symbol: "???" };

    return {
      mint: attrs.address || pool.id,
      name: baseToken.name,
      symbol: baseToken.symbol,
      price: parseFloat(attrs.base_token_price_usd) || 0,
      marketCap: parseFloat(attrs.market_cap_usd) || parseFloat(attrs.fdv_usd) || 0,
      volume24h: parseFloat(attrs.volume_usd?.h24) || 0,
      change24h: parseFloat(attrs.price_change_percentage?.h24) || 0,
      lifetimeFees: 0,
      poolAddress: attrs.address,
    };
  });

  return NextResponse.json({ tokens });
}

async function handleTokenInfo(mint: string): Promise<NextResponse> {
  // Check cache
  const cached = tokenDetailCache.get(mint);
  if (cached && Date.now() - cached.timestamp < TOKEN_DETAIL_CACHE_TTL) {
    return NextResponse.json({ token: cached.data, cached: true });
  }

  // Fetch comprehensive data from DexScreener
  const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    tokenDetailCache.set(mint, { data: null, timestamp: Date.now() });
    return NextResponse.json({ token: null, error: "Failed to fetch token info" });
  }

  const data = await response.json();
  const pair = data.pairs?.[0];

  const dexPrice = pair ? parseFloat(pair.priceUsd) || 0 : 0;
  const dexMcap = pair?.marketCap || 0;
  const dexHasData = pair && (dexPrice > 0 || dexMcap > 0);

  // If DexScreener has no pair or returned all zeros, try GeckoTerminal
  if (!dexHasData) {
    const geckoInfo = await fetchGeckoTerminalTokenInfo(mint);
    if (geckoInfo) {
      tokenDetailCache.set(mint, { data: geckoInfo, timestamp: Date.now() });
      return NextResponse.json({ token: geckoInfo, dataSource: "geckoterminal" });
    }

    if (!pair) {
      tokenDetailCache.set(mint, { data: null, timestamp: Date.now() });
      return NextResponse.json({ token: null, error: "Token not found" });
    }
  }

  const tokenInfo: TokenDetailedInfo = {
    mint,
    name: pair.baseToken?.name || "Unknown",
    symbol: pair.baseToken?.symbol || "???",
    imageUrl: pair.info?.imageUrl,
    price: parseFloat(pair.priceUsd) || 0,
    marketCap: pair.marketCap || 0,
    fdv: pair.fdv || pair.marketCap || 0,
    volume24h: pair.volume?.h24 || 0,
    volume6h: pair.volume?.h6 || 0,
    volume1h: pair.volume?.h1 || 0,
    liquidity: pair.liquidity?.usd || 0,
    change5m: pair.priceChange?.m5 || 0,
    change1h: pair.priceChange?.h1 || 0,
    change6h: pair.priceChange?.h6 || 0,
    change24h: pair.priceChange?.h24 || 0,
    txns24h: {
      buys: pair.txns?.h24?.buys || 0,
      sells: pair.txns?.h24?.sells || 0,
    },
    pairAddress: pair.pairAddress,
    dexId: pair.dexId,
    priceNative: pair.priceNative,
  };

  tokenDetailCache.set(mint, { data: tokenInfo, timestamp: Date.now() });
  return NextResponse.json({ token: tokenInfo, dataSource: "dexscreener" });
}

async function handleTokenTrades(mint: string): Promise<NextResponse> {
  // Check cache
  const cached = tradesCache.get(mint);
  if (cached && Date.now() - cached.timestamp < TRADES_CACHE_TTL) {
    return NextResponse.json({ trades: cached.data, cached: true });
  }

  // Get pair address first
  const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
    headers: { Accept: "application/json" },
  });

  if (!dexResponse.ok) {
    return NextResponse.json({ trades: [], error: "Failed to fetch pair info" });
  }

  const dexData = await dexResponse.json();
  const pair = dexData.pairs?.[0];

  if (!pair?.pairAddress) {
    return NextResponse.json({ trades: [], error: "No pair found" });
  }

  // Fetch recent trades from Birdeye or use GeckoTerminal trades
  // Using GeckoTerminal trades endpoint
  const tradesResponse = await fetch(
    `https://api.geckoterminal.com/api/v2/networks/solana/pools/${pair.pairAddress}/trades?trade_volume_in_usd_greater_than=0`,
    { headers: { Accept: "application/json" } }
  );

  const trades: RecentTrade[] = [];

  if (tradesResponse.ok) {
    const tradesData = await tradesResponse.json();
    const rawTrades = tradesData.data || [];

    for (const trade of rawTrades.slice(0, 50)) {
      const attrs = trade.attributes || {};
      trades.push({
        signature: trade.id || "",
        type: attrs.kind === "buy" ? "buy" : "sell",
        amount: parseFloat(attrs.volume_in_usd) || 0,
        priceUsd: parseFloat(attrs.price_to_in_usd) || 0,
        totalUsd: parseFloat(attrs.volume_in_usd) || 0,
        maker: attrs.tx_from_address || "",
        timestamp: new Date(attrs.block_timestamp || Date.now()).getTime(),
      });
    }
  }

  tradesCache.set(mint, { data: trades, timestamp: Date.now() });
  return NextResponse.json({ trades });
}

async function handleTokenHolders(mint: string): Promise<NextResponse> {
  // Check cache
  const cached = holdersCache.get(mint);
  if (cached && Date.now() - cached.timestamp < HOLDERS_CACHE_TTL) {
    return NextResponse.json({ holders: cached.data, cached: true });
  }

  // Try to fetch holders from Helius or Solscan
  // Note: This requires an API key for most services
  // For now, we'll return a placeholder with top holder info if available

  // Try using SolanaFM API (free tier)
  const response = await fetch(
    `https://api.solana.fm/v1/tokens/${mint}/holders?page=1&pageSize=20`,
    { headers: { Accept: "application/json" } }
  );

  const holders: TokenHolder[] = [];

  if (response.ok) {
    const data = await response.json();
    const holderList = data.result || data.data || [];

    let rank = 1;
    for (const holder of holderList) {
      holders.push({
        address: holder.owner || holder.address || "",
        balance: parseFloat(holder.amount) || parseFloat(holder.balance) || 0,
        percentage: parseFloat(holder.percentage) || 0,
        rank: rank++,
      });
    }
  }

  // If no holders found, try to get holder count from DexScreener pair info
  if (holders.length === 0) {
    const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
    if (dexResponse.ok) {
      const dexData = await dexResponse.json();
      // DexScreener doesn't provide holder list, just return empty with message
    }
  }

  holdersCache.set(mint, { data: holders, timestamp: Date.now() });
  return NextResponse.json({ holders, holderCount: holders.length });
}

async function handlePoolDiscovery(mint: string): Promise<NextResponse> {
  // Check cache first
  const cached = poolCache.get(mint);
  if (cached && Date.now() - cached.timestamp < POOL_CACHE_TTL) {
    return NextResponse.json({ pool: cached.pool, cached: true });
  }

  // Search for pool on GeckoTerminal
  const response = await fetch(
    `https://api.geckoterminal.com/api/v2/search/pools?query=${mint}&network=solana&page=1`,
    {
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    poolCache.set(mint, { pool: null, timestamp: Date.now() });
    return NextResponse.json({ pool: null, error: "Pool search failed" });
  }

  const data = await response.json();
  const pools = data.data || [];

  // Find the best pool (highest liquidity/volume)
  let bestPool: string | null = null;
  let bestVolume = 0;

  for (const pool of pools) {
    const attrs = pool.attributes || {};
    const volume = parseFloat(attrs.volume_usd?.h24) || 0;
    if (volume > bestVolume) {
      bestVolume = volume;
      bestPool = attrs.address || pool.id?.split("_")[1];
    }
  }

  poolCache.set(mint, { pool: bestPool, timestamp: Date.now() });
  return NextResponse.json({ pool: bestPool });
}

async function handleOHLCV(mint: string, interval: string): Promise<NextResponse> {
  const cacheKey = `${mint}_${interval}`;

  // Check cache first
  const cached = ohlcvCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < OHLCV_CACHE_TTL) {
    return NextResponse.json({ candles: cached.candles, interval, cached: true });
  }

  // First, get the pool address
  let poolAddress: string | null = null;

  const poolCached = poolCache.get(mint);
  if (poolCached && Date.now() - poolCached.timestamp < POOL_CACHE_TTL) {
    poolAddress = poolCached.pool;
  } else {
    // Discover pool
    const poolResponse = await fetch(
      `https://api.geckoterminal.com/api/v2/search/pools?query=${mint}&network=solana&page=1`,
      {
        headers: { Accept: "application/json" },
      }
    );

    if (poolResponse.ok) {
      const poolData = await poolResponse.json();
      const pools = poolData.data || [];

      let bestVolume = 0;
      for (const pool of pools) {
        const attrs = pool.attributes || {};
        const volume = parseFloat(attrs.volume_usd?.h24) || 0;
        if (volume > bestVolume) {
          bestVolume = volume;
          poolAddress = attrs.address || pool.id?.split("_")[1];
        }
      }

      poolCache.set(mint, { pool: poolAddress, timestamp: Date.now() });
    }
  }

  if (!poolAddress) {
    return NextResponse.json({ candles: [], error: "No pool found for token" });
  }

  // Map interval to GeckoTerminal format
  const timeframeMap: Record<string, { timeframe: string; aggregate: number }> = {
    "1s": { timeframe: "minute", aggregate: 1 }, // 1s maps to 1m (smallest available)
    "1m": { timeframe: "minute", aggregate: 1 },
    "5m": { timeframe: "minute", aggregate: 5 },
    "15m": { timeframe: "minute", aggregate: 15 },
    "1h": { timeframe: "hour", aggregate: 1 },
    "4h": { timeframe: "hour", aggregate: 4 },
    "1d": { timeframe: "day", aggregate: 1 },
  };

  const tf = timeframeMap[interval] || timeframeMap["1m"];

  // Fetch OHLCV from GeckoTerminal
  const ohlcvResponse = await fetch(
    `https://api.geckoterminal.com/api/v2/networks/solana/pools/${poolAddress}/ohlcv/${tf.timeframe}?aggregate=${tf.aggregate}&limit=200`,
    {
      headers: { Accept: "application/json" },
    }
  );

  if (!ohlcvResponse.ok) {
    return NextResponse.json({ candles: [], error: "Failed to fetch OHLCV data" });
  }

  const ohlcvData = await ohlcvResponse.json();
  const ohlcvList = ohlcvData.data?.attributes?.ohlcv_list || [];

  // Transform to our candle format
  // GeckoTerminal format: [timestamp, open, high, low, close, volume]
  const candles: OHLCVCandle[] = ohlcvList
    .map((candle: number[]) => ({
      time: candle[0],
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
      volume: candle[5],
    }))
    .sort((a: OHLCVCandle, b: OHLCVCandle) => a.time - b.time);

  // Update cache
  ohlcvCache.set(cacheKey, { candles, timestamp: Date.now() });

  return NextResponse.json({ candles, interval, pool: poolAddress });
}

async function handleHistory(): Promise<NextResponse> {
  // Check cache
  if (historyCache && Date.now() - historyCache.timestamp < HISTORY_CACHE_TTL) {
    return NextResponse.json({
      trades: historyCache.data,
      total: historyCache.data.length,
      cached: true,
    });
  }

  // For now, return empty - this would integrate with Bags.fm claim events
  // In production, this would fetch from the Bags API
  const trades: ClaimEvent[] = [];

  historyCache = { data: trades, timestamp: Date.now() };
  return NextResponse.json({ trades, total: trades.length });
}

async function handleLeaderboard(): Promise<NextResponse> {
  // Check cache
  if (leaderboardCache && Date.now() - leaderboardCache.timestamp < LEADERBOARD_CACHE_TTL) {
    return NextResponse.json({
      traders: leaderboardCache.data.map((t, i) => ({ ...t, rank: i + 1 })),
      cached: true,
    });
  }

  // For now, return empty - this would integrate with Bags.fm leaderboard data
  const traders: TraderStats[] = [];

  leaderboardCache = { data: traders, timestamp: Date.now() };
  return NextResponse.json({
    traders: traders.map((t, i) => ({ ...t, rank: i + 1 })),
  });
}

async function handlePortfolio(walletAddress: string): Promise<NextResponse> {
  // This would fetch token balances from Solana RPC
  // For now, return empty structure
  return NextResponse.json({ holdings: [], totalValue: 0 });
}

function sortTokens(tokens: TokenWithMetrics[], sortBy: string): TokenWithMetrics[] {
  const sorted = [...tokens];

  switch (sortBy) {
    case "volume":
      return sorted.sort((a, b) => b.volume24h - a.volume24h);
    case "mcap":
      return sorted.sort((a, b) => b.marketCap - a.marketCap);
    case "change":
      return sorted.sort((a, b) => b.change24h - a.change24h);
    case "newest":
      return sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    default:
      return sorted.sort((a, b) => b.volume24h - a.volume24h);
  }
}

// GeckoTerminal token info fetcher (used as fallback when DexScreener returns no data)
async function fetchGeckoTerminalTokenInfo(mint: string): Promise<TokenDetailedInfo | null> {
  try {
    const response = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${mint}`,
      { headers: { Accept: "application/json" } }
    );
    if (!response.ok) return null;

    const json = await response.json();
    const attrs = json.data?.attributes;
    if (!attrs) return null;

    const price = parseFloat(attrs.price_usd) || 0;
    const marketCap = parseFloat(attrs.market_cap_usd) || 0;
    if (price === 0 && marketCap === 0) return null;

    return {
      mint,
      name: attrs.name || "Unknown",
      symbol: attrs.symbol || "???",
      imageUrl: attrs.image_url,
      price,
      marketCap,
      fdv: parseFloat(attrs.fdv_usd) || marketCap,
      volume24h: parseFloat(attrs.volume_usd?.h24) || 0,
      volume6h: parseFloat(attrs.volume_usd?.h6) || 0,
      volume1h: parseFloat(attrs.volume_usd?.h1) || 0,
      liquidity: 0,
      change5m: parseFloat(attrs.price_change_percentage?.m5) || 0,
      change1h: parseFloat(attrs.price_change_percentage?.h1) || 0,
      change6h: parseFloat(attrs.price_change_percentage?.h6) || 0,
      change24h: parseFloat(attrs.price_change_percentage?.h24) || 0,
      txns24h: { buys: 0, sells: 0 },
    };
  } catch {
    return null;
  }
}

// DexScreener data fetcher with caching + GeckoTerminal fallback
async function fetchDexScreenerData(mint: string): Promise<{
  priceUsd: number;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
} | null> {
  const cached = dexScreenerCache.get(mint);
  if (cached && Date.now() - cached.timestamp < DEX_CACHE_TTL) {
    return cached.data;
  }

  const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    // DexScreener failed — try GeckoTerminal pool search as fallback
    const geckoResult = await fetchGeckoTerminalPoolData(mint);
    if (geckoResult) {
      dexScreenerCache.set(mint, { data: geckoResult, timestamp: Date.now() });
      return geckoResult;
    }
    dexScreenerCache.set(mint, { data: null, timestamp: Date.now() });
    return null;
  }

  const data = await response.json();
  const pair = data.pairs?.[0];

  if (!pair) {
    // No pair on DexScreener — try GeckoTerminal pool search as fallback
    const geckoResult = await fetchGeckoTerminalPoolData(mint);
    if (geckoResult) {
      dexScreenerCache.set(mint, { data: geckoResult, timestamp: Date.now() });
      return geckoResult;
    }
    dexScreenerCache.set(mint, { data: null, timestamp: Date.now() });
    return null;
  }

  const result = {
    priceUsd: parseFloat(pair.priceUsd) || 0,
    marketCap: pair.marketCap || 0,
    volume24h: pair.volume?.h24 || 0,
    priceChange24h: pair.priceChange?.h24 || 0,
  };

  // If DexScreener returned all zeros, try GeckoTerminal
  if (result.priceUsd === 0 && result.marketCap === 0) {
    const geckoResult = await fetchGeckoTerminalPoolData(mint);
    if (geckoResult) {
      dexScreenerCache.set(mint, { data: geckoResult, timestamp: Date.now() });
      return geckoResult;
    }
  }

  dexScreenerCache.set(mint, { data: result, timestamp: Date.now() });
  return result;
}

// GeckoTerminal pool search fallback for basic price/mcap data
async function fetchGeckoTerminalPoolData(mint: string): Promise<{
  priceUsd: number;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
} | null> {
  try {
    const response = await fetch(
      `https://api.geckoterminal.com/api/v2/search/pools?query=${mint}&network=solana&page=1`,
      { headers: { Accept: "application/json" } }
    );
    if (!response.ok) return null;

    const data = await response.json();
    const pool = data.data?.[0];
    if (!pool) return null;

    const attrs = pool.attributes || {};
    const price = parseFloat(attrs.base_token_price_usd) || 0;
    const marketCap = parseFloat(attrs.market_cap_usd) || parseFloat(attrs.fdv_usd) || 0;
    if (price === 0 && marketCap === 0) return null;

    return {
      priceUsd: price,
      marketCap,
      volume24h: parseFloat(attrs.volume_usd?.h24) || 0,
      priceChange24h: parseFloat(attrs.price_change_percentage?.h24) || 0,
    };
  } catch {
    return null;
  }
}

// Fees cache (30s per mint)
const feesCache = new Map<string, { fees: number | null; timestamp: number }>();
const FEES_CACHE_TTL = 30000;

async function handleFees(mint: string): Promise<NextResponse> {
  const cached = feesCache.get(mint);
  if (cached && Date.now() - cached.timestamp < FEES_CACHE_TTL) {
    return NextResponse.json({
      fees: cached.fees !== null ? { lifetimeFeesSol: cached.fees } : null,
      cached: true,
    });
  }

  const apiKey = process.env.BAGS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ fees: null });
  }

  try {
    const api = initBagsApi(apiKey);
    const feesLamports = await api.getTokenLifetimeFees(mint);
    const lifetimeFeesSol = feesLamports / 1_000_000_000;
    feesCache.set(mint, { fees: lifetimeFeesSol, timestamp: Date.now() });
    return NextResponse.json({ fees: { lifetimeFeesSol } });
  } catch {
    feesCache.set(mint, { fees: null, timestamp: Date.now() });
    return NextResponse.json({ fees: null });
  }
}
