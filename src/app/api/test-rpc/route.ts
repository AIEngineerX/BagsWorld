import { NextResponse } from "next/server";

/**
 * Test endpoint to verify Helius RPC connectivity
 */
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
        hint: response.status === 401
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
        hint: json.error.code === -32401
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
