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

const LAUNCH_GUIDE_TOPICS = [
  {
    title: "Start Launch",
    icon: "S",
    content:
      "Ready to launch your token on Bags.fm? Here's what you'll need:\n\n1. Token Name (3-32 chars)\n2. Symbol (up to 10 chars)\n3. Description (tell your story!)\n4. Logo image (square, required)\n5. Fee sharing setup (who gets trading fees)\n\nClick 'LAUNCH TOKEN NOW' below to begin!",
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
      "PRE-LAUNCH CHECKLIST:\n[ ] Name and symbol decided\n[ ] Description written\n[ ] Square logo ready\n[ ] Wallet linked at bags.fm/settings\n[ ] Fee sharing planned (must = 100%)\n[ ] SOL for initial buy (optional)",
  },
  {
    title: "NFA",
    icon: "!",
    content:
      "NOT FINANCIAL ADVICE\n\nBagsWorld and Professor Oak provide educational guidance only.\n\n- Do your own research (DYOR)\n- Never invest more than you can lose\n- Token launches carry significant risk\n- Past performance ≠ future results\n\nThis is not financial, legal, or investment advice.",
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
            "Ah, a new trainer ready to launch their first token! Welcome to Founder's Corner! I'm Professor Oak, and I'll guide you through launching on Bags.fm. What would you like to learn about?",
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

    try {
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
        "Wonderful question! Ask me about launching tokens, creator fees, or the launch checklist!";

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
        <p className="font-pixel text-[8px] text-gray-400 mb-2">Bags.fm Token Launch Guide:</p>
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

      {/* Messages */}
      <div className="h-36 overflow-y-auto p-2 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center py-4">
            <p className="font-pixel text-[10px] text-amber-400 mb-1">🎓 Welcome, Trainer!</p>
            <p className="font-pixel text-[8px] text-gray-400">
              I&apos;m Professor Oak! Let me guide you through launching on Bags.fm.
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
            placeholder="Ask about launching tokens..."
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
            <p className="font-pixel text-[7px] text-gray-400">Fee Share</p>
            <p className="font-pixel text-[10px] text-amber-400">=100%</p>
          </div>
          <div className="bg-amber-600/10 p-1 rounded">
            <p className="font-pixel text-[7px] text-gray-400">Initial Buy</p>
            <p className="font-pixel text-[10px] text-amber-400">Optional</p>
          </div>
          <div className="bg-red-600/10 p-1 rounded">
            <p className="font-pixel text-[7px] text-gray-400">Disclaimer</p>
            <p className="font-pixel text-[10px] text-red-400">NFA</p>
          </div>
        </div>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("bagsworld-launch-click"))}
          className="w-full mt-2 py-1.5 bg-bags-green/20 border border-bags-green/50 font-pixel text-[9px] text-bags-green hover:bg-bags-green/30 transition-colors"
        >
          [LAUNCH TOKEN NOW]
        </button>
      </div>
    </div>
  );
}
