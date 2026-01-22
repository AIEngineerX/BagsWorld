// SDK Pre-warm endpoint - call this early to initialize SDK before it's needed
// This reduces cold start latency on the first /api/world-state call

import { NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";

// Shared SDK instance (same pattern as world-state)
let sdkInstance: any = null;
let sdkInitPromise: Promise<any | null> | null = null;

async function initSDK(): Promise<boolean> {
  if (!process.env.BAGS_API_KEY) {
    return false;
  }

  if (sdkInstance) {
    return true;
  }

  if (sdkInitPromise) {
    await sdkInitPromise;
    return !!sdkInstance;
  }

  sdkInitPromise = (async () => {
    try {
      const { BagsSDK } = await import("@bagsfm/bags-sdk");
      const rpcUrl =
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
        "https://rpc.ankr.com/solana";
      const connection = new Connection(rpcUrl, "confirmed");
      sdkInstance = new BagsSDK(
        process.env.BAGS_API_KEY!,
        connection,
        "processed"
      );
      return sdkInstance;
    } catch {
      return null;
    } finally {
      sdkInitPromise = null;
    }
  })();

  await sdkInitPromise;
  return !!sdkInstance;
}

export async function GET() {
  const start = Date.now();
  const success = await initSDK();
  const duration = Date.now() - start;

  return NextResponse.json({
    warmed: success,
    duration,
    cached: duration < 10, // If very fast, was already cached
  });
}
