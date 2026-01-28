// Oracle Enter Prediction API - Submit a prediction
// Token-gated: requires 2M $BagsWorld tokens (admins and localhost bypass)
import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { getActiveOracleRound, enterOraclePrediction, isNeonConfigured } from "@/lib/neon";
import { isAdmin } from "@/lib/config";
import {
  getTokenBalance,
  BAGSWORLD_TOKEN_MINT,
  ORACLE_MIN_BALANCE,
  BAGSWORLD_TOKEN_SYMBOL,
  BAGSWORLD_BUY_URL,
} from "@/lib/token-balance";

export const dynamic = "force-dynamic";

// Get RPC URL from environment
function getRpcUrl(): string {
  return (
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    "https://api.mainnet-beta.solana.com"
  );
}

// Check if wallet has enough tokens for Oracle access (2M required)
async function checkOracleAccess(wallet: string): Promise<{
  hasAccess: boolean;
  balance: number;
  required: number;
}> {
  try {
    const connection = new Connection(getRpcUrl(), "confirmed");
    const walletPubkey = new PublicKey(wallet);
    const balance = await getTokenBalance(connection, walletPubkey, BAGSWORLD_TOKEN_MINT);

    return {
      hasAccess: balance >= ORACLE_MIN_BALANCE,
      balance,
      required: ORACLE_MIN_BALANCE,
    };
  } catch (error) {
    console.error("[Oracle] Error checking token balance:", error);
    // On error, deny access (fail closed)
    return {
      hasAccess: false,
      balance: 0,
      required: ORACLE_MIN_BALANCE,
    };
  }
}

export async function POST(request: NextRequest) {
  if (!isNeonConfigured()) {
    return NextResponse.json({ success: false, error: "Oracle not initialized" }, { status: 503 });
  }

  const body = await request.json();
  const { wallet, tokenMint } = body;

  if (!wallet || !tokenMint) {
    return NextResponse.json(
      { success: false, error: "Missing wallet or tokenMint" },
      { status: 400 }
    );
  }

  // Check token gate (admins and localhost bypass)
  const walletIsAdmin = isAdmin(wallet);
  const host = request.headers.get("host") || "";
  const isLocalhost = host.startsWith("localhost") || host.startsWith("127.0.0.1");

  if (!walletIsAdmin && !isLocalhost) {
    const accessCheck = await checkOracleAccess(wallet);

    if (!accessCheck.hasAccess) {
      return NextResponse.json(
        {
          success: false,
          error: "Token gate: Insufficient balance",
          tokenGate: {
            required: accessCheck.required,
            balance: accessCheck.balance,
            symbol: BAGSWORLD_TOKEN_SYMBOL,
            buyUrl: BAGSWORLD_BUY_URL,
            message: `Hold ${accessCheck.required.toLocaleString()} ${BAGSWORLD_TOKEN_SYMBOL} to enter predictions`,
          },
        },
        { status: 403 }
      );
    }
  }

  // Get active round
  const round = await getActiveOracleRound();
  if (!round) {
    return NextResponse.json(
      { success: false, error: "No active prediction round" },
      { status: 400 }
    );
  }

  // Enter prediction
  const result = await enterOraclePrediction(round.id, wallet, tokenMint);

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    message: "Prediction submitted successfully",
    roundId: round.id,
    tokenMint,
    bypass: walletIsAdmin ? "admin" : isLocalhost ? "localhost" : undefined,
  });
}
