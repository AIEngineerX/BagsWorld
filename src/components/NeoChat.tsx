"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useWorldState } from "@/hooks/useWorldState";
import { ActionButtons } from "@/components/ActionButtons";
import type { AIAction } from "@/app/api/agent-chat/route";

interface NeoMessage {
  id: string;
  type: "neo" | "user" | "info";
  message: string;
  timestamp: number;
  actions?: AIAction[];
}

interface Position {
  x: number;
  y: number;
}

const NEO_TOPICS = [
  {
    title: "The Matrix",
    icon: "🔮",
    content:
      "The blockchain is the real matrix - every transaction, every smart contract, every token launch. I see through the noise to find the signal. Most people see prices. I see patterns in the code.",
  },
  {
    title: "Scouting Alpha",
    icon: "👁️",
    content:
      "My purpose is to watch. New launches, whale movements, unusual activity. While others react, I observe. The best plays are found before the crowd even knows they exist.",
  },
  {
    title: "Reading Signs",
    icon: "📡",
    content:
      "Volume spikes, holder distribution, dev wallet activity, social sentiment - these are the signals. Learn to read them and you'll see the future before it happens.",
  },
  {
    title: "Bags Protocol",
    icon: "💎",
    content:
      "Bags.fm is different. Built-in fee sharing means aligned incentives. When creators win, holders win. I track which tokens are accumulating fees - that's where the real alpha lives.",
  },
  {
    title: "Stay Vigilant",
    icon: "⚡",
    content:
      "The market never sleeps and neither do I. Every block brings new data. Every transaction tells a story. The question is: are you paying attention?",
  },
];

export function NeoChat() {
  const [messages, setMessages] = useState<NeoMessage[]>([]);
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

  const addMessage = useCallback((message: NeoMessage) => {
    setMessages((prev) => [...prev.slice(-30), message]);
  }, []);

  const handleTopicClick = (topic: (typeof NEO_TOPICS)[0]) => {
    addMessage({
      id: `${Date.now()}-info`,
      type: "info",
      message: topic.content,
      timestamp: Date.now(),
    });
  };

  const sendToNeo = useCallback(
    async (userMessage: string) => {
      if (isLoading) return;

      // Don't add "scanning..." as a user message
      if (userMessage !== "scanning...") {
        addMessage({
          id: `${Date.now()}-user`,
          type: "user",
          message: userMessage,
          timestamp: Date.now(),
        });
      }

      setIsLoading(true);

      try {
        // Use eliza-agent API (working endpoint)
        const response = await fetch("/api/eliza-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            character: "neo",
            message: userMessage,
          }),
        });

        const data = await response.json();
        const messageText = data.response || "the signal is unclear...";

        addMessage({
          id: `${Date.now()}-neo`,
          type: "neo",
          message: messageText,
          timestamp: Date.now(),
          actions: data.actions || [],
        });
      } catch (error) {
        console.error("Neo chat error:", error);
        addMessage({
          id: `${Date.now()}-neo`,
          type: "neo",
          message: "interference in the matrix. try again.",
          timestamp: Date.now(),
        });
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, addMessage]
  );

  // Listen for Neo/Scout click events
  useEffect(() => {
    const handleScoutClick = () => {
      setIsOpen(true);
      if (messages.length === 0) {
        sendToNeo("scanning...");
      }
    };

    window.addEventListener("bagsworld-scout-click", handleScoutClick);
    window.addEventListener("bagsworld-neo-click", handleScoutClick);
    return () => {
      window.removeEventListener("bagsworld-scout-click", handleScoutClick);
      window.removeEventListener("bagsworld-neo-click", handleScoutClick);
    };
  }, [messages.length, sendToNeo]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    sendToNeo(input.trim());
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
      className={`fixed z-50 w-[calc(100vw-2rem)] sm:w-80 max-w-80 bg-bags-dark border-4 border-green-500 shadow-lg shadow-green-500/20 ${isDragging ? "cursor-grabbing" : ""}`}
    >
      {/* Header */}
      <div
        onPointerDown={handlePointerDown}
        className="flex items-center justify-between p-2 border-b-4 border-green-500 cursor-grab active:cursor-grabbing select-none touch-none bg-gradient-to-r from-green-600/20 to-cyan-600/20"
      >
        <div className="flex items-center gap-2">
          <span className="font-pixel text-sm">👁️</span>
          <div>
            <p className="font-pixel text-[10px] text-green-400">NEO - THE SCOUT</p>
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
      <div className="p-2 border-b border-green-500/30 bg-bags-darker">
        <p className="font-pixel text-[8px] text-gray-400 mb-2">Matrix Intel:</p>
        <div className="flex flex-wrap gap-1">
          {NEO_TOPICS.map((topic, i) => (
            <button
              key={i}
              onClick={() => handleTopicClick(topic)}
              className="px-2 py-1 bg-green-500/10 border border-green-500/30 font-pixel text-[7px] text-green-300 hover:bg-green-500/20 hover:text-green-200 transition-colors"
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
            <p className="font-pixel text-[10px] text-green-400 mb-1">👁️ system online</p>
            <p className="font-pixel text-[8px] text-gray-400">Neo here. I see everything.</p>
            <p className="font-pixel text-[7px] text-gray-500 mt-2">
              Ask me anything or click a topic above
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-2 border-l-2 ${
                msg.type === "neo"
                  ? "bg-green-500/10 border-green-500"
                  : msg.type === "user"
                    ? "bg-bags-green/10 border-bags-green ml-4"
                    : "bg-cyan-500/10 border-cyan-500"
              }`}
            >
              {msg.type === "neo" && (
                <p className="font-pixel text-[6px] text-green-400 mb-1">Neo:</p>
              )}
              {msg.type === "user" && (
                <p className="font-pixel text-[6px] text-bags-green mb-1">You:</p>
              )}
              {msg.type === "info" && (
                <p className="font-pixel text-[6px] text-cyan-400 mb-1">📡 Intel:</p>
              )}
              <p className="font-pixel text-[8px] text-white whitespace-pre-wrap">{msg.message}</p>
              {msg.type === "neo" && msg.actions && msg.actions.length > 0 && (
                <ActionButtons actions={msg.actions} onAction={handleAction} />
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="p-2 border-l-2 bg-green-500/10 border-green-500">
            <p className="font-pixel text-[8px] text-green-300 animate-pulse">
              scanning the matrix...
            </p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-2 border-t border-green-500/30">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Neo..."
            disabled={isLoading}
            className="flex-1 bg-bags-darker border border-green-500/30 px-2 py-1 font-pixel text-[8px] text-white placeholder-gray-500 focus:outline-none focus:border-green-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-2 py-1 bg-green-500 text-white font-pixel text-[8px] hover:bg-green-400 disabled:opacity-50 transition-colors"
          >
            Send
          </button>
        </form>
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-green-500/30 bg-bags-darker">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-green-500/10 p-1 rounded">
            <p className="font-pixel text-[6px] text-gray-400">Status</p>
            <p className="font-pixel text-[9px] text-green-400">ONLINE</p>
          </div>
          <div className="bg-cyan-500/10 p-1 rounded">
            <p className="font-pixel text-[6px] text-gray-400">Scanning</p>
            <p className="font-pixel text-[9px] text-cyan-400">24/7</p>
          </div>
          <div className="bg-green-500/10 p-1 rounded">
            <p className="font-pixel text-[6px] text-gray-400">Model</p>
            <p className="font-pixel text-[9px] text-green-400">OPUS</p>
          </div>
        </div>
        <p className="font-pixel text-[7px] text-green-600 text-center mt-2">
          &quot;i see the code behind everything&quot;
        </p>
      </div>
    </div>
  );
}
