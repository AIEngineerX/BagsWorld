"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useGameStore } from "@/lib/store";
import { ZoneType } from "@/lib/types";

interface MiniMapProps {
  onNavigate?: (zone: ZoneType) => void;
}

interface Position {
  x: number;
  y: number;
}

// Locations with clean data
const LOCATIONS: Record<
  string,
  { id: string; name: string; desc: string; event: string | null }[]
> = {
  labs: [{ id: "hq", name: "Bags.FM HQ", desc: "Headquarters", event: "bagsworld-hq-click" }],
  main_city: [
    {
      id: "pokecenter",
      name: "Rewards Center",
      desc: "Fee Claims",
      event: "bagsworld-pokecenter-click",
    },
    {
      id: "treasury",
      name: "Community Fund",
      desc: "Ghost's 5%",
      event: "bagsworld-treasury-click",
    },
  ],
  trending: [
    { id: "casino", name: "Casino", desc: "Games & Raffle", event: "bagsworld-casino-click" },
    { id: "oracle", name: "Oracle", desc: "Predictions", event: "bagsworld-oracle-click" },
    { id: "terminal", name: "Terminal", desc: "Live Trading", event: "bagsworld-terminal-click" },
  ],
  ballers: [
    { id: "mansions", name: "Mansions", desc: "Top Holders", event: null },
    { id: "leaderboard", name: "Leaderboard", desc: "View Rankings", event: null },
  ],
  founders: [
    { id: "oak", name: "Prof. Oak", desc: "Launch Guide", event: "bagsworld-oak-click" },
    { id: "dexprep", name: "DexScreener Prep", desc: "Get Listed", event: null },
  ],
  arena: [
    { id: "ring", name: "Fighting Ring", desc: "Watch Battles", event: null },
    { id: "queue", name: "Queue Status", desc: "Join the Fight", event: null },
  ],
};

export function MiniMap({ onNavigate }: MiniMapProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<Position>({ x: -1, y: -1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
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
      window.dispatchEvent(new CustomEvent("bagsworld-zone-change", { detail: { zone } }));
    },
    [setZone, onNavigate]
  );

  // Dragging handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setIsDragging(true);
      setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    }
  }, []);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDragging) return;
      const size = isOpen ? 220 : 48;
      setPosition({
        x: Math.max(8, Math.min(e.clientX - dragOffset.x, window.innerWidth - size - 8)),
        y: Math.max(60, Math.min(e.clientY - dragOffset.y, window.innerHeight - size - 8)),
      });
    },
    [isDragging, dragOffset, isOpen]
  );

  const handlePointerUp = useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
      return () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
      };
    }
  }, [isDragging, handlePointerMove, handlePointerUp]);

  const locations = LOCATIONS[currentZone] || LOCATIONS.main_city;
  const containerStyle: React.CSSProperties =
    position.x >= 0 && position.y >= 0
      ? { left: position.x, top: position.y, right: "auto", bottom: "auto" }
      : { right: 16, bottom: 80 };

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      className={`fixed z-50 transition-all duration-200 ${isDragging ? "cursor-grabbing" : ""}`}
    >
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          onPointerDown={handlePointerDown}
          className={`
            w-11 h-11 rounded-full bg-black/90 backdrop-blur-sm
            border border-bags-green/50 hover:border-bags-green
            shadow-lg shadow-black/50 hover:shadow-bags-green/20
            flex items-center justify-center
            transition-all duration-200 hover:scale-105 active:scale-95
            ${isDragging ? "cursor-grabbing" : "cursor-grab"}
          `}
          aria-label="Open map"
        >
          <svg
            className="w-5 h-5 text-bags-green"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
        </button>
      )}

      {/* Map Panel */}
      {isOpen && (
        <div className="w-56 bg-black/95 backdrop-blur-md border border-bags-green/30 rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
          {/* Header */}
          <div
            onPointerDown={handlePointerDown}
            className={`flex items-center justify-between px-4 py-3 border-b border-bags-green/20 ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
          >
            <span className="font-pixel text-[10px] text-bags-green tracking-widest">NAVIGATE</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-white transition-colors text-lg leading-none"
            >
              &times;
            </button>
          </div>

          {/* Zone Tabs - Row 1 */}
          <div className="flex border-b border-bags-green/10">
            <button
              onClick={() => handleZoneChange("labs")}
              className={`flex-1 py-2 font-pixel text-[8px] tracking-wide transition-all ${
                currentZone === "labs"
                  ? "text-green-400 bg-green-400/10 border-b-2 border-green-400"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              HQ
            </button>
            <button
              onClick={() => handleZoneChange("main_city")}
              className={`flex-1 py-2 font-pixel text-[8px] tracking-wide transition-all ${
                currentZone === "main_city"
                  ? "text-bags-green bg-bags-green/10 border-b-2 border-bags-green"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              PARK
            </button>
            <button
              onClick={() => handleZoneChange("trending")}
              className={`flex-1 py-2 font-pixel text-[8px] tracking-wide transition-all ${
                currentZone === "trending"
                  ? "text-bags-green bg-bags-green/10 border-b-2 border-bags-green"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              CITY
            </button>
          </div>
          {/* Zone Tabs - Row 2 */}
          <div className="flex border-b border-bags-green/10">
            <button
              onClick={() => handleZoneChange("ballers")}
              className={`flex-1 py-2 font-pixel text-[8px] tracking-wide transition-all ${
                currentZone === "ballers"
                  ? "text-bags-gold bg-bags-gold/10 border-b-2 border-bags-gold"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              BALLERS
            </button>
            <button
              onClick={() => handleZoneChange("founders")}
              className={`flex-1 py-2 font-pixel text-[8px] tracking-wide transition-all ${
                currentZone === "founders"
                  ? "text-purple-400 bg-purple-400/10 border-b-2 border-purple-400"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              FOUNDERS
            </button>
            <button
              onClick={() => handleZoneChange("arena")}
              className={`flex-1 py-2 font-pixel text-[8px] tracking-wide transition-all ${
                currentZone === "arena"
                  ? "text-red-400 bg-red-400/10 border-b-2 border-red-400"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              ARENA
            </button>
          </div>

          {/* Locations List */}
          <div className="p-2 space-y-1">
            {locations.map((loc) => (
              <button
                key={loc.id}
                onClick={() => handleLocationClick(loc.event)}
                disabled={!loc.event}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-all ${
                  loc.event ? "hover:bg-bags-green/10 group" : "opacity-40 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p
                      className={`font-pixel text-[10px] ${loc.event ? "text-white group-hover:text-bags-green" : "text-gray-500"}`}
                    >
                      {loc.name}
                    </p>
                    <p className="font-mono text-[9px] text-gray-600">{loc.desc}</p>
                  </div>
                  {loc.event && (
                    <svg
                      className="w-4 h-4 text-gray-600 group-hover:text-bags-green transition-colors"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="mx-3 border-t border-bags-green/10" />

          {/* Quick Actions */}
          <div className="p-2 flex gap-2">
            <button
              onClick={() => handleLocationClick("bagsworld-launch-click")}
              className="flex-1 py-2.5 rounded-lg bg-bags-green/10 hover:bg-bags-green/20 border border-bags-green/20 hover:border-bags-green/40 font-pixel text-[9px] text-bags-green transition-all"
            >
              LAUNCH
            </button>
            <button
              onClick={() => handleLocationClick("bagsworld-claim-click")}
              className="flex-1 py-2.5 rounded-lg bg-bags-gold/10 hover:bg-bags-gold/20 border border-bags-gold/20 hover:border-bags-gold/40 font-pixel text-[9px] text-bags-gold transition-all"
            >
              CLAIM
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MiniMap;
