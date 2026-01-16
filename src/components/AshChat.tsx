"use client";

import { useState, useEffect, useRef } from "react";
import { ECOSYSTEM_CONFIG } from "@/lib/config";

interface EcoMessage {
  id: string;
  type: "ash" | "info" | "tip";
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
    content: "10% of ALL fees go back to the strongest communities! 50% for community rewards, 25% for weekly airdrops, 15% for creator bonuses, and 10% for development. The more active your community, the more you earn!"
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
  const [position, setPosition] = useState<Position>({ x: -1, y: 16 }); // -1 means use right positioning
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  // Listen for Ash click events
  useEffect(() => {
    const handleAshClick = () => {
      setIsOpen(true);
      // Add Ash's greeting
      const randomQuote = ASH_QUOTES[Math.floor(Math.random() * ASH_QUOTES.length)];
      addMessage({
        id: `${Date.now()}-ash`,
        type: "ash",
        message: randomQuote,
        timestamp: Date.now(),
      });
    };

    window.addEventListener("bagsworld-ash-click", handleAshClick);
    return () => {
      window.removeEventListener("bagsworld-ash-click", handleAshClick);
    };
  }, []);

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

    // Ash comments on the topic
    setTimeout(() => {
      const comments = [
        "Just like training Pokemon, you gotta understand the basics!",
        "That's how we become the very best in BagsWorld!",
        "Knowledge is power, trainer!",
        "Now you're getting it! You'll be a champion in no time!",
      ];
      addMessage({
        id: `${Date.now()}-ash-comment`,
        type: "ash",
        message: comments[Math.floor(Math.random() * comments.length)],
        timestamp: Date.now(),
      });
    }, 500);
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
      <div className="h-48 overflow-y-auto p-2 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center py-4">
            <p className="font-pixel text-[10px] text-red-400 mb-1">
              ⚡ Welcome, Trainer!
            </p>
            <p className="font-pixel text-[8px] text-gray-400">
              I&apos;m Ash, and I&apos;ll help you understand how BagsWorld works!
            </p>
            <p className="font-pixel text-[7px] text-gray-500 mt-2">
              Click a topic above to learn more
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-2 border-l-2 ${
                msg.type === "ash"
                  ? "bg-red-500/10 border-red-500"
                  : msg.type === "info"
                  ? "bg-blue-500/10 border-blue-500"
                  : "bg-yellow-500/10 border-yellow-500"
              }`}
            >
              {msg.type === "ash" && (
                <p className="font-pixel text-[6px] text-red-400 mb-1">Ash:</p>
              )}
              {msg.type === "info" && (
                <p className="font-pixel text-[6px] text-blue-400 mb-1">📖 Info:</p>
              )}
              <p className="font-pixel text-[8px] text-white whitespace-pre-wrap">
                {msg.message}
              </p>
              <p className="font-pixel text-[6px] text-gray-600 mt-1">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer with key stats */}
      <div className="p-2 border-t border-red-500/30 bg-bags-darker">
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-red-500/10 p-1 rounded">
            <p className="font-pixel text-[7px] text-gray-400">Community Share</p>
            <p className="font-pixel text-[10px] text-red-400">{ECOSYSTEM_CONFIG.ecosystem.allocation.communityRewards}%</p>
          </div>
          <div className="bg-yellow-500/10 p-1 rounded">
            <p className="font-pixel text-[7px] text-gray-400">Weekly Airdrops</p>
            <p className="font-pixel text-[10px] text-yellow-400">{ECOSYSTEM_CONFIG.ecosystem.allocation.weeklyAirdrops}%</p>
          </div>
        </div>
        <a
          href={`https://solscan.io/account/${ECOSYSTEM_CONFIG.ecosystem.wallet}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center font-pixel text-[7px] text-blue-400 hover:text-blue-300 mt-2"
        >
          🔍 Verify Rewards Wallet on Solscan →
        </a>
      </div>
    </div>
  );
}
