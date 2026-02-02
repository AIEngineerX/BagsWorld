"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface AlphaPost {
  id: string;
  author: string;
  authorKarma?: number;
  content: string;
  title?: string;
  timestamp: string;
  upvotes: number;
  commentCount?: number;
}

interface AgentBarModalProps {
  onClose: () => void;
}

function getAvatarUrl(username: string): string {
  return `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(username)}&backgroundColor=1a1a2e`;
}

export function AgentBarModal({ onClose }: AgentBarModalProps) {
  const [posts, setPosts] = useState<AlphaPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPostsAvailable, setNewPostsAvailable] = useState(false);
  const [lastPostIds, setLastPostIds] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtTop = useRef(true);

  // Live timestamp updates every 10s
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = useCallback((timestamp: string): string => {
    const date = new Date(timestamp);
    const diff = now - date.getTime();
    const secs = Math.floor(diff / 1000);
    const mins = Math.floor(secs / 60);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (mins > 0) return `${mins}m`;
    if (secs > 10) return `${secs}s`;
    return "now";
  }, [now]);

  const fetchPosts = useCallback(async (initial = false) => {
    try {
      const res = await fetch("/api/moltbook-chat?limit=30&mode=feed");
      if (!res.ok) return;
      
      const data = await res.json();
      const newPosts: AlphaPost[] = (data.posts || data.messages || []).map((p: AlphaPost) => ({
        ...p,
        timestamp: p.timestamp || new Date().toISOString(),
      }));

      if (!initial && newPosts.length > 0) {
        const hasNew = newPosts.some(p => !lastPostIds.has(p.id));
        
        if (hasNew && !isAtTop.current) {
          setNewPostsAvailable(true);
        } else {
          setPosts(newPosts);
        }
        setLastPostIds(new Set(newPosts.map(p => p.id)));
      } else {
        setPosts(newPosts);
        setLastPostIds(new Set(newPosts.map(p => p.id)));
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [lastPostIds]);

  useEffect(() => {
    fetchPosts(true);
    const interval = setInterval(() => fetchPosts(false), 15000);
    return () => clearInterval(interval);
  }, [fetchPosts]);

  const handleScroll = () => {
    if (scrollRef.current) {
      isAtTop.current = scrollRef.current.scrollTop < 50;
      if (isAtTop.current && newPostsAvailable) {
        setNewPostsAvailable(false);
        fetchPosts(true);
      }
    }
  };

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setNewPostsAvailable(false);
    fetchPosts(true);
  };

  const renderContent = (text: string) => {
    return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
      i % 2 === 1 ? <strong key={i} className="text-white font-medium">{part}</strong> : part
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#0c0c10] w-full max-w-md rounded-2xl border border-white/10 flex flex-col max-h-[75vh] shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-lg">
                🔥
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0c0c10] animate-pulse" />
            </div>
            <div>
              <h2 className="font-semibold text-white text-sm">Alpha Feed</h2>
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span>Live • m/bagsworld-alpha</span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* New Posts Banner */}
        {newPostsAvailable && (
          <button
            onClick={scrollToTop}
            className="mx-4 mt-2 py-2 px-3 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 rounded-lg text-orange-400 text-xs font-medium transition-all flex items-center justify-center gap-2"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
            New posts available
          </button>
        )}

        {/* Feed */}
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto overscroll-contain"
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-4xl mb-3">🔥</div>
              <p className="text-gray-400 text-sm">No alpha yet</p>
            </div>
          ) : (
            <div className="py-1">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="px-4 py-3 hover:bg-white/[0.02] transition-colors border-b border-white/[0.03] last:border-0"
                >
                  <div className="flex gap-3">
                    <img
                      src={getAvatarUrl(post.author)}
                      alt=""
                      className="w-9 h-9 rounded-full bg-white/5 flex-shrink-0"
                    />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-[13px]">
                        <span className="font-medium text-white truncate">{post.author}</span>
                        {post.authorKarma && post.authorKarma > 0 && (
                          <span className="text-orange-500/60 text-[11px]">
                            {post.authorKarma >= 1000 ? `${(post.authorKarma/1000).toFixed(0)}k` : post.authorKarma}
                          </span>
                        )}
                        <span className="text-gray-600">·</span>
                        <span className="text-gray-500 text-[11px]">{formatTime(post.timestamp)}</span>
                      </div>

                      <p className="text-gray-300 text-[13px] leading-relaxed mt-1.5 whitespace-pre-wrap break-words">
                        {renderContent(post.content)}
                      </p>

                      <div className="flex items-center gap-4 mt-2.5">
                        <div className="flex items-center gap-1 text-gray-600 text-[11px]">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 19V5M5 12l7-7 7 7" />
                          </svg>
                          {post.upvotes}
                        </div>
                        {post.commentCount !== undefined && post.commentCount > 0 && (
                          <div className="flex items-center gap-1 text-gray-600 text-[11px]">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                            </svg>
                            {post.commentCount}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/5 flex gap-2">
          <a
            href="https://moltbook.com/m/bagsworld-alpha"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white text-xs font-medium rounded-lg transition-all text-center"
          >
            Open in Moltbook
          </a>
          <a
            href="https://moltbook.com/u/ChadGhost"
            target="_blank"
            rel="noopener noreferrer"
            className="py-2 px-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs rounded-lg transition-all"
          >
            @ChadGhost
          </a>
        </div>
      </div>
    </div>
  );
}
