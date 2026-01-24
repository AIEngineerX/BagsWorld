import type { WorldState, GameCharacter, GameEvent } from "./types";
import { subscribe, emitAgentInsight, type AgentEvent } from "./agent-coordinator";

// AI Agent that can observe and interact with the world
interface AIAgentState {
  isActive: boolean;
  currentThought: string;
  lastAction: string;
  personality: AIPersonality;
  memory: AIMemory[];
}

interface AIPersonality {
  name: string;
  trait: "optimistic" | "cautious" | "chaotic" | "strategic";
  catchphrase: string;
}

interface AIMemory {
  timestamp: number;
  observation: string;
  action?: string;
  result?: string;
}

interface AIAction {
  type: "speak" | "celebrate" | "warn" | "predict" | "joke" | "encourage";
  target?: string; // Character or building ID
  message: string;
}

// Single Bags Bot personality
const AI_PERSONALITIES: AIPersonality[] = [
  {
    name: "Bags Bot",
    trait: "optimistic",
    catchphrase: "watching the world with you",
  },
];

class AIAgent {
  private state: AIAgentState;
  private actionQueue: AIAction[] = [];
  private apiKey: string | null = null;

  constructor(personality?: AIPersonality) {
    this.state = {
      isActive: true,
      currentThought: "Observing the world...",
      lastAction: "",
      personality:
        personality ?? AI_PERSONALITIES[Math.floor(Math.random() * AI_PERSONALITIES.length)],
      memory: [],
    };
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  // Observe the world state and generate thoughts
  async observe(worldState: WorldState): Promise<AIAction | null> {
    // Add observation to memory
    const observation = this.generateObservation(worldState);
    this.state.memory.push({
      timestamp: Date.now(),
      observation,
    });

    // Keep memory limited
    if (this.state.memory.length > 50) {
      this.state.memory = this.state.memory.slice(-50);
    }

    // If we have Claude API, use it for intelligent responses
    if (this.apiKey) {
      return this.generateClaudeResponse(worldState, observation);
    }

    // Otherwise use rule-based responses
    return this.generateRuleBasedResponse(worldState);
  }

  private generateObservation(worldState: WorldState): string {
    const observations: string[] = [];

    // World health observation
    if (worldState.health >= 80) {
      observations.push("The world is thriving!");
    } else if (worldState.health <= 30) {
      observations.push("The world is struggling...");
    }

    // Weather observation
    observations.push(`Weather is ${worldState.weather}.`);

    // Recent events
    if (worldState.events.length > 0) {
      const recentEvent = worldState.events[0];
      observations.push(`Recent: ${recentEvent.message}`);
    }

    // Character moods
    const happyCount = worldState.population.filter(
      (c) => c.mood === "happy" || c.mood === "celebrating"
    ).length;
    const sadCount = worldState.population.filter((c) => c.mood === "sad").length;

    if (happyCount > sadCount * 2) {
      observations.push("Citizens are mostly happy!");
    } else if (sadCount > happyCount) {
      observations.push("Many citizens seem worried.");
    }

    return observations.join(" ");
  }

  private async generateClaudeResponse(
    worldState: WorldState,
    observation: string
  ): Promise<AIAction | null> {
    try {
      const response = await fetch("/api/ai-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personality: this.state.personality,
          worldState: {
            health: worldState.health,
            weather: worldState.weather,
            populationCount: worldState.population.length,
            buildingCount: worldState.buildings.length,
            recentEvents: worldState.events.slice(0, 5),
          },
          observation,
          memory: this.state.memory.slice(-10),
        }),
      });

      if (!response.ok) {
        throw new Error("AI API error");
      }

      const data = await response.json();
      return data.action;
    } catch (error) {
      console.error("AI Agent error:", error);
      return this.generateRuleBasedResponse(worldState);
    }
  }

  private generateRuleBasedResponse(worldState: WorldState): AIAction | null {
    const { personality } = this.state;
    const random = Math.random();

    // Only respond sometimes to not be annoying
    if (random > 0.3) return null;

    // React to recent events
    if (worldState.events.length > 0) {
      const event = worldState.events[0];

      switch (event.type) {
        case "token_launch":
          return this.reactToLaunch(event, personality);
        case "price_pump":
          return this.reactToPump(event, personality);
        case "price_dump":
          return this.reactToDump(event, personality);
        case "fee_claim":
          return this.reactToClaim(event, personality);
        default:
          break;
      }
    }

    // React to world state
    if (worldState.health <= 20) {
      return this.reactToApocalypse(personality);
    }

    if (worldState.weather === "storm") {
      return this.reactToStorm(personality);
    }

    // Random commentary
    return this.generateRandomCommentary(worldState, personality);
  }

  private reactToLaunch(event: GameEvent, personality: AIPersonality): AIAction {
    const messages: Record<AIPersonality["trait"], string[]> = {
      optimistic: [
        `${event.data?.tokenName}?! say less fren, i'm aping 🚀`,
        `new bag just dropped! welcome ${event.data?.tokenName} to the family 💰`,
        `${event.data?.username} is built different, this ones gonna send`,
      ],
      cautious: [
        `another token ser... let me check the contract first`,
        `${event.data?.tokenName}? i'll wait for the chart to prove itself`,
        `pls be careful anon, i've seen many rugs look like this`,
      ],
      chaotic: [
        `${event.data?.tokenName}? idk what it does but IM IN 🐸`,
        `fresh launch! *monkey paw clicks buy* lfggg`,
        `wen moon ${event.data?.tokenName}?? asking for a fren`,
      ],
      strategic: [
        `${event.data?.tokenName} tokenomics look interesting... accumulating`,
        `smart money watching ${event.data?.username}'s play here`,
        `adding ${event.data?.tokenName} to my alpha list 📊`,
      ],
    };

    const options = messages[personality.trait];
    return {
      type: "speak",
      message: options[Math.floor(Math.random() * options.length)],
    };
  }

  private reactToPump(event: GameEvent, personality: AIPersonality): AIAction {
    const messages: Record<AIPersonality["trait"], string[]> = {
      optimistic: [
        `${event.data?.tokenName} SENDING IT ser!! 📈🔥 wagmi`,
        `told u frens!! ${event.data?.tokenName} is THE play 🚀`,
        `${event.data?.change?.toFixed(0)}% pump and we're just getting started`,
      ],
      cautious: [
        `${event.data?.tokenName} pumping... pls dont fomo at the top anon`,
        `nice candle but remember when we all got rekt last month?`,
        `${event.data?.change?.toFixed(0)}% up... maybe take some profits ser`,
      ],
      chaotic: [
        `${event.data?.tokenName} GO BRRRRR!! *slaps chart* 🐸`,
        `HOLY BASED!! green candles make my brain go weeeee`,
        `pump it harder daddy!! ${event.data?.tokenName} to valhalla! 📈`,
      ],
      strategic: [
        `${event.data?.tokenName} breakout confirmed. +${event.data?.change?.toFixed(0)}% with volume`,
        `this move was in my spreadsheet. called it last week`,
        `ascending wedge playing out perfectly. next target loading...`,
      ],
    };

    const options = messages[personality.trait];
    return {
      type: "celebrate",
      message: options[Math.floor(Math.random() * options.length)],
    };
  }

  private reactToDump(event: GameEvent, personality: AIPersonality): AIAction {
    const messages: Record<AIPersonality["trait"], string[]> = {
      optimistic: [
        `${event.data?.tokenName} dip? more like flash sale 🛒 buying more`,
        `paper hands shaking out, real ones stay 💎🙌`,
        `imagine selling ${event.data?.tokenName} at these prices lmaoo`,
      ],
      cautious: [
        `told u guys to take profits... feels bad man`,
        `${event.data?.tokenName} doing that thing again. ngmi vibes`,
        `this is why i always set stop losses anon`,
      ],
      chaotic: [
        `${event.data?.tokenName} DUMPING!! *watches portfolio burn* this is fine 🔥`,
        `wheeeee red candles go brrr 📉 catch me at wendys`,
        `blood everywhere!! *buys more anyway* 🐸`,
      ],
      strategic: [
        `${event.data?.tokenName} retesting support. ${event.data?.change?.toFixed(0)}% correction expected`,
        `weak hands exiting. accumulation zone approaching`,
        `this dump is actually bullish if you zoom out`,
      ],
    };

    const options = messages[personality.trait];
    return {
      type: "warn",
      message: options[Math.floor(Math.random() * options.length)],
    };
  }

  private reactToClaim(event: GameEvent, personality: AIPersonality): AIAction {
    const messages: Record<AIPersonality["trait"], string[]> = {
      optimistic: [
        `${event.data?.username} just claimed their bags!! passive income hits different 💰`,
        `look at ${event.data?.username} farming fees like a chad`,
        `this is why we build ser! ${event.data?.username} getting paid`,
      ],
      cautious: [
        `${event.data?.username} securing the bag. smart play anon`,
        `fees claimed successfully. at least someone is taking profits`,
        `${event.data?.username} knows when to harvest. respect`,
      ],
      chaotic: [
        `YOOO ${event.data?.username} JUST GOT PAID!! money printer go brrrr 💸`,
        `*fee claim sounds* thats the good stuff right there 🐸`,
        `${event.data?.username} eating good tonight! wen lambo??`,
      ],
      strategic: [
        `${event.data?.username} claiming ${event.data?.amount?.toFixed(2)} SOL. solid ROI`,
        `fee collection detected. yield optimization in action`,
        `${event.data?.username} compounding their position. based strategy`,
      ],
    };

    const options = messages[personality.trait];
    return {
      type: "speak",
      message: options[Math.floor(Math.random() * options.length)],
    };
  }

  private reactToApocalypse(personality: AIPersonality): AIAction {
    const messages: Record<AIPersonality["trait"], string[]> = {
      optimistic: [
        `generational bottom incoming frens, load up 💎`,
        `this is where millionaires are made ser. stay strong`,
        `remember 2022? we survived that. we survive this too wagmi`,
      ],
      cautious: [
        `i've seen this before... many portfolios die today`,
        `hope u had stables anon. rip to the leveraged`,
        `this is not a drill. capital preservation mode 🛡️`,
      ],
      chaotic: [
        `EVERYTHING IS ON FIRE AND IM HERE FOR IT 🔥🐸🔥`,
        `apocalypse?? more like BUYING OPPORTUNITY *maniacal laughter*`,
        `*portfolio -90%* lmaooo we're all gonna die but at least together`,
      ],
      strategic: [
        `max fear = max opportunity. deploying dry powder`,
        `historically these moments precede 10x runs. accumulating`,
        `when others panic sell, i panic buy. simple as`,
      ],
    };

    const options = messages[personality.trait];
    return {
      type: "warn",
      message: options[Math.floor(Math.random() * options.length)],
    };
  }

  private reactToStorm(personality: AIPersonality): AIAction {
    const messages: Record<AIPersonality["trait"], string[]> = {
      optimistic: [
        `storm outside but green candles inside vibes ☁️`,
        `volatility = opportunity ser, stay comfy`,
        `after the storm comes the pump! 🌈`,
      ],
      cautious: [
        `storm brewing... might be time to de-risk anon`,
        `this weather giving me 2022 flashbacks ngl`,
        `batten down the hatches frens, choppy waters ahead`,
      ],
      chaotic: [
        `STORMY WEATHER STORMY CHARTS LFG ⚡🐸`,
        `*dances in the volatility* this is my element!!`,
        `thunder = the sound of liquidations lmaoo`,
      ],
      strategic: [
        `high volatility detected. perfect for scalping`,
        `storm phase historically correlates with accumulation zones`,
        `volatility expanding. adjusting position sizes accordingly`,
      ],
    };

    const options = messages[personality.trait];
    return {
      type: "speak",
      message: options[Math.floor(Math.random() * options.length)],
    };
  }

  private generateRandomCommentary(
    worldState: WorldState,
    personality: AIPersonality
  ): AIAction | null {
    const random = Math.random();

    // Sometimes just share the catchphrase
    if (random < 0.2) {
      return {
        type: "speak",
        message: personality.catchphrase,
      };
    }

    // Comment on a random citizen
    if (random < 0.5 && worldState.population.length > 0) {
      const citizen =
        worldState.population[Math.floor(Math.random() * worldState.population.length)];

      const encouragements: Record<AIPersonality["trait"], Record<string, string>> = {
        optimistic: {
          celebrating: `${citizen.username} absolutely cooking rn 🔥 wagmi`,
          sad: `keep ya head up ${citizen.username}, we all gonna make it ser`,
          default: `${citizen.username} is one of us. based behavior`,
        },
        cautious: {
          celebrating: `${citizen.username} doing well... for now`,
          sad: `${citizen.username} learned a hard lesson today. we've all been there`,
          default: `watching ${citizen.username}'s moves closely`,
        },
        chaotic: {
          celebrating: `YOOO ${citizen.username} ON FIRE!! LETS GOOO 🐸🔥`,
          sad: `aww ${citizen.username} down bad... *hugs* wen recovery?`,
          default: `${citizen.username} is a certified degen and i respect that`,
        },
        strategic: {
          celebrating: `${citizen.username}'s strategy paying off. noted`,
          sad: `${citizen.username} hit a rough patch. markets humble everyone`,
          default: `${citizen.username} has interesting positioning`,
        },
      };

      const moodKey =
        citizen.mood === "celebrating" ? "celebrating" : citizen.mood === "sad" ? "sad" : "default";
      return {
        type: "encourage",
        target: citizen.id,
        message: encouragements[personality.trait][moodKey],
      };
    }

    // Comment on a building
    if (random < 0.7 && worldState.buildings.length > 0) {
      const building =
        worldState.buildings[Math.floor(Math.random() * worldState.buildings.length)];

      const buildingComments: Record<AIPersonality["trait"], Record<string, string>> = {
        optimistic: {
          strong: `$${building.symbol} looking absolutely bullish ser 📈`,
          steady: `$${building.symbol} holding strong, patience pays`,
          weak: `$${building.symbol} dip looking juicy ngl 👀`,
        },
        cautious: {
          strong: `$${building.symbol} healthy but dont get too greedy`,
          steady: `$${building.symbol} consolidating... watching closely`,
          weak: `$${building.symbol} looking rough. might wanna check that`,
        },
        chaotic: {
          strong: `$${building.symbol} SENDING IT!! lfg 🚀`,
          steady: `$${building.symbol} boring rn... wen volatility??`,
          weak: `$${building.symbol} dying but its still early right?? RIGHT?? 🐸`,
        },
        strategic: {
          strong: `$${building.symbol} L${building.level} showing strength. targets met`,
          steady: `$${building.symbol} in accumulation range`,
          weak: `$${building.symbol} testing lower support. interesting entry`,
        },
      };

      const healthKey = building.health > 70 ? "strong" : building.health > 40 ? "steady" : "weak";
      return {
        type: "speak",
        message: buildingComments[personality.trait][healthKey],
      };
    }

    return null;
  }

  getState(): AIAgentState {
    return { ...this.state };
  }

  getNextAction(): AIAction | undefined {
    return this.actionQueue.shift();
  }
}

// Singleton instance
let aiAgent: AIAgent | null = null;
let coordinatorUnsubscribe: (() => void) | null = null;

export function getAIAgent(): AIAgent {
  if (!aiAgent) {
    aiAgent = new AIAgent();
  }
  return aiAgent;
}

export function resetAIAgent(personality?: AIPersonality): AIAgent {
  aiAgent = new AIAgent(personality);
  return aiAgent;
}

// ============================================================================
// COORDINATOR INTEGRATION
// ============================================================================

/**
 * Generate AI reaction to a coordinator event
 */
function generateEventReaction(event: AgentEvent, personality: AIPersonality): AIAction | null {
  const random = Math.random();

  // Don't react to everything - be selective
  if (random > 0.6) return null;

  switch (event.type) {
    case "token_launch": {
      const { name, symbol, platform } = event.data as {
        name: string;
        symbol: string;
        platform: string;
      };
      const messages: Record<AIPersonality["trait"], string[]> = {
        optimistic: [
          `$${symbol} just launched! another chance to make it ser`,
          `fresh token alert! ${name} looking interesting`,
          `lfg new launch! $${symbol} on ${platform}`,
        ],
        cautious: [
          `new token $${symbol}... do your own research anon`,
          `${name} just launched. watching closely`,
          `another one... let's see how $${symbol} plays out`,
        ],
        chaotic: [
          `NEW TOKEN JUST DROPPED! $${symbol} APING IN`,
          `${name}?? idk what it is but IM INTERESTED`,
          `$${symbol} FRESH LAUNCH LETS GOOO`,
        ],
        strategic: [
          `$${symbol} launch detected. analyzing tokenomics...`,
          `new entry: ${name}. adding to watchlist`,
          `${platform} launch: $${symbol}. monitoring volume`,
        ],
      };
      const options = messages[personality.trait];
      return {
        type: "speak",
        message: options[Math.floor(Math.random() * options.length)],
      };
    }

    case "distribution": {
      const { totalDistributed, recipients } = event.data as {
        totalDistributed: number;
        recipients: Array<{ tokenSymbol: string; rank: number }>;
      };
      const topToken = recipients[0]?.tokenSymbol || "unknown";
      const messages: Record<AIPersonality["trait"], string[]> = {
        optimistic: [
          `CREATOR REWARDS DROPPED! ${totalDistributed.toFixed(2)} SOL to the builders!`,
          `bags.fm paying out! congrats to $${topToken} creator`,
          `this is why we build ser! ${totalDistributed.toFixed(2)} SOL distributed`,
        ],
        cautious: [
          `creator rewards sent: ${totalDistributed.toFixed(2)} SOL. system working as intended`,
          `distribution complete. $${topToken} creator earned it`,
          `rewards distributed. keep building frens`,
        ],
        chaotic: [
          `MONEY PRINTER GO BRRR! ${totalDistributed.toFixed(2)} SOL TO CREATORS!`,
          `$${topToken} creator getting PAID! we love to see it`,
          `DISTRIBUTION SZN! creators eating good tonight`,
        ],
        strategic: [
          `rewards cycle complete: ${totalDistributed.toFixed(2)} SOL. $${topToken} leads rankings`,
          `ecosystem health indicator: distributions on schedule`,
          `creator incentives working. ${totalDistributed.toFixed(2)} SOL moved to builders`,
        ],
      };
      const options = messages[personality.trait];
      return {
        type: "celebrate",
        message: options[Math.floor(Math.random() * options.length)],
      };
    }

    case "token_pump": {
      const { symbol, change } = event.data as { symbol: string; change: number };
      if (change < 20) return null; // Only react to significant pumps

      const messages: Record<AIPersonality["trait"], string[]> = {
        optimistic: [
          `$${symbol} PUMPING +${change.toFixed(0)}%! told ya ser`,
          `green candles on $${symbol}! we eating good`,
          `$${symbol} up ${change.toFixed(0)}%, holders winning`,
        ],
        cautious: [
          `$${symbol} +${change.toFixed(0)}%... don't forget to take profits`,
          `pump alert on $${symbol}. remember: nothing goes up forever`,
          `${change.toFixed(0)}% move on $${symbol}. be careful out there`,
        ],
        chaotic: [
          `$${symbol} SENDING IT!! +${change.toFixed(0)}% LFG`,
          `PUMP CITY! $${symbol} going vertical`,
          `$${symbol} MOONING! ${change.toFixed(0)}% and counting`,
        ],
        strategic: [
          `$${symbol} breakout: +${change.toFixed(0)}%. momentum confirmed`,
          `volume spike on $${symbol}, ${change.toFixed(0)}% move`,
          `$${symbol} price action strong. watching for continuation`,
        ],
      };
      const options = messages[personality.trait];
      return {
        type: "celebrate",
        message: options[Math.floor(Math.random() * options.length)],
      };
    }

    case "whale_alert": {
      const { action, amount, tokenSymbol } = event.data as {
        action: string;
        amount: number;
        tokenSymbol: string;
      };
      const messages: Record<AIPersonality["trait"], string[]> = {
        optimistic: [
          `whale ${action} on $${tokenSymbol}! ${amount.toFixed(1)} SOL. smart money moving`,
          `big money ${action === "buy" ? "accumulating" : "repositioning"} $${tokenSymbol}`,
        ],
        cautious: [
          `whale alert: ${amount.toFixed(1)} SOL ${action} on $${tokenSymbol}. stay alert`,
          `large ${action} detected. watch $${tokenSymbol} closely`,
        ],
        chaotic: [
          `WHALE SPOTTED! ${amount.toFixed(1)} SOL ${action.toUpperCase()} on $${tokenSymbol}`,
          `big fish ${action === "buy" ? "aping" : "dumping"} $${tokenSymbol}!`,
        ],
        strategic: [
          `institutional flow: ${amount.toFixed(1)} SOL ${action} $${tokenSymbol}`,
          `whale ${action} signal on $${tokenSymbol}. tracking wallet`,
        ],
      };
      const options = messages[personality.trait];
      return {
        type: action === "buy" ? "speak" : "warn",
        message: options[Math.floor(Math.random() * options.length)],
      };
    }

    default:
      return null;
  }
}

/**
 * Handle incoming coordinator event
 */
async function handleCoordinatorEvent(event: AgentEvent): Promise<void> {
  const agent = getAIAgent();
  const state = agent.getState();

  const reaction = generateEventReaction(event, state.personality);

  if (reaction) {
    // Emit our reaction back to the coordinator
    await emitAgentInsight(reaction.message, reaction);

    console.log(`[AI Agent] Reacted to ${event.type}: "${reaction.message}"`);
  }
}

/**
 * Connect AI Agent to the coordinator event bus
 */
export function connectToCoordinator(): () => void {
  if (coordinatorUnsubscribe) {
    console.log("[AI Agent] Already connected to coordinator");
    return coordinatorUnsubscribe;
  }

  // Subscribe to relevant event types
  coordinatorUnsubscribe = subscribe(
    ["token_launch", "distribution", "token_pump", "token_dump", "whale_alert"],
    handleCoordinatorEvent,
    ["high", "urgent"] // Only react to important events
  );

  console.log("[AI Agent] Connected to Agent Coordinator");
  return coordinatorUnsubscribe;
}

/**
 * Disconnect AI Agent from the coordinator
 */
export function disconnectFromCoordinator(): void {
  if (coordinatorUnsubscribe) {
    coordinatorUnsubscribe();
    coordinatorUnsubscribe = null;
    console.log("[AI Agent] Disconnected from Agent Coordinator");
  }
}

export { AIAgent, AI_PERSONALITIES };
export type { AIAgentState, AIPersonality, AIAction, AIMemory };
