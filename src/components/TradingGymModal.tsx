"use client";

import { useState, useEffect, useRef } from "react";
import {
  ARENA_AGENTS,
  getLeaderboard,
  getActiveCalls,
  getAllCalls,
  getCurrentConversation,
  getRecentConversations,
  onConversation,
  onCall,
  connectArenaToCoordinator,
  makeCall,
  discussTopic,
  type ArenaAgent,
  type AgentScore,
  type AgentCall,
  type AgentConversation,
} from "@/lib/agent-arena";

interface TradingGymModalProps {
  onClose: () => void;
}

// Pixel art character head configs
const AGENT_HEADS: Record<string, {
  skinColor: string;
  hairColor: string;
  glowColor: string;
  accessory?: "sunglasses" | "cap" | "beanie" | "glasses" | "beard";
  accessoryColor?: string;
}> = {
  neo: {
    skinColor: "#f1c27d",
    hairColor: "#1a1a1a",
    glowColor: "#00ff41",
    accessory: "sunglasses",
    accessoryColor: "#0a0a0a",
  },
  ghost: {
    skinColor: "#e0ac69",
    hairColor: "#1f2937",
    glowColor: "#8b5cf6",
    accessory: "glasses",
    accessoryColor: "#06b6d4",
  },
  finn: {
    skinColor: "#ffd5b4",
    hairColor: "#92400e",
    glowColor: "#10b981",
    accessory: "beanie",
    accessoryColor: "#d97706",
  },
  ash: {
    skinColor: "#ffdbac",
    hairColor: "#1f2937",
    glowColor: "#ef4444",
    accessory: "cap",
    accessoryColor: "#dc2626",
  },
  toly: {
    skinColor: "#f1c27d",
    hairColor: "#4a3728",
    glowColor: "#9945ff",
    accessory: "beard",
    accessoryColor: "#5c4033",
  },
};

// Pixel Art Agent Face Component
function AgentFace({ agent, size = "md" }: { agent: ArenaAgent; size?: "sm" | "md" | "lg" }) {
  const sizeMap = { sm: 24, md: 40, lg: 56 };
  const pixelSize = sizeMap[size];

  const config = AGENT_HEADS[agent.id] || {
    skinColor: "#f1c27d",
    hairColor: "#4a3728",
    glowColor: agent.color,
  };

  return (
    <div className="relative flex-shrink-0" style={{ width: pixelSize, height: pixelSize }}>
      <div
        className="absolute inset-0 rounded-full blur-sm"
        style={{ backgroundColor: config.glowColor, opacity: 0.4, transform: "scale(1.2)" }}
      />
      <svg viewBox="0 0 12 12" className="relative z-10" style={{ width: pixelSize, height: pixelSize, imageRendering: "pixelated" }}>
        <rect x="3" y="1" width="6" height="3" fill={config.hairColor} />
        <rect x="2" y="2" width="1" height="2" fill={config.hairColor} />
        <rect x="9" y="2" width="1" height="2" fill={config.hairColor} />
        <rect x="3" y="3" width="6" height="6" fill={config.skinColor} />
        <rect x="2" y="4" width="1" height="4" fill={config.skinColor} />
        <rect x="9" y="4" width="1" height="4" fill={config.skinColor} />
        {config.accessory === "sunglasses" ? (
          <>
            <rect x="3" y="5" width="3" height="2" fill="#0a0a0a" />
            <rect x="6" y="5" width="3" height="2" fill="#0a0a0a" />
          </>
        ) : config.accessory === "glasses" ? (
          <>
            <rect x="3" y="5" width="2" height="2" fill={config.accessoryColor} />
            <rect x="7" y="5" width="2" height="2" fill={config.accessoryColor} />
            <rect x="5" y="5" width="2" height="1" fill={config.accessoryColor} />
            <rect x="4" y="6" width="1" height="1" fill="#1f2937" />
            <rect x="7" y="6" width="1" height="1" fill="#1f2937" />
          </>
        ) : (
          <>
            <rect x="4" y="5" width="1" height="2" fill="#1f2937" />
            <rect x="7" y="5" width="1" height="2" fill="#1f2937" />
          </>
        )}
        <rect x="5" y="8" width="2" height="1" fill="#c9a07a" />
        {config.accessory === "cap" && (
          <>
            <rect x="2" y="1" width="8" height="2" fill={config.accessoryColor} />
            <rect x="1" y="2" width="3" height="1" fill={config.accessoryColor} />
          </>
        )}
        {config.accessory === "beanie" && (
          <rect x="2" y="0" width="8" height="3" fill={config.accessoryColor} />
        )}
        {config.accessory === "beard" && (
          <>
            <rect x="3" y="8" width="6" height="2" fill={config.accessoryColor} />
            <rect x="2" y="7" width="1" height="2" fill={config.accessoryColor} />
            <rect x="9" y="7" width="1" height="2" fill={config.accessoryColor} />
          </>
        )}
      </svg>
    </div>
  );
}

export function TradingGymModal({ onClose }: TradingGymModalProps) {
  const [activeTab, setActiveTab] = useState<"arena" | "leaderboard" | "calls">("arena");
  const [leaderboard, setLeaderboard] = useState<AgentScore[]>([]);
  const [activeCalls, setActiveCalls] = useState<AgentCall[]>([]);
  const [allCalls, setAllCalls] = useState<AgentCall[]>([]);
  const [conversation, setConversation] = useState<AgentConversation | null>(null);
  const [recentConvos, setRecentConvos] = useState<AgentConversation[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [liveTokens, setLiveTokens] = useState<any[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Connect to arena
  useEffect(() => {
    const disconnect = connectArenaToCoordinator();

    const unsubConvo = onConversation((convo) => {
      setConversation({ ...convo });
      setRecentConvos(getRecentConversations(5));
    });

    const unsubCall = onCall(() => {
      setActiveCalls(getActiveCalls());
      setAllCalls(getAllCalls(20));
      setLeaderboard(getLeaderboard());
    });

    // Initial load
    setLeaderboard(getLeaderboard());
    setActiveCalls(getActiveCalls());
    setAllCalls(getAllCalls(20));
    setConversation(getCurrentConversation());
    setRecentConvos(getRecentConversations(5));

    // Fetch live tokens
    fetchLiveTokens();

    // Refresh periodically
    const interval = setInterval(() => {
      setLeaderboard(getLeaderboard());
      setActiveCalls(getActiveCalls());
      setAllCalls(getAllCalls(20));
    }, 10000);

    return () => {
      unsubConvo();
      unsubCall();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages]);

  const fetchLiveTokens = async () => {
    try {
      const res = await fetch("/api/arena?action=status");
      if (res.ok) {
        const data = await res.json();
        setLiveTokens(data.recentLaunches || []);
      }
    } catch (e) {
      console.error("Failed to fetch live tokens:", e);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const getAgent = (agentId: string): ArenaAgent | undefined => {
    return ARENA_AGENTS.find((a) => a.id === agentId);
  };

  const formatTime = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return "now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    return `${Math.floor(diff / 3600000)}h`;
  };

  const triggerNewCall = async (tokenSymbol?: string, tokenMint?: string) => {
    setIsGenerating(true);
    const randomAgent = ARENA_AGENTS[Math.floor(Math.random() * ARENA_AGENTS.length)];
    const symbol = tokenSymbol || liveTokens[0]?.symbol || "BAGS";
    const mint = tokenMint || liveTokens[0]?.mint;

    await makeCall(randomAgent.id, symbol, mint);
    setActiveCalls(getActiveCalls());
    setAllCalls(getAllCalls(20));
    setLeaderboard(getLeaderboard());
    setIsGenerating(false);
  };

  const triggerDiscussion = async (tokenSymbol?: string) => {
    setIsGenerating(true);
    const symbol = tokenSymbol || liveTokens[0]?.symbol;
    const mint = liveTokens.find((t) => t.symbol === symbol)?.mint;

    await discussTopic(symbol, mint);
    setConversation(getCurrentConversation());
    setIsGenerating(false);
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return { bg: "bg-yellow-500", text: "text-black", icon: "🥇" };
    if (index === 1) return { bg: "bg-gray-400", text: "text-black", icon: "🥈" };
    if (index === 2) return { bg: "bg-orange-600", text: "text-white", icon: "🥉" };
    return { bg: "bg-gray-700", text: "text-gray-300", icon: `#${index + 1}` };
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 sm:p-4" onClick={handleBackdropClick}>
      <div className="bg-gradient-to-b from-gray-900 to-gray-950 border-2 border-orange-500 rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl shadow-orange-500/20">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 via-red-500 to-orange-600 p-4 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.1) 10px, rgba(0,0,0,0.1) 20px)" }} />
          </div>

          <div className="flex justify-between items-center relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-black/30 rounded-xl flex items-center justify-center border border-white/20">
                <span className="text-2xl">⚔️</span>
              </div>
              <div>
                <h2 className="font-pixel text-white text-base sm:text-lg tracking-wide">TRADING GYM</h2>
                <p className="text-orange-200 text-[10px] sm:text-xs flex items-center gap-2">
                  <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  AI Agents Competing Live
                </p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 bg-black/30 hover:bg-black/50 rounded-lg flex items-center justify-center text-white transition-colors" aria-label="Close">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4 relative z-10">
            {([
              { id: "arena", label: "LIVE ARENA", icon: "⚡" },
              { id: "leaderboard", label: "RANKINGS", icon: "🏆" },
              { id: "calls", label: "CALLS", icon: "📊" },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 font-pixel text-[10px] px-3 py-2 rounded-lg transition-all ${
                  activeTab === tab.id
                    ? "bg-black/50 text-white border border-white/20"
                    : "bg-black/20 text-orange-200 hover:bg-black/30"
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Arena Tab */}
          {activeTab === "arena" && (
            <div className="space-y-4">
              {/* Live Tokens Feed */}
              {liveTokens.length > 0 && (
                <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-3">
                  <h4 className="font-pixel text-green-400 text-[10px] mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    LIVE FROM BAGS.FM
                  </h4>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {liveTokens.slice(0, 5).map((token: any) => (
                      <button
                        key={token.mint}
                        onClick={() => triggerDiscussion(token.symbol)}
                        disabled={isGenerating}
                        className="flex-shrink-0 bg-black/30 hover:bg-black/50 rounded-lg px-3 py-2 border border-green-500/20 transition-all hover:scale-105 disabled:opacity-50"
                      >
                        <p className="font-pixel text-[10px] text-green-400">${token.symbol}</p>
                        <p className="text-[8px] text-gray-500 truncate max-w-[80px]">{token.name}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Current Conversation */}
              <div className="bg-gray-800/50 rounded-xl border border-gray-700">
                <div className="p-3 border-b border-gray-700 flex justify-between items-center">
                  <div>
                    <h3 className="font-pixel text-orange-400 text-xs">
                      {conversation?.topic || "Waiting for action..."}
                    </h3>
                    {conversation?.isLoading && (
                      <span className="inline-flex items-center gap-1.5 text-[10px] text-yellow-400 mt-1">
                        <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                        AI ANALYZING...
                      </span>
                    )}
                    {conversation?.isActive && !conversation?.isLoading && (
                      <span className="inline-flex items-center gap-1.5 text-[10px] text-green-400 mt-1">
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        LIVE DISCUSSION
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => triggerDiscussion()}
                    disabled={isGenerating}
                    className="font-pixel text-[9px] bg-orange-600 hover:bg-orange-500 text-white px-2 py-1 rounded disabled:opacity-50"
                  >
                    {isGenerating ? "..." : "NEW"}
                  </button>
                </div>

                {/* Messages */}
                <div className="p-3 max-h-72 overflow-y-auto space-y-3">
                  {conversation?.messages && conversation.messages.length > 0 ? (
                    conversation.messages.map((msg) => {
                      const agent = getAgent(msg.agentId);
                      return (
                        <div key={msg.id} className="flex gap-3 group">
                          {agent && <AgentFace agent={agent} size="sm" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-pixel text-xs font-medium" style={{ color: agent?.color || "#888" }}>
                                {msg.agentName}
                              </span>
                              <span className="text-gray-500 text-[10px]">{formatTime(msg.timestamp)}</span>
                              {msg.isAI && (
                                <span className="text-[8px] px-1 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                                  AI
                                </span>
                              )}
                              {msg.sentiment && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                                  msg.sentiment === "bullish" ? "bg-green-500/20 text-green-400 border border-green-500/30" :
                                  msg.sentiment === "bearish" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                                  "bg-gray-500/20 text-gray-400 border border-gray-500/30"
                                }`}>
                                  {msg.sentiment.toUpperCase()}
                                </span>
                              )}
                            </div>
                            <p className="text-gray-300 text-sm mt-1 leading-relaxed">{msg.message}</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-10">
                      <div className="text-4xl mb-3 opacity-50">⚔️</div>
                      <p className="text-gray-400 font-pixel text-xs">Agents are warming up...</p>
                      <p className="text-gray-500 text-[11px] mt-2">Click a token above to start a discussion</p>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </div>

              {/* Agent Roster */}
              <div>
                <h4 className="font-pixel text-gray-400 text-[10px] mb-3 flex items-center gap-2">
                  ⭐ GYM TRAINERS
                </h4>
                <div className="grid grid-cols-5 gap-2">
                  {ARENA_AGENTS.map((agent) => {
                    const score = leaderboard.find((s) => s.agentId === agent.id);
                    return (
                      <div
                        key={agent.id}
                        onClick={() => triggerNewCall()}
                        className="bg-gray-800/50 rounded-xl p-3 text-center border border-gray-700 hover:border-orange-500/50 transition-all hover:scale-105 cursor-pointer group"
                      >
                        <div className="flex justify-center mb-2">
                          <AgentFace agent={agent} size="lg" />
                        </div>
                        <p className="font-pixel text-[10px] text-white">{agent.name}</p>
                        <p className={`text-[9px] mt-1 ${
                          agent.personality === "bullish" ? "text-green-400" :
                          agent.personality === "bearish" ? "text-red-400" :
                          agent.personality === "analytical" ? "text-blue-400" :
                          agent.personality === "chaotic" ? "text-yellow-400" :
                          "text-purple-400"
                        }`}>
                          {score?.totalCalls || 0} calls
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Leaderboard Tab */}
          {activeTab === "leaderboard" && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border border-yellow-500/30 rounded-xl p-4">
                <h3 className="font-pixel text-yellow-400 text-xs mb-1 flex items-center gap-2">
                  🏆 GYM LEADER RANKINGS
                </h3>
                <p className="text-gray-400 text-[11px]">
                  Agents compete based on their AI prediction accuracy
                </p>
              </div>

              <div className="space-y-2">
                {leaderboard.map((score, index) => {
                  const agent = getAgent(score.agentId);
                  const badge = getRankBadge(index);

                  return (
                    <div
                      key={score.agentId}
                      className={`bg-gray-800/50 rounded-xl p-4 border transition-all hover:scale-[1.01] ${
                        index === 0 ? "border-yellow-500/50 shadow-lg shadow-yellow-500/10" :
                        index === 1 ? "border-gray-400/30" :
                        index === 2 ? "border-orange-600/30" :
                        "border-gray-700"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-pixel text-lg ${badge.bg} ${badge.text}`}>
                          {badge.icon}
                        </div>
                        {agent && <AgentFace agent={agent} size="md" />}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-pixel text-white text-sm">{score.agentName}</span>
                            {score.streak > 2 && (
                              <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full border border-green-500/30">
                                🔥 {score.streak} streak
                              </span>
                            )}
                            {score.streak < -2 && (
                              <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full border border-red-500/30">
                                ❄️ cold
                              </span>
                            )}
                          </div>
                          <p className="text-gray-500 text-[10px] capitalize mt-0.5">
                            {agent?.tradingStyle}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-pixel text-base ${score.totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {score.totalPnl >= 0 ? "+" : ""}{score.totalPnl.toFixed(1)}%
                          </p>
                          <p className="text-gray-500 text-[10px]">
                            {score.wins}W / {score.losses}L ({score.winRate.toFixed(0)}%)
                          </p>
                          <p className="text-gray-600 text-[9px]">
                            {score.totalCalls} total calls
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {leaderboard.every((s) => s.totalCalls === 0) && (
                  <div className="text-center py-8">
                    <p className="text-gray-500 font-pixel text-xs">No calls yet</p>
                    <p className="text-gray-600 text-[10px] mt-1">Launch a token to see agents compete</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Calls Tab */}
          {activeTab === "calls" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-pixel text-orange-400 text-xs flex items-center gap-2">
                  📊 AGENT CALLS
                </h3>
                <button
                  onClick={() => triggerNewCall()}
                  disabled={isGenerating}
                  className="font-pixel text-[10px] bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white px-3 py-1.5 rounded-lg transition-all hover:scale-105 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isGenerating ? "ANALYZING..." : "+ NEW CALL"}
                </button>
              </div>

              {/* Active Calls */}
              {activeCalls.length > 0 && (
                <div>
                  <h4 className="font-pixel text-green-400 text-[10px] mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    ACTIVE CALLS ({activeCalls.length})
                  </h4>
                  <div className="space-y-2">
                    {activeCalls.map((call) => {
                      const agent = getAgent(call.agentId);
                      const timeLeft = Math.max(0, call.expiresAt - Date.now());
                      const hoursLeft = Math.floor(timeLeft / 3600000);

                      return (
                        <div key={call.id} className="bg-gray-800/50 rounded-xl p-4 border border-green-500/30">
                          <div className="flex items-center gap-4">
                            {agent && <AgentFace agent={agent} size="md" />}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-pixel text-white text-sm">{agent?.name}</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                  call.direction === "long"
                                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                    : "bg-red-500/20 text-red-400 border border-red-500/30"
                                }`}>
                                  {call.direction === "long" ? "📈 LONG" : "📉 SHORT"}
                                </span>
                                <span className="font-pixel text-yellow-400 text-sm">${call.tokenSymbol}</span>
                              </div>
                              <p className="text-gray-400 text-[11px] mt-1 italic">&ldquo;{call.reasoning}&rdquo;</p>
                            </div>
                            <div className="text-right">
                              <p className="font-pixel text-sm text-white">{call.confidence}%</p>
                              <p className="text-[10px] text-gray-500">confidence</p>
                              <p className="text-[9px] text-gray-600 mt-1">{hoursLeft}h left</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recent Calls History */}
              <div>
                <h4 className="font-pixel text-gray-400 text-[10px] mb-2">RECENT CALLS</h4>
                {allCalls.length > 0 ? (
                  <div className="space-y-2">
                    {allCalls.slice(0, 10).map((call) => {
                      const agent = getAgent(call.agentId);

                      return (
                        <div key={call.id} className={`bg-gray-800/30 rounded-lg p-3 border ${
                          call.status === "won" ? "border-green-500/30" :
                          call.status === "lost" ? "border-red-500/30" :
                          call.status === "expired" ? "border-gray-500/30" :
                          "border-gray-700"
                        }`}>
                          <div className="flex items-center gap-3">
                            {agent && <AgentFace agent={agent} size="sm" />}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-pixel text-[10px] text-white">{agent?.name}</span>
                                <span className={`text-[9px] ${call.direction === "long" ? "text-green-400" : "text-red-400"}`}>
                                  {call.direction.toUpperCase()}
                                </span>
                                <span className="font-pixel text-[10px] text-yellow-400">${call.tokenSymbol}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              {call.status === "active" ? (
                                <span className="text-[9px] text-blue-400">ACTIVE</span>
                              ) : call.status === "won" ? (
                                <span className="text-[9px] text-green-400">+{call.pnlPercent?.toFixed(1)}%</span>
                              ) : call.status === "lost" ? (
                                <span className="text-[9px] text-red-400">{call.pnlPercent?.toFixed(1)}%</span>
                              ) : (
                                <span className="text-[9px] text-gray-500">EXPIRED</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gray-800/30 rounded-xl border border-gray-700">
                    <div className="text-4xl mb-3 opacity-50">📊</div>
                    <p className="text-gray-400 font-pixel text-xs">No calls yet</p>
                    <p className="text-gray-500 text-[11px] mt-2">Click &ldquo;New Call&rdquo; to see agents make predictions</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-700 bg-gray-900/50">
          <p className="text-gray-500 text-[10px] text-center">
            AI agents powered by Claude • Live data from Bags.fm
          </p>
        </div>
      </div>
    </div>
  );
}
