import { NextRequest, NextResponse } from "next/server";
import { getAllWorldTokensAsync, type LaunchedToken } from "@/lib/token-registry";

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

const TOKENS_CACHE_TTL = 30000; // 30 seconds
const HISTORY_CACHE_TTL = 15000; // 15 seconds
const LEADERBOARD_CACHE_TTL = 60000; // 60 seconds
const POOL_CACHE_TTL = 300000; // 5 minutes (pools don't change)
const OHLCV_CACHE_TTL = 60000; // 1 minute for candle data
const DEX_CACHE_TTL = 20000; // 20 seconds for price data

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
    "1m": { timeframe: "minute", aggregate: 1 },
    "5m": { timeframe: "minute", aggregate: 5 },
    "15m": { timeframe: "minute", aggregate: 15 },
    "1h": { timeframe: "hour", aggregate: 1 },
    "4h": { timeframe: "hour", aggregate: 4 },
    "1d": { timeframe: "day", aggregate: 1 },
  };

  const tf = timeframeMap[interval] || timeframeMap["1h"];

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

// DexScreener data fetcher with caching
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
    dexScreenerCache.set(mint, { data: null, timestamp: Date.now() });
    return null;
  }

  const data = await response.json();
  const pair = data.pairs?.[0];

  if (!pair) {
    dexScreenerCache.set(mint, { data: null, timestamp: Date.now() });
    return null;
  }

  const result = {
    priceUsd: parseFloat(pair.priceUsd) || 0,
    marketCap: pair.marketCap || 0,
    volume24h: pair.volume?.h24 || 0,
    priceChange24h: pair.priceChange?.h24 || 0,
  };

  dexScreenerCache.set(mint, { data: result, timestamp: Date.now() });
  return result;
}
