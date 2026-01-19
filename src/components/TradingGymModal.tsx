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
  type ConversationMessage,
} from "@/lib/agent-arena";

interface TradingGymModalProps {
  onClose: () => void;
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

  const getAgentColor = (agentId: string): string => {
    const agent = ARENA_AGENTS.find(a => a.id === agentId);
    return agent?.color || "#888888";
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

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-bags-dark border-2 border-orange-500 rounded-lg max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header - Pokemon Gym Style */}
        <div className="bg-gradient-to-r from-orange-600 via-red-500 to-orange-600 p-3 sm:p-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-black/30 rounded-full flex items-center justify-center">
                <span className="text-2xl">&#9876;</span>
              </div>
              <div>
                <h2 className="font-pixel text-white text-sm sm:text-base">TRADING GYM</h2>
                <p className="font-pixel text-orange-200 text-[8px] sm:text-[10px]">
                  Where AI Agents Battle for Alpha
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-orange-200 text-xl font-bold p-2"
              aria-label="Close"
            >
              x
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-3">
            {(["arena", "leaderboard", "predictions"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`font-pixel text-[10px] px-3 py-1.5 rounded transition-colors ${
                  activeTab === tab
                    ? "bg-black/40 text-white"
                    : "bg-black/20 text-orange-200 hover:bg-black/30"
                }`}
              >
                {tab === "arena" ? "AGENT ARENA" : tab === "leaderboard" ? "RANKINGS" : "PREDICTIONS"}
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
              <div className="bg-bags-darker rounded-lg border border-orange-500/30">
                <div className="p-3 border-b border-orange-500/30 flex justify-between items-center">
                  <div>
                    <h3 className="font-pixel text-orange-400 text-xs">
                      {conversation?.topic || "Waiting for action..."}
                    </h3>
                    {conversation?.isActive && (
                      <span className="inline-flex items-center gap-1 text-[8px] text-green-400">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                        LIVE
                      </span>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <div className="p-3 max-h-64 overflow-y-auto space-y-3">
                  {conversation?.messages && conversation.messages.length > 0 ? (
                    conversation.messages.map((msg) => (
                      <div key={msg.id} className="flex gap-2">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                          style={{ backgroundColor: getAgentColor(msg.agentId) }}
                        >
                          {msg.agentName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="font-pixel text-xs"
                              style={{ color: getAgentColor(msg.agentId) }}
                            >
                              {msg.agentName}
                            </span>
                            <span className="text-gray-500 text-[8px]">
                              {formatTime(msg.timestamp)}
                            </span>
                            {msg.sentiment && (
                              <span className={`text-[8px] px-1 rounded ${
                                msg.sentiment === "bullish" ? "bg-green-900/50 text-green-400" :
                                msg.sentiment === "bearish" ? "bg-red-900/50 text-red-400" :
                                "bg-gray-800 text-gray-400"
                              }`}>
                                {msg.sentiment}
                              </span>
                            )}
                          </div>
                          <p className="text-gray-300 text-sm mt-0.5 break-words">
                            {msg.message}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500 font-pixel text-xs">
                        Agents are warming up...
                      </p>
                      <p className="text-gray-600 text-[10px] mt-1">
                        Conversations start when tokens launch or pump
                      </p>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </div>

              {/* Agent Roster */}
              <div>
                <h4 className="font-pixel text-gray-400 text-[10px] mb-2">GYM TRAINERS</h4>
                <div className="grid grid-cols-5 gap-2">
                  {ARENA_AGENTS.map((agent) => (
                    <div
                      key={agent.id}
                      className="bg-bags-darker rounded p-2 text-center border border-gray-700 hover:border-gray-500 transition-colors"
                    >
                      <div
                        className="w-8 h-8 rounded-full mx-auto flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: agent.color }}
                      >
                        {agent.avatar}
                      </div>
                      <p className="font-pixel text-[8px] text-gray-300 mt-1">{agent.name}</p>
                      <p className="text-[7px] text-gray-500 capitalize">{agent.personality}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Conversations */}
              {recentConvos.length > 1 && (
                <div>
                  <h4 className="font-pixel text-gray-400 text-[10px] mb-2">RECENT BATTLES</h4>
                  <div className="space-y-1">
                    {recentConvos.slice(1).map((convo) => (
                      <div
                        key={convo.id}
                        className="bg-bags-darker rounded p-2 flex justify-between items-center text-[10px]"
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
            <div className="space-y-3">
              <div className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-500/50 rounded-lg p-3">
                <h3 className="font-pixel text-yellow-400 text-xs mb-1">GYM LEADER RANKINGS</h3>
                <p className="text-gray-400 text-[10px]">
                  Agents compete based on prediction accuracy and total PnL
                </p>
              </div>

              <div className="space-y-2">
                {leaderboard.map((score, index) => {
                  const agent = ARENA_AGENTS.find(a => a.id === score.agentId);
                  const medal = index === 0 ? "1st" : index === 1 ? "2nd" : index === 2 ? "3rd" : `${index + 1}th`;

                  return (
                    <div
                      key={score.agentId}
                      className={`bg-bags-darker rounded-lg p-3 border ${
                        index === 0 ? "border-yellow-500/50" :
                        index === 1 ? "border-gray-400/50" :
                        index === 2 ? "border-orange-700/50" :
                        "border-gray-700"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          index === 0 ? "bg-yellow-500 text-black" :
                          index === 1 ? "bg-gray-400 text-black" :
                          index === 2 ? "bg-orange-700 text-white" :
                          "bg-gray-700 text-gray-300"
                        }`}>
                          {medal}
                        </div>
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: agent?.color }}
                        >
                          {agent?.avatar}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-pixel text-white text-xs">{score.agentName}</span>
                            {score.streak > 0 && (
                              <span className="text-[8px] bg-green-900/50 text-green-400 px-1 rounded">
                                {score.streak} streak
                              </span>
                            )}
                          </div>
                          <p className="text-gray-500 text-[10px] capitalize">
                            {agent?.tradingStyle}
                          </p>
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

          {/* Predictions Tab */}
          {activeTab === "predictions" && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-pixel text-orange-400 text-xs">ACTIVE PREDICTIONS</h3>
                <button
                  onClick={triggerTestPrediction}
                  className="font-pixel text-[8px] bg-orange-600 hover:bg-orange-500 text-white px-2 py-1 rounded"
                >
                  + NEW PREDICTION
                </button>
              </div>

              {predictions.length > 0 ? (
                <div className="space-y-2">
                  {predictions.map((pred) => {
                    const agent = ARENA_AGENTS.find(a => a.id === pred.agentId);

                    return (
                      <div
                        key={pred.id}
                        className="bg-bags-darker rounded-lg p-3 border border-gray-700"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                            style={{ backgroundColor: agent?.color }}
                          >
                            {agent?.avatar}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-pixel text-white text-xs">{agent?.name}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                pred.direction === "long"
                                  ? "bg-green-900/50 text-green-400"
                                  : "bg-red-900/50 text-red-400"
                              }`}>
                                {pred.direction.toUpperCase()}
                              </span>
                              <span className="font-pixel text-yellow-400 text-xs">
                                ${pred.tokenSymbol}
                              </span>
                            </div>
                            <p className="text-gray-500 text-[10px] mt-0.5">
                              {pred.reasoning}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-pixel text-xs text-gray-300">
                              {pred.confidence}% conf
                            </p>
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
                <div className="text-center py-8 bg-bags-darker rounded-lg">
                  <p className="text-gray-500 font-pixel text-xs">No active predictions</p>
                  <p className="text-gray-600 text-[10px] mt-1">
                    Click &quot;New Prediction&quot; to see agents make calls
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-orange-500/30 bg-black/30">
          <p className="font-pixel text-gray-500 text-[8px] text-center">
            &quot;Train hard, trade harder&quot; - Gym Leader Satoshi
          </p>
        </div>
      </div>
    </div>
  );
}
