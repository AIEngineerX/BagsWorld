// Wild Encounter XP / Level Progression
// Persists player progress in localStorage

import {
  type PlayerProgress,
  type PlayerBattleStats,
  PLAYER_LEVEL_STATS,
  MAX_PLAYER_LEVEL,
} from "./encounter-types";

const STORAGE_KEY = "bagsworld_player_progress";

const DEFAULT_PROGRESS: PlayerProgress = {
  xp: 0,
  level: 1,
  wins: 0,
  losses: 0,
  flees: 0,
};

export function loadProgress(): PlayerProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROGRESS };
    const parsed = JSON.parse(raw) as PlayerProgress;
    // Validate
    if (typeof parsed.level !== "number" || parsed.level < 1) return { ...DEFAULT_PROGRESS };
    return parsed;
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

export function saveProgress(progress: PlayerProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function addXp(amount: number): { progress: PlayerProgress; leveledUp: boolean; newLevel: number } {
  const progress = loadProgress();
  progress.xp += amount;

  let leveledUp = false;
  let newLevel = progress.level;

  // Check for level ups (can level up multiple times from one XP gain)
  while (newLevel < MAX_PLAYER_LEVEL) {
    const nextLevelStats = PLAYER_LEVEL_STATS[newLevel + 1];
    if (nextLevelStats && progress.xp >= nextLevelStats.xpNeeded) {
      newLevel++;
      leveledUp = true;
    } else {
      break;
    }
  }

  progress.level = newLevel;
  saveProgress(progress);

  // Dispatch event for HUD updates
  window.dispatchEvent(new CustomEvent("bagsworld-xp-changed", { detail: { progress, leveledUp, newLevel } }));

  return { progress, leveledUp, newLevel };
}

export function recordWin(): void {
  const progress = loadProgress();
  progress.wins++;
  saveProgress(progress);
}

export function recordLoss(): void {
  const progress = loadProgress();
  progress.losses++;
  saveProgress(progress);
}

export function recordFlee(): void {
  const progress = loadProgress();
  progress.flees++;
  saveProgress(progress);
}

export function getPlayerBattleStats(): PlayerBattleStats {
  const progress = loadProgress();
  const stats = PLAYER_LEVEL_STATS[progress.level] ?? PLAYER_LEVEL_STATS[1];
  return {
    hp: stats.hp,
    maxHp: stats.hp,
    attack: stats.attack,
    defense: stats.defense,
    level: progress.level,
  };
}

export function getLevelProgress(): { current: number; max: number; percent: number } {
  const progress = loadProgress();
  const currentStats = PLAYER_LEVEL_STATS[progress.level];
  const nextStats = PLAYER_LEVEL_STATS[progress.level + 1];

  if (!nextStats) {
    // Max level
    return { current: progress.xp, max: progress.xp, percent: 100 };
  }

  const currentThreshold = currentStats?.xpNeeded ?? 0;
  const nextThreshold = nextStats.xpNeeded;
  const xpInLevel = progress.xp - currentThreshold;
  const xpForLevel = nextThreshold - currentThreshold;

  return {
    current: xpInLevel,
    max: xpForLevel,
    percent: Math.min(100, Math.round((xpInLevel / xpForLevel) * 100)),
  };
}
