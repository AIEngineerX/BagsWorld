"use client";

import { useState, useCallback } from "react";
import { useGameStore } from "@/lib/store";
import { ZoneType } from "@/lib/types";

interface MiniMapProps {
  onNavigate?: (zone: ZoneType) => void;
}

// Map locations - clean, minimal design
const PARK_LOCATIONS = [
  { id: "pokecenter", name: "PokeCenter", event: "bagsworld-pokecenter-click", x: 20, y: 35 },
  { id: "gym", name: "Dojo", event: "bagsworld-tradinggym-click", x: 75, y: 30 },
  { id: "treasury", name: "Treasury", event: "bagsworld-treasury-click", x: 50, y: 60 },
] as const;

const CITY_LOCATIONS = [
  { id: "casino", name: "Casino", event: "bagsworld-casino-click", x: 25, y: 40 },
  { id: "terminal", name: "Terminal", event: "bagsworld-terminal-click", x: 70, y: 35 },
  { id: "hq", name: "BagsHQ", event: null, x: 50, y: 20 },
] as const;

const GLOBAL_ACTIONS = [
  { id: "launch", name: "Launch", event: "bagsworld-launch-click" },
  { id: "claim", name: "Claim", event: "bagsworld-claim-click" },
] as const;

export function MiniMap({ onNavigate }: MiniMapProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { currentZone, setZone } = useGameStore();

  const handleLocationClick = useCallback((eventName: string | null) => {
    if (!eventName) return;
    window.dispatchEvent(new CustomEvent(eventName));
    setIsOpen(false);
  }, []);

  const handleZoneChange = useCallback(
    (zone: ZoneType) => {
      setZone(zone);
      onNavigate?.(zone);
      // Dispatch zone change event for Phaser
      window.dispatchEvent(new CustomEvent("bagsworld-zone-change", { detail: { zone } }));
    },
    [setZone, onNavigate]
  );

  const locations = currentZone === "main_city" ? PARK_LOCATIONS : CITY_LOCATIONS;

  return (
    <>
      {/* Map Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 right-4 z-50 w-12 h-12 bg-bags-dark border-2 border-bags-green hover:bg-bags-green/20 transition-colors flex items-center justify-center group"
        aria-label="Toggle map"
      >
        <span className="font-pixel text-[10px] text-bags-green group-hover:text-white">
          {isOpen ? "[X]" : "MAP"}
        </span>
      </button>

      {/* Map Panel */}
      {isOpen && (
        <div className="fixed bottom-32 right-4 z-50 w-72 bg-bags-dark border-2 border-bags-green shadow-lg shadow-bags-green/20">
          {/* Header */}
          <div className="border-b border-bags-green/50 px-3 py-2 flex items-center justify-between">
            <span className="font-pixel text-[10px] text-bags-green">WORLD MAP</span>
            <span className="font-pixel text-[8px] text-gray-500">
              {currentZone === "main_city" ? "PARK" : "BAGSCITY"}
            </span>
          </div>

          {/* Zone Selector */}
          <div className="flex border-b border-bags-green/30">
            <button
              onClick={() => handleZoneChange("main_city")}
              className={`flex-1 py-2 font-pixel text-[9px] transition-colors ${
                currentZone === "main_city"
                  ? "bg-bags-green/20 text-bags-gold border-b-2 border-bags-gold"
                  : "text-gray-500 hover:text-bags-green hover:bg-bags-green/10"
              }`}
            >
              [P] PARK
            </button>
            <button
              onClick={() => handleZoneChange("trending")}
              className={`flex-1 py-2 font-pixel text-[9px] transition-colors ${
                currentZone === "trending"
                  ? "bg-bags-green/20 text-bags-gold border-b-2 border-bags-gold"
                  : "text-gray-500 hover:text-bags-green hover:bg-bags-green/10"
              }`}
            >
              [B] BAGSCITY
            </button>
          </div>

          {/* Visual Map */}
          <div className="relative h-32 bg-[#0a1a0a] border-b border-bags-green/30 overflow-hidden">
            {/* Grid pattern */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: `
                  linear-gradient(to right, #22c55e 1px, transparent 1px),
                  linear-gradient(to bottom, #22c55e 1px, transparent 1px)
                `,
                backgroundSize: "16px 16px",
              }}
            />

            {/* Zone indicator */}
            <div className="absolute top-2 left-2 font-pixel text-[7px] text-bags-green/60">
              {currentZone === "main_city" ? "// PARK ZONE" : "// CITY ZONE"}
            </div>

            {/* Location markers */}
            {locations.map((loc) => (
              <button
                key={loc.id}
                onClick={() => handleLocationClick(loc.event)}
                disabled={!loc.event}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 group ${
                  loc.event ? "cursor-pointer" : "cursor-default"
                }`}
                style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
              >
                {/* Marker dot */}
                <div
                  className={`w-3 h-3 border ${
                    loc.event
                      ? "bg-bags-green/80 border-bags-green group-hover:bg-bags-gold group-hover:border-bags-gold"
                      : "bg-gray-600 border-gray-500"
                  } transition-colors`}
                />
                {/* Label */}
                <span
                  className={`absolute top-4 left-1/2 -translate-x-1/2 font-pixel text-[7px] whitespace-nowrap ${
                    loc.event ? "text-bags-green group-hover:text-bags-gold" : "text-gray-500"
                  }`}
                >
                  {loc.name}
                </span>
              </button>
            ))}

            {/* Path lines connecting locations */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <defs>
                <pattern id="dash" patternUnits="userSpaceOnUse" width="8" height="1">
                  <rect width="4" height="1" fill="#22c55e" opacity="0.3" />
                </pattern>
              </defs>
              {locations.length >= 2 && (
                <path
                  d={`M ${(locations[0].x / 100) * 288} ${(locations[0].y / 100) * 128}
                     L ${(locations[1].x / 100) * 288} ${(locations[1].y / 100) * 128}
                     L ${(locations[2].x / 100) * 288} ${(locations[2].y / 100) * 128}`}
                  stroke="#22c55e"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  fill="none"
                  opacity="0.3"
                />
              )}
            </svg>
          </div>

          {/* Quick Actions */}
          <div className="p-2">
            <div className="font-pixel text-[7px] text-gray-500 mb-2">QUICK ACTIONS</div>
            <div className="grid grid-cols-2 gap-2">
              {GLOBAL_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  onClick={() => handleLocationClick(action.event)}
                  className="py-2 px-3 bg-bags-green/10 border border-bags-green/50 hover:bg-bags-green/20 hover:border-bags-green transition-colors font-pixel text-[9px] text-bags-green hover:text-white"
                >
                  [{action.name.toUpperCase()}]
                </button>
              ))}
            </div>
          </div>

          {/* Location List */}
          <div className="border-t border-bags-green/30 p-2">
            <div className="font-pixel text-[7px] text-gray-500 mb-2">LOCATIONS</div>
            <div className="grid grid-cols-3 gap-1">
              {locations.map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => handleLocationClick(loc.event)}
                  disabled={!loc.event}
                  className={`py-1.5 px-2 border font-pixel text-[8px] transition-colors ${
                    loc.event
                      ? "border-bags-green/30 hover:border-bags-green hover:bg-bags-green/10 text-gray-400 hover:text-bags-green"
                      : "border-gray-700 text-gray-600 cursor-not-allowed"
                  }`}
                >
                  {loc.name}
                </button>
              ))}
            </div>
          </div>

          {/* Footer hint */}
          <div className="border-t border-bags-green/30 px-3 py-1.5">
            <span className="font-pixel text-[7px] text-gray-600">Click locations to open</span>
          </div>
        </div>
      )}
    </>
  );
}

export default MiniMap;
