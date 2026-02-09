// Casino Wheel of Fortune API
import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { getCasinoPot, recordWheelSpin, isNeonConfigured, getLastWheelSpin } from "@/lib/neon";
import {
  getTokenBalance,
  BAGSWORLD_TOKEN_MINT,
  MIN_TOKEN_BALANCE,
  BAGSWORLD_TOKEN_SYMBOL,
  BAGSWORLD_BUY_URL,
} from "@/lib/token-balance";

function getRpcUrl(): string {
  return (
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    "https://api.mainnet-beta.solana.com"
  );
}

// Wheel segments with probabilities
const WHEEL_SEGMENTS = [
  { label: "MISS", prize: 0, weight: 50 },
  { label: "0.01 SOL", prize: 0.01, weight: 25 },
  { label: "MISS", prize: 0, weight: 50 },
  { label: "0.05 SOL", prize: 0.05, weight: 15 },
  { label: "MISS", prize: 0, weight: 50 },
  { label: "0.1 SOL", prize: 0.1, weight: 8 },
  { label: "MISS", prize: 0, weight: 50 },
  { label: "JACKPOT", prize: 0.5, weight: 2 },
];

const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

// Fallback in-memory state (only used when DB unavailable)
const spinCooldownsFallback = new Map<string, number>();
let potBalanceFallback = 0.35;

// Simple weighted random selection
function spinWheel(): { label: string; prize: number } {
  const totalWeight = WHEEL_SEGMENTS.reduce((sum, s) => sum + s.weight, 0);
  let random = Math.random() * totalWeight;

  for (const segment of WHEEL_SEGMENTS) {
    random -= segment.weight;
    if (random <= 0) {
      return { label: segment.label, prize: segment.prize };
    }
  }

  // Fallback
  return { label: "MISS", prize: 0 };
}

export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get("wallet");
    const dbConfigured = isNeonConfigured();

    // Get pot balance from DB or fallback
    let balance = potBalanceFallback;
    if (dbConfigured) {
      const dbPot = await getCasinoPot();
      if (dbPot !== null) balance = dbPot;
    }

    // Check cooldown for wallet
    let canSpin = true;
    let cooldownEnds: number | undefined;

    if (wallet) {
      if (dbConfigured) {
        // Use DB-backed cooldown
        const lastSpin = await getLastWheelSpin(wallet);
        if (lastSpin && lastSpin + COOLDOWN_MS > Date.now()) {
          canSpin = false;
          cooldownEnds = lastSpin + COOLDOWN_MS;
        }
      } else {
        // Fallback to in-memory
        const cooldown = spinCooldownsFallback.get(wallet);
        if (cooldown && cooldown > Date.now()) {
          canSpin = false;
          cooldownEnds = cooldown;
        }
      }
    }

    return NextResponse.json({
      potBalance: balance,
      canSpin,
      cooldownEnds,
    });
  } catch (error) {
    console.error("Error in wheel GET:", error);
    return NextResponse.json({ error: "Failed to get wheel status" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet } = body;

    if (!wallet) {
      return NextResponse.json({ error: "Wallet address required" }, { status: 400 });
    }

    // Token gate: verify wallet holds minimum $BagsWorld tokens
    try {
      const connection = new Connection(getRpcUrl(), "confirmed");
      const walletPubkey = new PublicKey(wallet);
      const balance = await getTokenBalance(connection, walletPubkey, BAGSWORLD_TOKEN_MINT);

      if (balance < MIN_TOKEN_BALANCE) {
        return NextResponse.json(
          {
            error: `Hold ${MIN_TOKEN_BALANCE.toLocaleString()} ${BAGSWORLD_TOKEN_SYMBOL} to spin the wheel`,
            balance,
            required: MIN_TOKEN_BALANCE,
            buyUrl: BAGSWORLD_BUY_URL,
          },
          { status: 403 }
        );
      }
    } catch (error) {
      console.error("Token gate check failed:", error);
      return NextResponse.json(
        { error: "Failed to verify token balance. Please try again." },
        { status: 500 }
      );
    }

    const dbConfigured = isNeonConfigured();

    // Check cooldown and record spin atomically to prevent double-spin race condition
    if (dbConfigured) {
      const lastSpin = await getLastWheelSpin(wallet);
      if (lastSpin && lastSpin + COOLDOWN_MS > Date.now()) {
        const remaining = Math.ceil((lastSpin + COOLDOWN_MS - Date.now()) / 60000);
        return NextResponse.json(
          { error: `Please wait ${remaining} minutes before spinning again` },
          { status: 429 }
        );
      }

      // Record spin FIRST to claim the cooldown slot atomically
      // This prevents concurrent requests from both passing the cooldown check
      const spinRecorded = await recordWheelSpin(wallet, 0, "pending");
      if (!spinRecorded) {
        return NextResponse.json(
          { error: "Spin already in progress, please wait" },
          { status: 429 }
        );
      }
    } else {
      const cooldown = spinCooldownsFallback.get(wallet);
      if (cooldown && cooldown > Date.now()) {
        const remaining = Math.ceil((cooldown - Date.now()) / 60000);
        return NextResponse.json(
          { error: `Please wait ${remaining} minutes before spinning again` },
          { status: 429 }
        );
      }
      // Set cooldown immediately to prevent in-memory race
      spinCooldownsFallback.set(wallet, Date.now() + COOLDOWN_MS);
    }

    // Get current pot balance
    let balance = potBalanceFallback;
    if (dbConfigured) {
      const dbPot = await getCasinoPot();
      if (dbPot !== null) balance = dbPot;
    }

    // Check minimum pot
    if (balance < 0.1) {
      return NextResponse.json(
        { error: "Pot is too low, please try again later" },
        { status: 400 }
      );
    }

    // Spin the wheel
    const result = spinWheel();

    // Cap prize at pot balance
    const actualPrize = Math.min(result.prize, balance);

    // Update the spin record with actual result and deduct from pot
    if (dbConfigured) {
      await recordWheelSpin(wallet, actualPrize, result.label);
      // Refresh balance from DB
      const newPot = await getCasinoPot();
      balance = newPot ?? balance - actualPrize;
    } else {
      // Fallback: deduct from memory
      if (actualPrize > 0) {
        potBalanceFallback = Math.max(0, potBalanceFallback - actualPrize);
      }
      balance = potBalanceFallback;
    }

    return NextResponse.json({
      success: true,
      result: result.label,
      prize: actualPrize,
      newPotBalance: balance,
    });
  } catch (error) {
    console.error("Error in wheel spin:", error);
    return NextResponse.json({ error: "Failed to spin wheel" }, { status: 500 });
  }
}
