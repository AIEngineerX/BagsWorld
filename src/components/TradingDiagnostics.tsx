"use client";

import { useState, useEffect, useCallback } from "react";

// ============================================================================
// TYPES
// ============================================================================

interface GhostStatus {
  success: boolean;
  wallet: { address: string | null; balanceSol: number };
  trading: {
    enabled: boolean;
    openPositions: number;
    totalExposureSol: number;
    maxExposureSol: number;
    maxPositions: number;
  };
  performance: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnlSol: number;
    winRate: string;
  };
  config: {
    minPositionSol: number;
    maxPositionSol: number;
    takeProfitTiers: number[];
    trailingStopPercent: number;
    stopLossPercent: number;
    minLiquidityUsd: number;
    minBuySellRatio: number;
    slippageBps: number;
  };
  smartMoneyWallets: Array<{ address: string; label: string }>;
}

interface GhostPosition {
  id: string;
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  status: "open" | "closed" | "failed";
  entryPriceSol: number;
  amountSol: number;
  entryReason: string;
  exitReason?: string;
  pnlSol?: number;
  createdAt: string;
  closedAt?: string;
  peakMultiplier?: number;
}

interface LearningSignal {
  signal: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: string;
  totalPnl: string;
  avgPnl: string;
  scoreAdjustment: number;
}

interface LearningData {
  success: boolean;
  learning: {
    totalSignalsTracked: number;
    totalTradesAnalyzed: number;
    bestSignals: string[];
    worstSignals: string[];
  };
  signals: LearningSignal[];
}

interface ScanEvaluation {
  token: { name: string; symbol: string; mint: string };
  metrics: {
    ageSeconds: number;
    marketCapUsd: number;
    liquidityUsd: number;
    volume24hUsd: number;
    buySellRatio: string;
    holders: number;
    lifetimeFees: string;
  };
  score: number;
  reasons: string[];
  redFlags: string[];
  verdict: "BUY" | "PASS";
}

interface LiveScanData {
  success: boolean;
  message: string;
  evaluations: ScanEvaluation[];
  summary: { total: number; buySignals: number; passSignals: number };
  config: {
    minLiquidityUsd: number;
    minMarketCapUsd: number;
    minLaunchAgeSec: number;
    maxLaunchAgeSec: number;
    requiredScore: number;
  };
}

interface DiagData {
  status: GhostStatus | null;
  positions: GhostPosition[];
  learning: LearningData | null;
  liveScan: LiveScanData | null;
  error: string | null;
}

type TabId = "scan" | "overview" | "positions" | "brain" | "config";

// ============================================================================
// ANIMATED HELPERS
// ============================================================================

/** Animated score bar that fills up */
function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.min(100, (score / max) * 100);
  const color =
    score >= 55
      ? "from-green-600 to-green-400"
      : score >= 40
        ? "from-yellow-600 to-yellow-400"
        : "from-red-600 to-red-400";
  return (
    <div className="h-1.5 bg-gray-800 overflow-hidden w-full">
      <div
        className={`h-full bg-gradient-to-r ${color} transition-all duration-1000 ease-out`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Pulsing dot */
function PulseDot({ color }: { color: string }) {
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full ${color} animate-pulse shadow-[0_0_4px_currentColor]`}
    />
  );
}

/** Pipeline step — shows the logic flow */
function PipelineStep({
  label,
  status,
  detail,
  index,
}: {
  label: string;
  status: "pass" | "fail" | "checking";
  detail: string;
  index: number;
}) {
  const statusIcon = status === "pass" ? ">" : status === "fail" ? "X" : "~";
  const statusColor =
    status === "pass" ? "text-green-400" : status === "fail" ? "text-red-400" : "text-yellow-400";
  const borderColor =
    status === "pass"
      ? "border-green-500/30"
      : status === "fail"
        ? "border-red-500/30"
        : "border-yellow-500/30";

  return (
    <div
      className={`flex items-start gap-2 border-l-2 ${borderColor} pl-2 py-1 animate-[fadeSlideIn_0.3s_ease-out_both]`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <span className={`font-pixel text-[9px] ${statusColor} shrink-0`}>[{statusIcon}]</span>
      <div className="min-w-0">
        <span className="font-pixel text-[8px] text-gray-300">{label}</span>
        <p className="font-pixel text-[7px] text-gray-500 truncate">{detail}</p>
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

// Shared state so the footer button can open the modal
let _openModal: (() => void) | null = null;

/** Inline footer button — renders [GHOST] in the status bar */
export function GhostTraderButton() {
  return (
    <button
      onClick={() => _openModal?.()}
      className="text-bags-gold hover:text-yellow-300 transition-colors"
    >
      [GHOST]
    </button>
  );
}

export function TradingDiagnostics() {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<DiagData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tab, setTab] = useState<TabId>("scan");
  const [scanLine, setScanLine] = useState(0);
  const [scanStep, setScanStep] = useState(0);

  // Register opener so the footer button can trigger the modal
  useEffect(() => {
    _openModal = () => setIsOpen(true);
    return () => {
      _openModal = null;
    };
  }, []);

  // Animated scan line
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setScanLine((prev) => (prev >= 100 ? 0 : prev + 0.5));
    }, 30);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Animate scan steps when on the scan tab
  useEffect(() => {
    if (!isOpen || tab !== "scan" || !data?.liveScan) return;
    setScanStep(0);
    const total = (data.liveScan.evaluations.length || 0) + 3; // +3 for pipeline intro steps
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setScanStep(step);
      if (step >= total) clearInterval(interval);
    }, 200);
    return () => clearInterval(interval);
  }, [isOpen, tab, data?.liveScan]);

  const fetchAll = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/agent-economy/diagnostics");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();

      setData({
        status: result.ghostTrader?.connected ? result.ghostTrader.raw : null,
        positions: result.positions || [],
        learning: result.learning || null,
        liveScan: result.liveScan || null,
        error: result.ghostTrader?.connected === false ? result.ghostTrader.error : null,
      });
    } catch (err) {
      setData({
        status: null,
        positions: [],
        learning: null,
        liveScan: null,
        error: err instanceof Error ? err.message : "Failed to load",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchAll();
      const interval = setInterval(fetchAll, 30000);
      return () => clearInterval(interval);
    }
  }, [isOpen, fetchAll]);

  const s = data?.status;
  const perf = s?.performance;
  const trading = s?.trading;
  const winRateNum = perf ? parseFloat(perf.winRate) : 0;
  const pnl = perf?.totalPnlSol ?? 0;
  const isLive = trading?.enabled ?? false;
  const scan = data?.liveScan;

  const openPositions = data?.positions.filter((p) => p.status === "open") ?? [];
  const closedPositions = data?.positions.filter((p) => p.status === "closed") ?? [];

  return (
    <>
      {/* ================================================================ */}
      {/* MODAL                                                           */}
      {/* ================================================================ */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal */}
          <div className="relative w-full max-w-lg bg-bags-dark border-2 border-yellow-500/60 shadow-[0_0_40px_rgba(234,179,8,0.15)] overflow-hidden">
            {/* Scan line animation */}
            <div
              className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-400/30 to-transparent pointer-events-none z-10"
              style={{ top: `${scanLine}%` }}
            />

            {/* Top gold bar */}
            <div className="h-1 bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600" />

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-yellow-500/30 bg-gradient-to-b from-yellow-900/20 to-transparent">
              <div>
                <h2 className="font-pixel text-sm text-yellow-300 tracking-wider flex items-center gap-2">
                  GHOST TRADER
                  <span
                    className={`text-[8px] px-1.5 py-0.5 border ${
                      isLive
                        ? "border-green-500/50 text-green-400 bg-green-500/10"
                        : "border-red-500/50 text-red-400 bg-red-500/10"
                    }`}
                  >
                    {isLive ? "LIVE" : "OFFLINE"}
                  </span>
                </h2>
                <p className="font-pixel text-[8px] text-yellow-600/80 mt-0.5">
                  AUTONOMOUS TRADING TERMINAL
                  <a
                    href="https://t.me/AgentDaddyGhost"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-400/80 hover:text-blue-300 transition-colors"
                  >
                    [TG]
                  </a>
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="font-pixel text-xs text-yellow-600 hover:text-yellow-300 transition-colors"
              >
                [X]
              </button>
            </div>

            {/* Stats ribbon */}
            {s && (
              <div className="flex border-b border-yellow-500/20 bg-black/30">
                <div className="flex-1 px-3 py-2 text-center border-r border-yellow-500/10">
                  <p className="font-pixel text-[7px] text-yellow-600/60">BALANCE</p>
                  <p className="font-pixel text-[11px] text-yellow-300">
                    {s.wallet.balanceSol.toFixed(3)} SOL
                  </p>
                </div>
                <div className="flex-1 px-3 py-2 text-center border-r border-yellow-500/10">
                  <p className="font-pixel text-[7px] text-yellow-600/60">PNL</p>
                  <p
                    className={`font-pixel text-[11px] ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}
                  >
                    {pnl >= 0 ? "+" : ""}
                    {pnl.toFixed(4)}
                  </p>
                </div>
                <div className="flex-1 px-3 py-2 text-center border-r border-yellow-500/10">
                  <p className="font-pixel text-[7px] text-yellow-600/60">WIN RATE</p>
                  <p
                    className={`font-pixel text-[11px] ${winRateNum >= 50 ? "text-green-400" : winRateNum > 0 ? "text-yellow-400" : "text-gray-500"}`}
                  >
                    {perf?.winRate || "0%"}
                  </p>
                </div>
                <div className="flex-1 px-3 py-2 text-center">
                  <p className="font-pixel text-[7px] text-yellow-600/60">TRADES</p>
                  <p className="font-pixel text-[11px] text-yellow-300">{perf?.totalTrades ?? 0}</p>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-yellow-500/20">
              {(["scan", "overview", "positions", "brain", "config"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2 font-pixel text-[8px] sm:text-[9px] transition-all ${
                    tab === t
                      ? "text-yellow-300 bg-yellow-500/10 border-b-2 border-yellow-400"
                      : "text-yellow-600/60 hover:text-yellow-400 hover:bg-yellow-500/5"
                  }`}
                >
                  {t === "scan"
                    ? "LIVE SCAN"
                    : t === "overview"
                      ? "STATS"
                      : t === "positions"
                        ? `TRADES (${openPositions.length})`
                        : t === "brain"
                          ? "BRAIN"
                          : "CONFIG"}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="max-h-[50vh] overflow-y-auto p-4 space-y-3">
              {isLoading && !data ? (
                <div className="text-center py-8">
                  <p className="font-pixel text-[10px] text-yellow-400 animate-pulse">
                    CONNECTING TO ELIZAOS...
                  </p>
                  <div className="mt-2 mx-auto w-32 h-1 bg-yellow-900/30 overflow-hidden">
                    <div className="h-full w-8 bg-yellow-400/50 animate-[shimmer_1s_infinite]" />
                  </div>
                </div>
              ) : data?.error && !s ? (
                <div className="bg-red-500/5 border border-red-500/30 p-4 text-center">
                  <p className="font-pixel text-[10px] text-red-400">{data.error}</p>
                  <p className="font-pixel text-[8px] text-gray-500 mt-2">
                    Ghost is resting. Check back soon.
                  </p>
                </div>
              ) : (
                <>
                  {/* ============================================== */}
                  {/* LIVE SCAN TAB — Real-time evaluation pipeline  */}
                  {/* ============================================== */}
                  {tab === "scan" && (
                    <>
                      {/* Pipeline flow diagram */}
                      <div className="bg-black/40 border border-yellow-500/20 p-3">
                        <div className="flex items-center gap-2 mb-3">
                          <PulseDot color="text-yellow-400" />
                          <p className="font-pixel text-[9px] text-yellow-300">DECISION PIPELINE</p>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap font-pixel text-[7px]">
                          {[
                            "FETCH LAUNCHES",
                            "HARD FILTERS",
                            "SCORE (5 AXES)",
                            "SMART MONEY",
                            "LEARNING ADJ",
                            "BUY/PASS",
                          ].map((step, i) => (
                            <span key={step} className="flex items-center gap-1">
                              <span
                                className={`px-1.5 py-0.5 border transition-all duration-500 ${
                                  scanStep > i
                                    ? "border-green-500/40 text-green-400 bg-green-500/10"
                                    : "border-yellow-500/20 text-yellow-600/40"
                                }`}
                              >
                                {step}
                              </span>
                              {i < 5 && (
                                <span
                                  className={`transition-colors duration-500 ${scanStep > i ? "text-green-400" : "text-yellow-600/20"}`}
                                >
                                  &gt;
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Scoring weights explanation */}
                      <div className="bg-black/40 border border-yellow-500/20 p-3">
                        <p className="font-pixel text-[8px] text-yellow-600/60 mb-2">
                          SCORING WEIGHTS
                        </p>
                        <div className="space-y-1.5">
                          {[
                            {
                              label: "VOL/MCAP RATIO",
                              weight: 25,
                              desc: "Trading volume vs market cap",
                            },
                            {
                              label: "BUY/SELL PRESSURE",
                              weight: 25,
                              desc: "Buyers outweighing sellers",
                            },
                            {
                              label: "PRICE MOMENTUM",
                              weight: 20,
                              desc: "24h price action direction",
                            },
                            {
                              label: "LIQUIDITY DEPTH",
                              weight: 15,
                              desc: "Available pool liquidity",
                            },
                            { label: "TOKEN AGE", weight: 15, desc: "Rug risk assessment" },
                          ].map((w) => (
                            <div key={w.label}>
                              <div className="flex justify-between items-center">
                                <span className="font-pixel text-[7px] text-gray-300">
                                  {w.label}
                                </span>
                                <span className="font-pixel text-[7px] text-yellow-400">
                                  {w.weight}pts
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <div className="flex-1 h-1 bg-gray-800 overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 transition-all duration-1000"
                                    style={{ width: `${w.weight}%` }}
                                  />
                                </div>
                                <span className="font-pixel text-[6px] text-gray-500 w-24 text-right">
                                  {w.desc}
                                </span>
                              </div>
                            </div>
                          ))}
                          <div className="flex items-center gap-2 mt-1 pt-1 border-t border-yellow-500/10">
                            <span className="font-pixel text-[7px] text-yellow-600/60">
                              BONUSES:
                            </span>
                            <span className="font-pixel text-[6px] text-gray-400">
                              Fee Claims +10, Smart Money +15, BagBot +15, Holders +5, Learning
                              +/-10
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <span className="font-pixel text-[7px] text-green-400">
                              BUY THRESHOLD: 55+
                            </span>
                            <span className="font-pixel text-[6px] text-gray-500">
                              with zero red flags
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Live evaluation results */}
                      {scan ? (
                        <div className="bg-black/40 border border-yellow-500/20 p-3">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <PulseDot color="text-green-400" />
                              <p className="font-pixel text-[9px] text-yellow-300">
                                LATEST SCAN ({scan.summary.total} tokens)
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <span className="font-pixel text-[7px] text-green-400">
                                {scan.summary.buySignals} BUY
                              </span>
                              <span className="font-pixel text-[7px] text-red-400">
                                {scan.summary.passSignals} PASS
                              </span>
                            </div>
                          </div>

                          <div className="space-y-3">
                            {scan.evaluations.map((ev, i) => (
                              <div
                                key={ev.token.mint}
                                className={`border p-2.5 transition-all duration-300 ${
                                  ev.verdict === "BUY"
                                    ? "border-green-500/40 bg-green-500/5"
                                    : "border-yellow-500/10 bg-black/20"
                                }`}
                                style={{ animationDelay: `${(i + 3) * 100}ms` }}
                              >
                                {/* Token header */}
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`font-pixel text-[10px] ${ev.verdict === "BUY" ? "text-green-400" : "text-gray-300"}`}
                                    >
                                      ${ev.token.symbol}
                                    </span>
                                    <span className="font-pixel text-[7px] text-gray-500 truncate max-w-[100px]">
                                      {ev.token.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-pixel text-[10px] text-yellow-300">
                                      {ev.score}
                                    </span>
                                    <span
                                      className={`font-pixel text-[8px] px-1.5 py-0.5 border ${
                                        ev.verdict === "BUY"
                                          ? "border-green-500/50 text-green-400 bg-green-500/10"
                                          : "border-gray-500/50 text-gray-400 bg-gray-500/10"
                                      }`}
                                    >
                                      {ev.verdict}
                                    </span>
                                  </div>
                                </div>

                                {/* Score bar */}
                                <ScoreBar score={ev.score} />

                                {/* Metrics row */}
                                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                                  <span className="font-pixel text-[6px] text-gray-400">
                                    MCap:{" "}
                                    <span className="text-white">
                                      ${(ev.metrics.marketCapUsd / 1000).toFixed(1)}K
                                    </span>
                                  </span>
                                  <span className="font-pixel text-[6px] text-gray-400">
                                    Liq:{" "}
                                    <span className="text-white">
                                      ${(ev.metrics.liquidityUsd / 1000).toFixed(1)}K
                                    </span>
                                  </span>
                                  <span className="font-pixel text-[6px] text-gray-400">
                                    Vol:{" "}
                                    <span className="text-white">
                                      ${(ev.metrics.volume24hUsd / 1000).toFixed(1)}K
                                    </span>
                                  </span>
                                  <span className="font-pixel text-[6px] text-gray-400">
                                    B/S:{" "}
                                    <span className="text-white">{ev.metrics.buySellRatio}x</span>
                                  </span>
                                  <span className="font-pixel text-[6px] text-gray-400">
                                    Holders:{" "}
                                    <span className="text-white">{ev.metrics.holders}</span>
                                  </span>
                                </div>

                                {/* Reasons — the logic flow */}
                                {ev.reasons.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {ev.reasons.map((r) => (
                                      <span
                                        key={r}
                                        className="font-pixel text-[6px] text-green-400/80 bg-green-500/10 border border-green-500/15 px-1.5 py-0.5"
                                      >
                                        {r}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Red flags */}
                                {ev.redFlags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {ev.redFlags.map((r) => (
                                      <span
                                        key={r}
                                        className="font-pixel text-[6px] text-red-400/80 bg-red-500/10 border border-red-500/15 px-1.5 py-0.5"
                                      >
                                        {r}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          {scan.evaluations.length === 0 && (
                            <p className="font-pixel text-[8px] text-gray-500 text-center py-4">
                              No recent launches to evaluate
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-6">
                          <p className="font-pixel text-[10px] text-gray-500">
                            SCAN DATA LOADING...
                          </p>
                          <p className="font-pixel text-[8px] text-gray-600 mt-1">
                            Waiting for ElizaOS dry-run response
                          </p>
                        </div>
                      )}

                      {/* Position management rules */}
                      <div className="bg-black/40 border border-yellow-500/20 p-3">
                        <p className="font-pixel text-[8px] text-yellow-600/60 mb-2">
                          EXIT RULES (AFTER BUY)
                        </p>
                        <div className="space-y-1">
                          <PipelineStep
                            index={0}
                            label="STOP LOSS"
                            status="pass"
                            detail={`Cut losses at -${s?.config.stopLossPercent ?? 15}%`}
                          />
                          <PipelineStep
                            index={1}
                            label="DEAD POSITION"
                            status="pass"
                            detail="8hr hold + no volume + decaying = auto-close"
                          />
                          <PipelineStep
                            index={2}
                            label="TRAILING STOP"
                            status="pass"
                            detail={`After 2x, trail by ${s?.config.trailingStopPercent ?? 10}% from peak`}
                          />
                          <PipelineStep
                            index={3}
                            label="TAKE PROFIT"
                            status="pass"
                            detail={`Close at ${s?.config.takeProfitTiers?.map((t) => `${t}x`).join(", ") ?? "1.5x, 2x, 3x"}`}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* ============================================== */}
                  {/* OVERVIEW TAB                                   */}
                  {/* ============================================== */}
                  {tab === "overview" && s && (
                    <>
                      {/* Exposure meter */}
                      <div className="bg-black/30 border border-yellow-500/20 p-3">
                        <div className="flex justify-between mb-1.5">
                          <span className="font-pixel text-[8px] text-yellow-600/60">EXPOSURE</span>
                          <span className="font-pixel text-[9px] text-yellow-300">
                            {trading!.totalExposureSol.toFixed(2)} /{" "}
                            {trading!.maxExposureSol.toFixed(1)} SOL
                          </span>
                        </div>
                        <div className="h-2 bg-yellow-900/30 border border-yellow-500/20 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 transition-all duration-500"
                            style={{
                              width: `${Math.min(100, (trading!.totalExposureSol / trading!.maxExposureSol) * 100)}%`,
                            }}
                          />
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="font-pixel text-[7px] text-gray-500">
                            {trading!.openPositions}/{trading!.maxPositions} slots used
                          </span>
                          <span className="font-pixel text-[7px] text-gray-500">
                            {(
                              100 -
                              (trading!.totalExposureSol / trading!.maxExposureSol) * 100
                            ).toFixed(0)}
                            % available
                          </span>
                        </div>
                      </div>

                      {/* W/L Breakdown */}
                      <div className="bg-black/30 border border-yellow-500/20 p-3">
                        <p className="font-pixel text-[8px] text-yellow-600/60 mb-2">
                          TRADE HISTORY
                        </p>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="flex gap-1 h-3">
                              {perf!.totalTrades > 0 ? (
                                <>
                                  <div
                                    className="bg-green-500/70 h-full transition-all"
                                    style={{
                                      width: `${(perf!.winningTrades / perf!.totalTrades) * 100}%`,
                                    }}
                                  />
                                  <div
                                    className="bg-red-500/70 h-full transition-all"
                                    style={{
                                      width: `${(perf!.losingTrades / perf!.totalTrades) * 100}%`,
                                    }}
                                  />
                                </>
                              ) : (
                                <div className="bg-gray-700 h-full w-full" />
                              )}
                            </div>
                          </div>
                          <div className="font-pixel text-[9px] shrink-0">
                            <span className="text-green-400">{perf!.winningTrades}W</span>
                            <span className="text-gray-500"> / </span>
                            <span className="text-red-400">{perf!.losingTrades}L</span>
                          </div>
                        </div>
                      </div>

                      {/* Wallet */}
                      {s.wallet.address && (
                        <div className="bg-black/30 border border-yellow-500/20 p-3">
                          <p className="font-pixel text-[8px] text-yellow-600/60 mb-1">WALLET</p>
                          <p className="font-pixel text-[9px] text-yellow-300/80 font-mono tracking-wider">
                            {s.wallet.address.slice(0, 12)}...{s.wallet.address.slice(-8)}
                          </p>
                        </div>
                      )}

                      {/* Smart Money tracking */}
                      {s.smartMoneyWallets && s.smartMoneyWallets.length > 0 && (
                        <div className="bg-black/30 border border-yellow-500/20 p-3">
                          <p className="font-pixel text-[8px] text-yellow-600/60 mb-2">
                            SMART MONEY TRACKING ({s.smartMoneyWallets.length})
                          </p>
                          <div className="grid grid-cols-2 gap-1">
                            {s.smartMoneyWallets.slice(0, 6).map((w) => (
                              <div
                                key={w.address}
                                className="flex items-center gap-1.5 text-[7px] font-pixel"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500/50" />
                                <span className="text-gray-400 truncate">{w.label}</span>
                              </div>
                            ))}
                          </div>
                          {s.smartMoneyWallets.length > 6 && (
                            <p className="font-pixel text-[7px] text-gray-600 mt-1">
                              +{s.smartMoneyWallets.length - 6} more wallets
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* ============================================== */}
                  {/* POSITIONS TAB                                  */}
                  {/* ============================================== */}
                  {tab === "positions" && (
                    <>
                      {openPositions.length > 0 && (
                        <div>
                          <p className="font-pixel text-[8px] text-yellow-600/60 mb-2">
                            OPEN POSITIONS
                          </p>
                          <div className="space-y-2">
                            {openPositions.map((pos) => (
                              <div
                                key={pos.id}
                                className="bg-black/30 border border-yellow-500/30 p-3"
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <span className="font-pixel text-[11px] text-yellow-300">
                                      ${pos.tokenSymbol}
                                    </span>
                                    <span className="font-pixel text-[8px] text-gray-500 ml-2">
                                      {pos.tokenName}
                                    </span>
                                  </div>
                                  <span className="font-pixel text-[10px] text-yellow-400">
                                    {pos.amountSol.toFixed(3)} SOL
                                  </span>
                                </div>
                                <p className="font-pixel text-[7px] text-green-400/80 mt-1">
                                  {pos.entryReason}
                                </p>
                                <p className="font-pixel text-[7px] text-gray-600 mt-0.5">
                                  {new Date(pos.createdAt).toLocaleString()}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {closedPositions.length > 0 && (
                        <div>
                          <p className="font-pixel text-[8px] text-yellow-600/60 mb-2 mt-2">
                            RECENT CLOSED
                          </p>
                          <div className="space-y-1">
                            {closedPositions.slice(0, 8).map((pos) => (
                              <div
                                key={pos.id}
                                className="flex items-center justify-between bg-black/20 border border-yellow-500/10 px-3 py-1.5"
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`font-pixel text-[8px] ${(pos.pnlSol ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}
                                  >
                                    {(pos.pnlSol ?? 0) >= 0 ? "W" : "L"}
                                  </span>
                                  <span className="font-pixel text-[9px] text-white">
                                    ${pos.tokenSymbol}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-pixel text-[8px] text-gray-500">
                                    {pos.amountSol.toFixed(2)}
                                  </span>
                                  <span
                                    className={`font-pixel text-[9px] ${(pos.pnlSol ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}
                                  >
                                    {(pos.pnlSol ?? 0) >= 0 ? "+" : ""}
                                    {(pos.pnlSol ?? 0).toFixed(4)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {openPositions.length === 0 && closedPositions.length === 0 && (
                        <div className="text-center py-6">
                          <p className="font-pixel text-[10px] text-gray-500">NO POSITIONS YET</p>
                          <p className="font-pixel text-[8px] text-gray-600 mt-1">
                            Ghost is scanning for opportunities...
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {/* ============================================== */}
                  {/* BRAIN TAB — Learning insights                  */}
                  {/* ============================================== */}
                  {tab === "brain" && (
                    <>
                      {data?.learning ? (
                        <>
                          <div className="bg-black/30 border border-yellow-500/20 p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <PulseDot color="text-purple-400" />
                              <p className="font-pixel text-[9px] text-yellow-300">
                                SELF-LEARNING ENGINE
                              </p>
                            </div>
                            <p className="font-pixel text-[7px] text-gray-500 mb-3">
                              Ghost tracks which entry signals lead to wins vs losses. After 3+
                              trades per signal, future scoring is automatically adjusted: winning
                              signals get bonus points, losing signals get penalties.
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <p className="font-pixel text-[7px] text-gray-500">
                                  Signals Tracked
                                </p>
                                <p className="font-pixel text-[11px] text-yellow-300">
                                  {data.learning.learning.totalSignalsTracked}
                                </p>
                              </div>
                              <div>
                                <p className="font-pixel text-[7px] text-gray-500">
                                  Trades Analyzed
                                </p>
                                <p className="font-pixel text-[11px] text-yellow-300">
                                  {data.learning.learning.totalTradesAnalyzed}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Best signals */}
                          {data.learning.learning.bestSignals.length > 0 && (
                            <div className="bg-black/30 border border-green-500/20 p-3">
                              <p className="font-pixel text-[8px] text-green-400/60 mb-2">
                                BEST SIGNALS (70%+ win rate)
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {data.learning.learning.bestSignals.map((sig) => (
                                  <span
                                    key={sig}
                                    className="font-pixel text-[8px] text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5"
                                  >
                                    {sig}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Worst signals */}
                          {data.learning.learning.worstSignals.length > 0 && (
                            <div className="bg-black/30 border border-red-500/20 p-3">
                              <p className="font-pixel text-[8px] text-red-400/60 mb-2">
                                WORST SIGNALS (30%- win rate)
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {data.learning.learning.worstSignals.map((sig) => (
                                  <span
                                    key={sig}
                                    className="font-pixel text-[8px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5"
                                  >
                                    {sig}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Signal performance table */}
                          {data.learning.signals.length > 0 && (
                            <div className="bg-black/30 border border-yellow-500/20 p-3">
                              <p className="font-pixel text-[8px] text-yellow-600/60 mb-2">
                                SIGNAL PERFORMANCE
                              </p>
                              <div className="space-y-1">
                                {data.learning.signals
                                  .sort((a, b) => b.trades - a.trades)
                                  .slice(0, 10)
                                  .map((sig) => (
                                    <div
                                      key={sig.signal}
                                      className="flex items-center justify-between"
                                    >
                                      <span className="font-pixel text-[8px] text-gray-300 truncate max-w-[140px]">
                                        {sig.signal}
                                      </span>
                                      <div className="flex items-center gap-3">
                                        <span className="font-pixel text-[7px] text-gray-500">
                                          {sig.trades}t
                                        </span>
                                        <span
                                          className={`font-pixel text-[8px] ${parseFloat(sig.winRate) >= 50 ? "text-green-400" : "text-red-400"}`}
                                        >
                                          {sig.winRate}
                                        </span>
                                        <span
                                          className={`font-pixel text-[8px] w-12 text-right ${sig.scoreAdjustment > 0 ? "text-green-400" : sig.scoreAdjustment < 0 ? "text-red-400" : "text-gray-500"}`}
                                        >
                                          {sig.scoreAdjustment > 0 ? "+" : ""}
                                          {sig.scoreAdjustment}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-6">
                          <p className="font-pixel text-[10px] text-gray-500">
                            LEARNING DATA UNAVAILABLE
                          </p>
                          <p className="font-pixel text-[8px] text-gray-600 mt-1">
                            Ghost needs more trades to build signal intelligence
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {/* ============================================== */}
                  {/* CONFIG TAB                                     */}
                  {/* ============================================== */}
                  {tab === "config" && s && (
                    <>
                      <div className="bg-black/30 border border-yellow-500/20 p-3">
                        <p className="font-pixel text-[8px] text-yellow-600/60 mb-2">
                          RISK MANAGEMENT
                        </p>
                        <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                          {[
                            ["Stop Loss", `${s.config.stopLossPercent}%`],
                            [
                              "Take Profit",
                              s.config.takeProfitTiers.map((t) => `${t}x`).join(", "),
                            ],
                            ["Trailing Stop", `${s.config.trailingStopPercent}%`],
                            ["Slippage", `${s.config.slippageBps / 100}%`],
                          ].map(([label, value]) => (
                            <div key={label}>
                              <p className="font-pixel text-[7px] text-gray-500">{label}</p>
                              <p className="font-pixel text-[10px] text-yellow-300">{value}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-black/30 border border-yellow-500/20 p-3">
                        <p className="font-pixel text-[8px] text-yellow-600/60 mb-2">
                          POSITION SIZING
                        </p>
                        <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                          {[
                            ["Min Position", `${s.config.minPositionSol} SOL`],
                            ["Max Position", `${s.config.maxPositionSol} SOL`],
                            ["Max Exposure", `${trading!.maxExposureSol} SOL`],
                            ["Max Positions", `${trading!.maxPositions}`],
                          ].map(([label, value]) => (
                            <div key={label}>
                              <p className="font-pixel text-[7px] text-gray-500">{label}</p>
                              <p className="font-pixel text-[10px] text-yellow-300">{value}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-black/30 border border-yellow-500/20 p-3">
                        <p className="font-pixel text-[8px] text-yellow-600/60 mb-2">
                          ENTRY FILTERS
                        </p>
                        <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                          {[
                            ["Min Liquidity", `$${s.config.minLiquidityUsd.toLocaleString()}`],
                            ["Min Buy/Sell", `${s.config.minBuySellRatio}x`],
                          ].map(([label, value]) => (
                            <div key={label}>
                              <p className="font-pixel text-[7px] text-gray-500">{label}</p>
                              <p className="font-pixel text-[10px] text-yellow-300">{value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-yellow-500/20 px-4 py-2 flex items-center justify-between bg-black/20">
              <button
                onClick={fetchAll}
                disabled={isLoading}
                className="font-pixel text-[8px] text-yellow-600 hover:text-yellow-300 disabled:opacity-40 transition-colors"
              >
                {isLoading ? "REFRESHING..." : "[~] REFRESH"}
              </button>
              <a
                href="https://t.me/AgentDaddyGhost"
                target="_blank"
                rel="noopener noreferrer"
                className="font-pixel text-[8px] text-blue-400/70 hover:text-blue-300 transition-colors"
              >
                JOIN TELEGRAM
              </a>
            </div>

            {/* Bottom gold bar */}
            <div className="h-1 bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600" />
          </div>
        </div>
      )}
    </>
  );
}
