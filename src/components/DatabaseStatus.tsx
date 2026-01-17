"use client";

import { useState, useEffect } from "react";

interface DatabaseStatusResponse {
  status: "connected" | "not_configured" | "error";
  message: string;
  tokenCount: number;
}

export function DatabaseStatus() {
  const [status, setStatus] = useState<DatabaseStatusResponse | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch("/api/database-status");
        const data = await response.json();
        setStatus(data);
      } catch {
        setStatus({
          status: "error",
          message: "Failed to check status",
          tokenCount: 0,
        });
      }
    };

    checkStatus();
    // Check every 5 minutes
    const interval = setInterval(checkStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!status) {
    return (
      <span className="text-gray-500">
        DB: <span className="animate-pulse">...</span>
      </span>
    );
  }

  const statusColors = {
    connected: "text-bags-green",
    not_configured: "text-bags-gold",
    error: "text-bags-red",
  };

  const statusIcons = {
    connected: "●",
    not_configured: "○",
    error: "✕",
  };

  return (
    <span
      className={`${statusColors[status.status]} cursor-help`}
      title={`${status.message}${status.tokenCount > 0 ? ` (${status.tokenCount} global tokens)` : ""}`}
    >
      {statusIcons[status.status]} GLOBAL: {status.status === "connected" ? "ON" : status.status === "not_configured" ? "LOCAL" : "ERR"}
    </span>
  );
}
