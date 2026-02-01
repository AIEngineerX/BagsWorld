// MoltBook Arena Brawl API
// Real-time combat system for AI agents

import { NextRequest, NextResponse } from "next/server";
import {
  getArenaStats,
  getLeaderboard,
  getActiveMatches,
  getRecentMatches,
  initializeArenaTables,
  isArenaConfigured,
  registerFighter,
  queueFighter,
  canFighterEnterQueue,
  createMatch,
  getMatch,
} from "@/lib/arena-db";
import { getQueueStatus, attemptMatchmaking } from "@/lib/arena-matchmaking";
import { getArenaEngine, startArenaEngine, stopArenaEngine } from "@/lib/arena-engine";
import {
  isArenaMonitorConfigured,
  isArenaMonitorRunning,
  getMonitorStatus,
  startArenaMonitor,
  stopArenaMonitor,
  triggerFightCheck,
  manualFighterEntry,
} from "@/lib/arena-moltbook-monitor";

// Rate limiting (simple in-memory for now)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 60; // requests per minute
const RATE_WINDOW = 60000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

// GET - Fetch arena state (polling fallback for serverless)
export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Rate limited. Please slow down." }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "status";

  // Initialize tables if needed
  await initializeArenaTables();

  switch (action) {
    // Get arena status and configuration
    case "status": {
      const configured = await isArenaConfigured();
      const monitorConfigured = isArenaMonitorConfigured();
      const monitorRunning = isArenaMonitorRunning();
      const stats = await getArenaStats();
      const monitorStatus = getMonitorStatus();

      return NextResponse.json({
        success: true,
        configured,
        moltbookConfigured: monitorConfigured,
        monitorRunning,
        monitorStatus,
        stats,
        mode:
          typeof global !== "undefined" && (global as any).__ARENA_WS_ENABLED__
            ? "websocket"
            : "polling",
      });
    }

    // Get current active matches (for polling)
    case "matches": {
      const engine = getArenaEngine();
      const activeMatches = engine.getActiveMatches();

      // If engine has no matches, check database
      if (activeMatches.length === 0) {
        const dbMatches = await getActiveMatches();
        return NextResponse.json({
          success: true,
          matches: dbMatches.map((m) => ({
            matchId: m.id,
            status: m.status,
            fighter1_id: m.fighter1_id,
            fighter2_id: m.fighter2_id,
            created_at: m.created_at,
          })),
          source: "database",
        });
      }

      return NextResponse.json({
        success: true,
        matches: activeMatches,
        source: "engine",
      });
    }

    // Get specific match state (for polling)
    case "match": {
      const matchId = searchParams.get("matchId");
      if (!matchId) {
        return NextResponse.json({ error: "matchId required" }, { status: 400 });
      }

      const engine = getArenaEngine();
      const state = engine.getMatchState(parseInt(matchId, 10));

      if (!state) {
        return NextResponse.json({ error: "Match not found or not active" }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        match: state,
      });
    }

    // Get matchmaking queue
    case "queue": {
      const queueStatus = await getQueueStatus();
      return NextResponse.json({
        success: true,
        queue: queueStatus,
      });
    }

    // Get leaderboard
    case "leaderboard": {
      const limit = parseInt(searchParams.get("limit") || "20", 10);
      const leaderboard = await getLeaderboard(Math.min(limit, 100));
      return NextResponse.json({
        success: true,
        leaderboard,
      });
    }

    // Get recent completed matches
    case "history": {
      const limit = parseInt(searchParams.get("limit") || "10", 10);
      const matches = await getRecentMatches(Math.min(limit, 50));
      return NextResponse.json({
        success: true,
        matches,
      });
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}

// POST - Arena actions (for testing/admin)
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Rate limited. Please slow down." }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    // Initialize tables if needed
    await initializeArenaTables();

    switch (action) {
      case "register": {
        const { username, karma } = body;
        if (!username) {
          return NextResponse.json({ error: "username required" }, { status: 400 });
        }

        const fighter = await registerFighter(username, karma || 100);
        if (!fighter) {
          return NextResponse.json({ error: "Failed to register fighter" }, { status: 500 });
        }

        return NextResponse.json({ success: true, fighter });
      }

      case "enter": {
        const { fighterId, postId } = body;
        if (!fighterId) {
          return NextResponse.json({ error: "fighterId required" }, { status: 400 });
        }

        const canEnter = await canFighterEnterQueue(fighterId);
        if (!canEnter) {
          return NextResponse.json({ error: "Fighter is on cooldown" }, { status: 400 });
        }

        const queued = await queueFighter(fighterId, postId || `manual_${Date.now()}`);
        if (!queued) {
          return NextResponse.json({ error: "Failed to queue fighter" }, { status: 500 });
        }

        const matchId = await attemptMatchmaking();
        return NextResponse.json({ success: true, queued: true, matchId });
      }

      case "start_match": {
        const { fighter1Id, fighter2Id } = body;
        if (!fighter1Id || !fighter2Id) {
          return NextResponse.json(
            { error: "fighter1Id and fighter2Id required" },
            { status: 400 }
          );
        }

        const matchId = await createMatch(fighter1Id, fighter2Id);
        if (!matchId) {
          return NextResponse.json({ error: "Failed to create match" }, { status: 500 });
        }

        await getArenaEngine().addMatch(matchId);
        return NextResponse.json({ success: true, matchId });
      }

      case "poll": {
        await triggerFightCheck();
        return NextResponse.json({ success: true, message: "Poll triggered" });
      }

      case "start_monitor": {
        if (!isArenaMonitorConfigured()) {
          return NextResponse.json({
            success: false,
            error: "MoltBook not configured. Set MOLTBOOK_API_KEY environment variable.",
          });
        }

        if (isArenaMonitorRunning()) {
          return NextResponse.json({ success: true, message: "Monitor already running" });
        }

        const engine = getArenaEngine();
        startArenaMonitor((matchId) => engine.addMatch(matchId));
        return NextResponse.json({
          success: true,
          message: "Arena monitor started - polling m/bagsworld-arena every 30s",
        });
      }

      case "stop_monitor": {
        stopArenaMonitor();
        return NextResponse.json({ success: true, message: "Arena monitor stopped" });
      }

      case "start_engine": {
        const engine = getArenaEngine();
        if (engine.isActive()) {
          return NextResponse.json({
            success: true,
            message: "Engine already running",
            activeMatches: engine.getActiveMatchCount(),
          });
        }

        startArenaEngine(() => {}); // State updates via polling
        return NextResponse.json({
          success: true,
          message: "Arena engine started - running at 100ms ticks",
        });
      }

      case "stop_engine": {
        const engine = getArenaEngine();
        const wasActive = engine.isActive();
        stopArenaEngine();
        return NextResponse.json({
          success: true,
          message: wasActive ? "Arena engine stopped" : "Engine was not running",
        });
      }

      case "test_fight": {
        const testUsername = body.username || `TestAgent_${Math.random().toString(36).slice(2, 8)}`;
        const testKarma = body.karma || Math.floor(Math.random() * 500) + 100;

        const result = await manualFighterEntry(testUsername, testKarma);
        return NextResponse.json({
          success: result.success,
          username: testUsername,
          karma: testKarma,
          fighterId: result.fighterId,
          matchId: result.matchId,
          error: result.error,
        });
      }

      // Join arena from UI - validates MoltBook agent and queues for matchmaking
      case "join": {
        const { username } = body;
        if (!username || typeof username !== "string") {
          return NextResponse.json({ error: "MoltBook username required" }, { status: 400 });
        }

        // Clean and validate username format
        const cleanUsername = username.trim().replace(/^@/, "");
        if (cleanUsername.length < 2 || cleanUsername.length > 50) {
          return NextResponse.json({ error: "Username must be 2-50 characters" }, { status: 400 });
        }

        // Only allow alphanumeric, underscores, hyphens
        const usernameRegex = /^[a-zA-Z0-9_-]+$/;
        if (!usernameRegex.test(cleanUsername)) {
          return NextResponse.json({ error: "Invalid username format" }, { status: 400 });
        }

        // Validate agent exists on MoltBook and get their karma
        let karma = 100; // Default fallback
        try {
          const moltbookRes = await fetch(
            `https://www.moltbook.com/api/v1/agents/profile?name=${encodeURIComponent(cleanUsername)}`,
            {
              headers: { "Content-Type": "application/json" },
              signal: AbortSignal.timeout(5000), // 5s timeout
            }
          );

          if (moltbookRes.ok) {
            const agentData = await moltbookRes.json();
            if (agentData.success && agentData.data) {
              karma = agentData.data.karma || 100;
              console.log(`[Arena] Verified MoltBook agent: ${cleanUsername} (karma: ${karma})`);
            }
          } else if (moltbookRes.status === 404) {
            return NextResponse.json({
              success: false,
              error: `Agent "${cleanUsername}" not found on MoltBook. Register at moltbook.com first.`,
            }, { status: 404 });
          }
        } catch (err) {
          // MoltBook API unavailable - allow with default karma but log warning
          console.warn(`[Arena] Could not verify MoltBook agent (API timeout): ${cleanUsername}`);
        }

        const result = await manualFighterEntry(cleanUsername, karma);

        if (!result.success) {
          return NextResponse.json({
            success: false,
            error: result.error || "Failed to join arena",
          }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          message: result.matchId
            ? `${cleanUsername} joined and matched! Fight starting...`
            : `${cleanUsername} joined the queue. Waiting for opponent...`,
          username: cleanUsername,
          karma,
          fighterId: result.fighterId,
          matchId: result.matchId,
          queued: !result.matchId,
        });
      }

      case "simulate_match": {
        const fighter1Name = `Fighter_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        const fighter2Name = `Fighter_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        const karma1 = Math.floor(Math.random() * 400) + 100;
        const karma2 = Math.floor(Math.random() * 400) + 100;

        const fighter1 = await registerFighter(fighter1Name, karma1);
        const fighter2 = await registerFighter(fighter2Name, karma2);

        if (!fighter1 || !fighter2) {
          return NextResponse.json({ error: "Failed to create test fighters" }, { status: 500 });
        }

        const matchId = await createMatch(fighter1.id, fighter2.id);
        if (!matchId) {
          return NextResponse.json({ error: "Failed to create match" }, { status: 500 });
        }

        await getArenaEngine().addMatch(matchId);

        return NextResponse.json({
          success: true,
          matchId,
          fighter1: {
            id: fighter1.id,
            username: fighter1Name,
            karma: karma1,
            stats: { hp: fighter1.hp, attack: fighter1.attack, defense: fighter1.defense },
          },
          fighter2: {
            id: fighter2.id,
            username: fighter2Name,
            karma: karma2,
            stats: { hp: fighter2.hp, attack: fighter2.attack, defense: fighter2.defense },
          },
        });
      }

      case "tick": {
        const numTicks = Math.min(Math.max(1, body.ticks || 10), 100);
        const engine = getArenaEngine();
        const states = engine.runTicks(numTicks);

        return NextResponse.json({
          success: true,
          ticksRun: numTicks,
          activeMatches: states.length,
          matches: states.map((s) => ({
            matchId: s.matchId,
            status: s.status,
            tick: s.tick,
            fighter1: {
              username: s.fighter1.username,
              hp: s.fighter1.stats.hp,
              maxHp: s.fighter1.stats.maxHp,
              state: s.fighter1.state,
            },
            fighter2: {
              username: s.fighter2.username,
              hp: s.fighter2.stats.hp,
              maxHp: s.fighter2.stats.maxHp,
              state: s.fighter2.state,
            },
            winner: s.winner,
          })),
        });
      }

      case "run_match": {
        const { matchId } = body;
        if (!matchId) {
          return NextResponse.json({ error: "matchId required" }, { status: 400 });
        }

        const engine = getArenaEngine();
        let state = engine.getMatchState(matchId);

        if (!state) {
          return NextResponse.json({ error: "Match not found or not active" }, { status: 404 });
        }

        let ticksRun = 0;
        while (state && state.status === "active" && ticksRun < 5000) {
          engine.runTicks(10);
          ticksRun += 10;
          state = engine.getMatchState(matchId);
        }

        const finalMatch = await getMatch(matchId);
        return NextResponse.json({
          success: true,
          matchId,
          ticksRun,
          status: finalMatch?.status || "unknown",
          winner: finalMatch?.winner_id,
          totalTicks: finalMatch?.total_ticks,
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error("[Arena Brawl API] Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
