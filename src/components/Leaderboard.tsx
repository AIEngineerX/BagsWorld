"use client";

import { useGameStore } from "@/lib/store";

export function Leaderboard() {
  const { worldState, selectCharacter, selectedCharacter } = useGameStore();

  const population = worldState?.population ?? [];

  const formatEarnings = (amount: number): string => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
    return amount.toFixed(2);
  };

  const getMoodEmoji = (mood: string): string => {
    switch (mood) {
      case "celebrating":
        return "🥳";
      case "happy":
        return "😎";
      case "sad":
        return "😔";
      default:
        return "🧑‍💻";
    }
  };

  const getProviderIcon = (provider: string): string => {
    switch (provider) {
      case "twitter":
        return "𝕏";
      case "tiktok":
        return "🎵";
      case "instagram":
        return "📸";
      case "github":
        return "⌨️";
      case "kick":
        return "🎮";
      default:
        return "🌐";
    }
  };

  const getRankBadge = (rank: number): string => {
    switch (rank) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return "";
    }
  };

  return (
    <div className="h-full flex flex-col p-2">
      <h2 className="font-pixel text-xs text-bags-green mb-2 px-2 flex items-center gap-2">
        <span>🏆</span> TOP EARNERS
      </h2>

      <div className="flex-1 overflow-y-auto space-y-1">
        {population.length === 0 ? (
          <div className="text-center py-8">
            <p className="font-pixel text-[10px] text-gray-500">
              Loading citizens...
            </p>
            <span className="text-2xl animate-bounce inline-block mt-2">🔄</span>
          </div>
        ) : (
          population.map((character, index) => (
            <div
              key={character.id}
              className={`w-full p-2 rounded transition-all ${
                selectedCharacter?.id === character.id
                  ? "bg-bags-green/20 border border-bags-green"
                  : "hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-pixel text-[10px] text-gray-500 w-5">
                  {getRankBadge(index + 1) || `#${index + 1}`}
                </span>

                <div
                  className="w-8 h-8 rounded bg-bags-dark overflow-hidden flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-bags-green"
                  onClick={() =>
                    selectCharacter(
                      selectedCharacter?.id === character.id ? null : character
                    )
                  }
                >
                  {character.avatarUrl ? (
                    <img
                      src={character.avatarUrl}
                      alt={character.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-lg">
                      {getMoodEmoji(character.mood)}
                    </span>
                  )}
                </div>

                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        selectCharacter(
                          selectedCharacter?.id === character.id ? null : character
                        )
                      }
                      className="font-pixel text-[10px] text-white truncate hover:text-bags-green"
                    >
                      {character.username}
                    </button>
                    {character.profileUrl && (
                      <a
                        href={character.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-pixel text-[10px] text-gray-400 hover:text-bags-green transition-colors"
                        title={`View on ${character.provider}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {getProviderIcon(character.provider)}
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <p className="font-pixel text-[8px] text-gray-500">
                      @{character.providerUsername?.toLowerCase() || character.username.toLowerCase()}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-pixel text-[10px] text-bags-gold flex items-center justify-end gap-1">
                    <span>💰</span>${formatEarnings(character.earnings24h)}
                  </p>
                  <p className="font-pixel text-[8px] text-gray-500">24h</p>
                </div>

                <span className="text-lg" title={character.mood}>
                  {getMoodEmoji(character.mood)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
