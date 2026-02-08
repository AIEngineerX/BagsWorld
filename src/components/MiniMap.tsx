"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useGameStore } from "@/lib/store";
import { ZoneType, ZONES } from "@/lib/types";

interface MiniMapProps {
  onNavigate?: (zone: ZoneType) => void;
}

interface Position {
  x: number;
  y: number;
}

// Zone color themes
const ZONE_THEME: Record<
  ZoneType,
  { accent: string; bg: string; border: string; glow: string; label: string }
> = {
  labs: {
    accent: "text-green-400",
    bg: "bg-green-400/15",
    border: "border-green-400/60",
    glow: "shadow-green-400/30",
    label: "HQ",
  },
  moltbook: {
    accent: "text-sky-400",
    bg: "bg-sky-400/15",
    border: "border-sky-400/60",
    glow: "shadow-sky-400/30",
    label: "BEACH",
  },
  main_city: {
    accent: "text-bags-green",
    bg: "bg-bags-green/15",
    border: "border-bags-green/60",
    glow: "shadow-bags-green/30",
    label: "PARK",
  },
  trending: {
    accent: "text-bags-gold",
    bg: "bg-bags-gold/15",
    border: "border-bags-gold/60",
    glow: "shadow-bags-gold/30",
    label: "CITY",
  },
  ballers: {
    accent: "text-yellow-400",
    bg: "bg-yellow-400/15",
    border: "border-yellow-400/60",
    glow: "shadow-yellow-400/30",
    label: "BALLERS",
  },
  founders: {
    accent: "text-amber-400",
    bg: "bg-amber-400/15",
    border: "border-amber-400/60",
    glow: "shadow-amber-400/30",
    label: "LAUNCH",
  },
  arena: {
    accent: "text-red-400",
    bg: "bg-red-400/15",
    border: "border-red-400/60",
    glow: "shadow-red-400/30",
    label: "ARENA",
  },
  dungeon: {
    accent: "text-purple-400",
    bg: "bg-purple-400/15",
    border: "border-purple-400/60",
    glow: "shadow-purple-400/30",
    label: "DUNGEON",
  },
};

// Map grid layout — rows of zone IDs matching a spatial map
const MAP_ROWS: ZoneType[][] = [
  ["labs", "moltbook", "arena"],
  ["main_city", "trending", "ballers"],
  ["founders", "dungeon"],
];

// Locations per zone
const LOCATIONS: Record<
  string,
  { id: string; name: string; desc: string; event: string | null }[]
> = {
  labs: [{ id: "hq", name: "Bags.FM HQ", desc: "Headquarters", event: "bagsworld-hq-click" }],
  moltbook: [
    { id: "beach", name: "Agent Beach", desc: "AI Hangout", event: null },
    { id: "feed", name: "Moltbook Feed", desc: "Social Feed", event: null },
  ],
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
  dungeon: [{ id: "entrance", name: "Dungeon Gate", desc: "Enter MMORPG", event: null }],
};

const DRAG_THRESHOLD = 5; // px moved before it counts as a drag

export function MiniMap({ onNavigate }: MiniMapProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedZone, setExpandedZone] = useState<ZoneType | null>(null);
  const [position, setPosition] = useState<Position>({ x: -1, y: -1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const pointerStartRef = useRef<Position | null>(null);
  const didDragRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { currentZone, setZone } = useGameStore();

  const handleLocationClick = useCallback((eventName: string | null) => {
    if (!eventName) return;
    window.dispatchEvent(new CustomEvent(eventName));
    setIsOpen(false);
    setExpandedZone(null);
  }, []);

  const handleZoneChange = useCallback(
    (zone: ZoneType) => {
      setZone(zone);
      onNavigate?.(zone);
      window.dispatchEvent(new CustomEvent("bagsworld-zone-change", { detail: { zone } }));
      setExpandedZone(zone);
    },
    [setZone, onNavigate]
  );

  const handleZoneTileClick = useCallback(
    (zone: ZoneType) => {
      if (zone === currentZone) {
        setExpandedZone(expandedZone === zone ? null : zone);
      } else {
        handleZoneChange(zone);
      }
    },
    [currentZone, expandedZone, handleZoneChange]
  );

  // Unified drag — works on both the collapsed button and expanded header
  const handleDragPointerDown = useCallback((e: React.PointerEvent) => {
    // Skip zone-tile buttons inside the grid, but allow the collapsed fab + header
    const target = e.target as HTMLElement;
    const isInsideGrid = target.closest("[data-zone-grid]");
    const isCloseBtn = target.closest("[data-close-btn]");
    if (isInsideGrid || isCloseBtn) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    didDragRef.current = false;
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    target.setPointerCapture?.(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!pointerStartRef.current) return;
      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;

      // Start dragging once threshold exceeded
      if (!didDragRef.current && Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) {
        didDragRef.current = true;
        setIsDragging(true);
      }

      if (didDragRef.current) {
        const w = isOpen ? 280 : 48;
        const h = isOpen ? 400 : 48;
        setPosition({
          x: Math.max(8, Math.min(e.clientX - dragOffset.x, window.innerWidth - w - 8)),
          y: Math.max(60, Math.min(e.clientY - dragOffset.y, window.innerHeight - h - 8)),
        });
      }
    },
    [dragOffset, isOpen]
  );

  const handlePointerUp = useCallback(() => {
    const wasDrag = didDragRef.current;
    const hadPointerDown = pointerStartRef.current !== null;
    pointerStartRef.current = null;
    didDragRef.current = false;
    setIsDragging(false);

    // Only open if the pointerdown originated on the map FAB (not a random page click)
    if (!wasDrag && !isOpen && hadPointerDown) {
      setIsOpen(true);
    }
  }, [isOpen]);

  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  // Close expanded zone when main panel closes
  useEffect(() => {
    if (!isOpen) setExpandedZone(null);
  }, [isOpen]);

  const containerStyle: React.CSSProperties =
    position.x >= 0 && position.y >= 0
      ? { left: position.x, top: position.y, right: "auto", bottom: "auto" }
      : { right: 16, bottom: "calc(80px + env(safe-area-inset-bottom, 0px))" };

  const locations = LOCATIONS[expandedZone || currentZone] || [];

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      className={`fixed z-50 transition-all duration-200 ${isDragging ? "cursor-grabbing" : ""}`}
    >
      {/* === Collapsed: Floating Map FAB === */}
      {!isOpen && (
        <div
          onPointerDown={handleDragPointerDown}
          className={`
            group w-11 h-11 rounded-lg
            bg-black/90 border border-bags-green/50 hover:border-bags-green
            shadow-lg shadow-black/60 hover:shadow-bags-green/20
            flex items-center justify-center
            transition-all duration-200 hover:scale-110
            select-none touch-none
            ${isDragging ? "cursor-grabbing scale-105" : "cursor-grab"}
          `}
          role="button"
          tabIndex={0}
          aria-label="Open map"
        >
          {/* Pixel map with pin drop */}
          <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" shapeRendering="crispEdges">
            {/* Map body — folded paper */}
            <rect x={2} y={8} width={20} height={14} fill="#14532d" />
            <rect x={3} y={9} width={18} height={12} fill="#0a0a0a" />
            {/* Fold crease */}
            <line x1={12} y1={9} x2={12} y2={21} stroke="#14532d" strokeWidth={1} />
            {/* Grid lines on map */}
            <line x1={3} y1={13} x2={21} y2={13} stroke="#22c55e" strokeWidth={0.5} opacity={0.2} />
            <line x1={3} y1={17} x2={21} y2={17} stroke="#22c55e" strokeWidth={0.5} opacity={0.2} />
            <line
              x1={7.5}
              y1={9}
              x2={7.5}
              y2={21}
              stroke="#22c55e"
              strokeWidth={0.5}
              opacity={0.15}
            />
            <line
              x1={16.5}
              y1={9}
              x2={16.5}
              y2={21}
              stroke="#22c55e"
              strokeWidth={0.5}
              opacity={0.15}
            />
            {/* Pixel path/road on map */}
            <rect x={5} y={11} width={2} height={2} fill="#22c55e" opacity={0.4} />
            <rect x={7} y={12} width={2} height={2} fill="#22c55e" opacity={0.35} />
            <rect x={9} y={13} width={2} height={2} fill="#22c55e" opacity={0.3} />
            <rect x={13} y={15} width={2} height={2} fill="#22c55e" opacity={0.3} />
            <rect x={15} y={16} width={2} height={2} fill="#22c55e" opacity={0.35} />
            <rect x={17} y={17} width={2} height={2} fill="#22c55e" opacity={0.4} />
            {/* Map border */}
            <rect
              x={2}
              y={8}
              width={20}
              height={14}
              fill="none"
              stroke="#4ade80"
              strokeWidth={1}
              opacity={0.5}
            />
            {/* Pin drop — sits above the map */}
            <rect x={10} y={2} width={4} height={4} rx={2} fill="#4ade80" />
            <rect x={11} y={6} width={2} height={3} fill="#4ade80" />
            <rect x={11.5} y={8.5} width={1} height={1.5} fill="#4ade80" opacity={0.7} />
            {/* Pin highlight */}
            <rect x={11} y={3} width={1} height={1} fill="#bbf7d0" />
            {/* Pin glow pulse */}
            <circle
              cx={12}
              cy={10}
              r={2.5}
              fill="#4ade80"
              opacity={0.15}
              className="animate-ping"
            />
          </svg>
        </div>
      )}

      {/* === Expanded: World Map Panel === */}
      {isOpen && (
        <div className="w-[272px] bg-bags-dark border-2 border-red-500 rounded-xl shadow-2xl shadow-black/60 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header — draggable */}
          <div
            onPointerDown={handleDragPointerDown}
            className={`
              bg-gradient-to-r from-red-600 to-red-500 px-3 py-2.5
              flex items-center justify-between select-none touch-none
              ${isDragging ? "cursor-grabbing" : "cursor-grab"}
            `}
          >
            <div className="flex items-center gap-2">
              {/* Mini map+pin icon */}
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" shapeRendering="crispEdges">
                <rect
                  x={1}
                  y={6}
                  width={14}
                  height={9}
                  fill="none"
                  stroke="white"
                  strokeWidth={1}
                  opacity={0.5}
                />
                <line
                  x1={1}
                  y1={10}
                  x2={15}
                  y2={10}
                  stroke="white"
                  strokeWidth={0.5}
                  opacity={0.2}
                />
                <line x1={8} y1={6} x2={8} y2={15} stroke="white" strokeWidth={0.5} opacity={0.2} />
                <rect x={6} y={1} width={4} height={3} rx={1.5} fill="white" opacity={0.9} />
                <rect x={7} y={4} width={2} height={2.5} fill="white" opacity={0.9} />
              </svg>
              <span className="font-pixel text-[11px] text-white tracking-wider">WORLD MAP</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-pixel text-[8px] text-red-200/70">
                {ZONES[currentZone]?.name?.toUpperCase()}
              </span>
              <button
                data-close-btn
                onClick={() => setIsOpen(false)}
                className="text-white/80 hover:text-white font-pixel text-xs px-1.5 py-0.5 hover:bg-white/10 rounded transition-colors"
              >
                [X]
              </button>
            </div>
          </div>

          {/* Zone Grid Map */}
          <div className="p-2.5 space-y-1.5" data-zone-grid>
            {MAP_ROWS.map((row, ri) => (
              <div key={ri} className="flex gap-1.5 justify-center">
                {row.map((zoneId) => {
                  const theme = ZONE_THEME[zoneId];
                  const isActive = currentZone === zoneId;
                  const isExpanded = expandedZone === zoneId;
                  const zone = ZONES[zoneId];

                  return (
                    <button
                      key={zoneId}
                      onClick={() => handleZoneTileClick(zoneId)}
                      className={`
                        relative flex-1 min-w-0 py-2.5 px-1 rounded-lg border transition-all duration-200
                        font-pixel text-center
                        ${
                          isActive
                            ? `${theme.bg} ${theme.border} border-2 shadow-md ${theme.glow}`
                            : isExpanded
                              ? `${theme.bg} border-gray-600 hover:${theme.border}`
                              : "bg-bags-darker border-gray-700/50 hover:border-gray-600 hover:bg-white/5"
                        }
                      `}
                    >
                      {/* You-are-here pulse */}
                      {isActive && (
                        <span className="absolute top-1 right-1 flex h-2 w-2">
                          <span
                            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${theme.bg}`}
                          />
                          <span
                            className={`relative inline-flex rounded-full h-2 w-2 ${theme.bg} border ${theme.border}`}
                          />
                        </span>
                      )}
                      <div className={`text-[10px] ${isActive ? theme.accent : "text-gray-500"}`}>
                        {zone.icon}
                      </div>
                      <div
                        className={`text-[9px] mt-0.5 leading-tight ${isActive ? theme.accent : "text-gray-400"}`}
                      >
                        {theme.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Locations Drawer */}
          {expandedZone && locations.length > 0 && (
            <>
              <div className="mx-2.5 border-t border-red-500/20" />
              <div className="px-2.5 pt-1.5 pb-1">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${ZONE_THEME[expandedZone].bg} ${ZONE_THEME[expandedZone].border} border`}
                  />
                  <span className={`font-pixel text-[8px] ${ZONE_THEME[expandedZone].accent}`}>
                    {ZONES[expandedZone].name.toUpperCase()} LOCATIONS
                  </span>
                </div>
                <div className="space-y-0.5">
                  {locations.map((loc) => (
                    <button
                      key={loc.id}
                      onClick={() => handleLocationClick(loc.event)}
                      disabled={!loc.event}
                      className={`w-full text-left px-2.5 py-2 rounded-lg transition-all group ${
                        loc.event
                          ? "hover:bg-white/5 active:bg-white/10"
                          : "opacity-35 cursor-not-allowed"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p
                            className={`font-pixel text-[10px] leading-tight ${
                              loc.event ? "text-gray-200 group-hover:text-white" : "text-gray-600"
                            }`}
                          >
                            {loc.name}
                          </p>
                          <p className="font-mono text-[8px] text-gray-600">{loc.desc}</p>
                        </div>
                        {loc.event && (
                          <svg
                            className="w-3 h-3 text-gray-600 group-hover:text-bags-green transition-colors shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2.5}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Quick Actions */}
          <div className="mx-2.5 border-t border-red-500/20" />
          <div className="p-2.5 flex gap-2">
            <button
              onClick={() => handleLocationClick("bagsworld-launch-click")}
              className="flex-1 py-2 rounded-lg bg-bags-green/10 hover:bg-bags-green/20 border border-bags-green/30 hover:border-bags-green/50 font-pixel text-[9px] text-bags-green transition-all active:scale-95"
            >
              LAUNCH
            </button>
            <button
              onClick={() => handleLocationClick("bagsworld-claim-click")}
              className="flex-1 py-2 rounded-lg bg-bags-gold/10 hover:bg-bags-gold/20 border border-bags-gold/30 hover:border-bags-gold/50 font-pixel text-[9px] text-bags-gold transition-all active:scale-95"
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
