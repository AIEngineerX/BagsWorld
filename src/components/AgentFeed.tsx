"use client";

import { useState } from "react";
import { useAgentEvents, type Announcement } from "@/hooks/useAgentEvents";

// ============================================================================
// STYLES
// ============================================================================

const priorityColors: Record<string, string> = {
  urgent: "border-red-500 bg-red-500/10",
  high: "border-yellow-500 bg-yellow-500/10",
  medium: "border-blue-500 bg-blue-500/10",
  low: "border-gray-500 bg-gray-500/10",
};

const priorityIcons: Record<string, string> = {
  urgent: "[!]",
  high: "[*]",
  medium: "[~]",
  low: "[.]",
};

const eventTypeLabels: Record<string, string> = {
  token_launch: "LAUNCH",
  token_pump: "PUMP",
  token_dump: "DUMP",
  fee_claim: "CLAIM",
  distribution: "REWARD",
  world_health: "HEALTH",
  creator_milestone: "MILESTONE",
  whale_alert: "WHALE",
  agent_insight: "AGENT",
  system: "SYSTEM",
  arena_victory: "ARENA",
  casino_win: "CASINO",
  oracle_settle: "ORACLE",
};

// ============================================================================
// COMPONENT
// ============================================================================

interface AgentFeedProps {
  maxItems?: number;
  compact?: boolean;
  showHeader?: boolean;
  className?: string;
}

export function AgentFeed({
  maxItems = 10,
  compact = false,
  showHeader = true,
  className = "",
}: AgentFeedProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { announcements, unreadCount, isConnected, markAsRead, markAllAsRead, clearAnnouncements } =
    useAgentEvents({ maxAnnouncements: maxItems });

  const visibleAnnouncements = isExpanded ? announcements : announcements.slice(0, compact ? 3 : 5);

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return "now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return `${Math.floor(diff / 86400000)}d`;
  };

  const handleAnnouncementClick = (announcement: Announcement) => {
    if (!announcement.read) {
      markAsRead([announcement.id]);
    }
  };

  if (compact) {
    return (
      <div
        className={`bg-black/80 border border-gray-700 rounded-lg p-2 overflow-hidden ${className}`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-gray-400">AGENT FEED</span>
            {unreadCount > 0 && (
              <span className="bg-yellow-500 text-black text-xs px-1.5 py-0.5 rounded-full font-bold">
                {unreadCount}
              </span>
            )}
          </div>
          <div
            className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
            title={isConnected ? "Connected" : "Disconnected"}
          />
        </div>

        {visibleAnnouncements.length === 0 ? (
          <p className="text-gray-500 text-xs">No recent activity</p>
        ) : (
          <div className="space-y-1">
            {visibleAnnouncements.map((a) => (
              <div
                key={a.id}
                onClick={() => handleAnnouncementClick(a)}
                className={`text-xs font-mono p-1 rounded border-l-2 cursor-pointer transition-opacity overflow-hidden ${
                  priorityColors[a.priority]
                } ${a.read ? "opacity-50" : "opacity-100"}`}
              >
                <span className="text-gray-500">{formatTime(a.timestamp)}</span>{" "}
                <span className="break-words">{a.message}</span>
              </div>
            ))}
          </div>
        )}

        {announcements.length > 3 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-blue-400 hover:text-blue-300 mt-2"
          >
            {isExpanded ? "Show less" : `Show ${announcements.length - 3} more`}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-black/90 border border-gray-700 rounded-lg overflow-hidden ${className}`}>
      {showHeader && (
        <div className="flex items-center justify-between p-3 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <h3 className="font-mono text-sm text-white">AGENT COORDINATION FEED</h3>
            {unreadCount > 0 && (
              <span className="bg-yellow-500 text-black text-xs px-2 py-0.5 rounded-full font-bold">
                {unreadCount} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
              title={isConnected ? "Connected" : "Disconnected"}
            />
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="text-xs text-gray-400 hover:text-white">
                Mark all read
              </button>
            )}
            <button onClick={clearAnnouncements} className="text-xs text-gray-400 hover:text-white">
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="p-3 max-h-96 overflow-y-auto overflow-x-hidden">
        {visibleAnnouncements.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">No agent activity yet</p>
            <p className="text-gray-600 text-xs mt-1">
              Events will appear here as agents detect activity
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleAnnouncements.map((a) => (
              <div
                key={a.id}
                onClick={() => handleAnnouncementClick(a)}
                className={`p-2 rounded border-l-4 cursor-pointer transition-all hover:bg-white/5 overflow-hidden ${
                  priorityColors[a.priority]
                } ${a.read ? "opacity-60" : "opacity-100"}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-mono text-gray-400 flex-shrink-0">
                      {priorityIcons[a.priority]}
                    </span>
                    <span className="text-xs font-mono text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded flex-shrink-0">
                      {eventTypeLabels[a.eventType] || a.eventType}
                    </span>
                    {!a.read && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />}
                  </div>
                  <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                    {formatTime(a.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-white font-mono break-words overflow-hidden">
                  {a.message}
                </p>
              </div>
            ))}
          </div>
        )}

        {announcements.length > 5 && !isExpanded && (
          <button
            onClick={() => setIsExpanded(true)}
            className="w-full text-center text-xs text-blue-400 hover:text-blue-300 mt-3 py-2 border-t border-gray-800"
          >
            Show {announcements.length - 5} more events
          </button>
        )}

        {isExpanded && announcements.length > 5 && (
          <button
            onClick={() => setIsExpanded(false)}
            className="w-full text-center text-xs text-blue-400 hover:text-blue-300 mt-3 py-2 border-t border-gray-800"
          >
            Show less
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// TOAST NOTIFICATION COMPONENT
// ============================================================================

interface AgentToastProps {
  className?: string;
}

export function AgentToast({ className = "" }: AgentToastProps) {
  const { getLatestAnnouncement, markAsRead } = useAgentEvents({
    autoMarkRead: false,
  });

  const latest = getLatestAnnouncement();

  if (!latest) return null;

  const handleDismiss = () => {
    markAsRead([latest.id]);
  };

  return (
    <div
      className={`fixed bottom-4 right-4 max-w-sm bg-black/95 border rounded-lg shadow-xl animate-slide-up ${
        priorityColors[latest.priority]
      } ${className}`}
    >
      <div className="p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-mono text-gray-400">
            {eventTypeLabels[latest.eventType] || "EVENT"}
          </span>
          <button onClick={handleDismiss} className="text-gray-500 hover:text-white text-xs">
            x
          </button>
        </div>
        <p className="text-sm text-white font-mono break-words overflow-hidden">{latest.message}</p>
      </div>
    </div>
  );
}

export default AgentFeed;
