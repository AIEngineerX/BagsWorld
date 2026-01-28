"use client";

import { useState } from "react";
import {
  useAlerts,
  useAcknowledgeAlert,
  type AutonomousAlert,
  type AlertFilters,
} from "@/hooks/useElizaAgents";

const ALERT_TYPES: AutonomousAlert["type"][] = [
  "launch",
  "rug",
  "pump",
  "dump",
  "milestone",
  "anomaly",
  "fee_reminder",
  "trade",
];

const SEVERITY_LEVELS: AutonomousAlert["severity"][] = ["info", "warning", "critical"];

const TYPE_COLORS: Record<AutonomousAlert["type"], string> = {
  launch: "text-green-400 bg-green-500/20 border-green-500/30",
  rug: "text-red-400 bg-red-500/20 border-red-500/30",
  pump: "text-green-400 bg-green-500/20 border-green-500/30",
  dump: "text-red-400 bg-red-500/20 border-red-500/30",
  milestone: "text-bags-gold bg-yellow-500/20 border-yellow-500/30",
  anomaly: "text-purple-400 bg-purple-500/20 border-purple-500/30",
  fee_reminder: "text-blue-400 bg-blue-500/20 border-blue-500/30",
  trade: "text-cyan-400 bg-cyan-500/20 border-cyan-500/30",
};

const SEVERITY_COLORS: Record<AutonomousAlert["severity"], string> = {
  info: "text-gray-400",
  warning: "text-yellow-400",
  critical: "text-red-400",
};

interface AlertsPanelProps {
  addLog?: (message: string, type?: "info" | "success" | "error") => void;
}

export function AlertsPanel({ addLog }: AlertsPanelProps) {
  const [filters, setFilters] = useState<AlertFilters>({
    limit: 50,
    unacknowledgedOnly: false,
  });

  const { data, isLoading, error, refetch } = useAlerts(filters);
  const acknowledgeAlert = useAcknowledgeAlert();

  const handleAcknowledge = async (alertId: string) => {
    const result = await acknowledgeAlert.mutateAsync(alertId);
    if (result.success) {
      addLog?.("Alert acknowledged", "success");
    }
  };

  const handleAcknowledgeAll = async () => {
    const unacknowledged = data?.alerts.filter((a) => !a.acknowledged) || [];
    for (const alert of unacknowledged) {
      await acknowledgeAlert.mutateAsync(alert.id);
    }
    addLog?.(`Acknowledged ${unacknowledged.length} alerts`, "success");
  };

  const formatTimeAgo = (timestamp: number) => {
    if (!timestamp) return "Unknown";
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-12 bg-gray-700 rounded" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-700 rounded" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 p-3">
        <p className="font-pixel text-[9px] text-red-400">Failed to load alerts</p>
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

  const alerts = data?.alerts || [];
  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-bags-darker p-3 border border-gray-700">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <span className="font-pixel text-[8px] text-gray-500">Type:</span>
            <select
              value={filters.type || ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  type: (e.target.value || undefined) as AutonomousAlert["type"] | undefined,
                }))
              }
              className="bg-black/50 border border-gray-700 px-2 py-0.5 font-pixel text-[8px] text-white"
            >
              <option value="">All</option>
              {ALERT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-pixel text-[8px] text-gray-500">Severity:</span>
            <select
              value={filters.severity || ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  severity: (e.target.value || undefined) as
                    | AutonomousAlert["severity"]
                    | undefined,
                }))
              }
              className="bg-black/50 border border-gray-700 px-2 py-0.5 font-pixel text-[8px] text-white"
            >
              <option value="">All</option>
              {SEVERITY_LEVELS.map((severity) => (
                <option key={severity} value={severity}>
                  {severity}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.unacknowledgedOnly}
              onChange={(e) => setFilters((f) => ({ ...f, unacknowledgedOnly: e.target.checked }))}
              className="w-3 h-3"
            />
            <span className="font-pixel text-[8px] text-gray-400">Unacknowledged only</span>
          </label>

          <button
            onClick={() => refetch()}
            className="font-pixel text-[7px] text-gray-500 hover:text-gray-300 ml-auto"
          >
            [REFRESH]
          </button>
        </div>
      </div>

      {/* Summary & Actions */}
      <div className="flex justify-between items-center">
        <p className="font-pixel text-[9px] text-gray-400">
          {alerts.length} alerts ({unacknowledgedCount} unread)
        </p>
        {unacknowledgedCount > 0 && (
          <button
            onClick={handleAcknowledgeAll}
            disabled={acknowledgeAlert.isPending}
            className="font-pixel text-[7px] text-yellow-400 hover:text-yellow-300 bg-yellow-500/10 px-2 py-1 border border-yellow-500/30"
          >
            [ACK ALL]
          </button>
        )}
      </div>

      {/* Alert List */}
      {alerts.length > 0 ? (
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              formatTimeAgo={formatTimeAgo}
              onAcknowledge={handleAcknowledge}
              isAcknowledging={acknowledgeAlert.isPending}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="font-pixel text-[9px] text-gray-500">No alerts</p>
          <p className="font-pixel text-[8px] text-gray-600 mt-1">
            Alerts appear when Neo detects launches, pumps, rugs, or anomalies
          </p>
        </div>
      )}
    </div>
  );
}

// Alert card subcomponent
function AlertCard({
  alert,
  formatTimeAgo,
  onAcknowledge,
  isAcknowledging,
}: {
  alert: AutonomousAlert;
  formatTimeAgo: (timestamp: number) => string;
  onAcknowledge: (alertId: string) => void;
  isAcknowledging: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const typeStyle = TYPE_COLORS[alert.type] || "text-gray-400 bg-gray-500/20 border-gray-500/30";
  const severityColor = SEVERITY_COLORS[alert.severity] || "text-gray-400";

  return (
    <div
      className={`bg-bags-darker border ${
        alert.acknowledged ? "border-gray-700 opacity-60" : "border-gray-600"
      }`}
    >
      <div className="p-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`font-pixel text-[7px] px-1.5 py-0.5 border ${typeStyle}`}>
                {alert.type.replace(/_/g, " ").toUpperCase()}
              </span>
              <span className={`font-pixel text-[7px] ${severityColor}`}>
                {alert.severity.toUpperCase()}
              </span>
              {alert.acknowledged && (
                <span className="font-pixel text-[6px] text-gray-500">ACK</span>
              )}
            </div>
            <p className="font-pixel text-[9px] text-white">{alert.title}</p>
            <p className="font-pixel text-[8px] text-gray-400 mt-0.5">{alert.message}</p>
            <p className="font-pixel text-[6px] text-gray-500 mt-1">
              {formatTimeAgo(alert.timestamp)}
            </p>
          </div>

          <div className="flex flex-col gap-1 flex-shrink-0">
            {!alert.acknowledged && (
              <button
                onClick={() => onAcknowledge(alert.id)}
                disabled={isAcknowledging}
                className="font-pixel text-[7px] text-green-400 hover:text-green-300 bg-green-500/10 px-2 py-0.5 border border-green-500/30"
              >
                [ACK]
              </button>
            )}
            {alert.data && Object.keys(alert.data).length > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="font-pixel text-[7px] text-gray-400 hover:text-gray-300 px-2 py-0.5 border border-gray-600"
              >
                {expanded ? "[HIDE]" : "[DATA]"}
              </button>
            )}
          </div>
        </div>
      </div>

      {expanded && alert.data && (
        <div className="border-t border-gray-700 p-2 bg-black/30">
          <pre className="font-mono text-[7px] text-gray-400 whitespace-pre-wrap overflow-x-auto">
            {JSON.stringify(alert.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default AlertsPanel;
