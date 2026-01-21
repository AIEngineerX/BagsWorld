"use client";

import { useState } from "react";

interface CasinoModalProps {
  onClose: () => void;
}

// Game definitions with coming soon status
const CASINO_GAMES = [
  {
    id: "highlow",
    name: "HIGH / LOW",
    description: "Predict if the next card will be higher or lower",
    icon: "H/L",
    color: "from-red-600 to-red-800",
    borderColor: "border-red-500/30",
    glowColor: "shadow-red-500/20",
    comingSoon: true,
  },
  {
    id: "coinflip",
    name: "COIN FLIP",
    description: "Double or nothing - 50/50 odds",
    icon: "2x",
    color: "from-yellow-600 to-amber-700",
    borderColor: "border-yellow-500/30",
    glowColor: "shadow-yellow-500/20",
    comingSoon: true,
  },
  {
    id: "dice",
    name: "DICE ROLL",
    description: "Roll the dice, beat the house",
    icon: "D6",
    color: "from-green-600 to-emerald-700",
    borderColor: "border-green-500/30",
    glowColor: "shadow-green-500/20",
    comingSoon: true,
  },
  {
    id: "slots",
    name: "SLOT MACHINE",
    description: "Match symbols to win big",
    icon: "777",
    color: "from-purple-600 to-violet-700",
    borderColor: "border-purple-500/30",
    glowColor: "shadow-purple-500/20",
    comingSoon: true,
  },
  {
    id: "raffle",
    name: "WEEKLY RAFFLE",
    description: "Free entry, winner takes pot",
    icon: "TKT",
    color: "from-blue-600 to-indigo-700",
    borderColor: "border-blue-500/30",
    glowColor: "shadow-blue-500/20",
    comingSoon: true,
  },
  {
    id: "prediction",
    name: "PRICE PREDICT",
    description: "Predict token price movements",
    icon: "UP",
    color: "from-cyan-600 to-teal-700",
    borderColor: "border-cyan-500/30",
    glowColor: "shadow-cyan-500/20",
    comingSoon: true,
  },
];

export function CasinoModal({ onClose }: CasinoModalProps) {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-[#0a0a0f] border border-purple-500/30 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="relative bg-gradient-to-b from-purple-900/40 to-transparent p-6 border-b border-purple-500/20">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                <span className="font-pixel text-xl text-white">777</span>
              </div>
              <div>
                <h2 className="font-pixel text-xl text-white tracking-wider">BAGSWORLD CASINO</h2>
                <p className="text-purple-400/80 text-sm mt-1">Play to earn SOL rewards</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Stats Banner */}
          <div className="flex items-center gap-6 mt-5 p-3 bg-black/30 rounded-lg border border-purple-500/10">
            <div className="text-center flex-1">
              <p className="text-gray-500 text-[10px] uppercase tracking-wider">House Pool</p>
              <p className="text-white font-bold text-lg">-- SOL</p>
            </div>
            <div className="w-px h-8 bg-purple-500/20" />
            <div className="text-center flex-1">
              <p className="text-gray-500 text-[10px] uppercase tracking-wider">Total Won</p>
              <p className="text-green-400 font-bold text-lg">-- SOL</p>
            </div>
            <div className="w-px h-8 bg-purple-500/20" />
            <div className="text-center flex-1">
              <p className="text-gray-500 text-[10px] uppercase tracking-wider">Players</p>
              <p className="text-purple-400 font-bold text-lg">--</p>
            </div>
          </div>
        </div>

        {/* Games Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {CASINO_GAMES.map((game) => (
              <button
                key={game.id}
                onClick={() => setSelectedGame(game.id)}
                disabled={game.comingSoon}
                className={`relative group bg-gradient-to-br ${game.color} rounded-xl p-4 border ${game.borderColor} transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${game.glowColor} disabled:opacity-70 disabled:cursor-not-allowed text-left`}
              >
                {/* Coming Soon Badge */}
                {game.comingSoon && (
                  <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-[9px] font-bold px-2 py-1 rounded-full shadow-lg animate-pulse">
                    SOON
                  </div>
                )}

                {/* Icon */}
                <div className="font-pixel text-2xl text-white/90 mb-3 filter drop-shadow-lg">
                  {game.icon}
                </div>

                {/* Info */}
                <h3 className="font-pixel text-xs text-white mb-1 tracking-wider">
                  {game.name}
                </h3>
                <p className="text-white/60 text-[10px] leading-relaxed">
                  {game.description}
                </p>

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-white/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>

          {/* Coming Soon Info */}
          <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="font-pixel text-lg text-yellow-500">[!]</div>
              <div>
                <h4 className="text-purple-400 font-medium text-sm mb-1">Casino Under Construction</h4>
                <p className="text-gray-400 text-xs leading-relaxed">
                  We&apos;re building the most degen casino on Solana. All games will be provably fair
                  with on-chain verification. Stay tuned for launch announcements!
                </p>
              </div>
            </div>
          </div>

          {/* Features Preview */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="bg-white/5 rounded-lg p-3 text-center border border-white/5">
              <div className="font-pixel text-sm text-yellow-400 mb-1">[&gt;]</div>
              <p className="text-white text-[10px] font-medium">Instant Payouts</p>
              <p className="text-gray-500 text-[9px]">Direct to wallet</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3 text-center border border-white/5">
              <div className="font-pixel text-sm text-green-400 mb-1">[OK]</div>
              <p className="text-white text-[10px] font-medium">Provably Fair</p>
              <p className="text-gray-500 text-[9px]">On-chain verified</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3 text-center border border-white/5">
              <div className="font-pixel text-sm text-purple-400 mb-1">[#1]</div>
              <p className="text-white text-[10px] font-medium">Leaderboards</p>
              <p className="text-gray-500 text-[9px]">Compete for prizes</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-purple-500/20 bg-black/30">
          <div className="flex items-center justify-between">
            <p className="text-gray-500 text-xs">
              Funded by <span className="text-purple-400">BagsWorld ecosystem fees</span>
            </p>
            <a
              href="https://x.com/BagsWorldApp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 text-xs transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              Follow for updates
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
