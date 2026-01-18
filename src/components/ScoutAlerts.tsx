"use client";

import { useEffect, useState } from "react";
import { useScoutAlerts, TokenLaunch } from "@/hooks/useScoutAlerts";

interface ScoutAlertsProps {
  onTokenClick?: (mint: string) => void;
  maxVisible?: number;
}

export function ScoutAlerts({ onTokenClick, maxVisible = 3 }: ScoutAlertsProps) {
  const [toasts, setToasts] = useState<TokenLaunch[]>([]);

  const { alerts, scoutState, startScout } = useScoutAlerts({
    pollIntervalMs: 3000,
    onNewLaunch: (launch) => {
      // Add to toasts
      setToasts((prev) => [launch, ...prev].slice(0, maxVisible));

      // Auto-dismiss after 10 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.mint !== launch.mint));
      }, 10000);
    },
  });

  // Auto-start scout if not running
  useEffect(() => {
    if (scoutState && !scoutState.isRunning) {
      startScout();
    }
  }, [scoutState, startScout]);

  const dismissToast = (mint: string) => {
    setToasts((prev) => prev.filter((t) => t.mint !== mint));
  };

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((launch) => (
        <div
          key={launch.mint}
          className="bg-gray-900 border border-green-500/50 rounded-lg p-3 shadow-lg animate-slide-in"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-green-400 text-xs font-bold uppercase">
                  {launch.platform === "bags" ? "BAGS" : "NEW"}
                </span>
                <span className="text-white font-medium truncate">
                  {launch.name}
                </span>
                <span className="text-gray-400 text-sm">${launch.symbol}</span>
              </div>

              <div className="text-gray-400 text-xs mt-1 font-mono truncate">
                {launch.mint.slice(0, 8)}...{launch.mint.slice(-6)}
              </div>

              {launch.liquidity > 0 && (
                <div className="text-gray-500 text-xs mt-1">
                  Liq: {(launch.liquidity * 200).toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 0,
                  })}
                </div>
              )}
            </div>

            <button
              onClick={() => dismissToast(launch.mint)}
              className="text-gray-500 hover:text-white transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="flex gap-2 mt-2">
            <button
              onClick={() => {
                onTokenClick?.(launch.mint);
                dismissToast(launch.mint);
              }}
              className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs py-1 px-2 rounded transition-colors"
            >
              View
            </button>
            <a
              href={`https://bags.fm/${launch.mint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-xs py-1 px-2 rounded text-center transition-colors"
            >
              Bags.fm
            </a>
          </div>
        </div>
      ))}

      <style jsx>{`
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

// Scout status indicator for the UI
export function ScoutStatus() {
  const { scoutState, startScout, stopScout } = useScoutAlerts();

  if (!scoutState) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <div
        className={`w-2 h-2 rounded-full ${
          scoutState.isConnected
            ? "bg-green-500 animate-pulse"
            : scoutState.isRunning
            ? "bg-yellow-500"
            : "bg-gray-500"
        }`}
      />
      <span className="text-gray-400">
        Scout: {scoutState.launchesScanned.toLocaleString()} scanned
      </span>
      <button
        onClick={() => (scoutState.isRunning ? stopScout() : startScout())}
        className={`px-2 py-0.5 rounded text-xs ${
          scoutState.isRunning
            ? "bg-red-600/50 hover:bg-red-600 text-red-200"
            : "bg-green-600/50 hover:bg-green-600 text-green-200"
        }`}
      >
        {scoutState.isRunning ? "Stop" : "Start"}
      </button>
    </div>
  );
}
