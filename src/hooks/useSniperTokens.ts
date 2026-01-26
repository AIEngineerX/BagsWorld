"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  SniperToken,
  SniperNewLaunch,
  SniperFilters,
  SniperSortField,
  SniperSortDirection,
} from "@/lib/types";

interface UseSniperTokensOptions {
  sortField?: SniperSortField;
  sortDirection?: SniperSortDirection;
  filters?: SniperFilters;
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseSniperTokensReturn {
  tokens: SniperToken[];
  isLoading: boolean;
  error: string | null;
  total: number;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

export function useSniperTokens(options: UseSniperTokensOptions = {}): UseSniperTokensReturn {
  const {
    sortField = "volume24h",
    sortDirection = "desc",
    filters = {},
    limit = 50,
    autoRefresh = true,
    refreshInterval = 30000, // 30 seconds
  } = options;

  const [tokens, setTokens] = useState<SniperToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);

  const fetchTokens = useCallback(
    async (currentOffset: number, append: boolean = false) => {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/sniper/all-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sortField,
          sortDirection,
          filters,
          limit,
          offset: currentOffset,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || "Failed to fetch tokens");
        setIsLoading(false);
        return;
      }

      const data = await response.json();

      if (data.success) {
        if (append) {
          setTokens((prev) => [...prev, ...data.tokens]);
        } else {
          setTokens(data.tokens);
        }
        setTotal(data.total);
      } else {
        setError(data.error || "Failed to fetch tokens");
      }

      setIsLoading(false);
    },
    [sortField, sortDirection, filters, limit]
  );

  const refresh = useCallback(async () => {
    setOffset(0);
    await fetchTokens(0, false);
  }, [fetchTokens]);

  const loadMore = useCallback(async () => {
    const newOffset = offset + limit;
    setOffset(newOffset);
    await fetchTokens(newOffset, true);
  }, [offset, limit, fetchTokens]);

  // Initial fetch
  useEffect(() => {
    fetchTokens(0, false);
  }, [fetchTokens]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchTokens(0, false);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchTokens]);

  const hasMore = tokens.length < total;

  return {
    tokens,
    isLoading,
    error,
    total,
    refresh,
    loadMore,
    hasMore,
  };
}

// Hook for new launch SSE subscription
interface UseNewLaunchesReturn {
  launches: SniperNewLaunch[];
  isConnected: boolean;
  error: string | null;
  latestLaunch: SniperNewLaunch | null;
}

export function useNewLaunches(): UseNewLaunchesReturn {
  const [launches, setLaunches] = useState<SniperNewLaunch[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestLaunch, setLatestLaunch] = useState<SniperNewLaunch | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let isUnmounted = false;

    const connect = () => {
      if (isUnmounted) return;

      // Close existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const eventSource = new EventSource("/api/sniper/new-launches");
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        if (isUnmounted) return;
        setIsConnected(true);
        setError(null);
      };

      eventSource.onmessage = (event) => {
        if (isUnmounted) return;

        const data = JSON.parse(event.data);

        if (data.type === "connected") {
          setIsConnected(true);
        } else if (data.type === "new_launch") {
          const launch = data.launch as SniperNewLaunch;
          setLatestLaunch(launch);
          setLaunches((prev) => [launch, ...prev.slice(0, 49)]); // Keep last 50
        } else if (data.type === "heartbeat") {
          // Connection is alive, nothing to do
        }
      };

      eventSource.onerror = () => {
        if (isUnmounted) return;

        setIsConnected(false);
        setError("Connection lost. Reconnecting...");

        // Close the errored connection
        eventSource.close();

        // Attempt to reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          if (!isUnmounted) {
            connect();
          }
        }, 5000);
      };
    };

    // Fetch initial launches
    fetch("/api/sniper/new-launches")
      .then((res) => res.json())
      .then((data) => {
        if (!isUnmounted && data.success) {
          setLaunches(data.launches || []);
        }
      });

    // Connect to SSE
    connect();

    return () => {
      isUnmounted = true;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return {
    launches,
    isConnected,
    error,
    latestLaunch,
  };
}

// Hook for executing snipes
interface UseSnipeOptions {
  onSuccess?: (signature: string) => void;
  onError?: (error: string) => void;
}

interface UseSnipeReturn {
  getQuote: (
    tokenMint: string,
    amountSol: number,
    slippageBps: number
  ) => Promise<{
    inputAmount: number;
    outputAmount: number;
    minOutputAmount: number;
    priceImpact: number;
  } | null>;
  executeSnipe: (
    tokenMint: string,
    amountSol: number,
    slippageBps: number,
    signTransaction: (tx: any) => Promise<any>
  ) => Promise<string | null>;
  isQuoting: boolean;
  isSniping: boolean;
  error: string | null;
}

export function useSnipe(options: UseSnipeOptions = {}): UseSnipeReturn {
  const { onSuccess, onError } = options;
  const [isQuoting, setIsQuoting] = useState(false);
  const [isSniping, setIsSniping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getQuote = useCallback(
    async (tokenMint: string, amountSol: number, slippageBps: number) => {
      setIsQuoting(true);
      setError(null);

      const response = await fetch("/api/sniper/quick-snipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "quote",
          tokenMint,
          amountSol,
          slippageBps,
        }),
      });

      const data = await response.json();
      setIsQuoting(false);

      if (!response.ok || !data.success) {
        const errorMsg = data.error || "Failed to get quote";
        setError(errorMsg);
        onError?.(errorMsg);
        return null;
      }

      return data.quote;
    },
    [onError]
  );

  const executeSnipe = useCallback(
    async (
      tokenMint: string,
      amountSol: number,
      slippageBps: number,
      signTransaction: (tx: any) => Promise<any>
    ) => {
      setIsSniping(true);
      setError(null);

      // We need the user's public key from the wallet
      // This should be passed in or obtained from context

      const response = await fetch("/api/sniper/quick-snipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "swap",
          tokenMint,
          amountSol,
          slippageBps,
          userPublicKey: "", // Will be filled by component
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorMsg = data.error || "Failed to create snipe transaction";
        setError(errorMsg);
        setIsSniping(false);
        onError?.(errorMsg);
        return null;
      }

      // Sign and send the transaction
      // This part will be handled by the component using wallet adapter

      setIsSniping(false);
      return data.transaction;
    },
    [onError]
  );

  return {
    getQuote,
    executeSnipe,
    isQuoting,
    isSniping,
    error,
  };
}
