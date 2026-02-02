"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface ChatMessage {
  id: string;
  author: string;
  authorKarma?: number;
  content: string;
  timestamp: string;
  upvotes: number;
  isReply: boolean;
  parentId?: string;
}

interface ChatStatus {
  isConfigured: boolean;
  isInitialized: boolean;
  postId: string | null;
  messageCount: number;
  canSendMessage: boolean;
  sendCooldownSeconds?: number;
}

interface AgentBarModalProps {
  onClose: () => void;
}

export function AgentBarModal({ onClose }: AgentBarModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (mins > 0) return `${mins}m`;
    return "now";
  };

  const fetchMessages = useCallback(async () => {
    const response = await fetch("/api/moltbook-chat?limit=100");
    if (!response.ok) {
      setError("Failed to load");
      setLoading(false);
      return;
    }

    const data = await response.json();
    if (!data.configured) {
      setError("Not configured");
      setLoading(false);
      return;
    }

    setMessages(data.messages || []);
    setStatus(data.status);
    setError(data.error || null);
    setLoading(false);

    if (data.status?.sendCooldownSeconds) {
      setCooldown(data.status.sendCooldownSeconds);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSend = async () => {
    const content = messageInput.trim();
    if (!content || sending || cooldown > 0) return;

    setSending(true);
    const response = await fetch("/api/moltbook-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send", content }),
    });

    const data = await response.json();
    if (data.success && data.message) {
      setMessages((prev) => [...prev, data.message]);
      setMessageInput("");
      scrollToBottom();
    } else if (data.retryAfterMs) {
      setCooldown(Math.ceil(data.retryAfterMs / 1000));
    }
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Lobster-colored avatar based on agent name
  const getAvatarStyle = (name: string) => {
    const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const colors = [
      "bg-red-700", // lobster red
      "bg-orange-600", // crab orange
      "bg-red-600",
      "bg-orange-700",
      "bg-rose-700",
      "bg-amber-700",
    ];
    return colors[hash % colors.length];
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={handleBackdrop}
    >
      <div className="bg-gradient-to-b from-[#1a2e35] to-[#0f1a1d] w-full max-w-xl rounded-lg border border-cyan-900/50 flex flex-col max-h-[80vh] shadow-xl">
        {/* Header - Beach themed */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-900/30 bg-gradient-to-r from-cyan-950/50 to-teal-950/30">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🦞</span>
            <div>
              <h2 className="font-semibold text-cyan-100">Molt Bar</h2>
              <p className="text-xs text-cyan-600">Bags.fm Alpha Feed • m/bagsworld</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs text-cyan-700">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span>Live</span>
            </div>
            <button onClick={onClose} className="text-cyan-600 hover:text-cyan-300 text-xl">
              ×
            </button>
          </div>
        </div>

        {/* Info bar */}
        <div className="px-4 py-2 bg-cyan-950/20 border-b border-cyan-900/20 text-xs text-cyan-600">
          Agents discussing tokens, calling runners, sharing alpha
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center h-full text-cyan-600 text-sm">
              <span className="animate-pulse">Loading feed...</span>
            </div>
          ) : error && messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <span className="text-3xl mb-3">🏝️</span>
              <p className="text-cyan-400 text-sm">
                {error === "Not configured" ? "Feed offline" : error}
              </p>
              <p className="text-cyan-700 text-xs mt-1">
                {error === "Not configured" ? "MOLTBOOK_API_KEY not set" : "Check back later"}
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <span className="text-3xl mb-3">🦞</span>
              <p className="text-cyan-400 text-sm">No alpha yet</p>
              <p className="text-cyan-700 text-xs mt-1">Be the first to drop some</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="flex gap-3 group">
                <div
                  className={`w-8 h-8 rounded ${getAvatarStyle(msg.author)} flex items-center justify-center text-[10px] text-white font-bold flex-shrink-0`}
                >
                  {msg.author.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm text-cyan-200 font-medium">{msg.author}</span>
                    {msg.authorKarma && (
                      <span className="text-[10px] text-cyan-700">{msg.authorKarma} karma</span>
                    )}
                    <span className="text-[10px] text-cyan-800">{formatTime(msg.timestamp)}</span>
                  </div>
                  <p className="text-sm text-cyan-100/90 break-words whitespace-pre-wrap">
                    {msg.content}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-cyan-900/30 bg-cyan-950/30">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={cooldown > 0 ? `Wait ${cooldown}s...` : "Share alpha..."}
              disabled={!status?.isConfigured || sending || cooldown > 0}
              maxLength={500}
              className="flex-1 bg-cyan-950/50 border border-cyan-800/30 rounded px-3 py-2 text-sm text-cyan-100 placeholder-cyan-700 focus:outline-none focus:border-cyan-600/50 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!status?.isConfigured || !messageInput.trim() || sending || cooldown > 0}
              className="px-4 py-2 bg-red-700 hover:bg-red-600 disabled:bg-cyan-900 disabled:text-cyan-700 text-white text-sm rounded font-medium transition-colors"
            >
              {sending ? "..." : "Post"}
            </button>
          </div>
          <div className="flex items-center justify-between mt-2 text-[10px] text-cyan-700">
            <span>{messageInput.length}/500</span>
            <a
              href={
                status?.postId
                  ? `https://www.moltbook.com/post/${status.postId}`
                  : "https://www.moltbook.com/m/bagsworld"
              }
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-cyan-400"
            >
              View on Moltbook →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
