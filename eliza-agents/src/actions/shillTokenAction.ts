// shillTokenAction - Generate hype copy for tokens in Finn's voice
// Helps creators spread the word about their token on Twitter/Discord

import type {
  Action,
  ActionExample,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  ActionResult,
} from "../types/elizaos.js";
import { BagsApiService, getBagsApiService, type TokenInfo } from "../services/BagsApiService.js";
import { getLLMService } from "../services/LLMService.js";
import { getCharacter } from "../characters/index.js";

// Extract token mint or symbol from message
function extractTokenIdentifier(text: string): { mint?: string; symbol?: string } {
  // Check for mint address first (base58, 32-44 chars)
  const mintMatch = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  if (mintMatch) {
    return { mint: mintMatch[0] };
  }

  // Check for symbol ($SYMBOL)
  const symbolMatch = text.match(/\$([A-Za-z]{2,10})/);
  if (symbolMatch) {
    return { symbol: symbolMatch[1].toUpperCase() };
  }

  // Check for plain symbol mention
  const words = text.split(/\s+/);
  for (const word of words) {
    if (/^[A-Z]{2,10}$/.test(word)) {
      return { symbol: word };
    }
  }

  return {};
}

// Format number with K/M suffix
function formatNumber(num: number | undefined): string {
  if (!num) return "0";
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + "K";
  }
  return num.toFixed(0);
}

// Generate shill templates based on token data
function generateShillTemplates(token: TokenInfo): string[] {
  const symbol = `$${token.symbol}`;
  const name = token.name;
  const mcap = formatNumber(token.marketCap);
  const volume = formatNumber(token.volume24h);
  const fees = token.lifetimeFees ? (token.lifetimeFees / 1_000_000_000).toFixed(2) : "0";

  const templates: string[] = [];

  // Twitter thread opener
  templates.push(`🔥 ${symbol} just launched on @BagsFM

${name} - creator earning fees on EVERY trade

MC: $${mcap}
Volume: $${volume}
Lifetime Fees: ${fees} SOL

This is the future of creator tokens. LFG!

bags.fm/token/${token.mint}`);

  // Short tweet
  templates.push(`${symbol} on @BagsFM 🔥

Creator earns 1% forever. Not just at launch - FOREVER.

$${mcap} MC | ${fees} SOL in fees already

bags.fm/token/${token.mint}`);

  // Discord announcement
  templates.push(`🚀 **${name} (${symbol})** is LIVE on Bags.fm!

**Why ${symbol}?**
• Creator earns fees on every trade
• ${fees} SOL already earned in fees
• $${mcap} market cap

**Links:**
🔗 Trade: bags.fm/token/${token.mint}
📊 Chart: dexscreener.com/solana/${token.mint}

LFG! 🔥`);

  // Hype one-liner
  templates.push(`${symbol} creators are earning fees on every trade while you're still launching on pump.fun 😭

bags.fm/token/${token.mint}`);

  return templates;
}

export const shillTokenAction: Action = {
  name: "shillToken",
  description: "Generate hype copy and shill content for a token in Finn's voice",

  similes: [
    "shill",
    "promote",
    "hype",
    "market",
    "spread the word",
    "help me shill",
    "write a tweet",
    "twitter thread",
    "discord announcement",
    "help me promote",
  ],

  examples: [
    [
      {
        name: "{{name1}}",
        content: { text: "help me shill $BAGS" },
      },
      {
        name: "Finn",
        content: {
          text: "Say less! Let me cook up some fire content for $BAGS...",
        },
      },
    ],
    [
      {
        name: "{{name1}}",
        content: { text: "write a tweet for my token 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" },
      },
      {
        name: "Finn",
        content: {
          text: "Let me check out your token and write something that slaps...",
        },
      },
    ],
    [
      {
        name: "{{name1}}",
        content: { text: "I need help promoting my launch" },
      },
      {
        name: "Finn",
        content: {
          text: "I got you! Drop the token address or ticker and I'll help you cook up some heat",
        },
      },
    ],
  ] as ActionExample[][],

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || "";

    // Check for shill/promote intent
    const hasShillIntent = [
      "shill",
      "promote",
      "hype",
      "market",
      "spread",
      "tweet",
      "thread",
      "discord",
      "announce",
      "help me",
    ].some((keyword) => text.includes(keyword));

    // Check for token reference
    const hasTokenRef =
      /[1-9A-HJ-NP-Za-km-z]{32,44}/.test(text) || // mint address
      /\$[A-Za-z]{2,10}/.test(text) || // $SYMBOL
      /token|coin|launch/.test(text);

    return hasShillIntent && hasTokenRef;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    const text = message.content?.text || "";
    const { mint, symbol } = extractTokenIdentifier(text);

    // If no token identifier, ask for it
    if (!mint && !symbol) {
      const response = {
        text: "I'm ready to help you cook up some fire content! Just drop your token address or ticker and I'll get to work. What are we shilling? 🔥",
      };

      if (callback) {
        await callback(response);
      }

      return {
        success: true,
        text: response.text,
        data: { needsToken: true },
      };
    }

    const api =
      runtime.getService<BagsApiService>(BagsApiService.serviceType) || getBagsApiService();

    // Fetch token info
    let token: TokenInfo | null = null;

    if (mint) {
      token = await api.getToken(mint);
    } else if (symbol) {
      const tokens = await api.searchTokens(symbol);
      token = tokens[0] || null;
    }

    if (!token) {
      const response = {
        text: "Couldn't find that token! Double-check the address or ticker and try again. Make sure it's launched on Bags.fm!",
      };

      if (callback) {
        await callback(response);
      }

      return {
        success: false,
        text: response.text,
        error: "Token not found",
      };
    }

    // Generate shill templates
    const templates = generateShillTemplates(token);

    // Check if user wants a specific format
    const wantsTwitter = /tweet|twitter|thread|x\.com/.test(text.toLowerCase());
    const wantsDiscord = /discord|server|announce/.test(text.toLowerCase());

    let selectedTemplates: string[];
    let formatLabel: string;

    if (wantsTwitter) {
      selectedTemplates = templates.slice(0, 2); // Twitter formats
      formatLabel = "Twitter";
    } else if (wantsDiscord) {
      selectedTemplates = [templates[2]]; // Discord format
      formatLabel = "Discord";
    } else {
      selectedTemplates = templates; // All formats
      formatLabel = "All platforms";
    }

    // Build response
    let responseText = `LET'S GO! Here's some fire content for $${token.symbol}:\n\n`;

    if (selectedTemplates.length === 1) {
      responseText += selectedTemplates[0];
    } else {
      responseText += selectedTemplates
        .map((t, i) => `**Option ${i + 1}:**\n\`\`\`\n${t}\n\`\`\``)
        .join("\n\n");
    }

    responseText += `\n\nPick your favorite and customize it! The best shills feel authentic. Add your own story and why YOU believe in it. Now go spread the word! 🔥`;

    const response = { text: responseText };

    if (callback) {
      await callback(response);
    }

    return {
      success: true,
      text: responseText,
      data: {
        token: {
          mint: token.mint,
          name: token.name,
          symbol: token.symbol,
          marketCap: token.marketCap,
          volume24h: token.volume24h,
          lifetimeFees: token.lifetimeFees,
        },
        templates: selectedTemplates,
        format: formatLabel,
      },
    };
  },
};

export default shillTokenAction;
