"use client";

import { useState, useEffect, useCallback } from "react";
import type { MoltbookPost } from "@/lib/moltbook-client";

interface MoltbookFeedProps {
  limit?: number;
  source?: "bagsworld" | "trending";
  autoRefresh?: boolean;
  refreshInterval?: number;
}

// Generate consistent avatar URL for an agent
function getAvatarUrl(username: string): string {
  return `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(username)}&backgroundColor=1a1a2e`;
}

function RefreshIcon({ size = 14, spinning = false }: { size?: number; spinning?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={spinning ? "animate-spin" : ""}
    >
      <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
    </svg>
  );
}

export function MoltbookFeed({
  limit = 5,
  source = "bagsworld",
  autoRefresh = true,
  refreshInterval = 60000,
}: MoltbookFeedProps) {
  const [posts, setPosts] = useState<MoltbookPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [queueInfo, setQueueInfo] = useState<{ pending: number; nextPostIn: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFeed = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) setRefreshing(true);

      try {
        const response = await fetch(`/api/moltbook?source=${source}&limit=${limit}`);

        if (!response.ok) {
          throw new Error("Failed to fetch feed");
        }

        const data = await response.json();

        if (!data.configured) {
          setConfigured(false);
          setPosts([]);
        } else {
          setConfigured(true);
          setPosts(data.posts || []);
          setQueueInfo(data.queue || null);
        }

        setError(null);
      } catch (err) {
        console.error("[MoltbookFeed] Error:", err);
        setError("Failed to load feed");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [source, limit]
  );

  useEffect(() => {
    fetchFeed();

    if (autoRefresh) {
      const interval = setInterval(() => fetchFeed(), refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchFeed, autoRefresh, refreshInterval]);

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const diff = Date.now() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "just now";
  };

  if (!configured) {
    return (
      <div className="bg-[#0d0d14] rounded-xl border border-gray-800/50 p-4">
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <span>📡</span>
          <span>Moltbook offline</span>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-[#0d0d14] rounded-xl border border-purple-500/20 p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-purple-500/20 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-purple-500/20 rounded animate-pulse w-2/3" />
            <div className="h-2 bg-purple-500/10 rounded animate-pulse w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#0d0d14] rounded-xl border border-red-500/20 p-4">
        <p className="text-red-400 text-sm">{error}</p>
        <button
          onClick={() => fetchFeed(true)}
          className="text-red-400/60 text-xs mt-2 hover:text-red-400 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#0d0d14] rounded-xl border border-purple-500/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <span className="font-medium text-white/90">Moltbook</span>
          <span className="text-xs text-gray-500">AI agents</span>
        </div>
        <button
          onClick={() => fetchFeed(true)}
          disabled={refreshing}
          className="text-gray-500 hover:text-purple-400 transition-colors p-2.5 rounded-lg hover:bg-white/5"
          title="Refresh"
        >
          <RefreshIcon size={14} spinning={refreshing} />
        </button>
      </div>

      {/* Posts */}
      <div className="max-h-80 overflow-y-auto">
        {posts.length === 0 ? (
          <div className="p-6 text-center">
            <span className="text-3xl">💭</span>
            <p className="text-gray-500 text-sm mt-2">No posts yet</p>
          </div>
        ) : (
          <div>
            {posts.map((post, index) => (
              <div
                key={post.id}
                className={`p-4 hover:bg-white/[0.02] transition-colors ${
                  index !== posts.length - 1 ? "border-b border-white/5" : ""
                }`}
              >
                {/* Author row */}
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <img
                    src={getAvatarUrl(post.author)}
                    alt=""
                    className="w-10 h-10 rounded-full bg-purple-500/10 flex-shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    {/* Name and time */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-white/90 text-sm">{post.author}</span>
                      <span className="text-gray-600 text-xs">·</span>
                      <span className="text-gray-500 text-xs">{formatTime(post.createdAt)}</span>
                    </div>

                    {/* Title */}
                    {post.title && (
                      <h3 className="text-white/80 text-sm mt-1 leading-snug">{post.title}</h3>
                    )}

                    {/* Content */}
                    {post.content && (
                      <p className="text-gray-400 text-sm mt-1.5 leading-relaxed line-clamp-3">
                        {post.content}
                      </p>
                    )}

                    {/* Engagement */}
                    <div className="flex items-center gap-4 mt-3">
                      {/* Upvotes */}
                      <div className="flex items-center gap-1.5 text-gray-500 hover:text-purple-400 transition-colors cursor-pointer group">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="group-hover:scale-110 transition-transform"
                        >
                          <path d="M12 19V5M5 12l7-7 7 7" />
                        </svg>
                        <span className="text-xs">{post.upvotes}</span>
                      </div>

                      {/* Comments */}
                      <div className="flex items-center gap-1.5 text-gray-500 hover:text-blue-400 transition-colors cursor-pointer group">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="group-hover:scale-110 transition-transform"
                        >
                          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                        </svg>
                        <span className="text-xs">{post.commentCount}</span>
                      </div>

                      {/* Link */}
                      {post.url && (
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-gray-500 hover:text-green-400 transition-colors ml-auto group"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="group-hover:scale-110 transition-transform"
                          >
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                          <span className="text-xs">open</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Queue info */}
      {queueInfo && queueInfo.pending > 0 && (
        <div className="px-4 py-2 bg-purple-500/5 border-t border-white/5 text-xs text-purple-400/70 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
          {queueInfo.pending} queued
          {queueInfo.nextPostIn > 0 && (
            <span>· posting in {Math.ceil(queueInfo.nextPostIn / 60)}m</span>
          )}
        </div>
      )}

      {/* Footer CTA */}
      <a
        href="https://www.moltbook.com"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-t border-white/5 text-purple-300/80 text-xs hover:text-purple-200 hover:from-purple-500/15 hover:to-blue-500/15 transition-all"
      >
        View all on Moltbook
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </a>
    </div>
  );
}

export default MoltbookFeed;
