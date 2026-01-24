"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ActionButtons } from "@/components/ActionButtons";
import type { AIAction } from "@/app/api/agent-chat/route";

interface BNNMessage {
  id: string;
  type: "bnn" | "user" | "info";
  message: string;
  timestamp: number;
  actions?: AIAction[];
}

interface Position {
  x: number;
  y: number;
}

const BNN_TOPICS = [
  {
    title: "Breaking News",
    icon: "🚨",
    content:
      "BREAKING: Alpha incoming. The Bags News Network brings you the latest updates, launches, and developments in real-time. Stay tuned.",
  },
  {
    title: "Token Updates",
    icon: "📊",
    content:
      "New launches, trending tokens, volume updates - BNN covers it all. The market moves fast, but we move faster. Data-driven reporting.",
  },
  {
    title: "Platform News",
    icon: "📢",
    content:
      "Feature updates, bug fixes, new integrations - if it happens on Bags.fm, BNN reports it. Official updates you can trust.",
  },
  {
    title: "CT Coverage",
    icon: "🐦",
    content:
      "Crypto Twitter moves fast. Narratives shift, trends emerge. BNN aggregates the signal from the noise. What's trending now matters.",
  },
  {
    title: "Alpha Alerts",
    icon: "🔔",
    content:
      "Early calls, whale movements, insider hints - the alpha that matters gets reported first. Follow BNN for the edge.",
  },
];

export function BNNChat() {
  const [messages, setMessages] = useState<BNNMessage[]>([]);
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 16, y: -1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

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

  const addMessage = useCallback((message: BNNMessage) => {
    setMessages((prev) => [...prev.slice(-30), message]);
  }, []);

  const handleTopicClick = (topic: (typeof BNN_TOPICS)[0]) => {
    addMessage({
      id: `${Date.now()}-info`,
      type: "info",
      message: topic.content,
      timestamp: Date.now(),
    });
  };

  const sendToBNN = useCallback(
    async (userMessage: string) => {
      if (isLoading) return;

      if (userMessage !== "initializing...") {
        addMessage({
          id: `${Date.now()}-user`,
          type: "user",
          message: userMessage,
          timestamp: Date.now(),
        });
      }

      setIsLoading(true);

      try {
        const response = await fetch("/api/eliza-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            character: "bnn",
            message: userMessage,
          }),
        });

        const data = await response.json();
        const messageText = data.response || "BREAKING: More news incoming...";

        addMessage({
          id: `${Date.now()}-bnn`,
          type: "bnn",
          message: messageText,
          timestamp: Date.now(),
          actions: data.actions || [],
        });
      } catch (error) {
        console.error("BNN chat error:", error);
        addMessage({
          id: `${Date.now()}-bnn`,
          type: "bnn",
          message: "TECHNICAL DIFFICULTIES: Broadcast interrupted. Try again.",
          timestamp: Date.now(),
        });
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, addMessage]
  );

  useEffect(() => {
    const handleBNNClick = () => {
      setIsOpen(true);
      if (messages.length === 0) {
        sendToBNN("initializing...");
      }
    };

    window.addEventListener("bagsworld-bnn-click", handleBNNClick);
    return () => {
      window.removeEventListener("bagsworld-bnn-click", handleBNNClick);
    };
  }, [messages.length, sendToBNN]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    sendToBNN(input.trim());
    setInput("");
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

  const chatStyle: React.CSSProperties =
    position.y >= 0
      ? { left: position.x, top: position.y, bottom: "auto" }
      : { left: position.x, bottom: 80 };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={chatRef}
      style={chatStyle}
      className={`fixed z-50 w-[calc(100vw-2rem)] sm:w-80 max-w-80 bg-bags-dark border-4 border-cyan-500 shadow-lg shadow-cyan-500/20 ${isDragging ? "cursor-grabbing" : ""}`}
    >
      <div
        onPointerDown={handlePointerDown}
        className="flex items-center justify-between p-2 border-b-4 border-cyan-500 cursor-grab active:cursor-grabbing select-none touch-none bg-gradient-to-r from-cyan-600/20 to-blue-600/20"
      >
        <div className="flex items-center gap-2">
          <span className="font-pixel text-sm">📰</span>
          <div>
            <p className="font-pixel text-[10px] text-cyan-400">BNN - BAGS NEWS</p>
            <p className="font-pixel text-[8px] text-gray-400">@BNNBags</p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="font-pixel text-xs text-gray-400 hover:text-white px-2"
        >
          [X]
        </button>
      </div>

      <div className="p-2 border-b border-cyan-500/30 bg-bags-darker">
        <p className="font-pixel text-[8px] text-gray-400 mb-2">News Topics:</p>
        <div className="flex flex-wrap gap-1">
          {BNN_TOPICS.map((topic, i) => (
            <button
              key={i}
              onClick={() => handleTopicClick(topic)}
              className="px-2 py-1 bg-cyan-500/10 border border-cyan-500/30 font-pixel text-[7px] text-cyan-300 hover:bg-cyan-500/20 hover:text-cyan-200 transition-colors"
            >
              {topic.icon} {topic.title}
            </button>
          ))}
        </div>
      </div>

      <div className="h-40 overflow-y-auto p-2 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center py-4">
            <p className="font-pixel text-[10px] text-cyan-400 mb-1">📰 broadcast live</p>
            <p className="font-pixel text-[8px] text-gray-400">
              BNN here. Breaking news incoming.
            </p>
            <p className="font-pixel text-[7px] text-gray-500 mt-2">
              Ask about news or click a topic above
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-2 border-l-2 ${
                msg.type === "bnn"
                  ? "bg-cyan-500/10 border-cyan-500"
                  : msg.type === "user"
                    ? "bg-bags-green/10 border-bags-green ml-4"
                    : "bg-blue-500/10 border-blue-500"
              }`}
            >
              {msg.type === "bnn" && (
                <p className="font-pixel text-[6px] text-cyan-400 mb-1">BNN:</p>
              )}
              {msg.type === "user" && (
                <p className="font-pixel text-[6px] text-bags-green mb-1">You:</p>
              )}
              {msg.type === "info" && (
                <p className="font-pixel text-[6px] text-blue-400 mb-1">📢 Bulletin:</p>
              )}
              <p className="font-pixel text-[8px] text-white whitespace-pre-wrap">{msg.message}</p>
              {msg.type === "bnn" && msg.actions && msg.actions.length > 0 && (
                <ActionButtons actions={msg.actions} onAction={handleAction} />
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="p-2 border-l-2 bg-cyan-500/10 border-cyan-500">
            <p className="font-pixel text-[8px] text-cyan-300 animate-pulse">
              receiving transmission...
            </p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-2 border-t border-cyan-500/30">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask BNN..."
            disabled={isLoading}
            className="flex-1 bg-bags-darker border border-cyan-500/30 px-2 py-1 font-pixel text-[8px] text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-2 py-1 bg-cyan-500 text-black font-pixel text-[8px] hover:bg-cyan-400 disabled:opacity-50 transition-colors"
          >
            Send
          </button>
        </form>
      </div>

      <div className="p-2 border-t border-cyan-500/30 bg-bags-darker">
        <div className="grid grid-cols-2 gap-2 text-center">
          <a
            href="https://x.com/BNNBags"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-cyan-500/10 p-1 rounded hover:bg-cyan-500/20 transition-colors"
          >
            <p className="font-pixel text-[6px] text-gray-400">X/Twitter</p>
            <p className="font-pixel text-[9px] text-cyan-400">@BNNBags</p>
          </a>
          <div className="bg-blue-500/10 p-1 rounded">
            <p className="font-pixel text-[6px] text-gray-400">Role</p>
            <p className="font-pixel text-[9px] text-blue-400">News Network</p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-2 mt-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
          <p className="font-pixel text-[7px] text-red-400">LIVE BROADCAST</p>
        </div>
      </div>
    </div>
  );
}
