// Bags.fm API Types

export interface FeeEarner {
  rank: number;
  username: string;
  providerUsername: string;
  provider: "twitter" | "tiktok" | "instagram" | "github" | "kick" | "bitcoin" | "pokemon";
  wallet: string;
  avatarUrl?: string;
  lifetimeEarnings: number;
  earnings24h: number;
  change24h: number;
  tokenCount: number;
  topToken?: TokenInfo;
  isSatoshi?: boolean; // Special flag for Satoshi character
  isAsh?: boolean; // Special flag for Ash character
}

export interface TokenInfo {
  mint: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  price: number;
  marketCap: number;
  volume24h: number;
  change24h: number;
  holders: number;
  lifetimeFees: number;
  creator: string;
}

export interface ClaimablePosition {
  baseMint: string;
  quoteMint: string;
  virtualPool: string;
  isMigrated: boolean;
  totalClaimableLamportsUserShare: number;
  claimableDisplayAmount: number;
  userBps: number;
}

export interface ClaimStats {
  user: string;
  totalClaimed: number;
  claimCount: number;
  lastClaimTime: number;
}

export interface ClaimEvent {
  signature: string;
  claimer: string;
  claimerUsername?: string;
  claimerProvider?: string;
  amount: number;
  timestamp: number;
  tokenMint: string;
  tokenName?: string;
  tokenSymbol?: string;
}

export interface TradeQuote {
  requestId: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  minOutAmount: string;
  priceImpactPct: string;
  slippageBps: number;
  routePlan: RouteLeg[];
}

export interface RouteLeg {
  venue: string;
  inAmount: string;
  outAmount: string;
  inputMint: string;
  outputMint: string;
}

// Game World Types

export type WeatherType = "sunny" | "cloudy" | "rain" | "storm" | "apocalypse";

export interface TimeInfo {
  hour: number;
  isNight: boolean;
  isDusk: boolean;
  isDawn: boolean;
}

export interface WorldState {
  health: number;
  weather: WeatherType;
  population: GameCharacter[];
  buildings: GameBuilding[];
  events: GameEvent[];
  lastUpdated: number;
  timeInfo?: TimeInfo;
}

export interface GameCharacter {
  id: string;
  username: string;
  provider: string;
  providerUsername: string;
  avatarUrl?: string;
  x: number;
  y: number;
  mood: "happy" | "neutral" | "sad" | "celebrating";
  earnings24h: number;
  direction: "left" | "right";
  isMoving: boolean;
  buildingId?: string;
  profileUrl?: string;
  isSatoshi?: boolean; // Special flag for Satoshi character
  isAsh?: boolean; // Special flag for Ash character
}

export interface GameBuilding {
  id: string;
  tokenMint: string;
  name: string;
  symbol: string;
  x: number;
  y: number;
  level: number; // 1-5 based on market cap
  health: number; // 0-100 based on recent performance
  glowing: boolean;
  ownerId: string;
  marketCap?: number;
  volume24h?: number;
  change24h?: number;
  tokenUrl?: string;
}

export type GameEventType =
  | "token_launch"
  | "building_constructed"
  | "fee_claim"
  | "price_pump"
  | "price_dump"
  | "milestone"
  | "whale_alert";

export interface GameEvent {
  id: string;
  type: GameEventType;
  message: string;
  timestamp: number;
  data?: {
    username?: string;
    tokenName?: string;
    amount?: number;
    change?: number;
  };
}

// Store types
export interface GameStore {
  worldState: WorldState | null;
  isLoading: boolean;
  error: string | null;
  selectedCharacter: GameCharacter | null;
  selectedBuilding: GameBuilding | null;
  setWorldState: (state: WorldState) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  selectCharacter: (character: GameCharacter | null) => void;
  selectBuilding: (building: GameBuilding | null) => void;
}
