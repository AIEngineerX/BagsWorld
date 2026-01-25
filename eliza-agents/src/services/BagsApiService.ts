import { Service, type IAgentRuntime } from '../types/elizaos.js';

export interface TokenInfo {
  mint: string;
  name: string;
  symbol: string;
  description?: string;
  image?: string;
  creator?: string;
  marketCap?: number;
  volume24h?: number;
  lifetimeFees?: number;
  holders?: number;
}

export interface CreatorFees {
  mint: string;
  totalFees: number;
  claimedFees: number;
  unclaimedFees: number;
  creatorAddress: string;
}

export interface TopCreator {
  address: string;
  name?: string;
  totalFees: number;
  rank: number;
}

export interface RecentLaunch {
  mint: string;
  name: string;
  symbol: string;
  launchedAt: number;
  creator: string;
  initialMarketCap?: number;
}

export interface WorldHealthData {
  health: number;
  weather: string;
  totalVolume24h: number;
  totalFees24h: number;
  activeTokens: number;
  topCreators: TopCreator[];
}

const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 30000;

function getCached<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  return null;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, timestamp: Date.now() });
}

interface BagsApiConfig {
  baseUrl?: string;
  apiKey?: string;
  bagsWorldUrl?: string;
}

function isRuntime(arg: unknown): arg is IAgentRuntime {
  return arg !== null && typeof arg === 'object' && 'getSetting' in arg;
}

export class BagsApiService extends Service {
  static readonly serviceType = 'bags_api';

  readonly capabilityDescription = 'Bags.fm API integration';

  private baseUrl: string;
  private apiKey?: string;
  private bagsWorldUrl: string;

  constructor(runtimeOrConfig?: IAgentRuntime | BagsApiConfig) {
    super(isRuntime(runtimeOrConfig) ? runtimeOrConfig : undefined);

    if (isRuntime(runtimeOrConfig)) {
      this.baseUrl = (runtimeOrConfig.getSetting('BAGS_API_URL') as string) || 'https://public-api-v2.bags.fm/api/v1';
      this.apiKey = runtimeOrConfig.getSetting('BAGS_API_KEY') as string;
      this.bagsWorldUrl = (runtimeOrConfig.getSetting('BAGSWORLD_API_URL') as string) || 'http://localhost:3000';
    } else if (runtimeOrConfig) {
      this.baseUrl = runtimeOrConfig.baseUrl || process.env.BAGS_API_URL || 'https://public-api-v2.bags.fm/api/v1';
      this.apiKey = runtimeOrConfig.apiKey || process.env.BAGS_API_KEY;
      this.bagsWorldUrl = runtimeOrConfig.bagsWorldUrl || process.env.BAGSWORLD_API_URL || 'http://localhost:3000';
    } else {
      this.baseUrl = process.env.BAGS_API_URL || 'https://public-api-v2.bags.fm/api/v1';
      this.apiKey = process.env.BAGS_API_KEY;
      this.bagsWorldUrl = process.env.BAGSWORLD_API_URL || 'http://localhost:3000';
    }
  }

  static async start(runtime: IAgentRuntime): Promise<BagsApiService> {
    console.log('[BagsApiService] Starting service...');
    const service = new BagsApiService(runtime);

    const hasApiKey = !!service.apiKey;
    console.log(`[BagsApiService] Initialized with API URL: ${service.baseUrl}`);
    console.log(`[BagsApiService] API Key: ${hasApiKey ? 'configured' : 'not configured'}`);

    return service;
  }

  async stop(): Promise<void> {
    this.clearCache();
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const cacheKey = `${endpoint}`;
    const cached = getCached<T>(cacheKey);
    if (cached) return cached;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: { ...headers, ...options?.headers },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Bags API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as T;
      setCache(cacheKey, data);
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  async getToken(mint: string): Promise<TokenInfo | null> {
    try {
      const data = await this.fetch<{ token: TokenInfo }>(`/token-launch/creator/v3?mint=${mint}`);
      return data.token || null;
    } catch (error) {
      console.error(`Failed to fetch token ${mint}:`, error);
      return null;
    }
  }

  async getCreatorFees(mint: string): Promise<CreatorFees | null> {
    try {
      const data = await this.fetch<CreatorFees>(`/token-launch/lifetime-fees?mint=${mint}`);
      return data;
    } catch (error) {
      console.error(`Failed to fetch fees for ${mint}:`, error);
      return null;
    }
  }

  async getTopCreators(limit: number = 10): Promise<TopCreator[]> {
    try {
      const data = await this.fetch<{ creators: TopCreator[] }>(`/creators/top?limit=${limit}`);
      return data.creators || [];
    } catch (error) {
      console.error('Failed to fetch top creators:', error);
      return [];
    }
  }

  async getRecentLaunches(limit: number = 10): Promise<RecentLaunch[]> {
    try {
      const data = await this.fetch<{ launches: RecentLaunch[] }>(`/token-launch/recent?limit=${limit}`);
      return data.launches || [];
    } catch (error) {
      console.error('Failed to fetch recent launches:', error);
      return [];
    }
  }

  async getWorldHealth(): Promise<WorldHealthData | null> {
    try {
      const response = await fetch(`${this.bagsWorldUrl}/api/world-state`);
      if (!response.ok) return null;

      const data = await response.json();
      return {
        health: data.health || 50,
        weather: data.weather || 'cloudy',
        totalVolume24h: data.volume24h || 0,
        totalFees24h: data.fees24h || 0,
        activeTokens: data.activeTokens || 0,
        topCreators: data.topCreators || [],
      };
    } catch (error) {
      console.error('Failed to fetch world health:', error);
      return null;
    }
  }

  async searchTokens(query: string): Promise<TokenInfo[]> {
    try {
      const data = await this.fetch<{ tokens: TokenInfo[] }>(`/tokens/search?q=${encodeURIComponent(query)}`);
      return data.tokens || [];
    } catch (error) {
      console.error(`Failed to search tokens for "${query}":`, error);
      return [];
    }
  }

  clearCache(): void {
    cache.clear();
  }
}

let standaloneInstance: BagsApiService | null = null;

export function getBagsApiService(runtimeOrConfig?: IAgentRuntime | { baseUrl?: string; apiKey?: string }): BagsApiService {
  if (runtimeOrConfig && 'getService' in runtimeOrConfig) {
    const runtime = runtimeOrConfig as IAgentRuntime;
    const service = runtime.getService<BagsApiService>(BagsApiService.serviceType);
    if (service) return service;
  }

  if (!standaloneInstance) {
    standaloneInstance = new BagsApiService();
  }
  return standaloneInstance;
}

export function resetBagsApiService(): void {
  standaloneInstance = null;
}

export default BagsApiService;
