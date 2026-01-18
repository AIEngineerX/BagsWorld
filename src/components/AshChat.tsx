"use client";

import { useState, useEffect, useRef } from "react";
import { ECOSYSTEM_CONFIG } from "@/lib/config";
import { useGameStore } from "@/lib/store";

interface EcoMessage {
  id: string;
  type: "ash" | "user" | "info" | "tip";
  message: string;
  timestamp: number;
}

interface Position {
  x: number;
  y: number;
}

const ASH_QUOTES = ECOSYSTEM_CONFIG.ash.quotes;

const ECOSYSTEM_TOPICS = [
  {
    title: "How Buildings Work",
    icon: "🏗️",
    content: "Every token launched on BagsWorld becomes a building! As the market cap grows, your building evolves - from a small shop to a towering skyscraper. Level 1 is under $100K, Level 5 is $10M+!"
  },
  {
    title: "Community Rewards",
    icon: "🏆",
    content: "5% of ALL fees go back to the strongest communities! 50% for community rewards, 25% for weekly airdrops, 15% for creator bonuses, and 10% for development. The more active your community, the more you earn!"
  },
  {
    title: "How Citizens Work",
    icon: "👥",
    content: "Every X/Twitter account that receives fee shares becomes a citizen walking around BagsWorld! Their mood changes based on earnings - celebrating when fees are flowing, sad when things are quiet."
  },
  {
    title: "Weather System",
    icon: "🌤️",
    content: "The world's weather reflects overall trading health! Sunny means things are booming (80%+ health), cloudy is normal, rain means slowing down, storm is rough times, and apocalypse... well, HODL tight!"
  },
  {
    title: "Permanent Fees",
    icon: "🔒",
    content: "On Bags.fm, fees are SET PERMANENTLY at launch and can never be changed. This means launching through BagsWorld guarantees your community always benefits from the ecosystem rewards!"
  },
  {
    title: "Weekly Airdrops",
    icon: "🎁",
    content: "Every week, the ecosystem distributes rewards to the most active communities and holders! Top earners get bonus airdrops, and engaged holders are rewarded for their participation."
  },
];

export function AshChat() {
  const [messages, setMessages] = useState<EcoMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState<Position>({ x: -1, y: 16 }); // -1 means use right positioning
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { worldState } = useGameStore();

  // Listen for Ash click events
  useEffect(() => {
    const handleAshClick = () => {
      setIsOpen(true);
      if (messages.length === 0) {
        addMessage({
          id: `${Date.now()}-ash`,
          type: "ash",
          message: "Hey trainer! Welcome to BagsWorld! Each building here is like a Pokemon - it evolves as it grows stronger. What would you like to know?",
          timestamp: Date.now(),
        });
      }
    };

    window.addEventListener("bagsworld-ash-click", handleAshClick);
    return () => {
      window.removeEventListener("bagsworld-ash-click", handleAshClick);
    };
  }, [messages.length]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;

    const rect = chatRef.current?.getBoundingClientRect();
    if (rect) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      const maxX = window.innerWidth - 320;
      const maxY = window.innerHeight - 400;

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  const addMessage = (message: EcoMessage) => {
    setMessages((prev) => [...prev.slice(-30), message]);
  };

  const handleTopicClick = (topic: typeof ECOSYSTEM_TOPICS[0]) => {
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

    try {
      const response = await fetch("/api/character-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character: "ash",
          userMessage: userMsg,
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
        id: `${Date.now()}-ash`,
        type: "ash",
        message: data.message || "Great question trainer! Ask me about buildings, fees, or the weather system!",
        timestamp: Date.now(),
      });
    } catch (error) {
      addMessage({
        id: `${Date.now()}-ash`,
        type: "ash",
        message: "Oops! Connection issue. Try again trainer!",
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

  const chatStyle: React.CSSProperties = position.x >= 0
    ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' }
    : { right: 16, bottom: 80 };

  if (!isOpen) {
    return null; // Hidden until Ash is clicked
  }

  return (
    <div
      ref={chatRef}
      style={chatStyle}
      className={`fixed z-50 w-80 bg-bags-dark border-4 border-red-500 shadow-lg ${isDragging ? 'cursor-grabbing' : ''}`}
    >
      {/* Header - Draggable */}
      <div
        onMouseDown={handleMouseDown}
        className="flex items-center justify-between p-2 border-b-4 border-red-500 cursor-grab active:cursor-grabbing select-none bg-gradient-to-r from-red-600/20 to-yellow-500/20"
      >
        <div className="flex items-center gap-2">
          <span className="font-pixel text-sm">⚡</span>
          <div>
            <p className="font-pixel text-[10px] text-red-400">
              ASH&apos;S ECOSYSTEM GUIDE
            </p>
            <p className="font-pixel text-[8px] text-gray-400">
              drag to move
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
      <div className="p-2 border-b border-red-500/30 bg-bags-darker">
        <p className="font-pixel text-[8px] text-gray-400 mb-2">Choose a topic to learn about:</p>
        <div className="flex flex-wrap gap-1">
          {ECOSYSTEM_TOPICS.map((topic, i) => (
            <button
              key={i}
              onClick={() => handleTopicClick(topic)}
              className="px-2 py-1 bg-red-500/10 border border-red-500/30 font-pixel text-[7px] text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-colors"
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
            <p className="font-pixel text-[10px] text-red-400 mb-1">
              ⚡ Welcome, Trainer!
            </p>
            <p className="font-pixel text-[8px] text-gray-400">
              I&apos;m Ash! Ask me anything about BagsWorld!
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
                msg.type === "ash"
                  ? "bg-red-500/10 border-red-500"
                  : msg.type === "user"
                  ? "bg-bags-green/10 border-bags-green ml-4"
                  : msg.type === "info"
                  ? "bg-blue-500/10 border-blue-500"
                  : "bg-yellow-500/10 border-yellow-500"
              }`}
            >
              {msg.type === "ash" && (
                <p className="font-pixel text-[6px] text-red-400 mb-1">Ash:</p>
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
          <div className="p-2 border-l-2 bg-red-500/10 border-red-500">
            <p className="font-pixel text-[8px] text-red-300 animate-pulse">thinking...</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="p-2 border-t border-red-500/30">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask Ash..."
            disabled={isLoading}
            className="flex-1 bg-bags-darker border border-red-500/30 px-2 py-1 font-pixel text-[8px] text-white placeholder-gray-500 focus:outline-none focus:border-red-500 disabled:opacity-50"
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputValue.trim()}
            className="px-2 py-1 bg-red-500 text-white font-pixel text-[8px] hover:bg-red-400 disabled:opacity-50 transition-colors"
          >
            Send
          </button>
        </div>
      </div>

      {/* Footer with key stats */}
      <div className="p-2 border-t border-red-500/30 bg-bags-darker">
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-bags-green/10 p-1 rounded">
            <p className="font-pixel text-[7px] text-gray-400">Buyback & Burn</p>
            <p className="font-pixel text-[10px] text-bags-green">80%</p>
          </div>
          <div className="bg-blue-500/10 p-1 rounded">
            <p className="font-pixel text-[7px] text-gray-400">Operations</p>
            <p className="font-pixel text-[10px] text-blue-400">20%</p>
          </div>
        </div>
        <p className="font-pixel text-[6px] text-gray-500 text-center mt-1">
          Top 5 tokens bought & burned every 12h
        </p>
        <a
          href={`https://solscan.io/account/${ECOSYSTEM_CONFIG.ecosystem.wallet}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center font-pixel text-[7px] text-blue-400 hover:text-blue-300 mt-1"
        >
          View Buyback Wallet on Solscan
        </a>
      </div>
    </div>
  );
}
