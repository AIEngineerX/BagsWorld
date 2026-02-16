import { NextResponse } from "next/server";
import { getSolIncinerator } from "@/lib/sol-incinerator";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";
import { isValidSolanaAddress } from "@/lib/env-utils";

type Action =
  | "burn"
  | "close"
  | "batch-close-all"
  | "burn-preview"
  | "close-preview"
  | "batch-close-all-preview"
  | "status";

export async function POST(request: Request) {
  // Rate limit: destructive endpoint - use strict limits
  const clientIP = getClientIP(request);
  const rateLimit = await checkRateLimit(`incinerator:${clientIP}`, RATE_LIMITS.strict);
  if (!rateLimit.success) {
    return NextResponse.json(
      {
        error: "Too many requests. Please wait before trying again.",
        retryAfter: Math.ceil(rateLimit.resetIn / 1000),
      },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rateLimit.resetIn / 1000)) },
      }
    );
  }

  try {
    const body = await request.json();
    const { action, data } = body as { action: Action; data?: Record<string, unknown> };

    if (action === "status") {
      const client = getSolIncinerator();
      const result = await client.status();
      return NextResponse.json(result);
    }

    if (!data?.userPublicKey) {
      return NextResponse.json({ error: "userPublicKey is required" }, { status: 400 });
    }

    if (!isValidSolanaAddress(data.userPublicKey)) {
      return NextResponse.json({ error: "Invalid userPublicKey address" }, { status: 400 });
    }

    const client = getSolIncinerator();

    switch (action) {
      case "burn": {
        if (!data.assetId) {
          return NextResponse.json({ error: "assetId is required for burn" }, { status: 400 });
        }
        const result = await client.burn({
          userPublicKey: data.userPublicKey as string,
          assetId: data.assetId as string,
          feePayer: data.feePayer as string | undefined,
          autoCloseTokenAccounts: data.autoCloseTokenAccounts as boolean | undefined,
          priorityFeeMicroLamports: data.priorityFeeMicroLamports as number | undefined,
          burnAmount: data.burnAmount as number | undefined,
        });
        return NextResponse.json(result);
      }

      case "close": {
        if (!data.assetId) {
          return NextResponse.json({ error: "assetId is required for close" }, { status: 400 });
        }
        const result = await client.close({
          userPublicKey: data.userPublicKey as string,
          assetId: data.assetId as string,
          feePayer: data.feePayer as string | undefined,
          priorityFeeMicroLamports: data.priorityFeeMicroLamports as number | undefined,
        });
        return NextResponse.json(result);
      }

      case "batch-close-all": {
        const result = await client.batchCloseAll({
          userPublicKey: data.userPublicKey as string,
          feePayer: data.feePayer as string | undefined,
          priorityFeeMicroLamports: data.priorityFeeMicroLamports as number | undefined,
        });
        return NextResponse.json(result);
      }

      case "burn-preview": {
        if (!data.assetId) {
          return NextResponse.json(
            { error: "assetId is required for burn preview" },
            { status: 400 }
          );
        }
        const result = await client.burnPreview({
          userPublicKey: data.userPublicKey as string,
          assetId: data.assetId as string,
          autoCloseTokenAccounts: data.autoCloseTokenAccounts as boolean | undefined,
          burnAmount: data.burnAmount as number | undefined,
        });
        return NextResponse.json(result);
      }

      case "close-preview": {
        if (!data.assetId) {
          return NextResponse.json(
            { error: "assetId is required for close preview" },
            { status: 400 }
          );
        }
        const result = await client.closePreview({
          userPublicKey: data.userPublicKey as string,
          assetId: data.assetId as string,
        });
        return NextResponse.json(result);
      }

      case "batch-close-all-preview": {
        const result = await client.batchCloseAllPreview({
          userPublicKey: data.userPublicKey as string,
        });
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json(
          {
            error: `Unknown action: ${action}. Valid actions: burn, close, batch-close-all, burn-preview, close-preview, batch-close-all-preview, status`,
          },
          { status: 400 }
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";

    if (message.includes("SOL_INCINERATOR_API_KEY not configured")) {
      return NextResponse.json(
        { error: "Sol Incinerator is not configured. API key missing." },
        { status: 503 }
      );
    }

    // Upstream RPC rate limit passed through by Sol Incinerator
    if (message.includes("max usage reached") || message.includes("-32429") || message.includes("429")) {
      return NextResponse.json(
        { error: "RPC rate-limited — the server retried but the limit persists. Please wait 30s and try again." },
        { status: 429, headers: { "Retry-After": "30" } }
      );
    }

    console.error("[Sol Incinerator API]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
