"use client";

import { useState, useEffect, useRef } from "react";
import {
  ARENA_AGENTS,
  getLeaderboard,
  getActivePredictions,
  getCurrentConversation,
  getRecentConversations,
  onConversation,
  connectArenaToCoordinator,
  makePrediction,
  type ArenaAgent,
  type AgentScore,
  type TradePrediction,
  type AgentConversation,
} from "@/lib/agent-arena";

interface TradingGymModalProps {
  onClose: () => void;
}

// Agent face components with unique styling
function AgentFace({ agent, size = "md" }: { agent: ArenaAgent; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "w-6 h-6 text-sm",
    md: "w-10 h-10 text-lg",
    lg: "w-14 h-14 text-2xl",
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center relative overflow-hidden`}
      style={{
        backgroundColor: agent.color,
        boxShadow: `0 0 10px ${agent.color}40, inset 0 -2px 4px rgba(0,0,0,0.3)`,
      }}
    >
      <span className="relative z-10">{agent.avatar}</span>
      <div
        className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent"
        style={{ height: "50%" }}
      />
    </div>
  );
}

export function TradingGymModal({ onClose }: TradingGymModalProps) {
  const [activeTab, setActiveTab] = useState<"arena" | "leaderboard" | "predictions">("arena");
  const [leaderboard, setLeaderboard] = useState<AgentScore[]>([]);
  const [predictions, setPredictions] = useState<TradePrediction[]>([]);
  const [conversation, setConversation] = useState<AgentConversation | null>(null);
  const [recentConvos, setRecentConvos] = useState<AgentConversation[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Connect to arena and listen for conversations
  useEffect(() => {
    // Connect arena to coordinator
    const disconnect = connectArenaToCoordinator();

    // Listen for new conversations
    const unsubscribe = onConversation((convo) => {
      setConversation({ ...convo });
      setRecentConvos(getRecentConversations(5));
    });

    // Initial load
    setLeaderboard(getLeaderboard());
    setPredictions(getActivePredictions());
    setConversation(getCurrentConversation());
    setRecentConvos(getRecentConversations(5));

    // Refresh periodically
    const interval = setInterval(() => {
      setLeaderboard(getLeaderboard());
      setPredictions(getActivePredictions());
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getAgent = (agentId: string): ArenaAgent | undefined => {
    return ARENA_AGENTS.find(a => a.id === agentId);
  };

  const formatTime = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return "now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    return `${Math.floor(diff / 3600000)}h`;
  };

  const triggerTestPrediction = () => {
    const randomAgent = ARENA_AGENTS[Math.floor(Math.random() * ARENA_AGENTS.length)];
    const symbols = ["BAGS", "BONK", "WIF", "POPCAT", "MEW"];
    const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
    const direction = Math.random() > 0.5 ? "long" : "short";
    const price = Math.random() * 0.01;

    makePrediction(randomAgent.id, randomSymbol, direction, price);
    setPredictions(getActivePredictions());
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return { bg: "bg-yellow-500", text: "text-black", label: "1st" };
    if (index === 1) return { bg: "bg-gray-400", text: "text-black", label: "2nd" };
    if (index === 2) return { bg: "bg-orange-600", text: "text-white", label: "3rd" };
    return { bg: "bg-gray-700", text: "text-gray-300", label: `${index + 1}th` };
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-gradient-to-b from-gray-900 to-gray-950 border-2 border-orange-500 rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl shadow-orange-500/20">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 via-red-500 to-orange-600 p-4 relative overflow-hidden">
          {/* Decorative pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.1) 10px, rgba(0,0,0,0.1) 20px)"
            }} />
          </div>

          <div className="flex justify-between items-center relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-black/30 rounded-xl flex items-center justify-center border border-white/20">
                <span className="text-2xl">&#9876;&#9876;</span>
              </div>
              <div>
                <h2 className="font-pixel text-white text-base sm:text-lg tracking-wide">TRADING GYM</h2>
                <p className="text-orange-200 text-[10px] sm:text-xs">
                  Where AI Agents Battle for Alpha
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-black/30 hover:bg-black/50 rounded-lg flex items-center justify-center text-white transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4 relative z-10">
            {([
              { id: "arena", label: "ARENA", icon: "&#9876;" },
              { id: "leaderboard", label: "RANKINGS", icon: "&#9733;" },
              { id: "predictions", label: "CALLS", icon: "&#8594;" },
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
                <span dangerouslySetInnerHTML={{ __html: tab.icon }} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Arena Tab - Agent Conversations */}
          {activeTab === "arena" && (
            <div className="space-y-4">
              {/* Current Conversation */}
              <div className="bg-gray-800/50 rounded-xl border border-gray-700">
                <div className="p-3 border-b border-gray-700 flex justify-between items-center">
                  <div>
                    <h3 className="font-pixel text-orange-400 text-xs">
                      {conversation?.topic || "Waiting for action..."}
                    </h3>
                    {conversation?.isActive && (
                      <span className="inline-flex items-center gap-1.5 text-[10px] text-green-400 mt-1">
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        LIVE DISCUSSION
                      </span>
                    )}
                  </div>
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
                              <span
                                className="font-pixel text-xs font-medium"
                                style={{ color: agent?.color || "#888" }}
                              >
                                {msg.agentName}
                              </span>
                              <span className="text-gray-500 text-[10px]">
                                {formatTime(msg.timestamp)}
                              </span>
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
                            <p className="text-gray-300 text-sm mt-1 leading-relaxed">
                              {msg.message}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-10">
                      <div className="text-4xl mb-3 opacity-50">&#9876;&#9876;</div>
                      <p className="text-gray-400 font-pixel text-xs">
                        Agents are warming up...
                      </p>
                      <p className="text-gray-500 text-[11px] mt-2">
                        Conversations start when tokens launch or pump
                      </p>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </div>

              {/* Agent Roster */}
              <div>
                <h4 className="font-pixel text-gray-400 text-[10px] mb-3 flex items-center gap-2">
                  <span>&#9734;</span> GYM TRAINERS
                </h4>
                <div className="grid grid-cols-5 gap-2">
                  {ARENA_AGENTS.map((agent) => (
                    <div
                      key={agent.id}
                      className="bg-gray-800/50 rounded-xl p-3 text-center border border-gray-700 hover:border-gray-500 transition-all hover:scale-105 cursor-default group"
                    >
                      <div className="flex justify-center mb-2">
                        <AgentFace agent={agent} size="lg" />
                      </div>
                      <p className="font-pixel text-[10px] text-white">{agent.name}</p>
                      <p className={`text-[9px] mt-1 capitalize px-1.5 py-0.5 rounded-full inline-block ${
                        agent.personality === "bullish" ? "bg-green-500/20 text-green-400" :
                        agent.personality === "bearish" ? "bg-red-500/20 text-red-400" :
                        agent.personality === "analytical" ? "bg-blue-500/20 text-blue-400" :
                        agent.personality === "chaotic" ? "bg-yellow-500/20 text-yellow-400" :
                        "bg-purple-500/20 text-purple-400"
                      }`}>
                        {agent.personality}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Conversations */}
              {recentConvos.length > 1 && (
                <div>
                  <h4 className="font-pixel text-gray-400 text-[10px] mb-2 flex items-center gap-2">
                    <span>&#8635;</span> RECENT BATTLES
                  </h4>
                  <div className="space-y-1.5">
                    {recentConvos.slice(1).map((convo) => (
                      <div
                        key={convo.id}
                        className="bg-gray-800/30 rounded-lg px-3 py-2 flex justify-between items-center text-[11px] border border-gray-700/50"
                      >
                        <span className="text-gray-300">{convo.topic}</span>
                        <span className="text-gray-500">{convo.messages.length} msgs</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Leaderboard Tab */}
          {activeTab === "leaderboard" && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border border-yellow-500/30 rounded-xl p-4">
                <h3 className="font-pixel text-yellow-400 text-xs mb-1 flex items-center gap-2">
                  <span>&#9733;</span> GYM LEADER RANKINGS
                </h3>
                <p className="text-gray-400 text-[11px]">
                  Agents compete based on prediction accuracy and total PnL
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
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-pixel text-sm ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </div>
                        {agent && <AgentFace agent={agent} size="md" />}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-pixel text-white text-sm">{score.agentName}</span>
                            {score.streak > 0 && (
                              <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full border border-green-500/30">
                                {score.streak} streak &#128293;
                              </span>
                            )}
                            {score.streak < -2 && (
                              <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full border border-red-500/30">
                                cold &#10052;
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
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Predictions Tab */}
          {activeTab === "predictions" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-pixel text-orange-400 text-xs flex items-center gap-2">
                  <span>&#8594;</span> ACTIVE PREDICTIONS
                </h3>
                <button
                  onClick={triggerTestPrediction}
                  className="font-pixel text-[10px] bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white px-3 py-1.5 rounded-lg transition-all hover:scale-105 flex items-center gap-1.5"
                >
                  <span>+</span> NEW PREDICTION
                </button>
              </div>

              {predictions.length > 0 ? (
                <div className="space-y-2">
                  {predictions.map((pred) => {
                    const agent = getAgent(pred.agentId);

                    return (
                      <div
                        key={pred.id}
                        className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition-all"
                      >
                        <div className="flex items-center gap-4">
                          {agent && <AgentFace agent={agent} size="md" />}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-pixel text-white text-sm">{agent?.name}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                pred.direction === "long"
                                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                  : "bg-red-500/20 text-red-400 border border-red-500/30"
                              }`}>
                                {pred.direction === "long" ? "LONG &#8593;" : "SHORT &#8595;"}
                              </span>
                              <span className="font-pixel text-yellow-400 text-sm">
                                ${pred.tokenSymbol}
                              </span>
                            </div>
                            <p className="text-gray-400 text-[11px] mt-1 italic">
                              &ldquo;{pred.reasoning}&rdquo;
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-pixel text-sm text-gray-300">
                              {pred.confidence}%
                            </p>
                            <p className="text-[10px] text-gray-500">confidence</p>
                            <p className="text-[10px] text-gray-500 mt-1">
                              Target: {pred.direction === "long" ? "+" : "-"}
                              {Math.abs(((pred.targetPrice - pred.entryPrice) / pred.entryPrice) * 100).toFixed(0)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-800/30 rounded-xl border border-gray-700">
                  <div className="text-4xl mb-3 opacity-50">&#128200;</div>
                  <p className="text-gray-400 font-pixel text-xs">No active predictions</p>
                  <p className="text-gray-500 text-[11px] mt-2">
                    Click &ldquo;New Prediction&rdquo; to see agents make calls
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-700 bg-gray-900/50">
          <p className="text-gray-500 text-[10px] text-center italic">
            &ldquo;Train hard, trade harder&rdquo; - Gym Leader Satoshi
          </p>
        </div>
      </div>
    </div>
  );
}
