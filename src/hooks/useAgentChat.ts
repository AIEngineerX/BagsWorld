// Unified Agent Chat Hook
// Provides consistent chat interface for all BagsWorld AI agents

import { useState, useCallback, useRef } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'info';
  content: string;
  timestamp: number;
  agentId?: string;
  agentName?: string;
  suggestedAgent?: string;
}

export interface UseAgentChatOptions {
  agentId: string;
  maxHistory?: number;
  onSuggestedAgent?: (agentId: string) => void;
}

export function useAgentChat(options: UseAgentChatOptions) {
  const { agentId: initialAgentId, maxHistory = 50, onSuggestedAgent } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentAgent, setCurrentAgent] = useState(initialAgentId);
  const sessionIdRef = useRef(crypto.randomUUID());

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => [...prev.slice(-(maxHistory - 1)), message]);
  }, [maxHistory]);

  const addInfoMessage = useCallback((content: string) => {
    addMessage({
      id: `info-${Date.now()}`,
      role: 'info',
      content,
      timestamp: Date.now(),
    });
  }, [addMessage]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const switchAgent = useCallback((newAgentId: string) => {
    setCurrentAgent(newAgentId);
    // Optionally add info message about the switch
    addMessage({
      id: `switch-${Date.now()}`,
      role: 'info',
      content: `Switched to ${newAgentId}`,
      timestamp: Date.now(),
    });
  }, [addMessage]);

  const sendMessage = useCallback(async (userMessage: string) => {
    if (!userMessage.trim() || isLoading) return;

    const now = Date.now();
    addMessage({ id: `user-${now}`, role: 'user', content: userMessage, timestamp: now });
    setIsLoading(true);

    try {
      const conversationHistory = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-10)
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: currentAgent,
          message: userMessage,
          sessionId: sessionIdRef.current,
          conversationHistory,
        }),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();
      if (data.sessionId) sessionIdRef.current = data.sessionId;

      addMessage({
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response,
        timestamp: Date.now(),
        agentId: data.agentId,
        agentName: data.agentName,
        suggestedAgent: data.suggestedAgent,
      });

      if (data.suggestedAgent && onSuggestedAgent) {
        onSuggestedAgent(data.suggestedAgent);
      }
    } catch (error) {
      console.error('Agent chat error:', error);
      addMessage({
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Connection interrupted. Please try again.',
        timestamp: Date.now(),
        agentId: currentAgent,
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentAgent, messages, isLoading, addMessage, onSuggestedAgent]);

  return {
    messages,
    isLoading,
    sessionId: sessionIdRef.current,
    sendMessage,
    clearMessages,
    addInfoMessage,
    switchAgent,
    currentAgent,
  };
}

// Agent display info
const AGENT_INFO: Record<string, { name: string; color: string; icon: string; tagline: string }> = {
  'neo': { name: 'Neo', color: 'green', icon: '👁️', tagline: 'i see the code' },
  'cj': { name: 'CJ', color: 'yellow', icon: '🎭', tagline: 'vibes curator' },
  'finn': { name: 'Finn', color: 'bags-green', icon: '🎒', tagline: 'ready to build?' },
  'bags-bot': { name: 'Bags Bot', color: 'bags-gold', icon: '🤖', tagline: 'your guide' },
  'toly': { name: 'Toly', color: 'purple', icon: '⚡', tagline: 'proof of history' },
  'ash': { name: 'Ash', color: 'red', icon: '🎮', tagline: 'evolve them all!' },
  'shaw': { name: 'Shaw', color: 'blue', icon: '🧠', tagline: 'agents are future' },
  'ghost': { name: 'Ghost', color: 'cyan', icon: '👻', tagline: 'rewards flowing' },
};

const DEFAULT_AGENT_INFO = { name: 'Agent', color: 'gray', icon: '🤖', tagline: 'AI Agent' };

export function getAgentInfo(agentId: string) {
  return AGENT_INFO[agentId.toLowerCase()] || { ...DEFAULT_AGENT_INFO, name: agentId };
}

export default useAgentChat;
