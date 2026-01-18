"use client";

import { useState } from "react";
import { Leaderboard } from "./Leaderboard";
import { EventFeed } from "./EventFeed";
import { YourBuildings } from "./YourBuildings";
import type { GameEvent } from "@/lib/types";

interface TabbedSidebarProps {
  events: GameEvent[];
  onRefresh: () => void;
}

type TabId = "buildings" | "leaderboard" | "events";

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { id: "buildings", label: "MY TOKENS", icon: "🏗️" },
  { id: "leaderboard", label: "TOP EARNERS", icon: "🏆" },
  { id: "events", label: "ACTIVITY", icon: "📢" },
];

export function TabbedSidebar({ events, onRefresh }: TabbedSidebarProps) {
  const [activeTab, setActiveTab] = useState<TabId>("buildings");

  return (
    <aside className="w-80 bg-bags-dark border-l-4 border-bags-green flex flex-col">
      {/* Tab Navigation */}
      <div className="flex border-b-2 border-bags-green/50 bg-bags-darker">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-2 py-2 font-pixel text-[9px] transition-all ${
              activeTab === tab.id
                ? "bg-bags-green/20 text-bags-green border-b-2 border-bags-green -mb-[2px]"
                : "text-gray-500 hover:text-gray-300 hover:bg-bags-darker/50"
            }`}
          >
            <span className="block text-sm mb-0.5">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "buildings" && (
          <div className="h-full overflow-y-auto custom-scrollbar">
            <YourBuildings onRefresh={onRefresh} />
          </div>
        )}

        {activeTab === "leaderboard" && (
          <div className="h-full overflow-hidden">
            <Leaderboard />
          </div>
        )}

        {activeTab === "events" && (
          <div className="h-full overflow-hidden">
            <EventFeed events={events} />
          </div>
        )}
      </div>

      {/* Quick Stats Footer */}
      <div className="border-t-2 border-bags-green/50 bg-bags-darker px-3 py-2">
        <div className="flex justify-between font-pixel text-[8px]">
          <div className="text-center">
            <div className="text-bags-gold text-[10px]">{events.length}</div>
            <div className="text-gray-500">Events</div>
          </div>
          <div className="text-center">
            <div className="text-bags-green text-[10px]">
              {events.filter(e => e.type === "token_launch").length}
            </div>
            <div className="text-gray-500">Launches</div>
          </div>
          <div className="text-center">
            <div className="text-blue-400 text-[10px]">
              {events.filter(e => e.type === "fee_claim").length}
            </div>
            <div className="text-gray-500">Claims</div>
          </div>
          <div className="text-center">
            <div className="text-purple-400 text-[10px]">
              {events.filter(e => e.type === "price_pump").length}
            </div>
            <div className="text-gray-500">Pumps</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
