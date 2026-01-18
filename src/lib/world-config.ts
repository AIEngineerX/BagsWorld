/**
 * World Configuration - Runtime-adjustable settings for the game world
 *
 * Persistence: Config is stored in Supabase and synced across all server instances.
 * Changes made via Admin Console are immediately saved to database and go live
 * for all users on their next refresh cycle.
 *
 * Flow:
 * 1. Server starts → loads config from Supabase (or uses defaults)
 * 2. Admin changes config → saves to memory + Supabase
 * 3. Other instances → load from Supabase on next getWorldConfig() call
 */

import { loadWorldConfig, saveWorldConfig } from "./supabase";

export interface WorldConfig {
  // Building limits
  maxBuildings: number;
  maxCharacters: number;
  buildingSpacing: number;

  // Filtering thresholds
  minMarketCap: number;
  decayThreshold: number;
  minLifetimeFees: number;

  // Volume thresholds for world health
  volumeThresholds: {
    thriving: number;
    healthy: number;
    normal: number;
    struggling: number;
    dying: number;
  };

  // Refresh settings
  refreshIntervalMs: number;

  // Cache durations (milliseconds)
  cacheDurations: {
    tokenData: number;
    earnerData: number;
    weatherData: number;
    claimEvents: number;
    dexscreener: number;
  };

  // Event thresholds
  eventThresholds: {
    pumpTriggerPercent: number;
    pumpHealthGain: number;
    dumpTriggerPercent: number;
    dumpHealthLoss: number;
    feeMilestones: number[];
  };

  // Day/Night cycle (hours in EST)
  dayNightCycle: {
    nightStart: number;
    nightEnd: number;
    dawnStart: number;
    dawnEnd: number;
    duskStart: number;
    duskEnd: number;
  };

  // Building level tiers (market cap thresholds in USD)
  buildingLevels: {
    level2: number;
    level3: number;
    level4: number;
    level5: number;
  };

  // Character mood thresholds
  moodThresholds: {
    celebratingPriceChange: number;
    happyPriceChange: number;
    happyEarnings24h: number;
    sadPriceChange: number;
  };

  // Health decay system
  healthDecay: {
    decayRate: number;
    recoveryRate: number;
    minVolumeForActive: number;
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
    tokenData: 30000,
    earnerData: 60000,
    weatherData: 300000,
    claimEvents: 15000,
    dexscreener: 60000,
  },

  eventThresholds: {
    pumpTriggerPercent: 100,
    pumpHealthGain: 20,
    dumpTriggerPercent: -30,
    dumpHealthLoss: 20,
    feeMilestones: [1, 5, 10, 50, 100, 500, 1000],
  },

  dayNightCycle: {
    nightStart: 20,
    nightEnd: 6,
    dawnStart: 6,
    dawnEnd: 8,
    duskStart: 18,
    duskEnd: 20,
  },

  buildingLevels: {
    level2: 100000,
    level3: 500000,
    level4: 2000000,
    level5: 10000000,
  },

  moodThresholds: {
    celebratingPriceChange: 100,
    happyPriceChange: 20,
    happyEarnings24h: 1000,
    sadPriceChange: -20,
  },

  healthDecay: {
    decayRate: 5,
    recoveryRate: 10,
    minVolumeForActive: 100,
  },
};

// Runtime state
let currentConfig: WorldConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
let configLoaded = false;
let loadPromise: Promise<void> | null = null;

/**
 * Deep merge helper for nested config objects
 */
function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key in source) {
    if (source[key] !== null && typeof source[key] === "object" && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else if (source[key] !== undefined) {
      result[key] = source[key];
    }
  }
  return result;
}

/**
 * Load config from Supabase (called once on first access)
 */
async function ensureConfigLoaded(): Promise<void> {
  if (configLoaded) return;

  // Prevent multiple simultaneous loads
  if (loadPromise) {
    await loadPromise;
    return;
  }

  loadPromise = (async () => {
    try {
      const stored = await loadWorldConfig();
      if (stored) {
        // Merge stored config with defaults (in case new fields were added)
        currentConfig = deepMerge(DEFAULT_CONFIG, stored);
        console.log("[WorldConfig] Loaded from Supabase");
      } else {
        console.log("[WorldConfig] No stored config, using defaults");
      }
    } catch (error) {
      console.error("[WorldConfig] Failed to load from Supabase:", error);
    } finally {
      configLoaded = true;
      loadPromise = null;
    }
  })();

  await loadPromise;
}

/**
 * Get the current world configuration
 * Loads from Supabase on first call
 */
export function getWorldConfig(): WorldConfig {
  // Trigger async load but return current config immediately
  // This prevents blocking on every call
  if (!configLoaded) {
    ensureConfigLoaded().catch(console.error);
  }
  return JSON.parse(JSON.stringify(currentConfig));
}

/**
 * Get config with guaranteed fresh load from Supabase
 */
export async function getWorldConfigAsync(): Promise<WorldConfig> {
  await ensureConfigLoaded();
  return JSON.parse(JSON.stringify(currentConfig));
}

/**
 * Force reload config from Supabase
 */
export async function reloadWorldConfig(): Promise<WorldConfig> {
  configLoaded = false;
  await ensureConfigLoaded();
  return JSON.parse(JSON.stringify(currentConfig));
}

/**
 * Update world configuration
 * Saves to both memory and Supabase for persistence
 */
export async function updateWorldConfig(
  updates: Partial<WorldConfig>,
  updatedBy?: string
): Promise<WorldConfig> {
  // Ensure we have the latest config first
  await ensureConfigLoaded();

  // Apply updates
  currentConfig = deepMerge(currentConfig, updates);

  // Save to Supabase for persistence
  const saved = await saveWorldConfig(currentConfig as unknown as Record<string, unknown>, updatedBy);
  if (saved) {
    console.log("[WorldConfig] Saved to Supabase by:", updatedBy || "admin");
  } else {
    console.warn("[WorldConfig] Failed to persist to Supabase (changes are memory-only)");
  }

  return JSON.parse(JSON.stringify(currentConfig));
}

/**
 * Reset configuration to defaults
 * Also clears Supabase stored config
 */
export async function resetWorldConfig(updatedBy?: string): Promise<WorldConfig> {
  currentConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

  // Save defaults to Supabase
  await saveWorldConfig(currentConfig as unknown as Record<string, unknown>, updatedBy);

  console.log("[WorldConfig] Reset to defaults by:", updatedBy || "admin");
  return JSON.parse(JSON.stringify(currentConfig));
}

/**
 * Get default configuration (for comparison/reset)
 */
export function getDefaultConfig(): WorldConfig {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}
