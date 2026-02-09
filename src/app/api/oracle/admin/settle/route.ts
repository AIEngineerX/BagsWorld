// Oracle Admin Settle Round API - Settle a completed prediction round
import { NextRequest, NextResponse } from "next/server";
import {
  getActiveOracleRound,
  getOracleRoundById,
  settleOracleRound,
  settleOracleRoundWithOutcome,
  cancelOracleRound,
  getOracleRoundPredictions,
  updatePredictionOPPayout,
  isNeonConfigured,
} from "@/lib/neon";

import { emitEvent } from "@/lib/agent-coordinator";
import { resolveMarket, calculateOPPayouts, getTokenPrice } from "@/lib/oracle-resolver";
import { addOP, updateStreak, updateReputation } from "@/lib/op-economy";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isNeonConfigured()) {
    return NextResponse.json({ success: false, error: "Oracle not initialized" }, { status: 503 });
  }

  const body = await request.json();
  const { adminWallet, action, roundId, winningOutcomeId } = body;

  // Verify admin using Bearer token auth
  const authHeader = request.headers.get("Authorization");
  const expectedToken = process.env.ADMIN_API_SECRET;
  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  // Get round - by ID if provided, otherwise active round
  const round = roundId ? await getOracleRoundById(roundId) : await getActiveOracleRound();
  if (!round) {
    return NextResponse.json(
      {
        success: false,
        error: roundId ? `Round #${roundId} not found` : "No active prediction round",
      },
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

  // For non-price-prediction markets, use the generalized resolver or admin-provided outcome
  const marketType = round.marketType || "price_prediction";
  if (marketType !== "price_prediction") {
    let resolvedOutcomeId: string | undefined;
    let resolutionData: Record<string, unknown> = {};

    if (marketType === "custom" && winningOutcomeId) {
      // Admin manually resolves custom market by picking the winning outcome
      resolvedOutcomeId = winningOutcomeId;
      resolutionData = {
        resolvedBy: adminWallet,
        resolvedAt: new Date().toISOString(),
        method: "admin_manual",
        winningOutcomeId,
      };
    } else if (marketType === "custom" && !winningOutcomeId) {
      return NextResponse.json(
        { success: false, error: "Custom markets require a winningOutcomeId" },
        { status: 400 }
      );
    } else {
      // Non-custom, non-price_prediction markets use the generalized resolver
      const resolution = await resolveMarket(round);
      if (!resolution.success) {
        return NextResponse.json(
          { success: false, error: resolution.error || "Resolution failed" },
          { status: 500 }
        );
      }
      resolvedOutcomeId = resolution.winningOutcomeId;
      resolutionData = resolution.resolutionData;
    }

    if (resolvedOutcomeId) {
      await settleOracleRoundWithOutcome(round.id, resolvedOutcomeId, resolutionData);
    }

    // Distribute OP payouts
    const predictions = await getOracleRoundPredictions(round.id);
    if (predictions.length > 0) {
      const winningId = resolvedOutcomeId || "";
      const payouts = calculateOPPayouts(predictions, winningId, true);
      const totalPreds = predictions.length;
      const winnerCount = payouts.filter((p) => p.isWinner).length;
      const difficulty = totalPreds > 0 ? totalPreds / Math.max(1, winnerCount) : 1;

      for (const payout of payouts) {
        await updatePredictionOPPayout(
          payout.predictionId,
          payout.opPayout,
          payout.isWinner,
          payout.rank
        );
        if (payout.opPayout > 0) {
          await addOP(payout.wallet, payout.opPayout, "prediction_win", round.id);
        }
        await updateStreak(payout.wallet, payout.isWinner);
        await updateReputation(payout.wallet, payout.isWinner, difficulty);
      }
    }

    console.log(
      `[Oracle Admin] Round #${round.id} (${marketType}) settled by ${adminWallet}: winner=${resolvedOutcomeId}`
    );

    return NextResponse.json({
      success: true,
      message: "Market settled successfully",
      roundId: round.id,
      marketType,
      winningOutcome: resolvedOutcomeId,
      resolutionData,
    });
  }

  // Settle the round - fetch end prices and determine winner (price_prediction flow)
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

  // Also distribute OP payouts for price prediction markets
  const predictions = await getOracleRoundPredictions(round.id);
  if (predictions.length > 0) {
    const payouts = calculateOPPayouts(predictions, winningTokenMint, false);
    const totalPreds = predictions.length;
    const winnerCount = payouts.filter((p) => p.isWinner).length;
    const difficulty = totalPreds > 0 ? totalPreds / Math.max(1, winnerCount) : 1;

    for (const payout of payouts) {
      await updatePredictionOPPayout(
        payout.predictionId,
        payout.opPayout,
        payout.isWinner,
        payout.rank
      );
      if (payout.opPayout > 0) {
        await addOP(payout.wallet, payout.opPayout, "prediction_win", round.id);
      }
      await updateStreak(payout.wallet, payout.isWinner);
      await updateReputation(payout.wallet, payout.isWinner, difficulty);
    }
  }

  // Calculate prize pool in SOL for logging
  const prizePoolSol = Number(round.prizePoolLamports) / 1_000_000_000;

  console.log(
    `[Oracle Admin] Round #${round.id} settled by ${adminWallet}: Winner ${winningToken?.symbol} (+${winningPriceChange.toFixed(2)}%), ${result.winnersCount} winners, ${prizePoolSol} SOL distributed`
  );

  // Emit oracle settle event to coordinator
  emitEvent(
    "oracle_settle",
    "oracle",
    {
      roundId: round.id,
      winningSymbol: winningToken?.symbol,
      winningMint: winningTokenMint,
      priceChange: winningPriceChange,
      winnersCount: result.winnersCount,
      prizePoolSol,
      message: `Oracle: $${winningToken?.symbol || "TOKEN"} wins (+${winningPriceChange.toFixed(1)}%)! ${result.winnersCount} predictors share ${prizePoolSol} SOL`,
    },
    "high"
  ).catch((err) => {
    console.error("[Oracle Admin] Failed to emit oracle_settle event:", err);
  });

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
