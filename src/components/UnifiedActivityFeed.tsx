"use client";

import { useMemo } from "react";
import { useAgentEvents } from "@/hooks/useAgentEvents";
import {
  RocketIcon,
  DiamondIcon,
  ChartUpIcon,
  ChartDownIcon,
  TargetIcon,
  WhaleIcon,
  SignalIcon,
  HammerIcon,
  TrophyIcon,
  CoinIcon,
} from "./icons";

// ============================================================================
// TYPES
// ============================================================================

interface UnifiedActivity {
  id: string;
  type: "agent" | "event";
  eventType: string;
  message: string;
  timestamp: number;
  priority?: string;
  read?: boolean;
}

interface UnifiedActivityFeedProps {
  maxItems?: number;
  className?: string;
}

// ============================================================================
// STYLES & ICONS
// ============================================================================

const getActivityStyle = (
  eventType: string,
  type: "agent" | "event"
): { color: string; icon: React.ReactNode; label: string } => {
  // Event types
  if (type === "event") {
    switch (eventType) {
      case "token_launch":
        return { color: "text-purple-400", icon: <RocketIcon size={12} />, label: "LAUNCH" };
      case "building_constructed":
        return { color: "text-orange-400", icon: <HammerIcon size={12} />, label: "BUILD" };
      case "fee_claim":
        return { color: "text-bags-gold", icon: <DiamondIcon size={12} />, label: "CLAIM" };
      case "price_pump":
        return { color: "text-bags-green", icon: <ChartUpIcon size={12} />, label: "PUMP" };
      case "price_dump":
        return { color: "text-red-400", icon: <ChartDownIcon size={12} />, label: "DUMP" };
      case "milestone":
        return { color: "text-bags-gold", icon: <TargetIcon size={12} />, label: "GOAL" };
      case "whale_alert":
        return { color: "text-blue-400", icon: <WhaleIcon size={12} />, label: "WHALE" };
      case "arena_victory":
        return { color: "text-red-400", icon: <TrophyIcon size={12} />, label: "ARENA" };
      case "casino_win":
        return { color: "text-bags-gold", icon: <CoinIcon size={12} />, label: "CASINO" };
      case "oracle_settle":
        return { color: "text-bags-purple", icon: <TargetIcon size={12} />, label: "ORACLE" };
      case "task_posted":
        return { color: "text-amber-400", icon: <TargetIcon size={12} />, label: "BOUNTY" };
      case "task_claimed":
        return { color: "text-yellow-400", icon: <HammerIcon size={12} />, label: "CLAIM" };
      case "task_completed":
        return { color: "text-emerald-400", icon: <TrophyIcon size={12} />, label: "DONE" };
      case "a2a_message":
        return { color: "text-cyan-400", icon: <SignalIcon size={12} />, label: "A2A" };
      default:
        return { color: "text-gray-400", icon: <SignalIcon size={12} />, label: "EVENT" };
    }
  }

  // Agent types
  switch (eventType) {
    case "token_launch":
      return { color: "text-purple-400", icon: <RocketIcon size={12} />, label: "LAUNCH" };
    case "token_pump":
      return { color: "text-bags-green", icon: <ChartUpIcon size={12} />, label: "PUMP" };
    case "token_dump":
      return { color: "text-red-400", icon: <ChartDownIcon size={12} />, label: "DUMP" };
    case "fee_claim":
      return { color: "text-bags-gold", icon: <DiamondIcon size={12} />, label: "CLAIM" };
    case "whale_alert":
      return { color: "text-blue-400", icon: <WhaleIcon size={12} />, label: "WHALE" };
    case "agent_insight":
      return { color: "text-cyan-400", icon: <SignalIcon size={12} />, label: "AGENT" };
    case "arena_victory":
      return { color: "text-red-400", icon: <TrophyIcon size={12} />, label: "ARENA" };
    case "casino_win":
      return { color: "text-bags-gold", icon: <CoinIcon size={12} />, label: "CASINO" };
    case "oracle_settle":
      return { color: "text-bags-purple", icon: <TargetIcon size={12} />, label: "ORACLE" };
    case "task_posted":
      return { color: "text-amber-400", icon: <TargetIcon size={12} />, label: "BOUNTY" };
    case "task_claimed":
      return { color: "text-yellow-400", icon: <HammerIcon size={12} />, label: "CLAIM" };
    case "task_completed":
      return { color: "text-emerald-400", icon: <TrophyIcon size={12} />, label: "DONE" };
    case "a2a_message":
      return { color: "text-cyan-400", icon: <SignalIcon size={12} />, label: "A2A" };
    default:
      return { color: "text-gray-400", icon: <SignalIcon size={12} />, label: "INFO" };
  }
};

// Strip emojis from message
const cleanMessage = (message: string): string => {
  return message
    .replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]+/g, "")
    .replace(/[\u2600-\u27BF]/g, "")
    .trim();
};

// Event types already shown in LiveMarketFeed — exclude from agent feed
const MARKET_EVENT_TYPES = new Set([
  "fee_claim",
  "token_launch",
  "price_pump",
  "price_dump",
  "milestone",
  "building_constructed",
  "whale_alert",
  "platform_launch",
  "platform_trending",
]);

// ============================================================================
// COMPONENT
// ============================================================================

export function UnifiedActivityFeed({ maxItems = 15, className = "" }: UnifiedActivityFeedProps) {
  const { announcements, markAsRead } = useAgentEvents({ maxAnnouncements: 20 });

  // Agent announcements only (market events are in LiveMarketFeed)
  const unifiedActivities = useMemo(() => {
    const activities: UnifiedActivity[] = announcements
      .filter((a) => a.priority !== "low" && !MARKET_EVENT_TYPES.has(a.eventType))
      .map((announcement) => ({
        id: announcement.id,
        type: "agent" as const,
        eventType: announcement.eventType,
        message: announcement.message,
        timestamp: announcement.timestamp,
        priority: announcement.priority,
        read: announcement.read,
      }));

    // Sort by timestamp (newest first)
    activities.sort((a, b) => b.timestamp - a.timestamp);

    return activities.slice(0, maxItems);
  }, [announcements, maxItems]);

  const formatTime = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    if (seconds > 10) return `${seconds}s`;
    return "now";
  };

  const handleClick = (activity: UnifiedActivity) => {
    if (activity.type === "agent" && !activity.read) {
      markAsRead([activity.id]);
    }
  };

  return (
    <div className={`flex flex-col h-full bg-bags-darker ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-bags-green/30">
        <div className="flex items-center gap-2">
          <span className="text-bags-green animate-pulse">
            <SignalIcon size={12} />
          </span>
          <span className="font-pixel text-[9px] text-bags-green">AGENT FEED</span>
        </div>
        <span className="font-pixel text-[6px] text-gray-600">
          {unifiedActivities.length > 0 ? `${unifiedActivities.length} events` : ""}
        </span>
      </div>

      {/* Activity List */}
      <div className="flex-1 overflow-y-auto" role="feed" aria-label="Live activity feed">
        {unifiedActivities.length === 0 ? (
          <div className="flex items-center justify-center h-full py-3">
            <div className="text-center">
              <span className="text-gray-600 block mb-1">
                <SignalIcon size={14} />
              </span>
              <p className="font-pixel text-[7px] text-gray-600">No agent activity yet</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-bags-green/10">
            {unifiedActivities.map((activity) => {
              const style = getActivityStyle(activity.eventType, activity.type);
              const isUnread = activity.type === "agent" && !activity.read;

              return (
                <div
                  key={`${activity.type}-${activity.id}`}
                  onClick={() => handleClick(activity)}
                  className={`px-3 py-2 hover:bg-bags-green/5 cursor-pointer transition-colors ${
                    isUnread ? "bg-bags-green/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {/* Icon */}
                    <span className={`flex-shrink-0 mt-0.5 ${style.color}`}>{style.icon}</span>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span
                          className={`font-pixel text-[6px] px-1 py-px ${style.color} bg-current/10`}
                        >
                          {style.label}
                        </span>
                        <span className="font-pixel text-[6px] text-gray-600">
                          {formatTime(activity.timestamp)}
                        </span>
                        {isUnread && <span className="w-1.5 h-1.5 bg-bags-green rounded-full" />}
                      </div>
                      <p className="font-pixel text-[8px] text-gray-300 leading-tight">
                        {cleanMessage(activity.message)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default UnifiedActivityFeed;
