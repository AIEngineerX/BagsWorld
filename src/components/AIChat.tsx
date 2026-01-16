"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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

interface Position {
  x: number;
  y: number;
}

export function AIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentPersonality, setCurrentPersonality] = useState<AIPersonality>(
    AI_PERSONALITIES[0]
  );
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 16, y: -1 }); // -1 means use bottom positioning
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const { worldState } = useGameStore();

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input')) return;

    const rect = chatRef.current?.getBoundingClientRect();
    if (rect) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;

    // Keep within viewport bounds
    const maxX = window.innerWidth - 320; // chat width
    const maxY = window.innerHeight - 400; // approximate chat height

    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    });
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

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

    // Observe every 20 seconds
    const interval = setInterval(observeWorld, 20000);

    // Initial observation after a short delay
    const timeout = setTimeout(observeWorld, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
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
      message: `Switched to ${personality.name} - "${personality.catchphrase}"`,
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
      // Build rich context from world state
      const worldContext = worldState ? {
        health: worldState.health,
        weather: worldState.weather,
        populationCount: worldState.population.length,
        buildingCount: worldState.buildings.length,
        recentEvents: worldState.events.slice(0, 5),
        topBuildings: worldState.buildings
          .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))
          .slice(0, 3)
          .map(b => ({ name: b.name, symbol: b.symbol, change: b.change24h, marketCap: b.marketCap })),
        timeInfo: (worldState as any).timeInfo,
      } : null;

      const response = await fetch("/api/ai-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personality: currentPersonality,
          worldState: worldContext,
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
        message: getSmartFallbackResponse(currentPersonality, userMessage, worldState),
        type: "speak",
        timestamp: Date.now(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getSmartFallbackResponse = (
    personality: AIPersonality,
    userMsg: string,
    world: typeof worldState
  ): string => {
    const lowerMsg = userMsg.toLowerCase();

    // Greetings
    if (lowerMsg.includes("hello") || lowerMsg.includes("hi") || lowerMsg.includes("hey")) {
      const greetings: Record<string, string> = {
        optimistic: "Hey there! Welcome to BagsWorld! Ready to see some gains?",
        cautious: "Hello. I've been watching the markets closely. What brings you here?",
        chaotic: "HELLOOO! Finally, someone to talk to! Let's stir up some chaos!",
        strategic: "Greetings. I've been analyzing the data. How can I assist?",
      };
      return greetings[personality.trait];
    }

    // Questions about tokens/buildings
    if (lowerMsg.includes("token") || lowerMsg.includes("building") || lowerMsg.includes("what's hot") || lowerMsg.includes("whats hot")) {
      if (world && world.buildings.length > 0) {
        const topBuilding = world.buildings
          .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))[0];
        const responses: Record<string, string> = {
          optimistic: `${topBuilding.name} is looking strong! Level ${topBuilding.level} building with solid momentum!`,
          cautious: `${topBuilding.name} has the highest market cap currently. Always do your own research though.`,
          chaotic: `${topBuilding.name}?! It's either going to moon or explode! Either way, EXCITING!`,
          strategic: `${topBuilding.name} leads with ${topBuilding.change24h?.toFixed(1)}% change. Watching volume closely.`,
        };
        return responses[personality.trait];
      }
      return "No buildings visible yet... the world is still loading!";
    }

    // Questions about market/price
    if (lowerMsg.includes("market") || lowerMsg.includes("price") || lowerMsg.includes("how's it going") || lowerMsg.includes("hows it going")) {
      if (world) {
        const healthStatus = world.health > 70 ? "thriving" : world.health > 40 ? "stable" : "struggling";
        const responses: Record<string, string> = {
          optimistic: `The world is ${healthStatus} at ${world.health}% health! ${world.weather === "sunny" ? "Perfect vibes!" : "We'll get through any weather!"}`,
          cautious: `World health at ${world.health}%. Weather: ${world.weather}. ${world.health < 50 ? "Stay cautious." : "Conditions acceptable."}`,
          chaotic: `${world.health}% health! ${world.weather} weather! ${world.buildings.length} buildings! NUMBERS! CHAOS!`,
          strategic: `Current metrics: ${world.health}% health, ${world.buildings.length} active buildings, ${world.weather} conditions. Data suggests ${world.health > 60 ? "bullish" : "neutral"} sentiment.`,
        };
        return responses[personality.trait];
      }
    }

    // Time/weather questions
    if (lowerMsg.includes("time") || lowerMsg.includes("weather") || lowerMsg.includes("day") || lowerMsg.includes("night")) {
      if (world) {
        const timeInfo = (world as any).timeInfo;
        const timeStr = timeInfo?.isNight ? "night" : timeInfo?.isDusk ? "dusk" : timeInfo?.isDawn ? "dawn" : "day";
        const responses: Record<string, string> = {
          optimistic: `It's ${timeStr}time in BagsWorld! ${world.weather} weather - perfect for trading!`,
          cautious: `Current conditions: ${timeStr}, ${world.weather}. The market never sleeps...`,
          chaotic: `It's ${timeStr}! ${world.weather}! Time is just a construct anyway! LET'S GO!`,
          strategic: `EST ${timeStr} cycle active. Weather pattern: ${world.weather}. Synced with DC conditions.`,
        };
        return responses[personality.trait];
      }
    }

    // Help
    if (lowerMsg.includes("help") || lowerMsg.includes("what can you do") || lowerMsg.includes("commands")) {
      return `I'm ${personality.name}! I can tell you about:\n- Current market conditions and world health\n- Top tokens and buildings\n- Weather and time in BagsWorld\n- Recent events and trading activity\nJust ask! ${personality.catchphrase}`;
    }

    // Who are you
    if (lowerMsg.includes("who are you") || lowerMsg.includes("what are you")) {
      return `I'm ${personality.name}, your ${personality.trait} AI companion in BagsWorld! I watch over the pixel world that evolves based on real Bags.fm trading. ${personality.catchphrase}`;
    }

    // Events
    if (lowerMsg.includes("event") || lowerMsg.includes("happening") || lowerMsg.includes("news")) {
      if (world && world.events.length > 0) {
        const recentEvent = world.events[0];
        const responses: Record<string, string> = {
          optimistic: `Latest news: ${recentEvent.message} - Exciting times ahead!`,
          cautious: `Recent activity: ${recentEvent.message} - Keep watching for more.`,
          chaotic: `BREAKING: ${recentEvent.message} - WHAT WILL HAPPEN NEXT?!`,
          strategic: `Event logged: ${recentEvent.message} - Analyzing implications...`,
        };
        return responses[personality.trait];
      }
      return "No recent events to report... yet!";
    }

    // Default responses
    const defaults: Record<string, string[]> = {
      optimistic: [
        "Love the energy! Anything specific you want to know about BagsWorld?",
        "I'm here to help! Ask me about tokens, weather, or market conditions!",
        "Great question vibes! What else is on your mind?",
      ],
      cautious: [
        "Interesting... Want me to analyze something specific?",
        "I'm tracking several metrics. What would you like to know?",
        "The markets are always moving. Any particular token catching your eye?",
      ],
      chaotic: [
        "Haha! I like your style! What chaos shall we discuss?",
        "Keep 'em coming! Ask me anything about this wild world!",
        "You're fun! Let's talk tokens, trades, or total mayhem!",
      ],
      strategic: [
        "Processing... Would you like market data, building stats, or event analysis?",
        "I have multiple data streams available. Specify your query.",
        "Request acknowledged. Available data: health, weather, tokens, events.",
      ],
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

  const chatStyle: React.CSSProperties = position.y >= 0
    ? { left: position.x, top: position.y, bottom: 'auto' }
    : { left: position.x, bottom: 80 };

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        style={{ left: position.x, bottom: position.y >= 0 ? 'auto' : 80, top: position.y >= 0 ? position.y : 'auto' }}
        className="fixed z-50 btn-retro flex items-center gap-2"
      >
        <span className="font-pixel text-sm">AI</span>
        <span className="font-pixel text-[8px]">{currentPersonality.name}</span>
        {messages.length > 0 && (
          <span className="w-2 h-2 bg-bags-green rounded-full animate-pulse" />
        )}
      </button>
    );
  }

  return (
    <div
      ref={chatRef}
      style={chatStyle}
      className={`fixed z-50 w-80 bg-bags-dark border-4 border-bags-green shadow-lg ${isDragging ? 'cursor-grabbing' : ''}`}
    >
      {/* Header - Draggable */}
      <div
        onMouseDown={handleMouseDown}
        className="flex items-center justify-between p-2 border-b-4 border-bags-green cursor-grab active:cursor-grabbing select-none"
      >
        <div className="flex items-center gap-2">
          <span className="font-pixel text-sm text-bags-green">AI</span>
          <div>
            <p className="font-pixel text-[10px] text-bags-green">
              {currentPersonality.name}
            </p>
            <p className="font-pixel text-[8px] text-gray-400">
              {currentPersonality.trait} | drag to move
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
          <div className="text-center py-4">
            <p className="font-pixel text-[10px] text-bags-green mb-2">
              {currentPersonality.name}
            </p>
            <p className="font-pixel text-[8px] text-gray-400">
              &ldquo;{currentPersonality.catchphrase}&rdquo;
            </p>
            <div className="mt-3 space-y-1">
              <p className="font-pixel text-[7px] text-gray-500">Try asking:</p>
              <p className="font-pixel text-[7px] text-bags-green/70">&quot;What&apos;s hot right now?&quot;</p>
              <p className="font-pixel text-[7px] text-bags-green/70">&quot;How&apos;s the market?&quot;</p>
              <p className="font-pixel text-[7px] text-bags-green/70">&quot;What time is it?&quot;</p>
            </div>
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
                className={`font-pixel text-[8px] whitespace-pre-wrap ${
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
            placeholder={`Ask ${currentPersonality.name}...`}
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
      </div>
    </div>
  );
}
