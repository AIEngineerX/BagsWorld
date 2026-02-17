import type {
  WeatherType,
  WorldState,
  GameCharacter,
  GameBuilding,
  GameEvent,
  FeeEarner,
  TokenInfo,
  BuildingStatus,
} from "./types";
import { ECOSYSTEM_CONFIG } from "./config";

// Constants for world calculations (scaled for 1280x960 canvas)
const SCALE = 1.6;
const WORLD_WIDTH = 1280;
const WORLD_HEIGHT = 960;
const BUILDING_SPACING = Math.round(120 * SCALE); // Increased spacing to prevent overlap
const MAX_BUILDINGS = 20;
const MAX_CHARACTERS = 25; // 15 special NPCs + up to 8 visitors + regular earners

// Bags.fm fee activity thresholds for world health (in SOL)
interface HealthThresholds {
  thriving: number;
  healthy: number;
  normal: number;
  struggling: number;
}

const CLAIM_THRESHOLDS: HealthThresholds = { thriving: 50, healthy: 20, normal: 5, struggling: 1 };
const FEE_THRESHOLDS: HealthThresholds = {
  thriving: 1000,
  healthy: 500,
  normal: 100,
  struggling: 10,
};

// Calculate score (0-100) from value using thresholds
function calculateThresholdScore(value: number, t: HealthThresholds): number {
  if (value >= t.thriving) return 90 + Math.min(10, (value - t.thriving) / (t.thriving / 5));
  if (value >= t.healthy) return 70 + ((value - t.healthy) / (t.thriving - t.healthy)) * 20;
  if (value >= t.normal) return 50 + ((value - t.normal) / (t.healthy - t.normal)) * 20;
  if (value >= t.struggling) return 25 + ((value - t.struggling) / (t.normal - t.struggling)) * 25;
  return Math.max(0, (value / (t.struggling || 1)) * 25);
}

// Position cache to prevent buildings from shifting when rankings change
// Key: token mint, Value: { x, y, assignedIndex }
const buildingPositionCache = new Map<string, { x: number; y: number; assignedIndex: number }>();

// Hash mint to index (djb2 variant)
function hashMintToIndex(mint: string, maxIndex: number): number {
  let hash = 0;
  for (let i = 0; i < mint.length; i++) {
    hash = (hash << 5) - hash + mint.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash) % maxIndex;
}

/**
 * Calculate world health based on Bags.fm ecosystem activity
 * @param claimVolume24h - Total SOL claimed in the last 24 hours
 * @param totalLifetimeFees - Total lifetime fees across all tokens
 * @param activeTokenCount - Number of tokens with activity
 * @param buildingCount - Number of buildings in the world (for baseline)
 */
export function calculateWorldHealth(
  claimVolume24h: number,
  totalLifetimeFees: number,
  activeTokenCount: number = 0,
  buildingCount: number = 0
): number {
  // Baseline health: world exists and is functioning (25-40%)
  // This prevents showing 0% when infrastructure is working but no token activity
  const BASELINE_HEALTH = 25;
  const BUILDING_BONUS = Math.min(15, buildingCount * 3); // Up to 15% for having buildings
  const baselineScore = BASELINE_HEALTH + BUILDING_BONUS;

  // If no fee activity, return baseline
  if (claimVolume24h === 0 && totalLifetimeFees === 0 && activeTokenCount === 0) {
    return baselineScore;
  }

  // Calculate scores using shared threshold logic
  const claimScore = calculateThresholdScore(claimVolume24h, CLAIM_THRESHOLDS);
  const feesScore = calculateThresholdScore(totalLifetimeFees, FEE_THRESHOLDS);
  const diversityScore = Math.min(100, activeTokenCount * 10);

  // Weighted average: 60% claims, 30% fees, 10% diversity
  const activityHealth = claimScore * 0.6 + feesScore * 0.3 + diversityScore * 0.1;

  // Blend baseline with activity (activity can boost above baseline)
  const health = Math.max(baselineScore, activityHealth);

  return Math.round(Math.max(0, Math.min(100, health)));
}

export function calculateWeather(health: number): WeatherType {
  if (health >= 80) return "sunny";
  if (health >= 60) return "cloudy";
  if (health >= 40) return "rain";
  if (health >= 20) return "storm";
  return "apocalypse";
}

export function calculateBuildingLevel(marketCap: number): number {
  const cap = Math.max(0, marketCap || 0);

  if (cap >= 10000000) return 5; // $10M+
  if (cap >= 2000000) return 4; // $2M+
  if (cap >= 500000) return 3; // $500K+
  if (cap >= 100000) return 2; // $100K+
  return 1;
}

// Determine building status from health value
function getStatusFromHealth(health: number): BuildingStatus {
  const { thresholds } = ECOSYSTEM_CONFIG.buildings.decay;
  if (health <= thresholds.dormant) return "dormant";
  if (health <= thresholds.critical) return "critical";
  if (health <= thresholds.warning) return "warning";
  return "active";
}

// Decay cycle duration in milliseconds (60 seconds)
const DECAY_CYCLE_MS = 60 * 1000;
// Maximum cycles to apply at once (prevents extreme decay after long periods)
// 60 cycles = 1 hour of decay applied at once max
const MAX_DECAY_CYCLES = 60;

export function calculateBuildingHealth(
  volume24h: number,
  marketCap: number,
  change24h: number,
  previousHealth: number,
  isPermanent: boolean = false,
  healthOverride?: number | null,
  lastHealthUpdate?: Date | null,
  createdAt?: number | null
): { health: number; status: BuildingStatus; cyclesApplied: number } {
  // Admin override - use directly
  if (healthOverride != null) {
    return {
      health: healthOverride,
      status: getStatusFromHealth(healthOverride),
      cyclesApplied: 0,
    };
  }

  // Permanent buildings always healthy
  if (isPermanent) {
    return { health: 100, status: "active", cyclesApplied: 0 };
  }

  const config = ECOSYSTEM_CONFIG.buildings.decay;

  // Grace period - new buildings get immunity from heavy decay
  const gracePeriod = config.gracePeriod;
  if (createdAt && gracePeriod) {
    const ageMs = Date.now() - createdAt;
    if (ageMs < gracePeriod.durationMs) {
      // During grace period, don't decay below minimum health floor
      const health = Math.max(previousHealth, gracePeriod.minHealth);
      return { health, status: getStatusFromHealth(health), cyclesApplied: 0 };
    }
  }

  let adjustmentPerCycle = 0;

  // Determine decay/recovery rate based on volume and market cap
  if (volume24h < config.volumeThresholds.dead) {
    if (marketCap < config.marketCapThreshold) {
      // Low volume + low market cap = heavy decay
      adjustmentPerCycle = config.rates.heavyDecay;
    } else {
      // Low volume only = moderate decay
      adjustmentPerCycle = config.rates.moderateDecay;
    }
  } else if (volume24h >= config.volumeThresholds.healthy) {
    // High volume = fast recovery
    adjustmentPerCycle = config.rates.fastRecovery;
  } else if (change24h < -20) {
    // Moderate volume + price drop = light decay
    adjustmentPerCycle = config.rates.lightDecay;
  } else {
    // Normal activity = recovery
    adjustmentPerCycle = config.rates.recovery;
  }

  // Calculate number of cycles based on time elapsed since last update
  let cyclesElapsed = 1; // Default: apply one cycle (for new buildings or missing timestamp)

  if (lastHealthUpdate) {
    const now = Date.now();
    const elapsed = now - lastHealthUpdate.getTime();
    // Calculate cycles, minimum 1, maximum MAX_DECAY_CYCLES
    cyclesElapsed = Math.min(MAX_DECAY_CYCLES, Math.max(1, Math.floor(elapsed / DECAY_CYCLE_MS)));
  }

  // Apply adjustment multiplied by cycles elapsed
  const totalAdjustment = adjustmentPerCycle * cyclesElapsed;
  const newHealth = Math.round(Math.max(0, Math.min(100, previousHealth + totalAdjustment)));

  return {
    health: newHealth,
    status: getStatusFromHealth(newHealth),
    cyclesApplied: cyclesElapsed,
  };
}

export function calculateCharacterMood(
  earnings24h: number,
  change24h: number
): "happy" | "neutral" | "sad" | "celebrating" {
  if (change24h > 100) return "celebrating";
  if (change24h > 20 || earnings24h > 1000) return "happy";
  if (change24h < -20) return "sad";
  return "neutral";
}

// Seeded random for consistent positions based on index
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

// Ground level - SIDEWALK where characters walk (550 * SCALE = 880)
// Buildings use origin(0.5, 1), so Y is where their bottom edge sits
const SIDEWALK_GROUND_Y = Math.round(550 * SCALE);

// Zone definitions for token-launched buildings
// Left zone (BagsCity side): x 100-550, avoiding landmarks at 128, 240, 448
// Right zone (Park side): x 730-1180, clear of landmarks
const LEFT_ZONE_START = 100;
const LEFT_ZONE_END = 550;
const RIGHT_ZONE_START = 730;
const RIGHT_ZONE_END = 1180;
const MIN_SLOT_SPACING = Math.round(100 * SCALE); // Minimum gap between buildings

// Landmark X positions to avoid (with clearance)
const LANDMARK_X_POSITIONS = [
  Math.round(50 * SCALE), // Casino (80) - far left
  Math.round(200 * SCALE), // Oracle Tower (320) - between Casino and center
  Math.round(280 * SCALE), // PokeCenter (448)
  Math.round(520 * SCALE), // Arcade (832)
  WORLD_WIDTH / 2, // HQ/Treasury (640)
];
const LANDMARK_CLEARANCE = 80; // Pixels to stay clear of landmarks

// Generate available slots for each zone, avoiding landmarks
function generateZoneSlots(zoneStart: number, zoneEnd: number): number[] {
  const slots: number[] = [];
  for (let x = zoneStart; x <= zoneEnd; x += MIN_SLOT_SPACING) {
    // Check if this X is clear of all landmarks
    const isClear = LANDMARK_X_POSITIONS.every(
      (landmarkX) => Math.abs(x - landmarkX) >= LANDMARK_CLEARANCE
    );
    if (isClear) {
      slots.push(x);
    }
  }
  return slots;
}

// Pre-compute available slots for both zones
const LEFT_ZONE_SLOTS = generateZoneSlots(LEFT_ZONE_START, LEFT_ZONE_END);
const RIGHT_ZONE_SLOTS = generateZoneSlots(RIGHT_ZONE_START, RIGHT_ZONE_END);

export function generateBuildingPosition(index: number, total: number): { x: number; y: number } {
  // Alternate between zones: even index → left zone, odd index → right zone
  const useLeftZone = index % 2 === 0;
  const slots = useLeftZone ? LEFT_ZONE_SLOTS : RIGHT_ZONE_SLOTS;

  // Pick slot based on index (divide by 2 since we alternate zones)
  const slotIndex = Math.floor(index / 2) % slots.length;
  const baseX = slots[slotIndex] || (useLeftZone ? LEFT_ZONE_START : RIGHT_ZONE_START);

  // Small deterministic X offset for visual variety (±8 pixels)
  const offsetX = seededRandom(index * 7 + 1) * 16 - 8;

  return {
    x: baseX + offsetX,
    y: SIDEWALK_GROUND_Y, // Same ground level as landmarks - NO random Y offset
  };
}

// Deterministic position from mint hash. Same mint = same position across all instances.
export function getCachedBuildingPosition(
  mint: string,
  existingBuildings: Set<string>
): { x: number; y: number } {
  const cached = buildingPositionCache.get(mint);
  if (cached) {
    return { x: cached.x, y: SIDEWALK_GROUND_Y };
  }

  const slotIndex = hashMintToIndex(mint, MAX_BUILDINGS);
  const position = generateBuildingPosition(slotIndex, MAX_BUILDINGS);

  // Offset to visually separate hash collisions
  const offsetX = (hashMintToIndex(mint + "_offset", 1000) % 40) - 20;

  const finalPosition = {
    x: position.x + offsetX,
    y: SIDEWALK_GROUND_Y,
  };

  buildingPositionCache.set(mint, {
    x: finalPosition.x,
    y: finalPosition.y,
    assignedIndex: slotIndex,
  });

  return finalPosition;
}

/**
 * Clean up position cache for buildings that no longer exist.
 */
export function cleanupBuildingPositionCache(activeMints: Set<string>): void {
  const toDelete: string[] = [];
  buildingPositionCache.forEach((_, mint) => {
    if (!activeMints.has(mint)) {
      toDelete.push(mint);
    }
  });
  toDelete.forEach((mint) => buildingPositionCache.delete(mint));
}

export function generateCharacterPosition(): { x: number; y: number } {
  // Characters walk on the ground/path area (around y=555, scaled)
  // Small Y variation so they're not all in a perfect line
  const groundY = Math.round(550 * SCALE);
  const margin = Math.round(50 * SCALE);
  return {
    x: margin + Math.random() * (WORLD_WIDTH - margin * 2),
    y: groundY + Math.random() * Math.round(15 * SCALE), // Ground level with slight variation
  };
}

function getProfileUrl(provider: string, username: string): string {
  switch (provider) {
    case "twitter":
      return `https://x.com/${username}`;
    case "tiktok":
      return `https://tiktok.com/@${username}`;
    case "instagram":
      return `https://instagram.com/${username}`;
    case "github":
      return `https://github.com/${username}`;
    case "kick":
      return `https://kick.com/${username}`;
    default:
      return `https://x.com/${username}`;
  }
}

// Landmark building mint for BagsWorld HQ
const BAGSHQ_MINT = "9auyeHWESnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS";

// Check if token/building is a landmark (fixed position, never decays)
function isLandmark(token: { mint: string; symbol: string }): {
  type: "pokecenter" | "casino" | "treasury" | "hq" | "oracle" | "arcade" | null;
  isPermanent: boolean;
} {
  const { mint, symbol } = token;
  if (mint === BAGSHQ_MINT || symbol === "BAGSWORLD") return { type: "hq", isPermanent: true };
  if (symbol === "POKECENTER" || mint.includes("PokeCenter"))
    return { type: "pokecenter", isPermanent: true };
  if (symbol === "CASINO" || mint.includes("Casino")) return { type: "casino", isPermanent: true };
  if (symbol === "ORACLE" || mint.includes("OracleTower") || mint.includes("Oracle"))
    return { type: "oracle", isPermanent: true };
  if (symbol === "ARCADE" || mint.includes("Arcade")) return { type: "arcade", isPermanent: true };
  if (mint.startsWith("Treasury")) return { type: "treasury", isPermanent: true };
  if (mint.startsWith("Starter")) return { type: null, isPermanent: true };
  return { type: null, isPermanent: false };
}

// Special character configuration - consolidates flags, positions, zones, and profile URLs
const SPECIAL_CHARACTERS: Record<
  string,
  {
    flag: string;
    wallet: string;
    x: number;
    zone: "labs" | "main_city" | "trending" | "ballers" | "founders";
    profileUrl?: string;
  }
> = {
  toly: {
    flag: "isToly",
    wallet: "toly-solana-permanent",
    x: WORLD_WIDTH / 2,
    zone: "main_city",
    profileUrl: "https://x.com/toly",
  },
  ash: {
    flag: "isAsh",
    wallet: "ash-ketchum-permanent",
    x: WORLD_WIDTH - Math.round(120 * SCALE),
    zone: "main_city",
  },
  finn: {
    flag: "isFinn",
    wallet: "finnbags-ceo-permanent",
    x: Math.round(100 * SCALE),
    zone: "labs", // CEO at Tech Labs HQ with his team
    profileUrl: "https://x.com/finnbags",
  },
  dev: {
    flag: "isDev",
    wallet: "daddyghost-dev-permanent",
    x: WORLD_WIDTH / 2 + Math.round(180 * SCALE),
    zone: "main_city",
    profileUrl: "https://x.com/DaddyGhost",
  },
  scout: {
    flag: "isScout",
    wallet: "scout-agent-permanent",
    x: Math.round(170 * SCALE),
    zone: "trending",
  },
  cj: {
    flag: "isCJ",
    wallet: "cj-grove-street-permanent",
    x: Math.round(90 * SCALE),
    zone: "trending",
  },
  shaw: {
    flag: "isShaw",
    wallet: "shaw-elizaos-permanent",
    x: WORLD_WIDTH / 2 - Math.round(150 * SCALE),
    zone: "main_city", // Shaw stays in Park with other AI agents
    profileUrl: "https://x.com/shawmakesmagic",
  },
  // Bags.fm Team - Tech Labs zone (R&D headquarters)
  ramo: {
    flag: "isRamo",
    wallet: "ramo-cto-permanent",
    x: Math.round(180 * SCALE),
    zone: "labs",
    profileUrl: "https://x.com/ramyobags",
  },
  sincara: {
    flag: "isSincara",
    wallet: "sincara-frontend-permanent",
    x: Math.round(320 * SCALE),
    zone: "labs",
    profileUrl: "https://x.com/sincara_bags",
  },
  stuu: {
    flag: "isStuu",
    wallet: "stuu-ops-permanent",
    x: Math.round(460 * SCALE),
    zone: "labs",
    profileUrl: "https://x.com/StuuBags",
  },
  sam: {
    flag: "isSam",
    wallet: "sam-growth-permanent",
    x: Math.round(600 * SCALE),
    zone: "labs",
    profileUrl: "https://x.com/Sambags12",
  },
  alaa: {
    flag: "isAlaa",
    wallet: "alaa-skunkworks-permanent",
    x: Math.round(740 * SCALE),
    zone: "labs",
    profileUrl: "https://x.com/alaadotsol",
  },
  carlo: {
    flag: "isCarlo",
    wallet: "carlo-ambassador-permanent",
    x: Math.round(880 * SCALE),
    zone: "labs",
    profileUrl: "https://x.com/carlobags",
  },
  bnn: {
    flag: "isBNN",
    wallet: "bnn-news-permanent",
    x: Math.round(1000 * SCALE),
    zone: "labs",
    profileUrl: "https://x.com/BNNBags",
  },
  // Founder's Corner Zone - Token Launch Guides
  professorOak: {
    flag: "isProfessorOak",
    wallet: "professor-oak-permanent",
    x: Math.round(400 * SCALE), // Center of Founder's Corner (near workshop)
    zone: "founders",
  },
  // Mascots
  bagsy: {
    flag: "isBagsy",
    wallet: "bagsy-mascot-permanent",
    x: Math.round(350 * SCALE), // Center of Park near the PokeCenter
    zone: "main_city",
    profileUrl: "https://x.com/BagsyHypeBot",
  },
};

export function transformFeeEarnerToCharacter(
  earner: FeeEarner,
  existingCharacter?: GameCharacter
): GameCharacter {
  const e = earner as any;
  const groundY = Math.round(555 * SCALE);

  // Detect special character type
  const specialType = Object.entries(SPECIAL_CHARACTERS).find(
    ([, cfg]) => e[cfg.flag] || earner.wallet === cfg.wallet
  );
  const isSpecial = !!specialType;
  const specialCfg = specialType?.[1];

  // Build flags object
  const flags = {
    isToly: e.isToly || earner.wallet === SPECIAL_CHARACTERS.toly.wallet,
    isAsh: e.isAsh || earner.wallet === SPECIAL_CHARACTERS.ash.wallet,
    isFinn: e.isFinn || earner.wallet === SPECIAL_CHARACTERS.finn.wallet,
    isDev: e.isDev || earner.wallet === SPECIAL_CHARACTERS.dev.wallet,
    isScout: e.isScout || earner.wallet === SPECIAL_CHARACTERS.scout.wallet,
    isCJ: e.isCJ || earner.wallet === SPECIAL_CHARACTERS.cj.wallet,
    isShaw: e.isShaw || earner.wallet === SPECIAL_CHARACTERS.shaw.wallet,
    // Academy Zone - Bags.fm Team
    isRamo: e.isRamo || earner.wallet === SPECIAL_CHARACTERS.ramo.wallet,
    isSincara: e.isSincara || earner.wallet === SPECIAL_CHARACTERS.sincara.wallet,
    isStuu: e.isStuu || earner.wallet === SPECIAL_CHARACTERS.stuu.wallet,
    isSam: e.isSam || earner.wallet === SPECIAL_CHARACTERS.sam.wallet,
    isAlaa: e.isAlaa || earner.wallet === SPECIAL_CHARACTERS.alaa.wallet,
    isCarlo: e.isCarlo || earner.wallet === SPECIAL_CHARACTERS.carlo.wallet,
    isBNN: e.isBNN || earner.wallet === SPECIAL_CHARACTERS.bnn.wallet,
    // Founder's Corner Zone
    isProfessorOak: e.isProfessorOak || earner.wallet === SPECIAL_CHARACTERS.professorOak.wallet,
    // Mascots
    isBagsy: e.isBagsy || earner.wallet === SPECIAL_CHARACTERS.bagsy.wallet,
  };

  // Determine position
  const position = existingCharacter
    ? { x: existingCharacter.x, y: existingCharacter.y }
    : specialCfg
      ? { x: specialCfg.x, y: groundY }
      : generateCharacterPosition();

  // Determine profile URL
  const profileUrl =
    specialCfg?.profileUrl ??
    (isSpecial ? undefined : getProfileUrl(earner.provider, earner.username));

  // Distribute regular fee earners across all zones based on wallet hash
  const getZoneForFeeEarner = (
    wallet: string
  ): "main_city" | "trending" | "ballers" | "founders" => {
    let hash = 0;
    for (let i = 0; i < wallet.length; i++) {
      hash = (hash << 5) - hash + wallet.charCodeAt(i);
      hash = hash & hash;
    }
    const zones: Array<"main_city" | "trending" | "ballers" | "founders"> = [
      "main_city",
      "trending",
      "ballers",
      "founders",
    ];
    return zones[Math.abs(hash) % zones.length];
  };

  // Visitors go to Park or BagsCity (the most populated zones)
  const getVisitorZone = (wallet: string): "main_city" | "trending" => {
    let hash = 0;
    for (let i = 0; i < wallet.length; i++) {
      hash = (hash << 5) - hash + wallet.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash) % 2 === 0 ? "main_city" : "trending";
  };

  const isVisitor = earner.isVisitor || false;

  return {
    id: earner.wallet,
    username: earner.providerUsername || earner.username,
    provider: earner.provider,
    providerUsername: earner.providerUsername,
    avatarUrl: earner.avatarUrl,
    x: position.x,
    y: position.y,
    mood: isSpecial ? "happy" : calculateCharacterMood(earner.earnings24h, earner.change24h),
    earnings24h: earner.earnings24h,
    direction: Math.random() > 0.5 ? "left" : "right",
    // Allow mascots (Bagsy) to wander, other special characters stay still
    isMoving: flags.isBagsy ? Math.random() > 0.3 : !isSpecial && Math.random() > 0.7,
    buildingId: earner.topToken?.mint,
    profileUrl,
    zone:
      specialCfg?.zone ??
      (isVisitor ? getVisitorZone(earner.wallet) : getZoneForFeeEarner(earner.wallet)),
    ...flags,
    // Platform visitor flags
    ...(isVisitor && {
      isVisitor: true,
      visitorTokenName: earner.visitorTokenName,
      visitorTokenSymbol: earner.visitorTokenSymbol,
      visitorTokenMint: earner.visitorTokenMint,
    }),
  };
}

export function transformTokenToBuilding(
  token: TokenInfo,
  index: number,
  existingBuilding?: GameBuilding
): GameBuilding {
  const landmark = isLandmark(token);
  const isBagsWorldHQ = landmark.type === "hq";

  // Always clear HQ from position cache to ensure it uses sky position
  if (isBagsWorldHQ) {
    buildingPositionCache.delete(BAGSHQ_MINT);
  }

  // Fixed positions for landmark buildings - same sidewalk level as token buildings
  const landmarkY = SIDEWALK_GROUND_Y; // Same as token buildings (550 * SCALE = 880)
  const skyY = 500; // BagsWorld HQ floats in the sky - DO NOT CHANGE
  let position: { x: number; y: number };

  // Check for admin position override FIRST (except for floating HQ)
  if (!isBagsWorldHQ && token.positionOverride) {
    position = { x: token.positionOverride.x, y: token.positionOverride.y };
  } else if (isBagsWorldHQ) {
    // BagsWorld HQ ALWAYS gets sky position (left side of world)
    position = { x: Math.round(WORLD_WIDTH / 4), y: skyY };
  } else if (existingBuilding) {
    position = { x: existingBuilding.x, y: existingBuilding.y };
  } else if (landmark.type === "casino") {
    position = { x: Math.round(50 * SCALE), y: landmarkY };
  } else if (landmark.type === "oracle") {
    position = { x: Math.round(200 * SCALE), y: landmarkY };
  } else if (landmark.type === "arcade") {
    position = { x: Math.round(520 * SCALE), y: landmarkY };
  } else if (landmark.type === "pokecenter") {
    position = { x: Math.round(280 * SCALE), y: landmarkY };
  } else if (landmark.type === "treasury") {
    position = { x: WORLD_WIDTH / 2, y: landmarkY };
  } else {
    position = generateBuildingPosition(index, MAX_BUILDINGS);
  }

  // Determine token URL based on type
  const isStarterToken = token.mint.startsWith("Starter");
  let tokenUrl: string | undefined;
  if (landmark.type === "treasury") {
    tokenUrl = `https://solscan.io/account/${token.creator}`;
  } else if (!isStarterToken) {
    tokenUrl = `https://bags.fm/${token.mint}`;
  }

  // Health source priority:
  // 1. DB persisted health (token.currentHealth) - survives serverless cold starts
  // 2. In-memory previous building health (existingBuilding?.health) - same instance
  // 3. Default to 50 for new buildings
  const previousHealth = token.currentHealth ?? existingBuilding?.health ?? 50;

  // Pass the last health update timestamp for time-based decay calculation
  const { health: newHealth, status } = calculateBuildingHealth(
    token.volume24h,
    token.marketCap,
    token.change24h,
    previousHealth,
    landmark.isPermanent,
    token.healthOverride,
    token.healthUpdatedAt, // For time-based decay - how long since last calculation
    token.createdAt // For grace period - new buildings get decay immunity
  );

  // Assign zones based on landmark type or hash of mint for user buildings
  const getZoneFromMint = (mint: string): "main_city" | "trending" => {
    let hash = 0;
    for (let i = 0; i < mint.length; i++) {
      hash = (hash << 5) - hash + mint.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash) % 2 === 0 ? "main_city" : "trending";
  };

  // Use zone override if set by admin, otherwise determine zone automatically
  const zone = isBagsWorldHQ
    ? undefined // HQ appears in all zones as the main landmark
    : token.zoneOverride // Admin zone override takes priority
      ? token.zoneOverride
      : landmark.type === "casino" || landmark.type === "oracle" || landmark.type === "arcade"
        ? ("trending" as const)
        : landmark.type === "pokecenter" || landmark.type === "treasury"
          ? ("main_city" as const)
          : getZoneFromMint(token.mint);

  // Use level override if set by admin, otherwise calculate from market cap
  // BagsWorld HQ always gets max level (it's the headquarters!)
  const level = isBagsWorldHQ
    ? 5
    : token.levelOverride && token.levelOverride >= 1 && token.levelOverride <= 5
      ? token.levelOverride
      : calculateBuildingLevel(token.marketCap);

  return {
    id: token.mint,
    tokenMint: token.mint,
    name: token.name,
    symbol: token.symbol,
    x: position.x,
    y: position.y,
    level,
    health: newHealth,
    status, // Decay status for visual effects
    glowing: isBagsWorldHQ || token.change24h > 50, // HQ always glows!
    ownerId: token.creator,
    marketCap: token.marketCap,
    volume24h: token.volume24h,
    change24h: token.change24h,
    tokenUrl,
    zone,
    isFloating: isBagsWorldHQ,
    isPermanent: landmark.isPermanent,
    styleOverride: token.styleOverride,
  };
}

export function generateGameEvent(type: GameEvent["type"], data: GameEvent["data"]): GameEvent {
  const messages: Record<GameEvent["type"], (data: GameEvent["data"]) => string> = {
    token_launch: (d) => `🏗️ ${d?.username} launched ${d?.tokenName}!`,
    building_constructed: (d) => `🏢 New building: ${d?.tokenName} constructed!`,
    fee_claim: (d) => `💰 ${d?.username} claimed ${d?.amount?.toFixed(2)} SOL`,
    price_pump: (d) => `📈 ${d?.tokenName} pumped ${d?.change?.toFixed(0)}%!`,
    price_dump: (d) => `📉 ${d?.tokenName} dumped ${Math.abs(d?.change ?? 0).toFixed(0)}%`,
    milestone: (d) => `🏆 ${d?.username} reached ${d?.amount} SOL earned!`,
    whale_alert: (d) => `🐋 Whale activity on ${d?.tokenName}!`,
    platform_launch: (d) => `🚀 New on Bags.fm: ${d?.tokenName} launched`,
    platform_trending: (d) => `📊 ${d?.tokenName} trending on Bags.fm`,
    platform_claim: (d) =>
      `💰 ${d?.username || "Someone"} claimed ${d?.amount?.toFixed(2) || "?"} SOL from ${d?.tokenName || "Bags.fm"}`,
    task_posted: (d) => `📋 ${d?.username || "Agent"} posted a bounty: ${d?.tokenName || "task"}`,
    task_claimed: (d) => `🔨 ${d?.username || "Agent"} claimed a bounty`,
    task_completed: (d) => `✅ Bounty completed by ${d?.username || "Agent"}`,
    a2a_message: (d) => `💬 ${d?.username || "Agent"} sent an A2A message`,
    corp_founded: (d) => `🏛️ ${d?.username || "Agent"} founded a corp`,
    corp_joined: (d) => `🏛️ ${d?.username || "Agent"} joined a corp`,
    corp_mission_complete: (d) => `🎯 Corp mission completed: ${d?.tokenName || "mission"}`,
    corp_payroll: (d) => `💵 Corp payroll distributed`,
    corp_service: (d) => `📄 ${d?.username || "Agent"} posted a service task`,
  };

  return {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    type,
    message: messages[type](data),
    timestamp: Date.now(),
    data,
  };
}

export interface BagsHealthMetrics {
  claimVolume24h: number; // Total SOL claimed in 24h
  totalLifetimeFees: number; // Total lifetime fees across all tokens
  activeTokenCount: number; // Number of tokens with recent activity
}

// BagsWorld token holder for Ballers Valley mansions
export interface BagsWorldHolder {
  address: string;
  balance: number;
  percentage: number;
  rank: number;
}

// Ballers Valley mansion positions - RANK-BASED LAYOUT
// #1 WHALE gets center position (largest), #2-3 flank it, #4-5 on edges
// Canvas is 1280px wide (800 * 1.6 SCALE), center is 640 (unscaled) or 1024 (scaled)
const BALLERS_POSITIONS = [
  { x: Math.round(400 * SCALE), y: SIDEWALK_GROUND_Y, scale: 1.5 }, // #1 - CENTER, largest (the whale)
  { x: Math.round(200 * SCALE), y: SIDEWALK_GROUND_Y, scale: 1.3 }, // #2 - left of center
  { x: Math.round(600 * SCALE), y: SIDEWALK_GROUND_Y, scale: 1.3 }, // #3 - right of center
  { x: Math.round(80 * SCALE), y: SIDEWALK_GROUND_Y, scale: 1.15 }, // #4 - far left edge
  { x: Math.round(720 * SCALE), y: SIDEWALK_GROUND_Y, scale: 1.15 }, // #5 - far right edge
];

// BagsWorld token mint for mansions
const BAGSWORLD_TOKEN_MINT = "9auyeHWESnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS";

// Unique landmark names for Ballers Valley mansions (by rank, matching actual building colors)
const MANSION_LANDMARKS = [
  { name: "Grand Palace", symbol: "PALACE" }, // #1 - Blue & Gold domed palace (center)
  { name: "Obsidian Tower", symbol: "OBSIDIAN" }, // #2 - Black & Gold Victorian tower
  { name: "Amethyst Chateau", symbol: "AMETHYST" }, // #3 - Purple French chateau with turrets
  { name: "Platinum Estate", symbol: "PLATINUM" }, // #4 - Gray/Silver Art Deco modern
  { name: "Emerald Manor", symbol: "EMERALD" }, // #5 - Green Colonial manor
];

/**
 * Create mansion buildings for top BagsWorld token holders
 * Positions are rank-based: #1 WHALE in center (largest), #2-3 flanking, #4-5 on edges
 * Mansions are permanent landmarks like BagsWorld HQ and Rewards Center
 */
export function createMansionBuildings(holders: BagsWorldHolder[]): GameBuilding[] {
  return holders.slice(0, 5).map((holder, index) => {
    const position = BALLERS_POSITIONS[index];
    const landmark = MANSION_LANDMARKS[index];

    return {
      id: `mansion_${landmark.symbol.toLowerCase()}`,
      tokenMint: BAGSWORLD_TOKEN_MINT,
      name: landmark.name,
      symbol: landmark.symbol,
      x: position.x,
      y: position.y,
      level: 6, // Special mansion level (above normal max of 5)
      health: 100, // Mansions always healthy
      status: "active" as BuildingStatus,
      glowing: true, // Mansions always glow
      ownerId: holder.address,
      zone: "ballers" as const,
      isMansion: true,
      isPermanent: true, // Permanent landmarks like BagsWorld HQ
      holderRank: holder.rank,
      holderAddress: holder.address,
      holderBalance: holder.balance,
      mansionScale: position.scale, // Rank-based scaling (#1 is 1.5x, #2-3 are 1.3x, etc.)
      tokenUrl: `https://solscan.io/account/${holder.address}`,
    };
  });
}

export function buildWorldState(
  earners: FeeEarner[],
  tokens: TokenInfo[],
  previousState?: WorldState,
  bagsMetrics?: BagsHealthMetrics,
  bagsWorldHolders?: BagsWorldHolder[]
): WorldState {
  // Calculate health from Bags.fm metrics (fee claims, lifetime fees)
  // Falls back to token count if no metrics provided
  const claimVolume24h = bagsMetrics?.claimVolume24h ?? 0;
  const totalLifetimeFees =
    bagsMetrics?.totalLifetimeFees ?? tokens.reduce((sum, t) => sum + (t.lifetimeFees || 0), 0);
  const activeTokenCount =
    bagsMetrics?.activeTokenCount ?? tokens.filter((t) => (t.lifetimeFees || 0) > 0).length;
  const buildingCount = tokens.filter((t) => !t.isPlatform).length;

  const health = calculateWorldHealth(
    claimVolume24h,
    totalLifetimeFees,
    activeTokenCount,
    buildingCount
  );
  const weather = calculateWeather(health);

  // Transform earners to characters (keep positions from previous state)
  const previousCharacters = new Map(previousState?.population.map((c) => [c.id, c]));
  const population = earners
    .slice(0, MAX_CHARACTERS)
    .map((earner) => transformFeeEarnerToCharacter(earner, previousCharacters.get(earner.wallet)));

  // Transform tokens to buildings (keep positions from previous state)
  const previousBuildings = new Map(previousState?.buildings.map((b) => [b.id, b]));

  // Only registered tokens become buildings (platform-discovered tokens contribute to health only)
  const buildableTokens = tokens.filter((t) => !t.isPlatform);
  const allBuildings = buildableTokens.map((token, index) =>
    transformTokenToBuilding(token, index, previousBuildings.get(token.mint))
  );

  // Decay system: Filter and sort buildings
  const DECAY_THRESHOLD = ECOSYSTEM_CONFIG.buildings.decay.thresholds.remove;
  const filteredBuildings = allBuildings
    // Keep permanent/floating buildings and buildings above decay threshold
    .filter((b) => {
      // Permanent and floating buildings never get removed
      if (b.isPermanent || b.isFloating) return true;
      return b.health > DECAY_THRESHOLD;
    })
    // Sort by: permanent/floating first, then by volume/activity, then by health
    .sort((a, b) => {
      const aIsPermanent = a.isPermanent || a.isFloating;
      const bIsPermanent = b.isPermanent || b.isFloating;
      if (aIsPermanent && !bIsPermanent) return -1;
      if (!aIsPermanent && bIsPermanent) return 1;
      // Sort by volume (most active first)
      const aVolume = a.volume24h ?? 0;
      const bVolume = b.volume24h ?? 0;
      if (aVolume !== bVolume) return bVolume - aVolume;
      // Then by health
      return b.health - a.health;
    })
    // Limit to max buildings
    .slice(0, MAX_BUILDINGS);

  // Get the set of active building mints for cache cleanup
  const activeMints = new Set(filteredBuildings.map((b) => b.id));

  // Clean up position cache for removed buildings
  cleanupBuildingPositionCache(activeMints);

  // Assign cached positions (buildings keep their position even when rankings change)
  const regularBuildings = filteredBuildings.map((building) => {
    // Landmark/permanent buildings use fixed positions
    if (building.isPermanent || building.isFloating) {
      return building;
    }
    return {
      ...building,
      ...getCachedBuildingPosition(building.id, activeMints),
    };
  });

  // Create mansion buildings for Ballers Valley from top BagsWorld token holders
  const mansionBuildings = bagsWorldHolders ? createMansionBuildings(bagsWorldHolders) : [];

  // Combine regular buildings with mansion buildings
  const buildings = [...regularBuildings, ...mansionBuildings];

  // Generate events for significant changes
  const events: GameEvent[] = previousState?.events.slice(0, 10) ?? [];

  // Check for new launches
  const previousBuildingIds = new Set(previousBuildings.keys());
  buildings.forEach((b) => {
    if (!previousBuildingIds.has(b.id)) {
      const owner = population.find((c) => c.id === b.ownerId);
      events.unshift(
        generateGameEvent("token_launch", {
          username: owner?.username ?? "Unknown",
          tokenName: b.name,
        })
      );
    }
  });

  // Check for price pumps/dumps
  tokens.forEach((token) => {
    const prevBuilding = previousBuildings.get(token.mint);
    if (prevBuilding) {
      const prevHealth = prevBuilding.health;
      const { health: newHealth } = calculateBuildingHealth(
        token.volume24h,
        token.marketCap,
        token.change24h,
        prevHealth,
        prevBuilding.isPermanent || prevBuilding.isFloating
      );

      if (token.change24h > 100 && newHealth > prevHealth + 20) {
        events.unshift(
          generateGameEvent("price_pump", {
            tokenName: token.name,
            change: token.change24h,
          })
        );
      } else if (token.change24h < -30 && newHealth < prevHealth - 20) {
        events.unshift(
          generateGameEvent("price_dump", {
            tokenName: token.name,
            change: token.change24h,
          })
        );
      }
    }
  });

  return {
    health,
    weather,
    population,
    buildings,
    events: events.slice(0, 20),
    lastUpdated: Date.now(),
  };
}
