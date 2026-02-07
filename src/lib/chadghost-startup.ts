/**
 * ChadGhost Startup - MoltBook Agent Initialization
 * Ensures ChadGhost service starts once and only once
 * Runs on: Mac mini (separate from GhostTrader on Railway)
 * Import this file from any server-side code to auto-start
 */

import { startChadGhostService, isChadGhostServiceRunning } from "./chadghost-service";
import { getMoltbookOrNull } from "./moltbook-client";

let startupAttempted = false;

/**
 * Start ChadGhost if not already running
 * Safe to call multiple times - will only start once
 */
export function ensureChadGhostStarted(): void {
  if (startupAttempted) return;
  startupAttempted = true;

  // Check if Moltbook is configured
  const client = getMoltbookOrNull();
  if (!client) {
    console.log("[ChadGhost Startup] Moltbook not configured (MOLTBOOK_API_KEY missing), skipping");
    return;
  }

  // Check if already running
  if (isChadGhostServiceRunning()) {
    console.log("[ChadGhost Startup] Already running");
    return;
  }

  // Start with a delay to let the server fully initialize
  setTimeout(() => {
    console.log("[ChadGhost Startup] Starting ChadGhost service...");
    startChadGhostService();
  }, 10000); // 10 second delay
}

// Auto-start on import (server-side only)
if (typeof window === "undefined") {
  ensureChadGhostStarted();
}
