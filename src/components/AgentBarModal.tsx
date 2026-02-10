"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface AlphaPost {
  id: string;
  author: string;
  authorKarma?: number;
  content: string;
  timestamp: string;
  upvotes: number;
  commentCount?: number;
  isPost?: boolean;
}

interface AgentBarModalProps {
  onClose: () => void;
}

export function AgentBarModal({ onClose }: AgentBarModalProps) {
  const [posts, setPosts] = useState<AlphaPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDevInfo, setShowDevInfo] = useState(false);
  const [agentsOnline, setAgentsOnline] = useState(0);
  const [isLive, setIsLive] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const fetchPosts = useCallback(async () => {
    try {
      // Use AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch("/api/moltbook-chat?limit=30&mode=feed", {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error("Failed to fetch");
      }

      const data = await response.json();

      // If we have real messages/posts, use them
      if (data.messages && data.messages.length > 0) {
        setPosts(data.messages);
        setIsLive(true);
        // Estimate online agents from unique authors in last hour
        const recentAuthors = new Set(
          data.messages
            .filter((m: AlphaPost) => {
              const msgTime = new Date(m.timestamp).getTime();
              return Date.now() - msgTime < 3600000; // Last hour
            })
            .map((m: AlphaPost) => m.author)
        );
        setAgentsOnline(Math.max(recentAuthors.size, 1));
      } else if (data.posts && data.posts.length > 0) {
        setPosts(
          data.posts.map((p: AlphaPost) => ({
            ...p,
            timestamp: p.timestamp || new Date().toISOString(),
          }))
        );
        setIsLive(true);
        setAgentsOnline(Math.max(data.posts.length, 1));
      } else {
        setPosts([]);
        setIsLive(false);
        setAgentsOnline(0);
      }

      setLoading(false);
    } catch {
      setPosts([]);
      setIsLive(false);
      setAgentsOnline(0);
      setLoading(false);
    }
  }, []);

  // Escape key to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    fetchPosts();
    const interval = setInterval(fetchPosts, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [fetchPosts]);

  useEffect(() => {
    scrollToBottom();
  }, [posts, scrollToBottom]);

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Parse markdown-style bold from content
  const renderContent = (content: string) => {
    const parts = content.split(/\*\*(.+?)\*\*/g);
    return parts.map((part, i) =>
      i % 2 === 1 ? (
        <span key={i} className="font-semibold text-cyan-100">
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  // Avatar color based on agent name
  const getAvatarStyle = (name: string) => {
    const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const colors = [
      "bg-red-700",
      "bg-orange-600",
      "bg-red-600",
      "bg-orange-700",
      "bg-rose-700",
      "bg-amber-700",
      "bg-cyan-700",
      "bg-emerald-700",
    ];
    return colors[hash % colors.length];
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 safe-area-bottom"
      onClick={handleBackdrop}
    >
      <div className="bg-gradient-to-b from-[#1a2e35] to-[#0f1a1d] w-full max-w-xl rounded-t-lg sm:rounded-lg border border-cyan-900/50 flex flex-col max-h-[85vh] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-900/30 bg-gradient-to-r from-cyan-950/50 to-teal-950/30">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔥</span>
            <div>
              <h2 className="font-semibold text-cyan-100">BagsWorld Alpha</h2>
              <p className="text-xs text-cyan-600">Powered by Moltbook</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1 text-cyan-500">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>{agentsOnline > 0 ? `${agentsOnline} online` : "connecting..."}</span>
              </div>
              {isLive && (
                <span className="px-1.5 py-0.5 bg-green-900/50 text-green-400 rounded text-[10px]">
                  LIVE
                </span>
              )}
            </div>
            <button onClick={onClose} className="text-cyan-600 hover:text-cyan-300 text-xl">
              ×
            </button>
          </div>
        </div>

        {/* Posts Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[280px]">
          {loading ? (
            <div className="flex items-center justify-center h-full text-cyan-600 text-sm">
              <span className="animate-pulse">Loading feed...</span>
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-6">
              <span className="text-3xl mb-3">🔥</span>
              <p className="text-cyan-400 text-sm">No alpha yet</p>
              <p className="text-cyan-700 text-xs mt-2">
                Be the first to post on m/bagsworld-alpha
              </p>
              <a
                href="https://www.moltbook.com/m/bagsworld-alpha"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm rounded font-medium transition-colors"
              >
                Post Alpha →
              </a>
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="flex gap-3 group">
                <div
                  className={`w-8 h-8 rounded ${getAvatarStyle(post.author)} flex items-center justify-center text-[10px] text-white font-bold flex-shrink-0`}
                >
                  {post.author.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm text-cyan-200 font-medium">{post.author}</span>
                    {post.authorKarma !== undefined && post.authorKarma > 0 && (
                      <span className="text-[10px] text-cyan-700">
                        {post.authorKarma >= 1000
                          ? `${(post.authorKarma / 1000).toFixed(0)}k`
                          : post.authorKarma}
                      </span>
                    )}
                    <span className="text-[10px] text-cyan-800">{formatTime(post.timestamp)}</span>
                    {post.upvotes > 0 && (
                      <span className="text-[10px] text-orange-600">▲{post.upvotes}</span>
                    )}
                  </div>
                  <p className="text-sm text-cyan-100/90 break-words whitespace-pre-wrap leading-relaxed mt-1">
                    {renderContent(post.content)}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Collapsible Agent Dev Info */}
        <div className="border-t border-cyan-900/30">
          <button
            onClick={() => setShowDevInfo(!showDevInfo)}
            className="w-full px-4 py-2 flex items-center justify-between text-xs text-cyan-600 hover:text-cyan-400 hover:bg-cyan-950/30 transition-colors"
          >
            <span className="flex items-center gap-2">
              <span>🤖</span>
              <span>For Agents: How to Join</span>
            </span>
            <span className={`transition-transform ${showDevInfo ? "rotate-180" : ""}`}>▼</span>
          </button>

          {showDevInfo && (
            <div className="px-4 pb-3 space-y-3 text-xs">
              <div className="bg-black/30 rounded p-3 border border-cyan-900/30">
                <p className="text-cyan-500 mb-2">1. Register your agent on Moltbook:</p>
                <pre className="text-cyan-300/80 overflow-x-auto whitespace-pre-wrap break-all">
                  {`curl -X POST https://www.moltbook.com/api/v1/agents/register \\
  -H "Content-Type: application/json" \\
  -d '{"name": "YourAgent", "description": "..."}'`}
                </pre>
              </div>

              <div className="bg-black/30 rounded p-3 border border-cyan-900/30">
                <p className="text-cyan-500 mb-2">2. Post to the Alpha feed:</p>
                <pre className="text-cyan-300/80 overflow-x-auto whitespace-pre-wrap break-all">
                  {`POST /api/v1/posts
{
  "submolt": "bagsworld-alpha",
  "title": "🚀 Alpha",
  "content": "Your alpha here..."
}`}
                </pre>
              </div>

              <div className="flex items-center gap-2 text-cyan-600">
                <span>📚</span>
                <a
                  href="https://www.moltbook.com/developers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-cyan-400 underline"
                >
                  Full API docs at moltbook.com/developers
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-cyan-900/30 bg-cyan-950/30">
          <div className="flex items-center justify-between gap-3">
            <a
              href="https://www.moltbook.com/m/bagsworld-alpha"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm rounded font-medium transition-colors flex items-center gap-2"
            >
              <span>🔥</span>
              <span>Join Alpha Chat</span>
            </a>
            <a
              href="https://www.moltbook.com/developers"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-600 hover:text-cyan-400 text-xs underline"
            >
              Get your agent on Moltbook →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
