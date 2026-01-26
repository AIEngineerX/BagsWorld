"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useSniperTokens, useNewLaunches, useSnipe } from "@/hooks/useSniperTokens";
import type {
  SniperToken,
  SniperNewLaunch,
  SniperSortField,
  SniperSortDirection,
  SniperFilters,
} from "@/lib/types";

interface SniperTowerProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = "all" | "new" | "watchlist";

interface SnipeModalState {
  isOpen: boolean;
  token: SniperToken | SniperNewLaunch | null;
}

export function SniperTower({ isOpen, onClose }: SniperTowerProps) {
  const { publicKey, signTransaction, connected } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>("all");

  // Sort and filter state
  const [sortField, setSortField] = useState<SniperSortField>("volume24h");
  const [sortDirection, setSortDirection] = useState<SniperSortDirection>("desc");
  const [filters, setFilters] = useState<SniperFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  // Snipe modal state
  const [snipeModal, setSnipeModal] = useState<SnipeModalState>({ isOpen: false, token: null });
  const [snipeAmount, setSnipeAmount] = useState<string>("0.1");
  const [slippageBps, setSlippageBps] = useState<number>(300); // 3%

  // Watchlist state (localStorage)
  const [watchlist, setWatchlist] = useState<string[]>([]);

  // Data hooks
  const {
    tokens,
    isLoading: tokensLoading,
    error: tokensError,
    total,
    refresh,
    loadMore,
    hasMore,
  } = useSniperTokens({
    sortField,
    sortDirection,
    filters,
    limit: 50,
    autoRefresh: activeTab === "all",
  });

  const { launches, isConnected: sseConnected, error: sseError, latestLaunch } = useNewLaunches();

  const {
    getQuote,
    executeSnipe,
    isQuoting,
    isSniping,
    error: snipeError,
  } = useSnipe({
    onSuccess: (signature) => {
      setSnipeModal({ isOpen: false, token: null });
      // Could show success toast here
    },
    onError: (error) => {
      // Error is already set in the hook
    },
  });

  // Quote state
  const [quote, setQuote] = useState<{
    inputAmount: number;
    outputAmount: number;
    minOutputAmount: number;
    priceImpact: number;
  } | null>(null);

  // Load watchlist from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("sniper_watchlist");
    if (saved) {
      try {
        setWatchlist(JSON.parse(saved));
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, []);

  // Save watchlist to localStorage
  const toggleWatchlist = useCallback((mint: string) => {
    setWatchlist((prev) => {
      const next = prev.includes(mint) ? prev.filter((m) => m !== mint) : [...prev, mint];
      localStorage.setItem("sniper_watchlist", JSON.stringify(next));
      return next;
    });
  }, []);

  // Filter tokens for watchlist tab
  const watchlistTokens = useMemo(() => {
    return tokens.filter((t) => watchlist.includes(t.mint));
  }, [tokens, watchlist]);

  // Audio alert for new launches
  useEffect(() => {
    if (latestLaunch && activeTab === "new") {
      // Play alert sound
      const audio = new Audio("/sounds/alert.mp3");
      audio.volume = 0.3;
      audio.play().catch(() => {
        // Audio play failed (user hasn't interacted with page)
      });
    }
  }, [latestLaunch, activeTab]);

  // Handle snipe button click
  const handleSnipeClick = useCallback(
    (token: SniperToken | SniperNewLaunch) => {
      if (!connected) {
        setWalletModalVisible(true);
        return;
      }
      setSnipeModal({ isOpen: true, token });
      setQuote(null);
    },
    [connected, setWalletModalVisible]
  );

  // Get quote when snipe modal opens or amount changes
  const handleGetQuote = useCallback(async () => {
    if (!snipeModal.token || !snipeAmount || parseFloat(snipeAmount) <= 0) return;

    const result = await getQuote(snipeModal.token.mint, parseFloat(snipeAmount), slippageBps);
    if (result) {
      setQuote(result);
    }
  }, [snipeModal.token, snipeAmount, slippageBps, getQuote]);

  // Execute snipe
  const handleExecuteSnipe = useCallback(async () => {
    if (!snipeModal.token || !signTransaction || !publicKey) return;

    await executeSnipe(
      snipeModal.token.mint,
      parseFloat(snipeAmount),
      slippageBps,
      signTransaction
    );
  }, [snipeModal.token, snipeAmount, slippageBps, signTransaction, publicKey, executeSnipe]);

  // Format helpers
  const formatPrice = (price: number) => {
    if (price >= 1) return `$${price.toFixed(2)}`;
    if (price >= 0.001) return `$${price.toFixed(4)}`;
    if (price >= 0.000001) return `$${price.toFixed(6)}`;
    return `$${price.toExponential(2)}`;
  };

  const formatMarketCap = (mcap: number) => {
    if (mcap >= 1_000_000_000) return `$${(mcap / 1_000_000_000).toFixed(2)}B`;
    if (mcap >= 1_000_000) return `$${(mcap / 1_000_000).toFixed(2)}M`;
    if (mcap >= 1_000) return `$${(mcap / 1_000).toFixed(1)}K`;
    return `$${mcap.toFixed(0)}`;
  };

  const formatVolume = (vol: number) => {
    if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(2)}M`;
    if (vol >= 1_000) return `$${(vol / 1_000).toFixed(1)}K`;
    return `$${vol.toFixed(0)}`;
  };

  const formatAge = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  const formatChange = (change: number) => {
    const sign = change >= 0 ? "+" : "";
    return `${sign}${change.toFixed(2)}%`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-gray-900 rounded-lg border border-gray-700 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Sniper Tower</h2>
              <p className="text-sm text-gray-400">All Bags.fm tokens in real-time</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
            <svg
              className="w-6 h-6 text-gray-400"
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

        {/* Tabs */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-800">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "all"
                ? "bg-green-500/20 text-green-400"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            All Tokens
          </button>
          <button
            onClick={() => setActiveTab("new")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              activeTab === "new"
                ? "bg-green-500/20 text-green-400"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            New Launches
            {sseConnected && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
          </button>
          <button
            onClick={() => setActiveTab("watchlist")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "watchlist"
                ? "bg-green-500/20 text-green-400"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            Watchlist ({watchlist.length})
          </button>

          <div className="flex-1" />

          {/* Refresh button */}
          <button
            onClick={refresh}
            disabled={tokensLoading}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <svg
              className={`w-5 h-5 text-gray-400 ${tokensLoading ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition-colors ${
              showFilters ? "bg-green-500/20 text-green-400" : "hover:bg-gray-800 text-gray-400"
            }`}
            title="Filters"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
          </button>
        </div>

        {/* Filters */}
        {showFilters && activeTab === "all" && (
          <div className="px-6 py-3 border-b border-gray-800 bg-gray-800/50">
            <div className="flex flex-wrap items-center gap-4">
              {/* Sort */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Sort:</span>
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as SniperSortField)}
                  className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-white"
                >
                  <option value="volume24h">Volume</option>
                  <option value="marketCap">Market Cap</option>
                  <option value="change24h">Change 24h</option>
                  <option value="createdAt">Age</option>
                  <option value="price">Price</option>
                  <option value="liquidity">Liquidity</option>
                </select>
                <button
                  onClick={() => setSortDirection(sortDirection === "desc" ? "asc" : "desc")}
                  className="p-1.5 bg-gray-700 border border-gray-600 rounded hover:bg-gray-600 transition-colors"
                >
                  {sortDirection === "desc" ? (
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 15l7-7 7 7"
                      />
                    </svg>
                  )}
                </button>
              </div>

              {/* Min Market Cap */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Min MCap:</span>
                <select
                  value={filters.minMarketCap || ""}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      minMarketCap: e.target.value ? parseInt(e.target.value) : undefined,
                    }))
                  }
                  className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-white"
                >
                  <option value="">Any</option>
                  <option value="1000">$1K+</option>
                  <option value="10000">$10K+</option>
                  <option value="50000">$50K+</option>
                  <option value="100000">$100K+</option>
                  <option value="500000">$500K+</option>
                </select>
              </div>

              {/* Max Age */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Max Age:</span>
                <select
                  value={filters.maxAge || ""}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      maxAge: e.target.value ? parseInt(e.target.value) : undefined,
                    }))
                  }
                  className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-white"
                >
                  <option value="">Any</option>
                  <option value="3600">1 hour</option>
                  <option value="21600">6 hours</option>
                  <option value="86400">24 hours</option>
                  <option value="604800">7 days</option>
                </select>
              </div>

              {/* Min Volume */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Min Vol:</span>
                <select
                  value={filters.minVolume || ""}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      minVolume: e.target.value ? parseInt(e.target.value) : undefined,
                    }))
                  }
                  className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-white"
                >
                  <option value="">Any</option>
                  <option value="100">$100+</option>
                  <option value="1000">$1K+</option>
                  <option value="10000">$10K+</option>
                  <option value="50000">$50K+</option>
                </select>
              </div>

              {/* Clear filters */}
              {(filters.minMarketCap || filters.maxAge || filters.minVolume) && (
                <button
                  onClick={() => setFilters({})}
                  className="text-sm text-red-400 hover:text-red-300"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* Error display */}
        {(tokensError || sseError) && (
          <div className="px-6 py-3 bg-red-500/10 border-b border-red-500/30">
            <p className="text-sm text-red-400">{tokensError || sseError}</p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {activeTab === "all" && (
            <TokenList
              tokens={tokens}
              isLoading={tokensLoading}
              watchlist={watchlist}
              onToggleWatchlist={toggleWatchlist}
              onSnipe={handleSnipeClick}
              formatPrice={formatPrice}
              formatMarketCap={formatMarketCap}
              formatVolume={formatVolume}
              formatAge={formatAge}
              formatChange={formatChange}
            />
          )}

          {activeTab === "new" && (
            <NewLaunchesList
              launches={launches}
              isConnected={sseConnected}
              watchlist={watchlist}
              onToggleWatchlist={toggleWatchlist}
              onSnipe={handleSnipeClick}
              formatPrice={formatPrice}
              formatAge={formatAge}
            />
          )}

          {activeTab === "watchlist" && (
            <TokenList
              tokens={watchlistTokens}
              isLoading={false}
              watchlist={watchlist}
              onToggleWatchlist={toggleWatchlist}
              onSnipe={handleSnipeClick}
              formatPrice={formatPrice}
              formatMarketCap={formatMarketCap}
              formatVolume={formatVolume}
              formatAge={formatAge}
              formatChange={formatChange}
              emptyMessage="No tokens in your watchlist. Click the star icon on any token to add it."
            />
          )}
        </div>

        {/* Footer with Load More */}
        {activeTab === "all" && hasMore && (
          <div className="px-6 py-3 border-t border-gray-800 flex justify-center">
            <button
              onClick={loadMore}
              disabled={tokensLoading}
              className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {tokensLoading ? "Loading..." : `Load More (${tokens.length}/${total})`}
            </button>
          </div>
        )}

        {/* Status bar */}
        <div className="px-6 py-2 border-t border-gray-800 flex items-center justify-between text-xs text-gray-500">
          <span>
            {activeTab === "all" && `${tokens.length} tokens loaded`}
            {activeTab === "new" && `${launches.length} recent launches`}
            {activeTab === "watchlist" && `${watchlistTokens.length} watched tokens`}
          </span>
          <span className="flex items-center gap-2">
            {sseConnected ? (
              <>
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                Live updates active
              </>
            ) : (
              <>
                <span className="w-2 h-2 bg-yellow-500 rounded-full" />
                Reconnecting...
              </>
            )}
          </span>
        </div>
      </div>

      {/* Snipe Modal */}
      {snipeModal.isOpen && snipeModal.token && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md bg-gray-900 rounded-lg border border-gray-700 shadow-2xl">
            {/* Snipe Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <div className="flex items-center gap-3">
                {snipeModal.token.imageUrl && (
                  <img
                    src={snipeModal.token.imageUrl}
                    alt={snipeModal.token.name}
                    className="w-10 h-10 rounded-full"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                )}
                <div>
                  <h3 className="text-lg font-bold text-white">{snipeModal.token.name}</h3>
                  <p className="text-sm text-gray-400">${snipeModal.token.symbol}</p>
                </div>
              </div>
              <button
                onClick={() => setSnipeModal({ isOpen: false, token: null })}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <svg
                  className="w-5 h-5 text-gray-400"
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

            {/* Snipe Modal Body */}
            <div className="px-6 py-4 space-y-4">
              {/* Amount input */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Amount (SOL)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={snipeAmount}
                    onChange={(e) => setSnipeAmount(e.target.value)}
                    min="0.001"
                    max="100"
                    step="0.01"
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white text-lg focus:outline-none focus:border-green-500"
                    placeholder="0.1"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                    SOL
                  </span>
                </div>
                <div className="flex gap-2 mt-2">
                  {[0.1, 0.25, 0.5, 1].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setSnipeAmount(amount.toString())}
                      className="flex-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-sm transition-colors"
                    >
                      {amount} SOL
                    </button>
                  ))}
                </div>
              </div>

              {/* Slippage input */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Slippage Tolerance
                </label>
                <div className="flex gap-2">
                  {[100, 300, 500, 1000].map((bps) => (
                    <button
                      key={bps}
                      onClick={() => setSlippageBps(bps)}
                      className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                        slippageBps === bps
                          ? "bg-green-500/20 text-green-400 border border-green-500/50"
                          : "bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700"
                      }`}
                    >
                      {bps / 100}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Get Quote button */}
              <button
                onClick={handleGetQuote}
                disabled={isQuoting || !snipeAmount || parseFloat(snipeAmount) <= 0}
                className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {isQuoting ? "Getting Quote..." : "Get Quote"}
              </button>

              {/* Quote display */}
              {quote && (
                <div className="bg-gray-800 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">You pay</span>
                    <span className="text-white">{(quote.inputAmount / 1e9).toFixed(4)} SOL</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">You receive (est.)</span>
                    <span className="text-green-400">
                      {quote.outputAmount.toLocaleString()} {snipeModal.token.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Min. received</span>
                    <span className="text-white">
                      {quote.minOutputAmount.toLocaleString()} {snipeModal.token.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Price Impact</span>
                    <span className={quote.priceImpact > 5 ? "text-red-400" : "text-white"}>
                      {quote.priceImpact.toFixed(2)}%
                    </span>
                  </div>
                </div>
              )}

              {/* Error display */}
              {snipeError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-sm text-red-400">{snipeError}</p>
                </div>
              )}
            </div>

            {/* Snipe Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-700">
              <button
                onClick={handleExecuteSnipe}
                disabled={!quote || isSniping}
                className="w-full py-3 bg-green-500 hover:bg-green-600 text-black font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSniping ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Sniping...
                  </span>
                ) : (
                  `Snipe ${snipeModal.token.symbol}`
                )}
              </button>
              <p className="text-xs text-gray-500 text-center mt-2">
                Transaction will be signed with your connected wallet
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Token List Component
interface TokenListProps {
  tokens: SniperToken[];
  isLoading: boolean;
  watchlist: string[];
  onToggleWatchlist: (mint: string) => void;
  onSnipe: (token: SniperToken) => void;
  formatPrice: (price: number) => string;
  formatMarketCap: (mcap: number) => string;
  formatVolume: (vol: number) => string;
  formatAge: (seconds: number) => string;
  formatChange: (change: number) => string;
  emptyMessage?: string;
}

function TokenList({
  tokens,
  isLoading,
  watchlist,
  onToggleWatchlist,
  onSnipe,
  formatPrice,
  formatMarketCap,
  formatVolume,
  formatAge,
  formatChange,
  emptyMessage,
}: TokenListProps) {
  if (isLoading && tokens.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500" />
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
        <p className="text-center max-w-md">
          {emptyMessage || "No tokens found matching your filters."}
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-800">
      {/* Header */}
      <div className="grid grid-cols-12 gap-2 px-6 py-3 text-xs text-gray-500 uppercase tracking-wider bg-gray-800/50 sticky top-0">
        <div className="col-span-3">Token</div>
        <div className="col-span-2 text-right">Price</div>
        <div className="col-span-2 text-right">Market Cap</div>
        <div className="col-span-1 text-right">Vol 24h</div>
        <div className="col-span-1 text-right">Change</div>
        <div className="col-span-1 text-right">Age</div>
        <div className="col-span-2 text-right">Action</div>
      </div>

      {/* Rows */}
      {tokens.map((token) => (
        <div
          key={token.mint}
          className="grid grid-cols-12 gap-2 px-6 py-4 hover:bg-gray-800/50 transition-colors items-center"
        >
          {/* Token info */}
          <div className="col-span-3 flex items-center gap-3 min-w-0">
            <button
              onClick={() => onToggleWatchlist(token.mint)}
              className={`flex-shrink-0 p-1 rounded transition-colors ${
                watchlist.includes(token.mint)
                  ? "text-yellow-400"
                  : "text-gray-600 hover:text-gray-400"
              }`}
            >
              <svg
                className="w-5 h-5"
                fill={watchlist.includes(token.mint) ? "currentColor" : "none"}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
            </button>
            {token.imageUrl && (
              <img
                src={token.imageUrl}
                alt={token.name}
                className="w-8 h-8 rounded-full flex-shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <div className="min-w-0">
              <p className="font-medium text-white truncate">{token.name}</p>
              <p className="text-xs text-gray-400">${token.symbol}</p>
            </div>
            {token.isNewLaunch && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-green-500/20 text-green-400 rounded">
                NEW
              </span>
            )}
          </div>

          {/* Price */}
          <div className="col-span-2 text-right">
            <p className="text-white font-medium">{formatPrice(token.priceUsd)}</p>
          </div>

          {/* Market Cap */}
          <div className="col-span-2 text-right">
            <p className="text-white">{formatMarketCap(token.marketCap)}</p>
          </div>

          {/* Volume */}
          <div className="col-span-1 text-right">
            <p className="text-gray-400">{formatVolume(token.volume24h)}</p>
          </div>

          {/* Change */}
          <div className="col-span-1 text-right">
            <p className={token.change24h >= 0 ? "text-green-400" : "text-red-400"}>
              {formatChange(token.change24h)}
            </p>
          </div>

          {/* Age */}
          <div className="col-span-1 text-right">
            <p className="text-gray-400">{formatAge(token.ageSeconds)}</p>
          </div>

          {/* Action */}
          <div className="col-span-2 text-right">
            <button
              onClick={() => onSnipe(token)}
              className="px-4 py-1.5 bg-green-500 hover:bg-green-600 text-black font-bold text-sm rounded transition-colors"
            >
              SNIPE
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// New Launches List Component
interface NewLaunchesListProps {
  launches: SniperNewLaunch[];
  isConnected: boolean;
  watchlist: string[];
  onToggleWatchlist: (mint: string) => void;
  onSnipe: (launch: SniperNewLaunch) => void;
  formatPrice: (price: number) => string;
  formatAge: (seconds: number) => string;
}

function NewLaunchesList({
  launches,
  isConnected,
  watchlist,
  onToggleWatchlist,
  onSnipe,
  formatPrice,
  formatAge,
}: NewLaunchesListProps) {
  if (launches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <div
          className={`w-16 h-16 mb-4 rounded-full border-2 flex items-center justify-center ${isConnected ? "border-green-500" : "border-yellow-500"}`}
        >
          {isConnected ? (
            <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse" />
          ) : (
            <svg className="w-8 h-8 text-yellow-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          )}
        </div>
        <p className="font-medium text-white mb-2">
          {isConnected ? "Listening for new launches..." : "Connecting to live feed..."}
        </p>
        <p className="text-sm text-center max-w-md">
          New Bags.fm token launches will appear here in real-time. Keep this tab open to catch the
          latest drops.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-800">
      {launches.map((launch) => (
        <div key={launch.mint} className="px-6 py-4 hover:bg-gray-800/50 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => onToggleWatchlist(launch.mint)}
                className={`p-1 rounded transition-colors ${
                  watchlist.includes(launch.mint)
                    ? "text-yellow-400"
                    : "text-gray-600 hover:text-gray-400"
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill={watchlist.includes(launch.mint) ? "currentColor" : "none"}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                  />
                </svg>
              </button>
              {launch.imageUrl && (
                <img
                  src={launch.imageUrl}
                  alt={launch.name}
                  className="w-12 h-12 rounded-full"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-white text-lg">{launch.name}</p>
                  <span className="px-2 py-0.5 text-xs font-bold bg-green-500 text-black rounded-full animate-pulse">
                    NEW
                  </span>
                </div>
                <p className="text-sm text-gray-400">${launch.symbol}</p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-sm text-gray-400">Launched</p>
                <p className="text-white font-medium">{formatAge(launch.ageSeconds)} ago</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">Price</p>
                <p className="text-white font-medium">{formatPrice(launch.currentPrice)}</p>
              </div>
              {launch.priceChange !== 0 && (
                <div className="text-right">
                  <p className="text-sm text-gray-400">Change</p>
                  <p
                    className={
                      launch.priceChange >= 0
                        ? "text-green-400 font-medium"
                        : "text-red-400 font-medium"
                    }
                  >
                    {launch.priceChange >= 0 ? "+" : ""}
                    {launch.priceChange.toFixed(2)}%
                  </p>
                </div>
              )}
              <button
                onClick={() => onSnipe(launch)}
                className="px-6 py-2 bg-green-500 hover:bg-green-600 text-black font-bold rounded-lg transition-colors"
              >
                SNIPE NOW
              </button>
            </div>
          </div>

          {/* Creator info */}
          <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
            <span>
              Creator: {launch.creator.slice(0, 4)}...{launch.creator.slice(-4)}
            </span>
            <a
              href={`https://solscan.io/tx/${launch.signature}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-300 transition-colors"
            >
              View TX
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
