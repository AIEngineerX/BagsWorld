// Partner Fee Claim API
// Generates transactions to claim accumulated partner fees from Bags.fm
// SECURITY: Only the configured partner wallet can claim fees
//
// Actions:
// - "create-config": One-time setup to register as a partner (creates on-chain config)
// - "claim": Generate transactions to claim accumulated fees

import { NextRequest, NextResponse } from "next/server";
import { ECOSYSTEM_CONFIG } from "@/lib/config";

const BAGS_API_URL = process.env.BAGS_API_URL || "https://public-api-v2.bags.fm/api/v1";
const BAGS_API_KEY = process.env.BAGS_API_KEY;

// Partner wallet - same as ecosystem wallet for simplicity
const PARTNER_WALLET = ECOSYSTEM_CONFIG.ecosystem.wallet;

export async function POST(request: NextRequest) {
  try {
    // Verify API key is configured
    if (!BAGS_API_KEY) {
      return NextResponse.json(
        { error: "Bags API key not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { walletAddress, action = "claim" } = body;

    // SECURITY: Verify the requesting wallet matches the partner wallet
    if (!walletAddress) {
      return NextResponse.json(
        { error: "Wallet address required" },
        { status: 400 }
      );
    }

    if (walletAddress !== PARTNER_WALLET) {
      return NextResponse.json(
        { error: "Unauthorized - only the partner wallet can claim fees" },
        { status: 403 }
      );
    }

    // Handle different actions
    if (action === "create-config") {
      return handleCreateConfig(walletAddress);
    } else {
      return handleClaimFees(walletAddress);
    }

  } catch (error) {
    console.error("Partner claim error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process request" },
      { status: 500 }
    );
  }
}

// Create partner config (one-time setup)
async function handleCreateConfig(walletAddress: string) {
  console.log(`Creating partner config for wallet: ${walletAddress}`);

  const response = await fetch(`${BAGS_API_URL}/fee-share/partner-config/creation-tx`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": BAGS_API_KEY!,
    },
    body: JSON.stringify({
      partnerWallet: walletAddress,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Bags API error (create-config):", response.status, errorText);

    let errorMessage = "Failed to create partner config";
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorJson.error || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: response.status }
    );
  }

  const data = await response.json();

  return NextResponse.json({
    success: true,
    action: "create-config",
    transaction: data.response?.transaction,
    blockhash: data.response?.blockhash,
    message: "Partner config creation transaction generated. Sign to complete setup.",
  });
}

// Claim accumulated fees
async function handleClaimFees(walletAddress: string) {
  console.log(`Generating partner claim transactions for wallet: ${walletAddress}`);

  const response = await fetch(`${BAGS_API_URL}/fee-share/partner-config/claim-tx`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": BAGS_API_KEY!,
    },
    body: JSON.stringify({
      partnerWallet: walletAddress,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Bags API error (claim):", response.status, errorText);

    let errorMessage = "Failed to generate claim transactions";
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorJson.error || errorMessage;

      // Check if partner config doesn't exist yet
      if (errorMessage.includes("not found") || errorMessage.includes("does not exist")) {
        errorMessage = "Partner config not found. Click 'Setup Partner' first to register.";
      }
    } catch {
      errorMessage = errorText || errorMessage;
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: response.status }
    );
  }

  const data = await response.json();

  return NextResponse.json({
    success: true,
    action: "claim",
    transactions: data.response?.transactions || [],
    message: data.response?.transactions?.length
      ? `Generated ${data.response.transactions.length} claim transaction(s)`
      : "No fees available to claim",
  });
}

// GET - Check partner status (for UI)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("wallet");

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Wallet address required" },
        { status: 400 }
      );
    }

    // Check if this wallet is the partner wallet
    const isPartner = walletAddress === PARTNER_WALLET;

    return NextResponse.json({
      isPartner,
      partnerWallet: isPartner ? PARTNER_WALLET : null,
      solscanUrl: isPartner ? `https://solscan.io/account/${PARTNER_WALLET}` : null,
    });

  } catch (error) {
    console.error("Partner status error:", error);
    return NextResponse.json(
      { error: "Failed to check partner status" },
      { status: 500 }
    );
  }
}
