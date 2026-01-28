// Oracle Admin Settle Round API - Settle a completed prediction round
import { NextRequest, NextResponse } from "next/server";
import {
  getActiveOracleRound,
  settleOracleRound,
  cancelOracleRound,
  isNeonConfigured,
} from "@/lib/neon";
import { isAdmin } from "@/lib/config";

export const dynamic = "force-dynamic";

// Fetch current price from DexScreener
async function getTokenPrice(mint: string): Promise<number> {
  const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    console.error(`DexScreener API error for ${mint}: ${response.status}`);
    return 0;
  }

  const data = await response.json();

  if (data.pairs && data.pairs.length > 0) {
    // Get price from most liquid pair
    const sortedPairs = data.pairs.sort(
      (a: { liquidity?: { usd?: number } }, b: { liquidity?: { usd?: number } }) =>
        (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
    );
    return parseFloat(sortedPairs[0].priceUsd || "0");
  }

  return 0;
}

export async function POST(request: NextRequest) {
  if (!isNeonConfigured()) {
    return NextResponse.json({ success: false, error: "Oracle not initialized" }, { status: 503 });
  }

  const body = await request.json();
  const { adminWallet, action } = body;

  // Verify admin using config-based admin check
  if (!adminWallet || !isAdmin(adminWallet)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  // Get active round
  const round = await getActiveOracleRound();
  if (!round) {
    return NextResponse.json(
      { success: false, error: "No active prediction round" },
      { status: 400 }
    );
  }

  // Handle cancel action
  if (action === "cancel") {
    const result = await cancelOracleRound(round.id);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    console.log(`[Oracle Admin] Round #${round.id} cancelled by ${adminWallet}`);
    return NextResponse.json({
      success: true,
      message: "Round cancelled",
      roundId: round.id,
    });
  }

  // Settle the round - fetch end prices and determine winner
  const endPrices: Record<string, number> = {};
  const priceChanges: Record<string, number> = {};
  let validPriceCount = 0;

  for (const token of round.tokenOptions) {
    const endPrice = await getTokenPrice(token.mint);
    endPrices[token.mint] = endPrice;

    // Calculate price change percentage
    if (token.startPrice > 0 && endPrice > 0) {
      const changePercent = ((endPrice - token.startPrice) / token.startPrice) * 100;
      priceChanges[token.mint] = changePercent;
      validPriceCount++;
    } else {
      // Mark as invalid (NaN will be excluded from winner selection)
      priceChanges[token.mint] = NaN;
    }
  }

  // Verify we have at least 1 token with valid prices
  if (validPriceCount === 0) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Could not fetch valid prices for any tokens. DexScreener may be unavailable. Try again later.",
        pricesAttempted: endPrices,
      },
      { status: 503 }
    );
  }

  // Find winner (highest % change, excluding invalid prices)
  let winningTokenMint = "";
  let winningPriceChange = -Infinity;

  for (const [mint, change] of Object.entries(priceChanges)) {
    // Skip tokens without valid price data
    if (isNaN(change)) continue;

    if (change > winningPriceChange) {
      winningPriceChange = change;
      winningTokenMint = mint;
    }
  }

  if (!winningTokenMint) {
    return NextResponse.json(
      { success: false, error: "Could not determine winner - no valid price changes" },
      { status: 500 }
    );
  }

  // Get winning token symbol
  const winningToken = round.tokenOptions.find((t) => t.mint === winningTokenMint);

  // Settle the round
  const settlementData = {
    endPrices,
    priceChanges,
    settledAt: new Date().toISOString(),
    adminWallet,
  };

  const result = await settleOracleRound(
    round.id,
    winningTokenMint,
    winningPriceChange,
    settlementData
  );

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  // Calculate prize pool in SOL for logging
  const prizePoolSol = Number(round.prizePoolLamports) / 1_000_000_000;

  console.log(
    `[Oracle Admin] Round #${round.id} settled by ${adminWallet}: Winner ${winningToken?.symbol} (+${winningPriceChange.toFixed(2)}%), ${result.winnersCount} winners, ${prizePoolSol} SOL distributed`
  );

  return NextResponse.json({
    success: true,
    message: "Round settled successfully",
    roundId: round.id,
    winner: {
      mint: winningTokenMint,
      symbol: winningToken?.symbol || "UNKNOWN",
      priceChange: winningPriceChange,
    },
    winnersCount: result.winnersCount,
    priceChanges,
    prizePool: {
      lamports: round.prizePoolLamports.toString(),
      sol: prizePoolSol,
    },
    distributions: result.distributions?.map((d) => ({
      wallet: d.wallet,
      walletShort: `${d.wallet.slice(0, 4)}...${d.wallet.slice(-4)}`,
      rank: d.rank,
      prizeLamports: d.prizeLamports.toString(),
      prizeSol: d.prizeSol,
    })),
  });
}
