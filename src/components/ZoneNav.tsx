"use client";

import { useEffect, useRef } from "react";
import { useGameStore } from "@/lib/store";
import { ZONES, ZoneType } from "@/lib/types";

export const MAIN_ZONES: ZoneType[] = [
  "labs",
  "moltbook",
  "main_city",
  "trending",
  "ballers",
  "founders",
  "arena",
];

export const ZONE_ORDER: ZoneType[] = [...MAIN_ZONES, "dungeon"];

const ZONE_SHORT_LABELS: Record<ZoneType, string> = {
  labs: "HQ",
  moltbook: "BEACH",
  main_city: "PARK",
  trending: "CITY",
  ballers: "BAL",
  founders: "LCH",
  arena: "ARENA",
  dungeon: "DNGN",
};

// Inactive color accents per zone (border / text / hover)
const ZONE_COLORS: Partial<Record<ZoneType, string>> = {
  labs: "border-green-500/50 text-green-400 hover:border-green-400",
  moltbook: "border-red-500/50 text-red-400 hover:border-red-400",
  trending: "border-yellow-500/50 text-bags-gold hover:border-bags-gold",
  ballers: "border-yellow-500/50 text-yellow-400 hover:border-yellow-400",
  founders: "border-amber-500/50 text-amber-400 hover:border-amber-400",
  arena: "border-red-500/50 text-red-400 hover:border-red-400",
  dungeon: "border-purple-500/50 text-purple-400 hover:border-purple-400",
};

const BTN_BASE =
  "font-pixel text-[8px] sm:text-[10px] px-1.5 sm:px-3 py-1.5 sm:py-1.5 min-h-[36px] sm:min-h-0 whitespace-nowrap transition-all duration-200 shrink-0 flex items-center gap-0.5 sm:gap-1 border";
const BTN_ACTIVE =
  "bg-bags-green text-bags-dark border-bags-green shadow-[0_0_12px_rgba(74,222,128,0.6),inset_0_1px_0_rgba(255,255,255,0.2)]";
const BTN_INACTIVE =
  "hover:bg-white/5 border-gray-600 text-gray-400 hover:text-bags-green hover:border-bags-green/50";

export function ZoneNav() {
  const { currentZone, setZone } = useGameStore();
  const navRef = useRef<HTMLElement>(null);

  const handleZoneChange = (zone: ZoneType) => {
    if (zone === currentZone) return;
    window.dispatchEvent(new CustomEvent("bagsworld-zone-change", { detail: { zone } }));
    setZone(zone);
  };

  // Auto-scroll to active zone button when zone changes
  useEffect(() => {
    if (!navRef.current) return;
    const activeBtn = navRef.current.querySelector("[data-active='true']") as HTMLElement | null;
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [currentZone]);

  return (
    <nav
      ref={navRef}
      className="flex items-center flex-nowrap overflow-x-auto scrollbar-hide zone-nav-scroll gap-px sm:gap-1 bg-black/90 backdrop-blur-sm px-1 sm:px-2 py-1 sm:py-1.5 border border-bags-green/50 shadow-[0_4px_20px_rgba(0,0,0,0.5),0_0_15px_rgba(74,222,128,0.15),inset_0_1px_0_rgba(74,222,128,0.1)]"
    >
      {ZONE_ORDER.map((zoneId) => {
        const zone = ZONES[zoneId];
        const isActive = currentZone === zoneId;
        const isDungeon = zoneId === "dungeon";

        const activeClass = isDungeon
          ? "bg-purple-600 text-white border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.6),inset_0_1px_0_rgba(255,255,255,0.2)]"
          : BTN_ACTIVE;

        return (
          <button
            key={zoneId}
            data-active={isActive}
            onClick={() => handleZoneChange(zoneId)}
            className={`${BTN_BASE} ${isActive ? activeClass : `${BTN_INACTIVE} ${ZONE_COLORS[zoneId] ?? ""}`}`}
            title={zone.description}
          >
            <span className="font-pixel text-[8px]">{zone.icon}</span>
            <span className="sm:hidden">{ZONE_SHORT_LABELS[zoneId]}</span>
            <span className="hidden sm:inline">{zone.name.toUpperCase()}</span>
          </button>
        );
      })}
    </nav>
  );
}
