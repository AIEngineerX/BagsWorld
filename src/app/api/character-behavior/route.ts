// Character Behavior API - Claude controls character movement and actions
// Makes characters feel alive by giving them AI-driven goals and behaviors

import { NextResponse } from "next/server";
import { characters } from "@/characters";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// ============================================================================
// TYPES
// ============================================================================

interface CharacterState {
  id: string;
  name: string;
  x: number;
  y: number;
  isMoving: boolean;
  mood?: string;
}

interface BuildingState {
  id: string;
  name: string;
  symbol?: string;
  x: number;
  y: number;
  level: number;
  isGlowing?: boolean;
}

interface WorldContext {
  characters: CharacterState[];
  buildings: BuildingState[];
  specialBuildings: string[]; // IDs of special buildings like PokeCenter, Casino
  recentEvents: string[];
  worldHealth: number;
  weather: string;
  timeOfDay: string;
}

interface BehaviorCommand {
  characterId: string;
  action: "moveTo" | "idle" | "observe" | "celebrate" | "patrol" | "approach";
  target?: {
    type: "position" | "character" | "building";
    x?: number;
    y?: number;
    id?: string;
  };
  dialogue?: string;
  emotion?: "neutral" | "excited" | "thoughtful" | "concerned" | "happy";
  duration?: number; // How long to perform action (ms)
}

interface BehaviorResponse {
  commands: BehaviorCommand[];
  narrative?: string; // Optional description of what's happening
}

// ============================================================================
// CHARACTER PERSONALITIES FOR BEHAVIOR
// ============================================================================

const CHARACTER_BEHAVIORS = {
  finn: {
    role: "Founder & Leader",
    tendencies: [
      "Visits new buildings to welcome them",
      "Walks confidently through the center of town",
      "Stops to observe busy areas",
      "Approaches Ghost to check on systems",
      "Celebrates when world health is high",
    ],
    movement: "purposeful, direct paths",
    frequentLocations: ["center", "new buildings", "near Ghost"],
  },
  ghost: {
    role: "Trading Agent & Monitor",
    tendencies: [
      "Patrols around buildings checking on them",
      "Stops near high-activity buildings",
      "Approaches Neo to share data",
      "Moves to edges to observe",
      "Investigates glowing buildings",
    ],
    movement: "methodical, patrol-like",
    frequentLocations: ["building perimeters", "observation spots", "near Neo"],
  },
  neo: {
    role: "Scout & Observer",
    tendencies: [
      "Wanders mysteriously at edges",
      "Appears suddenly near events",
      "Stops to 'scan' buildings",
      "Moves unpredictably",
      "Gravitates toward activity",
    ],
    movement: "unpredictable, sudden stops",
    frequentLocations: ["edges", "near events", "shadows"],
  },
  ash: {
    role: "Guide & Welcomer",
    tendencies: [
      "Greets other characters",
      "Walks near the path to guide visitors",
      "Approaches new or low-level buildings encouragingly",
      "Stays near PokeCenter",
      "Moves energetically",
    ],
    movement: "energetic, friendly approaches",
    frequentLocations: ["path", "PokeCenter", "new buildings"],
  },
  toly: {
    role: "Wise Elder",
    tendencies: [
      "Walks slowly, contemplatively",
      "Stops to observe the whole scene",
      "Approaches characters having conversations",
      "Visits the Treasury/rewards area",
      "Rests near benches",
    ],
    movement: "slow, deliberate",
    frequentLocations: ["center", "benches", "Treasury"],
  },
};

// ============================================================================
// BEHAVIOR GENERATION
// ============================================================================

async function generateBehaviors(context: WorldContext): Promise<BehaviorResponse> {
  if (!ANTHROPIC_API_KEY) {
    return generateFallbackBehaviors(context);
  }

  const prompt = buildBehaviorPrompt(context);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error("[CharacterBehavior] Claude API error:", response.status);
      return generateFallbackBehaviors(context);
    }

    const data = await response.json();
    const content = data.content[0]?.text || "";

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*"commands"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as BehaviorResponse;
      console.log(
        "[CharacterBehavior] AI generated behaviors for",
        parsed.commands.length,
        "characters"
      );
      return parsed;
    }
  } catch (error) {
    console.error("[CharacterBehavior] Error generating behaviors:", error);
  }

  return generateFallbackBehaviors(context);
}

function buildBehaviorPrompt(context: WorldContext): string {
  const characterList = context.characters
    .map((c) => {
      const behavior = CHARACTER_BEHAVIORS[c.id as keyof typeof CHARACTER_BEHAVIORS];
      return `- ${c.name} (${c.id}): at (${Math.round(c.x)}, ${Math.round(c.y)}), ${c.isMoving ? "moving" : "idle"}
    Role: ${behavior?.role || "Resident"}
    Tendencies: ${behavior?.tendencies?.slice(0, 3).join(", ") || "wanders"}`;
    })
    .join("\n");

  const buildingList = context.buildings
    .slice(0, 8)
    .map(
      (b) =>
        `- ${b.name} ($${b.symbol || "???"}) at (${Math.round(b.x)}, ${Math.round(b.y)}), level ${b.level}${b.isGlowing ? " [GLOWING - active!]" : ""}`
    )
    .join("\n");

  const specialList = context.specialBuildings.join(", ");

  return `You are the AI director for BagsWorld, a living pixel art game. You control 5 characters who should feel ALIVE and autonomous.

CURRENT WORLD STATE:
- Health: ${context.worldHealth}%
- Weather: ${context.weather}
- Time: ${context.timeOfDay}
- Recent events: ${context.recentEvents.slice(0, 3).join(", ") || "none"}

CHARACTERS (you control all of them):
${characterList}

BUILDINGS:
${buildingList}

SPECIAL LOCATIONS: ${specialList}

GAME BOUNDS: x: 80-1200, y: 450-750 (characters walk on paths)
PATH Y-LEVEL: around 570-620 is the main walking path

YOUR JOB: Decide what each character should do RIGHT NOW to make them feel alive. Consider:
1. Their personality and role
2. What's happening in the world (events, health, weather)
3. Where other characters are (they might approach each other)
4. Interesting buildings to visit
5. Natural idle behaviors

RESPOND WITH JSON ONLY:
{
  "commands": [
    {
      "characterId": "finn",
      "action": "moveTo",
      "target": { "type": "position", "x": 500, "y": 580 },
      "dialogue": "Optional short comment",
      "emotion": "neutral"
    },
    {
      "characterId": "ghost",
      "action": "approach",
      "target": { "type": "character", "id": "neo" },
      "emotion": "thoughtful"
    },
    {
      "characterId": "neo",
      "action": "observe",
      "target": { "type": "building", "id": "some-building-id" },
      "dialogue": "scanning...",
      "emotion": "neutral"
    }
  ],
  "narrative": "Brief description of the scene"
}

ACTIONS:
- "moveTo": Walk to a position
- "approach": Walk toward a character or building
- "observe": Stop and look at something
- "idle": Stay in place, maybe small movements
- "patrol": Walk around an area
- "celebrate": Happy movement (world health high, good event)

Keep dialogue SHORT (under 50 chars) or omit it. Not every character needs to speak.
Make movements feel natural - not everyone moves at once.`;
}

function generateFallbackBehaviors(context: WorldContext): BehaviorResponse {
  const commands: BehaviorCommand[] = [];

  // Simple rule-based behaviors when Claude is unavailable
  context.characters.forEach((char, index) => {
    const behavior = CHARACTER_BEHAVIORS[char.id as keyof typeof CHARACTER_BEHAVIORS];

    // 40% chance to give a new command
    if (Math.random() > 0.4) {
      commands.push({
        characterId: char.id,
        action: "idle",
        emotion: "neutral",
      });
      return;
    }

    // Generate position-based movement
    const actions: BehaviorCommand["action"][] = ["moveTo", "patrol", "observe"];
    const action = actions[Math.floor(Math.random() * actions.length)];

    // Random target within bounds
    const targetX = 150 + Math.random() * 950;
    const targetY = 520 + Math.random() * 100;

    // Maybe approach another character
    if (Math.random() > 0.7 && context.characters.length > 1) {
      const otherChars = context.characters.filter((c) => c.id !== char.id);
      const target = otherChars[Math.floor(Math.random() * otherChars.length)];
      commands.push({
        characterId: char.id,
        action: "approach",
        target: { type: "character", id: target.id },
        emotion: "neutral",
      });
      return;
    }

    // Maybe approach a building
    if (Math.random() > 0.6 && context.buildings.length > 0) {
      const building = context.buildings[Math.floor(Math.random() * context.buildings.length)];
      commands.push({
        characterId: char.id,
        action: "approach",
        target: { type: "building", id: building.id },
        emotion: "thoughtful",
      });
      return;
    }

    commands.push({
      characterId: char.id,
      action,
      target: { type: "position", x: targetX, y: targetY },
      emotion: "neutral",
    });
  });

  return { commands };
}

// ============================================================================
// API HANDLER
// ============================================================================

export async function POST(request: Request) {
  try {
    const context: WorldContext = await request.json();

    if (!context.characters || context.characters.length === 0) {
      return NextResponse.json({ error: "No characters provided" }, { status: 400 });
    }

    const behaviors = await generateBehaviors(context);

    return NextResponse.json({
      success: true,
      ...behaviors,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("[CharacterBehavior] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// GET endpoint for testing
export async function GET() {
  // Return sample behavior for testing
  const sampleContext: WorldContext = {
    characters: [
      { id: "finn", name: "Finn", x: 400, y: 570, isMoving: false },
      { id: "ghost", name: "Ghost", x: 600, y: 580, isMoving: false },
      { id: "neo", name: "Neo", x: 800, y: 560, isMoving: true },
    ],
    buildings: [{ id: "test-1", name: "Test Token", symbol: "TEST", x: 300, y: 500, level: 2 }],
    specialBuildings: ["PokeCenter", "TradingGym", "Treasury", "Casino"],
    recentEvents: ["New token launched", "Fee claimed"],
    worldHealth: 75,
    weather: "sunny",
    timeOfDay: "day",
  };

  const behaviors = await generateBehaviors(sampleContext);

  return NextResponse.json({
    success: true,
    ...behaviors,
    timestamp: Date.now(),
  });
}
