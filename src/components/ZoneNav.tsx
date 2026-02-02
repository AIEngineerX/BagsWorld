"use client";

import { useGameStore } from "@/lib/store";
import { ZONES, ZoneType } from "@/lib/types";

const ZONE_ORDER: ZoneType[] = [
  "labs",
  "moltbook",
  "main_city",
  "trending",
  "ballers",
  "founders",
  "arena",
];

export function ZoneNav() {
  const { currentZone, setZone } = useGameStore();

  const handleZoneChange = (zone: ZoneType) => {
    if (zone === currentZone) return;

    // Dispatch event for Phaser to handle zone transition
    window.dispatchEvent(new CustomEvent("bagsworld-zone-change", { detail: { zone } }));

    setZone(zone);
  };

  return (
    <nav className="flex items-center gap-1 bg-black/90 backdrop-blur-sm px-2 py-1.5 border border-bags-green/40 shadow-[0_4px_20px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(74,222,128,0.1)]">
      {ZONE_ORDER.map((zoneId) => {
        const zone = ZONES[zoneId];
        const isActive = currentZone === zoneId;
        const isLabs = zoneId === "labs";
        const isMoltbook = zoneId === "moltbook";
        const isTrending = zoneId === "trending";
        const isBallers = zoneId === "ballers";
        const isFounders = zoneId === "founders";
        const isArena = zoneId === "arena";

        return (
          <button
            key={zoneId}
            onClick={() => handleZoneChange(zoneId)}
            className={`
              font-pixel text-[10px] px-3 py-1.5 transition-all duration-200
              flex items-center gap-1
              border
              ${
                isActive
                  ? "bg-bags-green text-bags-dark border-bags-green shadow-[0_0_12px_rgba(74,222,128,0.6),inset_0_1px_0_rgba(255,255,255,0.2)]"
                  : "text-gray-400 hover:text-bags-green hover:bg-bags-green/10 border-transparent hover:border-bags-green/30 hover:shadow-[0_0_8px_rgba(74,222,128,0.2)]"
              }
              ${isLabs && !isActive ? "border-green-400/30 text-green-400 hover:border-green-400/50" : ""}
              ${isMoltbook && !isActive ? "border-red-400/30 text-red-400 hover:border-red-400/50" : ""}
              ${isTrending && !isActive ? "border-bags-gold/30 text-bags-gold hover:border-bags-gold/50" : ""}
              ${isBallers && !isActive ? "border-yellow-400/30 text-yellow-400 hover:border-yellow-400/50" : ""}
              ${isFounders && !isActive ? "border-amber-500/30 text-amber-400 hover:border-amber-500/50" : ""}
              ${isArena && !isActive ? "border-red-500/30 text-red-400 hover:border-red-500/50" : ""}
            `}
            title={zone.description}
          >
            <span className="font-pixel text-[8px]">{zone.icon}</span>
            <span className="hidden sm:inline">{zone.name.toUpperCase()}</span>
          </button>
        );
      })}
    </nav>
  );
}
