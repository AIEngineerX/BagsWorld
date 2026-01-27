// getOracleLeaderboard Action
// Get top Oracle predictors

import type {
  Action,
  ActionExample,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  ActionResult,
} from "../types/elizaos.js";

const BAGSWORLD_API_URL = process.env.BAGSWORLD_API_URL || "https://bags.world";

interface LeaderboardEntry {
  rank: number;
  wallet: string;
  walletShort: string;
  wins: number;
  totalPredictions: number;
  winRate: number;
}

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  userStats?: {
    wallet: string;
    walletShort: string;
    wins: number;
    totalPredictions: number;
    winRate: number;
    rank: number;
  };
  totalPredictors: number;
}

export const getOracleLeaderboardAction: Action = {
  name: "getOracleLeaderboard",
  description: "Get the Oracle prediction market leaderboard - top predictors",

  similes: [
    "oracle leaderboard",
    "top predictors",
    "prediction leaders",
    "who won",
    "best predictions",
    "oracle rankings",
    "top oracles",
    "prediction winners",
  ],

  examples: [
    [
      {
        name: "{{name1}}",
        content: { text: "who are the top oracle predictors?" },
      },
      {
        name: "Bags Bot",
        content: { text: "let me check the oracle leaderboard..." },
      },
    ],
    [
      {
        name: "{{name1}}",
        content: { text: "show me the prediction leaderboard" },
      },
      {
        name: "Neo",
        content: { text: "*accessing archives* scanning top predictors..." },
      },
    ],
  ] as ActionExample[][],

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
  ): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || "";

    const hasLeaderboardIntent = [
      "leaderboard",
      "top",
      "best",
      "leader",
      "ranking",
      "winners",
      "who won",
      "ranks",
    ].some((keyword) => text.includes(keyword));

    const hasOracleContext = [
      "oracle",
      "prediction",
      "predict",
      "predictor",
    ].some((keyword) => text.includes(keyword));

    return hasLeaderboardIntent && hasOracleContext;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    const walletAddress = (message.content?.wallet as string) || "";
    const walletParam = walletAddress ? `?wallet=${walletAddress}` : "";

    let data: LeaderboardResponse;
    try {
      const response = await fetch(
        `${BAGSWORLD_API_URL}/api/oracle/leaderboard${walletParam}`
      );
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      data = await response.json();
    } catch (error) {
      console.error("[getOracleLeaderboard] Failed to fetch:", error);
      const errorResponse = {
        text: "oracle leaderboard offline. try again in a moment.",
      };
      if (callback) await callback(errorResponse);
      return { success: false, text: errorResponse.text, error: "API error" };
    }

    const characterName = runtime.character?.name?.toLowerCase() || "";
    let responseText = "";

    if (!data.leaderboard || data.leaderboard.length === 0) {
      responseText = "no oracle predictions yet. be the first to win!";
    } else {
      const top5 = data.leaderboard.slice(0, 5);
      const leaderList = top5
        .map(
          (entry) =>
            `${entry.rank}. ${entry.walletShort} - ${entry.wins} win${entry.wins !== 1 ? "s" : ""} (${entry.winRate}%)`
        )
        .join("\n");

      if (characterName === "neo") {
        responseText =
          `*scanning archives* top oracle predictors:\n${leaderList}` +
          (data.userStats
            ? `\n\nyou rank #${data.userStats.rank} with ${data.userStats.wins} wins.`
            : "");
      } else if (characterName === "ghost") {
        responseText =
          `oracle leaderboard:\n${leaderList}` +
          `\n\n${data.totalPredictors} total predictors. all results on-chain.` +
          (data.userStats
            ? `\nyour rank: #${data.userStats.rank}`
            : "");
      } else {
        responseText =
          `oracle leaderboard:\n${leaderList}` +
          (data.userStats
            ? `\n\nyou're ranked #${data.userStats.rank} with ${data.userStats.wins} wins!`
            : "");
      }
    }

    const result = { text: responseText };

    if (callback) {
      await callback(result);
    }

    return {
      success: true,
      text: responseText,
      data: { leaderboard: data.leaderboard, userStats: data.userStats },
    };
  },
};

export default getOracleLeaderboardAction;
