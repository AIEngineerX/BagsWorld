"use client";

import { useState } from "react";
import type { OracleMarketType } from "@/lib/types";

interface MarketData {
  id: number;
  status: string;
  startTime: string;
  endTime: string;
  remainingMs: number;
  canEnter: boolean;
  entryCount: number;
  marketType: OracleMarketType;
  question: string;
  outcomeType: string;
  outcomes: Array<{ id: string; label: string }>;
  tokenOptions: Array<{
    mint: string;
    symbol: string;
    name: string;
    startPrice: number;
    imageUrl?: string;
  }>;
  predictionCounts: Record<string, number>;
  entryCostOp: number;
  userPrediction?: {
    tokenMint: string;
    outcomeId?: string;
    opWagered: number;
  };
  prizePool: { sol: number; hasPrize: boolean };
}

interface OracleMarketsTabProps {
  markets: MarketData[];
  opBalance: number;
  walletConnected: boolean;
  onPredict: (roundId: number, tokenMint: string, outcomeId?: string) => Promise<void>;
  onConnectWallet: () => void;
  isSubmitting: boolean;
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

const MARKET_TYPE_LABELS: Record<string, string> = {
  all: "ALL",
  price_prediction: "PRICE",
  custom: "CUSTOM",
};

const MARKET_TYPE_ICONS: Record<string, string> = {
  price_prediction: "◆",
  custom: "★",
};

export function OracleMarketsTab({
  markets,
  opBalance,
  walletConnected,
  onPredict,
  onConnectWallet,
  isSubmitting,
}: OracleMarketsTabProps) {
  const [filter, setFilter] = useState<string>("all");
  const [selectedChoices, setSelectedChoices] = useState<Record<number, string>>({});

  const filteredMarkets =
    filter === "all" ? markets : markets.filter((m) => m.marketType === filter);

  const getTotalPredictions = (market: MarketData) => {
    return Object.values(market.predictionCounts).reduce((a, b) => a + b, 0);
  };

  const getProbability = (market: MarketData, id: string) => {
    const total = getTotalPredictions(market);
    if (total === 0) {
      const optionCount =
        market.outcomeType === "multiple_choice"
          ? market.tokenOptions.length || market.outcomes.length
          : 2;
      return 100 / optionCount;
    }
    return ((market.predictionCounts[id] || 0) / total) * 100;
  };

  const handleSelect = (marketId: number, choiceId: string) => {
    setSelectedChoices((prev) => ({ ...prev, [marketId]: choiceId }));
  };

  const handleSubmit = async (market: MarketData) => {
    const choice = selectedChoices[market.id];
    if (!choice) return;

    if (market.marketType === "price_prediction") {
      await onPredict(market.id, choice);
    } else {
      await onPredict(market.id, "", choice);
    }
    setSelectedChoices((prev) => {
      const next = { ...prev };
      delete next[market.id];
      return next;
    });
  };

  if (markets.length === 0) {
    return (
      <div className="rpg-border-inner bg-[#1a1a1a] p-6 text-center">
        <div className="relative w-16 h-16 mx-auto mb-4">
          <div className="absolute inset-0 bg-purple-500/20 rounded-full animate-pulse" />
          <div className="w-full h-full flex items-center justify-center">
            <span className="font-pixel text-[#a855f7] text-2xl animate-pulse">?</span>
          </div>
        </div>
        <p className="font-pixel text-[#a855f7] text-sm glow-text">NO ACTIVE MARKETS</p>
        <p className="font-pixel text-[#666] text-[10px] mt-2">
          Markets are generated automatically. Check back soon!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Type Filter */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {Object.entries(MARKET_TYPE_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`font-pixel text-[9px] px-2 py-1 rpg-button whitespace-nowrap ${
              filter === key ? "active" : ""
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Market Cards */}
      {filteredMarkets.map((market) => {
        const isTokenMarket = market.marketType === "price_prediction";
        const options = isTokenMarket
          ? market.tokenOptions.map((t) => ({
              id: t.mint,
              label: t.symbol,
              imageUrl: t.imageUrl,
              sublabel: t.name,
            }))
          : market.outcomes.map((o) => ({
              id: o.id,
              label: o.label,
            }));

        const selected = selectedChoices[market.id];
        const hasUserPrediction = !!market.userPrediction;
        const userChoice = market.userPrediction?.tokenMint || market.userPrediction?.outcomeId;

        return (
          <div key={market.id} className="rpg-border-inner bg-[#1a1a1a]">
            {/* Market Header */}
            <div className="p-3 border-b-2 border-[#2e1065] bg-gradient-to-r from-[#1a1a2e] to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-pixel text-[#a855f7] text-[10px]">
                    {MARKET_TYPE_ICONS[market.marketType] || "◆"}
                  </span>
                  <span className="font-pixel text-[#666] text-[9px]">#{market.id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-pixel text-[#22c55e] text-[10px] glow-green">
                    {formatTimeRemaining(market.remainingMs)}
                  </span>
                  {market.prizePool.hasPrize && (
                    <span className="font-pixel text-[#fbbf24] text-[9px]">
                      {market.prizePool.sol} SOL
                    </span>
                  )}
                </div>
              </div>
              <p className="font-pixel text-white text-xs mt-1">{market.question}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="font-pixel text-[#666] text-[9px]">
                  {market.entryCount} seer{market.entryCount !== 1 ? "s" : ""}
                </span>
                <span className="font-pixel text-[#a855f7] text-[9px]">
                  {market.entryCostOp} OP
                </span>
              </div>
            </div>

            {/* User Prediction Status */}
            {hasUserPrediction && (
              <div className="px-3 py-2 bg-[#6b21a8]/10 border-b border-[#2e1065]">
                <p className="font-pixel text-[#a855f7] text-[9px]">
                  YOUR PICK:{" "}
                  <span className="text-white">
                    {options.find((o) => o.id === userChoice)?.label || userChoice}
                  </span>
                  <span className="text-[#666] ml-2">({market.userPrediction?.opWagered} OP)</span>
                </p>
              </div>
            )}

            {/* Options */}
            <div className="p-3 space-y-2">
              {options.map((option) => {
                const probability = getProbability(market, option.id);
                const predictions = market.predictionCounts[option.id] || 0;
                const isSelected = selected === option.id;
                const isUserPick = userChoice === option.id;

                return (
                  <button
                    key={option.id}
                    onClick={() =>
                      !hasUserPrediction && market.canEnter && handleSelect(market.id, option.id)
                    }
                    disabled={hasUserPrediction || !market.canEnter}
                    className={`w-full text-left p-2 transition-all ${
                      isSelected
                        ? "rpg-border bg-[#6b21a8]/20"
                        : isUserPick
                          ? "rpg-border-inner bg-[#6b21a8]/10"
                          : "rpg-border-inner bg-[#0d0d0d] hover:bg-[#1a1a2e]"
                    } ${hasUserPrediction || !market.canEnter ? "cursor-default" : "cursor-pointer"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {"imageUrl" in option && option.imageUrl ? (
                          <img
                            src={option.imageUrl as string}
                            alt=""
                            className="w-5 h-5 pixelated"
                          />
                        ) : (
                          <span className="font-pixel text-[#a855f7] text-[10px]">
                            {isTokenMarket
                              ? "◆"
                              : option.label === "YES" || option.label === "OVER"
                                ? "▲"
                                : option.label === "NO" || option.label === "UNDER"
                                  ? "▼"
                                  : "●"}
                          </span>
                        )}
                        <span className="font-pixel text-white text-xs">{option.label}</span>
                      </div>
                      <span className="font-pixel text-[#a855f7] text-xs">
                        {probability.toFixed(0)}%
                      </span>
                    </div>
                    <div className="mt-1 h-2 bg-[#0a0a0a] rpg-border-inner relative overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#6b21a8] to-[#a855f7] transition-all"
                        style={{ width: `${probability}%` }}
                      />
                    </div>
                    <span className="font-pixel text-[#666] text-[8px]">
                      {predictions} prediction{predictions !== 1 ? "s" : ""}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Submit */}
            {!hasUserPrediction && market.canEnter && (
              <div className="px-3 pb-3">
                {walletConnected ? (
                  <button
                    onClick={() => handleSubmit(market)}
                    disabled={!selected || isSubmitting || opBalance < market.entryCostOp}
                    className={`w-full font-pixel text-[10px] py-2 rpg-button ${
                      selected ? "glow-text" : ""
                    }`}
                  >
                    {isSubmitting
                      ? "SUBMITTING..."
                      : opBalance < market.entryCostOp
                        ? `NEED ${market.entryCostOp} OP`
                        : selected
                          ? `PREDICT ${options.find((o) => o.id === selected)?.label} (${market.entryCostOp} OP)`
                          : "SELECT OPTION"}
                  </button>
                ) : (
                  <button
                    onClick={onConnectWallet}
                    className="w-full font-pixel text-[10px] py-2 rpg-button glow-text"
                  >
                    CONNECT WALLET
                  </button>
                )}
              </div>
            )}

            {!market.canEnter && !hasUserPrediction && (
              <div className="px-3 pb-3">
                <div className="rpg-border-inner bg-[#854d0e]/20 p-2 text-center">
                  <p className="font-pixel text-[#fbbf24] text-[9px]">ENTRIES CLOSED</p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
