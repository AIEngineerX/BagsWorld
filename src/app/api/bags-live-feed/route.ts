import { NextResponse } from "next/server";
import {
  startLiveFeed,
  stopLiveFeed,
  getLiveFeedState,
  getRecentLaunches,
  getRecentTrades,
  enrichLaunchMetadata,
} from "@/lib/bags-live-feed";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "status";

  switch (action) {
    case "status": {
      const state = getLiveFeedState();
      return NextResponse.json({
        success: true,
        isRunning: state.isRunning,
        launchesFound: state.launchesFound,
        tradesFound: state.tradesFound,
        whaleAlertsFound: state.whaleAlertsFound,
        lastLaunchCheck: state.lastLaunchCheck,
        lastTradeCheck: state.lastTradeCheck,
        lastWhaleCheck: state.lastWhaleCheck,
        recentLaunchCount: state.recentLaunches.length,
        recentTradeCount: state.recentTrades.length,
        errors: state.errors.slice(-5),
        configured: !!process.env.BITQUERY_API_KEY,
      });
    }

    case "launches": {
      const count = parseInt(searchParams.get("count") || "10");
      const launches = getRecentLaunches(count);
      return NextResponse.json({
        success: true,
        count: launches.length,
        launches,
      });
    }

    case "trades": {
      const count = parseInt(searchParams.get("count") || "20");
      const trades = getRecentTrades(count);
      return NextResponse.json({
        success: true,
        count: trades.length,
        trades,
      });
    }

    case "all": {
      const state = getLiveFeedState();
      const launchCount = parseInt(searchParams.get("launches") || "10");
      const tradeCount = parseInt(searchParams.get("trades") || "20");

      return NextResponse.json({
        success: true,
        status: {
          isRunning: state.isRunning,
          launchesFound: state.launchesFound,
          tradesFound: state.tradesFound,
          whaleAlertsFound: state.whaleAlertsFound,
          configured: !!process.env.BITQUERY_API_KEY,
        },
        launches: getRecentLaunches(launchCount),
        trades: getRecentTrades(tradeCount),
      });
    }

    default:
      return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "start": {
        if (!process.env.BITQUERY_API_KEY) {
          return NextResponse.json({
            success: false,
            error: "BITQUERY_API_KEY not configured",
          }, { status: 400 });
        }
        const started = startLiveFeed();
        return NextResponse.json({
          success: started,
          message: started ? "Live feed started" : "Live feed already running or failed to start",
        });
      }

      case "stop": {
        stopLiveFeed();
        return NextResponse.json({ success: true, message: "Live feed stopped" });
      }

      case "enrich": {
        const { mint } = body;
        if (!mint) {
          return NextResponse.json({ success: false, error: "Missing mint" }, { status: 400 });
        }
        const metadata = await enrichLaunchMetadata(mint);
        return NextResponse.json({ success: !!metadata, metadata });
      }

      default:
        return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[Bags Live Feed API] Error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
