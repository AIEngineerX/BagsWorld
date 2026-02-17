// Wild Encounter Creature Definitions
// Per-zone creature templates with stat tables

import type { Creature, CreatureZone, CreatureStats } from "./encounter-types";
import { ZONE_DIFFICULTY } from "./encounter-types";

interface CreatureTemplate {
  name: string;
  type: string;
  spriteKey: string;
  baseStats: { hp: number; attack: number; defense: number };
}

const ZONE_CREATURES: Record<CreatureZone, CreatureTemplate[]> = {
  main_city: [
    { name: "Wild Dog", type: "beast", spriteKey: "dog", baseStats: { hp: 40, attack: 8, defense: 3 } },
    { name: "Alley Cat", type: "beast", spriteKey: "cat", baseStats: { hp: 35, attack: 10, defense: 2 } },
    { name: "Pixel Bird", type: "flying", spriteKey: "bird", baseStats: { hp: 25, attack: 6, defense: 4 } },
    { name: "Squirrel Scout", type: "beast", spriteKey: "squirrel", baseStats: { hp: 30, attack: 7, defense: 5 } },
    { name: "Flutter Bug", type: "bug", spriteKey: "butterfly", baseStats: { hp: 20, attack: 5, defense: 3 } },
  ],
  founders: [
    { name: "Charmander", type: "fire", spriteKey: "pokemon_charmander", baseStats: { hp: 50, attack: 12, defense: 5 } },
    { name: "Squirtle", type: "water", spriteKey: "pokemon_squirtle", baseStats: { hp: 55, attack: 10, defense: 8 } },
    { name: "Bulbasaur", type: "grass", spriteKey: "pokemon_bulbasaur", baseStats: { hp: 52, attack: 11, defense: 7 } },
  ],
  moltbook: [
    { name: "Beach Crab", type: "aquatic", spriteKey: "fighter_10", baseStats: { hp: 45, attack: 10, defense: 8 } },
    { name: "Lobster Brawler", type: "aquatic", spriteKey: "fighter_9", baseStats: { hp: 60, attack: 14, defense: 6 } },
    { name: "Octopus Ink", type: "aquatic", spriteKey: "fighter_11", baseStats: { hp: 50, attack: 12, defense: 5 } },
    { name: "Jellyfish Zap", type: "aquatic", spriteKey: "fighter_13", baseStats: { hp: 35, attack: 13, defense: 4 } },
    { name: "Pufferfish", type: "aquatic", spriteKey: "fighter_14", baseStats: { hp: 55, attack: 9, defense: 10 } },
  ],
};

function scaleStats(base: { hp: number; attack: number; defense: number }, level: number): CreatureStats {
  // Scale stats by ~20% per level above 1
  const multiplier = 1 + (level - 1) * 0.2;
  const hp = Math.round(base.hp * multiplier);
  return {
    hp,
    maxHp: hp,
    attack: Math.round(base.attack * multiplier),
    defense: Math.round(base.defense * multiplier),
  };
}

export function generateCreature(zone: CreatureZone): Creature {
  const templates = ZONE_CREATURES[zone];
  const template = templates[Math.floor(Math.random() * templates.length)];

  const difficulty = ZONE_DIFFICULTY[zone];
  const level = difficulty.minLevel + Math.floor(Math.random() * (difficulty.maxLevel - difficulty.minLevel + 1));

  const stats = scaleStats(template.baseStats, level);

  return {
    id: `${template.type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: template.name,
    type: template.type,
    zone,
    level,
    stats,
    spriteKey: template.spriteKey,
  };
}

// Sprite pool cache for Fal.ai generated sprites
const spritePool: Map<CreatureZone, { url: string; creatureType: string }[]> = new Map();

export async function preGenerateCreaturePool(zone: CreatureZone): Promise<void> {
  // Don't re-generate if pool already has sprites
  const existing = spritePool.get(zone);
  if (existing && existing.length > 0) return;

  // Check localStorage cache first
  try {
    const cached = localStorage.getItem(`bagsworld_creature_sprites_${zone}`);
    if (cached) {
      const parsed = JSON.parse(cached) as { url: string; creatureType: string }[];
      if (parsed.length > 0) {
        spritePool.set(zone, parsed);
        return;
      }
    }
  } catch {
    // ignore
  }

  const templates = ZONE_CREATURES[zone];
  const pool: { url: string; creatureType: string }[] = [];

  // Generate 5 sprites (or however many templates exist)
  const toGenerate = templates.slice(0, 5);

  for (const template of toGenerate) {
    try {
      const res = await fetch("/api/generate-creature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zone, creatureType: template.type, creatureName: template.name }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.imageUrl) {
          pool.push({ url: data.imageUrl, creatureType: template.type });
        }
      }
    } catch {
      // Fal.ai unavailable — will fall back to texture keys
    }
  }

  if (pool.length > 0) {
    spritePool.set(zone, pool);
    try {
      localStorage.setItem(`bagsworld_creature_sprites_${zone}`, JSON.stringify(pool));
    } catch {
      // ignore
    }
  }
}

export function getPooledSpriteUrl(zone: CreatureZone, creatureType: string): string | undefined {
  const pool = spritePool.get(zone);
  if (!pool || pool.length === 0) return undefined;

  // Try to find matching type first
  const match = pool.find((p) => p.creatureType === creatureType);
  if (match) return match.url;

  // Fall back to random from pool
  return pool[Math.floor(Math.random() * pool.length)]?.url;
}
