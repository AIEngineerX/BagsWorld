"use client";

import type { GameEvent } from "@/lib/types";

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

  const getEventStyle = (type: GameEvent["type"]): { color: string; icon: string; bg: string } => {
    switch (type) {
      case "token_launch":
        return { color: "text-purple-400", icon: "🚀", bg: "bg-purple-500/10" };
      case "fee_claim":
        return { color: "text-bags-gold", icon: "💎", bg: "bg-yellow-500/10" };
      case "price_pump":
        return { color: "text-bags-green", icon: "📈", bg: "bg-green-500/10" };
      case "price_dump":
        return { color: "text-bags-red", icon: "📉", bg: "bg-red-500/10" };
      case "milestone":
        return { color: "text-bags-gold", icon: "🎯", bg: "bg-yellow-500/10" };
      case "whale_alert":
        return { color: "text-blue-400", icon: "🐋", bg: "bg-blue-500/10" };
      default:
        return { color: "text-white", icon: "📢", bg: "bg-white/5" };
    }
  };

  // Strip emojis from message since we're adding our own icons
  const cleanMessage = (message: string): string => {
    return message.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, "").trim();
  };

  return (
    <div className="h-full flex flex-col p-2">
      <h2 className="font-pixel text-xs text-bags-green mb-2 px-2 flex items-center gap-2">
        <span className="animate-pulse">📡</span> LIVE FEED
      </h2>

      <div className="flex-1 overflow-y-auto space-y-1">
        {events.length === 0 ? (
          <div className="text-center py-4">
            <p className="font-pixel text-[8px] text-gray-500">
              Waiting for activity...
            </p>
            <span className="text-xl animate-pulse inline-block mt-2">👀</span>
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
                  <span className="text-sm">{style.icon}</span>
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
