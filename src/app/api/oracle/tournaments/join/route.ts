// Oracle Tournament Join API - Join a tournament (free entry)
import { NextRequest, NextResponse } from "next/server";
import { joinOracleTournament, isNeonConfigured, initializeOracleTables } from "@/lib/neon";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isNeonConfigured()) {
    return NextResponse.json({ success: false, error: "Oracle not initialized" }, { status: 503 });
  }

  await initializeOracleTables();

  const body = await request.json();
  const { wallet, tournamentId } = body;

  if (!wallet || !tournamentId) {
    return NextResponse.json(
      { success: false, error: "Missing wallet or tournamentId" },
      { status: 400 }
    );
  }

  const result = await joinOracleTournament(tournamentId, wallet);

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    message: "Joined tournament!",
    tournamentId,
  });
}
