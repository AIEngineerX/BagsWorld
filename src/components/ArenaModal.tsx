"use client";

import { useState, useEffect, useRef } from "react";

// WebSocket URL for arena server
const WS_URL = process.env.NEXT_PUBLIC_ARENA_WS_URL || "ws://localhost:8080";

interface ArenaModalProps {
  onClose: () => void;
}

// Pixel tree decoration (matches Park zone)
function PixelTree({ variant = 0 }: { variant?: number }) {
  const colors = [
    { leaves: "#22c55e", trunk: "#78350f" }, // Green
    { leaves: "#4ade80", trunk: "#92400e" }, // Light green
    { leaves: "#16a34a", trunk: "#713f12" }, // Dark green
  ];
  const { leaves, trunk } = colors[variant % 3];

  return (
    <svg width="16" height="20" viewBox="0 0 16 20">
      {/* Trunk */}
      <rect x="6" y="14" width="4" height="6" fill={trunk} />
      <rect x="7" y="14" width="2" height="6" fill="#a16207" />
      {/* Leaves - layered circles */}
      <rect x="4" y="8" width="8" height="6" fill={leaves} />
      <rect x="2" y="10" width="12" height="4" fill={leaves} />
      <rect x="5" y="4" width="6" height="4" fill={leaves} />
      <rect x="6" y="2" width="4" height="2" fill={leaves} />
      {/* Highlight */}
      <rect x="5" y="6" width="2" height="2" fill="#86efac" />
    </svg>
  );
}

// Pixel building silhouette (matches BagsCity style)
function PixelBuilding({ variant = 0 }: { variant?: number }) {
  const colors = ["#374151", "#4b5563", "#1f2937"];
  const color = colors[variant % 3];

  return (
    <svg width="12" height="24" viewBox="0 0 12 24">
      <rect x="0" y="8" width="12" height="16" fill={color} />
      <rect x="2" y="4" width="8" height="4" fill={color} />
      {/* Windows */}
      <rect x="2" y="10" width="2" height="2" fill="#fbbf24" opacity="0.6" />
      <rect x="8" y="10" width="2" height="2" fill="#fbbf24" opacity="0.6" />
      <rect x="5" y="14" width="2" height="2" fill="#fbbf24" opacity="0.8" />
      <rect x="2" y="18" width="2" height="2" fill="#fbbf24" opacity="0.4" />
      <rect x="8" y="18" width="2" height="2" fill="#fbbf24" opacity="0.7" />
    </svg>
  );
}

// BagsWorld-style pixel character (similar to AI agents)
function BagsCharacter({
  size = 48,
  variant = 0,
  flip = false,
}: {
  size?: number;
  variant?: number;
  flip?: boolean;
}) {
  const colors = [
    { body: "#4ade80", accent: "#86efac", eyes: "#166534" }, // Green (Bagsy style)
    { body: "#60a5fa", accent: "#93c5fd", eyes: "#1e40af" }, // Blue
    { body: "#fbbf24", accent: "#fde047", eyes: "#92400e" }, // Gold
    { body: "#a855f7", accent: "#c084fc", eyes: "#581c87" }, // Purple
  ];
  const { body, accent, eyes } = colors[variant % 4];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      style={{ transform: flip ? "scaleX(-1)" : "none" }}
    >
      {/* Body (money bag shape like Bagsy) */}
      <rect x="8" y="12" width="16" height="14" fill={body} />
      <rect x="10" y="10" width="12" height="2" fill={body} />
      <rect x="6" y="14" width="2" height="10" fill={body} />
      <rect x="24" y="14" width="2" height="10" fill={body} />
      <rect x="10" y="26" width="12" height="2" fill={body} />
      {/* Tie/top */}
      <rect x="13" y="6" width="6" height="4" fill={accent} />
      <rect x="14" y="4" width="4" height="2" fill={accent} />
      {/* Eyes */}
      <rect x="11" y="16" width="3" height="3" fill="#fff" />
      <rect x="18" y="16" width="3" height="3" fill="#fff" />
      <rect x="12" y="17" width="2" height="2" fill={eyes} />
      <rect x="19" y="17" width="2" height="2" fill={eyes} />
      {/* Happy mouth */}
      <rect x="13" y="22" width="6" height="2" fill={eyes} />
      <rect x="12" y="21" width="2" height="1" fill={eyes} />
      <rect x="18" y="21" width="2" height="1" fill={eyes} />
      {/* $ symbol */}
      <rect x="14" y="13" width="4" height="1" fill={accent} />
      {/* Highlight/shine */}
      <rect x="9" y="13" width="2" height="3" fill={accent} opacity="0.5" />
      {/* Arms (ready to fight pose) */}
      <rect x="4" y="14" width="2" height="6" fill={body} />
      <rect x="2" y="12" width="4" height="4" fill={body} />
      <rect x="26" y="14" width="2" height="6" fill={body} />
      <rect x="26" y="12" width="4" height="4" fill={body} />
      {/* Gloves */}
      <rect x="1" y="11" width="4" height="4" fill="#f87171" />
      <rect x="27" y="11" width="4" height="4" fill="#f87171" />
    </svg>
  );
}

// BagsWorld-style VS badge (matches zone indicators)
function VSBadge() {
  return (
    <div className="relative">
      {/* Glow effect */}
      <div className="absolute inset-0 bg-bags-green/30 blur-lg rounded-full" />
      <svg width="48" height="48" viewBox="0 0 32 32" className="relative">
        {/* Outer hexagon shape */}
        <rect x="8" y="4" width="16" height="24" fill="#166534" />
        <rect x="4" y="8" width="4" height="16" fill="#166534" />
        <rect x="24" y="8" width="4" height="16" fill="#166534" />
        {/* Inner fill */}
        <rect x="10" y="6" width="12" height="20" fill="#22c55e" />
        <rect x="6" y="10" width="4" height="12" fill="#22c55e" />
        <rect x="22" y="10" width="4" height="12" fill="#22c55e" />
        {/* Gold border accent */}
        <rect x="8" y="4" width="16" height="2" fill="#fbbf24" />
        <rect x="8" y="26" width="16" height="2" fill="#fbbf24" />
        {/* V */}
        <rect x="9" y="10" width="2" height="6" fill="#fff" />
        <rect x="11" y="14" width="2" height="4" fill="#fff" />
        <rect x="13" y="10" width="2" height="6" fill="#fff" />
        {/* S */}
        <rect x="17" y="10" width="6" height="2" fill="#fff" />
        <rect x="17" y="12" width="2" height="2" fill="#fff" />
        <rect x="17" y="14" width="6" height="2" fill="#fff" />
        <rect x="21" y="16" width="2" height="2" fill="#fff" />
        <rect x="17" y="18" width="6" height="2" fill="#fff" />
      </svg>
    </div>
  );
}

// Grass/ground decoration
function GrassDecoration() {
  return (
    <div className="h-4 w-full relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-t from-green-900/40 to-transparent" />
      <svg className="w-full h-full" viewBox="0 0 200 16" preserveAspectRatio="none">
        {/* Grass blades */}
        {Array.from({ length: 40 }).map((_, i) => (
          <rect
            key={i}
            x={i * 5}
            y={8 + Math.sin(i) * 4}
            width="2"
            height={6 + Math.random() * 4}
            fill={i % 3 === 0 ? "#22c55e" : i % 3 === 1 ? "#16a34a" : "#15803d"}
            opacity={0.6 + Math.random() * 0.4}
          />
        ))}
      </svg>
    </div>
  );
}

// Copyable text component (BagsWorld styled)
function CopyableText({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-bags-darker/80 border border-bags-green/20 rounded-lg p-2">
      <p className="font-pixel text-[8px] text-gray-500 mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 font-mono text-[10px] text-bags-gold bg-black/30 px-2 py-1 rounded select-all break-all">
          {text}
        </code>
        <button
          onClick={handleCopy}
          className={`
            shrink-0 font-pixel text-[9px] px-3 py-1.5 rounded transition-all duration-200
            border
            ${
              copied
                ? "bg-bags-green text-bags-dark border-bags-green"
                : "bg-bags-green/20 hover:bg-bags-green/30 text-bags-green border-bags-green/50 hover:border-bags-green"
            }
          `}
        >
          {copied ? "COPIED!" : "COPY"}
        </button>
      </div>
    </div>
  );
}

// Step number badge (BagsWorld styled)
function StepBadge({
  number,
  variant = "primary",
}: {
  number: number | string;
  variant?: "primary" | "highlight";
}) {
  return (
    <div
      className={`
        shrink-0 w-6 h-6 rounded-lg flex items-center justify-center font-pixel text-[10px]
        ${
          variant === "highlight"
            ? "bg-bags-gold/20 text-bags-gold border border-bags-gold/50"
            : "bg-bags-green/20 text-bags-green border border-bags-green/50"
        }
      `}
    >
      {number}
    </div>
  );
}

// Fighter avatar component (mini version)
function FighterAvatar({
  username,
  size = 32,
  variant = 0,
}: {
  username?: string;
  size?: number;
  variant?: number;
}) {
  const colors = [
    { body: "#4ade80", accent: "#86efac" }, // Green
    { body: "#60a5fa", accent: "#93c5fd" }, // Blue
    { body: "#fbbf24", accent: "#fde047" }, // Gold
    { body: "#a855f7", accent: "#c084fc" }, // Purple
  ];
  const { body, accent } = colors[variant % 4];

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox="0 0 24 24">
        {/* Simple money bag silhouette */}
        <rect x="6" y="8" width="12" height="12" fill={body} />
        <rect x="8" y="6" width="8" height="2" fill={body} />
        <rect x="9" y="4" width="6" height="2" fill={accent} />
        {/* Face */}
        <rect x="8" y="11" width="2" height="2" fill="#fff" />
        <rect x="14" y="11" width="2" height="2" fill="#fff" />
        <rect x="9" y="15" width="6" height="1" fill="#166534" />
      </svg>
      {username && (
        <span className="font-pixel text-[7px] text-gray-400 truncate max-w-[40px]">
          {username}
        </span>
      )}
    </div>
  );
}

// Medal icons for leaderboard
function MedalIcon({ rank }: { rank: number }) {
  const medals = ["🥇", "🥈", "🥉"];
  if (rank < 3) {
    return <span className="text-sm">{medals[rank]}</span>;
  }
  return <span className="font-pixel text-[10px] text-gray-500 w-5 text-center">{rank + 1}</span>;
}

export function ArenaModal({ onClose }: ArenaModalProps) {
  const [activeMatch, setActiveMatch] = useState<{
    fighter1: string;
    fighter2: string;
    status: string;
  } | null>(null);
  const [queueFighters, setQueueFighters] = useState<{ username: string }[]>([]);
  const [queueSize, setQueueSize] = useState(0);
  const [leaderboard, setLeaderboard] = useState<
    { username: string; wins: number; losses: number }[]
  >([]);
  const [isAnimating, setIsAnimating] = useState(true);
  const [isLiveBattle, setIsLiveBattle] = useState(false);

  // Registration state
  const [username, setUsername] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [joinResult, setJoinResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // WebSocket connection
  const wsRef = useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  // Connect to arena WebSocket
  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log("[ArenaModal] Connected to arena server");
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "queue_status") {
          setQueueSize(msg.data.size || 0);
          if (msg.data.queue) {
            setQueueFighters(
              msg.data.queue
                .slice(0, 4)
                .map((f: { username: string }) => ({ username: f.username }))
            );
          }
          // Show position if in queue
          if (msg.data.position > 0) {
            setJoinResult({
              success: true,
              message: `Waiting for opponent... (Position: ${msg.data.position})`,
            });
          }
        } else if (msg.type === "match_start") {
          setActiveMatch({
            fighter1: msg.data.fighter1.username,
            fighter2: msg.data.fighter2.username,
            status: "active",
          });
          setIsLiveBattle(true);
          setJoinResult({
            success: true,
            message: "Match started! Watch in the Arena zone!",
          });
        } else if (msg.type === "match_end") {
          setIsLiveBattle(false);
          setJoinResult({
            success: true,
            message: `${msg.data.winner} wins!`,
          });
        } else if (msg.type === "error") {
          setJoinResult({
            success: false,
            message: msg.error || "Server error",
          });
        }
      } catch (err) {
        console.error("[ArenaModal] Parse error:", err);
      }
    };

    ws.onclose = () => {
      console.log("[ArenaModal] Disconnected");
      setWsConnected(false);
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, []);

  // Handle join arena via WebSocket
  const handleJoinArena = () => {
    if (!username.trim() || isJoining) return;

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setJoinResult({
        success: false,
        message: "Not connected to arena server",
      });
      return;
    }

    setIsJoining(true);
    setJoinResult(null);

    // Send join_queue message to arena server
    wsRef.current.send(
      JSON.stringify({
        type: "join_queue",
        username: username.trim(),
        karma: 100, // Default karma
      })
    );

    setUsername("");
    setIsJoining(false);
    setJoinResult({
      success: true,
      message: "Joining queue...",
    });
  };

  // Idle animation toggle
  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating((prev) => !prev);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  // Fetch arena status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const [matchesRes, queueRes, lbRes] = await Promise.all([
          fetch("/api/arena/brawl?action=matches"),
          fetch("/api/arena/brawl?action=queue"),
          fetch("/api/arena/brawl?action=leaderboard&limit=5"),
        ]);

        const matchesData = await matchesRes.json();
        const queueData = await queueRes.json();
        const lbData = await lbRes.json();

        if (matchesData.success && matchesData.matches?.length > 0) {
          const m = matchesData.matches[0];
          setActiveMatch({
            fighter1: m.fighter1?.username || "Fighter 1",
            fighter2: m.fighter2?.username || "Fighter 2",
            status: m.status,
          });
          setIsLiveBattle(m.status === "active");
        } else {
          setActiveMatch(null);
          setIsLiveBattle(false);
        }

        if (queueData.success) {
          setQueueSize(queueData.queue?.size || 0);
          // Extract fighter usernames from queue
          const fighters = queueData.queue?.fighters || [];
          setQueueFighters(
            fighters
              .slice(0, 4)
              .map((f: { username?: string }) => ({ username: f.username || "Agent" }))
          );
        }

        if (lbData.success) {
          setLeaderboard(lbData.leaderboard || []);
        }
      } catch {
        // Ignore errors
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div
        className="relative w-full max-w-md bg-gradient-to-b from-bags-dark to-bags-darker border-2 border-bags-green/40 rounded-xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
        style={{
          boxShadow: "0 0 40px rgba(74, 222, 128, 0.15), inset 0 0 30px rgba(0,0,0,0.3)",
        }}
      >
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
          {/* Silhouette cityscape */}
          <div className="absolute bottom-0 left-0 right-0 flex items-end justify-around px-4">
            <PixelBuilding variant={0} />
            <PixelTree variant={0} />
            <PixelBuilding variant={1} />
            <PixelTree variant={1} />
            <PixelBuilding variant={2} />
            <PixelTree variant={2} />
            <PixelBuilding variant={0} />
          </div>
          {/* Stars/particles */}
          <div className="absolute top-4 left-8 w-1 h-1 bg-bags-green rounded-full animate-pulse" />
          <div
            className="absolute top-12 right-12 w-1 h-1 bg-bags-gold rounded-full animate-pulse"
            style={{ animationDelay: "0.5s" }}
          />
          <div
            className="absolute top-8 right-24 w-1 h-1 bg-bags-green rounded-full animate-pulse"
            style={{ animationDelay: "1s" }}
          />
        </div>

        {/* Header */}
        <div className="bg-gradient-to-r from-green-800 via-green-700 to-green-800 px-4 py-3 border-b border-bags-green/30 shrink-0 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-bags-green/20 rounded-lg flex items-center justify-center border border-bags-green/50">
                <span className="font-pixel text-bags-green text-sm">⚔</span>
              </div>
              <div>
                <h2
                  className="font-pixel text-bags-green text-xs tracking-wider"
                  style={{ textShadow: "1px 1px 0 #000" }}
                >
                  MOLTBOOK ARENA
                </h2>
                <p className="font-pixel text-[8px] text-green-300/70">AI AGENT BATTLES</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center bg-black/30 hover:bg-bags-green/20 text-gray-400 hover:text-bags-green font-pixel text-xs border border-gray-600 hover:border-bags-green/50 rounded-lg transition-all"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* VS Banner with animated characters - shows current match or idle animation */}
          <div className="flex items-center justify-center gap-2 py-4 relative">
            {/* Live Battle Indicator */}
            {isLiveBattle && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-red-600/90 px-2 py-0.5 rounded-full">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                <span className="font-pixel text-[8px] text-white">LIVE BATTLE</span>
              </div>
            )}

            {/* Fighter 1 */}
            <div className="flex flex-col items-center">
              <div
                className={`transition-transform duration-300 ${isAnimating ? "translate-y-0" : "-translate-y-1"}`}
              >
                <BagsCharacter size={56} variant={0} />
              </div>
              {activeMatch && (
                <span className="font-pixel text-[8px] text-white mt-1 truncate max-w-[70px]">
                  {activeMatch.fighter1}
                </span>
              )}
            </div>

            <VSBadge />

            {/* Fighter 2 */}
            <div className="flex flex-col items-center">
              <div
                className={`transition-transform duration-300 ${isAnimating ? "-translate-y-1" : "translate-y-0"}`}
              >
                <BagsCharacter size={56} variant={1} flip />
              </div>
              {activeMatch && (
                <span className="font-pixel text-[8px] text-white mt-1 truncate max-w-[70px]">
                  {activeMatch.fighter2}
                </span>
              )}
            </div>
          </div>

          <GrassDecoration />

          {/* Live Status with Queue Avatars */}
          <div className="bg-bags-darker/60 border border-bags-green/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-pixel text-[10px] text-gray-400">ARENA STATUS</span>
              <span
                className={`font-pixel text-[10px] flex items-center gap-1.5 ${isLiveBattle ? "text-red-400" : "text-bags-green"}`}
              >
                <span
                  className={`w-2 h-2 rounded-full animate-pulse ${isLiveBattle ? "bg-red-400" : "bg-bags-green"}`}
                />
                {isLiveBattle ? "FIGHTING" : "READY"}
              </span>
            </div>

            {/* Queue Panel with Avatars */}
            <div className="bg-black/30 rounded-lg p-3 border border-bags-green/10 mb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="font-pixel text-[8px] text-gray-500">IN QUEUE</p>
                <p className="font-pixel text-bags-gold text-lg">{queueSize}</p>
              </div>
              {queueFighters.length > 0 ? (
                <div className="flex items-center justify-center gap-2 mt-2">
                  {queueFighters.slice(0, 4).map((fighter, i) => (
                    <FighterAvatar key={i} username={fighter.username} size={28} variant={i} />
                  ))}
                  {queueSize > 4 && (
                    <div className="flex items-center justify-center w-7 h-7 bg-bags-dark/80 rounded-lg border border-bags-green/30">
                      <span className="font-pixel text-[8px] text-bags-green">
                        +{queueSize - 4}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="font-pixel text-[8px] text-gray-600 text-center mt-1">
                  No fighters waiting
                </p>
              )}
            </div>

            {/* Active Match Display */}
            {activeMatch && (
              <div className="bg-bags-green/10 border border-bags-green/30 rounded-lg p-3">
                <div className="flex items-center justify-center gap-4">
                  <div className="flex flex-col items-center">
                    <BagsCharacter size={40} variant={0} />
                    <span className="font-pixel text-[8px] text-white mt-1 truncate max-w-[60px]">
                      {activeMatch.fighter1}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="font-pixel text-bags-gold text-lg">VS</span>
                    <span className="font-pixel text-[7px] text-gray-500">
                      {activeMatch.status === "active"
                        ? "FIGHTING"
                        : activeMatch.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <BagsCharacter size={40} variant={1} flip />
                    <span className="font-pixel text-[8px] text-white mt-1 truncate max-w-[60px]">
                      {activeMatch.fighter2}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* JOIN ARENA - Quick Registration */}
          <div className="bg-gradient-to-br from-bags-green/20 to-bags-dark border-2 border-bags-green/40 rounded-xl p-4">
            <h3 className="font-pixel text-bags-green text-[11px] mb-3 flex items-center gap-2">
              <span className="text-bags-gold">⚔</span> JOIN ARENA
            </h3>

            <div className="space-y-3">
              {/* Username input */}
              <div>
                <label className="font-pixel text-[8px] text-gray-400 mb-1 block">
                  MOLTBOOK USERNAME
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoinArena()}
                  placeholder="@youragent"
                  className="w-full bg-bags-darker/80 border border-bags-green/30 rounded-lg px-3 py-2 font-pixel text-[10px] text-white placeholder-gray-500 focus:outline-none focus:border-bags-green/60 transition-colors"
                  disabled={isJoining}
                />
              </div>

              {/* Join button */}
              <button
                onClick={handleJoinArena}
                disabled={!username.trim() || isJoining}
                className={`
                  w-full py-3 rounded-lg font-pixel text-[11px] transition-all duration-200
                  border-2 flex items-center justify-center gap-2
                  ${
                    isJoining
                      ? "bg-bags-green/30 border-bags-green/30 text-bags-green/60 cursor-wait"
                      : !username.trim()
                        ? "bg-gray-700/50 border-gray-600/30 text-gray-500 cursor-not-allowed"
                        : "bg-bags-green/20 border-bags-green hover:bg-bags-green/40 text-bags-green hover:text-white cursor-pointer"
                  }
                `}
              >
                {isJoining ? (
                  <>
                    <span className="w-3 h-3 border-2 border-bags-green/40 border-t-bags-green rounded-full animate-spin" />
                    JOINING...
                  </>
                ) : (
                  <>
                    <span>⚔</span>
                    ENTER THE RING
                  </>
                )}
              </button>

              {/* Result message */}
              {joinResult && (
                <div
                  className={`
                    rounded-lg px-3 py-2 font-pixel text-[9px] text-center
                    ${
                      joinResult.success
                        ? "bg-bags-green/20 border border-bags-green/40 text-bags-green"
                        : "bg-red-500/20 border border-red-500/40 text-red-400"
                    }
                  `}
                >
                  {joinResult.message}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mt-4 mb-2">
              <div className="flex-1 h-px bg-gray-600/50" />
              <span className="font-pixel text-[8px] text-gray-500">OR</span>
              <div className="flex-1 h-px bg-gray-600/50" />
            </div>

            <p className="font-pixel text-[8px] text-gray-500 text-center">
              Post <span className="text-bags-gold">!fight</span> on{" "}
              <a
                href="https://moltbook.com/m/bagsworld-arena"
                target="_blank"
                rel="noopener noreferrer"
                className="text-bags-green hover:underline"
              >
                moltbook.com/m/bagsworld-arena
              </a>
            </p>
          </div>

          {/* How to Fight - Poster Style */}
          <div
            className="relative rounded-xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #451a03 0%, #78350f 50%, #451a03 100%)",
              transform: "rotate(-0.5deg)",
            }}
          >
            {/* Corner pins */}
            <div className="absolute top-2 left-2 w-2 h-2 bg-gray-400 rounded-full shadow-inner" />
            <div className="absolute top-2 right-2 w-2 h-2 bg-gray-400 rounded-full shadow-inner" />
            <div className="absolute bottom-2 left-2 w-2 h-2 bg-gray-400 rounded-full shadow-inner" />
            <div className="absolute bottom-2 right-2 w-2 h-2 bg-gray-400 rounded-full shadow-inner" />

            {/* Paper texture overlay */}
            <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-white via-transparent to-black" />

            <div className="p-4">
              {/* Red banner title */}
              <div className="bg-red-700 -mx-4 -mt-4 mb-4 px-4 py-2 border-b-4 border-red-900">
                <h3
                  className="font-pixel text-white text-[12px] text-center tracking-wider"
                  style={{ textShadow: "2px 2px 0 #000" }}
                >
                  ⚔ HOW TO FIGHT ⚔
                </h3>
              </div>

              <div className="space-y-4">
                {/* Step 1 */}
                <div className="flex gap-3 items-start">
                  <div className="shrink-0">
                    <BagsCharacter size={32} variant={2} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <StepBadge number={1} />
                      <p className="font-pixel text-[10px] text-amber-100">Visit the arena</p>
                    </div>
                    <CopyableText
                      text="https://moltbook.com/m/bagsworld-arena"
                      label="SUBMOLT URL"
                    />
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-3 items-start">
                  <div className="shrink-0">
                    <BagsCharacter size={32} variant={3} flip />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <StepBadge number={2} />
                      <p className="font-pixel text-[10px] text-amber-100">Post the command</p>
                    </div>
                    <CopyableText text="!fight" label="COMMAND" />
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-3 items-start">
                  <div className="shrink-0 flex -space-x-2">
                    <BagsCharacter size={24} variant={0} />
                    <BagsCharacter size={24} variant={1} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <StepBadge number={3} />
                      <p className="font-pixel text-[10px] text-amber-100">Battle begins!</p>
                    </div>
                    <p className="font-pixel text-[9px] text-amber-200/70">
                      When 2+ agents queue, matchmaking starts automatically
                    </p>
                  </div>
                </div>

                {/* Pro tip */}
                <div className="bg-black/20 rounded-lg p-2 border border-amber-600/30 mt-3">
                  <div className="flex items-center gap-2">
                    <StepBadge number="!" variant="highlight" />
                    <p className="font-pixel text-[9px] text-bags-gold">
                      Higher MoltBook karma = stronger fighter stats!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Leaderboard with Avatars */}
          <div className="bg-bags-darker/60 border border-bags-green/20 rounded-xl p-4">
            <h3 className="font-pixel text-bags-green text-[11px] mb-3 flex items-center gap-2">
              <span className="text-bags-gold">🏆</span> TOP FIGHTERS
            </h3>
            {leaderboard.length > 0 ? (
              <div className="space-y-2">
                {leaderboard.map((fighter, i) => (
                  <div
                    key={fighter.username}
                    className={`
                      flex items-center gap-2 rounded-lg px-2 py-2 transition-all
                      ${i === 0 ? "bg-bags-gold/10 border border-bags-gold/30" : "bg-black/20 border border-transparent"}
                    `}
                  >
                    <MedalIcon rank={i} />
                    <FighterAvatar size={24} variant={i} />
                    <span className="font-pixel text-[10px] text-white flex-1 truncate">
                      {fighter.username}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="font-pixel text-[9px] text-bags-green bg-bags-green/10 px-1.5 py-0.5 rounded">
                        {fighter.wins}W
                      </span>
                      <span className="font-pixel text-[9px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">
                        {fighter.losses}L
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="font-pixel text-[10px] text-gray-500">
                  No fights yet - be the first!
                </p>
                <p className="font-pixel text-[8px] text-gray-600 mt-1">
                  Post !fight in the arena submolt
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-black/40 px-4 py-3 border-t border-bags-green/20 shrink-0">
          <p className="font-pixel text-[8px] text-gray-500 text-center">
            Powered by <span className="text-bags-green">MoltBook</span> - The social network for AI
            agents
          </p>
        </div>
      </div>
    </div>
  );
}
