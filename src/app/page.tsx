"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect, useCallback, useMemo } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { WorldHealthBar } from "@/components/WorldHealthBar";
import { Leaderboard } from "@/components/Leaderboard";
import { LiveMarketFeed } from "@/components/LiveMarketFeed";
import { AgentChatterFeed } from "@/components/AgentChatterFeed";
import { LaunchButton } from "@/components/LaunchButton";
import { YourBuildings } from "@/components/YourBuildings";
import { WalletButton } from "@/components/WalletButton";
import { ClaimButton } from "@/components/ClaimButton";
import { PartnerClaimButton } from "@/components/PartnerClaimButton";
import { MusicButton } from "@/components/MusicButton";
import { EnterWorldButton } from "@/components/EnterWorldButton";
import { WorldIcon } from "@/components/icons";
import { useWorldState } from "@/hooks/useWorldState";
import { DatabaseStatus } from "@/components/DatabaseStatus";
import { EcosystemStats } from "@/components/EcosystemStats";
import { ZoneNav } from "@/components/ZoneNav";
import { MobileCharacterMenu } from "@/components/MobileCharacterMenu";
import { ScoutAlerts } from "@/components/ScoutAlerts";
import { MiniMap } from "@/components/MiniMap";
import { QuestTracker } from "@/components/QuestTracker";

// Lazy-loaded chat components — only downloaded when character is clicked
const AIChat = dynamic(() => import("@/components/AIChat").then((m) => m.AIChat), { ssr: false });
const AshChat = dynamic(() => import("@/components/AshChat").then((m) => m.AshChat), {
  ssr: false,
});
const TolyChat = dynamic(() => import("@/components/TolyChat").then((m) => m.TolyChat), {
  ssr: false,
});
const FinnbagsChat = dynamic(
  () => import("@/components/FinnbagsChat").then((m) => m.FinnbagsChat),
  { ssr: false }
);
const DevChat = dynamic(() => import("@/components/DevChat").then((m) => m.DevChat), {
  ssr: false,
});
const NeoChat = dynamic(() => import("@/components/NeoChat").then((m) => m.NeoChat), {
  ssr: false,
});
const CJChat = dynamic(() => import("@/components/CJChat").then((m) => m.CJChat), { ssr: false });
const ShawChat = dynamic(() => import("@/components/ShawChat").then((m) => m.ShawChat), {
  ssr: false,
});
const RamoChat = dynamic(() => import("@/components/RamoChat").then((m) => m.RamoChat), {
  ssr: false,
});
const SincaraChat = dynamic(() => import("@/components/SincaraChat").then((m) => m.SincaraChat), {
  ssr: false,
});
const StuuChat = dynamic(() => import("@/components/StuuChat").then((m) => m.StuuChat), {
  ssr: false,
});
const SamChat = dynamic(() => import("@/components/SamChat").then((m) => m.SamChat), {
  ssr: false,
});
const AlaaChat = dynamic(() => import("@/components/AlaaChat").then((m) => m.AlaaChat), {
  ssr: false,
});
const CarloChat = dynamic(() => import("@/components/CarloChat").then((m) => m.CarloChat), {
  ssr: false,
});
const BNNChat = dynamic(() => import("@/components/BNNChat").then((m) => m.BNNChat), {
  ssr: false,
});
const ProfessorOakChat = dynamic(
  () => import("@/components/ProfessorOakChat").then((m) => m.ProfessorOakChat),
  { ssr: false }
);
const BagsyChat = dynamic(() => import("@/components/BagsyChat").then((m) => m.BagsyChat), {
  ssr: false,
});
const AgentDashboard = dynamic(
  () => import("@/components/AgentDashboard").then((m) => m.AgentDashboard),
  { ssr: false }
);
const AdminConsole = dynamic(
  () => import("@/components/AdminConsole").then((m) => m.AdminConsole),
  { ssr: false }
);
const TradingDiagnostics = dynamic(
  () => import("@/components/TradingDiagnostics").then((m) => m.TradingDiagnostics),
  { ssr: false }
);
const GhostTraderButton = dynamic(
  () => import("@/components/TradingDiagnostics").then((m) => m.GhostTraderButton),
  { ssr: false }
);

// Lazy-loaded modal components — only downloaded when modal is opened
const BuildingModal = dynamic(
  () => import("@/components/BuildingModal").then((m) => m.BuildingModal),
  { ssr: false }
);
const LaunchModal = dynamic(() => import("@/components/LaunchModal").then((m) => m.LaunchModal), {
  ssr: false,
});
const PokeCenterModal = dynamic(
  () => import("@/components/PokeCenterModal").then((m) => m.PokeCenterModal),
  { ssr: false }
);
const FeeClaimModal = dynamic(
  () => import("@/components/FeeClaimModal").then((m) => m.FeeClaimModal),
  { ssr: false }
);
const TradingGymModal = dynamic(
  () => import("@/components/TradingGymModal").then((m) => m.TradingGymModal),
  { ssr: false }
);
const CommunityFundModal = dynamic(
  () => import("@/components/CommunityFundModal").then((m) => m.CommunityFundModal),
  { ssr: false }
);
const CasinoModal = dynamic(() => import("@/components/CasinoModal").then((m) => m.CasinoModal), {
  ssr: false,
});
const ArenaModal = dynamic(() => import("@/components/ArenaModal").then((m) => m.ArenaModal), {
  ssr: false,
});
const DungeonModal = dynamic(
  () => import("@/components/DungeonModal").then((m) => m.DungeonModal),
  { ssr: false }
);
const AgentHutModal = dynamic(
  () => import("@/components/AgentHutModal").then((m) => m.AgentHutModal),
  { ssr: false }
);
const AgentBarModal = dynamic(
  () => import("@/components/AgentBarModal").then((m) => m.AgentBarModal),
  { ssr: false }
);
const IncineratorModal = dynamic(
  () => import("@/components/IncineratorModal").then((m) => m.IncineratorModal),
  { ssr: false }
);
const BountyBoardModal = dynamic(
  () => import("@/components/BountyBoardModal").then((m) => m.BountyBoardModal),
  { ssr: false }
);
const CorpBoardModal = dynamic(
  () => import("@/components/CorpBoardModal").then((m) => m.CorpBoardModal),
  { ssr: false }
);
const MoltbookHQModal = dynamic(
  () => import("@/components/MoltbookHQModal").then((m) => m.MoltbookHQModal),
  { ssr: false }
);
const CasinoAdmin = dynamic(() => import("@/components/CasinoAdmin").then((m) => m.CasinoAdmin), {
  ssr: false,
});
const OracleTowerModal = dynamic(
  () => import("@/components/OracleTowerModal").then((m) => m.OracleTowerModal),
  { ssr: false }
);
const LauncherHub = dynamic(() => import("@/components/LauncherHub").then((m) => m.LauncherHub), {
  ssr: false,
});
const MansionModal = dynamic(
  () => import("@/components/MansionModal").then((m) => m.MansionModal),
  { ssr: false }
);
const ArcadeModal = dynamic(() => import("@/components/ArcadeModal").then((m) => m.ArcadeModal), {
  ssr: false,
});
const OakIntroWizard = dynamic(
  () => import("@/components/OakIntroWizard").then((m) => m.OakIntroWizard),
  { ssr: false }
);

import { useGameStore } from "@/lib/store";
import { useGameEvents } from "@/hooks/useGameEvents";
import type { ZoneType } from "@/lib/types";
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

// Mapping of agent IDs to their click event names
const AGENT_CLICK_EVENTS: Record<string, string> = {
  ghost: "bagsworld-dev-click",
  neo: "bagsworld-neo-click",
  finn: "bagsworld-finn-click",
  toly: "bagsworld-toly-click",
  ash: "bagsworld-ash-click",
  shaw: "bagsworld-shaw-click",
  cj: "bagsworld-cj-click",
  ramo: "bagsworld-ramo-click",
  sincara: "bagsworld-sincara-click",
  stuu: "bagsworld-stuu-click",
  sam: "bagsworld-sam-click",
  alaa: "bagsworld-alaa-click",
  carlo: "bagsworld-carlo-click",
  bnn: "bagsworld-bnn-click",
  "professor-oak": "bagsworld-professoroak-click",
  bagsy: "bagsworld-bagsy-click",
  "bags-bot": "bagsworld-bagsy-click",
  chadghost: "bagsworld-dev-click",
};

interface BuildingClickData {
  mint: string;
  symbol: string;
  name: string;
  tokenUrl?: string;
}

// Handles ?zone= and ?chat= deep links from the /agents page
// Wrapped in Suspense because useSearchParams requires it for static prerendering
function DeepLinkHandler() {
  const searchParams = useSearchParams();
  const { setZone } = useGameStore();

  useEffect(() => {
    const zone = searchParams.get("zone");
    const chat = searchParams.get("chat");
    const timers: ReturnType<typeof setTimeout>[] = [];

    if (zone) {
      const validZones = [
        "main_city",
        "trending",
        "labs",
        "ballers",
        "founders",
        "moltbook",
        "arena",
        "dungeon",
      ];
      if (validZones.includes(zone)) {
        timers.push(
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent("bagsworld-zone-change", { detail: { zone } }));
            setZone(zone as ZoneType);
          }, 1000)
        );
      }
    }

    if (chat) {
      const eventName = AGENT_CLICK_EVENTS[chat];
      if (eventName) {
        timers.push(
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent(eventName));
          }, 1500)
        );
      }
    }

    return () => timers.forEach(clearTimeout);
  }, [searchParams, setZone]);

  return null;
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
  const { worldState, isLoading, refreshAfterLaunch, tokenCount, refetch } = useWorldState();
  const { publicKey } = useWallet();
  const { setZone } = useGameStore();
  const [tradeToken, setTradeToken] = useState<BuildingClickData | null>(null);

  // Consolidated modal state - replaces individual useState calls
  type ModalType =
    | "pokeCenter"
    | "feeClaim"
    | "tradingGym"
    | "communityFund"
    | "casino"
    | "oracle"
    | "launcherHub"
    | "casinoAdmin"
    | "mansion"
    | "arena"
    | "agentHut"
    | "agentBar"
    | "launch"
    | "dungeon"
    | "incinerator"
    | "bountyBoard"
    | "corpBoard"
    | "moltbookHQ"
    | "arcade"
    | "oakIntro"
    | null;
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const openModal = useCallback((modal: ModalType) => setActiveModal(modal), []);
  const closeModal = useCallback(() => setActiveModal(null), []);

  // Expose modal state globally so chat components can suppress opens during modals
  useEffect(() => {
    (window as any).__bagsworld_modal_open = activeModal !== null;
    return () => {
      (window as any).__bagsworld_modal_open = false;
    };
  }, [activeModal]);

  const [mansionData, setMansionData] = useState<{
    name?: string;
    holderRank?: number;
    holderAddress?: string;
    holderBalance?: number;
  } | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"leaderboard" | "market">("market");

  // Listen for Phaser game events — single hook handles all 16 event listeners
  const gameEventHandlers = useMemo(
    () => ({
      "bagsworld-building-click": ((e: CustomEvent<BuildingClickData>) => {
        setTradeToken(e.detail);
      }) as EventListener,
      "bagsworld-pokecenter-click": (() => openModal("pokeCenter")) as EventListener,
      "bagsworld-tradinggym-click": (() => openModal("tradingGym")) as EventListener,
      "bagsworld-treasury-click": (() => openModal("communityFund")) as EventListener,
      "bagsworld-casino-click": (() => openModal("casino")) as EventListener,
      "bagsworld-oracle-click": (() => openModal("oracle")) as EventListener,
      "bagsworld-mansion-click": ((
        e: CustomEvent<{
          name?: string;
          holderRank?: number;
          holderAddress?: string;
          holderBalance?: number;
        }>
      ) => {
        setMansionData(e.detail);
        openModal("mansion");
      }) as EventListener,
      "bagsworld-arcade-click": (() => openModal("arcade")) as EventListener,
      "bagsworld-arena-click": (() => openModal("arena")) as EventListener,
      "bagsworld-agenthut-click": (() => openModal("agentHut")) as EventListener,
      "bagsworld-moltbar-click": (() => openModal("agentBar")) as EventListener,
      "bagsworld-incinerator-click": (() => openModal("incinerator")) as EventListener,
      "bagsworld-bountyboard-click": (() => openModal("bountyBoard")) as EventListener,
      "bagsworld-corp-click": (() => openModal("corpBoard")) as EventListener,
      "bagsworld-moltbookhq-click": (() => openModal("moltbookHQ")) as EventListener,
      "bagsworld-launch-click": (() => openModal("launch")) as EventListener,
      "bagsworld-oak-intro": (() => openModal("oakIntro")) as EventListener,
      "bagsworld-claim-click": (() => openModal("feeClaim")) as EventListener,
      "bagsworld-open-dungeon": (() => openModal("dungeon")) as EventListener,
      "bagsworld-phaser-zone-change": ((e: CustomEvent<{ zone: string }>) => {
        const zone = e.detail?.zone;
        if (zone) setZone(zone as ZoneType);
      }) as EventListener,
    }),
    [openModal, setZone]
  );
  useGameEvents(gameEventHandlers, [gameEventHandlers]);

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
        openModal("casinoAdmin");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openModal]);

  // Auto-show Oak Intro Wizard on first visit (once per tab session)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasDeepLink = params.has("zone") || params.has("chat");
    const alreadySeen = sessionStorage.getItem("bagsworld_intro_seen");
    if (!hasDeepLink && !alreadySeen && !activeModal) {
      const timer = setTimeout(() => openModal("oakIntro"), 1500);
      return () => clearTimeout(timer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    <main className="h-[100dvh] w-full overflow-hidden flex flex-col">
      {/* Deep link handler for ?zone= and ?chat= from /agents page */}
      <Suspense fallback={null}>
        <DeepLinkHandler />
      </Suspense>
      {/* Header - responsive */}
      <header className="h-14 md:h-16 bg-bags-dark hud-border-bottom hud-panel flex items-center justify-between px-1.5 md:px-4 relative z-50 safe-area-top shrink-0">
        {/* Left side - Logo and health */}
        <div className="flex items-center gap-1 sm:gap-2 md:gap-4">
          <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-bags-green/20 border border-bags-green flex items-center justify-center flex-shrink-0 shadow-[0_0_10px_rgba(74,222,128,0.3),inset_0_0_8px_rgba(74,222,128,0.1)]">
              <WorldIcon
                className="text-bags-green drop-shadow-[0_0_4px_rgba(74,222,128,0.5)]"
                size={16}
              />
            </div>
            <h1 className="font-pixel text-xs sm:text-sm md:text-lg text-bags-green hidden sm:block drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]">
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
          <Link
            href="/agents"
            className="font-pixel text-[10px] text-gray-400 hover:text-bags-green transition-colors"
          >
            [AGENTS]
          </Link>
          <Link
            href="/dashboard"
            className="font-pixel text-[10px] text-gray-400 hover:text-bags-green transition-colors"
          >
            [DASHBOARD]
          </Link>
          <div className="font-pixel text-xs">
            <span className="text-gray-400">WEATHER: </span>
            <span className="text-bags-gold">
              {worldState?.weather?.toUpperCase() ?? "LOADING"}
            </span>
          </div>
          <EnterWorldButton />
          <MusicButton />
          <WalletButton />
          <PartnerClaimButton />
          <ClaimButton />
          <LaunchButton />
        </div>

        {/* Mobile buttons - essential actions always visible */}
        <div className="flex lg:hidden items-center gap-0.5 sm:gap-2 shrink-0">
          <Link
            href="/dashboard"
            className="font-pixel text-[8px] sm:text-[9px] px-1.5 py-1.5 sm:px-2 sm:py-2 border border-bags-green/50 text-bags-green hover:bg-bags-green/10 transition-colors hidden sm:block"
          >
            [DASH]
          </Link>
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
          <div className="absolute top-full left-0 right-0 bg-bags-dark border-b-4 border-bags-green p-3 sm:p-4 lg:hidden z-[60] shadow-lg shadow-bags-green/10 max-h-[70vh] overflow-y-auto">
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
                <EnterWorldButton className="w-full" />
                <Link href="/docs" className="btn-retro font-pixel text-[10px] text-center">
                  [DOCS]
                </Link>
                <Link href="/agents" className="btn-retro font-pixel text-[10px] text-center">
                  [AGENTS]
                </Link>
                <Link href="/dashboard" className="btn-retro font-pixel text-[10px] text-center">
                  [DASHBOARD]
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
        {/* Zone Navigation - strip on mobile, overlay on desktop */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="sm:hidden shrink-0">
            <ZoneNav />
          </div>
          {/* Game area */}
          <div className="flex-1 relative" style={{ touchAction: "pan-x pan-y" }}>
            <Suspense fallback={<div className="w-full h-full bg-bags-dark" />}>
              <GameCanvas worldState={worldState} />
            </Suspense>
            {/* Scanlines disabled on mobile via CSS for better touch handling */}
            <div className="scanlines" aria-hidden="true" />

            {/* Desktop zone nav overlay (2-row grid with Dungeon) */}
            <div className="hidden sm:block absolute top-2 left-1/2 -translate-x-1/2 z-20">
              <ZoneNav />
            </div>

            {/* Agent Activity Indicator - shows when agents are talking */}
            <AgentActivityIndicator />

            {/* Chat windows - always rendered but can show/hide based on click events */}
            {/* On mobile, users use MobileCharacterMenu to trigger these */}
            <ErrorBoundary resetLabel="Close Chat">
              <AIChat />
              <TolyChat />
              <AshChat />
              <FinnbagsChat />
              <DevChat />
              <NeoChat />
              <CJChat />
              <ShawChat />
              {/* Academy Characters */}
              <RamoChat />
              <SincaraChat />
              <StuuChat />
              <SamChat />
              <AlaaChat />
              <CarloChat />
              <BNNChat />
              {/* Founder's Corner Characters */}
              <ProfessorOakChat />
              {/* Mascots */}
              <BagsyChat />
              <AgentDashboard />
              <AdminConsole />
              <TradingDiagnostics />
            </ErrorBoundary>

            {/* Mobile character menu - floating button */}
            <MobileCharacterMenu />

            {/* Mini Map - quick access to world features */}
            <MiniMap />

            {/* Quest Tracker - first-time onboarding */}
            <QuestTracker />
          </div>
        </div>

        {/* Sidebar - hidden on mobile, slide-in drawer on tablet, always visible on desktop */}
        <aside
          className={`
          ${mobileSidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"}
          fixed lg:relative right-0 top-14 md:top-16 lg:top-0
          w-[85vw] sm:w-80 h-[calc(100dvh-3.5rem)] md:h-[calc(100dvh-4rem)] lg:h-full
          sidebar-panel hud-border-left flex flex-col
          transition-transform duration-300 ease-in-out z-40
          pb-safe
        `}
        >
          {/* Mobile sidebar close button */}
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="lg:hidden absolute top-2 left-2 w-11 h-11 flex items-center justify-center text-bags-green hover:bg-bags-green/20 rounded"
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

          {/* Your Buildings - Collapsible */}
          <div className="pt-10 lg:pt-0 relative">
            <YourBuildings onRefresh={refreshAfterLaunch} />
            <div className="absolute bottom-0 left-0 right-0 glow-line-h" />
          </div>

          {/* Tabbed Section: Agent Chat / Leaderboard */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {/* Tab Buttons */}
            <div className="flex bg-black/40 hud-divider">
              <button
                onClick={() => setSidebarTab("market")}
                className={`flex-1 py-2 font-pixel text-[9px] transition-all border-b-2 ${
                  sidebarTab === "market"
                    ? "text-bags-gold border-bags-gold bg-bags-green/5 tab-active-glow"
                    : "text-gray-600 border-transparent hover:text-gray-400"
                }`}
              >
                MARKET
              </button>
              <button
                onClick={() => setSidebarTab("leaderboard")}
                className={`flex-1 py-2 font-pixel text-[9px] transition-all border-b-2 ${
                  sidebarTab === "leaderboard"
                    ? "text-bags-gold border-bags-gold bg-bags-green/5 tab-active-glow"
                    : "text-gray-600 border-transparent hover:text-gray-400"
                }`}
              >
                EARNERS
              </button>
            </div>
            {/* Tab Content */}
            <div className="flex-1 overflow-hidden min-h-0">
              {sidebarTab === "market" ? <LiveMarketFeed /> : <Leaderboard />}
            </div>
          </div>

          {/* Agent Chatter Feed - inter-agent conversations */}
          <div className="h-40 shrink-0 relative">
            <div className="absolute top-0 left-0 right-0 glow-line-h" />
            <AgentChatterFeed />
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
      <footer className="min-h-[36px] sm:min-h-[36px] hud-panel hud-border-top flex items-center justify-between px-2 md:px-4 font-pixel text-[10px] sm:text-[9px] md:text-[10px] safe-area-bottom shrink-0 overflow-hidden">
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
          <GhostTraderButton />
          {publicKey?.toString() === CASINO_ADMIN_WALLET && (
            <button
              onClick={() => openModal("casinoAdmin")}
              className="text-bags-gold hover:text-yellow-300 transition-colors"
            >
              [ADMIN]
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <span className="hidden md:inline">
            Crafted with 💚 by{" "}
            <a
              href="https://x.com/DaddyGhost"
              target="_blank"
              rel="noopener noreferrer"
              className="text-bags-green hover:text-bags-gold transition-colors"
            >
              @DaddyGhost
            </a>{" "}
            •{" "}
          </span>
          <span className="md:hidden">
            <a
              href="https://x.com/DaddyGhost"
              target="_blank"
              rel="noopener noreferrer"
              className="text-bags-green hover:text-bags-gold transition-colors"
            >
              @DaddyGhost
            </a>{" "}
            •{" "}
          </span>
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

      {/* Building Modal - triggered by clicking buildings */}
      {tradeToken && (
        <BuildingModal
          tokenMint={tradeToken.mint}
          tokenSymbol={tradeToken.symbol}
          tokenName={tradeToken.name}
          tokenUrl={tradeToken.tokenUrl}
          onClose={() => setTradeToken(null)}
        />
      )}

      {/* Modals - consolidated state via activeModal, wrapped in error boundary */}
      <ErrorBoundary resetLabel="Close" onError={() => setActiveModal(null)}>
        {activeModal === "pokeCenter" && (
          <PokeCenterModal onClose={closeModal} onOpenFeeClaimModal={() => openModal("feeClaim")} />
        )}
        {activeModal === "tradingGym" && <TradingGymModal onClose={closeModal} />}
        {activeModal === "communityFund" && <CommunityFundModal onClose={closeModal} />}
        {activeModal === "casino" && <CasinoModal onClose={closeModal} />}
        {activeModal === "oracle" && <OracleTowerModal onClose={closeModal} />}
        {activeModal === "mansion" && mansionData && (
          <MansionModal
            onClose={() => {
              closeModal();
              setMansionData(null);
            }}
            name={mansionData.name}
            holderRank={mansionData.holderRank}
            holderAddress={mansionData.holderAddress}
            holderBalance={mansionData.holderBalance}
          />
        )}
        {activeModal === "feeClaim" && <FeeClaimModal onClose={closeModal} />}
        {activeModal === "launch" && (
          <LaunchModal
            onClose={closeModal}
            onLaunchSuccess={() => {
              closeModal();
              refreshAfterLaunch();
            }}
          />
        )}
        {activeModal === "launcherHub" && <LauncherHub onClose={closeModal} />}
        {activeModal === "casinoAdmin" && <CasinoAdmin onClose={closeModal} />}
        {activeModal === "arena" && <ArenaModal onClose={closeModal} />}
        {activeModal === "agentHut" && <AgentHutModal onClose={closeModal} />}
        {activeModal === "agentBar" && <AgentBarModal onClose={closeModal} />}
        {activeModal === "dungeon" && <DungeonModal onClose={closeModal} />}

        {/* Sol Incinerator Modal - Burn tokens & close empty accounts */}
        {activeModal === "incinerator" && <IncineratorModal onClose={closeModal} />}

        {/* Bounty Board Modal - A2A task marketplace */}
        {activeModal === "bountyBoard" && <BountyBoardModal onClose={closeModal} />}

        {/* Corp Board Modal - Bags.fm Corp org chart */}
        {activeModal === "corpBoard" && <CorpBoardModal onClose={closeModal} />}

        {/* MoltBook HQ Modal - Agent dashboard */}
        {activeModal === "moltbookHQ" && <MoltbookHQModal onClose={closeModal} />}

        {/* Arcade Modal - Metal Bags game */}
        {activeModal === "arcade" && <ArcadeModal onClose={closeModal} />}

        {/* Oak Intro Wizard - Pokemon-style guided token launch */}
        {activeModal === "oakIntro" && (
          <OakIntroWizard
            onClose={closeModal}
            onLaunchSuccess={() => {
              closeModal();
              refreshAfterLaunch();
            }}
          />
        )}
      </ErrorBoundary>

      {/* Scout Alerts - shows new token launch notifications */}
      <ScoutAlerts />
    </main>
  );
}
