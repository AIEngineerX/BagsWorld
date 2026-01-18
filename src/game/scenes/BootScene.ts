import * as Phaser from "phaser";

// Skin tone palette for diversity
const SKIN_TONES = [
  0xffdbac, // Light
  0xf1c27d, // Light tan
  0xe0ac69, // Tan
  0xc68642, // Medium
  0x8d5524, // Brown
  0x5c3317, // Dark brown
];

// Hair colors
const HAIR_COLORS = [
  0x090806, // Black
  0x2c1810, // Dark brown
  0x6a4e42, // Brown
  0xb55239, // Auburn
  0xd6c4c2, // Blonde
  0xe5e5e5, // White/Gray
  0xff6b6b, // Pink (dyed)
  0x4ecdc4, // Teal (dyed)
  0xa855f7, // Purple (dyed)
];

// Shirt colors
const SHIRT_COLORS = [
  0x4ade80, // Green (Bags green)
  0x3b82f6, // Blue
  0xef4444, // Red
  0xfbbf24, // Gold
  0xa855f7, // Purple
  0xec4899, // Pink
  0x06b6d4, // Cyan
  0xf97316, // Orange
  0x6b7280, // Gray
];

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Create stylish loading screen
    const loadingBg = this.add.graphics();
    loadingBg.fillGradientStyle(0x0a0a0f, 0x0a0a0f, 0x1a1a2e, 0x1a1a2e, 1);
    loadingBg.fillRect(0, 0, width, height);

    // Logo text
    const logoText = this.add.text(width / 2, height / 2 - 80, "BAGSWORLD", {
      fontFamily: "monospace",
      fontSize: "32px",
      color: "#4ade80",
    });
    logoText.setOrigin(0.5, 0.5);

    // Subtitle
    const subText = this.add.text(width / 2, height / 2 - 45, "A Living Crypto World", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#6b7280",
    });
    subText.setOrigin(0.5, 0.5);

    // Progress bar container
    const progressBox = this.add.graphics();
    progressBox.lineStyle(2, 0x4ade80, 1);
    progressBox.strokeRect(width / 2 - 150, height / 2, 300, 20);

    const progressBar = this.add.graphics();

    // Loading text
    const loadingText = this.add.text(width / 2, height / 2 + 40, "Generating world...", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#4ade80",
    });
    loadingText.setOrigin(0.5, 0.5);

    // Progress events
    this.load.on("progress", (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x4ade80, 1);
      progressBar.fillRect(width / 2 - 148, height / 2 + 2, 296 * value, 16);
    });

    this.load.on("complete", () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
      logoText.destroy();
      subText.destroy();
      loadingBg.destroy();
    });

    this.generatePlaceholderAssets();
  }

  create(): void {
    this.scene.start("WorldScene");
    this.scene.start("UIScene");
  }

  private generatePlaceholderAssets(): void {
    // Generate enhanced grass with flowers
    this.generateGrass();

    // Generate path tiles
    this.generatePath();

    // Generate diverse buildings (levels 1-5)
    this.generateBuildings();

    // Generate special buildings
    this.generatePokeCenter();

    // Generate diverse character variants
    this.generateDiverseCharacters();

    // Generate weather particles
    this.generateWeatherAssets();

    // Generate UI elements
    this.generateUIAssets();

    // Generate trees and decorations
    this.generateDecorations();

    // Generate animals
    this.generateAnimals();

    // Generate extra decorations (flowers, rocks, fountain, etc.)
    this.generateExtraDecorations();

    // Generate ambient particles
    this.generateAmbientParticles();
  }

  private generateGrass(): void {
    const grassGraphics = this.make.graphics({ x: 0, y: 0 });

    // Base grass
    grassGraphics.fillStyle(0x1a472a);
    grassGraphics.fillRect(0, 0, 32, 32);

    // Grass variation
    grassGraphics.fillStyle(0x2d5a3d);
    for (let i = 0; i < 12; i++) {
      const x = Math.floor(Math.random() * 28);
      const y = Math.floor(Math.random() * 28);
      grassGraphics.fillRect(x, y, 2, 4);
    }

    // Occasional flowers
    grassGraphics.fillStyle(0xfbbf24);
    grassGraphics.fillRect(8, 12, 2, 2);
    grassGraphics.fillStyle(0xef4444);
    grassGraphics.fillRect(20, 8, 2, 2);

    grassGraphics.generateTexture("grass", 32, 32);
    grassGraphics.destroy();

    // Dark grass variant
    const darkGrass = this.make.graphics({ x: 0, y: 0 });
    darkGrass.fillStyle(0x14532d);
    darkGrass.fillRect(0, 0, 32, 32);
    darkGrass.fillStyle(0x1a472a);
    for (let i = 0; i < 8; i++) {
      const x = Math.floor(Math.random() * 28);
      const y = Math.floor(Math.random() * 28);
      darkGrass.fillRect(x, y, 3, 3);
    }
    darkGrass.generateTexture("grass_dark", 32, 32);
    darkGrass.destroy();
  }

  private generatePath(): void {
    const pathGraphics = this.make.graphics({ x: 0, y: 0 });
    pathGraphics.fillStyle(0x78716c);
    pathGraphics.fillRect(0, 0, 32, 32);
    pathGraphics.fillStyle(0x57534e);
    for (let i = 0; i < 6; i++) {
      const x = Math.floor(Math.random() * 24);
      const y = Math.floor(Math.random() * 24);
      pathGraphics.fillRect(x, y, 6, 6);
    }
    pathGraphics.generateTexture("path", 32, 32);
    pathGraphics.destroy();
  }

  private generateBuildings(): void {
    // Building styles by level - each level has a distinct architectural style
    // Level 1: Small shop/startup (<$100K market cap) - Cozy shop
    // Level 2: Growing business ($100K-$500K) - Office building
    // Level 3: Established company ($500K-$2M) - Corporate HQ
    // Level 4: Major token ($2M-$10M) - Modern tower
    // Level 5: Top tier empire ($10M+) - BagsWorld Skyscraper
    const buildingConfigs = [
      { base: 0x8b5cf6, roof: 0xfbbf24, accent: 0xfbbf24, height: 40, width: 30, style: "shop" },      // Level 1: Purple shop with gold roof
      { base: 0x3b82f6, roof: 0x1e40af, accent: 0x60a5fa, height: 55, width: 34, style: "office" },    // Level 2: Blue office building
      { base: 0x374151, roof: 0x4ade80, accent: 0x4ade80, height: 75, width: 38, style: "corporate" }, // Level 3: Gray corp with green accents
      { base: 0x1e3a8a, roof: 0x60a5fa, accent: 0xfbbf24, height: 100, width: 42, style: "tower" },    // Level 4: Modern blue tower
      { base: 0x0f172a, roof: 0x4ade80, accent: 0x4ade80, height: 130, width: 48, style: "skyscraper" }, // Level 5: BagsWorld HQ
    ];

    for (let level = 1; level <= 5; level++) {
      const config = buildingConfigs[level - 1];
      const buildingGraphics = this.make.graphics({ x: 0, y: 0 });
      const bHeight = config.height;
      const bWidth = config.width;
      const canvasHeight = 140;

      // Shadow
      buildingGraphics.fillStyle(0x000000, 0.4);
      buildingGraphics.fillRect(6, canvasHeight - bHeight + 6, bWidth - 2, bHeight);

      // Building base
      buildingGraphics.fillStyle(config.base);
      buildingGraphics.fillRect(4, canvasHeight - bHeight, bWidth - 4, bHeight);

      // Lighter left side for 3D effect
      buildingGraphics.fillStyle(config.base + 0x181818);
      buildingGraphics.fillRect(4, canvasHeight - bHeight, 6, bHeight);

      // Darker right side
      buildingGraphics.fillStyle(config.base - 0x0a0a0a);
      buildingGraphics.fillRect(bWidth - 6, canvasHeight - bHeight, 6, bHeight);

      // Style-specific roof and decorations
      if (level === 1) {
        // Shop - awning style roof
        buildingGraphics.fillStyle(config.roof);
        buildingGraphics.fillRect(0, canvasHeight - bHeight - 6, bWidth + 4, 8);
        // Stripes on awning
        buildingGraphics.fillStyle(0xef4444);
        for (let i = 0; i < bWidth; i += 8) {
          buildingGraphics.fillRect(i, canvasHeight - bHeight - 5, 4, 6);
        }
        // Shop sign
        buildingGraphics.fillStyle(0x1f2937);
        buildingGraphics.fillRect(6, canvasHeight - bHeight + 4, bWidth - 12, 8);
        buildingGraphics.fillStyle(config.accent);
        buildingGraphics.fillRect(8, canvasHeight - bHeight + 5, bWidth - 16, 6);
      } else if (level === 2) {
        // Office - flat roof with AC unit
        buildingGraphics.fillStyle(config.roof);
        buildingGraphics.fillRect(2, canvasHeight - bHeight - 4, bWidth, 6);
        // AC unit
        buildingGraphics.fillStyle(0x6b7280);
        buildingGraphics.fillRect(bWidth - 12, canvasHeight - bHeight - 10, 8, 8);
        buildingGraphics.fillStyle(0x9ca3af);
        buildingGraphics.fillRect(bWidth - 10, canvasHeight - bHeight - 8, 4, 4);
      } else if (level === 3) {
        // Corporate HQ - glass dome style top
        buildingGraphics.fillStyle(config.roof);
        buildingGraphics.fillRect(2, canvasHeight - bHeight - 8, bWidth, 10);
        // Dome accent
        buildingGraphics.fillStyle(config.accent);
        buildingGraphics.fillRect(bWidth / 2 - 6, canvasHeight - bHeight - 14, 16, 8);
        // Helipad marker
        buildingGraphics.fillStyle(0xffffff);
        buildingGraphics.fillCircle(bWidth / 2 + 2, canvasHeight - bHeight - 4, 6);
        buildingGraphics.fillStyle(config.roof);
        buildingGraphics.fillCircle(bWidth / 2 + 2, canvasHeight - bHeight - 4, 4);
      } else if (level === 4) {
        // Modern tower - stepped top
        buildingGraphics.fillStyle(config.roof);
        buildingGraphics.fillRect(6, canvasHeight - bHeight - 10, bWidth - 8, 12);
        buildingGraphics.fillRect(10, canvasHeight - bHeight - 18, bWidth - 16, 10);
        buildingGraphics.fillRect(14, canvasHeight - bHeight - 24, bWidth - 24, 8);
        // Antenna
        buildingGraphics.fillStyle(0x9ca3af);
        buildingGraphics.fillRect(bWidth / 2, canvasHeight - bHeight - 32, 2, 12);
        buildingGraphics.fillStyle(0xef4444);
        buildingGraphics.fillCircle(bWidth / 2 + 1, canvasHeight - bHeight - 34, 2);
      } else if (level === 5) {
        // BagsWorld Skyscraper - grand spire
        buildingGraphics.fillStyle(config.roof);
        buildingGraphics.fillTriangle(bWidth / 2 + 2, canvasHeight - bHeight - 30, 8, canvasHeight - bHeight, bWidth - 4, canvasHeight - bHeight);
        // Multiple spires
        buildingGraphics.fillStyle(config.accent);
        buildingGraphics.fillRect(bWidth / 2 - 1, canvasHeight - bHeight - 45, 6, 20);
        // Crown jewel
        buildingGraphics.fillStyle(0xfbbf24);
        buildingGraphics.fillCircle(bWidth / 2 + 2, canvasHeight - bHeight - 48, 4);
        // Beacon light
        buildingGraphics.fillStyle(0xef4444);
        buildingGraphics.fillCircle(bWidth / 2 + 2, canvasHeight - bHeight - 50, 2);
        // Side spires
        buildingGraphics.fillStyle(config.roof);
        buildingGraphics.fillRect(8, canvasHeight - bHeight - 15, 4, 18);
        buildingGraphics.fillRect(bWidth - 8, canvasHeight - bHeight - 15, 4, 18);
      }

      // Windows - style varies by building type
      const windowRows = level === 1 ? 2 : level === 2 ? 3 : level === 3 ? 4 : level === 4 ? 6 : 8;
      const windowCols = level >= 4 ? 4 : level >= 2 ? 3 : 2;
      const windowWidth = level >= 4 ? 5 : 6;
      const windowHeight = level >= 4 ? 6 : 5;
      const startY = canvasHeight - bHeight + (level === 1 ? 18 : 12);
      const windowSpacingY = level >= 4 ? 11 : 12;

      for (let row = 0; row < windowRows; row++) {
        for (let col = 0; col < windowCols; col++) {
          const totalWindowWidth = windowCols * windowWidth + (windowCols - 1) * 4;
          const startX = (bWidth - totalWindowWidth) / 2 + 2;
          const wx = startX + col * (windowWidth + 4);
          const wy = startY + row * windowSpacingY;

          // Skip windows where door is for level 1-2
          if (level <= 2 && row === windowRows - 1 && col === Math.floor(windowCols / 2)) continue;

          // Window glow
          buildingGraphics.fillStyle(config.accent, 0.3);
          buildingGraphics.fillRect(wx - 1, wy - 1, windowWidth + 2, windowHeight + 2);

          // Window
          buildingGraphics.fillStyle(config.accent);
          buildingGraphics.fillRect(wx, wy, windowWidth, windowHeight);

          // Window frame for higher levels
          if (level >= 3) {
            buildingGraphics.fillStyle(config.base - 0x151515);
            buildingGraphics.fillRect(wx + windowWidth / 2 - 1, wy, 1, windowHeight);
            buildingGraphics.fillRect(wx, wy + windowHeight / 2, windowWidth, 1);
          }
        }
      }

      // Door - style varies by level
      const doorWidth = level === 1 ? 12 : level >= 4 ? 14 : 10;
      const doorHeight = level >= 4 ? 16 : 12;
      const doorX = (bWidth - doorWidth) / 2 + 2;

      if (level === 5) {
        // Grand entrance with columns
        buildingGraphics.fillStyle(0x374151);
        buildingGraphics.fillRect(doorX - 6, canvasHeight - doorHeight - 4, 4, doorHeight + 4);
        buildingGraphics.fillRect(doorX + doorWidth + 2, canvasHeight - doorHeight - 4, 4, doorHeight + 4);
        // Entrance overhang
        buildingGraphics.fillStyle(config.accent);
        buildingGraphics.fillRect(doorX - 8, canvasHeight - doorHeight - 8, doorWidth + 16, 6);
      }

      // Door frame
      buildingGraphics.fillStyle(0x1f2937);
      buildingGraphics.fillRect(doorX, canvasHeight - doorHeight, doorWidth, doorHeight);
      // Door
      buildingGraphics.fillStyle(level >= 3 ? 0x374151 : 0x78350f);
      buildingGraphics.fillRect(doorX + 1, canvasHeight - doorHeight + 1, doorWidth - 2, doorHeight - 1);
      // Door handle
      buildingGraphics.fillStyle(config.accent);
      buildingGraphics.fillRect(doorX + doorWidth - 4, canvasHeight - doorHeight / 2 - 1, 2, 3);

      // Building sign for level 3+
      if (level >= 3) {
        buildingGraphics.fillStyle(0x1f2937);
        buildingGraphics.fillRect(doorX - 6, canvasHeight - doorHeight - 12, doorWidth + 12, 8);
        buildingGraphics.fillStyle(config.accent);
        buildingGraphics.fillRect(doorX - 4, canvasHeight - doorHeight - 11, doorWidth + 8, 6);
      }

      // Side decorations for level 4-5
      if (level >= 4) {
        // Vertical accent lines
        buildingGraphics.fillStyle(config.accent, 0.3);
        buildingGraphics.fillRect(6, canvasHeight - bHeight + 5, 2, bHeight - 20);
        buildingGraphics.fillRect(bWidth - 4, canvasHeight - bHeight + 5, 2, bHeight - 20);
      }

      buildingGraphics.generateTexture(`building_${level}`, 55, canvasHeight);
      buildingGraphics.destroy();
    }
  }

  private generatePokeCenter(): void {
    // PokeCenter - Pokemon Center style building (red roof, white base)
    const g = this.make.graphics({ x: 0, y: 0 });
    const canvasHeight = 140;
    const bHeight = 85;
    const bWidth = 50;

    // Shadow
    g.fillStyle(0x000000, 0.4);
    g.fillRect(6, canvasHeight - bHeight + 6, bWidth - 2, bHeight);

    // Building base (white/cream)
    g.fillStyle(0xfef3c7);
    g.fillRect(4, canvasHeight - bHeight, bWidth - 4, bHeight);

    // Lighter left side for 3D effect
    g.fillStyle(0xfefce8);
    g.fillRect(4, canvasHeight - bHeight, 6, bHeight);

    // Red roof - iconic PokeCenter style
    g.fillStyle(0xdc2626);
    g.fillRect(0, canvasHeight - bHeight - 8, bWidth + 4, 12);
    g.fillStyle(0xef4444);
    g.fillRect(2, canvasHeight - bHeight - 6, bWidth, 8);

    // Roof peak/overhang
    g.fillStyle(0xb91c1c);
    g.fillRect(bWidth / 2 - 8, canvasHeight - bHeight - 16, 20, 10);
    g.fillStyle(0xdc2626);
    g.fillRect(bWidth / 2 - 6, canvasHeight - bHeight - 14, 16, 6);

    // Pokeball logo on roof peak
    g.fillStyle(0xffffff);
    g.fillCircle(bWidth / 2 + 2, canvasHeight - bHeight - 10, 6);
    g.fillStyle(0xdc2626);
    g.fillRect(bWidth / 2 - 4, canvasHeight - bHeight - 16, 12, 6);
    g.fillStyle(0x1f2937);
    g.fillRect(bWidth / 2 - 4, canvasHeight - bHeight - 11, 12, 2);
    g.fillStyle(0xffffff);
    g.fillCircle(bWidth / 2 + 2, canvasHeight - bHeight - 10, 3);
    g.fillStyle(0x1f2937);
    g.fillCircle(bWidth / 2 + 2, canvasHeight - bHeight - 10, 1.5);

    // Windows (2 rows, 3 columns)
    const windowColor = 0x60a5fa;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        const wx = 10 + col * 12;
        const wy = canvasHeight - bHeight + 15 + row * 18;

        // Window glow
        g.fillStyle(windowColor, 0.3);
        g.fillRect(wx - 1, wy - 1, 9, 11);

        // Window
        g.fillStyle(windowColor);
        g.fillRect(wx, wy, 8, 10);

        // Window frame
        g.fillStyle(0xfef3c7);
        g.fillRect(wx + 3, wy, 2, 10);
        g.fillRect(wx, wy + 4, 8, 2);
      }
    }

    // Red cross/plus sign (healing center)
    g.fillStyle(0xdc2626);
    g.fillRect(bWidth / 2 - 1, canvasHeight - bHeight + 8, 6, 2);
    g.fillRect(bWidth / 2 + 1, canvasHeight - bHeight + 6, 2, 6);

    // Door - automatic sliding doors
    const doorWidth = 16;
    const doorHeight = 20;
    const doorX = (bWidth - doorWidth) / 2 + 2;

    // Door frame
    g.fillStyle(0xdc2626);
    g.fillRect(doorX - 2, canvasHeight - doorHeight - 4, doorWidth + 4, doorHeight + 4);

    // Glass doors
    g.fillStyle(0x93c5fd);
    g.fillRect(doorX, canvasHeight - doorHeight, doorWidth, doorHeight);

    // Door divider
    g.fillStyle(0x1f2937);
    g.fillRect(doorX + doorWidth / 2 - 1, canvasHeight - doorHeight, 2, doorHeight);

    // Welcome mat
    g.fillStyle(0xdc2626);
    g.fillRect(doorX - 4, canvasHeight - 2, doorWidth + 8, 2);

    // "P" sign above door
    g.fillStyle(0x1f2937);
    g.fillRect(doorX + 2, canvasHeight - doorHeight - 10, doorWidth - 4, 8);
    g.fillStyle(0xffffff);
    g.fillRect(doorX + 5, canvasHeight - doorHeight - 9, 2, 6);
    g.fillRect(doorX + 5, canvasHeight - doorHeight - 9, 5, 2);
    g.fillRect(doorX + 8, canvasHeight - doorHeight - 9, 2, 4);
    g.fillRect(doorX + 5, canvasHeight - doorHeight - 6, 5, 2);

    // Side decorations - pokeball symbols
    g.fillStyle(0xdc2626);
    g.fillCircle(10, canvasHeight - 25, 4);
    g.fillCircle(bWidth - 6, canvasHeight - 25, 4);
    g.fillStyle(0xffffff);
    g.fillRect(6, canvasHeight - 26, 8, 2);
    g.fillRect(bWidth - 10, canvasHeight - 26, 8, 2);

    g.generateTexture("pokecenter", 55, canvasHeight);
    g.destroy();
  }

  private generateDiverseCharacters(): void {
    // Generate multiple character variants for diversity
    for (let i = 0; i < 9; i++) {
      const skinTone = SKIN_TONES[i % SKIN_TONES.length];
      const hairColor = HAIR_COLORS[i % HAIR_COLORS.length];
      const shirtColor = SHIRT_COLORS[i % SHIRT_COLORS.length];

      // Neutral state
      this.createCharacterSprite(`character_${i}`, skinTone, hairColor, shirtColor, "neutral");
      // Happy state
      this.createCharacterSprite(`character_${i}_happy`, skinTone, hairColor, shirtColor, "happy");
      // Sad state
      this.createCharacterSprite(`character_${i}_sad`, skinTone, hairColor, shirtColor, "sad");
      // Celebrating state
      this.createCharacterSprite(`character_${i}_celebrating`, skinTone, hairColor, shirtColor, "celebrating");
    }

    // Keep default textures for backward compatibility
    this.createCharacterSprite("character", SKIN_TONES[0], HAIR_COLORS[0], SHIRT_COLORS[0], "neutral");
    this.createCharacterSprite("character_happy", SKIN_TONES[0], HAIR_COLORS[0], SHIRT_COLORS[0], "happy");
    this.createCharacterSprite("character_sad", SKIN_TONES[0], HAIR_COLORS[0], SHIRT_COLORS[0], "sad");
    this.createCharacterSprite("character_celebrating", SKIN_TONES[0], HAIR_COLORS[0], SHIRT_COLORS[0], "celebrating");

    // Generate Toly - Solana co-founder special character
    this.generateTolySprite();

    // Generate Ash Ketchum - ecosystem guide character
    this.generateAshSprite();

    // Generate Finn - Bags.fm founder
    this.generateFinnSprite();

    // Generate The Dev (DaddyGhost) - trading agent character
    this.generateDevSprite();

    // Generate Neo - The Scout Agent
    this.generateNeoSprite();
  }

  private generateTolySprite(): void {
    // Toly (Anatoly Yakovenko) - Solana co-founder
    // Casual tech look, beard, Solana purple/green colors
    const skinTone = 0xf1c27d; // Light tan
    const hairColor = 0x4a3728; // Brown hair
    const beardColor = 0x5c4033; // Brown beard
    const shirtColor = 0x9945ff; // Solana purple!

    const g = this.make.graphics({ x: 0, y: 0 });

    // Solana gradient aura/glow behind Toly
    g.fillStyle(0x14f195, 0.15); // Solana green
    g.fillCircle(16, 16, 18);
    g.fillStyle(0x9945ff, 0.1); // Solana purple
    g.fillCircle(16, 16, 22);

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(16, 30, 14, 5);

    // Legs (dark jeans)
    g.fillStyle(0x1e3a5f);
    g.fillRect(10, 22, 5, 9);
    g.fillRect(17, 22, 5, 9);

    // Shoes (casual sneakers)
    g.fillStyle(0x374151);
    g.fillRect(9, 29, 6, 3);
    g.fillRect(17, 29, 6, 3);
    // White sole
    g.fillStyle(0xffffff);
    g.fillRect(9, 31, 6, 1);
    g.fillRect(17, 31, 6, 1);

    // Body/Shirt (Solana purple hoodie)
    g.fillStyle(shirtColor);
    g.fillRect(8, 12, 16, 12);

    // Hoodie details
    g.fillStyle(0x7c3aed);
    g.fillRect(8, 12, 3, 12);
    g.fillRect(21, 12, 3, 12);

    // Solana logo on shirt (simplified S shape)
    g.fillStyle(0x14f195); // Solana green
    g.fillRect(13, 15, 6, 2);
    g.fillRect(13, 15, 2, 4);
    g.fillRect(13, 17, 6, 2);
    g.fillRect(17, 17, 2, 4);
    g.fillRect(13, 19, 6, 2);

    // Arms
    g.fillStyle(skinTone);
    g.fillRect(5, 13, 4, 10);
    g.fillRect(23, 13, 4, 10);

    // Head
    g.fillStyle(skinTone);
    g.fillRect(9, 2, 14, 12);

    // Hair (short, casual)
    g.fillStyle(hairColor);
    g.fillRect(9, 0, 14, 5);
    g.fillRect(8, 2, 2, 4);
    g.fillRect(22, 2, 2, 4);

    // Beard (short, well-groomed)
    g.fillStyle(beardColor);
    g.fillRect(10, 10, 12, 4);
    g.fillRect(11, 9, 10, 2);
    // Chin
    g.fillRect(12, 13, 8, 1);

    // Eyes (friendly, focused)
    g.fillStyle(0xffffff);
    g.fillRect(11, 5, 4, 3);
    g.fillRect(17, 5, 4, 3);
    // Pupils
    g.fillStyle(0x1e3a5f); // Blue-ish
    g.fillRect(13, 5, 2, 2);
    g.fillRect(19, 5, 2, 2);

    // Friendly smile under beard
    g.fillStyle(0xffffff);
    g.fillRect(14, 11, 4, 1);

    // Solana symbol above head (instead of question mark)
    g.fillStyle(0x14f195);
    g.fillRect(12, -4, 8, 2);
    g.fillStyle(0x9945ff);
    g.fillRect(14, -6, 4, 2);
    g.fillStyle(0x14f195);
    g.fillRect(13, -2, 6, 2);

    g.generateTexture("toly", 32, 32);
    g.destroy();
  }

  private generateAshSprite(): void {
    // Ash Ketchum - Pokemon trainer style with iconic cap
    const skinTone = 0xffdbac; // Light skin
    const g = this.make.graphics({ x: 0, y: 0 });

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(16, 30, 14, 5);

    // Legs (blue jeans)
    g.fillStyle(0x1e40af);
    g.fillRect(10, 22, 5, 9);
    g.fillRect(17, 22, 5, 9);

    // Shoes (red/black sneakers)
    g.fillStyle(0xdc2626);
    g.fillRect(9, 29, 6, 3);
    g.fillRect(17, 29, 6, 3);
    g.fillStyle(0xffffff);
    g.fillRect(10, 30, 2, 1);
    g.fillRect(18, 30, 2, 1);

    // Body (blue vest over black shirt)
    g.fillStyle(0x1f2937); // Black undershirt
    g.fillRect(8, 12, 16, 12);
    g.fillStyle(0x2563eb); // Blue vest
    g.fillRect(8, 12, 5, 12);
    g.fillRect(19, 12, 5, 12);
    // Yellow trim on vest
    g.fillStyle(0xfbbf24);
    g.fillRect(8, 12, 1, 12);
    g.fillRect(23, 12, 1, 12);

    // Arms
    g.fillStyle(skinTone);
    g.fillRect(5, 13, 4, 10);
    g.fillRect(23, 13, 4, 10);

    // Gloves (green fingerless)
    g.fillStyle(0x22c55e);
    g.fillRect(5, 19, 4, 4);
    g.fillRect(23, 19, 4, 4);
    g.fillStyle(skinTone);
    g.fillRect(6, 21, 2, 2);
    g.fillRect(24, 21, 2, 2);

    // Head
    g.fillStyle(skinTone);
    g.fillRect(9, 2, 14, 12);

    // Hair (black, spiky)
    g.fillStyle(0x1a1a1a);
    g.fillRect(9, 0, 14, 5);
    g.fillRect(7, 2, 3, 5);
    g.fillRect(22, 2, 3, 5);
    // Spiky hair bits sticking out
    g.fillRect(6, 3, 2, 3);
    g.fillRect(24, 3, 2, 3);
    g.fillRect(12, -1, 2, 2);
    g.fillRect(18, -1, 2, 2);

    // Iconic Pokemon cap (red with white front and green symbol area)
    g.fillStyle(0xdc2626); // Red
    g.fillRect(7, -2, 18, 5);
    g.fillStyle(0xffffff); // White front panel
    g.fillRect(11, -2, 10, 4);
    // Green Pokemon League symbol
    g.fillStyle(0x22c55e);
    g.fillRect(14, -1, 4, 2);
    // Cap bill
    g.fillStyle(0xdc2626);
    g.fillRect(7, 2, 10, 2);

    // Face marks (Z marks on cheeks - like Ash)
    g.fillStyle(0x8b4513);
    g.fillRect(9, 8, 2, 1);
    g.fillRect(9, 9, 1, 1);
    g.fillRect(21, 8, 2, 1);
    g.fillRect(22, 9, 1, 1);

    // Eyes (big anime style)
    g.fillStyle(0xffffff);
    g.fillRect(11, 5, 4, 4);
    g.fillRect(17, 5, 4, 4);
    // Brown irises
    g.fillStyle(0x92400e);
    g.fillRect(12, 6, 3, 3);
    g.fillRect(18, 6, 3, 3);
    // Black pupils
    g.fillStyle(0x000000);
    g.fillRect(13, 6, 2, 2);
    g.fillRect(19, 6, 2, 2);
    // Eye shine
    g.fillStyle(0xffffff);
    g.fillRect(13, 6, 1, 1);
    g.fillRect(19, 6, 1, 1);

    // Determined smile
    g.fillStyle(0x000000);
    g.fillRect(13, 11, 6, 1);
    g.fillRect(12, 10, 1, 1);
    g.fillRect(19, 10, 1, 1);

    // Pokeball icon floating (showing he's a trainer)
    g.fillStyle(0xdc2626);
    g.fillCircle(28, 4, 4);
    g.fillStyle(0xffffff);
    g.fillRect(24, 3, 8, 2);
    g.fillCircle(28, 4, 4);
    g.fillStyle(0xdc2626);
    g.fillRect(24, 0, 8, 4);
    g.fillStyle(0xffffff);
    g.fillRect(24, 4, 8, 4);
    g.fillStyle(0x1f2937);
    g.fillRect(24, 3, 8, 2);
    g.fillStyle(0xffffff);
    g.fillCircle(28, 4, 2);
    g.fillStyle(0x1f2937);
    g.fillCircle(28, 4, 1);

    g.generateTexture("ash", 32, 32);
    g.destroy();
  }

  private generateFinnSprite(): void {
    // Finn (@finnbags) - Bags.fm CEO
    // Casual tech founder look with WIF-inspired beanie, emerald brand colors
    const skinTone = 0xffd5b4; // Light skin
    const g = this.make.graphics({ x: 0, y: 0 });

    // Bags green glow behind Finn
    g.fillStyle(0x10b981, 0.15); // Emerald
    g.fillCircle(16, 16, 18);
    g.fillStyle(0x059669, 0.1);
    g.fillCircle(16, 16, 22);

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(16, 30, 14, 5);

    // Legs (dark jeans)
    g.fillStyle(0x1f2937);
    g.fillRect(10, 22, 5, 9);
    g.fillRect(17, 22, 5, 9);

    // Shoes (white sneakers - clean founder style)
    g.fillStyle(0xffffff);
    g.fillRect(9, 29, 6, 3);
    g.fillRect(17, 29, 6, 3);
    g.fillStyle(0xe5e7eb);
    g.fillRect(9, 31, 6, 1);
    g.fillRect(17, 31, 6, 1);

    // Body (emerald hoodie - Bags brand)
    g.fillStyle(0x10b981); // Emerald
    g.fillRect(8, 12, 16, 12);

    // Hoodie details (darker sides)
    g.fillStyle(0x059669);
    g.fillRect(8, 12, 3, 12);
    g.fillRect(21, 12, 3, 12);

    // "BAGS" text on hoodie (simplified)
    g.fillStyle(0xffffff);
    g.fillRect(11, 16, 2, 4); // B
    g.fillRect(11, 16, 4, 1);
    g.fillRect(11, 18, 4, 1);
    g.fillRect(11, 20, 4, 1);
    g.fillRect(14, 16, 1, 4);
    g.fillRect(16, 16, 3, 4); // A (simplified)
    g.fillRect(17, 15, 1, 1);

    // Arms
    g.fillStyle(skinTone);
    g.fillRect(5, 13, 4, 10);
    g.fillRect(23, 13, 4, 10);

    // Head
    g.fillStyle(skinTone);
    g.fillRect(9, 2, 14, 12);

    // Hair (short, neat)
    g.fillStyle(0x4a3728); // Brown
    g.fillRect(9, 0, 14, 4);
    g.fillRect(8, 1, 2, 4);
    g.fillRect(22, 1, 2, 4);

    // WIF-inspired pink beanie!
    g.fillStyle(0xec4899); // Pink like WIF hat
    g.fillRect(7, -3, 18, 5);
    g.fillRect(8, -4, 16, 2);
    // Beanie fold
    g.fillStyle(0xdb2777);
    g.fillRect(7, 1, 18, 2);

    // Eyes (friendly, entrepreneurial)
    g.fillStyle(0xffffff);
    g.fillRect(11, 5, 4, 3);
    g.fillRect(17, 5, 4, 3);
    // Blue pupils
    g.fillStyle(0x3b82f6);
    g.fillRect(13, 5, 2, 2);
    g.fillRect(19, 5, 2, 2);

    // Friendly smile
    g.fillStyle(0xffffff);
    g.fillRect(13, 10, 6, 2);
    g.fillStyle(skinTone);
    g.fillRect(13, 10, 6, 1);

    // Money bag icon floating (showing he's about bags!)
    g.fillStyle(0xfbbf24); // Gold
    g.fillCircle(28, 4, 4);
    g.fillStyle(0xf59e0b);
    g.fillRect(26, 0, 4, 2);
    // $ sign on bag
    g.fillStyle(0x065f46);
    g.fillRect(27, 2, 2, 4);
    g.fillRect(26, 3, 1, 1);
    g.fillRect(29, 4, 1, 1);

    g.generateTexture("finn", 32, 32);
    g.destroy();
  }

  private generateDevSprite(): void {
    // DaddyGhost (@DaddyGhost) - The Dev / Trencher
    // Hacker/dev aesthetic with hoodie, glasses, ghost theme
    const skinTone = 0xe0ac69; // Medium skin
    const g = this.make.graphics({ x: 0, y: 0 });

    // Ghost/ethereal glow behind The Dev (purple/cyan hacker vibes)
    g.fillStyle(0x8b5cf6, 0.15); // Purple
    g.fillCircle(16, 16, 18);
    g.fillStyle(0x06b6d4, 0.1); // Cyan
    g.fillCircle(16, 16, 22);

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(16, 30, 14, 5);

    // Legs (black joggers - dev uniform)
    g.fillStyle(0x1f2937);
    g.fillRect(10, 22, 5, 9);
    g.fillRect(17, 22, 5, 9);

    // Shoes (dark sneakers)
    g.fillStyle(0x374151);
    g.fillRect(9, 29, 6, 3);
    g.fillRect(17, 29, 6, 3);
    g.fillStyle(0x4b5563);
    g.fillRect(10, 30, 4, 1);
    g.fillRect(18, 30, 4, 1);

    // Body (dark hoodie with hood up - mysterious dev)
    g.fillStyle(0x1f2937); // Dark gray hoodie
    g.fillRect(8, 12, 16, 12);

    // Hoodie details (darker sides)
    g.fillStyle(0x111827);
    g.fillRect(8, 12, 3, 12);
    g.fillRect(21, 12, 3, 12);

    // Hood shadow around face
    g.fillStyle(0x111827);
    g.fillRect(8, 2, 16, 6);
    g.fillRect(7, 4, 2, 8);
    g.fillRect(23, 4, 2, 8);

    // Ghost icon on hoodie (the brand!)
    g.fillStyle(0x8b5cf6); // Purple ghost
    g.fillRect(13, 15, 6, 6);
    g.fillRect(12, 16, 2, 4);
    g.fillRect(18, 16, 2, 4);
    // Ghost eyes
    g.fillStyle(0xffffff);
    g.fillRect(14, 16, 2, 2);
    g.fillRect(17, 16, 2, 2);

    // Arms
    g.fillStyle(skinTone);
    g.fillRect(5, 13, 4, 10);
    g.fillRect(23, 13, 4, 10);

    // Head
    g.fillStyle(skinTone);
    g.fillRect(10, 4, 12, 10);

    // Hair (dark, messy - been coding all night)
    g.fillStyle(0x1a1a1a);
    g.fillRect(10, 2, 12, 4);
    g.fillRect(9, 3, 2, 3);
    g.fillRect(21, 3, 2, 3);
    // Messy bits sticking out
    g.fillRect(8, 4, 2, 2);
    g.fillRect(22, 4, 2, 2);
    g.fillRect(12, 1, 2, 2);
    g.fillRect(18, 1, 2, 2);

    // Glasses (dev essential)
    g.fillStyle(0x374151); // Frame
    g.fillRect(10, 6, 12, 1);
    g.fillRect(10, 6, 5, 4);
    g.fillRect(17, 6, 5, 4);
    // Lens
    g.fillStyle(0x60a5fa, 0.6); // Blue tinted
    g.fillRect(11, 7, 3, 2);
    g.fillRect(18, 7, 3, 2);
    // Lens shine
    g.fillStyle(0xffffff, 0.4);
    g.fillRect(11, 7, 1, 1);
    g.fillRect(18, 7, 1, 1);

    // Eyes behind glasses
    g.fillStyle(0x000000);
    g.fillRect(12, 7, 2, 2);
    g.fillRect(19, 7, 2, 2);

    // Slight smirk (knows something you don't)
    g.fillStyle(0x000000);
    g.fillRect(14, 11, 4, 1);
    g.fillRect(18, 10, 1, 1);

    // Terminal/code icon floating (showing he's a dev)
    g.fillStyle(0x1f2937);
    g.fillRect(24, 0, 8, 8);
    g.fillStyle(0x4ade80); // Green terminal text
    g.fillRect(25, 2, 1, 1);
    g.fillRect(26, 2, 3, 1);
    g.fillRect(25, 4, 1, 1);
    g.fillRect(26, 4, 4, 1);
    g.fillRect(25, 6, 2, 1);

    g.generateTexture("dev", 32, 32);
    g.destroy();
  }

  private generateNeoSprite(): void {
    // Neo - The One (Matrix-inspired Scout Agent)
    // Black coat, sunglasses, Matrix green theme
    const skinTone = 0xf1c27d; // Light skin
    const g = this.make.graphics({ x: 0, y: 0 });

    // Matrix green digital glow behind Neo
    g.fillStyle(0x00ff41, 0.2); // Matrix green
    g.fillCircle(16, 16, 18);
    g.fillStyle(0x00ff41, 0.1);
    g.fillCircle(16, 16, 22);

    // Shadow
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(16, 30, 14, 5);

    // Legs (black pants)
    g.fillStyle(0x0a0a0a);
    g.fillRect(10, 22, 5, 9);
    g.fillRect(17, 22, 5, 9);

    // Shoes (black boots)
    g.fillStyle(0x1a1a1a);
    g.fillRect(9, 29, 6, 3);
    g.fillRect(17, 29, 6, 3);
    g.fillStyle(0x0a0a0a);
    g.fillRect(9, 31, 6, 1);
    g.fillRect(17, 31, 6, 1);

    // Long black coat (iconic Matrix look)
    g.fillStyle(0x0a0a0a);
    g.fillRect(6, 12, 20, 16);

    // Coat details - slightly lighter edges
    g.fillStyle(0x1a1a1a);
    g.fillRect(6, 12, 2, 16);
    g.fillRect(24, 12, 2, 16);

    // Coat opening showing shirt
    g.fillStyle(0x111111);
    g.fillRect(12, 14, 8, 10);

    // Arms
    g.fillStyle(skinTone);
    g.fillRect(4, 13, 3, 10);
    g.fillRect(25, 13, 3, 10);

    // Head
    g.fillStyle(skinTone);
    g.fillRect(9, 2, 14, 12);

    // Hair (short, black, slicked back)
    g.fillStyle(0x0a0a0a);
    g.fillRect(9, 0, 14, 5);
    g.fillRect(8, 2, 2, 3);
    g.fillRect(22, 2, 2, 3);

    // Iconic sunglasses (small, round)
    g.fillStyle(0x1a1a1a); // Frame
    g.fillRect(10, 5, 5, 3);
    g.fillRect(17, 5, 5, 3);
    g.fillRect(15, 6, 2, 1); // Bridge

    // Green lens reflection (Matrix style)
    g.fillStyle(0x00ff41, 0.6);
    g.fillRect(11, 6, 3, 1);
    g.fillRect(18, 6, 3, 1);

    // Neutral expression
    g.fillStyle(0x000000);
    g.fillRect(14, 10, 4, 1);

    // Matrix code rain effect above head (iconic)
    g.fillStyle(0x00ff41, 0.8);
    // Column 1
    g.fillRect(8, -6, 2, 2);
    g.fillRect(8, -2, 2, 2);
    // Column 2
    g.fillRect(14, -4, 2, 2);
    g.fillRect(14, 0, 2, 2);
    // Column 3
    g.fillRect(20, -6, 2, 2);
    g.fillRect(20, -2, 2, 2);

    // Brighter "lead" characters
    g.fillStyle(0x80ff80);
    g.fillRect(8, 2, 2, 2);
    g.fillRect(14, -6, 2, 2);
    g.fillRect(20, 2, 2, 2);

    g.generateTexture("neo", 32, 32);
    g.destroy();
  }

  private createCharacterSprite(
    key: string,
    skinTone: number,
    hairColor: number,
    shirtColor: number,
    mood: "neutral" | "happy" | "sad" | "celebrating"
  ): void {
    const g = this.make.graphics({ x: 0, y: 0 });

    // Shadow
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(16, 30, 12, 4);

    // Legs
    const pantsColor = 0x1e3a8a;
    g.fillStyle(pantsColor);
    g.fillRect(10, 22, 5, 9);
    g.fillRect(17, 22, 5, 9);

    // Shoes
    g.fillStyle(0x1f2937);
    g.fillRect(9, 29, 6, 3);
    g.fillRect(17, 29, 6, 3);

    // Body/Shirt
    if (mood === "celebrating") {
      g.fillStyle(0xfbbf24); // Gold for celebrating
    } else if (mood === "sad") {
      g.fillStyle(0x6b7280); // Gray for sad
    } else {
      g.fillStyle(shirtColor);
    }
    g.fillRect(8, 12, 16, 12);

    // Shirt details
    g.fillStyle(shirtColor - 0x111111);
    g.fillRect(8, 12, 3, 12);

    // Arms
    g.fillStyle(skinTone);
    if (mood === "celebrating") {
      // Arms up
      g.fillRect(5, 6, 4, 8);
      g.fillRect(23, 6, 4, 8);
    } else {
      // Arms down
      g.fillRect(5, 13, 4, 10);
      g.fillRect(23, 13, 4, 10);
    }

    // Head
    g.fillStyle(skinTone);
    g.fillRect(9, 2, 14, 12);

    // Hair
    g.fillStyle(hairColor);
    g.fillRect(9, 1, 14, 5);
    g.fillRect(8, 3, 2, 4);
    g.fillRect(22, 3, 2, 4);

    // Eyes
    g.fillStyle(0xffffff);
    g.fillRect(11, 6, 4, 3);
    g.fillRect(17, 6, 4, 3);

    // Pupils
    g.fillStyle(0x000000);
    if (mood === "sad") {
      g.fillRect(12, 7, 2, 2);
      g.fillRect(18, 7, 2, 2);
    } else {
      g.fillRect(13, 6, 2, 2);
      g.fillRect(19, 6, 2, 2);
    }

    // Mouth
    if (mood === "happy" || mood === "celebrating") {
      g.fillStyle(0x000000);
      g.fillRect(13, 10, 6, 1);
      g.fillRect(12, 9, 1, 1);
      g.fillRect(19, 9, 1, 1);
    } else if (mood === "sad") {
      g.fillStyle(0x000000);
      g.fillRect(13, 11, 6, 1);
      g.fillRect(12, 10, 1, 1);
      g.fillRect(19, 10, 1, 1);
    } else {
      g.fillStyle(0x000000);
      g.fillRect(14, 10, 4, 1);
    }

    // Blush for happy
    if (mood === "happy" || mood === "celebrating") {
      g.fillStyle(0xff9999, 0.5);
      g.fillRect(10, 8, 2, 2);
      g.fillRect(20, 8, 2, 2);
    }

    g.generateTexture(key, 32, 32);
    g.destroy();
  }

  private generateWeatherAssets(): void {
    // Rain drop - enhanced
    const rainGraphics = this.make.graphics({ x: 0, y: 0 });
    rainGraphics.fillStyle(0x60a5fa);
    rainGraphics.fillRect(1, 0, 2, 8);
    rainGraphics.fillStyle(0x93c5fd);
    rainGraphics.fillRect(1, 0, 1, 3);
    rainGraphics.fillStyle(0x3b82f6);
    rainGraphics.fillRect(2, 5, 1, 3);
    rainGraphics.generateTexture("rain", 4, 10);
    rainGraphics.destroy();

    // Sun with rays - enhanced with more detail
    const sunGraphics = this.make.graphics({ x: 0, y: 0 });
    // Outer glow
    sunGraphics.fillStyle(0xfbbf24, 0.15);
    sunGraphics.fillCircle(20, 20, 20);
    sunGraphics.fillStyle(0xfbbf24, 0.3);
    sunGraphics.fillCircle(20, 20, 16);
    sunGraphics.fillStyle(0xfbbf24, 0.5);
    sunGraphics.fillCircle(20, 20, 12);
    // Core
    sunGraphics.fillStyle(0xfbbf24);
    sunGraphics.fillCircle(20, 20, 8);
    // Bright center
    sunGraphics.fillStyle(0xfef3c7);
    sunGraphics.fillCircle(18, 18, 4);
    // Hot spot
    sunGraphics.fillStyle(0xffffff);
    sunGraphics.fillCircle(17, 17, 2);
    sunGraphics.generateTexture("sun", 40, 40);
    sunGraphics.destroy();

    // Moon - crescent with crater details
    const moonGraphics = this.make.graphics({ x: 0, y: 0 });
    // Outer glow
    moonGraphics.fillStyle(0xc4b5fd, 0.2);
    moonGraphics.fillCircle(16, 16, 16);
    moonGraphics.fillStyle(0xe0e7ff, 0.3);
    moonGraphics.fillCircle(16, 16, 12);
    // Moon body
    moonGraphics.fillStyle(0xf1f5f9);
    moonGraphics.fillCircle(16, 16, 10);
    // Crescent shadow
    moonGraphics.fillStyle(0x1e293b, 0.7);
    moonGraphics.fillCircle(20, 14, 8);
    // Craters
    moonGraphics.fillStyle(0xcbd5e1);
    moonGraphics.fillCircle(12, 14, 2);
    moonGraphics.fillCircle(14, 20, 1.5);
    moonGraphics.fillCircle(10, 18, 1);
    moonGraphics.generateTexture("moon", 32, 32);
    moonGraphics.destroy();

    // Fluffy cloud
    const cloudGraphics = this.make.graphics({ x: 0, y: 0 });
    cloudGraphics.fillStyle(0x9ca3af);
    cloudGraphics.fillCircle(20, 24, 14);
    cloudGraphics.fillCircle(36, 20, 16);
    cloudGraphics.fillCircle(52, 24, 12);
    cloudGraphics.fillStyle(0xd1d5db);
    cloudGraphics.fillCircle(18, 22, 10);
    cloudGraphics.fillCircle(34, 18, 12);
    cloudGraphics.generateTexture("cloud", 68, 40);
    cloudGraphics.destroy();

    // Storm cloud
    const stormCloud = this.make.graphics({ x: 0, y: 0 });
    stormCloud.fillStyle(0x374151);
    stormCloud.fillCircle(20, 24, 14);
    stormCloud.fillCircle(36, 20, 16);
    stormCloud.fillCircle(52, 24, 12);
    stormCloud.fillStyle(0x4b5563);
    stormCloud.fillCircle(34, 22, 10);
    stormCloud.generateTexture("storm_cloud", 68, 40);
    stormCloud.destroy();

    // Lightning bolt
    const lightning = this.make.graphics({ x: 0, y: 0 });
    lightning.fillStyle(0xfbbf24);
    lightning.fillPoints([
      { x: 8, y: 0 },
      { x: 4, y: 10 },
      { x: 8, y: 10 },
      { x: 2, y: 20 },
      { x: 10, y: 8 },
      { x: 6, y: 8 },
      { x: 10, y: 0 },
    ], true);
    lightning.generateTexture("lightning", 12, 20);
    lightning.destroy();

    // Snowflake
    const snow = this.make.graphics({ x: 0, y: 0 });
    snow.fillStyle(0xffffff);
    snow.fillCircle(4, 4, 3);
    snow.fillStyle(0xe0f2fe);
    snow.fillCircle(3, 3, 1);
    snow.generateTexture("snow", 8, 8);
    snow.destroy();
  }

  private generateUIAssets(): void {
    // Coin with shine
    const coinGraphics = this.make.graphics({ x: 0, y: 0 });
    coinGraphics.fillStyle(0xfbbf24);
    coinGraphics.fillCircle(6, 6, 6);
    coinGraphics.fillStyle(0xf59e0b);
    coinGraphics.fillCircle(6, 6, 4);
    coinGraphics.fillStyle(0xfbbf24);
    coinGraphics.fillRect(5, 3, 2, 6);
    coinGraphics.fillStyle(0xfef3c7);
    coinGraphics.fillCircle(4, 4, 2);
    coinGraphics.generateTexture("coin", 12, 12);
    coinGraphics.destroy();

    // Glow effect
    const glowGraphics = this.make.graphics({ x: 0, y: 0 });
    glowGraphics.fillStyle(0x4ade80, 0.2);
    glowGraphics.fillCircle(20, 20, 20);
    glowGraphics.fillStyle(0x4ade80, 0.4);
    glowGraphics.fillCircle(20, 20, 14);
    glowGraphics.fillStyle(0x4ade80, 0.6);
    glowGraphics.fillCircle(20, 20, 8);
    glowGraphics.generateTexture("glow", 40, 40);
    glowGraphics.destroy();

    // Star particle - draw manually since Phaser graphics doesn't have fillStar
    const star = this.make.graphics({ x: 0, y: 0 });
    star.fillStyle(0xfbbf24);
    // Draw a 5-pointed star using points
    const cx = 8, cy = 8, outerR = 7, innerR = 3;
    const starPoints: Phaser.Types.Math.Vector2Like[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (i * Math.PI / 5) - Math.PI / 2;
      starPoints.push({
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle)
      });
    }
    star.fillPoints(starPoints, true);
    star.generateTexture("star", 16, 16);
    star.destroy();

    // Heart particle
    const heart = this.make.graphics({ x: 0, y: 0 });
    heart.fillStyle(0xef4444);
    heart.fillCircle(5, 5, 4);
    heart.fillCircle(11, 5, 4);
    heart.fillTriangle(1, 6, 15, 6, 8, 14);
    heart.generateTexture("heart", 16, 16);
    heart.destroy();
  }

  private generateDecorations(): void {
    // Tree
    const tree = this.make.graphics({ x: 0, y: 0 });
    // Trunk
    tree.fillStyle(0x78350f);
    tree.fillRect(12, 28, 8, 16);
    tree.fillStyle(0x92400e);
    tree.fillRect(14, 28, 4, 16);
    // Foliage layers
    tree.fillStyle(0x166534);
    tree.fillCircle(16, 20, 14);
    tree.fillStyle(0x15803d);
    tree.fillCircle(16, 16, 12);
    tree.fillStyle(0x22c55e);
    tree.fillCircle(16, 12, 8);
    tree.generateTexture("tree", 32, 44);
    tree.destroy();

    // Bush
    const bush = this.make.graphics({ x: 0, y: 0 });
    bush.fillStyle(0x166534);
    bush.fillCircle(8, 12, 8);
    bush.fillCircle(16, 10, 10);
    bush.fillCircle(24, 12, 8);
    bush.fillStyle(0x22c55e);
    bush.fillCircle(16, 8, 6);
    bush.generateTexture("bush", 32, 20);
    bush.destroy();

    // Lamp post
    const lamp = this.make.graphics({ x: 0, y: 0 });
    lamp.fillStyle(0x1f2937);
    lamp.fillRect(6, 8, 4, 32);
    lamp.fillStyle(0x374151);
    lamp.fillRect(2, 4, 12, 6);
    lamp.fillStyle(0xfbbf24, 0.5);
    lamp.fillRect(4, 6, 8, 4);
    lamp.generateTexture("lamp", 16, 40);
    lamp.destroy();

    // Bench
    const bench = this.make.graphics({ x: 0, y: 0 });
    bench.fillStyle(0x78350f);
    bench.fillRect(0, 8, 32, 4);
    bench.fillRect(2, 12, 4, 8);
    bench.fillRect(26, 12, 4, 8);
    bench.fillStyle(0x92400e);
    bench.fillRect(0, 4, 32, 4);
    bench.generateTexture("bench", 32, 20);
    bench.destroy();
  }

  private generateAnimals(): void {
    // Dog - pixel art style
    const dog = this.make.graphics({ x: 0, y: 0 });
    // Body
    dog.fillStyle(0xc68642); // Brown
    dog.fillRect(4, 8, 16, 10);
    // Head
    dog.fillRect(18, 4, 10, 10);
    // Ears
    dog.fillStyle(0x8d5524);
    dog.fillRect(18, 2, 4, 4);
    dog.fillRect(24, 2, 4, 4);
    // Snout
    dog.fillStyle(0xffdbac);
    dog.fillRect(26, 8, 4, 4);
    // Nose
    dog.fillStyle(0x1f2937);
    dog.fillRect(28, 9, 2, 2);
    // Eye
    dog.fillStyle(0x000000);
    dog.fillRect(22, 6, 2, 2);
    // Legs
    dog.fillStyle(0xc68642);
    dog.fillRect(6, 16, 3, 6);
    dog.fillRect(14, 16, 3, 6);
    // Tail
    dog.fillRect(2, 6, 3, 4);
    dog.generateTexture("dog", 32, 24);
    dog.destroy();

    // Cat - pixel art style
    const cat = this.make.graphics({ x: 0, y: 0 });
    // Body
    cat.fillStyle(0x6b7280); // Gray
    cat.fillRect(6, 10, 14, 8);
    // Head
    cat.fillRect(16, 4, 10, 10);
    // Ears (triangular)
    cat.fillStyle(0x4b5563);
    cat.fillTriangle(16, 6, 18, 0, 20, 6);
    cat.fillTriangle(24, 6, 26, 0, 28, 6);
    // Inner ears
    cat.fillStyle(0xfca5a5);
    cat.fillTriangle(17, 5, 18, 2, 19, 5);
    cat.fillTriangle(25, 5, 26, 2, 27, 5);
    // Eyes
    cat.fillStyle(0x22c55e); // Green eyes
    cat.fillRect(18, 7, 2, 3);
    cat.fillRect(23, 7, 2, 3);
    // Pupils
    cat.fillStyle(0x000000);
    cat.fillRect(18, 8, 1, 2);
    cat.fillRect(23, 8, 1, 2);
    // Nose
    cat.fillStyle(0xfca5a5);
    cat.fillRect(21, 10, 2, 1);
    // Whiskers
    cat.fillStyle(0x9ca3af);
    cat.fillRect(14, 9, 4, 1);
    cat.fillRect(26, 9, 4, 1);
    cat.fillRect(14, 11, 4, 1);
    cat.fillRect(26, 11, 4, 1);
    // Legs
    cat.fillStyle(0x6b7280);
    cat.fillRect(8, 16, 3, 5);
    cat.fillRect(15, 16, 3, 5);
    // Tail (curved up)
    cat.fillRect(4, 8, 3, 2);
    cat.fillRect(2, 4, 3, 5);
    cat.generateTexture("cat", 32, 24);
    cat.destroy();

    // Bird - small sparrow
    const bird = this.make.graphics({ x: 0, y: 0 });
    // Body
    bird.fillStyle(0x8b4513); // Brown
    bird.fillEllipse(8, 8, 8, 6);
    // Head
    bird.fillCircle(14, 6, 4);
    // Beak
    bird.fillStyle(0xfbbf24);
    bird.fillTriangle(18, 6, 22, 6, 18, 8);
    // Eye
    bird.fillStyle(0x000000);
    bird.fillCircle(15, 5, 1);
    // Wing
    bird.fillStyle(0x6b4423);
    bird.fillEllipse(6, 8, 5, 4);
    // Tail
    bird.fillStyle(0x5c3317);
    bird.fillTriangle(0, 6, 4, 8, 4, 10);
    // Legs
    bird.fillStyle(0xfbbf24);
    bird.fillRect(7, 12, 1, 4);
    bird.fillRect(10, 12, 1, 4);
    bird.generateTexture("bird", 24, 18);
    bird.destroy();

    // Butterfly
    const butterfly = this.make.graphics({ x: 0, y: 0 });
    // Wings
    butterfly.fillStyle(0xec4899); // Pink
    butterfly.fillEllipse(4, 6, 4, 5);
    butterfly.fillEllipse(12, 6, 4, 5);
    butterfly.fillStyle(0xf472b6);
    butterfly.fillEllipse(4, 10, 3, 4);
    butterfly.fillEllipse(12, 10, 3, 4);
    // Body
    butterfly.fillStyle(0x1f2937);
    butterfly.fillRect(7, 4, 2, 10);
    // Antennae
    butterfly.fillRect(6, 2, 1, 3);
    butterfly.fillRect(9, 2, 1, 3);
    // Wing patterns
    butterfly.fillStyle(0xfbbf24);
    butterfly.fillCircle(4, 6, 1);
    butterfly.fillCircle(12, 6, 1);
    butterfly.generateTexture("butterfly", 16, 16);
    butterfly.destroy();

    // Squirrel
    const squirrel = this.make.graphics({ x: 0, y: 0 });
    // Body
    squirrel.fillStyle(0xb45309); // Orange-brown
    squirrel.fillRect(8, 10, 10, 8);
    // Head
    squirrel.fillCircle(20, 10, 5);
    // Ear
    squirrel.fillStyle(0x92400e);
    squirrel.fillTriangle(18, 4, 20, 2, 22, 6);
    // Eye
    squirrel.fillStyle(0x000000);
    squirrel.fillCircle(21, 9, 1);
    // Nose
    squirrel.fillStyle(0x1f2937);
    squirrel.fillCircle(24, 11, 1);
    // Fluffy tail
    squirrel.fillStyle(0xb45309);
    squirrel.fillEllipse(4, 6, 5, 8);
    squirrel.fillStyle(0xd97706);
    squirrel.fillEllipse(4, 4, 3, 5);
    // Legs
    squirrel.fillStyle(0xb45309);
    squirrel.fillRect(10, 16, 2, 4);
    squirrel.fillRect(15, 16, 2, 4);
    // Front paws
    squirrel.fillRect(18, 14, 2, 3);
    squirrel.generateTexture("squirrel", 28, 22);
    squirrel.destroy();
  }

  private generateExtraDecorations(): void {
    // Flower - colorful pixel flower
    const flower = this.make.graphics({ x: 0, y: 0 });
    // Stem
    flower.fillStyle(0x22c55e);
    flower.fillRect(6, 8, 2, 12);
    // Leaves
    flower.fillStyle(0x16a34a);
    flower.fillRect(3, 12, 4, 3);
    flower.fillRect(7, 14, 4, 3);
    // Petals - random color per instance will be set in scene
    const petalColors = [0xef4444, 0xfbbf24, 0xec4899, 0x8b5cf6, 0x3b82f6];
    const petalColor = petalColors[Math.floor(Math.random() * petalColors.length)];
    flower.fillStyle(petalColor);
    flower.fillCircle(4, 4, 3);
    flower.fillCircle(10, 4, 3);
    flower.fillCircle(4, 8, 3);
    flower.fillCircle(10, 8, 3);
    // Center
    flower.fillStyle(0xfbbf24);
    flower.fillCircle(7, 6, 3);
    flower.generateTexture("flower", 14, 20);
    flower.destroy();

    // Rock - gray stone
    const rock = this.make.graphics({ x: 0, y: 0 });
    rock.fillStyle(0x6b7280);
    rock.fillEllipse(10, 8, 12, 8);
    rock.fillStyle(0x9ca3af);
    rock.fillEllipse(8, 6, 8, 5);
    rock.fillStyle(0x4b5563);
    rock.fillEllipse(12, 10, 6, 4);
    rock.generateTexture("rock", 20, 16);
    rock.destroy();

    // Fountain - decorative water fountain
    const fountain = this.make.graphics({ x: 0, y: 0 });
    // Base
    fountain.fillStyle(0x6b7280);
    fountain.fillRect(8, 28, 24, 8);
    fountain.fillStyle(0x9ca3af);
    fountain.fillRect(10, 26, 20, 4);
    // Middle tier
    fountain.fillStyle(0x78716c);
    fountain.fillRect(14, 18, 12, 10);
    fountain.fillStyle(0xa8a29e);
    fountain.fillRect(16, 16, 8, 4);
    // Top bowl
    fountain.fillStyle(0x6b7280);
    fountain.fillRect(12, 10, 16, 8);
    fountain.fillStyle(0x60a5fa, 0.7);
    fountain.fillRect(14, 12, 12, 4);
    // Spout
    fountain.fillStyle(0x9ca3af);
    fountain.fillRect(18, 4, 4, 8);
    // Water drops at top
    fountain.fillStyle(0x93c5fd);
    fountain.fillCircle(20, 2, 2);
    fountain.generateTexture("fountain", 40, 36);
    fountain.destroy();

    // Flag - waving flag on pole
    const flag = this.make.graphics({ x: 0, y: 0 });
    // Pole
    flag.fillStyle(0x78716c);
    flag.fillRect(2, 0, 3, 40);
    flag.fillStyle(0x9ca3af);
    flag.fillRect(3, 0, 1, 40);
    // Flag top ball
    flag.fillStyle(0xfbbf24);
    flag.fillCircle(3, 2, 3);
    // Flag fabric - BagsWorld green
    flag.fillStyle(0x4ade80);
    flag.fillRect(5, 4, 18, 12);
    flag.fillStyle(0x22c55e);
    flag.fillRect(5, 10, 18, 6);
    // B for Bags
    flag.fillStyle(0xffffff);
    flag.fillRect(10, 6, 6, 8);
    flag.fillRect(10, 6, 2, 8);
    flag.fillRect(10, 6, 6, 2);
    flag.fillRect(10, 9, 5, 2);
    flag.fillRect(10, 12, 6, 2);
    flag.generateTexture("flag", 24, 40);
    flag.destroy();

    // Pond - small water area
    const pond = this.make.graphics({ x: 0, y: 0 });
    // Water base
    pond.fillStyle(0x1e3a8a, 0.6);
    pond.fillEllipse(16, 10, 16, 10);
    pond.fillStyle(0x3b82f6, 0.5);
    pond.fillEllipse(16, 10, 12, 7);
    // Highlight/reflection
    pond.fillStyle(0x93c5fd, 0.4);
    pond.fillEllipse(12, 8, 6, 3);
    // Lily pad
    pond.fillStyle(0x22c55e);
    pond.fillCircle(20, 12, 3);
    pond.fillStyle(0x16a34a);
    pond.fillRect(20, 11, 3, 2);
    // Lily flower
    pond.fillStyle(0xfda4af);
    pond.fillCircle(21, 11, 2);
    pond.generateTexture("pond", 32, 20);
    pond.destroy();

    // Mushroom - cute pixel mushroom
    const mushroom = this.make.graphics({ x: 0, y: 0 });
    // Stem
    mushroom.fillStyle(0xfef3c7);
    mushroom.fillRect(4, 8, 6, 8);
    mushroom.fillStyle(0xfde68a);
    mushroom.fillRect(5, 8, 4, 8);
    // Cap
    mushroom.fillStyle(0xef4444);
    mushroom.fillEllipse(7, 6, 8, 6);
    // Spots
    mushroom.fillStyle(0xffffff);
    mushroom.fillCircle(5, 4, 2);
    mushroom.fillCircle(9, 5, 1.5);
    mushroom.fillCircle(7, 7, 1);
    mushroom.generateTexture("mushroom", 14, 16);
    mushroom.destroy();

    // Signpost
    const signpost = this.make.graphics({ x: 0, y: 0 });
    // Post
    signpost.fillStyle(0x78350f);
    signpost.fillRect(8, 10, 4, 20);
    signpost.fillStyle(0x92400e);
    signpost.fillRect(9, 10, 2, 20);
    // Sign board
    signpost.fillStyle(0xa16207);
    signpost.fillRect(0, 4, 20, 10);
    signpost.fillStyle(0xca8a04);
    signpost.fillRect(1, 5, 18, 8);
    // Arrow or text hint
    signpost.fillStyle(0x422006);
    signpost.fillRect(4, 8, 8, 2);
    signpost.fillTriangle(12, 6, 16, 9, 12, 12);
    signpost.generateTexture("signpost", 20, 30);
    signpost.destroy();
  }

  private generateAmbientParticles(): void {
    // Pollen/dust particle
    const pollen = this.make.graphics({ x: 0, y: 0 });
    pollen.fillStyle(0xfef3c7);
    pollen.fillCircle(2, 2, 2);
    pollen.fillStyle(0xffffff, 0.5);
    pollen.fillCircle(1.5, 1.5, 1);
    pollen.generateTexture("pollen", 4, 4);
    pollen.destroy();

    // Firefly - glowing particle for night
    const firefly = this.make.graphics({ x: 0, y: 0 });
    // Outer glow
    firefly.fillStyle(0xfde047, 0.3);
    firefly.fillCircle(6, 6, 6);
    firefly.fillStyle(0xfef08a, 0.5);
    firefly.fillCircle(6, 6, 4);
    // Core
    firefly.fillStyle(0xfef9c3);
    firefly.fillCircle(6, 6, 2);
    firefly.fillStyle(0xffffff);
    firefly.fillCircle(6, 6, 1);
    firefly.generateTexture("firefly", 12, 12);
    firefly.destroy();

    // Leaf particle
    const leaf = this.make.graphics({ x: 0, y: 0 });
    leaf.fillStyle(0x22c55e);
    leaf.fillEllipse(4, 3, 4, 3);
    leaf.fillStyle(0x16a34a);
    leaf.fillRect(3, 2, 1, 4);
    leaf.generateTexture("leaf", 8, 8);
    leaf.destroy();

    // Sparkle particle
    const sparkle = this.make.graphics({ x: 0, y: 0 });
    sparkle.fillStyle(0xffffff);
    sparkle.fillRect(3, 0, 2, 8);
    sparkle.fillRect(0, 3, 8, 2);
    sparkle.fillStyle(0xfef3c7);
    sparkle.fillRect(3, 3, 2, 2);
    sparkle.generateTexture("sparkle", 8, 8);
    sparkle.destroy();
  }
}
