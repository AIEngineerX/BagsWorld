// Hook for subscribing to Scout Agent alerts
import { useState, useEffect, useCallback, useRef } from "react";

export interface TokenLaunch {
  mint: string;
  name: string;
  symbol: string;
  creator: string;
  liquidity: number;
  supply: number;
  timestamp: number;
  platform: "bags" | "pump" | "unknown";
  uri?: string;
  signature?: string;
}

interface ScoutState {
  isRunning: boolean;
  isConnected: boolean;
  launchesScanned: number;
  alertsSent: number;
  recentLaunches: TokenLaunch[];
}

interface UseScoutAlertsOptions {
  pollIntervalMs?: number;
  maxAlerts?: number;
  onNewLaunch?: (launch: TokenLaunch) => void;
}

export function useScoutAlerts(options: UseScoutAlertsOptions = {}) {
  const {
    pollIntervalMs = 5000,
    maxAlerts = 20,
    onNewLaunch,
  } = options;

  const [alerts, setAlerts] = useState<TokenLaunch[]>([]);
  const [scoutState, setScoutState] = useState<ScoutState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSeenMint, setLastSeenMint] = useState<string | null>(null);

  // Use refs to avoid circular dependencies in useCallback
  const alertsRef = useRef<TokenLaunch[]>([]);
  const lastSeenMintRef = useRef<string | null>(null);
  const onNewLaunchRef = useRef(onNewLaunch);

  // Keep refs in sync with state
  useEffect(() => {
    alertsRef.current = alerts;
  }, [alerts]);

  useEffect(() => {
    lastSeenMintRef.current = lastSeenMint;
  }, [lastSeenMint]);

  useEffect(() => {
    onNewLaunchRef.current = onNewLaunch;
  }, [onNewLaunch]);

  // Fetch scout status and recent launches
  const fetchScoutData = useCallback(async () => {
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scout-launches", count: maxAlerts }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch scout data");
      }

      const data = await response.json();

      if (data.launches) {
        const launches = data.launches as TokenLaunch[];

        // Check for new launches using refs to avoid stale closures
        if (launches.length > 0 && launches[0].mint !== lastSeenMintRef.current) {
          const currentAlerts = alertsRef.current;
          const newLaunches = lastSeenMintRef.current
            ? launches.filter(
                (l) =>
                  currentAlerts.findIndex((a) => a.mint === l.mint) === -1
              )
            : [];

          // Notify about new launches
          if (onNewLaunchRef.current) {
            newLaunches.forEach((launch) => onNewLaunchRef.current!(launch));
          }

          setLastSeenMint(launches[0].mint);
        }

        setAlerts(launches);
      }

      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [maxAlerts]);

  // Fetch scout state
  const fetchScoutState = useCallback(async () => {
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scout-status" }),
      });

      if (response.ok) {
        const data = await response.json();
        setScoutState(data.scout);
      }
    } catch {
      // Silently fail for state fetch
    }
  }, []);

  // Start scout agent
  const startScout = useCallback(async () => {
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scout-start" }),
      });

      if (!response.ok) {
        throw new Error("Failed to start scout");
      }

      await fetchScoutState();
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, [fetchScoutState]);

  // Stop scout agent
  const stopScout = useCallback(async () => {
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scout-stop" }),
      });

      if (!response.ok) {
        throw new Error("Failed to stop scout");
      }

      await fetchScoutState();
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, [fetchScoutState]);

  // Clear an alert
  const dismissAlert = useCallback((mint: string) => {
    setAlerts((prev) => prev.filter((a) => a.mint !== mint));
  }, []);

  // Clear all alerts
  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  // Poll for new data
  useEffect(() => {
    fetchScoutData();
    fetchScoutState();

    const interval = setInterval(() => {
      fetchScoutData();
      fetchScoutState();
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [fetchScoutData, fetchScoutState, pollIntervalMs]);

  return {
    alerts,
    scoutState,
    isLoading,
    error,
    startScout,
    stopScout,
    dismissAlert,
    clearAlerts,
    refresh: fetchScoutData,
  };
}
