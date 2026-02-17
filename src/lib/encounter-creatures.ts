// Wild Encounter Creature Definitions
// Per-zone creature templates with stat tables and move sets

import type { Creature, CreatureZone, CreatureStats, Move } from "./encounter-types";
import { ZONE_DIFFICULTY } from "./encounter-types";

interface CreatureTemplate {
  name: string;
  type: string;
  spriteKey: string;
  baseStats: { hp: number; attack: number; defense: number; speed: number };
  moves: Move[];
}

const ZONE_CREATURES: Record<CreatureZone, CreatureTemplate[]> = {
  main_city: [
    {
      name: "Wild Dog", type: "beast", spriteKey: "dog",
      baseStats: { hp: 40, attack: 10, defense: 5, speed: 12 },
      moves: [
        { name: "Bite", type: "normal", power: 35, accuracy: 100, pp: 30, maxPp: 30, animation: "bite" },
        { name: "Tackle", type: "normal", power: 40, accuracy: 100, pp: 35, maxPp: 35, animation: "slash" },
        { name: "Growl", type: "debuff", power: 0, accuracy: 100, pp: 30, maxPp: 30, effect: "def_down", animation: "debuff" },
        { name: "Quick Strike", type: "normal", power: 30, accuracy: 100, pp: 30, maxPp: 30, effect: "priority", animation: "quick" },
      ],
    },
    {
      name: "Alley Cat", type: "beast", spriteKey: "cat",
      baseStats: { hp: 35, attack: 12, defense: 4, speed: 16 },
      moves: [
        { name: "Scratch", type: "normal", power: 35, accuracy: 100, pp: 35, maxPp: 35, animation: "slash" },
        { name: "Quick Strike", type: "normal", power: 30, accuracy: 100, pp: 30, maxPp: 30, effect: "priority", animation: "quick" },
        { name: "Hiss", type: "debuff", power: 0, accuracy: 100, pp: 30, maxPp: 30, effect: "def_down", animation: "debuff" },
        { name: "Pounce", type: "normal", power: 45, accuracy: 90, pp: 20, maxPp: 20, animation: "slash" },
      ],
    },
    {
      name: "Pixel Bird", type: "flying", spriteKey: "bird",
      baseStats: { hp: 25, attack: 8, defense: 6, speed: 18 },
      moves: [
        { name: "Gust", type: "flying", power: 40, accuracy: 100, pp: 25, maxPp: 25, animation: "gust" },
        { name: "Peck", type: "flying", power: 30, accuracy: 100, pp: 35, maxPp: 35, animation: "slash" },
        { name: "Quick Strike", type: "normal", power: 30, accuracy: 100, pp: 30, maxPp: 30, effect: "priority", animation: "quick" },
        { name: "Sand Attack", type: "debuff", power: 0, accuracy: 100, pp: 25, maxPp: 25, effect: "spd_down", animation: "debuff" },
      ],
    },
    {
      name: "Squirrel Scout", type: "beast", spriteKey: "squirrel",
      baseStats: { hp: 30, attack: 9, defense: 7, speed: 15 },
      moves: [
        { name: "Tackle", type: "normal", power: 40, accuracy: 100, pp: 35, maxPp: 35, animation: "slash" },
        { name: "Harden", type: "buff", power: 0, accuracy: 100, pp: 30, maxPp: 30, effect: "def_up", animation: "shimmer" },
        { name: "Quick Strike", type: "normal", power: 30, accuracy: 100, pp: 30, maxPp: 30, effect: "priority", animation: "quick" },
        { name: "Bite", type: "normal", power: 35, accuracy: 100, pp: 30, maxPp: 30, animation: "bite" },
      ],
    },
    {
      name: "Flutter Bug", type: "bug", spriteKey: "butterfly",
      baseStats: { hp: 20, attack: 7, defense: 5, speed: 14 },
      moves: [
        { name: "Bug Bite", type: "bug", power: 30, accuracy: 100, pp: 35, maxPp: 35, animation: "bite" },
        { name: "Gust", type: "flying", power: 40, accuracy: 100, pp: 25, maxPp: 25, animation: "gust" },
        { name: "Harden", type: "buff", power: 0, accuracy: 100, pp: 30, maxPp: 30, effect: "def_up", animation: "shimmer" },
        { name: "String Shot", type: "debuff", power: 0, accuracy: 95, pp: 30, maxPp: 30, effect: "spd_down", animation: "debuff" },
      ],
    },
  ],
  founders: [
    {
      name: "Charmander", type: "fire", spriteKey: "pokemon_charmander",
      baseStats: { hp: 50, attack: 14, defense: 8, speed: 12 },
      moves: [
        { name: "Ember", type: "fire", power: 40, accuracy: 100, pp: 25, maxPp: 25, effect: "burn", effectChance: 10, animation: "ember" },
        { name: "Scratch", type: "normal", power: 35, accuracy: 100, pp: 35, maxPp: 35, animation: "slash" },
        { name: "Growl", type: "debuff", power: 0, accuracy: 100, pp: 30, maxPp: 30, effect: "def_down", animation: "debuff" },
        { name: "Quick Strike", type: "normal", power: 30, accuracy: 100, pp: 30, maxPp: 30, effect: "priority", animation: "quick" },
      ],
    },
    {
      name: "Squirtle", type: "water", spriteKey: "pokemon_squirtle",
      baseStats: { hp: 55, attack: 12, defense: 12, speed: 10 },
      moves: [
        { name: "Water Gun", type: "water", power: 40, accuracy: 100, pp: 25, maxPp: 25, animation: "water" },
        { name: "Tackle", type: "normal", power: 40, accuracy: 100, pp: 35, maxPp: 35, animation: "slash" },
        { name: "Harden", type: "buff", power: 0, accuracy: 100, pp: 30, maxPp: 30, effect: "def_up", animation: "shimmer" },
        { name: "Bite", type: "normal", power: 35, accuracy: 100, pp: 30, maxPp: 30, animation: "bite" },
      ],
    },
    {
      name: "Bulbasaur", type: "grass", spriteKey: "pokemon_bulbasaur",
      baseStats: { hp: 52, attack: 13, defense: 10, speed: 11 },
      moves: [
        { name: "Vine Whip", type: "grass", power: 40, accuracy: 100, pp: 25, maxPp: 25, animation: "slash" },
        { name: "Tackle", type: "normal", power: 40, accuracy: 100, pp: 35, maxPp: 35, animation: "slash" },
        { name: "Growl", type: "debuff", power: 0, accuracy: 100, pp: 30, maxPp: 30, effect: "def_down", animation: "debuff" },
        { name: "Leech Seed", type: "grass", power: 25, accuracy: 90, pp: 20, maxPp: 20, animation: "shimmer" },
      ],
    },
  ],
  moltbook: [
    {
      name: "Beach Crab", type: "aquatic", spriteKey: "fighter_10",
      baseStats: { hp: 45, attack: 12, defense: 10, speed: 8 },
      moves: [
        { name: "Vice Grip", type: "normal", power: 45, accuracy: 100, pp: 25, maxPp: 25, animation: "bite" },
        { name: "Bubble", type: "water", power: 35, accuracy: 100, pp: 30, maxPp: 30, animation: "water" },
        { name: "Harden", type: "buff", power: 0, accuracy: 100, pp: 30, maxPp: 30, effect: "def_up", animation: "shimmer" },
        { name: "Mud Shot", type: "aquatic", power: 40, accuracy: 95, pp: 20, maxPp: 20, effect: "spd_down", effectChance: 100, animation: "debuff" },
      ],
    },
    {
      name: "Lobster Brawler", type: "aquatic", spriteKey: "fighter_9",
      baseStats: { hp: 60, attack: 16, defense: 8, speed: 10 },
      moves: [
        { name: "Crunch", type: "normal", power: 50, accuracy: 100, pp: 20, maxPp: 20, animation: "bite" },
        { name: "Bubble Beam", type: "water", power: 45, accuracy: 100, pp: 20, maxPp: 20, animation: "water" },
        { name: "Harden", type: "buff", power: 0, accuracy: 100, pp: 30, maxPp: 30, effect: "def_up", animation: "shimmer" },
        { name: "Tackle", type: "normal", power: 40, accuracy: 100, pp: 35, maxPp: 35, animation: "slash" },
      ],
    },
    {
      name: "Octopus Ink", type: "aquatic", spriteKey: "fighter_11",
      baseStats: { hp: 50, attack: 14, defense: 7, speed: 13 },
      moves: [
        { name: "Tentacle Slap", type: "aquatic", power: 40, accuracy: 100, pp: 25, maxPp: 25, animation: "slash" },
        { name: "Ink Jet", type: "water", power: 45, accuracy: 90, pp: 20, maxPp: 20, animation: "water" },
        { name: "Smokescreen", type: "debuff", power: 0, accuracy: 100, pp: 25, maxPp: 25, effect: "spd_down", animation: "debuff" },
        { name: "Constrict", type: "normal", power: 30, accuracy: 100, pp: 30, maxPp: 30, animation: "bite" },
      ],
    },
    {
      name: "Jellyfish Zap", type: "aquatic", spriteKey: "fighter_13",
      baseStats: { hp: 35, attack: 15, defense: 6, speed: 14 },
      moves: [
        { name: "Sting", type: "aquatic", power: 45, accuracy: 100, pp: 25, maxPp: 25, animation: "slash" },
        { name: "Bubble", type: "water", power: 35, accuracy: 100, pp: 30, maxPp: 30, animation: "water" },
        { name: "Acid", type: "aquatic", power: 40, accuracy: 100, pp: 25, maxPp: 25, effect: "def_down", effectChance: 30, animation: "debuff" },
        { name: "Wrap", type: "normal", power: 30, accuracy: 90, pp: 20, maxPp: 20, animation: "bite" },
      ],
    },
    {
      name: "Pufferfish", type: "aquatic", spriteKey: "fighter_14",
      baseStats: { hp: 55, attack: 11, defense: 14, speed: 8 },
      moves: [
        { name: "Spike Shot", type: "aquatic", power: 40, accuracy: 100, pp: 25, maxPp: 25, animation: "slash" },
        { name: "Bubble", type: "water", power: 35, accuracy: 100, pp: 30, maxPp: 30, animation: "water" },
        { name: "Harden", type: "buff", power: 0, accuracy: 100, pp: 30, maxPp: 30, effect: "def_up", animation: "shimmer" },
        { name: "Tackle", type: "normal", power: 40, accuracy: 100, pp: 35, maxPp: 35, animation: "slash" },
      ],
    },
  ],
};

function scaleStats(base: { hp: number; attack: number; defense: number; speed: number }, level: number): CreatureStats {
  const multiplier = 1 + (level - 1) * 0.2;
  const hp = Math.round(base.hp * multiplier);
  return {
    hp,
    maxHp: hp,
    attack: Math.round(base.attack * multiplier),
    defense: Math.round(base.defense * multiplier),
    speed: Math.round(base.speed * multiplier),
  };
}

function cloneMoves(moves: Move[]): Move[] {
  return moves.map((m) => ({ ...m }));
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
    moves: cloneMoves(template.moves),
    spriteKey: template.spriteKey,
  };
}

// Sprite pool cache for Fal.ai generated sprites
const spritePool: Map<CreatureZone, { url: string; creatureType: string }[]> = new Map();

export async function preGenerateCreaturePool(zone: CreatureZone): Promise<void> {
  const existing = spritePool.get(zone);
  if (existing && existing.length > 0) return;

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

  for (const template of templates.slice(0, 5)) {
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
      // Fal.ai unavailable
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
  const match = pool.find((p) => p.creatureType === creatureType);
  if (match) return match.url;
  return pool[Math.floor(Math.random() * pool.length)]?.url;
}
