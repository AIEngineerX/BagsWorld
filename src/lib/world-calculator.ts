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

export function calculateBuildingHealth(change24h: number): number {
  // change24h is percentage, e.g., 50 means +50%
  const normalized = Math.max(-100, Math.min(100, change24h));
  return Math.round(50 + normalized * 0.5);
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
  const cols = Math.min(actualTotal, maxCols);

  const row = Math.floor(index / maxCols);
  const col = index % maxCols;

  // Calculate how many buildings in this row
  const buildingsInThisRow = row < rows - 1 ? maxCols : actualTotal - (rows - 1) * maxCols;

  // Center the buildings horizontally
  const totalRowWidth = buildingsInThisRow * BUILDING_SPACING;
  const rowStartX = (WORLD_WIDTH - totalRowWidth) / 2 + BUILDING_SPACING / 2;

  // Center vertically with some padding from top
  const totalHeight = rows * BUILDING_SPACING;
  const startY = Math.max(150, (WORLD_HEIGHT - totalHeight) / 2 + 80);

  // Use seeded random for consistent small offsets based on index
  const offsetX = (seededRandom(index * 7 + 1) * 16 - 8);
  const offsetY = (seededRandom(index * 13 + 2) * 16 - 8);

  return {
    x: rowStartX + col * BUILDING_SPACING + offsetX,
    y: startY + row * BUILDING_SPACING + offsetY,
  };
}

export function generateCharacterPosition(): { x: number; y: number } {
  return {
    x: 50 + Math.random() * (WORLD_WIDTH - 100),
    y: 200 + Math.random() * (WORLD_HEIGHT - 300),
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
  const position = existingCharacter
    ? { x: existingCharacter.x, y: existingCharacter.y }
    : generateCharacterPosition();

  return {
    id: earner.wallet,
    username: earner.providerUsername || earner.username,
    provider: earner.provider,
    providerUsername: earner.providerUsername,
    avatarUrl: earner.avatarUrl,
    x: position.x,
    y: position.y,
    mood: calculateCharacterMood(earner.earnings24h, earner.change24h),
    earnings24h: earner.earnings24h,
    direction: Math.random() > 0.5 ? "left" : "right",
    isMoving: Math.random() > 0.7,
    buildingId: earner.topToken?.mint,
    profileUrl: getProfileUrl(earner.provider, earner.username),
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

  return {
    id: token.mint,
    tokenMint: token.mint,
    name: token.name,
    symbol: token.symbol,
    x: position.x,
    y: position.y,
    level: calculateBuildingLevel(token.marketCap),
    health: calculateBuildingHealth(token.change24h),
    glowing: token.change24h > 50,
    ownerId: token.creator,
    marketCap: token.marketCap,
    volume24h: token.volume24h,
    change24h: token.change24h,
    tokenUrl: `https://bags.fm/token/${token.mint}`,
  };
}

export function generateGameEvent(
  type: GameEvent["type"],
  data: GameEvent["data"]
): GameEvent {
  const messages: Record<GameEvent["type"], (data: GameEvent["data"]) => string> = {
    token_launch: (d) => `🏗️ ${d?.username} launched ${d?.tokenName}!`,
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
  const buildings = tokens.slice(0, MAX_BUILDINGS).map((token, index) =>
    transformTokenToBuilding(token, index, previousBuildings.get(token.mint))
  );

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
