"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState, useMemo } from "react";
import { ZONES, ZoneType } from "@/lib/types";

const EcosystemCanvas = dynamic(() => import("@/components/EcosystemCanvas"), {
  ssr: false,
});
import { AGENT_DATA, getAgentColorClass, getAgentBorderClass } from "@/lib/agent-data";
import { ZONE_ORDER } from "@/components/ZoneNav";
import { useWorldState } from "@/hooks/useWorldState";
import { useAgentStatuses, useElizaHealth } from "@/hooks/useElizaAgents";

// ============================================================================
// Constants
// ============================================================================

type FilterType = "ALL" | "CHARACTERS" | "TOOLS" | "ZONES";

const ZONE_COLORS: Record<ZoneType, string> = {
  labs: "border-green-500/50",
  moltbook: "border-red-500/50",
  main_city: "border-bags-green/50",
  trending: "border-yellow-500/50",
  ballers: "border-yellow-500/50",
  founders: "border-amber-500/50",
  arena: "border-red-500/50",
  dungeon: "border-purple-500/50",
};

const ZONE_TEXT_COLORS: Record<ZoneType, string> = {
  labs: "text-green-400",
  moltbook: "text-red-400",
  main_city: "text-bags-green",
  trending: "text-bags-gold",
  ballers: "text-yellow-400",
  founders: "text-amber-400",
  arena: "text-red-400",
  dungeon: "text-purple-400",
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

const PAGE_LINKS = [
  { name: "ENTER WORLD", href: "/", icon: "[W]", description: "Main pixel art game" },
  { name: "AGENTS", href: "/agents", icon: "[A]", description: "Meet the AI agents" },
  { name: "DOCS", href: "/docs", icon: "[D]", description: "Documentation & guides" },
  { name: "BANNER", href: "/banner", icon: "[B]", description: "Generate pixel art banners" },
];

// ============================================================================
// Helpers
// ============================================================================

function formatLastSeen(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

const AGENT_CAPABILITIES: Record<string, string[]> = {
  ghost: ["trade", "chat", "on-chain", "autonomous"],
  neo: ["scout", "chat", "launch-detect"],
  finn: ["chat", "ecosystem"],
  toly: ["chat", "solana-expert"],
  ash: ["chat", "guide", "pokemon"],
  shaw: ["chat", "elizaos", "agents"],
  cj: ["chat", "market-data"],
  ramo: ["chat", "contracts", "sdk"],
  sincara: ["chat", "frontend"],
  stuu: ["chat", "ops", "support"],
  sam: ["chat", "growth"],
  alaa: ["chat", "r&d"],
  carlo: ["chat", "community"],
  bnn: ["chat", "news", "alerts"],
  "professor-oak": ["chat", "ai-generate", "names", "logos"],
  "bags-bot": ["chat", "commands", "guide"],
  bagsy: ["chat", "moltbook", "hype", "autonomous"],
  chadghost: ["chat", "moltbook", "moderate"],
};

function getDefaultCapabilities(agentId: string): string[] {
  return AGENT_CAPABILITIES[agentId] ?? ["chat"];
}

// ============================================================================
// Components
// ============================================================================

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className="font-pixel text-xs text-bags-green whitespace-nowrap">{title}</h2>
      <div className="flex-1 h-px bg-gradient-to-r from-bags-green/60 to-transparent" />
    </div>
  );
}

function StatusDot({ status }: { status: "online" | "busy" | "offline" }) {
  const colors = {
    online: "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]",
    busy: "bg-yellow-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]",
    offline: "bg-gray-600",
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status]}`} />;
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

  // Build agent status map
  const statusMap = useMemo(() => {
    const map: Record<string, "online" | "busy" | "offline"> = {};
    if (agentStatuses?.agents) {
      for (const a of agentStatuses.agents) {
        map[a.agentId] = a.status;
      }
    }
    return map;
  }, [agentStatuses]);

  // Filtered data
  const filteredAgents = useMemo(() => {
    if (!q) return AGENT_DATA;
    return AGENT_DATA.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.role.toLowerCase().includes(q) ||
        a.zone.toLowerCase().includes(q)
    );
  }, [q]);

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
  const showCharacters = filter === "ALL" || filter === "CHARACTERS";
  const showTools = filter === "ALL" || filter === "TOOLS";

  const serverStatus = healthData?.status === "ok" ? "ONLINE" : "OFFLINE";
  const serverColor = healthData?.status === "ok" ? "text-green-400" : "text-gray-500";

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">
      {/* Search + Filter */}
      <div className="sticky top-14 z-40 bg-bags-darker/95 backdrop-blur-sm pb-3 pt-1 -mx-3 sm:-mx-6 px-3 sm:px-6 border-b border-bags-green/20">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents, zones, features..."
            className="flex-1 bg-black/40 border-2 border-bags-green/30 px-3 py-2 font-pixel text-[10px] text-gray-200 placeholder-gray-600 focus:border-bags-green/60 focus:outline-none min-h-[44px]"
          />
          <div className="flex gap-1">
            {(["ALL", "CHARACTERS", "TOOLS", "ZONES"] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`font-pixel text-[8px] sm:text-[10px] px-2 sm:px-3 py-1.5 min-h-[36px] border transition-all ${
                  filter === f
                    ? "bg-bags-green text-bags-dark border-bags-green"
                    : "bg-transparent text-gray-400 border-gray-600 hover:border-bags-green/50 hover:text-bags-green"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Ecosystem Demo */}
      {filter === "ALL" && !q && (
        <section>
          <SectionHeader title="[ECOSYSTEM MAP]" />
          {showDemo ? (
            <div>
              <EcosystemCanvas />
              <p className="font-pixel text-[8px] text-gray-500 text-center mt-2">
                Click any building to explore that zone
              </p>
            </div>
          ) : (
            <button
              onClick={() => setShowDemo(true)}
              className="w-full bg-black/40 border-2 border-bags-green/30 p-6 hover:bg-white/5 hover:border-bags-green/50 transition-all group"
            >
              <p className="font-pixel text-xs text-bags-green group-hover:brightness-125">
                LOAD ECOSYSTEM DEMO
              </p>
              <p className="font-pixel text-[8px] text-gray-500 mt-2">
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
            <div className="bg-black/40 border-2 border-bags-green/30 p-3 sm:p-4">
              <p className="font-pixel text-[8px] text-gray-500 mb-1">WORLD HEALTH</p>
              <div className="flex items-end gap-2">
                <span className="font-pixel text-lg text-bags-green">
                  {worldState?.health ?? "--"}%
                </span>
                <span className="font-pixel text-[8px] text-gray-400 mb-1">
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
              <div className="mt-2 h-2 bg-black/60 border border-bags-green/20">
                <div
                  className="h-full bg-bags-green transition-all duration-500"
                  style={{ width: `${worldState?.health ?? 0}%` }}
                />
              </div>
            </div>

            <div className="bg-black/40 border-2 border-bags-green/30 p-3 sm:p-4">
              <p className="font-pixel text-[8px] text-gray-500 mb-1">WEATHER</p>
              <span className="font-pixel text-lg text-bags-gold">
                {worldState?.weather?.toUpperCase() ?? "--"}
              </span>
            </div>

            <div className="bg-black/40 border-2 border-bags-green/30 p-3 sm:p-4">
              <p className="font-pixel text-[8px] text-gray-500 mb-1">AGENT SERVER</p>
              <span className={`font-pixel text-lg ${serverColor}`}>{serverStatus}</span>
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
              return (
                <Link
                  key={zId}
                  href={`/?zone=${zId}`}
                  className={`shrink-0 w-40 sm:w-auto bg-black/40 border-2 ${ZONE_COLORS[zId]} p-3 hover:bg-white/5 transition-all group`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-pixel text-[10px] ${ZONE_TEXT_COLORS[zId]}`}>
                      {z.icon}
                    </span>
                    <span
                      className={`font-pixel text-[10px] ${ZONE_TEXT_COLORS[zId]} group-hover:brightness-125`}
                    >
                      {z.name.toUpperCase()}
                    </span>
                  </div>
                  <p className="font-pixel text-[8px] text-gray-500 leading-relaxed">
                    {z.description}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Quick Nav: Pages */}
      {filter === "ALL" && !q && (
        <section>
          <SectionHeader title="[PAGES]" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PAGE_LINKS.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className="bg-black/40 border-2 border-bags-green/30 p-3 hover:bg-white/5 hover:border-bags-green/50 transition-all"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-pixel text-[10px] text-bags-green">{p.icon}</span>
                  <span className="font-pixel text-[10px] text-bags-green">{p.name}</span>
                </div>
                <p className="font-pixel text-[8px] text-gray-500">{p.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Agent Status Table */}
      {showCharacters && filteredAgents.length > 0 && (
        <section>
          <SectionHeader title={`[AGENT STATUS] (${filteredAgents.length})`} />

          {/* Desktop table */}
          <div className="hidden sm:block bg-black/40 border-2 border-bags-green/30 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-bags-green/20">
                  <th className="font-pixel text-[7px] text-gray-500 text-left px-3 py-2">ID</th>
                  <th className="font-pixel text-[7px] text-gray-500 text-left px-3 py-2">
                    STATUS
                  </th>
                  <th className="font-pixel text-[7px] text-gray-500 text-left px-3 py-2">ROLE</th>
                  <th className="font-pixel text-[7px] text-gray-500 text-left px-3 py-2">ZONE</th>
                  <th className="font-pixel text-[7px] text-gray-500 text-left px-3 py-2">TYPE</th>
                  <th className="font-pixel text-[7px] text-gray-500 text-left px-3 py-2">
                    CAPABILITIES
                  </th>
                  <th className="font-pixel text-[7px] text-gray-500 text-left px-3 py-2">
                    CURRENT TASK
                  </th>
                  <th className="font-pixel text-[7px] text-gray-500 text-left px-3 py-2">
                    SOCIALS
                  </th>
                  <th className="font-pixel text-[7px] text-gray-500 text-left px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {filteredAgents.map((agent) => {
                  const zoneId = ZONE_NAME_TO_ID[agent.zone] ?? "main_city";
                  const agentStatus = statusMap[agent.id] ?? "offline";
                  const liveAgent = agentStatuses?.agents?.find((a) => a.agentId === agent.id);
                  const lastSeenStr = liveAgent?.lastSeen
                    ? formatLastSeen(liveAgent.lastSeen)
                    : "--";
                  return (
                    <tr
                      key={agent.id}
                      className="border-b border-gray-800/50 hover:bg-white/[0.02] transition-colors"
                    >
                      {/* ID + Name */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-pixel text-[9px] ${getAgentColorClass(agent.color)}`}
                          >
                            {agent.name}
                          </span>
                          <span className="font-mono text-[7px] text-gray-600">{agent.id}</span>
                        </div>
                      </td>
                      {/* Status */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <StatusDot status={agentStatus} />
                          <span
                            className={`font-pixel text-[7px] ${agentStatus === "online" ? "text-green-400" : agentStatus === "busy" ? "text-yellow-400" : "text-gray-600"}`}
                          >
                            {agentStatus.toUpperCase()}
                          </span>
                        </div>
                        <span className="font-mono text-[6px] text-gray-600 block mt-0.5">
                          {lastSeenStr}
                        </span>
                      </td>
                      {/* Role */}
                      <td className="px-3 py-2">
                        <span className="font-pixel text-[7px] text-gray-400">{agent.role}</span>
                      </td>
                      {/* Zone */}
                      <td className="px-3 py-2">
                        <span
                          className={`font-pixel text-[7px] px-1.5 py-0.5 border ${ZONE_COLORS[zoneId]} ${ZONE_TEXT_COLORS[zoneId]}`}
                        >
                          {agent.zone}
                        </span>
                      </td>
                      {/* Type */}
                      <td className="px-3 py-2">
                        <span
                          className={`font-pixel text-[7px] px-1.5 py-0.5 border ${
                            agent.category === "moltbook"
                              ? "border-red-500/40 text-red-400"
                              : "border-bags-green/40 text-bags-green"
                          }`}
                        >
                          {agent.category === "moltbook" ? "SOCIAL" : "IN-GAME"}
                        </span>
                      </td>
                      {/* Capabilities */}
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {(liveAgent?.capabilities ?? getDefaultCapabilities(agent.id)).map(
                            (cap) => (
                              <span
                                key={cap}
                                className="font-mono text-[6px] px-1 py-0.5 bg-bags-green/10 border border-bags-green/20 text-bags-green/70"
                              >
                                {cap}
                              </span>
                            )
                          )}
                        </div>
                      </td>
                      {/* Current Task */}
                      <td className="px-3 py-2">
                        <span className="font-mono text-[7px] text-gray-500">
                          {liveAgent?.currentTask ?? "idle"}
                        </span>
                      </td>
                      {/* Socials */}
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-0.5">
                          {agent.twitter && (
                            <span className="font-mono text-[6px] text-blue-400">
                              X:{agent.twitter}
                            </span>
                          )}
                          {agent.moltbook && (
                            <span className="font-mono text-[6px] text-red-400">
                              MB:{agent.moltbook}
                            </span>
                          )}
                          {!agent.twitter && !agent.moltbook && (
                            <span className="font-mono text-[6px] text-gray-700">--</span>
                          )}
                        </div>
                      </td>
                      {/* Actions */}
                      <td className="px-3 py-2">
                        <Link
                          href={`/?chat=${agent.id}`}
                          className="font-pixel text-[7px] px-2 py-1 bg-bags-green/10 border border-bags-green/40 text-bags-green hover:bg-bags-green/20 transition-all"
                        >
                          TALK
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards — compact technical view */}
          <div className="sm:hidden space-y-2">
            {filteredAgents.map((agent) => {
              const zoneId = ZONE_NAME_TO_ID[agent.zone] ?? "main_city";
              const agentStatus = statusMap[agent.id] ?? "offline";
              const liveAgent = agentStatuses?.agents?.find((a) => a.agentId === agent.id);
              const lastSeenStr = liveAgent?.lastSeen ? formatLastSeen(liveAgent.lastSeen) : "--";
              return (
                <div
                  key={agent.id}
                  className={`bg-black/40 border-2 ${getAgentBorderClass(agent.color)} p-3`}
                >
                  {/* Header row */}
                  <div className="flex items-center gap-2 mb-2">
                    <StatusDot status={agentStatus} />
                    <span className={`font-pixel text-[9px] ${getAgentColorClass(agent.color)}`}>
                      {agent.name}
                    </span>
                    <span className="font-mono text-[7px] text-gray-600">{agent.id}</span>
                    <span
                      className={`ml-auto font-pixel text-[7px] px-1.5 py-0.5 border ${ZONE_COLORS[zoneId]} ${ZONE_TEXT_COLORS[zoneId]}`}
                    >
                      {agent.zone}
                    </span>
                  </div>
                  {/* Technical info */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-2">
                    <div>
                      <span className="font-pixel text-[6px] text-gray-600 block">ROLE</span>
                      <span className="font-pixel text-[7px] text-gray-400">{agent.role}</span>
                    </div>
                    <div>
                      <span className="font-pixel text-[6px] text-gray-600 block">STATUS</span>
                      <span
                        className={`font-pixel text-[7px] ${agentStatus === "online" ? "text-green-400" : agentStatus === "busy" ? "text-yellow-400" : "text-gray-500"}`}
                      >
                        {agentStatus.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <span className="font-pixel text-[6px] text-gray-600 block">TASK</span>
                      <span className="font-mono text-[7px] text-gray-500">
                        {liveAgent?.currentTask ?? "idle"}
                      </span>
                    </div>
                    <div>
                      <span className="font-pixel text-[6px] text-gray-600 block">LAST SEEN</span>
                      <span className="font-mono text-[7px] text-gray-500">{lastSeenStr}</span>
                    </div>
                  </div>
                  {/* Capabilities */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {(liveAgent?.capabilities ?? getDefaultCapabilities(agent.id)).map((cap) => (
                      <span
                        key={cap}
                        className="font-mono text-[6px] px-1 py-0.5 bg-bags-green/10 border border-bags-green/20 text-bags-green/70"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                  {/* Socials + Action */}
                  <div className="flex items-center gap-2">
                    {agent.twitter && (
                      <span className="font-mono text-[6px] text-blue-400">X:{agent.twitter}</span>
                    )}
                    {agent.moltbook && (
                      <span className="font-mono text-[6px] text-red-400">MB:{agent.moltbook}</span>
                    )}
                    <Link
                      href={`/?chat=${agent.id}`}
                      className="ml-auto font-pixel text-[7px] px-2 py-1 bg-bags-green/10 border border-bags-green/40 text-bags-green hover:bg-bags-green/20 transition-all"
                    >
                      TALK
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Features Grid */}
      {showTools && filteredFeatures.length > 0 && (
        <section>
          <SectionHeader title={`[FEATURES] (${filteredFeatures.length})`} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredFeatures.map((feat) => (
              <Link
                key={feat.name}
                href={`/?zone=${feat.zone}`}
                className={`bg-black/40 border-2 ${ZONE_COLORS[feat.zone]} p-3 hover:bg-white/5 transition-all group`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`font-pixel text-[10px] ${ZONE_TEXT_COLORS[feat.zone]}`}>
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
                <p className="font-pixel text-[8px] text-gray-500 leading-relaxed">
                  {feat.description}
                </p>
                <div className="mt-2">
                  <span
                    className={`font-pixel text-[7px] px-1.5 py-0.5 border ${ZONE_COLORS[feat.zone]} ${ZONE_TEXT_COLORS[feat.zone]}`}
                  >
                    {ZONES[feat.zone].name}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* No results */}
      {q &&
        filteredAgents.length === 0 &&
        filteredFeatures.length === 0 &&
        filteredZones.length === 0 && (
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
