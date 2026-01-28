"use client";

import { useAutonomousTasks, useTriggerTask, type ScheduledTask } from "@/hooks/useElizaAgents";

// Agent display names
const AGENT_NAMES: Record<string, string> = {
  neo: "Neo",
  ghost: "Ghost",
  finn: "Finn",
  bnn: "BNN",
};

// Task descriptions
const TASK_DESCRIPTIONS: Record<string, string> = {
  neo_launch_scan: "Scans for new token launches on Bags.fm",
  neo_anomaly_detection: "Detects suspicious trading patterns and rugs",
  ghost_rewards_check: "Checks and distributes reward pool",
  ghost_trade_eval: "Evaluates new launches for trading opportunities",
  ghost_position_check: "Monitors positions for take-profit/stop-loss",
  finn_fee_reminder: "Reminds tracked wallets about unclaimed fees",
  finn_health_check: "Monitors world health and ecosystem status",
  finn_twitter_update: "Posts ecosystem updates to Twitter",
  bnn_daily_recap: "Broadcasts daily ecosystem summary",
};

interface AutonomousTasksPanelProps {
  addLog?: (message: string, type?: "info" | "success" | "error") => void;
}

export function AutonomousTasksPanel({ addLog }: AutonomousTasksPanelProps) {
  const { data, isLoading, error, refetch } = useAutonomousTasks();
  const triggerTask = useTriggerTask();

  const handleTrigger = async (taskName: string) => {
    addLog?.(`Triggering task: ${taskName}...`, "info");
    const result = await triggerTask.mutateAsync(taskName);
    if (result.success) {
      addLog?.(`Task ${taskName} triggered successfully`, "success");
    } else {
      addLog?.(`Failed to trigger ${taskName}: ${result.error}`, "error");
    }
  };

  const formatInterval = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h`;
  };

  const formatTimeUntil = (timestamp: number) => {
    const diff = timestamp - Date.now();
    if (diff <= 0) return "Now";
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const formatLastRun = (timestamp: number) => {
    if (!timestamp) return "Never";
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-700 rounded" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 p-3">
        <p className="font-pixel text-[9px] text-red-400">Failed to load autonomous tasks</p>
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

  const tasks = data?.tasks || [];

  // Group tasks by agent
  const tasksByAgent = tasks.reduce(
    (acc, task) => {
      const agent = task.agentId;
      if (!acc[agent]) acc[agent] = [];
      acc[agent].push(task);
      return acc;
    },
    {} as Record<string, ScheduledTask[]>
  );

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-bags-darker p-3 border border-gray-700">
        <div className="flex justify-between items-center">
          <div>
            <p className="font-pixel text-[10px] text-gray-400">
              AUTONOMOUS TASKS ({data?.taskCount || 0})
            </p>
            <p className="font-pixel text-[8px] text-gray-500">
              Status: {data?.status || "unknown"}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="font-pixel text-[8px] text-gray-500 hover:text-gray-300"
          >
            [REFRESH]
          </button>
        </div>
      </div>

      {/* Tasks by Agent */}
      {Object.entries(tasksByAgent).map(([agentId, agentTasks]) => (
        <div key={agentId} className="bg-bags-darker border border-gray-700">
          <div className="p-2 border-b border-gray-700 bg-black/30">
            <p className="font-pixel text-[9px] text-bags-gold">
              {AGENT_NAMES[agentId] || agentId.toUpperCase()}
            </p>
          </div>
          <div className="p-2 space-y-2">
            {agentTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                description={TASK_DESCRIPTIONS[task.name]}
                formatInterval={formatInterval}
                formatLastRun={formatLastRun}
                formatTimeUntil={formatTimeUntil}
                onTrigger={handleTrigger}
                isTriggering={triggerTask.isPending}
              />
            ))}
          </div>
        </div>
      ))}

      {tasks.length === 0 && (
        <div className="text-center py-8">
          <p className="font-pixel text-[9px] text-gray-500">No tasks registered</p>
          <p className="font-pixel text-[8px] text-gray-600 mt-1">
            Make sure ENABLE_AUTONOMOUS=true on the server
          </p>
        </div>
      )}
    </div>
  );
}

// Task card subcomponent
function TaskCard({
  task,
  description,
  formatInterval,
  formatLastRun,
  formatTimeUntil,
  onTrigger,
  isTriggering,
}: {
  task: ScheduledTask;
  description?: string;
  formatInterval: (ms: number) => string;
  formatLastRun: (timestamp: number) => string;
  formatTimeUntil: (timestamp: number) => string;
  onTrigger: (taskName: string) => void;
  isTriggering: boolean;
}) {
  const isOverdue = task.nextRun < Date.now();

  return (
    <div
      className={`bg-black/30 p-2 border ${task.enabled ? "border-gray-600" : "border-red-500/30"}`}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-pixel text-[9px] text-white">{task.name.replace(/_/g, " ")}</p>
            {!task.enabled && (
              <span className="font-pixel text-[6px] text-red-400 bg-red-500/20 px-1">
                DISABLED
              </span>
            )}
          </div>
          {description && (
            <p className="font-pixel text-[7px] text-gray-500 mt-0.5 truncate">{description}</p>
          )}
          <div className="flex gap-3 mt-1 text-[7px]">
            <span className="text-gray-500">
              Every <span className="text-white">{formatInterval(task.interval)}</span>
            </span>
            <span className="text-gray-500">
              Last: <span className="text-white">{formatLastRun(task.lastRun)}</span>
            </span>
            <span className={isOverdue ? "text-yellow-400" : "text-gray-500"}>
              Next:{" "}
              <span className={isOverdue ? "text-yellow-400" : "text-white"}>
                {formatTimeUntil(task.nextRun)}
              </span>
            </span>
          </div>
        </div>
        <button
          onClick={() => onTrigger(task.name)}
          disabled={isTriggering || !task.enabled}
          className="font-pixel text-[7px] text-yellow-400 hover:text-yellow-300 bg-yellow-500/10 px-2 py-1 border border-yellow-500/30 disabled:opacity-50 flex-shrink-0 ml-2"
        >
          [TRIGGER]
        </button>
      </div>
    </div>
  );
}

export default AutonomousTasksPanel;
