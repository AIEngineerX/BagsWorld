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

// Map locations - minimal design
const PARK_LOCATIONS = [
  { id: "pokecenter", name: "Heal", icon: "+", event: "bagsworld-pokecenter-click", x: 20, y: 35 },
  { id: "gym", name: "Dojo", icon: "!", event: "bagsworld-tradinggym-click", x: 75, y: 30 },
  { id: "treasury", name: "Bank", icon: "$", event: "bagsworld-treasury-click", x: 50, y: 60 },
] as const;

const CITY_LOCATIONS = [
  { id: "casino", name: "Casino", icon: "*", event: "bagsworld-casino-click", x: 25, y: 40 },
  { id: "terminal", name: "Trade", icon: ">", event: "bagsworld-terminal-click", x: 70, y: 35 },
  { id: "hq", name: "HQ", icon: "#", event: null, x: 50, y: 20 },
] as const;

export function MiniMap({ onNavigate }: MiniMapProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<Position>({ x: -1, y: -1 }); // -1 means use default
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
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    }
  }, []);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDragging) return;

      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      const size = isOpen ? 200 : 48;

      setPosition({
        x: Math.max(8, Math.min(newX, window.innerWidth - size - 8)),
        y: Math.max(60, Math.min(newY, window.innerHeight - size - 8)),
      });
    },
    [isDragging, dragOffset, isOpen]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

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

  const locations = currentZone === "main_city" ? PARK_LOCATIONS : CITY_LOCATIONS;

  // Calculate style based on position state
  const containerStyle: React.CSSProperties =
    position.x >= 0 && position.y >= 0
      ? { left: position.x, top: position.y, right: "auto", bottom: "auto" }
      : { right: 16, bottom: 80 };

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      className={`fixed z-50 transition-all duration-200 ease-out ${isDragging ? "cursor-grabbing" : ""}`}
    >
      {/* Collapsed: Compact floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          onPointerDown={handlePointerDown}
          className={`
            w-11 h-11 rounded-full
            bg-gradient-to-br from-bags-dark to-black
            border border-bags-green/60 hover:border-bags-green
            shadow-lg shadow-black/50 hover:shadow-bags-green/20
            flex items-center justify-center
            transition-all duration-200 ease-out
            hover:scale-105 active:scale-95
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

      {/* Expanded: Compact map panel */}
      {isOpen && (
        <div
          className={`
            w-52 bg-gradient-to-br from-bags-dark to-black
            border border-bags-green/40 rounded-lg
            shadow-xl shadow-black/50
            overflow-hidden
            animate-in fade-in zoom-in-95 duration-150
          `}
        >
          {/* Header - Draggable */}
          <div
            onPointerDown={handlePointerDown}
            className={`
              flex items-center justify-between px-3 py-2
              bg-bags-green/10 border-b border-bags-green/20
              ${isDragging ? "cursor-grabbing" : "cursor-grab"}
            `}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-bags-green animate-pulse" />
              <span className="font-pixel text-[9px] text-bags-green/80 uppercase tracking-wider">
                {currentZone === "main_city" ? "Park" : "City"}
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-white transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Zone Toggle */}
          <div className="flex p-1.5 gap-1 bg-black/30">
            <button
              onClick={() => handleZoneChange("main_city")}
              className={`
                flex-1 py-1.5 rounded text-center font-pixel text-[8px] uppercase tracking-wide
                transition-all duration-150
                ${currentZone === "main_city"
                  ? "bg-bags-green/20 text-bags-green border border-bags-green/30"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                }
              `}
            >
              Park
            </button>
            <button
              onClick={() => handleZoneChange("trending")}
              className={`
                flex-1 py-1.5 rounded text-center font-pixel text-[8px] uppercase tracking-wide
                transition-all duration-150
                ${currentZone === "trending"
                  ? "bg-bags-green/20 text-bags-green border border-bags-green/30"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                }
              `}
            >
              City
            </button>
          </div>

          {/* Mini Visual Map */}
          <div className="relative h-24 bg-[#050a05] m-1.5 rounded overflow-hidden">
            {/* Subtle grid */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: `radial-gradient(circle, #22c55e 1px, transparent 1px)`,
                backgroundSize: "12px 12px",
              }}
            />

            {/* Location markers */}
            {locations.map((loc) => (
              <button
                key={loc.id}
                onClick={() => handleLocationClick(loc.event)}
                disabled={!loc.event}
                className={`
                  absolute transform -translate-x-1/2 -translate-y-1/2
                  transition-all duration-150
                  ${loc.event ? "hover:scale-125" : "opacity-40"}
                `}
                style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
              >
                <div
                  className={`
                    w-6 h-6 rounded-sm flex items-center justify-center
                    font-pixel text-[10px] font-bold
                    ${loc.event
                      ? "bg-bags-green/20 text-bags-green border border-bags-green/50 hover:bg-bags-green/40 hover:border-bags-green"
                      : "bg-gray-800/50 text-gray-600 border border-gray-700"
                    }
                  `}
                >
                  {loc.icon}
                </div>
              </button>
            ))}
          </div>

          {/* Quick location buttons */}
          <div className="grid grid-cols-3 gap-1 p-1.5 pt-0">
            {locations.map((loc) => (
              <button
                key={loc.id}
                onClick={() => handleLocationClick(loc.event)}
                disabled={!loc.event}
                className={`
                  py-1.5 rounded text-center font-pixel text-[7px] uppercase
                  transition-all duration-150
                  ${loc.event
                    ? "bg-white/5 text-gray-400 hover:bg-bags-green/20 hover:text-bags-green"
                    : "bg-transparent text-gray-600 cursor-not-allowed"
                  }
                `}
              >
                {loc.name}
              </button>
            ))}
          </div>

          {/* Quick actions */}
          <div className="flex gap-1 p-1.5 pt-0">
            <button
              onClick={() => handleLocationClick("bagsworld-launch-click")}
              className="flex-1 py-2 rounded bg-bags-green/10 border border-bags-green/30 hover:bg-bags-green/20 hover:border-bags-green font-pixel text-[8px] text-bags-green transition-all duration-150"
            >
              LAUNCH
            </button>
            <button
              onClick={() => handleLocationClick("bagsworld-claim-click")}
              className="flex-1 py-2 rounded bg-bags-gold/10 border border-bags-gold/30 hover:bg-bags-gold/20 hover:border-bags-gold font-pixel text-[8px] text-bags-gold transition-all duration-150"
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
