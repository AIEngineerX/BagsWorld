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

  // Filter out all NPC agents from the leaderboard (only show real fee earners)
  const population = (worldState?.population ?? []).filter(
    (c) =>
      !c.isToly &&
      !c.isAsh &&
      !c.isFinn &&
      !c.isDev &&
      !c.isScout &&
      !c.isCJ &&
      !c.isShaw &&
      // Bags.fm Team (HQ zone)
      !c.isRamo &&
      !c.isSincara &&
      !c.isStuu &&
      !c.isSam &&
      !c.isAlaa &&
      !c.isCarlo &&
      !c.isBNN &&
      // Founder's Corner
      !c.isProfessorOak
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
    <div className="h-full flex flex-col bg-bags-darker">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-bags-green/30">
        <div className="flex items-center gap-2">
          <TrophyIcon className="text-bags-gold" size={12} />
          <span className="font-pixel text-[9px] text-bags-gold">TOP EARNERS</span>
        </div>
        <span className="font-pixel text-[7px] text-gray-600">24h</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {population.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center py-4">
              <p className="font-pixel text-[9px] text-gray-500">No earners yet</p>
              <p className="font-pixel text-[7px] text-gray-600 mt-1">Launch a token to populate</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-bags-green/10">
            {population.map((character, index) => (
              <div
                key={character.id}
                onClick={() =>
                  selectCharacter(selectedCharacter?.id === character.id ? null : character)
                }
                className={`px-3 py-2 cursor-pointer transition-colors ${
                  selectedCharacter?.id === character.id
                    ? "bg-bags-green/10"
                    : "hover:bg-bags-green/5"
                }`}
              >
                <div className="flex items-center gap-2">
                  {/* Rank */}
                  <span className="w-5 flex-shrink-0 flex items-center justify-center">
                    {getRankBadge(index + 1) || (
                      <span className="font-pixel text-[8px] text-gray-600">{index + 1}</span>
                    )}
                  </span>

                  {/* Avatar */}
                  <div className="w-6 h-6 bg-black/40 border border-bags-green/20 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {character.avatarUrl ? (
                      <img
                        src={character.avatarUrl}
                        alt={character.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="font-pixel text-[8px] text-gray-500">
                        {character.username.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-pixel text-[9px] text-white truncate">
                        {character.username}
                      </span>
                      {character.profileUrl && (
                        <a
                          href={character.profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-500 hover:text-bags-green transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {getProviderIcon(character.provider)}
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Earnings */}
                  <div className="flex items-center gap-1.5">
                    <span className="font-pixel text-[9px] text-bags-gold">
                      {formatEarnings(character.earnings24h)}
                    </span>
                    <span className="flex-shrink-0">{getMoodIcon(character.mood)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
