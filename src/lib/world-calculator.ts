import type {
  WeatherType,
  WorldState,
  GameCharacter,
  GameBuilding,
  GameEvent,
  FeeEarner,
  TokenInfo,
} from "./types";

// Constants for world calculations
const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 600;
const BUILDING_SPACING = 120; // Increased spacing to prevent overlap
const MAX_BUILDINGS = 20;
const MAX_CHARACTERS = 15;

// Volume thresholds for world health (in SOL)
const VOLUME_THRESHOLDS = {
  thriving: 10000,
  healthy: 5000,
  normal: 2000,
  struggling: 500,
  dying: 100,
};

export function calculateWorldHealth(
  totalVolume24h: number,
  avgVolume: number
): number {
  if (avgVolume === 0) return 50;

  const ratio = totalVolume24h / avgVolume;

  if (ratio > 1.5) return Math.min(100, 80 + ratio * 10);
  if (ratio > 1.0) return 70 + (ratio - 1.0) * 20;
  if (ratio > 0.5) return 50 + (ratio - 0.5) * 40;
  if (ratio > 0.2) return 25 + (ratio - 0.2) * 83;
  return Math.max(0, ratio * 125);
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

  // GROUND LEVEL: Buildings sit on the ground (y=540 is the path/ground area)
  // Buildings use origin(0.5, 1), so y position is their bottom edge
  // Stack rows upward from ground level with spacing
  const GROUND_Y = 540; // Where buildings sit on the ground
  const ROW_SPACING = 100; // Vertical spacing between rows (slightly less than horizontal)

  // Front row (row 0) is at ground level, subsequent rows stack upward (behind)
  const baseY = GROUND_Y - row * ROW_SPACING;

  // Use seeded random for consistent small offsets based on index
  const offsetX = (seededRandom(index * 7 + 1) * 16 - 8);
  const offsetY = (seededRandom(index * 13 + 2) * 12 - 6); // Smaller Y offset

  return {
    x: rowStartX + col * BUILDING_SPACING + offsetX,
    y: baseY + offsetY,
  };
}

export function generateCharacterPosition(): { x: number; y: number } {
  // Characters walk on the ground/path area (around y=555)
  // Small Y variation so they're not all in a perfect line
  return {
    x: 50 + Math.random() * (WORLD_WIDTH - 100),
    y: 550 + Math.random() * 15, // Ground level with slight variation
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

  const position = existingCharacter
    ? { x: existingCharacter.x, y: existingCharacter.y }
    : isToly
    ? { x: WORLD_WIDTH / 2, y: 555 } // Center X, on the ground
    : isAsh
    ? { x: WORLD_WIDTH - 120, y: 555 } // Right side of world
    : isFinn
    ? { x: 120, y: 555 } // Left side of world
    : generateCharacterPosition();

  const isSpecialCharacter = isToly || isAsh || isFinn;

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
    profileUrl: isToly ? "https://x.com/toly" : isFinn ? "https://x.com/finnbags" : isAsh ? undefined : getProfileUrl(earner.provider, earner.username),
    isToly, // Pass through the Toly flag
    isAsh, // Pass through the Ash flag
    isFinn, // Pass through the Finn flag
  };
}

export function transformTokenToBuilding(
  token: TokenInfo,
  index: number,
  existingBuilding?: GameBuilding
): GameBuilding {
  const position = existingBuilding
    ? { x: existingBuilding.x, y: existingBuilding.y }
    : generateBuildingPosition(index, MAX_BUILDINGS);

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
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    message: messages[type](data),
    timestamp: Date.now(),
    data,
  };
}

export function buildWorldState(
  earners: FeeEarner[],
  tokens: TokenInfo[],
  previousState?: WorldState
): WorldState {
  // Calculate total 24h volume
  const totalVolume = tokens.reduce((sum, t) => sum + t.volume24h, 0);
  const avgVolume = VOLUME_THRESHOLDS.normal;

  const health = calculateWorldHealth(totalVolume, avgVolume);
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
  const buildings = allBuildings
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
    .slice(0, MAX_BUILDINGS)
    // Reassign positions based on new order
    .map((building, index) => ({
      ...building,
      ...generateBuildingPosition(index, MAX_BUILDINGS),
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
