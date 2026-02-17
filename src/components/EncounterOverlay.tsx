"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Creature, EncounterState, BattleAction } from "@/lib/encounter-types";
import {
  createEncounter,
  executePlayerTurn,
  executeCreatureTurn,
} from "@/lib/encounter-engine";
import {
  getPlayerBattleStats,
  addXp,
  recordWin,
  recordLoss,
  recordFlee,
  getLevelProgress,
} from "@/lib/encounter-xp";

// Pokemon Crystal-style visual phases (separate from engine phases)
type VisualPhase =
  | "transition" // White flashes → black
  | "slide_in" // Sprites slide in from edges
  | "appeared_text" // "Wild X appeared!" typewriter
  | "go_text" // "Go! Player!" typewriter
  | "player_turn" // Show 2x2 action menu
  | "player_attack_anim" // Player lunges, flash, creature shakes, HP drains
  | "player_defend_anim" // Defend text
  | "flee_anim" // Flee attempt
  | "creature_turn_text" // "[Creature] used attack!" typewriter
  | "creature_attack_anim" // Creature lunges, flash, player shakes, HP drains
  | "creature_defend_anim" // Creature braces
  | "faint_anim" // Loser sinks down
  | "result_text" // Victory/defeat/flee text
  | "xp_gain" // XP bar fills
  | "level_up" // Level up notification
  | "done"; // Close

interface EncounterOverlayProps {
  creature: Creature;
  onClose: (result: "win" | "lose" | "flee") => void;
}

// Creature type → color for fallback sprites
const TYPE_COLORS: Record<string, { bg: string; border: string }> = {
  fire: { bg: "#dc2626", border: "#f87171" },
  water: { bg: "#2563eb", border: "#60a5fa" },
  grass: { bg: "#16a34a", border: "#4ade80" },
  beast: { bg: "#92400e", border: "#d97706" },
  flying: { bg: "#7c3aed", border: "#a78bfa" },
  bug: { bg: "#65a30d", border: "#a3e635" },
  aquatic: { bg: "#0891b2", border: "#22d3ee" },
};

function getTypeColor(type: string) {
  return TYPE_COLORS[type] ?? { bg: "#6b7280", border: "#9ca3af" };
}

export function EncounterOverlay({ creature, onClose }: EncounterOverlayProps) {
  const [state, setState] = useState<EncounterState>(() =>
    createEncounter(creature, getPlayerBattleStats())
  );
  const [visualPhase, setVisualPhase] = useState<VisualPhase>("transition");
  const [typewriterText, setTypewriterText] = useState("");
  const [typewriterDone, setTypewriterDone] = useState(false);
  const [flashOpacity, setFlashOpacity] = useState(0);
  const [blackOverlay, setBlackOverlay] = useState(1); // Start fully black
  const [enemySlideX, setEnemySlideX] = useState(120); // Off-screen right
  const [playerSlideX, setPlayerSlideX] = useState(-120); // Off-screen left
  const [enemyShake, setEnemyShake] = useState(false);
  const [playerShake, setPlayerShake] = useState(false);
  const [screenFlash, setScreenFlash] = useState(false);
  const [enemyFaintY, setEnemyFaintY] = useState(0);
  const [playerFaintY, setPlayerFaintY] = useState(0);
  const [enemyHpDisplay, setEnemyHpDisplay] = useState(creature.stats.maxHp);
  const [playerHpDisplay, setPlayerHpDisplay] = useState(state.player.maxHp);
  const [xpBarPercent, setXpBarPercent] = useState(0);
  const [menuCursor, setMenuCursor] = useState(0); // 0=FIGHT, 1=DEFEND, 2=RUN
  const [levelUpMsg, setLevelUpMsg] = useState<string | null>(null);
  const [playerLunge, setPlayerLunge] = useState(false);
  const [creatureLunge, setCreatureLunge] = useState(false);
  const [damageNumber, setDamageNumber] = useState<{ value: number; side: "player" | "creature"; key: number } | null>(null);
  const dmgKey = useRef(0);
  const typewriterRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Block all click-through
  const stopPropagation = useCallback((e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
  }, []);

  // === TYPEWRITER ENGINE ===
  const typewrite = useCallback((text: string, speed = 30): Promise<void> => {
    return new Promise((resolve) => {
      setTypewriterText("");
      setTypewriterDone(false);
      let i = 0;
      const tick = () => {
        if (i < text.length) {
          setTypewriterText(text.slice(0, i + 1));
          i++;
          typewriterRef.current = setTimeout(tick, speed);
        } else {
          setTypewriterDone(true);
          resolve();
        }
      };
      tick();
    });
  }, []);

  // === HP DRAIN ANIMATION ===
  const animateHp = useCallback(
    (side: "player" | "creature", from: number, to: number, duration = 600): Promise<void> => {
      return new Promise((resolve) => {
        const setter = side === "player" ? setPlayerHpDisplay : setEnemyHpDisplay;
        const steps = Math.max(1, Math.abs(from - to));
        const stepDuration = duration / steps;
        let current = from;
        const tick = () => {
          if ((from > to && current > to) || (from < to && current < to)) {
            current += from > to ? -1 : 1;
            setter(Math.max(0, current));
            setTimeout(tick, stepDuration);
          } else {
            setter(Math.max(0, to));
            resolve();
          }
        };
        tick();
      });
    },
    []
  );

  // === SHOW DAMAGE NUMBER ===
  const showDamage = useCallback((value: number, side: "player" | "creature") => {
    dmgKey.current++;
    setDamageNumber({ value, side, key: dmgKey.current });
    setTimeout(() => setDamageNumber(null), 900);
  }, []);

  // === TRANSITION SEQUENCE (Pokemon Crystal: 3 white flashes → black) ===
  useEffect(() => {
    if (visualPhase !== "transition") return;

    const seq = async () => {
      // 3 white flashes
      for (let i = 0; i < 3; i++) {
        setFlashOpacity(0.9);
        await sleep(80);
        setFlashOpacity(0);
        await sleep(80);
      }
      // Hold black briefly
      await sleep(300);
      // Fade black overlay out to reveal battle scene
      setBlackOverlay(0);
      await sleep(400);
      setVisualPhase("slide_in");
    };
    seq();
  }, [visualPhase]);

  // === SLIDE-IN SEQUENCE (enemy from right, player from left) ===
  useEffect(() => {
    if (visualPhase !== "slide_in") return;

    // Animate both sprites sliding to center
    const duration = 800;
    const startTime = Date.now();

    const frame = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(1, elapsed / duration);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - t, 3);
      setEnemySlideX(120 * (1 - ease));
      setPlayerSlideX(-120 * (1 - ease));

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        setEnemySlideX(0);
        setPlayerSlideX(0);
        setVisualPhase("appeared_text");
      }
    };
    requestAnimationFrame(frame);
  }, [visualPhase]);

  // === "Wild X appeared!" TEXT ===
  useEffect(() => {
    if (visualPhase !== "appeared_text") return;
    const run = async () => {
      await typewrite(`Wild ${creature.name} appeared!`);
      await sleep(800);
      setVisualPhase("go_text");
    };
    run();
  }, [visualPhase, creature.name, typewrite]);

  // === "Go! Player!" TEXT ===
  useEffect(() => {
    if (visualPhase !== "go_text") return;
    const run = async () => {
      await typewrite("Go! Show them what you've got!");
      await sleep(600);
      setTypewriterText("");
      setVisualPhase("player_turn");
    };
    run();
  }, [visualPhase, typewrite]);

  // === HANDLE MENU ACTION ===
  const handleAction = useCallback(
    async (action: BattleAction) => {
      if (visualPhase !== "player_turn" || state.result) return;

      if (action === "attack") {
        setVisualPhase("player_attack_anim");

        await typewrite(`You attacked ${state.creature.name}!`);

        const afterPlayer = executePlayerTurn(state, "attack");
        const lastLog = afterPlayer.battleLog[afterPlayer.battleLog.length - (afterPlayer.result ? 3 : 1)];
        const dmg = lastLog?.damage ?? 0;

        // Player lunges forward
        setPlayerLunge(true);
        await sleep(200);
        // Impact flash
        setScreenFlash(true);
        setPlayerLunge(false);
        await sleep(100);
        setScreenFlash(false);
        // Creature shakes
        setEnemyShake(true);
        showDamage(dmg, "creature");
        await sleep(300);
        setEnemyShake(false);
        // HP drains gradually
        await animateHp("creature", state.creatureHp, afterPlayer.creatureHp);
        setState(afterPlayer);

        if (afterPlayer.result === "win") {
          await sleep(300);
          setVisualPhase("faint_anim");
          return;
        }

        await sleep(300);
        // Creature's turn
        setVisualPhase("creature_turn_text");
      } else if (action === "defend") {
        setVisualPhase("player_defend_anim");
        const afterPlayer = executePlayerTurn(state, "defend");
        await typewrite("You brace for the next attack!");
        setState(afterPlayer);
        await sleep(600);
        setVisualPhase("creature_turn_text");
      } else if (action === "flee") {
        setVisualPhase("flee_anim");
        const afterPlayer = executePlayerTurn(state, "flee");

        if (afterPlayer.result === "flee") {
          await typewrite("Got away safely!");
          setState(afterPlayer);
          await sleep(800);
          recordFlee();
          onClose("flee");
          return;
        }

        // Failed flee — creature gets free attack
        await typewrite("Can't escape!");
        await sleep(400);

        const creatureLog = afterPlayer.battleLog[afterPlayer.battleLog.length - 1];
        const dmg = creatureLog?.damage ?? 0;
        await typewrite(`${state.creature.name} attacks! ${dmg} damage!`);

        setCreatureLunge(true);
        await sleep(200);
        setScreenFlash(true);
        setCreatureLunge(false);
        await sleep(100);
        setScreenFlash(false);
        setPlayerShake(true);
        showDamage(dmg, "player");
        await sleep(300);
        setPlayerShake(false);
        await animateHp("player", state.playerHp, afterPlayer.playerHp);
        setState(afterPlayer);

        if (afterPlayer.result === "lose") {
          await sleep(300);
          setVisualPhase("faint_anim");
          return;
        }

        await sleep(300);
        setVisualPhase("player_turn");
      }
    },
    [visualPhase, state, typewrite, animateHp, showDamage, onClose]
  );

  // === CREATURE TURN ===
  useEffect(() => {
    if (visualPhase !== "creature_turn_text") return;

    const run = async () => {
      const afterCreature = executeCreatureTurn(state);
      const lastLog = afterCreature.battleLog[afterCreature.battleLog.length - (afterCreature.result ? 2 : 1)];
      const isDefend = lastLog?.type === "creature_defend";

      if (isDefend) {
        setVisualPhase("creature_defend_anim");
        await typewrite(`${state.creature.name} braces itself!`);
        setState(afterCreature);
        await sleep(600);
        setVisualPhase("player_turn");
        return;
      }

      const dmg = lastLog?.damage ?? 0;
      const isSpecial = lastLog?.message?.includes("special");
      const moveText = isSpecial
        ? `${state.creature.name} uses a special attack!`
        : `${state.creature.name} attacks!`;

      await typewrite(moveText);
      await sleep(200);

      // Creature lunges
      setCreatureLunge(true);
      await sleep(200);
      setScreenFlash(true);
      setCreatureLunge(false);
      await sleep(100);
      setScreenFlash(false);
      // Player shakes
      setPlayerShake(true);
      showDamage(dmg, "player");
      await sleep(300);
      setPlayerShake(false);
      // HP drains
      await animateHp("player", state.playerHp, afterCreature.playerHp);
      setState(afterCreature);

      if (afterCreature.result === "lose") {
        await sleep(300);
        setVisualPhase("faint_anim");
        return;
      }

      await sleep(400);
      setTypewriterText("");
      setVisualPhase("player_turn");
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visualPhase]);

  // === FAINT ANIMATION (sprite sinks down) ===
  useEffect(() => {
    if (visualPhase !== "faint_anim") return;

    const run = async () => {
      const isPlayerLoss = state.result === "lose";
      const steps = 8;
      const stepDuration = 80;

      for (let i = 1; i <= steps; i++) {
        if (isPlayerLoss) {
          setPlayerFaintY(i * 10);
        } else {
          setEnemyFaintY(i * 10);
        }
        await sleep(stepDuration);
      }

      await sleep(300);

      if (state.result === "win") {
        await typewrite(`Wild ${state.creature.name} fainted!`);
        await sleep(800);
        recordWin();
        setVisualPhase("xp_gain");
      } else {
        await typewrite("You were defeated...");
        await sleep(1200);
        recordLoss();
        onClose("lose");
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visualPhase]);

  // === XP GAIN ===
  useEffect(() => {
    if (visualPhase !== "xp_gain") return;

    const run = async () => {
      const xp = state.xpGained;
      await typewrite(`You gained ${xp} EXP. Points!`);

      // Animate XP bar
      const beforeXp = getLevelProgress();
      const { leveledUp, newLevel } = addXp(xp);
      const afterXp = getLevelProgress();

      // Animate from old percent to new
      const startPct = beforeXp.percent;
      const endPct = leveledUp ? 100 : afterXp.percent;
      setXpBarPercent(startPct);
      await sleep(300);

      const duration = 800;
      const startTime = Date.now();
      await new Promise<void>((resolve) => {
        const frame = () => {
          const t = Math.min(1, (Date.now() - startTime) / duration);
          setXpBarPercent(startPct + (endPct - startPct) * t);
          if (t < 1) requestAnimationFrame(frame);
          else resolve();
        };
        requestAnimationFrame(frame);
      });

      await sleep(400);

      if (leveledUp) {
        setLevelUpMsg(`Grew to LV ${newLevel}!`);
        setVisualPhase("level_up");
      } else {
        setVisualPhase("done");
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visualPhase]);

  // === LEVEL UP ===
  useEffect(() => {
    if (visualPhase !== "level_up") return;

    const run = async () => {
      await typewrite(levelUpMsg ?? "Level up!");
      await sleep(1500);
      setVisualPhase("done");
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visualPhase]);

  // === DONE — wait for click ===
  useEffect(() => {
    if (visualPhase !== "done") return;

    const run = async () => {
      await typewrite("Press any key to continue...");
    };
    run();
  }, [visualPhase, typewrite]);

  const handleDoneClick = useCallback(() => {
    if (visualPhase === "done") {
      onClose(state.result ?? "win");
    }
  }, [visualPhase, state.result, onClose]);

  // Keyboard support
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Prevent game controls from firing
      e.stopPropagation();

      if (visualPhase === "done") {
        handleDoneClick();
        return;
      }

      if (visualPhase !== "player_turn") return;

      if (e.key === "ArrowUp" || e.key === "w") {
        setMenuCursor((c) => Math.max(0, c - 1));
      } else if (e.key === "ArrowDown" || e.key === "s") {
        setMenuCursor((c) => Math.min(2, c + 1));
      } else if (e.key === "ArrowLeft" || e.key === "a") {
        setMenuCursor((c) => Math.max(0, c - 1));
      } else if (e.key === "ArrowRight" || e.key === "d") {
        setMenuCursor((c) => Math.min(2, c + 1));
      } else if (e.key === "Enter" || e.key === "e" || e.key === " ") {
        const actions: BattleAction[] = ["attack", "defend", "flee"];
        handleAction(actions[menuCursor]);
      }
    };

    window.addEventListener("keydown", handleKey, true); // Capture phase
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [visualPhase, menuCursor, handleAction, handleDoneClick]);

  // Cleanup typewriter on unmount
  useEffect(() => {
    return () => {
      if (typewriterRef.current) clearTimeout(typewriterRef.current);
    };
  }, []);

  // HP bar color (Pokemon Crystal thresholds: green >=50%, yellow 21-49%, red <21%)
  const hpBarColor = (current: number, max: number) => {
    const pct = max > 0 ? (current / max) * 100 : 0;
    if (pct >= 50) return "#22c55e"; // green
    if (pct >= 21) return "#eab308"; // yellow
    return "#ef4444"; // red
  };

  const hpBarWidth = (current: number, max: number) =>
    max > 0 ? `${Math.max(0, (current / max) * 100)}%` : "0%";

  const typeColor = getTypeColor(creature.type);
  const showMenu = visualPhase === "player_turn";

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] select-none"
      onClick={stopPropagation}
      onPointerDown={stopPropagation}
      onContextMenu={stopPropagation}
      style={{ touchAction: "none" }}
    >
      {/* Battle scene container — 10:9 aspect ratio like Game Boy */}
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        <div
          className="relative w-full max-w-[640px] max-h-[576px] aspect-[10/9] bg-[#f8f0e0] overflow-hidden"
          style={{ imageRendering: "pixelated" }}
        >
          {/* === BATTLE FIELD (top 2/3) === */}
          <div className="absolute inset-x-0 top-0 bottom-[33.3%]">
            {/* Battle background — simple gradient for ground */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#f8f0e0] via-[#f8f0e0] to-[#c8b888]" />

            {/* Ground line */}
            <div className="absolute bottom-[15%] left-0 right-0 h-[2px] bg-[#a89868]" />
            <div className="absolute bottom-[35%] left-[45%] right-0 h-[2px] bg-[#a89868]" />

            {/* --- ENEMY SPRITE (top-right) --- */}
            <div
              className="absolute right-[10%] top-[8%] w-[28%] aspect-square"
              style={{
                transform: `translateX(${enemySlideX}%) translateY(${enemyFaintY}px)`,
                clipPath: enemyFaintY > 0 ? `inset(0 0 ${enemyFaintY}px 0)` : undefined,
                transition: enemyShake ? undefined : "transform 0.1s",
                animation: enemyShake ? "pkmn-shake 0.08s linear infinite" : undefined,
              }}
            >
              {creature.spriteUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={creature.spriteUrl}
                  alt={creature.name}
                  className="w-full h-full object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center border-4"
                  style={{
                    backgroundColor: typeColor.bg,
                    borderColor: typeColor.border,
                    imageRendering: "pixelated",
                  }}
                >
                  <span className="font-pixel text-white text-[10px] text-center leading-tight drop-shadow-[1px_1px_0_rgba(0,0,0,0.5)]">
                    {creature.name}
                  </span>
                </div>
              )}

              {/* Floating damage on creature */}
              {damageNumber && damageNumber.side === "creature" && (
                <div
                  key={damageNumber.key}
                  className="absolute -top-2 left-1/2 -translate-x-1/2 font-pixel text-sm text-red-600 pkmn-dmg-float"
                >
                  -{damageNumber.value}
                </div>
              )}
            </div>

            {/* --- ENEMY HUD (top-left) --- */}
            <div className="absolute left-[3%] top-[5%] w-[48%]">
              <div className="bg-[#f8f0d8] border-2 border-[#484848] rounded-sm p-1.5 shadow-[2px_2px_0_rgba(0,0,0,0.2)]">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-pixel text-[10px] text-[#383838] uppercase tracking-wide">
                    {creature.name}
                  </span>
                  <span className="font-pixel text-[9px] text-[#383838]">
                    Lv{creature.level}
                  </span>
                </div>
                {/* HP bar */}
                <div className="flex items-center gap-1">
                  <span className="font-pixel text-[8px] text-[#383838]">HP</span>
                  <div className="flex-1 h-[6px] bg-[#383838] rounded-sm overflow-hidden border border-[#282828]">
                    <div
                      className="h-full transition-none"
                      style={{
                        width: hpBarWidth(enemyHpDisplay, creature.stats.maxHp),
                        backgroundColor: hpBarColor(enemyHpDisplay, creature.stats.maxHp),
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* --- PLAYER SPRITE (bottom-left) --- */}
            <div
              className="absolute left-[8%] bottom-[5%] w-[24%] aspect-square"
              style={{
                transform: `translateX(${playerSlideX}%) translateY(${playerFaintY}px)`,
                clipPath: playerFaintY > 0 ? `inset(0 0 ${playerFaintY}px 0)` : undefined,
                transition: playerShake ? undefined : "transform 0.1s",
                animation: playerShake ? "pkmn-shake 0.08s linear infinite" : undefined,
              }}
            >
              {/* Player back sprite — simple silhouette */}
              <div
                className="w-full h-full flex items-center justify-center bg-[#4060a8] border-4 border-[#6888c8]"
                style={{ imageRendering: "pixelated" }}
              >
                <span className="font-pixel text-white text-[10px] drop-shadow-[1px_1px_0_rgba(0,0,0,0.5)]">
                  YOU
                </span>
              </div>

              {/* Floating damage on player */}
              {damageNumber && damageNumber.side === "player" && (
                <div
                  key={damageNumber.key}
                  className="absolute -top-2 left-1/2 -translate-x-1/2 font-pixel text-sm text-red-600 pkmn-dmg-float"
                >
                  -{damageNumber.value}
                </div>
              )}
            </div>

            {/* --- PLAYER HUD (bottom-right) --- */}
            <div className="absolute right-[3%] bottom-[3%] w-[48%]">
              <div className="bg-[#f8f0d8] border-2 border-[#484848] rounded-sm p-1.5 shadow-[2px_2px_0_rgba(0,0,0,0.2)]">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-pixel text-[10px] text-[#383838] uppercase tracking-wide">
                    PLAYER
                  </span>
                  <span className="font-pixel text-[9px] text-[#383838]">
                    Lv{state.player.level}
                  </span>
                </div>
                {/* HP bar */}
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="font-pixel text-[8px] text-[#383838]">HP</span>
                  <div className="flex-1 h-[6px] bg-[#383838] rounded-sm overflow-hidden border border-[#282828]">
                    <div
                      className="h-full transition-none"
                      style={{
                        width: hpBarWidth(playerHpDisplay, state.player.maxHp),
                        backgroundColor: hpBarColor(playerHpDisplay, state.player.maxHp),
                      }}
                    />
                  </div>
                </div>
                {/* HP numbers (player only, like Pokemon) */}
                <div className="text-right font-pixel text-[8px] text-[#383838] mb-1">
                  {playerHpDisplay}/{state.player.maxHp}
                </div>
                {/* EXP bar */}
                <div className="flex items-center gap-1">
                  <span className="font-pixel text-[7px] text-[#6868a8]">EXP</span>
                  <div className="flex-1 h-[4px] bg-[#383838] rounded-sm overflow-hidden border border-[#282828]">
                    <div
                      className="h-full bg-[#48b8e8] transition-none"
                      style={{ width: `${xpBarPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Player lunge overlay */}
            {playerLunge && (
              <div className="absolute left-[25%] bottom-[20%] w-[15%] aspect-square bg-[#4060a8]/60 rounded-full blur-sm pkmn-lunge-right" />
            )}
            {creatureLunge && (
              <div className="absolute right-[25%] top-[30%] w-[15%] aspect-square rounded-full blur-sm pkmn-lunge-left"
                style={{ backgroundColor: `${typeColor.bg}99` }}
              />
            )}
          </div>

          {/* === TEXT BOX (bottom 1/3 — Pokemon Crystal style) === */}
          <div className="absolute inset-x-0 bottom-0 h-[33.3%] bg-[#f8f0e0] border-t-4 border-[#484848]">
            <div className="h-full flex">
              {/* Text area (left side) */}
              <div className="flex-1 p-3 flex flex-col justify-start">
                <p className="font-pixel text-[11px] text-[#383838] leading-relaxed whitespace-pre-wrap">
                  {typewriterText}
                  {!typewriterDone && <span className="animate-pulse">|</span>}
                </p>
              </div>

              {/* Action menu (right side — 2-column grid, Pokemon style) */}
              {showMenu && (
                <div className="w-[45%] border-l-4 border-[#484848] bg-[#f8f0d8] p-2 flex flex-col justify-center gap-1">
                  {(["FIGHT", "DEFEND", "RUN"] as const).map((label, i) => (
                    <button
                      key={label}
                      onClick={() => {
                        setMenuCursor(i);
                        const actions: BattleAction[] = ["attack", "defend", "flee"];
                        handleAction(actions[i]);
                      }}
                      onMouseEnter={() => setMenuCursor(i)}
                      className={`flex items-center gap-2 px-2 py-1.5 text-left transition-colors ${
                        menuCursor === i ? "bg-[#484848]/10" : ""
                      }`}
                    >
                      <span className="font-pixel text-[10px] text-[#383838] w-3">
                        {menuCursor === i ? "\u25B6" : ""}
                      </span>
                      <span className="font-pixel text-[11px] text-[#383838] tracking-wider">
                        {label}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Done click zone */}
              {visualPhase === "done" && (
                <button
                  onClick={handleDoneClick}
                  className="absolute inset-0 cursor-pointer"
                />
              )}
            </div>
          </div>

          {/* === OVERLAY EFFECTS === */}

          {/* Screen flash (white, on impact) */}
          {screenFlash && (
            <div className="absolute inset-0 bg-white/80 pointer-events-none" />
          )}

          {/* Transition flash */}
          {flashOpacity > 0 && (
            <div
              className="absolute inset-0 bg-white pointer-events-none"
              style={{ opacity: flashOpacity }}
            />
          )}

          {/* Black overlay (for transition in) */}
          {blackOverlay > 0 && (
            <div
              className="absolute inset-0 bg-black pointer-events-none transition-opacity duration-400"
              style={{ opacity: blackOverlay }}
            />
          )}
        </div>
      </div>

      {/* === GLOBAL ANIMATIONS === */}
      <style jsx global>{`
        @keyframes pkmn-shake {
          0% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          50% { transform: translateX(3px); }
          75% { transform: translateX(-2px); }
          100% { transform: translateX(0); }
        }
        @keyframes pkmn-dmg-float {
          0% { opacity: 1; transform: translate(-50%, 0); }
          100% { opacity: 0; transform: translate(-50%, -24px); }
        }
        .pkmn-dmg-float {
          animation: pkmn-dmg-float 0.9s ease-out forwards;
        }
        @keyframes pkmn-lunge-right {
          0% { transform: translateX(0); opacity: 1; }
          50% { transform: translateX(60px); opacity: 0.8; }
          100% { transform: translateX(0); opacity: 0; }
        }
        .pkmn-lunge-right {
          animation: pkmn-lunge-right 0.3s ease-in-out forwards;
        }
        @keyframes pkmn-lunge-left {
          0% { transform: translateX(0); opacity: 1; }
          50% { transform: translateX(-60px); opacity: 0.8; }
          100% { transform: translateX(0); opacity: 0; }
        }
        .pkmn-lunge-left {
          animation: pkmn-lunge-left 0.3s ease-in-out forwards;
        }
      `}</style>
    </div>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
