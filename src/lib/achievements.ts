/**
 * Achievements System
 *
 * Tracks user accomplishments in BagsWorld.
 * Achievements are stored per-wallet in Supabase for persistence.
 */

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "launcher" | "earner" | "builder" | "trader" | "world" | "special";
  requirement: number;  // Target value to unlock
  hidden?: boolean;     // Hidden until unlocked
}

export interface UserAchievement {
  odm: string;          // Achievement ID
  unlockedAt: string;   // ISO date when earned
  progress: number;     // Current progress (for progressive achievements)
}

export interface AchievementProgress {
  achievement: Achievement;
  unlocked: boolean;
  unlockedAt?: string;
  progress: number;
  percentage: number;
}

// All available achievements
export const ACHIEVEMENTS: Achievement[] = [
  // 🚀 Launcher Achievements
  {
    id: "first_hatch",
    name: "First Hatch",
    description: "Launch your first token",
    icon: "🥚",
    category: "launcher",
    requirement: 1,
  },
  {
    id: "serial_launcher",
    name: "Serial Launcher",
    description: "Launch 5 tokens",
    icon: "🐣",
    category: "launcher",
    requirement: 5,
  },
  {
    id: "token_factory",
    name: "Token Factory",
    description: "Launch 10 tokens",
    icon: "🐉",
    category: "launcher",
    requirement: 10,
  },

  // 💰 Earner Achievements
  {
    id: "first_bag",
    name: "First Bag",
    description: "Earn 1 SOL in fees",
    icon: "🪙",
    category: "earner",
    requirement: 1,
  },
  {
    id: "diamond_hands",
    name: "Diamond Hands",
    description: "Earn 100 SOL lifetime",
    icon: "💎",
    category: "earner",
    requirement: 100,
  },
  {
    id: "fee_king",
    name: "Fee King",
    description: "Earn 1,000 SOL lifetime",
    icon: "👑",
    category: "earner",
    requirement: 1000,
  },
  {
    id: "top_earner",
    name: "Top Earner",
    description: "Reach #1 on the leaderboard",
    icon: "🏆",
    category: "earner",
    requirement: 1,
  },

  // 🏗️ Builder Achievements
  {
    id: "startup",
    name: "Startup",
    description: "Have a Level 1 building",
    icon: "🏠",
    category: "builder",
    requirement: 1,
  },
  {
    id: "corporate",
    name: "Corporate",
    description: "Reach Level 3 ($500K MC)",
    icon: "🏢",
    category: "builder",
    requirement: 3,
  },
  {
    id: "skyscraper",
    name: "Skyscraper",
    description: "Reach Level 5 ($10M MC)",
    icon: "🏙️",
    category: "builder",
    requirement: 5,
  },

  // 📈 Trader Achievements
  {
    id: "first_trade",
    name: "First Trade",
    description: "Complete your first trade",
    icon: "🔄",
    category: "trader",
    requirement: 1,
  },
  {
    id: "active_trader",
    name: "Active Trader",
    description: "Complete 10 trades",
    icon: "📊",
    category: "trader",
    requirement: 10,
  },
  {
    id: "whale",
    name: "Whale",
    description: "Single trade of 10+ SOL",
    icon: "🐋",
    category: "trader",
    requirement: 10,
  },

  // 🌍 World Achievements
  {
    id: "early_bird",
    name: "Early Bird",
    description: "Visit during dawn (6-8 AM EST)",
    icon: "🌅",
    category: "world",
    requirement: 1,
  },
  {
    id: "night_owl",
    name: "Night Owl",
    description: "Visit during night (8 PM-6 AM EST)",
    icon: "🌙",
    category: "world",
    requirement: 1,
  },
  {
    id: "storm_chaser",
    name: "Storm Chaser",
    description: "Visit during storm weather",
    icon: "⛈️",
    category: "world",
    requirement: 1,
  },
  {
    id: "apocalypse_survivor",
    name: "Apocalypse Survivor",
    description: "Visit during apocalypse weather",
    icon: "🔥",
    category: "world",
    requirement: 1,
    hidden: true,
  },

  // 🎮 Special Achievements
  {
    id: "nurse_joy",
    name: "Nurse Joy",
    description: "Visit the PokeCenter",
    icon: "🏥",
    category: "special",
    requirement: 1,
  },
  {
    id: "toly_fan",
    name: "Toly Fan",
    description: "Chat with Toly 5 times",
    icon: "💬",
    category: "special",
    requirement: 5,
  },
  {
    id: "bags_believer",
    name: "Bags Believer",
    description: "Chat with Finn 5 times",
    icon: "💚",
    category: "special",
    requirement: 5,
  },
  {
    id: "world_admin",
    name: "World Admin",
    description: "Access the admin console",
    icon: "⚙️",
    category: "special",
    requirement: 1,
    hidden: true,
  },
];

// Get achievement by ID
export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

// Get achievements by category
export function getAchievementsByCategory(category: Achievement["category"]): Achievement[] {
  return ACHIEVEMENTS.filter((a) => a.category === category);
}

// Calculate achievement progress
export function calculateProgress(
  achievement: Achievement,
  currentValue: number,
  userAchievements: UserAchievement[]
): AchievementProgress {
  const userAch = userAchievements.find((ua) => ua.odm === achievement.id);
  const unlocked = !!userAch;
  const progress = unlocked ? achievement.requirement : Math.min(currentValue, achievement.requirement);
  const percentage = Math.min(100, (progress / achievement.requirement) * 100);

  return {
    achievement,
    unlocked,
    unlockedAt: userAch?.unlockedAt,
    progress,
    percentage,
  };
}

// Category display info
export const CATEGORY_INFO: Record<Achievement["category"], { name: string; icon: string }> = {
  launcher: { name: "Launcher", icon: "🚀" },
  earner: { name: "Earner", icon: "💰" },
  builder: { name: "Builder", icon: "🏗️" },
  trader: { name: "Trader", icon: "📈" },
  world: { name: "World", icon: "🌍" },
  special: { name: "Special", icon: "🎮" },
};
