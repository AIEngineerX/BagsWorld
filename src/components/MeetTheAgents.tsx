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
import { ZONES, type ZoneType } from "@/lib/types";

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

// Pixel art corner decoration (reused from Casino style)
function PixelCorner({
  position,
  color = "#4ade80",
}: {
  position: "tl" | "tr" | "bl" | "br";
  color?: string;
}) {
  const pos = {
    tl: { top: -2, left: -2 },
    tr: { top: -2, right: -2 },
    bl: { bottom: -2, left: -2 },
    br: { bottom: -2, right: -2 },
  }[position];

  return (
    <svg width="8" height="8" viewBox="0 0 8 8" className="absolute" style={pos}>
      <rect x="0" y="0" width="8" height="2" fill={color} />
      <rect x="0" y="0" width="2" height="8" fill={color} />
      <rect x="2" y="2" width="2" height="2" fill={color} opacity="0.5" />
    </svg>
  );
}

// Agent character card - game style
function AgentCard({
  agent,
  status,
  onVisit,
  onTalk,
}: {
  agent: AgentInfo;
  status: "online" | "busy" | "offline";
  onVisit: () => void;
  onTalk: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  const statusColors = {
    online: "#4ade80",
    busy: "#fbbf24",
    offline: "#6b7280",
  };

  const zoneColors: Record<string, string> = {
    Park: "#4ade80",
    BagsCity: "#fbbf24",
    HQ: "#22c55e",
    "Founder's Corner": "#f59e0b",
    All: "#8b5cf6",
  };

  const borderColor = isHovered ? "#4ade80" : "#374151";
  const bgColor = isHovered ? "rgba(74, 222, 128, 0.1)" : "rgba(0, 0, 0, 0.6)";

  return (
    <div
      className="relative cursor-pointer transition-all duration-150"
      style={{
        background: bgColor,
        border: `2px solid ${borderColor}`,
        boxShadow: isHovered
          ? "0 0 20px rgba(74, 222, 128, 0.3), inset 0 0 30px rgba(74, 222, 128, 0.05)"
          : "inset 0 0 20px rgba(0, 0, 0, 0.5)",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onVisit}
    >
      <PixelCorner position="tl" color={borderColor} />
      <PixelCorner position="tr" color={borderColor} />
      <PixelCorner position="bl" color={borderColor} />
      <PixelCorner position="br" color={borderColor} />

      <div className="p-3">
        {/* Header: Avatar + Name */}
        <div className="flex items-center gap-3 mb-2">
          {/* Avatar frame */}
          <div
            className="relative w-12 h-12 flex-shrink-0"
            style={{
              background: "#1a1a2e",
              border: `2px solid ${zoneColors[agent.zone] || "#4ade80"}`,
              boxShadow: `inset 0 0 10px rgba(0,0,0,0.8)`,
            }}
          >
            <Image
              src={agent.avatar}
              alt={agent.name}
              width={48}
              height={48}
              className="pixelated"
              onError={(e) => {
                // Fallback to a colored square if image fails
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            {/* Status indicator */}
            <div
              className="absolute -bottom-1 -right-1 w-3 h-3"
              style={{
                background: statusColors[status],
                border: "1px solid #000",
                boxShadow: status === "online" ? `0 0 6px ${statusColors[status]}` : "none",
              }}
            />
          </div>

          {/* Name + Role */}
          <div className="flex-1 min-w-0">
            <h3
              className="font-pixel text-[11px] truncate"
              style={{ color: zoneColors[agent.zone] || "#4ade80" }}
            >
              {agent.name.toUpperCase()}
            </h3>
            <p className="font-pixel text-[8px] text-gray-400 truncate">{agent.role}</p>
          </div>
        </div>

        {/* Zone tag */}
        <div
          className="inline-block px-2 py-0.5 mb-2"
          style={{
            background: "rgba(0,0,0,0.5)",
            border: `1px solid ${zoneColors[agent.zone] || "#4ade80"}`,
          }}
        >
          <span
            className="font-pixel text-[7px]"
            style={{ color: zoneColors[agent.zone] || "#4ade80" }}
          >
            {agent.zone.toUpperCase()}
          </span>
        </div>

        {/* Description */}
        <p className="font-pixel text-[7px] text-gray-300 line-clamp-2 mb-3 leading-relaxed">
          {agent.description}
        </p>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onVisit();
            }}
            className="flex-1 font-pixel text-[8px] py-1.5 transition-all"
            style={{
              background: "linear-gradient(180deg, #166534 0%, #14532d 100%)",
              border: "2px solid #4ade80",
              color: "#4ade80",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 0 #0a3622",
            }}
          >
            FIND
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTalk();
            }}
            className="flex-1 font-pixel text-[8px] py-1.5 transition-all"
            style={{
              background: "linear-gradient(180deg, #374151 0%, #1f2937 100%)",
              border: "2px solid #6b7280",
              color: "#9ca3af",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 0 #111827",
            }}
          >
            TALK
          </button>
        </div>

        {/* Twitter handle if exists */}
        {agent.twitter && (
          <a
            href={`https://x.com/${agent.twitter.replace("@", "")}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="block mt-2 font-pixel text-[7px] text-gray-500 hover:text-blue-400 transition-colors"
          >
            {agent.twitter}
          </a>
        )}
      </div>
    </div>
  );
}

// Ghost status mini panel
function GhostStatusMini() {
  const { data: ghostStatus, isLoading } = useGhostStatus();

  if (isLoading || !ghostStatus) {
    return (
      <div
        className="p-3"
        style={{
          background: "rgba(139, 92, 246, 0.1)",
          border: "2px solid #8b5cf6",
        }}
      >
        <div className="font-pixel text-[9px] text-violet-400 mb-2">GHOST TRADING</div>
        <div className="font-pixel text-[8px] text-gray-500">Loading...</div>
      </div>
    );
  }

  const { trading, performance } = ghostStatus;

  return (
    <div
      className="p-3 relative"
      style={{
        background: "rgba(139, 92, 246, 0.1)",
        border: "2px solid #8b5cf6",
        boxShadow: "inset 0 0 20px rgba(139, 92, 246, 0.1)",
      }}
    >
      <PixelCorner position="tl" color="#8b5cf6" />
      <PixelCorner position="tr" color="#8b5cf6" />
      <PixelCorner position="bl" color="#8b5cf6" />
      <PixelCorner position="br" color="#8b5cf6" />

      <div className="flex items-center justify-between mb-2">
        <span className="font-pixel text-[9px] text-violet-400">GHOST TRADING</span>
        <div className="flex items-center gap-1">
          <div
            className="w-2 h-2"
            style={{
              background: trading.enabled ? "#4ade80" : "#ef4444",
              boxShadow: trading.enabled ? "0 0 6px #4ade80" : "none",
            }}
          />
          <span className="font-pixel text-[7px] text-gray-400">
            {trading.enabled ? "ACTIVE" : "OFF"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="font-pixel text-[7px] text-gray-500">WIN RATE</div>
          <div className="font-pixel text-[10px] text-white">{performance.winRate}</div>
        </div>
        <div>
          <div className="font-pixel text-[7px] text-gray-500">PNL</div>
          <div
            className="font-pixel text-[10px]"
            style={{ color: performance.totalPnlSol >= 0 ? "#4ade80" : "#ef4444" }}
          >
            {performance.totalPnlSol >= 0 ? "+" : ""}
            {performance.totalPnlSol.toFixed(3)} SOL
          </div>
        </div>
        <div>
          <div className="font-pixel text-[7px] text-gray-500">POSITIONS</div>
          <div className="font-pixel text-[10px] text-white">{trading.openPositions}</div>
        </div>
        <div>
          <div className="font-pixel text-[7px] text-gray-500">EXPOSURE</div>
          <div className="font-pixel text-[10px] text-white">
            {trading.totalExposureSol.toFixed(2)} SOL
          </div>
        </div>
      </div>
    </div>
  );
}

// Tasks mini panel
function TasksMini() {
  const { data: tasksData, isLoading } = useAutonomousTasks();

  const activeTasks = tasksData?.tasks?.filter((t) => t.enabled).slice(0, 4) || [];

  return (
    <div
      className="p-3 relative"
      style={{
        background: "rgba(6, 182, 212, 0.1)",
        border: "2px solid #06b6d4",
        boxShadow: "inset 0 0 20px rgba(6, 182, 212, 0.1)",
      }}
    >
      <PixelCorner position="tl" color="#06b6d4" />
      <PixelCorner position="tr" color="#06b6d4" />
      <PixelCorner position="bl" color="#06b6d4" />
      <PixelCorner position="br" color="#06b6d4" />

      <div className="font-pixel text-[9px] text-cyan-400 mb-2">ACTIVE TASKS</div>

      {isLoading ? (
        <div className="font-pixel text-[8px] text-gray-500">Loading...</div>
      ) : activeTasks.length === 0 ? (
        <div className="font-pixel text-[8px] text-gray-500">No active tasks</div>
      ) : (
        <div className="space-y-1">
          {activeTasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between">
              <span className="font-pixel text-[7px] text-gray-300 truncate max-w-[100px]">
                {task.name}
              </span>
              <div
                className="w-1.5 h-1.5"
                style={{ background: "#4ade80", boxShadow: "0 0 4px #4ade80" }}
              />
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
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null);

  const isConnected = healthData?.status === "healthy" || healthData?.status === "ok";
  const onlineCount = agentStatusData?.online || 0;
  const totalCount = agentStatusData?.count || BAGSWORLD_AGENTS.length;

  const handleVisit = (agent: AgentInfo) => {
    const zoneId = ZONE_MAP[agent.zone];
    if (zoneId) {
      // Navigate to main page and trigger zone change
      router.push(`/?zone=${zoneId}`);
    } else {
      router.push("/");
    }
  };

  const handleTalk = (agent: AgentInfo) => {
    // Navigate to main page and open chat with this agent
    router.push(`/?chat=${agent.id}`);
  };

  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(180deg, #0a0a0f 0%, #1a1a2e 50%, #0a0a0f 100%)",
      }}
    >
      {/* Scanline overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-40"
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 1px, transparent 1px, transparent 2px)",
        }}
      />

      {/* Header */}
      <header
        className="relative z-10 border-b-2"
        style={{
          background: "rgba(0, 0, 0, 0.8)",
          borderColor: "#166534",
          boxShadow: "0 4px 20px rgba(74, 222, 128, 0.2)",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 flex items-center justify-center font-pixel text-lg"
              style={{
                background: "#4ade80",
                color: "#0a0a0f",
                boxShadow: "4px 4px 0 #166534, inset -2px -2px 0 rgba(0,0,0,0.2)",
              }}
            >
              A
            </div>
            <div>
              <h1 className="font-pixel text-sm" style={{ color: "#4ade80" }}>
                AGENTS
              </h1>
              <p className="font-pixel text-[7px] text-gray-500">SELECT CHARACTER</p>
            </div>
          </div>

          {/* Status + Back */}
          <div className="flex items-center gap-4">
            <div
              className="flex items-center gap-2 px-3 py-1"
              style={{
                background: "rgba(0,0,0,0.5)",
                border: `1px solid ${isConnected ? "#4ade80" : "#ef4444"}`,
              }}
            >
              <div
                className="w-2 h-2"
                style={{
                  background: isConnected ? "#4ade80" : "#ef4444",
                  boxShadow: isConnected ? "0 0 8px #4ade80" : "none",
                  animation: isConnected ? "pulse 2s infinite" : "none",
                }}
              />
              <span className="font-pixel text-[8px] text-gray-300">
                {onlineCount}/{totalCount}
              </span>
            </div>

            <a
              href="/"
              className="font-pixel text-[9px] px-3 py-1 transition-colors"
              style={{
                background: "rgba(0,0,0,0.5)",
                border: "1px solid #374151",
                color: "#6b7280",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#4ade80";
                e.currentTarget.style.color = "#4ade80";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#374151";
                e.currentTarget.style.color = "#6b7280";
              }}
            >
              BACK
            </a>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-6 relative z-10">
        {/* Stats row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <GhostStatusMini />
          <TasksMini />
        </div>

        {/* Section header */}
        <div className="mb-4 flex items-center gap-2">
          <div
            className="h-px flex-1"
            style={{ background: "linear-gradient(90deg, #4ade80, transparent)" }}
          />
          <span className="font-pixel text-[10px] text-gray-500">BAGSWORLD CREW</span>
          <div
            className="h-px flex-1"
            style={{ background: "linear-gradient(90deg, transparent, #4ade80)" }}
          />
        </div>

        {/* Agent grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
          {BAGSWORLD_AGENTS.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              status={getAgentOnlineStatus(agent.id, agentStatusData?.agents)}
              onVisit={() => handleVisit(agent)}
              onTalk={() => handleTalk(agent)}
            />
          ))}
        </div>

        {/* Moltbook section */}
        <div className="mb-4 flex items-center gap-2">
          <div
            className="h-px flex-1"
            style={{ background: "linear-gradient(90deg, #ef4444, transparent)" }}
          />
          <span className="font-pixel text-[10px] text-gray-500">MOLTBOOK AGENTS</span>
          <div
            className="h-px flex-1"
            style={{ background: "linear-gradient(90deg, transparent, #ef4444)" }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {MOLTBOOK_AGENTS.map((agent) => (
            <div
              key={agent.id}
              className="relative p-4"
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "2px solid #dc2626",
                boxShadow: "inset 0 0 20px rgba(239, 68, 68, 0.1)",
              }}
            >
              <PixelCorner position="tl" color="#dc2626" />
              <PixelCorner position="tr" color="#dc2626" />
              <PixelCorner position="bl" color="#dc2626" />
              <PixelCorner position="br" color="#dc2626" />

              <div className="flex items-start gap-4">
                <div
                  className="w-14 h-14 flex-shrink-0"
                  style={{
                    background: "#1a0a0a",
                    border: "2px solid #dc2626",
                  }}
                >
                  <Image
                    src={agent.avatar}
                    alt={agent.name}
                    width={56}
                    height={56}
                    className="pixelated"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-pixel text-[12px] text-red-400">
                    {agent.name.toUpperCase()}
                  </h3>
                  <p className="font-pixel text-[8px] text-gray-400 mb-1">{agent.role}</p>
                  <p className="font-pixel text-[7px] text-gray-300 mb-3">{agent.description}</p>
                  <a
                    href={`https://moltbook.com/u/${agent.name}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block font-pixel text-[8px] px-3 py-1 transition-all"
                    style={{
                      background: "linear-gradient(180deg, #991b1b 0%, #7f1d1d 100%)",
                      border: "2px solid #dc2626",
                      color: "#fca5a5",
                      boxShadow: "0 2px 0 #450a0a",
                    }}
                  >
                    VIEW PROFILE
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer
        className="relative z-10 border-t mt-8 py-4"
        style={{
          background: "rgba(0, 0, 0, 0.8)",
          borderColor: "#1f2937",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="font-pixel text-[7px] text-gray-600">
            BAGSWORLD AGENTS | POWERED BY RAILWAY
          </p>
        </div>
      </footer>

      {/* CSS for pulse animation */}
      <style jsx>{`
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}

export default MeetTheAgents;
