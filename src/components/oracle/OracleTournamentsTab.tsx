"use client";

interface Tournament {
  id: number;
  name: string;
  description?: string;
  startTime: string;
  endTime: string;
  status: string;
  prizePool: { sol: number; lamports: string };
  scoringType: string;
  maxParticipants?: number;
  participantCount?: number;
}

interface LeaderboardEntry {
  rank: number;
  wallet: string;
  walletShort: string;
  score: number;
  marketsEntered: number;
  marketsWon: number;
}

interface OracleTournamentsTabProps {
  tournaments: Tournament[];
  activeTournament?: Tournament;
  leaderboard: LeaderboardEntry[];
  wallet?: string;
  onJoin: (tournamentId: number) => Promise<void>;
  isJoining: boolean;
  hasJoined: boolean;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimeRemaining(endTime: string): string {
  const ms = Math.max(0, new Date(endTime).getTime() - Date.now());
  if (ms <= 0) return "ENDED";
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function OracleTournamentsTab({
  tournaments,
  activeTournament,
  leaderboard,
  wallet,
  onJoin,
  isJoining,
  hasJoined,
}: OracleTournamentsTabProps) {
  if (!activeTournament && tournaments.length === 0) {
    return (
      <div className="rpg-border-inner bg-[#1a1a1a] p-6 text-center">
        <p className="font-pixel text-[#a855f7] text-sm glow-text">NO TOURNAMENTS</p>
        <p className="font-pixel text-[#666] text-[10px] mt-2">
          Tournaments are created by admins with real SOL prizes.
        </p>
        <p className="font-pixel text-[#444] text-[9px] mt-1">Free entry, real rewards!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Active Tournament */}
      {activeTournament && (
        <div className="rpg-border-inner bg-[#1a1a1a]">
          <div className="p-3 border-b-2 border-[#2e1065] bg-gradient-to-r from-[#166534]/20 to-transparent">
            <div className="flex items-center justify-between">
              <span className="font-pixel text-[#22c55e] text-[10px] glow-green animate-pulse">
                ACTIVE
              </span>
              <span className="font-pixel text-[#22c55e] text-[10px] glow-green">
                {formatTimeRemaining(activeTournament.endTime)}
              </span>
            </div>
            <p className="font-pixel text-white text-sm mt-1">{activeTournament.name}</p>
            {activeTournament.description && (
              <p className="font-pixel text-[#888] text-[9px] mt-1">
                {activeTournament.description}
              </p>
            )}
          </div>

          <div className="p-3">
            {/* Prize Pool */}
            <div className="rpg-border-inner bg-[#0d0d0d] p-2 mb-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="font-pixel text-[#666] text-[8px]">PRIZE</p>
                  <p className="font-pixel text-[#fbbf24] text-sm">
                    {activeTournament.prizePool.sol} SOL
                  </p>
                </div>
                <div>
                  <p className="font-pixel text-[#666] text-[8px]">SCORING</p>
                  <p className="font-pixel text-white text-[10px]">
                    {activeTournament.scoringType === "op_earned"
                      ? "OP Earned"
                      : activeTournament.scoringType === "win_count"
                        ? "Wins"
                        : "Accuracy"}
                  </p>
                </div>
                <div>
                  <p className="font-pixel text-[#666] text-[8px]">ENTRY</p>
                  <p className="font-pixel text-[#22c55e] text-[10px]">FREE</p>
                </div>
              </div>
            </div>

            {/* Join Button */}
            {wallet && !hasJoined && (
              <button
                onClick={() => onJoin(activeTournament.id)}
                disabled={isJoining}
                className="w-full font-pixel text-[10px] py-2 rpg-button !bg-gradient-to-b !from-[#166534] !to-[#14532d] mb-3"
              >
                {isJoining ? "JOINING..." : "JOIN TOURNAMENT (FREE)"}
              </button>
            )}
            {hasJoined && (
              <div className="rpg-border-inner bg-[#166534]/10 p-2 text-center mb-3">
                <p className="font-pixel text-[#22c55e] text-[10px] glow-green">ENTERED</p>
              </div>
            )}

            {/* Mini Leaderboard */}
            {leaderboard.length > 0 && (
              <div>
                <p className="font-pixel text-[#a855f7] text-[9px] mb-1 glow-text">LEADERBOARD</p>
                <div className="space-y-1">
                  {leaderboard.slice(0, 5).map((entry) => {
                    const isUser = wallet && entry.wallet === wallet;
                    return (
                      <div
                        key={entry.wallet}
                        className={`flex items-center gap-2 p-1.5 rpg-border-inner ${
                          isUser ? "bg-[#6b21a8]/20" : "bg-[#0d0d0d]"
                        }`}
                      >
                        <span
                          className={`font-pixel text-[9px] w-4 text-center ${
                            entry.rank <= 3 ? "text-[#fbbf24]" : "text-[#666]"
                          }`}
                        >
                          {entry.rank}
                        </span>
                        <span className="font-pixel text-white text-[10px] flex-1">
                          {isUser ? "YOU" : entry.walletShort}
                        </span>
                        <span className="font-pixel text-[#a855f7] text-[10px]">
                          {entry.score} pts
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upcoming Tournaments */}
      {tournaments
        .filter((t) => t.status === "upcoming")
        .map((tournament) => (
          <div key={tournament.id} className="rpg-border-inner bg-[#1a1a1a] p-3">
            <div className="flex items-center justify-between">
              <span className="font-pixel text-[#fbbf24] text-[9px]">UPCOMING</span>
              <span className="font-pixel text-[#666] text-[9px]">
                Starts {formatDate(tournament.startTime)}
              </span>
            </div>
            <p className="font-pixel text-white text-xs mt-1">{tournament.name}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="font-pixel text-[#fbbf24] text-[10px]">
                {tournament.prizePool.sol} SOL
              </span>
              <span className="font-pixel text-[#22c55e] text-[9px]">FREE ENTRY</span>
            </div>
          </div>
        ))}
    </div>
  );
}
