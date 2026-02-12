"use client";

import React from "react";
import type { MarketEvent } from "@/lib/types";
import {
  RocketIcon,
  DiamondIcon,
  ChartUpIcon,
  ChartDownIcon,
  WhaleIcon,
  TrophyIcon,
  HammerIcon,
  SignalIcon,
} from "@/components/icons";

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  if (seconds > 10) return `${seconds}s`;
  return "now";
}

function getEventStyle(type: MarketEvent["type"]): {
  color: string;
  icon: React.ReactNode;
  label: string;
} {
  switch (type) {
    case "token_launch":
      return {
        color: "text-purple-400",
        icon: <RocketIcon size={12} />,
        label: "LAUNCH",
      };
    case "platform_launch":
      return {
        color: "text-purple-300",
        icon: <RocketIcon size={12} />,
        label: "LAUNCH",
      };
    case "building_constructed":
      return {
        color: "text-orange-400",
        icon: <HammerIcon size={12} />,
        label: "BUILD",
      };
    case "fee_claim":
      return {
        color: "text-bags-gold",
        icon: <DiamondIcon size={12} />,
        label: "CLAIM",
      };
    case "price_pump":
      return {
        color: "text-bags-green",
        icon: <ChartUpIcon size={12} />,
        label: "PUMP",
      };
    case "price_dump":
      return {
        color: "text-red-400",
        icon: <ChartDownIcon size={12} />,
        label: "DUMP",
      };
    case "whale_alert":
      return {
        color: "text-blue-400",
        icon: <WhaleIcon size={12} />,
        label: "WHALE",
      };
    case "milestone":
      return {
        color: "text-bags-gold",
        icon: <TrophyIcon size={12} />,
        label: "GOAL",
      };
    case "platform_trending":
      return {
        color: "text-cyan-400",
        icon: <ChartUpIcon size={12} />,
        label: "TRENDING",
      };
    case "platform_claim":
      return {
        color: "text-cyan-300",
        icon: <DiamondIcon size={12} />,
        label: "CLAIM",
      };
    default:
      return {
        color: "text-gray-400",
        icon: <SignalIcon size={12} />,
        label: "EVENT",
      };
  }
}

export const MarketEventItem = React.memo(function MarketEventItem({
  event,
}: {
  event: MarketEvent;
}) {
  const { color, icon, label } = getEventStyle(event.type);
  const isPlatform = event.source === "platform";

  return (
    <div
      className={`px-3 py-2 hover:bg-bags-green/5 transition-colors ${
        isPlatform ? "border-l-2 border-l-cyan-500/60" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <span className={`flex-shrink-0 mt-0.5 ${color}`}>{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`font-pixel text-[6px] px-1 py-px ${color} bg-current/10`}>
              {label}
            </span>
            {isPlatform && (
              <span className="font-pixel text-[5px] px-1 py-px text-cyan-400 bg-cyan-400/10 border border-cyan-500/30">
                BAGS.FM
              </span>
            )}
            <span className="font-pixel text-[6px] text-gray-600">
              {formatTime(event.timestamp)}
            </span>
          </div>
          <p className="font-pixel text-[8px] text-gray-300 leading-tight">{event.message}</p>
        </div>
      </div>
    </div>
  );
});

export default MarketEventItem;
