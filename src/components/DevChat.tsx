"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ECOSYSTEM_CONFIG } from "@/lib/config";
import { useGameStore } from "@/lib/store";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

interface DevMessage {
  id: string;
  type: "dev" | "user" | "info" | "error" | "portfolio";
  message: string;
  timestamp: number;
  data?: any;
}

interface Position {
  x: number;
  y: number;
}

interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  lifetimeFees: number;
  totalClaimed: number;
  totalUnclaimed: number;
  creators: Array<{
    username: string;
    provider: string;
    bps: number;
  }>;
}

interface PortfolioPosition {
  mint: string;
  symbol: string;
  balance: number;
  claimable: number;
}

const DEV_QUOTES = ECOSYSTEM_CONFIG.dev.quotes;

const AGENT_TOPICS = [
  {
    title: "Token Lookup",
    icon: "🔍",
    description: "Get Bags.fm token stats",
  },
  {
    title: "My Portfolio",
    icon: "💼",
    description: "Check your positions",
  },
  {
    title: "Trenches",
    icon: "⛏️",
    description: "Market talk",
  },
  {
    title: "Alpha",
    icon: "💡",
    description: "Bags ecosystem tips",
  },
];

export function DevChat() {
  const [messages, setMessages] = useState<DevMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState<Position>({ x: -1, y: -1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { worldState } = useGameStore();
  const { publicKey, connected } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();

  // Listen for Dev click events
  useEffect(() => {
    const handleDevClick = () => {
      setIsOpen(true);
      if (messages.length === 0) {
        const randomQuote = DEV_QUOTES[Math.floor(Math.random() * DEV_QUOTES.length)];
        addMessage({
          id: `${Date.now()}-dev`,
          type: "dev",
          message: randomQuote,
          timestamp: Date.now(),
        });
      }
    };

    window.addEventListener("bagsworld-dev-click", handleDevClick);
    return () => {
      window.removeEventListener("bagsworld-dev-click", handleDevClick);
    };
  }, [messages.length]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle dragging
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, input")) return;
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

      const chatWidth = Math.min(320, window.innerWidth - 32);
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

  const addMessage = (message: DevMessage) => {
    setMessages((prev) => [...prev.slice(-30), message]);
  };

  // Check if string looks like a Solana address
  const isValidCA = (str: string): boolean => {
    const cleaned = str.trim();
    return cleaned.length >= 32 && cleaned.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(cleaned);
  };

  // Format SOL amount
  const formatSol = (lamports: number): string => {
    const sol = lamports / 1e9;
    if (sol >= 1000) return `${(sol / 1000).toFixed(2)}K`;
    if (sol >= 1) return sol.toFixed(2);
    return sol.toFixed(4);
  };

  // Lookup token info from Bags.fm
  const lookupToken = useCallback(async (mint: string) => {
    setIsLoading(true);
    addMessage({
      id: `${Date.now()}-dev`,
      type: "dev",
      message: "checking bags.fm for that token...",
      timestamp: Date.now(),
    });

    try {
      // Fetch token fees and creators from our API
      const response = await fetch("/api/bags-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `lookup ${mint}`,
          worldState: null,
        }),
      });

      const data = await response.json();

      if (data.message) {
        addMessage({
          id: `${Date.now()}-info`,
          type: "info",
          message: data.message,
          timestamp: Date.now(),
        });
      } else {
        addMessage({
          id: `${Date.now()}-error`,
          type: "error",
          message: "couldnt find that token on bags.fm. might not be launched through bags.",
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      addMessage({
        id: `${Date.now()}-error`,
        type: "error",
        message: "api error. try again.",
        timestamp: Date.now(),
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get portfolio for connected wallet
  const getPortfolio = useCallback(async () => {
    if (!connected || !publicKey) {
      setWalletModalVisible(true);
      addMessage({
        id: `${Date.now()}-dev`,
        type: "dev",
        message: "connect your wallet first to see your portfolio",
        timestamp: Date.now(),
      });
      return;
    }

    setIsLoading(true);
    addMessage({
      id: `${Date.now()}-dev`,
      type: "dev",
      message: `checking positions for ${publicKey.toString().slice(0, 6)}...`,
      timestamp: Date.now(),
    });

    try {
      // Fetch claimable positions
      const response = await fetch("/api/claim-fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "get-positions",
          wallet: publicKey.toBase58(),
        }),
      });

      const data = await response.json();

      if (data.positions && data.positions.length > 0) {
        const totalClaimable = data.totalClaimable || 0;

        let portfolioMsg = `PORTFOLIO SUMMARY\n\n`;
        portfolioMsg += `Claimable Fees: ${formatSol(totalClaimable * 1e9)} SOL\n`;
        portfolioMsg += `Positions: ${data.positions.length}\n\n`;

        // List top positions
        const topPositions = data.positions.slice(0, 5);
        topPositions.forEach((pos: any, i: number) => {
          portfolioMsg += `${i + 1}. ${pos.baseMint.slice(0, 8)}... - ${pos.claimableDisplayAmount.toFixed(4)} SOL\n`;
        });

        if (data.positions.length > 5) {
          portfolioMsg += `\n+${data.positions.length - 5} more positions`;
        }

        addMessage({
          id: `${Date.now()}-portfolio`,
          type: "portfolio",
          message: portfolioMsg,
          timestamp: Date.now(),
          data: data.positions,
        });

        addMessage({
          id: `${Date.now()}-dev`,
          type: "dev",
          message:
            totalClaimable > 0.01
              ? "you got fees to claim. hit the claim button in the header."
              : "fees are stacking. keep building.",
          timestamp: Date.now(),
        });
      } else {
        addMessage({
          id: `${Date.now()}-dev`,
          type: "dev",
          message:
            "no claimable positions found. launch a token or buy into fee-sharing tokens to start earning.",
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      addMessage({
        id: `${Date.now()}-error`,
        type: "error",
        message: "couldnt fetch portfolio. try again.",
        timestamp: Date.now(),
      });
    } finally {
      setIsLoading(false);
    }
  }, [connected, publicKey, setWalletModalVisible]);

  const handleTopicClick = async (topic: (typeof AGENT_TOPICS)[0]) => {
    if (topic.title === "Token Lookup") {
      addMessage({
        id: `${Date.now()}-dev`,
        type: "dev",
        message:
          "paste a contract address and ill pull up the bags.fm stats - fees earned, creators, claim history.",
        timestamp: Date.now(),
      });
    } else if (topic.title === "My Portfolio") {
      await getPortfolio();
    } else if (topic.title === "Trenches") {
      const trenchTalk = [
        "been building in these trenches since day one. bags.fm is where builders eat. launch a token, earn fees forever.",
        "the trenches separate builders from flippers. if youre here to build, youll make it.",
        "real talk - the fee share model is changing the game. creators actually get paid now.",
        "seen a lot of projects come and go. the ones that last? they build for the community.",
      ];
      addMessage({
        id: `${Date.now()}-dev`,
        type: "dev",
        message: trenchTalk[Math.floor(Math.random() * trenchTalk.length)],
        timestamp: Date.now(),
      });
    } else if (topic.title === "Alpha") {
      const alphaTips = [
        "alpha: launch through bags.fm and you earn fees on every trade. forever. thats the model.",
        "tip: check token creators before buying. bags.fm shows you exactly who earns the fees.",
        "the move right now: build a community, launch a token, share fees with your holders.",
        "alpha: the best tokens on bags have active creators who keep building. look for commitment.",
        "pro tip: claim your fees regularly. compound that into more positions.",
      ];
      addMessage({
        id: `${Date.now()}-dev`,
        type: "dev",
        message: alphaTips[Math.floor(Math.random() * alphaTips.length)],
        timestamp: Date.now(),
      });
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;
    const userMsg = inputValue.trim();
    setInputValue("");

    addMessage({
      id: `${Date.now()}-user`,
      type: "user",
      message: userMsg,
      timestamp: Date.now(),
    });

    // Check if user pasted a CA
    if (isValidCA(userMsg)) {
      await lookupToken(userMsg);
      return;
    }

    // Check for commands
    const lowerMsg = userMsg.toLowerCase();

    if (lowerMsg === "portfolio" || lowerMsg === "positions" || lowerMsg === "my bags") {
      await getPortfolio();
      return;
    }

    if (lowerMsg.startsWith("lookup ") || lowerMsg.startsWith("check ")) {
      const ca = userMsg.split(" ")[1];
      if (ca && isValidCA(ca)) {
        await lookupToken(ca);
        return;
      }
    }

    // Regular chat - use eliza-agent API (routes through ElizaOS on Railway)
    setIsLoading(true);
    try {
      const response = await fetch("/api/eliza-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character: "ghost", // dev maps to ghost agent
          message: userMsg,
        }),
      });

      const data = await response.json();
      addMessage({
        id: `${Date.now()}-dev`,
        type: "dev",
        message: data.response || data.message || "connection dropped. try again.",
        timestamp: Date.now(),
      });
    } catch (error) {
      addMessage({
        id: `${Date.now()}-dev`,
        type: "dev",
        message: "connection issues. try again.",
        timestamp: Date.now(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const chatStyle: React.CSSProperties =
    position.x >= 0 && position.y >= 0
      ? { left: position.x, top: position.y, right: "auto", bottom: "auto" }
      : { right: 20, bottom: 80 };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={chatRef}
      style={chatStyle}
      className={`fixed z-50 w-[calc(100vw-2rem)] sm:w-80 max-w-80 bg-bags-dark border-4 border-purple-500 shadow-lg ${isDragging ? "cursor-grabbing" : ""}`}
    >
      {/* Header */}
      <div
        onPointerDown={handlePointerDown}
        className="flex items-center justify-between p-2 border-b-4 border-purple-500 cursor-grab active:cursor-grabbing select-none touch-none bg-gradient-to-r from-purple-600/20 to-cyan-500/20"
      >
        <div className="flex items-center gap-2">
          <span className="font-pixel text-sm">👻</span>
          <div>
            <p className="font-pixel text-[10px] text-purple-400">GHOST // THE DEV</p>
            <p className="font-pixel text-[8px] text-purple-600">powered by ElizaOS</p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="font-pixel text-xs text-gray-400 hover:text-white px-2"
        >
          [X]
        </button>
      </div>

      {/* Topic Buttons */}
      <div className="p-2 border-b border-purple-500/30 bg-bags-darker">
        <div className="flex flex-wrap gap-1">
          {AGENT_TOPICS.map((topic, i) => (
            <button
              key={i}
              onClick={() => handleTopicClick(topic)}
              disabled={isLoading}
              className="px-2 py-1 bg-purple-500/10 border border-purple-500/30 font-pixel text-[7px] text-purple-300 hover:bg-purple-500/20 hover:text-purple-200 transition-colors disabled:opacity-50"
              title={topic.description}
            >
              {topic.icon} {topic.title}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="h-48 overflow-y-auto p-2 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center py-4">
            <p className="font-pixel text-[10px] text-purple-400 mb-1">👻 ghost agent online</p>
            <p className="font-pixel text-[8px] text-gray-400">paste a CA to lookup token stats</p>
            <p className="font-pixel text-[7px] text-gray-500 mt-2">or click a topic above</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-2 border-l-2 ${
                msg.type === "dev"
                  ? "bg-purple-500/10 border-purple-500"
                  : msg.type === "user"
                    ? "bg-cyan-500/10 border-cyan-500 ml-4"
                    : msg.type === "info"
                      ? "bg-blue-500/10 border-blue-500"
                      : msg.type === "portfolio"
                        ? "bg-green-500/10 border-green-500"
                        : "bg-red-500/10 border-red-500"
              }`}
            >
              {msg.type === "dev" && (
                <p className="font-pixel text-[6px] text-purple-400 mb-1">Ghost:</p>
              )}
              {msg.type === "user" && (
                <p className="font-pixel text-[6px] text-cyan-400 mb-1">You:</p>
              )}
              {msg.type === "info" && (
                <p className="font-pixel text-[6px] text-blue-400 mb-1">Token Info:</p>
              )}
              {msg.type === "portfolio" && (
                <p className="font-pixel text-[6px] text-green-400 mb-1">Portfolio:</p>
              )}
              {msg.type === "error" && (
                <p className="font-pixel text-[6px] text-red-400 mb-1">Error:</p>
              )}
              <p className="font-pixel text-[8px] text-white whitespace-pre-wrap">{msg.message}</p>
            </div>
          ))
        )}
        {isLoading && (
          <div className="p-2 border-l-2 bg-purple-500/10 border-purple-500">
            <p className="font-pixel text-[8px] text-purple-300 animate-pulse">checking...</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="p-2 border-t border-purple-500/30">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="paste CA or ask something..."
            disabled={isLoading}
            className="flex-1 bg-bags-darker border border-purple-500/30 px-2 py-1 font-pixel text-[8px] text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 disabled:opacity-50"
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputValue.trim()}
            className="px-2 py-1 bg-purple-500 text-white font-pixel text-[8px] hover:bg-purple-400 disabled:opacity-50 transition-colors"
          >
            Send
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-purple-500/30 bg-bags-darker">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-gray-500"}`} />
            <p className="font-pixel text-[7px] text-gray-400">
              {connected
                ? `${publicKey?.toString().slice(0, 4)}...${publicKey?.toString().slice(-4)}`
                : "wallet not connected"}
            </p>
          </div>
          <a
            href="https://x.com/DaddyGhost"
            target="_blank"
            rel="noopener noreferrer"
            className="font-pixel text-[7px] text-purple-400 hover:text-purple-300 transition-colors"
          >
            @DaddyGhost
          </a>
        </div>
      </div>
    </div>
  );
}
