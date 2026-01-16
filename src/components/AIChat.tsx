"use client";

import { useState, useEffect, useRef } from "react";
import { getAIAgent, resetAIAgent, AI_PERSONALITIES } from "@/lib/ai-agent";
import type { AIAction, AIPersonality } from "@/lib/ai-agent";
import { useGameStore } from "@/lib/store";

interface ChatMessage {
  id: string;
  sender: "ai" | "system" | "user";
  message: string;
  type?: AIAction["type"];
  timestamp: number;
}

export function AIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentPersonality, setCurrentPersonality] = useState<AIPersonality>(
    AI_PERSONALITIES[0]
  );
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { worldState } = useGameStore();

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // AI observes and comments on world changes
  useEffect(() => {
    if (!worldState) return;

    const agent = getAIAgent();
    const currentWorldState = worldState;

    const observeWorld = async () => {
      const action = await agent.observe(currentWorldState);
      if (action) {
        addMessage({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          sender: "ai",
          message: action.message,
          type: action.type,
          timestamp: Date.now(),
        });
      }
    };

    // Observe every 15 seconds
    const interval = setInterval(observeWorld, 15000);

    // Initial observation
    observeWorld();

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldState?.lastUpdated]);

  const addMessage = (message: ChatMessage) => {
    setMessages((prev) => [...prev.slice(-50), message]); // Keep last 50 messages
  };

  const handlePersonalityChange = (personality: AIPersonality) => {
    setCurrentPersonality(personality);
    resetAIAgent(personality);
    addMessage({
      id: `${Date.now()}-system`,
      sender: "system",
      message: `AI personality changed to ${personality.name} (${personality.trait})`,
      timestamp: Date.now(),
    });
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    setIsLoading(true);

    // Add user message
    addMessage({
      id: `${Date.now()}-user`,
      sender: "user",
      message: userMessage,
      timestamp: Date.now(),
    });

    try {
      const response = await fetch("/api/ai-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personality: currentPersonality,
          worldState: worldState ? {
            health: worldState.health,
            weather: worldState.weather,
            populationCount: worldState.population.length,
            buildingCount: worldState.buildings.length,
            recentEvents: worldState.events.slice(0, 5),
          } : null,
          userMessage,
          chatHistory: messages.slice(-10).map(m => ({
            role: m.sender === "user" ? "user" : "assistant",
            content: m.message,
          })),
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      addMessage({
        id: `${Date.now()}-ai`,
        sender: "ai",
        message: data.action?.message || "...",
        type: data.action?.type,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Chat error:", error);
      addMessage({
        id: `${Date.now()}-ai`,
        sender: "ai",
        message: getFallbackResponse(currentPersonality, userMessage),
        type: "speak",
        timestamp: Date.now(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getFallbackResponse = (personality: AIPersonality, userMsg: string): string => {
    const lowerMsg = userMsg.toLowerCase();

    // Simple keyword-based responses when no API key
    if (lowerMsg.includes("hello") || lowerMsg.includes("hi") || lowerMsg.includes("hey")) {
      const greetings: Record<string, string> = {
        optimistic: "Hey there, friend! Ready for some gains? 🚀",
        cautious: "Hello. Stay vigilant in these markets.",
        chaotic: "HELLOOO! Let the chaos begin! 😈",
        strategic: "Greetings. I've been analyzing the data...",
      };
      return greetings[personality.trait];
    }

    if (lowerMsg.includes("market") || lowerMsg.includes("price") || lowerMsg.includes("token")) {
      const marketTalk: Record<string, string> = {
        optimistic: "Markets are looking great! Time to accumulate! 📈",
        cautious: "The market shows mixed signals. Proceed carefully.",
        chaotic: "Up, down, sideways - who cares! CHAOS! 🎲",
        strategic: "Current market structure suggests consolidation phase.",
      };
      return marketTalk[personality.trait];
    }

    if (lowerMsg.includes("help") || lowerMsg.includes("what")) {
      return `I'm ${personality.name}! I watch over BagsWorld and comment on the action. ${personality.catchphrase}`;
    }

    // Default responses
    const defaults: Record<string, string[]> = {
      optimistic: ["Stay positive!", "Good vibes only! ✨", "We're all gonna make it!"],
      cautious: ["Interesting...", "I'll keep that in mind.", "Let's see how this plays out."],
      chaotic: ["Haha! Wild!", "The plot thickens! 🎭", "Now THAT'S interesting!"],
      strategic: ["Noted.", "Processing information...", "Adding to my analysis."],
    };
    const options = defaults[personality.trait];
    return options[Math.floor(Math.random() * options.length)];
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getMessageStyle = (msg: ChatMessage) => {
    if (msg.sender === "user") {
      return "bg-bags-green/30 border-bags-green ml-4";
    }
    if (msg.sender === "system") {
      return "bg-gray-800/50 border-gray-500";
    }
    switch (msg.type) {
      case "celebrate":
        return "bg-bags-green/20 border-bags-green";
      case "warn":
        return "bg-bags-red/20 border-bags-red";
      case "predict":
        return "bg-purple-500/20 border-purple-500";
      case "encourage":
        return "bg-bags-gold/20 border-bags-gold";
      case "joke":
        return "bg-blue-500/20 border-blue-500";
      default:
        return "bg-white/5 border-gray-600";
    }
  };

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-20 left-4 z-50 btn-retro flex items-center gap-2"
      >
        <span>🤖</span>
        <span>{currentPersonality.name}</span>
        {messages.length > 0 && (
          <span className="w-2 h-2 bg-bags-green rounded-full animate-pulse" />
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 left-4 z-50 w-80 bg-bags-dark border-4 border-bags-green">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b-4 border-bags-green">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <div>
            <p className="font-pixel text-[10px] text-bags-green">
              {currentPersonality.name}
            </p>
            <p className="font-pixel text-[8px] text-gray-400">
              {currentPersonality.trait}
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsMinimized(true)}
          className="font-pixel text-xs text-gray-400 hover:text-white px-2"
        >
          [_]
        </button>
      </div>

      {/* Personality Selector */}
      <div className="flex gap-1 p-2 border-b border-bags-green/30 overflow-x-auto">
        {AI_PERSONALITIES.map((p) => (
          <button
            key={p.name}
            onClick={() => handlePersonalityChange(p)}
            className={`px-2 py-1 font-pixel text-[8px] whitespace-nowrap transition-colors ${
              currentPersonality.name === p.name
                ? "bg-bags-green text-bags-dark"
                : "bg-bags-darker text-gray-400 hover:text-white"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="h-48 overflow-y-auto p-2 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="font-pixel text-[8px] text-gray-500">
              {currentPersonality.name} is observing the world...
            </p>
            <p className="font-pixel text-[6px] text-gray-600 mt-2">
              &ldquo;{currentPersonality.catchphrase}&rdquo;
            </p>
            <p className="font-pixel text-[6px] text-bags-green mt-3">
              Type a message to chat!
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-2 border-l-2 ${getMessageStyle(msg)}`}
            >
              {msg.sender === "user" && (
                <p className="font-pixel text-[6px] text-bags-green mb-1">You:</p>
              )}
              {msg.sender === "ai" && (
                <p className="font-pixel text-[6px] text-bags-gold mb-1">{currentPersonality.name}:</p>
              )}
              <p
                className={`font-pixel text-[8px] ${
                  msg.sender === "system" ? "text-gray-400 italic" : "text-white"
                }`}
              >
                {msg.message}
              </p>
              <p className="font-pixel text-[6px] text-gray-600 mt-1">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </p>
            </div>
          ))
        )}
        {isLoading && (
          <div className="p-2 border-l-2 bg-white/5 border-gray-600">
            <p className="font-pixel text-[6px] text-bags-gold mb-1">{currentPersonality.name}:</p>
            <p className="font-pixel text-[8px] text-gray-400 animate-pulse">
              Thinking...
            </p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="p-2 border-t border-bags-green/30">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`Chat with ${currentPersonality.name}...`}
            disabled={isLoading}
            className="flex-1 bg-bags-darker border border-bags-green/30 px-2 py-1 font-pixel text-[8px] text-white placeholder-gray-500 focus:outline-none focus:border-bags-green disabled:opacity-50"
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputValue.trim()}
            className="px-2 py-1 bg-bags-green text-bags-dark font-pixel text-[8px] hover:bg-bags-green/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
        <p className="font-pixel text-[6px] text-gray-600 text-center mt-1">
          Press Enter to send
        </p>
      </div>
    </div>
  );
}
