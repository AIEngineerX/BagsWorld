// Oracle Admin Create Tournament API
import { NextRequest, NextResponse } from "next/server";
import { createOracleTournament, isNeonConfigured, initializeOracleTables } from "@/lib/neon";
import { isAdmin } from "@/lib/config";

export const dynamic = "force-dynamic";

const LAMPORTS_PER_SOL = 1_000_000_000;

export async function POST(request: NextRequest) {
  if (!isNeonConfigured()) {
    return NextResponse.json({ success: false, error: "Oracle not initialized" }, { status: 503 });
  }

  const body = await request.json();
  const {
    adminWallet,
    name,
    description,
    startTime,
    endTime,
    prizePoolSol = 0,
    prizeDistribution = [
      { rank: 1, pct: 50 },
      { rank: 2, pct: 30 },
      { rank: 3, pct: 20 },
    ],
    scoringType = "op_earned",
    maxParticipants,
  } = body;

  if (!adminWallet || !isAdmin(adminWallet)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  if (!name || !startTime || !endTime) {
    return NextResponse.json(
      { success: false, error: "Missing required fields: name, startTime, endTime" },
      { status: 400 }
    );
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (end <= start) {
    return NextResponse.json(
      { success: false, error: "End time must be after start time" },
      { status: 400 }
    );
  }

  await initializeOracleTables();

  const prizePoolLamports = BigInt(Math.floor((Number(prizePoolSol) || 0) * LAMPORTS_PER_SOL));

  const result = await createOracleTournament(
    name,
    description,
    start,
    end,
    prizePoolLamports,
    prizeDistribution,
    scoringType,
    maxParticipants,
    adminWallet
  );

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  console.log(
    `[Oracle Admin] Tournament "${name}" created by ${adminWallet}: ${prizePoolSol} SOL prize`
  );

  return NextResponse.json({
    success: true,
    tournamentId: result.tournamentId,
    name,
    prizePool: {
      lamports: prizePoolLamports.toString(),
      sol: Number(prizePoolSol) || 0,
    },
  });
}
