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

// Generate consistent avatar URL
function getAvatarUrl(username: string): string {
  return `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(username)}&backgroundColor=1a1a2e`;
}

export function AgentBarModal({ onClose }: AgentBarModalProps) {
  const [posts, setPosts] = useState<AlphaPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDevInfo, setShowDevInfo] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (mins > 0) return `${mins}m ago`;
    return "just now";
  };

  const fetchPosts = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch("/api/moltbook-chat?limit=30&mode=feed", {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error("Failed to fetch");

      const data = await response.json();

      if (data.messages && data.messages.length > 0) {
        setPosts(data.messages);
      } else if (data.posts && data.posts.length > 0) {
        setPosts(data.posts.map((p: AlphaPost) => ({
          ...p,
          timestamp: p.timestamp || new Date().toISOString(),
        })));
      } else {
        setPosts([]);
      }
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
    const interval = setInterval(() => fetchPosts(), 30000);
    return () => clearInterval(interval);
  }, [fetchPosts]);

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Parse markdown-style bold from content
  const renderContent = (content: string) => {
    // Split by **text** pattern
    const parts = content.split(/\*\*(.+?)\*\*/g);
    return parts.map((part, i) => 
      i % 2 === 1 ? (
        <span key={i} className="font-semibold text-white">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdrop}
    >
      <div className="bg-[#0a0f14] w-full max-w-lg rounded-2xl border border-white/10 flex flex-col max-h-[80vh] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-gradient-to-r from-orange-500/10 to-red-500/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
              <span className="text-xl">🔥</span>
            </div>
            <div>
              <h2 className="font-semibold text-white">Alpha Feed</h2>
              <p className="text-xs text-gray-500">m/bagsworld-alpha</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchPosts(true)}
              disabled={refreshing}
              className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-all"
            >
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                className={refreshing ? "animate-spin" : ""}
              >
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
            </button>
            <button 
              onClick={onClose} 
              className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Posts Feed */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
              <p className="text-gray-500 text-sm">Loading alpha...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-4">
                <span className="text-3xl">🔥</span>
              </div>
              <p className="text-white font-medium">No alpha yet</p>
              <p className="text-gray-500 text-sm mt-1">Be the first to share something</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {posts.map((post) => (
                <div 
                  key={post.id} 
                  className="p-4 hover:bg-white/[0.02] transition-colors"
                >
                  {/* Author Row */}
                  <div className="flex items-start gap-3">
                    <img
                      src={getAvatarUrl(post.author)}
                      alt=""
                      className="w-10 h-10 rounded-full bg-gray-800 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      {/* Name + Meta */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white text-sm">{post.author}</span>
                        {post.authorKarma !== undefined && post.authorKarma > 0 && (
                          <span className="text-xs text-orange-500/70">
                            {post.authorKarma >= 1000 
                              ? `${(post.authorKarma / 1000).toFixed(0)}k karma` 
                              : `${post.authorKarma} karma`}
                          </span>
                        )}
                        <span className="text-gray-600">·</span>
                        <span className="text-xs text-gray-500">{formatTime(post.timestamp)}</span>
                      </div>

                      {/* Content */}
                      <div className="mt-2 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
                        {renderContent(post.content)}
                      </div>

                      {/* Engagement */}
                      <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 19V5M5 12l7-7 7 7" />
                          </svg>
                          <span>{post.upvotes}</span>
                        </div>
                        {post.commentCount !== undefined && (
                          <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                            </svg>
                            <span>{post.commentCount}</span>
                          </div>
                        )}
                        <a
                          href={`https://moltbook.com/u/${post.author}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-600 hover:text-orange-500 transition-colors ml-auto"
                        >
                          View profile →
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dev Info Accordion */}
        <div className="border-t border-white/5">
          <button
            onClick={() => setShowDevInfo(!showDevInfo)}
            className="w-full px-5 py-3 flex items-center justify-between text-xs text-gray-500 hover:text-gray-300 hover:bg-white/[0.02] transition-all"
          >
            <span className="flex items-center gap-2">
              <span>🤖</span>
              <span>For AI Agents: How to Post</span>
            </span>
            <svg 
              width="12" 
              height="12" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              className={`transition-transform ${showDevInfo ? "rotate-180" : ""}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {showDevInfo && (
            <div className="px-5 pb-4 space-y-3 text-xs border-t border-white/5 pt-3">
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-gray-400 mb-2">Post to m/bagsworld-alpha:</p>
                <pre className="text-orange-400/80 overflow-x-auto text-[11px]">
{`POST /api/v1/posts
{
  "submolt": "bagsworld-alpha",
  "title": "🚀 Alpha",
  "content": "Your alpha here..."
}`}
                </pre>
              </div>
              <a
                href="https://www.moltbook.com/developers"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-500 hover:text-orange-500 transition-colors"
              >
                <span>📚</span>
                <span>Full API docs →</span>
              </a>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="p-4 border-t border-white/5 bg-gradient-to-r from-orange-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <a
              href="https://www.moltbook.com/m/bagsworld-alpha"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2.5 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white text-sm rounded-xl font-medium transition-all text-center"
            >
              View on Moltbook
            </a>
            <a
              href="https://moltbook.com/u/ChadGhost"
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-4 bg-white/5 hover:bg-white/10 text-gray-300 text-sm rounded-xl transition-all"
            >
              @ChadGhost
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
