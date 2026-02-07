"use client";

import { useRef, useEffect, useCallback } from "react";
import { useAgentChatter, type ChatterLine } from "@/hooks/useAgentChatter";

// Character name colors — mirrors speech-bubble-manager.ts text colors
const CHARACTER_COLORS: Record<string, string> = {
  finn: "#4ade80",
  ghost: "#c4b5fd",
  neo: "#00ff55",
  ash: "#fca5a5",
  cj: "#fdba74",
  toly: "#c084fc",
  shaw: "#ffb380",
  "bags-bot": "#60a5fa",
  "professor-oak": "#fbbf24",
  bagsy: "#f472b6",
  // HQ characters default to gray-400 via fallback
};

const DEFAULT_COLOR = "#9ca3af";

function getCharacterColor(id: string): string {
  return CHARACTER_COLORS[id] || DEFAULT_COLOR;
}

function formatDisplayName(id: string): string {
  return id
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function AgentChatterFeed() {
  const { lines, isActive } = useAgentChatter(30);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const prevLineCountRef = useRef(0);

  // Detect user scroll: pause auto-scroll when scrolled up
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    autoScrollRef.current = atBottom;
  }, []);

  // Auto-scroll on new lines
  useEffect(() => {
    if (lines.length > prevLineCountRef.current && autoScrollRef.current) {
      const el = scrollRef.current;
      if (el) {
        // Use requestAnimationFrame for smooth scroll after render
        requestAnimationFrame(() => {
          el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        });
      }
    }
    prevLineCountRef.current = lines.length;
  }, [lines.length]);

  // Group lines by conversationId for separators + timestamps
  const groups: { conversationId: string; lines: ChatterLine[] }[] = [];
  for (const line of lines) {
    const last = groups[groups.length - 1];
    if (last && last.conversationId === line.conversationId) {
      last.lines.push(line);
    } else {
      groups.push({ conversationId: line.conversationId, lines: [line] });
    }
  }

  return (
    <div className="h-full flex flex-col font-pixel text-[10px]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-green-900/30">
        <span className="text-green-400 text-[10px] tracking-wider">AGENT CHATTER</span>
        {isActive && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
        )}
      </div>

      {/* Scrollable feed */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-1 space-y-0.5 scrollbar-thin"
      >
        {groups.length === 0 ? (
          <p className="text-gray-500 text-[9px] py-4 text-center leading-relaxed">
            Agents are quiet...
            <br />
            conversations happen every ~90s
          </p>
        ) : (
          groups.map((group, gi) => (
            <div key={group.conversationId}>
              {/* Separator between conversations */}
              {gi > 0 && (
                <div className="flex items-center gap-2 my-1">
                  <div className="flex-1 border-t border-dashed border-gray-700/50" />
                  <span className="text-gray-600 text-[8px]">
                    {relativeTime(group.lines[0].timestamp)}
                  </span>
                  <div className="flex-1 border-t border-dashed border-gray-700/50" />
                </div>
              )}
              {/* First group timestamp */}
              {gi === 0 && (
                <div className="text-gray-600 text-[8px] text-right mb-0.5">
                  {relativeTime(group.lines[0].timestamp)}
                </div>
              )}
              {/* Lines */}
              {group.lines.map((line, li) => (
                <div key={`${group.conversationId}-${li}`} className="leading-snug py-px">
                  <span
                    style={{ color: getCharacterColor(line.characterId) }}
                    className="font-bold"
                  >
                    {formatDisplayName(line.characterId)}
                  </span>
                  <span className="text-gray-500">: </span>
                  <span className="text-gray-300">{line.message}</span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
