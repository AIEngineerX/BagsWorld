"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useWorldState } from "@/hooks/useWorldState";
import { ActionButtons } from "@/components/ActionButtons";
import type { AIAction } from "@/app/api/agent-chat/route";

interface CJMessage {
  id: string;
  type: "cj" | "user" | "info";
  message: string;
  timestamp: number;
  actions?: AIAction[];
}

interface Position {
  x: number;
  y: number;
}

const CJ_TOPICS = [
  {
    title: "The Hood",
    icon: "🏘️",
    content: "Grove Street, homie. Where legends get made. Been through wars, police raids, and came out on top. That's where real ones come from - not from some fancy house, but from the struggle."
  },
  {
    title: "Bags Life",
    icon: "💰",
    content: "Man, this Bags.fm thing is like running your own operation - but legal. You launch a token, stack fees, watch it grow. Just like building up Grove Street Families, except the feds can't touch you."
  },
  {
    title: "Survival Tips",
    icon: "🎯",
    content: "Three rules homie: 1) Never show all your cards. 2) Stack before you flex. 3) Your crew is everything - find people who got your back when things get hot. Same rules apply in crypto."
  },
  {
    title: "BagsCity Life",
    icon: "🌆",
    content: "BagsCity is like the hood I always wanted - people building together, making money together. No Ballas trying to start beef, just straight hustle. This is what the future looks like, G."
  },
  {
    title: "Real Talk",
    icon: "💯",
    content: "Most people talk big but never put in work. In the hood, you learn quick - only actions matter. Same in crypto. I don't care what you SAY you gonna do. Show me the receipts."
  },
];

export function CJChat() {
  const [messages, setMessages] = useState<CJMessage[]>([]);
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 16, y: -1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { worldState } = useWorldState();

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

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
    const handlePointerUp = () => setIsDragging(false);
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

  const addMessage = useCallback((message: CJMessage) => {
    setMessages((prev) => [...prev.slice(-30), message]);
  }, []);

  const handleTopicClick = (topic: typeof CJ_TOPICS[0]) => {
    addMessage({
      id: `${Date.now()}-info`,
      type: "info",
      message: topic.content,
      timestamp: Date.now(),
    });
  };

  const sendToCJ = useCallback(async (userMessage: string) => {
    if (isLoading) return;

    // Don't add opening line as user message
    if (userMessage !== "yo what's good") {
      addMessage({
        id: `${Date.now()}-user`,
        type: "user",
        message: userMessage,
        timestamp: Date.now(),
      });
    }

    setIsLoading(true);

    try {
      // Use unified agents API
      const conversationHistory = messages
        .filter(m => m.type === 'user' || m.type === 'cj')
        .slice(-10)
        .map(m => ({
          role: m.type === 'user' ? 'user' : 'assistant',
          content: m.message,
        }));

      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "cj",
          message: userMessage,
          conversationHistory,
        }),
      });

      const data = await response.json();
      const messageText = data.response || "aw shit, something went wrong homie";

      addMessage({
        id: `${Date.now()}-cj`,
        type: "cj",
        message: messageText,
        timestamp: Date.now(),
        actions: data.actions || [],
      });
    } catch (error) {
      console.error("CJ chat error:", error);
      addMessage({
        id: `${Date.now()}-cj`,
        type: "cj",
        message: "damn homie, connection dropped. try again",
        timestamp: Date.now(),
      });
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages, addMessage]);

  // Listen for CJ click events
  useEffect(() => {
    const handleCJClick = () => {
      setIsOpen(true);
      if (messages.length === 0) {
        sendToCJ("yo what's good");
      }
    };

    window.addEventListener("bagsworld-cj-click", handleCJClick);
    return () => {
      window.removeEventListener("bagsworld-cj-click", handleCJClick);
    };
  }, [messages.length, sendToCJ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    sendToCJ(input.trim());
    setInput("");
  };

  // Handle action button clicks
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
      case "claim":
        window.dispatchEvent(new CustomEvent("bagsworld-claim-click"));
        break;
      case "link":
        if (action.data.url) {
          window.open(action.data.url, "_blank", "noopener,noreferrer");
        }
        break;
    }
  };

  const chatStyle: React.CSSProperties = position.y >= 0
    ? { left: position.x, top: position.y, bottom: "auto" }
    : { left: position.x, bottom: 80 };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={chatRef}
      style={chatStyle}
      className={`fixed z-50 w-[calc(100vw-2rem)] sm:w-80 max-w-80 bg-bags-dark border-4 border-orange-500 shadow-lg ${isDragging ? "cursor-grabbing" : ""}`}
    >
      {/* Header */}
      <div
        onPointerDown={handlePointerDown}
        className="flex items-center justify-between p-2 border-b-4 border-orange-500 cursor-grab active:cursor-grabbing select-none touch-none bg-gradient-to-r from-orange-600/20 to-green-600/20"
      >
        <div className="flex items-center gap-2">
          <span className="font-pixel text-sm">🔫</span>
          <div>
            <p className="font-pixel text-[10px] text-orange-400">CJ - GROVE STREET</p>
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
      <div className="p-2 border-b border-orange-500/30 bg-bags-darker">
        <p className="font-pixel text-[8px] text-gray-400 mb-2">Real Talk Topics:</p>
        <div className="flex flex-wrap gap-1">
          {CJ_TOPICS.map((topic, i) => (
            <button
              key={i}
              onClick={() => handleTopicClick(topic)}
              className="px-2 py-1 bg-orange-500/10 border border-orange-500/30 font-pixel text-[7px] text-orange-300 hover:bg-orange-500/20 hover:text-orange-200 transition-colors"
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
            <p className="font-pixel text-[10px] text-orange-400 mb-1">🔫 yo what&apos;s good!</p>
            <p className="font-pixel text-[8px] text-gray-400">CJ here, from Grove Street.</p>
            <p className="font-pixel text-[7px] text-gray-500 mt-2">Ask me anything or click a topic above</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-2 border-l-2 ${
                msg.type === "cj"
                  ? "bg-orange-500/10 border-orange-500"
                  : msg.type === "user"
                  ? "bg-bags-green/10 border-bags-green ml-4"
                  : "bg-green-500/10 border-green-500"
              }`}
            >
              {msg.type === "cj" && <p className="font-pixel text-[6px] text-orange-400 mb-1">CJ:</p>}
              {msg.type === "user" && <p className="font-pixel text-[6px] text-bags-green mb-1">You:</p>}
              {msg.type === "info" && <p className="font-pixel text-[6px] text-green-400 mb-1">🏘️ Grove Street:</p>}
              <p className="font-pixel text-[8px] text-white whitespace-pre-wrap">{msg.message}</p>
              {msg.type === "cj" && msg.actions && msg.actions.length > 0 && (
                <ActionButtons actions={msg.actions} onAction={handleAction} />
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="p-2 border-l-2 bg-orange-500/10 border-orange-500">
            <p className="font-pixel text-[8px] text-orange-300 animate-pulse">hold up homie...</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-2 border-t border-orange-500/30">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Talk to CJ..."
            disabled={isLoading}
            className="flex-1 bg-bags-darker border border-orange-500/30 px-2 py-1 font-pixel text-[8px] text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-2 py-1 bg-orange-500 text-white font-pixel text-[8px] hover:bg-orange-400 disabled:opacity-50 transition-colors"
          >
            Send
          </button>
        </form>
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-orange-500/30 bg-bags-darker">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-orange-500/10 p-1 rounded">
            <p className="font-pixel text-[6px] text-gray-400">Hood Rep</p>
            <p className="font-pixel text-[9px] text-orange-400">💯 MAX</p>
          </div>
          <div className="bg-green-500/10 p-1 rounded">
            <p className="font-pixel text-[6px] text-gray-400">Grove St</p>
            <p className="font-pixel text-[9px] text-green-400">4 LIFE</p>
          </div>
          <div className="bg-orange-500/10 p-1 rounded">
            <p className="font-pixel text-[6px] text-gray-400">Status</p>
            <p className="font-pixel text-[9px] text-orange-400">OG</p>
          </div>
        </div>
        <p className="font-pixel text-[7px] text-orange-600 text-center mt-2">
          &quot;aw shit here we go again&quot;
        </p>
      </div>
    </div>
  );
}
