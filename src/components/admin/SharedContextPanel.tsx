"use client";

import {
  useSharedContext,
  useElizaHealth,
  type SharedContext,
} from "@/hooks/useElizaAgents";

interface SharedContextPanelProps {
  addLog?: (message: string, type?: "info" | "success" | "error") => void;
}

export function SharedContextPanel({ addLog }: SharedContextPanelProps) {
  const { data: contextData, isLoading: contextLoading, error: contextError, refetch: refetchContext } = useSharedContext();
  const { data: health, isLoading: healthLoading, error: healthError, refetch: refetchHealth } = useElizaHealth();

  const formatTimeAgo = (timestamp: number | undefined) => {
    if (!timestamp) return "Never";
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  const getHealthColor = (health: number | undefined) => {
    if (health === undefined) return "text-gray-400";
    if (health >= 80) return "text-green-400";
    if (health >= 60) return "text-yellow-400";
    if (health >= 40) return "text-orange-400";
    return "text-red-400";
  };

  const getWeatherEmoji = (weather: string | undefined) => {
    switch (weather?.toLowerCase()) {
      case "sunny":
        return "Clear";
      case "cloudy":
        return "Cloudy";
      case "rain":
        return "Rain";
      case "storm":
        return "Storm";
      case "apocalypse":
        return "Apocalypse";
      default:
        return weather || "Unknown";
    }
  };

  const refetchAll = () => {
    refetchContext();
    refetchHealth();
    addLog?.("Context refreshed", "info");
  };

  if (contextLoading || healthLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-24 bg-gray-700 rounded" />
        <div className="h-32 bg-gray-700 rounded" />
        <div className="h-40 bg-gray-700 rounded" />
      </div>
    );
  }

  if (contextError || healthError) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 p-3">
        <p className="font-pixel text-[9px] text-red-400">
          Failed to load shared context
        </p>
        <p className="font-pixel text-[8px] text-gray-500 mt-1">
          {(contextError || healthError) instanceof Error
            ? (contextError || healthError)?.message
            : "Connection error"}
        </p>
        <button
          onClick={refetchAll}
          className="font-pixel text-[8px] text-red-400 hover:text-red-300 mt-2"
        >
          [RETRY]
        </button>
      </div>
    );
  }

  const context = contextData?.context || {};

  return (
    <div className="space-y-4">
      {/* Server Health */}
      <div className="bg-bags-darker p-3 border border-gray-700">
        <div className="flex justify-between items-center mb-2">
          <p className="font-pixel text-[8px] text-gray-400">SERVER HEALTH</p>
          <button
            onClick={refetchAll}
            className="font-pixel text-[7px] text-gray-500 hover:text-gray-300"
          >
            [REFRESH]
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <p className="font-pixel text-[7px] text-gray-500">Status</p>
            <p className={`font-pixel text-sm ${health?.status === "ok" ? "text-green-400" : "text-yellow-400"}`}>
              {health?.status?.toUpperCase() || "UNKNOWN"}
            </p>
          </div>
          <div>
            <p className="font-pixel text-[7px] text-gray-500">Database</p>
            <p className={`font-pixel text-sm ${health?.database?.status === "connected" ? "text-green-400" : "text-red-400"}`}>
              {health?.database?.status?.toUpperCase() || "UNKNOWN"}
            </p>
          </div>
          <div>
            <p className="font-pixel text-[7px] text-gray-500">LLM Provider</p>
            <p className="font-pixel text-sm text-white">
              {health?.llm?.provider || "None"}
            </p>
          </div>
          <div>
            <p className="font-pixel text-[7px] text-gray-500">Agents</p>
            <p className="font-pixel text-sm text-white">
              {health?.agents || 0}
            </p>
          </div>
        </div>
      </div>

      {/* World State */}
      <div className="bg-bags-darker p-3 border border-bags-green/30">
        <p className="font-pixel text-[8px] text-gray-400 mb-2">WORLD STATE</p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <p className="font-pixel text-[7px] text-gray-500">World Health</p>
            <p className={`font-pixel text-lg ${getHealthColor(context.worldHealth as number)}`}>
              {context.worldHealth !== undefined ? `${context.worldHealth}%` : "-"}
            </p>
          </div>
          <div>
            <p className="font-pixel text-[7px] text-gray-500">Weather</p>
            <p className="font-pixel text-sm text-white">
              {getWeatherEmoji(context.weather as string)}
            </p>
          </div>
          <div>
            <p className="font-pixel text-[7px] text-gray-500">24h Fees</p>
            <p className="font-pixel text-sm text-bags-gold">
              {context.fees24h !== undefined ? `${(context.fees24h as number).toFixed(2)} SOL` : "-"}
            </p>
          </div>
        </div>
      </div>

      {/* Ghost Trading */}
      <div className="bg-bags-darker p-3 border border-purple-500/30">
        <p className="font-pixel text-[8px] text-gray-400 mb-2">GHOST TRADING</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <p className="font-pixel text-[7px] text-gray-500">Status</p>
            <p className={`font-pixel text-sm ${context.ghostTradingEnabled ? "text-green-400" : "text-red-400"}`}>
              {context.ghostTradingEnabled ? "ENABLED" : "DISABLED"}
            </p>
          </div>
          <div>
            <p className="font-pixel text-[7px] text-gray-500">Open Positions</p>
            <p className="font-pixel text-sm text-white">
              {context.ghostOpenPositions ?? "-"}
            </p>
          </div>
          <div>
            <p className="font-pixel text-[7px] text-gray-500">Exposure</p>
            <p className="font-pixel text-sm text-bags-gold">
              {context.ghostExposureSol !== undefined
                ? `${(context.ghostExposureSol as number).toFixed(3)} SOL`
                : "-"}
            </p>
          </div>
          <div>
            <p className="font-pixel text-[7px] text-gray-500">Total P&L</p>
            <p className={`font-pixel text-sm ${
              (context.ghostPnlSol as number) > 0
                ? "text-green-400"
                : (context.ghostPnlSol as number) < 0
                ? "text-red-400"
                : "text-gray-400"
            }`}>
              {context.ghostPnlSol !== undefined
                ? `${(context.ghostPnlSol as number) > 0 ? "+" : ""}${(context.ghostPnlSol as number).toFixed(4)} SOL`
                : "-"}
            </p>
          </div>
        </div>
      </div>

      {/* Activity Summary */}
      <div className="bg-bags-darker p-3 border border-gray-700">
        <p className="font-pixel text-[8px] text-gray-400 mb-2">ACTIVITY</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="font-pixel text-[7px] text-gray-500">Recent Launches</p>
            <p className="font-pixel text-sm text-white">
              {context.recentLaunches ?? "-"}
            </p>
            <p className="font-pixel text-[6px] text-gray-600">
              Last scan: {formatTimeAgo(context.lastLaunchScan as number)}
            </p>
          </div>
          <div>
            <p className="font-pixel text-[7px] text-gray-500">Anomalies Detected</p>
            <p className="font-pixel text-sm text-purple-400">
              {context.anomaliesDetected ?? "-"}
            </p>
            <p className="font-pixel text-[6px] text-gray-600">
              Last scan: {formatTimeAgo(context.lastAnomalyScan as number)}
            </p>
          </div>
        </div>
      </div>

      {/* Fee Tracking */}
      <div className="bg-bags-darker p-3 border border-blue-500/30">
        <p className="font-pixel text-[8px] text-gray-400 mb-2">FEE TRACKING</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="font-pixel text-[7px] text-gray-500">Wallets with Unclaimed</p>
            <p className="font-pixel text-sm text-white">
              {context.walletsWithUnclaimedFees ?? "-"}
            </p>
          </div>
          <div>
            <p className="font-pixel text-[7px] text-gray-500">Total Unclaimed</p>
            <p className="font-pixel text-sm text-bags-gold">
              {context.totalUnclaimedSol !== undefined
                ? `${(context.totalUnclaimedSol as number).toFixed(2)} SOL`
                : "-"}
            </p>
          </div>
        </div>
      </div>

      {/* Raw Context */}
      <div className="bg-bags-darker p-3 border border-gray-700">
        <details>
          <summary className="font-pixel text-[8px] text-gray-400 cursor-pointer hover:text-gray-300">
            RAW CONTEXT ({contextData?.keys?.length || 0} keys)
          </summary>
          <div className="mt-2 bg-black/30 p-2 overflow-x-auto">
            <pre className="font-mono text-[7px] text-gray-400 whitespace-pre-wrap">
              {JSON.stringify(context, null, 2)}
            </pre>
          </div>
        </details>
      </div>
    </div>
  );
}

export default SharedContextPanel;
