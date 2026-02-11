// Trading Diagnostics API
// Proxies GhostTrader status from ElizaOS server.
// No auth required — only returns operational metadata (no secrets).

import { NextResponse } from "next/server";

const AGENTS_API_URL = process.env.AGENTS_API_URL || "http://localhost:3001";

// ============================================================================
// HANDLER
// ============================================================================

export async function GET() {
  try {
    // Fetch all three endpoints from ElizaOS in parallel
    let ghostRaw: Record<string, unknown> | null = null;
    let ghostError: string | null = null;
    let positions: Record<string, unknown>[] = [];
    let learning: Record<string, unknown> | null = null;
    let liveScan: Record<string, unknown> | null = null;

    try {
      const [statusRes, positionsRes, learningRes, dryRunRes] = await Promise.all([
        fetch(`${AGENTS_API_URL}/api/ghost/status`, {
          signal: AbortSignal.timeout(5000),
        }),
        fetch(`${AGENTS_API_URL}/api/ghost/positions?limit=20`, {
          signal: AbortSignal.timeout(5000),
        }),
        fetch(`${AGENTS_API_URL}/api/ghost/learning`, {
          signal: AbortSignal.timeout(5000),
        }),
        fetch(`${AGENTS_API_URL}/api/ghost/dry-run`, {
          signal: AbortSignal.timeout(10000),
        }),
      ]);

      if (statusRes.ok) {
        const data = await statusRes.json();
        if (data.success) {
          ghostRaw = data;
        }
      } else {
        ghostError = `ElizaOS returned ${statusRes.status}`;
      }

      if (positionsRes.ok) {
        const data = await positionsRes.json();
        if (data.success) {
          positions = data.positions || [];
        }
      }

      if (learningRes.ok) {
        const data = await learningRes.json();
        if (data.success) {
          learning = data;
        }
      }

      if (dryRunRes.ok) {
        const data = await dryRunRes.json();
        if (data.success) {
          liveScan = data;
        }
      }
    } catch (err) {
      ghostError =
        err instanceof Error
          ? err.message.includes("abort")
            ? "Ghost Trader service is currently offline"
            : "Ghost Trader service unavailable"
          : "Failed to reach Ghost Trader";
    }

    // ========================================================================
    // BUILD RESPONSE
    // ========================================================================

    return NextResponse.json({
      timestamp: new Date().toISOString(),

      // GhostTrader — pass the full raw status so the component has
      // access to config, smartMoneyWallets, etc.
      ghostTrader: ghostRaw
        ? {
            connected: true,
            raw: ghostRaw,
          }
        : {
            connected: false,
            error: ghostError,
          },

      // Full position objects (component needs id, tokenName, entryPriceSol, etc.)
      positions,

      // Learning insights (signal performance, best/worst signals)
      learning,

      // Live scan — dry-run evaluation of current launches
      liveScan,
    });
  } catch (error) {
    console.error("[Diagnostics] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate diagnostics",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
