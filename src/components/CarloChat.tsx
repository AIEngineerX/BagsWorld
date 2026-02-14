"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ActionButtons } from "@/components/ActionButtons";
import type { AIAction } from "@/app/api/agent-chat/route";
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss";

interface CarloMessage {
  id: string;
  type: "carlo" | "user" | "info";
  message: string;
  timestamp: number;
  actions?: AIAction[];
}

interface Position {
  x: number;
  y: number;
}

const CARLO_TOPICS = [
  {
    title: "Community",
    icon: "🤝",
    content:
      "Community is everything. The vibes, the energy, the people who show up day after day. That's what makes Bags special. We're not just users, we're family.",
  },
  {
    title: "Events",
    icon: "🎉",
    content:
      "Spaces, AMAs, community calls - we do it all. The best alpha comes from conversations. Join the next event, meet the team, ask questions.",
  },
  {
    title: "Discord",
    icon: "💬",
    content:
      "The Discord is where the magic happens. Real-time support, alpha channels, community chat. If you're not in there, you're missing out.",
  },
  {
    title: "Memes",
    icon: "🎭",
    content:
      "Memes are the language of CT. Good memes spread organically. We don't just make them, we live them. The best communities meme together.",
  },
  {
    title: "Vibes",
    icon: "✨",
    content:
      "Can't fake good vibes. Either you have them or you don't. Bags community has them. Positive energy, helpful people, genuine connections.",
  },
];

export function CarloChat() {
  const [messages, setMessages] = useState<CarloMessage[]>([]);
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 16, y: -1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    translateY,
    isDismissing,
    handlers: swipeHandlers,
  } = useSwipeToDismiss(() => setIsOpen(false));

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

  const addMessage = useCallback((message: CarloMessage) => {
    setMessages((prev) => [...prev.slice(-30), message]);
  }, []);

  const handleTopicClick = (topic: (typeof CARLO_TOPICS)[0]) => {
    addMessage({
      id: `${Date.now()}-info`,
      type: "info",
      message: topic.content,
      timestamp: Date.now(),
    });
  };

  const sendToCarlo = useCallback(
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
            character: "carlo",
            message: userMessage,
          }),
        });

        const data = await response.json();
        const messageText = data.response || "vibes are immaculate, what's good?";

        addMessage({
          id: `${Date.now()}-carlo`,
          type: "carlo",
          message: messageText,
          timestamp: Date.now(),
          actions: data.actions || [],
        });
      } catch (error) {
        console.error("Carlo chat error:", error);
        addMessage({
          id: `${Date.now()}-carlo`,
          type: "carlo",
          message: "connection interrupted. try again fam.",
          timestamp: Date.now(),
        });
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, addMessage]
  );

  useEffect(() => {
    const handleCarloClick = () => {
      setIsOpen(true);
      if (messages.length === 0) {
        sendToCarlo("initializing...");
      }
    };

    window.addEventListener("bagsworld-carlo-click", handleCarloClick);
    return () => {
      window.removeEventListener("bagsworld-carlo-click", handleCarloClick);
    };
  }, [messages.length, sendToCarlo]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    sendToCarlo(input.trim());
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
      style={{
        ...chatStyle,
        transform: translateY > 0 ? `translateY(${translateY}px)` : undefined,
      }}
      className={`fixed z-50 w-[calc(100vw-3rem)] sm:w-80 max-w-80 bg-bags-dark border-4 border-orange-500 shadow-lg shadow-orange-500/20 chat-window-mobile ${isDragging ? "cursor-grabbing" : ""} ${isDismissing ? "modal-sheet-dismiss" : ""}`}
      {...swipeHandlers}
    >
      <div
        onPointerDown={handlePointerDown}
        className="flex items-center justify-between p-2 border-b-4 border-orange-500 cursor-grab active:cursor-grabbing select-none touch-none bg-gradient-to-r from-orange-600/20 to-red-600/20"
      >
        <div className="flex items-center gap-2">
          <span className="font-pixel text-sm">🤝</span>
          <div>
            <p className="font-pixel text-[10px] text-orange-400">CARLO // COMMUNITY</p>
            <p className="font-pixel text-[8px] text-orange-600">powered by ElizaOS</p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="font-pixel text-xs text-gray-400 hover:text-white px-2"
        >
          [X]
        </button>
      </div>

      <div className="p-2 border-b border-orange-500/30 bg-bags-darker">
        <p className="font-pixel text-[8px] text-gray-400 mb-2">Community Topics:</p>
        <div className="flex flex-wrap gap-1">
          {CARLO_TOPICS.map((topic, i) => (
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

      <div className="h-40 overflow-y-auto p-2 space-y-2 chat-messages">
        {messages.length === 0 ? (
          <div className="text-center py-4">
            <p className="font-pixel text-[10px] text-orange-400 mb-1">🤝 vibes check passed</p>
            <p className="font-pixel text-[8px] text-gray-400">
              Carlo here. Welcome to the community!
            </p>
            <p className="font-pixel text-[7px] text-gray-500 mt-2">
              Ask about community or click a topic above
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-2 border-l-2 ${
                msg.type === "carlo"
                  ? "bg-orange-500/10 border-orange-500"
                  : msg.type === "user"
                    ? "bg-bags-green/10 border-bags-green ml-4"
                    : "bg-red-500/10 border-red-500"
              }`}
            >
              {msg.type === "carlo" && (
                <p className="font-pixel text-[6px] text-orange-400 mb-1">Carlo:</p>
              )}
              {msg.type === "user" && (
                <p className="font-pixel text-[6px] text-bags-green mb-1">You:</p>
              )}
              {msg.type === "info" && (
                <p className="font-pixel text-[6px] text-red-400 mb-1">🎉 Community:</p>
              )}
              <p className="font-pixel text-[8px] text-white whitespace-pre-wrap">{msg.message}</p>
              {msg.type === "carlo" && msg.actions && msg.actions.length > 0 && (
                <ActionButtons actions={msg.actions} onAction={handleAction} />
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="p-2 border-l-2 bg-orange-500/10 border-orange-500">
            <p className="font-pixel text-[8px] text-orange-300 animate-pulse">
              spreading vibes...
            </p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-2 border-t border-orange-500/30">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Carlo..."
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

      <div className="p-2 border-t border-orange-500/30 bg-bags-darker">
        <div className="grid grid-cols-2 gap-2 text-center">
          <a
            href="https://x.com/carlobags"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-orange-500/10 p-1 rounded hover:bg-orange-500/20 transition-colors"
          >
            <p className="font-pixel text-[6px] text-gray-400">X/Twitter</p>
            <p className="font-pixel text-[9px] text-orange-400">@carlobags</p>
          </a>
          <div className="bg-red-500/10 p-1 rounded">
            <p className="font-pixel text-[6px] text-gray-400">Role</p>
            <p className="font-pixel text-[9px] text-red-400">Community Ambassador</p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-2 mt-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          <p className="font-pixel text-[7px] text-green-400">Bags.fm Academy</p>
        </div>
      </div>
    </div>
  );
}
