"use client";

import { useGameStore } from "@/lib/store";
import { ZONES, ZoneType } from "@/lib/types";

const ZONE_ORDER: ZoneType[] = ["main_city", "launch_pad", "whale_waters", "graveyard"];

export function ZoneNav() {
  const { currentZone, setZone } = useGameStore();

  const handleZoneChange = (zone: ZoneType) => {
    if (zone === currentZone) return;

    // Dispatch event for Phaser to handle zone transition
    window.dispatchEvent(
      new CustomEvent("bagsworld-zone-change", { detail: { zone } })
    );

    setZone(zone);
  };

  return (
    <nav className="flex items-center gap-1 bg-bags-darker/80 backdrop-blur-sm px-2 py-1 rounded-lg border border-bags-green/30">
      {ZONE_ORDER.map((zoneId) => {
        const zone = ZONES[zoneId];
        const isActive = currentZone === zoneId;
        const isLaunchPad = zoneId === "launch_pad";

        return (
          <button
            key={zoneId}
            onClick={() => handleZoneChange(zoneId)}
            className={`
              font-pixel text-[10px] px-3 py-1.5 rounded transition-all duration-200
              flex items-center gap-1
              border
              ${isActive
                ? "bg-bags-green text-bags-dark border-bags-green shadow-[0_0_10px_rgba(74,222,128,0.5)]"
                : "text-gray-400 hover:text-bags-green hover:bg-bags-green/10 border-gray-600 hover:border-bags-green/50"
              }
              ${isLaunchPad && !isActive ? "border-bags-gold/50 text-bags-gold" : ""}
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
