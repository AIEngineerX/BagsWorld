// getOraclePrices Action
// Get live price changes for tokens in active Oracle round

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

interface TokenPrice {
  mint: string;
  symbol: string;
  name: string;
  startPrice: number;
  currentPrice: number | null;
  priceChange: number;
  priceChangePercent: number;
}

interface PricesResponse {
  status: string;
  roundId?: number;
  remainingMs?: number;
  entryCount?: number;
  leader?: {
    symbol: string;
    priceChangePercent: number;
  };
  tokens?: TokenPrice[];
  message?: string;
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "ended";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export const getOraclePricesAction: Action = {
  name: "getOraclePrices",
  description:
    "Get live price changes for tokens in the active Oracle prediction round",

  similes: [
    "oracle prices",
    "price changes",
    "who is winning",
    "current leader",
    "token prices",
    "live prices",
    "which token is up",
    "price updates",
  ],

  examples: [
    [
      {
        name: "{{name1}}",
        content: { text: "which token is winning the oracle round?" },
      },
      {
        name: "Neo",
        content: { text: "*checking prices* scanning live data..." },
      },
    ],
    [
      {
        name: "{{name1}}",
        content: { text: "show me the current oracle prices" },
      },
      {
        name: "Bags Bot",
        content: { text: "fetching live price changes..." },
      },
    ],
  ] as ActionExample[][],

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
  ): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || "";

    const hasPriceIntent = [
      "price",
      "prices",
      "winning",
      "leader",
      "leading",
      "up",
      "down",
      "pump",
      "dump",
      "change",
      "live",
      "current",
    ].some((keyword) => text.includes(keyword));

    const hasOracleContext = ["oracle", "prediction", "round", "tower"].some(
      (keyword) => text.includes(keyword)
    );

    return hasPriceIntent && hasOracleContext;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    let data: PricesResponse;
    try {
      const response = await fetch(`${BAGSWORLD_API_URL}/api/oracle/prices`);
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      data = await response.json();
    } catch (error) {
      console.error("[getOraclePrices] Failed to fetch:", error);
      const errorResponse = {
        text: "oracle prices offline. try again in a moment.",
      };
      if (callback) await callback(errorResponse);
      return { success: false, text: errorResponse.text, error: "API error" };
    }

    const characterName = runtime.character?.name?.toLowerCase() || "";
    let responseText = "";

    if (data.status === "none" || !data.tokens) {
      responseText = data.message || "no active oracle round.";
    } else {
      const timeLeft = formatTimeRemaining(data.remainingMs || 0);
      const tokenList = data.tokens
        .map((t) => {
          const changeStr =
            t.priceChangePercent >= 0
              ? `+${t.priceChangePercent}%`
              : `${t.priceChangePercent}%`;
          const emoji = t.priceChangePercent >= 0 ? "↑" : "↓";
          return `${t.symbol}: ${changeStr} ${emoji}`;
        })
        .join("\n");

      if (characterName === "neo") {
        responseText =
          `*live feed* round #${data.roundId} - ${timeLeft} remaining\n\n` +
          `${tokenList}\n\n` +
          `current leader: $${data.leader?.symbol} at ${data.leader?.priceChangePercent}%`;
      } else if (characterName === "cj") {
        const leader = data.leader;
        responseText =
          `yo check it - ${timeLeft} left!\n\n` +
          `${tokenList}\n\n` +
          `$${leader?.symbol} in the lead with ${leader?.priceChangePercent}% gains!`;
      } else if (characterName === "ghost") {
        responseText =
          `live oracle prices (round #${data.roundId}):\n\n` +
          `${tokenList}\n\n` +
          `leader: $${data.leader?.symbol} (+${data.leader?.priceChangePercent}%)\n` +
          `${data.entryCount} predictions locked.`;
      } else {
        responseText =
          `oracle round #${data.roundId} - ${timeLeft} left\n\n` +
          `${tokenList}\n\n` +
          `$${data.leader?.symbol} is currently winning!`;
      }
    }

    const result = { text: responseText };

    if (callback) {
      await callback(result);
    }

    return {
      success: true,
      text: responseText,
      data: { tokens: data.tokens, leader: data.leader },
    };
  },
};

export default getOraclePricesAction;
