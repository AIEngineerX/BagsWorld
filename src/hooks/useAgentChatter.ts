"use client";

import { useState, useEffect, useRef } from "react";
import {
  getConversationHistory,
  getActiveConversation,
  type DialogueLine,
  type Conversation,
} from "@/lib/autonomous-dialogue";

export interface ChatterLine extends DialogueLine {
  conversationId: string;
}

interface AgentChatterState {
  lines: ChatterLine[];
  isActive: boolean;
}

/**
 * Polls the autonomous dialogue system every 2s and returns a flat
 * chronological array of recent dialogue lines for the sidebar feed.
 * No API/LLM calls — reads in-memory state only.
 */
export function useAgentChatter(maxLines: number = 30): AgentChatterState {
  const [state, setState] = useState<AgentChatterState>({
    lines: [],
    isActive: false,
  });
  const prevCountRef = useRef(0);

  useEffect(() => {
    function poll() {
      const active = getActiveConversation();
      const history = getConversationHistory(10);

      // Build flat chronological list from completed + active conversations
      const allLines: ChatterLine[] = [];

      // Add completed conversations (oldest first — history is newest-first)
      const reversed = [...history].reverse();
      for (const conv of reversed) {
        for (const line of conv.lines) {
          allLines.push({ ...line, conversationId: conv.id });
        }
      }

      // Add active conversation lines
      if (active?.isActive) {
        for (const line of active.lines) {
          allLines.push({ ...line, conversationId: active.id });
        }
      }

      // Keep only the most recent lines
      const trimmed = allLines.slice(-maxLines);

      // Only update state if line count changed (avoids unnecessary re-renders)
      if (trimmed.length !== prevCountRef.current) {
        prevCountRef.current = trimmed.length;
        setState({ lines: trimmed, isActive: active?.isActive ?? false });
      } else if ((active?.isActive ?? false) !== state.isActive) {
        setState((prev) => ({
          ...prev,
          isActive: active?.isActive ?? false,
        }));
      }
    }

    poll(); // Initial read
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [maxLines]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}
