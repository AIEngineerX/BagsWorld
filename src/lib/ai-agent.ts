import type { WorldState, GameCharacter, GameEvent } from "./types";

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

// Predefined AI personalities
const AI_PERSONALITIES: AIPersonality[] = [
  {
    name: "Oracle",
    trait: "strategic",
    catchphrase: "The market speaks to those who listen...",
  },
  {
    name: "Hype Beast",
    trait: "optimistic",
    catchphrase: "TO THE MOON! 🚀",
  },
  {
    name: "Doom Prophet",
    trait: "cautious",
    catchphrase: "I've seen this pattern before...",
  },
  {
    name: "Chaos Gremlin",
    trait: "chaotic",
    catchphrase: "Let's see what happens if...",
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
        personality ??
        AI_PERSONALITIES[Math.floor(Math.random() * AI_PERSONALITIES.length)],
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

  private reactToLaunch(
    event: GameEvent,
    personality: AIPersonality
  ): AIAction {
    const messages: Record<AIPersonality["trait"], string[]> = {
      optimistic: [
        `🚀 ${event.data?.tokenName}?! This is gonna be HUGE!`,
        `New building in town! Welcome ${event.data?.tokenName}! 🎉`,
        `${event.data?.username} is a genius! Let's goooo!`,
      ],
      cautious: [
        `Hmm, another new token. Let's see how ${event.data?.tokenName} performs...`,
        `${event.data?.tokenName} enters the arena. Time will tell.`,
        `I'll be watching ${event.data?.tokenName} closely.`,
      ],
      chaotic: [
        `${event.data?.tokenName}? More like ${event.data?.tokenName?.split("").reverse().join("")}! CHAOS!`,
        `New token = new chaos potential! 😈`,
        `Let the games begin with ${event.data?.tokenName}!`,
      ],
      strategic: [
        `${event.data?.tokenName} launched. Analyzing market positioning...`,
        `Interesting timing for ${event.data?.username}'s new launch.`,
        `Adding ${event.data?.tokenName} to my watchlist.`,
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
        `${event.data?.tokenName} IS PUMPING! 📈🔥`,
        `I KNEW IT! ${event.data?.tokenName} to the moon!`,
        `This is beautiful! ${event.data?.change?.toFixed(0)}% pump!`,
      ],
      cautious: [
        `${event.data?.tokenName} pumping. Be careful of the dump...`,
        `Nice pump, but remember: what goes up...`,
        `${event.data?.change?.toFixed(0)}% is impressive. Stay vigilant.`,
      ],
      chaotic: [
        `PUMP IT! PUMP IT! ${event.data?.tokenName} GO BRRRRR!`,
        `Everyone panic buy NOW! Just kidding... or am I? 😏`,
        `The charts are doing the thing! THE THING!`,
      ],
      strategic: [
        `${event.data?.tokenName} showing +${event.data?.change?.toFixed(0)}%. Volume analysis suggests...`,
        `Significant movement on ${event.data?.tokenName}. Correlating with market trends.`,
        `This pump aligns with my models. Interesting.`,
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
        `${event.data?.tokenName} dip = buying opportunity! 🛒`,
        `Temporary setback for ${event.data?.tokenName}. We'll be back!`,
        `Diamond hands, everyone! 💎🙌`,
      ],
      cautious: [
        `I warned you about ${event.data?.tokenName}...`,
        `As expected. Market correction in progress.`,
        `This is why we don't leverage, friends.`,
      ],
      chaotic: [
        `${event.data?.tokenName} DUMP! Quick, everyone panic! 😂`,
        `Wheeeee! Down we go! 🎢`,
        `Blood in the streets! My favorite time!`,
      ],
      strategic: [
        `${event.data?.tokenName} correction: ${event.data?.change?.toFixed(0)}%. Watching support levels.`,
        `Dump pattern recognized. Potential accumulation zone approaching.`,
        `Market makers at work on ${event.data?.tokenName}.`,
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
        `${event.data?.username} claimed their rewards! Passive income FTW! 💰`,
        `Ka-ching! ${event.data?.username} getting paid!`,
        `This is the way! Fees are flowing!`,
      ],
      cautious: [
        `${event.data?.username} wisely securing profits.`,
        `Smart move, taking those fees.`,
        `Always good to realize gains.`,
      ],
      chaotic: [
        `MONEY MONEY MONEY! ${event.data?.username} is RICH!`,
        `Coins go brrr for ${event.data?.username}!`,
        `Rain those coins! 🌧️💰`,
      ],
      strategic: [
        `${event.data?.username} optimizing their fee collection strategy.`,
        `Claim detected. Treasury management in action.`,
        `${event.data?.amount?.toFixed(2)} SOL secured.`,
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
        `Dark times, but the sun will rise again! ☀️`,
        `This is just the bottom before the next bull run!`,
        `HODL strong, friends! We've been through worse!`,
      ],
      cautious: [
        `I've been preparing for this. Have you?`,
        `The prophecy is fulfilled...`,
        `Capital preservation mode: ACTIVATED.`,
      ],
      chaotic: [
        `APOCALYPSE MODE! THIS IS FINE 🔥🔥🔥`,
        `Finally! Pure chaos! MY TIME HAS COME!`,
        `Burn it all down! We rebuild from ashes!`,
      ],
      strategic: [
        `Maximum fear = maximum opportunity.`,
        `Accumulation phase initiated. Weak hands exiting.`,
        `Historical data suggests recovery in T-minus...`,
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
      optimistic: [`Storm clouds? Just atmosphere! The sun's still there! ☁️`, `A little rain never hurt anyone!`, `After the storm comes the rainbow! 🌈`],
      cautious: [`Storm brewing. Battening down the hatches.`, `Turbulent times ahead. Proceed with caution.`, `The weather matches the market sentiment...`],
      chaotic: [`THUNDER! LIGHTNING! I LOVE IT! ⚡`, `Dance in the rain! DANCE!`, `Storm = energy = POWER!`],
      strategic: [`Volatility increasing. Storm conditions favorable for swing trades.`, `Weather patterns correlating with market movement. Fascinating.`, `Storm phase: optimal for contrarian positions.`],
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
        worldState.population[
          Math.floor(Math.random() * worldState.population.length)
        ];
      return {
        type: "encourage",
        target: citizen.id,
        message: `Keep it up, ${citizen.username}! ${
          citizen.mood === "celebrating"
            ? "You're on fire! 🔥"
            : citizen.mood === "sad"
            ? "Things will get better!"
            : "You're doing great!"
        }`,
      };
    }

    // Comment on a building
    if (random < 0.7 && worldState.buildings.length > 0) {
      const building =
        worldState.buildings[
          Math.floor(Math.random() * worldState.buildings.length)
        ];
      return {
        type: "speak",
        message: `${building.name} (Level ${building.level}) looking ${
          building.health > 70 ? "strong" : building.health > 40 ? "steady" : "shaky"
        }...`,
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

export { AIAgent, AI_PERSONALITIES };
export type { AIAgentState, AIPersonality, AIAction, AIMemory };
