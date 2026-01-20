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

// Pixel art character configs - cleaner style
const AGENT_STYLES: Record<string, {
  bgColor: string;
  accentColor: string;
  icon: string;
}> = {
  neo: { bgColor: "#0f2419", accentColor: "#22c55e", icon: "N" },
  ghost: { bgColor: "#1e1b2e", accentColor: "#a855f7", icon: "G" },
  finn: { bgColor: "#14231a", accentColor: "#10b981", icon: "F" },
  ash: { bgColor: "#2a1414", accentColor: "#ef4444", icon: "A" },
  toly: { bgColor: "#1e1424", accentColor: "#9945ff", icon: "T" },
};

function TrainerBadge({ agent, size = "md" }: { agent: ArenaAgent; size?: "sm" | "md" | "lg" }) {
  const sizeMap = { sm: 28, md: 40, lg: 52 };
  const pixelSize = sizeMap[size];
  const style = AGENT_STYLES[agent.id] || { bgColor: "#1a1a1a", accentColor: agent.color, icon: agent.name[0] };

  return (
    <div
      className="relative flex-shrink-0 rounded-lg border-2 flex items-center justify-center font-pixel"
      style={{
        width: pixelSize,
        height: pixelSize,
        backgroundColor: style.bgColor,
        borderColor: style.accentColor,
        color: style.accentColor,
        fontSize: size === "sm" ? 10 : size === "md" ? 14 : 18,
      }}
    >
      {style.icon}
      {/* Status dot */}
      <div
        className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-bags-dark"
        style={{ backgroundColor: style.accentColor }}
      />
    </div>
  );
}

export function TradingGymModal({ onClose }: TradingGymModalProps) {
  const [activeTab, setActiveTab] = useState<"arena" | "rankings" | "calls">("arena");
  const [leaderboard, setLeaderboard] = useState<AgentScore[]>([]);
  const [predictions, setPredictions] = useState<TradePrediction[]>([]);
  const [conversation, setConversation] = useState<AgentConversation | null>(null);
  const [recentConvos, setRecentConvos] = useState<AgentConversation[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const disconnect = connectArenaToCoordinator();
    const unsubscribe = onConversation((convo) => {
      setConversation({ ...convo });
      setRecentConvos(getRecentConversations(5));
    });

    setLeaderboard(getLeaderboard());
    setPredictions(getActivePredictions());
    setConversation(getCurrentConversation());
    setRecentConvos(getRecentConversations(5));

    const interval = setInterval(() => {
      setLeaderboard(getLeaderboard());
      setPredictions(getActivePredictions());
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

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

  const getTypeColor = (personality: string) => {
    switch (personality) {
      case "bullish": return { bg: "bg-green-500/20", text: "text-green-400", border: "border-green-500/30" };
      case "bearish": return { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/30" };
      case "analytical": return { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/30" };
      case "chaotic": return { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/30" };
      default: return { bg: "bg-purple-500/20", text: "text-purple-400", border: "border-purple-500/30" };
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-bags-dark border-4 border-amber-600 rounded-lg max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header - Gym Badge style */}
        <div className="bg-gradient-to-r from-amber-700 to-amber-600 p-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-900/50 border-2 border-amber-400 rounded-lg flex items-center justify-center">
                <span className="font-pixel text-amber-300 text-lg">T</span>
              </div>
              <div>
                <h2 className="font-pixel text-white text-sm">TRADING GYM</h2>
                <p className="text-amber-200 text-[10px]">Train with AI Agents</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-amber-900/50 hover:bg-amber-900 rounded-lg flex items-center justify-center text-amber-200 hover:text-white transition-colors font-pixel text-xs"
              aria-label="Close"
            >
              X
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-3">
            {([
              { id: "arena", label: "ARENA" },
              { id: "rankings", label: "RANKINGS" },
              { id: "calls", label: "CALLS" },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`font-pixel text-[10px] px-4 py-1.5 rounded transition-all ${
                  activeTab === tab.id
                    ? "bg-amber-900/80 text-amber-100 border border-amber-400/50"
                    : "bg-amber-900/30 text-amber-300/70 hover:bg-amber-900/50 border border-transparent"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-bags-dark to-bags-darker">
          {/* Arena Tab */}
          {activeTab === "arena" && (
            <div className="space-y-4">
              {/* Battle Area */}
              <div className="bg-bags-darker border-2 border-gray-700 rounded-lg overflow-hidden">
                <div className="p-3 border-b border-gray-700 flex justify-between items-center bg-gray-800/30">
                  <span className="font-pixel text-[11px] text-amber-400">
                    {conversation?.topic || "Waiting for challengers..."}
                  </span>
                  {conversation?.isActive && (
                    <span className="flex items-center gap-1.5 text-[10px] text-green-400">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      LIVE
                    </span>
                  )}
                </div>

                {/* Messages */}
                <div className="p-3 max-h-60 overflow-y-auto space-y-3">
                  {conversation?.messages && conversation.messages.length > 0 ? (
                    conversation.messages.map((msg) => {
                      const agent = getAgent(msg.agentId);
                      return (
                        <div key={msg.id} className="flex gap-3">
                          {agent && <TrainerBadge agent={agent} size="sm" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-pixel text-[11px]" style={{ color: agent?.color || "#888" }}>
                                {msg.agentName}
                              </span>
                              <span className="text-gray-500 text-[10px]">{formatTime(msg.timestamp)}</span>
                              {msg.sentiment && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                                  msg.sentiment === "bullish" ? "bg-green-500/20 text-green-400" :
                                  msg.sentiment === "bearish" ? "bg-red-500/20 text-red-400" :
                                  "bg-gray-500/20 text-gray-400"
                                }`}>
                                  {msg.sentiment.toUpperCase()}
                                </span>
                              )}
                            </div>
                            <p className="text-gray-300 text-[12px] mt-1">{msg.message}</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500 font-pixel text-[11px]">No active discussions</p>
                      <p className="text-gray-600 text-[10px] mt-1">Agents activate when tokens launch or pump</p>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </div>

              {/* Trainers */}
              <div>
                <p className="font-pixel text-[10px] text-amber-400 mb-3">GYM TRAINERS</p>
                <div className="grid grid-cols-5 gap-2">
                  {ARENA_AGENTS.map((agent) => {
                    const typeColor = getTypeColor(agent.personality);
                    return (
                      <div
                        key={agent.id}
                        className="bg-bags-darker border border-gray-700 rounded-lg p-3 text-center hover:border-gray-600 transition-colors"
                      >
                        <div className="flex justify-center mb-2">
                          <TrainerBadge agent={agent} size="lg" />
                        </div>
                        <p className="font-pixel text-[10px] text-white">{agent.name}</p>
                        <p className={`text-[9px] mt-1 px-2 py-0.5 rounded inline-block ${typeColor.bg} ${typeColor.text} border ${typeColor.border}`}>
                          {agent.personality}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent */}
              {recentConvos.length > 1 && (
                <div>
                  <p className="font-pixel text-[10px] text-gray-500 mb-2">RECENT MATCHES</p>
                  <div className="space-y-1">
                    {recentConvos.slice(1).map((convo) => (
                      <div
                        key={convo.id}
                        className="bg-bags-darker border border-gray-700/50 rounded px-3 py-2 flex justify-between items-center text-[11px]"
                      >
                        <span className="text-gray-400 truncate">{convo.topic}</span>
                        <span className="text-gray-600">{convo.messages.length} msgs</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Rankings Tab */}
          {activeTab === "rankings" && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-amber-900/30 to-amber-800/20 border border-amber-500/30 rounded-lg p-3">
                <p className="font-pixel text-amber-400 text-[11px]">TRAINER RANKINGS</p>
                <p className="text-gray-400 text-[10px] mt-1">Based on prediction accuracy and total gains</p>
              </div>

              <div className="space-y-2">
                {leaderboard.map((score, index) => {
                  const agent = getAgent(score.agentId);
                  const rankColors = [
                    { border: "border-amber-400/50", badge: "bg-amber-500 text-black" },
                    { border: "border-gray-400/50", badge: "bg-gray-400 text-black" },
                    { border: "border-amber-700/50", badge: "bg-amber-700 text-white" },
                  ];
                  const rankStyle = rankColors[index] || { border: "border-gray-700", badge: "bg-gray-700 text-gray-300" };

                  return (
                    <div
                      key={score.agentId}
                      className={`bg-bags-darker border-2 rounded-lg p-3 ${rankStyle.border}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded flex items-center justify-center font-pixel text-[11px] ${rankStyle.badge}`}>
                          #{index + 1}
                        </div>
                        {agent && <TrainerBadge agent={agent} size="md" />}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-pixel text-[12px] text-white">{score.agentName}</span>
                            {score.streak > 0 && (
                              <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded border border-green-500/30">
                                +{score.streak} streak
                              </span>
                            )}
                            {score.streak < -2 && (
                              <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30">
                                {score.streak} cold
                              </span>
                            )}
                          </div>
                          <p className="text-gray-500 text-[10px]">{agent?.tradingStyle}</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-pixel text-sm ${score.totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
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

          {/* Calls Tab */}
          {activeTab === "calls" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="font-pixel text-[10px] text-amber-400">ACTIVE CALLS</p>
                <button
                  onClick={triggerTestPrediction}
                  className="font-pixel text-[10px] bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 px-3 py-1.5 rounded border border-amber-500/30 transition-all"
                >
                  [+] NEW CALL
                </button>
              </div>

              {predictions.length > 0 ? (
                <div className="space-y-2">
                  {predictions.map((pred) => {
                    const agent = getAgent(pred.agentId);
                    return (
                      <div
                        key={pred.id}
                        className="bg-bags-darker border-2 border-gray-700 rounded-lg p-3"
                      >
                        <div className="flex items-center gap-3">
                          {agent && <TrainerBadge agent={agent} size="md" />}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-pixel text-[11px] text-white">{agent?.name}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded font-pixel ${
                                pred.direction === "long"
                                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                  : "bg-red-500/20 text-red-400 border border-red-500/30"
                              }`}>
                                {pred.direction.toUpperCase()}
                              </span>
                              <span className="font-pixel text-[11px] text-amber-400">${pred.tokenSymbol}</span>
                            </div>
                            <p className="text-gray-400 text-[11px] mt-1">{pred.reasoning}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-pixel text-sm text-white">{pred.confidence}%</p>
                            <p className="text-[10px] text-gray-500">
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
                <div className="text-center py-10 bg-bags-darker border-2 border-gray-700 rounded-lg">
                  <p className="text-gray-500 font-pixel text-[11px]">No active calls</p>
                  <p className="text-gray-600 text-[10px] mt-1">Click [+] NEW CALL to simulate</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t-2 border-amber-600/50 bg-bags-darker">
          <p className="text-gray-500 text-[10px] text-center">
            Train your trading instincts - not financial advice
          </p>
        </div>
      </div>
    </div>
  );
}
