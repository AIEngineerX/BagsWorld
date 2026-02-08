"use client";

interface ProfileData {
  wallet: string;
  opBalance: number;
  totalOpEarned: number;
  totalOpSpent: number;
  reputationScore: number;
  reputationTier: string;
  tierBonus: string;
  currentStreak: number;
  bestStreak: number;
  totalMarketsEntered: number;
  totalMarketsWon: number;
  winRate: number;
  achievements: Record<string, { unlockedAt: string; opAwarded: number }>;
  canClaimDaily: boolean;
  nextDailyClaimAt?: string | null;
}

interface LedgerEntry {
  id: number;
  amount: number;
  balanceAfter: number;
  txType: string;
  referenceId?: number;
  createdAt: string;
}

interface OracleProfileTabProps {
  profile: ProfileData | null;
  ledger: LedgerEntry[];
  onClaimDaily: () => Promise<void>;
  isClaiming: boolean;
  walletConnected: boolean;
  onConnectWallet: () => void;
}

const TIER_COLORS: Record<string, string> = {
  novice: "#9ca3af",
  seer: "#a855f7",
  oracle: "#fbbf24",
  master: "#ef4444",
};

const TIER_ICONS: Record<string, string> = {
  novice: "◇",
  seer: "★",
  oracle: "☀",
  master: "♛",
};

const TX_TYPE_LABELS: Record<string, string> = {
  signup_bonus: "Welcome Bonus",
  daily_claim: "Daily Claim",
  prediction_entry: "Prediction Entry",
  prediction_win: "Prediction Win",
  participation: "Participation",
  streak_bonus: "Streak Bonus",
  achievement: "Achievement",
};

const ACHIEVEMENT_LABELS: Record<string, { name: string; desc: string }> = {
  first_victory: { name: "First Victory", desc: "Win your first market" },
  hot_streak: { name: "Hot Streak", desc: "Win 5 in a row" },
  oracle_vision: { name: "Oracle Vision", desc: "Win 10 in a row" },
  underdog: { name: "Underdog", desc: "Win with <15% odds" },
  daily_devotion: { name: "Daily Devotion", desc: "7-day claim streak" },
  market_maker: { name: "Market Maker", desc: "Enter 50 markets" },
};

function formatTimeUntil(dateStr: string): string {
  const ms = Math.max(0, new Date(dateStr).getTime() - Date.now());
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function OracleProfileTab({
  profile,
  ledger,
  onClaimDaily,
  isClaiming,
  walletConnected,
  onConnectWallet,
}: OracleProfileTabProps) {
  if (!walletConnected) {
    return (
      <div className="rpg-border-inner bg-[#1a1a1a] p-6 text-center">
        <p className="font-pixel text-[#a855f7] text-sm glow-text">CONNECT WALLET</p>
        <p className="font-pixel text-[#666] text-[10px] mt-2">
          Connect your wallet to view your Oracle profile
        </p>
        <button
          onClick={onConnectWallet}
          className="mt-4 font-pixel text-[10px] px-4 py-2 rpg-button glow-text"
        >
          CONNECT
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rpg-border-inner bg-[#1a1a1a] p-6 text-center">
        <p className="font-pixel text-[#666] text-xs">Loading profile...</p>
      </div>
    );
  }

  const tierColor = TIER_COLORS[profile.reputationTier] || "#666";
  const tierIcon = TIER_ICONS[profile.reputationTier] || "◇";

  return (
    <div className="space-y-3">
      {/* OP Balance */}
      <div className="rpg-border-inner bg-[#1a1a2e] p-4 text-center animate-[glow-pulse_3s_ease-in-out_infinite]">
        <p className="font-pixel text-[#666] text-[9px]">ORACLE POINTS</p>
        <p className="font-pixel text-[#a855f7] text-2xl glow-text">
          {profile.opBalance.toLocaleString()}
        </p>
        <p className="font-pixel text-[#666] text-[8px] mt-1">OP</p>
      </div>

      {/* Daily Claim */}
      <div className="rpg-border-inner bg-[#1a1a1a] p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-pixel text-[#a855f7] text-[10px] glow-text">DAILY BONUS</p>
            <p className="font-pixel text-[#666] text-[8px] mt-0.5">+50 OP every 24h</p>
          </div>
          {profile.canClaimDaily ? (
            <button
              onClick={onClaimDaily}
              disabled={isClaiming}
              className="font-pixel text-[10px] px-3 py-1.5 rpg-button !bg-gradient-to-b !from-[#166534] !to-[#14532d]"
            >
              {isClaiming ? "..." : "CLAIM"}
            </button>
          ) : (
            <span className="font-pixel text-[#666] text-[9px]">
              {profile.nextDailyClaimAt ? formatTimeUntil(profile.nextDailyClaimAt) : "Claimed"}
            </span>
          )}
        </div>
      </div>

      {/* Reputation & Stats */}
      <div className="rpg-border-inner bg-[#1a1a1a] p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="font-pixel text-lg" style={{ color: tierColor }}>
              {tierIcon}
            </span>
            <div>
              <p className="font-pixel text-xs" style={{ color: tierColor }}>
                {profile.reputationTier.toUpperCase()}
              </p>
              <p className="font-pixel text-[#666] text-[8px]">
                {profile.reputationScore} ELO · {profile.tierBonus} bonus
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rpg-border-inner bg-[#0d0d0d] p-2">
            <p className="font-pixel text-[#666] text-[8px]">PREDICTIONS</p>
            <p className="font-pixel text-white text-xs">{profile.totalMarketsEntered}</p>
          </div>
          <div className="rpg-border-inner bg-[#0d0d0d] p-2">
            <p className="font-pixel text-[#666] text-[8px]">WINS</p>
            <p className="font-pixel text-[#22c55e] text-xs">{profile.totalMarketsWon}</p>
          </div>
          <div className="rpg-border-inner bg-[#0d0d0d] p-2">
            <p className="font-pixel text-[#666] text-[8px]">WIN RATE</p>
            <p className="font-pixel text-[#a855f7] text-xs">{profile.winRate}%</p>
          </div>
          <div className="rpg-border-inner bg-[#0d0d0d] p-2">
            <p className="font-pixel text-[#666] text-[8px]">STREAK</p>
            <p className="font-pixel text-[#fbbf24] text-xs">
              {profile.currentStreak} 🔥 (best: {profile.bestStreak})
            </p>
          </div>
        </div>
      </div>

      {/* Achievements */}
      <div className="rpg-border-inner bg-[#1a1a1a] p-3">
        <p className="font-pixel text-[#a855f7] text-[10px] mb-2 glow-text">ACHIEVEMENTS</p>
        <div className="grid grid-cols-2 gap-1">
          {Object.entries(ACHIEVEMENT_LABELS).map(([id, info]) => {
            const unlocked = profile.achievements[id];
            return (
              <div
                key={id}
                className={`rpg-border-inner p-1.5 ${
                  unlocked ? "bg-[#166534]/10" : "bg-[#0d0d0d] opacity-40"
                }`}
              >
                <p
                  className={`font-pixel text-[9px] ${unlocked ? "text-[#22c55e]" : "text-[#666]"}`}
                >
                  {unlocked ? "✓ " : ""}
                  {info.name}
                </p>
                <p className="font-pixel text-[#444] text-[7px]">{info.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* OP History */}
      <div className="rpg-border-inner bg-[#1a1a1a] p-3">
        <p className="font-pixel text-[#a855f7] text-[10px] mb-2 glow-text">OP HISTORY</p>
        {ledger.length === 0 ? (
          <p className="font-pixel text-[#666] text-[9px] text-center">No transactions yet</p>
        ) : (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {ledger.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between py-1 border-b border-[#2e1065]/30"
              >
                <div>
                  <p className="font-pixel text-white text-[9px]">
                    {TX_TYPE_LABELS[entry.txType] || entry.txType}
                  </p>
                  <p className="font-pixel text-[#444] text-[7px]">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`font-pixel text-[10px] ${
                    entry.amount >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"
                  }`}
                >
                  {entry.amount >= 0 ? "+" : ""}
                  {entry.amount}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
