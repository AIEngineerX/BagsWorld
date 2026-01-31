// Custom Next.js Server with WebSocket Support for Arena
// Run with: npx ts-node --project tsconfig.server.json server.ts
// Or for development: npm run dev:ws
//
// NOTE: This server is for local development and non-serverless deployments.
// For Netlify/Vercel, use the polling fallback API routes instead.

import { createServer, IncomingMessage } from "http";
import { parse } from "url";
import next from "next";
import WebSocket from "ws";
import { startArenaEngine, stopArenaEngine, getArenaEngine } from "./src/lib/arena-engine";

// Type alias for WebSocket data
type RawData = WebSocket.Data;
import { startArenaMonitor, stopArenaMonitor } from "./src/lib/arena-moltbook-monitor";
import { getQueueStatus } from "./src/lib/arena-matchmaking";
import type { MatchState, ArenaWSMessage } from "./src/lib/arena-types";
import {
  startMoltbookAutonomous,
  stopMoltbookAutonomous,
  getMoltbookAutonomousStatus,
} from "./src/lib/moltbook-autonomous";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Track connected WebSocket clients
interface ArenaClient {
  ws: WebSocket;
  watchingMatchId?: number;
  watchingQueue: boolean;
  connectedAt: number;
}

const clients: Set<ArenaClient> = new Set();

// Heartbeat interval for connection health
const HEARTBEAT_INTERVAL = 30000;

app.prepare().then(() => {
  // Create HTTP server
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error handling request:", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  // Create WebSocket server on /api/arena-ws path
  const wss = new WebSocket.Server({
    server,
    path: "/api/arena-ws",
  });

  console.log(`[WebSocket] Server initialized on /api/arena-ws`);

  // Handle new WebSocket connections
  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    const client: ArenaClient = {
      ws,
      watchingQueue: false,
      connectedAt: Date.now(),
    };
    clients.add(client);

    console.log(`[WebSocket] Client connected (total: ${clients.size})`);

    // Send initial state
    const engine = getArenaEngine();
    const queueStatus = await getQueueStatus();
    const initialMessage: ArenaWSMessage = {
      type: "connected",
      data: {
        activeMatches: engine.getActiveMatches(),
        queueSize: queueStatus.size,
      },
    };
    ws.send(JSON.stringify(initialMessage));

    // Handle incoming messages
    ws.on("message", async (rawData: RawData) => {
      try {
        const message = JSON.parse(rawData.toString());
        await handleClientMessage(client, message);
      } catch (error) {
        console.error("[WebSocket] Error parsing message:", error);
        sendError(ws, "Invalid message format");
      }
    });

    // Handle disconnection
    ws.on("close", () => {
      clients.delete(client);
      console.log(`[WebSocket] Client disconnected (remaining: ${clients.size})`);
    });

    // Handle errors
    ws.on("error", (error: Error) => {
      console.error("[WebSocket] Client error:", error);
      clients.delete(client);
    });

    // Set up ping/pong for connection health
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, HEARTBEAT_INTERVAL);

    ws.on("close", () => clearInterval(pingInterval));
  });

  // Handle client messages
  async function handleClientMessage(
    client: ArenaClient,
    message: { type: string; matchId?: number }
  ): Promise<void> {
    switch (message.type) {
      case "watch_match":
        if (typeof message.matchId === "number") {
          client.watchingMatchId = message.matchId;
          client.watchingQueue = false;

          // Send current match state immediately
          const engine = getArenaEngine();
          const state = engine.getMatchState(message.matchId);
          if (state) {
            const response: ArenaWSMessage = {
              type: "match_state",
              data: state,
            };
            client.ws.send(JSON.stringify(response));
          } else {
            sendError(client.ws, `Match ${message.matchId} not found or not active`);
          }
        }
        break;

      case "watch_queue":
        client.watchingMatchId = undefined;
        client.watchingQueue = true;

        // Send queue status and active matches
        const engine = getArenaEngine();
        const queueStatus = await getQueueStatus();
        const response: ArenaWSMessage = {
          type: "active_matches",
          data: engine.getActiveMatches(),
        };
        client.ws.send(JSON.stringify(response));

        const queueResponse: ArenaWSMessage = {
          type: "queue_update",
          data: queueStatus.fighters.map((f) => ({
            id: 0,
            fighter_id: f.fighterId,
            moltbook_post_id: "",
            queued_at: new Date(Date.now() - f.waitSeconds * 1000).toISOString(),
          })),
        };
        client.ws.send(JSON.stringify(queueResponse));
        break;

      case "unwatch":
        client.watchingMatchId = undefined;
        client.watchingQueue = false;
        break;

      default:
        sendError(client.ws, `Unknown message type: ${message.type}`);
    }
  }

  // Send error message to client
  function sendError(ws: WebSocket, error: string): void {
    if (ws.readyState === WebSocket.OPEN) {
      const message: ArenaWSMessage = {
        type: "error",
        error,
      };
      ws.send(JSON.stringify(message));
    }
  }

  // Broadcast match update to relevant clients
  function broadcastMatchUpdate(state: MatchState): void {
    const message: ArenaWSMessage = {
      type: "match_update",
      data: state,
    };
    const messageStr = JSON.stringify(message);

    clients.forEach((client) => {
      if (client.ws.readyState !== WebSocket.OPEN) return;

      // Send to clients watching this specific match
      if (client.watchingMatchId === state.matchId) {
        client.ws.send(messageStr);
      }

      // Send to clients watching all matches (queue view)
      if (client.watchingQueue) {
        client.ws.send(messageStr);
      }
    });
  }

  // Broadcast queue update to relevant clients
  async function broadcastQueueUpdate(): Promise<void> {
    const queueStatus = await getQueueStatus();
    const engine = getArenaEngine();

    const queueMessage: ArenaWSMessage = {
      type: "queue_update",
      data: queueStatus.fighters.map((f) => ({
        id: 0,
        fighter_id: f.fighterId,
        moltbook_post_id: "",
        queued_at: new Date(Date.now() - f.waitSeconds * 1000).toISOString(),
      })),
    };

    const activeMessage: ArenaWSMessage = {
      type: "active_matches",
      data: engine.getActiveMatches(),
    };

    const queueStr = JSON.stringify(queueMessage);
    const activeStr = JSON.stringify(activeMessage);

    clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN && client.watchingQueue) {
        client.ws.send(queueStr);
        client.ws.send(activeStr);
      }
    });
  }

  // Start Arena Engine with broadcast callback
  const engine = startArenaEngine((state: MatchState) => {
    broadcastMatchUpdate(state);
  });

  // Start MoltBook monitor with match created callback
  startArenaMonitor(async (matchId: number) => {
    console.log(`[Arena] New match created: ${matchId}`);
    await engine.addMatch(matchId);
    await broadcastQueueUpdate();
  });

  // Start Bagsy's MoltBook autonomous posting service
  startMoltbookAutonomous();
  const moltbookStatus = getMoltbookAutonomousStatus();
  if (moltbookStatus.moltbookConfigured) {
    console.log(`> Bagsy MoltBook autonomous posting: ENABLED`);
  } else {
    console.log(`> Bagsy MoltBook: NOT CONFIGURED (set MOLTBOOK_API_KEY)`);
  }

  // Periodic queue broadcast (every 5 seconds)
  setInterval(broadcastQueueUpdate, 5000);

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("[Server] Shutting down...");
    stopArenaEngine();
    stopArenaMonitor();
    stopMoltbookAutonomous();

    clients.forEach((client) => {
      client.ws.close(1001, "Server shutting down");
    });

    server.close(() => {
      console.log("[Server] Shut down complete");
      process.exit(0);
    });
  });

  // Start server
  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Arena WebSocket on ws://${hostname}:${port}/api/arena-ws`);
    console.log(`> MoltBook Arena monitoring m/bagsworld-arena`);
    console.log(`> Bagsy status: GET /api/bagsy`);
  });
});
