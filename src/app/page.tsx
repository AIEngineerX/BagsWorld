"use client";

import dynamic from "next/dynamic";
import { Suspense, useState, useEffect } from "react";
import { WorldHealthBar } from "@/components/WorldHealthBar";
import { TabbedSidebar } from "@/components/TabbedSidebar";
import { LaunchButton } from "@/components/LaunchButton";
import { AIChat } from "@/components/AIChat";
import { AshChat } from "@/components/AshChat";
import { TolyChat } from "@/components/TolyChat";
import { FinnbagsChat } from "@/components/FinnbagsChat";
import { DevChat } from "@/components/DevChat";
import { AgentDashboard } from "@/components/AgentDashboard";
import { WalletButton } from "@/components/WalletButton";
import { ClaimButton } from "@/components/ClaimButton";
import { TradeModal } from "@/components/TradeModal";
import { PartnerClaimButton } from "@/components/PartnerClaimButton";
import { MusicButton } from "@/components/MusicButton";
import { useWorldState } from "@/hooks/useWorldState";
import { DatabaseStatus } from "@/components/DatabaseStatus";
import { PokeCenterModal } from "@/components/PokeCenterModal";
import { FeeClaimModal } from "@/components/FeeClaimModal";
import { TradingTerminal } from "@/components/TradingTerminal";

interface BuildingClickData {
  mint: string;
  symbol: string;
  name: string;
  tokenUrl?: string;
}

// Weather emoji helper
function getWeatherEmoji(weather: string | undefined): string {
  switch (weather) {
    case "sunny": return "☀️";
    case "cloudy": return "☁️";
    case "rain": return "🌧️";
    case "storm": return "⛈️";
    case "apocalypse": return "🔥";
    default: return "🌤️";
  }
}

const GameCanvas = dynamic(() => import("@/components/GameCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-bags-darker">
      <div className="text-center">
        <div className="text-4xl mb-4 animate-pulse-slow">🌍</div>
        <p className="font-pixel text-xs text-bags-green animate-pulse">
          Loading BagsWorld...
        </p>
      </div>
    </div>
  ),
});

export default function Home() {
  const { worldState, isLoading, refreshAfterLaunch, tokenCount } = useWorldState();
  const [tradeToken, setTradeToken] = useState<BuildingClickData | null>(null);
  const [showPokeCenterModal, setShowPokeCenterModal] = useState(false);
  const [showFeeClaimModal, setShowFeeClaimModal] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);

  // Listen for building click events from Phaser
  useEffect(() => {
    const handleBuildingClick = (event: CustomEvent<BuildingClickData>) => {
      setTradeToken(event.detail);
    };

    const handlePokeCenterClick = () => {
      setShowPokeCenterModal(true);
    };

    window.addEventListener("bagsworld-building-click", handleBuildingClick as EventListener);
    window.addEventListener("bagsworld-pokecenter-click", handlePokeCenterClick as EventListener);
    return () => {
      window.removeEventListener("bagsworld-building-click", handleBuildingClick as EventListener);
      window.removeEventListener("bagsworld-pokecenter-click", handlePokeCenterClick as EventListener);
    };
  }, []);

  return (
    <main className="h-screen w-screen overflow-hidden flex flex-col">
      {/* Header */}
      <header className="h-14 bg-bags-dark border-b-4 border-bags-green flex items-center justify-between px-4">
        {/* Left: Logo + Health */}
        <div className="flex items-center gap-3">
          <h1 className="font-pixel text-base text-bags-green tracking-wider">BAGSWORLD</h1>
          <WorldHealthBar health={worldState?.health ?? 50} />
          <div className="hidden md:flex items-center gap-2 ml-2 font-pixel text-[9px]">
            <span className="text-gray-500">|</span>
            <span className="text-gray-400">
              {getWeatherEmoji(worldState?.weather)} {worldState?.weather?.toUpperCase() ?? "..."}
            </span>
          </div>
        </div>

        {/* Center: Quick Stats */}
        <div className="hidden lg:flex items-center gap-4 font-pixel text-[9px]">
          <div className="flex items-center gap-1">
            <span className="text-gray-500">POP</span>
            <span className="text-white">{worldState?.population?.length ?? 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500">BLDGS</span>
            <span className="text-white">{worldState?.buildings?.length ?? 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500">YOURS</span>
            <span className="text-bags-gold">{tokenCount ?? 0}</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTerminal(!showTerminal)}
            className={`font-pixel text-[9px] px-2 py-1 border-2 rounded transition-all flex items-center gap-1 ${
              showTerminal
                ? "bg-bags-green/20 border-bags-green text-bags-green"
                : "bg-bags-darker border-gray-600 text-gray-400 hover:border-bags-green hover:text-bags-green"
            }`}
            title="Trading Terminal"
          >
            <span>📈</span>
            <span className="hidden sm:inline">TRADE</span>
          </button>
          <MusicButton />
          <WalletButton />
          <div className="hidden md:flex items-center gap-2">
            <PartnerClaimButton />
            <ClaimButton />
          </div>
          <LaunchButton />
        </div>
      </header>

      {/* Trading Terminal - expandable from header */}
      <TradingTerminal
        isOpen={showTerminal}
        onClose={() => setShowTerminal(false)}
      />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Game area */}
        <div className="flex-1 relative">
          <Suspense
            fallback={
              <div className="w-full h-full bg-bags-darker animate-pulse" />
            }
          >
            <GameCanvas worldState={worldState} />
          </Suspense>
          <div className="scanlines" />

          {/* AI Agent Chat */}
          <AIChat />

          {/* Toly's Solana Guide */}
          <TolyChat />

          {/* Ash's Ecosystem Guide */}
          <AshChat />

          {/* Finn's Bags.fm Guide */}
          <FinnbagsChat />

          {/* The Dev's Trading Desk */}
          <DevChat />

          {/* Agent Dashboard (Admin Only) */}
          <AgentDashboard />
        </div>

        {/* Sidebar - Tabbed Interface */}
        <TabbedSidebar
          events={worldState?.events ?? []}
          onRefresh={refreshAfterLaunch}
        />
      </div>

      {/* Footer status bar */}
      <footer className="h-6 bg-bags-darker border-t-2 border-bags-green/50 flex items-center justify-between px-4 font-pixel text-[8px]">
        <div className="flex items-center gap-3">
          <DatabaseStatus />
          <span className="text-gray-600 hidden sm:inline">
            {worldState?.timeInfo?.isNight ? "🌙" : "☀️"} {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" })} EST
          </span>
        </div>
        <div className="text-gray-500">
          POWERED BY{" "}
          <a
            href="https://bags.fm"
            target="_blank"
            className="text-bags-green/70 hover:text-bags-green"
          >
            BAGS.FM
          </a>
        </div>
      </footer>

      {/* Trade Modal - triggered by clicking buildings */}
      {tradeToken && (
        <TradeModal
          tokenMint={tradeToken.mint}
          tokenSymbol={tradeToken.symbol}
          tokenName={tradeToken.name}
          onClose={() => setTradeToken(null)}
        />
      )}

      {/* PokeCenter Modal - triggered by clicking PokeCenter building */}
      {showPokeCenterModal && (
        <PokeCenterModal
          onClose={() => setShowPokeCenterModal(false)}
          onOpenFeeClaimModal={() => setShowFeeClaimModal(true)}
        />
      )}

      {/* Fee Claim Modal - can be opened from PokeCenter */}
      {showFeeClaimModal && (
        <FeeClaimModal onClose={() => setShowFeeClaimModal(false)} />
      )}
    </main>
  );
}
