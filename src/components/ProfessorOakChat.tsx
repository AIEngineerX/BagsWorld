"use client";

import { useState, useEffect, useRef } from "react";
import { ActionButtons } from "@/components/ActionButtons";
import type { AIAction } from "@/app/api/agent-chat/route";

interface OakMessage {
  id: string;
  type: "oak" | "user" | "info" | "checklist";
  message: string;
  timestamp: number;
  actions?: AIAction[];
}

interface Position {
  x: number;
  y: number;
}

const DEXSCREENER_TOPICS = [
  {
    title: "Getting Started",
    icon: "S",
    content:
      "DexScreener Enhanced Token Info costs $299. You'll need: a square logo (512x512px), a 3:1 banner (600x200px), website URL, and Twitter handle. Processing usually takes minutes!",
  },
  {
    title: "Logo Requirements",
    icon: "L",
    content:
      "TOKEN LOGO:\n- Format: PNG, JPG, WEBP, or GIF\n- Ratio: 1:1 (SQUARE)\n- Recommended: 512x512px or 1024x1024px\n- Minimum: 100px width",
  },
  {
    title: "Banner Requirements",
    icon: "B",
    content:
      "TOKEN HEADER/BANNER:\n- Format: PNG, JPG, WEBP, or GIF\n- Ratio: 3:1 (wide rectangle)\n- Recommended: 600x200px or 1500x500px\n- Minimum: 600px width",
  },
  {
    title: "Social Links",
    icon: "X",
    content:
      "REQUIRED:\n- Website URL\n- Twitter/X handle\n\nOPTIONAL (recommended):\n- Telegram group\n- Discord server\n\nTIP: Active socials = more trust!",
  },
  {
    title: "Launch Checklist",
    icon: "C",
    content:
      "PRE-LAUNCH CHECKLIST:\n[ ] Logo ready (512x512px, square)\n[ ] Banner ready (600x200px, 3:1)\n[ ] Website live\n[ ] Twitter active\n[ ] Description written\n[ ] $299 payment ready",
  },
  {
    title: "Payment Info",
    icon: "$",
    content:
      "PAYMENT OPTIONS:\n- Crypto (various tokens)\n- Credit card\n\nCost: $299 USD\nProcessing: Minutes to 12 hours\n\nMake sure all assets are ready BEFORE payment!",
  },
];

export function ProfessorOakChat() {
  const [messages, setMessages] = useState<OakMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState<Position>({ x: -1, y: 16 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Listen for Professor Oak click events
  useEffect(() => {
    const handleOakClick = () => {
      setIsOpen(true);
      if (messages.length === 0) {
        addMessage({
          id: `${Date.now()}-oak`,
          type: "oak",
          message:
            "Welcome to Founder's Corner! I'm Professor Oak, and I'm here to help you prepare your token for DexScreener. What would you like to learn about?",
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

  const addMessage = (message: OakMessage) => {
    setMessages((prev) => [...prev.slice(-30), message]);
  };

  const handleTopicClick = (topic: (typeof DEXSCREENER_TOPICS)[0]) => {
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
      const response = await fetch("/api/eliza-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character: "professorOak",
          message: userMsg,
        }),
      });

      const data = await response.json();
      const messageText =
        data.response ||
        data.message ||
        "Great question! Ask me about logo sizes, banner dimensions, or the launch checklist!";

      addMessage({
        id: `${Date.now()}-oak`,
        type: "oak",
        message: messageText,
        timestamp: Date.now(),
        actions: data.actions || [],
      });
    } catch (error) {
      addMessage({
        id: `${Date.now()}-oak`,
        type: "oak",
        message: "Connection issue! Try again - preparation is key!",
        timestamp: Date.now(),
      });
    } finally {
      setIsLoading(false);
    }
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
      className={`fixed z-50 w-[calc(100vw-2rem)] sm:w-80 max-w-80 bg-bags-dark border-4 border-amber-600 shadow-lg ${isDragging ? "cursor-grabbing" : ""}`}
    >
      {/* Header - Draggable */}
      <div
        onPointerDown={handlePointerDown}
        className="flex items-center justify-between p-2 border-b-4 border-amber-600 cursor-grab active:cursor-grabbing select-none touch-none bg-gradient-to-r from-amber-600/20 to-orange-500/20"
      >
        <div className="flex items-center gap-2">
          <span className="font-pixel text-sm">🎓</span>
          <div>
            <p className="font-pixel text-[10px] text-amber-400">PROFESSOR OAK // GUIDE</p>
            <p className="font-pixel text-[8px] text-amber-600">powered by ElizaOS</p>
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
      <div className="p-2 border-b border-amber-600/30 bg-bags-darker">
        <p className="font-pixel text-[8px] text-gray-400 mb-2">DexScreener Launch Guide:</p>
        <div className="flex flex-wrap gap-1">
          {DEXSCREENER_TOPICS.map((topic, i) => (
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

      {/* Messages */}
      <div className="h-36 overflow-y-auto p-2 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center py-4">
            <p className="font-pixel text-[10px] text-amber-400 mb-1">🎓 Welcome, Creator!</p>
            <p className="font-pixel text-[8px] text-gray-400">
              I&apos;m Professor Oak! Let me help you prepare for DexScreener.
            </p>
            <p className="font-pixel text-[7px] text-gray-500 mt-2">
              Click a topic or ask a question below
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
            placeholder="Ask about DexScreener..."
            disabled={isLoading}
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

      {/* Footer with quick reference */}
      <div className="p-2 border-t border-amber-600/30 bg-bags-darker">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-amber-600/10 p-1 rounded">
            <p className="font-pixel text-[7px] text-gray-400">Logo</p>
            <p className="font-pixel text-[10px] text-amber-400">512x512</p>
          </div>
          <div className="bg-amber-600/10 p-1 rounded">
            <p className="font-pixel text-[7px] text-gray-400">Banner</p>
            <p className="font-pixel text-[10px] text-amber-400">600x200</p>
          </div>
          <div className="bg-amber-600/10 p-1 rounded">
            <p className="font-pixel text-[7px] text-gray-400">Cost</p>
            <p className="font-pixel text-[10px] text-amber-400">$299</p>
          </div>
        </div>
        <a
          href="https://marketplace.dexscreener.com/product/token-info"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center font-pixel text-[7px] text-blue-400 hover:text-blue-300 mt-1"
        >
          Visit DexScreener Marketplace
        </a>
      </div>
    </div>
  );
}
