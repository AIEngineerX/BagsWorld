import type {
  WeatherType,
  WorldState,
  GameCharacter,
  GameBuilding,
  GameEvent,
  FeeEarner,
  TokenInfo,
} from "./types";

// Constants for world calculations (scaled for 1280x960 canvas)
const SCALE = 1.6;
const WORLD_WIDTH = 1280;
const WORLD_HEIGHT = 960;
const BUILDING_SPACING = Math.round(120 * SCALE); // Increased spacing to prevent overlap
const MAX_BUILDINGS = 20;
const MAX_CHARACTERS = 15;

// Bags.fm fee activity thresholds for world health (in SOL)
interface HealthThresholds {
  thriving: number;
  healthy: number;
  normal: number;
  struggling: number;
}

const CLAIM_THRESHOLDS: HealthThresholds = { thriving: 50, healthy: 20, normal: 5, struggling: 1 };
const FEE_THRESHOLDS: HealthThresholds = { thriving: 1000, healthy: 500, normal: 100, struggling: 10 };

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
  // Level thresholds based on market cap
  // Level 1: Small startup (<$100K) - Small gray shop
  // Level 2: Growing project ($100K-$500K) - Blue office
  // Level 3: Established token ($500K-$2M) - Purple corp building
  // Level 4: Major token ($2M-$10M) - Blue tower
  // Level 5: Top tier ($10M+) - Bags green skyscraper
  if (marketCap >= 10000000) return 5; // $10M+
  if (marketCap >= 2000000) return 4; // $2M+
  if (marketCap >= 500000) return 3; // $500K+
  if (marketCap >= 100000) return 2; // $100K+
  return 1;
}

export function calculateBuildingHealth(
  change24h: number,
  volume24h: number = 0,
  previousHealth: number = 50
): number {
  // Base health from price change
  const normalized = Math.max(-100, Math.min(100, change24h));
  const changeBasedHealth = 50 + normalized * 0.5;

  // Activity-based decay/recovery
  const MIN_VOLUME = 100; // Minimum volume to be considered "active"
  const DECAY_RATE = 5;
  const RECOVER_RATE = 10;

  let activityAdjustment = 0;
  if (volume24h < MIN_VOLUME) {
    // No activity - decay
    activityAdjustment = -DECAY_RATE;
  } else {
    // Active - recover toward base health
    activityAdjustment = RECOVER_RATE;
  }

  // Blend previous health with new calculation (smooth transitions)
  const blendedHealth = previousHealth * 0.7 + changeBasedHealth * 0.3 + activityAdjustment;

  return Math.round(Math.max(0, Math.min(100, blendedHealth)));
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

export function generateBuildingPosition(
  index: number,
  total: number
): { x: number; y: number } {
  // Use a fixed grid layout with deterministic small offsets
  const maxCols = 5; // Maximum 5 buildings per row
  const actualTotal = Math.min(total, MAX_BUILDINGS);
  const rows = Math.ceil(actualTotal / maxCols);

  const row = Math.floor(index / maxCols);
  const col = index % maxCols;

  // Calculate how many buildings in this row
  const buildingsInThisRow = row < rows - 1 ? maxCols : actualTotal - (rows - 1) * maxCols;

  // Center the buildings horizontally
  const totalRowWidth = buildingsInThisRow * BUILDING_SPACING;
  const rowStartX = (WORLD_WIDTH - totalRowWidth) / 2 + BUILDING_SPACING / 2;

  // GROUND LEVEL: Buildings sit on the ground (y=540 is the path/ground area, scaled)
  // Buildings use origin(0.5, 1), so y position is their bottom edge
  // Stack rows upward from ground level with spacing
  const GROUND_Y = Math.round(540 * SCALE); // Where buildings sit on the ground
  const ROW_SPACING = Math.round(100 * SCALE); // Vertical spacing between rows (slightly less than horizontal)

  // Front row (row 0) is at ground level, subsequent rows stack upward (behind)
  const baseY = GROUND_Y - row * ROW_SPACING;

  // Use seeded random for consistent small X offset based on index (scaled)
  // Y offset removed - buildings now snap to consistent ground level per row
  const offsetX = (seededRandom(index * 7 + 1) * Math.round(16 * SCALE) - Math.round(8 * SCALE));

  return {
    x: rowStartX + col * BUILDING_SPACING + offsetX,
    y: baseY, // Snap to ground level (no random Y offset)
  };
}

/**
 * Get or create a cached position for a building by its mint address.
 * This prevents buildings from shifting when rankings change.
 */
export function getCachedBuildingPosition(
  mint: string,
  existingBuildings: Set<string>
): { x: number; y: number } {
  // Check if we already have a cached position for this mint
  const cached = buildingPositionCache.get(mint);
  if (cached) {
    return { x: cached.x, y: cached.y };
  }

  // Find the next available index that's not in use
  // First, collect all used indices
  const usedIndices = new Set<number>();
  buildingPositionCache.forEach((pos) => {
    usedIndices.add(pos.assignedIndex);
  });

  // Find the lowest available index
  let assignedIndex = 0;
  while (usedIndices.has(assignedIndex) && assignedIndex < MAX_BUILDINGS) {
    assignedIndex++;
  }

  // Generate position based on assigned index
  const position = generateBuildingPosition(assignedIndex, MAX_BUILDINGS);

  // Cache it
  buildingPositionCache.set(mint, {
    x: position.x,
    y: position.y,
    assignedIndex,
  });

  return position;
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

// Special character configuration - consolidates flags, positions, zones, and profile URLs
const SPECIAL_CHARACTERS: Record<string, {
  flag: string;
  wallet: string;
  x: number;
  zone: "main_city" | "trending";
  profileUrl?: string;
}> = {
  toly: { flag: "isToly", wallet: "toly-solana-permanent", x: WORLD_WIDTH / 2, zone: "main_city", profileUrl: "https://x.com/toly" },
  ash: { flag: "isAsh", wallet: "ash-ketchum-permanent", x: WORLD_WIDTH - Math.round(120 * SCALE), zone: "main_city" },
  finn: { flag: "isFinn", wallet: "finnbags-ceo-permanent", x: Math.round(120 * SCALE), zone: "main_city", profileUrl: "https://x.com/finnbags" },
  dev: { flag: "isDev", wallet: "daddyghost-dev-permanent", x: WORLD_WIDTH / 2 + Math.round(180 * SCALE), zone: "main_city", profileUrl: "https://x.com/DaddyGhost" },
  scout: { flag: "isScout", wallet: "scout-agent-permanent", x: Math.round(170 * SCALE), zone: "trending" },
  cj: { flag: "isCJ", wallet: "cj-grove-street-permanent", x: Math.round(90 * SCALE), zone: "trending" },
  shaw: { flag: "isShaw", wallet: "shaw-elizaos-permanent", x: WORLD_WIDTH / 2 - Math.round(150 * SCALE), zone: "main_city", profileUrl: "https://x.com/shawmakesmagic" },
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
  };

  // Determine position
  const position = existingCharacter
    ? { x: existingCharacter.x, y: existingCharacter.y }
    : specialCfg
    ? { x: specialCfg.x, y: groundY }
    : generateCharacterPosition();

  // Determine profile URL
  const profileUrl = specialCfg?.profileUrl ?? (isSpecial ? undefined : getProfileUrl(earner.provider, earner.username));

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
    isMoving: !isSpecial && Math.random() > 0.7,
    buildingId: earner.topToken?.mint,
    profileUrl,
    zone: specialCfg?.zone ?? "main_city",
    ...flags,
  };
}

export function transformTokenToBuilding(
  token: TokenInfo,
  index: number,
  existingBuilding?: GameBuilding
): GameBuilding {
  // Special landmark buildings get fixed positions
  const isPokeCenter = token.symbol === "POKECENTER" || token.mint.includes("PokeCenter");
  const isTradingGym = token.symbol === "GYM" || token.mint.includes("TradingGym");
  const isCasino = token.symbol === "CASINO" || token.mint.includes("Casino");
  const isTreasuryHub = token.mint.startsWith("Treasury");
  // BagsWorld HQ - the floating headquarters in the sky (uses real token data)
  const BAGSHQ_MINT = "9auyeHWESnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS";
  const isBagsWorldHQ = token.mint === BAGSHQ_MINT || token.symbol === "BAGSWORLD";

  // Always clear HQ from position cache to ensure it uses sky position
  if (isBagsWorldHQ) {
    buildingPositionCache.delete(BAGSHQ_MINT);
  }

  // Fixed positions for landmark buildings (City side = left, x < center, scaled)
  const landmarkY = Math.round(480 * SCALE);
  const skyY = 500; // Floating in the sky above the city skyline
  let position: { x: number; y: number };

  // BagsWorld HQ ALWAYS gets sky position - check this FIRST
  if (isBagsWorldHQ) {
    // BagsWorld HQ: Floating in the sky, center of the park
    position = { x: Math.round(WORLD_WIDTH / 2), y: skyY };
  } else if (existingBuilding) {
    // Use existing position for other buildings
    position = { x: existingBuilding.x, y: existingBuilding.y };
  } else if (isCasino) {
    // Casino: BagsCity side (far left), Vegas-style landmark
    position = { x: Math.round(80 * SCALE), y: landmarkY };
  } else if (isTradingGym) {
    // Trading Gym: BagsCity side, prominent position
    position = { x: Math.round(150 * SCALE), y: landmarkY };
  } else if (isPokeCenter) {
    // PokeCenter: Park side (center-right)
    position = { x: Math.round(280 * SCALE), y: landmarkY };
  } else if (isTreasuryHub) {
    // Treasury: Center position
    position = { x: WORLD_WIDTH / 2, y: landmarkY };
  } else {
    position = generateBuildingPosition(index, MAX_BUILDINGS);
  }

  // Check if this is a real token (not a starter/placeholder/treasury)
  const isStarterToken = token.mint.startsWith("Starter");
  const isTreasuryBuilding = token.mint.startsWith("Treasury");

  // Treasury links to Solscan, real tokens link to Bags.fm, starters have no link
  let tokenUrl: string | undefined;
  if (isTreasuryBuilding) {
    // Link to Solscan so users can verify the treasury wallet
    tokenUrl = `https://solscan.io/account/${token.creator}`;
  } else if (!isStarterToken) {
    tokenUrl = `https://bags.fm/${token.mint}`;
  }

  // Calculate health with decay system (uses previous health for smooth transitions)
  const previousHealth = existingBuilding?.health ?? 50;
  const newHealth = calculateBuildingHealth(token.change24h, token.volume24h, previousHealth);

  // Assign zones:
  // - BagsWorld HQ has NO zone - floats in the sky visible from both zones
  // - Trading Gym and Casino go to BagsCity (trending)
  // - User-created buildings are distributed between Park (main_city) and BagsCity (trending)
  //   based on a hash of their mint address for deterministic, even distribution
  const getZoneFromMint = (mint: string): "main_city" | "trending" => {
    let hash = 0;
    for (let i = 0; i < mint.length; i++) {
      hash = ((hash << 5) - hash) + mint.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash) % 2 === 0 ? "main_city" : "trending";
  };

  const zone = isBagsWorldHQ ? undefined
    : (isTradingGym || isCasino) ? "trending" as const
    : (isPokeCenter || isTreasuryHub) ? "main_city" as const
    : getZoneFromMint(token.mint);

  // Use level override if set by admin, otherwise calculate from market cap
  // BagsWorld HQ always gets max level (it's the headquarters!)
  const level = isBagsWorldHQ ? 5
    : token.levelOverride && token.levelOverride >= 1 && token.levelOverride <= 5
      ? token.levelOverride
      : calculateBuildingLevel(token.marketCap);

  // Permanent buildings (Treasury, Starter, HQ) always have full health
  const isPermanent = isTreasuryBuilding || isStarterToken || isBagsWorldHQ;

  return {
    id: token.mint,
    tokenMint: token.mint,
    name: token.name,
    symbol: token.symbol,
    x: position.x,
    y: position.y,
    level,
    health: isPermanent ? 100 : newHealth,
    glowing: isBagsWorldHQ || token.change24h > 50, // HQ always glows!
    ownerId: token.creator,
    marketCap: token.marketCap,
    volume24h: token.volume24h,
    change24h: token.change24h,
    tokenUrl,
    zone,
    isFloating: isBagsWorldHQ, // Only HQ floats
    isPermanent, // Landmark buildings (Treasury, Starter, HQ)
  };
}

export function generateGameEvent(
  type: GameEvent["type"],
  data: GameEvent["data"]
): GameEvent {
  const messages: Record<GameEvent["type"], (data: GameEvent["data"]) => string> = {
    token_launch: (d) => `🏗️ ${d?.username} launched ${d?.tokenName}!`,
    building_constructed: (d) => `🏢 New building: ${d?.tokenName} constructed!`,
    fee_claim: (d) =>
      `💰 ${d?.username} claimed ${d?.amount?.toFixed(2)} SOL`,
    price_pump: (d) =>
      `📈 ${d?.tokenName} pumped ${d?.change?.toFixed(0)}%!`,
    price_dump: (d) =>
      `📉 ${d?.tokenName} dumped ${Math.abs(d?.change ?? 0).toFixed(0)}%`,
    milestone: (d) => `🏆 ${d?.username} reached ${d?.amount} SOL earned!`,
    whale_alert: (d) => `🐋 Whale activity on ${d?.tokenName}!`,
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
  claimVolume24h: number;      // Total SOL claimed in 24h
  totalLifetimeFees: number;   // Total lifetime fees across all tokens
  activeTokenCount: number;    // Number of tokens with recent activity
}

export function buildWorldState(
  earners: FeeEarner[],
  tokens: TokenInfo[],
  previousState?: WorldState,
  bagsMetrics?: BagsHealthMetrics
): WorldState {
  // Calculate health from Bags.fm metrics (fee claims, lifetime fees)
  // Falls back to token count if no metrics provided
  const claimVolume24h = bagsMetrics?.claimVolume24h ?? 0;
  const totalLifetimeFees = bagsMetrics?.totalLifetimeFees ?? tokens.reduce((sum, t) => sum + (t.lifetimeFees || 0), 0);
  const activeTokenCount = bagsMetrics?.activeTokenCount ?? tokens.filter(t => (t.lifetimeFees || 0) > 0).length;
  const buildingCount = tokens.length;

  const health = calculateWorldHealth(claimVolume24h, totalLifetimeFees, activeTokenCount, buildingCount);
  const weather = calculateWeather(health);

  // Transform earners to characters (keep positions from previous state)
  const previousCharacters = new Map(
    previousState?.population.map((c) => [c.id, c])
  );
  const population = earners.slice(0, MAX_CHARACTERS).map((earner) =>
    transformFeeEarnerToCharacter(earner, previousCharacters.get(earner.wallet))
  );

  // Transform tokens to buildings (keep positions from previous state)
  const previousBuildings = new Map(
    previousState?.buildings.map((b) => [b.id, b])
  );

  // Transform all tokens to buildings first
  const allBuildings = tokens.map((token, index) =>
    transformTokenToBuilding(token, index, previousBuildings.get(token.mint))
  );

  // Decay system: Filter and sort buildings
  const DECAY_THRESHOLD = 10; // Buildings below this health are removed
  const filteredBuildings = allBuildings
    // Keep permanent buildings (Treasury, Starter) and buildings above decay threshold
    .filter((b) => {
      const isPermanent = b.id.startsWith("Treasury") || b.id.startsWith("Starter");
      return isPermanent || b.health > DECAY_THRESHOLD;
    })
    // Sort by: permanent first, then by volume/activity, then by health
    .sort((a, b) => {
      const aIsPermanent = a.id.startsWith("Treasury") || a.id.startsWith("Starter");
      const bIsPermanent = b.id.startsWith("Treasury") || b.id.startsWith("Starter");
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
  // EXCEPT for floating buildings like HQ which have fixed sky positions
  const BAGSHQ_MINT = "9auyeHWESnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS";
  const buildings = filteredBuildings.map((building) => {
    // Skip cache for floating buildings - they use their fixed position
    if (building.isFloating || building.id === BAGSHQ_MINT) {
      return building;
    }
    return {
      ...building,
      ...getCachedBuildingPosition(building.id, activeMints),
    };
  });

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
      const newHealth = calculateBuildingHealth(token.change24h);

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
