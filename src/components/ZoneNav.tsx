"use client";

import { useGameStore } from "@/lib/store";
import { ZONES, ZoneType } from "@/lib/types";

export const ZONE_ORDER: ZoneType[] = [
  "labs",
  "moltbook",
  "main_city",
  "trending",
  "ballers",
  "founders",
  "arena",
];

const ZONE_SHORT_LABELS: Record<ZoneType, string> = {
  labs: "HQ",
  moltbook: "BEACH",
  main_city: "PARK",
  trending: "CITY",
  ballers: "BALLERS",
  founders: "LAUNCH",
  arena: "ARENA",
};

export function ZoneNav() {
  const { currentZone, setZone } = useGameStore();

  const handleZoneChange = (zone: ZoneType) => {
    if (zone === currentZone) return;

    // Dispatch event for Phaser to handle zone transition
    window.dispatchEvent(new CustomEvent("bagsworld-zone-change", { detail: { zone } }));

    setZone(zone);
  };

  return (
    <nav className="flex items-center flex-nowrap overflow-x-auto scrollbar-hide gap-1.5 sm:gap-1 bg-black/90 backdrop-blur-sm px-2 py-1.5 border border-bags-green/50 shadow-[0_4px_20px_rgba(0,0,0,0.5),0_0_15px_rgba(74,222,128,0.15),inset_0_1px_0_rgba(74,222,128,0.1)]">
      {ZONE_ORDER.map((zoneId) => {
        const zone = ZONES[zoneId];
        const isActive = currentZone === zoneId;
        const isLabs = zoneId === "labs";
        const isMoltbook = zoneId === "moltbook";
        const isTrending = zoneId === "trending";
        const isBallers = zoneId === "ballers";
        const isFounders = zoneId === "founders";
        const isArena = zoneId === "arena";

        // Base inactive styles
        const baseInactive =
          "hover:bg-white/5 border-gray-600 text-gray-400 hover:text-bags-green hover:border-bags-green/50";

        return (
          <button
            key={zoneId}
            onClick={() => handleZoneChange(zoneId)}
            className={`
              font-pixel text-[11px] sm:text-[10px] px-4 sm:px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0
              whitespace-nowrap transition-all duration-200
              flex items-center gap-1 border
              ${
                isActive
                  ? "bg-bags-green text-bags-dark border-bags-green shadow-[0_0_12px_rgba(74,222,128,0.6),inset_0_1px_0_rgba(255,255,255,0.2)]"
                  : baseInactive
              }
              ${!isActive && isLabs ? "border-green-500/50 text-green-400 hover:border-green-400" : ""}
              ${!isActive && isMoltbook ? "border-red-500/50 text-red-400 hover:border-red-400" : ""}
              ${!isActive && isTrending ? "border-yellow-500/50 text-bags-gold hover:border-bags-gold" : ""}
              ${!isActive && isBallers ? "border-yellow-500/50 text-yellow-400 hover:border-yellow-400" : ""}
              ${!isActive && isFounders ? "border-amber-500/50 text-amber-400 hover:border-amber-400" : ""}
              ${!isActive && isArena ? "border-red-500/50 text-red-400 hover:border-red-400" : ""}
            `}
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
