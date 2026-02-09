// Oracle Admin Create Round API - Create a new prediction round with prize pool
// Supports any Bags.fm token - specify mints directly or use auto-selection from registry
import { NextRequest, NextResponse } from "next/server";
import {
  createOracleRound,
  initializeOracleTables,
  isNeonConfigured,
  OracleTokenOptionDB,
} from "@/lib/neon";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";
import { getAllWorldTokensAsync, LaunchedToken } from "@/lib/token-registry";
import { ECOSYSTEM_CONFIG } from "@/lib/config";

export const dynamic = "force-dynamic";

// Prize pool configuration from config
const MIN_PRIZE_SOL = ECOSYSTEM_CONFIG.oracle.prizePool.minSol;
const MAX_PRIZE_SOL = ECOSYSTEM_CONFIG.oracle.prizePool.maxSol;
const LAMPORTS_PER_SOL = 1_000_000_000;

interface DexScreenerPair {
  priceUsd?: string;
  liquidity?: { usd?: number };
  baseToken?: { symbol?: string; name?: string };
  info?: { imageUrl?: string };
}

// Fetch token data from DexScreener (price + info)
async function getTokenData(mint: string): Promise<{
  price: number;
  symbol: string;
  name: string;
  imageUrl?: string;
} | null> {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      console.error(`DexScreener API error for ${mint}: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.pairs && data.pairs.length > 0) {
      // Get most liquid pair
      const sortedPairs = data.pairs.sort(
        (a: DexScreenerPair, b: DexScreenerPair) =>
          (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
      );
      const bestPair = sortedPairs[0] as DexScreenerPair;

      return {
        price: parseFloat(bestPair.priceUsd || "0"),
        symbol: bestPair.baseToken?.symbol || mint.slice(0, 6).toUpperCase(),
        name: bestPair.baseToken?.name || `Token ${mint.slice(0, 8)}`,
        imageUrl: bestPair.info?.imageUrl,
      };
    }

    return null;
  } catch (error) {
    console.error(`Error fetching token data for ${mint}:`, error);
    return null;
  }
}

interface TokenInput {
  mint: string;
  symbol?: string;
  name?: string;
  imageUrl?: string;
}

export async function POST(request: NextRequest) {
  if (!isNeonConfigured()) {
    return NextResponse.json({ success: false, error: "Oracle not initialized" }, { status: 503 });
  }

  const body = await request.json();
  const {
    adminWallet,
    durationHours = 24,
    tokens,
    tokenMints,
    useRegistry = true,
    prizePoolSol = (ECOSYSTEM_CONFIG.oracle?.prizePool as { defaultSol?: number })?.defaultSol ??
      0.1,
    // New virtual market fields
    marketType = "price_prediction",
    marketConfig,
    resolutionSource,
    entryCostOp = 100,
    // General-purpose market fields
    category,
    description,
    imageUrl,
    isPrizeEvent,
  } = body;
  const autoResolve = body.autoResolve ?? marketType !== "custom";

  // Verify admin using Bearer token auth
  const authHeader = request.headers.get("Authorization");
  const expectedToken = process.env.ADMIN_API_SECRET;
  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  // Rate limit admin creation operations
  const clientIP = getClientIP(request);
  const rateLimit = await checkRateLimit(`oracle-create:${clientIP}`, RATE_LIMITS.strict);
  if (!rateLimit.success) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  // Validate prize pool (0 = no prize pool)
  const prizeAmount = Number(prizePoolSol) || 0;
  if (prizeAmount > 0) {
    if (prizeAmount < MIN_PRIZE_SOL) {
      return NextResponse.json(
        { success: false, error: `Prize pool must be at least ${MIN_PRIZE_SOL} SOL` },
        { status: 400 }
      );
    }
    if (prizeAmount > MAX_PRIZE_SOL) {
      return NextResponse.json(
        { success: false, error: `Prize pool cannot exceed ${MAX_PRIZE_SOL} SOL` },
        { status: 400 }
      );
    }
  }

  const prizePoolLamports = BigInt(Math.floor(prizeAmount * LAMPORTS_PER_SOL));

  // Initialize tables
  const tablesInitialized = await initializeOracleTables();
  if (!tablesInitialized) {
    return NextResponse.json(
      { success: false, error: "Failed to initialize oracle tables" },
      { status: 500 }
    );
  }

  let tokenOptions: OracleTokenOptionDB[] = [];

  // Option 1: Full token objects provided (best - includes all info)
  if (tokens && Array.isArray(tokens) && tokens.length > 0) {
    for (const token of (tokens as TokenInput[]).slice(0, 5)) {
      const data = await getTokenData(token.mint);
      tokenOptions.push({
        mint: token.mint,
        symbol: token.symbol || data?.symbol || token.mint.slice(0, 6).toUpperCase(),
        name: token.name || data?.name || `Token ${token.mint.slice(0, 8)}`,
        startPrice: data?.price || 0,
        imageUrl: token.imageUrl || data?.imageUrl,
      });
    }
  }
  // Option 2: Just mint addresses - fetch info from DexScreener
  else if (tokenMints && Array.isArray(tokenMints) && tokenMints.length > 0) {
    for (const mint of (tokenMints as string[]).slice(0, 5)) {
      const data = await getTokenData(mint);
      if (data) {
        tokenOptions.push({
          mint,
          symbol: data.symbol,
          name: data.name,
          startPrice: data.price,
          imageUrl: data.imageUrl,
        });
      } else {
        // Fallback if DexScreener doesn't have the token
        tokenOptions.push({
          mint,
          symbol: mint.slice(0, 6).toUpperCase(),
          name: `Token ${mint.slice(0, 8)}`,
          startPrice: 0,
        });
      }
    }
  }
  // Option 3: Auto-select from BagsWorld registry
  else if (useRegistry) {
    const registry = await getAllWorldTokensAsync();
    const activeTokens = registry
      .filter((t: LaunchedToken) => !t.mint.startsWith("Starter") && !t.mint.startsWith("Treasury"))
      .slice(0, 10); // Get top 10, we'll select 5 with valid prices

    for (const token of activeTokens) {
      if (tokenOptions.length >= 5) break;

      const data = await getTokenData(token.mint);
      if (data && data.price > 0) {
        tokenOptions.push({
          mint: token.mint,
          symbol: token.symbol || data.symbol,
          name: token.name || data.name,
          startPrice: data.price,
          imageUrl: token.imageUrl || data.imageUrl,
        });
      }
    }
  }

  // Validate: isPrizeEvent requires a prize pool
  if (isPrizeEvent === true && prizeAmount <= 0) {
    return NextResponse.json(
      { success: false, error: "Prize events require a prize pool > 0 SOL" },
      { status: 400 }
    );
  }

  // Custom markets don't need tokens (they use outcomes instead)
  if (marketType !== "custom" && tokenOptions.length < 2) {
    return NextResponse.json(
      { success: false, error: "Need at least 2 tokens with valid prices to create a round" },
      { status: 400 }
    );
  }

  // Calculate end time
  const endTime = new Date(Date.now() + durationHours * 60 * 60 * 1000);

  // Merge category/description/imageUrl/isPrizeEvent into marketConfig
  const mergedMarketConfig = {
    ...(marketConfig || {}),
    ...(category && { category }),
    ...(description && { description }),
    ...(imageUrl && { imageUrl }),
    isPrizeEvent: isPrizeEvent ?? prizeAmount > 0,
  };

  // Create round with prize pool and market type options
  const result = await createOracleRound(tokenOptions, endTime, prizePoolLamports, {
    marketType,
    marketConfig: mergedMarketConfig,
    autoResolve,
    resolutionSource,
    createdBy: "admin",
    entryCostOp,
  });

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  const prizeDisplay = prizeAmount > 0 ? `${prizeAmount} SOL prize` : "no prize pool";
  console.log(
    `[Oracle Admin] Round #${result.roundId} created by ${adminWallet}: ${tokenOptions.length} tokens, ${prizeDisplay}, ends ${endTime.toISOString()}`
  );

  return NextResponse.json({
    success: true,
    roundId: result.roundId,
    tokenCount: tokenOptions.length,
    endTime: endTime.toISOString(),
    prizePool: {
      lamports: prizePoolLamports.toString(),
      sol: prizeAmount,
    },
    tokens: tokenOptions.map((t) => ({
      mint: t.mint,
      symbol: t.symbol,
      name: t.name,
      startPrice: t.startPrice,
      imageUrl: t.imageUrl,
    })),
  });
}
