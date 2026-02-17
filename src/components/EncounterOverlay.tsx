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
} from "@/lib/encounter-xp";

interface EncounterOverlayProps {
  creature: Creature;
  onClose: (result: "win" | "lose" | "flee") => void;
}

export function EncounterOverlay({ creature, onClose }: EncounterOverlayProps) {
  const [state, setState] = useState<EncounterState>(() =>
    createEncounter(creature, getPlayerBattleStats())
  );
  const [playerShake, setPlayerShake] = useState(false);
  const [creatureShake, setCreatureShake] = useState(false);
  const [floatingDmg, setFloatingDmg] = useState<{
    value: number;
    side: "player" | "creature";
    key: number;
  } | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [levelUpMsg, setLevelUpMsg] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const dmgKey = useRef(0);

  // Start intro -> player turn
  useEffect(() => {
    const timer = setTimeout(() => {
      setState((s) => ({ ...s, phase: "player_turn" }));
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [state.battleLog]);

  // Show result screen when battle ends
  useEffect(() => {
    if (state.result) {
      if (state.result === "win") {
        recordWin();
        const { leveledUp, newLevel } = addXp(state.xpGained);
        if (leveledUp) {
          setLevelUpMsg(`Level Up! You are now level ${newLevel}!`);
        }
      } else if (state.result === "lose") {
        recordLoss();
      } else if (state.result === "flee") {
        recordFlee();
      }

      const delay = state.result === "lose" ? 2000 : 1500;
      const timer = setTimeout(() => setShowResult(true), delay);
      return () => clearTimeout(timer);
    }
  }, [state.result, state.xpGained]);

  // Auto-close on lose after result shows
  useEffect(() => {
    if (showResult && state.result === "lose") {
      const timer = setTimeout(() => onClose("lose"), 3000);
      return () => clearTimeout(timer);
    }
  }, [showResult, state.result, onClose]);

  const showDamage = useCallback((value: number, side: "player" | "creature") => {
    dmgKey.current++;
    setFloatingDmg({ value, side, key: dmgKey.current });
    setTimeout(() => setFloatingDmg(null), 800);
  }, []);

  const handleAction = useCallback(
    (action: BattleAction) => {
      if (state.phase !== "player_turn" || state.result) return;

      setState((s) => ({ ...s, phase: "animating" }));

      const afterPlayer = executePlayerTurn(state, action);

      // Shake creature on attack
      if (action === "attack") {
        setCreatureShake(true);
        setTimeout(() => setCreatureShake(false), 400);

        // Show damage number
        const lastLog = afterPlayer.battleLog[afterPlayer.battleLog.length - 1];
        if (lastLog?.damage) {
          showDamage(lastLog.damage, "creature");
        }
      }

      // Apply player action with delay
      setTimeout(() => {
        setState(afterPlayer);

        if (afterPlayer.result) return; // Battle over

        if (afterPlayer.phase === "creature_turn") {
          // Creature turn after delay
          setTimeout(() => {
            const afterCreature = executeCreatureTurn(afterPlayer);

            // Shake player on creature attack
            const creatureLog = afterCreature.battleLog[afterCreature.battleLog.length - 1];
            if (creatureLog?.damage) {
              setPlayerShake(true);
              setTimeout(() => setPlayerShake(false), 400);
              showDamage(creatureLog.damage, "player");
            }

            setTimeout(() => {
              setState(afterCreature);
            }, 400);
          }, 500);
        }
      }, 400);
    },
    [state, showDamage]
  );

  const playerHpPercent = Math.max(0, (state.playerHp / state.player.maxHp) * 100);
  const creatureHpPercent = Math.max(0, (state.creatureHp / state.creature.stats.maxHp) * 100);

  const hpColor = (percent: number) =>
    percent > 50 ? "bg-green-500" : percent > 25 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center">
      {/* Battle arena */}
      <div className="w-full max-w-2xl px-4">
        {/* Combatants */}
        <div className="flex items-end justify-between mb-6 h-48">
          {/* Player side */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-40">
              <div className="flex justify-between items-center mb-1">
                <span className="font-pixel text-[10px] text-white">YOU</span>
                <span className="font-pixel text-[10px] text-bags-gold">LV{state.player.level}</span>
              </div>
              <div className="w-full h-3 bg-gray-800 border border-gray-600">
                <div
                  className={`h-full transition-all duration-300 ${hpColor(playerHpPercent)}`}
                  style={{ width: `${playerHpPercent}%` }}
                />
              </div>
              <div className="font-pixel text-[8px] text-gray-400 text-right mt-0.5">
                {state.playerHp}/{state.player.maxHp}
              </div>
            </div>
            <div
              className={`w-16 h-16 bg-blue-600 border-2 border-blue-400 flex items-center justify-center transition-transform ${
                playerShake ? "animate-shake" : ""
              }`}
            >
              <span className="font-pixel text-[10px] text-white">YOU</span>
            </div>

            {/* Floating damage on player */}
            {floatingDmg && floatingDmg.side === "player" && (
              <div
                key={floatingDmg.key}
                className="font-pixel text-red-400 text-sm animate-float-up absolute"
              >
                -{floatingDmg.value}
              </div>
            )}
          </div>

          {/* Creature side */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-40">
              <div className="flex justify-between items-center mb-1">
                <span className="font-pixel text-[10px] text-white truncate max-w-[100px]">
                  {state.creature.name}
                </span>
                <span className="font-pixel text-[10px] text-bags-gold">LV{state.creature.level}</span>
              </div>
              <div className="w-full h-3 bg-gray-800 border border-gray-600">
                <div
                  className={`h-full transition-all duration-300 ${hpColor(creatureHpPercent)}`}
                  style={{ width: `${creatureHpPercent}%` }}
                />
              </div>
              <div className="font-pixel text-[8px] text-gray-400 text-right mt-0.5">
                {state.creatureHp}/{state.creature.stats.maxHp}
              </div>
            </div>
            <div className="relative">
              {creature.spriteUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={creature.spriteUrl}
                  alt={creature.name}
                  className={`w-16 h-16 object-contain pixelated transition-transform ${
                    creatureShake ? "animate-shake" : ""
                  }`}
                />
              ) : (
                <div
                  className={`w-16 h-16 bg-red-600 border-2 border-red-400 flex items-center justify-center transition-transform ${
                    creatureShake ? "animate-shake" : ""
                  }`}
                >
                  <span className="font-pixel text-[8px] text-white text-center leading-tight">
                    {creature.name}
                  </span>
                </div>
              )}

              {/* Floating damage on creature */}
              {floatingDmg && floatingDmg.side === "creature" && (
                <div
                  key={floatingDmg.key}
                  className="font-pixel text-red-400 text-sm animate-float-up absolute -top-4 left-1/2 -translate-x-1/2"
                >
                  -{floatingDmg.value}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Battle log */}
        <div
          ref={logRef}
          className="w-full h-28 bg-black/90 border border-gray-700 p-2 overflow-y-auto mb-4 font-mono text-[11px]"
        >
          {state.battleLog.map((entry, i) => (
            <div
              key={i}
              className={`mb-0.5 ${
                entry.type === "player_attack"
                  ? "text-blue-300"
                  : entry.type === "creature_attack"
                    ? "text-red-300"
                    : entry.type === "result"
                      ? "text-bags-gold"
                      : entry.type === "flee"
                        ? "text-yellow-300"
                        : entry.type === "player_defend" || entry.type === "creature_defend"
                          ? "text-cyan-300"
                          : "text-gray-400"
              }`}
            >
              {entry.message}
            </div>
          ))}
        </div>

        {/* Action buttons */}
        {!state.result && (
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => handleAction("attack")}
              disabled={state.phase !== "player_turn"}
              className="font-pixel text-sm px-6 py-2.5 bg-red-800 border-2 border-red-500 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              ATTACK
            </button>
            <button
              onClick={() => handleAction("defend")}
              disabled={state.phase !== "player_turn"}
              className="font-pixel text-sm px-6 py-2.5 bg-cyan-800 border-2 border-cyan-500 text-white hover:bg-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              DEFEND
            </button>
            <button
              onClick={() => handleAction("flee")}
              disabled={state.phase !== "player_turn"}
              className="font-pixel text-sm px-6 py-2.5 bg-yellow-800 border-2 border-yellow-500 text-white hover:bg-yellow-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              FLEE
            </button>
          </div>
        )}

        {/* Result screen */}
        {showResult && state.result === "win" && (
          <div className="text-center mt-4 animate-bounce-in">
            <div className="font-pixel text-3xl text-bags-gold mb-2">VICTORY!</div>
            <div className="font-pixel text-sm text-green-400 mb-1">+{state.xpGained} XP</div>
            {levelUpMsg && (
              <div className="font-pixel text-sm text-bags-gold animate-pulse">{levelUpMsg}</div>
            )}
            <button
              onClick={() => onClose("win")}
              className="font-pixel text-sm px-8 py-2 mt-4 bg-bags-green/20 border border-bags-green text-bags-green hover:bg-bags-green/30 transition-all"
            >
              CONTINUE
            </button>
          </div>
        )}

        {showResult && state.result === "lose" && (
          <div className="text-center mt-4">
            <div className="font-pixel text-3xl text-red-500 animate-pulse">DEFEAT</div>
            <div className="font-pixel text-xs text-gray-400 mt-2">Returning to world...</div>
          </div>
        )}

        {showResult && state.result === "flee" && (
          <div className="text-center mt-4 animate-bounce-in">
            <div className="font-pixel text-2xl text-yellow-400 mb-2">GOT AWAY SAFELY!</div>
            <button
              onClick={() => onClose("flee")}
              className="font-pixel text-sm px-8 py-2 mt-2 bg-bags-green/20 border border-bags-green text-bags-green hover:bg-bags-green/30 transition-all"
            >
              CONTINUE
            </button>
          </div>
        )}
      </div>

      {/* CSS animations */}
      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          50% { transform: translateX(6px); }
          75% { transform: translateX(-4px); }
        }
        @keyframes float-up {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-30px); }
        }
        @keyframes bounce-in {
          0% { transform: scale(0.5); opacity: 0; }
          60% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
        .animate-float-up {
          animation: float-up 0.8s ease-out forwards;
        }
        .animate-bounce-in {
          animation: bounce-in 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
