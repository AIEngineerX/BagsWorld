import { NextResponse } from "next/server";
import type { SniperToken, SniperFilters, SniperSortField, SniperSortDirection } from "@/lib/types";
import { BAGS_UPDATE_AUTHORITY } from "@/lib/types";

const BITQUERY_API_URL = "https://streaming.bitquery.io/eap";
const BITQUERY_GRAPHQL_URL = "https://streaming.bitquery.io/graphql";

interface BitqueryTokenData {
  Trade: {
    Currency: {
      MintAddress: string;
      Name: string;
      Symbol: string;
      UpdateAuthority: string;
      Decimals: number;
    };
    Price: number;
    PriceInUSD: number;
  };
  Block: {
    Time: string;
  };
  volume: string;
  buy_volume: string;
  sell_volume: string;
  trades: string;
  buys: string;
  sells: string;
}

interface BitqueryResponse {
  data?: {
    Solana?: {
      DEXTradeByTokens?: BitqueryTokenData[];
    };
  };
  errors?: Array<{ message: string }>;
}

interface RequestBody {
  sortField?: SniperSortField;
  sortDirection?: SniperSortDirection;
  filters?: SniperFilters;
  limit?: number;
  offset?: number;
}

// Cache tokens for 30 seconds to avoid rate limiting
let tokenCache: { tokens: SniperToken[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 30000;

async function fetchBagsTokensFromBitquery(): Promise<SniperToken[]> {
  const apiKey = process.env.BITQUERY_API_KEY;

  if (!apiKey) {
    console.error("BITQUERY_API_KEY not configured");
    return [];
  }

  // GraphQL query to get all Bags.fm tokens by UpdateAuthority
  // This aggregates trade data to get volume, price, and transaction counts
  const query = `
    query GetBagsFmTokens {
      Solana {
        DEXTradeByTokens(
          where: {
            Trade: {
              Currency: {
                UpdateAuthority: { is: "${BAGS_UPDATE_AUTHORITY}" }
              }
            }
            Block: {
              Time: { after: "${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}" }
            }
          }
          orderBy: { descendingByField: "volume" }
          limit: { count: 200 }
        ) {
          Trade {
            Currency {
              MintAddress
              Name
              Symbol
              UpdateAuthority
              Decimals
            }
            Price(maximum: Block_Time)
            PriceInUSD(maximum: Block_Time)
          }
          Block {
            Time(maximum: true)
          }
          volume: sum(of: Trade_Side_AmountInUSD)
          buy_volume: sum(of: Trade_Side_AmountInUSD, selectWhere: { Trade: { Side: { Type: { is: buy } } } })
          sell_volume: sum(of: Trade_Side_AmountInUSD, selectWhere: { Trade: { Side: { Type: { is: sell } } } })
          trades: count
          buys: count(selectWhere: { Trade: { Side: { Type: { is: buy } } } })
          sells: count(selectWhere: { Trade: { Side: { Type: { is: sell } } } })
        }
      }
    }
  `;

  const response = await fetch(BITQUERY_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Bitquery API error:", response.status, errorText);
    throw new Error(`Bitquery API error: ${response.status}`);
  }

  const result: BitqueryResponse = await response.json();

  if (result.errors && result.errors.length > 0) {
    console.error("Bitquery GraphQL errors:", result.errors);
    throw new Error(result.errors[0].message);
  }

  const trades = result.data?.Solana?.DEXTradeByTokens || [];
  const now = Date.now();

  // Deduplicate by mint address and transform to SniperToken format
  const tokenMap = new Map<string, SniperToken>();

  for (const trade of trades) {
    const mint = trade.Trade.Currency.MintAddress;

    // Skip if already processed (we keep the first one which has highest volume)
    if (tokenMap.has(mint)) continue;

    const volume24h = parseFloat(trade.volume) || 0;
    const buyVolume = parseFloat(trade.buy_volume) || 0;
    const sellVolume = parseFloat(trade.sell_volume) || 0;
    const trades24h = parseInt(trade.trades) || 0;
    const buys24h = parseInt(trade.buys) || 0;
    const sells24h = parseInt(trade.sells) || 0;

    // Estimate market cap from price and typical supply (1B tokens is common for memecoins)
    // This is an approximation - real market cap would need token supply data
    const price = trade.Trade.Price || 0;
    const priceUsd = trade.Trade.PriceInUSD || 0;
    const estimatedMarketCap = priceUsd * 1_000_000_000; // Assumes 1B supply

    // Calculate price change based on buy/sell ratio (approximation)
    const totalVolume = buyVolume + sellVolume;
    const buyPressure = totalVolume > 0 ? (buyVolume / totalVolume - 0.5) * 100 : 0;
    const change24h = buyPressure * 2; // Scale to reasonable percentage

    // Parse creation time from block time
    const blockTime = new Date(trade.Block.Time).getTime();
    const ageSeconds = Math.floor((now - blockTime) / 1000);
    const isNewLaunch = ageSeconds < 3600; // Less than 1 hour old

    const token: SniperToken = {
      mint,
      name: trade.Trade.Currency.Name || "Unknown",
      symbol: trade.Trade.Currency.Symbol || "???",
      imageUrl: `https://img.bags.fm/cdn-cgi/image/width=64,quality=75/${mint}`,
      price,
      priceUsd,
      marketCap: estimatedMarketCap,
      volume24h,
      change24h,
      createdAt: blockTime,
      ageSeconds,
      liquidity: volume24h * 0.1, // Rough estimate
      txCount24h: trades24h,
      buyCount24h: buys24h,
      sellCount24h: sells24h,
      holders: 0, // Would need separate query
      isNewLaunch,
    };

    tokenMap.set(mint, token);
  }

  return Array.from(tokenMap.values());
}

async function getTokensWithCache(): Promise<SniperToken[]> {
  const now = Date.now();

  // Return cached data if fresh
  if (tokenCache && now - tokenCache.timestamp < CACHE_TTL_MS) {
    return tokenCache.tokens;
  }

  // Fetch fresh data
  const tokens = await fetchBagsTokensFromBitquery();

  // Update cache
  tokenCache = {
    tokens,
    timestamp: now,
  };

  return tokens;
}

function applyFilters(tokens: SniperToken[], filters: SniperFilters): SniperToken[] {
  return tokens.filter((token) => {
    if (filters.minMarketCap !== undefined && token.marketCap < filters.minMarketCap) {
      return false;
    }
    if (filters.maxMarketCap !== undefined && token.marketCap > filters.maxMarketCap) {
      return false;
    }
    if (filters.minVolume !== undefined && token.volume24h < filters.minVolume) {
      return false;
    }
    if (filters.maxAge !== undefined && token.ageSeconds > filters.maxAge) {
      return false;
    }
    return true;
  });
}

function sortTokens(
  tokens: SniperToken[],
  sortField: SniperSortField,
  sortDirection: SniperSortDirection
): SniperToken[] {
  const sorted = [...tokens].sort((a, b) => {
    let aVal: number;
    let bVal: number;

    switch (sortField) {
      case "marketCap":
        aVal = a.marketCap;
        bVal = b.marketCap;
        break;
      case "volume24h":
        aVal = a.volume24h;
        bVal = b.volume24h;
        break;
      case "change24h":
        aVal = a.change24h;
        bVal = b.change24h;
        break;
      case "createdAt":
        aVal = a.createdAt;
        bVal = b.createdAt;
        break;
      case "price":
        aVal = a.priceUsd;
        bVal = b.priceUsd;
        break;
      case "liquidity":
        aVal = a.liquidity;
        bVal = b.liquidity;
        break;
      default:
        aVal = a.volume24h;
        bVal = b.volume24h;
    }

    return sortDirection === "desc" ? bVal - aVal : aVal - bVal;
  });

  return sorted;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sortField = (searchParams.get("sortField") || "volume24h") as SniperSortField;
  const sortDirection = (searchParams.get("sortDirection") || "desc") as SniperSortDirection;
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  const filters: SniperFilters = {};
  const minMarketCap = searchParams.get("minMarketCap");
  const maxMarketCap = searchParams.get("maxMarketCap");
  const minVolume = searchParams.get("minVolume");
  const maxAge = searchParams.get("maxAge");

  if (minMarketCap) filters.minMarketCap = parseFloat(minMarketCap);
  if (maxMarketCap) filters.maxMarketCap = parseFloat(maxMarketCap);
  if (minVolume) filters.minVolume = parseFloat(minVolume);
  if (maxAge) filters.maxAge = parseInt(maxAge);

  const tokens = await getTokensWithCache();
  const filtered = applyFilters(tokens, filters);
  const sorted = sortTokens(filtered, sortField, sortDirection);
  const paginated = sorted.slice(offset, offset + limit);

  return NextResponse.json({
    success: true,
    tokens: paginated,
    total: filtered.length,
    limit,
    offset,
    cacheAge: tokenCache ? Date.now() - tokenCache.timestamp : 0,
  });
}

export async function POST(request: Request) {
  const body: RequestBody = await request.json();
  const {
    sortField = "volume24h",
    sortDirection = "desc",
    filters = {},
    limit = 50,
    offset = 0,
  } = body;

  const tokens = await getTokensWithCache();
  const filtered = applyFilters(tokens, filters);
  const sorted = sortTokens(filtered, sortField, sortDirection);
  const paginated = sorted.slice(offset, offset + limit);

  return NextResponse.json({
    success: true,
    tokens: paginated,
    total: filtered.length,
    limit,
    offset,
    cacheAge: tokenCache ? Date.now() - tokenCache.timestamp : 0,
  });
}
