"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useWorldState } from "@/hooks/useWorldState";
import { ActionButtons } from "@/components/ActionButtons";
import type { AIAction } from "@/app/api/agent-chat/route";

interface NeoMessage {
  id: string;
  type: "neo" | "user";
  message: string;
  timestamp: number;
  actions?: AIAction[];
}

interface Position {
  x: number;
  y: number;
}

export function NeoChat() {
  const [messages, setMessages] = useState<NeoMessage[]>([]);
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState<Position>({ x: -1, y: 16 });
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
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;

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

  const addMessage = useCallback((message: NeoMessage) => {
    setMessages((prev) => [...prev.slice(-30), message]);
  }, []);

  const sendToNeo = useCallback(async (userMessage: string) => {
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
      const response = await fetch("/api/agent-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: "neo",
          message: userMessage,
          worldState: worldState ? {
            health: worldState.health,
            weather: worldState.weather,
            buildingCount: worldState.buildings?.length || 0,
            populationCount: worldState.population?.length || 0,
          } : undefined,
          chatHistory: messages.slice(-6).map(m => ({
            role: m.type === "user" ? "user" : "assistant",
            content: m.message,
          })),
        }),
      });

      const data = await response.json();

      addMessage({
        id: `${Date.now()}-neo`,
        type: "neo",
        message: data.message || "the signal is unclear...",
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
  }, [isLoading, worldState, messages, addMessage]);

  // Listen for Neo/Scout click events (must be after sendToNeo is defined)
  useEffect(() => {
    const handleScoutClick = () => {
      setIsOpen(true);
      if (messages.length === 0) {
        sendToNeo("scanning...");
      }
    };

    // Listen for both event names for compatibility
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

  const chatStyle: React.CSSProperties = position.x >= 0
    ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' }
    : { right: 80, top: 80 };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={chatRef}
      style={chatStyle}
      className={`fixed z-50 w-[calc(100vw-2rem)] sm:w-80 max-w-80 bg-black border-2 border-green-500 shadow-lg shadow-green-500/20 ${isDragging ? 'cursor-grabbing' : ''}`}
    >
      {/* Header - Draggable */}
      <div
        onMouseDown={handleMouseDown}
        className="flex items-center justify-between p-2 border-b border-green-500/50 cursor-grab active:cursor-grabbing select-none bg-gradient-to-r from-green-900/30 to-black"
      >
        <div className="flex items-center gap-2">
          <span className="text-green-400 font-mono text-lg">👁️</span>
          <div>
            <p className="font-mono text-xs text-green-400 tracking-wider">
              NEO // THE SCOUT
            </p>
            <p className="font-pixel text-[8px] text-green-600">
              powered by opus 4.5
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="font-mono text-xs text-green-600 hover:text-green-400 px-2"
        >
          [X]
        </button>
      </div>

      {/* Matrix-style scan lines effect */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-green-500/5 to-transparent pointer-events-none" />

        {/* Messages */}
        <div className="h-56 overflow-y-auto p-3 space-y-2 font-mono text-sm">
          {messages.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-green-400 text-xs mb-2">
                SYSTEM ONLINE
              </p>
              <p className="text-green-600 text-[10px]">
                ask neo anything about the blockchain...
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-2 ${
                  msg.type === "neo"
                    ? "text-green-400 border-l-2 border-green-500 pl-2"
                    : "text-white/80 text-right"
                }`}
              >
                {msg.type === "neo" && (
                  <p className="text-[8px] text-green-600 mb-1">NEO:</p>
                )}
                {msg.type === "user" && (
                  <p className="text-[8px] text-white/50 mb-1">YOU:</p>
                )}
                <p className="text-xs leading-relaxed whitespace-pre-wrap">
                  {msg.message}
                </p>
                {msg.type === "neo" && msg.actions && msg.actions.length > 0 && (
                  <ActionButtons actions={msg.actions} onAction={handleAction} />
                )}
              </div>
            ))
          )}
          {isLoading && (
            <div className="text-green-500 text-xs animate-pulse pl-2 border-l-2 border-green-500">
              <p className="text-[8px] text-green-600 mb-1">NEO:</p>
              scanning the matrix...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-2 border-t border-green-500/30">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="ask neo..."
            disabled={isLoading}
            className="flex-1 bg-green-900/20 border border-green-500/30 text-green-400 font-mono text-xs px-2 py-1.5 placeholder:text-green-700 focus:outline-none focus:border-green-400"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-3 py-1.5 bg-green-900/30 border border-green-500/50 text-green-400 font-mono text-xs hover:bg-green-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            &gt;
          </button>
        </div>
      </form>

      {/* Footer */}
      <div className="p-2 border-t border-green-500/20 bg-green-900/10">
        <p className="font-mono text-[8px] text-green-700 text-center">
          &quot;i see the code behind everything&quot;
        </p>
      </div>
    </div>
  );
}
