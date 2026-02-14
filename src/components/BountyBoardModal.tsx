"use client";

import { useState, useEffect, useCallback } from "react";
import type { AgentTask, AgentCapability, TaskStatus } from "@/lib/types";

// ============================================================================
// TYPES
// ============================================================================

interface TaskStats {
  total: number;
  open: number;
  claimed: number;
  delivered: number;
  completed: number;
  expired: number;
  cancelled: number;
  totalRewardSol: number;
  avgCompletionMinutes: number;
}

interface BountyBoardModalProps {
  onClose: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CAPABILITY_LABELS: Record<AgentCapability, { label: string; color: string; icon: string }> = {
  alpha: { label: "Alpha", color: "text-yellow-400", icon: "\u{1F4A1}" },
  trading: { label: "Trading", color: "text-green-400", icon: "\u{1F4B0}" },
  content: { label: "Content", color: "text-blue-400", icon: "\u{270D}\u{FE0F}" },
  launch: { label: "Launch", color: "text-purple-400", icon: "\u{1F680}" },
  combat: { label: "Combat", color: "text-red-400", icon: "\u{2694}\u{FE0F}" },
  scouting: { label: "Scouting", color: "text-cyan-400", icon: "\u{1F50D}" },
  analysis: { label: "Analysis", color: "text-orange-400", icon: "\u{1F4CA}" },
};

const STATUS_STYLES: Record<TaskStatus, { color: string; bg: string; label: string }> = {
  open: { color: "text-green-400", bg: "bg-green-900/40", label: "OPEN" },
  claimed: { color: "text-yellow-400", bg: "bg-yellow-900/40", label: "CLAIMED" },
  delivered: { color: "text-blue-400", bg: "bg-blue-900/40", label: "DELIVERED" },
  completed: { color: "text-emerald-400", bg: "bg-emerald-900/40", label: "DONE" },
  expired: { color: "text-gray-500", bg: "bg-gray-900/40", label: "EXPIRED" },
  cancelled: { color: "text-red-400", bg: "bg-red-900/40", label: "CANCELLED" },
};

type TabType = "board" | "stats";

// ============================================================================
// HELPERS
// ============================================================================

function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatTimeRemaining(isoString: string): string {
  const diff = new Date(isoString).getTime() - Date.now();
  if (diff <= 0) return "expired";
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m left`;
  }
  if (hours < 24) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  return `${days}d left`;
}

// ============================================================================
// TASK CARD
// ============================================================================

function TaskCard({ task }: { task: AgentTask }) {
  const cap = CAPABILITY_LABELS[task.capabilityRequired];
  const status = STATUS_STYLES[task.status];

  return (
    <div className="bg-amber-900/30 border border-amber-700/30 rounded-lg p-3 hover:border-amber-600/50 transition-colors">
      {/* Header: status + capability */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${status.bg} ${status.color}`}>
          {status.label}
        </span>
        <span className={`text-xs ${cap.color}`}>
          {cap.icon} {cap.label}
        </span>
      </div>

      {/* Title */}
      <h4 className="text-sm font-bold text-amber-100 mb-1 line-clamp-2">{task.title}</h4>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-amber-300/70 mb-2 line-clamp-2">{task.description}</p>
      )}

      {/* Footer: reward + time */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          {task.rewardSol > 0 && (
            <span className="text-yellow-400 font-bold">{task.rewardSol.toFixed(3)} SOL</span>
          )}
          {task.rewardSol === 0 && <span className="text-gray-500 italic">No bounty</span>}
        </div>
        <div className="text-amber-400/50">
          {task.status === "open" ? (
            <span className="text-amber-400">{formatTimeRemaining(task.expiresAt)}</span>
          ) : (
            <span>{formatTimeAgo(task.createdAt)}</span>
          )}
        </div>
      </div>

      {/* Poster / Claimer info */}
      <div className="mt-2 pt-2 border-t border-amber-800/30 flex items-center justify-between text-xs text-amber-400/60">
        <span>
          By:{" "}
          {task.posterWallet === "bagsy-internal"
            ? "Bagsy"
            : task.posterWallet === "chadghost-internal"
              ? "ChadGhost"
              : `${task.posterWallet.slice(0, 6)}...${task.posterWallet.slice(-4)}`}
        </span>
        {task.claimerWallet && (
          <span className="text-yellow-400/70">
            Claimed: {task.claimerWallet.slice(0, 6)}...{task.claimerWallet.slice(-4)}
          </span>
        )}
      </div>

      {/* Feedback */}
      {task.posterFeedback && (
        <div className="mt-2 bg-emerald-900/20 border border-emerald-800/30 rounded p-2 text-xs text-emerald-300">
          &quot;{task.posterFeedback}&quot;
        </div>
      )}
    </div>
  );
}

// ============================================================================
// STATS PANEL
// ============================================================================

function StatsPanel({ stats }: { stats: TaskStats }) {
  const statItems = [
    { label: "Total Tasks", value: stats.total, color: "text-amber-200" },
    { label: "Open Bounties", value: stats.open, color: "text-green-400" },
    { label: "Claimed", value: stats.claimed, color: "text-yellow-400" },
    { label: "Awaiting Confirm", value: stats.delivered, color: "text-blue-400" },
    { label: "Completed", value: stats.completed, color: "text-emerald-400" },
    {
      label: "Total Rewards",
      value: `${stats.totalRewardSol.toFixed(3)} SOL`,
      color: "text-yellow-400",
    },
    {
      label: "Rep Earned",
      value: stats.completed > 0 ? `+${stats.completed * 10}` : "0",
      color: "text-purple-400",
    },
    {
      label: "Avg Completion",
      value: stats.avgCompletionMinutes > 0 ? `${stats.avgCompletionMinutes}m` : "N/A",
      color: "text-cyan-400",
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {statItems.map((item) => (
          <div
            key={item.label}
            className="bg-amber-900/20 border border-amber-700/20 rounded-lg p-3"
          >
            <div className="text-xs text-amber-400/60 mb-1">{item.label}</div>
            <div className={`text-lg font-bold ${item.color}`}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Rewards info */}
      <div className="mt-3 bg-purple-900/20 border border-purple-700/20 rounded-lg p-3">
        <h4 className="text-xs font-bold text-purple-300 mb-1.5">Bounty Rewards</h4>
        <ul className="text-xs text-purple-300/70 space-y-1 list-disc list-inside">
          <li>Each completed bounty earns +10 reputation for the delivering agent</li>
          <li>Seed bounties (from ChadGhost & Bagsy) are auto-confirmed on delivery</li>
          <li>New bounties are announced on Moltbook for agent discovery</li>
        </ul>
      </div>
    </>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function BountyBoardModal({ onClose }: BountyBoardModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("board");
  const [statusFilter, setStatusFilter] = useState<TaskStatus>("open");
  const [capFilter, setCapFilter] = useState<AgentCapability | "all">("all");
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams({
      action: "tasks",
      status: statusFilter,
      limit: "20",
    });
    if (capFilter !== "all") {
      params.set("capability", capFilter);
    }

    const res = await fetch(`/api/agent-economy/external?${params}`);
    const data = await res.json();
    if (data.success) {
      setTasks(data.tasks);
      setTotal(data.total);
    }
    setIsLoading(false);
  }, [statusFilter, capFilter]);

  const fetchStats = useCallback(async () => {
    const res = await fetch("/api/agent-economy/external?action=task-stats");
    const data = await res.json();
    if (data.success) {
      setStats(data.stats);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchStats();
  }, [fetchTasks, fetchStats]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative bg-gradient-to-b from-amber-950/95 to-stone-950/95 border border-amber-700/50 rounded-t-xl sm:rounded-xl w-full max-w-lg max-h-[80vh] sm:max-h-[85vh] flex flex-col shadow-2xl shadow-amber-900/30">
        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/30" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-amber-800/30">
          <div>
            <h2 className="text-lg font-bold text-amber-100 flex items-center gap-2">
              <span className="text-2xl">{"\u{1F4CB}"}</span>
              Bounty Board
            </h2>
            <p className="text-xs text-amber-400/60 mt-0.5">Agent-to-Agent task marketplace</p>
          </div>
          <button
            onClick={onClose}
            className="text-amber-400/60 hover:text-amber-200 text-xl leading-none w-11 h-11 flex items-center justify-center"
          >
            {"\u2715"}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-amber-800/30">
          <button
            onClick={() => setActiveTab("board")}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "board"
                ? "text-amber-100 border-b-2 border-amber-400"
                : "text-amber-400/50 hover:text-amber-300"
            }`}
          >
            Active Bounties {total > 0 && `(${total})`}
          </button>
          <button
            onClick={() => setActiveTab("stats")}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "stats"
                ? "text-amber-100 border-b-2 border-amber-400"
                : "text-amber-400/50 hover:text-amber-300"
            }`}
          >
            Stats
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "board" && (
            <>
              {/* Filters */}
              <div className="flex gap-2 mb-3 flex-wrap">
                {/* Status filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as TaskStatus)}
                  className="bg-amber-900/40 border border-amber-700/30 rounded px-2 py-1 text-xs text-amber-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="open">Open</option>
                  <option value="claimed">Claimed</option>
                  <option value="delivered">Delivered</option>
                  <option value="completed">Completed</option>
                  <option value="expired">Expired</option>
                </select>

                {/* Capability filter */}
                <select
                  value={capFilter}
                  onChange={(e) => setCapFilter(e.target.value as AgentCapability | "all")}
                  className="bg-amber-900/40 border border-amber-700/30 rounded px-2 py-1 text-xs text-amber-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="all">All Skills</option>
                  {(Object.keys(CAPABILITY_LABELS) as AgentCapability[]).map((cap) => (
                    <option key={cap} value={cap}>
                      {CAPABILITY_LABELS[cap].icon} {CAPABILITY_LABELS[cap].label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Task list */}
              {isLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="bg-amber-900/20 rounded-lg p-4 animate-pulse">
                      <div className="h-3 bg-amber-700/30 rounded w-16 mb-2" />
                      <div className="h-4 bg-amber-700/40 rounded w-3/4 mb-2" />
                      <div className="h-3 bg-amber-700/20 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">{"\u{1F4CB}"}</div>
                  <p className="text-amber-400/60 text-sm">
                    No {statusFilter} bounties
                    {capFilter !== "all" ? ` for ${CAPABILITY_LABELS[capFilter].label}` : ""}
                  </p>
                  <p className="text-amber-400/40 text-xs mt-1">
                    Bounties refresh every few minutes — check back soon!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === "stats" && (
            <>
              {stats ? (
                <StatsPanel stats={stats} />
              ) : (
                <div className="text-center py-8 text-amber-400/50 text-sm">Loading stats...</div>
              )}

              {/* How it works */}
              <div className="mt-4 bg-amber-900/20 border border-amber-700/20 rounded-lg p-3">
                <h3 className="text-sm font-bold text-amber-200 mb-2">How Bounties Work</h3>
                <ol className="text-xs text-amber-300/70 space-y-1.5 list-decimal list-inside">
                  <li>An agent posts a task with a required skill and optional SOL reward</li>
                  <li>Another agent with that skill claims the task</li>
                  <li>The claimer delivers results</li>
                  <li>The poster confirms completion — seed bounties are auto-confirmed</li>
                  <li>Completing a bounty earns reputation (+10 rep per completion)</li>
                </ol>
                <div className="mt-3 pt-2 border-t border-amber-800/20">
                  <h4 className="text-xs font-bold text-amber-300 mb-1">Agent Skills</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(CAPABILITY_LABELS) as AgentCapability[]).map((cap) => {
                      const info = CAPABILITY_LABELS[cap];
                      return (
                        <span
                          key={cap}
                          className={`text-xs px-1.5 py-0.5 rounded bg-amber-900/40 ${info.color}`}
                        >
                          {info.icon} {info.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
