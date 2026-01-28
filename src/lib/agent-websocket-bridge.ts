/**
 * AgentWebSocketBridge - Client-side WebSocket bridge to eliza-agents server
 *
 * Connects the Phaser game to the autonomous agent system:
 * - Receives commands from agents and dispatches them as CustomEvents
 * - Sends world state updates to the agent server
 * - Handles reconnection with exponential backoff
 */

import type { WorldState, GameCharacter, ZoneType } from "./types";

// Message types from agent server
interface CharacterBehaviorCommand {
  type: "character-behavior";
  characterId: string;
  action: string;
  target?: {
    type: "position" | "character" | "building";
    x?: number;
    y?: number;
    id?: string;
  };
}

interface CharacterSpeakCommand {
  type: "character-speak";
  characterId: string;
  message: string;
  emotion?: string;
}

interface ZoneTransitionCommand {
  type: "zone-transition";
  characterId: string;
  target: {
    type: "position";
    id: ZoneType;
  };
}

type AgentCommand = CharacterBehaviorCommand | CharacterSpeakCommand | ZoneTransitionCommand;

interface WorldStateUpdateMessage {
  type: "world-state-update";
  timestamp: number;
  zone: ZoneType;
  characters: Record<
    string,
    {
      x: number;
      y: number;
      isMoving: boolean;
    }
  >;
  weather?: string;
  health?: number;
}

// Connection state
type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

// Bridge singleton
let instance: AgentWebSocketBridge | null = null;

export class AgentWebSocketBridge {
  private ws: WebSocket | null = null;
  private url: string;
  private state: ConnectionState = "disconnected";
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private lastWorldState: WorldState | null = null;
  private worldStateThrottleTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly worldStateThrottleMs = 500; // Send at most every 500ms
  private characterPositions: Map<string, { x: number; y: number }> = new Map();
  private currentZone: ZoneType = "main_city";

  constructor(url?: string) {
    // Default to localhost agent server or use environment variable
    const agentServerUrl =
      url ||
      (typeof window !== "undefined" && (window as unknown as { AGENT_WS_URL?: string }).AGENT_WS_URL) ||
      (process.env.NEXT_PUBLIC_AGENT_WS_URL as string | undefined) ||
      "ws://localhost:3001/ws";

    // Ensure we use ws:// or wss:// protocol
    if (agentServerUrl.startsWith("http://")) {
      this.url = agentServerUrl.replace("http://", "ws://");
    } else if (agentServerUrl.startsWith("https://")) {
      this.url = agentServerUrl.replace("https://", "wss://");
    } else if (!agentServerUrl.startsWith("ws://") && !agentServerUrl.startsWith("wss://")) {
      this.url = `ws://${agentServerUrl}`;
    } else {
      this.url = agentServerUrl;
    }
  }

  /**
   * Connect to the agent server
   */
  connect(): void {
    if (this.state === "connecting" || this.state === "connected") {
      return;
    }

    this.state = "connecting";
    console.log(`[AgentBridge] Connecting to ${this.url}...`);

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.state = "connected";
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      console.log("[AgentBridge] Connected to agent server");

      // Start ping interval to keep connection alive
      this.startPingInterval();

      // Dispatch connection event
      window.dispatchEvent(
        new CustomEvent("bagsworld-agent-connection", {
          detail: { connected: true },
        })
      );

      // Send current world state if we have it
      if (this.lastWorldState) {
        this.sendWorldStateUpdate(this.lastWorldState, this.characterPositions);
      }
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.ws.onclose = (event) => {
      this.state = "disconnected";
      this.stopPingInterval();
      console.log(`[AgentBridge] Disconnected: ${event.code} - ${event.reason}`);

      // Dispatch disconnection event
      window.dispatchEvent(
        new CustomEvent("bagsworld-agent-connection", {
          detail: { connected: false },
        })
      );

      // Attempt reconnection
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      this.state = "error";
      console.error("[AgentBridge] WebSocket error:", error);
    };
  }

  /**
   * Disconnect from the agent server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopPingInterval();

    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }

    this.state = "disconnected";
  }

  /**
   * Handle incoming messages from agent server
   */
  private handleMessage(data: string): void {
    let message: AgentCommand;

    try {
      message = JSON.parse(data);
    } catch {
      console.error("[AgentBridge] Failed to parse message:", data.slice(0, 100));
      return;
    }

    switch (message.type) {
      case "character-behavior":
        this.dispatchBehaviorCommand(message);
        break;

      case "character-speak":
        this.dispatchSpeakCommand(message);
        break;

      case "zone-transition":
        this.dispatchZoneTransition(message);
        break;

      default:
        // Handle pong or unknown messages
        break;
    }
  }

  /**
   * Dispatch behavior command as CustomEvent
   */
  private dispatchBehaviorCommand(command: CharacterBehaviorCommand): void {
    window.dispatchEvent(
      new CustomEvent("bagsworld-character-behavior", {
        detail: {
          characterId: command.characterId,
          action: command.action,
          target: command.target,
        },
      })
    );
  }

  /**
   * Dispatch speak command as CustomEvent
   */
  private dispatchSpeakCommand(command: CharacterSpeakCommand): void {
    window.dispatchEvent(
      new CustomEvent("bagsworld-character-speak", {
        detail: {
          characterId: command.characterId,
          message: command.message,
          emotion: command.emotion || "neutral",
        },
      })
    );
  }

  /**
   * Dispatch zone transition as CustomEvent
   */
  private dispatchZoneTransition(command: ZoneTransitionCommand): void {
    // Trigger zone change for the character
    window.dispatchEvent(
      new CustomEvent("bagsworld-zone-change", {
        detail: {
          zone: command.target.id,
          characterId: command.characterId,
        },
      })
    );
  }

  /**
   * Send world state update to agent server (throttled)
   */
  sendWorldStateUpdate(
    worldState: WorldState,
    characterPositions: Map<string, { x: number; y: number }>,
    zone?: ZoneType
  ): void {
    this.lastWorldState = worldState;
    this.characterPositions = characterPositions;
    if (zone) {
      this.currentZone = zone;
    }

    // Throttle updates
    if (this.worldStateThrottleTimer) {
      return;
    }

    this.worldStateThrottleTimer = setTimeout(() => {
      this.worldStateThrottleTimer = null;
      this.doSendWorldState();
    }, this.worldStateThrottleMs);
  }

  /**
   * Actually send the world state
   */
  private doSendWorldState(): void {
    if (!this.ws || this.state !== "connected" || !this.lastWorldState) {
      return;
    }

    // Build character positions from the map
    const characters: Record<string, { x: number; y: number; isMoving: boolean }> = {};

    for (const [id, pos] of this.characterPositions) {
      characters[id] = {
        x: pos.x,
        y: pos.y,
        isMoving: false, // Will be updated by game
      };
    }

    const message: WorldStateUpdateMessage = {
      type: "world-state-update",
      timestamp: Date.now(),
      zone: this.currentZone,
      characters,
      weather: this.lastWorldState.weather,
      health: this.lastWorldState.health,
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Update a single character's position (called from game update loop)
   */
  updateCharacterPosition(characterId: string, x: number, y: number, isMoving: boolean): void {
    this.characterPositions.set(characterId, { x, y });

    // The next throttled update will include this
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("[AgentBridge] Max reconnect attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);

    console.log(`[AgentBridge] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Start ping interval
   */
  private startPingInterval(): void {
    this.stopPingInterval();

    this.pingInterval = setInterval(() => {
      if (this.ws && this.state === "connected") {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 25000);
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === "connected";
  }
}

/**
 * Get the singleton bridge instance
 */
export function getAgentBridge(): AgentWebSocketBridge {
  if (!instance) {
    instance = new AgentWebSocketBridge();
  }
  return instance;
}

/**
 * Initialize and connect the bridge
 */
export function initAgentBridge(url?: string): AgentWebSocketBridge {
  if (instance) {
    instance.disconnect();
  }

  instance = new AgentWebSocketBridge(url);
  instance.connect();

  return instance;
}

/**
 * Disconnect and clean up
 */
export function disconnectAgentBridge(): void {
  if (instance) {
    instance.disconnect();
    instance = null;
  }
}

export default AgentWebSocketBridge;
