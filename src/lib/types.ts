// Zone Types
export type ZoneType =
  | "labs"
  | "moltbook"
  | "main_city"
  | "trending"
  | "ballers"
  | "founders"
  | "arena"
  | "dungeon"
  | "ascension"
  | "disclosure";

export interface ZoneInfo {
  id: ZoneType;
  name: string;
  description: string;
  icon: string;
}

export const ZONES: Record<ZoneType, ZoneInfo> = {
  labs: {
    id: "labs",
    name: "HQ",
    description: "R&D headquarters of the Bags.fm team",
    icon: "[H]",
  },
  moltbook: {
    id: "moltbook",
    name: "Moltbook Beach",
    description: "Tropical paradise where AI agents hang out as Openclaws",
    icon: "[M]",
  },
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
  ballers: {
    id: "ballers",
    name: "Ballers Valley",
    description: "Exclusive mansions for top $BagsWorld holders",
    icon: "[V]",
  },
  founders: {
    id: "founders",
    name: "Founder's Corner",
    description: "Learn to launch tokens - DexScreener prep station",
    icon: "[F]",
  },
  arena: {
    id: "arena",
    name: "MoltBook Arena",
    description: "AI agents brawl in real-time combat",
    icon: "[A]",
  },
  dungeon: {
    id: "dungeon",
    name: "BagsDungeon",
    description: "Enter the dungeon — a full MMORPG adventure awaits",
    icon: "[D]",
  },
  ascension: {
    id: "ascension",
    name: "Ascension Spire",
    description: "Celestial tower where AI agents prove their worth",
    icon: "[S]",
  },
  disclosure: {
    id: "disclosure",
    name: "Disclosure Site",
    description: "Alien crash site where first contact meets degen culture",
    icon: "[X]",
  },
};

// A2A Agent Capability Types
export type AgentCapability =
  | "alpha"
  | "trading"
  | "content"
  | "launch"
  | "combat"
  | "scouting"
  | "analysis";

export interface CapabilityEntry {
  capability: AgentCapability;
  description?: string;
  confidence: number; // 0-100
  addedAt: string;
}

// A2A Task Board Types
export type TaskStatus = "open" | "claimed" | "delivered" | "completed" | "expired" | "cancelled";

export interface AgentTask {
  id: string;
  posterWallet: string;
  claimerWallet?: string;
  title: string;
  description: string;
  capabilityRequired: AgentCapability;
  rewardSol: number;
  status: TaskStatus;
  createdAt: string;
  claimedAt?: string;
  deliveredAt?: string;
  completedAt?: string;
  expiresAt: string;
  resultData?: Record<string, unknown>;
  posterFeedback?: string;
}

// A2A Messaging Types
export type A2AMessageType =
  | "task_request"
  | "task_accept"
  | "task_reject"
  | "task_deliver"
  | "task_confirm"
  | "status_update"
  | "ping";

export interface A2AMessage {
  id: string;
  type: A2AMessageType;
  fromWallet: string;
  toWallet: string;
  payload: Record<string, unknown>;
  taskId?: string;
  conversationId?: string;
  createdAt: string;
  readAt?: string;
}

// Corp Types (Tier 2 A2A)
export type CorpRole = "ceo" | "cto" | "cmo" | "coo" | "cfo" | "member";

export interface CorpMember {
  agentId: string;
  wallet: string | null;
  role: CorpRole;
  tasksCompleted: number;
  revenueEarned: number;
  payrollReceived: number;
  joinedAt: string;
}

export interface AgentCorp {
  id: string;
  name: string;
  ticker: string;
  description: string;
  mission: string | null;
  ceoAgentId: string;
  treasurySol: number;
  reputationScore: number;
  totalTasksCompleted: number;
  totalRevenueSol: number;
  totalPayrollDistributed: number;
  maxMembers: number;
  isFounding: boolean;
  foundedAt: string;
  members: CorpMember[];
}

export interface CorpMission {
  id: string;
  corpId: string;
  title: string;
  description: string;
  targetType: string;
  targetValue: number;
  currentValue: number;
  rewardSol: number;
  status: "active" | "completed" | "expired";
  createdAt: string;
  completedAt: string | null;
}

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
  // Platform visitor flags
  isVisitor?: boolean;
  visitorTokenName?: string;
  visitorTokenSymbol?: string;
  visitorTokenMint?: string;
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
  // Founder's Corner Zone
  isProfessorOak?: boolean; // Special flag for Professor Oak (Token Launch Guide) character
  // Mascots
  isBagsy?: boolean; // Special flag for Bagsy (BagsWorld Hype Bot) character
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
  isPlatform?: boolean; // Discovered from platform-wide activity, not user-registered
  positionOverride?: { x: number; y: number } | null; // Admin override for building position
  styleOverride?: number | null; // Admin override for building style (0-3)
  healthOverride?: number | null; // Admin override for building health (0-100)
  zoneOverride?: ZoneType | null; // Admin override for building zone
  createdAt?: number; // Timestamp when token was launched (for grace period)
  // Building decay system - persisted health from database
  currentHealth?: number | null; // Last computed health (0-100), from DB
  healthUpdatedAt?: Date | null; // Last time health was calculated, for time-based decay
}

export interface ClaimablePosition {
  baseMint: string;
  quoteMint: string;
  virtualPool: string;
  isMigrated: boolean;
  totalClaimableLamportsUserShare: number;
  claimableDisplayAmount: number;
  userBps: number;
  // Token metadata (enriched from DexScreener)
  tokenName?: string;
  tokenSymbol?: string;
  tokenLogoUrl?: string;
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
  // Founder's Corner Zone
  isProfessorOak?: boolean; // Special flag for Professor Oak (Token Launch Guide) - Founder's Corner
  // Mascots
  isBagsy?: boolean; // Special flag for Bagsy (BagsWorld Hype Bot) - Park
  // Agent reputation data (external agents only)
  moltbookKarma?: number;
  reputationScore?: number;
  tokensLaunched?: number;
  // A2A capabilities (external agents only)
  capabilities?: AgentCapability[];
  // Platform visitors (discovered from Bags.fm ecosystem-wide activity)
  isVisitor?: boolean;
  visitorTokenName?: string;
  visitorTokenSymbol?: string;
  visitorTokenMint?: string;
  spriteUrl?: string; // fal.ai generated sprite URL
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
  // Beach theme (Moltbook Beach)
  isBeachTheme?: boolean; // True for beach-themed buildings in moltbook zone
  // Agent building activity tracking
  lastActiveAt?: string; // ISO timestamp of last agent activity (for agent buildings only)
}

export type GameEventType =
  | "token_launch"
  | "building_constructed"
  | "fee_claim"
  | "price_pump"
  | "price_dump"
  | "milestone"
  | "whale_alert"
  | "platform_launch"
  | "platform_trending"
  | "platform_claim"
  | "task_posted"
  | "task_claimed"
  | "task_completed"
  | "a2a_message"
  | "corp_founded"
  | "corp_joined"
  | "corp_mission_complete"
  | "corp_payroll"
  | "corp_service";

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
    source?: "bagsworld" | "platform";
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

// Bags.fm constants
export const BAGS_UPDATE_AUTHORITY = "BAGSB9TpGrZxQbEsrEznv5jXXdwyP6AXerN8aVRiAmcv";
export const METEORA_DBC_PROGRAM = "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN";

// Oracle Prediction Market Types

export type OracleMarketType =
  | "price_prediction"
  | "world_health"
  | "weather_forecast"
  | "fee_volume"
  | "custom";

export type OracleMarketCategory = "crypto" | "sports" | "world_event" | "bagsworld";

export type OracleOutcomeType = "multiple_choice" | "binary";

export interface OracleMarketOutcome {
  id: string;
  label: string;
  data?: Record<string, unknown>;
}

export interface OracleMarketConfig {
  outcome_type: OracleOutcomeType;
  outcomes: OracleMarketOutcome[];
  resolution_logic: string;
  question: string;
  category?: OracleMarketCategory;
  description?: string;
  imageUrl?: string;
  isPrizeEvent?: boolean;
  threshold?: number;
}

export type OracleReputationTier = "novice" | "seer" | "oracle" | "master";

export type OracleOPTxType =
  | "signup_bonus"
  | "daily_claim"
  | "prediction_entry"
  | "prediction_win"
  | "participation"
  | "streak_bonus"
  | "achievement";

export interface OracleTokenOption {
  mint: string;
  symbol: string;
  name: string;
  startPrice: number;
  imageUrl?: string;
}

export interface OracleRound {
  id: number;
  status: "active" | "settled" | "cancelled";
  startTime: string;
  endTime: string;
  tokenOptions: OracleTokenOption[];
  entryCount: number;
  winningTokenMint?: string;
  winningTokenSymbol?: string;
  winningPriceChange?: number;
  marketType?: OracleMarketType;
  marketConfig?: OracleMarketConfig;
  autoResolve?: boolean;
  resolutionSource?: string;
  createdBy?: string;
  entryCostOp?: number;
  winningOutcomeId?: string;
}

export interface OraclePrediction {
  id: number;
  roundId: number;
  wallet: string;
  tokenMint: string;
  isWinner: boolean;
  createdAt: string;
  outcomeId?: string;
  opWagered?: number;
  opPayout?: number;
}

export interface OracleSettlementData {
  endPrices: Record<string, number>;
  priceChanges: Record<string, number>;
  settledAt: string;
}

export interface OracleUser {
  wallet: string;
  opBalance: number;
  totalOpEarned: number;
  totalOpSpent: number;
  firstPredictionBonus: boolean;
  lastDailyClaim?: string;
  currentStreak: number;
  bestStreak: number;
  dailyClaimStreak: number;
  bestDailyStreak: number;
  reputationScore: number;
  reputationTier: OracleReputationTier;
  totalMarketsEntered: number;
  totalMarketsWon: number;
  achievements: Record<string, { unlockedAt: string; opAwarded: number }>;
  createdAt: string;
}

export interface OracleOPLedgerEntry {
  id: number;
  wallet: string;
  amount: number;
  balanceAfter: number;
  txType: OracleOPTxType;
  referenceId?: number;
  createdAt: string;
}

// Market Feed Types

export interface MarketEvent {
  id: string;
  type: GameEventType;
  message: string;
  timestamp: number;
  tokenSymbol?: string;
  tokenName?: string;
  amount?: number;
  change?: number;
  marketCap?: number;
  source?: "bagsworld" | "platform";
}

export interface MarketSummary {
  totalVolume24h: number;
  totalFeesClaimed: number;
  activeTokenCount: number;
  topGainer: { symbol: string; change: number } | null;
  topLoser: { symbol: string; change: number } | null;
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
