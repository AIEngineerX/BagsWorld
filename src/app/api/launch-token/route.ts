import { NextResponse } from "next/server";
import { getServerBagsApiOrNull } from "@/lib/bags-api-server";
import type { BagsApiClient } from "@/lib/bags-api";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";
import { ECOSYSTEM_CONFIG } from "@/lib/config";
import { isValidSolanaAddress, isValidBps, sanitizeString } from "@/lib/env-utils";

interface LaunchRequestBody {
  action: "create-info" | "configure-fees" | "create-launch-tx" | "lookup-wallet";
  data: {
    // For create-info
    name?: string;
    symbol?: string;
    description?: string;
    image?: string;
    twitter?: string;
    telegram?: string;
    website?: string;
    // For configure-fees
    mint?: string;
    payer?: string; // Wallet address of the payer
    feeClaimers?: Array<{
      provider: string;
      providerUsername: string;
      bps: number;
    }>;
    // For create-launch-tx (new format)
    ipfs?: string; // IPFS URL of token metadata
    tokenMint?: string; // Public key of token mint
    wallet?: string; // User's wallet public key
    initialBuyLamports?: number;
    configKey?: string; // From configure-fees step
    tipWallet?: string;
    tipLamports?: number;
    // For lookup-wallet
    provider?: string;
    username?: string;
  };
}

export async function POST(request: Request) {
  // Rate limit: 20 requests per minute (standard - allows full launch flow with retries)
  // A single launch needs: create-info + configure-fees + create-launch-tx + potential retries
  const clientIP = getClientIP(request);
  const rateLimit = await checkRateLimit(`launch:${clientIP}`, RATE_LIMITS.standard);
  if (!rateLimit.success) {
    return NextResponse.json(
      {
        error: "Too many launch requests. Please wait a moment and try again.",
        retryAfter: Math.ceil(rateLimit.resetIn / 1000),
      },
      { status: 429 }
    );
  }

  try {
    const body: LaunchRequestBody = await request.json();
    const { action, data } = body;
    const api = getServerBagsApiOrNull();

    if (!api) {
      return NextResponse.json(
        { error: "Bags API not configured. Set BAGS_API_KEY environment variable." },
        { status: 500 }
      );
    }

    switch (action) {
      case "create-info":
        return handleCreateTokenInfo(api, data);

      case "configure-fees":
        return handleConfigureFees(api, data);

      case "create-launch-tx":
        return handleCreateLaunchTx(api, data);

      case "lookup-wallet":
        return handleLookupWallet(api, data);

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Launch token API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process request" },
      { status: 500 }
    );
  }
}

async function handleCreateTokenInfo(
  api: BagsApiClient,
  data: LaunchRequestBody["data"]
): Promise<NextResponse> {
  if (!data.name || !data.symbol || !data.description) {
    return NextResponse.json(
      { error: "Missing required fields: name, symbol, description" },
      { status: 400 }
    );
  }

  try {
    // Convert base64 image to Blob if provided
    let imageBlob: Blob | undefined;
    let imageName = "token-image.png";

    if (data.image && data.image.startsWith("data:")) {
      // It's a data URL, convert to Blob
      try {
        const [header, base64Data] = data.image.split(",");
        const mimeMatch = header.match(/data:([^;]+)/);
        const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
        const extension = mimeType.split("/")[1] || "png";
        imageName = `token-image.${extension}`;

        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        imageBlob = new Blob([bytes], { type: mimeType });
      } catch {
        return NextResponse.json({ error: "Invalid base64 image data" }, { status: 400 });
      }
    } else if (data.image) {
      // It's just base64, assume PNG
      try {
        const binaryString = atob(data.image);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        imageBlob = new Blob([bytes], { type: "image/png" });
      } catch {
        return NextResponse.json({ error: "Invalid base64 image data" }, { status: 400 });
      }
    }

    const result = await api.createTokenInfo({
      name: data.name,
      symbol: data.symbol,
      description: data.description,
      imageBlob,
      imageName,
      twitter: data.twitter,
      telegram: data.telegram,
      website: data.website,
    });

    return NextResponse.json({
      success: true,
      tokenMint: result.tokenMint,
      tokenMetadata: result.tokenMetadata,
    });
  } catch (error) {
    console.error("Create token info error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create token info" },
      { status: 500 }
    );
  }
}

async function handleConfigureFees(
  api: BagsApiClient,
  data: LaunchRequestBody["data"]
): Promise<NextResponse> {
  if (!data.mint || !data.feeClaimers?.length || !data.payer) {
    return NextResponse.json(
      { error: "Missing required fields: mint, feeClaimers, payer" },
      { status: 400 }
    );
  }

  // Validate mint address
  if (!isValidSolanaAddress(data.mint)) {
    return NextResponse.json({ error: "Invalid token mint address" }, { status: 400 });
  }

  // Validate payer address
  if (!isValidSolanaAddress(data.payer)) {
    return NextResponse.json({ error: "Invalid payer wallet address" }, { status: 400 });
  }

  // Validate each fee claimer's BPS value
  for (const claimer of data.feeClaimers) {
    if (!isValidBps(claimer.bps, 1, 10000)) {
      return NextResponse.json(
        {
          error: `Invalid BPS value for ${claimer.providerUsername}: ${claimer.bps}. Must be between 1 and 10000.`,
        },
        { status: 400 }
      );
    }

    // Validate provider is a supported type (per Bags.fm API SocialProvider enum)
    const validProviders = [
      "twitter",
      "github",
      "kick",
      "moltbook",
      "tiktok",
      "instagram",
      "solana",
    ];
    if (!validProviders.includes(claimer.provider)) {
      return NextResponse.json(
        {
          error: `Invalid provider: ${claimer.provider}. Must be one of: ${validProviders.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Sanitize username
    if (!claimer.providerUsername || claimer.providerUsername.length > 100) {
      return NextResponse.json({ error: "Invalid provider username" }, { status: 400 });
    }
  }

  // Validate total bps equals exactly 100%
  const totalBps = data.feeClaimers.reduce((sum, c) => sum + c.bps, 0);
  if (totalBps !== 10000) {
    return NextResponse.json(
      {
        error: `Total fee share must equal exactly 100% (10000 bps). Currently: ${totalBps} bps (${(totalBps / 100).toFixed(1)}%)`,
      },
      { status: 400 }
    );
  }

  // Get partner config from ecosystem settings
  const partnerWallet = ECOSYSTEM_CONFIG.ecosystem.wallet;
  const partnerConfigPda = ECOSYSTEM_CONFIG.ecosystem.partnerConfigPda;

  // Debug log
  console.log("Configure fees request:", {
    mint: data.mint,
    payer: data.payer,
    partnerWallet,
    partnerConfigPda,
    feeClaimers: JSON.stringify(data.feeClaimers, null, 2),
  });

  try {
    const result = await api.createFeeShareConfig(
      data.mint,
      data.feeClaimers,
      data.payer,
      partnerWallet,
      partnerConfigPda
    );

    return NextResponse.json({
      success: true,
      configId: result.configId,
      totalBps: result.totalBps,
      needsCreation: result.needsCreation,
      transactions: result.transactions,
    });
  } catch (error) {
    console.error("Configure fees error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to configure fee sharing" },
      { status: 500 }
    );
  }
}

async function handleCreateLaunchTx(
  api: BagsApiClient,
  data: LaunchRequestBody["data"]
): Promise<NextResponse> {
  // Validate required fields for new API format
  if (!data.ipfs || !data.tokenMint || !data.wallet || !data.configKey) {
    return NextResponse.json(
      { error: "Missing required fields: ipfs, tokenMint, wallet, configKey" },
      { status: 400 }
    );
  }

  // Validate Solana addresses
  if (!isValidSolanaAddress(data.tokenMint)) {
    return NextResponse.json({ error: "Invalid token mint address" }, { status: 400 });
  }

  if (!isValidSolanaAddress(data.wallet)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  if (data.tipWallet && !isValidSolanaAddress(data.tipWallet)) {
    return NextResponse.json({ error: "Invalid tip wallet address" }, { status: 400 });
  }

  // Validate IPFS URL format
  if (!data.ipfs.startsWith("ipfs://") && !data.ipfs.startsWith("https://")) {
    return NextResponse.json({ error: "Invalid IPFS URL format" }, { status: 400 });
  }

  // Debug log the request data
  console.log("Create launch tx request:", {
    ipfs: data.ipfs,
    tokenMint: data.tokenMint,
    wallet: data.wallet,
    initialBuyLamports: data.initialBuyLamports || 0,
    configKey: data.configKey,
  });

  try {
    const result = await api.createLaunchTransaction({
      ipfs: data.ipfs,
      tokenMint: data.tokenMint,
      wallet: data.wallet,
      initialBuyLamports: data.initialBuyLamports || 0,
      configKey: data.configKey,
      tipWallet: data.tipWallet,
      tipLamports: data.tipLamports,
    });

    // result is now { transaction: string, lastValidBlockHeight?: number }
    return NextResponse.json({
      success: true,
      transaction: result.transaction, // Extract the transaction string
      lastValidBlockHeight: result.lastValidBlockHeight,
    });
  } catch (error) {
    console.error("Create launch tx error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create launch transaction" },
      { status: 500 }
    );
  }
}

async function handleLookupWallet(
  api: BagsApiClient,
  data: LaunchRequestBody["data"]
): Promise<NextResponse> {
  if (!data.provider || !data.username) {
    return NextResponse.json(
      { error: "Missing required fields: provider, username" },
      { status: 400 }
    );
  }

  try {
    const result = await api.getWalletByUsername(
      data.provider,
      data.username.replace(/@/g, "").trim()
    );

    return NextResponse.json({
      success: true,
      wallet: result.wallet,
      platformData: result.platformData,
    });
  } catch (error) {
    console.error("Lookup wallet error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to lookup wallet" },
      { status: 500 }
    );
  }
}
