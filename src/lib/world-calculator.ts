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
// Based on 24h claim volume and lifetime fees
const BAGS_HEALTH_THRESHOLDS = {
  // 24h claim volume thresholds (SOL claimed in last 24h)
  claimVolume: {
    thriving: 50,    // 50+ SOL claimed in 24h = thriving
    healthy: 20,     // 20+ SOL claimed
    normal: 5,       // 5+ SOL claimed
    struggling: 1,   // 1+ SOL claimed
    dying: 0,        // No claims
  },
  // Lifetime fees weight (total fees across all tokens)
  lifetimeFees: {
    thriving: 1000,  // 1000+ SOL lifetime = established ecosystem
    healthy: 500,
    normal: 100,
    struggling: 10,
    dying: 0,
  },
};

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

  // Weight: 60% claim activity, 30% lifetime fees, 10% token diversity
  const claimThresholds = BAGS_HEALTH_THRESHOLDS.claimVolume;
  const feeThresholds = BAGS_HEALTH_THRESHOLDS.lifetimeFees;

  // Calculate claim volume score (0-100)
  let claimScore = 0;
  if (claimVolume24h >= claimThresholds.thriving) {
    claimScore = 90 + Math.min(10, (claimVolume24h - claimThresholds.thriving) / 10);
  } else if (claimVolume24h >= claimThresholds.healthy) {
    claimScore = 70 + (claimVolume24h - claimThresholds.healthy) / (claimThresholds.thriving - claimThresholds.healthy) * 20;
  } else if (claimVolume24h >= claimThresholds.normal) {
    claimScore = 50 + (claimVolume24h - claimThresholds.normal) / (claimThresholds.healthy - claimThresholds.normal) * 20;
  } else if (claimVolume24h >= claimThresholds.struggling) {
    claimScore = 25 + (claimVolume24h - claimThresholds.struggling) / (claimThresholds.normal - claimThresholds.struggling) * 25;
  } else {
    claimScore = Math.max(0, claimVolume24h * 25); // 0-25 for < 1 SOL
  }

  // Calculate lifetime fees score (0-100)
  let feesScore = 0;
  if (totalLifetimeFees >= feeThresholds.thriving) {
    feesScore = 90 + Math.min(10, (totalLifetimeFees - feeThresholds.thriving) / 100);
  } else if (totalLifetimeFees >= feeThresholds.healthy) {
    feesScore = 70 + (totalLifetimeFees - feeThresholds.healthy) / (feeThresholds.thriving - feeThresholds.healthy) * 20;
  } else if (totalLifetimeFees >= feeThresholds.normal) {
    feesScore = 50 + (totalLifetimeFees - feeThresholds.normal) / (feeThresholds.healthy - feeThresholds.normal) * 20;
  } else if (totalLifetimeFees >= feeThresholds.struggling) {
    feesScore = 25 + (totalLifetimeFees - feeThresholds.struggling) / (feeThresholds.normal - feeThresholds.struggling) * 25;
  } else {
    // Defensive: avoid division by zero if threshold is ever 0
    const divisor = feeThresholds.struggling || 1;
    feesScore = Math.max(0, (totalLifetimeFees / divisor) * 25);
  }

  // Calculate token diversity score (0-100)
  // More active tokens = healthier ecosystem
  const diversityScore = Math.min(100, activeTokenCount * 10); // 10 tokens = 100%

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

  // Use seeded random for consistent small offsets based on index (scaled)
  const offsetX = (seededRandom(index * 7 + 1) * Math.round(16 * SCALE) - Math.round(8 * SCALE));
  const offsetY = (seededRandom(index * 13 + 2) * Math.round(12 * SCALE) - Math.round(6 * SCALE)); // Smaller Y offset

  return {
    x: rowStartX + col * BUILDING_SPACING + offsetX,
    y: baseY + offsetY,
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

export function transformFeeEarnerToCharacter(
  earner: FeeEarner,
  existingCharacter?: GameCharacter
): GameCharacter {
  // Toly gets a fixed central position near the Treasury
  const isToly = earner.isToly || earner.wallet === "toly-solana-permanent";
  // Ash gets a position on the right side of the world
  const isAsh = (earner as any).isAsh || earner.wallet === "ash-ketchum-permanent";
  // Finn gets a position on the left side of the world
  const isFinn = (earner as any).isFinn || earner.wallet === "finnbags-ceo-permanent";
  // The Dev gets a position near center-right (trenching area)
  const isDev = (earner as any).isDev || earner.wallet === "daddyghost-dev-permanent";
  // Scout Agent gets a position on far right (watching the horizon)
  const isScout = (earner as any).isScout || earner.wallet === "scout-agent-permanent";
  // CJ gets a position in BagsCity (left side, near the Casino)
  const isCJ = (earner as any).isCJ || earner.wallet === "cj-grove-street-permanent";

  const groundY = Math.round(555 * SCALE);
  const position = existingCharacter
    ? { x: existingCharacter.x, y: existingCharacter.y }
    : isToly
    ? { x: WORLD_WIDTH / 2, y: groundY } // Center X, on the ground
    : isAsh
    ? { x: WORLD_WIDTH - Math.round(120 * SCALE), y: groundY } // Right side of world
    : isFinn
    ? { x: Math.round(120 * SCALE), y: groundY } // Left side of world
    : isDev
    ? { x: WORLD_WIDTH / 2 + Math.round(180 * SCALE), y: groundY } // Center-right, in the trenches
    : isScout
    ? { x: WORLD_WIDTH - Math.round(60 * SCALE), y: groundY } // Far right, watching the horizon
    : isCJ
    ? { x: Math.round(100 * SCALE), y: groundY } // BagsCity, next to the Casino
    : generateCharacterPosition();

  const isSpecialCharacter = isToly || isAsh || isFinn || isDev || isScout || isCJ;

  return {
    id: earner.wallet,
    username: earner.providerUsername || earner.username,
    provider: earner.provider,
    providerUsername: earner.providerUsername,
    avatarUrl: earner.avatarUrl,
    x: position.x,
    y: position.y,
    mood: isSpecialCharacter ? "happy" : calculateCharacterMood(earner.earnings24h, earner.change24h),
    earnings24h: earner.earnings24h,
    direction: Math.random() > 0.5 ? "left" : "right",
    isMoving: !isSpecialCharacter && Math.random() > 0.7, // Special characters don't wander randomly
    buildingId: earner.topToken?.mint,
    profileUrl: isToly ? "https://x.com/toly" : isFinn ? "https://x.com/finnbags" : isDev ? "https://x.com/DaddyGhost" : isAsh || isScout || isCJ ? undefined : getProfileUrl(earner.provider, earner.username),
    isToly, // Pass through the Toly flag
    isAsh, // Pass through the Ash flag
    isFinn, // Pass through the Finn flag
    isDev, // Pass through the Dev flag
    isScout, // Pass through the Scout flag
    isCJ, // Pass through the CJ flag
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

  // Fixed positions for landmark buildings (City side = left, x < center, scaled)
  const landmarkY = Math.round(480 * SCALE);
  let position: { x: number; y: number };
  if (existingBuilding) {
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
    tokenUrl = `https://bags.fm/token/${token.mint}`;
  }

  // Calculate health with decay system (uses previous health for smooth transitions)
  const previousHealth = existingBuilding?.health ?? 50;
  const newHealth = calculateBuildingHealth(token.change24h, token.volume24h, previousHealth);

  // Assign zones: Trading Gym and Casino go to BagsCity, all other buildings go to Park
  const zone = (isTradingGym || isCasino) ? "trending" as const : "main_city" as const;

  return {
    id: token.mint,
    tokenMint: token.mint,
    name: token.name,
    symbol: token.symbol,
    x: position.x,
    y: position.y,
    level: calculateBuildingLevel(token.marketCap),
    health: isTreasuryBuilding || isStarterToken ? 100 : newHealth, // Permanent buildings always healthy
    glowing: token.change24h > 50,
    ownerId: token.creator,
    marketCap: token.marketCap,
    volume24h: token.volume24h,
    change24h: token.change24h,
    tokenUrl,
    zone,
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
  const buildings = filteredBuildings.map((building) => ({
    ...building,
    ...getCachedBuildingPosition(building.id, activeMints),
  }));

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
