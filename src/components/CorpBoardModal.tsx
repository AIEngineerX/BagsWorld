"use client";

import { useState, useEffect, useRef } from "react";
import { BAGSWORLD_AGENTS } from "@/lib/agent-data";
import { CorpTaskBoard } from "./CorpTaskBoard";

// ============================================================================
// Corp Board Modal — Bags.fm Corp org chart + live A2A task board
// Org chart: static from agent-data (matches corps.ts FOUNDING_CORP)
// Task board: fetched from API using real ROLE_TASK_PREFERENCES logic
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

          {/* C-Suite Row */}
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

          {/* A2A Task Board — real data from API */}
          <CorpTaskBoard selectedAgent={selectedAgent} onSelectAgent={setSelectedAgent} />

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
