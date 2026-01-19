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
import { NeoChat } from "@/components/NeoChat";
import { AgentDashboard } from "@/components/AgentDashboard";
import { YourBuildings } from "@/components/YourBuildings";
import { WalletButton } from "@/components/WalletButton";
import { ClaimButton } from "@/components/ClaimButton";
import { TradeModal } from "@/components/TradeModal";
import { PartnerClaimButton } from "@/components/PartnerClaimButton";
import { MusicButton } from "@/components/MusicButton";
import { useWorldState } from "@/hooks/useWorldState";
import { DatabaseStatus } from "@/components/DatabaseStatus";
import { EcosystemStats } from "@/components/EcosystemStats";
import { PokeCenterModal } from "@/components/PokeCenterModal";
import { FeeClaimModal } from "@/components/FeeClaimModal";
import { TestLaunchButton } from "@/components/TestLaunchButton";

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
  const [showPokeCenterModal, setShowPokeCenterModal] = useState(false);
  const [showFeeClaimModal, setShowFeeClaimModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false);
        setMobileSidebarOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <main className="h-screen w-screen overflow-hidden flex flex-col">
      {/* Header - responsive */}
      <header className="h-14 md:h-16 bg-bags-dark border-b-4 border-bags-green flex items-center justify-between px-2 md:px-4 relative z-50">
        {/* Left side - Logo and health */}
        <div className="flex items-center gap-2 md:gap-4">
          <h1 className="font-pixel text-sm md:text-lg text-bags-green">BAGSWORLD</h1>
          <div className="hidden sm:block">
            <WorldHealthBar health={worldState?.health ?? 50} />
          </div>
        </div>

        {/* Desktop nav - hidden on mobile */}
        <div className="hidden lg:flex items-center gap-4">
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
          <TestLaunchButton />
        </div>

        {/* Mobile buttons - essential actions always visible */}
        <div className="flex lg:hidden items-center gap-2">
          <WalletButton />
          <LaunchButton />
          {/* Hamburger menu */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-bags-green hover:bg-bags-green/20 rounded"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-bags-dark border-b-4 border-bags-green p-4 lg:hidden z-50">
            <div className="flex flex-col gap-3">
              {/* Health bar on mobile */}
              <div className="sm:hidden pb-2 border-b border-bags-green/30">
                <WorldHealthBar health={worldState?.health ?? 50} />
              </div>

              {/* Weather */}
              <div className="font-pixel text-xs pb-2 border-b border-bags-green/30">
                <span className="text-gray-400">WEATHER: </span>
                <span className="text-bags-gold">
                  {worldState?.weather?.toUpperCase() ?? "LOADING"}
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <MusicButton />
                <PartnerClaimButton />
                <ClaimButton />
              </div>

              {/* Toggle sidebar button */}
              <button
                onClick={() => {
                  setMobileSidebarOpen(!mobileSidebarOpen);
                  setMobileMenuOpen(false);
                }}
                className="btn-retro w-full text-center"
              >
                {mobileSidebarOpen ? "HIDE STATS" : "SHOW STATS"}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative">
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

          {/* Chat windows - hidden on small mobile */}
          <div className="hidden sm:block">
            <AIChat />
            <TolyChat />
            <AshChat />
            <FinnbagsChat />
            <DevChat />
            <NeoChat />
            <AgentDashboard />
          </div>
        </div>

        {/* Sidebar - hidden on mobile, slide-in drawer on tablet, always visible on desktop */}
        <aside className={`
          ${mobileSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
          fixed lg:relative right-0 top-14 md:top-16 lg:top-0
          w-full sm:w-80 h-[calc(100vh-3.5rem)] md:h-[calc(100vh-4rem)] lg:h-full
          bg-bags-dark border-l-4 border-bags-green flex flex-col
          transition-transform duration-300 ease-in-out z-40
        `}>
          {/* Mobile sidebar close button */}
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="lg:hidden absolute top-2 left-2 p-2 text-bags-green hover:bg-bags-green/20 rounded"
            aria-label="Close sidebar"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Your Buildings */}
          <div className="max-h-48 overflow-hidden border-b-2 border-bags-green/50 pt-10 lg:pt-0">
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

        {/* Mobile sidebar overlay */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}
      </div>

      {/* Footer status bar - simplified on mobile */}
      <footer className="h-8 bg-bags-dark border-t-4 border-bags-green flex items-center justify-between px-2 md:px-4 font-pixel text-[8px] md:text-[10px]">
        <div className="flex items-center gap-2 md:gap-4">
          <span className="text-gray-400">
            POP: <span className="text-white">{worldState?.population?.length ?? 0}</span>
          </span>
          <span className="text-gray-400 hidden sm:inline">
            BUILDINGS: <span className="text-white">{worldState?.buildings?.length ?? 0}</span>
          </span>
          <div className="hidden md:block">
            <DatabaseStatus />
          </div>
          <div className="hidden lg:block">
            <EcosystemStats />
          </div>
        </div>
        <div className="text-gray-400">
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
