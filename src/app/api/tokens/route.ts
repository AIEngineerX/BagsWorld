// Enrich registered tokens with live Bags.fm SDK data
import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

// Bags SDK types
interface TokenLaunchCreator {
  username: string;
  pfp: string;
  royaltyBps: number;
  isCreator: boolean;
  wallet: string;
  provider: string | null;
  providerUsername: string | null;
}

interface TokenClaimEvent {
  wallet: string;
  isCreator: boolean;
  amount: string;
  signature: string;
  timestamp: number;
}

// Lazy-loaded SDK
let sdkInstance: any = null;

async function getBagsSDK(): Promise<any | null> {
  if (!process.env.BAGS_API_KEY) {
    console.log("No BAGS_API_KEY configured");
    return null;
  }

  if (sdkInstance) {
    return sdkInstance;
  }

  try {
    const { BagsSDK } = await import("@bagsfm/bags-sdk");
    const rpcUrl =
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
      "https://rpc.ankr.com/solana";
    const connection = new Connection(rpcUrl, "confirmed");
    sdkInstance = new BagsSDK(process.env.BAGS_API_KEY!, connection, "processed");
    console.log("Bags SDK initialized for tokens endpoint");
    return sdkInstance;
  } catch (error) {
    console.error("Failed to initialize Bags SDK:", error);
    return null;
  }
}

// Response type for enriched token data
export interface EnrichedTokenData {
  mint: string;
  lifetimeFees: number;
  creators: TokenLaunchCreator[];
  claimEvents: Array<{
    signature: string;
    wallet: string;
    amount: number;
    timestamp: number;
  }>;
  error?: string;
}

// POST - Fetch live data for multiple tokens
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mints } = body as { mints: string[] };

    if (!mints || !Array.isArray(mints) || mints.length === 0) {
      return NextResponse.json(
        { error: "mints array is required" },
        { status: 400 }
      );
    }

    // Limit to 20 tokens per request
    const limitedMints = mints.slice(0, 20);

    const sdk = await getBagsSDK();
    if (!sdk) {
      // Return mock data if SDK not available
      return NextResponse.json({
        tokens: limitedMints.map((mint) => ({
          mint,
          lifetimeFees: 0,
          creators: [],
          claimEvents: [],
          error: "SDK not configured",
        })),
        sdkAvailable: false,
      });
    }

    // Fetch data for each token in parallel
    const results = await Promise.all(
      limitedMints.map(async (mint): Promise<EnrichedTokenData> => {
        try {
          const mintPubkey = new PublicKey(mint);

          // Fetch creators, fees, and claim events
          const [creatorsResult, feesResult, eventsResult] =
            await Promise.allSettled([
              sdk.state.getTokenCreators(mintPubkey),
              sdk.state.getTokenLifetimeFees(mintPubkey),
              sdk.state.getTokenClaimEvents(mintPubkey, { limit: 10 }),
            ]);

          const creators: TokenLaunchCreator[] =
            creatorsResult.status === "fulfilled" ? creatorsResult.value : [];

          const lifetimeFees: number =
            feesResult.status === "fulfilled" ? feesResult.value || 0 : 0;

          const rawEvents: TokenClaimEvent[] =
            eventsResult.status === "fulfilled" ? eventsResult.value : [];

          // Convert claim events
          const claimEvents = rawEvents.map((e) => ({
            signature: e.signature,
            wallet: e.wallet,
            amount: parseFloat(e.amount) / 1e9, // Convert lamports to SOL
            timestamp: e.timestamp,
          }));

          return {
            mint,
            lifetimeFees,
            creators,
            claimEvents,
          };
        } catch (error) {
          console.error(`Error fetching data for ${mint}:`, error);
          return {
            mint,
            lifetimeFees: 0,
            creators: [],
            claimEvents: [],
            error: "Failed to fetch token data",
          };
        }
      })
    );

    return NextResponse.json({
      tokens: results,
      sdkAvailable: true,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Error in tokens endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET - Health check and SDK status
export async function GET() {
  const sdk = await getBagsSDK();
  return NextResponse.json({
    status: "ok",
    sdkConfigured: !!process.env.BAGS_API_KEY,
    sdkInitialized: !!sdk,
    timestamp: Date.now(),
  });
}
