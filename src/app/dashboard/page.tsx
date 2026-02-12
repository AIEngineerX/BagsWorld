"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState, useMemo } from "react";
import { ZONES, ZoneType } from "@/lib/types";

const EcosystemCanvas = dynamic(() => import("@/components/EcosystemCanvas"), {
  ssr: false,
});
const QuickLaunchPanel = dynamic(
  () => import("@/components/QuickLaunchPanel").then((m) => ({ default: m.QuickLaunchPanel })),
  { ssr: false }
);
import { AGENT_DATA } from "@/lib/agent-data";
import { ZONE_ORDER } from "@/components/ZoneNav";
import { useWorldState } from "@/hooks/useWorldState";
import { useAgentStatuses, useElizaHealth } from "@/hooks/useElizaAgents";

// ============================================================================
// Constants
// ============================================================================

type FilterType = "ALL" | "TOOLS" | "ZONES";

const ZONE_GRADIENT_COLORS: Record<ZoneType, string> = {
  labs: "#22c55e",
  moltbook: "#ef4444",
  main_city: "#4ade80",
  trending: "#eab308",
  ballers: "#eab308",
  founders: "#f59e0b",
  arena: "#ef4444",
  dungeon: "#a855f7",
};

const ZONE_NAME_TO_ID: Record<string, ZoneType> = {
  Park: "main_city",
  BagsCity: "trending",
  HQ: "labs",
  "Founder's Corner": "founders",
  All: "main_city",
  "m/bagsworld": "moltbook",
  "m/pokecenter": "moltbook",
};

interface FeatureItem {
  name: string;
  icon: string;
  description: string;
  zone: ZoneType;
  gate?: string;
}

const FEATURES: FeatureItem[] = [
  {
    name: "Casino",
    icon: "[C]",
    description: "Gamble tokens for big prizes",
    zone: "trending",
    gate: "1M $BW",
  },
  {
    name: "Trading Terminal",
    icon: "[T]",
    description: "Live charts and market data",
    zone: "trending",
  },
  {
    name: "Oracle Tower",
    icon: "[O]",
    description: "Predict token outcomes",
    zone: "trending",
    gate: "2M $BW",
  },
  {
    name: "Professor Oak",
    icon: "[P]",
    description: "AI token name & art generator",
    zone: "founders",
  },
  {
    name: "Launch Pad",
    icon: "[L]",
    description: "Create and launch new tokens",
    zone: "founders",
  },
  {
    name: "Sol Incinerator",
    icon: "[I]",
    description: "Burn tokens & reclaim SOL rent",
    zone: "founders",
  },
  { name: "Moltbook Feed", icon: "[M]", description: "AI agent social network", zone: "moltbook" },
  { name: "Arena Combat", icon: "[A]", description: "Real-time AI agent battles", zone: "arena" },
  { name: "Leaderboard", icon: "[#]", description: "Top fee earners ranked", zone: "main_city" },
  { name: "Agent Dashboard", icon: "[D]", description: "Monitor autonomous agents", zone: "labs" },
  {
    name: "Ballers Mansions",
    icon: "[B]",
    description: "Luxury showcase for top holders",
    zone: "ballers",
  },
  {
    name: "PokeCenter",
    icon: "[+]",
    description: "Heal and manage your tokens",
    zone: "main_city",
  },
  {
    name: "Token Registry",
    icon: "[R]",
    description: "Browse all launched tokens",
    zone: "main_city",
  },
  {
    name: "Fee Claiming",
    icon: "[$]",
    description: "Claim your creator fee earnings",
    zone: "main_city",
  },
  { name: "BagsDungeon", icon: "[X]", description: "MMORPG adventure zone", zone: "dungeon" },
];

// ============================================================================
// Components
// ============================================================================

function SectionHeader({ title, color = "#4ade80" }: { title: string; color?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2
        className="font-pixel text-xs whitespace-nowrap"
        style={{ color, textShadow: `0 0 6px ${color}66` }}
      >
        {title}
      </h2>
      <div
        className="flex-1 h-px"
        style={{ background: `linear-gradient(to right, ${color}99, transparent)` }}
      />
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function DashboardPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [showDemo, setShowDemo] = useState(false);

  const { worldState } = useWorldState();
  const { data: agentStatuses } = useAgentStatuses();
  const { data: healthData } = useElizaHealth();

  const q = search.toLowerCase().trim();

  // Filtered data
  const filteredFeatures = useMemo(() => {
    if (!q) return FEATURES;
    return FEATURES.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        ZONES[f.zone]?.name.toLowerCase().includes(q)
    );
  }, [q]);

  const filteredZones = useMemo(() => {
    if (!q) return ZONE_ORDER;
    return ZONE_ORDER.filter((zId) => {
      const z = ZONES[zId];
      return z.name.toLowerCase().includes(q) || z.description.toLowerCase().includes(q);
    });
  }, [q]);

  const showZones = filter === "ALL" || filter === "ZONES";
  const showTools = filter === "ALL" || filter === "TOOLS";

  const isServerOnline = healthData?.status === "ok" || healthData?.status === "healthy";
  const serverStatus = isServerOnline ? "ONLINE" : "OFFLINE";

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">
      <style jsx>{`
        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
      `}</style>

      {/* Search + Filter */}
      <div className="sticky top-14 z-40 bg-bags-darker/95 backdrop-blur-sm pb-3 pt-1 -mx-3 sm:-mx-6 px-3 sm:px-6 border-b border-bags-green/20">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search zones, features..."
            className="flex-1 bg-black/40 border-2 border-bags-green/30 px-3 py-2 font-pixel text-[10px] text-gray-200 placeholder-gray-600 focus:border-bags-green/60 focus:outline-none min-h-[44px]"
          />
          <div className="flex gap-1">
            {(["ALL", "TOOLS", "ZONES"] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`font-pixel text-[8px] sm:text-[10px] px-2 sm:px-3 py-1.5 min-h-[36px] border transition-all duration-150 ${
                  filter === f
                    ? "bg-bags-green text-bags-dark border-bags-green scale-105"
                    : "bg-transparent text-gray-400 border-gray-600 hover:border-bags-green/50 hover:text-bags-green"
                }`}
              >
                {f}
              </button>
            ))}
            <Link
              href="/agents"
              className="font-pixel text-[8px] sm:text-[10px] px-2 sm:px-3 py-1.5 min-h-[36px] border border-cyan-500/40 text-cyan-400 hover:border-cyan-400 hover:bg-cyan-500/10 transition-all duration-150 flex items-center"
            >
              AGENTS
            </Link>
          </div>
        </div>
      </div>

      {/* Ecosystem Demo */}
      {filter === "ALL" && !q && (
        <section>
          <SectionHeader title="[ECOSYSTEM MAP]" />
          {showDemo ? (
            <div className="relative">
              <button
                onClick={() => setShowDemo(false)}
                className="absolute top-2 right-2 z-10 font-pixel text-[10px] px-2 py-1 bg-black/80 border border-bags-green/40 text-bags-green hover:bg-bags-green/20 hover:text-white transition-all"
                title="Close demo"
              >
                [X]
              </button>
              <EcosystemCanvas />
            </div>
          ) : (
            <button
              onClick={() => setShowDemo(true)}
              className="w-full bg-black/40 border-2 border-bags-green/30 p-6 hover:bg-white/5 hover:border-bags-green/50 transition-all group"
            >
              <p className="font-pixel text-xs text-bags-green group-hover:brightness-125">
                LOAD ECOSYSTEM DEMO
              </p>
              <p className="font-pixel text-[8px] text-gray-400 mt-2">
                Animated pixel-art map of the BagsWorld ecosystem
              </p>
            </button>
          )}
        </section>
      )}

      {/* World Status Panel */}
      {(filter === "ALL" || !q) && (
        <section>
          <SectionHeader title="[WORLD STATUS]" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Health */}
            <div
              className="border-2 border-green-500/40 p-3 sm:p-4"
              style={{
                backgroundColor: "rgba(74,222,128,0.04)",
                boxShadow: "inset 0 0 24px rgba(74,222,128,0.04)",
              }}
            >
              <p className="font-pixel text-[8px] text-green-400/80 mb-1">WORLD HEALTH</p>
              <div className="flex items-end gap-2">
                <span
                  className="font-pixel text-lg text-green-400"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {worldState?.health ?? "--"}%
                </span>
                <span
                  className={`font-pixel text-[8px] text-gray-300 mb-1 ${(worldState?.health ?? 0) >= 80 ? "animate-pulse" : ""}`}
                >
                  {(worldState?.health ?? 0) >= 80
                    ? "THRIVING"
                    : (worldState?.health ?? 0) >= 60
                      ? "HEALTHY"
                      : (worldState?.health ?? 0) >= 40
                        ? "GROWING"
                        : (worldState?.health ?? 0) >= 20
                          ? "QUIET"
                          : "DORMANT"}
                </span>
              </div>
              <div className="mt-2 h-2 bg-black/60 border border-green-500/20 overflow-hidden relative">
                <div
                  className="h-full bg-green-400 transition-all duration-1000 ease-out"
                  style={{
                    width: `${worldState?.health ?? 0}%`,
                    boxShadow: "0 0 8px rgba(74,222,128,0.4)",
                  }}
                />
                <div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                  style={{
                    animation: "shimmer 2s infinite linear",
                    backgroundSize: "200% 100%",
                  }}
                />
              </div>
            </div>

            {/* Weather */}
            <div
              className="border-2 border-amber-500/40 p-3 sm:p-4"
              style={{
                backgroundColor: "rgba(245,158,11,0.04)",
                boxShadow: "inset 0 0 24px rgba(245,158,11,0.04)",
              }}
            >
              <p className="font-pixel text-[8px] text-amber-400/80 mb-1">WEATHER</p>
              <div className="flex items-center gap-2">
                <span className="font-pixel text-lg text-amber-400">
                  {worldState?.weather?.toUpperCase() ?? "--"}
                </span>
                <span className="text-lg">
                  {(() => {
                    const w = worldState?.weather?.toLowerCase();
                    if (w === "sunny") return <span className="text-yellow-400">{"\u2600"}</span>;
                    if (w === "cloudy") return <span className="text-gray-400">{"\u2601"}</span>;
                    if (w === "rain")
                      return <span className="text-blue-400">{"\uD83C\uDF27"}</span>;
                    if (w === "storm") return <span className="text-purple-400">{"\u26A1"}</span>;
                    if (w === "apocalypse")
                      return <span className="text-red-400">{"\uD83D\uDC80"}</span>;
                    return <span className="text-gray-400">{"\uD83C\uDF24"}</span>;
                  })()}
                </span>
              </div>
            </div>

            {/* Agent Server */}
            <div
              className="border-2 border-cyan-500/40 p-3 sm:p-4"
              style={{
                backgroundColor: "rgba(6,182,212,0.04)",
                boxShadow: "inset 0 0 24px rgba(6,182,212,0.04)",
              }}
            >
              <p className="font-pixel text-[8px] text-cyan-400/80 mb-1">AGENT SERVER</p>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block w-2.5 h-2.5 rounded-full ${
                    isServerOnline
                      ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)] animate-pulse"
                      : "bg-gray-600"
                  }`}
                />
                <span
                  className={`font-pixel text-lg ${isServerOnline ? "text-cyan-400" : "text-gray-500"}`}
                >
                  {serverStatus}
                </span>
              </div>
              {isServerOnline && agentStatuses?.online != null && (
                <p className="font-pixel text-[7px] text-gray-400 mt-1">
                  {agentStatuses.online}/{agentStatuses.count ?? 0} agents online
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Quick Nav: Zones */}
      {showZones && filteredZones.length > 0 && (
        <section>
          <SectionHeader title="[ZONES]" />
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide sm:grid sm:grid-cols-4 sm:overflow-visible">
            {filteredZones.map((zId) => {
              const z = ZONES[zId];
              const accent = ZONE_GRADIENT_COLORS[zId];
              return (
                <Link
                  key={zId}
                  href={`/?zone=${zId}`}
                  className="shrink-0 w-40 sm:w-auto border-2 p-3 hover:scale-[1.02] hover:brightness-110 transition-all group relative overflow-hidden"
                  style={{
                    borderColor: `${accent}60`,
                    backgroundColor: `${accent}0c`,
                    boxShadow: `inset 0 0 30px ${accent}06`,
                  }}
                >
                  {/* Accent bar */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1.5"
                    style={{ backgroundColor: accent }}
                  />
                  <div className="flex items-center gap-2 mb-1 mt-1">
                    <span className="font-pixel text-[10px]" style={{ color: accent }}>
                      {z.icon}
                    </span>
                    <span
                      className="font-pixel text-[10px] group-hover:brightness-125"
                      style={{ color: accent }}
                    >
                      {z.name.toUpperCase()}
                    </span>
                  </div>
                  <p className="font-pixel text-[8px] text-gray-300 leading-relaxed">
                    {z.description}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <span
                      className="font-pixel text-[6px] px-1.5 py-0.5 border text-gray-300"
                      style={{
                        borderColor: `${accent}40`,
                        backgroundColor: `${accent}10`,
                      }}
                    >
                      {
                        AGENT_DATA.filter((a) => (ZONE_NAME_TO_ID[a.zone] ?? "main_city") === zId)
                          .length
                      }{" "}
                      agents
                    </span>
                    <span
                      className="font-pixel text-[6px] px-1.5 py-0.5 border text-gray-300"
                      style={{
                        borderColor: `${accent}40`,
                        backgroundColor: `${accent}10`,
                      }}
                    >
                      {FEATURES.filter((f) => f.zone === zId).length} features
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Quick Launch */}
      {filter === "ALL" && !q && (
        <section>
          <SectionHeader title="[QUICK LAUNCH]" color="#fbbf24" />
          <QuickLaunchPanel />
        </section>
      )}

      {/* Meet The Agents link */}
      {filter === "ALL" && !q && (
        <section>
          <SectionHeader title="[AGENTS]" color="#22d3ee" />
          <Link
            href="/agents"
            className="block border-2 border-cyan-500/30 p-4 sm:p-5 hover:border-cyan-500/50 transition-all group"
            style={{
              backgroundColor: "rgba(6,182,212,0.04)",
              boxShadow: "inset 0 0 30px rgba(6,182,212,0.03)",
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-pixel text-xs text-cyan-400 group-hover:brightness-125">
                  MEET THE CREW
                </p>
                <p className="font-pixel text-[8px] text-gray-400 mt-1">
                  {AGENT_DATA.length} AI agents — live status, trading stats, scheduled tasks
                </p>
              </div>
              <span className="font-pixel text-sm text-cyan-400 group-hover:translate-x-1 transition-transform">
                {"\u2192"}
              </span>
            </div>
          </Link>
        </section>
      )}

      {/* Features Grid */}
      {showTools && filteredFeatures.length > 0 && (
        <section>
          <SectionHeader title={`[FEATURES] (${filteredFeatures.length})`} color="#fbbf24" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredFeatures.map((feat) => {
              const accent = ZONE_GRADIENT_COLORS[feat.zone];
              return (
                <Link
                  key={feat.name}
                  href={`/?zone=${feat.zone}`}
                  className="border-2 p-3 hover:brightness-110 transition-all group"
                  style={{
                    borderColor: `${accent}40`,
                    backgroundColor: `${accent}08`,
                    boxShadow: `inset 0 0 20px ${accent}04`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-pixel text-[10px]" style={{ color: accent }}>
                      {feat.icon}
                    </span>
                    <span className="font-pixel text-[10px] text-gray-200 group-hover:text-white">
                      {feat.name}
                    </span>
                    {feat.gate && (
                      <span className="ml-auto font-pixel text-[7px] px-1.5 py-0.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">
                        {feat.gate}
                      </span>
                    )}
                  </div>
                  <p className="font-pixel text-[8px] text-gray-300 leading-relaxed">
                    {feat.description}
                  </p>
                  <div className="mt-2">
                    <span
                      className="font-pixel text-[7px] px-1.5 py-0.5 border"
                      style={{ borderColor: `${accent}40`, color: accent }}
                    >
                      {ZONES[feat.zone].name}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* No results */}
      {q && filteredFeatures.length === 0 && filteredZones.length === 0 && (
        <div className="text-center py-12">
          <p className="font-pixel text-xs text-gray-500">NO RESULTS FOR &quot;{search}&quot;</p>
          <button
            onClick={() => {
              setSearch("");
              setFilter("ALL");
            }}
            className="mt-3 font-pixel text-[10px] text-bags-green hover:underline"
          >
            CLEAR SEARCH
          </button>
        </div>
      )}
    </div>
  );
}
