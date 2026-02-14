"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { BAGSWORLD_AGENTS, getAgentColorClass } from "@/lib/agent-data";
import { CorpTaskBoard } from "./CorpTaskBoard";

// ============================================================================
// Corp Board Modal — Bags.fm Corp org chart + live A2A task board
// Tabs: Board (org chart + tasks) | Activity (feed) | Work Log (per-agent)
// ============================================================================

interface CorpBoardModalProps {
  onClose: () => void;
}

interface CorpMember {
  id: string;
  name: string;
  corpRole: string;
  role: string;
  description: string;
}

interface ActivityEvent {
  taskId: string;
  title: string;
  capability: string;
  status: string;
  posterName: string;
  workerName: string;
  narrative: string | null;
  resultData: Record<string, unknown>;
  rewardSol: number;
  deliveredAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface WorkLogData {
  agentId: string;
  agentName: string;
  agentRole?: string;
  isFoundingMember?: boolean;
  deliveries: Array<{
    title: string;
    capability: string;
    status: string;
    narrative: string | null;
    resultData: Record<string, unknown>;
    completedAt: string | null;
    rewardSol: number;
  }>;
  memories: Array<{
    title: string;
    content: string;
    createdAt: string;
  }>;
}

type TabType = "board" | "activity";

function getAgentData(id: string, corpRole: string): CorpMember {
  const agent = BAGSWORLD_AGENTS.find((a) => a.id === id);
  return {
    id,
    name: agent?.name || id,
    corpRole,
    role: agent?.role || corpRole,
    description: agent?.description || "",
  };
}

function getTimeAgo(isoDate: string): string {
  const timestamp = new Date(isoDate).getTime();
  if (isNaN(timestamp)) return "unknown";
  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) return "just now";
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

const CEO = getAgentData("finn", "CEO");

const C_SUITE: CorpMember[] = [
  getAgentData("ramo", "CTO"),
  getAgentData("sam", "CMO"),
  getAgentData("stuu", "COO"),
  getAgentData("alaa", "CFO"),
];

const MEMBERS: CorpMember[] = [
  getAgentData("sincara", "ENG"),
  getAgentData("carlo", "AMB"),
  getAgentData("bnn", "NEWS"),
];

// ============================================================================
// Sub-Components
// ============================================================================

function MemberNode({
  member,
  highlight,
  selected,
  onSelect,
}: {
  member: CorpMember;
  highlight?: boolean;
  selected: boolean;
  onSelect: (name: string | null) => void;
}) {
  const isActive = selected || highlight;
  return (
    <button
      type="button"
      onClick={() => onSelect(selected ? null : member.name)}
      title={member.role + "\n" + member.description}
      className={`flex flex-col items-center w-full p-2 sm:p-3 rounded-lg border cursor-pointer
        transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-green-400/60
        ${
          isActive
            ? "bg-green-900/50 border-green-400/50 shadow-[0_0_12px_rgba(74,222,128,0.15)]"
            : "bg-green-950/40 border-green-800/30 hover:border-green-500/40 hover:bg-green-900/25 hover:shadow-[0_0_8px_rgba(74,222,128,0.08)]"
        }`}
      style={{ transform: "translateY(0)", transition: "transform 0.2s" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <span
        className={`text-sm font-bold tracking-wide ${isActive ? "text-green-200" : "text-green-300"}`}
      >
        {member.name}
      </span>
      <span className="text-[11px] text-green-400 font-mono mt-0.5">{member.corpRole}</span>
      <span className="text-[10px] text-green-400/55 mt-1 text-center leading-snug w-full break-words hyphens-auto">
        {member.role}
      </span>
    </button>
  );
}

function ConnectorVertical() {
  return (
    <div className="flex justify-center py-0.5">
      <div
        className="w-0.5 h-5 rounded-full"
        style={{
          background: "linear-gradient(to bottom, rgba(74,222,128,0.5), rgba(74,222,128,0.1))",
          animation: "corpFlow 1.8s ease-in-out infinite",
        }}
      />
    </div>
  );
}

function ConnectorHorizontal() {
  return (
    <div
      className="mx-6 h-0.5 rounded-full"
      style={{
        background: "linear-gradient(to right, transparent, rgba(74,222,128,0.35), transparent)",
        animation: "corpFlow 2.2s ease-in-out infinite",
      }}
    />
  );
}

function AboutSection() {
  const ref = useRef<HTMLParagraphElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVisible(true);
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      className="border border-green-700/25 rounded-lg p-3 mt-2 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, rgba(6,78,59,0.12), rgba(6,78,59,0.04))" }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, #000 2px, #000 3px)",
        }}
      />
      <h4 className="text-xs font-bold text-green-400 font-mono mb-1.5 relative z-[1]">
        About the Corp
      </h4>
      <p
        ref={ref}
        className={`text-xs text-green-400/55 leading-relaxed relative z-[1] transition-opacity duration-700 ${visible ? "opacity-100" : "opacity-0"}`}
      >
        The Bags.fm Corp coordinates autonomous agent services across the ecosystem. Each member has
        assigned capabilities and contributes to the A2A task board.
      </p>
    </div>
  );
}

// ============================================================================
// Activity Feed
// ============================================================================

function ActivityFeed({ onViewAgent }: { onViewAgent: (agentId: string) => void }) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFeed() {
      try {
        const res = await fetch("/api/agent-economy/external?action=activity-feed&limit=20");
        const data = await res.json();
        if (data.success && data.events) {
          setEvents(data.events);
        }
      } catch {
        // API unavailable
      } finally {
        setLoading(false);
      }
    }
    fetchFeed();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-5 h-5 border-2 border-green-500/30 border-t-green-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-green-500/40 font-mono">No recent activity</p>
        <p className="text-xs text-green-500/30 font-mono mt-1">
          Agent deliveries will appear here
        </p>
      </div>
    );
  }

  // Resolve agent color from name
  function getColorForName(name: string): string {
    const agent = BAGSWORLD_AGENTS.find(
      (a) => a.name.toLowerCase() === name.toLowerCase() || a.id === name.toLowerCase()
    );
    return agent ? getAgentColorClass(agent.color) : "text-green-300";
  }

  function getAgentIdForName(name: string): string | null {
    const agent = BAGSWORLD_AGENTS.find(
      (a) => a.name.toLowerCase() === name.toLowerCase() || a.id === name.toLowerCase()
    );
    return agent?.id || null;
  }

  return (
    <div className="space-y-1">
      {events.map((event) => {
        const isExpanded = expandedId === event.taskId;
        const workerColor = getColorForName(event.workerName);
        const workerId = getAgentIdForName(event.workerName);
        const timestamp = event.completedAt || event.deliveredAt || event.createdAt;
        const verb = event.status === "completed" ? "completed" : "delivered";
        const snippet = event.narrative
          ? event.narrative.length > 120
            ? event.narrative.slice(0, 120) + "..."
            : event.narrative
          : null;

        return (
          <div key={event.taskId}>
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : event.taskId)}
              className={`w-full text-left rounded-lg px-3 py-2.5 transition-all duration-200 ${
                isExpanded
                  ? "bg-green-900/40 border border-green-500/30"
                  : "bg-green-950/20 border border-transparent hover:bg-green-950/30"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
                    event.status === "completed" ? "bg-green-500" : "bg-orange-400"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (workerId) onViewAgent(workerId);
                      }}
                      className={`text-sm font-bold ${workerColor} hover:underline`}
                    >
                      {event.workerName}
                    </button>
                    <span className="text-sm text-green-400/60">{verb}</span>
                    <span className="text-sm text-green-200 truncate">
                      &ldquo;{event.title}&rdquo;
                    </span>
                  </div>
                  {snippet && !isExpanded && (
                    <p className="text-xs text-green-400/50 mt-0.5 truncate">{snippet}</p>
                  )}
                </div>
                <span className="text-[10px] text-green-500/40 font-mono flex-shrink-0 mt-0.5">
                  {getTimeAgo(timestamp)}
                </span>
              </div>
            </button>

            {/* Expanded view */}
            {isExpanded && (
              <div className="mx-1 px-3 py-2.5 bg-green-900/20 border border-t-0 border-green-700/30 rounded-b-lg space-y-2">
                {event.narrative && (
                  <p className="text-sm text-green-200/90 leading-relaxed">
                    &ldquo;{event.narrative}&rdquo;
                  </p>
                )}
                {event.resultData && Object.keys(event.resultData).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(event.resultData)
                      .filter(([key]) => key !== "narrative" && key !== "summary")
                      .slice(0, 6)
                      .map(([key, val]) => (
                        <span
                          key={key}
                          className="bg-green-800/30 text-green-300 text-[10px] px-2 py-0.5 rounded font-mono"
                        >
                          {key}: {typeof val === "object" ? JSON.stringify(val) : String(val)}
                        </span>
                      ))}
                  </div>
                )}
                <div className="flex items-center gap-2 text-[10px] font-mono text-green-500/50 pt-1">
                  <span>{event.capability}</span>
                  {event.rewardSol > 0 && (
                    <span className="ml-auto text-green-400/60">
                      {event.rewardSol.toFixed(3)} SOL
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Agent Work Log
// ============================================================================

function AgentWorkLog({ agentId, onBack }: { agentId: string; onBack: () => void }) {
  const [data, setData] = useState<WorkLogData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLog() {
      try {
        const res = await fetch(
          `/api/agent-economy/external?action=agent-work-log&agentId=${agentId}`
        );
        const json = await res.json();
        if (json.success) {
          setData(json);
        }
      } catch {
        // API unavailable
      } finally {
        setLoading(false);
      }
    }
    fetchLog();
  }, [agentId]);

  const agentInfo = BAGSWORLD_AGENTS.find((a) => a.id === agentId);
  const nameColor = agentInfo ? getAgentColorClass(agentInfo.color) : "text-green-300";
  const displayName = data?.agentName || agentInfo?.name || agentId;

  return (
    <div className="space-y-3">
      {/* Back button + header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-green-400 hover:text-green-200 font-mono transition-colors"
        >
          {"\u2190"} Back
        </button>
        <div className="flex-1 h-px bg-green-700/30" />
        <h3 className={`text-sm font-bold font-mono ${nameColor}`}>
          {displayName}&apos;s Work Log
        </h3>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-green-500/30 border-t-green-400 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Deliveries */}
          <div>
            <h4 className="text-[11px] font-mono text-green-400/60 uppercase tracking-wider mb-2">
              Recent Deliveries
            </h4>
            {data && data.deliveries.length > 0 ? (
              <div className="space-y-2">
                {data.deliveries.map((d, i) => (
                  <div
                    key={i}
                    className="bg-green-950/20 border border-green-700/30 rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm text-green-200">{d.title}</span>
                      {d.completedAt && (
                        <span className="text-[10px] text-green-500/40 font-mono flex-shrink-0">
                          {getTimeAgo(d.completedAt)}
                        </span>
                      )}
                    </div>
                    {d.narrative && (
                      <p className="text-xs text-green-200/70 leading-relaxed mt-1.5">
                        &ldquo;{d.narrative}&rdquo;
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="bg-green-800/30 text-green-300 text-[10px] px-2 py-0.5 rounded font-mono">
                        {d.capability}
                      </span>
                      {d.rewardSol > 0 && (
                        <span className="text-[10px] text-green-400/50 font-mono">
                          {d.rewardSol.toFixed(3)} SOL
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : data?.isFoundingMember ? (
              <div className="bg-green-950/20 border border-green-700/20 rounded-lg p-3 text-center">
                <p className="text-xs text-green-400/50 font-mono">
                  {displayName} is a founding Bags.fm Corp member
                </p>
                {data.agentRole && (
                  <p className="text-[10px] text-green-500/30 font-mono mt-1">
                    Role: {data.agentRole}
                  </p>
                )}
                <p className="text-[10px] text-green-500/30 font-mono mt-1">
                  Task deliveries appear here when the economy loop is active
                </p>
              </div>
            ) : (
              <p className="text-xs text-green-500/30 font-mono text-center py-3">
                No deliveries yet
              </p>
            )}
          </div>

          {/* Memories */}
          <div>
            <h4 className="text-[11px] font-mono text-green-400/60 uppercase tracking-wider mb-2">
              Memories
            </h4>
            {data && data.memories.length > 0 ? (
              <div className="space-y-1.5">
                {data.memories.map((m, i) => (
                  <div
                    key={i}
                    className="bg-green-950/20 border border-green-700/20 rounded px-3 py-2"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-green-500/40 text-xs flex-shrink-0 mt-0.5">
                        {"\uD83D\uDCAD"}
                      </span>
                      <div className="min-w-0">
                        <span className="text-xs text-green-300">&ldquo;{m.title}&rdquo;</span>
                        {m.content && m.content !== m.title && (
                          <span className="text-xs text-green-400/50">
                            {" "}
                            &mdash; {m.content.slice(0, 80)}
                            {m.content.length > 80 ? "..." : ""}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-green-500/30 font-mono flex-shrink-0">
                        {getTimeAgo(m.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-green-500/30 font-mono text-center py-3">
                No memories stored yet
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Main
// ============================================================================

export function CorpBoardModal({ onClose }: CorpBoardModalProps) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("board");
  const [workLogAgentId, setWorkLogAgentId] = useState<string | null>(null);

  // Handle agent click from org chart
  const handleAgentSelect = useCallback((name: string | null) => {
    setSelectedAgent(name);
  }, []);

  // Open work log for an agent
  const handleViewWorkLog = useCallback((agentId: string) => {
    setWorkLogAgentId(agentId);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative bg-gradient-to-b from-[#0c1e30] to-[#080e18] border-2 border-green-500/40 rounded-t-xl sm:rounded-xl
        w-full max-w-lg max-h-[80vh] sm:max-h-[85vh] flex flex-col shadow-2xl shadow-green-500/10 overflow-hidden"
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-2 pb-1 relative z-20">
          <div className="w-10 h-1 rounded-full bg-white/30" />
        </div>
        {/* CRT scanline overlay */}
        <div
          className="pointer-events-none absolute inset-0 rounded-xl opacity-[0.04] z-10"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, #000 2px, #000 4px)",
          }}
        />

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-green-600/30 bg-green-950/30 flex-shrink-0">
          <div>
            <h2
              className="text-xl font-bold text-green-300 font-mono tracking-wider"
              style={{ animation: "corpGlow 2.5s ease-in-out infinite" }}
            >
              BAGS.FM CORP
            </h2>
            <p className="text-xs text-green-500/70 mt-1 font-mono">Organization Chart</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse shadow-sm shadow-green-400/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
            </div>
            <button
              onClick={onClose}
              className="text-green-500/60 hover:text-green-200 text-xl leading-none w-11 h-11 flex items-center justify-center transition-colors"
            >
              {"\u2715"}
            </button>
          </div>
        </div>

        {/* Tab bar */}
        {!workLogAgentId && (
          <div className="flex border-b border-green-600/30 flex-shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("board")}
              className={`flex-1 py-2 text-xs font-mono font-bold tracking-wider transition-colors ${
                activeTab === "board"
                  ? "text-green-300 border-b-2 border-green-400"
                  : "text-green-500/50 hover:text-green-400/70"
              }`}
            >
              Board
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("activity")}
              className={`flex-1 py-2 text-xs font-mono font-bold tracking-wider transition-colors ${
                activeTab === "activity"
                  ? "text-green-300 border-b-2 border-green-400"
                  : "text-green-500/50 hover:text-green-400/70"
              }`}
            >
              Activity
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 corp-scroll">
          {/* Work Log view — replaces tab content */}
          {workLogAgentId ? (
            <AgentWorkLog agentId={workLogAgentId} onBack={() => setWorkLogAgentId(null)} />
          ) : activeTab === "board" ? (
            <>
              {/* CEO */}
              <div className="flex justify-center">
                <div className="w-44">
                  <MemberNode
                    member={CEO}
                    highlight={!selectedAgent}
                    selected={selectedAgent === CEO.name}
                    onSelect={handleAgentSelect}
                  />
                </div>
              </div>

              {/* Connector: CEO to C-suite */}
              <ConnectorVertical />
              <ConnectorHorizontal />

              {/* C-Suite Row */}
              <div className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-4 sm:gap-2 sm:overflow-visible">
                {C_SUITE.map((m) => (
                  <div
                    key={m.id}
                    className="min-w-[5.5rem] sm:min-w-0 flex-shrink-0 sm:flex-shrink"
                  >
                    <MemberNode
                      member={m}
                      selected={selectedAgent === m.name}
                      onSelect={handleAgentSelect}
                    />
                  </div>
                ))}
              </div>

              {/* Connector: C-suite to Members */}
              <ConnectorVertical />
              <ConnectorHorizontal />

              {/* Members Row */}
              <div className="grid grid-cols-3 gap-2">
                {MEMBERS.map((m) => (
                  <MemberNode
                    key={m.id}
                    member={m}
                    selected={selectedAgent === m.name}
                    onSelect={handleAgentSelect}
                  />
                ))}
              </div>

              {/* View Log link for selected agent */}
              {selectedAgent &&
                (() => {
                  const agent = BAGSWORLD_AGENTS.find(
                    (a) => a.name.toLowerCase() === selectedAgent.toLowerCase()
                  );
                  return agent ? (
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => handleViewWorkLog(agent.id)}
                        className="text-[11px] font-mono text-green-400/70 hover:text-green-300 transition-colors
                        border border-green-700/30 hover:border-green-500/40 rounded px-3 py-1"
                      >
                        View {selectedAgent}&apos;s Work Log {"\u2192"}
                      </button>
                    </div>
                  ) : null;
                })()}

              {/* A2A Task Board — real data from API */}
              <CorpTaskBoard selectedAgent={selectedAgent} onSelectAgent={handleAgentSelect} />

              {/* About */}
              <AboutSection />
            </>
          ) : (
            /* Activity tab */
            <ActivityFeed onViewAgent={handleViewWorkLog} />
          )}
        </div>
      </div>

      {/* Global keyframe styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes corpGlow {
          0%, 100% { text-shadow: 0 0 6px rgba(74,222,128,0.25); }
          50%      { text-shadow: 0 0 14px rgba(74,222,128,0.45); }
        }
        @keyframes corpFlow {
          0%, 100% { opacity: 0.35; }
          50%      { opacity: 0.85; }
        }
        .corp-scroll::-webkit-scrollbar { width: 4px; }
        .corp-scroll::-webkit-scrollbar-track { background: transparent; }
        .corp-scroll::-webkit-scrollbar-thumb {
          background: rgba(74,222,128,0.2);
          border-radius: 2px;
        }
        .corp-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(74,222,128,0.4);
        }
        .corp-scroll { scrollbar-width: thin; scrollbar-color: rgba(74,222,128,0.2) transparent; }
      `,
        }}
      />
    </div>
  );
}
