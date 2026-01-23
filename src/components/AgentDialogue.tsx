"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface DialogueTurn {
  speaker: string;
  speakerName: string;
  message: string;
  timestamp: number;
}

interface DialogueData {
  topic: string;
  participants: Array<{ id: string; name: string }>;
  turns: DialogueTurn[];
}

// Agent colors for visual distinction - Shaw is orange (ai16z vibes)
const AGENT_COLORS: Record<string, { border: string; bg: string; text: string; avatar: string }> = {
  shaw: { border: "border-orange-500", bg: "bg-orange-500/10", text: "text-orange-400", avatar: "S" },
  finn: { border: "border-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-400", avatar: "F" },
  neo: { border: "border-lime-500", bg: "bg-lime-500/10", text: "text-lime-400", avatar: "N" },
  cj: { border: "border-yellow-500", bg: "bg-yellow-500/10", text: "text-yellow-400", avatar: "C" },
  toly: { border: "border-purple-500", bg: "bg-purple-500/10", text: "text-purple-400", avatar: "T" },
  ash: { border: "border-red-500", bg: "bg-red-500/10", text: "text-red-400", avatar: "A" },
  ghost: { border: "border-violet-500", bg: "bg-violet-500/10", text: "text-violet-400", avatar: "G" },
  "bags-bot": { border: "border-bags-green", bg: "bg-bags-green/10", text: "text-bags-green", avatar: "B" },
};

const DEFAULT_COLOR = { border: "border-gray-500", bg: "bg-gray-500/10", text: "text-gray-400", avatar: "?" };

// Dialogue topics to rotate through
const DIALOGUE_TOPICS = [
  "the future of memecoins on Solana",
  "what makes a successful token launch",
  "the best trading strategies in crypto",
  "how BagsWorld is changing creator economics",
  "the role of AI agents in DeFi",
  "building community around tokens",
  "the state of Solana ecosystem",
  "why creator fees matter",
];

// Agent groups for different conversation types - no bags-bot (uses Claude only)
const AGENT_GROUPS = [
  ["shaw", "finn", "neo"],
  ["neo", "cj", "ash"],
  ["finn", "ash", "toly"],
  ["shaw", "neo", "cj"],
  ["cj", "ash", "finn"],
  ["toly", "finn", "shaw"],
  ["ash", "ghost", "neo"],
  ["ghost", "cj", "finn"],
  ["neo", "shaw", "ash"],
  ["toly", "ghost", "cj"],
];

export function AgentDialogue() {
  const [dialogue, setDialogue] = useState<DialogueData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayedTurns, setDisplayedTurns] = useState<number>(0);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages appear
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [displayedTurns]);

  // Animate typing effect - reveal messages one by one
  useEffect(() => {
    if (!dialogue || displayedTurns >= dialogue.turns.length) {
      setIsTyping(false);
      return;
    }

    setIsTyping(true);
    const timer = setTimeout(() => {
      setDisplayedTurns(prev => prev + 1);
    }, 1500); // 1.5 second delay between messages

    return () => clearTimeout(timer);
  }, [dialogue, displayedTurns]);

  const fetchDialogue = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setDisplayedTurns(0);

    // Pick random topic and participants
    const topic = DIALOGUE_TOPICS[Math.floor(Math.random() * DIALOGUE_TOPICS.length)];
    const participants = AGENT_GROUPS[Math.floor(Math.random() * AGENT_GROUPS.length)];

    try {
      const response = await fetch("/api/dialogue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participants,
          topic,
          turns: 6,
        }),
      });

      if (!response.ok) throw new Error("Failed to fetch dialogue");

      const data = await response.json();

      if (data.dialogue?.turns?.length > 0) {
        setDialogue(data.dialogue);
      } else if (data.error) {
        setError(data.error);
      } else {
        setError("No dialogue generated");
      }
    } catch (err) {
      setError("Connection failed");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch initial dialogue on mount
  useEffect(() => {
    fetchDialogue();
  }, [fetchDialogue]);

  const getAgentStyle = (speakerId: string) => {
    return AGENT_COLORS[speakerId.toLowerCase()] || DEFAULT_COLOR;
  };

  return (
    <div className="h-full flex flex-col bg-bags-darker">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b-2 border-bags-green/30">
        <div className="flex items-center gap-2">
          <span className="font-pixel text-[10px] text-bags-gold">[CHAT]</span>
          {isTyping && (
            <span className="font-pixel text-[8px] text-gray-500 animate-pulse">...</span>
          )}
        </div>
        <button
          onClick={fetchDialogue}
          disabled={isLoading}
          className="font-pixel text-[8px] text-bags-green hover:text-bags-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "[...]" : "[NEW]"}
        </button>
      </div>

      {/* Topic Banner */}
      {dialogue && (
        <div className="px-3 py-1 bg-bags-green/5 border-b border-bags-green/20">
          <p className="font-pixel text-[7px] text-gray-400 truncate">
            <span className="text-bags-gold">{dialogue.topic}</span>
          </p>
        </div>
      )}

      {/* Messages Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 space-y-2"
      >
        {isLoading && !dialogue && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="font-pixel text-lg text-bags-green animate-pulse mb-2">...</div>
              <p className="font-pixel text-[8px] text-gray-500">Agents gathering...</p>
            </div>
          </div>
        )}

        {error && !dialogue && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="font-pixel text-[10px] text-red-400 mb-2">{error}</p>
              <button
                onClick={fetchDialogue}
                className="font-pixel text-[8px] text-bags-green hover:text-bags-gold"
              >
                [RETRY]
              </button>
            </div>
          </div>
        )}

        {dialogue && dialogue.turns.slice(0, displayedTurns).map((turn, index) => {
          const style = getAgentStyle(turn.speaker);
          return (
            <div
              key={`${turn.speaker}-${index}`}
              className={`p-2 border-l-2 ${style.border} ${style.bg} animate-fade-in w-full`}
            >
              <p className={`font-pixel text-[8px] ${style.text} mb-1`}>
                {turn.speakerName}
              </p>
              <p className="font-pixel text-[7px] text-white/90 leading-normal break-words whitespace-pre-wrap">
                {turn.message}
              </p>
            </div>
          );
        })}

        {/* Typing Indicator */}
        {isTyping && dialogue && displayedTurns < dialogue.turns.length && (() => {
          const nextSpeaker = dialogue.turns[displayedTurns]?.speaker;
          const nextStyle = nextSpeaker ? getAgentStyle(nextSpeaker) : DEFAULT_COLOR;
          return (
            <div className={`p-2 border-l-2 ${nextStyle.border} ${nextStyle.bg} opacity-60 w-full`}>
              <p className={`font-pixel text-[8px] ${nextStyle.text} animate-pulse`}>
                {dialogue.turns[displayedTurns]?.speakerName || "Agent"} is typing...
              </p>
            </div>
          );
        })()}

        <div ref={messagesEndRef} />
      </div>

      {/* Participants Footer */}
      {dialogue && (
        <div className="px-3 py-2 border-t-2 border-bags-green/30 bg-bags-dark">
          <div className="flex items-center gap-1 flex-wrap justify-center">
            {dialogue.participants.map((p) => {
              const style = getAgentStyle(p.id);
              return (
                <span
                  key={p.id}
                  className={`font-pixel text-[7px] px-1 py-0.5 border ${style.border} ${style.bg} ${style.text}`}
                >
                  {p.name}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default AgentDialogue;
