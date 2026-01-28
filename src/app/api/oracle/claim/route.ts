// Oracle Claim API - Request withdrawal of prize winnings
// Requires wallet signature to prove ownership
import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";
import {
  createOracleClaimRequest,
  getOracleBalance,
  getOraclePendingClaim,
  isNeonConfigured,
} from "@/lib/neon";

export const dynamic = "force-dynamic";

// Message to sign for claim verification
const CLAIM_MESSAGE = "Sign to claim your Oracle winnings from BagsWorld";

export async function POST(request: NextRequest) {
  if (!isNeonConfigured()) {
    return NextResponse.json({ success: false, error: "Oracle not initialized" }, { status: 503 });
  }

  const body = await request.json();
  const { wallet, signature } = body;

  if (!wallet || !signature) {
    return NextResponse.json(
      { success: false, error: "Missing wallet or signature" },
      { status: 400 }
    );
  }

  // Verify the wallet address is valid
  let walletPubkey: PublicKey;
  try {
    walletPubkey = new PublicKey(wallet);
  } catch {
    return NextResponse.json({ success: false, error: "Invalid wallet address" }, { status: 400 });
  }

  // Verify signature proves wallet ownership
  try {
    const messageBytes = new TextEncoder().encode(CLAIM_MESSAGE);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = walletPubkey.toBytes();

    const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

    if (!isValid) {
      return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 401 });
    }
  } catch (error) {
    console.error("[Oracle Claim] Signature verification error:", error);
    return NextResponse.json(
      { success: false, error: "Signature verification failed" },
      { status: 401 }
    );
  }

  // Check if user has a pending claim already
  const pendingClaim = await getOraclePendingClaim(wallet);
  if (pendingClaim) {
    return NextResponse.json(
      {
        success: false,
        error: "You already have a pending claim",
        pendingClaim: {
          id: pendingClaim.id,
          amountSol: Number(pendingClaim.amountLamports) / 1_000_000_000,
          status: pendingClaim.status,
          createdAt: pendingClaim.createdAt.toISOString(),
        },
      },
      { status: 400 }
    );
  }

  // Check balance
  const balance = await getOracleBalance(wallet);
  if (!balance || balance.balanceLamports <= BigInt(0)) {
    return NextResponse.json({ success: false, error: "No balance to claim" }, { status: 400 });
  }

  // Create claim request
  const result = await createOracleClaimRequest(wallet);

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  const amountSol = Number(result.amountLamports || BigInt(0)) / 1_000_000_000;

  console.log(
    `[Oracle Claim] Claim #${result.claimId} created: ${wallet.slice(0, 8)}... requesting ${amountSol} SOL`
  );

  return NextResponse.json({
    success: true,
    message: "Claim submitted successfully. Processing within 24 hours.",
    claimId: result.claimId,
    amount: {
      lamports: result.amountLamports?.toString(),
      sol: amountSol,
    },
  });
}

// GET endpoint to get the message to sign
export async function GET() {
  return NextResponse.json({
    message: CLAIM_MESSAGE,
    instructions: "Sign this message with your wallet to prove ownership and claim your winnings.",
  });
}
