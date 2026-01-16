"use client";

import type { GameEvent } from "@/lib/types";
import {
  RocketIcon,
  DiamondIcon,
  ChartUpIcon,
  ChartDownIcon,
  TargetIcon,
  WhaleIcon,
  SignalIcon,
} from "./icons";

interface EventFeedProps {
  events: GameEvent[];
}

export function EventFeed({ events }: EventFeedProps) {
  const formatTime = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "just now";
  };

  const getEventStyle = (type: GameEvent["type"]): { color: string; icon: React.ReactNode; bg: string } => {
    switch (type) {
      case "token_launch":
        return { color: "text-purple-400", icon: <RocketIcon size={14} />, bg: "bg-purple-500/10" };
      case "fee_claim":
        return { color: "text-bags-gold", icon: <DiamondIcon size={14} />, bg: "bg-yellow-500/10" };
      case "price_pump":
        return { color: "text-bags-green", icon: <ChartUpIcon size={14} />, bg: "bg-green-500/10" };
      case "price_dump":
        return { color: "text-bags-red", icon: <ChartDownIcon size={14} />, bg: "bg-red-500/10" };
      case "milestone":
        return { color: "text-bags-gold", icon: <TargetIcon size={14} />, bg: "bg-yellow-500/10" };
      case "whale_alert":
        return { color: "text-blue-400", icon: <WhaleIcon size={14} />, bg: "bg-blue-500/10" };
      default:
        return { color: "text-white", icon: <SignalIcon size={14} />, bg: "bg-white/5" };
    }
  };

  // Strip emojis from message since we're adding our own icons
  const cleanMessage = (message: string): string => {
    // Remove common emoji ranges
    return message
      .replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]+/g, "")
      .replace(/[\u2600-\u27BF]/g, "")
      .trim();
  };

  return (
    <div className="h-full flex flex-col p-2">
      <h2 className="font-pixel text-xs text-bags-green mb-2 px-2 flex items-center gap-2">
        <span className="animate-pulse"><SignalIcon size={14} /></span> BAGS.FM LIVE
      </h2>

      <div className="flex-1 overflow-y-auto space-y-1">
        {events.length === 0 ? (
          <div className="text-center py-4">
            <p className="font-pixel text-[8px] text-gray-500">
              Waiting for activity...
            </p>
            <div className="mt-2 text-gray-500">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="inline-block animate-pulse">
                <circle cx="12" cy="12" r="10" />
                <circle cx="9" cy="10" r="1.5" fill="#0a0a0f" />
                <circle cx="15" cy="10" r="1.5" fill="#0a0a0f" />
                <line x1="9" y1="15" x2="15" y2="15" stroke="#0a0a0f" strokeWidth="1.5" />
              </svg>
            </div>
          </div>
        ) : (
          events.map((event) => {
            const style = getEventStyle(event.type);
            return (
              <div
                key={event.id}
                className={`px-2 py-1.5 rounded transition-colors border-l-2 ${style.bg} border-current ${style.color}`}
              >
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0">{style.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-pixel text-[8px] ${style.color}`}>
                      {cleanMessage(event.message)}
                    </p>
                    <p className="font-pixel text-[6px] text-gray-600 mt-0.5">
                      {formatTime(event.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
