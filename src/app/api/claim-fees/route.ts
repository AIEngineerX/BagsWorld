import { NextResponse } from "next/server";
import { BagsApiClient } from "@/lib/bags-api";

let bagsApi: BagsApiClient | null = null;

function getBagsApi(): BagsApiClient | null {
  if (!bagsApi && process.env.BAGS_API_KEY) {
    bagsApi = new BagsApiClient(process.env.BAGS_API_KEY);
  }
  return bagsApi;
}

interface ClaimRequestBody {
  action: "get-positions" | "generate-claim-tx" | "lookup-by-x";
  wallet?: string;
  positions?: string[]; // virtualPool addresses for claiming
  xUsername?: string; // X username for wallet lookup
}

export async function POST(request: Request) {
  try {
    const body: ClaimRequestBody = await request.json();
    const { action, wallet, positions, xUsername } = body;
    const api = getBagsApi();

    if (!api) {
      return NextResponse.json(
        { error: "Bags API not configured. Set BAGS_API_KEY environment variable." },
        { status: 500 }
      );
    }

    switch (action) {
      case "get-positions":
        return handleGetPositions(api, wallet || "");

      case "generate-claim-tx":
        return handleGenerateClaimTx(api, wallet || "", positions || []);

      case "lookup-by-x":
        return handleLookupByX(api, xUsername || "");

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Claim fees API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process request" },
      { status: 500 }
    );
  }
}

async function handleGetPositions(
  api: BagsApiClient,
  wallet: string
): Promise<NextResponse> {
  if (!wallet) {
    return NextResponse.json(
      { error: "Missing required field: wallet" },
      { status: 400 }
    );
  }

  try {
    const positions = await api.getClaimablePositions(wallet);

    // Calculate total claimable
    const totalClaimable = positions.reduce(
      (sum, p) => sum + p.claimableDisplayAmount,
      0
    );

    return NextResponse.json({
      success: true,
      positions,
      totalClaimable,
    });
  } catch (error) {
    console.error("Get positions error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get claimable positions" },
      { status: 500 }
    );
  }
}

async function handleGenerateClaimTx(
  api: BagsApiClient,
  wallet: string,
  positions: string[]
): Promise<NextResponse> {
  if (!wallet || !positions.length) {
    return NextResponse.json(
      { error: "Missing required fields: wallet, positions" },
      { status: 400 }
    );
  }

  try {
    const result = await api.generateClaimTransactions(wallet, positions);

    return NextResponse.json({
      success: true,
      transactions: result.transactions,
      computeUnitLimit: result.computeUnitLimit,
    });
  } catch (error) {
    console.error("Generate claim tx error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate claim transactions" },
      { status: 500 }
    );
  }
}

async function handleLookupByX(
  api: BagsApiClient,
  username: string
): Promise<NextResponse> {
  if (!username) {
    return NextResponse.json(
      { error: "Missing required field: xUsername" },
      { status: 400 }
    );
  }

  try {
    // Remove @ prefix if present
    const cleanUsername = username.replace(/^@/, "");

    const result = await api.getWalletByUsername("twitter", cleanUsername);

    return NextResponse.json({
      success: true,
      wallet: result.wallet,
      platformData: result.platformData,
    });
  } catch (error) {
    console.error("Lookup by X error:", error);

    // Check if it's a "not found" type error
    const errorMessage = error instanceof Error ? error.message : "Failed to look up wallet";

    if (errorMessage.includes("not found") || errorMessage.includes("404")) {
      return NextResponse.json(
        { error: "No wallet linked to this X account. Link your wallet at bags.fm/settings" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
