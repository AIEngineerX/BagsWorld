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

const ACTIONS_NEEDING_ASSET = new Set(["burn", "close", "burn-preview", "close-preview"]);

function jsonError(error: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json({ error }, { status, headers });
}

export async function POST(request: Request) {
  const clientIP = getClientIP(request);
  const rateLimit = await checkRateLimit(`incinerator:${clientIP}`, RATE_LIMITS.strict);
  if (!rateLimit.success) {
    const retryAfter = String(Math.ceil(rateLimit.resetIn / 1000));
    return jsonError("Too many requests. Please wait before trying again.", 429, {
      "Retry-After": retryAfter,
    });
  }

  try {
    const body = await request.json();
    const { action, data } = body as { action: Action; data?: Record<string, unknown> };
    const client = getSolIncinerator();

    if (action === "status") {
      return NextResponse.json(await client.status());
    }

    if (!data?.userPublicKey) {
      return jsonError("userPublicKey is required", 400);
    }
    if (!isValidSolanaAddress(data.userPublicKey)) {
      return jsonError("Invalid userPublicKey address", 400);
    }

    const pk = data.userPublicKey as string;
    const asset = data.assetId as string | undefined;

    if (ACTIONS_NEEDING_ASSET.has(action) && !asset) {
      return jsonError(`assetId is required for ${action}`, 400);
    }

    switch (action) {
      case "burn":
        return NextResponse.json(
          await client.burn({
            userPublicKey: pk,
            assetId: asset!,
            feePayer: data.feePayer as string | undefined,
            autoCloseTokenAccounts: data.autoCloseTokenAccounts as boolean | undefined,
            priorityFeeMicroLamports: data.priorityFeeMicroLamports as number | undefined,
            burnAmount: data.burnAmount as number | undefined,
          })
        );

      case "close":
        return NextResponse.json(
          await client.close({
            userPublicKey: pk,
            assetId: asset!,
            feePayer: data.feePayer as string | undefined,
            priorityFeeMicroLamports: data.priorityFeeMicroLamports as number | undefined,
          })
        );

      case "batch-close-all":
        return NextResponse.json(
          await client.batchCloseAll({
            userPublicKey: pk,
            feePayer: data.feePayer as string | undefined,
            priorityFeeMicroLamports: data.priorityFeeMicroLamports as number | undefined,
          })
        );

      case "burn-preview":
        return NextResponse.json(
          await client.burnPreview({
            userPublicKey: pk,
            assetId: asset!,
            autoCloseTokenAccounts: data.autoCloseTokenAccounts as boolean | undefined,
            burnAmount: data.burnAmount as number | undefined,
          })
        );

      case "close-preview":
        return NextResponse.json(await client.closePreview({ userPublicKey: pk, assetId: asset! }));

      case "batch-close-all-preview":
        return NextResponse.json(await client.batchCloseAllPreview({ userPublicKey: pk }));

      default:
        return jsonError(
          `Unknown action: ${action}. Valid: burn, close, batch-close-all, burn-preview, close-preview, batch-close-all-preview, status`,
          400
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";

    if (message.includes("SOL_INCINERATOR_API_KEY not configured")) {
      return jsonError("Sol Incinerator is not configured. API key missing.", 503);
    }

    if (
      message.includes("max usage reached") ||
      message.includes("-32429") ||
      message.includes("at capacity")
    ) {
      return jsonError(
        "Sol Incinerator's RPC is at capacity. Please try again in ~30 seconds.",
        429,
        {
          "Retry-After": "30",
        }
      );
    }

    console.error("[Sol Incinerator API]", message);
    return jsonError(message, 500);
  }
}
