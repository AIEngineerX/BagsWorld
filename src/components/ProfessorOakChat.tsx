"use client";

import { useState, useEffect, useRef } from "react";
import { ActionButtons } from "@/components/ActionButtons";
import type { AIAction } from "@/app/api/agent-chat/route";

// =============================================================================
// TYPES
// =============================================================================

interface OakMessage {
  id: string;
  type: "oak" | "user" | "info" | "checklist" | "generated";
  message: string;
  timestamp: number;
  actions?: AIAction[];
  generatedData?: GeneratedContent;
}

interface Position {
  x: number;
  y: number;
}

interface NameSuggestion {
  name: string;
  ticker: string;
  description: string;
}

interface GeneratedContent {
  names?: NameSuggestion[];
  logoUrl?: string;
  bannerUrl?: string;
}

type WizardStep = "idle" | "concept" | "style" | "generating-names" | "select-name" | "generating-images" | "preview" | "ready";

type ArtStyle = "pixel-art" | "cartoon" | "minimalist" | "abstract" | "cute";

// =============================================================================
// CONSTANTS
// =============================================================================

const LAUNCH_GUIDE_TOPICS = [
  {
    title: "Start Launch",
    icon: "S",
    content:
      "Ready to launch your token on Bags.fm? Here's what you'll need:\n\n1. Token Name (3-32 chars)\n2. Symbol (up to 10 chars)\n3. Description (tell your story!)\n4. Logo image (512x512, square)\n5. Fee sharing setup (who gets trading fees)\n\nClick 'LAUNCH TOKEN NOW' below to begin!",
  },
  {
    title: "Fee Sharing",
    icon: "F",
    content:
      "FEE SHARING - Who gets the trading fees!\n\nYou assign WHO receives fees from trades:\n- Add Twitter, GitHub, or Kick usernames\n- Percentages MUST total exactly 100%\n- Each person needs wallet linked at bags.fm/settings\n\nExample: You 100%, or You 80% + Friend 20%",
  },
  {
    title: "Initial Buy",
    icon: "B",
    content:
      "INITIAL BUY - Your first purchase:\n\n- Optional but helps secure your position\n- Amount is entirely your choice\n- You can always buy more after launch!\n\nTIP: Consider your budget and project goals when deciding!",
  },
  {
    title: "Wallet Link",
    icon: "W",
    content:
      "IMPORTANT: WALLET LINKING\n\nFee claimers MUST link their wallet first!\n\n1. Go to bags.fm/settings\n2. Connect your Solana wallet\n3. Link your Twitter/GitHub/Kick\n\nWithout this, you cannot receive fees!",
  },
  {
    title: "Launch Checklist",
    icon: "C",
    content:
      "PRE-LAUNCH CHECKLIST:\n[ ] Name and symbol decided\n[ ] Description written\n[ ] Square logo ready (512x512)\n[ ] Wallet linked at bags.fm/settings\n[ ] Fee sharing planned (must = 100%)\n[ ] SOL for initial buy (optional)",
  },
  {
    title: "NFA",
    icon: "!",
    content:
      "NOT FINANCIAL ADVICE\n\nBagsWorld and Professor Oak provide educational guidance only.\n\n- Do your own research (DYOR)\n- Never invest more than you can lose\n- Token launches carry significant risk\n- Past performance ≠ future results\n\nThis is not financial, legal, or investment advice.",
  },
];

const ART_STYLES: { id: ArtStyle; name: string; emoji: string; description: string }[] = [
  { id: "pixel-art", name: "Pixel Art", emoji: "🎮", description: "Retro 16-bit game aesthetic" },
  { id: "cartoon", name: "Cartoon", emoji: "🎨", description: "Bold, playful mascot style" },
  { id: "cute", name: "Kawaii", emoji: "🌸", description: "Adorable chibi style" },
  { id: "minimalist", name: "Minimal", emoji: "◻️", description: "Clean, modern shapes" },
  { id: "abstract", name: "Abstract", emoji: "🔮", description: "Artistic geometric" },
];

// =============================================================================
// COMPONENT
// =============================================================================

export function ProfessorOakChat() {
  // Chat state
  const [messages, setMessages] = useState<OakMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Dragging state
  const [position, setPosition] = useState<Position>({ x: -1, y: 16 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });

  // AI Generation Wizard state
  const [wizardStep, setWizardStep] = useState<WizardStep>("idle");
  const [concept, setConcept] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<ArtStyle>("pixel-art");
  const [generatedNames, setGeneratedNames] = useState<NameSuggestion[]>([]);
  const [selectedName, setSelectedName] = useState<NameSuggestion | null>(null);
  const [generatedLogo, setGeneratedLogo] = useState<string | null>(null);
  const [generatedBanner, setGeneratedBanner] = useState<string | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ==========================================================================
  // EVENT LISTENERS
  // ==========================================================================

  // Listen for Professor Oak click events from the game
  useEffect(() => {
    const handleOakClick = () => {
      setIsOpen(true);
      if (messages.length === 0) {
        addMessage({
          id: `${Date.now()}-oak`,
          type: "oak",
          message:
            "Ah, a new trainer ready to launch their first token! Welcome to Founder's Corner!\n\nI'm Professor Oak, and I can help you create everything you need - name, logo, banner, and more!\n\nWould you like me to generate your token assets with AI?",
          timestamp: Date.now(),
        });
      }
    };

    window.addEventListener("bagsworld-professoroak-click", handleOakClick);
    return () => {
      window.removeEventListener("bagsworld-professoroak-click", handleOakClick);
    };
  }, [messages.length]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle dragging
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, input, textarea")) return;
    const rect = chatRef.current?.getBoundingClientRect();
    if (rect) {
      setIsDragging(true);
      setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    }
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging) return;

      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      const chatWidth = Math.min(360, window.innerWidth - 32);
      const maxX = window.innerWidth - chatWidth;
      const maxY = window.innerHeight - 300;

      setPosition({
        x: Math.max(8, Math.min(newX, maxX - 8)),
        y: Math.max(60, Math.min(newY, maxY)),
      });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
      return () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
      };
    }
  }, [isDragging, dragOffset]);

  // ==========================================================================
  // MESSAGE HANDLING
  // ==========================================================================

  const addMessage = (message: OakMessage) => {
    setMessages((prev) => [...prev.slice(-30), message]);
  };

  const handleTopicClick = (topic: (typeof LAUNCH_GUIDE_TOPICS)[0]) => {
    addMessage({
      id: `${Date.now()}-info`,
      type: "info",
      message: topic.content,
      timestamp: Date.now(),
    });
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;
    const userMsg = inputValue.trim();
    setInputValue("");
    setIsLoading(true);

    addMessage({
      id: `${Date.now()}-user`,
      type: "user",
      message: userMsg,
      timestamp: Date.now(),
    });

    // If in concept step, use the input as the concept
    if (wizardStep === "concept") {
      setConcept(userMsg);
      setWizardStep("style");
      addMessage({
        id: `${Date.now()}-oak`,
        type: "oak",
        message: `"${userMsg}" - wonderful concept! Now, what art style would you like for your logo and banner?`,
        timestamp: Date.now(),
      });
      setIsLoading(false);
      return;
    }

    // Regular chat with Professor Oak
    const response = await fetch("/api/eliza-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        character: "professor-oak",
        message: userMsg,
      }),
    });

    const data = await response.json();
    const messageText =
      data.response ||
      data.message ||
      "Wonderful question! Ask me about launching tokens, creator fees, or click 'AI GENERATE' to create your token assets!";

    addMessage({
      id: `${Date.now()}-oak`,
      type: "oak",
      message: messageText,
      timestamp: Date.now(),
      actions: data.actions || [],
    });

    setIsLoading(false);
  };

  const handleAction = (action: AIAction) => {
    switch (action.type) {
      case "trade":
        if (action.data.mint) {
          window.dispatchEvent(
            new CustomEvent("bagsworld-building-click", {
              detail: {
                mint: action.data.mint,
                symbol: action.data.symbol || "TOKEN",
                name: action.data.name || "Token",
              },
            })
          );
        }
        break;
      case "launch":
        window.dispatchEvent(new CustomEvent("bagsworld-launch-click"));
        break;
      case "link":
        if (action.data.url) {
          window.open(action.data.url, "_blank", "noopener,noreferrer");
        }
        break;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ==========================================================================
  // AI GENERATION WIZARD
  // ==========================================================================

  const startWizard = () => {
    setWizardStep("concept");
    setConcept("");
    setSelectedStyle("pixel-art");
    setGeneratedNames([]);
    setSelectedName(null);
    setGeneratedLogo(null);
    setGeneratedBanner(null);

    addMessage({
      id: `${Date.now()}-oak`,
      type: "oak",
      message:
        "Ah, the AI Token Generator! Splendid choice!\n\nFirst, tell me about your token concept. What's the theme, idea, or story behind it?\n\nExamples: 'a space cat exploring galaxies', 'a pizza-loving dog', 'a wizard frog'",
      timestamp: Date.now(),
    });
  };

  const selectStyle = async (style: ArtStyle) => {
    setSelectedStyle(style);
    setWizardStep("generating-names");

    addMessage({
      id: `${Date.now()}-oak`,
      type: "oak",
      message: `${ART_STYLES.find((s) => s.id === style)?.emoji} ${style} style selected! Generating name suggestions...\n\nHm? Oh right, I need to consult my research database!`,
      timestamp: Date.now(),
    });

    // Call the generation API
    const response = await fetch("/api/oak-generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "suggest-names",
        concept: concept,
        style: style,
      }),
    });

    const data = await response.json();

    if (data.success && data.names) {
      setGeneratedNames(data.names);
      setWizardStep("select-name");

      addMessage({
        id: `${Date.now()}-generated`,
        type: "generated",
        message: "Here are my suggestions! Click one to select it:",
        timestamp: Date.now(),
        generatedData: { names: data.names },
      });
    } else {
      addMessage({
        id: `${Date.now()}-oak`,
        type: "oak",
        message: "Hmm, my research database seems to be offline. Let me try a different approach...",
        timestamp: Date.now(),
      });
      setWizardStep("concept");
    }
  };

  const selectName = async (name: NameSuggestion) => {
    setSelectedName(name);
    setWizardStep("generating-images");

    addMessage({
      id: `${Date.now()}-oak`,
      type: "oak",
      message: `Excellent choice! "${name.name}" ($${name.ticker}) - very memorable!\n\nNow generating your logo and banner... This may take a moment!`,
      timestamp: Date.now(),
    });

    // Generate logo
    const logoResponse = await fetch("/api/oak-generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "generate-logo",
        concept: `${name.name} - ${concept}`,
        style: selectedStyle,
      }),
    });

    const logoData = await logoResponse.json();
    if (logoData.success && logoData.imageUrl) {
      setGeneratedLogo(logoData.imageUrl);
    }

    // Generate banner
    const bannerResponse = await fetch("/api/oak-generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "generate-banner",
        concept: `${name.name} - ${concept}`,
        style: selectedStyle,
      }),
    });

    const bannerData = await bannerResponse.json();
    if (bannerData.success && bannerData.imageUrl) {
      setGeneratedBanner(bannerData.imageUrl);
    }

    setWizardStep("preview");

    addMessage({
      id: `${Date.now()}-generated`,
      type: "generated",
      message: "Your token assets are ready! Review them below:",
      timestamp: Date.now(),
      generatedData: {
        names: [name],
        logoUrl: logoData.imageUrl,
        bannerUrl: bannerData.imageUrl,
      },
    });
  };

  const regenerateLogo = async () => {
    if (!selectedName) return;

    addMessage({
      id: `${Date.now()}-oak`,
      type: "oak",
      message: "Generating a new logo variation...",
      timestamp: Date.now(),
    });

    const response = await fetch("/api/oak-generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "generate-logo",
        concept: `${selectedName.name} - ${concept} - variation ${Date.now()}`,
        style: selectedStyle,
      }),
    });

    const data = await response.json();
    if (data.success && data.imageUrl) {
      setGeneratedLogo(data.imageUrl);
      addMessage({
        id: `${Date.now()}-oak`,
        type: "oak",
        message: "New logo ready! How's this one?",
        timestamp: Date.now(),
      });
    }
  };

  const regenerateBanner = async () => {
    if (!selectedName) return;

    addMessage({
      id: `${Date.now()}-oak`,
      type: "oak",
      message: "Generating a new banner variation...",
      timestamp: Date.now(),
    });

    const response = await fetch("/api/oak-generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "generate-banner",
        concept: `${selectedName.name} - ${concept} - variation ${Date.now()}`,
        style: selectedStyle,
      }),
    });

    const data = await response.json();
    if (data.success && data.imageUrl) {
      setGeneratedBanner(data.imageUrl);
      addMessage({
        id: `${Date.now()}-oak`,
        type: "oak",
        message: "New banner ready! Take a look!",
        timestamp: Date.now(),
      });
    }
  };

  const launchWithGenerated = () => {
    if (!selectedName || !generatedLogo) return;

    // Dispatch event to pre-fill LaunchModal
    window.dispatchEvent(
      new CustomEvent("bagsworld-launch-prefill", {
        detail: {
          name: selectedName.name,
          symbol: selectedName.ticker,
          description: selectedName.description,
          logo: generatedLogo,
          banner: generatedBanner,
        },
      })
    );

    // Also open the launch modal
    window.dispatchEvent(new CustomEvent("bagsworld-launch-click"));

    addMessage({
      id: `${Date.now()}-oak`,
      type: "oak",
      message:
        "Wonderful! I've filled in the Launch Modal with your generated assets. Complete the fee sharing setup and you're ready to launch!\n\nGood luck, trainer!",
      timestamp: Date.now(),
    });

    // Reset wizard
    setWizardStep("idle");
  };

  const resetWizard = () => {
    setWizardStep("idle");
    setConcept("");
    setGeneratedNames([]);
    setSelectedName(null);
    setGeneratedLogo(null);
    setGeneratedBanner(null);

    addMessage({
      id: `${Date.now()}-oak`,
      type: "oak",
      message: "No problem! Click 'AI GENERATE' anytime to start fresh, or ask me anything about token launches!",
      timestamp: Date.now(),
    });
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  const chatStyle: React.CSSProperties =
    position.x >= 0
      ? { left: position.x, top: position.y, right: "auto", bottom: "auto" }
      : { right: 16, bottom: 80 };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={chatRef}
      style={chatStyle}
      className={`fixed z-50 w-[calc(100vw-2rem)] sm:w-[360px] max-w-[360px] bg-bags-dark border-4 border-amber-600 shadow-lg ${isDragging ? "cursor-grabbing" : ""}`}
    >
      {/* Header - Draggable */}
      <div
        onPointerDown={handlePointerDown}
        className="flex items-center justify-between p-2 border-b-4 border-amber-600 cursor-grab active:cursor-grabbing select-none touch-none bg-gradient-to-r from-amber-600/20 to-orange-500/20"
      >
        <div className="flex items-center gap-2">
          <span className="font-pixel text-sm">🎓</span>
          <div>
            <p className="font-pixel text-[10px] text-amber-400">PROFESSOR OAK // AI GENERATOR</p>
            <p className="font-pixel text-[8px] text-amber-600">Founder&apos;s Corner</p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="font-pixel text-xs text-gray-400 hover:text-white px-2"
        >
          [X]
        </button>
      </div>

      {/* Wizard Progress Bar (when active) */}
      {wizardStep !== "idle" && (
        <div className="p-2 border-b border-amber-600/30 bg-gradient-to-r from-amber-900/20 to-orange-900/20">
          <div className="flex items-center justify-between mb-1">
            <p className="font-pixel text-[8px] text-amber-400">AI GENERATION WIZARD</p>
            <button
              onClick={resetWizard}
              className="font-pixel text-[7px] text-red-400 hover:text-red-300"
            >
              [CANCEL]
            </button>
          </div>
          <div className="flex gap-1">
            {["concept", "style", "names", "images", "preview"].map((step, i) => {
              const stepMap: Record<string, number> = {
                concept: 0,
                style: 1,
                "generating-names": 1,
                "select-name": 2,
                "generating-images": 3,
                preview: 4,
                ready: 4,
              };
              const currentStep = stepMap[wizardStep] ?? -1;
              const isActive = i === currentStep;
              const isComplete = i < currentStep;

              return (
                <div
                  key={step}
                  className={`flex-1 h-1 rounded ${
                    isComplete
                      ? "bg-bags-green"
                      : isActive
                        ? "bg-amber-500 animate-pulse"
                        : "bg-gray-700"
                  }`}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-1">
            <span className="font-pixel text-[6px] text-gray-500">Concept</span>
            <span className="font-pixel text-[6px] text-gray-500">Style</span>
            <span className="font-pixel text-[6px] text-gray-500">Name</span>
            <span className="font-pixel text-[6px] text-gray-500">Images</span>
            <span className="font-pixel text-[6px] text-gray-500">Done</span>
          </div>
        </div>
      )}

      {/* Topic Buttons (only when idle) */}
      {wizardStep === "idle" && (
        <div className="p-2 border-b border-amber-600/30 bg-bags-darker">
          <div className="flex items-center justify-between mb-2">
            <p className="font-pixel text-[8px] text-gray-400">Quick Guide:</p>
            <button
              onClick={startWizard}
              className="px-2 py-1 bg-bags-green/20 border border-bags-green font-pixel text-[8px] text-bags-green hover:bg-bags-green/30 animate-pulse"
            >
              🤖 AI GENERATE
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {LAUNCH_GUIDE_TOPICS.map((topic, i) => (
              <button
                key={i}
                onClick={() => handleTopicClick(topic)}
                className="px-2 py-1 bg-amber-600/10 border border-amber-600/30 font-pixel text-[7px] text-amber-300 hover:bg-amber-600/20 hover:text-amber-200 transition-colors"
              >
                [{topic.icon}] {topic.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Style Selection (when in style step) */}
      {wizardStep === "style" && (
        <div className="p-2 border-b border-amber-600/30 bg-bags-darker">
          <p className="font-pixel text-[8px] text-amber-400 mb-2">Select Art Style:</p>
          <div className="grid grid-cols-2 gap-1">
            {ART_STYLES.map((style) => (
              <button
                key={style.id}
                onClick={() => selectStyle(style.id)}
                className="p-2 bg-amber-600/10 border border-amber-600/30 hover:bg-amber-600/20 hover:border-amber-500 transition-all text-left"
              >
                <div className="flex items-center gap-1">
                  <span className="text-base">{style.emoji}</span>
                  <span className="font-pixel text-[9px] text-amber-300">{style.name}</span>
                </div>
                <p className="font-pixel text-[7px] text-gray-400 mt-1">{style.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Name Selection Cards */}
      {wizardStep === "select-name" && generatedNames.length > 0 && (
        <div className="p-2 border-b border-amber-600/30 bg-bags-darker max-h-48 overflow-y-auto">
          <p className="font-pixel text-[8px] text-amber-400 mb-2">Click to select a name:</p>
          <div className="space-y-1">
            {generatedNames.map((name, i) => (
              <button
                key={i}
                onClick={() => selectName(name)}
                className="w-full p-2 bg-amber-600/10 border border-amber-600/30 hover:bg-amber-600/20 hover:border-bags-green transition-all text-left"
              >
                <div className="flex items-center justify-between">
                  <span className="font-pixel text-[10px] text-white">{name.name}</span>
                  <span className="font-pixel text-[9px] text-bags-green">${name.ticker}</span>
                </div>
                <p className="font-pixel text-[7px] text-gray-400 mt-1 line-clamp-2">
                  {name.description}
                </p>
              </button>
            ))}
          </div>
          <button
            onClick={() => selectStyle(selectedStyle)}
            className="w-full mt-2 py-1 bg-gray-700/50 border border-gray-600 font-pixel text-[7px] text-gray-400 hover:bg-gray-700 hover:text-white"
          >
            🔄 Generate More Names
          </button>
        </div>
      )}

      {/* Image Preview */}
      {(wizardStep === "preview" || wizardStep === "generating-images") && selectedName && (
        <div className="p-2 border-b border-amber-600/30 bg-bags-darker">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="font-pixel text-[10px] text-white">{selectedName.name}</p>
              <p className="font-pixel text-[8px] text-bags-green">${selectedName.ticker}</p>
            </div>
            {wizardStep === "preview" && (
              <button
                onClick={launchWithGenerated}
                className="px-3 py-1.5 bg-bags-green border-2 border-bags-green/50 font-pixel text-[9px] text-black hover:bg-bags-green/80 animate-pulse"
              >
                🚀 USE & LAUNCH
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Logo Preview */}
            <div className="space-y-1">
              <p className="font-pixel text-[7px] text-gray-400">Logo (512x512)</p>
              <div className="aspect-square bg-gray-800 border border-amber-600/30 flex items-center justify-center overflow-hidden">
                {generatedLogo ? (
                  <img
                    src={generatedLogo}
                    alt="Generated logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="font-pixel text-[8px] text-gray-500 animate-pulse">
                    Generating...
                  </div>
                )}
              </div>
              {wizardStep === "preview" && (
                <button
                  onClick={regenerateLogo}
                  className="w-full py-1 bg-gray-700/50 border border-gray-600 font-pixel text-[7px] text-gray-400 hover:bg-gray-700 hover:text-white"
                >
                  🔄 New Logo
                </button>
              )}
            </div>

            {/* Banner Preview */}
            <div className="space-y-1">
              <p className="font-pixel text-[7px] text-gray-400">Banner (600x200)</p>
              <div className="aspect-[3/1] bg-gray-800 border border-amber-600/30 flex items-center justify-center overflow-hidden">
                {generatedBanner ? (
                  <img
                    src={generatedBanner}
                    alt="Generated banner"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="font-pixel text-[8px] text-gray-500 animate-pulse">
                    Generating...
                  </div>
                )}
              </div>
              {wizardStep === "preview" && (
                <button
                  onClick={regenerateBanner}
                  className="w-full py-1 bg-gray-700/50 border border-gray-600 font-pixel text-[7px] text-gray-400 hover:bg-gray-700 hover:text-white"
                >
                  🔄 New Banner
                </button>
              )}
            </div>
          </div>

          <p className="font-pixel text-[7px] text-gray-500 mt-2 text-center">
            {wizardStep === "generating-images"
              ? "Creating your unique token images..."
              : "Click 'USE & LAUNCH' to continue to token creation"}
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="h-36 overflow-y-auto p-2 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center py-4">
            <p className="font-pixel text-[10px] text-amber-400 mb-1">🎓 Welcome, Trainer!</p>
            <p className="font-pixel text-[8px] text-gray-400">
              I&apos;m Professor Oak! I can generate your token name, logo, and banner using AI.
            </p>
            <p className="font-pixel text-[7px] text-gray-500 mt-2">
              Click &apos;AI GENERATE&apos; or ask me anything!
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-2 border-l-2 ${
                msg.type === "oak"
                  ? "bg-amber-600/10 border-amber-500"
                  : msg.type === "user"
                    ? "bg-bags-green/10 border-bags-green ml-4"
                    : msg.type === "info"
                      ? "bg-blue-500/10 border-blue-500"
                      : msg.type === "generated"
                        ? "bg-purple-500/10 border-purple-500"
                        : "bg-green-500/10 border-green-500"
              }`}
            >
              {msg.type === "oak" && (
                <p className="font-pixel text-[6px] text-amber-400 mb-1">Professor Oak:</p>
              )}
              {msg.type === "user" && (
                <p className="font-pixel text-[6px] text-bags-green mb-1">You:</p>
              )}
              {msg.type === "info" && (
                <p className="font-pixel text-[6px] text-blue-400 mb-1">📋 Info:</p>
              )}
              {msg.type === "generated" && (
                <p className="font-pixel text-[6px] text-purple-400 mb-1">🤖 Generated:</p>
              )}
              <p className="font-pixel text-[8px] text-white whitespace-pre-wrap">{msg.message}</p>
              {msg.type === "oak" && msg.actions && msg.actions.length > 0 && (
                <ActionButtons actions={msg.actions} onAction={handleAction} />
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="p-2 border-l-2 bg-amber-600/10 border-amber-500">
            <p className="font-pixel text-[8px] text-amber-300 animate-pulse">thinking...</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="p-2 border-t border-amber-600/30">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              wizardStep === "concept"
                ? "Describe your token concept..."
                : "Ask about token launches..."
            }
            disabled={isLoading || wizardStep === "style" || wizardStep === "select-name"}
            className="flex-1 bg-bags-darker border border-amber-600/30 px-2 py-1 font-pixel text-[8px] text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 disabled:opacity-50"
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputValue.trim()}
            className="px-2 py-1 bg-amber-600 text-white font-pixel text-[8px] hover:bg-amber-500 disabled:opacity-50 transition-colors"
          >
            Send
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-amber-600/30 bg-bags-darker">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-amber-600/10 p-1 rounded">
            <p className="font-pixel text-[7px] text-gray-400">Logo</p>
            <p className="font-pixel text-[9px] text-amber-400">512x512</p>
          </div>
          <div className="bg-amber-600/10 p-1 rounded">
            <p className="font-pixel text-[7px] text-gray-400">Banner</p>
            <p className="font-pixel text-[9px] text-amber-400">600x200</p>
          </div>
          <div className="bg-amber-600/10 p-1 rounded">
            <p className="font-pixel text-[7px] text-gray-400">Fee</p>
            <p className="font-pixel text-[9px] text-amber-400">=100%</p>
          </div>
        </div>
        {wizardStep === "idle" && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("bagsworld-launch-click"))}
            className="w-full mt-2 py-1.5 bg-bags-green/20 border border-bags-green/50 font-pixel text-[9px] text-bags-green hover:bg-bags-green/30 transition-colors"
          >
            [LAUNCH TOKEN MANUALLY]
          </button>
        )}
      </div>
    </div>
  );
}
