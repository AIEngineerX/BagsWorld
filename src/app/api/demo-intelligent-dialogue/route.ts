// Demo endpoint showing what intelligent dialogue looks like with mock data
// This works without any API keys - just demonstrates the format

import { NextResponse } from "next/server";

// Simulated intelligent conversation - this is what Claude generates
const DEMO_CONVERSATIONS = {
  market_discussion: [
    {
      speaker: "finn",
      name: "Finn",
      message: "$DEGEN up 156% - this is what happens when devs actually build",
    },
    {
      speaker: "ghost",
      name: "Ghost",
      message: "watching the chain. @cryptobuilder at 125 SOL earned. top creator rn",
    },
    {
      speaker: "neo",
      name: "Neo",
      message: "i see accumulation patterns on $BAGS. 2.5M mcap but volume says more coming",
    },
    {
      speaker: "finn",
      name: "Finn",
      message: "754K in 24h volume. 47 active tokens. ecosystem shipping daily",
    },
    {
      speaker: "ghost",
      name: "Ghost",
      message: "7.5K SOL in fees generated today. creators getting paid. all verifiable",
    },
    {
      speaker: "neo",
      name: "Neo",
      message: "the code shows @degenwhale loading. 89 SOL position. smart money moving",
    },
  ],
  token_launch: [
    { speaker: "neo", name: "Neo", message: "new signal in the matrix. $ALPHA just deployed" },
    {
      speaker: "finn",
      name: "Finn",
      message: "another builder entering. 180K mcap out the gate. let's see the volume",
    },
    {
      speaker: "ghost",
      name: "Ghost",
      message: "contract clean. fees locked. checking creator wallet history...",
    },
    {
      speaker: "neo",
      name: "Neo",
      message: "wallet shows previous success. @solanadev - 4 tokens, 28 SOL earned",
    },
    {
      speaker: "finn",
      name: "Finn",
      message: "experienced creator. this could run. watching closely",
    },
  ],
  fee_claim: [
    {
      speaker: "ghost",
      name: "Ghost",
      message: "claim detected. @cryptobuilder just pulled 12.5 SOL from $BAGS",
    },
    {
      speaker: "finn",
      name: "Finn",
      message: "125 SOL lifetime earnings. top creator doing top creator things",
    },
    {
      speaker: "ash",
      name: "Ash",
      message: "that's like winning the pokemon league! top trainer gets the prizes!",
    },
    {
      speaker: "ghost",
      name: "Ghost",
      message: "check solscan. tx confirms in 400ms. solana speed",
    },
    {
      speaker: "finn",
      name: "Finn",
      message: "this is why we built bags. creators earn, ecosystem grows",
    },
  ],
  world_health: [
    {
      speaker: "bags-bot",
      name: "Bags Bot",
      message: "world health at 85% ser. vibes are immaculate ngl",
    },
    {
      speaker: "ash",
      name: "Ash",
      message: "47 tokens active! that's like having a full pokedex of opportunities!",
    },
    {
      speaker: "finn",
      name: "Finn",
      message: "healthy ecosystem = healthy volume. 754K in 24h proves it",
    },
    {
      speaker: "neo",
      name: "Neo",
      message: "i see green across the board. the code doesn't lie about momentum",
    },
    {
      speaker: "bags-bot",
      name: "Bags Bot",
      message: "even the animals are happy. historically bullish signal fren",
    },
  ],
};

const MOCK_WORLD_DATA = {
  topTokens: [
    { symbol: "BAGS", marketCap: 2500000, volume24h: 450000, change24h: 23.5 },
    { symbol: "MOON", marketCap: 890000, volume24h: 125000, change24h: -8.2 },
    { symbol: "DEGEN", marketCap: 650000, volume24h: 89000, change24h: 156.7 },
    { symbol: "PUMP", marketCap: 420000, volume24h: 67000, change24h: 45.0 },
    { symbol: "ALPHA", marketCap: 180000, volume24h: 23000, change24h: 12.3 },
  ],
  topCreators: [
    { username: "cryptobuilder", earnings: 125.5, tokens: 3 },
    { username: "degenwhale", earnings: 89.2, tokens: 2 },
    { username: "alphahunter", earnings: 45.8, tokens: 5 },
    { username: "pumpmaster", earnings: 34.1, tokens: 1 },
    { username: "solanadev", earnings: 28.9, tokens: 4 },
  ],
  stats: {
    volume24h: 754000,
    fees24h: 7540,
    activeTokens: 47,
    creators: 156,
    worldHealth: 85,
  },
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const topic = searchParams.get("topic") || "market_discussion";

  const conversation =
    DEMO_CONVERSATIONS[topic as keyof typeof DEMO_CONVERSATIONS] ||
    DEMO_CONVERSATIONS.market_discussion;

  return NextResponse.json({
    demo: true,
    note: "This is a demonstration of what intelligent dialogue looks like. Add real API keys to enable live data.",
    topic,
    worldData: MOCK_WORLD_DATA,
    conversation: conversation.map((line, i) => ({
      ...line,
      timestamp: Date.now() + i * 4000,
      emotion: topic === "fee_claim" ? "excited" : topic === "world_health" ? "happy" : "neutral",
    })),
    availableTopics: Object.keys(DEMO_CONVERSATIONS),
    howToEnable: {
      step1: "Get Anthropic API key from https://console.anthropic.com/",
      step2: "Add to .env.local: ANTHROPIC_API_KEY=sk-ant-api03-...",
      step3: "Restart dev server",
      result: "Characters will discuss REAL Bags.fm data using Claude AI",
    },
  });
}
