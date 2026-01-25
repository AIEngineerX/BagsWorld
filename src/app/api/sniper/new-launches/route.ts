import { NextResponse } from "next/server";
import type { SniperNewLaunch } from "@/lib/types";
import { BAGS_UPDATE_AUTHORITY, METEORA_DBC_PROGRAM } from "@/lib/types";

const BITQUERY_WS_URL = "wss://streaming.bitquery.io/eap";
const BITQUERY_GRAPHQL_URL = "https://streaming.bitquery.io/graphql";

// Store recent launches to avoid duplicates
const recentLaunches = new Map<string, SniperNewLaunch>();
const MAX_RECENT_LAUNCHES = 100;

// Polling-based approach for SSE since Next.js edge functions don't support long-lived WebSockets
// We'll poll Bitquery for recent token creation events
async function fetchRecentLaunches(): Promise<SniperNewLaunch[]> {
  const apiKey = process.env.BITQUERY_API_KEY;

  if (!apiKey) {
    return [];
  }

  // Query for recent token creation events on Meteora DBC with Bags UpdateAuthority
  // This looks for initialize_virtual_pool instructions
  const query = `
    query GetRecentBagsLaunches {
      Solana {
        Instructions(
          where: {
            Instruction: {
              Program: {
                Address: { is: "${METEORA_DBC_PROGRAM}" }
                Method: { includes: "initialize" }
              }
            }
            Block: {
              Time: { after: "${new Date(Date.now() - 60 * 60 * 1000).toISOString()}" }
            }
          }
          orderBy: { descending: Block_Time }
          limit: { count: 50 }
        ) {
          Transaction {
            Signature
            Signer
          }
          Block {
            Time
            Slot
          }
          Instruction {
            Program {
              Address
              Method
            }
            Accounts {
              Address
              IsWritable
              Token {
                Mint
                Owner
                ProgramId
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch(BITQUERY_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    console.error("Bitquery API error:", response.status);
    return [];
  }

  const result = await response.json();

  if (result.errors) {
    console.error("Bitquery GraphQL errors:", result.errors);
    return [];
  }

  const instructions = result.data?.Solana?.Instructions || [];
  const launches: SniperNewLaunch[] = [];
  const now = Date.now();

  for (const instruction of instructions) {
    // Find the token mint from the accounts
    const tokenAccount = instruction.Instruction.Accounts?.find(
      (acc: { Token?: { Mint?: string } }) => acc.Token?.Mint
    );

    if (!tokenAccount?.Token?.Mint) continue;

    const mint = tokenAccount.Token.Mint;

    // Skip if we've already seen this mint
    if (recentLaunches.has(mint)) continue;

    const blockTime = new Date(instruction.Block.Time).getTime();
    const ageSeconds = Math.floor((now - blockTime) / 1000);

    const launch: SniperNewLaunch = {
      mint,
      name: "New Token", // Would need separate metadata fetch
      symbol: "???",
      imageUrl: `https://img.bags.fm/cdn-cgi/image/width=64,quality=75/${mint}`,
      createdAt: blockTime,
      ageSeconds,
      initialPrice: 0,
      currentPrice: 0,
      priceChange: 0,
      liquidity: 0,
      creator: instruction.Transaction.Signer,
      signature: instruction.Transaction.Signature,
    };

    launches.push(launch);

    // Cache to avoid duplicates
    recentLaunches.set(mint, launch);

    // Prune old entries
    if (recentLaunches.size > MAX_RECENT_LAUNCHES) {
      const oldest = Array.from(recentLaunches.keys())[0];
      recentLaunches.delete(oldest);
    }
  }

  return launches;
}

// Fetch token metadata from Bags.fm or on-chain
async function enrichLaunchWithMetadata(launch: SniperNewLaunch): Promise<SniperNewLaunch> {
  // Try to get metadata from Bags API
  const bagsApiKey = process.env.BAGS_API_KEY;

  if (bagsApiKey) {
    const bagsApiUrl = process.env.BAGS_API_URL || "https://public-api-v2.bags.fm/api/v1";

    const response = await fetch(`${bagsApiUrl}/token-launch/creator/v3?mint=${launch.mint}`, {
      headers: { "x-api-key": bagsApiKey },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.response) {
        const tokenData = data.response;
        return {
          ...launch,
          name: tokenData.name || launch.name,
          symbol: tokenData.symbol || launch.symbol,
          imageUrl: tokenData.imageUrl || launch.imageUrl,
        };
      }
    }
  }

  return launch;
}

// SSE endpoint for real-time new launch notifications
export async function GET(request: Request) {
  const encoder = new TextEncoder();

  // Check for SSE request
  const acceptHeader = request.headers.get("accept");
  const isSSE = acceptHeader?.includes("text/event-stream");

  if (!isSSE) {
    // Regular GET request - return recent launches
    const launches = await fetchRecentLaunches();

    // Enrich with metadata (limit to avoid rate limiting)
    const enrichedLaunches = await Promise.all(
      launches.slice(0, 10).map(enrichLaunchWithMetadata)
    );

    return NextResponse.json({
      success: true,
      launches: enrichedLaunches,
      total: launches.length,
    });
  }

  // SSE stream for real-time updates
  const stream = new ReadableStream({
    async start(controller) {
      let lastCheckTime = Date.now();
      let isControllerClosed = false;

      // Send initial connection message
      const connectMsg = `data: ${JSON.stringify({ type: "connected", timestamp: Date.now() })}\n\n`;
      controller.enqueue(encoder.encode(connectMsg));

      // Poll for new launches every 5 seconds
      const pollInterval = setInterval(async () => {
        if (isControllerClosed) {
          clearInterval(pollInterval);
          return;
        }

        const launches = await fetchRecentLaunches();

        // Filter to only new launches since last check
        const newLaunches = launches.filter((l) => l.createdAt > lastCheckTime);

        for (const launch of newLaunches) {
          const enriched = await enrichLaunchWithMetadata(launch);
          const msg = `data: ${JSON.stringify({ type: "new_launch", launch: enriched })}\n\n`;

          controller.enqueue(encoder.encode(msg));
        }

        if (newLaunches.length > 0) {
          lastCheckTime = Math.max(...newLaunches.map((l) => l.createdAt));
        }

        // Send heartbeat to keep connection alive
        const heartbeat = `data: ${JSON.stringify({ type: "heartbeat", timestamp: Date.now() })}\n\n`;
        controller.enqueue(encoder.encode(heartbeat));
      }, 5000);

      // Handle client disconnect
      request.signal.addEventListener("abort", () => {
        isControllerClosed = true;
        clearInterval(pollInterval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
