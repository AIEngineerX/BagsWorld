import {
  loadProgress,
  saveProgress,
  addXp,
  recordWin,
  recordLoss,
  recordFlee,
  getPlayerBattleStats,
  getLevelProgress,
} from "@/lib/encounter-xp";
import { PLAYER_LEVEL_STATS, PLAYER_MOVES, MAX_PLAYER_LEVEL } from "@/lib/encounter-types";

// jest.setup.js provides localStorage mock; grab references for assertions
const mockGetItem = window.localStorage.getItem as jest.Mock;
const mockSetItem = window.localStorage.setItem as jest.Mock;

function setStoredProgress(data: Record<string, unknown>): void {
  mockGetItem.mockReturnValue(JSON.stringify(data));
}

let dispatchedEvents: CustomEvent[] = [];
const origDispatch = window.dispatchEvent;
beforeEach(() => {
  dispatchedEvents = [];
  window.dispatchEvent = jest.fn((event: Event) => {
    if (event instanceof CustomEvent) dispatchedEvents.push(event);
    return origDispatch.call(window, event);
  });
});
afterEach(() => {
  window.dispatchEvent = origDispatch;
});

// ==========================================================================
// loadProgress
// ==========================================================================
describe("loadProgress", () => {
  it("returns defaults when localStorage is empty", () => {
    mockGetItem.mockReturnValue(null);
    const p = loadProgress();
    expect(p).toEqual({ xp: 0, level: 1, wins: 0, losses: 0, flees: 0 });
  });

  it("returns valid stored data", () => {
    setStoredProgress({ xp: 50, level: 2, wins: 3, losses: 1, flees: 2 });
    const p = loadProgress();
    expect(p).toEqual({ xp: 50, level: 2, wins: 3, losses: 1, flees: 2 });
  });

  it("repairs invalid level (too high) without nuking other fields", () => {
    setStoredProgress({ xp: 200, level: 99, wins: 5, losses: 2, flees: 1 });
    const p = loadProgress();
    expect(p.level).toBe(1); // Reset to default
    expect(p.xp).toBe(200); // Preserved
    expect(p.wins).toBe(5); // Preserved
  });

  it("repairs invalid level (zero)", () => {
    setStoredProgress({ xp: 100, level: 0, wins: 0, losses: 0, flees: 0 });
    expect(loadProgress().level).toBe(1);
  });

  it("repairs negative level", () => {
    setStoredProgress({ xp: 100, level: -3, wins: 0, losses: 0, flees: 0 });
    expect(loadProgress().level).toBe(1);
  });

  it("repairs non-numeric level", () => {
    setStoredProgress({ xp: 100, level: "five", wins: 0, losses: 0, flees: 0 });
    expect(loadProgress().level).toBe(1);
  });

  it("repairs negative XP without affecting other fields", () => {
    setStoredProgress({ xp: -50, level: 3, wins: 10, losses: 5, flees: 2 });
    const p = loadProgress();
    expect(p.xp).toBe(0); // Reset
    expect(p.level).toBe(3); // Preserved
    expect(p.wins).toBe(10); // Preserved
  });

  it("repairs negative wins/losses/flees individually", () => {
    setStoredProgress({ xp: 100, level: 2, wins: -1, losses: 5, flees: -3 });
    const p = loadProgress();
    expect(p.wins).toBe(0); // Repaired
    expect(p.losses).toBe(5); // Preserved
    expect(p.flees).toBe(0); // Repaired
  });

  it("handles completely invalid JSON gracefully", () => {
    mockGetItem.mockReturnValue("not json {{{");
    const p = loadProgress();
    expect(p).toEqual({ xp: 0, level: 1, wins: 0, losses: 0, flees: 0 });
  });

  it("handles missing fields (partial object)", () => {
    setStoredProgress({ xp: 75 }); // level, wins, losses, flees missing
    const p = loadProgress();
    expect(p.xp).toBe(75);
    expect(p.level).toBe(1); // Default
    expect(p.wins).toBe(0); // Default
    expect(p.losses).toBe(0); // Default
    expect(p.flees).toBe(0); // Default
  });

  it("accepts MAX_PLAYER_LEVEL as valid level", () => {
    setStoredProgress({ xp: 999, level: MAX_PLAYER_LEVEL, wins: 0, losses: 0, flees: 0 });
    expect(loadProgress().level).toBe(MAX_PLAYER_LEVEL);
  });

  it("rejects level = MAX_PLAYER_LEVEL + 1", () => {
    setStoredProgress({ xp: 999, level: MAX_PLAYER_LEVEL + 1, wins: 0, losses: 0, flees: 0 });
    expect(loadProgress().level).toBe(1);
  });

  it("handles null stored in fields", () => {
    setStoredProgress({ xp: null, level: null, wins: null, losses: null, flees: null });
    const p = loadProgress();
    expect(p).toEqual({ xp: 0, level: 1, wins: 0, losses: 0, flees: 0 });
  });

  it("handles localStorage throwing (e.g., in iframe)", () => {
    mockGetItem.mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const p = loadProgress();
    expect(p).toEqual({ xp: 0, level: 1, wins: 0, losses: 0, flees: 0 });
  });
});

// ==========================================================================
// saveProgress
// ==========================================================================
describe("saveProgress", () => {
  it("writes JSON to localStorage and returns true", () => {
    const progress = { xp: 100, level: 2, wins: 3, losses: 1, flees: 0 };
    const result = saveProgress(progress);
    expect(result).toBe(true);
    expect(mockSetItem).toHaveBeenCalledWith("bagsworld_player_progress", JSON.stringify(progress));
  });

  it("returns false when localStorage throws (quota exceeded)", () => {
    mockSetItem.mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const result = saveProgress({ xp: 0, level: 1, wins: 0, losses: 0, flees: 0 });
    expect(result).toBe(false);
  });
});

// ==========================================================================
// addXp
// ==========================================================================
describe("addXp", () => {
  it("adds XP to current progress", () => {
    setStoredProgress({ xp: 50, level: 1, wins: 0, losses: 0, flees: 0 });
    const result = addXp(30);
    expect(result.progress.xp).toBe(80);
    expect(result.leveledUp).toBe(false);
    expect(result.newLevel).toBe(1);
  });

  it("triggers level up when threshold is reached", () => {
    setStoredProgress({ xp: 90, level: 1, wins: 0, losses: 0, flees: 0 });
    // Need 100 XP for level 2
    const result = addXp(10);
    expect(result.progress.xp).toBe(100);
    expect(result.leveledUp).toBe(true);
    expect(result.newLevel).toBe(2);
  });

  it("can level up multiple times at once", () => {
    setStoredProgress({ xp: 0, level: 1, wins: 0, losses: 0, flees: 0 });
    // Level 2 = 100 XP, Level 3 = 300 XP — give 300
    const result = addXp(300);
    expect(result.newLevel).toBe(3);
    expect(result.leveledUp).toBe(true);
  });

  it("caps at MAX_PLAYER_LEVEL", () => {
    setStoredProgress({ xp: 0, level: 1, wins: 0, losses: 0, flees: 0 });
    const result = addXp(999999);
    expect(result.newLevel).toBeLessThanOrEqual(MAX_PLAYER_LEVEL);
  });

  it("dispatches bagsworld-xp-changed event", () => {
    setStoredProgress({ xp: 0, level: 1, wins: 0, losses: 0, flees: 0 });
    addXp(50);

    const xpEvents = dispatchedEvents.filter((e) => e.type === "bagsworld-xp-changed");
    expect(xpEvents).toHaveLength(1);
    expect(xpEvents[0].detail.progress.xp).toBe(50);
  });

  it("event includes leveledUp and newLevel", () => {
    setStoredProgress({ xp: 90, level: 1, wins: 0, losses: 0, flees: 0 });
    addXp(15);

    const xpEvents = dispatchedEvents.filter((e) => e.type === "bagsworld-xp-changed");
    expect(xpEvents[0].detail.leveledUp).toBe(true);
    expect(xpEvents[0].detail.newLevel).toBe(2);
  });

  it("saves updated progress to localStorage", () => {
    setStoredProgress({ xp: 0, level: 1, wins: 0, losses: 0, flees: 0 });
    addXp(42);
    expect(mockSetItem).toHaveBeenCalled();
    const savedData = JSON.parse(mockSetItem.mock.calls[0][1]);
    expect(savedData.xp).toBe(42);
  });

  it("adding 0 XP does not level up", () => {
    setStoredProgress({ xp: 100, level: 2, wins: 0, losses: 0, flees: 0 });
    const result = addXp(0);
    expect(result.leveledUp).toBe(false);
    expect(result.newLevel).toBe(2);
  });
});

// ==========================================================================
// recordWin / recordLoss / recordFlee
// ==========================================================================
describe("recordWin", () => {
  it("increments wins by 1", () => {
    setStoredProgress({ xp: 0, level: 1, wins: 5, losses: 0, flees: 0 });
    recordWin();
    const saved = JSON.parse(mockSetItem.mock.calls[0][1]);
    expect(saved.wins).toBe(6);
  });

  it("does not affect other stats", () => {
    setStoredProgress({ xp: 100, level: 2, wins: 0, losses: 3, flees: 1 });
    recordWin();
    const saved = JSON.parse(mockSetItem.mock.calls[0][1]);
    expect(saved.losses).toBe(3);
    expect(saved.flees).toBe(1);
    expect(saved.xp).toBe(100);
  });
});

describe("recordLoss", () => {
  it("increments losses by 1", () => {
    setStoredProgress({ xp: 0, level: 1, wins: 0, losses: 7, flees: 0 });
    recordLoss();
    const saved = JSON.parse(mockSetItem.mock.calls[0][1]);
    expect(saved.losses).toBe(8);
  });
});

describe("recordFlee", () => {
  it("increments flees by 1", () => {
    setStoredProgress({ xp: 0, level: 1, wins: 0, losses: 0, flees: 4 });
    recordFlee();
    const saved = JSON.parse(mockSetItem.mock.calls[0][1]);
    expect(saved.flees).toBe(5);
  });
});

// ==========================================================================
// getPlayerBattleStats
// ==========================================================================
describe("getPlayerBattleStats", () => {
  it("returns level 1 stats for fresh player", () => {
    mockGetItem.mockReturnValue(null);
    const stats = getPlayerBattleStats();
    const level1 = PLAYER_LEVEL_STATS[1];
    expect(stats.hp).toBe(level1.hp);
    expect(stats.maxHp).toBe(level1.hp);
    expect(stats.attack).toBe(level1.attack);
    expect(stats.defense).toBe(level1.defense);
    expect(stats.speed).toBe(level1.speed);
    expect(stats.level).toBe(1);
  });

  it("returns correct stats for level 3", () => {
    setStoredProgress({ xp: 300, level: 3, wins: 0, losses: 0, flees: 0 });
    const stats = getPlayerBattleStats();
    const level3 = PLAYER_LEVEL_STATS[3];
    expect(stats.hp).toBe(level3.hp);
    expect(stats.attack).toBe(level3.attack);
    expect(stats.defense).toBe(level3.defense);
    expect(stats.speed).toBe(level3.speed);
    expect(stats.level).toBe(3);
  });

  it("has exactly 4 moves", () => {
    mockGetItem.mockReturnValue(null);
    const stats = getPlayerBattleStats();
    expect(stats.moves).toHaveLength(4);
  });

  it("moves are cloned (not shared references)", () => {
    mockGetItem.mockReturnValue(null);
    const stats1 = getPlayerBattleStats();
    const stats2 = getPlayerBattleStats();
    stats1.moves[0].pp = 0;
    expect(stats2.moves[0].pp).toBe(PLAYER_MOVES[0].maxPp); // Unaffected
  });

  it("falls back to level 1 stats if stored level has no entry", () => {
    // This shouldn't normally happen, but tests resilience
    setStoredProgress({ xp: 0, level: 999, wins: 0, losses: 0, flees: 0 });
    // loadProgress will repair level to 1 since 999 > MAX_PLAYER_LEVEL
    const stats = getPlayerBattleStats();
    expect(stats.level).toBe(1);
  });
});

// ==========================================================================
// getLevelProgress
// ==========================================================================
describe("getLevelProgress", () => {
  it("returns 0% at start of level 1", () => {
    setStoredProgress({ xp: 0, level: 1, wins: 0, losses: 0, flees: 0 });
    const prog = getLevelProgress();
    expect(prog.current).toBe(0);
    expect(prog.percent).toBe(0);
    expect(prog.max).toBe(PLAYER_LEVEL_STATS[2].xpNeeded); // 100
  });

  it("returns 50% at halfway through level 1", () => {
    setStoredProgress({ xp: 50, level: 1, wins: 0, losses: 0, flees: 0 });
    const prog = getLevelProgress();
    expect(prog.percent).toBe(50);
  });

  it("returns 100% at max level", () => {
    setStoredProgress({
      xp: 99999,
      level: MAX_PLAYER_LEVEL,
      wins: 0,
      losses: 0,
      flees: 0,
    });
    const prog = getLevelProgress();
    expect(prog.percent).toBe(100);
  });

  it("correctly computes mid-level progress for level 2", () => {
    // Level 2 threshold = 100, level 3 threshold = 300
    // XP = 200 → in-level = 200-100 = 100, needed = 300-100 = 200 → 50%
    setStoredProgress({ xp: 200, level: 2, wins: 0, losses: 0, flees: 0 });
    const prog = getLevelProgress();
    expect(prog.current).toBe(100);
    expect(prog.max).toBe(200);
    expect(prog.percent).toBe(50);
  });

  it("percent is clamped to 100 even if XP exceeds next threshold", () => {
    // This could happen if XP was added after max level
    setStoredProgress({ xp: 500, level: 2, wins: 0, losses: 0, flees: 0 });
    const prog = getLevelProgress();
    expect(prog.percent).toBeLessThanOrEqual(100);
  });
});
