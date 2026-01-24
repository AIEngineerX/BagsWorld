"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Suspense, useState, useEffect } from "react";
import { WorldHealthBar } from "@/components/WorldHealthBar";
import { Leaderboard } from "@/components/Leaderboard";
import { AgentDialogue } from "@/components/AgentDialogue";
import { EventFeed } from "@/components/EventFeed";
import { LaunchButton } from "@/components/LaunchButton";
import { AIChat } from "@/components/AIChat";
import { AshChat } from "@/components/AshChat";
import { TolyChat } from "@/components/TolyChat";
import { FinnbagsChat } from "@/components/FinnbagsChat";
import { DevChat } from "@/components/DevChat";
import { NeoChat } from "@/components/NeoChat";
import { CJChat } from "@/components/CJChat";
import { ShawChat } from "@/components/ShawChat";
import { AgentDashboard } from "@/components/AgentDashboard";
import { AdminConsole } from "@/components/AdminConsole";
import { YourBuildings } from "@/components/YourBuildings";
import { WalletButton } from "@/components/WalletButton";
import { ClaimButton } from "@/components/ClaimButton";
import { TradeModal } from "@/components/TradeModal";
import { LaunchModal } from "@/components/LaunchModal";
import { PartnerClaimButton } from "@/components/PartnerClaimButton";
import { MusicButton } from "@/components/MusicButton";
import { WorldIcon } from "@/components/icons";
import { useWorldState } from "@/hooks/useWorldState";
import { DatabaseStatus } from "@/components/DatabaseStatus";
import { EcosystemStats } from "@/components/EcosystemStats";
import { PokeCenterModal } from "@/components/PokeCenterModal";
import { FeeClaimModal } from "@/components/FeeClaimModal";
import { ZoneNav } from "@/components/ZoneNav";
import { MobileCharacterMenu } from "@/components/MobileCharacterMenu";
import { AgentFeed, AgentToast } from "@/components/AgentFeed";
import { TradingGymModal } from "@/components/TradingGymModal";
import { CreatorRewardsModal } from "@/components/CreatorRewardsModal";
import { CasinoModal } from "@/components/CasinoModal";
import { CasinoAdmin } from "@/components/CasinoAdmin";
import { LauncherHub } from "@/components/LauncherHub";
import { TradingTerminalModal } from "@/components/TradingTerminalModal";
import { initDialogueSystem, cleanupDialogueSystem } from "@/lib/autonomous-dialogue";
import {
  initDialogueEventBridge,
  cleanupDialogueEventBridge,
  onWorldStateUpdate,
  initBrowserEventListener,
} from "@/lib/dialogue-event-bridge";
import {
  initCharacterBehavior,
  cleanupCharacterBehavior,
  updateWorldStateForBehavior,
} from "@/lib/character-behavior";
import { AgentActivityIndicator } from "@/components/AgentActivityIndicator";
import { useWallet } from "@solana/wallet-adapter-react";

const CASINO_ADMIN_WALLET = "7BAHgz9Q2ubiTaVo9sCy5AdDvNMiJaK8FebGHTM3PEwm";

interface BuildingClickData {
  mint: string;
  symbol: string;
  name: string;
  tokenUrl?: string;
}

const GameCanvas = dynamic(() => import("@/components/GameCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-bags-dark">
      <div className="text-center">
        <div className="text-4xl mb-4 animate-pulse-slow">🌍</div>
        <p className="font-pixel text-xs text-bags-green animate-pulse">Loading BagsWorld...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  const { worldState, isLoading, refreshAfterLaunch, tokenCount } = useWorldState();
  const { publicKey } = useWallet();
  const [tradeToken, setTradeToken] = useState<BuildingClickData | null>(null);
  const [showPokeCenterModal, setShowPokeCenterModal] = useState(false);
  const [showFeeClaimModal, setShowFeeClaimModal] = useState(false);
  const [showTradingGymModal, setShowTradingGymModal] = useState(false);
  const [showCreatorRewardsModal, setShowCreatorRewardsModal] = useState(false);
  const [showCasinoModal, setShowCasinoModal] = useState(false);
  const [showLauncherHub, setShowLauncherHub] = useState(false);
  const [showCasinoAdmin, setShowCasinoAdmin] = useState(false);
  const [showTradingTerminal, setShowTradingTerminal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"leaderboard" | "agents">("agents");

  // State for LaunchModal
  const [showLaunchModal, setShowLaunchModal] = useState(false);

  // Listen for building click events from Phaser
  useEffect(() => {
    const handleBuildingClick = (event: CustomEvent<BuildingClickData>) => {
      setTradeToken(event.detail);
    };

    const handlePokeCenterClick = () => {
      setShowPokeCenterModal(true);
    };

    const handleTradingGymClick = () => {
      setShowTradingGymModal(true);
    };

    const handleTreasuryClick = () => {
      setShowCreatorRewardsModal(true);
    };

    const handleCasinoClick = () => {
      setShowCasinoModal(true);
    };

    const handleTradingTerminalClick = () => {
      setShowTradingTerminal(true);
    };

    // Handle AI action button events
    const handleLaunchClick = () => {
      setShowLaunchModal(true);
    };

    const handleClaimClick = () => {
      setShowFeeClaimModal(true);
    };

    window.addEventListener("bagsworld-building-click", handleBuildingClick as EventListener);
    window.addEventListener("bagsworld-pokecenter-click", handlePokeCenterClick as EventListener);
    window.addEventListener("bagsworld-tradinggym-click", handleTradingGymClick as EventListener);
    window.addEventListener("bagsworld-treasury-click", handleTreasuryClick as EventListener);
    window.addEventListener("bagsworld-casino-click", handleCasinoClick as EventListener);
    window.addEventListener(
      "bagsworld-terminal-click",
      handleTradingTerminalClick as EventListener
    );
    window.addEventListener("bagsworld-launch-click", handleLaunchClick as EventListener);
    window.addEventListener("bagsworld-claim-click", handleClaimClick as EventListener);
    return () => {
      window.removeEventListener("bagsworld-building-click", handleBuildingClick as EventListener);
      window.removeEventListener(
        "bagsworld-pokecenter-click",
        handlePokeCenterClick as EventListener
      );
      window.removeEventListener(
        "bagsworld-tradinggym-click",
        handleTradingGymClick as EventListener
      );
      window.removeEventListener("bagsworld-treasury-click", handleTreasuryClick as EventListener);
      window.removeEventListener("bagsworld-casino-click", handleCasinoClick as EventListener);
      window.removeEventListener(
        "bagsworld-terminal-click",
        handleTradingTerminalClick as EventListener
      );
      window.removeEventListener("bagsworld-launch-click", handleLaunchClick as EventListener);
      window.removeEventListener("bagsworld-claim-click", handleClaimClick as EventListener);
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

  // Pre-warm SDK on mount (fire-and-forget for faster subsequent API calls)
  useEffect(() => {
    fetch("/api/warm-sdk").catch((err) => {
      console.debug("[SDK] Pre-warm failed (non-critical):", err.message || err);
    });
  }, []);

  // Secret keyboard shortcut for casino admin (Ctrl+Shift+R)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "R") {
        e.preventDefault();
        setShowCasinoAdmin(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Initialize autonomous dialogue and behavior systems (all sync, non-blocking)
  useEffect(() => {
    // Run all initializations - they're synchronous and non-blocking
    initDialogueSystem();
    initDialogueEventBridge();
    initBrowserEventListener();
    initCharacterBehavior();

    return () => {
      cleanupDialogueSystem();
      cleanupDialogueEventBridge();
      cleanupCharacterBehavior();
    };
  }, []);

  // Update dialogue and behavior systems when world state changes
  useEffect(() => {
    if (worldState) {
      onWorldStateUpdate(worldState);
      updateWorldStateForBehavior(worldState);
    }
  }, [worldState]);

  return (
    <main className="h-[100dvh] w-screen overflow-hidden flex flex-col">
      {/* Header - responsive */}
      <header className="h-14 md:h-16 bg-bags-dark border-b-4 border-bags-green flex items-center justify-between px-2 md:px-4 relative z-50 safe-area-top shrink-0">
        {/* Left side - Logo and health */}
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-bags-green/20 border border-bags-green flex items-center justify-center flex-shrink-0">
              <WorldIcon className="text-bags-green" size={16} />
            </div>
            <h1 className="font-pixel text-xs sm:text-sm md:text-lg text-bags-green hidden xs:block">
              BAGSWORLD
            </h1>
          </div>
          <div className="hidden sm:block">
            <WorldHealthBar health={worldState?.health ?? 50} />
          </div>
        </div>

        {/* Desktop nav - hidden on mobile */}
        <div className="hidden lg:flex items-center gap-4">
          <Link
            href="/docs"
            className="font-pixel text-[10px] text-gray-400 hover:text-bags-green transition-colors"
          >
            [DOCS]
          </Link>
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

        {/* Mobile buttons - essential actions always visible */}
        <div className="flex lg:hidden items-center gap-1.5 sm:gap-2">
          <WalletButton />
          <LaunchButton />
          {/* Hamburger menu - pixel style */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="w-10 h-10 sm:w-11 sm:h-11 bg-bags-dark border border-bags-green text-bags-green hover:bg-bags-green/10 flex items-center justify-center touch-target active:scale-95 transition-all"
            aria-label="Toggle menu"
          >
            <span className="font-pixel text-[10px]">{mobileMenuOpen ? "[X]" : "[=]"}</span>
          </button>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-bags-dark border-b-4 border-bags-green p-3 sm:p-4 lg:hidden z-50 shadow-lg shadow-bags-green/10">
            <div className="flex flex-col gap-3">
              {/* Health bar on mobile */}
              <div className="sm:hidden pb-3 border-b border-bags-green/30">
                <p className="font-pixel text-[8px] text-gray-500 mb-2">[WORLD STATUS]</p>
                <WorldHealthBar health={worldState?.health ?? 50} />
              </div>

              {/* Weather */}
              <div className="font-pixel text-xs pb-3 border-b border-bags-green/30 flex items-center justify-between">
                <span className="text-gray-400">[WEATHER]</span>
                <span className="text-bags-gold">
                  {worldState?.weather?.toUpperCase() ?? "LOADING"}
                </span>
              </div>

              {/* Action buttons - grid for better touch targets */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Link href="/docs" className="btn-retro font-pixel text-[10px] text-center">
                  [DOCS]
                </Link>
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
                className="btn-retro w-full text-center font-pixel text-[10px]"
              >
                {mobileSidebarOpen ? "[HIDE STATS]" : "[SHOW STATS]"}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Game area */}
        <div className="flex-1 relative" style={{ touchAction: "auto" }}>
          <Suspense fallback={<div className="w-full h-full bg-bags-dark" />}>
            <GameCanvas worldState={worldState} />
          </Suspense>
          {/* Scanlines disabled on mobile via CSS for better touch handling */}
          <div className="scanlines" aria-hidden="true" />

          {/* Zone Navigation - positioned over game canvas */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20">
            <ZoneNav />
          </div>

          {/* Agent Activity Indicator - shows when agents are talking */}
          <AgentActivityIndicator />

          {/* Chat windows - always rendered but can show/hide based on click events */}
          {/* On mobile, users use MobileCharacterMenu to trigger these */}
          <AIChat />
          <TolyChat />
          <AshChat />
          <FinnbagsChat />
          <DevChat />
          <NeoChat />
          <CJChat />
          <ShawChat />
          <AgentDashboard />
          <AdminConsole />

          {/* Mobile character menu - floating button */}
          <MobileCharacterMenu />
        </div>

        {/* Sidebar - hidden on mobile, slide-in drawer on tablet, always visible on desktop */}
        <aside
          className={`
          ${mobileSidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"}
          fixed lg:relative right-0 top-14 md:top-16 lg:top-0
          w-full sm:w-80 h-[calc(100dvh-3.5rem)] md:h-[calc(100dvh-4rem)] lg:h-full
          bg-bags-dark border-l-4 border-bags-green flex flex-col
          transition-transform duration-300 ease-in-out z-40
          pb-safe
        `}
        >
          {/* Mobile sidebar close button */}
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="lg:hidden absolute top-2 left-2 p-2 text-bags-green hover:bg-bags-green/20 rounded"
            aria-label="Close sidebar"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Your Buildings */}
          <div className="max-h-48 overflow-hidden border-b-2 border-bags-green/50 pt-10 lg:pt-0">
            <YourBuildings onRefresh={refreshAfterLaunch} />
          </div>

          {/* Tabbed Section: Agent Chat / Leaderboard */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Tab Buttons */}
            <div className="flex border-b-2 border-bags-green/30 bg-bags-dark">
              <button
                onClick={() => setSidebarTab("agents")}
                className={`flex-1 py-2 font-pixel text-[9px] transition-colors ${
                  sidebarTab === "agents"
                    ? "text-bags-gold bg-bags-green/10 border-b-2 border-bags-gold -mb-0.5"
                    : "text-gray-500 hover:text-bags-green"
                }`}
              >
                [AGENTS]
              </button>
              <button
                onClick={() => setSidebarTab("leaderboard")}
                className={`flex-1 py-2 font-pixel text-[9px] transition-colors ${
                  sidebarTab === "leaderboard"
                    ? "text-bags-gold bg-bags-green/10 border-b-2 border-bags-gold -mb-0.5"
                    : "text-gray-500 hover:text-bags-green"
                }`}
              >
                [EARNERS]
              </button>
            </div>
            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
              {sidebarTab === "agents" ? <AgentDialogue /> : <Leaderboard />}
            </div>
          </div>

          {/* Agent Feed - coordinated agent activity */}
          <div className="h-32 border-t-2 border-bags-green/50">
            <AgentFeed compact maxItems={10} showHeader={false} className="h-full" />
          </div>

          {/* Event Feed */}
          <div className="h-36 border-t-4 border-bags-green">
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
      <footer className="h-8 sm:h-9 bg-bags-dark border-t-4 border-bags-green flex items-center justify-between px-2 md:px-4 font-pixel text-[7px] sm:text-[8px] md:text-[10px] safe-area-bottom shrink-0">
        <div className="flex items-center gap-2 md:gap-4">
          <span className="text-gray-400">
            [POP:<span className="text-white ml-1">{worldState?.population?.length ?? 0}</span>]
          </span>
          <span className="text-gray-400 hidden sm:inline">
            [BLDG:<span className="text-white ml-1">{worldState?.buildings?.length ?? 0}</span>]
          </span>
          <div className="hidden md:block">
            <DatabaseStatus />
          </div>
          <div className="hidden lg:block">
            <EcosystemStats />
          </div>
          <button
            onClick={() => setShowTradingTerminal(true)}
            className="text-[#22c55e] hover:text-[#16a34a] transition-colors"
          >
            [TERMINAL]
          </button>
          <button
            onClick={() => setShowLauncherHub(true)}
            className="text-gray-400 hover:text-bags-green transition-colors"
          >
            [LAUNCHERS]
          </button>
          {publicKey?.toString() === CASINO_ADMIN_WALLET && (
            <button
              onClick={() => setShowCasinoAdmin(true)}
              className="text-bags-gold hover:text-yellow-300 transition-colors"
            >
              [ADMIN]
            </button>
          )}
        </div>
        <div className="text-gray-400">
          <a
            href="https://bags.fm"
            target="_blank"
            rel="noopener noreferrer"
            className="text-bags-green hover:text-bags-gold transition-colors"
          >
            [BAGS.FM]
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

      {/* Trading Gym Modal - triggered by clicking Trading Gym building */}
      {showTradingGymModal && <TradingGymModal onClose={() => setShowTradingGymModal(false)} />}

      {/* Creator Rewards Hub Modal - Treasury Building */}
      {showCreatorRewardsModal && (
        <CreatorRewardsModal onClose={() => setShowCreatorRewardsModal(false)} />
      )}

      {/* Casino Modal - triggered by clicking Casino building */}
      {showCasinoModal && <CasinoModal onClose={() => setShowCasinoModal(false)} />}

      {/* Trading Terminal Modal - professional trading terminal with charts */}
      {showTradingTerminal && (
        <TradingTerminalModal onClose={() => setShowTradingTerminal(false)} />
      )}

      {/* Fee Claim Modal - can be opened from PokeCenter or AI action buttons */}
      {showFeeClaimModal && <FeeClaimModal onClose={() => setShowFeeClaimModal(false)} />}

      {/* Launch Modal - can be opened from AI action buttons */}
      {showLaunchModal && (
        <LaunchModal
          onClose={() => setShowLaunchModal(false)}
          onLaunchSuccess={() => {
            setShowLaunchModal(false);
            refreshAfterLaunch();
          }}
        />
      )}

      {/* Agent Toast Notifications - shows real-time agent activity */}
      <AgentToast />

      {/* Launcher Hub - shows wallets of people who launched on BagsWorld */}
      {showLauncherHub && <LauncherHub onClose={() => setShowLauncherHub(false)} />}

      {/* Casino Admin - secret panel (Ctrl+Shift+R) */}
      {showCasinoAdmin && <CasinoAdmin onClose={() => setShowCasinoAdmin(false)} />}
    </main>
  );
}
