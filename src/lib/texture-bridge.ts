// Texture Bridge — Extract Phaser-generated textures to data URLs for React components
// Phaser generates all sprites programmatically in BootScene.
// This bridge converts them to data URLs so the EncounterOverlay (React) can use them.

const textureCache: Map<string, string> = new Map();
let extracted = false;

const BATTLE_TEXTURE_KEYS = [
  // Animals (main_city encounters)
  "dog",
  "cat",
  "bird",
  "butterfly",
  "squirrel",
  // Pokemon (founders encounters)
  "pokemon_charmander",
  "pokemon_squirtle",
  "pokemon_bulbasaur",
  // Arena fighters — creature variants (moltbook encounters) — idle pose
  "fighter_9_idle_fight",
  "fighter_10_idle_fight",
  "fighter_11_idle_fight",
  "fighter_13_idle_fight",
  "fighter_14_idle_fight",
  // Arena fighters — attack pose (for attack animation)
  "fighter_9_attack",
  "fighter_10_attack",
  "fighter_11_attack",
  "fighter_13_attack",
  "fighter_14_attack",
  // Arena fighters — hurt pose
  "fighter_9_hurt",
  "fighter_10_hurt",
  "fighter_11_hurt",
  "fighter_13_hurt",
  "fighter_14_hurt",
  // Player character variants (0-8)
  "character_0",
  "character_1",
  "character_2",
  "character_3",
  "character_4",
  "character_5",
  "character_6",
  "character_7",
  "character_8",
];

function extractTextureToDataUrl(
  scene: {
    textures: {
      get: (key: string) => {
        source?: Array<{
          image: HTMLCanvasElement | HTMLImageElement;
          width: number;
          height: number;
        }>;
      };
    };
  },
  key: string
): string | null {
  try {
    const texture = scene.textures.get(key);
    if (!texture?.source?.[0]) return null;

    const source = texture.source[0];
    let canvas: HTMLCanvasElement;

    if (source.image instanceof HTMLCanvasElement) {
      canvas = source.image;
    } else if (source.image instanceof HTMLImageElement) {
      canvas = document.createElement("canvas");
      canvas.width = source.width;
      canvas.height = source.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(source.image, 0, 0);
    } else {
      return null;
    }

    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

/** Call from WorldScene.create() after BootScene has generated all textures */
export function extractBattleTextures(scene: {
  textures: { get: (key: string) => unknown };
}): void {
  if (extracted) return;

  for (const key of BATTLE_TEXTURE_KEYS) {
    const dataUrl = extractTextureToDataUrl(
      scene as Parameters<typeof extractTextureToDataUrl>[0],
      key
    );
    if (dataUrl) {
      textureCache.set(key, dataUrl);
    }
  }

  extracted = true;
  console.log(
    `[TextureBridge] Extracted ${textureCache.size}/${BATTLE_TEXTURE_KEYS.length} battle textures`
  );
}

/** Get a texture as a data URL for use in React <img> tags */
export function getTextureDataUrl(key: string): string | null {
  return textureCache.get(key) ?? null;
}

/** Get the player's character sprite data URL based on their variant */
export function getPlayerSpriteUrl(): string | null {
  // Read from the game store or localStorage which variant the player chose
  // Default to character_0 if unknown
  const variant = (window as unknown as Record<string, unknown>).__bagsworld_player_variant ?? 0;
  return getTextureDataUrl(`character_${variant}`);
}

/** Map creature spriteKey to the correct texture key for battle display.
 *  Arena fighters need the _idle_fight suffix, animals/pokemon use the key directly. */
export function getCreatureBattleSpriteUrl(spriteKey: string): string | null {
  // Direct match first (animals, pokemon)
  const direct = getTextureDataUrl(spriteKey);
  if (direct) return direct;

  // Arena fighter — try idle_fight pose
  const idle = getTextureDataUrl(`${spriteKey}_idle_fight`);
  if (idle) return idle;

  return null;
}
