"use client";

import { useState, useEffect, useRef } from "react";
import { ECOSYSTEM_CONFIG } from "@/lib/config";

interface NeoMessage {
  id: string;
  type: "neo" | "user" | "alert";
  message: string;
  timestamp: number;
}

interface Position {
  x: number;
  y: number;
}

const NEO_QUOTES = ECOSYSTEM_CONFIG.scout.quotes;

export function NeoChat() {
  const [messages, setMessages] = useState<NeoMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<Position>({ x: -1, y: 16 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  // Listen for Neo/Scout click events
  useEffect(() => {
    const handleScoutClick = () => {
      setIsOpen(true);
      if (messages.length === 0) {
        // Random Neo quote as greeting
        const randomQuote = NEO_QUOTES[Math.floor(Math.random() * NEO_QUOTES.length)];
        addMessage({
          id: `${Date.now()}-neo`,
          type: "neo",
          message: randomQuote,
          timestamp: Date.now(),
        });
      }
    };

    window.addEventListener("bagsworld-scout-click", handleScoutClick);
    return () => {
      window.removeEventListener("bagsworld-scout-click", handleScoutClick);
    };
  }, [messages.length]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;

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

  const addMessage = (message: NeoMessage) => {
    setMessages((prev) => [...prev.slice(-20), message]);
  };

  const showRandomQuote = () => {
    const randomQuote = NEO_QUOTES[Math.floor(Math.random() * NEO_QUOTES.length)];
    addMessage({
      id: `${Date.now()}-neo`,
      type: "neo",
      message: randomQuote,
      timestamp: Date.now(),
    });
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
      className={`fixed z-50 w-80 bg-black border-2 border-green-500 shadow-lg shadow-green-500/20 ${isDragging ? 'cursor-grabbing' : ''}`}
    >
      {/* Header - Draggable */}
      <div
        onMouseDown={handleMouseDown}
        className="flex items-center justify-between p-2 border-b border-green-500/50 cursor-grab active:cursor-grabbing select-none bg-gradient-to-r from-green-900/30 to-black"
      >
        <div className="flex items-center gap-2">
          <span className="text-green-400 font-mono text-lg">&#x25C9;</span>
          <div>
            <p className="font-mono text-xs text-green-400 tracking-wider">
              NEO // THE SCOUT
            </p>
            <p className="font-pixel text-[8px] text-green-600">
              drag to move
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
        <div className="h-48 overflow-y-auto p-3 space-y-2 font-mono text-sm">
          {messages.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-green-400 text-xs mb-2">
                SYSTEM ONLINE
              </p>
              <p className="text-green-600 text-[10px]">
                scanning the blockchain...
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-2 ${
                  msg.type === "neo"
                    ? "text-green-400 border-l-2 border-green-500 pl-2"
                    : msg.type === "alert"
                    ? "text-yellow-400 bg-yellow-900/20 border border-yellow-500/30"
                    : "text-white"
                }`}
              >
                {msg.type === "neo" && (
                  <p className="text-[8px] text-green-600 mb-1">NEO:</p>
                )}
                <p className="text-xs leading-relaxed whitespace-pre-wrap">
                  {msg.message}
                </p>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Actions */}
      <div className="p-2 border-t border-green-500/30 space-y-2">
        <button
          onClick={showRandomQuote}
          className="w-full px-3 py-2 bg-green-900/30 border border-green-500/50 text-green-400 font-mono text-xs hover:bg-green-900/50 hover:border-green-400 transition-colors"
        >
          &gt; REQUEST_WISDOM()
        </button>

        <a
          href="https://bags.fm"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full px-3 py-2 bg-green-900/20 border border-green-500/30 text-green-500 font-mono text-xs hover:bg-green-900/40 text-center transition-colors"
        >
          &gt; OPEN_BAGS.FM
        </a>
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-green-500/20 bg-green-900/10">
        <p className="font-mono text-[8px] text-green-700 text-center">
          &quot;There is no spoon... only the blockchain.&quot;
        </p>
      </div>
    </div>
  );
}
