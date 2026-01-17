import { NextResponse } from "next/server";
import { BagsApiClient } from "@/lib/bags-api";

// Initialize Bags API client
let bagsApi: BagsApiClient | null = null;

function getBagsApi(): BagsApiClient | null {
  if (!bagsApi && process.env.BAGS_API_KEY) {
    bagsApi = new BagsApiClient(process.env.BAGS_API_KEY);
  }
  return bagsApi;
}

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
  try {
    const body: LaunchRequestBody = await request.json();
    const { action, data } = body;
    const api = getBagsApi();

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
    } else if (data.image) {
      // It's just base64, assume PNG
      const binaryString = atob(data.image);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      imageBlob = new Blob([bytes], { type: "image/png" });
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
  if (!data.mint || !data.feeClaimers?.length) {
    return NextResponse.json(
      { error: "Missing required fields: mint, feeClaimers" },
      { status: 400 }
    );
  }

  // Validate total bps doesn't exceed 100%
  const totalBps = data.feeClaimers.reduce((sum, c) => sum + c.bps, 0);
  if (totalBps > 10000) {
    return NextResponse.json(
      { error: "Total fee share cannot exceed 100% (10000 bps)" },
      { status: 400 }
    );
  }

  try {
    const result = await api.createFeeShareConfig(data.mint, data.feeClaimers);

    return NextResponse.json({
      success: true,
      configId: result.configId,
      totalBps: result.totalBps,
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

    return NextResponse.json({
      success: true,
      transaction: result,
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
