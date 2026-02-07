// Oracle Tournaments API - List tournaments
import { NextRequest, NextResponse } from "next/server";
import {
  getOracleTournaments,
  getOracleTournamentLeaderboard,
  isNeonConfigured,
  initializeOracleTables,
} from "@/lib/neon";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isNeonConfigured()) {
    return NextResponse.json({ success: false, error: "Oracle not initialized" }, { status: 503 });
  }

  await initializeOracleTables();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const tournamentId = searchParams.get("id");

  // If specific tournament requested, return with leaderboard
  if (tournamentId) {
    const tournaments = await getOracleTournaments();
    const tournament = tournaments.find((t) => t.id === parseInt(tournamentId));
    if (!tournament) {
      return NextResponse.json({ success: false, error: "Tournament not found" }, { status: 404 });
    }

    const leaderboard = await getOracleTournamentLeaderboard(tournament.id, 20);

    return NextResponse.json({
      success: true,
      tournament: {
        id: tournament.id,
        name: tournament.name,
        description: tournament.description,
        startTime: tournament.startTime.toISOString(),
        endTime: tournament.endTime.toISOString(),
        status: tournament.status,
        prizePool: {
          lamports: tournament.prizePoolLamports.toString(),
          sol: Number(tournament.prizePoolLamports) / 1_000_000_000,
        },
        prizeDistribution: tournament.prizeDistribution,
        scoringType: tournament.scoringType,
        maxParticipants: tournament.maxParticipants,
      },
      leaderboard: leaderboard.map((entry, i) => ({
        rank: i + 1,
        wallet: entry.wallet,
        walletShort: `${entry.wallet.slice(0, 4)}...${entry.wallet.slice(-4)}`,
        score: entry.score,
        marketsEntered: entry.marketsEntered,
        marketsWon: entry.marketsWon,
      })),
    });
  }

  // List tournaments
  const tournaments = await getOracleTournaments(status || undefined);

  return NextResponse.json({
    success: true,
    tournaments: tournaments.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      startTime: t.startTime.toISOString(),
      endTime: t.endTime.toISOString(),
      status: t.status,
      prizePool: {
        lamports: t.prizePoolLamports.toString(),
        sol: Number(t.prizePoolLamports) / 1_000_000_000,
      },
      scoringType: t.scoringType,
      maxParticipants: t.maxParticipants,
    })),
  });
}
