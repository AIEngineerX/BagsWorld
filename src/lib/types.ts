// Zone Types
export type ZoneType = "main_city" | "trending" | "academy" | "ballers";

export interface ZoneInfo {
  id: ZoneType;
  name: string;
  description: string;
  icon: string;
}

export const ZONES: Record<ZoneType, ZoneInfo> = {
  main_city: {
    id: "main_city",
    name: "Park",
    description: "The peaceful heart of BagsWorld",
    icon: "[P]",
  },
  trending: {
    id: "trending",
    name: "BagsCity",
    description: "Downtown district with hot tokens",
    icon: "[B]",
  },
  academy: {
    id: "academy",
    name: "Academy",
    description: "Learn from the Bags.fm team",
    icon: "[A]",
  },
  ballers: {
    id: "ballers",
    name: "Ballers Valley",
    description: "Exclusive mansions for top $BagsWorld holders",
    icon: "[V]",
  },
};

// Bags.fm API Types

export interface FeeEarner {
  rank: number;
  username: string;
  providerUsername: string;
  provider: "twitter" | "github" | "kick" | "solana" | "pokemon";
  wallet: string;
  avatarUrl?: string;
  lifetimeEarnings: number;
  earnings24h: number;
  change24h: number;
  tokenCount: number;
  topToken?: TokenInfo;
  isToly?: boolean; // Special flag for Toly (Solana co-founder) character
  isAsh?: boolean; // Special flag for Ash character
  isFinn?: boolean; // Special flag for Finn (Bags.fm CEO) character
  isDev?: boolean; // Special flag for The Dev (DaddyGhost) character
  isScout?: boolean; // Special flag for Scout Agent character
  isCJ?: boolean; // Special flag for CJ character
  isShaw?: boolean; // Special flag for Shaw (ElizaOS creator) character
  // Bags.fm Team (Academy Zone)
  isRamo?: boolean; // Special flag for Ramo (Co-Founder & CTO) character
  isSincara?: boolean; // Special flag for Sincara (Frontend Engineer) character
  isStuu?: boolean; // Special flag for Stuu (Operations) character
  isSam?: boolean; // Special flag for Sam (Growth) character
  isAlaa?: boolean; // Special flag for Alaa (Skunk Works) character
  isCarlo?: boolean; // Special flag for Carlo (Ambassador) character
  isBNN?: boolean; // Special flag for BNN (News Bot) character
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
  levelOverride?: number | null; // Admin override for building level (1-5)
  isPermanent?: boolean; // True for landmark buildings (Treasury, etc.) - not real on-chain tokens
  positionOverride?: { x: number; y: number } | null; // Admin override for building position
  styleOverride?: number | null; // Admin override for building style (0-3)
  healthOverride?: number | null; // Admin override for building health (0-100)
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

// Building decay status
export type BuildingStatus = "active" | "warning" | "critical" | "dormant";

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
  zone?: ZoneType; // Which zone this character appears in (trending=BagsCity, main_city=Park)
  isToly?: boolean; // Special flag for Toly (Solana co-founder) character
  isAsh?: boolean; // Special flag for Ash character
  isFinn?: boolean; // Special flag for Finn (Bags.fm CEO) character
  isDev?: boolean; // Special flag for The Dev (DaddyGhost) character
  isScout?: boolean; // Special flag for Scout Agent (Neo) - BagsCity
  isCJ?: boolean; // Special flag for CJ character - BagsCity
  isShaw?: boolean; // Special flag for Shaw (ElizaOS creator) - Park
  // Bags.fm Team (Academy Zone)
  isRamo?: boolean; // Special flag for Ramo (Co-Founder & CTO) - Academy
  isSincara?: boolean; // Special flag for Sincara (Frontend Engineer) - Academy
  isStuu?: boolean; // Special flag for Stuu (Operations) - Academy
  isSam?: boolean; // Special flag for Sam (Growth) - Academy
  isAlaa?: boolean; // Special flag for Alaa (Skunk Works) - Academy
  isCarlo?: boolean; // Special flag for Carlo (Ambassador) - Academy
  isBNN?: boolean; // Special flag for BNN (News Bot) - Academy
}

export interface GameBuilding {
  id: string;
  tokenMint: string;
  name: string;
  symbol: string;
  x: number;
  y: number;
  level: number; // 1-5 based on market cap, 6 for mansions
  health: number; // 0-100 based on recent performance
  status?: BuildingStatus; // Decay status for visual effects
  glowing: boolean;
  ownerId: string;
  marketCap?: number;
  volume24h?: number;
  change24h?: number;
  tokenUrl?: string;
  zone?: ZoneType; // Which zone this building appears in (default: both)
  isFloating?: boolean; // Special floating building (BagsWorld HQ)
  isPermanent?: boolean; // Landmark building (Treasury, etc.) - not a real token
  styleOverride?: number | null; // Admin override for building style (0-3)
  // Mansion fields (Ballers Valley)
  isMansion?: boolean; // True for top holder mansions
  holderRank?: number; // 1-5 for top holders
  holderAddress?: string; // Wallet address of the holder
  holderBalance?: number; // Token balance held
  mansionScale?: number; // Scale multiplier for mansion display (1.5 for #1, 1.3 for #2-3, etc.)
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
    symbol?: string;
    platform?: "bags" | "pump";
    mint?: string;
  };
}

// Terminal Types (Trading Terminal API)

export interface TrendingToken {
  mint: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  price: number;
  marketCap: number;
  volume24h: number;
  change24h: number;
  lifetimeFees: number;
  rank: number;
}

export interface NewPair {
  mint: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  createdAt: number;
  ageSeconds: number;
  marketCap: number;
  volume24h: number;
  safety: TokenSafety;
}

export interface TokenSafety {
  score: number; // 0-100 safety score
  mintAuthorityDisabled: boolean;
  freezeAuthorityDisabled: boolean;
  lpBurned: boolean;
  lpBurnedPercent: number;
  top10HolderPercent: number;
  isRugRisk: boolean;
  warnings: string[];
}

// Store types
export interface GameStore {
  worldState: WorldState | null;
  isLoading: boolean;
  error: string | null;
  selectedCharacter: GameCharacter | null;
  selectedBuilding: GameBuilding | null;
  currentZone: ZoneType;
  setWorldState: (state: WorldState) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  selectCharacter: (character: GameCharacter | null) => void;
  selectBuilding: (building: GameBuilding | null) => void;
  setZone: (zone: ZoneType) => void;
}
