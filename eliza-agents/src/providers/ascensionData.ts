// Ascension Data Provider
// Injects current Ascension Spire state into agent context so agents can
// talk about their position, nearby rivals, and recent ascension events.

import type { Provider, IAgentRuntime, Memory, State, ProviderResult } from '../types/elizaos.js';

const BAGSWORLD_API_URL = process.env.BAGSWORLD_API_URL || 'https://bags.world';

interface LeaderboardEntry {
  rank: number;
  name: string;
  wallet: string;
  reputationScore: number;
  reputationTier: string;
  moltbookKarma: number;
  tokensLaunched: number;
  totalFeesEarnedSol: number;
}

interface AscensionState {
  myTier: string;
  myScore: number;
  myRank: number;
  nearbyAgents: Array<{ name: string; tier: string; score: number; rank: number }>;
  recentAscensions: Array<{ name: string; fromTier: string; toTier: string }>;
  nextTierThreshold: number;
  pointsToNextTier: number;
  totalAgents: number;
  tierDistribution: Record<string, number>;
}

// Cache to avoid excessive API calls
let leaderboardCache: { data: LeaderboardEntry[]; timestamp: number } | null = null;
const CACHE_DURATION = 30 * 1000; // 30 seconds

// Track recent ascensions in memory (reset on process restart)
const recentAscensions: Array<{ name: string; fromTier: string; toTier: string; time: number }> = [];
const MAX_RECENT_ASCENSIONS = 20;

const TIER_THRESHOLDS: Record<string, number> = {
  none: 0,
  bronze: 100,
  silver: 300,
  gold: 600,
  diamond: 900,
};

const TIER_ORDER = ['none', 'bronze', 'silver', 'gold', 'diamond'];

function getNextTier(currentTier: string): string | null {
  const idx = TIER_ORDER.indexOf(currentTier);
  if (idx === -1 || idx >= TIER_ORDER.length - 1) return null;
  return TIER_ORDER[idx + 1];
}

async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const now = Date.now();

  if (leaderboardCache && (now - leaderboardCache.timestamp) < CACHE_DURATION) {
    return leaderboardCache.data;
  }

  const response = await fetch(
    `${BAGSWORLD_API_URL}/api/agent-economy/external?action=leaderboard&metric=reputation&limit=30`
  );
  if (!response.ok) {
    console.error(`[ascensionData] API error: ${response.status}`);
    return leaderboardCache?.data || [];
  }
  const json = await response.json();
  if (!json.success || !json.leaderboard) {
    return leaderboardCache?.data || [];
  }
  leaderboardCache = { data: json.leaderboard, timestamp: now };
  return json.leaderboard;
}

function buildAscensionState(
  agentName: string,
  leaderboard: LeaderboardEntry[]
): AscensionState {
  // Find this agent on the leaderboard
  const normalizedName = agentName.toLowerCase();
  const myEntry = leaderboard.find(
    (e) => e.name.toLowerCase() === normalizedName
  );

  const myTier = myEntry?.reputationTier || 'none';
  const myScore = myEntry?.reputationScore || 0;
  const myRank = myEntry?.rank || leaderboard.length + 1;

  // Find nearby agents (within 50 score points)
  const nearbyAgents = leaderboard
    .filter((e) => e.name.toLowerCase() !== normalizedName)
    .filter((e) => Math.abs(e.reputationScore - myScore) <= 50)
    .map((e) => ({
      name: e.name,
      tier: e.reputationTier,
      score: e.reputationScore,
      rank: e.rank,
    }))
    .slice(0, 5);

  // Calculate next tier threshold
  const nextTier = getNextTier(myTier);
  const nextTierThreshold = nextTier ? TIER_THRESHOLDS[nextTier] : TIER_THRESHOLDS.diamond;
  const pointsToNextTier = Math.max(0, nextTierThreshold - myScore);

  // Tier distribution
  const tierDistribution: Record<string, number> = {
    diamond: 0,
    gold: 0,
    silver: 0,
    bronze: 0,
    none: 0,
  };
  for (const entry of leaderboard) {
    const tier = entry.reputationTier || 'none';
    if (tier in tierDistribution) {
      tierDistribution[tier]++;
    }
  }

  // Recent ascensions (from in-memory tracking, last 5 minutes)
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  const recent = recentAscensions
    .filter((a) => a.time > fiveMinutesAgo)
    .map(({ name, fromTier, toTier }) => ({ name, fromTier, toTier }))
    .slice(0, 5);

  return {
    myTier,
    myScore,
    myRank,
    nearbyAgents,
    recentAscensions: recent,
    nextTierThreshold,
    pointsToNextTier,
    totalAgents: leaderboard.length,
    tierDistribution,
  };
}

/** Record an ascension event (called from zone logic via API) */
export function recordAscensionEvent(
  name: string,
  fromTier: string,
  toTier: string
): void {
  recentAscensions.unshift({ name, fromTier, toTier, time: Date.now() });
  if (recentAscensions.length > MAX_RECENT_ASCENSIONS) {
    recentAscensions.length = MAX_RECENT_ASCENSIONS;
  }
}

export const ascensionDataProvider: Provider = {
  name: 'ascensionData',
  description: 'Provides current Ascension Spire state — agent position, rivals, recent events',

  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State
  ): Promise<ProviderResult> => {
    const agentName = runtime.character?.name || 'Unknown';
    const leaderboard = await fetchLeaderboard();

    if (leaderboard.length === 0) {
      return {
        text: 'Ascension Spire Status: No agents on the spire currently.',
        ascensionActive: false,
      };
    }

    const ascState = buildAscensionState(agentName, leaderboard);

    let statusText = `Ascension Spire Status for ${agentName}:\n`;
    statusText += `- My Tier: ${ascState.myTier.toUpperCase()}\n`;
    statusText += `- My Score: ${ascState.myScore}\n`;
    statusText += `- My Rank: #${ascState.myRank} of ${ascState.totalAgents}\n`;

    if (ascState.pointsToNextTier > 0) {
      statusText += `- Points to next tier: ${ascState.pointsToNextTier} (need ${ascState.nextTierThreshold})\n`;
    } else {
      statusText += `- At maximum tier (Diamond)!\n`;
    }

    if (ascState.nearbyAgents.length > 0) {
      statusText += `- Nearby rivals: ${ascState.nearbyAgents.map(
        (a) => `${a.name} (${a.tier}, ${a.score}pts)`
      ).join(', ')}\n`;
    }

    if (ascState.recentAscensions.length > 0) {
      statusText += `- Recent ascensions: ${ascState.recentAscensions.map(
        (a) => `${a.name}: ${a.fromTier}→${a.toTier}`
      ).join(', ')}\n`;
    }

    statusText += `- Tier distribution: Diamond:${ascState.tierDistribution.diamond} Gold:${ascState.tierDistribution.gold} Silver:${ascState.tierDistribution.silver} Bronze:${ascState.tierDistribution.bronze}`;

    return {
      text: statusText,
      ascensionActive: true,
      ascensionState: ascState,
    };
  },
};

export default ascensionDataProvider;
