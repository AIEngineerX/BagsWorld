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

export const ZONE_ORDER: ZoneType[] = ["ascension", ...MAIN_ZONES];

const ZONE_SHORT_LABELS: Record<ZoneType, string> = {
  labs: "HQ",
  moltbook: "BEACH",
  main_city: "PARK",
  trending: "CITY",
  ballers: "BAL",
  founders: "LCH",
  arena: "ARENA",
  ascension: "SPIRE",
};

// Inactive color accents per zone (border / text / hover)
const ZONE_COLORS: Partial<Record<ZoneType, string>> = {
  labs: "border-green-500/50 text-green-400 hover:border-green-400",
  moltbook: "border-red-500/50 text-red-400 hover:border-red-400",
  trending: "border-yellow-500/50 text-bags-gold hover:border-bags-gold",
  ballers: "border-yellow-500/50 text-yellow-400 hover:border-yellow-400",
  founders: "border-amber-500/50 text-amber-400 hover:border-amber-400",
  arena: "border-red-500/50 text-red-400 hover:border-red-400",
  ascension: "border-cyan-500/50 text-cyan-400 hover:border-cyan-400",
};

const BTN_BASE =
  "font-pixel text-[8px] sm:text-[10px] px-1.5 sm:px-3 py-1.5 sm:py-1.5 min-h-[36px] sm:min-h-0 whitespace-nowrap transition-all duration-200 shrink-0 flex items-center justify-center gap-0.5 sm:gap-1 border";
const BTN_ACTIVE =
  "bg-bags-green text-bags-dark border-bags-green shadow-[0_0_12px_rgba(74,222,128,0.6),inset_0_1px_0_rgba(255,255,255,0.2)]";
const BTN_INACTIVE =
  "bg-black/75 backdrop-blur-sm hover:bg-white/5 border-gray-600 text-gray-400 hover:text-bags-green hover:border-bags-green/50";

const ASCENSION_ACTIVE =
  "bg-cyan-600 text-white border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.6),inset_0_1px_0_rgba(255,255,255,0.2)]";

function ZoneButton({
  zoneId,
  currentZone,
  onZoneChange,
}: {
  zoneId: ZoneType;
  currentZone: ZoneType;
  onZoneChange: (zone: ZoneType) => void;
}) {
  const zone = ZONES[zoneId];
  const isActive = currentZone === zoneId;
  const isAscension = zoneId === "ascension";
  const activeClass = isAscension ? ASCENSION_ACTIVE : BTN_ACTIVE;

  return (
    <button
      data-active={isActive}
      data-zone={zoneId}
      onClick={() => onZoneChange(zoneId)}
      className={`${BTN_BASE} ${isActive ? activeClass : `${BTN_INACTIVE} ${ZONE_COLORS[zoneId] ?? ""}`}`}
      title={zone.description}
    >
      <span className="font-pixel text-[8px]">{zone.icon}</span>
      <span className="sm:hidden">{ZONE_SHORT_LABELS[zoneId]}</span>
      <span className="hidden sm:inline xl:hidden">{ZONE_SHORT_LABELS[zoneId]}</span>
      <span className="hidden xl:inline">{zone.name.toUpperCase()}</span>
    </button>
  );
}

export function ZoneNav() {
  const { currentZone, setZone } = useGameStore();
  const navRef = useRef<HTMLElement>(null);
  const handleZoneChange = (zone: ZoneType) => {
    if (zone === currentZone) return;
    window.dispatchEvent(new CustomEvent("bagsworld-zone-change", { detail: { zone } }));
    setZone(zone);
  };

  // Auto-scroll to active zone button when zone changes (mobile only)
  useEffect(() => {
    if (!navRef.current) return;
    const activeBtn = navRef.current.querySelector("[data-active='true']") as HTMLElement | null;
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [currentZone]);

  return (
    <>
      {/* Mobile: single-row horizontal scroller */}
      <nav
        ref={navRef}
        className="sm:hidden flex items-center flex-nowrap overflow-x-auto scrollbar-hide zone-nav-scroll gap-px bg-black/85 backdrop-blur-sm px-1 py-1 border border-gray-700/60 shadow-[0_4px_16px_rgba(0,0,0,0.6)]"
      >
        {ZONE_ORDER.map((zoneId) => (
          <ZoneButton
            key={zoneId}
            zoneId={zoneId}
            currentZone={currentZone}
            onZoneChange={handleZoneChange}
          />
        ))}
      </nav>

      {/* Desktop: 2-row — Ascension top, main zones bottom */}
      <nav className="hidden sm:flex flex-col items-center gap-1 px-1 py-1">
        {/* Row 1: Ascension — centered */}
        <div className="flex justify-center">
          <ZoneButton
            zoneId="ascension"
            currentZone={currentZone}
            onZoneChange={handleZoneChange}
          />
        </div>
        {/* Row 2: Main zones */}
        <div className="flex items-center gap-1">
          {MAIN_ZONES.map((zoneId) => (
            <ZoneButton
              key={zoneId}
              zoneId={zoneId}
              currentZone={currentZone}
              onZoneChange={handleZoneChange}
            />
          ))}
        </div>
      </nav>
    </>
  );
}
