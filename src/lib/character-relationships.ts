// Character Relationships - Track how characters relate to each other
// Enables more interesting dialogue based on history and opinions

import { characters } from "@/characters";

// ============================================================================
// TYPES
// ============================================================================

export interface CharacterRelationship {
  fromCharacter: string;
  toCharacter: string;
  trust: number; // -1 to 1 (distrust to full trust)
  respect: number; // 0 to 1
  familiarity: number; // 0 to 1 (how well they know each other)
  sentiment: "positive" | "neutral" | "negative";
  interactions: number;
  lastInteraction: number;
  sharedTopics: string[];
  notes: string[]; // Memory of specific interactions
}

export interface CharacterState {
  id: string;
  mood: "happy" | "neutral" | "thoughtful" | "concerned" | "excited";
  energy: number; // 0-100
  recentTopics: string[];
  opinionsExpressed: string[];
}

// ============================================================================
// DEFAULT RELATIONSHIPS
// ============================================================================

// Pre-defined relationships based on lore
const DEFAULT_RELATIONSHIPS: Partial<CharacterRelationship>[] = [
  // Finn's relationships
  {
    fromCharacter: "finn",
    toCharacter: "ghost",
    trust: 0.9,
    respect: 0.85,
    familiarity: 0.9,
    sentiment: "positive",
  },
  {
    fromCharacter: "finn",
    toCharacter: "neo",
    trust: 0.7,
    respect: 0.8,
    familiarity: 0.7,
    sentiment: "positive",
  },
  {
    fromCharacter: "finn",
    toCharacter: "ash",
    trust: 0.8,
    respect: 0.7,
    familiarity: 0.8,
    sentiment: "positive",
  },
  {
    fromCharacter: "finn",
    toCharacter: "bags-bot",
    trust: 0.6,
    respect: 0.5,
    familiarity: 0.6,
    sentiment: "positive",
  },

  // Ghost's relationships
  {
    fromCharacter: "ghost",
    toCharacter: "finn",
    trust: 0.85,
    respect: 0.9,
    familiarity: 0.9,
    sentiment: "positive",
  },
  {
    fromCharacter: "ghost",
    toCharacter: "neo",
    trust: 0.8,
    respect: 0.85,
    familiarity: 0.8,
    sentiment: "positive",
  },
  {
    fromCharacter: "ghost",
    toCharacter: "ash",
    trust: 0.5,
    respect: 0.6,
    familiarity: 0.5,
    sentiment: "neutral",
  },
  {
    fromCharacter: "ghost",
    toCharacter: "bags-bot",
    trust: 0.4,
    respect: 0.5,
    familiarity: 0.5,
    sentiment: "neutral",
  },

  // Neo's relationships
  {
    fromCharacter: "neo",
    toCharacter: "finn",
    trust: 0.7,
    respect: 0.8,
    familiarity: 0.7,
    sentiment: "positive",
  },
  {
    fromCharacter: "neo",
    toCharacter: "ghost",
    trust: 0.85,
    respect: 0.9,
    familiarity: 0.8,
    sentiment: "positive",
  },
  {
    fromCharacter: "neo",
    toCharacter: "ash",
    trust: 0.4,
    respect: 0.5,
    familiarity: 0.4,
    sentiment: "neutral",
  },
  {
    fromCharacter: "neo",
    toCharacter: "bags-bot",
    trust: 0.3,
    respect: 0.4,
    familiarity: 0.3,
    sentiment: "neutral",
  },

  // Ash's relationships
  {
    fromCharacter: "ash",
    toCharacter: "finn",
    trust: 0.8,
    respect: 0.85,
    familiarity: 0.8,
    sentiment: "positive",
  },
  {
    fromCharacter: "ash",
    toCharacter: "ghost",
    trust: 0.6,
    respect: 0.7,
    familiarity: 0.5,
    sentiment: "positive",
  },
  {
    fromCharacter: "ash",
    toCharacter: "neo",
    trust: 0.5,
    respect: 0.6,
    familiarity: 0.4,
    sentiment: "neutral",
  },
  {
    fromCharacter: "ash",
    toCharacter: "bags-bot",
    trust: 0.7,
    respect: 0.6,
    familiarity: 0.7,
    sentiment: "positive",
  },

  // Bags Bot's relationships
  {
    fromCharacter: "bags-bot",
    toCharacter: "finn",
    trust: 0.7,
    respect: 0.8,
    familiarity: 0.7,
    sentiment: "positive",
  },
  {
    fromCharacter: "bags-bot",
    toCharacter: "ghost",
    trust: 0.6,
    respect: 0.7,
    familiarity: 0.6,
    sentiment: "positive",
  },
  {
    fromCharacter: "bags-bot",
    toCharacter: "neo",
    trust: 0.5,
    respect: 0.6,
    familiarity: 0.5,
    sentiment: "neutral",
  },
  {
    fromCharacter: "bags-bot",
    toCharacter: "ash",
    trust: 0.8,
    respect: 0.7,
    familiarity: 0.8,
    sentiment: "positive",
  },
];

// ============================================================================
// STATE
// ============================================================================

interface RelationshipState {
  relationships: Map<string, CharacterRelationship>;
  characterStates: Map<string, CharacterState>;
}

let state: RelationshipState = {
  relationships: new Map(),
  characterStates: new Map(),
};

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the relationship system with default relationships
 */
export function initRelationshipSystem(): void {
  // Initialize relationships
  DEFAULT_RELATIONSHIPS.forEach((rel) => {
    const key = `${rel.fromCharacter}->${rel.toCharacter}`;
    state.relationships.set(key, {
      fromCharacter: rel.fromCharacter!,
      toCharacter: rel.toCharacter!,
      trust: rel.trust ?? 0.5,
      respect: rel.respect ?? 0.5,
      familiarity: rel.familiarity ?? 0.5,
      sentiment: rel.sentiment ?? "neutral",
      interactions: 0,
      lastInteraction: 0,
      sharedTopics: [],
      notes: [],
    });
  });

  // Initialize character states
  Object.keys(characters).forEach((id) => {
    state.characterStates.set(id, {
      id,
      mood: "neutral",
      energy: 50 + Math.random() * 50,
      recentTopics: [],
      opinionsExpressed: [],
    });
  });

  console.log("[Relationships] System initialized with", state.relationships.size, "relationships");
}

// ============================================================================
// GETTERS
// ============================================================================

/**
 * Get relationship between two characters
 */
export function getRelationship(fromId: string, toId: string): CharacterRelationship | null {
  const key = `${fromId}->${toId}`;
  return state.relationships.get(key) || null;
}

/**
 * Get all relationships for a character
 */
export function getCharacterRelationships(characterId: string): CharacterRelationship[] {
  const relationships: CharacterRelationship[] = [];
  state.relationships.forEach((rel) => {
    if (rel.fromCharacter === characterId) {
      relationships.push(rel);
    }
  });
  return relationships;
}

/**
 * Get character state
 */
export function getCharacterState(characterId: string): CharacterState | null {
  return state.characterStates.get(characterId) || null;
}

/**
 * Get characters that like each other (for conversation pairing)
 */
export function getFriendlyPairs(): [string, string][] {
  const pairs: [string, string][] = [];
  const seen = new Set<string>();

  state.relationships.forEach((rel) => {
    if (rel.sentiment === "positive" && rel.trust > 0.6) {
      const pairKey = [rel.fromCharacter, rel.toCharacter].sort().join("-");
      if (!seen.has(pairKey)) {
        pairs.push([rel.fromCharacter, rel.toCharacter]);
        seen.add(pairKey);
      }
    }
  });

  return pairs;
}

// ============================================================================
// MODIFIERS
// ============================================================================

/**
 * Record an interaction between characters
 */
export function recordInteraction(
  fromId: string,
  toId: string,
  topic: string,
  sentiment: "positive" | "neutral" | "negative" = "neutral"
): void {
  const key = `${fromId}->${toId}`;
  let rel = state.relationships.get(key);

  if (!rel) {
    // Create new relationship
    rel = {
      fromCharacter: fromId,
      toCharacter: toId,
      trust: 0.5,
      respect: 0.5,
      familiarity: 0.3,
      sentiment: "neutral",
      interactions: 0,
      lastInteraction: Date.now(),
      sharedTopics: [],
      notes: [],
    };
    state.relationships.set(key, rel);
  }

  // Update relationship
  rel.interactions++;
  rel.lastInteraction = Date.now();

  // Add topic if new
  if (!rel.sharedTopics.includes(topic)) {
    rel.sharedTopics.push(topic);
    if (rel.sharedTopics.length > 10) {
      rel.sharedTopics.shift();
    }
  }

  // Update familiarity (increases with interactions)
  rel.familiarity = Math.min(1, rel.familiarity + 0.02);

  // Update sentiment based on interaction
  if (sentiment === "positive") {
    rel.trust = Math.min(1, rel.trust + 0.05);
    rel.sentiment = rel.trust > 0.6 ? "positive" : "neutral";
  } else if (sentiment === "negative") {
    rel.trust = Math.max(-1, rel.trust - 0.1);
    rel.sentiment = rel.trust < -0.3 ? "negative" : "neutral";
  }

  // Update character states
  const fromState = state.characterStates.get(fromId);
  if (fromState) {
    fromState.recentTopics.unshift(topic);
    if (fromState.recentTopics.length > 5) {
      fromState.recentTopics.pop();
    }
  }
}

/**
 * Update character mood
 */
export function updateCharacterMood(characterId: string, mood: CharacterState["mood"]): void {
  const charState = state.characterStates.get(characterId);
  if (charState) {
    charState.mood = mood;
  }
}

/**
 * Update character energy
 */
export function updateCharacterEnergy(characterId: string, delta: number): void {
  const charState = state.characterStates.get(characterId);
  if (charState) {
    charState.energy = Math.max(0, Math.min(100, charState.energy + delta));
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get how a character would refer to another character
 */
export function getCharacterReference(fromId: string, toId: string): string {
  const rel = getRelationship(fromId, toId);

  if (!rel) return toId;

  // Based on relationship, return different references
  if (rel.trust > 0.8 && rel.familiarity > 0.7) {
    // Close relationship - use friendly terms
    const friendlyRefs: Record<string, Record<string, string>> = {
      finn: { ghost: "ghost", neo: "neo", ash: "ash" },
      ghost: { finn: "boss", neo: "neo" },
      neo: { ghost: "ghost", finn: "the architect" },
      ash: { finn: "professor oak", neo: "psychic trainer" },
    };
    return friendlyRefs[fromId]?.[toId] || toId;
  }

  return toId;
}

/**
 * Check if two characters are likely to agree
 */
export function wouldAgree(char1: string, char2: string, topic: string): boolean {
  const rel1 = getRelationship(char1, char2);
  const rel2 = getRelationship(char2, char1);

  if (!rel1 || !rel2) return Math.random() > 0.5;

  // High trust and shared topics increase agreement
  const avgTrust = (rel1.trust + rel2.trust) / 2;
  const sharedTopics = rel1.sharedTopics.filter((t) => rel2.sharedTopics.includes(t));

  return avgTrust > 0.6 || sharedTopics.includes(topic) || Math.random() < avgTrust;
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Reset relationship system
 */
export function resetRelationshipSystem(): void {
  state = {
    relationships: new Map(),
    characterStates: new Map(),
  };
}

// Auto-initialize
if (typeof window !== "undefined") {
  initRelationshipSystem();
}
