// Types for Bags.fm integration

export interface BagsToken {
  mint: string;
  symbol: string;
  name: string;
  creator: string;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
  holders: number;
  feesGenerated: number;
  createdAt: Date;
}

export interface BagsCreator {
  wallet: string;
  username?: string;
  tokensCreated: number;
  totalFeesEarned: number;
  topToken?: BagsToken;
}

export interface WorldState {
  health: number;
  weather: 'sunny' | 'cloudy' | 'rain' | 'storm' | 'apocalypse';
  totalVolume: number;
  totalFees: number;
  activeTokens: number;
  topTokens: BagsToken[];
  recentLaunches: BagsToken[];
}

export interface TokenLaunchEvent {
  type: 'token_launch';
  token: BagsToken;
  timestamp: Date;
}

export interface PricePumpEvent {
  type: 'price_pump' | 'price_dump';
  token: BagsToken;
  changePercent: number;
  timestamp: Date;
}

export interface FeeClaimEvent {
  type: 'fee_claim';
  wallet: string;
  amount: number;
  token: BagsToken;
  timestamp: Date;
}

export interface DistributionEvent {
  type: 'distribution';
  recipients: Array<{
    wallet: string;
    amount: number;
    rank: number;
  }>;
  totalAmount: number;
  timestamp: Date;
}

export type BagsEvent = TokenLaunchEvent | PricePumpEvent | FeeClaimEvent | DistributionEvent;

export interface BagsFmConfig {
  apiEndpoint?: string;
  dexscreenerEnabled?: boolean;
  scoutEnabled?: boolean;
  autoClaimEnabled?: boolean;
  rewardsDistributionEnabled?: boolean;
}
