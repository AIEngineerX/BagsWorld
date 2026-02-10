"use client";

import { useState } from "react";

// Character definitions for the mobile menu - pixel art style with pre-defined classes
const CHARACTERS = [
  {
    id: "ash",
    name: "ASH",
    shortName: "A",
    event: "bagsworld-ash-click",
    buttonClass: "bg-red-500/10 border-red-500/40 hover:bg-red-500/20 hover:border-red-500/60",
    iconClass: "bg-red-500/30 border-red-500/50",
    textClass: "text-red-400",
  },
  {
    id: "toly",
    name: "TOLY",
    shortName: "T",
    event: "bagsworld-toly-click",
    buttonClass:
      "bg-purple-500/10 border-purple-500/40 hover:bg-purple-500/20 hover:border-purple-500/60",
    iconClass: "bg-purple-500/30 border-purple-500/50",
    textClass: "text-purple-400",
  },
  {
    id: "finn",
    name: "FINN",
    shortName: "F",
    event: "bagsworld-finn-click",
    buttonClass:
      "bg-emerald-500/10 border-emerald-500/40 hover:bg-emerald-500/20 hover:border-emerald-500/60",
    iconClass: "bg-emerald-500/30 border-emerald-500/50",
    textClass: "text-emerald-400",
  },
  {
    id: "ghost",
    name: "GHOST",
    shortName: "G",
    event: "bagsworld-dev-click",
    buttonClass:
      "bg-violet-500/10 border-violet-500/40 hover:bg-violet-500/20 hover:border-violet-500/60",
    iconClass: "bg-violet-500/30 border-violet-500/50",
    textClass: "text-violet-400",
  },
  {
    id: "neo",
    name: "NEO",
    shortName: "N",
    event: "bagsworld-neo-click",
    buttonClass: "bg-cyan-500/10 border-cyan-500/40 hover:bg-cyan-500/20 hover:border-cyan-500/60",
    iconClass: "bg-cyan-500/30 border-cyan-500/50",
    textClass: "text-cyan-400",
  },
] as const;

// Academy characters
const ACADEMY_CHARACTERS = [
  {
    id: "ramo",
    name: "RAMO",
    shortName: "R",
    event: "bagsworld-ramo-click",
    buttonClass: "bg-blue-500/10 border-blue-500/40 hover:bg-blue-500/20 hover:border-blue-500/60",
    iconClass: "bg-blue-500/30 border-blue-500/50",
    textClass: "text-blue-400",
  },
  {
    id: "sincara",
    name: "SINCARA",
    shortName: "S",
    event: "bagsworld-sincara-click",
    buttonClass: "bg-pink-500/10 border-pink-500/40 hover:bg-pink-500/20 hover:border-pink-500/60",
    iconClass: "bg-pink-500/30 border-pink-500/50",
    textClass: "text-pink-400",
  },
  {
    id: "stuu",
    name: "STUU",
    shortName: "St",
    event: "bagsworld-stuu-click",
    buttonClass:
      "bg-green-500/10 border-green-500/40 hover:bg-green-500/20 hover:border-green-500/60",
    iconClass: "bg-green-500/30 border-green-500/50",
    textClass: "text-green-400",
  },
  {
    id: "sam",
    name: "SAM",
    shortName: "Sa",
    event: "bagsworld-sam-click",
    buttonClass:
      "bg-yellow-500/10 border-yellow-500/40 hover:bg-yellow-500/20 hover:border-yellow-500/60",
    iconClass: "bg-yellow-500/30 border-yellow-500/50",
    textClass: "text-yellow-400",
  },
  {
    id: "alaa",
    name: "ALAA",
    shortName: "Al",
    event: "bagsworld-alaa-click",
    buttonClass:
      "bg-indigo-500/10 border-indigo-500/40 hover:bg-indigo-500/20 hover:border-indigo-500/60",
    iconClass: "bg-indigo-500/30 border-indigo-500/50",
    textClass: "text-indigo-400",
  },
  {
    id: "carlo",
    name: "CARLO",
    shortName: "C",
    event: "bagsworld-carlo-click",
    buttonClass:
      "bg-orange-500/10 border-orange-500/40 hover:bg-orange-500/20 hover:border-orange-500/60",
    iconClass: "bg-orange-500/30 border-orange-500/50",
    textClass: "text-orange-400",
  },
  {
    id: "bnn",
    name: "BNN",
    shortName: "B",
    event: "bagsworld-bnn-click",
    buttonClass: "bg-cyan-500/10 border-cyan-500/40 hover:bg-cyan-500/20 hover:border-cyan-500/60",
    iconClass: "bg-cyan-500/30 border-cyan-500/50",
    textClass: "text-cyan-400",
  },
] as const;

export function MobileCharacterMenu() {
  const [isOpen, setIsOpen] = useState(false);

  const handleCharacterClick = (eventName: string) => {
    window.dispatchEvent(new CustomEvent(eventName));
    setIsOpen(false);
  };

  return (
    <div
      className="sm:hidden fixed left-4 z-[45]"
      style={{ bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))" }}
    >
      {/* Expanded menu */}
      {isOpen && (
        <div className="absolute bottom-16 left-0 bg-bags-dark border-2 border-bags-green p-3 shadow-lg shadow-bags-green/20 max-h-[60vh] overflow-y-auto">
          <p className="font-pixel text-[10px] text-bags-green mb-3 text-center border-b border-bags-green/30 pb-2">
            [TALK TO]
          </p>
          <div className="flex flex-col gap-2">
            {CHARACTERS.map((char) => (
              <button
                key={char.id}
                onClick={() => handleCharacterClick(char.event)}
                className={`flex items-center gap-3 px-3 py-2.5 border active:scale-95 transition-all min-w-[110px] touch-target ${char.buttonClass}`}
              >
                <div
                  className={`w-6 h-6 border flex items-center justify-center ${char.iconClass}`}
                >
                  <span className={`font-pixel text-[10px] ${char.textClass}`}>
                    {char.shortName}
                  </span>
                </div>
                <span className="font-pixel text-[11px] text-white">{char.name}</span>
              </button>
            ))}
          </div>
          {/* Academy Section */}
          <p className="font-pixel text-[10px] text-blue-400 mt-3 mb-2 text-center border-t border-blue-500/30 pt-2">
            [ACADEMY]
          </p>
          <div className="flex flex-col gap-2">
            {ACADEMY_CHARACTERS.map((char) => (
              <button
                key={char.id}
                onClick={() => handleCharacterClick(char.event)}
                className={`flex items-center gap-3 px-3 py-2.5 border active:scale-95 transition-all min-w-[110px] touch-target ${char.buttonClass}`}
              >
                <div
                  className={`w-6 h-6 border flex items-center justify-center ${char.iconClass}`}
                >
                  <span className={`font-pixel text-[10px] ${char.textClass}`}>
                    {char.shortName}
                  </span>
                </div>
                <span className="font-pixel text-[11px] text-white">{char.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Toggle button - pixel style */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-bags-dark border-2 border-bags-green flex items-center justify-center shadow-lg shadow-bags-green/30 hover:bg-bags-green/10 active:scale-95 transition-all"
        aria-label="Open character menu"
      >
        <span className="font-pixel text-bags-green text-xs">{isOpen ? "[X]" : "[?]"}</span>
      </button>
    </div>
  );
}
