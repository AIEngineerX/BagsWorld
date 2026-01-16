"use client";

import { useState, useEffect, useRef } from "react";
import { ECOSYSTEM_CONFIG } from "@/lib/config";

interface BagsMessage {
  id: string;
  type: "finn" | "info" | "tip";
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
    title: "$250K Challenge",
    icon: "🏆",
    content: "Be the first memecoin on Bags to hit $10M market cap and HOLD it for 24 hours - win $250,000! The clock starts when you cross $10M. Can your community diamond hand it?"
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
  const [position, setPosition] = useState<Position>({ x: -1, y: -1 }); // -1 means use default positioning
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

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
      className={`fixed z-50 w-80 bg-bags-dark border-4 border-emerald-500 shadow-lg ${isDragging ? 'cursor-grabbing' : ''}`}
    >
      {/* Header - Draggable */}
      <div
        onMouseDown={handleMouseDown}
        className="flex items-center justify-between p-2 border-b-4 border-emerald-500 cursor-grab active:cursor-grabbing select-none bg-gradient-to-r from-emerald-600/20 to-bags-green/20"
      >
        <div className="flex items-center gap-2">
          <span className="font-pixel text-sm">💼</span>
          <div>
            <p className="font-pixel text-[10px] text-emerald-400">
              FINN&apos;S BAGS GUIDE
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
      <div className="h-48 overflow-y-auto p-2 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center py-4">
            <p className="font-pixel text-[10px] text-emerald-400 mb-1">
              💼 Hey, I&apos;m Finn!
            </p>
            <p className="font-pixel text-[8px] text-gray-400">
              Founder of Bags.fm. Let me show you around.
            </p>
            <p className="font-pixel text-[7px] text-gray-500 mt-2">
              Click a topic to learn more
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-2 border-l-2 ${
                msg.type === "finn"
                  ? "bg-emerald-500/10 border-emerald-500"
                  : msg.type === "info"
                  ? "bg-blue-500/10 border-blue-500"
                  : "bg-yellow-500/10 border-yellow-500"
              }`}
            >
              {msg.type === "finn" && (
                <p className="font-pixel text-[6px] text-emerald-400 mb-1">Finn:</p>
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
            <p className="font-pixel text-[6px] text-gray-400">Challenge</p>
            <p className="font-pixel text-[9px] text-purple-400">$250K</p>
          </div>
        </div>
        <a
          href="https://bags.fm"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center font-pixel text-[7px] text-emerald-400 hover:text-emerald-300 mt-2"
        >
          🚀 Launch on Bags.fm →
        </a>
      </div>
    </div>
  );
}
