// Scout Agent - Real-time new token launch scanner
// Monitors Bags.fm/pump.fun for new token launches and alerts the system

import WebSocket from "ws";
import { emitTokenLaunch } from "./agent-coordinator";

// Scout configuration
export interface ScoutConfig {
  enabled: boolean;
  reconnectDelayMs: number;
  filters: {
    minLiquidityUsd: number;
    maxSupply: number | null;
    nameContains: string | null;
    blockedCreators: string[];
    bagsOnly: boolean; // Only track Bags.fm launches
  };
  alertCooldownMs: number; // Prevent spam
  maxAlertsPerMinute: number;
}

// Token launch data from WebSocket
export interface TokenLaunch {
  mint: string;
  name: string;
  symbol: string;
  creator: string;
  liquidity: number;
  supply: number;
  timestamp: number;
  platform: "bags" | "pump" | "unknown";
  uri?: string;
  signature?: string;
}

// Scout state
export interface ScoutState {
  isRunning: boolean;
  isConnected: boolean;
  lastLaunchSeen: number;
  launchesScanned: number;
  alertsSent: number;
  recentLaunches: TokenLaunch[];
  errors: string[];
}

// Alert callback type
export type ScoutAlertCallback = (launch: TokenLaunch) => void;

// Known Bags.fm creator signer
const BAGS_SIGNER = "BAGSB9TpGrZxQbEsrEznv5jXXdwyP6AXerN8aVRiAmcv";

// WebSocket endpoints
const WS_ENDPOINTS = {
  pumpportal: "wss://pumpportal.fun/api/data",
};

// Default configuration
const DEFAULT_CONFIG: ScoutConfig = {
  enabled: true,
  reconnectDelayMs: 5000,
  filters: {
    minLiquidityUsd: 500, // Min $500 liquidity
    maxSupply: null, // No max supply filter
    nameContains: null, // No name filter
    blockedCreators: [], // No blocked creators
    bagsOnly: true, // Only track Bags.fm launches
  },
  alertCooldownMs: 1000, // 1 second between alerts
  maxAlertsPerMinute: 30,
};

// Agent state
let scoutState: ScoutState = {
  isRunning: false,
  isConnected: false,
  lastLaunchSeen: 0,
  launchesScanned: 0,
  alertsSent: 0,
  recentLaunches: [],
  errors: [],
};

let scoutConfig: ScoutConfig = { ...DEFAULT_CONFIG };
let ws: WebSocket | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;
let alertCallbacks: ScoutAlertCallback[] = [];
let alertTimestamps: number[] = [];

// Initialize the scout agent
export function initScoutAgent(config?: Partial<ScoutConfig>): boolean {
  scoutConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    filters: {
      ...DEFAULT_CONFIG.filters,
      ...config?.filters,
    },
  };

  console.log("[Scout Agent] Initialized:", {
    minLiquidity: `$${scoutConfig.filters.minLiquidityUsd}`,
    bagsOnly: scoutConfig.filters.bagsOnly,
    blockedCreators: scoutConfig.filters.blockedCreators.length,
  });

  return true;
}

// Start the scout agent
export function startScoutAgent(): boolean {
  if (scoutState.isRunning) {
    console.log("[Scout Agent] Already running");
    return true;
  }

  scoutState.isRunning = true;
  connect();

  console.log("[Scout Agent] Started - scanning for new tokens");
  return true;
}

// Stop the scout agent
export function stopScoutAgent(): void {
  scoutState.isRunning = false;

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (ws) {
    ws.close();
    ws = null;
  }

  scoutState.isConnected = false;
  console.log("[Scout Agent] Stopped");
}

// Connect to WebSocket
function connect(): void {
  if (!scoutState.isRunning) return;

  try {
    ws = new WebSocket(WS_ENDPOINTS.pumpportal);

    ws.onopen = () => {
      console.log("[Scout Agent] Connected to token stream");
      scoutState.isConnected = true;

      // Subscribe to new token launches
      ws?.send(JSON.stringify({ method: "subscribeNewToken" }));
    };

    ws.onmessage = (event: WebSocket.MessageEvent) => {
      try {
        const data = JSON.parse(event.data.toString());
        handleTokenData(data);
      } catch (err) {
        // Ignore parse errors for non-JSON messages
      }
    };

    ws.onerror = (error: WebSocket.ErrorEvent) => {
      console.error("[Scout Agent] WebSocket error:", error.message);
      addError(`WebSocket error: ${error.message}`);
    };

    ws.onclose = () => {
      console.log("[Scout Agent] Disconnected");
      scoutState.isConnected = false;

      // Reconnect if still running
      if (scoutState.isRunning) {
        reconnectTimeout = setTimeout(() => {
          console.log("[Scout Agent] Reconnecting...");
          connect();
        }, scoutConfig.reconnectDelayMs);
      }
    };
  } catch (error: any) {
    console.error("[Scout Agent] Connection error:", error);
    addError(`Connection error: ${error.message}`);

    // Retry connection
    if (scoutState.isRunning) {
      reconnectTimeout = setTimeout(connect, scoutConfig.reconnectDelayMs);
    }
  }
}

// Handle incoming token data
function handleTokenData(data: any): void {
  // Parse token launch data
  const launch = parseTokenLaunch(data);
  if (!launch) return;

  scoutState.launchesScanned++;
  scoutState.lastLaunchSeen = Date.now();

  // Check if it passes filters
  if (!passesFilters(launch)) {
    return;
  }

  // Add to recent launches
  scoutState.recentLaunches.unshift(launch);
  if (scoutState.recentLaunches.length > 50) {
    scoutState.recentLaunches = scoutState.recentLaunches.slice(0, 50);
  }

  // Rate limit alerts
  if (!canSendAlert()) {
    return;
  }

  // Send alerts
  sendAlerts(launch);
}

// Parse raw WebSocket data into TokenLaunch
function parseTokenLaunch(data: any): TokenLaunch | null {
  try {
    // Handle pumpportal.fun format
    // NOTE: PumpPortal only streams pump.fun launches, NOT Bags.fm launches
    // Bags.fm uses Meteora DBC bonding curves which are on a different system
    if (data.mint && data.name) {
      // PumpPortal data is always from pump.fun
      // Bags.fm launches come through the world-state API, not this WebSocket
      return {
        mint: data.mint,
        name: data.name || "Unknown",
        symbol: data.symbol && data.symbol !== "undefined" ? data.symbol : "???",
        creator: data.traderPublicKey || data.creator || "unknown",
        liquidity: data.vSolInBondingCurve || data.liquidity || 0,
        supply: data.initialBuy || data.supply || 0,
        timestamp: Date.now(),
        platform: "pump", // Always pump.fun from PumpPortal
        uri: data.uri,
        signature: data.signature,
      };
    }

    return null;
  } catch {
    return null;
  }
}

// Check if token passes configured filters
function passesFilters(launch: TokenLaunch): boolean {
  const { filters } = scoutConfig;

  // Bags-only filter
  if (filters.bagsOnly && launch.platform !== "bags") {
    return false;
  }

  // Minimum liquidity
  if (filters.minLiquidityUsd > 0) {
    // Approximate USD value (assuming ~$200/SOL)
    const liquidityUsd = launch.liquidity * 200;
    if (liquidityUsd < filters.minLiquidityUsd) {
      return false;
    }
  }

  // Max supply
  if (filters.maxSupply !== null && launch.supply > filters.maxSupply) {
    return false;
  }

  // Name contains
  if (filters.nameContains) {
    const searchTerm = filters.nameContains.toLowerCase();
    const nameMatch = launch.name.toLowerCase().includes(searchTerm);
    const symbolMatch = launch.symbol.toLowerCase().includes(searchTerm);
    if (!nameMatch && !symbolMatch) {
      return false;
    }
  }

  // Blocked creators
  if (filters.blockedCreators.includes(launch.creator)) {
    return false;
  }

  return true;
}

// Rate limiting for alerts
function canSendAlert(): boolean {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;

  // Clean old timestamps
  alertTimestamps = alertTimestamps.filter((t) => t > oneMinuteAgo);

  // Check rate limit
  if (alertTimestamps.length >= scoutConfig.maxAlertsPerMinute) {
    return false;
  }

  // Check cooldown
  const lastAlert = alertTimestamps[alertTimestamps.length - 1];
  if (lastAlert && now - lastAlert < scoutConfig.alertCooldownMs) {
    return false;
  }

  alertTimestamps.push(now);
  return true;
}

// Send alerts to all registered callbacks
function sendAlerts(launch: TokenLaunch): void {
  scoutState.alertsSent++;

  console.log(`[Scout Agent] New token: ${launch.name} ($${launch.symbol}) - ${launch.platform}`);

  // Emit to Agent Coordinator for cross-agent communication
  emitTokenLaunch(launch).catch((err) => {
    console.error("[Scout Agent] Failed to emit to coordinator:", err);
  });

  for (const callback of alertCallbacks) {
    try {
      callback(launch);
    } catch (error: any) {
      console.error("[Scout Agent] Alert callback error:", error);
    }
  }
}

// Register an alert callback
export function onTokenLaunch(callback: ScoutAlertCallback): () => void {
  alertCallbacks.push(callback);

  // Return unsubscribe function
  return () => {
    alertCallbacks = alertCallbacks.filter((cb) => cb !== callback);
  };
}

// Add error to state
function addError(error: string): void {
  scoutState.errors.push(`${new Date().toISOString()}: ${error}`);
  if (scoutState.errors.length > 10) {
    scoutState.errors = scoutState.errors.slice(-10);
  }
}

// Get current state
export function getScoutState(): ScoutState & { config: ScoutConfig } {
  return {
    ...scoutState,
    config: scoutConfig,
  };
}

// Update configuration
export function updateScoutConfig(config: Partial<ScoutConfig>): ScoutConfig {
  scoutConfig = {
    ...scoutConfig,
    ...config,
    filters: {
      ...scoutConfig.filters,
      ...config.filters,
    },
  };

  return scoutConfig;
}

// Get recent launches
export function getRecentLaunches(count: number = 10): TokenLaunch[] {
  return scoutState.recentLaunches.slice(0, count);
}

// Add a creator to blocklist
export function blockCreator(creatorAddress: string): void {
  if (!scoutConfig.filters.blockedCreators.includes(creatorAddress)) {
    scoutConfig.filters.blockedCreators.push(creatorAddress);
    console.log(`[Scout Agent] Blocked creator: ${creatorAddress}`);
  }
}

// Remove a creator from blocklist
export function unblockCreator(creatorAddress: string): void {
  scoutConfig.filters.blockedCreators = scoutConfig.filters.blockedCreators.filter(
    (c) => c !== creatorAddress
  );
}

// Reset state
export function resetScoutState(): void {
  scoutState = {
    isRunning: false,
    isConnected: false,
    lastLaunchSeen: 0,
    launchesScanned: 0,
    alertsSent: 0,
    recentLaunches: [],
    errors: [],
  };
}

// Manual trigger to check for specific token
export async function checkToken(mint: string): Promise<TokenLaunch | null> {
  try {
    // Fetch token info from Bags API or on-chain
    const response = await fetch(
      `https://public-api-v2.bags.fm/api/v1/token-launch/creator/v3?tokenMint=${mint}`,
      {
        headers: {
          "x-api-key": process.env.BAGS_API_KEY || "",
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return {
      mint,
      name: data.name || "Unknown",
      symbol: data.symbol || "???",
      creator: data.creators?.[0]?.wallet || "unknown",
      liquidity: 0,
      supply: 0,
      timestamp: Date.now(),
      platform: "bags",
    };
  } catch {
    return null;
  }
}
