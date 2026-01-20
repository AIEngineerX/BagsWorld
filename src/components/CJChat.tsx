"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useWorldState } from "@/hooks/useWorldState";
import { ActionButtons } from "@/components/ActionButtons";
import type { AIAction } from "@/app/api/agent-chat/route";

interface CJMessage {
  id: string;
  type: "cj" | "user";
  message: string;
  timestamp: number;
  actions?: AIAction[];
}

interface Position {
  x: number;
  y: number;
}

export function CJChat() {
  const [messages, setMessages] = useState<CJMessage[]>([]);
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

  const addMessage = useCallback((message: CJMessage) => {
    setMessages((prev) => [...prev.slice(-30), message]);
  }, []);

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
      const response = await fetch("/api/agent-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: "cj",
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
        id: `${Date.now()}-cj`,
        type: "cj",
        message: data.message || "aw shit, something went wrong homie",
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
  }, [isLoading, worldState, messages, addMessage]);

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

  const chatStyle: React.CSSProperties = position.x >= 0
    ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' }
    : { left: 80, top: 80 };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={chatRef}
      style={chatStyle}
      className={`fixed z-50 w-[calc(100vw-2rem)] sm:w-80 max-w-80 bg-black border-2 border-orange-500 shadow-lg shadow-orange-500/20 ${isDragging ? 'cursor-grabbing' : ''}`}
    >
      {/* Header - Draggable */}
      <div
        onMouseDown={handleMouseDown}
        className="flex items-center justify-between p-2 border-b border-orange-500/50 cursor-grab active:cursor-grabbing select-none bg-gradient-to-r from-orange-900/30 to-black"
      >
        <div className="flex items-center gap-2">
          <span className="text-orange-400 font-mono text-lg">🔫</span>
          <div>
            <p className="font-mono text-xs text-orange-400 tracking-wider">
              CJ // HOOD RAT
            </p>
            <p className="font-pixel text-[8px] text-orange-600">
              grove street 4 life
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="font-mono text-xs text-orange-600 hover:text-orange-400 px-2"
        >
          [X]
        </button>
      </div>

      {/* Messages */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-500/5 to-transparent pointer-events-none" />

        <div className="h-56 overflow-y-auto p-3 space-y-2 font-mono text-sm">
          {messages.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-orange-400 text-xs mb-2">
                BAGSCITY RESIDENT
              </p>
              <p className="text-orange-600 text-[10px]">
                keeping it real since day one...
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-2 ${
                  msg.type === "cj"
                    ? "text-orange-400 border-l-2 border-orange-500 pl-2"
                    : "text-white/80 text-right"
                }`}
              >
                {msg.type === "cj" && (
                  <p className="text-[8px] text-orange-600 mb-1">CJ:</p>
                )}
                {msg.type === "user" && (
                  <p className="text-[8px] text-white/50 mb-1">YOU:</p>
                )}
                <p className="text-xs leading-relaxed whitespace-pre-wrap">
                  {msg.message}
                </p>
                {msg.type === "cj" && msg.actions && msg.actions.length > 0 && (
                  <ActionButtons actions={msg.actions} onAction={handleAction} />
                )}
              </div>
            ))
          )}
          {isLoading && (
            <div className="text-orange-500 text-xs animate-pulse pl-2 border-l-2 border-orange-500">
              <p className="text-[8px] text-orange-600 mb-1">CJ:</p>
              thinking about it homie...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-2 border-t border-orange-500/30">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="talk to cj..."
            disabled={isLoading}
            className="flex-1 bg-orange-900/20 border border-orange-500/30 text-orange-400 font-mono text-xs px-2 py-1.5 placeholder:text-orange-700 focus:outline-none focus:border-orange-400"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-3 py-1.5 bg-orange-900/30 border border-orange-500/50 text-orange-400 font-mono text-xs hover:bg-orange-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            &gt;
          </button>
        </div>
      </form>

      {/* Footer */}
      <div className="p-2 border-t border-orange-500/20 bg-orange-900/10">
        <p className="font-mono text-[8px] text-orange-700 text-center">
          &quot;aw shit here we go again&quot;
        </p>
      </div>
    </div>
  );
}
