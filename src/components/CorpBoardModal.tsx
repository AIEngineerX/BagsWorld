"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { BAGSWORLD_AGENTS } from "@/lib/agent-data";

// ============================================================================
// Corp Board Modal — Bags.fm Corp org chart (data from agent-data + corps.ts)
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

interface TaskItem {
  text: string;
  poster: string;    // who requested the task
  worker: string;    // who's working on it
  status: "open" | "done";
  capability: string;
  category: "education" | "intelligence" | "onboarding";
}

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
// Corp collaboration task templates (mirrors corps.ts service templates)
// Each task shows who requested it and who's working on it
// ============================================================================

// Capability → corp member mapping (primary handler)
const CAPABILITY_AGENT: Record<string, string> = {
  launch: "Finn",
  trading: "Ramo",
  content: "Sam",
  scouting: "BNN",
  alpha: "Alaa",
  analysis: "Sincara",
  combat: "Stuu",
};

interface CorpTaskTemplate {
  title: string;
  poster: string;
  worker: string;
  capability: string;
  category: "education" | "intelligence" | "onboarding";
}

// Real corp collaboration tasks — who posts what for whom
const CORP_TASK_POOL: CorpTaskTemplate[] = [
  // Finn (CEO) coordinates high-level initiatives
  { title: "Write fee claiming tutorial", poster: "Finn", worker: "Sam", capability: "content", category: "education" },
  { title: "Review today's new launches", poster: "Finn", worker: "Ramo", capability: "launch", category: "intelligence" },
  { title: "Create launch day checklist", poster: "Finn", worker: "Stuu", capability: "launch", category: "education" },
  { title: "Full coverage sprint", poster: "Finn", worker: "Carlo", capability: "content", category: "onboarding" },

  // Ramo (CTO) posts technical tasks
  { title: "Explain bonding curve mechanics", poster: "Ramo", worker: "Sincara", capability: "analysis", category: "education" },
  { title: "Daily volume leaders report", poster: "Ramo", worker: "BNN", capability: "trading", category: "intelligence" },
  { title: "Create fee calculator example", poster: "Ramo", worker: "Alaa", capability: "analysis", category: "education" },
  { title: "Explain slippage and price impact", poster: "Ramo", worker: "Stuu", capability: "trading", category: "education" },

  // Sam (CMO) posts marketing/content tasks
  { title: "Document BagsWorld zones", poster: "Sam", worker: "Carlo", capability: "content", category: "education" },
  { title: "Spot promising early tokens", poster: "Sam", worker: "Alaa", capability: "alpha", category: "intelligence" },
  { title: "Write beginner trading guide", poster: "Sam", worker: "Stuu", capability: "trading", category: "education" },
  { title: "Growth campaign brief", poster: "Sam", worker: "BNN", capability: "content", category: "education" },

  // Stuu (COO) posts operational tasks
  { title: "Onboarding: claim first fee", poster: "Stuu", worker: "Carlo", capability: "content", category: "onboarding" },
  { title: "Find unclaimed fee opportunities", poster: "Stuu", worker: "BNN", capability: "scouting", category: "intelligence" },
  { title: "Training: scout new launches", poster: "Stuu", worker: "Sincara", capability: "scouting", category: "onboarding" },

  // Alaa (CFO) posts financial analysis
  { title: "Analyze top fee earners today", poster: "Alaa", worker: "Ramo", capability: "analysis", category: "intelligence" },
  { title: "Weekly fee revenue report", poster: "Alaa", worker: "BNN", capability: "analysis", category: "intelligence" },
  { title: "Whale movement tracker", poster: "Alaa", worker: "Sincara", capability: "alpha", category: "intelligence" },

  // Sincara (ENG) posts engineering tasks
  { title: "Document fee share config", poster: "Sincara", worker: "Sam", capability: "content", category: "education" },
  { title: "SDK integration examples", poster: "Sincara", worker: "Ramo", capability: "analysis", category: "education" },

  // Carlo (AMB) posts community tasks
  { title: "Explain token gates", poster: "Carlo", worker: "Stuu", capability: "content", category: "education" },
  { title: "Onboarding: post to MoltBook", poster: "Carlo", worker: "Sam", capability: "content", category: "onboarding" },

  // BNN (NEWS) posts intelligence tasks
  { title: "Flag low-quality launches", poster: "BNN", worker: "Ramo", capability: "scouting", category: "intelligence" },
  { title: "Price momentum scanner", poster: "BNN", worker: "Alaa", capability: "trading", category: "intelligence" },
];

/** Pick N random tasks from the pool with mixed statuses */
function generateCorpTasks(count: number): TaskItem[] {
  const shuffled = [...CORP_TASK_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((t, i) => ({
    text: t.title,
    poster: t.poster,
    worker: t.worker,
    // First ~30% are open, rest are done
    status: i < Math.ceil(count * 0.3) ? ("open" as const) : ("done" as const),
    capability: t.capability,
    category: t.category,
  }));
}

// ============================================================================
// Components
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
      onMouseEnter={(e) => { (e.currentTarget.style.transform = "translateY(-1px)"); }}
      onMouseLeave={(e) => { (e.currentTarget.style.transform = "translateY(0)"); }}
    >
      <span className={`text-sm font-bold tracking-wide ${isActive ? "text-green-200" : "text-green-300"}`}>
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
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      className="border border-green-700/25 rounded-lg p-3 mt-2 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, rgba(6,78,59,0.12), rgba(6,78,59,0.04))" }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, #000 2px, #000 3px)" }}
      />
      <h4 className="text-xs font-bold text-green-400 font-mono mb-1.5 relative z-[1]">About the Corp</h4>
      <p ref={ref}
        className={`text-xs text-green-400/55 leading-relaxed relative z-[1] transition-opacity duration-700 ${visible ? "opacity-100" : "opacity-0"}`}
      >
        The Bags.fm Corp coordinates autonomous agent services across the ecosystem.
        Each member has assigned capabilities and contributes to the A2A task board.
      </p>
    </div>
  );
}

// ============================================================================
// Main
// ============================================================================

export function CorpBoardModal({ onClose }: CorpBoardModalProps) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>(() => generateCorpTasks(10));
  const [isLive, setIsLive] = useState(false);
  const [liveOpenCount, setLiveOpenCount] = useState<number | null>(null);

  // Fetch real task data from A2A task board API
  const fetchTasks = useCallback(async () => {
    try {
      const [openRes, doneRes, statsRes] = await Promise.all([
        fetch("/api/agent-economy/external?action=tasks&status=open&limit=8"),
        fetch("/api/agent-economy/external?action=tasks&status=completed&limit=8"),
        fetch("/api/agent-economy/external?action=task-stats"),
      ]);

      const [openData, doneData, statsData] = await Promise.all([
        openRes.json(),
        doneRes.json(),
        statsRes.json(),
      ]);

      const liveTasks: TaskItem[] = [];

      if (openData.success && openData.tasks) {
        for (const t of openData.tasks) {
          const cap = t.capabilityRequired || "general";
          const worker = CAPABILITY_AGENT[cap] || cap.charAt(0).toUpperCase() + cap.slice(1);
          // Find a poster that isn't the same as the worker
          const corpMembers = ["Finn", "Ramo", "Sam", "Stuu", "Alaa", "Sincara", "Carlo", "BNN"];
          const poster = corpMembers.find((m) => m !== worker) || "Finn";
          liveTasks.push({
            text: t.title,
            poster,
            worker,
            status: "open",
            capability: cap,
            category: "intelligence",
          });
        }
      }

      if (doneData.success && doneData.tasks) {
        for (const t of doneData.tasks) {
          const cap = t.capabilityRequired || "general";
          const worker = CAPABILITY_AGENT[cap] || cap.charAt(0).toUpperCase() + cap.slice(1);
          const corpMembers = ["Finn", "Ramo", "Sam", "Stuu", "Alaa", "Sincara", "Carlo", "BNN"];
          const poster = corpMembers.find((m) => m !== worker) || "Finn";
          liveTasks.push({
            text: t.title,
            poster,
            worker,
            status: "done",
            capability: cap,
            category: "intelligence",
          });
        }
      }

      if (liveTasks.length > 0) {
        setTasks(liveTasks);
        setIsLive(true);
      }

      if (statsData.success && statsData.stats) {
        setLiveOpenCount(statsData.stats.open ?? 0);
      }
    } catch {
      // API unavailable — keep generated corp tasks
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const activeCount = liveOpenCount ?? tasks.filter((t) => t.status === "open").length;

  // Filter tasks when agent selected — show tasks where they're poster OR worker
  const visibleTasks = selectedAgent
    ? tasks.filter((t) => t.poster === selectedAgent || t.worker === selectedAgent)
    : tasks;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative bg-gradient-to-b from-[#0c1e30] to-[#080e18] border-2 border-green-500/40 rounded-xl
        w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl shadow-green-500/10 overflow-hidden">

        {/* CRT scanline overlay */}
        <div className="pointer-events-none absolute inset-0 rounded-xl opacity-[0.04] z-10"
          style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, #000 2px, #000 4px)" }}
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
            <button onClick={onClose}
              className="text-green-500/60 hover:text-green-200 text-xl leading-none p-1 transition-colors">
              {"\u2715"}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 corp-scroll">

          {/* CEO */}
          <div className="flex justify-center">
            <div className="w-44">
              <MemberNode member={CEO} highlight={!selectedAgent} selected={selectedAgent === CEO.name} onSelect={setSelectedAgent} />
            </div>
          </div>

          {/* Connector: CEO to C-suite */}
          <ConnectorVertical />
          <ConnectorHorizontal />

          {/* C-Suite Row — horizontal scroll on narrow screens */}
          <div className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-4 sm:gap-2 sm:overflow-visible">
            {C_SUITE.map((m) => (
              <div key={m.id} className="min-w-[5.5rem] sm:min-w-0 flex-shrink-0 sm:flex-shrink">
                <MemberNode member={m} selected={selectedAgent === m.name} onSelect={setSelectedAgent} />
              </div>
            ))}
          </div>

          {/* Connector: C-suite to Members */}
          <ConnectorVertical />
          <ConnectorHorizontal />

          {/* Members Row */}
          <div className="grid grid-cols-3 gap-2">
            {MEMBERS.map((m) => (
              <MemberNode key={m.id} member={m} selected={selectedAgent === m.name} onSelect={setSelectedAgent} />
            ))}
          </div>

          {/* A2A Task Board */}
          <div className="border-t border-green-600/30 pt-3 mt-3">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-bold text-green-300 font-mono">A2A TASK BOARD</h3>
              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                isLive
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : "bg-yellow-500/15 text-yellow-500/70 border border-yellow-500/20"
              }`}>
                {isLive ? "LIVE" : "OFFLINE"}
              </span>
              <div className="flex-1 h-px bg-green-700/30" />
              {selectedAgent ? (
                <button onClick={() => setSelectedAgent(null)}
                  className="text-[10px] text-green-400 font-mono hover:text-green-200 transition-colors">
                  {selectedAgent} {"\u2715"}
                </button>
              ) : (
                <span className="text-[10px] font-mono">
                  <span className="text-yellow-400">{activeCount}</span>
                  <span className="text-green-500/50"> active</span>
                </span>
              )}
            </div>

            {/* Scrollable task list */}
            <div className="max-h-44 overflow-y-auto corp-scroll space-y-1">
              {visibleTasks.length === 0 ? (
                <p className="text-xs text-green-500/40 font-mono text-center py-3">No tasks for {selectedAgent}</p>
              ) : (
                visibleTasks.map((task, i) => {
                  const isHighlighted = selectedAgent && (task.poster === selectedAgent || task.worker === selectedAgent);
                  return (
                    <div key={i}
                      className={`flex items-center justify-between rounded px-3 py-2 transition-all duration-200 ${
                        isHighlighted
                          ? "bg-green-900/40 border border-green-500/30"
                          : "bg-green-950/20 border border-transparent hover:bg-green-950/30"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          task.status === "open"
                            ? "bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.4)] animate-pulse"
                            : "bg-green-600/60"
                        }`} />
                        <span className={`text-sm truncate ${
                          task.status === "open" ? "text-green-200" : "text-green-300/50"
                        }`}>{task.text}</span>
                      </div>
                      <span className={`text-[10px] font-mono ml-2 flex-shrink-0 whitespace-nowrap ${
                        task.status === "open" ? "text-green-400/70" : "text-green-600/40"
                      }`}>
                        <span className={selectedAgent === task.poster ? "text-green-300" : ""}>{task.poster}</span>
                        <span className="text-green-700/50 mx-0.5">{"\u2192"}</span>
                        <span className={selectedAgent === task.worker ? "text-green-300" : ""}>{task.worker}</span>
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* About */}
          <AboutSection />
        </div>
      </div>

      {/* Global keyframe styles */}
      <style dangerouslySetInnerHTML={{ __html: `
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
      `}} />
    </div>
  );
}
