"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  ACHIEVEMENTS,
  type Achievement,
  type AchievementProgress,
  CATEGORY_INFO,
} from "@/lib/achievements";
import {
  loadUserAchievements,
  unlockAchievement,
  type StoredAchievement,
} from "@/lib/supabase";
import { useGameStore } from "@/lib/store";

interface UseAchievementsReturn {
  achievements: AchievementProgress[];
  unlockedCount: number;
  totalCount: number;
  percentage: number;
  isLoading: boolean;
  unlock: (achievementId: string) => Promise<boolean>;
  checkAndUnlock: () => Promise<string[]>; // Returns newly unlocked IDs
  getByCategory: (category: Achievement["category"]) => AchievementProgress[];
}

export function useAchievements(): UseAchievementsReturn {
  const { publicKey, connected } = useWallet();
  const worldState = useGameStore((state) => state.worldState);
  const [userAchievements, setUserAchievements] = useState<StoredAchievement[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const wallet = publicKey?.toBase58();

  // Load user achievements from Supabase
  useEffect(() => {
    if (!wallet) {
      setUserAchievements([]);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      try {
        const achievements = await loadUserAchievements(wallet);
        setUserAchievements(achievements);
      } catch (error) {
        console.error("Failed to load achievements:", error);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [wallet]);

  // Calculate progress for all achievements
  const achievements: AchievementProgress[] = ACHIEVEMENTS.map((achievement) => {
    const userAch = userAchievements.find(
      (ua) => ua.achievement_id === achievement.id
    );
    const unlocked = !!userAch;
    const progress = userAch?.progress || 0;
    const percentage = unlocked
      ? 100
      : Math.min(100, (progress / achievement.requirement) * 100);

    return {
      achievement,
      unlocked,
      unlockedAt: userAch?.unlocked_at,
      progress: unlocked ? achievement.requirement : progress,
      percentage,
    };
  });

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalCount = ACHIEVEMENTS.length;
  const percentage = Math.round((unlockedCount / totalCount) * 100);

  // Unlock a specific achievement
  const unlock = useCallback(
    async (achievementId: string): Promise<boolean> => {
      if (!wallet) return false;

      const achievement = ACHIEVEMENTS.find((a) => a.id === achievementId);
      if (!achievement) return false;

      // Check if already unlocked
      if (userAchievements.some((ua) => ua.achievement_id === achievementId)) {
        return true;
      }

      const success = await unlockAchievement(wallet, achievementId, achievement.requirement);

      if (success) {
        // Update local state
        setUserAchievements((prev) => [
          ...prev,
          {
            wallet,
            achievement_id: achievementId,
            unlocked_at: new Date().toISOString(),
            progress: achievement.requirement,
          },
        ]);
      }

      return success;
    },
    [wallet, userAchievements]
  );

  // Check all achievements and unlock any that are earned
  const checkAndUnlock = useCallback(async (): Promise<string[]> => {
    if (!wallet || !worldState) return [];

    const newlyUnlocked: string[] = [];
    const now = new Date();
    const estHour = new Date(
      now.toLocaleString("en-US", { timeZone: "America/New_York" })
    ).getHours();

    // Get user's buildings and stats from world state
    const userBuildings = worldState.buildings.filter(
      (b) => b.ownerId === wallet
    );
    const userEarner = worldState.population.find((p) => p.id === wallet);
    const isTopEarner = worldState.population[0]?.id === wallet;

    // Check each achievement
    for (const achievement of ACHIEVEMENTS) {
      // Skip if already unlocked
      if (userAchievements.some((ua) => ua.achievement_id === achievement.id)) {
        continue;
      }

      let shouldUnlock = false;

      switch (achievement.id) {
        // Launcher achievements
        case "first_hatch":
          shouldUnlock = userBuildings.length >= 1;
          break;
        case "serial_launcher":
          shouldUnlock = userBuildings.length >= 5;
          break;
        case "token_factory":
          shouldUnlock = userBuildings.length >= 10;
          break;

        // Earner achievements
        case "first_bag":
          shouldUnlock = (userEarner?.lifetimeEarnings || 0) >= 1;
          break;
        case "diamond_hands":
          shouldUnlock = (userEarner?.lifetimeEarnings || 0) >= 100;
          break;
        case "fee_king":
          shouldUnlock = (userEarner?.lifetimeEarnings || 0) >= 1000;
          break;
        case "top_earner":
          shouldUnlock = isTopEarner;
          break;

        // Builder achievements
        case "startup":
          shouldUnlock = userBuildings.some((b) => b.level >= 1);
          break;
        case "corporate":
          shouldUnlock = userBuildings.some((b) => b.level >= 3);
          break;
        case "skyscraper":
          shouldUnlock = userBuildings.some((b) => b.level >= 5);
          break;

        // World achievements
        case "early_bird":
          shouldUnlock = estHour >= 6 && estHour < 8;
          break;
        case "night_owl":
          shouldUnlock = estHour >= 20 || estHour < 6;
          break;
        case "storm_chaser":
          shouldUnlock = worldState.weather === "storm";
          break;
        case "apocalypse_survivor":
          shouldUnlock = worldState.weather === "apocalypse";
          break;

        // Special achievements - these are unlocked via specific actions
        // nurse_joy, toly_fan, bags_believer, world_admin
        // are handled by calling unlock() directly from components
      }

      if (shouldUnlock) {
        const success = await unlockAchievement(
          wallet,
          achievement.id,
          achievement.requirement
        );
        if (success) {
          newlyUnlocked.push(achievement.id);
          setUserAchievements((prev) => [
            ...prev,
            {
              wallet,
              achievement_id: achievement.id,
              unlocked_at: new Date().toISOString(),
              progress: achievement.requirement,
            },
          ]);
        }
      }
    }

    return newlyUnlocked;
  }, [wallet, worldState, userAchievements]);

  // Get achievements by category
  const getByCategory = useCallback(
    (category: Achievement["category"]): AchievementProgress[] => {
      return achievements.filter((a) => a.achievement.category === category);
    },
    [achievements]
  );

  return {
    achievements,
    unlockedCount,
    totalCount,
    percentage,
    isLoading,
    unlock,
    checkAndUnlock,
    getByCategory,
  };
}

// Export category info for display
export { CATEGORY_INFO };
