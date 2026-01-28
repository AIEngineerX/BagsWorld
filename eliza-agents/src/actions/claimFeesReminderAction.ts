// claimFeesReminderAction - Check and remind users about unclaimed fees
// Used by Finn to nudge creators to claim their hard-earned fees

import type {
  Action,
  ActionExample,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  ActionResult,
} from "../types/elizaos.js";
import { BagsApiService, getBagsApiService, type ClaimablePosition } from "../services/BagsApiService.js";

const LAMPORTS_PER_SOL = 1_000_000_000;

// Minimum threshold for reminding (0.01 SOL)
const MIN_REMINDER_THRESHOLD_LAMPORTS = 0.01 * LAMPORTS_PER_SOL;

// Format SOL amount with appropriate precision
function formatSol(lamports: number): string {
  const sol = lamports / LAMPORTS_PER_SOL;
  if (sol >= 1) {
    return sol.toFixed(2);
  } else if (sol >= 0.01) {
    return sol.toFixed(3);
  } else {
    return sol.toFixed(4);
  }
}

// Extract wallet address from message text
function extractWalletAddress(text: string): string | null {
  const match = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  return match ? match[0] : null;
}

export const claimFeesReminderAction: Action = {
  name: "claimFeesReminder",
  description: "Check unclaimed fees for a wallet and remind the user to claim them",

  similes: [
    "check fees",
    "unclaimed fees",
    "claim fees",
    "my fees",
    "fee check",
    "claimable",
    "how much can I claim",
    "do I have fees",
    "pending fees",
  ],

  examples: [
    [
      {
        name: "{{name1}}",
        content: { text: "do I have any unclaimed fees? my wallet is 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" },
      },
      {
        name: "Finn",
        content: {
          text: "let me check... BRO you have 2.5 SOL unclaimed! Go claim right now at bags.fm/claim!",
        },
      },
    ],
    [
      {
        name: "{{name1}}",
        content: { text: "check my fees 9bqx8GEcwuw4r3WzhWnJx8fpjt7aXdvVZhWE56bzWBoK" },
      },
      {
        name: "Finn",
        content: {
          text: "checking... you're clean! no unclaimed fees. keep building and they'll stack up!",
        },
      },
    ],
    [
      {
        name: "{{name1}}",
        content: { text: "how do I claim my fees?" },
      },
      {
        name: "Finn",
        content: {
          text: "easy! head to bags.fm/claim, connect your wallet, and claim. don't leave money on the table!",
        },
      },
    ],
  ] as ActionExample[][],

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || "";

    // Check for fee-related intent
    const hasFeeIntent = [
      "fee",
      "fees",
      "claim",
      "unclaimed",
      "claimable",
      "pending",
      "earnings",
      "earned",
    ].some((keyword) => text.includes(keyword));

    // Also trigger if they're asking about their wallet and fees
    const hasWalletAndFee = /wallet|address/.test(text) && /fee|claim|earn/.test(text);

    // Check if message contains a wallet address
    const hasWalletAddress = /[1-9A-HJ-NP-Za-km-z]{32,44}/.test(text);

    return hasFeeIntent || hasWalletAndFee || (hasWalletAddress && hasFeeIntent);
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    const text = message.content?.text || "";
    const walletAddress = extractWalletAddress(text);

    // If no wallet address provided, give general guidance
    if (!walletAddress) {
      const response = {
        text: "To check your fees, drop your wallet address! Or head straight to bags.fm/claim to see and claim everything. Don't leave SOL on the table!",
      };

      if (callback) {
        await callback(response);
      }

      return {
        success: true,
        text: response.text,
        data: { needsWallet: true },
      };
    }

    const api =
      runtime.getService<BagsApiService>(BagsApiService.serviceType) || getBagsApiService();

    let positions: ClaimablePosition[];
    try {
      positions = await api.getClaimablePositions(walletAddress);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[claimFeesReminder] Failed to fetch claimable positions: ${errorMessage}`);

      const response = {
        text: "Couldn't check your fees right now - try again in a sec or head to bags.fm/claim directly!",
      };

      if (callback) {
        await callback(response);
      }

      return {
        success: false,
        text: response.text,
        error: errorMessage,
      };
    }

    // Calculate total unclaimed
    const totalUnclaimedLamports = positions.reduce(
      (sum, pos) => sum + pos.totalClaimableLamportsUserShare,
      0
    );

    // Build response based on amount
    let responseText: string;

    if (totalUnclaimedLamports < MIN_REMINDER_THRESHOLD_LAMPORTS) {
      responseText =
        "You're clean! No significant unclaimed fees right now. Keep building and they'll stack up! When you earn, claim at bags.fm/claim";
    } else if (totalUnclaimedLamports < 0.1 * LAMPORTS_PER_SOL) {
      // Small amount (< 0.1 SOL)
      const solAmount = formatSol(totalUnclaimedLamports);
      responseText = `You've got ${solAmount} SOL waiting! Not huge but it adds up. Claim at bags.fm/claim when you're ready!`;
    } else if (totalUnclaimedLamports < 1 * LAMPORTS_PER_SOL) {
      // Medium amount (0.1 - 1 SOL)
      const solAmount = formatSol(totalUnclaimedLamports);
      responseText = `Yo! You have ${solAmount} SOL unclaimed! That's real money bro. Go claim it at bags.fm/claim!`;
    } else {
      // Large amount (> 1 SOL)
      const solAmount = formatSol(totalUnclaimedLamports);
      responseText = `BRO WHAT ARE YOU DOING?! You have ${solAmount} SOL just sitting there unclaimed! Go to bags.fm/claim RIGHT NOW and get your money!`;
    }

    // Add position breakdown if there are multiple tokens
    if (positions.length > 1 && totalUnclaimedLamports >= MIN_REMINDER_THRESHOLD_LAMPORTS) {
      const topPositions = positions
        .filter((p) => p.totalClaimableLamportsUserShare > 0)
        .sort((a, b) => b.totalClaimableLamportsUserShare - a.totalClaimableLamportsUserShare)
        .slice(0, 3);

      if (topPositions.length > 0) {
        const breakdown = topPositions
          .map((p) => {
            const symbol = p.tokenSymbol || "Unknown";
            const amount = formatSol(p.totalClaimableLamportsUserShare);
            return `${symbol}: ${amount} SOL`;
          })
          .join(", ");
        responseText += `\n\nTop earners: ${breakdown}`;
      }
    }

    const response = { text: responseText };

    if (callback) {
      await callback(response);
    }

    return {
      success: true,
      text: responseText,
      data: {
        wallet: walletAddress,
        totalUnclaimedLamports,
        totalUnclaimedSol: totalUnclaimedLamports / LAMPORTS_PER_SOL,
        positionCount: positions.length,
        positions: positions.map((p) => ({
          mint: p.baseMint,
          symbol: p.tokenSymbol,
          unclaimedLamports: p.totalClaimableLamportsUserShare,
          unclaimedSol: p.totalClaimableLamportsUserShare / LAMPORTS_PER_SOL,
        })),
      },
    };
  },
};

export default claimFeesReminderAction;
