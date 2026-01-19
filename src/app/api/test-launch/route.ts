import { NextResponse } from "next/server";

/**
 * MINIMAL TEST LAUNCH API
 *
 * This follows the Bags API docs exactly with maximum logging.
 * No ecosystem fees, no complexity - just the bare minimum.
 */

const BAGS_API_URL = process.env.BAGS_API_URL || "https://public-api-v2.bags.fm/api/v1";
const BAGS_API_KEY = process.env.BAGS_API_KEY;

// Generate a simple default image (1x1 pixel PNG - green)
function generateDefaultImage(): Blob {
  // Minimal 1x1 green PNG
  const pngData = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 pixels
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
    0x54, 0x08, 0xd7, 0x63, 0x28, 0xcf, 0x28, 0x00,
    0x00, 0x00, 0x8d, 0x00, 0x45, 0xb5, 0xb5, 0x59,
    0x32, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
    0x44, 0xae, 0x42, 0x60, 0x82, // IEND chunk
  ]);
  return new Blob([pngData], { type: "image/png" });
}

// Simple fetch wrapper with full logging
async function bagsApiFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${BAGS_API_URL}${endpoint}`;
  console.log(`[TEST-API] Calling: ${options.method || "GET"} ${url}`);
  if (options.body && typeof options.body === "string") {
    console.log(`[TEST-API] Body:`, options.body);
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      "x-api-key": BAGS_API_KEY || "",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const text = await response.text();
  console.log(`[TEST-API] Response status: ${response.status}`);
  console.log(`[TEST-API] Response body: ${text.substring(0, 2000)}`);

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response (${response.status}): ${text.substring(0, 500)}`);
  }

  if (!response.ok) {
    // Extract detailed error message
    const errorMsg = json.error || json.message || json.response ||
      (typeof json === "string" ? json : null) ||
      `API error ${response.status}`;
    console.error(`[TEST-API] Error details:`, JSON.stringify(json, null, 2));
    throw new Error(`Bags API error (${response.status}): ${errorMsg}`);
  }

  if (json.success === false) {
    const errorMsg = json.error || json.message || json.response || "Unknown error";
    console.error(`[TEST-API] API returned success=false:`, JSON.stringify(json, null, 2));
    throw new Error(`Bags API failed: ${errorMsg}`);
  }

  // Return the response field if it exists, otherwise the whole json
  return json.response !== undefined ? json.response : json;
}

export async function POST(request: Request) {
  console.log("[TEST-API] ========== TEST LAUNCH REQUEST ==========");

  if (!BAGS_API_KEY) {
    return NextResponse.json({ error: "BAGS_API_KEY not configured" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { action } = body;
    console.log(`[TEST-API] Action: ${action}`);
    console.log(`[TEST-API] Body:`, JSON.stringify(body, null, 2));

    switch (action) {
      case "create-info": {
        // Step 1: Create token metadata with image
        const { name, symbol, description, imageDataUrl } = body;

        if (!name || !symbol || !description) {
          return NextResponse.json({ error: "Missing name, symbol, or description" }, { status: 400 });
        }

        // Use FormData for token info (matches working implementation)
        const formData = new FormData();
        formData.append("name", name);
        formData.append("symbol", symbol);
        formData.append("description", description);

        // Add image - either from user upload or generate default
        if (imageDataUrl && imageDataUrl.startsWith("data:")) {
          // Convert data URL to Blob
          const [header, base64Data] = imageDataUrl.split(",");
          const mimeMatch = header.match(/data:([^;]+)/);
          const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const imageBlob = new Blob([bytes], { type: mimeType });
          formData.append("image", imageBlob, "token-image.png");
          console.log(`[TEST-API] Using uploaded image, size: ${imageBlob.size} bytes`);
        } else {
          // Generate a default image
          const defaultImage = generateDefaultImage();
          formData.append("image", defaultImage, "token-image.png");
          console.log(`[TEST-API] Using default image, size: ${defaultImage.size} bytes`);
        }

        const url = `${BAGS_API_URL}/token-launch/create-token-info`;
        console.log(`[TEST-API] Calling: POST ${url} (FormData with image)`);

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "x-api-key": BAGS_API_KEY,
            // Don't set Content-Type for FormData - browser sets it with boundary
          },
          body: formData,
        });

        const text = await response.text();
        console.log(`[TEST-API] create-token-info status: ${response.status}`);
        console.log(`[TEST-API] create-token-info response: ${text}`);

        let json;
        try {
          json = JSON.parse(text);
        } catch {
          throw new Error(`Invalid JSON: ${text.substring(0, 200)}`);
        }

        if (!response.ok || json.success === false) {
          throw new Error(json.error || json.response || `API error ${response.status}`);
        }

        const result = json.response || json;
        console.log("[TEST-API] create-token-info result:", result);

        if (!result.tokenMint || !result.tokenMetadata) {
          throw new Error(`Missing tokenMint or tokenMetadata in response: ${JSON.stringify(result)}`);
        }

        return NextResponse.json({
          tokenMint: result.tokenMint,
          tokenMetadata: result.tokenMetadata,
        });
      }

      case "configure-fees": {
        // Step 2: Configure fee sharing with a single claimer
        const { mint, payer, twitterUsername } = body;

        if (!mint || !payer || !twitterUsername) {
          return NextResponse.json({ error: "Missing mint, payer, or twitterUsername" }, { status: 400 });
        }

        // First, lookup the wallet for the Twitter username
        console.log(`[TEST-API] Looking up wallet for twitter/${twitterUsername}`);

        let walletResult;
        try {
          walletResult = await bagsApiFetch(
            `/token-launch/fee-share/wallet/v2?provider=twitter&username=${encodeURIComponent(twitterUsername)}`
          );
          console.log("[TEST-API] Wallet lookup result:", walletResult);
        } catch (walletError) {
          console.error("[TEST-API] Wallet lookup failed:", walletError);
          return NextResponse.json({
            error: `Wallet lookup failed for @${twitterUsername}: ${walletError instanceof Error ? walletError.message : walletError}`,
            step: "wallet-lookup",
          }, { status: 500 });
        }

        if (!walletResult?.wallet) {
          return NextResponse.json({
            error: `Could not find wallet for twitter user: @${twitterUsername}. Make sure you've linked your wallet at bags.fm/settings`,
            step: "wallet-lookup",
          }, { status: 400 });
        }

        const wallet = walletResult.wallet;
        console.log(`[TEST-API] Found wallet: ${wallet}`);

        // Create fee config with 100% to this wallet (10000 bps = 100%)
        const feeConfigBody = {
          baseMint: mint,
          payer,
          claimersArray: [wallet],
          basisPointsArray: [10000], // 100% to single claimer
        };

        console.log("[TEST-API] Fee config request:", JSON.stringify(feeConfigBody, null, 2));

        let feeResult;
        try {
          feeResult = await bagsApiFetch("/fee-share/config", {
            method: "POST",
            body: JSON.stringify(feeConfigBody),
          });
        } catch (feeError) {
          console.error("[TEST-API] Fee config failed:", feeError);
          return NextResponse.json({
            error: `Fee config failed: ${feeError instanceof Error ? feeError.message : feeError}`,
            step: "fee-config",
            request: feeConfigBody,
          }, { status: 500 });
        }

        console.log("[TEST-API] Fee config result:", JSON.stringify(feeResult, null, 2));
        console.log("[TEST-API] Fee config result type:", typeof feeResult);
        console.log("[TEST-API] Fee config result keys:", Object.keys(feeResult || {}));

        // Extract configKey - try multiple possible field names
        const configKey =
          feeResult?.meteoraConfigKey ||
          feeResult?.configKey ||
          feeResult?.configId ||
          feeResult?.config_key ||
          feeResult?.config ||
          feeResult?.key ||
          (typeof feeResult === "string" ? feeResult : null);

        console.log("[TEST-API] Extracted configKey:", configKey);

        if (!configKey) {
          console.error("[TEST-API] Could not extract configKey from:", feeResult);
          return NextResponse.json({
            error: `Fee config created but no configKey found. Response: ${JSON.stringify(feeResult)}`,
            debug: feeResult,
          }, { status: 500 });
        }

        return NextResponse.json({
          configKey,
          needsCreation: feeResult?.needsCreation,
          transactions: feeResult?.transactions,
          debug: { wallet, feeResult },
        });
      }

      case "create-launch-tx": {
        // Step 3: Create the launch transaction
        // Note: SDK uses metadataUrl and launchWallet, but API may accept ipfs and wallet
        const { ipfs, tokenMint, wallet, configKey, initialBuyLamports = 0 } = body;

        if (!ipfs || !tokenMint || !wallet || !configKey) {
          return NextResponse.json({
            error: "Missing required fields",
            required: { ipfs: !!ipfs, tokenMint: !!tokenMint, wallet: !!wallet, configKey: !!configKey },
          }, { status: 400 });
        }

        // Bags API uses ipfs and wallet (not metadataUrl/launchWallet)
        const launchBody = {
          ipfs,
          tokenMint,
          wallet,
          configKey,
          initialBuyLamports,
        };

        console.log("[TEST-API] Launch tx request:", JSON.stringify(launchBody, null, 2));

        const launchResult = await bagsApiFetch("/token-launch/create-launch-transaction", {
          method: "POST",
          body: JSON.stringify(launchBody),
        });

        console.log("[TEST-API] Launch tx result type:", typeof launchResult);
        console.log("[TEST-API] Launch tx result:", typeof launchResult === "string" ? launchResult.substring(0, 200) : JSON.stringify(launchResult));

        // Extract transaction - could be string or object
        let transaction: string;
        if (typeof launchResult === "string") {
          transaction = launchResult;
        } else if (launchResult?.transaction) {
          transaction = launchResult.transaction;
        } else {
          console.error("[TEST-API] Unexpected launch result format:", launchResult);
          return NextResponse.json({
            error: "No transaction in launch response",
            debug: launchResult,
          }, { status: 500 });
        }

        console.log("[TEST-API] Transaction type:", typeof transaction);
        console.log("[TEST-API] Transaction length:", transaction?.length);
        console.log("[TEST-API] Transaction preview:", transaction?.substring(0, 100));

        if (!transaction || transaction.length < 100) {
          return NextResponse.json({
            error: `Transaction too short or empty (length: ${transaction?.length})`,
            debug: { transaction: transaction?.substring(0, 500), launchResult },
          }, { status: 500 });
        }

        return NextResponse.json({
          transaction,
          lastValidBlockHeight: launchResult?.lastValidBlockHeight,
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error("[TEST-API] Error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
