import { NextResponse } from "next/server";

/**
 * Test endpoint to verify Helius RPC connectivity
 * GET - basic health check
 * POST - test sendTransaction capability (with dummy tx that will fail but shows auth works)
 */

async function testRpcMethod(rpcUrl: string, method: string, params: unknown[] = []) {
  const response = await fetch(rpcUrl, {
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
  return { status: response.status, ok: response.ok, body: text };
}

export async function GET() {
  const rpcUrl = process.env.SOLANA_RPC_URL;

  if (!rpcUrl) {
    return NextResponse.json({
      success: false,
      error: "SOLANA_RPC_URL not set",
      hint: "Add SOLANA_RPC_URL to Netlify environment variables",
    });
  }

  // Log URL format (hide key)
  const safeUrl = rpcUrl.includes("api-key=")
    ? rpcUrl.replace(/api-key=.+/, "api-key=***HIDDEN***")
    : rpcUrl.substring(0, 50) + "...";

  console.log("[test-rpc] Testing RPC URL:", safeUrl);

  try {
    // Simple health check - getHealth is a lightweight call
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getHealth",
      }),
    });

    const text = await response.text();
    console.log("[test-rpc] Response status:", response.status);
    console.log("[test-rpc] Response body:", text);

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: `RPC returned ${response.status}`,
        response: text,
        rpcUrl: safeUrl,
        hint:
          response.status === 401
            ? "API key is invalid or expired. Check your Helius dashboard."
            : "Check RPC URL format",
      });
    }

    const json = JSON.parse(text);

    if (json.error) {
      return NextResponse.json({
        success: false,
        error: json.error.message || "RPC error",
        code: json.error.code,
        rpcUrl: safeUrl,
        hint:
          json.error.code === -32401
            ? "API key is invalid. Generate a new key at dev.helius.xyz"
            : undefined,
      });
    }

    return NextResponse.json({
      success: true,
      result: json.result,
      rpcUrl: safeUrl,
      message: "Helius RPC is working!",
    });
  } catch (error) {
    console.error("[test-rpc] Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      rpcUrl: safeUrl,
    });
  }
}

// POST - Test multiple RPC methods including sendTransaction auth
export async function POST() {
  const rpcUrl = process.env.SOLANA_RPC_URL;

  if (!rpcUrl) {
    return NextResponse.json({ error: "SOLANA_RPC_URL not set" }, { status: 500 });
  }

  const safeUrl = rpcUrl.includes("api-key=")
    ? rpcUrl.replace(/api-key=.+/, "api-key=***HIDDEN***")
    : rpcUrl.substring(0, 50) + "...";

  const results: Record<string, unknown> = { rpcUrl: safeUrl };

  // Test 1: getHealth (basic)
  try {
    const health = await testRpcMethod(rpcUrl, "getHealth");
    results.getHealth = health;
  } catch (e) {
    results.getHealth = { error: String(e) };
  }

  // Test 2: getLatestBlockhash (more advanced)
  try {
    const blockhash = await testRpcMethod(rpcUrl, "getLatestBlockhash", [
      { commitment: "confirmed" },
    ]);
    results.getLatestBlockhash = blockhash;
  } catch (e) {
    results.getLatestBlockhash = { error: String(e) };
  }

  // Test 3: sendTransaction with invalid tx (should fail with tx error, NOT 401)
  // A proper 401 here means auth issue, other errors mean auth is working
  try {
    const dummyTx =
      "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const send = await testRpcMethod(rpcUrl, "sendTransaction", [dummyTx, { encoding: "base64" }]);
    results.sendTransaction = send;

    // Parse the response to check error type
    try {
      const parsed = JSON.parse(send.body);
      if (parsed.error?.code === -32401) {
        results.sendTransactionAuth = "FAILED - 401 Unauthorized";
      } else if (parsed.error) {
        results.sendTransactionAuth = "OK - Got transaction error (expected), auth works";
      } else {
        results.sendTransactionAuth = "OK - No error";
      }
    } catch {
      results.sendTransactionAuth = "Could not parse response";
    }
  } catch (e) {
    results.sendTransaction = { error: String(e) };
  }

  return NextResponse.json(results);
}
