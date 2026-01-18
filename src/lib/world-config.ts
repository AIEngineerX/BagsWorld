/**
 * World Configuration - Runtime-adjustable settings for the game world
 *
 * These values can be modified via the Admin Console without redeploying.
 * Changes are stored in memory and reset on server restart.
 * For persistent config, use environment variables or database storage.
 */

export interface WorldConfig {
  // Building limits
  maxBuildings: number;
  maxCharacters: number;
  buildingSpacing: number;

  // Filtering thresholds
  minMarketCap: number;        // Minimum market cap to appear as building ($)
  decayThreshold: number;      // Health below this = building removed
  minLifetimeFees: number;     // Minimum lifetime fees to appear (SOL)

  // Volume thresholds for world health
  volumeThresholds: {
    thriving: number;
    healthy: number;
    normal: number;
    struggling: number;
    dying: number;
  };

  // Refresh settings
  refreshIntervalMs: number;   // How often world state refreshes

  // Cache durations (milliseconds)
  cacheDurations: {
    tokenData: number;         // Token info cache
    earnerData: number;        // Fee earner cache
    weatherData: number;       // Weather API cache
    claimEvents: number;       // Claim events cache
    dexscreener: number;       // Price data cache
  };

  // Event thresholds
  eventThresholds: {
    pumpTriggerPercent: number;      // Price change % to trigger pump event
    pumpHealthGain: number;          // Min health gain for pump event
    dumpTriggerPercent: number;      // Price change % to trigger dump event (negative)
    dumpHealthLoss: number;          // Min health loss for dump event
    feeMilestones: number[];         // SOL amounts that trigger milestone events
  };

  // Day/Night cycle (hours in EST)
  dayNightCycle: {
    nightStart: number;        // Hour when night begins (0-23)
    nightEnd: number;          // Hour when night ends (0-23)
    dawnStart: number;         // Hour when dawn begins
    dawnEnd: number;           // Hour when dawn ends
    duskStart: number;         // Hour when dusk begins
    duskEnd: number;           // Hour when dusk ends
  };

  // Building level tiers (market cap thresholds in USD)
  buildingLevels: {
    level2: number;            // Min market cap for level 2
    level3: number;            // Min market cap for level 3
    level4: number;            // Min market cap for level 4
    level5: number;            // Min market cap for level 5
  };

  // Character mood thresholds
  moodThresholds: {
    celebratingPriceChange: number;  // +% for celebrating mood
    happyPriceChange: number;        // +% for happy mood
    happyEarnings24h: number;        // SOL earnings for happy mood
    sadPriceChange: number;          // -% for sad mood (negative value)
  };

  // Health decay system
  healthDecay: {
    decayRate: number;         // Points lost per cycle when inactive
    recoveryRate: number;      // Points gained per cycle when active
    minVolumeForActive: number; // Minimum volume to be considered "active"
  };
}

// Default configuration
const DEFAULT_CONFIG: WorldConfig = {
  maxBuildings: 20,
  maxCharacters: 15,
  buildingSpacing: 120,

  minMarketCap: 0,
  decayThreshold: 10,
  minLifetimeFees: 0,

  volumeThresholds: {
    thriving: 10000,
    healthy: 5000,
    normal: 2000,
    struggling: 500,
    dying: 100,
  },

  refreshIntervalMs: 30000,

  cacheDurations: {
    tokenData: 30000,          // 30 seconds
    earnerData: 60000,         // 1 minute
    weatherData: 300000,       // 5 minutes
    claimEvents: 15000,        // 15 seconds
    dexscreener: 60000,        // 1 minute
  },

  eventThresholds: {
    pumpTriggerPercent: 100,   // +100% triggers pump
    pumpHealthGain: 20,        // Must gain 20+ health
    dumpTriggerPercent: -30,   // -30% triggers dump
    dumpHealthLoss: 20,        // Must lose 20+ health
    feeMilestones: [1, 5, 10, 50, 100, 500, 1000],
  },

  dayNightCycle: {
    nightStart: 20,            // 8 PM
    nightEnd: 6,               // 6 AM
    dawnStart: 6,              // 6 AM
    dawnEnd: 8,                // 8 AM
    duskStart: 18,             // 6 PM
    duskEnd: 20,               // 8 PM
  },

  buildingLevels: {
    level2: 100000,            // $100K
    level3: 500000,            // $500K
    level4: 2000000,           // $2M
    level5: 10000000,          // $10M
  },

  moodThresholds: {
    celebratingPriceChange: 100,  // +100%
    happyPriceChange: 20,         // +20%
    happyEarnings24h: 1000,       // 1000 SOL
    sadPriceChange: -20,          // -20%
  },

  healthDecay: {
    decayRate: 5,              // Lose 5 pts when inactive
    recoveryRate: 10,          // Gain 10 pts when active
    minVolumeForActive: 100,   // $100 min volume
  },
};

// Runtime configuration (mutable)
let currentConfig: WorldConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

/**
 * Get the current world configuration
 */
export function getWorldConfig(): WorldConfig {
  return JSON.parse(JSON.stringify(currentConfig));
}

/**
 * Update world configuration (partial update supported)
 * Handles nested objects properly
 */
export function updateWorldConfig(updates: Partial<WorldConfig>): WorldConfig {
  // Deep merge helper
  const deepMerge = (target: any, source: any): any => {
    const result = { ...target };
    for (const key in source) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = deepMerge(target[key] || {}, source[key]);
      } else if (source[key] !== undefined) {
        result[key] = source[key];
      }
    }
    return result;
  };

  currentConfig = deepMerge(currentConfig, updates);
  console.log("[WorldConfig] Updated:", JSON.stringify(currentConfig, null, 2));
  return JSON.parse(JSON.stringify(currentConfig));
}

/**
 * Reset configuration to defaults
 */
export function resetWorldConfig(): WorldConfig {
  currentConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  console.log("[WorldConfig] Reset to defaults");
  return JSON.parse(JSON.stringify(currentConfig));
}

/**
 * Get default configuration (for comparison)
 */
export function getDefaultConfig(): WorldConfig {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}
