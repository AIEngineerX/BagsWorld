"use client";

import { useState } from "react";

// Character definitions for the mobile menu
const CHARACTERS = [
  { id: "ash", name: "Ash", icon: "▲", color: "red", event: "bagsworld-ash-click" },
  { id: "toly", name: "Toly", icon: "◉", color: "purple", event: "bagsworld-toly-click" },
  { id: "finn", name: "Finn", icon: "◈", color: "emerald", event: "bagsworld-finn-click" },
  { id: "ghost", name: "Ghost", icon: "◌", color: "purple", event: "bagsworld-dev-click" },
  { id: "neo", name: "Neo", icon: "⬡", color: "cyan", event: "bagsworld-neo-click" },
] as const;

export function MobileCharacterMenu() {
  const [isOpen, setIsOpen] = useState(false);

  const handleCharacterClick = (eventName: string) => {
    window.dispatchEvent(new CustomEvent(eventName));
    setIsOpen(false);
  };

  return (
    <div className="sm:hidden fixed bottom-20 right-4 z-50">
      {/* Expanded menu */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 bg-bags-dark border-2 border-bags-green p-2 rounded-lg shadow-lg">
          <p className="font-pixel text-[8px] text-gray-400 mb-2 text-center">TALK TO</p>
          <div className="flex flex-col gap-2">
            {CHARACTERS.map((char) => (
              <button
                key={char.id}
                onClick={() => handleCharacterClick(char.event)}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded
                  bg-${char.color}-500/20 border border-${char.color}-500/50
                  hover:bg-${char.color}-500/30 transition-colors
                  min-w-[100px]
                `}
              >
                <span className="text-lg">{char.icon}</span>
                <span className="font-pixel text-[10px] text-white">{char.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-14 h-14 rounded-full
          bg-bags-green/20 border-2 border-bags-green
          flex items-center justify-center
          shadow-lg hover:bg-bags-green/30 transition-all
          ${isOpen ? "rotate-45" : ""}
        `}
        aria-label="Open character menu"
      >
        <span className="text-2xl">{isOpen ? "✕" : "💬"}</span>
      </button>
    </div>
  );
}
