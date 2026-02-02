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

// Agent colors - cleaner, more cohesive palette
const AGENT_COLORS: Record<string, { accent: string; avatar: string }> = {
  shaw: { accent: "text-orange-400", avatar: "S" },
  finn: { accent: "text-emerald-400", avatar: "F" },
  neo: { accent: "text-lime-400", avatar: "N" },
  cj: { accent: "text-yellow-400", avatar: "C" },
  toly: { accent: "text-purple-400", avatar: "T" },
  ash: { accent: "text-red-400", avatar: "A" },
  ghost: { accent: "text-violet-400", avatar: "G" },
  "bags-bot": { accent: "text-bags-green", avatar: "B" },
};

const DEFAULT_COLOR = { accent: "text-gray-400", avatar: "?" };

// Dialogue topics
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

// Agent conversation groups
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

const REFRESH_DELAY = 120000; // 2 minutes

export function AgentDialogue() {
  const [dialogue, setDialogue] = useState<DialogueData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayedTurns, setDisplayedTurns] = useState<number>(0);
  const [isTyping, setIsTyping] = useState(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [isPaused, setIsPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [displayedTurns]);

  // Typing animation
  useEffect(() => {
    if (!dialogue || displayedTurns >= dialogue.turns.length) {
      setIsTyping(false);
      return;
    }

    setIsTyping(true);
    const timer = setTimeout(() => {
      setDisplayedTurns((prev) => prev + 1);
    }, 1500);

    return () => clearTimeout(timer);
  }, [dialogue, displayedTurns]);

  const fetchDialogue = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setDisplayedTurns(0);

    const topic = DIALOGUE_TOPICS[Math.floor(Math.random() * DIALOGUE_TOPICS.length)];
    const participants = AGENT_GROUPS[Math.floor(Math.random() * AGENT_GROUPS.length)];

    try {
      const response = await fetch("/api/dialogue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participants, topic, turns: 4 }),
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
    } catch {
      setError("Connection failed");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-refresh countdown
  useEffect(() => {
    if (!dialogue || isTyping || isPaused) return;
    if (displayedTurns < dialogue.turns.length) return;

    setCountdown(REFRESH_DELAY / 1000);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const refreshTimer = setTimeout(() => {
      if (!isPaused) fetchDialogue();
    }, REFRESH_DELAY);

    return () => {
      clearInterval(interval);
      clearTimeout(refreshTimer);
    };
  }, [dialogue, displayedTurns, isTyping, isPaused, fetchDialogue]);

  // Initial fetch
  useEffect(() => {
    fetchDialogue();
  }, [fetchDialogue]);

  const getAgentStyle = (speakerId: string) => {
    return AGENT_COLORS[speakerId.toLowerCase()] || DEFAULT_COLOR;
  };

  return (
    <div className="h-full flex flex-col bg-bags-darker">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-bags-green/30">
        <div className="flex items-center gap-2">
          <span className="font-pixel text-[9px] text-bags-gold">[CHAT]</span>
          {!isPaused && <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />}
        </div>
        <div className="flex items-center gap-2">
          {countdown > 0 && !isTyping && (
            <span className="font-pixel text-[7px] text-gray-600">{countdown}s</span>
          )}
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="font-pixel text-[8px] text-gray-500 hover:text-white w-5 text-center"
          >
            {isPaused ? "▶" : "❚❚"}
          </button>
          <button
            onClick={fetchDialogue}
            disabled={isLoading}
            className="font-pixel text-[8px] text-bags-green hover:text-bags-gold disabled:opacity-50"
          >
            NEW
          </button>
        </div>
      </div>

      {/* Topic */}
      {dialogue && (
        <div className="px-3 py-1.5 bg-black/30 border-b border-bags-green/20">
          <p className="font-pixel text-[7px] text-gray-500 truncate">
            discussing: <span className="text-bags-gold">{dialogue.topic}</span>
          </p>
        </div>
      )}

      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-2 py-2">
        {isLoading && !dialogue && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="font-pixel text-lg text-bags-green animate-pulse">...</div>
              <p className="font-pixel text-[8px] text-gray-600 mt-1">Agents gathering</p>
            </div>
          </div>
        )}

        {error && !dialogue && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="font-pixel text-[9px] text-red-400 mb-2">{error}</p>
              <button
                onClick={fetchDialogue}
                className="font-pixel text-[8px] text-bags-green hover:text-bags-gold"
              >
                [RETRY]
              </button>
            </div>
          </div>
        )}

        {dialogue && (
          <div className="space-y-2">
            {dialogue.turns.slice(0, displayedTurns).map((turn, index) => {
              const style = getAgentStyle(turn.speaker);
              return (
                <div key={`${turn.speaker}-${index}`} className="group">
                  <div className="flex items-start gap-2">
                    {/* Avatar */}
                    <div
                      className={`w-5 h-5 flex items-center justify-center font-pixel text-[8px] bg-black/50 border border-current/30 flex-shrink-0 ${style.accent}`}
                    >
                      {style.avatar}
                    </div>

                    {/* Message */}
                    <div className="flex-1 min-w-0">
                      <span className={`font-pixel text-[8px] ${style.accent}`}>
                        {turn.speakerName}
                      </span>
                      <p className="font-pixel text-[8px] text-gray-300 leading-relaxed mt-0.5">
                        {turn.message}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing indicator */}
            {isTyping && dialogue && displayedTurns < dialogue.turns.length && (
              <div className="flex items-center gap-2 opacity-60">
                <div
                  className={`w-5 h-5 flex items-center justify-center font-pixel text-[8px] bg-black/50 border border-current/30 ${
                    getAgentStyle(dialogue.turns[displayedTurns]?.speaker).accent
                  }`}
                >
                  {getAgentStyle(dialogue.turns[displayedTurns]?.speaker).avatar}
                </div>
                <span className="font-pixel text-[8px] text-gray-500 animate-pulse">typing...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Participants */}
      {dialogue && (
        <div className="px-3 py-2 border-t border-bags-green/20 bg-black/20">
          <div className="flex items-center gap-1.5">
            {dialogue.participants.map((p) => {
              const style = getAgentStyle(p.id);
              return (
                <span key={p.id} className={`font-pixel text-[7px] ${style.accent}`}>
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
