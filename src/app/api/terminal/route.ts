import { NextResponse } from "next/server";
import { getJupiterClient } from "@/lib/jupiter-api";
import { Connection, PublicKey } from "@solana/web3.js";

const jupiter = getJupiterClient();
const SOL_MINT = "So11111111111111111111111111111111111111112";

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
  rank: number;
  tags?: string[];
}

export interface NewPair {
  mint: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  createdAt: number;
  ageSeconds: number;
  marketCap: number;
  volume24h: number;
  safety: TokenSafety;
}

export interface TokenSafety {
  score: number;
  mintAuthorityDisabled: boolean;
  freezeAuthorityDisabled: boolean;
  lpBurned: boolean;
  lpBurnedPercent: number;
  top10HolderPercent: number;
  isRugRisk: boolean;
  warnings: string[];
}

// BagsWorld hot token interface
export interface BagsWorldToken {
  mint: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  price: number;
  volume24h: number;
  lifetimeFees: number;
  createdAt: number;
  creator: string;
  isFeatured?: boolean;
}

interface TerminalRequestBody {
  action:
    | "trending"
    | "new-pairs"
    | "search"
    | "token-safety"
    | "quote"
    | "ultra-order"
    | "ultra-execute"
    | "bags-hot";
  data?: {
    // For search
    query?: string;
    // For token-safety
    mint?: string;
    // For quote / ultra-order
    inputMint?: string;
    outputMint?: string;
    amount?: number;
    slippageBps?: number;
    taker?: string;
    // For ultra-execute
    requestId?: string;
    signedTransaction?: string;
    // Pagination
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
        return handleTrending(data?.limit);

      case "new-pairs":
        return handleNewPairs(data?.limit);

      case "search":
        if (!data?.query) {
          return NextResponse.json({ error: "Missing query" }, { status: 400 });
        }
        return handleSearch(data.query, data.limit);

      case "token-safety":
        if (!data?.mint) {
          return NextResponse.json({ error: "Missing mint" }, { status: 400 });
        }
        return handleTokenSafety(data.mint);

      case "quote":
        return handleQuote(data);

      case "ultra-order":
        return handleUltraOrder(data);

      case "ultra-execute":
        return handleUltraExecute(data);

      case "bags-hot":
        return handleBagsHot(data?.limit);

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Terminal API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "trending";
  const limit = parseInt(searchParams.get("limit") || "10");
  const query = searchParams.get("query");
  const mint = searchParams.get("mint");

  switch (action) {
    case "trending":
      return handleTrending(limit);
    case "new-pairs":
      return handleNewPairs(limit);
    case "search":
      return handleSearch(query || "", limit);
    case "token-safety":
      if (!mint) return NextResponse.json({ error: "Missing mint" }, { status: 400 });
      return handleTokenSafety(mint);
    case "bags-hot":
      return handleBagsHot(limit);
    default:
      return handleTrending(limit);
  }
}

/**
 * Get trending tokens from Jupiter (by volume)
 */
async function handleTrending(limit: number = 10): Promise<NextResponse> {
  try {
    const tokens = await jupiter.getTrendingTokens(limit);
    const mints = tokens.map(t => t.address);
    const prices = await jupiter.getTokenPrices(mints);

    const trending: TrendingToken[] = tokens.map((token, index) => ({
      mint: token.address,
      name: token.name,
      symbol: token.symbol,
      imageUrl: token.logoURI,
      price: prices[token.address] ? parseFloat(prices[token.address].price) : 0,
      marketCap: 0, // Jupiter doesn't provide this directly
      volume24h: token.daily_volume || 0,
      change24h: 0, // Would need historical data
      rank: index + 1,
      tags: token.tags,
    }));

    return NextResponse.json({ success: true, trending, source: "jupiter" });
  } catch (error) {
    console.error("Trending error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch trending" },
      { status: 500 }
    );
  }
}

/**
 * Get newly listed tokens
 */
async function handleNewPairs(limit: number = 10): Promise<NextResponse> {
  try {
    const tokens = await jupiter.getNewPairs(limit);
    const now = Date.now();

    const pairs: NewPair[] = await Promise.all(
      tokens.map(async (token) => {
        const createdAt = token.created_at ? new Date(token.created_at).getTime() : 0;
        const ageSeconds = createdAt ? Math.floor((now - createdAt) / 1000) : 0;

        // Quick safety check from Jupiter token data
        const safety: TokenSafety = {
          score: 50,
          mintAuthorityDisabled: token.mint_authority === null,
          freezeAuthorityDisabled: token.freeze_authority === null,
          lpBurned: false,
          lpBurnedPercent: 0,
          top10HolderPercent: 0,
          isRugRisk: token.mint_authority !== null || token.freeze_authority !== null,
          warnings: [],
        };

        if (token.mint_authority !== null) {
          safety.warnings.push("Mint authority enabled");
          safety.score -= 20;
        } else {
          safety.score += 20;
        }

        if (token.freeze_authority !== null) {
          safety.warnings.push("Freeze authority enabled");
          safety.score -= 15;
        } else {
          safety.score += 15;
        }

        return {
          mint: token.address,
          name: token.name,
          symbol: token.symbol,
          imageUrl: token.logoURI,
          createdAt,
          ageSeconds,
          marketCap: 0,
          volume24h: token.daily_volume || 0,
          safety,
        };
      })
    );

    return NextResponse.json({ success: true, pairs, source: "jupiter" });
  } catch (error) {
    console.error("New pairs error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch new pairs" },
      { status: 500 }
    );
  }
}

/**
 * Search tokens by symbol/name/address
 */
async function handleSearch(query: string, limit: number = 10): Promise<NextResponse> {
  try {
    const tokens = await jupiter.searchTokens(query, limit);

    const results = tokens.map(token => ({
      mint: token.address,
      name: token.name,
      symbol: token.symbol,
      imageUrl: token.logoURI,
      tags: token.tags,
      decimals: token.decimals,
    }));

    return NextResponse.json({ success: true, results, query, source: "jupiter" });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed" },
      { status: 500 }
    );
  }
}

/**
 * Get detailed token safety check from on-chain data
 */
async function handleTokenSafety(mint: string): Promise<NextResponse> {
  try {
    const connection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"
    );

    const mintPubkey = new PublicKey(mint);
    const mintInfo = await connection.getParsedAccountInfo(mintPubkey);

    const warnings: string[] = [];
    let score = 50;

    if (!mintInfo.value) {
      return NextResponse.json({
        success: true,
        mint,
        safety: {
          score: 0,
          mintAuthorityDisabled: false,
          freezeAuthorityDisabled: false,
          lpBurned: false,
          lpBurnedPercent: 0,
          top10HolderPercent: 100,
          isRugRisk: true,
          warnings: ["Token not found on-chain"],
        },
      });
    }

    const parsed = mintInfo.value.data as any;
    let mintAuthorityDisabled = false;
    let freezeAuthorityDisabled = false;

    if (parsed?.parsed?.info) {
      const info = parsed.parsed.info;

      mintAuthorityDisabled = info.mintAuthority === null;
      if (mintAuthorityDisabled) score += 20;
      else {
        warnings.push("Mint authority enabled - can mint more");
        score -= 10;
      }

      freezeAuthorityDisabled = info.freezeAuthority === null;
      if (freezeAuthorityDisabled) score += 15;
      else {
        warnings.push("Freeze authority enabled");
        score -= 10;
      }
    }

    // Get top holders
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
          warnings.push(`Top 10 hold ${top10HolderPercent.toFixed(1)}%`);
          score -= 20;
        } else if (top10HolderPercent > 50) {
          warnings.push(`Top 10 hold ${top10HolderPercent.toFixed(1)}%`);
          score -= 10;
        } else {
          score += 15;
        }
      }
    } catch (e) {
      console.error("Holder check error:", e);
    }

    const isRugRisk = !mintAuthorityDisabled || !freezeAuthorityDisabled || top10HolderPercent > 80;

    return NextResponse.json({
      success: true,
      mint,
      safety: {
        score: Math.max(0, Math.min(100, score)),
        mintAuthorityDisabled,
        freezeAuthorityDisabled,
        lpBurned: false,
        lpBurnedPercent: 0,
        top10HolderPercent,
        isRugRisk,
        warnings,
      },
    });
  } catch (error) {
    console.error("Safety check error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Safety check failed" },
      { status: 500 }
    );
  }
}

/**
 * Get swap quote from Jupiter
 */
async function handleQuote(data?: TerminalRequestBody["data"]): Promise<NextResponse> {
  if (!data?.outputMint || !data?.amount) {
    return NextResponse.json(
      { error: "Missing outputMint or amount" },
      { status: 400 }
    );
  }

  try {
    const inputMint = data.inputMint || SOL_MINT;
    const amountInSmallest = data.inputMint === SOL_MINT || !data.inputMint
      ? Math.floor(data.amount * 1e9) // SOL to lamports
      : Math.floor(data.amount * 1e6); // Assume 6 decimals for tokens

    const quote = await jupiter.getQuote(
      inputMint,
      data.outputMint,
      amountInSmallest,
      data.slippageBps || 100
    );

    return NextResponse.json({
      success: true,
      quote,
      source: "jupiter",
    });
  } catch (error) {
    console.error("Quote error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Quote failed" },
      { status: 500 }
    );
  }
}

/**
 * Create Ultra Swap order
 * Jupiter handles: MEV protection, fees, transaction landing
 */
async function handleUltraOrder(data?: TerminalRequestBody["data"]): Promise<NextResponse> {
  if (!data?.outputMint || !data?.amount || !data?.taker) {
    return NextResponse.json(
      { error: "Missing outputMint, amount, or taker" },
      { status: 400 }
    );
  }

  try {
    const inputMint = data.inputMint || SOL_MINT;
    const amountInSmallest = inputMint === SOL_MINT
      ? Math.floor(data.amount * 1e9)
      : Math.floor(data.amount * 1e6);

    const order = await jupiter.createUltraOrder(
      inputMint,
      data.outputMint,
      amountInSmallest,
      data.taker,
      data.slippageBps || 100
    );

    return NextResponse.json({
      success: true,
      order,
      gasless: order.gasless,
      source: "jupiter-ultra",
    });
  } catch (error) {
    console.error("Ultra order error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ultra order failed" },
      { status: 500 }
    );
  }
}

/**
 * Execute Ultra Swap with signed transaction
 * Jupiter Beam lands the transaction with optimal timing
 */
async function handleUltraExecute(data?: TerminalRequestBody["data"]): Promise<NextResponse> {
  if (!data?.requestId || !data?.signedTransaction) {
    return NextResponse.json(
      { error: "Missing requestId or signedTransaction" },
      { status: 400 }
    );
  }

  try {
    const result = await jupiter.executeUltraSwap(
      data.requestId,
      data.signedTransaction
    );

    return NextResponse.json({
      success: true,
      signature: result.signature,
      status: result.status,
      slot: result.slot,
      source: "jupiter-ultra",
    });
  } catch (error) {
    console.error("Ultra execute error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Execute failed" },
      { status: 500 }
    );
  }
}

/**
 * Get hot tokens launched on BagsWorld
 * Fetches from global database and enriches with Jupiter price data
 */
async function handleBagsHot(limit: number = 10): Promise<NextResponse> {
  try {
    // Fetch BagsWorld tokens from global database
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const globalRes = await fetch(`${baseUrl}/api/global-tokens`);

    if (!globalRes.ok) {
      return NextResponse.json({
        success: true,
        tokens: [],
        source: "bagsworld",
        message: "No BagsWorld tokens found",
      });
    }

    const globalData = await globalRes.json();

    if (!globalData.configured || !globalData.tokens || globalData.tokens.length === 0) {
      return NextResponse.json({
        success: true,
        tokens: [],
        source: "bagsworld",
        message: "No BagsWorld tokens found",
      });
    }

    // Get mints for price lookup
    const mints = globalData.tokens.map((t: any) => t.mint);

    // Fetch prices from Jupiter
    let prices: Record<string, { price: string }> = {};
    try {
      prices = await jupiter.getTokenPrices(mints);
    } catch (e) {
      console.error("Price fetch error:", e);
    }

    // Transform and sort by volume/fees
    const tokens: BagsWorldToken[] = globalData.tokens.map((t: any) => ({
      mint: t.mint,
      name: t.name,
      symbol: t.symbol,
      imageUrl: t.image_url,
      price: prices[t.mint] ? parseFloat(prices[t.mint].price) : 0,
      volume24h: t.volume_24h || 0,
      lifetimeFees: t.lifetime_fees || 0,
      createdAt: t.created_at ? new Date(t.created_at).getTime() : 0,
      creator: t.creator_wallet || "",
      isFeatured: t.is_featured || false,
    }));

    // Sort by: featured first, then by volume (descending)
    tokens.sort((a, b) => {
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      return b.volume24h - a.volume24h;
    });

    return NextResponse.json({
      success: true,
      tokens: tokens.slice(0, limit),
      total: tokens.length,
      source: "bagsworld",
    });
  } catch (error) {
    console.error("BagsWorld hot error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch BagsWorld tokens" },
      { status: 500 }
    );
  }
}
