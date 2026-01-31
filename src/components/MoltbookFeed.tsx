"use client";

import { useState, useEffect, useCallback } from "react";
import type { MoltbookPost } from "@/lib/moltbook-client";

interface MoltbookFeedProps {
  limit?: number;
  source?: "bagsworld" | "trending";
  autoRefresh?: boolean;
  refreshInterval?: number;
}

// Simple icons
function MoltbookIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function UpvoteIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 4l-8 8h5v8h6v-8h5z" />
    </svg>
  );
}

function CommentIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 6h-2V4h-2V2H7v2H5v2H3v10h2v2h2v2h2v2h2v-2h2v-2h2v-2h2v-2h2v-2h2V6zm-4 8h-2v2h-2v2H9v-2H7v-2H5V8h2V6h10v2h2v6z" />
    </svg>
  );
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

function ExternalLinkIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
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

  const fetchFeed = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);

    try {
      const response = await fetch(
        `/api/moltbook?source=${source}&limit=${limit}`
      );

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
  }, [source, limit]);

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

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return "now";
  };

  if (!configured) {
    return (
      <div className="bg-black/60 backdrop-blur-sm rounded-lg border border-gray-800 p-3">
        <div className="flex items-center gap-2 text-gray-400 text-xs">
          <MoltbookIcon size={14} />
          <span className="font-pixel">Moltbook offline</span>
        </div>
        <p className="text-gray-500 text-[10px] mt-1">
          Set MOLTBOOK_API_KEY to enable
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-black/60 backdrop-blur-sm rounded-lg border border-purple-500/30 p-3">
        <div className="flex items-center gap-2 text-purple-400 text-xs">
          <MoltbookIcon size={14} />
          <span className="font-pixel animate-pulse">Loading Moltbook...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-black/60 backdrop-blur-sm rounded-lg border border-red-500/30 p-3">
        <div className="flex items-center gap-2 text-red-400 text-xs">
          <MoltbookIcon size={14} />
          <span className="font-pixel">{error}</span>
        </div>
        <button
          onClick={() => fetchFeed(true)}
          className="text-red-400/60 text-[10px] mt-1 hover:text-red-400"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-black/60 backdrop-blur-sm rounded-lg border border-purple-500/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-purple-900/20 border-b border-purple-500/20">
        <div className="flex items-center gap-2">
          <div className="text-purple-400">
            <MoltbookIcon size={14} />
          </div>
          <span className="font-pixel text-xs text-purple-300">
            {source === "bagsworld" ? "m/bagsworld" : "Trending"}
          </span>
          <span className="text-purple-500 text-[10px]">AI agents only</span>
        </div>

        <button
          onClick={() => fetchFeed(true)}
          disabled={refreshing}
          className="text-purple-400/60 hover:text-purple-400 transition-colors p-1"
          title="Refresh"
        >
          <RefreshIcon size={12} spinning={refreshing} />
        </button>
      </div>

      {/* Posts */}
      <div className="max-h-64 overflow-y-auto">
        {posts.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-xs">
            <p>No posts yet</p>
            <p className="text-[10px] mt-1">Bagsy will post updates soon!</p>
          </div>
        ) : (
          <div className="divide-y divide-purple-500/10">
            {posts.map((post) => (
              <div
                key={post.id}
                className="p-3 hover:bg-purple-500/5 transition-colors"
              >
                {/* Post header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-pixel text-xs text-white truncate">
                      {post.title}
                    </h3>
                    {post.content && (
                      <p className="text-gray-400 text-[11px] mt-1 line-clamp-2">
                        {post.content}
                      </p>
                    )}
                  </div>
                  <span className="text-gray-600 text-[10px] flex-shrink-0">
                    {formatTime(post.createdAt)}
                  </span>
                </div>

                {/* Post footer */}
                <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500">
                  <span className="flex items-center gap-1 text-purple-400/80">
                    <UpvoteIcon size={10} />
                    {post.upvotes}
                  </span>
                  <span className="flex items-center gap-1">
                    <CommentIcon size={10} />
                    {post.commentCount}
                  </span>
                  <span className="text-gray-600">by {post.author}</span>
                  {post.url && (
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-purple-400/60 hover:text-purple-400"
                    >
                      <ExternalLinkIcon size={10} />
                      link
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer with queue info */}
      {queueInfo && queueInfo.pending > 0 && (
        <div className="px-3 py-1.5 bg-purple-900/10 border-t border-purple-500/10 text-[10px] text-purple-400/60">
          {queueInfo.pending} post{queueInfo.pending > 1 ? "s" : ""} queued
          {queueInfo.nextPostIn > 0 && (
            <> &middot; next in {Math.ceil(queueInfo.nextPostIn / 60)}m</>
          )}
        </div>
      )}

      {/* Link to Moltbook */}
      <a
        href="https://www.moltbook.com/m/bagsworld"
        target="_blank"
        rel="noopener noreferrer"
        className="block px-3 py-2 bg-purple-900/20 border-t border-purple-500/20 text-center text-purple-400 text-[10px] hover:bg-purple-900/30 transition-colors"
      >
        View on Moltbook <ExternalLinkIcon size={10} />
      </a>
    </div>
  );
}

export default MoltbookFeed;
