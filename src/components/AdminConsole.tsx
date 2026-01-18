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
  cacheDurations: {
    tokenData: number;
    earnerData: number;
    weatherData: number;
    claimEvents: number;
    dexscreener: number;
  };
  eventThresholds: {
    pumpTriggerPercent: number;
    pumpHealthGain: number;
    dumpTriggerPercent: number;
    dumpHealthLoss: number;
    feeMilestones: number[];
  };
  dayNightCycle: {
    nightStart: number;
    nightEnd: number;
    dawnStart: number;
    dawnEnd: number;
    duskStart: number;
    duskEnd: number;
  };
  buildingLevels: {
    level2: number;
    level3: number;
    level4: number;
    level5: number;
  };
  moodThresholds: {
    celebratingPriceChange: number;
    happyPriceChange: number;
    happyEarnings24h: number;
    sadPriceChange: number;
  };
  healthDecay: {
    decayRate: number;
    recoveryRate: number;
    minVolumeForActive: number;
  };
}

const ADMIN_WALLET = process.env.NEXT_PUBLIC_ADMIN_WALLET;

// Collapsible section component
function ConfigSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-orange-500/30 bg-bags-darker/50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2 hover:bg-orange-500/10"
      >
        <span className="font-pixel text-[9px] text-orange-400">{title}</span>
        <span className="text-orange-400 text-xs">{isOpen ? "▼" : "▶"}</span>
      </button>
      {isOpen && <div className="p-2 pt-0 space-y-2">{children}</div>}
    </div>
  );
}

export function AdminConsole() {
  const { publicKey, connected } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<WorldConfig | null>(null);
  const [defaults, setDefaults] = useState<WorldConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editedConfig, setEditedConfig] = useState<WorldConfig | null>(null);

  const isAdmin = connected && publicKey?.toBase58() === ADMIN_WALLET;

  const fetchConfig = useCallback(async () => {
    if (!publicKey) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/admin/config", {
        headers: { "x-admin-wallet": publicKey.toBase58() },
      });

      if (!response.ok) throw new Error("Failed to fetch configuration");

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
        body: JSON.stringify({ action: "update", updates: editedConfig }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save");

      setConfig(data.config);
      setEditedConfig(data.config);
      setSuccessMessage("Config saved! Changes apply on next refresh.");
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
      if (!response.ok) throw new Error(data.error || "Failed to reset");

      setConfig(data.config);
      setEditedConfig(data.config);
      setSuccessMessage("Reset to defaults!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset config");
    } finally {
      setIsSaving(false);
    }
  };

  // Update helpers
  const updateField = (field: keyof WorldConfig, value: number) => {
    if (!editedConfig) return;
    setEditedConfig({ ...editedConfig, [field]: value });
  };

  const updateNested = <K extends keyof WorldConfig>(
    section: K,
    field: keyof WorldConfig[K],
    value: number
  ) => {
    if (!editedConfig) return;
    setEditedConfig({
      ...editedConfig,
      [section]: { ...editedConfig[section], [field]: value },
    });
  };

  const hasChanges = JSON.stringify(config) !== JSON.stringify(editedConfig);

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
        <div className="fixed bottom-24 left-4 z-50 w-96 bg-bags-dark border-2 border-orange-500 shadow-2xl max-h-[80vh] overflow-hidden flex flex-col">
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
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {isLoading ? (
              <p className="font-pixel text-[10px] text-orange-300 animate-pulse">Loading...</p>
            ) : error ? (
              <div className="bg-red-500/10 p-2 border border-red-500/30">
                <p className="font-pixel text-[8px] text-red-400">{error}</p>
              </div>
            ) : editedConfig ? (
              <>
                {successMessage && (
                  <div className="bg-green-500/20 border border-green-500/50 p-2">
                    <p className="font-pixel text-[8px] text-green-400">{successMessage}</p>
                  </div>
                )}

                {/* Building Limits */}
                <ConfigSection title="🏢 BUILDING LIMITS" defaultOpen={true}>
                  <ConfigSlider label="Max Buildings" value={editedConfig.maxBuildings} min={5} max={50} onChange={(v) => updateField("maxBuildings", v)} />
                  <ConfigSlider label="Max Characters" value={editedConfig.maxCharacters} min={5} max={30} onChange={(v) => updateField("maxCharacters", v)} />
                  <ConfigSlider label="Building Spacing (px)" value={editedConfig.buildingSpacing} min={50} max={200} step={10} onChange={(v) => updateField("buildingSpacing", v)} />
                </ConfigSection>

                {/* Filtering */}
                <ConfigSection title="🔍 FILTERING THRESHOLDS">
                  <ConfigInput label="Min Market Cap ($)" value={editedConfig.minMarketCap} onChange={(v) => updateField("minMarketCap", v)} />
                  <ConfigSlider label="Decay Threshold" value={editedConfig.decayThreshold} min={0} max={50} onChange={(v) => updateField("decayThreshold", v)} />
                  <ConfigInput label="Min Lifetime Fees (SOL)" value={editedConfig.minLifetimeFees} onChange={(v) => updateField("minLifetimeFees", v)} />
                </ConfigSection>

                {/* Cache Durations */}
                <ConfigSection title="⏱️ CACHE DURATIONS">
                  <ConfigSlider label="Token Data (sec)" value={editedConfig.cacheDurations.tokenData / 1000} min={5} max={120} onChange={(v) => updateNested("cacheDurations", "tokenData", v * 1000)} />
                  <ConfigSlider label="Earner Data (sec)" value={editedConfig.cacheDurations.earnerData / 1000} min={10} max={300} onChange={(v) => updateNested("cacheDurations", "earnerData", v * 1000)} />
                  <ConfigSlider label="Weather (sec)" value={editedConfig.cacheDurations.weatherData / 1000} min={60} max={600} onChange={(v) => updateNested("cacheDurations", "weatherData", v * 1000)} />
                  <ConfigSlider label="Claim Events (sec)" value={editedConfig.cacheDurations.claimEvents / 1000} min={5} max={60} onChange={(v) => updateNested("cacheDurations", "claimEvents", v * 1000)} />
                  <ConfigSlider label="DexScreener (sec)" value={editedConfig.cacheDurations.dexscreener / 1000} min={10} max={120} onChange={(v) => updateNested("cacheDurations", "dexscreener", v * 1000)} />
                </ConfigSection>

                {/* Event Thresholds */}
                <ConfigSection title="📊 EVENT THRESHOLDS">
                  <ConfigSlider label="Pump Trigger (%)" value={editedConfig.eventThresholds.pumpTriggerPercent} min={20} max={500} step={10} onChange={(v) => updateNested("eventThresholds", "pumpTriggerPercent", v)} />
                  <ConfigSlider label="Pump Health Gain" value={editedConfig.eventThresholds.pumpHealthGain} min={5} max={50} onChange={(v) => updateNested("eventThresholds", "pumpHealthGain", v)} />
                  <ConfigSlider label="Dump Trigger (%)" value={Math.abs(editedConfig.eventThresholds.dumpTriggerPercent)} min={10} max={100} onChange={(v) => updateNested("eventThresholds", "dumpTriggerPercent", -v)} />
                  <ConfigSlider label="Dump Health Loss" value={editedConfig.eventThresholds.dumpHealthLoss} min={5} max={50} onChange={(v) => updateNested("eventThresholds", "dumpHealthLoss", v)} />
                </ConfigSection>

                {/* Day/Night Cycle */}
                <ConfigSection title="🌙 DAY/NIGHT CYCLE (EST)">
                  <ConfigSlider label="Night Start (hour)" value={editedConfig.dayNightCycle.nightStart} min={18} max={23} onChange={(v) => updateNested("dayNightCycle", "nightStart", v)} />
                  <ConfigSlider label="Night End (hour)" value={editedConfig.dayNightCycle.nightEnd} min={4} max={8} onChange={(v) => updateNested("dayNightCycle", "nightEnd", v)} />
                  <ConfigSlider label="Dusk Start (hour)" value={editedConfig.dayNightCycle.duskStart} min={16} max={20} onChange={(v) => updateNested("dayNightCycle", "duskStart", v)} />
                  <ConfigSlider label="Dawn End (hour)" value={editedConfig.dayNightCycle.dawnEnd} min={6} max={10} onChange={(v) => updateNested("dayNightCycle", "dawnEnd", v)} />
                </ConfigSection>

                {/* Building Levels */}
                <ConfigSection title="🏗️ BUILDING LEVEL TIERS ($)">
                  <ConfigInput label="Level 2 Min" value={editedConfig.buildingLevels.level2} onChange={(v) => updateNested("buildingLevels", "level2", v)} format="currency" />
                  <ConfigInput label="Level 3 Min" value={editedConfig.buildingLevels.level3} onChange={(v) => updateNested("buildingLevels", "level3", v)} format="currency" />
                  <ConfigInput label="Level 4 Min" value={editedConfig.buildingLevels.level4} onChange={(v) => updateNested("buildingLevels", "level4", v)} format="currency" />
                  <ConfigInput label="Level 5 Min" value={editedConfig.buildingLevels.level5} onChange={(v) => updateNested("buildingLevels", "level5", v)} format="currency" />
                </ConfigSection>

                {/* Mood Thresholds */}
                <ConfigSection title="😊 MOOD SENSITIVITY">
                  <ConfigSlider label="Celebrating (+%)" value={editedConfig.moodThresholds.celebratingPriceChange} min={50} max={500} step={10} onChange={(v) => updateNested("moodThresholds", "celebratingPriceChange", v)} />
                  <ConfigSlider label="Happy (+%)" value={editedConfig.moodThresholds.happyPriceChange} min={5} max={100} onChange={(v) => updateNested("moodThresholds", "happyPriceChange", v)} />
                  <ConfigInput label="Happy Earnings (SOL)" value={editedConfig.moodThresholds.happyEarnings24h} onChange={(v) => updateNested("moodThresholds", "happyEarnings24h", v)} />
                  <ConfigSlider label="Sad (-%)" value={Math.abs(editedConfig.moodThresholds.sadPriceChange)} min={5} max={50} onChange={(v) => updateNested("moodThresholds", "sadPriceChange", -v)} />
                </ConfigSection>

                {/* Health Decay */}
                <ConfigSection title="💔 HEALTH DECAY">
                  <ConfigSlider label="Decay Rate (pts)" value={editedConfig.healthDecay.decayRate} min={1} max={20} onChange={(v) => updateNested("healthDecay", "decayRate", v)} />
                  <ConfigSlider label="Recovery Rate (pts)" value={editedConfig.healthDecay.recoveryRate} min={1} max={30} onChange={(v) => updateNested("healthDecay", "recoveryRate", v)} />
                  <ConfigInput label="Min Volume ($)" value={editedConfig.healthDecay.minVolumeForActive} onChange={(v) => updateNested("healthDecay", "minVolumeForActive", v)} />
                </ConfigSection>

                {/* Volume Thresholds */}
                <ConfigSection title="📈 VOLUME THRESHOLDS (SOL)">
                  <ConfigInput label="Thriving" value={editedConfig.volumeThresholds.thriving} onChange={(v) => updateNested("volumeThresholds", "thriving", v)} />
                  <ConfigInput label="Healthy" value={editedConfig.volumeThresholds.healthy} onChange={(v) => updateNested("volumeThresholds", "healthy", v)} />
                  <ConfigInput label="Normal" value={editedConfig.volumeThresholds.normal} onChange={(v) => updateNested("volumeThresholds", "normal", v)} />
                  <ConfigInput label="Struggling" value={editedConfig.volumeThresholds.struggling} onChange={(v) => updateNested("volumeThresholds", "struggling", v)} />
                  <ConfigInput label="Dying" value={editedConfig.volumeThresholds.dying} onChange={(v) => updateNested("volumeThresholds", "dying", v)} />
                </ConfigSection>

                {/* Refresh */}
                <ConfigSection title="🔄 REFRESH SETTINGS">
                  <ConfigSlider label="World Refresh (sec)" value={editedConfig.refreshIntervalMs / 1000} min={5} max={120} step={5} onChange={(v) => updateField("refreshIntervalMs", v * 1000)} />
                </ConfigSection>
              </>
            ) : null}
          </div>

          {/* Footer */}
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
              <p className="font-pixel text-[7px] text-orange-400 text-center">* Unsaved changes</p>
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
function ConfigSlider({ label, value, min, max, step = 1, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <span className="font-pixel text-[7px] text-gray-400">{label}</span>
        <span className="font-pixel text-[8px] text-orange-300">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-bags-darker rounded appearance-none cursor-pointer accent-orange-500"
      />
    </div>
  );
}

function ConfigInput({ label, value, onChange, format }: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  format?: "currency" | "sol";
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-pixel text-[7px] text-gray-400">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
        className="w-24 bg-bags-darker border border-orange-500/30 px-2 py-0.5 font-pixel text-[8px] text-white text-right focus:outline-none focus:border-orange-500"
      />
    </div>
  );
}
