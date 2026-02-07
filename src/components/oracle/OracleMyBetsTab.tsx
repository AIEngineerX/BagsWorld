"use client";

interface ActiveBet {
  prediction: {
    tokenMint: string;
    outcomeId?: string;
    opWagered: number;
    createdAt: string;
  };
  round: {
    id: number;
    endTime: string;
    marketType: string;
    question?: string;
    tokenOptions: Array<{ mint: string; symbol: string }>;
    marketConfig?: { outcomes?: Array<{ id: string; label: string }> };
  };
}

interface RecentResult {
  prediction: {
    tokenMint: string;
    outcomeId?: string;
    opWagered: number;
    opPayout: number;
    isWinner: boolean;
    rank?: number;
  };
  round: {
    id: number;
    endTime: string;
    marketType: string;
    question?: string;
    tokenOptions: Array<{ mint: string; symbol: string }>;
    marketConfig?: { outcomes?: Array<{ id: string; label: string }> };
    winningTokenMint?: string;
    winningOutcomeId?: string;
  };
}

interface OracleMyBetsTabProps {
  activeBets: ActiveBet[];
  recentResults: RecentResult[];
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "RESOLVING...";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function getChoiceLabel(bet: ActiveBet | RecentResult): string {
  const pred = bet.prediction;
  if (pred.outcomeId && bet.round.marketConfig?.outcomes) {
    return (
      bet.round.marketConfig.outcomes.find((o) => o.id === pred.outcomeId)?.label || pred.outcomeId
    );
  }
  if (pred.tokenMint) {
    return (
      bet.round.tokenOptions.find((t) => t.mint === pred.tokenMint)?.symbol ||
      pred.tokenMint.slice(0, 6)
    );
  }
  return "?";
}

export function OracleMyBetsTab({ activeBets, recentResults }: OracleMyBetsTabProps) {
  const totalOPWon = recentResults.reduce((sum, r) => sum + r.prediction.opPayout, 0);
  const totalOPSpent = recentResults.reduce((sum, r) => sum + r.prediction.opWagered, 0);
  const netOP = totalOPWon - totalOPSpent;
  const winCount = recentResults.filter((r) => r.prediction.isWinner).length;
  const winRate =
    recentResults.length > 0 ? Math.round((winCount / recentResults.length) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Summary Stats */}
      <div className="rpg-border-inner bg-[#1a1a2e] p-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="font-pixel text-[#666] text-[8px]">NET OP</p>
            <p
              className={`font-pixel text-sm ${netOP >= 0 ? "text-[#22c55e] glow-green" : "text-[#ef4444]"}`}
            >
              {netOP >= 0 ? "+" : ""}
              {netOP}
            </p>
          </div>
          <div>
            <p className="font-pixel text-[#666] text-[8px]">WIN RATE</p>
            <p className="font-pixel text-[#a855f7] text-sm">{winRate}%</p>
          </div>
          <div>
            <p className="font-pixel text-[#666] text-[8px]">ACTIVE</p>
            <p className="font-pixel text-white text-sm">{activeBets.length}</p>
          </div>
        </div>
      </div>

      {/* Active Bets */}
      {activeBets.length > 0 && (
        <div>
          <p className="font-pixel text-[#a855f7] text-[10px] mb-2 glow-text">ACTIVE PREDICTIONS</p>
          <div className="space-y-2">
            {activeBets.map((bet) => {
              const endTime = new Date(bet.round.endTime);
              const remainingMs = Math.max(0, endTime.getTime() - Date.now());

              return (
                <div key={bet.round.id} className="rpg-border-inner bg-[#1a1a1a] p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-pixel text-white text-xs">{getChoiceLabel(bet)}</p>
                      <p className="font-pixel text-[#666] text-[9px]">
                        #{bet.round.id} · {bet.prediction.opWagered} OP
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-pixel text-[#22c55e] text-[10px] glow-green animate-pulse">
                        {formatTimeRemaining(remainingMs)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Results */}
      <div>
        <p className="font-pixel text-[#a855f7] text-[10px] mb-2 glow-text">RECENT RESULTS</p>
        {recentResults.length === 0 ? (
          <div className="rpg-border-inner bg-[#1a1a1a] p-4 text-center">
            <p className="font-pixel text-[#666] text-xs">NO RESULTS YET</p>
            <p className="font-pixel text-[#444] text-[9px] mt-1">Enter a market to get started!</p>
          </div>
        ) : (
          <div className="space-y-1">
            {recentResults.map((result) => {
              const isWin = result.prediction.isWinner;
              const netResult = result.prediction.opPayout - result.prediction.opWagered;

              return (
                <div
                  key={result.round.id}
                  className={`rpg-border-inner p-2 flex items-center justify-between ${
                    isWin ? "bg-[#166534]/10" : "bg-[#1a1a1a]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-pixel text-[10px] w-5 text-center ${
                        isWin ? "text-[#22c55e]" : "text-[#ef4444]"
                      }`}
                    >
                      {isWin ? "W" : "L"}
                    </span>
                    <div>
                      <p className="font-pixel text-white text-[10px]">{getChoiceLabel(result)}</p>
                      <p className="font-pixel text-[#666] text-[8px]">
                        #{result.round.id}
                        {result.prediction.rank && ` · Rank #${result.prediction.rank}`}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`font-pixel text-xs ${
                      netResult >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"
                    }`}
                  >
                    {netResult >= 0 ? "+" : ""}
                    {netResult} OP
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
