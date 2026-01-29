"use client";

import { useState, useCallback } from "react";
import { AgentList } from "./AgentList";
import { GhostTradingPanel } from "./GhostTradingPanel";
import { AutonomousTasksPanel } from "./AutonomousTasksPanel";
import { TwitterPanel } from "./TwitterPanel";
import { AlertsPanel } from "./AlertsPanel";
import { SharedContextPanel } from "./SharedContextPanel";
import { useElizaHealth } from "@/hooks/useElizaAgents";

type SubTab = "agents" | "trading" | "tasks" | "twitter" | "alerts" | "context";

interface AgentDashboardProps {
  addLog?: (message: string, type?: "info" | "success" | "error") => void;
}

export function AgentDashboard({ addLog }: AgentDashboardProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("agents");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const { data: health, isLoading: healthLoading, error: healthError } = useElizaHealth();

  const logMessage = useCallback(
    (message: string, type: "info" | "success" | "error" = "info") => {
      addLog?.(`[AGENTS] ${message}`, type);
    },
    [addLog]
  );

  const subTabs: { id: SubTab; label: string; highlight?: boolean }[] = [
    { id: "agents", label: "Agents" },
    { id: "trading", label: "Trading", highlight: true },
    { id: "tasks", label: "Tasks" },
    { id: "twitter", label: "Twitter" },
    { id: "alerts", label: "Alerts" },
    { id: "context", label: "Context" },
  ];

  // Server connection status (backend returns "healthy" or "degraded" or "unhealthy")
  const isConnected = health?.status === "healthy" || health?.status === "degraded";
  const connectionError = healthError instanceof Error ? healthError.message : null;

  return (
    <div className="space-y-4">
      {/* Connection Status Banner */}
      {!healthLoading && (
        <div
          className={`p-2 border ${
            isConnected ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-400" : "bg-red-400"}`}
              />
              <span
                className={`font-pixel text-[9px] ${
                  isConnected ? "text-green-400" : "text-red-400"
                }`}
              >
                {isConnected ? "Connected to eliza-agents" : "Cannot connect to eliza-agents"}
              </span>
            </div>
            {isConnected && health?.agents && (
              <span className="font-pixel text-[8px] text-gray-400">
                {health.agents} agents | {health.llm?.provider || "No LLM"}
              </span>
            )}
            {!isConnected && connectionError && (
              <span className="font-pixel text-[7px] text-gray-500">{connectionError}</span>
            )}
          </div>
          {!isConnected && (
            <p className="font-pixel text-[7px] text-gray-400 mt-1">
              Make sure eliza-agents server is running at{" "}
              {process.env.NEXT_PUBLIC_ELIZA_API_URL || "http://localhost:3001"}
            </p>
          )}
        </div>
      )}

      {/* Sub-Tabs */}
      <div className="flex border-b border-gray-700 overflow-x-auto">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex-shrink-0 px-3 py-1.5 font-pixel text-[8px] transition-colors relative ${
              activeSubTab === tab.id
                ? "text-bags-green border-b-2 border-bags-green bg-green-500/10"
                : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50"
            }`}
          >
            {tab.label.toUpperCase()}
            {tab.highlight && (
              <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-yellow-400 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {activeSubTab === "agents" && (
          <AgentList onSelectAgent={setSelectedAgentId} selectedAgentId={selectedAgentId} />
        )}

        {activeSubTab === "trading" && <GhostTradingPanel addLog={logMessage} />}

        {activeSubTab === "tasks" && <AutonomousTasksPanel addLog={logMessage} />}

        {activeSubTab === "twitter" && <TwitterPanel addLog={logMessage} />}

        {activeSubTab === "alerts" && <AlertsPanel addLog={logMessage} />}

        {activeSubTab === "context" && <SharedContextPanel addLog={logMessage} />}
      </div>
    </div>
  );
}

export default AgentDashboard;
