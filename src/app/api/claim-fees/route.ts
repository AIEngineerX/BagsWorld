import { NextResponse } from "next/server";
import { getServerBagsApiOrNull } from "@/lib/bags-api-server";
import type { BagsApiClient } from "@/lib/bags-api";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";
import { getTokensByMints } from "@/lib/dexscreener-api";
import { isValidSolanaAddress } from "@/lib/env-utils";

interface ClaimRequestBody {
  action: "get-positions" | "generate-claim-tx" | "lookup-by-x";
  wallet?: string;
  positions?: string[]; // virtualPool addresses for claiming
  xUsername?: string; // X username for wallet lookup
}

export async function POST(request: Request) {
  // Rate limit: 30 requests per minute (standard)
  const clientIP = getClientIP(request);
  const rateLimit = await checkRateLimit(`claim-fees:${clientIP}`, RATE_LIMITS.standard);
  if (!rateLimit.success) {
    return NextResponse.json(
      {
        error: "Too many requests. Try again later.",
        retryAfter: Math.ceil(rateLimit.resetIn / 1000),
      },
      { status: 429 }
    );
  }

  try {
    const body: ClaimRequestBody = await request.json();
    const { action, wallet, positions, xUsername } = body;
    const api = getServerBagsApiOrNull();

    if (!api) {
      return NextResponse.json(
        { error: "Bags API not configured. Set BAGS_API_KEY environment variable." },
        { status: 500 }
      );
    }

    switch (action) {
      case "get-positions":
        return handleGetPositions(api, wallet || "");

      case "generate-claim-tx":
        return handleGenerateClaimTx(api, wallet || "", positions || []);

      case "lookup-by-x":
        return handleLookupByX(api, xUsername || "");

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Claim fees API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process request" },
      { status: 500 }
    );
  }
}

async function handleGetPositions(api: BagsApiClient, wallet: string): Promise<NextResponse> {
  if (!wallet) {
    return NextResponse.json({ error: "Missing required field: wallet" }, { status: 400 });
  }

  if (!isValidSolanaAddress(wallet)) {
    return NextResponse.json({ error: "Invalid Solana wallet address" }, { status: 400 });
  }

  try {
    const positions = await api.getClaimablePositions(wallet);

    // Enrich positions with token metadata from DexScreener
    const enrichedPositions = await enrichPositionsWithTokenData(positions);

    // Calculate total claimable
    const totalClaimable = enrichedPositions.reduce(
      (sum, p) => sum + (p.claimableDisplayAmount ?? 0),
      0
    );

    return NextResponse.json({
      success: true,
      positions: enrichedPositions,
      totalClaimable,
    });
  } catch (error) {
    console.error("Get positions error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get claimable positions" },
      { status: 500 }
    );
  }
}

// Enrich positions with token name, symbol, and logo from DexScreener + Helius fallback
async function enrichPositionsWithTokenData(
  positions: Array<{
    baseMint: string;
    quoteMint: string;
    virtualPool: string;
    isMigrated: boolean;
    totalClaimableLamportsUserShare: number;
    claimableDisplayAmount: number;
    userBps: number;
  }>
) {
  if (positions.length === 0) return positions;

  try {
    // Get unique baseMint addresses
    const mints = [...new Set(positions.map((p) => p.baseMint).filter(Boolean))];

    if (mints.length === 0) return positions;

    // Create a map of mint -> token info
    const tokenMap = new Map<string, { name: string; symbol: string; logoUrl?: string }>();

    // Step 1: Try DexScreener first (supports up to 30 at once)
    try {
      const tokenPairs = await getTokensByMints(mints.slice(0, 30));
      for (const pair of tokenPairs) {
        if (pair?.baseToken?.address) {
          tokenMap.set(pair.baseToken.address, {
            name: pair.baseToken.name || "Unknown",
            symbol: pair.baseToken.symbol || "???",
            logoUrl: pair.info?.imageUrl,
          });
        }
      }
    } catch (dexError) {
      console.error("DexScreener fetch error:", dexError);
    }

    // Step 2: For any mints not found on DexScreener, try Helius DAS API
    const missingMints = mints.filter((m) => !tokenMap.has(m));
    if (missingMints.length > 0) {
      const heliusData = await fetchTokenMetadataFromHelius(missingMints);
      for (const [mint, data] of heliusData) {
        if (!tokenMap.has(mint)) {
          tokenMap.set(mint, data);
        }
      }
    }

    // Enrich positions with token data
    return positions.map((position) => ({
      ...position,
      tokenName: tokenMap.get(position.baseMint)?.name,
      tokenSymbol: tokenMap.get(position.baseMint)?.symbol,
      tokenLogoUrl: tokenMap.get(position.baseMint)?.logoUrl,
    }));
  } catch (error) {
    console.error("Error enriching positions with token data:", error);
    // Return positions without enrichment on error
    return positions;
  }
}

// Fetch token metadata from Helius DAS API (fallback for tokens not on DexScreener)
async function fetchTokenMetadataFromHelius(
  mints: string[]
): Promise<Map<string, { name: string; symbol: string; logoUrl?: string }>> {
  const result = new Map<string, { name: string; symbol: string; logoUrl?: string }>();

  const rpcUrl = process.env.SOLANA_RPC_URL;
  if (!rpcUrl || !rpcUrl.includes("helius")) {
    return result; // Only works with Helius RPC
  }

  try {
    // Helius DAS API - getAssetBatch
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "claim-fees-metadata",
        method: "getAssetBatch",
        params: {
          ids: mints,
        },
      }),
    });

    if (!response.ok) return result;

    const data = await response.json();
    const assets = data.result || [];

    for (const asset of assets) {
      if (asset?.id && asset?.content?.metadata) {
        const metadata = asset.content.metadata;
        result.set(asset.id, {
          name: metadata.name || "Unknown",
          symbol: metadata.symbol || "???",
          logoUrl: asset.content?.links?.image || asset.content?.files?.[0]?.uri,
        });
      }
    }
  } catch (error) {
    console.error("Helius DAS API error:", error);
  }

  return result;
}

async function handleGenerateClaimTx(
  api: BagsApiClient,
  wallet: string,
  positions: string[]
): Promise<NextResponse> {
  if (!wallet || !positions.length) {
    return NextResponse.json(
      { error: "Missing required fields: wallet, positions" },
      { status: 400 }
    );
  }

  if (!isValidSolanaAddress(wallet)) {
    return NextResponse.json({ error: "Invalid Solana wallet address" }, { status: 400 });
  }

  // Validate all position addresses (virtualPool addresses)
  for (const position of positions) {
    if (!isValidSolanaAddress(position)) {
      return NextResponse.json({ error: "Invalid position address in list" }, { status: 400 });
    }
  }

  try {
    const result = await api.generateClaimTransactions(wallet, positions);

    return NextResponse.json({
      success: true,
      transactions: result.transactions,
      computeUnitLimit: result.computeUnitLimit,
    });
  } catch (error) {
    console.error("Generate claim tx error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate claim transactions" },
      { status: 500 }
    );
  }
}

async function handleLookupByX(api: BagsApiClient, username: string): Promise<NextResponse> {
  if (!username) {
    return NextResponse.json({ error: "Missing required field: xUsername" }, { status: 400 });
  }

  try {
    // Remove @ prefix if present
    const cleanUsername = username.replace(/^@/, "");

    const result = await api.getWalletByUsername("twitter", cleanUsername);

    return NextResponse.json({
      success: true,
      wallet: result.wallet,
      platformData: result.platformData,
    });
  } catch (error) {
    console.error("Lookup by X error:", error);

    // Check if it's a "not found" type error
    const errorMessage = error instanceof Error ? error.message : "Failed to look up wallet";

    if (errorMessage.includes("not found") || errorMessage.includes("404")) {
      return NextResponse.json(
        { error: "No wallet linked to this X account. Link your wallet at bags.fm/settings" },
        { status: 404 }
      );
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
