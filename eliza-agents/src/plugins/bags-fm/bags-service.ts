// Bags.fm Service - Handles all Bags.fm API interactions
import { Service, IAgentRuntime, logger } from '@elizaos/core';
import type { BagsToken, BagsCreator, WorldState, BagsEvent, BagsFmConfig } from './types';

export class BagsFmService extends Service {
  static serviceType = 'bags-fm';

  private config: BagsFmConfig;
  private eventListeners: Map<string, Set<(event: BagsEvent) => void>> = new Map();
  private recentEvents: BagsEvent[] = [];
  private worldState: WorldState | null = null;
  private lastFetch: number = 0;
  private cacheDuration: number = 30000; // 30 seconds

  capabilityDescription = 'Provides real-time access to Bags.fm token data, creator information, and ecosystem events';

  constructor(runtime: IAgentRuntime) {
    super(runtime);
    this.config = {
      apiEndpoint: process.env.BAGSWORLD_API_URL || 'http://localhost:3000',
      dexscreenerEnabled: true,
      scoutEnabled: true,
      autoClaimEnabled: false,
      rewardsDistributionEnabled: false,
    };
  }

  static async start(runtime: IAgentRuntime): Promise<BagsFmService> {
    const service = new BagsFmService(runtime);
    await service.initialize();
    return service;
  }

  async initialize(): Promise<void> {
    logger.info('[BagsFmService] Initializing Bags.fm service...');

    // Initial fetch of world state
    await this.refreshWorldState();

    // Start background polling for events
    this.startEventPolling();

    logger.info('[BagsFmService] Service initialized successfully');
  }

  async stop(): Promise<void> {
    logger.info('[BagsFmService] Stopping Bags.fm service...');
  }

  // ================== World State ==================

  async getWorldState(): Promise<WorldState> {
    const now = Date.now();
    if (!this.worldState || now - this.lastFetch > this.cacheDuration) {
      await this.refreshWorldState();
    }
    return this.worldState!;
  }

  private async refreshWorldState(): Promise<void> {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/api/world-state`);
      if (response.ok) {
        const data = await response.json();
        this.worldState = {
          health: data.health || 50,
          weather: this.calculateWeather(data.health || 50),
          totalVolume: data.totalVolume || 0,
          totalFees: data.totalFees || 0,
          activeTokens: data.activeTokens || 0,
          topTokens: data.topTokens || [],
          recentLaunches: data.recentLaunches || [],
        };
        this.lastFetch = Date.now();
      }
    } catch (error) {
      logger.warn('[BagsFmService] Failed to fetch world state, using cached data');
      if (!this.worldState) {
        this.worldState = this.getDefaultWorldState();
      }
    }
  }

  private calculateWeather(health: number): WorldState['weather'] {
    if (health >= 80) return 'sunny';
    if (health >= 60) return 'cloudy';
    if (health >= 40) return 'rain';
    if (health >= 20) return 'storm';
    return 'apocalypse';
  }

  private getDefaultWorldState(): WorldState {
    return {
      health: 50,
      weather: 'cloudy',
      totalVolume: 0,
      totalFees: 0,
      activeTokens: 0,
      topTokens: [],
      recentLaunches: [],
    };
  }

  // ================== Token Data ==================

  async getTopTokens(limit: number = 10): Promise<BagsToken[]> {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/api/global-tokens?limit=${limit}`);
      if (response.ok) {
        const data = await response.json();
        return data.tokens || [];
      }
    } catch (error) {
      logger.warn('[BagsFmService] Failed to fetch top tokens');
    }
    return [];
  }

  async getTokenByMint(mint: string): Promise<BagsToken | null> {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/api/token/${mint}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      logger.warn(`[BagsFmService] Failed to fetch token ${mint}`);
    }
    return null;
  }

  async searchTokens(query: string): Promise<BagsToken[]> {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/api/search-tokens?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        return data.tokens || [];
      }
    } catch (error) {
      logger.warn('[BagsFmService] Failed to search tokens');
    }
    return [];
  }

  // ================== Creator Data ==================

  async getTopCreators(limit: number = 10): Promise<BagsCreator[]> {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/api/top-creators?limit=${limit}`);
      if (response.ok) {
        const data = await response.json();
        return data.creators || [];
      }
    } catch (error) {
      logger.warn('[BagsFmService] Failed to fetch top creators');
    }
    return [];
  }

  async getCreatorByWallet(wallet: string): Promise<BagsCreator | null> {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/api/creator/${wallet}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      logger.warn(`[BagsFmService] Failed to fetch creator ${wallet}`);
    }
    return null;
  }

  // ================== Events ==================

  private startEventPolling(): void {
    // Poll for events every 15 seconds
    setInterval(async () => {
      await this.pollForEvents();
    }, 15000);
  }

  private async pollForEvents(): Promise<void> {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/api/agent-coordinator?count=10`);
      if (response.ok) {
        const data = await response.json();
        const events = data.events || [];

        for (const event of events) {
          this.emitEvent(event);
        }
      }
    } catch (error) {
      // Silent fail for polling
    }
  }

  onEvent(type: string, callback: (event: BagsEvent) => void): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)!.add(callback);
  }

  offEvent(type: string, callback: (event: BagsEvent) => void): void {
    this.eventListeners.get(type)?.delete(callback);
  }

  private emitEvent(event: BagsEvent): void {
    this.recentEvents.unshift(event);
    if (this.recentEvents.length > 100) {
      this.recentEvents.pop();
    }

    // Emit to specific type listeners
    this.eventListeners.get(event.type)?.forEach(cb => cb(event));

    // Emit to wildcard listeners
    this.eventListeners.get('*')?.forEach(cb => cb(event));
  }

  getRecentEvents(limit: number = 10): BagsEvent[] {
    return this.recentEvents.slice(0, limit);
  }

  // ================== Autonomous Actions ==================

  async generateDialogue(participants: string[], topic: string): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/api/intelligent-dialogue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participants, topic }),
      });
      if (response.ok) {
        const data = await response.json();
        return data.dialogue || [];
      }
    } catch (error) {
      logger.warn('[BagsFmService] Failed to generate dialogue');
    }
    return [];
  }

  // ================== Formatting Helpers ==================

  formatTokenForDisplay(token: BagsToken): string {
    const priceEmoji = token.priceChange24h >= 0 ? '📈' : '📉';
    return `**${token.symbol}** (${token.name})
${priceEmoji} 24h: ${token.priceChange24h >= 0 ? '+' : ''}${token.priceChange24h.toFixed(2)}%
💰 MCap: $${this.formatNumber(token.marketCap)}
📊 Vol: $${this.formatNumber(token.volume24h)}
👥 Holders: ${token.holders}`;
  }

  formatWorldStateForPrompt(): string {
    if (!this.worldState) return 'World state unavailable';

    return `BagsWorld Status:
- Health: ${this.worldState.health}% (${this.worldState.weather})
- Total Volume: $${this.formatNumber(this.worldState.totalVolume)}
- Total Fees Generated: $${this.formatNumber(this.worldState.totalFees)}
- Active Tokens: ${this.worldState.activeTokens}
- Top Token: ${this.worldState.topTokens[0]?.symbol || 'None'}`;
  }

  private formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(2);
  }
}

export default BagsFmService;
