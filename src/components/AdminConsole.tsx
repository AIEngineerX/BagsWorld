"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

interface WorldConfig {
  maxBuildings: number;
  maxCharacters: number;
  buildingSpacing: number;
  minMarketCap: number;
  decayThreshold: number;
  minLifetimeFees: number;
  volumeThresholds: {
    thriving: number;
    healthy: number;
    normal: number;
    struggling: number;
    dying: number;
  };
  refreshIntervalMs: number;
}

const ADMIN_WALLET = process.env.NEXT_PUBLIC_ADMIN_WALLET;

export function AdminConsole() {
  const { publicKey, connected } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<WorldConfig | null>(null);
  const [defaults, setDefaults] = useState<WorldConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Local editable state
  const [editedConfig, setEditedConfig] = useState<WorldConfig | null>(null);

  // Check if current wallet is admin
  const isAdmin = connected && publicKey?.toBase58() === ADMIN_WALLET;

  const fetchConfig = useCallback(async () => {
    if (!publicKey) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/admin/config", {
        headers: {
          "x-admin-wallet": publicKey.toBase58(),
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch configuration");
      }

      const data = await response.json();
      setConfig(data.config);
      setDefaults(data.defaults);
      setEditedConfig(data.config);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load config");
    } finally {
      setIsLoading(false);
    }
  }, [publicKey]);

  // Fetch config when opened
  useEffect(() => {
    if (isOpen && isAdmin) {
      fetchConfig();
    }
  }, [isOpen, isAdmin, fetchConfig]);

  const handleSave = async () => {
    if (!publicKey || !editedConfig) return;

    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch("/api/admin/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-wallet": publicKey.toBase58(),
        },
        body: JSON.stringify({
          action: "update",
          updates: editedConfig,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save");
      }

      setConfig(data.config);
      setEditedConfig(data.config);
      setSuccessMessage("Configuration saved!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save config");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!publicKey) return;

    try {
      setIsSaving(true);
      setError(null);

      const response = await fetch("/api/admin/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-wallet": publicKey.toBase58(),
        },
        body: JSON.stringify({ action: "reset" }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reset");
      }

      setConfig(data.config);
      setEditedConfig(data.config);
      setSuccessMessage("Configuration reset to defaults!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset config");
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: keyof WorldConfig, value: number) => {
    if (!editedConfig) return;
    setEditedConfig({ ...editedConfig, [field]: value });
  };

  const updateVolumeThreshold = (key: keyof WorldConfig["volumeThresholds"], value: number) => {
    if (!editedConfig) return;
    setEditedConfig({
      ...editedConfig,
      volumeThresholds: {
        ...editedConfig.volumeThresholds,
        [key]: value,
      },
    });
  };

  const hasChanges = JSON.stringify(config) !== JSON.stringify(editedConfig);

  // Don't render if not admin
  if (!isAdmin) return null;

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-12 left-4 z-50 font-pixel text-[10px] px-3 py-2 bg-orange-600 border-2 border-orange-400 text-white hover:bg-orange-500 transition-colors shadow-lg"
        title="Admin Console"
      >
        ⚙️ ADMIN
      </button>

      {/* Admin Console Panel */}
      {isOpen && (
        <div className="fixed bottom-24 left-4 z-50 w-80 bg-bags-dark border-2 border-orange-500 shadow-2xl max-h-[70vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b-2 border-orange-500 bg-orange-900/30">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚙️</span>
              <h2 className="font-pixel text-sm text-orange-300">ADMIN CONSOLE</h2>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-orange-400 hover:text-white font-pixel text-xs"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {isLoading ? (
              <p className="font-pixel text-[10px] text-orange-300 animate-pulse">Loading config...</p>
            ) : error ? (
              <div className="bg-red-500/10 p-2 border border-red-500/30">
                <p className="font-pixel text-[8px] text-red-400">{error}</p>
              </div>
            ) : editedConfig ? (
              <>
                {/* Success Message */}
                {successMessage && (
                  <div className="bg-green-500/20 border border-green-500/50 p-2">
                    <p className="font-pixel text-[8px] text-green-400">{successMessage}</p>
                  </div>
                )}

                {/* Building Limits */}
                <div className="space-y-2">
                  <h3 className="font-pixel text-[9px] text-orange-400 border-b border-orange-500/30 pb-1">
                    BUILDING LIMITS
                  </h3>

                  <ConfigSlider
                    label="Max Buildings"
                    value={editedConfig.maxBuildings}
                    min={5}
                    max={50}
                    defaultValue={defaults?.maxBuildings}
                    onChange={(v) => updateField("maxBuildings", v)}
                  />

                  <ConfigSlider
                    label="Max Characters"
                    value={editedConfig.maxCharacters}
                    min={5}
                    max={30}
                    defaultValue={defaults?.maxCharacters}
                    onChange={(v) => updateField("maxCharacters", v)}
                  />

                  <ConfigSlider
                    label="Building Spacing"
                    value={editedConfig.buildingSpacing}
                    min={50}
                    max={200}
                    step={10}
                    defaultValue={defaults?.buildingSpacing}
                    onChange={(v) => updateField("buildingSpacing", v)}
                  />
                </div>

                {/* Filtering Thresholds */}
                <div className="space-y-2">
                  <h3 className="font-pixel text-[9px] text-orange-400 border-b border-orange-500/30 pb-1">
                    FILTERING THRESHOLDS
                  </h3>

                  <ConfigInput
                    label="Min Market Cap ($)"
                    value={editedConfig.minMarketCap}
                    defaultValue={defaults?.minMarketCap}
                    onChange={(v) => updateField("minMarketCap", v)}
                    format="currency"
                  />

                  <ConfigSlider
                    label="Decay Threshold (Health)"
                    value={editedConfig.decayThreshold}
                    min={0}
                    max={50}
                    defaultValue={defaults?.decayThreshold}
                    onChange={(v) => updateField("decayThreshold", v)}
                  />

                  <ConfigInput
                    label="Min Lifetime Fees (SOL)"
                    value={editedConfig.minLifetimeFees}
                    defaultValue={defaults?.minLifetimeFees}
                    onChange={(v) => updateField("minLifetimeFees", v)}
                    format="sol"
                  />
                </div>

                {/* Volume Thresholds */}
                <div className="space-y-2">
                  <h3 className="font-pixel text-[9px] text-orange-400 border-b border-orange-500/30 pb-1">
                    VOLUME THRESHOLDS (SOL)
                  </h3>

                  {(["thriving", "healthy", "normal", "struggling", "dying"] as const).map((key) => (
                    <ConfigInput
                      key={key}
                      label={key.charAt(0).toUpperCase() + key.slice(1)}
                      value={editedConfig.volumeThresholds[key]}
                      defaultValue={defaults?.volumeThresholds[key]}
                      onChange={(v) => updateVolumeThreshold(key, v)}
                      format="sol"
                    />
                  ))}
                </div>

                {/* Refresh Settings */}
                <div className="space-y-2">
                  <h3 className="font-pixel text-[9px] text-orange-400 border-b border-orange-500/30 pb-1">
                    REFRESH SETTINGS
                  </h3>

                  <ConfigSlider
                    label="Refresh Interval (sec)"
                    value={editedConfig.refreshIntervalMs / 1000}
                    min={5}
                    max={120}
                    step={5}
                    defaultValue={defaults ? defaults.refreshIntervalMs / 1000 : undefined}
                    onChange={(v) => updateField("refreshIntervalMs", v * 1000)}
                  />
                </div>
              </>
            ) : null}
          </div>

          {/* Footer Actions */}
          <div className="p-3 border-t border-orange-500/30 space-y-2">
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
                className="flex-1 py-2 font-pixel text-[9px] bg-green-600 border border-green-400 text-white hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? "SAVING..." : "SAVE CHANGES"}
              </button>

              <button
                onClick={handleReset}
                disabled={isSaving}
                className="py-2 px-3 font-pixel text-[9px] bg-red-600/50 border border-red-400/50 text-red-200 hover:bg-red-500/50 disabled:opacity-50"
              >
                RESET
              </button>
            </div>

            {hasChanges && (
              <p className="font-pixel text-[7px] text-orange-400 text-center">
                * Unsaved changes
              </p>
            )}

            <button
              onClick={fetchConfig}
              disabled={isLoading}
              className="w-full py-1 font-pixel text-[8px] bg-bags-darker border border-orange-500/30 text-orange-300 hover:bg-orange-500/10"
            >
              ↻ REFRESH
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// Helper Components

interface ConfigSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
  onChange: (value: number) => void;
}

function ConfigSlider({ label, value, min, max, step = 1, defaultValue, onChange }: ConfigSliderProps) {
  const isDefault = defaultValue !== undefined && value === defaultValue;

  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <span className="font-pixel text-[8px] text-gray-300">{label}</span>
        <span className={`font-pixel text-[8px] ${isDefault ? "text-gray-500" : "text-orange-400"}`}>
          {value}
          {!isDefault && defaultValue !== undefined && (
            <span className="text-gray-600 ml-1">(def: {defaultValue})</span>
          )}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-bags-darker rounded-lg appearance-none cursor-pointer accent-orange-500"
      />
    </div>
  );
}

interface ConfigInputProps {
  label: string;
  value: number;
  defaultValue?: number;
  onChange: (value: number) => void;
  format?: "currency" | "sol" | "number";
}

function ConfigInput({ label, value, defaultValue, onChange, format = "number" }: ConfigInputProps) {
  const isDefault = defaultValue !== undefined && value === defaultValue;

  const formatDisplay = (v: number) => {
    if (format === "currency") return `$${v.toLocaleString()}`;
    if (format === "sol") return `${v.toLocaleString()} SOL`;
    return v.toLocaleString();
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-pixel text-[8px] text-gray-300 flex-shrink-0">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
          className="w-20 bg-bags-darker border border-orange-500/30 px-2 py-1 font-pixel text-[8px] text-white text-right focus:outline-none focus:border-orange-500"
        />
        {!isDefault && defaultValue !== undefined && (
          <button
            onClick={() => onChange(defaultValue)}
            className="font-pixel text-[7px] text-gray-500 hover:text-orange-400"
            title={`Reset to ${formatDisplay(defaultValue)}`}
          >
            ↩
          </button>
        )}
      </div>
    </div>
  );
}
