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
  intent?: string; // For tracking what kind of action this was
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
          .slice(0, 5)
          .map(b => ({ name: b.name, symbol: b.symbol, mint: b.tokenMint, change24h: b.change24h, marketCap: b.marketCap })),
        population: worldState.population.map(c => ({
          username: c.username,
          mood: c.mood,
          earnings24h: c.earnings24h,
        })),
        animals: [
          { type: "dog" },
          { type: "cat" },
          { type: "bird" },
          { type: "butterfly" },
          { type: "squirrel" },
        ],
        timeInfo: (worldState as any).timeInfo,
      } : null;

      // Use the new Bags Bot API
      const response = await fetch("/api/bags-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat",
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
        intent: data.action?.intent,
        timestamp: Date.now(),
      });

      // Handle special intents with quick action buttons
      if (data.action?.intent) {
        handleBotIntent(data.action.intent, data.data);
      }
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

  // Handle special bot intents - trigger game events
  const handleBotIntent = (intent: string, data: any) => {
    switch (intent) {
      case "animal_interaction":
        // Trigger animal animation in game
        if (data?.animalType && data?.action) {
          window.dispatchEvent(
            new CustomEvent("bagsworld-animal-control", {
              detail: {
                action: data.action,
                animalType: data.animalType,
                targetX: data.targetX,
              },
            })
          );
        }
        break;
      case "citizen_interaction":
        // Could highlight the citizen in the game
        break;
      case "building_interaction":
        // Could highlight the building
        break;
    }
  };

  const getSmartFallbackResponse = (
    personality: AIPersonality,
    userMsg: string,
    world: typeof worldState
  ): string => {
    const lowerMsg = userMsg.toLowerCase();

    // Greetings
    if (lowerMsg.includes("hello") || lowerMsg.includes("hi") || lowerMsg.includes("hey") || lowerMsg.includes("gm") || lowerMsg.includes("sup")) {
      const greetings: Record<string, string> = {
        optimistic: "hey! what can i help you with?",
        cautious: "hey. watching the markets. what's up?",
        chaotic: "yo! what's good?",
        strategic: "gm. what do you need?",
      };
      return greetings[personality.trait];
    }

    // Questions about tokens/buildings
    if (lowerMsg.includes("token") || lowerMsg.includes("building") || lowerMsg.includes("what's hot") || lowerMsg.includes("whats hot") || lowerMsg.includes("alpha")) {
      if (world && world.buildings.length > 0) {
        const topBuilding = world.buildings
          .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))[0];
        const responses: Record<string, string> = {
          optimistic: `$${topBuilding.symbol} is leading right now - Level ${topBuilding.level} building`,
          cautious: `$${topBuilding.symbol} has the biggest mcap. always dyor though`,
          chaotic: `$${topBuilding.symbol} looking interesting`,
          strategic: `$${topBuilding.symbol} up ${topBuilding.change24h?.toFixed(1)}%. largest by market cap`,
        };
        return responses[personality.trait];
      }
      return "no buildings loaded yet - world still syncing";
    }

    // Questions about market/price
    if (lowerMsg.includes("market") || lowerMsg.includes("price") || lowerMsg.includes("how's it going") || lowerMsg.includes("hows it going") || lowerMsg.includes("vibes")) {
      if (world) {
        const healthStatus = world.health > 70 ? "strong" : world.health > 40 ? "steady" : "weak";
        const responses: Record<string, string> = {
          optimistic: `world health ${world.health}% - looking ${healthStatus}. weather: ${world.weather}`,
          cautious: `${world.health}% health. ${world.weather} conditions. ${world.health < 50 ? "be careful out there" : "holding steady"}`,
          chaotic: `${world.health}% health, ${world.weather}, ${world.buildings.length} tokens active`,
          strategic: `metrics: ${world.health}% health, ${world.buildings.length} tokens, ${world.weather}. sentiment ${world.health > 60 ? "positive" : "neutral"}`,
        };
        return responses[personality.trait];
      }
    }

    // Time/weather questions
    if (lowerMsg.includes("time") || lowerMsg.includes("weather") || lowerMsg.includes("day") || lowerMsg.includes("night")) {
      if (world) {
        const timeInfo = (world as any).timeInfo;
        const timeStr = timeInfo?.isNight ? "night" : timeInfo?.isDusk ? "evening" : timeInfo?.isDawn ? "morning" : "daytime";
        const responses: Record<string, string> = {
          optimistic: `it's ${timeStr} in BagsWorld. weather: ${world.weather}`,
          cautious: `${timeStr} right now. ${world.weather} conditions`,
          chaotic: `${timeStr}, ${world.weather} weather`,
          strategic: `time: ${timeStr} (EST). weather: ${world.weather}`,
        };
        return responses[personality.trait];
      }
    }

    // Help
    if (lowerMsg.includes("help") || lowerMsg.includes("what can you do") || lowerMsg.includes("commands")) {
      return `i'm ${personality.name}. i can help with:\n- world health and status\n- token info and buildings\n- weather and time\n- recent events`;
    }

    // Who are you
    if (lowerMsg.includes("who are you") || lowerMsg.includes("what are you")) {
      const intros: Record<string, string> = {
        optimistic: `i'm ${personality.name}. i track what's happening in BagsWorld based on real solana trading`,
        cautious: `${personality.name}. i monitor the world and keep tabs on everything`,
        chaotic: `${personality.name} here. watching things unfold`,
        strategic: `${personality.name}. i analyze BagsWorld data`,
      };
      return intros[personality.trait];
    }

    // WAGMI/NGMI
    if (lowerMsg.includes("wagmi") || lowerMsg.includes("ngmi") || lowerMsg.includes("gmi")) {
      const responses: Record<string, string> = {
        optimistic: "we're all gonna make it",
        cautious: "wagmi if you manage risk",
        chaotic: "who knows but let's find out",
        strategic: "depends on your strategy",
      };
      return responses[personality.trait];
    }

    // Wen questions
    if (lowerMsg.includes("wen")) {
      const responses: Record<string, string> = {
        optimistic: "soon. patience",
        cautious: "timing markets is tricky",
        chaotic: "now? maybe? let's see",
        strategic: "when volume picks up",
      };
      return responses[personality.trait];
    }

    // Events
    if (lowerMsg.includes("event") || lowerMsg.includes("happening") || lowerMsg.includes("news")) {
      if (world && world.events.length > 0) {
        const recentEvent = world.events[0];
        const responses: Record<string, string> = {
          optimistic: `latest: ${recentEvent.message}`,
          cautious: `recent: ${recentEvent.message}`,
          chaotic: `news: ${recentEvent.message}`,
          strategic: `event: ${recentEvent.message}`,
        };
        return responses[personality.trait];
      }
      return "nothing major right now";
    }

    // Default responses
    const defaults: Record<string, string[]> = {
      optimistic: [
        "what can i help you with?",
        "ask me about tokens, weather, or events",
        "i'm here to help",
      ],
      cautious: [
        "want me to check something?",
        "what are you looking for?",
        "anything specific?",
      ],
      chaotic: [
        "what's up?",
        "ask me anything",
        "what do you want to know?",
      ],
      strategic: [
        "what data do you need?",
        "available: health, weather, tokens, events",
        "specify your query",
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
        <span className="font-pixel text-sm">💰</span>
        <span className="font-pixel text-[8px]">BAGS BOT</span>
        {messages.length > 0 && (
          <span className="w-2 h-2 bg-bags-gold rounded-full animate-pulse" />
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
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="font-pixel text-[10px] text-gray-400 hover:text-white"
              title="Clear chat"
            >
              &lt;
            </button>
          )}
          <span className="font-pixel text-sm text-bags-gold">💰</span>
          <p className="font-pixel text-[10px] text-bags-green">
            BAGS BOT
          </p>
        </div>
        <button
          onClick={() => setIsMinimized(true)}
          className="font-pixel text-xs text-gray-400 hover:text-white px-2"
        >
          [_]
        </button>
      </div>


      {/* Messages */}
      <div className="h-48 overflow-y-auto p-2 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center py-2">
            <p className="font-pixel text-[10px] text-bags-gold mb-1">
              💰 BAGS BOT
            </p>
            <p className="font-pixel text-[8px] text-gray-400 mb-2">
              your guide to BagsWorld
            </p>
            <div className="flex flex-wrap justify-center gap-1 mb-2">
              <button
                onClick={() => setInputValue("pet the dog")}
                className="px-2 py-1 bg-bags-darker border border-bags-green/30 font-pixel text-[7px] text-bags-green hover:bg-bags-green/20"
              >
                🐕 pet dog
              </button>
              <button
                onClick={() => setInputValue("whats the top token?")}
                className="px-2 py-1 bg-bags-darker border border-bags-green/30 font-pixel text-[7px] text-bags-green hover:bg-bags-green/20"
              >
                🏢 tokens
              </button>
              <button
                onClick={() => setInputValue("who is earning?")}
                className="px-2 py-1 bg-bags-darker border border-bags-green/30 font-pixel text-[7px] text-bags-green hover:bg-bags-green/20"
              >
                👥 citizens
              </button>
              <button
                onClick={() => setInputValue("how do i claim fees?")}
                className="px-2 py-1 bg-bags-darker border border-bags-green/30 font-pixel text-[7px] text-bags-green hover:bg-bags-green/20"
              >
                💰 fees
              </button>
            </div>
            <p className="font-pixel text-[7px] text-gray-500">
              {currentPersonality.catchphrase}
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
