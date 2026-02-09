import { NextResponse } from "next/server";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Server-side transaction sending endpoint
 * This keeps the RPC URL secret (no NEXT_PUBLIC_ prefix)
 *
 * Uses direct fetch to Helius RPC instead of @solana/web3.js Connection
 * to ensure proper API key handling.
 */

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;

// Helper to make JSON-RPC calls to Helius
async function rpcCall(method: string, params: unknown[]) {
  if (!SOLANA_RPC_URL) {
    throw new Error("SOLANA_RPC_URL not configured");
  }

  const response = await fetch(SOLANA_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  });

  const text = await response.text();

  if (!response.ok) {
    console.error(`[send-transaction] RPC ${method} failed:`, response.status);
    throw new Error(`RPC request failed: ${response.status}`);
  }

  const json = JSON.parse(text);

  if (json.error) {
    throw new Error(`RPC error ${json.error.code}: ${json.error.message}`);
  }

  return json.result;
}

export async function POST(request: Request) {
  // Rate limit: 5 requests per minute (strict - prevents transaction spam)
  const clientIP = getClientIP(request);
  const rateLimit = await checkRateLimit(`send-tx:${clientIP}`, RATE_LIMITS.strict);
  if (!rateLimit.success) {
    return NextResponse.json(
      {
        error: "Too many transaction requests. Try again later.",
        retryAfter: Math.ceil(rateLimit.resetIn / 1000),
      },
      { status: 429 }
    );
  }

  try {
    // Validate RPC URL is configured
    if (!SOLANA_RPC_URL || !SOLANA_RPC_URL.startsWith("https://")) {
      console.error("[send-transaction] SOLANA_RPC_URL not configured or invalid");
      return NextResponse.json({ error: "Transaction service unavailable" }, { status: 503 });
    }

    const { signedTransaction } = await request.json();

    if (!signedTransaction) {
      return NextResponse.json({ error: "Missing signedTransaction" }, { status: 400 });
    }

    // Send transaction using sendTransaction RPC method
    // The transaction is already base64 encoded from the client
    const txid = await rpcCall("sendTransaction", [
      signedTransaction,
      {
        encoding: "base64",
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 3,
      },
    ]);

    // Confirm transaction
    let confirmed = false;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max

    while (!confirmed && attempts < maxAttempts) {
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 1000));

      try {
        const status = await rpcCall("getSignatureStatuses", [[txid]]);
        const txStatus = status?.value?.[0];

        if (txStatus) {
          if (txStatus.err) {
            return NextResponse.json(
              {
                error: "Transaction failed on-chain",
                details: txStatus.err,
                txid,
              },
              { status: 500 }
            );
          }

          if (
            txStatus.confirmationStatus === "confirmed" ||
            txStatus.confirmationStatus === "finalized"
          ) {
            confirmed = true;
          }
        }
      } catch (pollError) {
        // Log polling errors for debugging while continuing to poll
        console.warn(
          `[send-transaction] Poll attempt ${attempts}/${maxAttempts} failed:`,
          pollError instanceof Error ? pollError.message : String(pollError)
        );
      }
    }

    if (!confirmed) {
      return NextResponse.json({
        success: true,
        txid,
        warning: "Transaction sent but confirmation timed out. Check explorer.",
      });
    }

    return NextResponse.json({
      success: true,
      txid,
    });
  } catch (error) {
    console.error("[send-transaction] Error:", error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check for common RPC errors — log details server-side, return generic message to client
    if (
      errorMessage.includes("401") ||
      errorMessage.includes("Unauthorized") ||
      errorMessage.includes("-32401")
    ) {
      console.error("[send-transaction] RPC auth failure — check API key");
      return NextResponse.json(
        { error: "Transaction service temporarily unavailable" },
        { status: 503 }
      );
    }

    if (errorMessage.includes("403") || errorMessage.includes("Forbidden")) {
      console.error("[send-transaction] RPC access denied");
      return NextResponse.json(
        { error: "Transaction service temporarily unavailable" },
        { status: 503 }
      );
    }

    // For RPC-level transaction errors (e.g. insufficient funds), pass a sanitized message
    if (errorMessage.startsWith("RPC error")) {
      return NextResponse.json(
        { error: "Transaction rejected by network. Please check your balance and try again." },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Failed to send transaction" }, { status: 500 });
  }
}
