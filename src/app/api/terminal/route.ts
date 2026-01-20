import { NextResponse } from "next/server";
import { getServerBagsApiOrNull } from "@/lib/bags-api-server";
import { Connection, PublicKey } from "@solana/web3.js";

// Types for terminal responses
export interface TrendingToken {
  mint: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  price: number;
  marketCap: number;
  volume24h: number;
  change24h: number;
  lifetimeFees: number;
  rank: number;
}

export interface NewPair {
  mint: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  createdAt: number; // timestamp
  ageSeconds: number;
  marketCap: number;
  volume24h: number;
  safety: TokenSafety;
}

export interface TokenSafety {
  score: number; // 0-100
  mintAuthorityDisabled: boolean;
  freezeAuthorityDisabled: boolean;
  lpBurned: boolean;
  lpBurnedPercent: number;
  top10HolderPercent: number;
  isRugRisk: boolean;
  warnings: string[];
}

interface TerminalRequestBody {
  action: "trending" | "new-pairs" | "token-safety" | "quick-quote";
  data?: {
    // For token-safety
    mint?: string;
    // For quick-quote
    inputMint?: string;
    outputMint?: string;
    amountSol?: number;
    slippageBps?: number;
    // For pagination
    limit?: number;
    offset?: number;
  };
}

export async function POST(request: Request) {
  try {
    const body: TerminalRequestBody = await request.json();
    const { action, data } = body;

    switch (action) {
      case "trending":
        return handleTrending(data?.limit, data?.offset);

      case "new-pairs":
        return handleNewPairs(data?.limit);

      case "token-safety":
        if (!data?.mint) {
          return NextResponse.json(
            { error: "Missing required field: mint" },
            { status: 400 }
          );
        }
        return handleTokenSafety(data.mint);

      case "quick-quote":
        return handleQuickQuote(data);

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Terminal API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process request" },
      { status: 500 }
    );
  }
}

// GET endpoint for quick access to trending
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "trending";
  const limit = parseInt(searchParams.get("limit") || "10");
  const mint = searchParams.get("mint");

  switch (action) {
    case "trending":
      return handleTrending(limit, 0);
    case "new-pairs":
      return handleNewPairs(limit);
    case "token-safety":
      if (!mint) {
        return NextResponse.json(
          { error: "Missing required param: mint" },
          { status: 400 }
        );
      }
      return handleTokenSafety(mint);
    default:
      return handleTrending(limit, 0);
  }
}

async function handleTrending(
  limit: number = 10,
  offset: number = 0
): Promise<NextResponse> {
  try {
    // Fetch from global tokens API to get world buildings data
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/api/world-state`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens: [] }), // Empty to get all global tokens
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch world state");
    }

    const worldState = await response.json();
    const buildings = worldState.buildings || [];

    // Sort by volume24h (most active) and map to trending format
    const trending: TrendingToken[] = buildings
      .filter((b: any) => b.tokenMint && b.volume24h > 0)
      .sort((a: any, b: any) => (b.volume24h || 0) - (a.volume24h || 0))
      .slice(offset, offset + limit)
      .map((b: any, index: number) => ({
        mint: b.tokenMint,
        name: b.name,
        symbol: b.symbol,
        imageUrl: b.imageUrl,
        price: b.price || 0,
        marketCap: b.marketCap || 0,
        volume24h: b.volume24h || 0,
        change24h: b.change24h || 0,
        lifetimeFees: b.lifetimeFees || 0,
        rank: offset + index + 1,
      }));

    return NextResponse.json({
      success: true,
      trending,
      total: buildings.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Trending error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch trending" },
      { status: 500 }
    );
  }
}

async function handleNewPairs(limit: number = 10): Promise<NextResponse> {
  try {
    // Fetch global tokens and sort by creation time
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/api/global-tokens`
    );

    if (!response.ok) {
      // Return empty if global tokens not configured
      return NextResponse.json({
        success: true,
        pairs: [],
        message: "Global tokens database not configured",
      });
    }

    const data = await response.json();
    if (!data.configured || !data.tokens) {
      return NextResponse.json({
        success: true,
        pairs: [],
        message: "No tokens in database",
      });
    }

    const now = Date.now();

    // Sort by creation time (newest first) and add safety scores
    const pairs: NewPair[] = await Promise.all(
      data.tokens
        .sort((a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        .slice(0, limit)
        .map(async (token: any) => {
          const createdAt = new Date(token.created_at).getTime();
          const ageSeconds = Math.floor((now - createdAt) / 1000);

          // Get basic safety check (simplified for performance)
          const safety = await getQuickSafetyCheck(token.mint);

          return {
            mint: token.mint,
            name: token.name,
            symbol: token.symbol,
            imageUrl: token.image_url,
            createdAt,
            ageSeconds,
            marketCap: token.market_cap || 0,
            volume24h: token.volume_24h || 0,
            safety,
          };
        })
    );

    return NextResponse.json({
      success: true,
      pairs,
      total: data.tokens.length,
    });
  } catch (error) {
    console.error("New pairs error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch new pairs" },
      { status: 500 }
    );
  }
}

async function handleTokenSafety(mint: string): Promise<NextResponse> {
  try {
    const safety = await getDetailedSafetyCheck(mint);

    return NextResponse.json({
      success: true,
      mint,
      safety,
    });
  } catch (error) {
    console.error("Token safety error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check token safety" },
      { status: 500 }
    );
  }
}

async function handleQuickQuote(
  data?: TerminalRequestBody["data"]
): Promise<NextResponse> {
  if (!data?.outputMint || !data?.amountSol) {
    return NextResponse.json(
      { error: "Missing required fields: outputMint, amountSol" },
      { status: 400 }
    );
  }

  const api = getServerBagsApiOrNull();
  if (!api) {
    return NextResponse.json(
      { error: "Bags API not configured. Set BAGS_API_KEY environment variable." },
      { status: 500 }
    );
  }

  try {
    const SOL_MINT = "So11111111111111111111111111111111111111112";
    const inputMint = data.inputMint || SOL_MINT;
    const amountLamports = Math.floor(data.amountSol * 1e9);

    const quote = await api.getTradeQuote(
      inputMint,
      data.outputMint,
      amountLamports,
      data.slippageBps || 100 // Default 1% for quick trades
    );

    return NextResponse.json({
      success: true,
      quote,
      inputAmount: data.amountSol,
      inputSymbol: inputMint === SOL_MINT ? "SOL" : "TOKEN",
    });
  } catch (error) {
    console.error("Quick quote error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get quote" },
      { status: 500 }
    );
  }
}

// Quick safety check for list views (faster, less detailed)
async function getQuickSafetyCheck(mint: string): Promise<TokenSafety> {
  const warnings: string[] = [];
  let score = 50; // Start neutral

  try {
    const connection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://rpc.ankr.com/solana"
    );

    const mintPubkey = new PublicKey(mint);
    const mintInfo = await connection.getParsedAccountInfo(mintPubkey);

    if (!mintInfo.value) {
      warnings.push("Token not found on-chain");
      return {
        score: 0,
        mintAuthorityDisabled: false,
        freezeAuthorityDisabled: false,
        lpBurned: false,
        lpBurnedPercent: 0,
        top10HolderPercent: 100,
        isRugRisk: true,
        warnings,
      };
    }

    const parsed = mintInfo.value.data as any;
    if (parsed?.parsed?.info) {
      const info = parsed.parsed.info;

      // Check mint authority
      const mintAuthorityDisabled = info.mintAuthority === null;
      if (mintAuthorityDisabled) {
        score += 20;
      } else {
        warnings.push("Mint authority enabled - can mint more tokens");
        score -= 10;
      }

      // Check freeze authority
      const freezeAuthorityDisabled = info.freezeAuthority === null;
      if (freezeAuthorityDisabled) {
        score += 15;
      } else {
        warnings.push("Freeze authority enabled - can freeze accounts");
        score -= 10;
      }

      return {
        score: Math.max(0, Math.min(100, score)),
        mintAuthorityDisabled,
        freezeAuthorityDisabled,
        lpBurned: false, // Would need LP account check
        lpBurnedPercent: 0,
        top10HolderPercent: 0, // Would need token accounts query
        isRugRisk: !mintAuthorityDisabled || !freezeAuthorityDisabled,
        warnings,
      };
    }
  } catch (error) {
    console.error("Quick safety check error:", error);
    warnings.push("Could not verify on-chain data");
  }

  return {
    score: 50,
    mintAuthorityDisabled: false,
    freezeAuthorityDisabled: false,
    lpBurned: false,
    lpBurnedPercent: 0,
    top10HolderPercent: 0,
    isRugRisk: true,
    warnings: ["Unable to verify token safety"],
  };
}

// Detailed safety check for individual token view
async function getDetailedSafetyCheck(mint: string): Promise<TokenSafety> {
  const warnings: string[] = [];
  let score = 50;

  try {
    const connection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://rpc.ankr.com/solana"
    );

    const mintPubkey = new PublicKey(mint);

    // Get mint info
    const mintInfo = await connection.getParsedAccountInfo(mintPubkey);

    if (!mintInfo.value) {
      warnings.push("Token not found on-chain");
      return {
        score: 0,
        mintAuthorityDisabled: false,
        freezeAuthorityDisabled: false,
        lpBurned: false,
        lpBurnedPercent: 0,
        top10HolderPercent: 100,
        isRugRisk: true,
        warnings,
      };
    }

    const parsed = mintInfo.value.data as any;
    let mintAuthorityDisabled = false;
    let freezeAuthorityDisabled = false;

    if (parsed?.parsed?.info) {
      const info = parsed.parsed.info;

      // Check mint authority
      mintAuthorityDisabled = info.mintAuthority === null;
      if (mintAuthorityDisabled) {
        score += 20;
      } else {
        warnings.push("Mint authority enabled - can mint more tokens");
        score -= 10;
      }

      // Check freeze authority
      freezeAuthorityDisabled = info.freezeAuthority === null;
      if (freezeAuthorityDisabled) {
        score += 15;
      } else {
        warnings.push("Freeze authority enabled - can freeze accounts");
        score -= 10;
      }
    }

    // Get largest token holders
    let top10HolderPercent = 0;
    try {
      const largestAccounts = await connection.getTokenLargestAccounts(mintPubkey);
      const totalSupply = parsed?.parsed?.info?.supply
        ? BigInt(parsed.parsed.info.supply)
        : BigInt(0);

      if (totalSupply > 0 && largestAccounts.value.length > 0) {
        const top10Sum = largestAccounts.value
          .slice(0, 10)
          .reduce((sum, acc) => sum + BigInt(acc.amount), BigInt(0));

        top10HolderPercent = Number((top10Sum * BigInt(10000)) / totalSupply) / 100;

        if (top10HolderPercent > 80) {
          warnings.push(`Top 10 holders own ${top10HolderPercent.toFixed(1)}% - high concentration`);
          score -= 20;
        } else if (top10HolderPercent > 50) {
          warnings.push(`Top 10 holders own ${top10HolderPercent.toFixed(1)}%`);
          score -= 10;
        } else {
          score += 15; // Good distribution
        }
      }
    } catch (e) {
      console.error("Error fetching token holders:", e);
    }

    // Determine if rug risk
    const isRugRisk = !mintAuthorityDisabled || !freezeAuthorityDisabled || top10HolderPercent > 80;

    // Bonus for clean tokens
    if (mintAuthorityDisabled && freezeAuthorityDisabled && top10HolderPercent < 50) {
      score += 10;
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      mintAuthorityDisabled,
      freezeAuthorityDisabled,
      lpBurned: false, // TODO: Check LP token burn
      lpBurnedPercent: 0,
      top10HolderPercent,
      isRugRisk,
      warnings,
    };
  } catch (error) {
    console.error("Detailed safety check error:", error);
    warnings.push("Error checking token safety");
    return {
      score: 0,
      mintAuthorityDisabled: false,
      freezeAuthorityDisabled: false,
      lpBurned: false,
      lpBurnedPercent: 0,
      top10HolderPercent: 0,
      isRugRisk: true,
      warnings,
    };
  }
}
