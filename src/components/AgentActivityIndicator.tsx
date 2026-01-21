"use client";

import { useState, useEffect } from "react";
import { getActiveConversation, getCurrentLine, type Conversation, type DialogueLine } from "@/lib/autonomous-dialogue";

// Character display colors
const characterColors: Record<string, string> = {
  finn: "text-bags-gold",
  ghost: "text-cyan-400",
  neo: "text-green-400",
  ash: "text-red-400",
  "bags-bot": "text-blue-400",
  cj: "text-orange-400",
  toly: "text-purple-400",
};

const characterEmoji: Record<string, string> = {
  finn: "F",
  ghost: "G",
  neo: "N",
  ash: "A",
  "bags-bot": "B",
  cj: "C",
  toly: "T",
};

interface AgentActivityIndicatorProps {
  className?: string;
}

export function AgentActivityIndicator({ className = "" }: AgentActivityIndicatorProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [currentLine, setCurrentLine] = useState<DialogueLine | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const checkDialogue = () => {
      const activeConv = getActiveConversation();
      const line = getCurrentLine();

      setConversation(activeConv);
      setCurrentLine(line);
      setIsVisible(!!activeConv?.isActive && !!line);
    };

    // Check immediately and then every 500ms
    checkDialogue();
    const interval = setInterval(checkDialogue, 500);

    return () => clearInterval(interval);
  }, []);

  if (!isVisible || !conversation || !currentLine) {
    return null;
  }

  const speakerColor = characterColors[currentLine.characterId] || "text-white";
  const speakerEmoji = characterEmoji[currentLine.characterId] || "?";

  return (
    <div
      className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in ${className}`}
    >
      <div className="bg-black/95 border-2 border-bags-gold/50 rounded-lg shadow-2xl px-4 py-3 max-w-lg animate-glow-pulse">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="font-pixel text-[8px] text-green-400">LIVE</span>
          </div>
          <span className="font-pixel text-[8px] text-gray-500">|</span>
          <span className="font-pixel text-[8px] text-bags-gold">AGENTS TALKING</span>
          <span className="font-pixel text-[8px] text-gray-500">|</span>
          <div className="flex items-center gap-1">
            {conversation.participants.map((p) => (
              <span
                key={p}
                className={`font-pixel text-[10px] ${characterColors[p] || "text-white"}`}
                title={p}
              >
                [{characterEmoji[p] || "?"}]
              </span>
            ))}
          </div>
        </div>

        {/* Current Speech */}
        <div className="flex items-start gap-2">
          <span className={`font-pixel text-[10px] ${speakerColor} font-bold shrink-0`}>
            {currentLine.characterName}:
          </span>
          <p className="font-pixel text-[10px] text-white leading-relaxed">
            {currentLine.message}
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1 mt-2">
          {conversation.lines.map((_, i) => {
            const currentIndex = conversation.lines.findIndex(
              (l) => l.timestamp === currentLine.timestamp
            );
            return (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === currentIndex
                    ? "bg-bags-gold"
                    : i < currentIndex
                    ? "bg-gray-600"
                    : "bg-gray-800"
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default AgentActivityIndicator;
