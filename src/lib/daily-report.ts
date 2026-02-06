// Daily Report Generator for BagsWorld
// Generates performance reports for top runners (earners)

import { BagsApiClient } from "./bags-api";
import { getXClient } from "./x-client";
import type { FeeEarner, GameBuilding } from "./types";
import { getRecentEvents } from "./agent-coordinator";

export interface DailyReportData {
  date: string;
  topRunners: Array<{
    rank: number;
    username: string;
    provider: string;
    earnings: number;
    tokenCount: number;
  }>;
  ecosystemStats: {
    totalTokens: number;
    totalFees: number;
    totalClaims: number;
    activeRunners: number;
  };
  activityStats: {
    arenaBattles: number;
    casinoPrizes: number;
    oracleRounds: number;
    feeClaims: number;
    tokenLaunches: number;
  };
  topToken: {
    symbol: string;
    fees: number;
    creator: string;
  } | null;
}

export interface ReportResult {
  success: boolean;
  report?: DailyReportData;
  tweets?: string[];
  tweetIds?: string[];
  error?: string;
}

// Fetch data for the daily report
async function fetchReportData(): Promise<DailyReportData> {
  const api = new BagsApiClient(process.env.BAGS_API_KEY || "");

  // We'll pull data from our world-state which aggregates everything
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/world-state`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokens: [] }), // Empty to get base state
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch world state");
  }

  const worldState = await response.json();

  // Gather coordinator event counts for the last 24 hours
  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
  const arenaBattles = getRecentEvents(100, "arena_victory").filter(
    (e) => e.timestamp > twentyFourHoursAgo
  ).length;
  const casinoPrizes = getRecentEvents(100, "casino_win").filter(
    (e) => e.timestamp > twentyFourHoursAgo
  ).length;
  const oracleRounds = getRecentEvents(100, "oracle_settle").filter(
    (e) => e.timestamp > twentyFourHoursAgo
  ).length;
  const feeClaims = getRecentEvents(100, "fee_claim").filter(
    (e) => e.timestamp > twentyFourHoursAgo
  ).length;
  const tokenLaunches = getRecentEvents(100, "token_launch").filter(
    (e) => e.timestamp > twentyFourHoursAgo
  ).length;

  // Extract top runners (fee earners) - filter out the guide characters
  const runners = (worldState.population || [])
    .filter((p: any) => !p.isToly && !p.isAsh && !p.isFinn && !p.isDev)
    .sort(
      (a: any, b: any) =>
        (b.lifetimeEarnings || b.earnings24h || 0) - (a.lifetimeEarnings || a.earnings24h || 0)
    )
    .slice(0, 10)
    .map((runner: any, index: number) => ({
      rank: index + 1,
      username: runner.providerUsername || runner.username,
      provider: runner.provider || "solana",
      earnings: runner.lifetimeEarnings || runner.earnings24h || 0,
      tokenCount: 1, // Default
    }));

  // Extract building/token stats
  const buildings: GameBuilding[] = worldState.buildings || [];
  const totalFees = buildings.reduce((sum, b) => sum + (b.marketCap || 0) / 100, 0); // Rough estimate

  // Find top token by market cap (proxy for fees)
  const topBuilding = buildings
    .filter((b) => b.symbol !== "BAGS" && b.symbol !== "WORLD") // Exclude permanent
    .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))[0];

  const topToken = topBuilding
    ? {
        symbol: topBuilding.symbol,
        fees: (topBuilding.marketCap || 0) / 100,
        creator: topBuilding.ownerId || "unknown",
      }
    : null;

  return {
    date: new Date().toISOString().split("T")[0],
    topRunners: runners,
    ecosystemStats: {
      totalTokens: buildings.filter((b) => b.symbol !== "BAGS" && b.symbol !== "WORLD").length,
      totalFees: totalFees,
      totalClaims: feeClaims,
      activeRunners: runners.length,
    },
    activityStats: {
      arenaBattles,
      casinoPrizes,
      oracleRounds,
      feeClaims,
      tokenLaunches,
    },
    topToken,
  };
}

// Format SOL amount
function formatSol(lamports: number): string {
  if (lamports >= 1_000_000_000) {
    return `${(lamports / 1_000_000_000).toFixed(2)} SOL`;
  }
  if (lamports >= 1_000_000) {
    return `${(lamports / 1_000_000).toFixed(2)}M`;
  }
  if (lamports >= 1_000) {
    return `${(lamports / 1_000).toFixed(2)}K`;
  }
  return lamports.toFixed(2);
}

// Generate the report text - strong, no emojis
function generateReportText(data: DailyReportData): string[] {
  const tweets: string[] = [];
  const date = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Main report tweet
  let mainTweet = `BAGSWORLD DAILY REPORT | ${date}\n\n`;

  if (data.topRunners.length > 0) {
    mainTweet += `TOP RUNNERS:\n`;
    data.topRunners.slice(0, 5).forEach((runner) => {
      const handle = runner.provider === "twitter" ? `@${runner.username}` : runner.username;
      mainTweet += `${runner.rank}. ${handle}\n`;
    });
  } else {
    mainTweet += `No active runners today.\n`;
  }

  mainTweet += `\nbagsworld.netlify.app`;
  tweets.push(mainTweet);

  // Stats tweet (as reply)
  if (data.ecosystemStats.totalTokens > 0 || data.topToken) {
    let statsTweet = `ECOSYSTEM STATS:\n\n`;
    statsTweet += `Active Tokens: ${data.ecosystemStats.totalTokens}\n`;
    statsTweet += `Active Runners: ${data.ecosystemStats.activeRunners}\n`;

    // Add 24h activity summary from coordinator events
    const { arenaBattles, casinoPrizes, oracleRounds, feeClaims, tokenLaunches } =
      data.activityStats;
    const activityParts: string[] = [];
    if (arenaBattles > 0) activityParts.push(`${arenaBattles} battles`);
    if (feeClaims > 0) activityParts.push(`${feeClaims} claims`);
    if (tokenLaunches > 0) activityParts.push(`${tokenLaunches} launches`);
    if (casinoPrizes > 0) activityParts.push(`${casinoPrizes} raffles`);
    if (oracleRounds > 0) activityParts.push(`${oracleRounds} predictions`);

    if (activityParts.length > 0) {
      statsTweet += `24h Activity: ${activityParts.join(" | ")}\n`;
    }

    if (data.topToken) {
      statsTweet += `\nTop Performer: $${data.topToken.symbol}`;
    }

    tweets.push(statsTweet);
  }

  return tweets;
}

// Generate and optionally post the daily report
export async function generateDailyReport(postToX: boolean = false): Promise<ReportResult> {
  try {
    // Fetch data
    const data = await fetchReportData();

    // Generate tweet text
    const tweets = generateReportText(data);

    // Post to X if requested
    let tweetIds: string[] = [];
    if (postToX) {
      const xClient = getXClient();

      if (!xClient.isConfigured()) {
        return {
          success: false,
          report: data,
          tweets,
          error: "X API not configured",
        };
      }

      const results = await xClient.postThread(tweets);
      tweetIds = results.filter((r) => r.success && r.tweetId).map((r) => r.tweetId!);

      const failedCount = results.filter((r) => !r.success).length;
      if (failedCount === results.length) {
        return {
          success: false,
          report: data,
          tweets,
          error: results[0]?.error || "Failed to post to X",
        };
      }
    }

    return {
      success: true,
      report: data,
      tweets,
      tweetIds,
    };
  } catch (error: any) {
    console.error("Daily report error:", error);
    return {
      success: false,
      error: error.message || "Failed to generate report",
    };
  }
}

// Generate a simple text report (for testing/preview)
export async function generateReportPreview(): Promise<string> {
  try {
    const data = await fetchReportData();
    const tweets = generateReportText(data);
    return tweets.join("\n\n---\n\n");
  } catch (error: any) {
    return `Error generating report: ${error.message}`;
  }
}
