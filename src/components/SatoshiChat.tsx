"use client";

import { useState, useEffect, useRef } from "react";
import { ECOSYSTEM_CONFIG } from "@/lib/config";

interface CryptoMessage {
  id: string;
  type: "satoshi" | "wisdom" | "history";
  message: string;
  timestamp: number;
}

interface Position {
  x: number;
  y: number;
}

const SATOSHI_QUOTES = ECOSYSTEM_CONFIG.satoshi.quotes;

const CRYPTO_TOPICS = [
  {
    title: "What is Bitcoin?",
    icon: "₿",
    content: "Bitcoin is a peer-to-peer electronic cash system. It allows online payments to be sent directly from one party to another without going through a financial institution. No trusted third party required."
  },
  {
    title: "Why Decentralization?",
    icon: "🌐",
    content: "The root problem with conventional currency is all the trust required to make it work. Banks must be trusted not to debase the currency. With Bitcoin, trust is replaced by cryptographic proof."
  },
  {
    title: "21 Million Cap",
    icon: "🔢",
    content: "There will only ever be 21 million Bitcoin. This fixed supply makes it deflationary by design. Lost coins only make everyone else&apos;s coins worth slightly more. Think of it as a donation to everyone."
  },
  {
    title: "Proof of Work",
    icon: "⛏️",
    content: "The proof-of-work chain is the solution to the Byzantine Generals Problem. Nodes vote with their CPU power, expressing acceptance by working on extending the chain."
  },
  {
    title: "The Genesis Block",
    icon: "📜",
    content: "On January 3, 2009, the genesis block was mined with the message: &apos;The Times 03/Jan/2009 Chancellor on brink of second bailout for banks.&apos; This marked the birth of Bitcoin."
  },
  {
    title: "Satoshi&apos;s Disappearance",
    icon: "👻",
    content: "In 2011, Satoshi Nakamoto sent a final message: &apos;I&apos;ve moved on to other things.&apos; The identity remains unknown. Some say it&apos;s better this way - Bitcoin belongs to everyone now."
  },
];

export function SatoshiChat() {
  const [messages, setMessages] = useState<CryptoMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 16, y: -1 }); // -1 means use bottom positioning
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  // Listen for Satoshi click events
  useEffect(() => {
    const handleSatoshiClick = () => {
      setIsOpen(true);
      // Add Satoshi&apos;s greeting
      const randomQuote = SATOSHI_QUOTES[Math.floor(Math.random() * SATOSHI_QUOTES.length)];
      addMessage({
        id: `${Date.now()}-satoshi`,
        type: "satoshi",
        message: randomQuote,
        timestamp: Date.now(),
      });
    };

    window.addEventListener("bagsworld-satoshi-click", handleSatoshiClick);
    return () => {
      window.removeEventListener("bagsworld-satoshi-click", handleSatoshiClick);
    };
  }, []);

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

  const addMessage = (message: CryptoMessage) => {
    setMessages((prev) => [...prev.slice(-30), message]);
  };

  const handleTopicClick = (topic: typeof CRYPTO_TOPICS[0]) => {
    addMessage({
      id: `${Date.now()}-wisdom`,
      type: "wisdom",
      message: topic.content,
      timestamp: Date.now(),
    });

    // Satoshi comments on the topic
    setTimeout(() => {
      const comments = [
        "The nature of Bitcoin is such that once version 0.1 was released, the core design was set in stone.",
        "It might make sense just to get some in case it catches on.",
        "I am not Dorian Nakamoto.",
        "Writing a description for this thing for general audiences is bloody hard.",
        "If you don&apos;t believe it or don&apos;t get it, I don&apos;t have the time to try to convince you, sorry.",
      ];
      addMessage({
        id: `${Date.now()}-satoshi-comment`,
        type: "satoshi",
        message: comments[Math.floor(Math.random() * comments.length)],
        timestamp: Date.now(),
      });
    }, 500);
  };

  const chatStyle: React.CSSProperties = position.y >= 0
    ? { left: position.x, top: position.y, bottom: 'auto' }
    : { left: position.x, bottom: 80 };

  if (!isOpen) {
    return null; // Hidden until Satoshi is clicked
  }

  return (
    <div
      ref={chatRef}
      style={chatStyle}
      className={`fixed z-50 w-80 bg-bags-dark border-4 border-orange-500 shadow-lg ${isDragging ? 'cursor-grabbing' : ''}`}
    >
      {/* Header - Draggable */}
      <div
        onMouseDown={handleMouseDown}
        className="flex items-center justify-between p-2 border-b-4 border-orange-500 cursor-grab active:cursor-grabbing select-none bg-gradient-to-r from-orange-600/20 to-yellow-500/20"
      >
        <div className="flex items-center gap-2">
          <span className="font-pixel text-sm">₿</span>
          <div>
            <p className="font-pixel text-[10px] text-orange-400">
              SATOSHI&apos;S WISDOM
            </p>
            <p className="font-pixel text-[8px] text-gray-400">
              drag to move
            </p>
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
        <p className="font-pixel text-[8px] text-gray-400 mb-2">Learn about crypto:</p>
        <div className="flex flex-wrap gap-1">
          {CRYPTO_TOPICS.map((topic, i) => (
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
      <div className="h-48 overflow-y-auto p-2 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center py-4">
            <p className="font-pixel text-[10px] text-orange-400 mb-1">
              ₿ Hello, friend.
            </p>
            <p className="font-pixel text-[8px] text-gray-400">
              I am Satoshi Nakamoto, creator of Bitcoin.
            </p>
            <p className="font-pixel text-[7px] text-gray-500 mt-2">
              Click a topic to learn about cryptocurrency
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-2 border-l-2 ${
                msg.type === "satoshi"
                  ? "bg-orange-500/10 border-orange-500"
                  : msg.type === "wisdom"
                  ? "bg-yellow-500/10 border-yellow-500"
                  : "bg-gray-500/10 border-gray-500"
              }`}
            >
              {msg.type === "satoshi" && (
                <p className="font-pixel text-[6px] text-orange-400 mb-1">Satoshi:</p>
              )}
              {msg.type === "wisdom" && (
                <p className="font-pixel text-[6px] text-yellow-400 mb-1">₿ Knowledge:</p>
              )}
              {msg.type === "history" && (
                <p className="font-pixel text-[6px] text-gray-400 mb-1">📜 History:</p>
              )}
              <p className="font-pixel text-[8px] text-white whitespace-pre-wrap">
                {msg.message}
              </p>
              <p className="font-pixel text-[6px] text-gray-600 mt-1">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer with Bitcoin stats */}
      <div className="p-2 border-t border-orange-500/30 bg-bags-darker">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-orange-500/10 p-1 rounded">
            <p className="font-pixel text-[6px] text-gray-400">Max Supply</p>
            <p className="font-pixel text-[9px] text-orange-400">21M BTC</p>
          </div>
          <div className="bg-yellow-500/10 p-1 rounded">
            <p className="font-pixel text-[6px] text-gray-400">Genesis</p>
            <p className="font-pixel text-[9px] text-yellow-400">2009</p>
          </div>
          <div className="bg-gray-500/10 p-1 rounded">
            <p className="font-pixel text-[6px] text-gray-400">Identity</p>
            <p className="font-pixel text-[9px] text-gray-400">Unknown</p>
          </div>
        </div>
        <p className="font-pixel text-[7px] text-gray-500 text-center mt-2">
          &quot;Running bitcoin&quot; - Hal Finney, Jan 2009
        </p>
      </div>
    </div>
  );
}
