"use client";

// Unified Agent Chat Component
// A reusable chat interface for all BagsWorld AI agents

import { useState, useEffect, useRef, useCallback } from "react";
import { useAgentChat, getAgentInfo, type ChatMessage } from "@/hooks/useAgentChat";

interface Position {
  x: number;
  y: number;
}

interface UnifiedAgentChatProps {
  agentId: string;
  isOpen: boolean;
  onClose: () => void;
  onSwitchAgent?: (agentId: string) => void;
  initialPosition?: Position;
  topics?: Array<{
    title: string;
    icon: string;
    content: string;
  }>;
}

export function UnifiedAgentChat({
  agentId,
  isOpen,
  onClose,
  onSwitchAgent,
  initialPosition = { x: 16, y: -1 },
  topics = [],
}: UnifiedAgentChatProps) {
  const [position, setPosition] = useState<Position>(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [input, setInput] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const agentInfo = getAgentInfo(agentId);

  const {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
    addInfoMessage,
    switchAgent,
    currentAgent,
  } = useAgentChat({
    agentId,
    onSuggestedAgent: onSwitchAgent,
  });

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
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, input")) return;
    const rect = chatRef.current?.getBoundingClientRect();
    if (rect) {
      setIsDragging(true);
      setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    }
  }, []);

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

  const handleTopicClick = (topic: { title: string; icon: string; content: string }) => {
    addInfoMessage(topic.content);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput("");
  };

  if (!isOpen) {
    return null;
  }

  const chatStyle: React.CSSProperties =
    position.y >= 0
      ? { left: position.x, top: position.y, bottom: "auto" }
      : { left: position.x, bottom: 80 };

  // Dynamic color classes based on agent
  const borderColor = `border-${agentInfo.color}-500`;
  const bgColor = `bg-${agentInfo.color}-500`;
  const textColor = `text-${agentInfo.color}-400`;
  const bgTint = `bg-${agentInfo.color}-500/10`;

  return (
    <div
      ref={chatRef}
      style={chatStyle}
      className={`fixed z-50 w-[calc(100vw-2rem)] sm:w-80 max-w-80 bg-bags-dark border-4 border-${agentInfo.color}-500 shadow-lg shadow-${agentInfo.color}-500/20 ${isDragging ? "cursor-grabbing" : ""}`}
    >
      {/* Header */}
      <div
        onPointerDown={handlePointerDown}
        className={`flex items-center justify-between p-2 border-b-4 border-${agentInfo.color}-500 cursor-grab active:cursor-grabbing select-none touch-none bg-gradient-to-r from-${agentInfo.color}-600/20 to-${agentInfo.color}-400/10`}
      >
        <div className="flex items-center gap-2">
          <span className="font-pixel text-sm">{agentInfo.icon}</span>
          <div>
            <p className={`font-pixel text-[10px] text-${agentInfo.color}-400`}>
              {agentInfo.name.toUpperCase()}
            </p>
            <p className="font-pixel text-[8px] text-gray-400">drag to move</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="font-pixel text-xs text-gray-400 hover:text-white px-1"
              title="Clear chat"
            >
              [C]
            </button>
          )}
          <button
            onClick={onClose}
            className="font-pixel text-xs text-gray-400 hover:text-white px-2"
          >
            [X]
          </button>
        </div>
      </div>

      {/* Topics */}
      {topics.length > 0 && (
        <div className="p-2 border-b border-gray-700 bg-bags-darker">
          <div className="flex flex-wrap gap-1">
            {topics.map((topic, i) => (
              <button
                key={i}
                onClick={() => handleTopicClick(topic)}
                className={`px-2 py-1 bg-${agentInfo.color}-500/10 border border-${agentInfo.color}-500/30 font-pixel text-[7px] text-${agentInfo.color}-300 hover:bg-${agentInfo.color}-500/20 transition-colors`}
              >
                {topic.icon} {topic.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="h-48 overflow-y-auto p-2 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center py-4">
            <p className={`font-pixel text-[10px] text-${agentInfo.color}-400 mb-1`}>
              {agentInfo.icon} online
            </p>
            <p className="font-pixel text-[8px] text-gray-400">{agentInfo.tagline}</p>
            <p className="font-pixel text-[7px] text-gray-500 mt-2">Ask me anything</p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              agentInfo={agentInfo}
              onSwitchAgent={onSwitchAgent}
            />
          ))
        )}
        {isLoading && (
          <div
            className={`p-2 border-l-2 bg-${agentInfo.color}-500/10 border-${agentInfo.color}-500`}
          >
            <p className={`font-pixel text-[8px] text-${agentInfo.color}-300 animate-pulse`}>
              thinking...
            </p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={`p-2 border-t border-${agentInfo.color}-500/30`}>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask ${agentInfo.name}...`}
            disabled={isLoading}
            className={`flex-1 bg-bags-darker border border-${agentInfo.color}-500/30 px-2 py-1 font-pixel text-[8px] text-white placeholder-gray-500 focus:outline-none focus:border-${agentInfo.color}-500 disabled:opacity-50`}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className={`px-2 py-1 bg-${agentInfo.color}-500 text-white font-pixel text-[8px] hover:bg-${agentInfo.color}-400 disabled:opacity-50 transition-colors`}
          >
            Send
          </button>
        </form>
      </div>

      {/* Footer */}
      <div className={`p-2 border-t border-${agentInfo.color}-500/30 bg-bags-darker`}>
        <p className={`font-pixel text-[7px] text-${agentInfo.color}-600 text-center`}>
          &quot;{agentInfo.tagline}&quot;
        </p>
      </div>
    </div>
  );
}

// Message bubble component
function MessageBubble({
  message,
  agentInfo,
  onSwitchAgent,
}: {
  message: ChatMessage;
  agentInfo: { name: string; color: string; icon: string };
  onSwitchAgent?: (agentId: string) => void;
}) {
  const isUser = message.role === "user";
  const isInfo = message.role === "info";

  return (
    <div
      className={`p-2 border-l-2 ${
        isUser
          ? "bg-bags-green/10 border-bags-green ml-4"
          : isInfo
            ? "bg-cyan-500/10 border-cyan-500"
            : `bg-${agentInfo.color}-500/10 border-${agentInfo.color}-500`
      }`}
    >
      {isUser && <p className="font-pixel text-[6px] text-bags-green mb-1">You:</p>}
      {isInfo && <p className="font-pixel text-[6px] text-cyan-400 mb-1">Info:</p>}
      {!isUser && !isInfo && (
        <p className={`font-pixel text-[6px] text-${agentInfo.color}-400 mb-1`}>
          {message.agentName || agentInfo.name}:
        </p>
      )}
      <p className="font-pixel text-[8px] text-white whitespace-pre-wrap">{message.content}</p>
      {message.suggestedAgent && onSwitchAgent && (
        <button
          onClick={() => onSwitchAgent(message.suggestedAgent!)}
          className="mt-2 px-2 py-1 bg-purple-500/20 border border-purple-500/30 font-pixel text-[7px] text-purple-300 hover:bg-purple-500/30 transition-colors"
        >
          Switch to {message.suggestedAgent}
        </button>
      )}
    </div>
  );
}

export default UnifiedAgentChat;
