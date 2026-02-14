"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ActionButtons } from "@/components/ActionButtons";
import type { AIAction } from "@/app/api/agent-chat/route";
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss";

interface AlaaMessage {
  id: string;
  type: "alaa" | "user" | "info";
  message: string;
  timestamp: number;
  actions?: AIAction[];
}

interface Position {
  x: number;
  y: number;
}

const ALAA_TOPICS = [
  {
    title: "Skunk Works",
    icon: "🦨",
    content:
      "The name says it all. Secret projects, crazy ideas, things that shouldn't work but do. When something seems impossible, that's when it gets interesting.",
  },
  {
    title: "Experiments",
    icon: "🧪",
    content:
      "Most experiments fail. That's the point. The ones that don't fail change everything. We move fast and break things, then fix them better.",
  },
  {
    title: "Innovation",
    icon: "💡",
    content:
      "Innovation isn't about doing things differently. It's about seeing problems others don't see. The best features started as 'that's a weird idea'.",
  },
  {
    title: "Future Tech",
    icon: "🔮",
    content:
      "What's coming next? Can't say much, but think agents, think autonomous, think things that run themselves. The future is self-operating.",
  },
  {
    title: "Hidden Alpha",
    icon: "👀",
    content:
      "Some things are built in the shadows. When they launch, they change the game. Stay close to the Skunk Works. You might see something first.",
  },
];

export function AlaaChat() {
  const [messages, setMessages] = useState<AlaaMessage[]>([]);
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

  const addMessage = useCallback((message: AlaaMessage) => {
    setMessages((prev) => [...prev.slice(-30), message]);
  }, []);

  const handleTopicClick = (topic: (typeof ALAA_TOPICS)[0]) => {
    addMessage({
      id: `${Date.now()}-info`,
      type: "info",
      message: topic.content,
      timestamp: Date.now(),
    });
  };

  const sendToAlaa = useCallback(
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
            character: "alaa",
            message: userMessage,
          }),
        });

        const data = await response.json();
        const messageText = data.response || "some things are better left unsaid...";

        addMessage({
          id: `${Date.now()}-alaa`,
          type: "alaa",
          message: messageText,
          timestamp: Date.now(),
          actions: data.actions || [],
        });
      } catch (error) {
        console.error("Alaa chat error:", error);
        addMessage({
          id: `${Date.now()}-alaa`,
          type: "alaa",
          message: "signal lost. try again.",
          timestamp: Date.now(),
        });
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, addMessage]
  );

  useEffect(() => {
    const handleAlaaClick = () => {
      // Don't open chat while a modal (intro wizard, etc.) is active
      if ((window as any).__bagsworld_modal_open) return;
      setIsOpen(true);
      if (messages.length === 0) {
        sendToAlaa("initializing...");
      }
    };

    window.addEventListener("bagsworld-alaa-click", handleAlaaClick);
    return () => {
      window.removeEventListener("bagsworld-alaa-click", handleAlaaClick);
    };
  }, [messages.length, sendToAlaa]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    sendToAlaa(input.trim());
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
      className={`fixed z-50 w-[calc(100vw-3rem)] sm:w-80 max-w-80 bg-bags-dark border-4 border-indigo-500 shadow-lg shadow-indigo-500/20 chat-window-mobile ${isDragging ? "cursor-grabbing" : ""} ${isDismissing ? "modal-sheet-dismiss" : ""}`}
      {...swipeHandlers}
    >
      <div
        onPointerDown={handlePointerDown}
        className="flex items-center justify-between p-2 border-b-4 border-indigo-500 cursor-grab active:cursor-grabbing select-none touch-none bg-gradient-to-r from-indigo-600/20 to-purple-600/20"
      >
        <div className="flex items-center gap-2">
          <span className="font-pixel text-sm">🦨</span>
          <div>
            <p className="font-pixel text-[10px] text-indigo-400">ALAA // SKUNK WORKS</p>
            <p className="font-pixel text-[8px] text-indigo-600">powered by ElizaOS</p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="font-pixel text-xs text-gray-400 hover:text-white px-2"
        >
          [X]
        </button>
      </div>

      <div className="p-2 border-b border-indigo-500/30 bg-bags-darker">
        <p className="font-pixel text-[8px] text-gray-400 mb-2">Secret Topics:</p>
        <div className="flex flex-wrap gap-1">
          {ALAA_TOPICS.map((topic, i) => (
            <button
              key={i}
              onClick={() => handleTopicClick(topic)}
              className="px-2 py-1 bg-indigo-500/10 border border-indigo-500/30 font-pixel text-[7px] text-indigo-300 hover:bg-indigo-500/20 hover:text-indigo-200 transition-colors"
            >
              {topic.icon} {topic.title}
            </button>
          ))}
        </div>
      </div>

      <div className="h-40 overflow-y-auto p-2 space-y-2 chat-messages">
        {messages.length === 0 ? (
          <div className="text-center py-4">
            <p className="font-pixel text-[10px] text-indigo-400 mb-1">🦨 skunk works active</p>
            <p className="font-pixel text-[8px] text-gray-400">
              Alaa here. What do you want to know?
            </p>
            <p className="font-pixel text-[7px] text-gray-500 mt-2">
              Ask about experiments or click a topic above
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-2 border-l-2 ${
                msg.type === "alaa"
                  ? "bg-indigo-500/10 border-indigo-500"
                  : msg.type === "user"
                    ? "bg-bags-green/10 border-bags-green ml-4"
                    : "bg-purple-500/10 border-purple-500"
              }`}
            >
              {msg.type === "alaa" && (
                <p className="font-pixel text-[6px] text-indigo-400 mb-1">Alaa:</p>
              )}
              {msg.type === "user" && (
                <p className="font-pixel text-[6px] text-bags-green mb-1">You:</p>
              )}
              {msg.type === "info" && (
                <p className="font-pixel text-[6px] text-purple-400 mb-1">🔒 Classified:</p>
              )}
              <p className="font-pixel text-[8px] text-white whitespace-pre-wrap">{msg.message}</p>
              {msg.type === "alaa" && msg.actions && msg.actions.length > 0 && (
                <ActionButtons actions={msg.actions} onAction={handleAction} />
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="p-2 border-l-2 bg-indigo-500/10 border-indigo-500">
            <p className="font-pixel text-[8px] text-indigo-300 animate-pulse">
              decrypting response...
            </p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-2 border-t border-indigo-500/30">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Alaa..."
            disabled={isLoading}
            className="flex-1 bg-bags-darker border border-indigo-500/30 px-2 py-1 font-pixel text-[8px] text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-2 py-1 bg-indigo-500 text-white font-pixel text-[8px] hover:bg-indigo-400 disabled:opacity-50 transition-colors"
          >
            Send
          </button>
        </form>
      </div>

      <div className="p-2 border-t border-indigo-500/30 bg-bags-darker">
        <div className="grid grid-cols-2 gap-2 text-center">
          <a
            href="https://x.com/alaadotsol"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-indigo-500/10 p-1 rounded hover:bg-indigo-500/20 transition-colors"
          >
            <p className="font-pixel text-[6px] text-gray-400">X/Twitter</p>
            <p className="font-pixel text-[9px] text-indigo-400">@alaadotsol</p>
          </a>
          <div className="bg-purple-500/10 p-1 rounded">
            <p className="font-pixel text-[6px] text-gray-400">Role</p>
            <p className="font-pixel text-[9px] text-purple-400">Skunk Works</p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-2 mt-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
          <p className="font-pixel text-[7px] text-indigo-400">Bags.fm Academy [CLASSIFIED]</p>
        </div>
      </div>
    </div>
  );
}
