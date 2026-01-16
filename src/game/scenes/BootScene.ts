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
    // Building styles by level - each level has a distinct look
    // Level 1: Small shop/startup (<$10K market cap)
    // Level 2: Growing business ($10K-$100K)
    // Level 3: Established company ($100K-$1M)
    // Level 4: Corporate tower ($1M-$10M)
    // Level 5: Skyscraper empire ($10M+)
    const buildingConfigs = [
      { base: 0x6b7280, roof: 0x9ca3af, accent: 0xfbbf24, height: 35, width: 28 }, // Level 1: Small gray shop
      { base: 0x3b82f6, roof: 0x60a5fa, accent: 0xfbbf24, height: 50, width: 32 }, // Level 2: Blue office
      { base: 0x8b5cf6, roof: 0xa78bfa, accent: 0x22d3d8, height: 68, width: 36 }, // Level 3: Purple corp
      { base: 0x1e3a8a, roof: 0x3b82f6, accent: 0xfbbf24, height: 90, width: 40 }, // Level 4: Blue tower
      { base: 0x0f172a, roof: 0x4ade80, accent: 0x4ade80, height: 120, width: 44 }, // Level 5: Bags green HQ
    ];

    for (let level = 1; level <= 5; level++) {
      const config = buildingConfigs[level - 1];
      const buildingGraphics = this.make.graphics({ x: 0, y: 0 });
      const bHeight = config.height;
      const bWidth = config.width;
      const canvasHeight = 130;

      // Shadow
      buildingGraphics.fillStyle(0x000000, 0.4);
      buildingGraphics.fillRect(6, canvasHeight - bHeight + 6, bWidth - 2, bHeight);

      // Building base
      buildingGraphics.fillStyle(config.base);
      buildingGraphics.fillRect(4, canvasHeight - bHeight, bWidth - 4, bHeight);

      // Lighter left side for 3D effect
      buildingGraphics.fillStyle(config.base + 0x222222);
      buildingGraphics.fillRect(4, canvasHeight - bHeight, 5, bHeight);

      // Darker right side
      buildingGraphics.fillStyle(config.base - 0x111111);
      buildingGraphics.fillRect(bWidth - 6, canvasHeight - bHeight, 6, bHeight);

      // Roof based on level
      if (level === 5) {
        // Skyscraper spire
        buildingGraphics.fillStyle(config.roof);
        buildingGraphics.fillTriangle(bWidth / 2 + 2, canvasHeight - bHeight - 20, 6, canvasHeight - bHeight, bWidth - 2, canvasHeight - bHeight);
        // Antenna
        buildingGraphics.fillStyle(0x9ca3af);
        buildingGraphics.fillRect(bWidth / 2, canvasHeight - bHeight - 30, 3, 15);
        // Blinking light
        buildingGraphics.fillStyle(0xef4444);
        buildingGraphics.fillCircle(bWidth / 2 + 1, canvasHeight - bHeight - 32, 2);
      } else if (level >= 3) {
        // Flat corporate roof with detail
        buildingGraphics.fillStyle(config.roof);
        buildingGraphics.fillRect(2, canvasHeight - bHeight - 6, bWidth, 8);
        buildingGraphics.fillStyle(config.roof - 0x111111);
        buildingGraphics.fillRect(2, canvasHeight - bHeight - 2, bWidth, 4);
      } else {
        // Simple angled roof for smaller buildings
        buildingGraphics.fillStyle(config.roof);
        buildingGraphics.fillRect(0, canvasHeight - bHeight - 4, bWidth + 2, 6);
      }

      // Windows - number based on building size
      const windowRows = Math.min(level + 1, 6);
      const windowCols = level >= 4 ? 3 : 2;
      const windowWidth = 6;
      const windowHeight = 5;
      const windowSpacingY = 12;
      const windowSpacingX = (bWidth - 8 - windowCols * windowWidth) / (windowCols - 1) + windowWidth;

      for (let row = 0; row < windowRows; row++) {
        for (let col = 0; col < windowCols; col++) {
          const wx = 8 + col * windowSpacingX;
          const wy = canvasHeight - bHeight + 10 + row * windowSpacingY;

          // Window glow
          buildingGraphics.fillStyle(config.accent, 0.3);
          buildingGraphics.fillRect(wx - 1, wy - 1, windowWidth + 2, windowHeight + 2);

          // Window
          buildingGraphics.fillStyle(config.accent);
          buildingGraphics.fillRect(wx, wy, windowWidth, windowHeight);

          // Window cross frame
          buildingGraphics.fillStyle(config.base - 0x222222);
          buildingGraphics.fillRect(wx + windowWidth / 2 - 1, wy, 1, windowHeight);
        }
      }

      // Door
      const doorWidth = Math.min(10, bWidth / 4);
      const doorHeight = 12;
      const doorX = (bWidth - doorWidth) / 2 + 2;
      buildingGraphics.fillStyle(0x1f2937);
      buildingGraphics.fillRect(doorX, canvasHeight - doorHeight, doorWidth, doorHeight);
      buildingGraphics.fillStyle(config.accent);
      buildingGraphics.fillRect(doorX + doorWidth - 3, canvasHeight - doorHeight / 2, 2, 2);

      // Level indicator sign for level 3+
      if (level >= 3) {
        buildingGraphics.fillStyle(0x1f2937);
        buildingGraphics.fillRect(doorX - 4, canvasHeight - doorHeight - 8, doorWidth + 8, 6);
        buildingGraphics.fillStyle(config.accent);
        buildingGraphics.fillRect(doorX - 2, canvasHeight - doorHeight - 7, doorWidth + 4, 4);
      }

      // Special decorations for level 5
      if (level === 5) {
        // Side pillars
        buildingGraphics.fillStyle(0x374151);
        buildingGraphics.fillRect(2, canvasHeight - bHeight + 10, 3, bHeight - 10);
        buildingGraphics.fillRect(bWidth - 1, canvasHeight - bHeight + 10, 3, bHeight - 10);
      }

      buildingGraphics.generateTexture(`building_${level}`, 50, canvasHeight);
      buildingGraphics.destroy();
    }
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
    // Rain drop
    const rainGraphics = this.make.graphics({ x: 0, y: 0 });
    rainGraphics.fillStyle(0x60a5fa);
    rainGraphics.fillRect(1, 0, 2, 6);
    rainGraphics.fillStyle(0x93c5fd);
    rainGraphics.fillRect(1, 0, 1, 2);
    rainGraphics.generateTexture("rain", 4, 8);
    rainGraphics.destroy();

    // Sun with rays
    const sunGraphics = this.make.graphics({ x: 0, y: 0 });
    sunGraphics.fillStyle(0xfbbf24, 0.3);
    sunGraphics.fillCircle(16, 16, 16);
    sunGraphics.fillStyle(0xfbbf24, 0.6);
    sunGraphics.fillCircle(16, 16, 12);
    sunGraphics.fillStyle(0xfbbf24);
    sunGraphics.fillCircle(16, 16, 8);
    sunGraphics.fillStyle(0xfef3c7);
    sunGraphics.fillCircle(14, 14, 3);
    sunGraphics.generateTexture("sun", 32, 32);
    sunGraphics.destroy();

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
}
