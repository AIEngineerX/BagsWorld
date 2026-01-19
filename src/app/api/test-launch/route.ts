import { NextResponse } from "next/server";

/**
 * MINIMAL TEST LAUNCH API
 *
 * This follows the Bags API docs exactly with maximum logging.
 * No ecosystem fees, no complexity - just the bare minimum.
 */

const BAGS_API_URL = process.env.BAGS_API_URL || "https://public-api-v2.bags.fm/api/v1";
const BAGS_API_KEY = process.env.BAGS_API_KEY;

// Simple fetch wrapper with full logging
async function bagsApiFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${BAGS_API_URL}${endpoint}`;
  console.log(`[TEST-API] Calling: ${options.method || "GET"} ${url}`);
  console.log(`[TEST-API] Body:`, options.body);

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
  console.log(`[TEST-API] Response body: ${text}`);

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response: ${text.substring(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(json.error || json.response || `API error ${response.status}`);
  }

  if (json.success === false) {
    throw new Error(json.error || json.response || "API returned success: false");
  }

  // Return the response field if it exists, otherwise the whole json
  return json.response !== undefined ? json.response : json;
}

// FormData fetch for image upload
async function bagsApiFormData(endpoint: string, formData: FormData) {
  const url = `${BAGS_API_URL}${endpoint}`;
  console.log(`[TEST-API] Calling: POST ${url} (FormData)`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "x-api-key": BAGS_API_KEY || "",
      // Don't set Content-Type for FormData
    },
    body: formData,
  });

  const text = await response.text();
  console.log(`[TEST-API] Response status: ${response.status}`);
  console.log(`[TEST-API] Response body: ${text}`);

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response: ${text.substring(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(json.error || json.response || `API error ${response.status}`);
  }

  if (json.success === false) {
    throw new Error(json.error || json.response || "API returned success: false");
  }

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
        // Step 1: Create token metadata
        const { name, symbol, description } = body;

        if (!name || !symbol || !description) {
          return NextResponse.json({ error: "Missing name, symbol, or description" }, { status: 400 });
        }

        // Use FormData for token info (as per Bags docs)
        const formData = new FormData();
        formData.append("name", name);
        formData.append("symbol", symbol);
        formData.append("description", description);
        // Note: No image for test - Bags API may generate a default

        const result = await bagsApiFormData("/token-launch/create-token-info", formData);

        console.log("[TEST-API] create-token-info result:", result);

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

        const walletResult = await bagsApiFetch(
          `/token-launch/fee-share/wallet/v2?provider=twitter&username=${encodeURIComponent(twitterUsername)}`
        );

        console.log("[TEST-API] Wallet lookup result:", walletResult);

        if (!walletResult.wallet) {
          throw new Error(`Could not find wallet for twitter user: ${twitterUsername}. Link your wallet at bags.fm/settings`);
        }

        const wallet = walletResult.wallet;
        console.log(`[TEST-API] Found wallet: ${wallet}`);

        // Create fee config with 100% to this wallet
        const feeConfigBody = {
          baseMint: mint,
          payer,
          claimersArray: [wallet],
          basisPointsArray: [10000], // 100% to single claimer
        };

        console.log("[TEST-API] Fee config request:", JSON.stringify(feeConfigBody, null, 2));

        const feeResult = await bagsApiFetch("/fee-share/config", {
          method: "POST",
          body: JSON.stringify(feeConfigBody),
        });

        console.log("[TEST-API] Fee config result:", JSON.stringify(feeResult, null, 2));
        console.log("[TEST-API] Fee config result keys:", Object.keys(feeResult));

        // Extract configKey - try multiple possible field names
        const configKey =
          feeResult.meteoraConfigKey ||
          feeResult.configKey ||
          feeResult.configId ||
          feeResult.config_key ||
          feeResult.config ||
          feeResult.key ||
          (typeof feeResult === "string" ? feeResult : null);

        console.log("[TEST-API] Extracted configKey:", configKey);

        if (!configKey) {
          console.error("[TEST-API] Could not extract configKey from:", feeResult);
          return NextResponse.json({
            error: `Fee config created but no configKey found. Response keys: ${Object.keys(feeResult).join(", ")}`,
            debug: feeResult,
          }, { status: 500 });
        }

        return NextResponse.json({
          configKey,
          needsCreation: feeResult.needsCreation,
          transactions: feeResult.transactions,
          debug: { wallet, feeResult },
        });
      }

      case "create-launch-tx": {
        // Step 3: Create the launch transaction
        const { ipfs, tokenMint, wallet, configKey, initialBuyLamports = 0 } = body;

        if (!ipfs || !tokenMint || !wallet || !configKey) {
          return NextResponse.json({
            error: "Missing required fields",
            required: { ipfs, tokenMint, wallet, configKey },
          }, { status: 400 });
        }

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
        console.log("[TEST-API] Launch tx result:", launchResult);

        // Extract transaction - could be string or object
        let transaction: string;
        if (typeof launchResult === "string") {
          transaction = launchResult;
        } else if (launchResult.transaction) {
          transaction = launchResult.transaction;
        } else {
          console.error("[TEST-API] Unexpected launch result format:", launchResult);
          return NextResponse.json({
            error: "No transaction in launch response",
            debug: launchResult,
          }, { status: 500 });
        }

        console.log("[TEST-API] Transaction length:", transaction.length);
        console.log("[TEST-API] Transaction preview:", transaction.substring(0, 100));

        if (transaction.length < 100) {
          return NextResponse.json({
            error: `Transaction too short (${transaction.length} chars)`,
            debug: { transaction, launchResult },
          }, { status: 500 });
        }

        return NextResponse.json({
          transaction,
          lastValidBlockHeight: launchResult.lastValidBlockHeight,
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
