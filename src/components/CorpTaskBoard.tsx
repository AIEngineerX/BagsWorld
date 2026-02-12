"use client";

import { useState, useEffect, useCallback } from "react";
import { BAGSWORLD_AGENTS } from "@/lib/agent-data";

// ============================================================================
// Corp Task Board — fetches real delegation data from /api/agent-economy/external
// Uses the same ROLE_TASK_PREFERENCES + generateServiceTask logic as the economy loop
// ============================================================================

interface CorpBoardTask {
  title: string;
  description: string;
  posterAgentId: string;
  posterRole: string;
  workerAgentId: string;
  workerRole: string;
  capability: string;
  category: string;
  rewardSol: number;
  status: "open" | "claimed" | "delivered" | "completed";
}

interface CorpTaskBoardProps {
  selectedAgent: string | null;
  onSelectAgent: (name: string | null) => void;
}

/** Map agentId → display name from BAGSWORLD_AGENTS */
function agentName(agentId: string): string {
  const agent = BAGSWORLD_AGENTS.find((a) => a.id === agentId);
  return agent?.name || agentId.charAt(0).toUpperCase() + agentId.slice(1);
}

/** Map agentId → display name, case-insensitive match */
function findAgentIdByName(name: string): string | null {
  const lower = name.toLowerCase();
  const agent = BAGSWORLD_AGENTS.find((a) => a.name.toLowerCase() === lower || a.id === lower);
  return agent?.id || null;
}

const STATUS_LABELS: Record<string, { label: string; color: string; dot: string }> = {
  open: { label: "OPEN", color: "text-yellow-400", dot: "bg-yellow-400 animate-pulse shadow-[0_0_6px_rgba(250,204,21,0.4)]" },
  claimed: { label: "IN PROGRESS", color: "text-blue-400", dot: "bg-blue-400 animate-pulse shadow-[0_0_6px_rgba(96,165,250,0.4)]" },
  delivered: { label: "REVIEW", color: "text-orange-400", dot: "bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.3)]" },
  completed: { label: "DONE", color: "text-green-600/60", dot: "bg-green-600/60" },
};

export function CorpTaskBoard({ selectedAgent, onSelectAgent }: CorpTaskBoardProps) {
  const [tasks, setTasks] = useState<CorpBoardTask[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [corpStats, setCorpStats] = useState<{ totalTasksCompleted: number; treasurySol: number } | null>(null);

  const fetchCorpTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/agent-economy/external?action=corp-tasks");
      const data = await res.json();

      if (data.success && data.tasks?.length > 0) {
        setTasks(data.tasks);
        setIsLive(true);
        if (data.stats) {
          setCorpStats(data.stats);
        }
      }
    } catch {
      // API unavailable — tasks stay empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCorpTasks();
  }, [fetchCorpTasks]);

  // Resolve selected agent name to agentId for filtering
  const selectedId = selectedAgent ? findAgentIdByName(selectedAgent) : null;

  // Filter tasks when agent selected — poster OR worker
  const visibleTasks = selectedId
    ? tasks.filter((t) => t.posterAgentId === selectedId || t.workerAgentId === selectedId)
    : tasks;

  const openCount = tasks.filter((t) => t.status === "open" || t.status === "claimed").length;

  if (loading) {
    return (
      <div className="border-t border-green-600/30 pt-3 mt-3">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-sm font-bold text-green-300 font-mono">A2A TASK BOARD</h3>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-green-500/10 text-green-500/50 border border-green-500/15">
            LOADING
          </span>
        </div>
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 border-2 border-green-500/30 border-t-green-400 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-green-600/30 pt-3 mt-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-bold text-green-300 font-mono">A2A TASK BOARD</h3>
        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
          isLive
            ? "bg-green-500/20 text-green-400 border border-green-500/30"
            : "bg-yellow-500/15 text-yellow-500/70 border border-yellow-500/20"
        }`}>
          {isLive ? "LIVE" : "OFFLINE"}
        </span>
        <div className="flex-1 h-px bg-green-700/30" />
        {selectedAgent ? (
          <button onClick={() => onSelectAgent(null)}
            className="text-[10px] text-green-400 font-mono hover:text-green-200 transition-colors">
            {selectedAgent} {"\u2715"}
          </button>
        ) : (
          <span className="text-[10px] font-mono">
            <span className="text-yellow-400">{openCount}</span>
            <span className="text-green-500/50"> active</span>
          </span>
        )}
      </div>

      {/* Corp stats (from DB) */}
      {corpStats && corpStats.totalTasksCompleted > 0 && (
        <div className="flex gap-3 mb-2 text-[10px] font-mono text-green-500/50">
          <span>{corpStats.totalTasksCompleted} completed all-time</span>
          <span>{corpStats.treasurySol.toFixed(3)} SOL treasury</span>
        </div>
      )}

      {/* Task list */}
      <div className="max-h-44 overflow-y-auto corp-scroll space-y-1">
        {visibleTasks.length === 0 ? (
          <p className="text-xs text-green-500/40 font-mono text-center py-3">
            {selectedAgent ? `No tasks for ${selectedAgent}` : "No tasks available"}
          </p>
        ) : (
          visibleTasks.map((task, i) => {
            const posterName = agentName(task.posterAgentId);
            const workerName = agentName(task.workerAgentId);
            const statusInfo = STATUS_LABELS[task.status] || STATUS_LABELS.open;
            const isHighlighted = selectedId && (task.posterAgentId === selectedId || task.workerAgentId === selectedId);
            const isDone = task.status === "completed";

            return (
              <div key={i}
                className={`flex items-center justify-between rounded px-3 py-2 transition-all duration-200 ${
                  isHighlighted
                    ? "bg-green-900/40 border border-green-500/30"
                    : "bg-green-950/20 border border-transparent hover:bg-green-950/30"
                }`}
                title={`${task.description}\n\nCapability: ${task.capability}\nCategory: ${task.category}\nReward: ${task.rewardSol} SOL`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusInfo.dot}`} />
                  <span className={`text-sm truncate ${isDone ? "text-green-300/50" : "text-green-200"}`}>
                    {task.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                  <span className={`text-[10px] font-mono whitespace-nowrap ${isDone ? "text-green-600/40" : "text-green-400/70"}`}>
                    <span className={selectedId === task.posterAgentId ? "text-green-300" : ""}>{posterName}</span>
                    <span className="text-green-700/50 mx-0.5">{"\u2192"}</span>
                    <span className={selectedId === task.workerAgentId ? "text-green-300" : ""}>{workerName}</span>
                  </span>
                  {!isDone && (
                    <span className={`text-[8px] font-mono px-1 py-0.5 rounded ${statusInfo.color} bg-current/10`}>
                      {statusInfo.label}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
