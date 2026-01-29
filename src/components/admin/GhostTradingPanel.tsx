"use client";

import { useState } from "react";
import {
  useGhostStatus,
  useGhostOpenPositions,
  useGhostPositions,
  useEnableGhostTrading,
  useDisableGhostTrading,
  useUpdateGhostConfig,
  useTriggerGhostEvaluate,
  useTriggerGhostCheckPositions,
  type GhostPosition,
} from "@/hooks/useElizaAgents";

interface GhostTradingPanelProps {
  addLog?: (message: string, type?: "info" | "success" | "error") => void;
}

export function GhostTradingPanel({ addLog }: GhostTradingPanelProps) {
  const { data: status, isLoading: statusLoading, error: statusError } = useGhostStatus();
  const { data: openPositions } = useGhostOpenPositions();
  const { data: allPositions } = useGhostPositions();

  const enableTrading = useEnableGhostTrading();
  const disableTrading = useDisableGhostTrading();
  const updateConfig = useUpdateGhostConfig();
  const triggerEvaluate = useTriggerGhostEvaluate();
  const triggerCheck = useTriggerGhostCheckPositions();

  const [showEnableModal, setShowEnableModal] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [showConfigEditor, setShowConfigEditor] = useState(false);
  const [showAllPositions, setShowAllPositions] = useState(false);

  // Config editor state
  const [configEdits, setConfigEdits] = useState<Record<string, string>>({});

  const handleEnable = async () => {
    if (confirmPhrase !== "i understand the risks") {
      addLog?.("Invalid confirmation phrase", "error");
      return;
    }

    const result = await enableTrading.mutateAsync(confirmPhrase);
    if (result.success) {
      addLog?.("Ghost trading ENABLED - monitor closely!", "success");
      setShowEnableModal(false);
      setConfirmPhrase("");
    } else {
      addLog?.(`Failed to enable trading: ${result.error}`, "error");
    }
  };

  const handleDisable = async () => {
    const result = await disableTrading.mutateAsync();
    if (result.success) {
      addLog?.(`Ghost trading DISABLED - ${result.openPositions} positions remain open`, "success");
    } else {
      addLog?.("Failed to disable trading", "error");
    }
  };

  const handleSaveConfig = async () => {
    const updates: Record<string, number> = {};

    for (const [key, value] of Object.entries(configEdits)) {
      if (value !== "") {
        const num = parseFloat(value);
        if (!isNaN(num)) {
          updates[key] = num;
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      addLog?.("No config changes to save", "info");
      return;
    }

    const result = await updateConfig.mutateAsync(updates);
    if (result.success) {
      addLog?.(`Config updated: ${Object.keys(updates).join(", ")}`, "success");
      setConfigEdits({});
      setShowConfigEditor(false);
    } else {
      addLog?.("Failed to update config", "error");
    }
  };

  const handleTriggerEvaluate = async () => {
    addLog?.("Triggering Ghost trade evaluation...", "info");
    const result = await triggerEvaluate.mutateAsync();
    if (result.success) {
      addLog?.(`Evaluation complete: ${result.newPositions} new positions`, "success");
    } else {
      addLog?.(`Evaluation failed: ${result.error}`, "error");
    }
  };

  const handleTriggerCheck = async () => {
    addLog?.("Checking Ghost positions...", "info");
    const result = await triggerCheck.mutateAsync();
    if (result.success) {
      addLog?.(`Position check complete: ${result.positionsClosed} closed`, "success");
    } else {
      addLog?.(`Position check failed: ${result.error}`, "error");
    }
  };

  const formatPnl = (pnl: number | undefined) => {
    if (pnl === undefined || pnl === null) return "-";
    const formatted = pnl.toFixed(4);
    if (pnl > 0) return `+${formatted}`;
    return formatted;
  };

  const getPnlColor = (pnl: number | undefined) => {
    if (pnl === undefined || pnl === null) return "text-gray-400";
    if (pnl > 0) return "text-green-400";
    if (pnl < 0) return "text-red-400";
    return "text-gray-400";
  };

  if (statusLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-20 bg-gray-700 rounded" />
        <div className="h-32 bg-gray-700 rounded" />
      </div>
    );
  }

  if (statusError) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 p-3">
        <p className="font-pixel text-[9px] text-red-400">Failed to load Ghost trading status</p>
        <p className="font-pixel text-[8px] text-gray-500 mt-1">
          {statusError instanceof Error ? statusError.message : "Connection error"}
        </p>
      </div>
    );
  }

  const isEnabled = status?.trading?.enabled || false;
  const config = status?.config;
  const performance = status?.performance;
  const positions = showAllPositions ? allPositions?.positions : openPositions?.positions;

  return (
    <div className="space-y-4">
      {/* Trading Status */}
      <div
        className={`p-3 border ${isEnabled ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`w-3 h-3 rounded-full ${isEnabled ? "bg-green-400 animate-pulse" : "bg-red-400"}`}
            />
            <div>
              <p className={`font-pixel text-sm ${isEnabled ? "text-green-400" : "text-red-400"}`}>
                TRADING {isEnabled ? "ENABLED" : "DISABLED"}
              </p>
              {isEnabled && (
                <p className="font-pixel text-[8px] text-yellow-400">
                  Real SOL trades active - monitor closely
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            {isEnabled ? (
              <button
                onClick={handleDisable}
                disabled={disableTrading.isPending}
                className="font-pixel text-[9px] text-red-400 hover:text-white bg-red-500/20 hover:bg-red-500/40 px-3 py-1.5 border border-red-500/50"
              >
                {disableTrading.isPending ? "[...]" : "[KILL SWITCH]"}
              </button>
            ) : (
              <button
                onClick={() => setShowEnableModal(true)}
                className="font-pixel text-[9px] text-green-400 hover:text-white bg-green-500/20 hover:bg-green-500/40 px-3 py-1.5 border border-green-500/50"
              >
                [ENABLE]
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Wallet Info */}
      {status?.wallet && (
        <div className="bg-bags-darker p-3 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-pixel text-[7px] text-gray-500">GHOST WALLET</p>
              <p className="font-mono text-[9px] text-gray-400">
                {status.wallet.address
                  ? `${status.wallet.address.slice(0, 8)}...${status.wallet.address.slice(-8)}`
                  : "Not configured"}
              </p>
            </div>
            <div className="text-right">
              <p className="font-pixel text-[7px] text-gray-500">BALANCE</p>
              <p className="font-pixel text-lg text-bags-gold">
                {status.wallet.balanceSol.toFixed(4)} SOL
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-bags-darker p-2 border border-gray-700">
          <p className="font-pixel text-[7px] text-gray-500">Open Positions</p>
          <p className="font-pixel text-lg text-white">
            {status?.trading?.openPositions || 0}/{status?.trading?.maxPositions || 5}
          </p>
        </div>
        <div className="bg-bags-darker p-2 border border-gray-700">
          <p className="font-pixel text-[7px] text-gray-500">Exposure</p>
          <p className="font-pixel text-lg text-bags-gold">
            {(status?.trading?.totalExposureSol || 0).toFixed(3)} SOL
          </p>
        </div>
        <div className="bg-bags-darker p-2 border border-gray-700">
          <p className="font-pixel text-[7px] text-gray-500">Win Rate</p>
          <p className="font-pixel text-lg text-white">{performance?.winRate || "0%"}</p>
        </div>
        <div className="bg-bags-darker p-2 border border-gray-700">
          <p className="font-pixel text-[7px] text-gray-500">Total P&L</p>
          <p className={`font-pixel text-lg ${getPnlColor(performance?.totalPnlSol)}`}>
            {formatPnl(performance?.totalPnlSol)} SOL
          </p>
        </div>
      </div>

      {/* Performance Stats */}
      <div className="bg-bags-darker p-3 border border-gray-700">
        <p className="font-pixel text-[8px] text-gray-400 mb-2">PERFORMANCE</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="font-pixel text-[7px] text-gray-500">Total Trades</p>
            <p className="font-pixel text-sm text-white">{performance?.totalTrades || 0}</p>
          </div>
          <div>
            <p className="font-pixel text-[7px] text-gray-500">Winning</p>
            <p className="font-pixel text-sm text-green-400">{performance?.winningTrades || 0}</p>
          </div>
          <div>
            <p className="font-pixel text-[7px] text-gray-500">Losing</p>
            <p className="font-pixel text-sm text-red-400">{performance?.losingTrades || 0}</p>
          </div>
        </div>
      </div>

      {/* Manual Actions */}
      {isEnabled && (
        <div className="bg-bags-darker p-3 border border-yellow-500/30">
          <p className="font-pixel text-[8px] text-gray-400 mb-2">MANUAL ACTIONS</p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleTriggerEvaluate}
              disabled={triggerEvaluate.isPending}
              className="font-pixel text-[8px] text-yellow-400 hover:text-yellow-300 bg-yellow-500/10 px-2 py-1 border border-yellow-500/30"
            >
              {triggerEvaluate.isPending ? "[...]" : "[EVALUATE NOW]"}
            </button>
            <button
              onClick={handleTriggerCheck}
              disabled={triggerCheck.isPending}
              className="font-pixel text-[8px] text-yellow-400 hover:text-yellow-300 bg-yellow-500/10 px-2 py-1 border border-yellow-500/30"
            >
              {triggerCheck.isPending ? "[...]" : "[CHECK POSITIONS]"}
            </button>
          </div>
        </div>
      )}

      {/* Positions */}
      <div className="bg-bags-darker p-3 border border-gray-700">
        <div className="flex justify-between items-center mb-2">
          <p className="font-pixel text-[8px] text-gray-400">POSITIONS</p>
          <button
            onClick={() => setShowAllPositions(!showAllPositions)}
            className="font-pixel text-[7px] text-gray-500 hover:text-gray-300"
          >
            {showAllPositions ? "[SHOW OPEN]" : "[SHOW ALL]"}
          </button>
        </div>

        {positions && positions.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {positions.map((pos) => (
              <PositionCard key={pos.id} position={pos} />
            ))}
          </div>
        ) : (
          <p className="font-pixel text-[9px] text-gray-500 text-center py-4">
            {showAllPositions ? "No positions yet" : "No open positions"}
          </p>
        )}
      </div>

      {/* Config Editor */}
      <div className="bg-bags-darker p-3 border border-gray-700">
        <div className="flex justify-between items-center mb-2">
          <p className="font-pixel text-[8px] text-gray-400">CONFIGURATION</p>
          <button
            onClick={() => setShowConfigEditor(!showConfigEditor)}
            className="font-pixel text-[7px] text-gray-500 hover:text-gray-300"
          >
            {showConfigEditor ? "[CLOSE]" : "[EDIT]"}
          </button>
        </div>

        {showConfigEditor ? (
          <div className="space-y-2">
            <ConfigField
              label="Min Position (SOL)"
              field="minPositionSol"
              value={configEdits.minPositionSol ?? String(config?.minPositionSol || 0.05)}
              onChange={(v) => setConfigEdits((p) => ({ ...p, minPositionSol: v }))}
            />
            <ConfigField
              label="Max Position (SOL)"
              field="maxPositionSol"
              value={configEdits.maxPositionSol ?? String(config?.maxPositionSol || 0.1)}
              onChange={(v) => setConfigEdits((p) => ({ ...p, maxPositionSol: v }))}
            />
            <div className="flex items-center gap-2">
              <label className="font-pixel text-[8px] text-gray-400 w-32">Take Profit Tiers</label>
              <span className="font-pixel text-[8px] text-green-400">
                {config?.takeProfitTiers?.join("x, ") || "1.5, 2, 3"}x (read-only)
              </span>
            </div>
            <ConfigField
              label="Trailing Stop (%)"
              field="trailingStopPercent"
              value={configEdits.trailingStopPercent ?? String(config?.trailingStopPercent || 10)}
              onChange={(v) => setConfigEdits((p) => ({ ...p, trailingStopPercent: v }))}
            />
            <ConfigField
              label="Stop Loss (%)"
              field="stopLossPercent"
              value={configEdits.stopLossPercent ?? String(config?.stopLossPercent || 15)}
              onChange={(v) => setConfigEdits((p) => ({ ...p, stopLossPercent: v }))}
            />
            <ConfigField
              label="Slippage (bps)"
              field="slippageBps"
              value={configEdits.slippageBps ?? String(config?.slippageBps || 500)}
              onChange={(v) => setConfigEdits((p) => ({ ...p, slippageBps: v }))}
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleSaveConfig}
                disabled={updateConfig.isPending}
                className="font-pixel text-[8px] text-green-400 hover:text-green-300 bg-green-500/10 px-2 py-1 border border-green-500/30"
              >
                {updateConfig.isPending ? "[...]" : "[SAVE]"}
              </button>
              <button
                onClick={() => {
                  setConfigEdits({});
                  setShowConfigEditor(false);
                }}
                className="font-pixel text-[8px] text-gray-400 hover:text-gray-300 px-2 py-1 border border-gray-600"
              >
                [CANCEL]
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[8px]">
            <div>
              <span className="text-gray-500">Position:</span>{" "}
              <span className="text-white">
                {config?.minPositionSol}-{config?.maxPositionSol} SOL
              </span>
            </div>
            <div>
              <span className="text-gray-500">TP Tiers:</span>{" "}
              <span className="text-green-400">
                {config?.takeProfitTiers?.map((t: number) => `${t}x`).join(", ") || "1.5x, 2x, 3x"}
              </span>
            </div>
            <div>
              <span className="text-gray-500">SL:</span>{" "}
              <span className="text-red-400">-{config?.stopLossPercent || 15}%</span>
            </div>
            <div>
              <span className="text-gray-500">Trailing:</span>{" "}
              <span className="text-yellow-400">{config?.trailingStopPercent || 10}%</span>
            </div>
            <div>
              <span className="text-gray-500">Slippage:</span>{" "}
              <span className="text-white">{config?.slippageBps} bps</span>
            </div>
          </div>
        )}
      </div>

      {/* Smart Money Wallets */}
      {status?.smartMoneyWallets && status.smartMoneyWallets.length > 0 && (
        <div className="bg-bags-darker p-3 border border-gray-700">
          <p className="font-pixel text-[8px] text-gray-400 mb-2">
            SMART MONEY TRACKING ({status.smartMoneyWallets.length})
          </p>
          <div className="space-y-1">
            {status.smartMoneyWallets.map((wallet) => (
              <div key={wallet.address} className="flex justify-between">
                <span className="font-mono text-[8px] text-gray-500">
                  {wallet.address.slice(0, 8)}...{wallet.address.slice(-8)}
                </span>
                <span className="font-pixel text-[7px] text-gray-600">{wallet.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enable Trading Modal */}
      {showEnableModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80">
          <div className="bg-bags-dark border-4 border-yellow-500 p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="font-pixel text-sm text-yellow-400 mb-4">ENABLE GHOST TRADING</h3>

            <div className="bg-red-500/20 border border-red-500/50 p-3 mb-4">
              <p className="font-pixel text-[9px] text-red-400 mb-2">WARNING</p>
              <ul className="font-pixel text-[8px] text-gray-300 space-y-1">
                <li>Ghost will execute REAL trades with REAL SOL</li>
                <li>Positions may result in losses</li>
                <li>You are responsible for monitoring trades</li>
                <li>Requires configured wallet with SOL balance</li>
              </ul>
            </div>

            <div className="mb-4">
              <p className="font-pixel text-[8px] text-gray-400 mb-2">
                Type &quot;i understand the risks&quot; to enable:
              </p>
              <input
                type="text"
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                placeholder="i understand the risks"
                className="w-full bg-black/50 border border-gray-700 px-2 py-1 font-mono text-[10px] text-white placeholder-gray-600"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleEnable}
                disabled={enableTrading.isPending || confirmPhrase !== "i understand the risks"}
                className="flex-1 font-pixel text-[9px] text-yellow-400 hover:text-yellow-300 bg-yellow-500/10 px-3 py-2 border border-yellow-500/30 disabled:opacity-50"
              >
                {enableTrading.isPending ? "[ENABLING...]" : "[ENABLE TRADING]"}
              </button>
              <button
                onClick={() => {
                  setShowEnableModal(false);
                  setConfirmPhrase("");
                }}
                className="flex-1 font-pixel text-[9px] text-gray-400 hover:text-gray-300 px-3 py-2 border border-gray-600"
              >
                [CANCEL]
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Position card subcomponent
function PositionCard({ position }: { position: GhostPosition }) {
  const status = position.status || "unknown";
  const isOpen = status === "open";
  const isFailed = status === "failed";

  const statusColor = isOpen ? "text-yellow-400" : isFailed ? "text-red-400" : "text-gray-400";

  const pnlColor = position.pnlSol
    ? position.pnlSol > 0
      ? "text-green-400"
      : position.pnlSol < 0
        ? "text-red-400"
        : "text-gray-400"
    : "text-gray-400";

  // Format symbol - truncate if it looks like a mint address
  const symbol = position.tokenSymbol || position.tokenMint?.slice(0, 6) || "???";
  const displaySymbol = symbol.length > 10 ? `${symbol.slice(0, 6)}...` : symbol;

  return (
    <div
      className={`bg-black/30 p-2 border ${isOpen ? "border-yellow-500/30" : "border-gray-700"}`}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="font-pixel text-[10px] text-bags-gold">${displaySymbol}</p>
          <p className="font-pixel text-[7px] text-gray-500">{position.tokenName || "Unknown"}</p>
        </div>
        <div className="text-right">
          <p className={`font-pixel text-[8px] ${statusColor}`}>{status.toUpperCase()}</p>
          {position.pnlSol !== undefined && position.pnlSol !== null && (
            <p className={`font-pixel text-[9px] ${pnlColor}`}>
              {position.pnlSol > 0 ? "+" : ""}
              {position.pnlSol.toFixed(4)} SOL
            </p>
          )}
        </div>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-2 text-[7px]">
        <div>
          <span className="text-gray-500">Entry:</span>{" "}
          <span className="text-white">{position.amountSol.toFixed(4)} SOL</span>
        </div>
        <div>
          <span className="text-gray-500">Tokens:</span>{" "}
          <span className="text-white">{position.amountTokens.toLocaleString()}</span>
        </div>
      </div>
      <p className="font-pixel text-[6px] text-gray-600 mt-1 truncate">{position.entryReason}</p>
      {position.exitReason && (
        <p className="font-pixel text-[6px] text-gray-500 truncate">Exit: {position.exitReason}</p>
      )}
    </div>
  );
}

// Config field subcomponent
function ConfigField({
  label,
  field,
  value,
  onChange,
}: {
  label: string;
  field: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="font-pixel text-[8px] text-gray-400 w-32">{label}</label>
      <input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-black/50 border border-gray-700 px-2 py-0.5 font-mono text-[9px] text-white"
      />
    </div>
  );
}

export default GhostTradingPanel;
