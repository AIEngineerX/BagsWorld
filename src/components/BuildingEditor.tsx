"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { ZoneType } from "@/lib/types";

// Valid zones for override
const VALID_ZONES: ZoneType[] = ["labs", "main_city", "trending", "ballers", "founders"];

// Building style info with colors for preview
const BUILDING_STYLES = [
  { id: 0, name: "Style A", colors: ["#6B5B95", "#FFB347"] },
  { id: 1, name: "Style B", colors: ["#87CEEB", "#1E3A5F"] },
  { id: 2, name: "Style C", colors: ["#F5DEB3", "#FF6B35"] },
  { id: 3, name: "Style D", colors: ["#E6E6FA", "#9B59B6"] },
];

// Zone display info
const ZONE_INFO: Record<ZoneType, { name: string; color: string; description: string }> = {
  labs: { name: "HQ", color: "#10B981", description: "Bags.fm team headquarters" },
  main_city: { name: "Park", color: "#3B82F6", description: "Peaceful green space" },
  trending: { name: "BagsCity", color: "#F59E0B", description: "Urban neon district" },
  ballers: { name: "Ballers Valley", color: "#8B5CF6", description: "Top holder mansions" },
  founders: { name: "Founder's Corner", color: "#EC4899", description: "Token launch hub" },
};

interface GlobalToken {
  mint: string;
  name: string;
  symbol: string;
  image_url?: string;
  market_cap?: number;
  volume_24h?: number;
  lifetime_fees?: number;
  is_featured?: boolean;
  is_verified?: boolean;
  level_override?: number | null;
  position_x?: number | null;
  position_y?: number | null;
  style_override?: number | null;
  health_override?: number | null;
  zone_override?: string | null;
}

interface BuildingEditorProps {
  tokens: GlobalToken[];
  sessionToken: string | null;
  onRefresh: () => void;
  addLog: (message: string, type?: "info" | "error" | "success") => void;
}

export function BuildingEditor({ tokens, sessionToken, onRefresh, addLog }: BuildingEditorProps) {
  const [selectedMint, setSelectedMint] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterZone, setFilterZone] = useState<ZoneType | "all">("all");
  const [filterFeatured, setFilterFeatured] = useState<boolean | "all">("all");
  const [isUpdating, setIsUpdating] = useState(false);

  // Add building state
  const [newMint, setNewMint] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Local edit state for the selected building
  const [editLevel, setEditLevel] = useState<number | "auto">("auto");
  const [editStyle, setEditStyle] = useState<number | "auto">("auto");
  const [editZone, setEditZone] = useState<ZoneType | "auto">("auto");
  const [editHealth, setEditHealth] = useState<number | "auto">("auto");
  const [editPositionX, setEditPositionX] = useState<string>("");
  const [editPositionY, setEditPositionY] = useState<string>("");

  // Get selected token
  const selectedToken = useMemo(
    () => tokens.find((t) => t.mint === selectedMint),
    [tokens, selectedMint]
  );

  // Featured tokens for quick access bar
  const featuredTokens = useMemo(
    () => tokens.filter((t) => t.is_featured || t.is_verified),
    [tokens]
  );

  // Filtered tokens list
  const filteredTokens = useMemo(() => {
    return tokens.filter((t) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !t.name.toLowerCase().includes(query) &&
          !t.symbol.toLowerCase().includes(query) &&
          !t.mint.toLowerCase().includes(query)
        ) {
          return false;
        }
      }
      // Zone filter
      if (filterZone !== "all" && t.zone_override !== filterZone) {
        return false;
      }
      // Featured filter
      if (filterFeatured !== "all") {
        if (filterFeatured && !t.is_featured) return false;
        if (!filterFeatured && t.is_featured) return false;
      }
      return true;
    });
  }, [tokens, searchQuery, filterZone, filterFeatured]);

  // Load selected token's values into edit state
  useEffect(() => {
    if (selectedToken) {
      setEditLevel(selectedToken.level_override ?? "auto");
      setEditStyle(selectedToken.style_override ?? "auto");
      setEditZone((selectedToken.zone_override as ZoneType) ?? "auto");
      setEditHealth(selectedToken.health_override ?? "auto");
      setEditPositionX(selectedToken.position_x?.toString() ?? "");
      setEditPositionY(selectedToken.position_y?.toString() ?? "");
    }
  }, [selectedToken]);

  // API call helper
  const updateBuilding = useCallback(
    async (action: string, data: Record<string, unknown>) => {
      if (!sessionToken) {
        addLog("Not authenticated", "error");
        return false;
      }
      setIsUpdating(true);
      try {
        const res = await fetch("/api/admin", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ action, data }),
        });
        const result = await res.json();
        if (!res.ok) {
          addLog(result.error || "Update failed", "error");
          return false;
        }
        addLog(`Updated ${action.replace("set_", "")} successfully`, "success");
        onRefresh();
        return true;
      } catch (err) {
        addLog("Network error", "error");
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [sessionToken, addLog, onRefresh]
  );

  // Save all changes for selected building
  const saveAllChanges = async () => {
    if (!selectedMint) return;

    const updates: Promise<boolean>[] = [];

    // Level
    const newLevel = editLevel === "auto" ? null : editLevel;
    if (newLevel !== selectedToken?.level_override) {
      updates.push(updateBuilding("set_level_override", { mint: selectedMint, level: newLevel }));
    }

    // Style
    const newStyle = editStyle === "auto" ? null : editStyle;
    if (newStyle !== selectedToken?.style_override) {
      updates.push(updateBuilding("set_style", { mint: selectedMint, style: newStyle }));
    }

    // Zone
    const newZone = editZone === "auto" ? null : editZone;
    if (newZone !== selectedToken?.zone_override) {
      updates.push(updateBuilding("set_zone", { mint: selectedMint, zone: newZone }));
    }

    // Health
    const newHealth = editHealth === "auto" ? null : editHealth;
    if (newHealth !== selectedToken?.health_override) {
      updates.push(updateBuilding("set_health", { mint: selectedMint, health: newHealth }));
    }

    // Position
    const newX = editPositionX === "" ? null : parseFloat(editPositionX);
    const newY = editPositionY === "" ? null : parseFloat(editPositionY);
    if (newX !== selectedToken?.position_x || newY !== selectedToken?.position_y) {
      updates.push(updateBuilding("set_position", { mint: selectedMint, x: newX, y: newY }));
    }

    if (updates.length === 0) {
      addLog("No changes to save", "info");
      return;
    }

    await Promise.all(updates);
  };

  // Add new building by mint
  const addBuilding = async () => {
    if (!newMint.trim() || !sessionToken) return;

    setIsAdding(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ action: "add_token", data: { mint: newMint.trim() } }),
      });
      const result = await res.json();
      if (!res.ok) {
        addLog(result.error || "Failed to add building", "error");
        return;
      }
      addLog(result.message || `Added building: ${result.token?.symbol || newMint.slice(0, 8)}`, "success");
      setNewMint("");
      setSelectedMint(newMint.trim()); // Select the newly added building
      onRefresh();
    } catch (err) {
      addLog("Network error adding building", "error");
    } finally {
      setIsAdding(false);
    }
  };

  // Calculate building level from market cap
  const calculateLevel = (marketCap: number): number => {
    if (marketCap >= 10000000) return 5;
    if (marketCap >= 2000000) return 4;
    if (marketCap >= 500000) return 3;
    if (marketCap >= 100000) return 2;
    return 1;
  };

  const displayLevel =
    editLevel === "auto" ? calculateLevel(selectedToken?.market_cap || 0) : editLevel;

  return (
    <div className="space-y-4">
      {/* Featured Buildings Quick Access */}
      {featuredTokens.length > 0 && (
        <div className="bg-bags-darker border border-yellow-500/30 p-3">
          <h3 className="font-pixel text-[10px] text-yellow-400 mb-2 flex items-center gap-2">
            <span className="text-yellow-500">★</span> FEATURED BUILDINGS
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {featuredTokens.slice(0, 8).map((token) => (
              <button
                key={token.mint}
                onClick={() => setSelectedMint(token.mint)}
                className={`flex-shrink-0 p-2 border transition-all ${
                  selectedMint === token.mint
                    ? "border-yellow-400 bg-yellow-500/20"
                    : "border-gray-700 bg-bags-dark hover:border-yellow-500/50"
                }`}
              >
                <div className="w-12 h-12 bg-gray-800 flex items-center justify-center mb-1">
                  {token.image_url ? (
                    <img
                      src={token.image_url}
                      alt={token.symbol}
                      className="w-10 h-10 object-cover"
                    />
                  ) : (
                    <span className="font-pixel text-[8px] text-gray-500">
                      L{token.level_override || calculateLevel(token.market_cap || 0)}
                    </span>
                  )}
                </div>
                <p className="font-pixel text-[7px] text-gray-300 truncate max-w-[50px]">
                  ${token.symbol}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Panel: Building List */}
        <div className="lg:col-span-1 bg-bags-darker border border-red-500/30 p-3">
          <h3 className="font-pixel text-[10px] text-red-400 mb-3">ALL BUILDINGS</h3>

          {/* Add New Building */}
          <div className="mb-3 p-2 bg-green-500/10 border border-green-500/30">
            <p className="font-pixel text-[8px] text-green-400 mb-2">+ ADD NEW BUILDING</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Paste token mint address..."
                value={newMint}
                onChange={(e) => setNewMint(e.target.value)}
                className="flex-1 bg-black/50 border border-gray-700 px-2 py-1 font-mono text-[8px] text-white placeholder-gray-600"
              />
              <button
                onClick={addBuilding}
                disabled={isAdding || !newMint.trim()}
                className="font-pixel text-[8px] text-green-400 hover:text-green-300 bg-green-500/20 px-2 py-1 border border-green-500/30 disabled:opacity-50"
              >
                {isAdding ? "..." : "ADD"}
              </button>
            </div>
            <p className="font-pixel text-[6px] text-gray-500 mt-1">
              Auto-fetches from DexScreener/Bags.fm
            </p>
          </div>

          {/* Search and Filters */}
          <div className="space-y-2 mb-3">
            <input
              type="text"
              placeholder="Search by name, symbol, or mint..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/50 border border-gray-700 px-2 py-1 font-pixel text-[9px] text-white"
            />
            <div className="flex gap-2">
              <select
                value={filterZone}
                onChange={(e) => setFilterZone(e.target.value as ZoneType | "all")}
                className="flex-1 bg-black/50 border border-gray-700 px-2 py-1 font-pixel text-[8px] text-white"
              >
                <option value="all">All Zones</option>
                {VALID_ZONES.map((zone) => (
                  <option key={zone} value={zone}>
                    {ZONE_INFO[zone].name}
                  </option>
                ))}
              </select>
              <select
                value={filterFeatured === "all" ? "all" : filterFeatured ? "yes" : "no"}
                onChange={(e) =>
                  setFilterFeatured(
                    e.target.value === "all" ? "all" : e.target.value === "yes"
                  )
                }
                className="flex-1 bg-black/50 border border-gray-700 px-2 py-1 font-pixel text-[8px] text-white"
              >
                <option value="all">All</option>
                <option value="yes">Featured</option>
                <option value="no">Not Featured</option>
              </select>
            </div>
          </div>

          {/* Token List */}
          <div className="max-h-[400px] overflow-y-auto space-y-1">
            {filteredTokens.map((token) => {
              const level = token.level_override || calculateLevel(token.market_cap || 0);
              const hasOverrides =
                token.level_override ||
                token.position_x ||
                token.style_override ||
                token.zone_override;
              return (
                <button
                  key={token.mint}
                  onClick={() => setSelectedMint(token.mint)}
                  className={`w-full text-left p-2 border transition-all flex items-center gap-2 ${
                    selectedMint === token.mint
                      ? "border-red-400 bg-red-500/20"
                      : "border-gray-800 bg-black/30 hover:border-gray-600"
                  }`}
                >
                  <div
                    className="w-6 h-6 flex items-center justify-center border"
                    style={{
                      borderColor: BUILDING_STYLES[token.style_override || 0].colors[0],
                      backgroundColor: `${BUILDING_STYLES[token.style_override || 0].colors[0]}20`,
                    }}
                  >
                    <span className="font-pixel text-[8px] text-white">L{level}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-pixel text-[9px] text-white truncate">${token.symbol}</p>
                    <p className="font-pixel text-[7px] text-gray-500 truncate">{token.name}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {token.is_featured && (
                      <span className="text-yellow-400 text-[8px]">★</span>
                    )}
                    {token.is_verified && (
                      <span className="text-green-400 text-[8px]">✓</span>
                    )}
                    {hasOverrides && (
                      <span className="w-2 h-2 rounded-full bg-purple-500" title="Has overrides" />
                    )}
                  </div>
                </button>
              );
            })}
            {filteredTokens.length === 0 && (
              <p className="font-pixel text-[9px] text-gray-500 text-center py-4">
                No buildings found
              </p>
            )}
          </div>
        </div>

        {/* Right Panel: Building Editor */}
        <div className="lg:col-span-2 bg-bags-darker border border-red-500/30 p-4">
          {selectedToken ? (
            <>
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {selectedToken.image_url && (
                    <img
                      src={selectedToken.image_url}
                      alt={selectedToken.symbol}
                      className="w-12 h-12 object-cover border border-gray-700"
                    />
                  )}
                  <div>
                    <h3 className="font-pixel text-sm text-white">
                      ${selectedToken.symbol}
                      {selectedToken.is_featured && (
                        <span className="ml-2 text-yellow-400">★</span>
                      )}
                      {selectedToken.is_verified && (
                        <span className="ml-1 text-green-400">✓</span>
                      )}
                    </h3>
                    <p className="font-pixel text-[8px] text-gray-500">{selectedToken.name}</p>
                    <p className="font-pixel text-[7px] text-gray-600 truncate max-w-[200px]">
                      {selectedToken.mint}
                    </p>
                  </div>
                </div>
                <button
                  onClick={saveAllChanges}
                  disabled={isUpdating}
                  className="font-pixel text-[10px] bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white px-4 py-2 border border-green-400"
                >
                  {isUpdating ? "SAVING..." : "SAVE ALL"}
                </button>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-black/30 p-2 border border-gray-800">
                  <p className="font-pixel text-[7px] text-gray-500">Market Cap</p>
                  <p className="font-pixel text-[10px] text-bags-gold">
                    ${((selectedToken.market_cap || 0) / 1000).toFixed(1)}K
                  </p>
                </div>
                <div className="bg-black/30 p-2 border border-gray-800">
                  <p className="font-pixel text-[7px] text-gray-500">Volume 24h</p>
                  <p className="font-pixel text-[10px] text-blue-400">
                    ${((selectedToken.volume_24h || 0) / 1000).toFixed(1)}K
                  </p>
                </div>
                <div className="bg-black/30 p-2 border border-gray-800">
                  <p className="font-pixel text-[7px] text-gray-500">Lifetime Fees</p>
                  <p className="font-pixel text-[10px] text-green-400">
                    {(selectedToken.lifetime_fees || 0).toFixed(2)} SOL
                  </p>
                </div>
              </div>

              {/* Building Controls Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Level Control */}
                <div className="bg-black/30 p-3 border border-gray-800">
                  <label className="font-pixel text-[9px] text-gray-400 block mb-2">
                    BUILDING LEVEL
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={editLevel}
                      onChange={(e) =>
                        setEditLevel(e.target.value === "auto" ? "auto" : parseInt(e.target.value))
                      }
                      className="flex-1 bg-black/50 border border-gray-700 px-2 py-2 font-pixel text-[10px] text-white"
                    >
                      <option value="auto">
                        Auto (L{calculateLevel(selectedToken.market_cap || 0)})
                      </option>
                      {[1, 2, 3, 4, 5].map((l) => (
                        <option key={l} value={l}>
                          Level {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="font-pixel text-[7px] text-gray-600 mt-1">
                    L1: &lt;$100K | L2: $100K+ | L3: $500K+ | L4: $2M+ | L5: $10M+
                  </p>
                </div>

                {/* Style Control */}
                <div className="bg-black/30 p-3 border border-gray-800">
                  <label className="font-pixel text-[9px] text-gray-400 block mb-2">
                    BUILDING STYLE
                  </label>
                  <div className="flex gap-2">
                    {BUILDING_STYLES.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => setEditStyle(style.id)}
                        className={`flex-1 p-2 border-2 transition-all ${
                          editStyle === style.id
                            ? "border-white scale-105"
                            : "border-gray-700 hover:border-gray-500"
                        }`}
                        style={{
                          background: `linear-gradient(135deg, ${style.colors[0]}, ${style.colors[1]})`,
                        }}
                      >
                        <span className="font-pixel text-[8px] text-white drop-shadow-md">
                          {style.id}
                        </span>
                      </button>
                    ))}
                    <button
                      onClick={() => setEditStyle("auto")}
                      className={`flex-1 p-2 border-2 transition-all ${
                        editStyle === "auto"
                          ? "border-white"
                          : "border-gray-700 hover:border-gray-500"
                      } bg-gray-800`}
                    >
                      <span className="font-pixel text-[8px] text-gray-400">Auto</span>
                    </button>
                  </div>
                </div>

                {/* Zone Control */}
                <div className="bg-black/30 p-3 border border-gray-800">
                  <label className="font-pixel text-[9px] text-gray-400 block mb-2">
                    ZONE PLACEMENT
                  </label>
                  <select
                    value={editZone}
                    onChange={(e) => setEditZone(e.target.value as ZoneType | "auto")}
                    className="w-full bg-black/50 border border-gray-700 px-2 py-2 font-pixel text-[10px] text-white"
                  >
                    <option value="auto">Auto (hash-based)</option>
                    {VALID_ZONES.map((zone) => (
                      <option key={zone} value={zone}>
                        {ZONE_INFO[zone].name} - {ZONE_INFO[zone].description}
                      </option>
                    ))}
                  </select>
                  {editZone !== "auto" && (
                    <div
                      className="mt-2 p-2 border"
                      style={{
                        borderColor: ZONE_INFO[editZone].color,
                        backgroundColor: `${ZONE_INFO[editZone].color}20`,
                      }}
                    >
                      <p
                        className="font-pixel text-[9px]"
                        style={{ color: ZONE_INFO[editZone].color }}
                      >
                        {ZONE_INFO[editZone].name}
                      </p>
                      <p className="font-pixel text-[7px] text-gray-400">
                        {ZONE_INFO[editZone].description}
                      </p>
                    </div>
                  )}
                </div>

                {/* Health Control */}
                <div className="bg-black/30 p-3 border border-gray-800">
                  <label className="font-pixel text-[9px] text-gray-400 block mb-2">
                    BUILDING HEALTH
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={editHealth === "auto" ? 50 : editHealth}
                      onChange={(e) => setEditHealth(parseInt(e.target.value))}
                      disabled={editHealth === "auto"}
                      className="flex-1"
                    />
                    <span className="font-pixel text-[10px] text-white w-10 text-right">
                      {editHealth === "auto" ? "Auto" : `${editHealth}%`}
                    </span>
                    <button
                      onClick={() => setEditHealth(editHealth === "auto" ? 50 : "auto")}
                      className={`font-pixel text-[8px] px-2 py-1 border ${
                        editHealth === "auto"
                          ? "border-green-500 text-green-400"
                          : "border-gray-600 text-gray-400"
                      }`}
                    >
                      {editHealth === "auto" ? "AUTO" : "SET"}
                    </button>
                  </div>
                  <div className="mt-2 h-2 bg-gray-800 rounded overflow-hidden">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${editHealth === "auto" ? 50 : editHealth}%`,
                        backgroundColor:
                          (editHealth === "auto" ? 50 : editHealth) > 75
                            ? "#10B981"
                            : (editHealth === "auto" ? 50 : editHealth) > 50
                              ? "#F59E0B"
                              : (editHealth === "auto" ? 50 : editHealth) > 25
                                ? "#EF4444"
                                : "#6B7280",
                      }}
                    />
                  </div>
                </div>

                {/* Position Control */}
                <div className="bg-black/30 p-3 border border-gray-800 md:col-span-2">
                  <label className="font-pixel text-[9px] text-gray-400 block mb-2">
                    POSITION OVERRIDE
                  </label>
                  <div className="flex gap-4 items-end">
                    <div className="flex-1">
                      <label className="font-pixel text-[7px] text-gray-500 block mb-1">
                        X (0-1280)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="1280"
                        placeholder="Auto"
                        value={editPositionX}
                        onChange={(e) => setEditPositionX(e.target.value)}
                        className="w-full bg-black/50 border border-gray-700 px-2 py-2 font-pixel text-[10px] text-white"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="font-pixel text-[7px] text-gray-500 block mb-1">
                        Y (0-960)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="960"
                        placeholder="Auto"
                        value={editPositionY}
                        onChange={(e) => setEditPositionY(e.target.value)}
                        className="w-full bg-black/50 border border-gray-700 px-2 py-2 font-pixel text-[10px] text-white"
                      />
                    </div>
                    <button
                      onClick={() => {
                        setEditPositionX("");
                        setEditPositionY("");
                      }}
                      className="font-pixel text-[8px] text-gray-400 hover:text-white px-3 py-2 border border-gray-700"
                    >
                      RESET
                    </button>
                  </div>

                  {/* Mini Position Map */}
                  <div className="mt-3 relative">
                    <div className="w-full h-24 bg-black/50 border border-gray-700 relative overflow-hidden">
                      {/* Zone regions */}
                      <div
                        className="absolute left-0 top-0 w-1/5 h-1/2 border-r border-b border-gray-800"
                        style={{ backgroundColor: `${ZONE_INFO.labs.color}10` }}
                      >
                        <span className="font-pixel text-[6px] text-gray-600 p-1">HQ</span>
                      </div>
                      <div
                        className="absolute left-1/5 top-0 w-2/5 h-1/2 border-r border-b border-gray-800"
                        style={{ backgroundColor: `${ZONE_INFO.main_city.color}10` }}
                      >
                        <span className="font-pixel text-[6px] text-gray-600 p-1">Park</span>
                      </div>
                      <div
                        className="absolute left-[60%] top-0 w-2/5 h-1/2 border-b border-gray-800"
                        style={{ backgroundColor: `${ZONE_INFO.trending.color}10` }}
                      >
                        <span className="font-pixel text-[6px] text-gray-600 p-1">City</span>
                      </div>
                      <div
                        className="absolute left-0 bottom-0 w-1/3 h-1/2 border-r border-gray-800"
                        style={{ backgroundColor: `${ZONE_INFO.founders.color}10` }}
                      >
                        <span className="font-pixel text-[6px] text-gray-600 p-1">Founders</span>
                      </div>
                      <div
                        className="absolute right-0 bottom-0 w-1/3 h-1/2 border-gray-800"
                        style={{ backgroundColor: `${ZONE_INFO.ballers.color}10` }}
                      >
                        <span className="font-pixel text-[6px] text-gray-600 p-1">Ballers</span>
                      </div>

                      {/* Current position marker */}
                      {editPositionX && editPositionY && (
                        <div
                          className="absolute w-3 h-3 bg-red-500 border-2 border-white rounded-full transform -translate-x-1/2 -translate-y-1/2 z-10"
                          style={{
                            left: `${(parseFloat(editPositionX) / 1280) * 100}%`,
                            top: `${(parseFloat(editPositionY) / 960) * 100}%`,
                          }}
                        />
                      )}
                    </div>
                    <p className="font-pixel text-[7px] text-gray-600 mt-1">
                      Click zones or enter coordinates manually. Leave empty for auto-placement.
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <p className="font-pixel text-sm text-gray-500 mb-2">No Building Selected</p>
                <p className="font-pixel text-[9px] text-gray-600">
                  Select a building from the list to edit its properties
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
