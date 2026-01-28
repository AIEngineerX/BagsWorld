/**
 * WorldSyncService - WebSocket bridge between Phaser game and agent server
 *
 * This service maintains bidirectional communication:
 * - Receives world state updates from the game (character positions, zone, events)
 * - Sends agent commands back to the game (movement, speech, zone transitions)
 *
 * Based on eliza-town's architecture for autonomous agent control.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type {
  ZoneType,
  AgentWorldState,
  GameCommand,
  WorldStateUpdate,
} from '../types/elizaos.js';

// Zone walking boundaries (pixels, based on BagsWorld's coordinate system)
const ZONE_BOUNDS: Record<ZoneType, { minX: number; maxX: number; walkY: number }> = {
  main_city: { minX: 80, maxX: 720, walkY: 555 },
  trending: { minX: 80, maxX: 720, walkY: 555 },
  labs: { minX: 80, maxX: 720, walkY: 555 },
  founders: { minX: 80, maxX: 720, walkY: 555 },
  ballers: { minX: 80, maxX: 720, walkY: 555 },
};

// Distance threshold for "nearby" agents (pixels)
const NEARBY_DISTANCE = 150;

export class WorldSyncService {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private worldState: WorldStateUpdate | null = null;
  private agentStates: Map<string, AgentWorldState> = new Map();
  private commandQueue: GameCommand[] = [];
  private isInitialized = false;

  /**
   * Initialize the WebSocket server attached to an HTTP server
   */
  initialize(server: Server): void {
    if (this.isInitialized) {
      console.warn('[WorldSync] Already initialized');
      return;
    }

    this.wss = new WebSocketServer({
      server,
      path: '/ws',
    });

    this.wss.on('connection', (ws: WebSocket, request) => {
      const clientIp = request.socket.remoteAddress || 'unknown';
      console.log(`[WorldSync] Client connected from ${clientIp}`);
      this.clients.add(ws);

      // Send any queued commands to new client
      this.flushCommandQueue(ws);

      ws.on('message', (data: Buffer) => {
        this.handleMessage(data, ws);
      });

      ws.on('close', (code: number, reason: Buffer) => {
        console.log(`[WorldSync] Client disconnected: ${code} - ${reason.toString()}`);
        this.clients.delete(ws);
      });

      ws.on('error', (error: Error) => {
        console.error('[WorldSync] WebSocket error:', error.message);
        this.clients.delete(ws);
      });

      // Send ping every 30 seconds to keep connection alive
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        } else {
          clearInterval(pingInterval);
        }
      }, 30000);

      ws.on('close', () => clearInterval(pingInterval));
    });

    this.wss.on('error', (error: Error) => {
      console.error('[WorldSync] Server error:', error.message);
    });

    this.isInitialized = true;
    console.log('[WorldSync] WebSocket server initialized on /ws');
  }

  /**
   * Handle incoming messages from game clients
   */
  private handleMessage(data: Buffer, ws: WebSocket): void {
    let message: unknown;

    try {
      message = JSON.parse(data.toString());
    } catch {
      console.error('[WorldSync] Failed to parse message:', data.toString().slice(0, 100));
      return;
    }

    if (!message || typeof message !== 'object') {
      return;
    }

    const msg = message as Record<string, unknown>;

    switch (msg.type) {
      case 'world-state-update':
        this.processWorldStateUpdate(msg as unknown as WorldStateUpdate);
        break;

      case 'character-click':
        // Player clicked on a character - could trigger interaction
        this.handleCharacterClick(msg as { characterId: string; playerId?: string });
        break;

      case 'zone-change':
        // Player changed zones
        this.handleZoneChange(msg as { zone: ZoneType });
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
    }
  }

  /**
   * Process world state updates from the game
   */
  private processWorldStateUpdate(update: WorldStateUpdate): void {
    this.worldState = update;

    // Update individual agent states
    for (const [agentId, charState] of Object.entries(update.characters)) {
      const existingState = this.agentStates.get(agentId);

      // Calculate nearby agents
      const nearbyAgents = this.calculateNearbyAgents(agentId, charState.x, charState.y, update.characters);

      const newState: AgentWorldState = {
        id: agentId,
        position: {
          x: charState.x,
          y: charState.y,
          zone: update.zone as ZoneType,
        },
        isMoving: charState.isMoving,
        nearbyAgents,
        currentActivity: existingState?.currentActivity,
        lastConversation: existingState?.lastConversation,
        lastActivity: existingState?.lastActivity,
      };

      this.agentStates.set(agentId, newState);
    }
  }

  /**
   * Calculate which agents are nearby a given position
   */
  private calculateNearbyAgents(
    agentId: string,
    x: number,
    y: number,
    characters: Record<string, { x: number; y: number; isMoving: boolean }>
  ): string[] {
    const nearby: string[] = [];

    for (const [otherId, otherState] of Object.entries(characters)) {
      if (otherId === agentId) continue;

      const dx = otherState.x - x;
      const dy = otherState.y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < NEARBY_DISTANCE) {
        nearby.push(otherId);
      }
    }

    return nearby;
  }

  /**
   * Handle player clicking on a character
   */
  private handleCharacterClick(data: { characterId: string; playerId?: string }): void {
    // This could trigger the character to react or start a conversation
    console.log(`[WorldSync] Character clicked: ${data.characterId}`);
  }

  /**
   * Handle zone change events
   */
  private handleZoneChange(data: { zone: ZoneType }): void {
    console.log(`[WorldSync] Zone changed to: ${data.zone}`);
  }

  /**
   * Send a command to all connected game clients
   */
  sendCommand(command: GameCommand): void {
    const data = JSON.stringify(command);

    let sent = false;
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
        sent = true;
      }
    }

    // Queue command if no clients connected
    if (!sent) {
      this.commandQueue.push(command);
      // Limit queue size
      if (this.commandQueue.length > 100) {
        this.commandQueue.shift();
      }
    }
  }

  /**
   * Send queued commands to a newly connected client
   */
  private flushCommandQueue(ws: WebSocket): void {
    while (this.commandQueue.length > 0) {
      const command = this.commandQueue.shift();
      if (command && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(command));
      }
    }
  }

  /**
   * Send movement command for an agent
   */
  sendMove(agentId: string, x: number, y: number): void {
    this.sendCommand({
      type: 'character-behavior',
      characterId: agentId,
      action: 'moveTo',
      target: { type: 'position', x, y },
    });
  }

  /**
   * Send movement command to approach another agent
   */
  sendApproach(agentId: string, targetAgentId: string): void {
    this.sendCommand({
      type: 'character-behavior',
      characterId: agentId,
      action: 'moveTo',
      target: { type: 'character', id: targetAgentId },
    });
  }

  /**
   * Send speech command for an agent
   */
  sendSpeak(agentId: string, message: string, emotion: string = 'neutral'): void {
    this.sendCommand({
      type: 'character-speak',
      characterId: agentId,
      message,
      emotion,
    });
  }

  /**
   * Request zone transition for an agent
   */
  sendZoneTransition(agentId: string, zone: ZoneType): void {
    this.sendCommand({
      type: 'zone-transition',
      characterId: agentId,
      target: { type: 'position', x: 0, y: 0, id: zone },
    });
  }

  /**
   * Get the current world state
   */
  getWorldState(): WorldStateUpdate | null {
    return this.worldState;
  }

  /**
   * Get state for a specific agent
   */
  getAgentState(agentId: string): AgentWorldState | null {
    return this.agentStates.get(agentId) || null;
  }

  /**
   * Get all agent states
   */
  getAllAgentStates(): Map<string, AgentWorldState> {
    return this.agentStates;
  }

  /**
   * Update activity state for an agent
   */
  updateAgentActivity(
    agentId: string,
    activity: { description: string; emoji: string; until: number } | undefined
  ): void {
    const state = this.agentStates.get(agentId);
    if (state) {
      state.currentActivity = activity;
      if (activity) {
        state.lastActivity = Date.now();
      }
    }
  }

  /**
   * Record that an agent finished a conversation
   */
  recordConversationEnd(agentId: string): void {
    const state = this.agentStates.get(agentId);
    if (state) {
      state.lastConversation = Date.now();
    }
  }

  /**
   * Get a random wander destination within a zone
   */
  getWanderDestination(zone: ZoneType): { x: number; y: number } {
    const bounds = ZONE_BOUNDS[zone] || ZONE_BOUNDS.main_city;
    return {
      x: bounds.minX + Math.floor(Math.random() * (bounds.maxX - bounds.minX)),
      y: bounds.walkY,
    };
  }

  /**
   * Get current zone from world state
   */
  getCurrentZone(): ZoneType {
    return (this.worldState?.zone as ZoneType) || 'main_city';
  }

  /**
   * Get current weather from world state
   */
  getCurrentWeather(): string {
    return this.worldState?.weather || 'cloudy';
  }

  /**
   * Get current world health from world state
   */
  getCurrentHealth(): number {
    return this.worldState?.health || 50;
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Check if service is connected to any game clients
   */
  isConnected(): boolean {
    return this.clients.size > 0;
  }

  /**
   * Register an agent with initial state
   */
  registerAgent(agentId: string, zone: ZoneType = 'main_city'): void {
    const bounds = ZONE_BOUNDS[zone];
    const initialX = bounds.minX + Math.floor(Math.random() * (bounds.maxX - bounds.minX));

    this.agentStates.set(agentId, {
      id: agentId,
      position: { x: initialX, y: bounds.walkY, zone },
      isMoving: false,
      nearbyAgents: [],
    });
  }

  /**
   * Shutdown the WebSocket server
   */
  async shutdown(): Promise<void> {
    if (this.wss) {
      for (const client of this.clients) {
        client.close(1000, 'Server shutting down');
      }
      this.clients.clear();

      await new Promise<void>((resolve) => {
        this.wss!.close(() => resolve());
      });

      this.wss = null;
      this.isInitialized = false;
      console.log('[WorldSync] WebSocket server shut down');
    }
  }
}

// Singleton instance
let instance: WorldSyncService | null = null;

export function getWorldSyncService(): WorldSyncService {
  if (!instance) {
    instance = new WorldSyncService();
  }
  return instance;
}

export function resetWorldSyncService(): void {
  if (instance) {
    instance.shutdown();
    instance = null;
  }
}

export default WorldSyncService;
