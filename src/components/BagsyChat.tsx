"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ActionButtons } from "@/components/ActionButtons";
import type { AIAction } from "@/app/api/agent-chat/route";
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss";

interface BagsyMessage {
  id: string;
  type: "bagsy" | "user" | "info";
  message: string;
  timestamp: number;
  actions?: AIAction[];
}

interface Position {
  x: number;
  y: number;
}

const BAGSY_TOPICS = [
  {
    title: "How to Claim",
    icon: "📋",
    content:
      "claiming is ez fren! go to bags.fm/claim, connect ur wallet, and click claim. thats it! ur SOL is waiting for u :)",
  },
  {
    title: "Why Claim",
    icon: "❓",
    content:
      "those fees are UR money! every time someone trades ur token, u earn 1%. but u gotta claim it or its just... sitting there. makes me sad tbh",
  },
  {
    title: "bags.fm/claim",
    icon: "🔗",
    content:
      "this is the magic link: bags.fm/claim\n\nbookmark it. visit it daily. claim ur fees. become happy. its that simple fren",
  },
  {
    title: "Fee FAQs",
    icon: "📚",
    content:
      "Q: how much do i earn?\nA: 1% of every trade, forever\n\nQ: when can i claim?\nA: anytime! no lockup\n\nQ: is there a minimum?\nA: nope! claim any amount",
  },
  {
    title: "What are Fees",
    icon: "💰",
    content:
      "when u launch on @BagsFM, u get 1% of every single trade. FOREVER. not just at launch - forever. this is why bags is different. creators actually eating here",
  },
];

export function BagsyChat() {
  const [messages, setMessages] = useState<BagsyMessage[]>([]);
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState<Position>({ x: -1, y: -1 });
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

  const addMessage = useCallback((message: BagsyMessage) => {
    setMessages((prev) => [...prev.slice(-30), message]);
  }, []);

  const handleTopicClick = (topic: (typeof BAGSY_TOPICS)[0]) => {
    addMessage({
      id: `${Date.now()}-info`,
      type: "info",
      message: topic.content,
      timestamp: Date.now(),
    });
  };

  const sendToBagsy = useCallback(
    async (userMessage: string) => {
      if (isLoading) return;

      // Don't add greeting as a user message
      if (userMessage !== "gm!") {
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
            character: "bagsy",
            message: userMessage,
          }),
        });

        const data = await response.json();
        const messageText = data.response || "hmm something went wrong fren, try again? :)";

        addMessage({
          id: `${Date.now()}-bagsy`,
          type: "bagsy",
          message: messageText,
          timestamp: Date.now(),
          actions: data.actions || [],
        });
      } catch (error) {
        console.error("Bagsy chat error:", error);
        addMessage({
          id: `${Date.now()}-bagsy`,
          type: "bagsy",
          message: "oops something went wrong fren! maybe try again? :)",
          timestamp: Date.now(),
        });
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, addMessage]
  );

  // Listen for Bagsy click events
  useEffect(() => {
    const handleBagsyClick = () => {
      // Don't open chat while a modal (intro wizard, etc.) is active
      if ((window as any).__bagsworld_modal_open) return;
      setIsOpen(true);
      if (messages.length === 0) {
        sendToBagsy("gm!");
      }
    };

    window.addEventListener("bagsworld-bagsy-click", handleBagsyClick);
    return () => {
      window.removeEventListener("bagsworld-bagsy-click", handleBagsyClick);
    };
  }, [messages.length, sendToBagsy]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    sendToBagsy(input.trim());
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
    position.x >= 0 && position.y >= 0
      ? { left: position.x, top: position.y, bottom: "auto", right: "auto" }
      : { right: 16, bottom: 80 };

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
      className={`fixed z-50 w-[calc(100vw-3rem)] sm:w-80 max-w-80 bg-bags-dark border-4 border-bags-green shadow-lg shadow-bags-green/20 chat-window-mobile ${isDragging ? "cursor-grabbing" : ""} ${isDismissing ? "modal-sheet-dismiss" : ""}`}
      {...swipeHandlers}
    >
      {/* Header */}
      <div
        onPointerDown={handlePointerDown}
        className="flex items-center justify-between p-2 border-b-4 border-bags-green cursor-grab active:cursor-grabbing select-none touch-none bg-gradient-to-r from-bags-green/20 to-lime-600/20"
      >
        <div className="flex items-center gap-2">
          <span className="font-pixel text-sm">💰</span>
          <div>
            <p className="font-pixel text-[10px] text-bags-green">BAGSY // HYPE BOT</p>
            <p className="font-pixel text-[8px] text-green-600">powered by ElizaOS</p>
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
      <div className="p-2 border-b border-bags-green/30 bg-bags-darker">
        <p className="font-pixel text-[8px] text-gray-400 mb-2">Fee Help:</p>
        <div className="flex flex-wrap gap-1">
          {BAGSY_TOPICS.map((topic, i) => (
            <button
              key={i}
              onClick={() => handleTopicClick(topic)}
              className="px-2 py-1 bg-bags-green/10 border border-bags-green/30 font-pixel text-[7px] text-green-300 hover:bg-bags-green/20 hover:text-green-200 transition-colors"
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
            <p className="font-pixel text-[10px] text-bags-green mb-1">💰 gm fren!</p>
            <p className="font-pixel text-[8px] text-gray-400">
              im bagsy, ur fee claiming assistant :)
            </p>
            <p className="font-pixel text-[7px] text-gray-500 mt-2">
              ask me about fees or click a topic above!
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-2 border-l-2 ${
                msg.type === "bagsy"
                  ? "bg-bags-green/10 border-bags-green"
                  : msg.type === "user"
                    ? "bg-lime-500/10 border-lime-500 ml-4"
                    : "bg-emerald-500/10 border-emerald-500"
              }`}
            >
              {msg.type === "bagsy" && (
                <p className="font-pixel text-[6px] text-bags-green mb-1">Bagsy:</p>
              )}
              {msg.type === "user" && (
                <p className="font-pixel text-[6px] text-lime-400 mb-1">You:</p>
              )}
              {msg.type === "info" && (
                <p className="font-pixel text-[6px] text-emerald-400 mb-1">💡 Info:</p>
              )}
              <p className="font-pixel text-[8px] text-white whitespace-pre-wrap">{msg.message}</p>
              {msg.type === "bagsy" && msg.actions && msg.actions.length > 0 && (
                <ActionButtons actions={msg.actions} onAction={handleAction} />
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="p-2 border-l-2 bg-bags-green/10 border-bags-green">
            <p className="font-pixel text-[8px] text-green-300 animate-pulse">
              thinking about fees...
            </p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-2 border-t border-bags-green/30">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Bagsy..."
            disabled={isLoading}
            className="flex-1 bg-bags-darker border border-bags-green/30 px-2 py-1 font-pixel text-[8px] text-white placeholder-gray-500 focus:outline-none focus:border-bags-green disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-2 py-1 bg-bags-green text-white font-pixel text-[8px] hover:bg-green-400 disabled:opacity-50 transition-colors"
          >
            Send
          </button>
        </form>
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-bags-green/30 bg-bags-darker">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-bags-green/10 p-1 rounded">
            <p className="font-pixel text-[6px] text-gray-400">Mood</p>
            <p className="font-pixel text-[9px] text-bags-green">BULLISH</p>
          </div>
          <div className="bg-lime-500/10 p-1 rounded">
            <p className="font-pixel text-[6px] text-gray-400">Mission</p>
            <p className="font-pixel text-[9px] text-lime-400">CLAIM</p>
          </div>
          <div className="bg-bags-green/10 p-1 rounded">
            <p className="font-pixel text-[6px] text-gray-400">Vibe</p>
            <p className="font-pixel text-[9px] text-bags-green">COZY</p>
          </div>
        </div>
        <p className="font-pixel text-[7px] text-green-600 text-center mt-2">
          &quot;pls claim ur fees fren :)&quot;
        </p>
      </div>
    </div>
  );
}
