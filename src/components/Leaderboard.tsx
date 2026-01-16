"use client";

import { useGameStore } from "@/lib/store";
import {
  XIcon,
  TikTokIcon,
  GitHubIcon,
  InstagramIcon,
  GlobeIcon,
  GamepadIcon,
  TrophyIcon,
  CoinIcon,
  GoldMedalIcon,
  SilverMedalIcon,
  BronzeMedalIcon,
  HappyFaceIcon,
  CelebrateFaceIcon,
  NeutralFaceIcon,
  SadFaceIcon,
} from "./icons";

export function Leaderboard() {
  const { worldState, selectCharacter, selectedCharacter } = useGameStore();

  // Filter out guide characters (Toly, Ash, Finn) from the leaderboard
  const population = (worldState?.population ?? []).filter(
    (c) => !c.isToly && !c.isAsh && !c.isFinn
  );

  const formatEarnings = (amount: number): string => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
    return amount.toFixed(2);
  };

  const getMoodIcon = (mood: string) => {
    const iconClass = "w-4 h-4";
    switch (mood) {
      case "celebrating":
        return <CelebrateFaceIcon className={`${iconClass} text-yellow-400`} size={16} />;
      case "happy":
        return <HappyFaceIcon className={`${iconClass} text-green-400`} size={16} />;
      case "sad":
        return <SadFaceIcon className={`${iconClass} text-red-400`} size={16} />;
      default:
        return <NeutralFaceIcon className={`${iconClass} text-gray-400`} size={16} />;
    }
  };

  const getProviderIcon = (provider: string) => {
    const iconClass = "w-3 h-3";
    switch (provider) {
      case "twitter":
        return <XIcon className={iconClass} size={12} />;
      case "tiktok":
        return <TikTokIcon className={iconClass} size={12} />;
      case "instagram":
        return <InstagramIcon className={iconClass} size={12} />;
      case "github":
        return <GitHubIcon className={iconClass} size={12} />;
      case "kick":
        return <GamepadIcon className={iconClass} size={12} />;
      default:
        return <GlobeIcon className={iconClass} size={12} />;
    }
  };

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return <GoldMedalIcon size={16} />;
      case 2:
        return <SilverMedalIcon size={16} />;
      case 3:
        return <BronzeMedalIcon size={16} />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col p-2">
      <h2 className="font-pixel text-xs text-bags-green mb-2 px-2 flex items-center gap-2">
        <TrophyIcon className="text-bags-gold" size={14} /> TOP EARNERS
      </h2>

      <div className="flex-1 overflow-y-auto space-y-1">
        {population.length === 0 ? (
          <div className="text-center py-8 px-4">
            <div className="text-3xl mb-2">🏚️</div>
            <p className="font-pixel text-[10px] text-gray-500 mb-1">
              No citizens yet
            </p>
            <p className="font-pixel text-[8px] text-gray-600">
              Launch a token to populate the world!
            </p>
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
                <span className="font-pixel text-[10px] text-gray-500 w-5 flex items-center justify-center">
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
                    getMoodIcon(character.mood)
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
                        className="text-gray-400 hover:text-bags-green transition-colors"
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
                    <CoinIcon className="text-bags-gold" size={12} />${formatEarnings(character.earnings24h)}
                  </p>
                  <p className="font-pixel text-[8px] text-gray-500">24h</p>
                </div>

                <span title={character.mood}>
                  {getMoodIcon(character.mood)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
