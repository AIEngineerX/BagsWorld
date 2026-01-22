"use client";

import { useState, useEffect, useRef } from "react";
import { ECOSYSTEM_CONFIG } from "@/lib/config";
import { useGameStore } from "@/lib/store";

interface BagsMessage {
  id: string;
  type: "finn" | "user" | "info" | "tip";
  message: string;
  timestamp: number;
}

interface Position {
  x: number;
  y: number;
}

const FINN_QUOTES = ECOSYSTEM_CONFIG.finn.quotes;

const BAGS_TOPICS = [
  {
    title: "Launch Tokens",
    icon: "🚀",
    content: "Launch your own memecoin in seconds! No code required. Just pick a name, upload an image, and you're live. Your token becomes a building in BagsWorld that grows with market cap."
  },
  {
    title: "Earn Forever",
    icon: "💰",
    content: "Creators earn 1% of ALL trading volume on their tokens - forever. Set your fee shares at launch and they're locked permanently. No rugs, no changes, just consistent earnings."
  },
  {
    title: "Fee Sharing",
    icon: "🤝",
    content: "Split your fees with anyone! Add your community members, collaborators, or influencers as fee share recipients. They earn every time someone trades your token."
  },
  {
    title: "Building Levels",
    icon: "🏗️",
    content: "Your building evolves based on market cap:\n• Level 1: Under $100K (Shop)\n• Level 2: $100K-$500K (Office)\n• Level 3: $500K-$2M (HQ)\n• Level 4: $2M-$10M (Tower)\n• Level 5: $10M+ (Skyscraper)"
  },
  {
    title: "Why Bags.fm?",
    icon: "💎",
    content: "Over $1B in volume in under 30 days. Fastest growing launchpad in crypto. Fair launches, permanent fees, and a community that actually builds. This is where culture meets capital."
  },
];

export function FinnbagsChat() {
  const [messages, setMessages] = useState<BagsMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState<Position>({ x: -1, y: -1 }); // -1 means use default positioning
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { worldState } = useGameStore();

  // Listen for Finn click events
  useEffect(() => {
    const handleFinnClick = () => {
      setIsOpen(true);
      // Add Finn's greeting
      const randomQuote = FINN_QUOTES[Math.floor(Math.random() * FINN_QUOTES.length)];
      addMessage({
        id: `${Date.now()}-finn`,
        type: "finn",
        message: randomQuote,
        timestamp: Date.now(),
      });
    };

    window.addEventListener("bagsworld-finn-click", handleFinnClick);
    return () => {
      window.removeEventListener("bagsworld-finn-click", handleFinnClick);
    };
  }, []);

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
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
      return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
      };
    }
  }, [isDragging, dragOffset]);

  const addMessage = (message: BagsMessage) => {
    setMessages((prev) => [...prev.slice(-30), message]);
  };

  const handleTopicClick = (topic: typeof BAGS_TOPICS[0]) => {
    addMessage({
      id: `${Date.now()}-info`,
      type: "info",
      message: topic.content,
      timestamp: Date.now(),
    });

    // Finn comments on the topic
    setTimeout(() => {
      const comments = [
        "That's the Bags way. Build something people actually want.",
        "We're not just another launchpad - we're building the future of creator monetization.",
        "The best part? This is just the beginning. Keep building.",
        "Now you're thinking like a founder. Ship it!",
        "This is why we built Bags. Let's go.",
      ];
      addMessage({
        id: `${Date.now()}-finn-comment`,
        type: "finn",
        message: comments[Math.floor(Math.random() * comments.length)],
        timestamp: Date.now(),
      });
    }, 500);
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

    try {
      const response = await fetch("/api/agent-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: "finn",
          message: userMsg,
          chatHistory: messages.slice(-6).map((m) => ({
            role: m.type === "user" ? "user" : "assistant",
            content: m.message,
          })),
          worldState: worldState ? {
            health: worldState.health,
            weather: worldState.weather,
            buildingCount: worldState.buildings.length,
            populationCount: worldState.population.length,
          } : undefined,
        }),
      });

      const data = await response.json();
      addMessage({
        id: `${Date.now()}-finn`,
        type: "finn",
        message: data.message || "This is why we built Bags. What else you want to know?",
        timestamp: Date.now(),
      });
    } catch (error) {
      addMessage({
        id: `${Date.now()}-finn`,
        type: "finn",
        message: "Connection issue ser. Try again?",
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

  const chatStyle: React.CSSProperties = position.x >= 0 && position.y >= 0
    ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' }
    : { right: 350, bottom: 80 };

  if (!isOpen) {
    return null; // Hidden until Finn is clicked
  }

  return (
    <div
      ref={chatRef}
      style={chatStyle}
      className={`fixed z-50 w-[calc(100vw-2rem)] sm:w-80 max-w-80 bg-bags-dark border-4 border-emerald-500 shadow-lg ${isDragging ? 'cursor-grabbing' : ''}`}
    >
      {/* Header - Draggable */}
      <div
        onPointerDown={handlePointerDown}
        className="flex items-center justify-between p-2 border-b-4 border-emerald-500 cursor-grab active:cursor-grabbing select-none touch-none bg-gradient-to-r from-emerald-600/20 to-bags-green/20"
      >
        <div className="flex items-center gap-2">
          <span className="font-pixel text-sm">💼</span>
          <div>
            <p className="font-pixel text-[10px] text-emerald-400">
              FINN // FOUNDER
            </p>
            <p className="font-pixel text-[8px] text-emerald-600">
              powered by opus 4.5
            </p>
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
      <div className="p-2 border-b border-emerald-500/30 bg-bags-darker">
        <p className="font-pixel text-[8px] text-gray-400 mb-2">Learn about Bags.fm:</p>
        <div className="flex flex-wrap gap-1">
          {BAGS_TOPICS.map((topic, i) => (
            <button
              key={i}
              onClick={() => handleTopicClick(topic)}
              className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/30 font-pixel text-[7px] text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200 transition-colors"
            >
              {topic.icon} {topic.title}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="h-36 overflow-y-auto p-2 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center py-4">
            <p className="font-pixel text-[10px] text-emerald-400 mb-1">
              💼 Hey, I&apos;m Finn!
            </p>
            <p className="font-pixel text-[8px] text-gray-400">
              Founder of Bags.fm. Let me show you around.
            </p>
            <p className="font-pixel text-[7px] text-gray-500 mt-2">
              Click a topic or type a question below
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-2 border-l-2 ${
                msg.type === "finn"
                  ? "bg-emerald-500/10 border-emerald-500"
                  : msg.type === "user"
                  ? "bg-bags-green/10 border-bags-green ml-4"
                  : msg.type === "info"
                  ? "bg-blue-500/10 border-blue-500"
                  : "bg-yellow-500/10 border-yellow-500"
              }`}
            >
              {msg.type === "finn" && (
                <p className="font-pixel text-[6px] text-emerald-400 mb-1">Finn:</p>
              )}
              {msg.type === "user" && (
                <p className="font-pixel text-[6px] text-bags-green mb-1">You:</p>
              )}
              {msg.type === "info" && (
                <p className="font-pixel text-[6px] text-blue-400 mb-1">📖 Info:</p>
              )}
              <p className="font-pixel text-[8px] text-white whitespace-pre-wrap">
                {msg.message}
              </p>
            </div>
          ))
        )}
        {isLoading && (
          <div className="p-2 border-l-2 bg-emerald-500/10 border-emerald-500">
            <p className="font-pixel text-[8px] text-emerald-300 animate-pulse">thinking...</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="p-2 border-t border-emerald-500/30">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask Finn..."
            disabled={isLoading}
            className="flex-1 bg-bags-darker border border-emerald-500/30 px-2 py-1 font-pixel text-[8px] text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputValue.trim()}
            className="px-2 py-1 bg-emerald-500 text-white font-pixel text-[8px] hover:bg-emerald-400 disabled:opacity-50 transition-colors"
          >
            Send
          </button>
        </div>
      </div>

      {/* Footer with Bags stats */}
      <div className="p-2 border-t border-emerald-500/30 bg-bags-darker">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-emerald-500/10 p-1 rounded">
            <p className="font-pixel text-[6px] text-gray-400">Volume</p>
            <p className="font-pixel text-[9px] text-emerald-400">$1B+</p>
          </div>
          <div className="bg-bags-gold/10 p-1 rounded">
            <p className="font-pixel text-[6px] text-gray-400">Creator Fee</p>
            <p className="font-pixel text-[9px] text-bags-gold">1%</p>
          </div>
          <div className="bg-purple-500/10 p-1 rounded">
            <p className="font-pixel text-[6px] text-gray-400">Ecosystem</p>
            <p className="font-pixel text-[9px] text-purple-400">5%</p>
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <a
            href="https://x.com/finnbags"
            target="_blank"
            rel="noopener noreferrer"
            className="font-pixel text-[7px] text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            @finnbags
          </a>
          <a
            href="https://bags.fm"
            target="_blank"
            rel="noopener noreferrer"
            className="font-pixel text-[7px] text-emerald-400 hover:text-emerald-300"
          >
            Launch on Bags.fm
          </a>
        </div>
      </div>
    </div>
  );
}
