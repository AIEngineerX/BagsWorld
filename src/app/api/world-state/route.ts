import { NextResponse } from "next/server";
import type { WorldState, FeeEarner, TokenInfo, GameEvent } from "@/lib/types";
import { buildWorldState } from "@/lib/world-calculator";

// Mock data for development - in production, this would call the Bags.fm API
const MOCK_FEE_EARNERS: FeeEarner[] = [
  {
    rank: 1,
    username: "yishan",
    providerUsername: "YISHAN",
    provider: "twitter",
    wallet: "yishan123...",
    lifetimeEarnings: 59184.21,
    earnings24h: 3240,
    change24h: 49410,
    tokenCount: 3,
    avatarUrl: undefined,
  },
  {
    rank: 2,
    username: "steve_yegge",
    providerUsername: "STEVE_YEGGE",
    provider: "twitter",
    wallet: "stevey456...",
    lifetimeEarnings: 209813.78,
    earnings24h: 40250,
    change24h: 632.09,
    tokenCount: 5,
    avatarUrl: undefined,
  },
  {
    rank: 3,
    username: "jasonkneen",
    providerUsername: "JASONKNEEN",
    provider: "twitter",
    wallet: "jason789...",
    lifetimeEarnings: 43326.41,
    earnings24h: 1530,
    change24h: 13980,
    tokenCount: 2,
    avatarUrl: undefined,
  },
  {
    rank: 4,
    username: "dom_scholz",
    providerUsername: "DOM_SCHOLZ",
    provider: "twitter",
    wallet: "dom012...",
    lifetimeEarnings: 46102.25,
    earnings24h: 3170,
    change24h: 1590,
    tokenCount: 4,
    avatarUrl: undefined,
  },
  {
    rank: 5,
    username: "thekitze",
    providerUsername: "THEKITZE",
    provider: "twitter",
    wallet: "kitze345...",
    lifetimeEarnings: 22533.95,
    earnings24h: 946.7,
    change24h: 1310,
    tokenCount: 2,
    avatarUrl: undefined,
  },
  {
    rank: 6,
    username: "dividendsbot",
    providerUsername: "DIVIDENDSBOT",
    provider: "twitter",
    wallet: "dividends...",
    lifetimeEarnings: 40798.86,
    earnings24h: 136.87,
    change24h: 755.89,
    tokenCount: 1,
    avatarUrl: undefined,
  },
  {
    rank: 7,
    username: "sherryyanjiang",
    providerUsername: "SHERRYYANJIANG",
    provider: "twitter",
    wallet: "sherry...",
    lifetimeEarnings: 27273.65,
    earnings24h: 171.0,
    change24h: 507.52,
    tokenCount: 2,
    avatarUrl: undefined,
  },
  {
    rank: 8,
    username: "thekaranchawla",
    providerUsername: "THEKARANCHAW...",
    provider: "twitter",
    wallet: "karan...",
    lifetimeEarnings: 58771.63,
    earnings24h: 2430,
    change24h: 498.74,
    tokenCount: 3,
    avatarUrl: undefined,
  },
  {
    rank: 9,
    username: "claude_memory",
    providerUsername: "CLAUDE_MEMORY",
    provider: "twitter",
    wallet: "claude...",
    lifetimeEarnings: 68025.9,
    earnings24h: 5810,
    change24h: 392.43,
    tokenCount: 4,
    avatarUrl: undefined,
  },
];

const MOCK_TOKENS: TokenInfo[] = [
  {
    mint: "terra123...",
    name: "TERRA",
    symbol: "TERRA",
    price: 0.0032,
    marketCap: 3240000,
    volume24h: 8940000,
    change24h: 49410,
    holders: 3400,
    lifetimeFees: 59184.21,
    creator: "yishan123...",
  },
  {
    mint: "gas456...",
    name: "GAS",
    symbol: "GAS",
    price: 0.04,
    marketCap: 40250000,
    volume24h: 39460000,
    change24h: 632.09,
    holders: 7470,
    lifetimeFees: 209813.78,
    creator: "stevey456...",
  },
  {
    mint: "huggi789...",
    name: "HUGGI",
    symbol: "HUGGI",
    price: 0.0015,
    marketCap: 1530000,
    volume24h: 6740000,
    change24h: 13980,
    holders: 2030,
    lifetimeFees: 43326.41,
    creator: "jason789...",
  },
  {
    mint: "starcraft012...",
    name: "STARCRAFT",
    symbol: "STARCRAFT",
    price: 0.0032,
    marketCap: 3170000,
    volume24h: 4970000,
    change24h: 1590,
    holders: 1760,
    lifetimeFees: 46102.25,
    creator: "dom012...",
  },
  {
    mint: "slopcraft345...",
    name: "SLOPCRAFT",
    symbol: "SLOPCRAFT",
    price: 0.00095,
    marketCap: 946700,
    volume24h: 1300000,
    change24h: 1310,
    holders: 1110,
    lifetimeFees: 22533.95,
    creator: "kitze345...",
  },
  {
    mint: "company678...",
    name: "COMPANY",
    symbol: "COMPANY",
    price: 0.00014,
    marketCap: 136870,
    volume24h: 157850,
    change24h: 755.89,
    holders: 865,
    lifetimeFees: 40798.86,
    creator: "dividends...",
  },
  {
    mint: "peekmoney901...",
    name: "PEEKMONEY",
    symbol: "PEEKMONEY",
    price: 0.00017,
    marketCap: 171000,
    volume24h: 477800,
    change24h: 507.52,
    holders: 567,
    lifetimeFees: 27273.65,
    creator: "sherry...",
  },
  {
    mint: "vvm234...",
    name: "VVM",
    symbol: "VVM",
    price: 0.0024,
    marketCap: 2430000,
    volume24h: 2540000,
    change24h: 498.74,
    holders: 1320,
    lifetimeFees: 58771.63,
    creator: "karan...",
  },
  {
    mint: "cmem567...",
    name: "CMEM",
    symbol: "CMEM",
    price: 0.0058,
    marketCap: 5810000,
    volume24h: 7050000,
    change24h: 392.43,
    holders: 2470,
    lifetimeFees: 68025.9,
    creator: "claude...",
  },
];

// Store previous state for event generation
let previousState: WorldState | null = null;

export async function GET() {
  try {
    // In production, fetch real data from Bags.fm API
    // const bagsApi = getBagsApi();
    // const earners = await fetchTopEarners(bagsApi);
    // const tokens = await fetchTopTokens(bagsApi);

    // Add some randomness to simulate live data
    const earners = MOCK_FEE_EARNERS.map((e) => ({
      ...e,
      earnings24h: e.earnings24h * (0.9 + Math.random() * 0.2),
      change24h: e.change24h * (0.8 + Math.random() * 0.4),
    }));

    const tokens = MOCK_TOKENS.map((t) => ({
      ...t,
      volume24h: t.volume24h * (0.8 + Math.random() * 0.4),
      change24h: t.change24h * (0.9 + Math.random() * 0.2),
    }));

    // Build world state
    const worldState = buildWorldState(earners, tokens, previousState ?? undefined);

    // Add some random events occasionally
    if (Math.random() > 0.7) {
      const eventTypes: GameEvent["type"][] = [
        "fee_claim",
        "price_pump",
        "milestone",
      ];
      const randomType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      const randomEarner = earners[Math.floor(Math.random() * earners.length)];
      const randomToken = tokens[Math.floor(Math.random() * tokens.length)];

      const newEvent: GameEvent = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: randomType,
        message:
          randomType === "fee_claim"
            ? `💰 ${randomEarner.providerUsername} claimed ${(Math.random() * 10).toFixed(2)} SOL`
            : randomType === "price_pump"
            ? `📈 ${randomToken.name} pumped ${(Math.random() * 50 + 10).toFixed(0)}%!`
            : `🏆 ${randomEarner.providerUsername} reached a milestone!`,
        timestamp: Date.now(),
        data: {
          username: randomEarner.providerUsername,
          tokenName: randomToken.name,
          amount: Math.random() * 1000,
          change: Math.random() * 100,
        },
      };

      worldState.events.unshift(newEvent);
    }

    previousState = worldState;

    return NextResponse.json(worldState);
  } catch (error) {
    console.error("Error fetching world state:", error);
    return NextResponse.json(
      { error: "Failed to fetch world state" },
      { status: 500 }
    );
  }
}
