"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { BAGSWORLD_AGENTS, MOLTBOOK_AGENTS, type AgentInfo } from "@/lib/agent-data";
import {
  useElizaHealth,
  useAgentStatuses,
  useGhostStatus,
  useAutonomousTasks,
  type AgentStatus,
} from "@/hooks/useElizaAgents";
import { type ZoneType } from "@/lib/types";

// Zone ID mapping for navigation
const ZONE_MAP: Record<string, ZoneType> = {
  Park: "main_city",
  BagsCity: "trending",
  HQ: "labs",
  "Founder's Corner": "founders",
  All: "main_city",
};

// Get status for an agent from Railway data
function getAgentOnlineStatus(
  agentId: string,
  railwayAgents: AgentStatus[] | undefined
): "online" | "busy" | "offline" {
  if (!railwayAgents) return "offline";
  const agent = railwayAgents.find(
    (a) => a.agentId === agentId || a.agentId === agentId.replace("-", "")
  );
  return agent?.status || "offline";
}

const ZONE_COLORS: Record<string, string> = {
  Park: "#4ade80",
  BagsCity: "#fbbf24",
  HQ: "#22d3ee",
  "Founder's Corner": "#f59e0b",
  All: "#a78bfa",
  "m/pokecenter": "#ef4444",
  "m/bagsworld": "#4ade80",
};

// GameBoy-style agent entry
function AgentEntry({
  agent,
  index,
  status,
  isSelected,
  onSelect,
  onVisit,
  onTalk,
}: {
  agent: AgentInfo;
  index: number;
  status: "online" | "busy" | "offline";
  isSelected: boolean;
  onSelect: () => void;
  onVisit: () => void;
  onTalk: () => void;
}) {
  const accentColor = ZONE_COLORS[agent.zone] || "#4ade80";

  return (
    <div
      onClick={onSelect}
      className="cursor-pointer transition-all duration-100"
      style={{
        background: isSelected ? "rgba(74, 222, 128, 0.08)" : "rgba(0, 0, 0, 0.4)",
        border: isSelected ? "3px solid #4ade80" : "3px solid #1e293b",
        boxShadow: isSelected
          ? "0 0 16px rgba(74, 222, 128, 0.2), inset 0 0 24px rgba(74, 222, 128, 0.03)"
          : "inset 0 0 12px rgba(0, 0, 0, 0.4)",
      }}
    >
      <div className="p-4 sm:p-5">
        {/* Top row: sprite + name/role + status */}
        <div className="flex items-center gap-4 mb-3">
          {/* Sprite frame */}
          <div className="relative flex-shrink-0">
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center"
              style={{
                background: "#0c0c1a",
                border: `3px solid ${accentColor}`,
                boxShadow: `inset 0 0 12px rgba(0,0,0,0.9), 0 0 8px ${accentColor}33`,
              }}
            >
              <Image
                src={agent.avatar}
                alt={agent.name}
                width={80}
                height={80}
                className="pixelated w-full h-full"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            {/* Status dot */}
            <div
              className="absolute -bottom-1 -right-1 w-4 h-4"
              style={{
                background:
                  status === "online" ? "#4ade80" : status === "busy" ? "#fbbf24" : "#4b5563",
                border: "2px solid #000",
                boxShadow: status === "online" ? "0 0 8px #4ade80" : "none",
              }}
            />
          </div>

          {/* Name block */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-pixel text-[10px] text-gray-600">
                #{String(index + 1).padStart(2, "0")}
              </span>
              {agent.twitter && (
                <a
                  href={`https://x.com/${agent.twitter.replace("@", "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="font-pixel text-[10px] text-blue-400/60 hover:text-blue-400 transition-colors"
                >
                  {agent.twitter}
                </a>
              )}
            </div>
            <h3
              className="font-pixel text-base sm:text-lg leading-none mb-1"
              style={{ color: accentColor }}
            >
              {agent.name.toUpperCase()}
            </h3>
            <p className="font-pixel text-xs text-gray-400">{agent.role}</p>
          </div>
        </div>

        {/* Zone tag */}
        <div className="mb-3">
          <span
            className="inline-block font-pixel text-[10px] px-2 py-1"
            style={{
              background: `${accentColor}15`,
              border: `2px solid ${accentColor}`,
              color: accentColor,
            }}
          >
            {agent.zone.toUpperCase()}
          </span>
        </div>

        {/* Full bio - no clipping */}
        <p className="font-pixel text-xs sm:text-[13px] text-gray-300 leading-relaxed mb-4">
          {agent.description}
        </p>

        {/* Action buttons - GameBoy style */}
        <div className="flex gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onVisit();
            }}
            className="flex-1 font-pixel text-xs sm:text-sm py-2 transition-all hover:brightness-125 active:translate-y-[1px]"
            style={{
              background: "linear-gradient(180deg, #166534 0%, #14532d 100%)",
              border: "3px solid #4ade80",
              color: "#4ade80",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15), 0 3px 0 #0a3622",
            }}
          >
            <span className="opacity-50 mr-1">A</span> FIND
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTalk();
            }}
            className="flex-1 font-pixel text-xs sm:text-sm py-2 transition-all hover:brightness-125 active:translate-y-[1px]"
            style={{
              background: "linear-gradient(180deg, #1e3a5f 0%, #172554 100%)",
              border: "3px solid #60a5fa",
              color: "#93c5fd",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15), 0 3px 0 #0c1a3d",
            }}
          >
            <span className="opacity-50 mr-1">B</span> TALK
          </button>
        </div>
      </div>
    </div>
  );
}

// Ghost status panel
function GhostStatusPanel() {
  const { data: ghostStatus, isLoading } = useGhostStatus();

  return (
    <div
      className="p-4"
      style={{
        background: "rgba(139, 92, 246, 0.08)",
        border: "3px solid #7c3aed",
        boxShadow: "inset 0 0 20px rgba(139, 92, 246, 0.08)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-pixel text-sm text-violet-400">GHOST TRADING</span>
        {!isLoading && ghostStatus && (
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3"
              style={{
                background: ghostStatus.trading.enabled ? "#4ade80" : "#ef4444",
                boxShadow: ghostStatus.trading.enabled ? "0 0 8px #4ade80" : "none",
              }}
            />
            <span className="font-pixel text-xs text-gray-400">
              {ghostStatus.trading.enabled ? "ACTIVE" : "OFF"}
            </span>
          </div>
        )}
      </div>

      {isLoading || !ghostStatus ? (
        <div className="font-pixel text-xs text-gray-500">Connecting...</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <div className="font-pixel text-[10px] text-gray-500 mb-1">WIN RATE</div>
            <div className="font-pixel text-sm text-white">{ghostStatus.performance.winRate}</div>
          </div>
          <div>
            <div className="font-pixel text-[10px] text-gray-500 mb-1">PNL</div>
            <div
              className="font-pixel text-sm"
              style={{
                color: ghostStatus.performance.totalPnlSol >= 0 ? "#4ade80" : "#ef4444",
              }}
            >
              {ghostStatus.performance.totalPnlSol >= 0 ? "+" : ""}
              {ghostStatus.performance.totalPnlSol.toFixed(3)} SOL
            </div>
          </div>
          <div>
            <div className="font-pixel text-[10px] text-gray-500 mb-1">POSITIONS</div>
            <div className="font-pixel text-sm text-white">{ghostStatus.trading.openPositions}</div>
          </div>
          <div>
            <div className="font-pixel text-[10px] text-gray-500 mb-1">EXPOSURE</div>
            <div className="font-pixel text-sm text-white">
              {ghostStatus.trading.totalExposureSol.toFixed(2)} SOL
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Tasks panel
function TasksPanel() {
  const { data: tasksData, isLoading } = useAutonomousTasks();
  const activeTasks = tasksData?.tasks?.filter((t) => t.enabled).slice(0, 6) || [];

  return (
    <div
      className="p-4"
      style={{
        background: "rgba(6, 182, 212, 0.08)",
        border: "3px solid #0891b2",
        boxShadow: "inset 0 0 20px rgba(6, 182, 212, 0.08)",
      }}
    >
      <div className="font-pixel text-sm text-cyan-400 mb-3">SCHEDULED TASKS</div>

      {isLoading ? (
        <div className="font-pixel text-xs text-gray-500">Connecting...</div>
      ) : activeTasks.length === 0 ? (
        <div className="font-pixel text-xs text-gray-500">No active tasks</div>
      ) : (
        <div className="space-y-2">
          {activeTasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between">
              <span className="font-pixel text-xs text-gray-300">{task.name}</span>
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5"
                  style={{ background: "#4ade80", boxShadow: "0 0 6px #4ade80" }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Main component
export function MeetTheAgents() {
  const router = useRouter();
  const { data: healthData } = useElizaHealth();
  const { data: agentStatusData } = useAgentStatuses();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const isConnected = healthData?.status === "healthy" || healthData?.status === "ok";
  const onlineCount = agentStatusData?.online || 0;
  const totalCount = agentStatusData?.count || BAGSWORLD_AGENTS.length;

  const handleVisit = (agent: AgentInfo) => {
    const zoneId = ZONE_MAP[agent.zone];
    router.push(zoneId ? `/?zone=${zoneId}` : "/");
  };

  const handleTalk = (agent: AgentInfo) => {
    router.push(`/?chat=${agent.id}`);
  };

  return (
    <div className="min-h-screen" style={{ background: "#050510" }}>
      {/* Scanline overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-40 opacity-30"
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 3px)",
        }}
      />

      {/* === HEADER BAR === */}
      <header
        className="relative z-10 border-b-4"
        style={{
          background: "#0a0a1a",
          borderColor: "#4ade80",
          boxShadow: "0 4px 24px rgba(74, 222, 128, 0.15)",
        }}
      >
        <div className="max-w-5xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center font-pixel text-lg sm:text-xl"
              style={{
                background: "#4ade80",
                color: "#050510",
                boxShadow: "4px 4px 0 #166534",
              }}
            >
              B
            </div>
            <div>
              <h1 className="font-pixel text-lg sm:text-xl" style={{ color: "#4ade80" }}>
                AGENT SELECT
              </h1>
              <p className="font-pixel text-[10px] sm:text-xs text-gray-500">
                BAGSWORLD CHARACTER DATABASE
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Connection status */}
            <div
              className="flex items-center gap-2 px-3 py-1.5"
              style={{
                background: "rgba(0,0,0,0.6)",
                border: `2px solid ${isConnected ? "#4ade80" : "#ef4444"}`,
              }}
            >
              <div
                className="w-3 h-3"
                style={{
                  background: isConnected ? "#4ade80" : "#ef4444",
                  boxShadow: isConnected ? "0 0 8px #4ade80" : "none",
                }}
              />
              <span className="font-pixel text-xs text-gray-300">
                {onlineCount}/{totalCount}
              </span>
            </div>

            <a
              href="/"
              className="font-pixel text-xs sm:text-sm px-4 py-1.5 transition-all hover:brightness-125"
              style={{
                background: "linear-gradient(180deg, #1f2937 0%, #111827 100%)",
                border: "3px solid #4b5563",
                color: "#9ca3af",
                boxShadow: "0 3px 0 #0a0a0a",
              }}
            >
              START BACK
            </a>
          </div>
        </div>
      </header>

      {/* === MAIN CONTENT === */}
      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-5 sm:py-8 relative z-10">
        {/* Status panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <GhostStatusPanel />
          <TasksPanel />
        </div>

        {/* === BAGSWORLD CREW === */}
        <div className="mb-5">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="font-pixel text-base sm:text-lg text-bags-green whitespace-nowrap">
              BAGSWORLD CREW
            </h2>
            <div
              className="h-[3px] flex-1"
              style={{
                background: "linear-gradient(90deg, #4ade80 0%, transparent 100%)",
              }}
            />
          </div>
          <p className="font-pixel text-xs text-gray-500 mb-4">
            {BAGSWORLD_AGENTS.length} IN-GAME AI CHARACTERS
          </p>
        </div>

        {/* Agent grid - 2 columns, readable */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-10">
          {BAGSWORLD_AGENTS.map((agent, i) => (
            <AgentEntry
              key={agent.id}
              agent={agent}
              index={i}
              status={getAgentOnlineStatus(agent.id, agentStatusData?.agents)}
              isSelected={selectedId === agent.id}
              onSelect={() => setSelectedId(selectedId === agent.id ? null : agent.id)}
              onVisit={() => handleVisit(agent)}
              onTalk={() => handleTalk(agent)}
            />
          ))}
        </div>

        {/* === MOLTBOOK AGENTS === */}
        <div className="mb-5">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="font-pixel text-base sm:text-lg text-red-400 whitespace-nowrap">
              MOLTBOOK AGENTS
            </h2>
            <div
              className="h-[3px] flex-1"
              style={{
                background: "linear-gradient(90deg, #ef4444 0%, transparent 100%)",
              }}
            />
          </div>
          <p className="font-pixel text-xs text-gray-500 mb-4">EXTERNAL SOCIAL AI AGENTS</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          {MOLTBOOK_AGENTS.map((agent, i) => (
            <div
              key={agent.id}
              className="transition-all"
              style={{
                background: "rgba(239, 68, 68, 0.06)",
                border: "3px solid #991b1b",
                boxShadow: "inset 0 0 20px rgba(239, 68, 68, 0.05)",
              }}
            >
              <div className="p-4 sm:p-5">
                <div className="flex items-center gap-4 mb-3">
                  {/* Sprite */}
                  <div
                    className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 flex items-center justify-center"
                    style={{
                      background: "#1a0505",
                      border: "3px solid #dc2626",
                      boxShadow: "inset 0 0 12px rgba(0,0,0,0.9)",
                    }}
                  >
                    <Image
                      src={agent.avatar}
                      alt={agent.name}
                      width={80}
                      height={80}
                      className="pixelated w-full h-full"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="font-pixel text-[10px] text-gray-600">
                      #{String(BAGSWORLD_AGENTS.length + i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="font-pixel text-base sm:text-lg text-red-400 leading-none mb-1">
                      {agent.name.toUpperCase()}
                    </h3>
                    <p className="font-pixel text-xs text-gray-400">{agent.role}</p>
                  </div>
                </div>

                <div className="mb-3">
                  <span
                    className="inline-block font-pixel text-[10px] px-2 py-1"
                    style={{
                      background: "rgba(239, 68, 68, 0.1)",
                      border: "2px solid #dc2626",
                      color: "#f87171",
                    }}
                  >
                    {agent.zone.toUpperCase()}
                  </span>
                </div>

                <p className="font-pixel text-xs sm:text-[13px] text-gray-300 leading-relaxed mb-4">
                  {agent.description}
                </p>

                {/* Action buttons */}
                <div className="flex gap-3">
                  <a
                    href={`https://moltbook.com/u/${agent.name}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center font-pixel text-xs sm:text-sm py-2 transition-all hover:brightness-125 active:translate-y-[1px]"
                    style={{
                      background: "linear-gradient(180deg, #991b1b 0%, #7f1d1d 100%)",
                      border: "3px solid #dc2626",
                      color: "#fca5a5",
                      boxShadow: "0 3px 0 #450a0a",
                    }}
                  >
                    VIEW PROFILE
                  </a>
                  {agent.twitter && (
                    <a
                      href={`https://x.com/${agent.twitter.replace("@", "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-center font-pixel text-xs sm:text-sm py-2 transition-all hover:brightness-125 active:translate-y-[1px]"
                      style={{
                        background: "linear-gradient(180deg, #1e3a5f 0%, #172554 100%)",
                        border: "3px solid #60a5fa",
                        color: "#93c5fd",
                        boxShadow: "0 3px 0 #0c1a3d",
                      }}
                    >
                      {agent.twitter}
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* === FOOTER === */}
      <footer
        className="relative z-10 border-t-4 py-4"
        style={{
          background: "#0a0a1a",
          borderColor: "#1e293b",
        }}
      >
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between">
          <p className="font-pixel text-xs text-gray-600">BAGSWORLD AGENT DATABASE v1.0</p>
          <p className="font-pixel text-xs text-gray-600">POWERED BY RAILWAY</p>
        </div>
      </footer>
    </div>
  );
}

export default MeetTheAgents;
