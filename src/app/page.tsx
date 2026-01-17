"use client";

import dynamic from "next/dynamic";
import { Suspense, useState, useEffect } from "react";
import { WorldHealthBar } from "@/components/WorldHealthBar";
import { Leaderboard } from "@/components/Leaderboard";
import { EventFeed } from "@/components/EventFeed";
import { LaunchButton } from "@/components/LaunchButton";
import { AIChat } from "@/components/AIChat";
import { AshChat } from "@/components/AshChat";
import { TolyChat } from "@/components/TolyChat";
import { FinnbagsChat } from "@/components/FinnbagsChat";
import { DevChat } from "@/components/DevChat";
import { AgentDashboard } from "@/components/AgentDashboard";
import { YourBuildings } from "@/components/YourBuildings";
import { WalletButton } from "@/components/WalletButton";
import { ClaimButton } from "@/components/ClaimButton";
import { TradeModal } from "@/components/TradeModal";
import { PartnerClaimButton } from "@/components/PartnerClaimButton";
import { MusicButton } from "@/components/MusicButton";
import { useWorldState } from "@/hooks/useWorldState";
import { DatabaseStatus } from "@/components/DatabaseStatus";

interface BuildingClickData {
  mint: string;
  symbol: string;
  name: string;
  tokenUrl?: string;
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

  // Listen for building click events from Phaser
  useEffect(() => {
    const handleBuildingClick = (event: CustomEvent<BuildingClickData>) => {
      setTradeToken(event.detail);
    };

    window.addEventListener("bagsworld-building-click", handleBuildingClick as EventListener);
    return () => {
      window.removeEventListener("bagsworld-building-click", handleBuildingClick as EventListener);
    };
  }, []);

  return (
    <main className="h-screen w-screen overflow-hidden flex flex-col">
      {/* Header */}
      <header className="h-16 bg-bags-dark border-b-4 border-bags-green flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <h1 className="font-pixel text-lg text-bags-green">BAGSWORLD</h1>
          <WorldHealthBar health={worldState?.health ?? 50} />
        </div>
        <div className="flex items-center gap-4">
          <div className="font-pixel text-xs">
            <span className="text-gray-400">WEATHER: </span>
            <span className="text-bags-gold">
              {worldState?.weather?.toUpperCase() ?? "LOADING"}
            </span>
          </div>
          <MusicButton />
          <WalletButton />
          <PartnerClaimButton />
          <ClaimButton />
          <LaunchButton />
        </div>
      </header>

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

        {/* Sidebar */}
        <aside className="w-80 bg-bags-dark border-l-4 border-bags-green flex flex-col">
          {/* Your Buildings */}
          <div className="max-h-48 overflow-hidden border-b-2 border-bags-green/50">
            <YourBuildings onRefresh={refreshAfterLaunch} />
          </div>

          {/* Leaderboard */}
          <div className="flex-1 overflow-hidden">
            <Leaderboard />
          </div>

          {/* Event Feed */}
          <div className="h-48 border-t-4 border-bags-green">
            <EventFeed events={worldState?.events ?? []} />
          </div>
        </aside>
      </div>

      {/* Footer status bar */}
      <footer className="h-8 bg-bags-dark border-t-4 border-bags-green flex items-center justify-between px-4 font-pixel text-[10px]">
        <div className="flex items-center gap-4">
          <span className="text-gray-400">
            POPULATION:{" "}
            <span className="text-white">
              {worldState?.population?.length ?? 0}
            </span>
          </span>
          <span className="text-gray-400">
            BUILDINGS:{" "}
            <span className="text-white">
              {worldState?.buildings?.length ?? 0}
            </span>
          </span>
          <span className="text-gray-400">
            YOUR TOKENS:{" "}
            <span className="text-bags-gold">
              {tokenCount ?? 0}
            </span>
          </span>
          <DatabaseStatus />
        </div>
        <div className="text-gray-400">
          POWERED BY{" "}
          <a
            href="https://bags.fm"
            target="_blank"
            className="text-bags-green hover:underline"
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
    </main>
  );
}
