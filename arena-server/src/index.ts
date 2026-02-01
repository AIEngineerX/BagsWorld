// MoltBook Arena WebSocket Server
// Real-time arena battles for AI agents
// Deploy on Railway for persistent WebSocket connections

import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { getArenaEngine } from "./arena-engine";
import {
  MatchState,
  QueuedFighter,
  ClientMessage,
  ServerMessage,
  usernameToSpriteVariant,
} from "./types";

// Configuration
const PORT = parseInt(process.env.PORT || "8080", 10);
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

// Queue of fighters waiting for a match
const queue: Map<string, QueuedFighter> = new Map();

// Active match watchers (matchId -> Set of WebSocket clients)
const matchWatchers: Map<number, Set<WebSocket>> = new Map();

// All connected clients
const clients: Set<WebSocket> = new Set();

// Next fighter ID
let nextFighterId = 1;

// Create HTTP server (required for Railway health checks)
const server = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        engine: getArenaEngine().getStatus(),
        queue: queue.size,
        clients: clients.size,
      })
    );
  } else {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("MoltBook Arena Server");
  }
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Initialize arena engine
const engine = getArenaEngine();
engine.start((state: MatchState) => {
  // Broadcast match updates to all watchers
  broadcastMatchUpdate(state);
});

console.log("[Arena Server] Engine started");

// Handle new WebSocket connections
wss.on("connection", (ws: WebSocket, req) => {
  console.log(`[Arena Server] Client connected from ${req.socket.remoteAddress}`);
  clients.add(ws);

  // Send welcome message
  sendMessage(ws, {
    type: "connected",
    data: "Welcome to MoltBook Arena!",
  });

  // Handle messages from client
  ws.on("message", (data) => {
    try {
      const message: ClientMessage = JSON.parse(data.toString());
      handleClientMessage(ws, message);
    } catch (error) {
      console.error("[Arena Server] Invalid message:", error);
      sendMessage(ws, { type: "error", error: "Invalid message format" });
    }
  });

  // Handle client disconnect
  ws.on("close", () => {
    console.log("[Arena Server] Client disconnected");
    clients.delete(ws);

    // Remove from queue if waiting
    for (const [username, fighter] of queue.entries()) {
      if (fighter.ws === ws) {
        queue.delete(username);
        console.log(`[Arena Server] ${username} removed from queue (disconnected)`);
        broadcastQueueStatus();
        break;
      }
    }

    // Remove from match watchers
    matchWatchers.forEach((watchers) => {
      watchers.delete(ws);
    });
  });

  // Handle errors
  ws.on("error", (error) => {
    console.error("[Arena Server] WebSocket error:", error);
  });

  // Send initial queue status
  sendMessage(ws, {
    type: "queue_status",
    data: { position: 0, size: queue.size },
  });
});

// Handle client messages
function handleClientMessage(ws: WebSocket, message: ClientMessage): void {
  switch (message.type) {
    case "join_queue": {
      if (!message.username) {
        sendMessage(ws, { type: "error", error: "Username required" });
        return;
      }

      const username = message.username.trim();
      const karma = message.karma || 100;

      // Check if already in queue
      if (queue.has(username)) {
        sendMessage(ws, { type: "error", error: "Already in queue" });
        return;
      }

      // Add to queue
      const fighter: QueuedFighter = {
        odid: nextFighterId++,
        username,
        karma,
        joinedAt: Date.now(),
        ws,
      };
      queue.set(username, fighter);

      console.log(
        `[Arena Server] ${username} joined queue (karma: ${karma}, queue size: ${queue.size})`
      );

      // Notify the player of their position
      sendMessage(ws, {
        type: "queue_status",
        data: { position: queue.size, size: queue.size },
      });

      // Broadcast queue update to all
      broadcastQueueStatus();

      // Check if we can start a match
      if (queue.size >= 2) {
        startMatch();
      }
      break;
    }

    case "leave_queue": {
      // Find and remove from queue
      for (const [username, fighter] of queue.entries()) {
        if (fighter.ws === ws) {
          queue.delete(username);
          console.log(`[Arena Server] ${username} left queue`);
          sendMessage(ws, { type: "queue_status", data: { position: 0, size: queue.size } });
          broadcastQueueStatus();
          break;
        }
      }
      break;
    }

    default:
      sendMessage(ws, { type: "error", error: `Unknown message type: ${message.type}` });
  }
}

// Start a match between the first two fighters in queue
function startMatch(): void {
  if (queue.size < 2) return;

  // Get first two fighters
  const fighters = Array.from(queue.values()).slice(0, 2);
  const [fighter1Data, fighter2Data] = fighters;

  // Remove from queue
  queue.delete(fighter1Data.username);
  queue.delete(fighter2Data.username);

  console.log(
    `[Arena Server] Starting match: ${fighter1Data.username} vs ${fighter2Data.username}`
  );

  // Create match in engine
  const matchState = engine.createMatch(
    { id: fighter1Data.odid, username: fighter1Data.username, karma: fighter1Data.karma },
    { id: fighter2Data.odid, username: fighter2Data.username, karma: fighter2Data.karma }
  );

  // Add both fighters as watchers
  const watchers = new Set<WebSocket>();
  watchers.add(fighter1Data.ws);
  watchers.add(fighter2Data.ws);
  matchWatchers.set(matchState.matchId, watchers);

  // Broadcast match start to ALL clients (fighters + spectators)
  const matchStartMessage: ServerMessage = {
    type: "match_start",
    data: matchState,
  };
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      sendMessage(ws, matchStartMessage);
    }
  });

  // Broadcast queue update
  broadcastQueueStatus();
}

// Broadcast match update to ALL connected clients (fighters + spectators)
function broadcastMatchUpdate(state: MatchState): void {
  const message: ServerMessage = {
    type: state.status === "completed" ? "match_end" : "match_update",
    data: state,
  };

  // Broadcast to ALL connected clients so spectators can watch
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      sendMessage(ws, message);
    }
  });

  // Clean up watchers for completed matches
  if (state.status === "completed") {
    setTimeout(() => {
      matchWatchers.delete(state.matchId);
    }, 5000);
  }
}

// Broadcast queue status to all clients
function broadcastQueueStatus(): void {
  const queueList = Array.from(queue.values()).map((f, i) => ({
    position: i + 1,
    username: f.username,
    karma: f.karma,
  }));

  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      // Find this client's position in queue
      let position = 0;
      for (const [username, fighter] of queue.entries()) {
        if (fighter.ws === ws) {
          position = Array.from(queue.keys()).indexOf(username) + 1;
          break;
        }
      }

      sendMessage(ws, {
        type: "queue_status",
        data: { position, size: queue.size, queue: queueList },
      });
    }
  });
}

// Send message to a client
function sendMessage(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

// Heartbeat to keep connections alive
setInterval(() => {
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  });
}, HEARTBEAT_INTERVAL);

// Start server
server.listen(PORT, () => {
  console.log(`[Arena Server] Listening on port ${PORT}`);
  console.log(`[Arena Server] Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[Arena Server] Shutting down...");
  engine.stop();
  wss.close();
  server.close();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[Arena Server] Interrupted, shutting down...");
  engine.stop();
  wss.close();
  server.close();
  process.exit(0);
});
