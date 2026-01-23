// Shared Context Manager
// Provides world state awareness across all agents

import { getDatabaseAdapter } from '../db';
import { getAgentBus } from './agent-bus';
import { createLogger } from '../utils/logger';
import type {
  SharedWorldState,
  TokenSummary,
  RecentEvent,
  ContextPayload,
} from './types';

const log = createLogger('SharedContext');

export class SharedContextManager {
  private worldState: SharedWorldState | null = null;
  private eventBuffer: RecentEvent[] = [];
  private refreshInterval: NodeJS.Timeout | null = null;
  private db = getDatabaseAdapter();
  private bus = getAgentBus();
  private bagsWorldApiUrl: string;

  // Maximum events to keep in buffer
  private readonly MAX_EVENTS = 100;

  // Context TTL
  private readonly CONTEXT_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.bagsWorldApiUrl = process.env.BAGSWORLD_API_URL || 'http://localhost:3000';
  }

  // ==================== Initialization ====================

  async initialize(): Promise<void> {
    log.info('Initializing shared context manager...');

    // Load initial world state
    await this.refreshWorldState();

    // Load persisted context from database
    await this.loadPersistedContext();

    log.info('Shared context manager initialized');
  }

  startAutoRefresh(intervalMs: number = 30000): void {
    if (this.refreshInterval) return;

    this.refreshInterval = setInterval(async () => {
      await this.refreshWorldState();
      await this.cleanExpiredContext();
    }, intervalMs);

    log.info(`Started auto-refresh every ${intervalMs}ms`);
  }

  stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      log.info('Stopped auto-refresh');
    }
  }

  // ==================== World State ====================

  async refreshWorldState(): Promise<SharedWorldState | null> {
    try {
      const response = await fetch(`${this.bagsWorldApiUrl}/api/world-state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens: [] }), // Minimal request
      });

      if (!response.ok) {
        log.warn(`Failed to fetch world state: ${response.status}`);
        return this.worldState;
      }

      const data = await response.json();

      const newState: SharedWorldState = {
        health: data.health || 50,
        weather: data.weather || 'cloudy',
        buildingCount: data.buildings?.length || 0,
        populationCount: data.population?.length || 0,
        totalVolume24h: data.healthMetrics?.totalVolume24h || 0,
        totalFees24h: data.healthMetrics?.claimVolume24h || 0,
        topTokens: this.extractTopTokens(data.buildings || []),
        recentEvents: data.events || [],
        lastUpdated: Date.now(),
      };

      // Check for significant changes
      if (this.hasSignificantChange(this.worldState, newState)) {
        this.worldState = newState;

        // Persist to database
        await this.persistContext('world_state', 'current', newState);

        // Broadcast update to all agents
        this.bus.updateContext('system', 'world_state', 'current', newState, this.CONTEXT_TTL);

        log.debug('World state updated and broadcast');
      } else {
        this.worldState = newState;
      }

      return this.worldState;
    } catch (error) {
      log.error('Error refreshing world state:', error);
      return this.worldState;
    }
  }

  private extractTopTokens(buildings: Array<{
    symbol: string;
    name: string;
    id: string;
    marketCap?: number;
    priceChange24h?: number;
    volume24h?: number;
  }>): TokenSummary[] {
    return buildings
      .filter(b => b.marketCap && b.marketCap > 0)
      .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))
      .slice(0, 5)
      .map(b => ({
        mint: b.id,
        symbol: b.symbol,
        name: b.name,
        marketCap: b.marketCap || 0,
        priceChange24h: b.priceChange24h || 0,
        volume24h: b.volume24h || 0,
      }));
  }

  private hasSignificantChange(
    oldState: SharedWorldState | null,
    newState: SharedWorldState
  ): boolean {
    if (!oldState) return true;

    // Health change of 5% or more
    if (Math.abs(oldState.health - newState.health) >= 5) return true;

    // Weather change
    if (oldState.weather !== newState.weather) return true;

    // Building count change
    if (oldState.buildingCount !== newState.buildingCount) return true;

    // Volume change of 10% or more
    const volumeChange = oldState.totalVolume24h > 0
      ? Math.abs(newState.totalVolume24h - oldState.totalVolume24h) / oldState.totalVolume24h
      : 1;
    if (volumeChange >= 0.1) return true;

    return false;
  }

  getWorldState(): SharedWorldState | null {
    return this.worldState;
  }

  // Format world state for injection into agent prompts
  formatWorldStateForPrompt(): string {
    if (!this.worldState) return 'World state unavailable.';

    const healthEmoji = this.worldState.health >= 80 ? '🌟' :
                        this.worldState.health >= 60 ? '☀️' :
                        this.worldState.health >= 40 ? '🌤️' :
                        this.worldState.health >= 20 ? '⛈️' : '🌋';

    let prompt = `BAGSWORLD STATE ${healthEmoji}:\n`;
    prompt += `Health: ${this.worldState.health}% | Weather: ${this.worldState.weather}\n`;
    prompt += `Buildings: ${this.worldState.buildingCount} | Citizens: ${this.worldState.populationCount}\n`;
    prompt += `24h Volume: $${this.formatNumber(this.worldState.totalVolume24h)} | Fees: $${this.formatNumber(this.worldState.totalFees24h)}\n`;

    if (this.worldState.topTokens.length > 0) {
      prompt += '\nTOP TOKENS:\n';
      this.worldState.topTokens.forEach((token, i) => {
        const trend = token.priceChange24h >= 0 ? '📈' : '📉';
        prompt += `${i + 1}. ${token.symbol} ${trend} ${token.priceChange24h >= 0 ? '+' : ''}${token.priceChange24h.toFixed(1)}% | $${this.formatNumber(token.marketCap)} mcap\n`;
      });
    }

    return prompt;
  }

  private formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(2);
  }

  // ==================== Event Buffer ====================

  addEvent(event: RecentEvent): void {
    // Check for duplicate
    if (this.eventBuffer.some(e => e.id === event.id)) return;

    this.eventBuffer.unshift(event);

    // Trim buffer
    if (this.eventBuffer.length > this.MAX_EVENTS) {
      this.eventBuffer = this.eventBuffer.slice(0, this.MAX_EVENTS);
    }

    // Persist event
    this.persistContext('event', event.id, event).catch(err => {
      log.error('Failed to persist event:', err);
    });

    // Broadcast to agents
    this.bus.broadcastEvent('system', event.type, event.data);
  }

  getRecentEvents(limit: number = 10, type?: string): RecentEvent[] {
    let events = this.eventBuffer;
    if (type) {
      events = events.filter(e => e.type === type);
    }
    return events.slice(0, limit);
  }

  getUnprocessedEvents(agentId: string, limit: number = 10): RecentEvent[] {
    return this.eventBuffer
      .filter(e => !e.processedBy.includes(agentId))
      .slice(0, limit);
  }

  markEventProcessed(eventId: string, agentId: string): void {
    const event = this.eventBuffer.find(e => e.id === eventId);
    if (event && !event.processedBy.includes(agentId)) {
      event.processedBy.push(agentId);
    }
  }

  // ==================== Token Data ====================

  async getTokenData(mint: string): Promise<TokenSummary | null> {
    // Check cache first
    const cached = await this.getContext('token_data', mint);
    if (cached) {
      return cached.data as TokenSummary;
    }

    // Fetch from API
    try {
      const response = await fetch(`${this.bagsWorldApiUrl}/api/token/${mint}`);
      if (!response.ok) return null;

      const data = await response.json();
      const token: TokenSummary = {
        mint: data.mint,
        symbol: data.symbol,
        name: data.name,
        marketCap: data.market_cap || 0,
        priceChange24h: data.price_change_24h || 0,
        volume24h: data.volume_24h || 0,
      };

      // Cache for 2 minutes
      await this.persistContext('token_data', mint, token, 2 * 60 * 1000);

      return token;
    } catch (error) {
      log.error(`Error fetching token ${mint}:`, error);
      return null;
    }
  }

  // ==================== User Context ====================

  async getUserContext(userId: string): Promise<Record<string, unknown> | null> {
    const cached = await this.getContext('user_info', userId);
    return cached?.data || null;
  }

  async setUserContext(userId: string, data: Record<string, unknown>, ttlMs?: number): Promise<void> {
    await this.persistContext('user_info', userId, data, ttlMs || this.CONTEXT_TTL);
    this.bus.updateContext('system', 'user_info', userId, data, ttlMs);
  }

  // ==================== Persistence ====================

  private async persistContext(
    contextType: string,
    key: string,
    data: Record<string, unknown>,
    ttlMs?: number
  ): Promise<void> {
    await this.db.initialize();
    await this.db.setSharedContext(contextType, key, data, 'system', ttlMs);
  }

  private async getContext(
    contextType: string,
    key: string
  ): Promise<{ data: Record<string, unknown> } | null> {
    await this.db.initialize();
    const results = await this.db.getSharedContext(contextType, key);
    return results.length > 0 ? { data: results[0].data } : null;
  }

  private async loadPersistedContext(): Promise<void> {
    await this.db.initialize();

    // Load world state
    const worldStateResults = await this.db.getSharedContext('world_state', 'current');
    if (worldStateResults.length > 0) {
      this.worldState = worldStateResults[0].data as SharedWorldState;
      log.debug('Loaded persisted world state');
    }

    // Load recent events
    const eventResults = await this.db.getSharedContext('event');
    for (const result of eventResults.slice(0, 20)) {
      this.eventBuffer.push(result.data as RecentEvent);
    }
    log.debug(`Loaded ${this.eventBuffer.length} persisted events`);
  }

  private async cleanExpiredContext(): Promise<void> {
    await this.db.cleanExpiredSharedContext();
  }

  // ==================== Cleanup ====================

  async cleanup(): Promise<void> {
    this.stopAutoRefresh();
    await this.cleanExpiredContext();
    log.info('Shared context manager cleaned up');
  }
}

// Singleton instance
let contextInstance: SharedContextManager | null = null;

export function getSharedContext(): SharedContextManager {
  if (!contextInstance) {
    contextInstance = new SharedContextManager();
  }
  return contextInstance;
}

export default SharedContextManager;
