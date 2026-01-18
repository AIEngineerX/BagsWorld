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
}

// Default configuration
const DEFAULT_CONFIG: WorldConfig = {
  maxBuildings: 20,
  maxCharacters: 15,
  buildingSpacing: 120,

  minMarketCap: 0,             // No minimum by default
  decayThreshold: 10,
  minLifetimeFees: 0,          // No minimum by default

  volumeThresholds: {
    thriving: 10000,
    healthy: 5000,
    normal: 2000,
    struggling: 500,
    dying: 100,
  },

  refreshIntervalMs: 30000,
};

// Runtime configuration (mutable)
let currentConfig: WorldConfig = { ...DEFAULT_CONFIG };

/**
 * Get the current world configuration
 */
export function getWorldConfig(): WorldConfig {
  return { ...currentConfig };
}

/**
 * Update world configuration (partial update supported)
 */
export function updateWorldConfig(updates: Partial<WorldConfig>): WorldConfig {
  currentConfig = {
    ...currentConfig,
    ...updates,
    // Handle nested volumeThresholds separately
    volumeThresholds: {
      ...currentConfig.volumeThresholds,
      ...(updates.volumeThresholds || {}),
    },
  };
  console.log("[WorldConfig] Updated:", currentConfig);
  return { ...currentConfig };
}

/**
 * Reset configuration to defaults
 */
export function resetWorldConfig(): WorldConfig {
  currentConfig = { ...DEFAULT_CONFIG };
  console.log("[WorldConfig] Reset to defaults");
  return { ...currentConfig };
}

/**
 * Get default configuration (for comparison)
 */
export function getDefaultConfig(): WorldConfig {
  return { ...DEFAULT_CONFIG };
}
