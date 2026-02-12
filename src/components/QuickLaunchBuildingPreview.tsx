"use client";

import { ECOSYSTEM_CONFIG } from "@/lib/config";

interface QuickLaunchBuildingPreviewProps {
  name: string;
  symbol: string;
  logoUrl?: string | null;
  level?: number;
}

function getTierInfo(level: number) {
  const tier = ECOSYSTEM_CONFIG.buildings.tiers.find((t) => t.level === level);
  return tier ?? ECOSYSTEM_CONFIG.buildings.tiers[0];
}

export function QuickLaunchBuildingPreview({
  name,
  symbol,
  logoUrl,
  level = 1,
}: QuickLaunchBuildingPreviewProps) {
  const tier = getTierInfo(level);

  // Building dimensions scale with level
  const heights = [64, 80, 100, 120, 144];
  const widths = [48, 56, 64, 72, 80];
  const h = heights[level - 1] ?? 64;
  const w = widths[level - 1] ?? 48;
  const windowRows = level;
  const windowCols = level >= 3 ? 3 : 2;

  // Pixel art colors per level
  const colors = [
    { wall: "#4a5568", light: "#718096", dark: "#2d3748", roof: "#48bb78", window: "#fbbf24" },
    { wall: "#2d6a4f", light: "#40916c", dark: "#1b4332", roof: "#52b788", window: "#f59e0b" },
    { wall: "#1e3a5f", light: "#2563eb", dark: "#1e1e5f", roof: "#3b82f6", window: "#fbbf24" },
    { wall: "#5b21b6", light: "#7c3aed", dark: "#3b0764", roof: "#a78bfa", window: "#fde68a" },
    { wall: "#b45309", light: "#d97706", dark: "#78350f", roof: "#fbbf24", window: "#fef3c7" },
  ];
  const c = colors[level - 1] ?? colors[0];

  return (
    <div className="bg-black/60 border-2 border-bags-green/30 p-4 flex flex-col items-center">
      <p className="font-pixel text-[8px] text-gray-500 mb-3">BUILDING PREVIEW</p>

      {/* Sky + Building */}
      <div
        className="relative flex flex-col items-center justify-end"
        style={{ width: w + 40, height: h + 48 }}
      >
        {/* Stars for level 4+ */}
        {level >= 4 && (
          <>
            <div
              className="absolute w-1 h-1 bg-white/60 rounded-full animate-pulse"
              style={{ top: 4, left: 8 }}
            />
            <div
              className="absolute w-1 h-1 bg-white/40 rounded-full animate-pulse"
              style={{ top: 12, right: 6, animationDelay: "0.5s" }}
            />
            <div
              className="absolute w-0.5 h-0.5 bg-white/30 rounded-full animate-pulse"
              style={{ top: 8, left: "50%", animationDelay: "1s" }}
            />
          </>
        )}

        {/* Roof */}
        <div
          style={{
            width: w + 8,
            height: 8,
            backgroundColor: c.roof,
            borderBottom: `2px solid ${c.dark}`,
            imageRendering: "pixelated" as const,
          }}
        />

        {/* Building body */}
        <div
          className="relative"
          style={{
            width: w,
            height: h,
            backgroundColor: c.wall,
            borderLeft: `4px solid ${c.light}`,
            borderRight: `4px solid ${c.dark}`,
            borderBottom: `4px solid ${c.dark}`,
            imageRendering: "pixelated" as const,
          }}
        >
          {/* Windows grid */}
          <div
            className="absolute inset-0 p-1.5 grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${windowCols}, 1fr)`,
              gridTemplateRows: `repeat(${windowRows}, 1fr)`,
            }}
          >
            {Array.from({ length: windowRows * windowCols }).map((_, i) => (
              <div
                key={i}
                className="relative"
                style={{
                  backgroundColor: c.window,
                  opacity: 0.8 + Math.random() * 0.2,
                  boxShadow: `0 0 4px ${c.window}60`,
                  imageRendering: "pixelated" as const,
                }}
              >
                {/* Window highlight */}
                <div
                  className="absolute top-0 left-0 w-1/3 h-1/3"
                  style={{ backgroundColor: "rgba(255,255,255,0.3)" }}
                />
              </div>
            ))}
          </div>

          {/* Logo sign on building */}
          {logoUrl && (
            <div
              className="absolute left-1/2 -translate-x-1/2 border border-white/30"
              style={{
                bottom: 4,
                width: Math.min(w * 0.5, 32),
                height: Math.min(w * 0.5, 32),
                imageRendering: "pixelated" as const,
              }}
            >
              <img
                src={logoUrl}
                alt=""
                className="w-full h-full object-cover"
                style={{ imageRendering: "pixelated" as const }}
              />
            </div>
          )}

          {/* Door (no logo) */}
          {!logoUrl && (
            <div
              className="absolute left-1/2 -translate-x-1/2"
              style={{
                bottom: 0,
                width: 10,
                height: 14,
                backgroundColor: c.dark,
                borderTop: `2px solid ${c.light}`,
              }}
            />
          )}
        </div>

        {/* Ground */}
        <div
          className="w-full"
          style={{
            height: 8,
            backgroundColor: "#2d4a2d",
            borderTop: "2px solid #48bb78",
            imageRendering: "pixelated" as const,
          }}
        />
      </div>

      {/* Labels */}
      <div className="text-center mt-3 space-y-1">
        <p
          className="font-pixel text-[10px] text-bags-green truncate max-w-[140px]"
          style={{ textShadow: "0 0 6px rgba(74,222,128,0.4)" }}
        >
          {symbol ? `$${symbol}` : "$TOKEN"}
        </p>
        <p className="font-pixel text-[8px] text-gray-400 truncate max-w-[140px]">
          {name || "Your Token"}
        </p>
        <span
          className={`inline-block font-pixel text-[7px] px-2 py-0.5 border ${
            level >= 4
              ? "border-bags-gold/50 text-bags-gold bg-bags-gold/10"
              : "border-bags-green/40 text-bags-green bg-bags-green/10"
          }`}
        >
          {tier.icon} LV{tier.level} {tier.name.toUpperCase()}
        </span>
      </div>
    </div>
  );
}
