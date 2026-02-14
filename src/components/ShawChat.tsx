"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useWorldState } from "@/hooks/useWorldState";
import { ActionButtons } from "@/components/ActionButtons";
import type { AIAction } from "@/app/api/agent-chat/route";
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss";

interface ShawMessage {
  id: string;
  type: "shaw" | "user" | "info";
  message: string;
  timestamp: number;
  actions?: AIAction[];
}

interface Position {
  x: number;
  y: number;
}

const SHAW_TOPICS = [
  {
    title: "ElizaOS",
    icon: "🔶",
    content:
      "ElizaOS is a framework for building autonomous AI agents. Character files define their personality, plugins give them capabilities. 17k stars on GitHub - the community is incredible.",
  },
  {
    title: "Character Files",
    icon: "📄",
    content:
      "Character files are the DNA of an agent. Bio, lore, message examples, style - it all shapes how they think and respond. Like giving an AI a soul.",
  },
  {
    title: "Plugin System",
    icon: "🔌",
    content:
      "Plugins extend what agents can do. Twitter, Discord, Solana, Telegram - each plugin adds new capabilities. The architecture is designed for infinite extensibility.",
  },
  {
    title: "ai16z",
    icon: "🤖",
    content:
      "ai16z is where AI meets crypto. Agents that can own wallets, make trades, participate in economies. The future is agents with agency.",
  },
  {
    title: "Multi-Agent",
    icon: "🌐",
    content:
      "Multi-agent is the future. Agents can share memories, coordinate actions, build on each other. We're building digital societies.",
  },
];

export function ShawChat() {
  const [messages, setMessages] = useState<ShawMessage[]>([]);
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
  const {
    translateY,
    isDismissing,
    handlers: swipeHandlers,
  } = useSwipeToDismiss(() => setIsOpen(false));

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

  // Handle dragging - use pointer events for touch + mouse support
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

  const addMessage = useCallback((message: ShawMessage) => {
    setMessages((prev) => [...prev.slice(-30), message]);
  }, []);

  const handleTopicClick = (topic: (typeof SHAW_TOPICS)[0]) => {
    addMessage({
      id: `${Date.now()}-info`,
      type: "info",
      message: topic.content,
      timestamp: Date.now(),
    });
  };

  const sendToShaw = useCallback(
    async (userMessage: string) => {
      if (isLoading) return;

      // Don't add "initializing..." as a user message
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
        // Use eliza-agent API (working endpoint)
        const response = await fetch("/api/eliza-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            character: "shaw",
            message: userMessage,
          }),
        });

        const data = await response.json();
        const messageText = data.response || "the framework awaits your input...";

        addMessage({
          id: `${Date.now()}-shaw`,
          type: "shaw",
          message: messageText,
          timestamp: Date.now(),
          actions: data.actions || [],
        });
      } catch (error) {
        console.error("Shaw chat error:", error);
        addMessage({
          id: `${Date.now()}-shaw`,
          type: "shaw",
          message: "connection interrupted. try again.",
          timestamp: Date.now(),
        });
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, addMessage]
  );

  // Listen for Shaw click events
  useEffect(() => {
    const handleShawClick = () => {
      setIsOpen(true);
      if (messages.length === 0) {
        sendToShaw("initializing...");
      }
    };

    window.addEventListener("bagsworld-shaw-click", handleShawClick);
    return () => {
      window.removeEventListener("bagsworld-shaw-click", handleShawClick);
    };
  }, [messages.length, sendToShaw]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    sendToShaw(input.trim());
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
      style={{
        ...chatStyle,
        transform: translateY > 0 ? `translateY(${translateY}px)` : undefined,
      }}
      className={`fixed z-50 w-[calc(100vw-3rem)] sm:w-80 max-w-80 bg-bags-dark border-4 border-orange-500 shadow-lg shadow-orange-500/20 chat-window-mobile ${isDragging ? "cursor-grabbing" : ""} ${isDismissing ? "modal-sheet-dismiss" : ""}`}
      {...swipeHandlers}
    >
      {/* Header - Draggable (touch + mouse) */}
      <div
        onPointerDown={handlePointerDown}
        className="flex items-center justify-between p-2 border-b-4 border-orange-500 cursor-grab active:cursor-grabbing select-none touch-none bg-gradient-to-r from-orange-600/20 to-amber-600/20"
      >
        <div className="flex items-center gap-2">
          <span className="font-pixel text-sm">🔶</span>
          <div>
            <p className="font-pixel text-[10px] text-orange-400">SHAW - ELIZAOS CREATOR</p>
            <p className="font-pixel text-[8px] text-gray-400">@shawmakesmagic</p>
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
        <p className="font-pixel text-[8px] text-gray-400 mb-2">Framework Topics:</p>
        <div className="flex flex-wrap gap-1">
          {SHAW_TOPICS.map((topic, i) => (
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
      <div className="h-40 overflow-y-auto p-2 space-y-2 chat-messages">
        {messages.length === 0 ? (
          <div className="text-center py-4">
            <p className="font-pixel text-[10px] text-orange-400 mb-1">🔶 framework online</p>
            <p className="font-pixel text-[8px] text-gray-400">
              Shaw here. Let&apos;s build something.
            </p>
            <p className="font-pixel text-[7px] text-gray-500 mt-2">
              Ask me about ElizaOS or click a topic above
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-2 border-l-2 ${
                msg.type === "shaw"
                  ? "bg-orange-500/10 border-orange-500"
                  : msg.type === "user"
                    ? "bg-bags-green/10 border-bags-green ml-4"
                    : "bg-amber-500/10 border-amber-500"
              }`}
            >
              {msg.type === "shaw" && (
                <p className="font-pixel text-[6px] text-orange-400 mb-1">Shaw:</p>
              )}
              {msg.type === "user" && (
                <p className="font-pixel text-[6px] text-bags-green mb-1">You:</p>
              )}
              {msg.type === "info" && (
                <p className="font-pixel text-[6px] text-amber-400 mb-1">📄 Docs:</p>
              )}
              <p className="font-pixel text-[8px] text-white whitespace-pre-wrap">{msg.message}</p>
              {msg.type === "shaw" && msg.actions && msg.actions.length > 0 && (
                <ActionButtons actions={msg.actions} onAction={handleAction} />
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="p-2 border-l-2 bg-orange-500/10 border-orange-500">
            <p className="font-pixel text-[8px] text-orange-300 animate-pulse">
              compiling response...
            </p>
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
            placeholder="Ask Shaw..."
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
          <a
            href="https://github.com/elizaOS/eliza"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-orange-500/10 p-1 rounded hover:bg-orange-500/20 transition-colors"
          >
            <p className="font-pixel text-[6px] text-gray-400">ElizaOS Stars</p>
            <p className="font-pixel text-[9px] text-orange-400">17K+</p>
          </a>
          <a
            href="https://x.com/shawmakesmagic"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-amber-500/10 p-1 rounded hover:bg-amber-500/20 transition-colors"
          >
            <p className="font-pixel text-[6px] text-gray-400">X/Twitter</p>
            <p className="font-pixel text-[9px] text-amber-400">@shaw</p>
          </a>
          <a
            href="https://elizaos.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-orange-500/10 p-1 rounded hover:bg-orange-500/20 transition-colors"
          >
            <p className="font-pixel text-[6px] text-gray-400">Website</p>
            <p className="font-pixel text-[9px] text-orange-400">elizaos.ai</p>
          </a>
        </div>
        <div className="flex items-center justify-center gap-2 mt-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          <p className="font-pixel text-[7px] text-green-400">powered by TRUE ElizaOS runtime</p>
        </div>
      </div>
    </div>
  );
}
