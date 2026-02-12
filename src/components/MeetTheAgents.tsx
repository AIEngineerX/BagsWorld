"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BAGSWORLD_AGENTS, MOLTBOOK_AGENTS, AGENT_DATA, type AgentInfo } from "@/lib/agent-data";
import {
  useElizaHealth,
  useAgentStatuses,
  useGhostStatus,
  useAutonomousTasks,
  type AgentStatus,
} from "@/hooks/useElizaAgents";

// ============================================================================
// Constants
// ============================================================================

// Hex colors per zone for inline styles (avoids Tailwind purge issues)
const ZONE_COLORS: Record<string, string> = {
  Park: "#4ade80",
  BagsCity: "#fbbf24",
  HQ: "#22d3ee",
  "Founder's Corner": "#f59e0b",
  All: "#a78bfa",
  "m/pokecenter": "#ef4444",
  "m/bagsworld": "#4ade80",
};

// Agent capability descriptions
const AGENT_CAPABILITIES: Record<string, string[]> = {
  ghost: ["Trading", "Fee Claiming", "On-chain Ops"],
  neo: ["Launch Detection", "Rug Scanning"],
  finn: ["Ecosystem Info", "Roadmap"],
  toly: ["Solana Education", "Tech Explainers"],
  ash: ["Tutorial Guide", "Pokemon Analogies"],
  shaw: ["ElizaOS Support", "Agent Architecture"],
  cj: ["Market Commentary", "Street Alpha"],
  ramo: ["Smart Contracts", "SDK Support"],
  sincara: ["UI/UX", "Frontend"],
  stuu: ["Support", "Operations"],
  sam: ["Growth Strategy", "Marketing"],
  alaa: ["R&D", "Skunk Works"],
  carlo: ["Community", "Onboarding"],
  bnn: ["News", "Announcements"],
  "professor-oak": ["Name Generation", "Logo Gen", "Banner Gen"],
  "bags-bot": ["World Guide", "Commands"],
  bagsy: ["Hype Posts", "Fee Reminders"],
  chadghost: ["Moltbook Moderation", "Engagement"],
};

const AGENT_ACTIVE_TASKS: Record<string, string> = {
  ghost: "Scanning launches for entry signals",
  neo: "Monitoring new token deployments",
  bagsy: "Composing hype post for m/bagsworld",
  chadghost: "Moderating m/pokecenter feed",
  bnn: "Scanning for breaking news",
};

// ============================================================================
// Helpers
// ============================================================================

function getAgentOnlineStatus(
  agentId: string,
  railwayAgents: AgentStatus[] | undefined
): AgentStatus | undefined {
  if (!railwayAgents) return undefined;
  return railwayAgents.find((a) => a.agentId === agentId || a.agentId === agentId.replace("-", ""));
}

function getStatusInfo(status: "online" | "busy" | "offline") {
  if (status === "online") return { color: "#4ade80", label: "ONLINE", glow: true };
  if (status === "busy") return { color: "#fbbf24", label: "BUSY", glow: true };
  return { color: "#4b5563", label: "OFFLINE", glow: false };
}

function formatLastSeen(ts: number): string {
  if (!ts) return "Unknown";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function getDefaultCapabilities(agentId: string): string[] {
  return AGENT_CAPABILITIES[agentId] ?? ["Chat"];
}

function getAgentTask(agentId: string, railwayStatus?: AgentStatus): string {
  if (railwayStatus?.currentTask) return railwayStatus.currentTask;
  return AGENT_ACTIVE_TASKS[agentId] ?? "Idle";
}

// ============================================================================
// Sub-components
// ============================================================================

function StatusDot({
  status,
  size = 12,
}: {
  status: "online" | "busy" | "offline";
  size?: number;
}) {
  const info = getStatusInfo(status);
  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: info.color,
        boxShadow: info.glow ? `0 0 8px ${info.color}` : "none",
      }}
    />
  );
}

// GameBoy-style agent entry (buttons removed, inline status added)
function AgentEntry({
  agent,
  index,
  railwayStatus,
  isSelected,
  onSelect,
}: {
  agent: AgentInfo;
  index: number;
  railwayStatus?: AgentStatus;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const accentColor = ZONE_COLORS[agent.zone] || "#4ade80";
  const status = railwayStatus?.status ?? "offline";
  const statusInfo = getStatusInfo(status);
  const task = getAgentTask(agent.id, railwayStatus);
  const caps = railwayStatus?.capabilities?.length
    ? railwayStatus.capabilities
    : getDefaultCapabilities(agent.id);

  return (
    <div
      onClick={onSelect}
      className="cursor-pointer transition-all duration-100"
      style={{
        background: isSelected ? `${accentColor}12` : "rgba(0, 0, 0, 0.4)",
        border: isSelected ? `3px solid ${accentColor}` : "3px solid #1e293b",
        boxShadow: isSelected
          ? `0 0 16px ${accentColor}33, inset 0 0 24px ${accentColor}08`
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
                background: statusInfo.color,
                border: "2px solid #000",
                boxShadow: statusInfo.glow ? `0 0 8px ${statusInfo.color}` : "none",
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

        {/* Zone + status tags */}
        <div className="flex flex-wrap gap-2 mb-3">
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
          <span
            className="inline-block font-pixel text-[10px] px-2 py-1"
            style={{
              background: `${statusInfo.color}15`,
              border: `2px solid ${statusInfo.color}80`,
              color: statusInfo.color,
            }}
          >
            {statusInfo.label}
          </span>
        </div>

        {/* Full bio */}
        <p className="font-pixel text-xs sm:text-[13px] text-gray-300 leading-relaxed mb-3">
          {agent.description}
        </p>

        {/* Live status: current task + capabilities */}
        <div
          className="p-2"
          style={{
            background: "rgba(0,0,0,0.3)",
            border: "2px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <StatusDot status={status} size={8} />
            <span className="font-pixel text-[9px] text-gray-300 truncate">{task}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {caps.slice(0, 4).map((cap) => (
              <span
                key={cap}
                className="font-pixel text-[7px] px-1.5 py-0.5"
                style={{
                  background: `${accentColor}10`,
                  border: `1px solid ${accentColor}30`,
                  color: `${accentColor}cc`,
                }}
              >
                {cap}
              </span>
            ))}
          </div>
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

// Agent Status Table (moved from dashboard)
function AgentStatusTable({ agents }: { agents: AgentStatus[] | undefined }) {
  const allAgents = AGENT_DATA;

  return (
    <div
      className="p-4 overflow-x-auto"
      style={{
        background: "rgba(34, 211, 238, 0.05)",
        border: "3px solid #0e7490",
        boxShadow: "inset 0 0 20px rgba(6, 182, 212, 0.06)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-pixel text-sm text-cyan-400">AGENT STATUS</span>
        <span className="font-pixel text-[10px] text-gray-500">
          {agents?.filter((a) => a.status === "online").length ?? 0}/{allAgents.length} ONLINE
        </span>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "2px solid rgba(34, 211, 238, 0.2)" }}>
              <th className="text-left font-pixel text-[9px] text-gray-500 pb-2 pr-3">AGENT</th>
              <th className="text-left font-pixel text-[9px] text-gray-500 pb-2 pr-3">STATUS</th>
              <th className="text-left font-pixel text-[9px] text-gray-500 pb-2 pr-3">ZONE</th>
              <th className="text-left font-pixel text-[9px] text-gray-500 pb-2 pr-3">TASK</th>
              <th className="text-left font-pixel text-[9px] text-gray-500 pb-2">LAST SEEN</th>
            </tr>
          </thead>
          <tbody>
            {allAgents.map((agent) => {
              const railway = getAgentOnlineStatus(agent.id, agents);
              const status = railway?.status ?? "offline";
              const info = getStatusInfo(status);
              const zoneColor = ZONE_COLORS[agent.zone] || "#6b7280";
              const task = getAgentTask(agent.id, railway);

              return (
                <tr key={agent.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 flex-shrink-0 flex items-center justify-center overflow-hidden"
                        style={{ border: `1px solid ${zoneColor}60` }}
                      >
                        <Image
                          src={agent.avatar}
                          alt=""
                          width={24}
                          height={24}
                          className="pixelated w-full h-full"
                        />
                      </div>
                      <span className="font-pixel text-[10px] text-gray-200">{agent.name}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-1.5">
                      <StatusDot status={status} size={8} />
                      <span className="font-pixel text-[9px]" style={{ color: info.color }}>
                        {info.label}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <span className="font-pixel text-[9px]" style={{ color: zoneColor }}>
                      {agent.zone}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <span className="font-pixel text-[9px] text-gray-400 truncate max-w-[200px] inline-block">
                      {task}
                    </span>
                  </td>
                  <td className="py-2">
                    <span className="font-pixel text-[9px] text-gray-500">
                      {railway ? formatLastSeen(railway.lastSeen) : "--"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {allAgents.map((agent) => {
          const railway = getAgentOnlineStatus(agent.id, agents);
          const status = railway?.status ?? "offline";
          const info = getStatusInfo(status);
          const zoneColor = ZONE_COLORS[agent.zone] || "#6b7280";
          const task = getAgentTask(agent.id, railway);

          return (
            <div
              key={agent.id}
              className="flex items-center gap-3 p-2"
              style={{
                background: "rgba(0,0,0,0.2)",
                border: "1px solid rgba(255,255,255,0.04)",
              }}
            >
              <div
                className="w-8 h-8 flex-shrink-0 flex items-center justify-center overflow-hidden"
                style={{ border: `2px solid ${zoneColor}60` }}
              >
                <Image
                  src={agent.avatar}
                  alt=""
                  width={32}
                  height={32}
                  className="pixelated w-full h-full"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-pixel text-[10px] text-gray-200">{agent.name}</span>
                  <StatusDot status={status} size={6} />
                  <span className="font-pixel text-[8px]" style={{ color: info.color }}>
                    {info.label}
                  </span>
                </div>
                <span className="font-pixel text-[8px] text-gray-500 truncate block">{task}</span>
              </div>
              <span className="font-pixel text-[8px]" style={{ color: zoneColor }}>
                {agent.zone}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Section header helper
function SectionHeader({ title, color = "#4ade80" }: { title: string; color?: string }) {
  return (
    <div className="flex items-center gap-3 mb-1">
      <h2
        className="font-pixel text-base sm:text-lg whitespace-nowrap"
        style={{ color, textShadow: `0 0 12px ${color}66` }}
      >
        {title}
      </h2>
      <div
        className="h-[3px] flex-1"
        style={{ background: `linear-gradient(90deg, ${color} 0%, transparent 100%)` }}
      />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function MeetTheAgents() {
  const { data: healthData } = useElizaHealth();
  const { data: agentStatusData } = useAgentStatuses();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const isConnected = healthData?.status === "healthy" || healthData?.status === "ok";
  const onlineCount = agentStatusData?.online || 0;
  const totalCount = agentStatusData?.count || BAGSWORLD_AGENTS.length;

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
        className="relative z-10"
        style={{
          background: "#0a0a1a",
          borderBottom: "4px solid #4ade80",
          boxShadow: "0 4px 24px rgba(74, 222, 128, 0.15), inset 0 -1px 0 rgba(74, 222, 128, 0.3)",
        }}
      >
        <div className="max-w-5xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
          {/* Left: Logo + Title */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div
              className="w-11 h-11 sm:w-14 sm:h-14 flex-shrink-0 flex items-center justify-center"
              style={{
                background: "#0c1a0c",
                border: "3px solid #4ade80",
                boxShadow:
                  "0 0 12px rgba(74, 222, 128, 0.3), inset 0 0 8px rgba(74, 222, 128, 0.1)",
              }}
            >
              <Image
                src="/agents/bagsy.png"
                alt="BagsWorld"
                width={56}
                height={56}
                className="pixelated w-full h-full"
              />
            </div>
            <div>
              <h1
                className="font-pixel text-lg sm:text-2xl leading-none"
                style={{
                  color: "#4ade80",
                  textShadow: "0 0 12px rgba(74, 222, 128, 0.4)",
                }}
              >
                BAGSWORLD
              </h1>
              <p className="font-pixel text-xs sm:text-sm text-gray-400 mt-0.5">THE CREW</p>
            </div>
          </div>

          {/* Right: Status + Nav */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Railway connection */}
            <div
              className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5"
              style={{
                background: "rgba(0,0,0,0.6)",
                border: `3px solid ${isConnected ? "#166534" : "#7f1d1d"}`,
              }}
            >
              <div
                className="w-3 h-3"
                style={{
                  background: isConnected ? "#4ade80" : "#ef4444",
                  boxShadow: isConnected ? "0 0 8px #4ade80" : "0 0 8px #ef4444",
                }}
              />
              <span className="font-pixel text-xs text-gray-300 hidden sm:inline">
                {isConnected ? "ONLINE" : "OFFLINE"}
              </span>
              <span className="font-pixel text-xs text-gray-500">
                {onlineCount}/{totalCount}
              </span>
            </div>

            {/* Back to world */}
            <Link
              href="/"
              className="font-pixel text-xs sm:text-sm px-3 sm:px-4 py-1.5 transition-all hover:brightness-125 active:translate-y-[1px]"
              style={{
                background: "linear-gradient(180deg, #166534 0%, #14532d 100%)",
                border: "3px solid #4ade80",
                color: "#4ade80",
                boxShadow: "0 3px 0 #0a3622",
              }}
            >
              <span className="hidden sm:inline">ENTER WORLD</span>
              <span className="sm:hidden">WORLD</span>
            </Link>
          </div>
        </div>
      </header>

      {/* === MAIN CONTENT === */}
      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-5 sm:py-8 relative z-10">
        {/* Status panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <GhostStatusPanel />
          <TasksPanel />
        </div>

        {/* Agent Status Table */}
        <div className="mb-8">
          <AgentStatusTable agents={agentStatusData?.agents} />
        </div>

        {/* === BAGSWORLD CREW === */}
        <div className="mb-5">
          <SectionHeader title="BAGSWORLD CREW" color="#4ade80" />
          <p className="font-pixel text-xs text-gray-500 mb-4">
            {BAGSWORLD_AGENTS.length} IN-GAME AI CHARACTERS
          </p>
        </div>

        {/* Agent grid - 2 columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-10">
          {BAGSWORLD_AGENTS.map((agent, i) => {
            const railway = getAgentOnlineStatus(agent.id, agentStatusData?.agents);
            return (
              <AgentEntry
                key={agent.id}
                agent={agent}
                index={i}
                railwayStatus={railway}
                isSelected={selectedId === agent.id}
                onSelect={() => setSelectedId(selectedId === agent.id ? null : agent.id)}
              />
            );
          })}
        </div>

        {/* === MOLTBOOK AGENTS === */}
        <div className="mb-5">
          <SectionHeader title="MOLTBOOK AGENTS" color="#ef4444" />
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

                {/* Tags: zone + moltbook username */}
                <div className="flex flex-wrap gap-2 mb-3">
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
                  {agent.moltbook && (
                    <a
                      href={`https://moltbook.com/u/${agent.moltbook}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block font-pixel text-[10px] px-2 py-1 hover:brightness-125 transition-all"
                      style={{
                        background: "rgba(251, 146, 60, 0.1)",
                        border: "2px solid #f97316",
                        color: "#fb923c",
                      }}
                    >
                      @{agent.moltbook.toUpperCase()}
                    </a>
                  )}
                </div>

                <p className="font-pixel text-xs sm:text-[13px] text-gray-300 leading-relaxed mb-4">
                  {agent.description}
                </p>

                {/* External links */}
                <div className="flex gap-3">
                  <a
                    href={`https://moltbook.com/u/${agent.moltbook || agent.name}`}
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
                    MOLTBOOK
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
