import * as Phaser from "phaser";
import {
  SCALE,
  PALETTE,
  SKIN_TONES,
  HAIR_COLORS,
  SHIRT_COLORS,
  darken,
  lighten,
} from "./constants";

export function generateDiverseCharacters(scene: Phaser.Scene): void {
  // Generate multiple character variants for diversity
  for (let i = 0; i < 9; i++) {
    const skinTone = SKIN_TONES[i % SKIN_TONES.length];
    const hairColor = HAIR_COLORS[i % HAIR_COLORS.length];
    const shirtColor = SHIRT_COLORS[i % SHIRT_COLORS.length];

    // Neutral state
    createCharacterSprite(scene, `character_${i}`, skinTone, hairColor, shirtColor, "neutral");
    // Happy state
    createCharacterSprite(scene, `character_${i}_happy`, skinTone, hairColor, shirtColor, "happy");
    // Sad state
    createCharacterSprite(scene, `character_${i}_sad`, skinTone, hairColor, shirtColor, "sad");
    // Celebrating state
    createCharacterSprite(
      scene,
      `character_${i}_celebrating`,
      skinTone,
      hairColor,
      shirtColor,
      "celebrating"
    );
  }

  // Keep default textures for backward compatibility
  createCharacterSprite(
    scene,
    "character",
    SKIN_TONES[0],
    HAIR_COLORS[0],
    SHIRT_COLORS[0],
    "neutral"
  );
  createCharacterSprite(
    scene,
    "character_happy",
    SKIN_TONES[0],
    HAIR_COLORS[0],
    SHIRT_COLORS[0],
    "happy"
  );
  createCharacterSprite(
    scene,
    "character_sad",
    SKIN_TONES[0],
    HAIR_COLORS[0],
    SHIRT_COLORS[0],
    "sad"
  );
  createCharacterSprite(
    scene,
    "character_celebrating",
    SKIN_TONES[0],
    HAIR_COLORS[0],
    SHIRT_COLORS[0],
    "celebrating"
  );

  // Generate Toly - Solana co-founder special character
  generateTolySprite(scene);

  // Generate Ash Ketchum - ecosystem guide character
  generateAshSprite(scene);

  // Generate Finn - Bags.fm founder
  generateFinnSprite(scene);

  // Generate The Dev (DaddyGhost) - trading agent character
  generateDevSprite(scene);

  // Generate Neo - The Scout Agent
  generateNeoSprite(scene);

  // Generate CJ - The Hood Rat from BagsCity
  generateCJSprite(scene);

  // Generate Shaw - ElizaOS creator, ai16z co-founder
  generateShawSprite(scene);
}

function generateTolySprite(scene: Phaser.Scene): void {
  // Toly (Anatoly Yakovenko) - Solana co-founder
  // Casual tech look, beard, Solana purple/green colors
  const s = SCALE;
  const size = Math.round(32 * s);
  const skinTone = 0xf1c27d; // Light tan
  const hairColor = 0x4a3728; // Brown hair
  const beardColor = 0x5c4033; // Brown beard
  const shirtColor = 0x9945ff; // Solana purple!

  const g = scene.make.graphics({ x: 0, y: 0 });

  // Solana gradient aura/glow behind Toly
  g.fillStyle(0x14f195, 0.15); // Solana green
  g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
  g.fillStyle(0x9945ff, 0.1); // Solana purple
  g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

  // Shadow
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

  // Legs (dark jeans)
  g.fillStyle(0x1e3a5f);
  g.fillRect(Math.round(10 * s), Math.round(22 * s), Math.round(5 * s), Math.round(9 * s));
  g.fillRect(Math.round(17 * s), Math.round(22 * s), Math.round(5 * s), Math.round(9 * s));

  // Shoes (casual sneakers)
  g.fillStyle(0x374151);
  g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
  g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
  // White sole
  g.fillStyle(0xffffff);
  g.fillRect(Math.round(9 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));
  g.fillRect(Math.round(17 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));

  // Body/Shirt (Solana purple hoodie)
  g.fillStyle(shirtColor);
  g.fillRect(Math.round(8 * s), Math.round(12 * s), Math.round(16 * s), Math.round(12 * s));

  // Hoodie details
  g.fillStyle(0x7c3aed);
  g.fillRect(Math.round(8 * s), Math.round(12 * s), Math.round(3 * s), Math.round(12 * s));
  g.fillRect(Math.round(21 * s), Math.round(12 * s), Math.round(3 * s), Math.round(12 * s));

  // Solana logo on shirt (simplified S shape)
  g.fillStyle(0x14f195); // Solana green
  g.fillRect(Math.round(13 * s), Math.round(15 * s), Math.round(6 * s), Math.round(2 * s));
  g.fillRect(Math.round(13 * s), Math.round(15 * s), Math.round(2 * s), Math.round(4 * s));
  g.fillRect(Math.round(13 * s), Math.round(17 * s), Math.round(6 * s), Math.round(2 * s));
  g.fillRect(Math.round(17 * s), Math.round(17 * s), Math.round(2 * s), Math.round(4 * s));
  g.fillRect(Math.round(13 * s), Math.round(19 * s), Math.round(6 * s), Math.round(2 * s));

  // Arms
  g.fillStyle(skinTone);
  g.fillRect(Math.round(5 * s), Math.round(13 * s), Math.round(4 * s), Math.round(10 * s));
  g.fillRect(Math.round(23 * s), Math.round(13 * s), Math.round(4 * s), Math.round(10 * s));

  // Head
  g.fillStyle(skinTone);
  g.fillRect(Math.round(9 * s), Math.round(2 * s), Math.round(14 * s), Math.round(12 * s));

  // Hair (short, casual)
  g.fillStyle(hairColor);
  g.fillRect(Math.round(9 * s), 0, Math.round(14 * s), Math.round(5 * s));
  g.fillRect(Math.round(8 * s), Math.round(2 * s), Math.round(2 * s), Math.round(4 * s));
  g.fillRect(Math.round(22 * s), Math.round(2 * s), Math.round(2 * s), Math.round(4 * s));

  // Beard (short, well-groomed)
  g.fillStyle(beardColor);
  g.fillRect(Math.round(10 * s), Math.round(10 * s), Math.round(12 * s), Math.round(4 * s));
  g.fillRect(Math.round(11 * s), Math.round(9 * s), Math.round(10 * s), Math.round(2 * s));
  // Chin
  g.fillRect(Math.round(12 * s), Math.round(13 * s), Math.round(8 * s), Math.round(1 * s));

  // Eyes (friendly, focused)
  g.fillStyle(0xffffff);
  g.fillRect(Math.round(11 * s), Math.round(5 * s), Math.round(4 * s), Math.round(3 * s));
  g.fillRect(Math.round(17 * s), Math.round(5 * s), Math.round(4 * s), Math.round(3 * s));
  // Pupils
  g.fillStyle(0x1e3a5f); // Blue-ish
  g.fillRect(Math.round(13 * s), Math.round(5 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(19 * s), Math.round(5 * s), Math.round(2 * s), Math.round(2 * s));

  // Friendly smile under beard
  g.fillStyle(0xffffff);
  g.fillRect(Math.round(14 * s), Math.round(11 * s), Math.round(4 * s), Math.round(1 * s));

  // Solana symbol above head (instead of question mark)
  g.fillStyle(0x14f195);
  g.fillRect(Math.round(12 * s), Math.round(-4 * s), Math.round(8 * s), Math.round(2 * s));
  g.fillStyle(0x9945ff);
  g.fillRect(Math.round(14 * s), Math.round(-6 * s), Math.round(4 * s), Math.round(2 * s));
  g.fillStyle(0x14f195);
  g.fillRect(Math.round(13 * s), Math.round(-2 * s), Math.round(6 * s), Math.round(2 * s));

  g.generateTexture("toly", size, size);
  g.destroy();
}

function generateAshSprite(scene: Phaser.Scene): void {
  // Ash Ketchum - Pokemon trainer style with iconic cap
  const s = SCALE;
  const size = Math.round(32 * s);
  const skinTone = 0xffdbac; // Light skin
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Shadow
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

  // Legs (blue jeans)
  g.fillStyle(0x1e40af);
  g.fillRect(Math.round(10 * s), Math.round(22 * s), Math.round(5 * s), Math.round(9 * s));
  g.fillRect(Math.round(17 * s), Math.round(22 * s), Math.round(5 * s), Math.round(9 * s));

  // Shoes (red/black sneakers)
  g.fillStyle(0xdc2626);
  g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
  g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
  g.fillStyle(0xffffff);
  g.fillRect(Math.round(10 * s), Math.round(30 * s), Math.round(2 * s), Math.round(1 * s));
  g.fillRect(Math.round(18 * s), Math.round(30 * s), Math.round(2 * s), Math.round(1 * s));

  // Body (blue vest over black shirt)
  g.fillStyle(0x1f2937); // Black undershirt
  g.fillRect(Math.round(8 * s), Math.round(12 * s), Math.round(16 * s), Math.round(12 * s));
  g.fillStyle(0x2563eb); // Blue vest
  g.fillRect(Math.round(8 * s), Math.round(12 * s), Math.round(5 * s), Math.round(12 * s));
  g.fillRect(Math.round(19 * s), Math.round(12 * s), Math.round(5 * s), Math.round(12 * s));
  // Yellow trim on vest
  g.fillStyle(0xfbbf24);
  g.fillRect(Math.round(8 * s), Math.round(12 * s), Math.round(1 * s), Math.round(12 * s));
  g.fillRect(Math.round(23 * s), Math.round(12 * s), Math.round(1 * s), Math.round(12 * s));

  // Arms
  g.fillStyle(skinTone);
  g.fillRect(Math.round(5 * s), Math.round(13 * s), Math.round(4 * s), Math.round(10 * s));
  g.fillRect(Math.round(23 * s), Math.round(13 * s), Math.round(4 * s), Math.round(10 * s));

  // Gloves (green fingerless)
  g.fillStyle(0x22c55e);
  g.fillRect(Math.round(5 * s), Math.round(19 * s), Math.round(4 * s), Math.round(4 * s));
  g.fillRect(Math.round(23 * s), Math.round(19 * s), Math.round(4 * s), Math.round(4 * s));
  g.fillStyle(skinTone);
  g.fillRect(Math.round(6 * s), Math.round(21 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(24 * s), Math.round(21 * s), Math.round(2 * s), Math.round(2 * s));

  // Head
  g.fillStyle(skinTone);
  g.fillRect(Math.round(9 * s), Math.round(2 * s), Math.round(14 * s), Math.round(12 * s));

  // Hair (black, spiky)
  g.fillStyle(0x1a1a1a);
  g.fillRect(Math.round(9 * s), 0, Math.round(14 * s), Math.round(5 * s));
  g.fillRect(Math.round(7 * s), Math.round(2 * s), Math.round(3 * s), Math.round(5 * s));
  g.fillRect(Math.round(22 * s), Math.round(2 * s), Math.round(3 * s), Math.round(5 * s));
  // Spiky hair bits sticking out
  g.fillRect(Math.round(6 * s), Math.round(3 * s), Math.round(2 * s), Math.round(3 * s));
  g.fillRect(Math.round(24 * s), Math.round(3 * s), Math.round(2 * s), Math.round(3 * s));
  g.fillRect(Math.round(12 * s), Math.round(-1 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(18 * s), Math.round(-1 * s), Math.round(2 * s), Math.round(2 * s));

  // Iconic Pokemon cap (red with white front and green symbol area)
  g.fillStyle(0xdc2626); // Red
  g.fillRect(Math.round(7 * s), Math.round(-2 * s), Math.round(18 * s), Math.round(5 * s));
  g.fillStyle(0xffffff); // White front panel
  g.fillRect(Math.round(11 * s), Math.round(-2 * s), Math.round(10 * s), Math.round(4 * s));
  // Green Pokemon League symbol
  g.fillStyle(0x22c55e);
  g.fillRect(Math.round(14 * s), Math.round(-1 * s), Math.round(4 * s), Math.round(2 * s));
  // Cap bill
  g.fillStyle(0xdc2626);
  g.fillRect(Math.round(7 * s), Math.round(2 * s), Math.round(10 * s), Math.round(2 * s));

  // Face marks (Z marks on cheeks - like Ash)
  g.fillStyle(0x8b4513);
  g.fillRect(Math.round(9 * s), Math.round(8 * s), Math.round(2 * s), Math.round(1 * s));
  g.fillRect(Math.round(9 * s), Math.round(9 * s), Math.round(1 * s), Math.round(1 * s));
  g.fillRect(Math.round(21 * s), Math.round(8 * s), Math.round(2 * s), Math.round(1 * s));
  g.fillRect(Math.round(22 * s), Math.round(9 * s), Math.round(1 * s), Math.round(1 * s));

  // Eyes (big anime style)
  g.fillStyle(0xffffff);
  g.fillRect(Math.round(11 * s), Math.round(5 * s), Math.round(4 * s), Math.round(4 * s));
  g.fillRect(Math.round(17 * s), Math.round(5 * s), Math.round(4 * s), Math.round(4 * s));
  // Brown irises
  g.fillStyle(0x92400e);
  g.fillRect(Math.round(12 * s), Math.round(6 * s), Math.round(3 * s), Math.round(3 * s));
  g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(3 * s), Math.round(3 * s));
  // Black pupils
  g.fillStyle(0x000000);
  g.fillRect(Math.round(13 * s), Math.round(6 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(19 * s), Math.round(6 * s), Math.round(2 * s), Math.round(2 * s));
  // Eye shine
  g.fillStyle(0xffffff);
  g.fillRect(Math.round(13 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));
  g.fillRect(Math.round(19 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));

  // Determined smile
  g.fillStyle(0x000000);
  g.fillRect(Math.round(13 * s), Math.round(11 * s), Math.round(6 * s), Math.round(1 * s));
  g.fillRect(Math.round(12 * s), Math.round(10 * s), Math.round(1 * s), Math.round(1 * s));
  g.fillRect(Math.round(19 * s), Math.round(10 * s), Math.round(1 * s), Math.round(1 * s));

  // Pokeball icon floating (showing he's a trainer)
  g.fillStyle(0xdc2626);
  g.fillCircle(Math.round(28 * s), Math.round(4 * s), Math.round(4 * s));
  g.fillStyle(0xffffff);
  g.fillRect(Math.round(24 * s), Math.round(3 * s), Math.round(8 * s), Math.round(2 * s));
  g.fillCircle(Math.round(28 * s), Math.round(4 * s), Math.round(4 * s));
  g.fillStyle(0xdc2626);
  g.fillRect(Math.round(24 * s), 0, Math.round(8 * s), Math.round(4 * s));
  g.fillStyle(0xffffff);
  g.fillRect(Math.round(24 * s), Math.round(4 * s), Math.round(8 * s), Math.round(4 * s));
  g.fillStyle(0x1f2937);
  g.fillRect(Math.round(24 * s), Math.round(3 * s), Math.round(8 * s), Math.round(2 * s));
  g.fillStyle(0xffffff);
  g.fillCircle(Math.round(28 * s), Math.round(4 * s), Math.round(2 * s));
  g.fillStyle(0x1f2937);
  g.fillCircle(Math.round(28 * s), Math.round(4 * s), Math.round(1 * s));

  g.generateTexture("ash", size, size);
  g.destroy();
}

function generateFinnSprite(scene: Phaser.Scene): void {
  // Finn (@finnbags) - Bags.fm CEO
  // Casual tech founder look with WIF-inspired beanie, emerald brand colors
  const s = SCALE;
  const size = Math.round(32 * s);
  const skinTone = 0xffd5b4; // Light skin
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Bags green glow behind Finn
  g.fillStyle(0x10b981, 0.15); // Emerald
  g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
  g.fillStyle(0x059669, 0.1);
  g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

  // Shadow
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

  // Legs (dark jeans)
  g.fillStyle(0x1f2937);
  g.fillRect(Math.round(10 * s), Math.round(22 * s), Math.round(5 * s), Math.round(9 * s));
  g.fillRect(Math.round(17 * s), Math.round(22 * s), Math.round(5 * s), Math.round(9 * s));

  // Shoes (white sneakers - clean founder style)
  g.fillStyle(0xffffff);
  g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
  g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
  g.fillStyle(0xe5e7eb);
  g.fillRect(Math.round(9 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));
  g.fillRect(Math.round(17 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));

  // Body (emerald hoodie - Bags brand)
  g.fillStyle(0x10b981); // Emerald
  g.fillRect(Math.round(8 * s), Math.round(12 * s), Math.round(16 * s), Math.round(12 * s));

  // Hoodie details (darker sides)
  g.fillStyle(0x059669);
  g.fillRect(Math.round(8 * s), Math.round(12 * s), Math.round(3 * s), Math.round(12 * s));
  g.fillRect(Math.round(21 * s), Math.round(12 * s), Math.round(3 * s), Math.round(12 * s));

  // "BAGS" text on hoodie (simplified)
  g.fillStyle(0xffffff);
  g.fillRect(Math.round(11 * s), Math.round(16 * s), Math.round(2 * s), Math.round(4 * s)); // B
  g.fillRect(Math.round(11 * s), Math.round(16 * s), Math.round(4 * s), Math.round(1 * s));
  g.fillRect(Math.round(11 * s), Math.round(18 * s), Math.round(4 * s), Math.round(1 * s));
  g.fillRect(Math.round(11 * s), Math.round(20 * s), Math.round(4 * s), Math.round(1 * s));
  g.fillRect(Math.round(14 * s), Math.round(16 * s), Math.round(1 * s), Math.round(4 * s));
  g.fillRect(Math.round(16 * s), Math.round(16 * s), Math.round(3 * s), Math.round(4 * s)); // A (simplified)
  g.fillRect(Math.round(17 * s), Math.round(15 * s), Math.round(1 * s), Math.round(1 * s));

  // Arms
  g.fillStyle(skinTone);
  g.fillRect(Math.round(5 * s), Math.round(13 * s), Math.round(4 * s), Math.round(10 * s));
  g.fillRect(Math.round(23 * s), Math.round(13 * s), Math.round(4 * s), Math.round(10 * s));

  // Head
  g.fillStyle(skinTone);
  g.fillRect(Math.round(9 * s), Math.round(2 * s), Math.round(14 * s), Math.round(12 * s));

  // Hair (short, neat)
  g.fillStyle(0x4a3728); // Brown
  g.fillRect(Math.round(9 * s), 0, Math.round(14 * s), Math.round(4 * s));
  g.fillRect(Math.round(8 * s), Math.round(1 * s), Math.round(2 * s), Math.round(4 * s));
  g.fillRect(Math.round(22 * s), Math.round(1 * s), Math.round(2 * s), Math.round(4 * s));

  // WIF-inspired pink beanie!
  g.fillStyle(0xec4899); // Pink like WIF hat
  g.fillRect(Math.round(7 * s), Math.round(-3 * s), Math.round(18 * s), Math.round(5 * s));
  g.fillRect(Math.round(8 * s), Math.round(-4 * s), Math.round(16 * s), Math.round(2 * s));
  // Beanie fold
  g.fillStyle(0xdb2777);
  g.fillRect(Math.round(7 * s), Math.round(1 * s), Math.round(18 * s), Math.round(2 * s));

  // Eyes (friendly, entrepreneurial)
  g.fillStyle(0xffffff);
  g.fillRect(Math.round(11 * s), Math.round(5 * s), Math.round(4 * s), Math.round(3 * s));
  g.fillRect(Math.round(17 * s), Math.round(5 * s), Math.round(4 * s), Math.round(3 * s));
  // Blue pupils
  g.fillStyle(0x3b82f6);
  g.fillRect(Math.round(13 * s), Math.round(5 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(19 * s), Math.round(5 * s), Math.round(2 * s), Math.round(2 * s));

  // Friendly smile
  g.fillStyle(0xffffff);
  g.fillRect(Math.round(13 * s), Math.round(10 * s), Math.round(6 * s), Math.round(2 * s));
  g.fillStyle(skinTone);
  g.fillRect(Math.round(13 * s), Math.round(10 * s), Math.round(6 * s), Math.round(1 * s));

  // Money bag icon floating (showing he's about bags!)
  g.fillStyle(0xfbbf24); // Gold
  g.fillCircle(Math.round(28 * s), Math.round(4 * s), Math.round(4 * s));
  g.fillStyle(0xf59e0b);
  g.fillRect(Math.round(26 * s), 0, Math.round(4 * s), Math.round(2 * s));
  // $ sign on bag
  g.fillStyle(0x065f46);
  g.fillRect(Math.round(27 * s), Math.round(2 * s), Math.round(2 * s), Math.round(4 * s));
  g.fillRect(Math.round(26 * s), Math.round(3 * s), Math.round(1 * s), Math.round(1 * s));
  g.fillRect(Math.round(29 * s), Math.round(4 * s), Math.round(1 * s), Math.round(1 * s));

  g.generateTexture("finn", size, size);
  g.destroy();
}

function generateDevSprite(scene: Phaser.Scene): void {
  // DaddyGhost (@DaddyGhost) - The Dev / Trencher
  // Hacker/dev aesthetic with hoodie, glasses, ghost theme
  const s = SCALE;
  const size = Math.round(32 * s);
  const skinTone = 0xe0ac69; // Medium skin
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Ghost/ethereal glow behind The Dev (purple/cyan hacker vibes)
  g.fillStyle(0x8b5cf6, 0.15); // Purple
  g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
  g.fillStyle(0x06b6d4, 0.1); // Cyan
  g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

  // Shadow
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

  // Legs (black joggers - dev uniform)
  g.fillStyle(0x1f2937);
  g.fillRect(Math.round(10 * s), Math.round(22 * s), Math.round(5 * s), Math.round(9 * s));
  g.fillRect(Math.round(17 * s), Math.round(22 * s), Math.round(5 * s), Math.round(9 * s));

  // Shoes (dark sneakers)
  g.fillStyle(0x374151);
  g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
  g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
  g.fillStyle(0x4b5563);
  g.fillRect(Math.round(10 * s), Math.round(30 * s), Math.round(4 * s), Math.round(1 * s));
  g.fillRect(Math.round(18 * s), Math.round(30 * s), Math.round(4 * s), Math.round(1 * s));

  // Body (dark hoodie with hood up - mysterious dev)
  g.fillStyle(0x1f2937); // Dark gray hoodie
  g.fillRect(Math.round(8 * s), Math.round(12 * s), Math.round(16 * s), Math.round(12 * s));

  // Hoodie details (darker sides)
  g.fillStyle(0x111827);
  g.fillRect(Math.round(8 * s), Math.round(12 * s), Math.round(3 * s), Math.round(12 * s));
  g.fillRect(Math.round(21 * s), Math.round(12 * s), Math.round(3 * s), Math.round(12 * s));

  // Hood shadow around face
  g.fillStyle(0x111827);
  g.fillRect(Math.round(8 * s), Math.round(2 * s), Math.round(16 * s), Math.round(6 * s));
  g.fillRect(Math.round(7 * s), Math.round(4 * s), Math.round(2 * s), Math.round(8 * s));
  g.fillRect(Math.round(23 * s), Math.round(4 * s), Math.round(2 * s), Math.round(8 * s));

  // Ghost icon on hoodie (the brand!)
  g.fillStyle(0x8b5cf6); // Purple ghost
  g.fillRect(Math.round(13 * s), Math.round(15 * s), Math.round(6 * s), Math.round(6 * s));
  g.fillRect(Math.round(12 * s), Math.round(16 * s), Math.round(2 * s), Math.round(4 * s));
  g.fillRect(Math.round(18 * s), Math.round(16 * s), Math.round(2 * s), Math.round(4 * s));
  // Ghost eyes
  g.fillStyle(0xffffff);
  g.fillRect(Math.round(14 * s), Math.round(16 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(17 * s), Math.round(16 * s), Math.round(2 * s), Math.round(2 * s));

  // Arms
  g.fillStyle(skinTone);
  g.fillRect(Math.round(5 * s), Math.round(13 * s), Math.round(4 * s), Math.round(10 * s));
  g.fillRect(Math.round(23 * s), Math.round(13 * s), Math.round(4 * s), Math.round(10 * s));

  // Head
  g.fillStyle(skinTone);
  g.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(12 * s), Math.round(10 * s));

  // Hair (dark, messy - been coding all night)
  g.fillStyle(0x1a1a1a);
  g.fillRect(Math.round(10 * s), Math.round(2 * s), Math.round(12 * s), Math.round(4 * s));
  g.fillRect(Math.round(9 * s), Math.round(3 * s), Math.round(2 * s), Math.round(3 * s));
  g.fillRect(Math.round(21 * s), Math.round(3 * s), Math.round(2 * s), Math.round(3 * s));
  // Messy bits sticking out
  g.fillRect(Math.round(8 * s), Math.round(4 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(22 * s), Math.round(4 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(12 * s), Math.round(1 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(18 * s), Math.round(1 * s), Math.round(2 * s), Math.round(2 * s));

  // Glasses (dev essential)
  g.fillStyle(0x374151); // Frame
  g.fillRect(Math.round(10 * s), Math.round(6 * s), Math.round(12 * s), Math.round(1 * s));
  g.fillRect(Math.round(10 * s), Math.round(6 * s), Math.round(5 * s), Math.round(4 * s));
  g.fillRect(Math.round(17 * s), Math.round(6 * s), Math.round(5 * s), Math.round(4 * s));
  // Lens
  g.fillStyle(0x60a5fa, 0.6); // Blue tinted
  g.fillRect(Math.round(11 * s), Math.round(7 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillRect(Math.round(18 * s), Math.round(7 * s), Math.round(3 * s), Math.round(2 * s));
  // Lens shine
  g.fillStyle(0xffffff, 0.4);
  g.fillRect(Math.round(11 * s), Math.round(7 * s), Math.round(1 * s), Math.round(1 * s));
  g.fillRect(Math.round(18 * s), Math.round(7 * s), Math.round(1 * s), Math.round(1 * s));

  // Eyes behind glasses
  g.fillStyle(0x000000);
  g.fillRect(Math.round(12 * s), Math.round(7 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(19 * s), Math.round(7 * s), Math.round(2 * s), Math.round(2 * s));

  // Slight smirk (knows something you don't)
  g.fillStyle(0x000000);
  g.fillRect(Math.round(14 * s), Math.round(11 * s), Math.round(4 * s), Math.round(1 * s));
  g.fillRect(Math.round(18 * s), Math.round(10 * s), Math.round(1 * s), Math.round(1 * s));

  // Terminal/code icon floating (showing he's a dev)
  g.fillStyle(0x1f2937);
  g.fillRect(Math.round(24 * s), 0, Math.round(8 * s), Math.round(8 * s));
  g.fillStyle(0x4ade80); // Green terminal text
  g.fillRect(Math.round(25 * s), Math.round(2 * s), Math.round(1 * s), Math.round(1 * s));
  g.fillRect(Math.round(26 * s), Math.round(2 * s), Math.round(3 * s), Math.round(1 * s));
  g.fillRect(Math.round(25 * s), Math.round(4 * s), Math.round(1 * s), Math.round(1 * s));
  g.fillRect(Math.round(26 * s), Math.round(4 * s), Math.round(4 * s), Math.round(1 * s));
  g.fillRect(Math.round(25 * s), Math.round(6 * s), Math.round(2 * s), Math.round(1 * s));

  g.generateTexture("dev", size, size);
  g.destroy();
}

function generateNeoSprite(scene: Phaser.Scene): void {
  // Neo - The One (Matrix-inspired Scout Agent)
  // Black coat, sunglasses, Matrix green theme
  const s = SCALE;
  const size = Math.round(32 * s);
  const skinTone = 0xf1c27d; // Light skin
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Matrix green digital glow behind Neo
  g.fillStyle(0x00ff41, 0.2); // Matrix green
  g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
  g.fillStyle(0x00ff41, 0.1);
  g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

  // Shadow
  g.fillStyle(0x000000, 0.4);
  g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

  // Legs (black pants)
  g.fillStyle(0x0a0a0a);
  g.fillRect(Math.round(10 * s), Math.round(22 * s), Math.round(5 * s), Math.round(9 * s));
  g.fillRect(Math.round(17 * s), Math.round(22 * s), Math.round(5 * s), Math.round(9 * s));

  // Shoes (black boots)
  g.fillStyle(0x1a1a1a);
  g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
  g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
  g.fillStyle(0x0a0a0a);
  g.fillRect(Math.round(9 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));
  g.fillRect(Math.round(17 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));

  // Long black coat (iconic Matrix look)
  g.fillStyle(0x0a0a0a);
  g.fillRect(Math.round(6 * s), Math.round(12 * s), Math.round(20 * s), Math.round(16 * s));

  // Coat details - slightly lighter edges
  g.fillStyle(0x1a1a1a);
  g.fillRect(Math.round(6 * s), Math.round(12 * s), Math.round(2 * s), Math.round(16 * s));
  g.fillRect(Math.round(24 * s), Math.round(12 * s), Math.round(2 * s), Math.round(16 * s));

  // Coat opening showing shirt
  g.fillStyle(0x111111);
  g.fillRect(Math.round(12 * s), Math.round(14 * s), Math.round(8 * s), Math.round(10 * s));

  // Arms
  g.fillStyle(skinTone);
  g.fillRect(Math.round(4 * s), Math.round(13 * s), Math.round(3 * s), Math.round(10 * s));
  g.fillRect(Math.round(25 * s), Math.round(13 * s), Math.round(3 * s), Math.round(10 * s));

  // Head
  g.fillStyle(skinTone);
  g.fillRect(Math.round(9 * s), Math.round(2 * s), Math.round(14 * s), Math.round(12 * s));

  // Hair (short, black, slicked back)
  g.fillStyle(0x0a0a0a);
  g.fillRect(Math.round(9 * s), 0, Math.round(14 * s), Math.round(5 * s));
  g.fillRect(Math.round(8 * s), Math.round(2 * s), Math.round(2 * s), Math.round(3 * s));
  g.fillRect(Math.round(22 * s), Math.round(2 * s), Math.round(2 * s), Math.round(3 * s));

  // Iconic sunglasses (small, round)
  g.fillStyle(0x1a1a1a); // Frame
  g.fillRect(Math.round(10 * s), Math.round(5 * s), Math.round(5 * s), Math.round(3 * s));
  g.fillRect(Math.round(17 * s), Math.round(5 * s), Math.round(5 * s), Math.round(3 * s));
  g.fillRect(Math.round(15 * s), Math.round(6 * s), Math.round(2 * s), Math.round(1 * s)); // Bridge

  // Green lens reflection (Matrix style)
  g.fillStyle(0x00ff41, 0.6);
  g.fillRect(Math.round(11 * s), Math.round(6 * s), Math.round(3 * s), Math.round(1 * s));
  g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(3 * s), Math.round(1 * s));

  // Neutral expression
  g.fillStyle(0x000000);
  g.fillRect(Math.round(14 * s), Math.round(10 * s), Math.round(4 * s), Math.round(1 * s));

  // Matrix code rain effect above head (iconic)
  g.fillStyle(0x00ff41, 0.8);
  // Column 1
  g.fillRect(Math.round(8 * s), Math.round(-6 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(8 * s), Math.round(-2 * s), Math.round(2 * s), Math.round(2 * s));
  // Column 2
  g.fillRect(Math.round(14 * s), Math.round(-4 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(14 * s), 0, Math.round(2 * s), Math.round(2 * s));
  // Column 3
  g.fillRect(Math.round(20 * s), Math.round(-6 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(20 * s), Math.round(-2 * s), Math.round(2 * s), Math.round(2 * s));

  // Brighter "lead" characters
  g.fillStyle(0x80ff80);
  g.fillRect(Math.round(8 * s), Math.round(2 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(14 * s), Math.round(-6 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(20 * s), Math.round(2 * s), Math.round(2 * s), Math.round(2 * s));

  g.generateTexture("neo", size, size);
  g.destroy();
}

function generateCJSprite(scene: Phaser.Scene): void {
  // CJ - On-chain hood rat from BagsCity (GTA San Andreas inspired)
  // Bald head, white tank top, blue jeans - iconic Grove Street look
  const s = SCALE;
  const size = Math.round(32 * s);
  const skinTone = 0x6b4423; // Dark brown skin (CJ's actual skin tone)
  const skinHighlight = 0x7d5a3c; // Slightly lighter for depth
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Subtle green glow (Grove Street)
  g.fillStyle(0x00aa00, 0.1);
  g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(20 * s));

  // Shadow
  g.fillStyle(0x000000, 0.4);
  g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

  // Legs (blue jeans - lighter blue like in GTA)
  g.fillStyle(0x4a6fa5); // Medium blue denim
  g.fillRect(Math.round(9 * s), Math.round(20 * s), Math.round(6 * s), Math.round(11 * s));
  g.fillRect(Math.round(17 * s), Math.round(20 * s), Math.round(6 * s), Math.round(11 * s));
  // Slightly darker for depth
  g.fillStyle(0x3d5a87);
  g.fillRect(Math.round(9 * s), Math.round(20 * s), Math.round(1 * s), Math.round(11 * s));
  g.fillRect(Math.round(22 * s), Math.round(20 * s), Math.round(1 * s), Math.round(11 * s));

  // Belt area (brown belt)
  g.fillStyle(0x3d2817);
  g.fillRect(Math.round(8 * s), Math.round(19 * s), Math.round(16 * s), Math.round(2 * s));
  // Belt buckle
  g.fillStyle(0x888888);
  g.fillRect(Math.round(14 * s), Math.round(19 * s), Math.round(4 * s), Math.round(2 * s));

  // Shoes (black sneakers)
  g.fillStyle(0x1a1a1a);
  g.fillRect(Math.round(8 * s), Math.round(29 * s), Math.round(7 * s), Math.round(3 * s));
  g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(7 * s), Math.round(3 * s));

  // White tank top (wife beater - THE iconic CJ look)
  g.fillStyle(0xffffff);
  g.fillRect(Math.round(8 * s), Math.round(11 * s), Math.round(16 * s), Math.round(9 * s));
  // Tank top straps
  g.fillRect(Math.round(10 * s), Math.round(9 * s), Math.round(3 * s), Math.round(3 * s));
  g.fillRect(Math.round(19 * s), Math.round(9 * s), Math.round(3 * s), Math.round(3 * s));
  // Tank top shadow/fold
  g.fillStyle(0xe8e8e8);
  g.fillRect(Math.round(8 * s), Math.round(15 * s), Math.round(16 * s), Math.round(1 * s));

  // Muscular arms (skin)
  g.fillStyle(skinTone);
  g.fillRect(Math.round(4 * s), Math.round(11 * s), Math.round(5 * s), Math.round(10 * s));
  g.fillRect(Math.round(23 * s), Math.round(11 * s), Math.round(5 * s), Math.round(10 * s));
  // Arm highlights
  g.fillStyle(skinHighlight);
  g.fillRect(Math.round(5 * s), Math.round(12 * s), Math.round(2 * s), Math.round(4 * s));
  g.fillRect(Math.round(24 * s), Math.round(12 * s), Math.round(2 * s), Math.round(4 * s));
  // Hands
  g.fillStyle(skinTone);
  g.fillRect(Math.round(4 * s), Math.round(20 * s), Math.round(4 * s), Math.round(3 * s));
  g.fillRect(Math.round(24 * s), Math.round(20 * s), Math.round(4 * s), Math.round(3 * s));

  // BALD HEAD (no hair!)
  g.fillStyle(skinTone);
  g.fillRect(Math.round(9 * s), Math.round(1 * s), Math.round(14 * s), Math.round(10 * s));
  // Head shape - rounded top
  g.fillRect(Math.round(10 * s), Math.round(0 * s), Math.round(12 * s), Math.round(2 * s));
  // Head highlight (bald shine)
  g.fillStyle(skinHighlight);
  g.fillRect(Math.round(12 * s), Math.round(1 * s), Math.round(6 * s), Math.round(2 * s));

  // Ears
  g.fillStyle(skinTone);
  g.fillRect(Math.round(8 * s), Math.round(4 * s), Math.round(2 * s), Math.round(3 * s));
  g.fillRect(Math.round(22 * s), Math.round(4 * s), Math.round(2 * s), Math.round(3 * s));

  // Eyes (whites)
  g.fillStyle(0xffffff);
  g.fillRect(Math.round(11 * s), Math.round(4 * s), Math.round(4 * s), Math.round(2 * s));
  g.fillRect(Math.round(17 * s), Math.round(4 * s), Math.round(4 * s), Math.round(2 * s));
  // Pupils (dark brown)
  g.fillStyle(0x2d1f14);
  g.fillRect(Math.round(13 * s), Math.round(4 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(18 * s), Math.round(4 * s), Math.round(2 * s), Math.round(2 * s));

  // Eyebrows (subtle)
  g.fillStyle(0x2d1f14);
  g.fillRect(Math.round(11 * s), Math.round(3 * s), Math.round(4 * s), Math.round(1 * s));
  g.fillRect(Math.round(17 * s), Math.round(3 * s), Math.round(4 * s), Math.round(1 * s));

  // Nose
  g.fillStyle(0x5a3d1f);
  g.fillRect(Math.round(14 * s), Math.round(5 * s), Math.round(4 * s), Math.round(2 * s));

  // Mouth/slight frown
  g.fillStyle(0x4a3020);
  g.fillRect(Math.round(13 * s), Math.round(8 * s), Math.round(6 * s), Math.round(1 * s));

  // Goatee (small)
  g.fillStyle(0x1a1a1a);
  g.fillRect(Math.round(14 * s), Math.round(9 * s), Math.round(4 * s), Math.round(1 * s));

  g.generateTexture("cj", size, size);
  g.destroy();
}

function generateShawSprite(scene: Phaser.Scene): void {
  // Shaw - ElizaOS creator (@shawmakesmagic)
  // Based on reference: dark messy hair, teal sunglasses, pink tie-dye shirt, dark pants
  const s = SCALE;
  const size = Math.round(32 * s);
  const skinTone = 0xdeb896; // Warm skin tone
  const skinHighlight = 0xf0c8a0;
  const g = scene.make.graphics({ x: 0, y: 0 });

  // ai16z purple digital glow behind Shaw
  g.fillStyle(0x9333ea, 0.15);
  g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
  g.fillStyle(0xec4899, 0.1); // Pink accent
  g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

  // Shadow
  g.fillStyle(0x000000, 0.4);
  g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

  // Legs (dark gray/black pants)
  g.fillStyle(0x1a1a2e);
  g.fillRect(Math.round(10 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));
  g.fillRect(Math.round(17 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));
  // Pant highlights
  g.fillStyle(0x2a2a3e);
  g.fillRect(Math.round(10 * s), Math.round(21 * s), Math.round(2 * s), Math.round(10 * s));
  g.fillRect(Math.round(17 * s), Math.round(21 * s), Math.round(2 * s), Math.round(10 * s));

  // Shoes (blue/white sneakers like reference)
  g.fillStyle(0x3b82f6); // Blue base
  g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
  g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
  // White sole
  g.fillStyle(0xffffff);
  g.fillRect(Math.round(9 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));
  g.fillRect(Math.round(17 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));

  // Pink tie-dye shirt (matching reference)
  g.fillStyle(0xec4899); // Hot pink base
  g.fillRect(Math.round(7 * s), Math.round(11 * s), Math.round(18 * s), Math.round(11 * s));
  // Tie-dye swirl patterns
  g.fillStyle(0xf472b6); // Lighter pink
  g.fillRect(Math.round(9 * s), Math.round(13 * s), Math.round(4 * s), Math.round(3 * s));
  g.fillRect(Math.round(17 * s), Math.round(16 * s), Math.round(5 * s), Math.round(3 * s));
  g.fillRect(Math.round(11 * s), Math.round(18 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillStyle(0xfda4af); // Even lighter pink/peach
  g.fillRect(Math.round(14 * s), Math.round(14 * s), Math.round(4 * s), Math.round(2 * s));
  g.fillRect(Math.round(8 * s), Math.round(17 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillStyle(0xfb7185); // Rose
  g.fillRect(Math.round(19 * s), Math.round(12 * s), Math.round(3 * s), Math.round(3 * s));
  g.fillRect(Math.round(10 * s), Math.round(19 * s), Math.round(4 * s), Math.round(2 * s));

  // Arms (skin)
  g.fillStyle(skinTone);
  g.fillRect(Math.round(4 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
  g.fillRect(Math.round(24 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
  // Arm highlights
  g.fillStyle(skinHighlight);
  g.fillRect(Math.round(5 * s), Math.round(13 * s), Math.round(2 * s), Math.round(4 * s));
  g.fillRect(Math.round(25 * s), Math.round(13 * s), Math.round(2 * s), Math.round(4 * s));
  // Hands
  g.fillStyle(skinTone);
  g.fillRect(Math.round(4 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillRect(Math.round(25 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));

  // Head
  g.fillStyle(skinTone);
  g.fillRect(Math.round(9 * s), Math.round(3 * s), Math.round(14 * s), Math.round(10 * s));
  // Face highlight
  g.fillStyle(skinHighlight);
  g.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(4 * s), Math.round(3 * s));

  // Dark messy hair (matching reference - fuller, messier)
  g.fillStyle(0x1a1a1a); // Very dark
  // Main hair mass
  g.fillRect(Math.round(7 * s), Math.round(-1 * s), Math.round(18 * s), Math.round(7 * s));
  // Side hair going down (messy look)
  g.fillRect(Math.round(6 * s), Math.round(1 * s), Math.round(3 * s), Math.round(7 * s));
  g.fillRect(Math.round(23 * s), Math.round(1 * s), Math.round(3 * s), Math.round(7 * s));
  // Messy bangs
  g.fillRect(Math.round(8 * s), Math.round(4 * s), Math.round(2 * s), Math.round(3 * s));
  g.fillRect(Math.round(22 * s), Math.round(4 * s), Math.round(2 * s), Math.round(3 * s));
  // Hair texture highlights
  g.fillStyle(0x2d2d3d);
  g.fillRect(Math.round(10 * s), Math.round(0 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillRect(Math.round(17 * s), Math.round(-1 * s), Math.round(4 * s), Math.round(2 * s));
  g.fillRect(Math.round(7 * s), Math.round(3 * s), Math.round(2 * s), Math.round(2 * s));

  // Teal/cyan sunglasses (signature look - larger like reference)
  g.fillStyle(0x0d9488); // Teal frame
  g.fillRect(Math.round(9 * s), Math.round(5 * s), Math.round(6 * s), Math.round(4 * s));
  g.fillRect(Math.round(17 * s), Math.round(5 * s), Math.round(6 * s), Math.round(4 * s));
  g.fillRect(Math.round(15 * s), Math.round(6 * s), Math.round(2 * s), Math.round(2 * s)); // Bridge
  // Lens (bright cyan/teal)
  g.fillStyle(0x22d3d1); // Bright teal
  g.fillRect(Math.round(10 * s), Math.round(6 * s), Math.round(4 * s), Math.round(2 * s));
  g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(4 * s), Math.round(2 * s));
  // Lens reflection/shine
  g.fillStyle(0x5eead4);
  g.fillRect(Math.round(10 * s), Math.round(6 * s), Math.round(2 * s), Math.round(1 * s));
  g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(2 * s), Math.round(1 * s));

  // Small neutral mouth
  g.fillStyle(0x8b6b5a);
  g.fillRect(Math.round(13 * s), Math.round(10 * s), Math.round(6 * s), Math.round(1 * s));

  g.generateTexture("shaw", size, size);
  g.destroy();
}

function createCharacterSprite(
  scene: Phaser.Scene,
  key: string,
  skinTone: number,
  hairColor: number,
  shirtColor: number,
  mood: "neutral" | "happy" | "sad" | "celebrating"
): void {
  const s = SCALE;
  const size = Math.round(32 * s);
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Ground shadow (more defined)
  g.fillStyle(PALETTE.void, 0.3);
  g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(12 * s), Math.round(4 * s));

  // Legs with shading
  const pantsColor = PALETTE.navy;
  g.fillStyle(pantsColor);
  g.fillRect(Math.round(10 * s), Math.round(22 * s), Math.round(5 * s), Math.round(9 * s));
  g.fillRect(Math.round(17 * s), Math.round(22 * s), Math.round(5 * s), Math.round(9 * s));
  // Leg highlight (left side catches light)
  g.fillStyle(lighten(pantsColor, 0.15));
  g.fillRect(Math.round(10 * s), Math.round(22 * s), Math.round(2 * s), Math.round(9 * s));
  g.fillRect(Math.round(17 * s), Math.round(22 * s), Math.round(2 * s), Math.round(9 * s));
  // Inner leg shadow
  g.fillStyle(darken(pantsColor, 0.2));
  g.fillRect(Math.round(14 * s), Math.round(22 * s), Math.round(1 * s), Math.round(9 * s));

  // Shoes with shading
  g.fillStyle(PALETTE.darkGray);
  g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
  g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
  // Shoe highlight
  g.fillStyle(lighten(PALETTE.darkGray, 0.2));
  g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(3 * s), Math.round(1 * s));
  g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(3 * s), Math.round(1 * s));

  // Body/Shirt with proper shading
  let activeShirtColor = shirtColor;
  if (mood === "celebrating") {
    activeShirtColor = PALETTE.gold;
  } else if (mood === "sad") {
    activeShirtColor = PALETTE.lightGray;
  }
  g.fillStyle(activeShirtColor);
  g.fillRect(Math.round(8 * s), Math.round(12 * s), Math.round(16 * s), Math.round(12 * s));
  // Shirt highlight (left side)
  g.fillStyle(lighten(activeShirtColor, 0.2));
  g.fillRect(Math.round(8 * s), Math.round(12 * s), Math.round(4 * s), Math.round(12 * s));
  // Shirt shadow (right side)
  g.fillStyle(darken(activeShirtColor, 0.2));
  g.fillRect(Math.round(20 * s), Math.round(12 * s), Math.round(4 * s), Math.round(12 * s));
  // Collar detail
  g.fillStyle(darken(activeShirtColor, 0.15));
  g.fillRect(Math.round(12 * s), Math.round(12 * s), Math.round(8 * s), Math.round(2 * s));

  // Arms with shading
  g.fillStyle(skinTone);
  if (mood === "celebrating") {
    // Arms up
    g.fillRect(Math.round(5 * s), Math.round(6 * s), Math.round(4 * s), Math.round(8 * s));
    g.fillRect(Math.round(23 * s), Math.round(6 * s), Math.round(4 * s), Math.round(8 * s));
    // Arm highlights
    g.fillStyle(lighten(skinTone, 0.15));
    g.fillRect(Math.round(5 * s), Math.round(6 * s), Math.round(2 * s), Math.round(8 * s));
    g.fillRect(Math.round(23 * s), Math.round(6 * s), Math.round(2 * s), Math.round(8 * s));
  } else {
    // Arms down
    g.fillRect(Math.round(5 * s), Math.round(13 * s), Math.round(4 * s), Math.round(10 * s));
    g.fillRect(Math.round(23 * s), Math.round(13 * s), Math.round(4 * s), Math.round(10 * s));
    // Arm highlights
    g.fillStyle(lighten(skinTone, 0.15));
    g.fillRect(Math.round(5 * s), Math.round(13 * s), Math.round(2 * s), Math.round(10 * s));
    g.fillRect(Math.round(23 * s), Math.round(13 * s), Math.round(2 * s), Math.round(10 * s));
  }

  // Head with shading
  g.fillStyle(skinTone);
  g.fillRect(Math.round(9 * s), Math.round(2 * s), Math.round(14 * s), Math.round(12 * s));
  // Face highlight (forehead/left cheek)
  g.fillStyle(lighten(skinTone, 0.12));
  g.fillRect(Math.round(9 * s), Math.round(2 * s), Math.round(5 * s), Math.round(5 * s));
  // Face shadow (right side)
  g.fillStyle(darken(skinTone, 0.1));
  g.fillRect(Math.round(20 * s), Math.round(4 * s), Math.round(3 * s), Math.round(8 * s));

  // Hair with shading
  g.fillStyle(hairColor);
  g.fillRect(Math.round(9 * s), Math.round(1 * s), Math.round(14 * s), Math.round(5 * s));
  g.fillRect(Math.round(8 * s), Math.round(3 * s), Math.round(2 * s), Math.round(4 * s));
  g.fillRect(Math.round(22 * s), Math.round(3 * s), Math.round(2 * s), Math.round(4 * s));
  // Hair highlight
  g.fillStyle(lighten(hairColor, 0.25));
  g.fillRect(Math.round(10 * s), Math.round(1 * s), Math.round(4 * s), Math.round(2 * s));
  // Hair shadow
  g.fillStyle(darken(hairColor, 0.2));
  g.fillRect(Math.round(19 * s), Math.round(2 * s), Math.round(4 * s), Math.round(3 * s));

  // Eyes with highlight
  g.fillStyle(PALETTE.white);
  g.fillRect(Math.round(11 * s), Math.round(6 * s), Math.round(4 * s), Math.round(3 * s));
  g.fillRect(Math.round(17 * s), Math.round(6 * s), Math.round(4 * s), Math.round(3 * s));

  // Pupils
  g.fillStyle(PALETTE.void);
  if (mood === "sad") {
    g.fillRect(Math.round(12 * s), Math.round(7 * s), Math.round(2 * s), Math.round(2 * s));
    g.fillRect(Math.round(18 * s), Math.round(7 * s), Math.round(2 * s), Math.round(2 * s));
  } else {
    g.fillRect(Math.round(13 * s), Math.round(6 * s), Math.round(2 * s), Math.round(2 * s));
    g.fillRect(Math.round(19 * s), Math.round(6 * s), Math.round(2 * s), Math.round(2 * s));
  }
  // Eye highlights (small white dot)
  g.fillStyle(PALETTE.white);
  g.fillRect(Math.round(13 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));
  g.fillRect(Math.round(19 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));

  // Mouth
  if (mood === "happy" || mood === "celebrating") {
    g.fillStyle(PALETTE.void);
    g.fillRect(Math.round(13 * s), Math.round(10 * s), Math.round(6 * s), Math.round(1 * s));
    g.fillRect(Math.round(12 * s), Math.round(9 * s), Math.round(1 * s), Math.round(1 * s));
    g.fillRect(Math.round(19 * s), Math.round(9 * s), Math.round(1 * s), Math.round(1 * s));
  } else if (mood === "sad") {
    g.fillStyle(PALETTE.void);
    g.fillRect(Math.round(13 * s), Math.round(11 * s), Math.round(6 * s), Math.round(1 * s));
    g.fillRect(Math.round(12 * s), Math.round(10 * s), Math.round(1 * s), Math.round(1 * s));
    g.fillRect(Math.round(19 * s), Math.round(10 * s), Math.round(1 * s), Math.round(1 * s));
  } else {
    g.fillStyle(PALETTE.void);
    g.fillRect(Math.round(14 * s), Math.round(10 * s), Math.round(4 * s), Math.round(1 * s));
  }

  // Blush for happy (rosy cheeks)
  if (mood === "happy" || mood === "celebrating") {
    g.fillStyle(0xffaaaa, 0.4);
    g.fillRect(Math.round(10 * s), Math.round(8 * s), Math.round(2 * s), Math.round(2 * s));
    g.fillRect(Math.round(20 * s), Math.round(8 * s), Math.round(2 * s), Math.round(2 * s));
  }

  g.generateTexture(key, size, size);
  g.destroy();
}
