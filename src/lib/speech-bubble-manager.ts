// Speech Bubble Manager - Renders speech bubbles above characters in Phaser
// Works with the autonomous dialogue system to show character conversations

import type { DialogueLine } from "./autonomous-dialogue";
import { characterMeta } from "@/characters";

export interface SpeechBubble {
  id: string;
  characterId: string;
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
  nameTag: Phaser.GameObjects.Text;
  tail: Phaser.GameObjects.Graphics;
  fadeOutTimer?: Phaser.Time.TimerEvent;
}

export interface BubbleConfig {
  maxWidth: number;
  padding: number;
  fontSize: number;
  backgroundColor: number;
  textColor: string;
  borderColor: number;
  borderWidth: number;
  cornerRadius: number;
  tailHeight: number;
  fadeInDuration: number;
  fadeOutDuration: number;
  displayDuration: number;
  yOffset: number;
}

const DEFAULT_CONFIG: BubbleConfig = {
  maxWidth: 220, // Wider for better readability
  padding: 12, // More padding
  fontSize: 13, // Larger font for visibility
  backgroundColor: 0x1a1a2e,
  textColor: "#ffffff",
  borderColor: 0x4ade80,
  borderWidth: 3, // Thicker border
  cornerRadius: 10,
  tailHeight: 10,
  fadeInDuration: 150, // Faster fade in
  fadeOutDuration: 250, // Faster fade out
  displayDuration: 3500, // Slightly shorter to match dialogue timing
  yOffset: -60, // Higher above character
};

// Character-specific bubble colors - VIBRANT for visibility
const CHARACTER_COLORS: Record<string, { bg: number; border: number; text: string }> = {
  finn: { bg: 0x0a1f0a, border: 0x22c55e, text: "#4ade80" }, // Bright emerald
  ghost: { bg: 0x0f0f1f, border: 0xa78bfa, text: "#c4b5fd" }, // Bright purple
  neo: { bg: 0x001a00, border: 0x00ff55, text: "#00ff55" }, // Bright matrix green
  ash: { bg: 0x1f0a0a, border: 0xf87171, text: "#fca5a5" }, // Bright Pokemon red
  "bags-bot": { bg: 0x1f1a00, border: 0xfbbf24, text: "#fde047" }, // Bright amber
  cj: { bg: 0x1f1000, border: 0xfb923c, text: "#fdba74" }, // Bright Grove Street orange
  toly: { bg: 0x1a0a1f, border: 0xa855f7, text: "#c084fc" }, // Bright purple for Toly
  shaw: { bg: 0x1f1408, border: 0xff5800, text: "#ffb380" }, // ai16z purple for Shaw
};

export class SpeechBubbleManager {
  private scene: Phaser.Scene;
  private bubbles: Map<string, SpeechBubble> = new Map();
  private config: BubbleConfig;
  private characterSprites: Map<string, Phaser.GameObjects.Sprite>;

  constructor(
    scene: Phaser.Scene,
    characterSprites: Map<string, Phaser.GameObjects.Sprite>,
    config: Partial<BubbleConfig> = {}
  ) {
    this.scene = scene;
    this.characterSprites = characterSprites;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Show a speech bubble for a character
   * Only ONE bubble shows at a time - hides all others first
   */
  showBubble(line: DialogueLine, characterSpriteId?: string): SpeechBubble | null {
    const { characterId, characterName, message } = line;

    // Find the character sprite
    // Special characters have IDs that match their character names
    const spriteId = characterSpriteId || this.findCharacterSpriteId(characterId);
    const sprite = spriteId ? this.characterSprites.get(spriteId) : null;

    if (!sprite) {
      console.log(`[SpeechBubble] No sprite found for character: ${characterId}`);
      return null;
    }

    // Hide ALL existing bubbles - only one character speaks at a time
    this.hideAllBubbles();

    // Get character-specific colors
    const colors = CHARACTER_COLORS[characterId] || {
      bg: this.config.backgroundColor,
      border: this.config.borderColor,
      text: this.config.textColor,
    };

    // Create container
    const container = this.scene.add.container(sprite.x, sprite.y + this.config.yOffset);
    container.setDepth(200); // Above everything

    // Create background graphics
    const background = this.scene.add.graphics();

    // Create text
    const text = this.scene.add.text(0, 0, message, {
      fontFamily: "monospace",
      fontSize: `${this.config.fontSize}px`,
      color: colors.text,
      wordWrap: { width: this.config.maxWidth - this.config.padding * 2 },
      align: "left",
    });
    text.setOrigin(0.5, 0.5);

    // Calculate bubble size
    const textWidth = Math.min(text.width + this.config.padding * 2, this.config.maxWidth);
    const textHeight = text.height + this.config.padding * 2;

    // Draw background
    background.fillStyle(colors.bg, 0.95);
    background.lineStyle(this.config.borderWidth, colors.border, 1);

    // Rounded rectangle
    const x = -textWidth / 2;
    const y = -textHeight / 2;
    background.fillRoundedRect(x, y, textWidth, textHeight, this.config.cornerRadius);
    background.strokeRoundedRect(x, y, textWidth, textHeight, this.config.cornerRadius);

    // Draw tail (pointing down to character)
    const tail = this.scene.add.graphics();
    tail.fillStyle(colors.bg, 0.95);
    tail.lineStyle(this.config.borderWidth, colors.border, 1);

    const tailWidth = 10;
    const tailY = textHeight / 2;
    tail.beginPath();
    tail.moveTo(-tailWidth / 2, tailY - 2);
    tail.lineTo(0, tailY + this.config.tailHeight);
    tail.lineTo(tailWidth / 2, tailY - 2);
    tail.closePath();
    tail.fillPath();
    tail.strokePath();

    // Create name tag
    const meta = characterMeta[characterId];
    const nameTag = this.scene.add.text(
      0,
      -textHeight / 2 - 12,
      meta?.displayName || characterName,
      {
        fontFamily: "monospace",
        fontSize: "9px",
        color: colors.text,
        backgroundColor: `#${colors.bg.toString(16).padStart(6, "0")}`,
        padding: { x: 4, y: 2 },
      }
    );
    nameTag.setOrigin(0.5, 0.5);

    // Add icon
    if (meta?.icon) {
      nameTag.setText(`${meta.icon} ${nameTag.text}`);
    }

    // Add to container
    container.add([background, tail, text, nameTag]);

    // Start hidden
    container.setAlpha(0);

    // Fade in
    this.scene.tweens.add({
      targets: container,
      alpha: 1,
      y: sprite.y + this.config.yOffset - 10,
      duration: this.config.fadeInDuration,
      ease: "Back.easeOut",
    });

    // Store bubble
    const bubble: SpeechBubble = {
      id: `bubble_${characterId}_${Date.now()}`,
      characterId,
      container,
      background,
      text,
      nameTag,
      tail,
    };

    // Schedule fade out
    bubble.fadeOutTimer = this.scene.time.delayedCall(this.config.displayDuration, () =>
      this.hideBubble(characterId)
    );

    this.bubbles.set(characterId, bubble);

    console.log(
      `[SpeechBubble] Showing bubble for ${characterId}: "${message.substring(0, 30)}..."`
    );

    return bubble;
  }

  /**
   * Hide a speech bubble
   */
  hideBubble(characterId: string): void {
    const bubble = this.bubbles.get(characterId);
    if (!bubble) return;

    // Cancel scheduled fade out
    if (bubble.fadeOutTimer) {
      bubble.fadeOutTimer.destroy();
    }

    // Fade out
    this.scene.tweens.add({
      targets: bubble.container,
      alpha: 0,
      y: bubble.container.y - 10,
      duration: this.config.fadeOutDuration,
      ease: "Back.easeIn",
      onComplete: () => {
        bubble.container.destroy();
        this.bubbles.delete(characterId);
      },
    });
  }

  /**
   * Hide all bubbles
   */
  hideAllBubbles(): void {
    this.bubbles.forEach((_, characterId) => {
      this.hideBubble(characterId);
    });
  }

  /**
   * Update bubble positions to follow characters
   */
  update(): void {
    this.bubbles.forEach((bubble, characterId) => {
      const spriteId = this.findCharacterSpriteId(characterId);
      const sprite = spriteId ? this.characterSprites.get(spriteId) : null;

      if (sprite && bubble.container.active) {
        // Smoothly follow character
        const targetX = sprite.x;
        const targetY = sprite.y + this.config.yOffset - 10;

        bubble.container.x += (targetX - bubble.container.x) * 0.3;
        bubble.container.y += (targetY - bubble.container.y) * 0.3;
      }
    });
  }

  /**
   * Find sprite ID for a character
   * Special characters use their character ID directly
   */
  private findCharacterSpriteId(characterId: string): string | null {
    // Check if any sprite has the special character flag
    for (const [spriteId, sprite] of this.characterSprites) {
      const spriteData = sprite as any;

      // Check special character flags
      if (characterId === "finn" && spriteData.isFinn) return spriteId;
      if (characterId === "ghost" && spriteData.isDev) return spriteId;
      if (characterId === "neo" && spriteData.isScout) return spriteId;
      if (characterId === "ash" && spriteData.isAsh) return spriteId;
      if (characterId === "toly" && spriteData.isToly) return spriteId;
      if (characterId === "cj" && spriteData.isCJ) return spriteId;
      if (characterId === "shaw" && spriteData.isShaw) return spriteId;
      if (characterId === "bags-bot") {
        // Bags bot doesn't have a sprite, use Toly as fallback
        if (spriteData.isToly) return spriteId;
      }

      // Direct ID match
      if (spriteId === characterId) return spriteId;
    }

    return null;
  }

  /**
   * Update the character sprites reference
   */
  setCharacterSprites(sprites: Map<string, Phaser.GameObjects.Sprite>): void {
    this.characterSprites = sprites;
  }

  /**
   * Get active bubble count
   */
  getActiveBubbleCount(): number {
    return this.bubbles.size;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.hideAllBubbles();
    this.bubbles.clear();
  }
}

// ============================================================================
// HELPER: Map character IDs to sprite finder functions
// ============================================================================

export function getCharacterSpriteKey(characterId: string): {
  flag: string;
  fallback?: string;
} {
  switch (characterId) {
    case "finn":
      return { flag: "isFinn" };
    case "ghost":
      return { flag: "isDev" };
    case "neo":
      return { flag: "isScout" };
    case "ash":
      return { flag: "isAsh" };
    case "cj":
      return { flag: "isCJ" };
    case "shaw":
      return { flag: "isShaw" };
    case "bags-bot":
      return { flag: "isToly", fallback: "toly" }; // Use Toly sprite for Bags Bot
    default:
      return { flag: characterId };
  }
}
