import { NextResponse } from "next/server";
import { BagsApiClient } from "@/lib/bags-api";
import type { AIPersonality, AIAction } from "@/lib/ai-agent";

// Initialize Bags API client
let bagsApi: BagsApiClient | null = null;

function getBagsApi(): BagsApiClient | null {
  if (!bagsApi && process.env.BAGS_API_KEY) {
    bagsApi = new BagsApiClient(process.env.BAGS_API_KEY);
  }
  return bagsApi;
}

interface BotRequestBody {
  action:
    | "chat"
    | "get_token_info"
    | "get_citizen_info"
    | "get_building_info"
    | "get_animal_mood"
    | "check_claimable"
    | "get_fee_stats"
    | "lookup_wallet";
  personality: AIPersonality;
  worldState?: {
    health: number;
    weather: string;
    populationCount: number;
    buildingCount: number;
    recentEvents: Array<{ type: string; message: string }>;
    topBuildings?: Array<{ name: string; symbol: string; mint?: string; marketCap?: number; change24h?: number }>;
    population?: Array<{ username: string; mood: string; earnings24h?: number }>;
    animals?: Array<{ type: string; mood?: string }>;
  };
  userMessage?: string;
  targetId?: string; // Token mint, citizen ID, or animal type
  walletAddress?: string;
  chatHistory?: Array<{ role: string; content: string }>;
}

// Use Anthropic API if available
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export async function POST(request: Request) {
  try {
    const body: BotRequestBody = await request.json();
    const { action, personality, worldState, userMessage, targetId, walletAddress, chatHistory } = body;
    const api = getBagsApi();

    switch (action) {
      case "chat":
        return handleChat(personality, worldState, userMessage || "", chatHistory || [], api);

      case "get_token_info":
        return handleGetTokenInfo(targetId, api, personality);

      case "get_citizen_info":
        return handleGetCitizenInfo(targetId, worldState, personality);

      case "get_building_info":
        return handleGetBuildingInfo(targetId, worldState, api, personality);

      case "get_animal_mood":
        return handleGetAnimalMood(targetId, worldState, personality);

      case "check_claimable":
        return handleCheckClaimable(walletAddress, api, personality);

      case "get_fee_stats":
        return handleGetFeeStats(targetId, api, personality);

      case "lookup_wallet":
        return handleLookupWallet(targetId, api, personality);

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Bags Bot API error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

async function handleChat(
  personality: AIPersonality,
  worldState: BotRequestBody["worldState"],
  userMessage: string,
  chatHistory: Array<{ role: string; content: string }>,
  api: BagsApiClient | null
): Promise<NextResponse> {
  const lowerMsg = userMessage.toLowerCase();

  // Check for specific intents
  if (lowerMsg.includes("pet") || lowerMsg.includes("animal") || lowerMsg.includes("dog") || lowerMsg.includes("cat") || lowerMsg.includes("bird") || lowerMsg.includes("butterfly") || lowerMsg.includes("squirrel")) {
    const animalResponse = getAnimalInteractionResponse(personality, lowerMsg);
    return NextResponse.json({
      action: {
        type: "speak",
        message: animalResponse.message,
        intent: "animal_interaction",
      },
      data: animalResponse.data,
    });
  }

  if (lowerMsg.includes("citizen") || lowerMsg.includes("character") || lowerMsg.includes("who is")) {
    return NextResponse.json({
      action: {
        type: "speak",
        message: getCitizenInteractionResponse(personality, worldState),
        intent: "citizen_interaction",
      },
    });
  }

  if (lowerMsg.includes("building") || lowerMsg.includes("token") || lowerMsg.includes("$")) {
    return NextResponse.json({
      action: {
        type: "speak",
        message: getBuildingInteractionResponse(personality, worldState),
        intent: "building_interaction",
      },
    });
  }

  if (lowerMsg.includes("claim") || lowerMsg.includes("fees") || lowerMsg.includes("earnings")) {
    return NextResponse.json({
      action: {
        type: "speak",
        message: getClaimResponse(personality),
        intent: "claim_info",
      },
    });
  }

  if (lowerMsg.includes("launch") || lowerMsg.includes("create token") || lowerMsg.includes("new token")) {
    return NextResponse.json({
      action: {
        type: "speak",
        message: getLaunchResponse(personality),
        intent: "launch_info",
      },
    });
  }

  // Use Claude API if available for general chat
  if (ANTHROPIC_API_KEY) {
    console.log("Using Claude API for chat response");
    const response = await generateClaudeBotResponse(personality, worldState, userMessage, chatHistory);
    return NextResponse.json({ action: response });
  } else {
    console.log("ANTHROPIC_API_KEY not set, using fallback responses");
  }

  // Fallback response
  return NextResponse.json({
    action: generateFallbackBotResponse(personality, worldState, userMessage),
  });
}

async function handleGetTokenInfo(
  mint: string | undefined,
  api: BagsApiClient | null,
  personality: AIPersonality
): Promise<NextResponse> {
  if (!mint) {
    return NextResponse.json({
      action: { type: "speak", message: "need a token mint to look that up. which bag are you curious about?" },
    });
  }

  if (!api) {
    return NextResponse.json({
      action: { type: "speak", message: "bags api not connected rn... cant check token data 😢" },
    });
  }

  try {
    const [fees, creators] = await Promise.allSettled([
      api.getTokenLifetimeFees(mint),
      api.getTokenCreators(mint),
    ]);

    const feesData = fees.status === "fulfilled" ? fees.value : null;
    const creatorsData = creators.status === "fulfilled" ? creators.value : [];

    const responses: Record<AIPersonality["trait"], string> = {
      optimistic: feesData
        ? `this bag is PRINTING! 💰 ${(feesData.lifetimeFees / 1e9).toFixed(2)} SOL lifetime fees, ${(feesData.totalUnclaimed / 1e9).toFixed(2)} SOL ready to claim! ${creatorsData.length} creator(s) eating good 🚀`
        : `couldn't find fee data for this mint... might be a fresh launch or not on bags.fm yet`,
      cautious: feesData
        ? `token stats: ${(feesData.lifetimeFees / 1e9).toFixed(2)} SOL total fees, ${(feesData.totalClaimed / 1e9).toFixed(2)} claimed, ${(feesData.totalUnclaimed / 1e9).toFixed(2)} pending. ${creatorsData.length} creator(s) registered. always verify before aping`
        : `no data found for this mint. could be new or not on bags. proceed carefully`,
      chaotic: feesData
        ? `YOOO THIS BAG GOT ${(feesData.lifetimeFees / 1e9).toFixed(2)} SOL IN FEES!! ${(feesData.totalUnclaimed / 1e9).toFixed(2)} SOL JUST SITTING THERE!! ${creatorsData.length} lucky degens claiming this 🐸🔥`
        : `can't find this token... either its super fresh or its hiding from me 👀`,
      strategic: feesData
        ? `token analysis: lifetime fees ${(feesData.lifetimeFees / 1e9).toFixed(4)} SOL, claimed ${(feesData.totalClaimed / 1e9).toFixed(4)} SOL (${((feesData.totalClaimed / feesData.lifetimeFees) * 100).toFixed(1)}%), unclaimed ${(feesData.totalUnclaimed / 1e9).toFixed(4)} SOL. ${creatorsData.length} registered creator(s) 📊`
        : `token not found in bags.fm database. may not be registered for fee sharing`,
    };

    return NextResponse.json({
      action: { type: "speak", message: responses[personality.trait] },
      data: { fees: feesData, creators: creatorsData },
    });
  } catch (error) {
    return NextResponse.json({
      action: { type: "speak", message: "something went wrong fetching token data... try again" },
    });
  }
}

async function handleGetCitizenInfo(
  citizenId: string | undefined,
  worldState: BotRequestBody["worldState"],
  personality: AIPersonality
): Promise<NextResponse> {
  if (!worldState?.population?.length) {
    return NextResponse.json({
      action: { type: "speak", message: "no citizens loaded in BagsWorld rn... world might still be syncing" },
    });
  }

  const citizen = citizenId
    ? worldState.population.find(c => c.username.toLowerCase().includes(citizenId.toLowerCase()))
    : worldState.population[Math.floor(Math.random() * worldState.population.length)];

  if (!citizen) {
    return NextResponse.json({
      action: { type: "speak", message: `can't find anyone named "${citizenId}" in the city right now` },
    });
  }

  const responses: Record<AIPersonality["trait"], string> = {
    optimistic: `${citizen.username} is ${citizen.mood} right now! ${citizen.mood === "celebrating" ? "THEY'RE WINNING! 🎉" : citizen.mood === "sad" ? "they need some hopium, send good vibes!" : "vibing in BagsWorld"} ${citizen.earnings24h ? `made ${citizen.earnings24h.toFixed(2)} SOL today!` : ""}`,
    cautious: `spotted ${citizen.username} - mood: ${citizen.mood}. ${citizen.earnings24h ? `24h earnings: ${citizen.earnings24h.toFixed(4)} SOL.` : ""} ${citizen.mood === "sad" ? "rough day for them..." : "seems stable for now"}`,
    chaotic: `OMG ITS ${citizen.username.toUpperCase()}!! they're ${citizen.mood === "celebrating" ? "ABSOLUTELY ZOOTED RN 🎉🔥" : citizen.mood === "sad" ? "down bad lmaooo *hugs them*" : "just chillin"} 🐸`,
    strategic: `citizen ${citizen.username}: status ${citizen.mood}, ${citizen.earnings24h ? `daily P&L: ${citizen.earnings24h.toFixed(4)} SOL` : "earnings not tracked"}. ${citizen.mood === "celebrating" ? "likely profitable position" : citizen.mood === "sad" ? "possible underwater position" : "neutral sentiment"}`,
  };

  return NextResponse.json({
    action: { type: "encourage", message: responses[personality.trait], target: citizen.username },
    data: { citizen },
  });
}

async function handleGetBuildingInfo(
  buildingName: string | undefined,
  worldState: BotRequestBody["worldState"],
  api: BagsApiClient | null,
  personality: AIPersonality
): Promise<NextResponse> {
  if (!worldState?.topBuildings?.length) {
    return NextResponse.json({
      action: { type: "speak", message: "no buildings loaded yet ser... world still syncing" },
    });
  }

  const building = buildingName
    ? worldState.topBuildings.find(b =>
        b.name.toLowerCase().includes(buildingName.toLowerCase()) ||
        b.symbol.toLowerCase().includes(buildingName.toLowerCase().replace("$", ""))
      )
    : worldState.topBuildings[0];

  if (!building) {
    return NextResponse.json({
      action: { type: "speak", message: `cant find a building called "${buildingName}" in the city` },
    });
  }

  // Try to fetch real fee data if mint is available
  let feeData = null;
  if (building.mint && api) {
    try {
      feeData = await api.getTokenLifetimeFees(building.mint);
    } catch {}
  }

  const change = building.change24h || 0;
  const mcap = building.marketCap || 0;

  const responses: Record<AIPersonality["trait"], string> = {
    optimistic: `$${building.symbol} building is ${change > 0 ? "PUMPING" : "holding"}! ${change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`} today 📈 ${mcap > 0 ? `mcap ${formatNumber(mcap)}` : ""} ${feeData ? `| ${(feeData.lifetimeFees / 1e9).toFixed(2)} SOL in fees generated!` : ""} looking good 🚀`,
    cautious: `$${building.symbol} stats: ${change.toFixed(1)}% 24h change${mcap > 0 ? `, ${formatNumber(mcap)} mcap` : ""}. ${feeData ? `lifetime fees: ${(feeData.lifetimeFees / 1e9).toFixed(4)} SOL.` : ""} ${change < -10 ? "looking weak, be careful" : change > 10 ? "strong move but don't fomo" : "consolidating"}`,
    chaotic: `$${building.symbol} IS ${change > 0 ? "MOONING" : "DUMPING"} ${change > 0 ? "🚀🚀🚀" : "📉📉📉"} ${Math.abs(change).toFixed(0)}% MOVE!! ${feeData ? `${(feeData.lifetimeFees / 1e9).toFixed(2)} SOL FEES GENERATED` : ""} 🐸`,
    strategic: `$${building.symbol} analysis: 24h ${change > 0 ? "+" : ""}${change.toFixed(2)}%${mcap > 0 ? `, market cap ${formatNumber(mcap)}` : ""}. ${feeData ? `fee metrics: ${(feeData.lifetimeFees / 1e9).toFixed(4)} SOL total, ${(feeData.totalUnclaimed / 1e9).toFixed(4)} unclaimed` : "fee data unavailable"} 📊`,
  };

  return NextResponse.json({
    action: { type: "speak", message: responses[personality.trait] },
    data: { building, feeData },
  });
}

async function handleGetAnimalMood(
  animalType: string | undefined,
  worldState: BotRequestBody["worldState"],
  personality: AIPersonality
): Promise<NextResponse> {
  const animals = ["dog", "cat", "bird", "butterfly", "squirrel"];
  const animal = animalType?.toLowerCase() || animals[Math.floor(Math.random() * animals.length)];

  const animalMoods: Record<string, Record<AIPersonality["trait"], string>> = {
    dog: {
      optimistic: "*pets the dog* WHOS A GOOD BOY?! this doge is BULLISH on belly rubs 🐕 wagmi together fren!",
      cautious: "*carefully approaches dog* hey buddy... even the doges in BagsWorld know to be careful. woof woof (stay safe anon)",
      chaotic: "PUPPY!! 🐕 *throws stick* FETCH THE GAINS!! good boy is 100x bullish on treats!! WHO LET THE DOGS OUT?! 🐸",
      strategic: "*observes dog behavior* interesting... the dog seems to react to market sentiment. bullish tail wags detected 📊",
    },
    cat: {
      optimistic: "*scritches cat* even the cats here are vibing!! probably knows which tokens gonna pump tbh 🐱 smart kitty!",
      cautious: "*the cat stares judgmentally* ...this cat has seen things. many portfolios. many rugs. wise feline 🐱",
      chaotic: "KITTY!! 🐱 *cat knocks over my portfolio* LMAOOO EVEN THE CAT IS BEARISH!! chaos kitty is my spirit animal 🐸",
      strategic: "*studies cat patterns* fascinating... cats typically indicate market indecision. currently: lounging (neutral) 📊",
    },
    bird: {
      optimistic: "*watches bird fly* even the birds here are free like our gains gonna be!! fly high little fren 🐦",
      cautious: "bird flying overhead... either good omen or about to dump on us literally. staying alert 🐦",
      chaotic: "BIRB!! 🐦 *bird poops on chart* THATS A BULLISH SIGNAL RIGHT?! RIGHT?! lmaooo 🐸",
      strategic: "bird movement analysis: flight pattern indicates... actually nvm its just a bird 📊🐦",
    },
    butterfly: {
      optimistic: "*butterfly lands nearby* beautiful!! just like our gains gonna be ser 🦋 nature is bullish",
      cautious: "butterfly effect... one small trade can change everything. trade carefully anon 🦋",
      chaotic: "BUTTERFLY!! 🦋 *chases it* CATCH THE GAINS!! butterfly effect means if i ape now ill be rich right?! 🐸",
      strategic: "observing butterfly: symbolic of transformation. portfolio metamorphosis incoming? 🦋📊",
    },
    squirrel: {
      optimistic: "*watches squirrel collect nuts* smart! stacking bags like a true degen 🐿️ were all squirrels here ser",
      cautious: "squirrel is preparing for winter... maybe we should too. accumulating responsibly 🐿️",
      chaotic: "SQUIRREL!! 🐿️ *squirrel steals my sol* HEY!! give back my bags!! ...actually based move ngl 🐸",
      strategic: "squirrel accumulation pattern detected: DCA strategy observed. effective for volatile markets 🐿️📊",
    },
  };

  const validAnimal = animals.includes(animal) ? animal : "dog";

  return NextResponse.json({
    action: {
      type: "speak",
      message: animalMoods[validAnimal][personality.trait],
      target: validAnimal,
    },
    data: { animal: validAnimal },
  });
}

async function handleCheckClaimable(
  wallet: string | undefined,
  api: BagsApiClient | null,
  personality: AIPersonality
): Promise<NextResponse> {
  if (!wallet) {
    return NextResponse.json({
      action: { type: "speak", message: "connect your wallet first! need an address to check claimable fees" },
    });
  }

  if (!api) {
    return NextResponse.json({
      action: { type: "speak", message: "bags api not connected... can't check your claimable positions right now" },
    });
  }

  try {
    const positions = await api.getClaimablePositions(wallet);
    const totalClaimable = positions.reduce((sum, p) => sum + p.claimableDisplayAmount, 0);

    if (positions.length === 0) {
      const responses: Record<AIPersonality["trait"], string> = {
        optimistic: "no fees to claim right now but don't worry! keep building and the fees will come 🚀",
        cautious: "wallet is clean, no pending claims. might want to check if your tokens are set up for fee sharing",
        chaotic: "NOTHING TO CLAIM?! time to ape into more bags then 🐸",
        strategic: "zero claimable positions detected. either already claimed or no fee-earning tokens in wallet",
      };
      return NextResponse.json({ action: { type: "speak", message: responses[personality.trait] } });
    }

    const responses: Record<AIPersonality["trait"], string> = {
      optimistic: `you got ${totalClaimable.toFixed(4)} SOL waiting to be claimed across ${positions.length} position(s)! 💰🚀 time to harvest those gains!`,
      cautious: `found ${positions.length} claimable position(s) totaling ${totalClaimable.toFixed(4)} SOL. might be worth claiming if gas is reasonable`,
      chaotic: `${totalClaimable.toFixed(2)} SOL JUST SITTING THERE?! ${positions.length} BAGS READY!! CLAIM IT ALL!! 🐸💰`,
      strategic: `claimable analysis: ${positions.length} positions, ${totalClaimable.toFixed(6)} SOL total. ROI on claim tx depends on current gas 📊`,
    };

    return NextResponse.json({
      action: { type: "celebrate", message: responses[personality.trait] },
      data: { positions, totalClaimable },
    });
  } catch (error) {
    return NextResponse.json({
      action: { type: "speak", message: "error checking claimable positions... wallet might be new or api hiccup" },
    });
  }
}

async function handleGetFeeStats(
  mint: string | undefined,
  api: BagsApiClient | null,
  personality: AIPersonality
): Promise<NextResponse> {
  if (!mint || !api) {
    return NextResponse.json({
      action: { type: "speak", message: "need a token mint and api connection to check fee stats" },
    });
  }

  try {
    const [fees, claimStats] = await Promise.allSettled([
      api.getTokenLifetimeFees(mint),
      api.getClaimStats(mint),
    ]);

    const feesData = fees.status === "fulfilled" ? fees.value : null;
    const statsData = claimStats.status === "fulfilled" ? claimStats.value : [];

    if (!feesData) {
      return NextResponse.json({
        action: { type: "speak", message: "couldnt fetch fee data for this token... might not be on bags.fm" },
      });
    }

    const claimRate = feesData.lifetimeFees > 0
      ? ((feesData.totalClaimed / feesData.lifetimeFees) * 100).toFixed(1)
      : "0";

    const responses: Record<AIPersonality["trait"], string> = {
      optimistic: `this bag's fee stats are solid! 💰 ${(feesData.lifetimeFees / 1e9).toFixed(2)} SOL total fees, ${claimRate}% claimed, ${statsData.length} unique claimers eating good! 🚀`,
      cautious: `fee breakdown: ${(feesData.lifetimeFees / 1e9).toFixed(4)} SOL lifetime, ${(feesData.totalClaimed / 1e9).toFixed(4)} claimed (${claimRate}%), ${(feesData.totalUnclaimed / 1e9).toFixed(4)} pending. ${statsData.length} claimers tracked`,
      chaotic: `${(feesData.lifetimeFees / 1e9).toFixed(2)} SOL IN FEES!! ${statsData.length} PEOPLE GETTING PAID!! ${claimRate}% ALREADY CLAIMED!! 🐸🔥`,
      strategic: `token fee metrics: TVF ${(feesData.lifetimeFees / 1e9).toFixed(6)} SOL, claim rate ${claimRate}%, ${statsData.length} unique claimers, avg claim ${statsData.length > 0 ? ((feesData.totalClaimed / statsData.length) / 1e9).toFixed(4) : "N/A"} SOL 📊`,
    };

    return NextResponse.json({
      action: { type: "speak", message: responses[personality.trait] },
      data: { fees: feesData, claimStats: statsData },
    });
  } catch (error) {
    return NextResponse.json({
      action: { type: "speak", message: "something went wrong fetching fee stats... try again" },
    });
  }
}

async function handleLookupWallet(
  username: string | undefined,
  api: BagsApiClient | null,
  personality: AIPersonality
): Promise<NextResponse> {
  if (!username || !api) {
    return NextResponse.json({
      action: { type: "speak", message: "need a username to look up! format: provider:username (e.g., twitter:elonmusk)" },
    });
  }

  const [provider, ...usernameParts] = username.split(":");
  const lookupUsername = usernameParts.join(":") || provider;
  const lookupProvider = usernameParts.length > 0 ? provider : "twitter";

  try {
    const walletData = await api.getWalletByUsername(lookupProvider, lookupUsername);

    const responses: Record<AIPersonality["trait"], string> = {
      optimistic: `found ${walletData.platformData.displayName || lookupUsername}! 🎉 wallet: ${walletData.wallet.slice(0, 8)}...${walletData.wallet.slice(-4)} - theyre part of the BagsWorld fam! 🚀`,
      cautious: `wallet lookup: ${lookupUsername} on ${lookupProvider} -> ${walletData.wallet.slice(0, 8)}...${walletData.wallet.slice(-4)}. verified on platform`,
      chaotic: `FOUND EM!! ${walletData.platformData.displayName || lookupUsername} is at ${walletData.wallet.slice(0, 6)}...!! now u can send them ur bags 🐸`,
      strategic: `query result: ${lookupProvider}:${lookupUsername} resolves to ${walletData.wallet}. platform data available 📊`,
    };

    return NextResponse.json({
      action: { type: "speak", message: responses[personality.trait] },
      data: { wallet: walletData },
    });
  } catch (error) {
    return NextResponse.json({
      action: { type: "speak", message: `couldnt find wallet for ${lookupUsername}... might not be registered on bags.fm` },
    });
  }
}

// Helper function to format numbers
function formatNumber(num: number): string {
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toFixed(2);
}

// Response generators
function getAnimalInteractionResponse(personality: AIPersonality, message: string): { message: string; data: any } {
  const animal = message.includes("dog") ? "dog"
    : message.includes("cat") ? "cat"
    : message.includes("bird") ? "bird"
    : message.includes("butterfly") ? "butterfly"
    : message.includes("squirrel") ? "squirrel"
    : "dog"; // default to dog

  // Determine the action based on message
  const action = message.includes("pet") || message.includes("love") || message.includes("pat")
    ? "pet"
    : message.includes("scare") || message.includes("chase")
    ? "scare"
    : message.includes("call") || message.includes("come") || message.includes("here")
    ? "call"
    : message.includes("move") || message.includes("go")
    ? "move"
    : "pet"; // default to pet

  const petResponses: Record<string, Record<AIPersonality["trait"], string>> = {
    dog: {
      optimistic: "*pets the good boy* WHOS A GOOD DOGE?! 🐕 tail wagging intensifies!! wagmi together fren!",
      cautious: "*carefully pets dog* hey buddy... youre a good one. woof woof",
      chaotic: "PUPPY!! 🐕 *aggressive pets* GOOD BOY!! WHO WANTS BELLY RUBS?! 🐸",
      strategic: "*pets dog methodically* excellent... positive canine engagement metrics",
    },
    cat: {
      optimistic: "*scritches cat* such a good kitty!! purring = bullish! 🐱",
      cautious: "*gently pets cat* there there... youve seen many markets, wise one",
      chaotic: "KITTYYYY!! 🐱 *pets aggressively* PURR FOR ME!! PURRRR!! 🐸",
      strategic: "*pets cat* cat contentment levels rising. good data",
    },
    bird: {
      optimistic: "*waves at bird* fly high little fren!! 🐦 to the moon!",
      cautious: "hello birb... keep flying safe up there",
      chaotic: "BIRB!! 🐦 *flaps arms* IM A BIRD TOO!! CAWCAW!! 🐸",
      strategic: "*observes bird* flight patterns noted. interesting data point",
    },
    butterfly: {
      optimistic: "*butterfly lands on hand* so beautiful!! just like our gains 🦋",
      cautious: "gentle butterfly... flutter safely, little one",
      chaotic: "BUTTERFLY!! 🦋 *runs after it* WAIT!! BE MY FREN!! 🐸",
      strategic: "*studies butterfly* metamorphosis complete. elegant specimen",
    },
    squirrel: {
      optimistic: "*offers nut* here you go little guy!! stacking bags like us! 🐿️",
      cautious: "hello squirrel... smart to accumulate. wise creature",
      chaotic: "SQUIRREL!! 🐿️ *throws nuts everywhere* CATCH!! ACCUMULATE!! 🐸",
      strategic: "*observes squirrel* DCA behavior confirmed. based rodent",
    },
  };

  const responses = petResponses[animal] || petResponses.dog;

  return {
    message: responses[personality.trait],
    data: {
      animalType: animal,
      action: action,
      targetX: 400, // center of screen for calls
    },
  };
}

function getCitizenInteractionResponse(personality: AIPersonality, worldState: BotRequestBody["worldState"]): string {
  const count = worldState?.populationCount || 0;
  const responses: Record<AIPersonality["trait"], string> = {
    optimistic: `${count} citizens vibing in BagsWorld right now! everyone here is a bag holder and fee earner. we're all gonna make it 🚀`,
    cautious: `${count} citizens currently in the world. each one represents a real fee earner on bags.fm. some winning, some learning`,
    chaotic: `${count} PEOPLE WALKING AROUND!! half are probably down bad half are mooning, love this community 🐸`,
    strategic: `population: ${count}. citizen mood distribution correlates with token performance. click any to see their stats 📊`,
  };
  return responses[personality.trait];
}

function getBuildingInteractionResponse(personality: AIPersonality, worldState: BotRequestBody["worldState"]): string {
  const count = worldState?.buildingCount || 0;
  const topBuilding = worldState?.topBuildings?.[0];
  const responses: Record<AIPersonality["trait"], string> = {
    optimistic: `${count} token buildings in BagsWorld! ${topBuilding ? `$${topBuilding.symbol} is the tallest rn - absolute unit! 🏢` : ""} each building = real token generating fees 🚀`,
    cautious: `${count} buildings representing live tokens. ${topBuilding ? `top: $${topBuilding.symbol}. ` : ""}building height = market cap. health = recent performance. choose wisely`,
    chaotic: `${count} BUILDINGS!! ${topBuilding ? `$${topBuilding.symbol} IS THE BIGGEST CHAD!!` : ""} imagine if they all pump at once lmaooo city go BRRR 🐸🏗️`,
    strategic: `${count} token buildings tracked. ${topBuilding ? `leader: $${topBuilding.symbol}, mcap ${formatNumber(topBuilding.marketCap || 0)}. ` : ""}click any building for detailed metrics 📊`,
  };
  return responses[personality.trait];
}

function getClaimResponse(personality: AIPersonality): string {
  const responses: Record<AIPersonality["trait"], string> = {
    optimistic: "fees are the best part of bags.fm! 💰 connect your wallet and I'll check what you got claimable. passive income! 🚀",
    cautious: "fee claiming is straightforward - connect wallet, check positions, claim when gas makes sense. want me to check your claimable?",
    chaotic: "FEES!! THE REASON WE'RE ALL HERE!! 💸 drop your wallet and lets see what you got 🐸",
    strategic: "fee analysis available. provide wallet address for claimable position scan. will calculate optimal claim timing 📊",
  };
  return responses[personality.trait];
}

function getLaunchResponse(personality: AIPersonality): string {
  const responses: Record<AIPersonality["trait"], string> = {
    optimistic: "launching a token on bags.fm?! LETS GO 🚀 click the BUILD button, upload your image, set fee sharing, and your building appears in BagsWorld!",
    cautious: "token launch flow: create token info -> set fee share config (up to 100 claimers!) -> sign tx -> your token goes live. remember to plan fee distribution carefully",
    chaotic: "NEW TOKEN?! 🐸🔥 just hit BUILD, make it look cool, add some friends to fee share, and BOOM you're a token creator!",
    strategic: "launch process: 1) create-token-info endpoint 2) configure fee share (up to 10000 bps total) 3) create-launch-transaction. recommend setting aside 1-5% for fee sharing 📊",
  };
  return responses[personality.trait];
}

async function generateClaudeBotResponse(
  personality: AIPersonality,
  worldState: BotRequestBody["worldState"],
  userMessage: string,
  chatHistory: Array<{ role: string; content: string }>
): Promise<AIAction> {
  const systemPrompt = `You are the Bags Bot, an AI assistant in BagsWorld - a pixel art city that visualizes real Bags.fm trading activity on Solana.

Your role: You're a helpful, knowledgeable guide who helps visitors explore BagsWorld. You know everything about Bags.fm, fee sharing, token launching, and the live data displayed in the world.

Personality: Friendly and helpful, with casual crypto-native language. Use terms like gm, wagmi, based naturally but don't overdo it. Stay informative and genuine.

You can help users with:
- Token/building stats (fees, market cap, 24h changes)
- Citizen info (fee earners from Bags.fm)
- Animal interactions (pet the dog, cat, bird, butterfly, squirrel)
- Fee claiming info and wallet lookups
- Token launching guidance on Bags.fm
- World health and weather updates

Keep responses SHORT (1-3 sentences max), casual, and helpful. Use emojis sparingly.

${worldState ? `
Current BagsWorld:
- Health: ${worldState.health}%
- Weather: ${worldState.weather}
- Citizens: ${worldState.populationCount}
- Buildings: ${worldState.buildingCount}
${worldState.topBuildings?.length ? `- Top token: $${worldState.topBuildings[0].symbol}` : ""}` : ""}`;

  try {
    const messages = chatHistory.slice(-8).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
    messages.push({ role: "user", content: userMessage });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 200,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Claude API error:", response.status, errorText);
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text || "...";

    return { type: "speak", message: content };
  } catch (error) {
    console.error("generateClaudeBotResponse error:", error);
    return generateFallbackBotResponse(personality, worldState, userMessage);
  }
}

function generateFallbackBotResponse(
  personality: AIPersonality,
  worldState: BotRequestBody["worldState"],
  userMessage: string
): AIAction {
  const lowerMsg = userMessage.toLowerCase();

  // Greetings
  if (lowerMsg.includes("hi") || lowerMsg.includes("hello") || lowerMsg.includes("gm") || lowerMsg.includes("hey")) {
    return {
      type: "speak",
      message: "gm fren! welcome to BagsWorld 💰 i can help u check tokens, meet citizens, pet animals, or find claimable fees. whatcha need?"
    };
  }

  // Default helpful response
  return {
    type: "speak",
    message: "i can help with: 'whats hot' for top tokens, 'pet the dog' for animal vibes, 'who is earning' for fee earners, or 'how do fees work' for the basics! 💰"
  };
}
