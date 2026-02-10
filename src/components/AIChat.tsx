"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useGameStore } from "@/lib/store";
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss";

interface ChatMessage {
  id: string;
  sender: "bot" | "user";
  message: string;
  timestamp: number;
}

interface Position {
  x: number;
  y: number;
}

export function AIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 16, y: -1 }); // -1 means use bottom positioning
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const { worldState } = useGameStore();
  const {
    translateY,
    isDismissing,
    handlers: swipeHandlers,
  } = useSwipeToDismiss(() => setIsMinimized(true));

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle dragging - use pointer events for touch + mouse support
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, input")) return;

    const rect = chatRef.current?.getBoundingClientRect();
    if (rect) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      // Capture pointer for reliable tracking
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    }
  }, []);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDragging) return;

      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      // Keep within viewport bounds with safe area consideration
      const chatWidth = Math.min(320, window.innerWidth - 32);
      const maxX = window.innerWidth - chatWidth;
      const maxY = window.innerHeight - 300;

      setPosition({
        x: Math.max(8, Math.min(newX, maxX - 8)),
        y: Math.max(60, Math.min(newY, maxY)),
      });
    },
    [isDragging, dragOffset]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
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
  }, [isDragging, handlePointerMove, handlePointerUp]);

  const addMessage = (message: ChatMessage) => {
    setMessages((prev) => [...prev.slice(-50), message]); // Keep last 50 messages
  };

  // Handle bot actions from response
  const handleBotActions = (actions: Array<{ type: string; data: Record<string, unknown> }>) => {
    actions.forEach((action) => {
      switch (action.type) {
        case "animal":
          // Dispatch animal control event to WorldScene
          window.dispatchEvent(
            new CustomEvent("bagsworld-bot-animal", {
              detail: action.data,
            })
          );
          break;
        case "effect":
          // Dispatch effect event to WorldScene
          window.dispatchEvent(
            new CustomEvent("bagsworld-bot-effect", {
              detail: action.data,
            })
          );
          break;
        case "pokemon":
          // Dispatch pokemon control event to WorldScene (Founders zone)
          window.dispatchEvent(
            new CustomEvent("bagsworld-bot-pokemon", {
              detail: action.data,
            })
          );
          break;
        case "announce":
          // Could show announcement in UI or dispatch to game
          console.log("Announcement:", action.data);
          break;
      }
    });
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    setIsLoading(true);

    // Add user message
    addMessage({
      id: `${Date.now()}-user`,
      sender: "user",
      message: userMessage,
      timestamp: Date.now(),
    });

    try {
      // Call eliza-agent API (working endpoint)
      const response = await fetch("/api/eliza-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character: "bags-bot",
          message: userMessage,
        }),
      });

      if (!response.ok) throw new Error("Bot request failed");

      const data = await response.json();

      // Add bot response
      addMessage({
        id: `${Date.now()}-bot`,
        sender: "bot",
        message: data.response || "...",
        timestamp: Date.now(),
      });

      // Handle any actions from the bot
      if (data.actions && data.actions.length > 0) {
        handleBotActions(data.actions);
      }
    } catch (error) {
      console.error("Chat error:", error);
      addMessage({
        id: `${Date.now()}-bot`,
        sender: "bot",
        message: "oops, something went wrong. try again!",
        timestamp: Date.now(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Quick action handlers
  const handleQuickAction = (action: string) => {
    setInputValue(action);
    // Auto-send the message
    setTimeout(() => {
      const input = document.getElementById("bot-input") as HTMLInputElement;
      if (input) {
        input.form?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
      }
    }, 100);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const chatStyle: React.CSSProperties =
    position.y >= 0
      ? { left: position.x, top: position.y, bottom: "auto" }
      : { left: position.x, bottom: 80 };

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        style={{
          left: position.x,
          bottom: position.y >= 0 ? "auto" : 80,
          top: position.y >= 0 ? position.y : "auto",
        }}
        className="fixed z-50 btn-retro flex items-center gap-2 chat-minimized-mobile"
      >
        <span className="font-pixel text-[8px]">Bot</span>
        {messages.length > 0 && (
          <span className="w-2 h-2 bg-bags-gold rounded-full animate-pulse" />
        )}
      </button>
    );
  }

  return (
    <div
      ref={chatRef}
      style={{
        ...chatStyle,
        transform: translateY > 0 ? `translateY(${translateY}px)` : undefined,
      }}
      className={`fixed z-50 w-[calc(100vw-2rem)] sm:w-80 max-w-80 bg-bags-dark border-4 border-bags-green shadow-lg chat-window-mobile ${isDragging ? "cursor-grabbing" : ""} ${isDismissing ? "modal-sheet-dismiss" : ""}`}
      {...swipeHandlers}
    >
      {/* Header - Draggable (touch + mouse) */}
      <div
        onPointerDown={handlePointerDown}
        className="flex items-center justify-between p-2 border-b-4 border-bags-green cursor-grab active:cursor-grabbing select-none touch-none"
      >
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="font-pixel text-[10px] text-gray-400 hover:text-white"
              title="Clear chat"
            >
              &lt;
            </button>
          )}
          <div>
            <p className="font-pixel text-[10px] text-bags-green">BAGS BOT // WORLD GUIDE</p>
            <p className="font-pixel text-[8px] text-bags-green/60">powered by ElizaOS</p>
          </div>
        </div>
        <button
          onClick={() => setIsMinimized(true)}
          className="font-pixel text-xs text-gray-400 hover:text-white px-2"
        >
          [_]
        </button>
      </div>

      {/* Messages */}
      <div className="h-48 overflow-y-auto p-2 space-y-2 chat-messages">
        {messages.length === 0 ? (
          <div className="text-center py-2">
            <p className="font-pixel text-[10px] text-bags-gold mb-2">BagsWorld Bot</p>
            <p className="font-pixel text-[9px] sm:text-[7px] text-gray-400 mb-3">
              i can control animals, trigger effects, and answer questions!
            </p>

            {/* Quick Actions - Animals & Pokemon */}
            <div className="flex flex-wrap justify-center gap-1 mb-2">
              <button
                onClick={() => handleQuickAction("pet the dog")}
                className="px-2 py-1 bg-bags-darker border border-bags-green/30 font-pixel text-[9px] sm:text-[7px] text-bags-green hover:bg-bags-green/20"
              >
                🐕 pet dog
              </button>
              <button
                onClick={() => handleQuickAction("call the cat")}
                className="px-2 py-1 bg-bags-darker border border-bags-green/30 font-pixel text-[9px] sm:text-[7px] text-bags-green hover:bg-bags-green/20"
              >
                🐱 call cat
              </button>
              <button
                onClick={() => handleQuickAction("play with charmander")}
                className="px-2 py-1 bg-bags-darker border border-orange-500/30 font-pixel text-[9px] sm:text-[7px] text-orange-400 hover:bg-orange-500/20"
                title="Visit Founders zone!"
              >
                🔥 charmander
              </button>
            </div>

            {/* Quick Actions - Effects */}
            <div className="flex flex-wrap justify-center gap-1 mb-2">
              <button
                onClick={() => handleQuickAction("fireworks")}
                className="px-2 py-1 bg-bags-darker border border-purple-500/30 font-pixel text-[9px] sm:text-[7px] text-purple-400 hover:bg-purple-500/20"
              >
                🎆 fireworks
              </button>
              <button
                onClick={() => handleQuickAction("make it rain")}
                className="px-2 py-1 bg-bags-darker border border-yellow-500/30 font-pixel text-[9px] sm:text-[7px] text-yellow-400 hover:bg-yellow-500/20"
              >
                💰 coins
              </button>
              <button
                onClick={() => handleQuickAction("confetti")}
                className="px-2 py-1 bg-bags-darker border border-pink-500/30 font-pixel text-[9px] sm:text-[7px] text-pink-400 hover:bg-pink-500/20"
              >
                🎊 confetti
              </button>
            </div>

            <p className="font-pixel text-[8px] sm:text-[6px] text-gray-500">
              try &quot;help&quot; for more commands
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-2 border-l-2 ${
                msg.sender === "user"
                  ? "bg-bags-green/20 border-bags-green ml-4"
                  : "bg-white/5 border-gray-600"
              }`}
            >
              {msg.sender === "user" && (
                <p className="font-pixel text-[6px] text-bags-green mb-1">You:</p>
              )}
              {msg.sender === "bot" && (
                <p className="font-pixel text-[6px] text-bags-gold mb-1">Bot:</p>
              )}
              <p className="font-pixel text-[10px] sm:text-[8px] text-white whitespace-pre-wrap">
                {msg.message}
              </p>
            </div>
          ))
        )}
        {isLoading && (
          <div className="p-2 border-l-2 bg-white/5 border-gray-600">
            <p className="font-pixel text-[6px] text-bags-gold mb-1">Bot:</p>
            <p className="font-pixel text-[8px] text-gray-400 animate-pulse">...</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="p-2 border-t border-bags-green/30">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex gap-2"
        >
          <input
            id="bot-input"
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="pet the dog, fireworks, help..."
            disabled={isLoading}
            className="flex-1 bg-bags-darker border border-bags-green/30 px-2 py-1 font-pixel text-[11px] sm:text-[8px] text-white placeholder-gray-500 focus:outline-none focus:border-bags-green disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="px-2 py-1 bg-bags-green text-bags-dark font-pixel text-[8px] hover:bg-bags-green/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
