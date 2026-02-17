// Wild Encounter XP / Level Progression
// Persists player progress in localStorage

import {
  type PlayerProgress,
  type PlayerBattleStats,
  PLAYER_LEVEL_STATS,
  PLAYER_MOVES,
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
    const parsed = JSON.parse(raw);
    // Repair individual fields instead of nuking all data on one bad field
    return {
      level:
        typeof parsed.level === "number" && parsed.level >= 1 && parsed.level <= MAX_PLAYER_LEVEL
          ? parsed.level
          : DEFAULT_PROGRESS.level,
      xp: typeof parsed.xp === "number" && parsed.xp >= 0 ? parsed.xp : DEFAULT_PROGRESS.xp,
      wins:
        typeof parsed.wins === "number" && parsed.wins >= 0 ? parsed.wins : DEFAULT_PROGRESS.wins,
      losses:
        typeof parsed.losses === "number" && parsed.losses >= 0
          ? parsed.losses
          : DEFAULT_PROGRESS.losses,
      flees:
        typeof parsed.flees === "number" && parsed.flees >= 0
          ? parsed.flees
          : DEFAULT_PROGRESS.flees,
    };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

export function saveProgress(progress: PlayerProgress): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    // localStorage full or unavailable
    return false;
  }
}

export function addXp(amount: number): {
  progress: PlayerProgress;
  leveledUp: boolean;
  newLevel: number;
} {
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

  window.dispatchEvent(
    new CustomEvent("bagsworld-xp-changed", { detail: { progress, leveledUp, newLevel } })
  );

  return { progress, leveledUp, newLevel };
}

function incrementStat(key: "wins" | "losses" | "flees"): void {
  const progress = loadProgress();
  progress[key]++;
  saveProgress(progress);
}

export function recordWin(): void {
  incrementStat("wins");
}
export function recordLoss(): void {
  incrementStat("losses");
}
export function recordFlee(): void {
  incrementStat("flees");
}

export function getPlayerBattleStats(): PlayerBattleStats {
  const progress = loadProgress();
  const stats = PLAYER_LEVEL_STATS[progress.level] ?? PLAYER_LEVEL_STATS[1];
  return {
    hp: stats.hp,
    maxHp: stats.hp,
    attack: stats.attack,
    defense: stats.defense,
    speed: stats.speed,
    level: progress.level,
    moves: PLAYER_MOVES.map((m) => ({ ...m })),
  };
}

export function getLevelProgress(): { current: number; max: number; percent: number } {
  const progress = loadProgress();
  const currentStats = PLAYER_LEVEL_STATS[progress.level];
  const nextStats = PLAYER_LEVEL_STATS[progress.level + 1];

  if (!nextStats) {
    return { current: progress.xp, max: progress.xp, percent: 100 };
  }

  const currentThreshold = currentStats.xpNeeded;
  const nextThreshold = nextStats.xpNeeded;
  const xpInLevel = progress.xp - currentThreshold;
  const xpForLevel = nextThreshold - currentThreshold;

  return {
    current: xpInLevel,
    max: xpForLevel,
    percent: Math.min(100, Math.round((xpInLevel / xpForLevel) * 100)),
  };
}
