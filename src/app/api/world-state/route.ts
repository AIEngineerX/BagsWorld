import { NextResponse } from "next/server";
import type { WorldState, FeeEarner, TokenInfo, GameEvent } from "@/lib/types";
import { buildWorldState } from "@/lib/world-calculator";

// Representative data based on real Bags.fm top earners and tokens
// Note: The Bags.fm public API doesn't expose leaderboard endpoints,
// so this data simulates realistic values based on known top performers
const BASE_FEE_EARNERS: FeeEarner[] = [
  {
    rank: 1,
    username: "yishan",
    providerUsername: "yishan",
    provider: "twitter",
    wallet: "yishan123abc",
    lifetimeEarnings: 59184.21,
    earnings24h: 3240,
    change24h: 15.5,
    tokenCount: 3,
    avatarUrl: undefined,
  },
  {
    rank: 2,
    username: "steve_yegge",
    providerUsername: "steve_yegge",
    provider: "twitter",
    wallet: "stevey456def",
    lifetimeEarnings: 209813.78,
    earnings24h: 40250,
    change24h: 8.2,
    tokenCount: 5,
    avatarUrl: undefined,
  },
  {
    rank: 3,
    username: "jasonkneen",
    providerUsername: "jasonkneen",
    provider: "twitter",
    wallet: "jason789ghi",
    lifetimeEarnings: 43326.41,
    earnings24h: 1530,
    change24h: 22.1,
    tokenCount: 2,
    avatarUrl: undefined,
  },
  {
    rank: 4,
    username: "dom_scholz",
    providerUsername: "dom_scholz",
    provider: "twitter",
    wallet: "dom012jkl",
    lifetimeEarnings: 46102.25,
    earnings24h: 3170,
    change24h: 5.8,
    tokenCount: 4,
    avatarUrl: undefined,
  },
  {
    rank: 5,
    username: "thekitze",
    providerUsername: "thekitze",
    provider: "twitter",
    wallet: "kitze345mno",
    lifetimeEarnings: 22533.95,
    earnings24h: 946.7,
    change24h: -3.2,
    tokenCount: 2,
    avatarUrl: undefined,
  },
  {
    rank: 6,
    username: "dividendsbot",
    providerUsername: "dividendsbot",
    provider: "twitter",
    wallet: "dividendspqr",
    lifetimeEarnings: 40798.86,
    earnings24h: 136.87,
    change24h: 12.4,
    tokenCount: 1,
    avatarUrl: undefined,
  },
  {
    rank: 7,
    username: "sherryyanjiang",
    providerUsername: "sherryyanjiang",
    provider: "twitter",
    wallet: "sherrystu",
    lifetimeEarnings: 27273.65,
    earnings24h: 171.0,
    change24h: -8.7,
    tokenCount: 2,
    avatarUrl: undefined,
  },
  {
    rank: 8,
    username: "thekaranchawla",
    providerUsername: "thekaranchawla",
    provider: "twitter",
    wallet: "karanvwx",
    lifetimeEarnings: 58771.63,
    earnings24h: 2430,
    change24h: 31.2,
    tokenCount: 3,
    avatarUrl: undefined,
  },
  {
    rank: 9,
    username: "ClaudeAI",
    providerUsername: "ClaudeAI",
    provider: "twitter",
    wallet: "claudeyz",
    lifetimeEarnings: 68025.9,
    earnings24h: 5810,
    change24h: 18.9,
    tokenCount: 4,
    avatarUrl: undefined,
  },
];

const BASE_TOKENS: TokenInfo[] = [
  {
    mint: "terra123abcdef",
    name: "TERRA",
    symbol: "TERRA",
    price: 0.0032,
    marketCap: 3240000,
    volume24h: 894000,
    change24h: 15.5,
    holders: 3400,
    lifetimeFees: 59184.21,
    creator: "yishan123abc",
  },
  {
    mint: "gas456ghijkl",
    name: "GAS",
    symbol: "GAS",
    price: 0.04,
    marketCap: 40250000,
    volume24h: 3946000,
    change24h: 8.2,
    holders: 7470,
    lifetimeFees: 209813.78,
    creator: "stevey456def",
  },
  {
    mint: "huggi789mnopq",
    name: "HUGGI",
    symbol: "HUGGI",
    price: 0.0015,
    marketCap: 1530000,
    volume24h: 674000,
    change24h: 22.1,
    holders: 2030,
    lifetimeFees: 43326.41,
    creator: "jason789ghi",
  },
  {
    mint: "starcraft012rs",
    name: "STARCRAFT",
    symbol: "STARCRAFT",
    price: 0.0032,
    marketCap: 3170000,
    volume24h: 497000,
    change24h: 5.8,
    holders: 1760,
    lifetimeFees: 46102.25,
    creator: "dom012jkl",
  },
  {
    mint: "slopcraft345tu",
    name: "SLOPCRAFT",
    symbol: "SLOPCRAFT",
    price: 0.00095,
    marketCap: 946700,
    volume24h: 130000,
    change24h: -3.2,
    holders: 1110,
    lifetimeFees: 22533.95,
    creator: "kitze345mno",
  },
  {
    mint: "company678vwx",
    name: "COMPANY",
    symbol: "COMPANY",
    price: 0.00014,
    marketCap: 136870,
    volume24h: 15785,
    change24h: 12.4,
    holders: 865,
    lifetimeFees: 40798.86,
    creator: "dividendspqr",
  },
  {
    mint: "peekmoney901yz",
    name: "PEEKMONEY",
    symbol: "PEEKMONEY",
    price: 0.00017,
    marketCap: 171000,
    volume24h: 47780,
    change24h: -8.7,
    holders: 567,
    lifetimeFees: 27273.65,
    creator: "sherrystu",
  },
  {
    mint: "vvm234abcxyz",
    name: "VVM",
    symbol: "VVM",
    price: 0.0024,
    marketCap: 2430000,
    volume24h: 254000,
    change24h: 31.2,
    holders: 1320,
    lifetimeFees: 58771.63,
    creator: "karanvwx",
  },
  {
    mint: "cmem567defghi",
    name: "CMEM",
    symbol: "CMEM",
    price: 0.0058,
    marketCap: 5810000,
    volume24h: 705000,
    change24h: 18.9,
    holders: 2470,
    lifetimeFees: 68025.9,
    creator: "claudeyz",
  },
];

// Track state across requests for consistent evolution
let lastUpdateTime = Date.now();
let accumulatedChanges: Map<string, number> = new Map();

// Store previous state for event generation
let previousState: WorldState | null = null;

// Simulate realistic market movements
function simulateMarketChange(baseChange: number, timeDelta: number): number {
  // Small random walk based on time elapsed
  const volatility = 0.02; // 2% volatility per update
  const randomWalk = (Math.random() - 0.5) * 2 * volatility * 100;

  // Mean reversion tendency - extreme values tend to revert
  const meanReversion = -baseChange * 0.01;

  return baseChange + randomWalk + meanReversion;
}

export async function GET() {
  try {
    const now = Date.now();
    const timeDelta = now - lastUpdateTime;
    lastUpdateTime = now;

    // Apply realistic market simulation to earners
    const earners = BASE_FEE_EARNERS.map((e) => {
      // Get or initialize accumulated change for this earner
      const key = `earner-${e.wallet}`;
      let currentChange = accumulatedChanges.get(key) ?? e.change24h;
      currentChange = simulateMarketChange(currentChange, timeDelta);
      accumulatedChanges.set(key, currentChange);

      // Small variation in earnings (they accumulate over time)
      const earningsMultiplier = 1 + (Math.random() * 0.02 - 0.005);

      return {
        ...e,
        earnings24h: e.earnings24h * earningsMultiplier,
        change24h: currentChange,
      };
    });

    // Apply realistic market simulation to tokens
    const tokens = BASE_TOKENS.map((t) => {
      // Get or initialize accumulated change for this token
      const key = `token-${t.mint}`;
      let currentChange = accumulatedChanges.get(key) ?? t.change24h;
      currentChange = simulateMarketChange(currentChange, timeDelta);
      accumulatedChanges.set(key, currentChange);

      // Volume fluctuates more than price
      const volumeMultiplier = 0.9 + Math.random() * 0.2;

      // Market cap changes based on price change
      const priceMultiplier = 1 + (currentChange / 100) * 0.001;

      return {
        ...t,
        volume24h: t.volume24h * volumeMultiplier,
        change24h: currentChange,
        marketCap: t.marketCap * priceMultiplier,
        price: t.price * priceMultiplier,
      };
    });

    // Build world state
    const worldState = buildWorldState(earners, tokens, previousState ?? undefined);

    // Generate events based on significant changes (more realistic)
    const shouldGenerateEvent = Math.random() > 0.6; // 40% chance per request

    if (shouldGenerateEvent) {
      const eventTypes: GameEvent["type"][] = [
        "fee_claim",
        "price_pump",
        "price_dump",
        "whale_alert",
        "milestone",
      ];

      // Weight events based on market conditions
      const avgChange = tokens.reduce((sum, t) => sum + t.change24h, 0) / tokens.length;
      let selectedType: GameEvent["type"];

      if (avgChange > 10) {
        selectedType = Math.random() > 0.3 ? "price_pump" : "fee_claim";
      } else if (avgChange < -5) {
        selectedType = Math.random() > 0.3 ? "price_dump" : "whale_alert";
      } else {
        selectedType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      }

      const randomEarner = earners[Math.floor(Math.random() * earners.length)];
      const randomToken = tokens[Math.floor(Math.random() * tokens.length)];
      const claimAmount = (Math.random() * 5 + 0.5).toFixed(2);
      const pumpPercent = (Math.random() * 30 + 5).toFixed(0);
      const dumpPercent = (Math.random() * 20 + 3).toFixed(0);

      const messages: Record<GameEvent["type"], string> = {
        fee_claim: `${randomEarner.providerUsername} claimed ${claimAmount} SOL`,
        price_pump: `${randomToken.name} pumped ${pumpPercent}%!`,
        price_dump: `${randomToken.name} dropped ${dumpPercent}%`,
        whale_alert: `Whale activity detected on ${randomToken.name}`,
        milestone: `${randomEarner.providerUsername} reached a new milestone!`,
        token_launch: `New token launched by ${randomEarner.providerUsername}`,
      };

      const newEvent: GameEvent = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: selectedType,
        message: messages[selectedType],
        timestamp: Date.now(),
        data: {
          username: randomEarner.providerUsername,
          tokenName: randomToken.name,
          amount: parseFloat(claimAmount),
          change: parseFloat(pumpPercent),
        },
      };

      worldState.events.unshift(newEvent);
      // Keep only last 20 events
      worldState.events = worldState.events.slice(0, 20);
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
