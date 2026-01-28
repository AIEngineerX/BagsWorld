"use client";

import { useAgentStatuses, type AgentStatus } from "@/hooks/useElizaAgents";

// Agent zone mapping for display
const AGENT_ZONES: Record<string, string> = {
  toly: "Park",
  ash: "Park",
  finn: "Park",
  shaw: "Park",
  ghost: "Park",
  "bags-bot": "All",
  neo: "BagsCity",
  cj: "BagsCity",
  ramo: "HQ",
  sincara: "HQ",
  stuu: "HQ",
  sam: "HQ",
  alaa: "HQ",
  carlo: "HQ",
  bnn: "HQ",
  "professor-oak": "Founder's Corner",
};

// Agent display names
const AGENT_NAMES: Record<string, string> = {
  toly: "Toly",
  ash: "Ash",
  finn: "Finn",
  finnbags: "Finn",
  shaw: "Shaw",
  ghost: "Ghost",
  "bags-bot": "Bags Bot",
  neo: "Neo",
  cj: "CJ",
  ramo: "Ramo",
  sincara: "Sincara",
  stuu: "Stuu",
  sam: "Sam",
  alaa: "Alaa",
  carlo: "Carlo",
  bnn: "BNN",
  "professor-oak": "Prof. Oak",
  oak: "Prof. Oak",
};

interface AgentListProps {
  onSelectAgent?: (agentId: string) => void;
  selectedAgentId?: string | null;
}

export function AgentList({ onSelectAgent, selectedAgentId }: AgentListProps) {
  const { data, isLoading, error, refetch } = useAgentStatuses();

  const getStatusColor = (status: AgentStatus["status"]) => {
    switch (status) {
      case "online":
        return "bg-green-400";
      case "busy":
        return "bg-yellow-400";
      case "offline":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = (status: AgentStatus["status"]) => {
    switch (status) {
      case "online":
        return "text-green-400";
      case "busy":
        return "text-yellow-400";
      case "offline":
        return "text-gray-500";
      default:
        return "text-gray-500";
    }
  };

  const formatLastSeen = (timestamp: number) => {
    if (!timestamp) return "Never";
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <p className="font-pixel text-[10px] text-gray-400">AGENT STATUS</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[...Array(16)].map((_, i) => (
            <div
              key={i}
              className="bg-bags-darker p-2 border border-gray-700 animate-pulse"
            >
              <div className="h-4 bg-gray-700 rounded mb-2" />
              <div className="h-3 bg-gray-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 p-3">
        <p className="font-pixel text-[9px] text-red-400">
          Failed to load agent statuses
        </p>
        <p className="font-pixel text-[8px] text-gray-500 mt-1">
          {error instanceof Error ? error.message : "Connection error"}
        </p>
        <button
          onClick={() => refetch()}
          className="font-pixel text-[8px] text-red-400 hover:text-red-300 mt-2"
        >
          [RETRY]
        </button>
      </div>
    );
  }

  const agents = data?.agents || [];

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <p className="font-pixel text-[10px] text-gray-400">
          AGENT STATUS ({data?.online || 0}/{data?.count || 0} online)
        </p>
        <button
          onClick={() => refetch()}
          className="font-pixel text-[8px] text-gray-500 hover:text-gray-300"
        >
          [REFRESH]
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {agents.map((agent) => {
          const displayName =
            AGENT_NAMES[agent.agentId] || agent.agentId;
          const zone = AGENT_ZONES[agent.agentId] || "Unknown";
          const isSelected = selectedAgentId === agent.agentId;

          return (
            <button
              key={agent.agentId}
              onClick={() => onSelectAgent?.(agent.agentId)}
              className={`bg-bags-darker p-2 border text-left transition-colors ${
                isSelected
                  ? "border-bags-green bg-green-500/10"
                  : "border-gray-700 hover:border-gray-500"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`w-2 h-2 rounded-full ${getStatusColor(agent.status)}`}
                />
                <span className="font-pixel text-[10px] text-white truncate">
                  {displayName}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-pixel text-[7px] text-gray-500">
                  {zone}
                </span>
                <span
                  className={`font-pixel text-[7px] ${getStatusText(agent.status)}`}
                >
                  {agent.status.toUpperCase()}
                </span>
              </div>
              {agent.currentTask && (
                <p className="font-pixel text-[7px] text-yellow-400 mt-1 truncate">
                  {agent.currentTask}
                </p>
              )}
              <p className="font-pixel text-[6px] text-gray-600 mt-0.5">
                {formatLastSeen(agent.lastSeen)}
              </p>
            </button>
          );
        })}
      </div>

      {agents.length === 0 && (
        <div className="text-center py-4">
          <p className="font-pixel text-[9px] text-gray-500">
            No agents registered
          </p>
          <p className="font-pixel text-[8px] text-gray-600 mt-1">
            Make sure eliza-agents server is running
          </p>
        </div>
      )}
    </div>
  );
}

export default AgentList;
