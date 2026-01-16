"use client";

import { useState, useEffect, useRef } from "react";
import { useGameStore } from "@/lib/store";

interface TolyMessage {
  id: string;
  type: "toly" | "user" | "info";
  message: string;
  timestamp: number;
}

interface Position {
  x: number;
  y: number;
}

const SOLANA_TOPICS = [
  {
    title: "What is Solana?",
    icon: "◎",
    content: "Solana is a high-performance blockchain built for speed and scale. We achieve 65,000+ TPS using Proof of History - a cryptographic clock that orders transactions without waiting for consensus."
  },
  {
    title: "Proof of History",
    icon: "⏰",
    content: "PoH creates a historical record proving events occurred at specific moments. Instead of validators agreeing on time, they verify a cryptographic sequence. This removes communication overhead and enables parallel execution."
  },
  {
    title: "Why So Fast?",
    icon: "⚡",
    content: "Solana processes transactions in parallel using Sealevel. While other chains process sequentially, we run thousands of smart contracts simultaneously. Combined with Gulf Stream (mempool-less forwarding), we achieve sub-second finality."
  },
  {
    title: "For Builders",
    icon: "🛠️",
    content: "Build without limits. Sub-penny fees mean you can create apps that weren't possible before. Bags.fm is a perfect example - high-frequency trading with instant fee distribution, only possible on Solana."
  },
  {
    title: "The Vision",
    icon: "🌍",
    content: "We're building a decentralized network that can support billions of users. Web3 shouldn't be slow and expensive. It should feel like the internet - instant, cheap, and accessible to everyone."
  },
];

export function TolyChat() {
  const [messages, setMessages] = useState<TolyMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 16, y: -1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { worldState } = useGameStore();

  // Listen for Toly click events
  useEffect(() => {
    const handleTolyClick = () => {
      setIsOpen(true);
      if (messages.length === 0) {
        addMessage({
          id: `${Date.now()}-toly`,
          type: "toly",
          message: "gm ser! I'm Toly, co-founder of Solana. Welcome to BagsWorld - built on the fastest blockchain. What would you like to know?",
          timestamp: Date.now(),
        });
      }
    };

    window.addEventListener("bagsworld-toly-click", handleTolyClick);
    return () => {
      window.removeEventListener("bagsworld-toly-click", handleTolyClick);
    };
  }, [messages.length]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, input")) return;
    const rect = chatRef.current?.getBoundingClientRect();
    if (rect) {
      setIsDragging(true);
      setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
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
    const handleMouseUp = () => setIsDragging(false);
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  const addMessage = (message: TolyMessage) => {
    setMessages((prev) => [...prev.slice(-30), message]);
  };

  const handleTopicClick = (topic: typeof SOLANA_TOPICS[0]) => {
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
          character: "toly",
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
        id: `${Date.now()}-toly`,
        type: "toly",
        message: data.message || "interesting question ser. ask me about Solana or the ecosystem!",
        timestamp: Date.now(),
      });
    } catch (error) {
      addMessage({
        id: `${Date.now()}-toly`,
        type: "toly",
        message: "connection hiccup ser. try again?",
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

  const chatStyle: React.CSSProperties = position.y >= 0
    ? { left: position.x, top: position.y, bottom: "auto" }
    : { left: position.x, bottom: 80 };

  if (!isOpen) return null;

  return (
    <div
      ref={chatRef}
      style={chatStyle}
      className={`fixed z-50 w-80 bg-bags-dark border-4 border-purple-500 shadow-lg ${isDragging ? "cursor-grabbing" : ""}`}
    >
      {/* Header */}
      <div
        onMouseDown={handleMouseDown}
        className="flex items-center justify-between p-2 border-b-4 border-purple-500 cursor-grab active:cursor-grabbing select-none bg-gradient-to-r from-purple-600/20 to-purple-400/20"
      >
        <div className="flex items-center gap-2">
          <span className="font-pixel text-sm">◎</span>
          <div>
            <p className="font-pixel text-[10px] text-purple-400">TOLY - SOLANA CO-FOUNDER</p>
            <p className="font-pixel text-[8px] text-gray-400">drag to move</p>
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
        <p className="font-pixel text-[8px] text-gray-400 mb-2">Learn about Solana:</p>
        <div className="flex flex-wrap gap-1">
          {SOLANA_TOPICS.map((topic, i) => (
            <button
              key={i}
              onClick={() => handleTopicClick(topic)}
              className="px-2 py-1 bg-purple-500/10 border border-purple-500/30 font-pixel text-[7px] text-purple-300 hover:bg-purple-500/20 hover:text-purple-200 transition-colors"
            >
              {topic.icon} {topic.title}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="h-40 overflow-y-auto p-2 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center py-4">
            <p className="font-pixel text-[10px] text-purple-400 mb-1">◎ gm ser!</p>
            <p className="font-pixel text-[8px] text-gray-400">I&apos;m Toly, co-founder of Solana.</p>
            <p className="font-pixel text-[7px] text-gray-500 mt-2">Ask me anything or click a topic above</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-2 border-l-2 ${
                msg.type === "toly"
                  ? "bg-purple-500/10 border-purple-500"
                  : msg.type === "user"
                  ? "bg-bags-green/10 border-bags-green ml-4"
                  : "bg-blue-500/10 border-blue-500"
              }`}
            >
              {msg.type === "toly" && <p className="font-pixel text-[6px] text-purple-400 mb-1">Toly:</p>}
              {msg.type === "user" && <p className="font-pixel text-[6px] text-bags-green mb-1">You:</p>}
              {msg.type === "info" && <p className="font-pixel text-[6px] text-blue-400 mb-1">◎ Solana:</p>}
              <p className="font-pixel text-[8px] text-white whitespace-pre-wrap">{msg.message}</p>
            </div>
          ))
        )}
        {isLoading && (
          <div className="p-2 border-l-2 bg-purple-500/10 border-purple-500">
            <p className="font-pixel text-[8px] text-purple-300 animate-pulse">thinking...</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-2 border-t border-purple-500/30">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask Toly..."
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
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-purple-500/10 p-1 rounded">
            <p className="font-pixel text-[6px] text-gray-400">TPS</p>
            <p className="font-pixel text-[9px] text-purple-400">65,000+</p>
          </div>
          <div className="bg-purple-500/10 p-1 rounded">
            <p className="font-pixel text-[6px] text-gray-400">Finality</p>
            <p className="font-pixel text-[9px] text-purple-400">400ms</p>
          </div>
          <div className="bg-purple-500/10 p-1 rounded">
            <p className="font-pixel text-[6px] text-gray-400">Fees</p>
            <p className="font-pixel text-[9px] text-purple-400">$0.00025</p>
          </div>
        </div>
      </div>
    </div>
  );
}
