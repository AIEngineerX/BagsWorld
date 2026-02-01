// WorldSyncService - WebSocket bridge between Phaser game and agent server

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
  labs: { minX: 80, maxX: 720, walkY: 555 },
  moltbook: { minX: 80, maxX: 720, walkY: 555 },
  main_city: { minX: 80, maxX: 720, walkY: 555 },
  trending: { minX: 80, maxX: 720, walkY: 555 },
  ballers: { minX: 80, maxX: 720, walkY: 555 },
  founders: { minX: 80, maxX: 720, walkY: 555 },
  arena: { minX: 80, maxX: 720, walkY: 555 },
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

  private handleCharacterClick(data: { characterId: string; playerId?: string }): void {
    console.log(`[WorldSync] Character clicked: ${data.characterId}`);
  }

  private handleZoneChange(data: { zone: ZoneType }): void {
    console.log(`[WorldSync] Zone changed to: ${data.zone}`);
  }

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

  private flushCommandQueue(ws: WebSocket): void {
    while (this.commandQueue.length > 0) {
      const command = this.commandQueue.shift();
      if (command && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(command));
      }
    }
  }

  sendMove(agentId: string, x: number, y: number): void {
    this.sendCommand({
      type: 'character-behavior',
      characterId: agentId,
      action: 'moveTo',
      target: { type: 'position', x, y },
    });
  }

  sendApproach(agentId: string, targetAgentId: string): void {
    this.sendCommand({
      type: 'character-behavior',
      characterId: agentId,
      action: 'moveTo',
      target: { type: 'character', id: targetAgentId },
    });
  }

  sendSpeak(agentId: string, message: string, emotion: string = 'neutral'): void {
    this.sendCommand({
      type: 'character-speak',
      characterId: agentId,
      message,
      emotion,
    });
  }

  sendZoneTransition(agentId: string, zone: ZoneType): void {
    this.sendCommand({
      type: 'zone-transition',
      characterId: agentId,
      target: { type: 'position', x: 0, y: 0, id: zone },
    });
  }

  getWorldState(): WorldStateUpdate | null {
    return this.worldState;
  }

  getAgentState(agentId: string): AgentWorldState | null {
    return this.agentStates.get(agentId) || null;
  }

  getAllAgentStates(): Map<string, AgentWorldState> {
    return this.agentStates;
  }

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

  recordConversationEnd(agentId: string): void {
    const state = this.agentStates.get(agentId);
    if (state) {
      state.lastConversation = Date.now();
    }
  }

  getWanderDestination(zone: ZoneType): { x: number; y: number } {
    const bounds = ZONE_BOUNDS[zone] || ZONE_BOUNDS.main_city;
    return {
      x: bounds.minX + Math.floor(Math.random() * (bounds.maxX - bounds.minX)),
      y: bounds.walkY,
    };
  }

  getCurrentZone(): ZoneType {
    return (this.worldState?.zone as ZoneType) || 'main_city';
  }

  getCurrentWeather(): string {
    return this.worldState?.weather || 'cloudy';
  }

  getCurrentHealth(): number {
    return this.worldState?.health || 50;
  }

  getClientCount(): number {
    return this.clients.size;
  }

  isConnected(): boolean {
    return this.clients.size > 0;
  }

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
