// LLM-based Intent Extraction - Makes the bot understand natural language
// Instead of regex patterns, we use Claude to understand what the user wants

export interface ExtractedIntent {
  action: "pet" | "scare" | "call" | "feed" | "effect" | "query" | "chat" | "unknown";
  target?: {
    type: "animal" | "effect" | "token" | "world";
    name: string;
  };
  confidence: number;
  reasoning?: string;
}

export interface WorldContext {
  health?: number;
  weather?: string;
  topTokens?: string[];
  recentEvents?: string[];
}

const INTENT_SYSTEM_PROMPT = `You are an intent parser for BagsWorld, a pixel art game. Extract the user's intent from their message.

Available actions:
- pet: User wants to pet/love/cuddle an animal
- scare: User wants to scare/spook/chase an animal
- call: User wants to summon/find/call an animal
- feed: User wants to feed/give food to an animal
- effect: User wants to trigger a visual effect
- query: User is asking a question about the world/tokens/stats
- chat: General conversation, greeting, or unclear intent

Available animals: dog, cat, bird, butterfly, squirrel
Available effects: fireworks, coins, hearts, confetti, stars, ufo

Respond with JSON only:
{
  "action": "pet|scare|call|feed|effect|query|chat",
  "target": { "type": "animal|effect|token|world", "name": "specific name" },
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

Examples:
"give the puppy some love" → {"action":"pet","target":{"type":"animal","name":"dog"},"confidence":0.95,"reasoning":"puppy=dog, love=pet"}
"yo make it rain" → {"action":"effect","target":{"type":"effect","name":"coins"},"confidence":0.9,"reasoning":"make it rain=money/coins effect"}
"where's the kitty" → {"action":"call","target":{"type":"animal","name":"cat"},"confidence":0.85,"reasoning":"looking for cat=call"}
"let's party!" → {"action":"effect","target":{"type":"effect","name":"fireworks"},"confidence":0.8,"reasoning":"party=celebration=fireworks"}
"how's the world doing" → {"action":"query","target":{"type":"world","name":"status"},"confidence":0.9,"reasoning":"asking about world state"}
"gm fren" → {"action":"chat","confidence":0.95,"reasoning":"greeting"}`;

export async function extractIntent(
  message: string,
  apiKey: string,
  context?: WorldContext
): Promise<ExtractedIntent> {
  try {
    const contextStr = context
      ? `\nWorld context: Health ${context.health}%, Weather: ${context.weather}`
      : "";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5-20251101",
        max_tokens: 200,
        system: INTENT_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Parse this message: "${message}"${contextStr}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.content[0]?.text || "{}";

    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { action: "chat", confidence: 0.5 };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      action: parsed.action || "chat",
      target: parsed.target,
      confidence: parsed.confidence || 0.5,
      reasoning: parsed.reasoning,
    };
  } catch (error) {
    console.error("Intent extraction error:", error);
    // Fallback to basic pattern matching
    return fallbackIntentExtraction(message);
  }
}

// Fallback when API unavailable - basic pattern matching
function fallbackIntentExtraction(message: string): ExtractedIntent {
  const lower = message.toLowerCase();

  // Animal patterns
  const animals = ["dog", "puppy", "cat", "kitty", "bird", "butterfly", "squirrel"];
  const animalActions: Record<string, ExtractedIntent["action"]> = {
    pet: "pet", love: "pet", cuddle: "pet", pat: "pet", scratch: "pet",
    scare: "scare", spook: "scare", chase: "scare", boo: "scare",
    call: "call", find: "call", where: "call", summon: "call",
    feed: "feed", give: "feed", treat: "feed",
  };

  for (const [word, action] of Object.entries(animalActions)) {
    if (lower.includes(word)) {
      for (const animal of animals) {
        if (lower.includes(animal) || (animal === "dog" && lower.includes("puppy")) || (animal === "cat" && lower.includes("kitty"))) {
          const normalizedAnimal = animal === "puppy" ? "dog" : animal === "kitty" ? "cat" : animal;
          return {
            action,
            target: { type: "animal", name: normalizedAnimal },
            confidence: 0.7,
          };
        }
      }
    }
  }

  // Effect patterns
  const effectPatterns: Record<string, string> = {
    "firework": "fireworks", "party": "fireworks", "celebrate": "fireworks",
    "rain": "coins", "money": "coins", "coin": "coins", "cash": "coins",
    "heart": "hearts", "love": "hearts",
    "confetti": "confetti", "woohoo": "confetti", "congrat": "confetti",
    "star": "stars",
    "ufo": "ufo", "alien": "ufo", "spaceship": "ufo", "abduct": "ufo", "beam": "ufo",
  };

  for (const [pattern, effect] of Object.entries(effectPatterns)) {
    if (lower.includes(pattern)) {
      return {
        action: "effect",
        target: { type: "effect", name: effect },
        confidence: 0.7,
      };
    }
  }

  // Query patterns
  if (lower.match(/\b(how|what|where|status|health|weather)\b/)) {
    return {
      action: "query",
      target: { type: "world", name: "status" },
      confidence: 0.6,
    };
  }

  return { action: "chat", confidence: 0.5 };
}

// Quick intent check without API (for rate limiting / cost saving)
export function quickIntentCheck(message: string): ExtractedIntent | null {
  const lower = message.toLowerCase();

  // Very obvious patterns - skip API call
  const obviousPatterns: Array<{ pattern: RegExp; intent: ExtractedIntent }> = [
    {
      pattern: /^(gm|gn|hi|hello|hey|yo|sup)\b/i,
      intent: { action: "chat", confidence: 0.99 },
    },
    {
      pattern: /^(pet|pat)\s+(the\s+)?(dog|cat|bird)/i,
      intent: { action: "pet", target: { type: "animal", name: "$3" }, confidence: 0.99 },
    },
    {
      pattern: /^fireworks?$/i,
      intent: { action: "effect", target: { type: "effect", name: "fireworks" }, confidence: 0.99 },
    },
  ];

  for (const { pattern, intent } of obviousPatterns) {
    const match = lower.match(pattern);
    if (match) {
      // Replace $3 placeholder with actual match
      if (intent.target?.name === "$3" && match[3]) {
        return {
          ...intent,
          target: { ...intent.target, name: match[3] },
        };
      }
      return intent;
    }
  }

  return null; // Not obvious, need LLM
}
