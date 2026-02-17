"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { Creature, EncounterState, Move } from "@/lib/encounter-types";
import { STRUGGLE_MOVE } from "@/lib/encounter-types";
import {
  createEncounter,
  executePlayerMove,
  executePlayerDefend,
  executePlayerFlee,
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
import {
  getCreatureBattleSpriteUrl,
  getPlayerSpriteUrl,
} from "@/lib/texture-bridge";
import * as sfx from "@/lib/battle-sounds";

// Visual phase state machine (separate from engine phases)
type VisualPhase =
  | "transition"
  | "slide_in"
  | "appeared_text"
  | "go_text"
  | "player_turn" // Main menu: FIGHT / DEFEND / RUN
  | "move_select" // FIGHT submenu: 4 moves in 2x2 grid
  | "animating" // Generic animating state (player or creature acting)
  | "faint_anim"
  | "xp_gain"
  | "level_up"
  | "done";

interface EncounterOverlayProps {
  creature: Creature;
  onClose: (result: "win" | "lose" | "flee") => void;
}

// Type color palette for fallback sprites
const TYPE_COLORS: Record<string, string> = {
  fire: "#dc2626", water: "#2563eb", grass: "#16a34a", beast: "#92400e",
  flying: "#7c3aed", bug: "#65a30d", aquatic: "#0891b2", normal: "#6b7280",
};

export function EncounterOverlay({ creature, onClose }: EncounterOverlayProps) {
  const [state, setState] = useState<EncounterState>(() =>
    createEncounter(creature, getPlayerBattleStats())
  );
  // Ref to always access latest state in async callbacks (fixes stale closures)
  const stateRef = useRef(state);
  stateRef.current = state;

  const [vp, setVp] = useState<VisualPhase>("transition");
  const [text, setText] = useState("");
  const [textDone, setTextDone] = useState(false);
  const [flashOpacity, setFlashOpacity] = useState(0);
  const [blackOverlay, setBlackOverlay] = useState(1);
  const [enemyX, setEnemyX] = useState(120);
  const [playerX, setPlayerX] = useState(-120);
  const [enemyShake, setEnemyShake] = useState(false);
  const [playerShake, setPlayerShake] = useState(false);
  const [screenFlash, setScreenFlash] = useState(false);
  const [enemyFaintY, setEnemyFaintY] = useState(0);
  const [playerFaintY, setPlayerFaintY] = useState(0);
  const [enemyHp, setEnemyHp] = useState(creature.stats.maxHp);
  const [playerHp, setPlayerHp] = useState(state.player.maxHp);
  const [xpPct, setXpPct] = useState(0);
  const [menuIdx, setMenuIdx] = useState(0);
  const [moveIdx, setMoveIdx] = useState(0);
  const [levelUpMsg, setLevelUpMsg] = useState<string | null>(null);
  const [playerLunge, setPlayerLunge] = useState(false);
  const [creatureLunge, setCreatureLunge] = useState(false);
  const [dmgNum, setDmgNum] = useState<{ v: number; side: "p" | "e"; k: number } | null>(null);
  const [atkEffect, setAtkEffect] = useState<{ anim: Move["animation"]; side: "p" | "e" } | null>(null);
  const [enemyBob, setEnemyBob] = useState(true);
  const [playerBob, setPlayerBob] = useState(true);
  const dkRef = useRef(0);
  const twRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve sprite URLs
  const creatureSpriteUrl = creature.spriteUrl ?? getCreatureBattleSpriteUrl(creature.spriteKey) ?? null;
  const playerSpriteUrl = getPlayerSpriteUrl();

  const stop = useCallback((e: React.SyntheticEvent) => { e.stopPropagation(); e.preventDefault(); }, []);

  // Ensure AudioContext is ready on first user gesture
  const gestureRef = useRef(false);
  const onFirstGesture = useCallback(() => {
    if (!gestureRef.current) { gestureRef.current = true; sfx.ensureAudioReady(); }
  }, []);

  // Typewriter with sound blips — cancels any in-flight call
  const typewrite = useCallback((t: string, speed = 28): Promise<void> => {
    return new Promise((resolve) => {
      if (twRef.current) clearTimeout(twRef.current); // Fix race: cancel previous
      setText(""); setTextDone(false);
      let i = 0;
      const tick = () => {
        if (i < t.length) {
          setText(t.slice(0, i + 1));
          if (i % 2 === 0) sfx.typewriterBlip();
          i++;
          twRef.current = setTimeout(tick, speed);
        } else {
          setTextDone(true); resolve();
        }
      };
      tick();
    });
  }, []);

  // HP drain animation with sound — cap min step time to avoid slow small drains
  const drainHp = useCallback(
    (side: "p" | "e", from: number, to: number, dur = 600): Promise<void> => {
      return new Promise((resolve) => {
        const set = side === "p" ? setPlayerHp : setEnemyHp;
        if (from === to) { resolve(); return; }
        sfx.hpDrainSound(Math.min(dur, 400));
        const steps = Math.max(1, Math.abs(from - to));
        const ms = Math.min(dur / steps, 50); // Cap at 50ms/step so small drains aren't slow
        let cur = from;
        const tick = () => {
          if ((from > to && cur > to) || (from < to && cur < to)) {
            cur += from > to ? -1 : 1;
            set(Math.max(0, cur));
            setTimeout(tick, ms);
          } else { set(Math.max(0, to)); resolve(); }
        };
        tick();
      });
    }, []
  );

  const showDmg = useCallback((v: number, side: "p" | "e") => {
    dkRef.current++;
    setDmgNum({ v, side, k: dkRef.current });
    setTimeout(() => setDmgNum(null), 900);
  }, []);

  const playEffect = useCallback((anim: Move["animation"], side: "p" | "e"): Promise<void> => {
    return new Promise((resolve) => {
      setAtkEffect({ anim, side });
      setTimeout(() => { setAtkEffect(null); resolve(); }, 500);
    });
  }, []);

  // Intro wipe state
  const [wipePhase, setWipePhase] = useState(0);
  const [wipeDir, setWipeDir] = useState<"close" | "open">("close");
  const [introShake, setIntroShake] = useState(0);

  // === TRANSITION — Pokemon Crystal venetian-blind wipe + flash storm ===
  useEffect(() => {
    if (vp !== "transition") return;
    sfx.battleStartSound();
    const run = async () => {
      for (let i = 0; i < 4; i++) {
        setFlashOpacity(0.6 + i * 0.1);
        setIntroShake(3 + i);
        await sleep(60 - i * 8);
        setFlashOpacity(0);
        await sleep(60 - i * 8);
      }
      setIntroShake(0);
      setWipeDir("close");
      setWipePhase(1);
      await sleep(350);
      setWipePhase(2);
      await sleep(200);
      setBlackOverlay(0);
      setWipeDir("open");
      setWipePhase(3);
      await sleep(400);
      setWipePhase(0);
      setFlashOpacity(0.7);
      await sleep(60);
      setFlashOpacity(0);
      await sleep(150);
      setVp("slide_in");
    };
    run();
  }, [vp]);

  // === SLIDE IN ===
  useEffect(() => {
    if (vp !== "slide_in") return;
    const start = Date.now();
    const frame = () => {
      const t = Math.min(1, (Date.now() - start) / 800);
      const e = 1 - Math.pow(1 - t, 3);
      setEnemyX(120 * (1 - e)); setPlayerX(-120 * (1 - e));
      if (t < 1) requestAnimationFrame(frame);
      else { setEnemyX(0); setPlayerX(0); setVp("appeared_text"); }
    };
    requestAnimationFrame(frame);
  }, [vp]);

  // === APPEARED TEXT ===
  useEffect(() => {
    if (vp !== "appeared_text") return;
    const run = async () => {
      await typewrite(`Wild ${creature.name} appeared!`);
      await sleep(700);
      setVp("go_text");
    };
    run();
  }, [vp, creature.name, typewrite]);

  // === GO TEXT ===
  useEffect(() => {
    if (vp !== "go_text") return;
    const run = async () => {
      await typewrite("Go! Show them what you've got!");
      await sleep(500);
      setText(""); setMenuIdx(0);
      setVp("player_turn");
    };
    run();
  }, [vp, typewrite]);

  // === ANIMATE PLAYER ATTACK (reusable async function) ===
  const animatePlayerAttack = useCallback(async (
    move: Move,
    before: EncounterState,
    after: EncounterState,
  ) => {
    setEnemyBob(false);
    const logEntries = after.battleLog.slice(before.battleLog.length);
    const dmgEntry = logEntries.find((e) => e.damage !== undefined && e.type === "player_attack");
    const dmg = dmgEntry?.damage ?? 0;

    await typewrite(`You used ${move.name}!`);
    sfx.menuSelect();

    if (move.power > 0) {
      setPlayerLunge(true); await sleep(150);
      await playEffect(move.animation, "e");
      setPlayerLunge(false);
      setScreenFlash(true); sfx.attackHit(); await sleep(100); setScreenFlash(false);
      setEnemyShake(true); showDmg(dmg, "e"); await sleep(300); setEnemyShake(false);
      await drainHp("e", before.creatureHp, after.creatureHp);

      // Effectiveness messages
      const effMsg = logEntries.find((e) => e.type === "effectiveness");
      if (effMsg) { await typewrite(effMsg.message); await sleep(300); }

      // Secondary effect messages (burn, stat changes)
      for (const entry of logEntries) {
        if (entry.type === "stat_change" || (entry.type === "info" && entry.message.includes("burned"))) {
          await typewrite(entry.message); await sleep(300);
        }
      }

      // Struggle recoil
      const recoilEntry = logEntries.find((e) => e.type === "info" && e.message.includes("recoil"));
      if (recoilEntry) {
        await typewrite(recoilEntry.message);
        setPlayerShake(true); await sleep(200); setPlayerShake(false);
        await drainHp("p", before.playerHp, after.playerHp);
      }
    } else {
      await playEffect(move.animation, "p");
      const statMsg = logEntries.find((e) => e.type === "stat_change");
      if (statMsg) { await sleep(200); await typewrite(statMsg.message); sfx.statUpSound(); }
    }

    setEnemyBob(true);
  }, [typewrite, drainHp, showDmg, playEffect]);

  // === ANIMATE CREATURE TURN (reusable async function) ===
  const animateCreatureTurn = useCallback(async (
    before: EncounterState,
    after: EncounterState,
  ) => {
    setPlayerBob(false);
    const logEntries = after.battleLog.slice(before.battleLog.length);
    const atkEntry = logEntries.find((e) => e.type === "creature_attack");
    const dmg = atkEntry?.damage ?? 0;
    const moveAnim = atkEntry?.moveAnimation ?? "slash";
    const isStatus = dmg === 0 && logEntries.some((e) => e.type === "stat_change");
    const moveName = atkEntry?.message?.match(/used (.+)!/)?.[1] ?? "attack";

    await typewrite(`${before.creature.name} used ${moveName}!`);

    if (!isStatus && dmg > 0) {
      setCreatureLunge(true); await sleep(150);
      await playEffect(moveAnim, "p");
      setCreatureLunge(false);
      setScreenFlash(true); sfx.attackHit(); await sleep(100); setScreenFlash(false);
      setPlayerShake(true); showDmg(dmg, "p"); await sleep(300); setPlayerShake(false);
      await drainHp("p", before.playerHp, after.playerHp);

      // Effectiveness messages
      const effMsg = logEntries.find((e) => e.type === "effectiveness");
      if (effMsg) { await typewrite(effMsg.message); await sleep(300); }

      // Secondary effects from creature's damaging moves
      for (const entry of logEntries) {
        if (entry.type === "stat_change" || (entry.type === "info" && entry.message.includes("burned"))) {
          await typewrite(entry.message);
          if (entry.message.includes("burned")) { /* no extra sound */ }
          else if (entry.message.includes("fell")) sfx.statDownSound();
          await sleep(300);
        }
      }
    } else if (isStatus) {
      await playEffect(moveAnim, "e");
      const statMsg = logEntries.find((e) => e.type === "stat_change");
      if (statMsg) {
        await sleep(200);
        await typewrite(statMsg.message);
        if (statMsg.message.includes("rose")) sfx.statUpSound();
        else sfx.statDownSound();
      }
    }

    // Burn damage at end of turn
    const burnEntries = logEntries.filter((e) => e.type === "status_damage");
    for (const burnEntry of burnEntries) {
      await typewrite(burnEntry.message);
      const burnDmg = burnEntry.damage ?? 0;
      if (burnEntry.message.includes("You")) {
        setPlayerShake(true); showDmg(burnDmg, "p"); await sleep(200); setPlayerShake(false);
        await drainHp("p", playerHp, Math.max(0, playerHp - burnDmg));
      } else {
        setEnemyShake(true); showDmg(burnDmg, "e"); await sleep(200); setEnemyShake(false);
        await drainHp("e", enemyHp, Math.max(0, enemyHp - burnDmg));
      }
      await sleep(200);
    }

    setPlayerBob(true);
  }, [typewrite, drainHp, showDmg, playEffect, playerHp, enemyHp]);

  // === FULL TURN: Player picks a move → speed determines who goes first ===
  const doPlayerAttack = useCallback(async (move: Move) => {
    onFirstGesture();
    setVp("animating");
    const cur = stateRef.current;

    // Check if all moves are exhausted — force Struggle
    const actualMove = move.name === "Struggle" ? STRUGGLE_MOVE : move;

    // Execute both sides to determine turn order + outcomes
    const afterPlayer = executePlayerMove(cur, actualMove);
    const creatureGoesFirst = afterPlayer.creatureGoesFirst ?? false;

    if (creatureGoesFirst) {
      // Creature attacks first
      const afterCreature = executeCreatureTurn(cur);
      await animateCreatureTurn(cur, afterCreature);
      setState(afterCreature);
      await sleep(300);

      if (afterCreature.result === "lose") { setVp("faint_anim"); return; }

      // Now player attacks on the post-creature state
      const afterPlayerOnUpdated = executePlayerMove(afterCreature, actualMove);
      await animatePlayerAttack(actualMove, afterCreature, afterPlayerOnUpdated);
      setState(afterPlayerOnUpdated);
      await sleep(300);

      if (afterPlayerOnUpdated.result === "win") { setVp("faint_anim"); return; }
      if (afterPlayerOnUpdated.result === "lose") { setVp("faint_anim"); return; }

      setText(""); setMenuIdx(0);
      setVp("player_turn");
    } else {
      // Player attacks first (original flow)
      await animatePlayerAttack(actualMove, cur, afterPlayer);
      setState(afterPlayer);
      await sleep(300);

      if (afterPlayer.result === "win") { setVp("faint_anim"); return; }
      if (afterPlayer.result === "lose") { setVp("faint_anim"); return; }

      // Creature turn
      const afterCreature = executeCreatureTurn(afterPlayer);
      await animateCreatureTurn(afterPlayer, afterCreature);
      setState(afterCreature);
      await sleep(300);

      if (afterCreature.result === "lose") { setVp("faint_anim"); return; }

      setText(""); setMenuIdx(0);
      setVp("player_turn");
    }
  }, [animatePlayerAttack, animateCreatureTurn, onFirstGesture]);

  // === PLAYER DEFEND ===
  const doPlayerDefend = useCallback(async () => {
    onFirstGesture();
    setVp("animating");
    const cur = stateRef.current;
    const afterDefend = executePlayerDefend(cur);
    const creatureGoesFirst = afterDefend.creatureGoesFirst ?? false;

    if (creatureGoesFirst) {
      // Creature attacks before player defends
      const afterCreature = executeCreatureTurn(cur);
      await animateCreatureTurn(cur, afterCreature);
      setState(afterCreature);
      await sleep(300);

      if (afterCreature.result === "lose") { setVp("faint_anim"); return; }

      // Now player defends
      const afterDefendOnUpdated = executePlayerDefend(afterCreature);
      await typewrite("You brace yourself!");
      await playEffect("shimmer", "p");
      sfx.statUpSound();
      await typewrite("Defense rose temporarily!");
      setState(afterDefendOnUpdated);
      await sleep(300);
    } else {
      // Player defends first, then creature attacks
      await typewrite("You brace yourself!");
      await playEffect("shimmer", "p");
      sfx.statUpSound();
      await typewrite("Defense rose temporarily!");
      setState(afterDefend);
      await sleep(300);

      const afterCreature = executeCreatureTurn(afterDefend);
      await animateCreatureTurn(afterDefend, afterCreature);
      setState(afterCreature);
      await sleep(300);

      if (afterCreature.result === "lose") { setVp("faint_anim"); return; }
    }

    setText(""); setMenuIdx(0);
    setVp("player_turn");
  }, [typewrite, playEffect, animateCreatureTurn, onFirstGesture]);

  // === PLAYER FLEE ===
  const doPlayerFlee = useCallback(async () => {
    onFirstGesture();
    setVp("animating");
    const cur = stateRef.current;
    const after = executePlayerFlee(cur);

    if (after.result === "flee") {
      sfx.fleeSound();
      await typewrite("Got away safely!");
      setState(after);
      await sleep(800);
      recordFlee();
      onClose("flee");
      return;
    }

    sfx.fleeFailSound();
    await typewrite("Can't escape!");
    setState(after);
    await sleep(400);

    // Creature gets a free turn
    const afterCreature = executeCreatureTurn(after);
    await animateCreatureTurn(after, afterCreature);
    setState(afterCreature);
    await sleep(300);

    if (afterCreature.result === "lose") { setVp("faint_anim"); return; }
    setText(""); setMenuIdx(0);
    setVp("player_turn");
  }, [typewrite, animateCreatureTurn, onClose, onFirstGesture]);

  // === FAINT ===
  useEffect(() => {
    if (vp !== "faint_anim") return;
    const run = async () => {
      const s = stateRef.current;
      const isLoss = s.result === "lose";
      sfx.faintSound();
      for (let i = 1; i <= 8; i++) {
        if (isLoss) setPlayerFaintY(i * 10); else setEnemyFaintY(i * 10);
        await sleep(80);
      }
      await sleep(400);
      if (s.result === "win") {
        await typewrite(`Wild ${s.creature.name} fainted!`);
        await sleep(800); recordWin(); setVp("xp_gain");
      } else {
        await typewrite("You blacked out...");
        await sleep(1500); recordLoss(); onClose("lose");
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vp]);

  // === XP GAIN ===
  useEffect(() => {
    if (vp !== "xp_gain") return;
    const run = async () => {
      const s = stateRef.current;
      await typewrite(`You gained ${s.xpGained} EXP. Points!`);
      const before = getLevelProgress();
      const { leveledUp, newLevel } = addXp(s.xpGained);
      const after = getLevelProgress();
      setXpPct(before.percent);
      await sleep(300);
      sfx.xpDing();
      const end = leveledUp ? 100 : after.percent;
      const start = Date.now();
      await new Promise<void>((r) => {
        const f = () => {
          const t = Math.min(1, (Date.now() - start) / 800);
          setXpPct(before.percent + (end - before.percent) * t);
          if (t < 1) requestAnimationFrame(f); else r();
        };
        requestAnimationFrame(f);
      });
      await sleep(400);
      if (leveledUp) {
        setLevelUpMsg(`Grew to LV ${newLevel}!`);
        sfx.levelUpSound();
        setVp("level_up");
      } else { setVp("done"); }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vp]);

  // === LEVEL UP ===
  useEffect(() => {
    if (vp !== "level_up") return;
    const run = async () => { await typewrite(levelUpMsg ?? "Level up!"); await sleep(1500); setVp("done"); };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vp]);

  // === DONE ===
  useEffect(() => {
    if (vp !== "done") return;
    sfx.victoryFanfare();
    typewrite("Press any key to continue...");
  }, [vp, typewrite]);

  const handleDone = useCallback(() => {
    const s = stateRef.current;
    if (vp === "done") onClose(s.result ?? "win");
  }, [vp, onClose]);

  // Check if all player moves are at 0 PP (Struggle condition)
  const allMovesExhausted = state.player.moves.every((m) => m.pp <= 0);

  // Keyboard controls
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      e.stopPropagation();
      sfx.ensureAudioReady(); // Gesture guard
      if (vp === "done") { handleDone(); return; }
      if (vp === "player_turn") {
        if (e.key === "ArrowUp" || e.key === "w") { setMenuIdx((c) => Math.max(0, c - 1)); sfx.menuBlip(); }
        else if (e.key === "ArrowDown" || e.key === "s") { setMenuIdx((c) => Math.min(2, c + 1)); sfx.menuBlip(); }
        else if (e.key === "Enter" || e.key === "e" || e.key === " ") {
          sfx.menuSelect();
          if (menuIdx === 0) {
            if (allMovesExhausted) { doPlayerAttack(STRUGGLE_MOVE); }
            else { setMoveIdx(0); setVp("move_select"); }
          }
          else if (menuIdx === 1) doPlayerDefend();
          else doPlayerFlee();
        }
      } else if (vp === "move_select") {
        const moves = stateRef.current.player.moves;
        if (e.key === "ArrowUp" || e.key === "w") { setMoveIdx((c) => Math.max(0, c - 2)); sfx.menuBlip(); }
        else if (e.key === "ArrowDown" || e.key === "s") { setMoveIdx((c) => Math.min(moves.length - 1, c + 2)); sfx.menuBlip(); }
        else if (e.key === "ArrowLeft" || e.key === "a") { setMoveIdx((c) => Math.max(0, c - 1)); sfx.menuBlip(); }
        else if (e.key === "ArrowRight" || e.key === "d") { setMoveIdx((c) => Math.min(moves.length - 1, c + 1)); sfx.menuBlip(); }
        else if (e.key === "Escape" || e.key === "Backspace") { setVp("player_turn"); sfx.menuBlip(); }
        else if (e.key === "Enter" || e.key === "e" || e.key === " ") {
          const m = moves[moveIdx];
          if (m && m.pp > 0) doPlayerAttack(m);
        }
      }
    };
    window.addEventListener("keydown", handle, true);
    return () => window.removeEventListener("keydown", handle, true);
  }, [vp, menuIdx, moveIdx, allMovesExhausted, handleDone, doPlayerAttack, doPlayerDefend, doPlayerFlee]);

  useEffect(() => () => { if (twRef.current) clearTimeout(twRef.current); }, []);

  // HP bar helpers
  const hpColor = (cur: number, max: number) => {
    const p = max > 0 ? (cur / max) * 100 : 0;
    return p >= 50 ? "#22c55e" : p >= 21 ? "#eab308" : "#ef4444";
  };
  const hpW = (cur: number, max: number) => max > 0 ? `${Math.max(0, (cur / max) * 100)}%` : "0%";
  const typeCol = TYPE_COLORS[creature.type] ?? "#6b7280";

  const showMainMenu = vp === "player_turn";
  const showMoveMenu = vp === "move_select";

  // Stable intro shake offset (not recalculated on re-renders)
  const shakeOffset = useMemo(() => ({ x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) }), [introShake]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-[100] select-none" onClick={(e) => { stop(e); onFirstGesture(); }} onPointerDown={stop} onContextMenu={stop} style={{ touchAction: "none" }}>
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        <div className="relative w-full max-w-[640px] max-h-[576px] aspect-[10/9] overflow-hidden" style={{ imageRendering: "pixelated" }}>

          {/* Battle background — Pokemon Crystal style with sky, terrain, platforms */}
          <div className="absolute inset-x-0 top-0 bottom-[33.3%]" style={{
            transform: introShake ? `translate(${shakeOffset.x * introShake}px, ${shakeOffset.y * introShake}px)` : undefined,
          }}>
            {/* Sky gradient */}
            <div className="absolute inset-x-0 top-0 h-[45%]" style={{
              background: "linear-gradient(180deg, #90d8f8 0%, #b8e8c8 70%, #d0f0d0 100%)",
            }} />

            {/* Distant hills / treeline silhouette */}
            <div className="absolute left-0 right-0 top-[32%] h-[16%]" style={{
              background: `
                radial-gradient(ellipse 30% 100% at 15% 100%, #5a9858 0%, transparent 70%),
                radial-gradient(ellipse 25% 100% at 40% 100%, #4a8848 0%, transparent 70%),
                radial-gradient(ellipse 35% 100% at 65% 100%, #5a9858 0%, transparent 70%),
                radial-gradient(ellipse 20% 100% at 85% 100%, #4a8848 0%, transparent 70%)
              `,
            }} />

            {/* Main ground plane */}
            <div className="absolute inset-x-0 top-[45%] bottom-0" style={{
              background: "linear-gradient(180deg, #78b860 0%, #88c868 15%, #68a850 40%, #58a040 70%, #489838 100%)",
            }} />

            {/* Ground texture lines */}
            {[...Array(8)].map((_, i) => (
              <div key={`gl-${i}`} className="absolute left-0 right-0" style={{
                top: `${48 + i * 6.5}%`,
                height: "2px",
                background: i % 2 === 0
                  ? "repeating-linear-gradient(90deg, transparent 0px, transparent 12px, #70b050 12px, #70b050 16px, transparent 16px, transparent 28px)"
                  : "repeating-linear-gradient(90deg, transparent 0px, transparent 6px, #60a040 6px, #60a040 10px, transparent 10px, transparent 22px)",
                opacity: 0.4 + (i * 0.06),
              }} />
            ))}

            {/* Grass tufts */}
            {[...Array(12)].map((_, i) => (
              <div key={`gt-${i}`} className="absolute" style={{
                left: `${5 + ((i * 37 + 13) % 90)}%`,
                top: `${52 + ((i * 23 + 7) % 42)}%`,
                width: `${4 + (i % 3) * 2}px`,
                height: `${3 + (i % 2) * 2}px`,
                backgroundColor: i % 3 === 0 ? "#60a848" : i % 3 === 1 ? "#80c868" : "#50a038",
                borderRadius: "1px 1px 0 0",
                opacity: 0.6,
              }} />
            ))}

            {/* Enemy platform */}
            <div className="absolute right-[2%] top-[38%] w-[45%] h-[22%]" style={{
              background: "linear-gradient(180deg, #88c868 0%, #78b858 30%, #68a848 100%)",
              clipPath: "polygon(10% 45%, 90% 35%, 100% 100%, 0% 100%)",
            }} />
            <div className="absolute right-[2%] top-[38%] w-[45%] h-[22%]" style={{
              background: "linear-gradient(180deg, #a0d880 0%, transparent 40%)",
              clipPath: "polygon(10% 45%, 90% 35%, 90% 42%, 10% 52%)",
              opacity: 0.7,
            }} />

            {/* Player platform */}
            <div className="absolute left-[-5%] bottom-0 w-[50%] h-[35%]" style={{
              background: "linear-gradient(180deg, #78b858 0%, #68a848 40%, #589838 100%)",
              clipPath: "polygon(0% 30%, 85% 20%, 100% 100%, 0% 100%)",
            }} />
            <div className="absolute left-[-5%] bottom-0 w-[50%] h-[35%]" style={{
              background: "linear-gradient(180deg, #98d070 0%, transparent 35%)",
              clipPath: "polygon(0% 30%, 85% 20%, 85% 27%, 0% 37%)",
              opacity: 0.6,
            }} />

            {/* --- ENEMY HUD (top-left) --- */}
            <div className="absolute left-[2%] top-[4%] w-[48%] z-10">
              <div className="bg-[#f8f0d8] border-[3px] border-[#484848] p-1.5" style={{ boxShadow: "3px 3px 0 rgba(0,0,0,0.15)" }}>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-pixel text-[10px] text-[#383838] uppercase">{creature.name}</span>
                  <span className="font-pixel text-[9px] text-[#383838]">Lv{creature.level}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-pixel text-[7px] text-[#f87171]">HP</span>
                  <div className="flex-1 h-[6px] bg-[#282828] border border-[#181818] overflow-hidden">
                    <div className="h-full transition-none" style={{ width: hpW(enemyHp, creature.stats.maxHp), backgroundColor: hpColor(enemyHp, creature.stats.maxHp) }} />
                  </div>
                </div>
              </div>
            </div>

            {/* --- ENEMY SPRITE --- */}
            <div className="absolute right-[8%] top-[3%] w-[30%] aspect-square z-[5]" style={{
              transform: `translateX(${enemyX}%) translateY(${enemyFaintY}px)`,
              clipPath: enemyFaintY > 0 ? `inset(0 0 ${enemyFaintY}px 0)` : undefined,
              animation: enemyShake ? "pkmn-shake 0.06s linear infinite" : enemyBob ? "pkmn-idle 0.8s ease-in-out infinite" : undefined,
            }}>
              <div className="absolute bottom-0 left-[15%] right-[15%] h-[8%] bg-black/20 rounded-full" />
              {creatureSpriteUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={creatureSpriteUrl} alt={creature.name} className="w-full h-full object-contain" style={{ imageRendering: "pixelated" }} />
              ) : (
                <div className="w-full h-full flex items-center justify-center border-4" style={{ backgroundColor: typeCol, borderColor: `${typeCol}88` }}>
                  <span className="font-pixel text-white text-[9px] text-center drop-shadow-[1px_1px_0_rgba(0,0,0,0.5)]">{creature.name}</span>
                </div>
              )}
              {dmgNum && dmgNum.side === "e" && (
                <div key={dmgNum.k} className="absolute -top-1 left-1/2 -translate-x-1/2 font-pixel text-sm text-white pkmn-dmg-float" style={{ textShadow: "1px 1px 0 #000, -1px -1px 0 #000" }}>-{dmgNum.v}</div>
              )}
              {atkEffect && atkEffect.side === "e" && <AttackEffect anim={atkEffect.anim} />}
            </div>

            {/* --- PLAYER SPRITE --- */}
            <div className="absolute left-[6%] bottom-[2%] w-[26%] aspect-square z-[5]" style={{
              transform: `translateX(${playerX}%) translateY(${playerFaintY}px)`,
              clipPath: playerFaintY > 0 ? `inset(0 0 ${playerFaintY}px 0)` : undefined,
              animation: playerShake ? "pkmn-shake 0.06s linear infinite" : playerBob ? "pkmn-idle 0.8s ease-in-out infinite" : undefined,
            }}>
              <div className="absolute bottom-0 left-[15%] right-[15%] h-[8%] bg-black/20 rounded-full" />
              {playerSpriteUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={playerSpriteUrl} alt="Player" className="w-full h-full object-contain" style={{ imageRendering: "pixelated" }} />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[#4060a8] border-4 border-[#6888c8]">
                  <span className="font-pixel text-white text-[10px]">YOU</span>
                </div>
              )}
              {dmgNum && dmgNum.side === "p" && (
                <div key={dmgNum.k} className="absolute -top-1 left-1/2 -translate-x-1/2 font-pixel text-sm text-white pkmn-dmg-float" style={{ textShadow: "1px 1px 0 #000, -1px -1px 0 #000" }}>-{dmgNum.v}</div>
              )}
              {atkEffect && atkEffect.side === "p" && <AttackEffect anim={atkEffect.anim} />}
            </div>

            {/* --- PLAYER HUD --- */}
            <div className="absolute right-[2%] bottom-[2%] w-[50%] z-10">
              <div className="bg-[#f8f0d8] border-[3px] border-[#484848] p-1.5" style={{ boxShadow: "3px 3px 0 rgba(0,0,0,0.15)" }}>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-pixel text-[10px] text-[#383838]">PLAYER</span>
                  <span className="font-pixel text-[9px] text-[#383838]">Lv{state.player.level}</span>
                </div>
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="font-pixel text-[7px] text-[#f87171]">HP</span>
                  <div className="flex-1 h-[6px] bg-[#282828] border border-[#181818] overflow-hidden">
                    <div className="h-full transition-none" style={{ width: hpW(playerHp, state.player.maxHp), backgroundColor: hpColor(playerHp, state.player.maxHp) }} />
                  </div>
                </div>
                <div className="text-right font-pixel text-[8px] text-[#383838] mb-1">{playerHp}/{state.player.maxHp}</div>
                <div className="flex items-center gap-1">
                  <span className="font-pixel text-[7px] text-[#6868a8]">EXP</span>
                  <div className="flex-1 h-[4px] bg-[#282828] border border-[#181818] overflow-hidden">
                    <div className="h-full bg-[#48b8e8] transition-none" style={{ width: `${xpPct}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Lunge indicators */}
            {playerLunge && <div className="absolute left-[30%] bottom-[25%] w-4 h-4 bg-white/40 rounded-full pkmn-lunge-r" />}
            {creatureLunge && <div className="absolute right-[30%] top-[35%] w-4 h-4 bg-white/40 rounded-full pkmn-lunge-l" />}
          </div>

          {/* === TEXT BOX + MENUS (bottom 1/3) === */}
          <div className="absolute inset-x-0 bottom-0 h-[33.3%] bg-[#f8f0e0] border-t-[4px] border-[#484848]">
            <div className="h-full flex">
              {/* Text area */}
              <div className="flex-1 p-3 flex flex-col justify-start overflow-hidden">
                <p className="font-pixel text-[11px] text-[#383838] leading-relaxed whitespace-pre-wrap">
                  {text}{!textDone && <span className="animate-pulse">|</span>}
                </p>
              </div>

              {/* Main menu: FIGHT / DEFEND / RUN */}
              {showMainMenu && (
                <div className="w-[40%] border-l-[4px] border-[#484848] bg-[#f8f0d8] p-2 flex flex-col justify-center gap-0.5">
                  {(["FIGHT", "DEFEND", "RUN"] as const).map((label, i) => (
                    <button key={label} onClick={() => {
                      onFirstGesture(); setMenuIdx(i); sfx.menuSelect();
                      if (i === 0) {
                        if (allMovesExhausted) { doPlayerAttack(STRUGGLE_MOVE); }
                        else { setMoveIdx(0); setVp("move_select"); }
                      }
                      else if (i === 1) doPlayerDefend();
                      else doPlayerFlee();
                    }} onMouseEnter={() => { setMenuIdx(i); sfx.menuBlip(); }}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-left hover:bg-[#484848]/10 transition-colors">
                      <span className="font-pixel text-[10px] text-[#383838] w-3">{menuIdx === i ? "\u25B6" : ""}</span>
                      <span className="font-pixel text-[11px] text-[#383838] tracking-wider">
                        {i === 0 && allMovesExhausted ? "STRUGGLE" : label}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Move submenu: 2x2 grid of 4 moves */}
              {showMoveMenu && (
                <div className="w-[55%] border-l-[4px] border-[#484848] bg-[#f8f0d8] p-1.5 flex flex-col justify-center">
                  <div className="grid grid-cols-2 gap-0.5">
                    {state.player.moves.map((m, i) => (
                      <button key={m.name} onClick={() => { onFirstGesture(); if (m.pp > 0) { setMoveIdx(i); doPlayerAttack(m); } }}
                        onMouseEnter={() => { setMoveIdx(i); sfx.menuBlip(); }}
                        disabled={m.pp <= 0}
                        className={`flex flex-col px-1.5 py-1 text-left transition-colors ${m.pp <= 0 ? "opacity-30" : "hover:bg-[#484848]/10"}`}>
                        <div className="flex items-center gap-1">
                          <span className="font-pixel text-[8px] text-[#383838] w-2.5">{moveIdx === i ? "\u25B6" : ""}</span>
                          <span className="font-pixel text-[9px] text-[#383838] truncate">{m.name}</span>
                        </div>
                        <span className="font-pixel text-[7px] text-[#888] ml-3.5">PP {m.pp}/{m.maxPp}</span>
                      </button>
                    ))}
                  </div>
                  <button onClick={() => { setVp("player_turn"); sfx.menuBlip(); }}
                    className="mt-1 font-pixel text-[8px] text-[#888] hover:text-[#383838] text-center">
                    [BACK]
                  </button>
                </div>
              )}

              {/* Done click zone */}
              {vp === "done" && <button onClick={handleDone} className="absolute inset-0 cursor-pointer" />}
            </div>
          </div>

          {/* Screen flash */}
          {screenFlash && <div className="absolute inset-0 bg-white/80 pointer-events-none z-20" />}
          {flashOpacity > 0 && <div className="absolute inset-0 bg-white pointer-events-none z-20" style={{ opacity: flashOpacity }} />}
          {blackOverlay > 0 && <div className="absolute inset-0 bg-black pointer-events-none z-20 transition-opacity duration-400" style={{ opacity: blackOverlay }} />}

          {/* Venetian blind wipe overlay */}
          {wipePhase > 0 && (
            <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
              {[...Array(10)].map((_, i) => (
                <div key={`wipe-${i}`} className="absolute left-0 right-0" style={{
                  top: `${i * 10}%`,
                  height: "10%",
                  backgroundColor: "#000",
                  transform: wipePhase === 1 ? `scaleY(0)` : wipePhase === 2 ? `scaleY(1)` : `scaleY(0)`,
                  transformOrigin: wipeDir === "close" ? "top" : "bottom",
                  animation:
                    wipePhase === 1 ? `wipe-bar-close 0.35s ease-out ${i * 0.025}s forwards` :
                    wipePhase === 3 ? `wipe-bar-open 0.4s ease-in ${i * 0.03}s forwards` : undefined,
                }} />
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes pkmn-idle { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
        @keyframes pkmn-shake { 0% { transform: translateX(0); } 25% { transform: translateX(-3px); } 50% { transform: translateX(3px); } 75% { transform: translateX(-2px); } 100% { transform: translateX(0); } }
        @keyframes wipe-bar-close { 0% { transform: scaleY(0); } 100% { transform: scaleY(1); } }
        @keyframes wipe-bar-open { 0% { transform: scaleY(1); } 100% { transform: scaleY(0); } }
        @keyframes pkmn-dmg-float { 0% { opacity: 1; transform: translate(-50%, 0); } 100% { opacity: 0; transform: translate(-50%, -24px); } }
        .pkmn-dmg-float { animation: pkmn-dmg-float 0.9s ease-out forwards; }
        @keyframes pkmn-lunge-r { 0% { transform: translateX(0); opacity: 1; } 100% { transform: translateX(40px); opacity: 0; } }
        .pkmn-lunge-r { animation: pkmn-lunge-r 0.2s ease-out forwards; }
        @keyframes pkmn-lunge-l { 0% { transform: translateX(0); opacity: 1; } 100% { transform: translateX(-40px); opacity: 0; } }
        .pkmn-lunge-l { animation: pkmn-lunge-l 0.2s ease-out forwards; }
        @keyframes pkmn-slash { 0% { clip-path: polygon(0 0, 100% 0, 100% 0, 0 0); opacity: 1; } 50% { clip-path: polygon(0 0, 100% 0, 80% 100%, 20% 100%); opacity: 1; } 100% { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); opacity: 0; } }
        @keyframes pkmn-ember-rise { 0% { transform: translateY(0) scale(1); opacity: 1; } 100% { transform: translateY(-30px) scale(0.3); opacity: 0; } }
        @keyframes pkmn-gust { 0% { transform: translateX(-100%) scaleX(0.5); opacity: 0; } 30% { opacity: 1; } 100% { transform: translateX(100%) scaleX(1.5); opacity: 0; } }
        @keyframes pkmn-water { 0% { transform: translateX(-20px) scale(0.5); opacity: 1; } 100% { transform: translateX(10px) scale(1.2); opacity: 0; } }
        @keyframes pkmn-shimmer { 0%, 100% { opacity: 0; } 25% { opacity: 0.8; } 50% { opacity: 0.2; } 75% { opacity: 0.9; } }
        @keyframes pkmn-quick { 0% { transform: scaleX(0); opacity: 1; } 50% { transform: scaleX(1.5); opacity: 0.8; } 100% { transform: scaleX(0.5); opacity: 0; } }
      `}</style>
    </div>
  );
}

// Attack effect overlays — stable positions via index-based math (no Math.random in render)
function AttackEffect({ anim }: { anim: Move["animation"] }) {
  // Pre-computed stable particle positions per index
  const particles = useMemo(() => {
    return [...Array(6)].map((_, i) => ({
      w: 6 + ((i * 7 + 3) % 5),
      h: 6 + ((i * 3 + 1) % 4),
      left: 20 + ((i * 17 + 5) % 60),
      bottom: 10 + ((i * 11 + 2) % 20),
      dur: 0.3 + ((i * 13 + 7) % 30) / 100,
    }));
  }, []);

  switch (anim) {
    case "slash":
    case "bite":
      return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
          <div className="absolute inset-0 bg-white" style={{ animation: "pkmn-slash 0.15s ease-out forwards" }} />
          <div className="absolute top-[20%] left-[10%] w-[80%] h-[3px] bg-white rotate-[-30deg]" style={{ animation: "pkmn-slash 0.2s ease-out forwards", animationDelay: "0.05s" }} />
        </div>
      );
    case "ember":
      return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
          {particles.map((p, i) => (
            <div key={i} className="absolute rounded-full" style={{
              width: p.w, height: p.h,
              left: `${p.left}%`, bottom: `${p.bottom}%`,
              backgroundColor: ["#f97316", "#ef4444", "#fbbf24"][i % 3],
              animation: `pkmn-ember-rise ${p.dur}s ease-out forwards`,
              animationDelay: `${i * 0.06}s`,
            }} />
          ))}
        </div>
      );
    case "water":
      return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="absolute rounded-full" style={{
              width: 8, height: 8,
              top: `${25 + i * 15}%`, left: "30%",
              backgroundColor: "#60a5fa",
              animation: `pkmn-water ${0.35}s ease-out forwards`,
              animationDelay: `${i * 0.08}s`,
            }} />
          ))}
        </div>
      );
    case "gust":
      return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="absolute h-[2px] rounded-full" style={{
              width: "60%", top: `${30 + i * 15}%`, left: 0,
              backgroundColor: "rgba(255,255,255,0.8)",
              animation: `pkmn-gust 0.3s ease-out forwards`,
              animationDelay: `${i * 0.07}s`,
            }} />
          ))}
        </div>
      );
    case "shimmer":
      return (
        <div className="absolute inset-0 pointer-events-none z-10 bg-white/50" style={{ animation: "pkmn-shimmer 0.5s ease-in-out forwards" }} />
      );
    case "debuff":
      return (
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="absolute inset-0 bg-purple-500/30" style={{ animation: "pkmn-shimmer 0.4s ease-in-out forwards" }} />
        </div>
      );
    case "quick":
      return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="absolute h-[2px] bg-white/70" style={{
              width: "70%", top: `${20 + i * 18}%`, left: "-10%",
              animation: `pkmn-quick 0.15s ease-out forwards`,
              animationDelay: `${i * 0.03}s`,
            }} />
          ))}
          <div className="absolute inset-0 bg-white" style={{ animation: "pkmn-slash 0.12s ease-out forwards" }} />
        </div>
      );
    default:
      return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
