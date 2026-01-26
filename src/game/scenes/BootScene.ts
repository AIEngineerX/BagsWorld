import * as Phaser from "phaser";

// Scale factor for higher resolution sprites (1.6x for 1280x960 canvas)
const SCALE = 1.6;

// ========================================
// BAGSWORLD PIXEL ART PALETTE (32 colors)
// Cohesive retro palette for consistent visuals
// ========================================
const PALETTE = {
  // Backgrounds & Darks
  void: 0x0a0a0f, // Darkest - UI backgrounds
  night: 0x1a1a2e, // Dark blue-black
  shadow: 0x16213e, // Shadow blue

  // Grays (buildings, concrete)
  darkGray: 0x1f2937,
  gray: 0x374151,
  midGray: 0x4b5563,
  lightGray: 0x6b7280,
  silver: 0x9ca3af,

  // Greens (nature, Bags brand, success)
  darkGreen: 0x14532d,
  forest: 0x166534,
  green: 0x22c55e,
  bagsGreen: 0x4ade80, // Primary brand color
  mint: 0x86efac,

  // Blues (water, tech, corporate)
  navy: 0x1e3a8a,
  blue: 0x2563eb,
  sky: 0x3b82f6,
  lightBlue: 0x60a5fa,
  cyan: 0x06b6d4,

  // Purples (casino, premium, Solana)
  deepPurple: 0x2d1b4e,
  purple: 0x7c3aed,
  violet: 0x8b5cf6,
  lavender: 0xa855f7,
  solanaPurple: 0x9945ff,

  // Warm colors (alerts, highlights)
  darkRed: 0x991b1b,
  red: 0xdc2626,
  brightRed: 0xef4444,
  orange: 0xf97316,
  amber: 0xf59e0b,
  gold: 0xfbbf24,
  yellow: 0xfde047,

  // Skin tones
  skinLight: 0xffdbac,
  skinTan: 0xf1c27d,
  skinMedium: 0xe0ac69,
  skinOlive: 0xc68642,
  skinBrown: 0x8d5524,
  skinDark: 0x5c3317,

  // Utility
  white: 0xffffff,
  cream: 0xfef3c7,
  brown: 0x78350f,
  darkBrown: 0x451a03,
};

// Skin tone palette for diversity
const SKIN_TONES = [
  PALETTE.skinLight,
  PALETTE.skinTan,
  PALETTE.skinMedium,
  PALETTE.skinOlive,
  PALETTE.skinBrown,
  PALETTE.skinDark,
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
  PALETTE.lavender, // Purple (dyed)
];

// Shirt colors
const SHIRT_COLORS = [
  PALETTE.bagsGreen,
  PALETTE.sky,
  PALETTE.brightRed,
  PALETTE.gold,
  PALETTE.lavender,
  0xec4899, // Pink
  PALETTE.cyan,
  PALETTE.orange,
  PALETTE.lightGray,
];

// ========================================
// PIXEL ART HELPER FUNCTIONS
// ========================================

// Darken a color by a percentage (0-1)
function darken(color: number, amount: number): number {
  const r = Math.max(0, ((color >> 16) & 0xff) * (1 - amount));
  const g = Math.max(0, ((color >> 8) & 0xff) * (1 - amount));
  const b = Math.max(0, (color & 0xff) * (1 - amount));
  return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
}

// Lighten a color by a percentage (0-1)
function lighten(color: number, amount: number): number {
  const r = Math.min(255, ((color >> 16) & 0xff) + (255 - ((color >> 16) & 0xff)) * amount);
  const g = Math.min(255, ((color >> 8) & 0xff) + (255 - ((color >> 8) & 0xff)) * amount);
  const b = Math.min(255, (color & 0xff) + (255 - (color & 0xff)) * amount);
  return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Create stylish loading screen (solid color to prevent flash)
    const loadingBg = this.add.graphics();
    loadingBg.fillStyle(0x0a0a0f, 1);
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
    this.generateTradingGym();
    this.generateCasino();
    this.generateTradingTerminal();
    this.generateBagsWorldHQ();

    // Generate Ballers Valley mansions (for top BagsWorld token holders)
    this.generateMansions();

    // Generate Ballers Valley luxury props (gold fountain, lamps, topiaries, etc.)
    this.generateBallersProps();

    // Generate Academy zone buildings (Hogwarts-style campus)
    this.generateAcademyBuildings();

    // Generate Sniper Tower for Academy zone
    this.generateSniperTower();

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

    // Generate Launch Pad zone assets (NYC Times Square style)
    this.generateLaunchPadAssets();

    // Generate Founder's Corner zone assets (cozy workshop/educational hub)
    this.generateFoundersAssets();

    // Generate Tech Labs zone assets (futuristic R&D headquarters)
    this.generateLabsAssets();
  }

  private generateGrass(): void {
    const size = Math.round(32 * SCALE);
    const grassGraphics = this.make.graphics({ x: 0, y: 0 });

    // Base grass
    grassGraphics.fillStyle(0x1a472a);
    grassGraphics.fillRect(0, 0, size, size);

    // Grass variation - more blades for higher resolution
    grassGraphics.fillStyle(0x2d5a3d);
    const bladeCount = Math.round(12 * SCALE);
    for (let i = 0; i < bladeCount; i++) {
      const x = Math.floor(Math.random() * (size - 4));
      const y = Math.floor(Math.random() * (size - 6));
      grassGraphics.fillRect(x, y, Math.round(2 * SCALE), Math.round(4 * SCALE));
    }

    // Occasional flowers
    grassGraphics.fillStyle(0xfbbf24);
    grassGraphics.fillRect(
      Math.round(8 * SCALE),
      Math.round(12 * SCALE),
      Math.round(3 * SCALE),
      Math.round(3 * SCALE)
    );
    grassGraphics.fillStyle(0xef4444);
    grassGraphics.fillRect(
      Math.round(20 * SCALE),
      Math.round(8 * SCALE),
      Math.round(3 * SCALE),
      Math.round(3 * SCALE)
    );

    grassGraphics.generateTexture("grass", size, size);
    grassGraphics.destroy();

    // Dark grass variant
    const darkGrass = this.make.graphics({ x: 0, y: 0 });
    darkGrass.fillStyle(0x14532d);
    darkGrass.fillRect(0, 0, size, size);
    darkGrass.fillStyle(0x1a472a);
    for (let i = 0; i < Math.round(8 * SCALE); i++) {
      const x = Math.floor(Math.random() * (size - 5));
      const y = Math.floor(Math.random() * (size - 5));
      darkGrass.fillRect(x, y, Math.round(3 * SCALE), Math.round(3 * SCALE));
    }
    darkGrass.generateTexture("grass_dark", size, size);
    darkGrass.destroy();
  }

  private generatePath(): void {
    const size = Math.round(32 * SCALE);
    const pathGraphics = this.make.graphics({ x: 0, y: 0 });
    pathGraphics.fillStyle(0x78716c);
    pathGraphics.fillRect(0, 0, size, size);
    pathGraphics.fillStyle(0x57534e);
    for (let i = 0; i < Math.round(6 * SCALE); i++) {
      const x = Math.floor(Math.random() * (size - 10));
      const y = Math.floor(Math.random() * (size - 10));
      pathGraphics.fillRect(x, y, Math.round(6 * SCALE), Math.round(6 * SCALE));
    }
    pathGraphics.generateTexture("path", size, size);
    pathGraphics.destroy();
  }

  private generateBuildings(): void {
    // Building style packs - 4 unique styles per level for visual diversity
    // Each token gets a deterministic style based on its mint address
    const s = SCALE;

    // Level 1: Small Shops (<$100K market cap)
    const level1Styles = [
      {
        name: "corner_store",
        base: PALETTE.violet,
        roof: PALETTE.gold,
        accent: PALETTE.gold,
        awningColor: PALETTE.brightRed,
      },
      {
        name: "taco_stand",
        base: PALETTE.cream,
        roof: PALETTE.orange,
        accent: PALETTE.orange,
        awningColor: PALETTE.brightRed,
      },
      {
        name: "coffee_shop",
        base: PALETTE.brown,
        roof: PALETTE.cream,
        accent: PALETTE.amber,
        awningColor: PALETTE.darkBrown,
      },
      {
        name: "arcade",
        base: PALETTE.night,
        roof: PALETTE.lavender,
        accent: PALETTE.cyan,
        awningColor: PALETTE.solanaPurple,
      },
    ];

    // Level 2: Office Buildings ($100K-$500K)
    const level2Styles = [
      { name: "tech_startup", base: PALETTE.sky, roof: PALETTE.navy, accent: PALETTE.lightBlue },
      { name: "law_office", base: PALETTE.gray, roof: PALETTE.darkGray, accent: PALETTE.silver },
      { name: "coworking", base: PALETTE.cream, roof: PALETTE.orange, accent: PALETTE.amber },
      {
        name: "design_studio",
        base: PALETTE.lavender,
        roof: PALETTE.deepPurple,
        accent: PALETTE.violet,
      },
    ];

    // Level 3: Corporate Buildings ($500K-$2M)
    const level3Styles = [
      {
        name: "corporate_hq",
        base: PALETTE.gray,
        roof: PALETTE.bagsGreen,
        accent: PALETTE.bagsGreen,
      },
      { name: "bank", base: PALETTE.cream, roof: PALETTE.gold, accent: PALETTE.amber },
      { name: "media_tower", base: PALETTE.sky, roof: PALETTE.navy, accent: PALETTE.cyan },
      { name: "pharma_lab", base: PALETTE.white, roof: PALETTE.cyan, accent: PALETTE.lightBlue },
    ];

    // Level 4: Towers ($2M-$10M)
    const level4Styles = [
      { name: "modern_tower", base: PALETTE.navy, roof: PALETTE.lightBlue, accent: PALETTE.gold },
      { name: "art_deco", base: PALETTE.night, roof: PALETTE.gold, accent: PALETTE.amber },
      { name: "glass_spire", base: PALETTE.sky, roof: PALETTE.cyan, accent: PALETTE.white },
      {
        name: "tech_campus",
        base: PALETTE.darkGreen,
        roof: PALETTE.bagsGreen,
        accent: PALETTE.mint,
      },
    ];

    // Level 5: Skyscrapers ($10M+)
    const level5Styles = [
      { name: "bags_hq", base: PALETTE.night, roof: PALETTE.bagsGreen, accent: PALETTE.bagsGreen },
      { name: "diamond_tower", base: PALETTE.navy, roof: PALETTE.cyan, accent: PALETTE.lightBlue },
      { name: "gold_citadel", base: PALETTE.night, roof: PALETTE.gold, accent: PALETTE.amber },
      {
        name: "neon_megacorp",
        base: PALETTE.deepPurple,
        roof: PALETTE.solanaPurple,
        accent: PALETTE.lavender,
      },
    ];

    const allLevelStyles = [level1Styles, level2Styles, level3Styles, level4Styles, level5Styles];
    const levelDimensions = [
      { height: Math.round(40 * s), width: Math.round(30 * s) }, // Level 1
      { height: Math.round(55 * s), width: Math.round(34 * s) }, // Level 2
      { height: Math.round(75 * s), width: Math.round(38 * s) }, // Level 3
      { height: Math.round(100 * s), width: Math.round(42 * s) }, // Level 4
      { height: Math.round(130 * s), width: Math.round(48 * s) }, // Level 5
    ];

    for (let level = 1; level <= 5; level++) {
      const styles = allLevelStyles[level - 1];
      const dims = levelDimensions[level - 1];

      for (let styleIndex = 0; styleIndex < styles.length; styleIndex++) {
        const style = styles[styleIndex];
        const g = this.make.graphics({ x: 0, y: 0 });
        const bHeight = dims.height;
        const bWidth = dims.width;
        const canvasHeight = Math.round(190 * s);
        const canvasWidth = Math.round(55 * s);

        // Drop shadow
        g.fillStyle(PALETTE.void, 0.5);
        g.fillRect(
          Math.round(6 * s),
          canvasHeight - bHeight + Math.round(6 * s),
          bWidth - Math.round(2 * s),
          bHeight
        );

        // Building base
        g.fillStyle(style.base);
        g.fillRect(Math.round(4 * s), canvasHeight - bHeight, bWidth - Math.round(4 * s), bHeight);

        // Highlight left edge
        g.fillStyle(lighten(style.base, 0.2));
        g.fillRect(Math.round(4 * s), canvasHeight - bHeight, Math.round(6 * s), bHeight);

        // Shadow right edge
        g.fillStyle(darken(style.base, 0.25));
        g.fillRect(bWidth - Math.round(6 * s), canvasHeight - bHeight, Math.round(6 * s), bHeight);

        // Dithering pattern for texture
        g.fillStyle(darken(style.base, 0.08));
        for (let py = 0; py < bHeight; py += Math.round(4 * s)) {
          for (
            let px = Math.round(10 * s);
            px < bWidth - Math.round(10 * s);
            px += Math.round(8 * s)
          ) {
            if ((py / Math.round(4 * s) + px / Math.round(8 * s)) % 2 === 0) {
              g.fillRect(
                Math.round(4 * s) + px,
                canvasHeight - bHeight + py,
                Math.round(2 * s),
                Math.round(2 * s)
              );
            }
          }
        }

        // Level-specific decorations
        if (level === 1) {
          this.drawLevel1Roof(g, style, bWidth, bHeight, canvasHeight, s);
        } else if (level === 2) {
          this.drawLevel2Roof(g, style, styleIndex, bWidth, bHeight, canvasHeight, s);
        } else if (level === 3) {
          this.drawLevel3Roof(g, style, styleIndex, bWidth, bHeight, canvasHeight, s);
        } else if (level === 4) {
          this.drawLevel4Roof(g, style, styleIndex, bWidth, bHeight, canvasHeight, s);
        } else if (level === 5) {
          this.drawLevel5Roof(g, style, styleIndex, bWidth, bHeight, canvasHeight, s);
        }

        // Windows
        this.drawWindows(g, style, level, bWidth, bHeight, canvasHeight, s);

        // Door
        this.drawDoor(g, style, level, bWidth, canvasHeight, s);

        g.generateTexture(`building_${level}_${styleIndex}`, canvasWidth, canvasHeight);
        g.destroy();
      }
    }
  }

  private drawLevel1Roof(
    g: Phaser.GameObjects.Graphics,
    style: any,
    bWidth: number,
    bHeight: number,
    canvasHeight: number,
    s: number
  ): void {
    const awningColor = style.awningColor || PALETTE.brightRed;

    // Awning roof
    g.fillStyle(style.roof);
    g.fillRect(
      0,
      canvasHeight - bHeight - Math.round(6 * s),
      bWidth + Math.round(4 * s),
      Math.round(8 * s)
    );
    g.fillStyle(lighten(style.roof, 0.15));
    g.fillRect(
      0,
      canvasHeight - bHeight - Math.round(6 * s),
      bWidth + Math.round(4 * s),
      Math.round(2 * s)
    );

    // Awning stripes
    g.fillStyle(awningColor);
    for (let i = 0; i < bWidth; i += Math.round(8 * s)) {
      g.fillRect(
        i,
        canvasHeight - bHeight - Math.round(5 * s),
        Math.round(4 * s),
        Math.round(6 * s)
      );
    }

    // Shop sign
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(
      Math.round(6 * s),
      canvasHeight - bHeight + Math.round(4 * s),
      bWidth - Math.round(12 * s),
      Math.round(8 * s)
    );
    g.fillStyle(style.accent);
    g.fillRect(
      Math.round(8 * s),
      canvasHeight - bHeight + Math.round(5 * s),
      bWidth - Math.round(16 * s),
      Math.round(6 * s)
    );
  }

  private drawLevel2Roof(
    g: Phaser.GameObjects.Graphics,
    style: any,
    styleIndex: number,
    bWidth: number,
    bHeight: number,
    canvasHeight: number,
    s: number
  ): void {
    // Flat roof base
    g.fillStyle(style.roof);
    g.fillRect(
      Math.round(2 * s),
      canvasHeight - bHeight - Math.round(4 * s),
      bWidth,
      Math.round(6 * s)
    );
    g.fillStyle(lighten(style.roof, 0.2));
    g.fillRect(
      Math.round(2 * s),
      canvasHeight - bHeight - Math.round(4 * s),
      bWidth,
      Math.round(2 * s)
    );

    // Style-specific roof details
    if (styleIndex === 0) {
      // Tech startup - satellite dish
      g.fillStyle(PALETTE.lightGray);
      g.fillCircle(
        bWidth - Math.round(8 * s),
        canvasHeight - bHeight - Math.round(8 * s),
        Math.round(5 * s)
      );
      g.fillStyle(PALETTE.silver);
      g.fillCircle(
        bWidth - Math.round(8 * s),
        canvasHeight - bHeight - Math.round(8 * s),
        Math.round(3 * s)
      );
    } else if (styleIndex === 1) {
      // Law office - brick chimney
      g.fillStyle(PALETTE.darkRed);
      g.fillRect(
        bWidth - Math.round(10 * s),
        canvasHeight - bHeight - Math.round(12 * s),
        Math.round(6 * s),
        Math.round(10 * s)
      );
      g.fillStyle(lighten(PALETTE.darkRed, 0.15));
      g.fillRect(
        bWidth - Math.round(10 * s),
        canvasHeight - bHeight - Math.round(12 * s),
        Math.round(2 * s),
        Math.round(10 * s)
      );
    } else if (styleIndex === 2) {
      // Coworking - rooftop garden
      g.fillStyle(PALETTE.forest);
      g.fillRect(
        Math.round(6 * s),
        canvasHeight - bHeight - Math.round(8 * s),
        Math.round(10 * s),
        Math.round(5 * s)
      );
      g.fillStyle(PALETTE.bagsGreen);
      g.fillCircle(
        Math.round(8 * s),
        canvasHeight - bHeight - Math.round(10 * s),
        Math.round(3 * s)
      );
      g.fillCircle(
        Math.round(14 * s),
        canvasHeight - bHeight - Math.round(9 * s),
        Math.round(2 * s)
      );
    } else {
      // Design studio - colorful skylights
      g.fillStyle(PALETTE.cyan);
      g.fillRect(
        Math.round(8 * s),
        canvasHeight - bHeight - Math.round(6 * s),
        Math.round(4 * s),
        Math.round(3 * s)
      );
      g.fillStyle(PALETTE.lavender);
      g.fillRect(
        Math.round(14 * s),
        canvasHeight - bHeight - Math.round(6 * s),
        Math.round(4 * s),
        Math.round(3 * s)
      );
      g.fillStyle(PALETTE.amber);
      g.fillRect(
        Math.round(20 * s),
        canvasHeight - bHeight - Math.round(6 * s),
        Math.round(4 * s),
        Math.round(3 * s)
      );
    }
  }

  private drawLevel3Roof(
    g: Phaser.GameObjects.Graphics,
    style: any,
    styleIndex: number,
    bWidth: number,
    bHeight: number,
    canvasHeight: number,
    s: number
  ): void {
    // Base roof
    g.fillStyle(style.roof);
    g.fillRect(
      Math.round(2 * s),
      canvasHeight - bHeight - Math.round(8 * s),
      bWidth,
      Math.round(10 * s)
    );
    g.fillStyle(lighten(style.roof, 0.15));
    g.fillRect(
      Math.round(2 * s),
      canvasHeight - bHeight - Math.round(8 * s),
      bWidth,
      Math.round(3 * s)
    );

    if (styleIndex === 0) {
      // Corporate HQ - helipad
      g.fillStyle(style.accent);
      g.fillRect(
        bWidth / 2 - Math.round(6 * s),
        canvasHeight - bHeight - Math.round(14 * s),
        Math.round(16 * s),
        Math.round(8 * s)
      );
      g.fillStyle(PALETTE.white);
      g.fillCircle(
        bWidth / 2 + Math.round(2 * s),
        canvasHeight - bHeight - Math.round(4 * s),
        Math.round(6 * s)
      );
      g.fillStyle(style.roof);
      g.fillCircle(
        bWidth / 2 + Math.round(2 * s),
        canvasHeight - bHeight - Math.round(4 * s),
        Math.round(4 * s)
      );
    } else if (styleIndex === 1) {
      // Bank - columns and dome
      g.fillStyle(PALETTE.gold);
      g.fillRect(
        Math.round(8 * s),
        canvasHeight - bHeight - Math.round(16 * s),
        bWidth - Math.round(12 * s),
        Math.round(10 * s)
      );
      g.fillStyle(lighten(PALETTE.gold, 0.2));
      g.fillTriangle(
        bWidth / 2 + Math.round(2 * s),
        canvasHeight - bHeight - Math.round(22 * s),
        Math.round(8 * s),
        canvasHeight - bHeight - Math.round(14 * s),
        bWidth - Math.round(4 * s),
        canvasHeight - bHeight - Math.round(14 * s)
      );
    } else if (styleIndex === 2) {
      // Media tower - antenna array
      g.fillStyle(PALETTE.silver);
      g.fillRect(
        bWidth / 2 - Math.round(1 * s),
        canvasHeight - bHeight - Math.round(20 * s),
        Math.round(3 * s),
        Math.round(14 * s)
      );
      g.fillRect(
        bWidth / 2 - Math.round(6 * s),
        canvasHeight - bHeight - Math.round(14 * s),
        Math.round(2 * s),
        Math.round(8 * s)
      );
      g.fillRect(
        bWidth / 2 + Math.round(5 * s),
        canvasHeight - bHeight - Math.round(14 * s),
        Math.round(2 * s),
        Math.round(8 * s)
      );
      g.fillStyle(PALETTE.brightRed);
      g.fillCircle(bWidth / 2, canvasHeight - bHeight - Math.round(21 * s), Math.round(2 * s));
    } else {
      // Pharma lab - clean dome
      g.fillStyle(PALETTE.white);
      g.fillCircle(
        bWidth / 2 + Math.round(2 * s),
        canvasHeight - bHeight - Math.round(10 * s),
        Math.round(10 * s)
      );
      g.fillStyle(style.accent);
      g.fillCircle(
        bWidth / 2 + Math.round(2 * s),
        canvasHeight - bHeight - Math.round(10 * s),
        Math.round(6 * s)
      );
      g.fillStyle(lighten(PALETTE.white, 0.3));
      g.fillCircle(
        bWidth / 2 - Math.round(2 * s),
        canvasHeight - bHeight - Math.round(12 * s),
        Math.round(3 * s)
      );
    }
  }

  private drawLevel4Roof(
    g: Phaser.GameObjects.Graphics,
    style: any,
    styleIndex: number,
    bWidth: number,
    bHeight: number,
    canvasHeight: number,
    s: number
  ): void {
    if (styleIndex === 0) {
      // Modern tower - stepped
      g.fillStyle(style.roof);
      g.fillRect(
        Math.round(6 * s),
        canvasHeight - bHeight - Math.round(10 * s),
        bWidth - Math.round(8 * s),
        Math.round(12 * s)
      );
      g.fillRect(
        Math.round(10 * s),
        canvasHeight - bHeight - Math.round(18 * s),
        bWidth - Math.round(16 * s),
        Math.round(10 * s)
      );
      g.fillRect(
        Math.round(14 * s),
        canvasHeight - bHeight - Math.round(24 * s),
        bWidth - Math.round(24 * s),
        Math.round(8 * s)
      );
      g.fillStyle(lighten(style.roof, 0.2));
      g.fillRect(
        Math.round(6 * s),
        canvasHeight - bHeight - Math.round(10 * s),
        bWidth - Math.round(8 * s),
        Math.round(2 * s)
      );
      g.fillRect(
        Math.round(10 * s),
        canvasHeight - bHeight - Math.round(18 * s),
        bWidth - Math.round(16 * s),
        Math.round(2 * s)
      );
      // Antenna
      g.fillStyle(PALETTE.silver);
      g.fillRect(
        bWidth / 2,
        canvasHeight - bHeight - Math.round(32 * s),
        Math.round(2 * s),
        Math.round(12 * s)
      );
      g.fillStyle(PALETTE.brightRed);
      g.fillCircle(
        bWidth / 2 + Math.round(1 * s),
        canvasHeight - bHeight - Math.round(34 * s),
        Math.round(2 * s)
      );
    } else if (styleIndex === 1) {
      // Art deco - ornate crown
      g.fillStyle(style.roof);
      g.fillRect(
        Math.round(4 * s),
        canvasHeight - bHeight - Math.round(12 * s),
        bWidth - Math.round(4 * s),
        Math.round(14 * s)
      );
      g.fillStyle(style.accent);
      // Deco spires
      g.fillRect(
        Math.round(6 * s),
        canvasHeight - bHeight - Math.round(22 * s),
        Math.round(4 * s),
        Math.round(12 * s)
      );
      g.fillRect(
        bWidth / 2 - Math.round(2 * s),
        canvasHeight - bHeight - Math.round(28 * s),
        Math.round(6 * s),
        Math.round(18 * s)
      );
      g.fillRect(
        bWidth - Math.round(8 * s),
        canvasHeight - bHeight - Math.round(22 * s),
        Math.round(4 * s),
        Math.round(12 * s)
      );
      g.fillStyle(lighten(style.accent, 0.3));
      g.fillCircle(
        bWidth / 2 + Math.round(1 * s),
        canvasHeight - bHeight - Math.round(30 * s),
        Math.round(4 * s)
      );
    } else if (styleIndex === 2) {
      // Glass spire - pointed
      g.fillStyle(style.roof);
      g.fillTriangle(
        bWidth / 2 + Math.round(2 * s),
        canvasHeight - bHeight - Math.round(35 * s),
        Math.round(8 * s),
        canvasHeight - bHeight,
        bWidth - Math.round(4 * s),
        canvasHeight - bHeight
      );
      g.fillStyle(lighten(style.roof, 0.3));
      g.fillTriangle(
        bWidth / 2,
        canvasHeight - bHeight - Math.round(30 * s),
        Math.round(10 * s),
        canvasHeight - bHeight - Math.round(5 * s),
        bWidth / 2,
        canvasHeight - bHeight - Math.round(5 * s)
      );
      g.fillStyle(style.accent);
      g.fillCircle(
        bWidth / 2 + Math.round(2 * s),
        canvasHeight - bHeight - Math.round(36 * s),
        Math.round(3 * s)
      );
    } else {
      // Tech campus - green roof
      g.fillStyle(style.roof);
      g.fillRect(
        Math.round(4 * s),
        canvasHeight - bHeight - Math.round(10 * s),
        bWidth - Math.round(4 * s),
        Math.round(12 * s)
      );
      // Solar panels
      g.fillStyle(PALETTE.navy);
      for (let i = 0; i < 3; i++) {
        g.fillRect(
          Math.round((8 + i * 10) * s),
          canvasHeight - bHeight - Math.round(16 * s),
          Math.round(8 * s),
          Math.round(6 * s)
        );
        g.fillStyle(lighten(PALETTE.navy, 0.2));
        g.fillRect(
          Math.round((8 + i * 10) * s),
          canvasHeight - bHeight - Math.round(16 * s),
          Math.round(8 * s),
          Math.round(1 * s)
        );
        g.fillStyle(PALETTE.navy);
      }
      // Green area
      g.fillStyle(PALETTE.forest);
      g.fillRect(
        Math.round(6 * s),
        canvasHeight - bHeight - Math.round(8 * s),
        Math.round(6 * s),
        Math.round(4 * s)
      );
    }
  }

  private drawLevel5Roof(
    g: Phaser.GameObjects.Graphics,
    style: any,
    styleIndex: number,
    bWidth: number,
    bHeight: number,
    canvasHeight: number,
    s: number
  ): void {
    if (styleIndex === 0) {
      // Bags HQ - grand spire
      g.fillStyle(style.roof);
      g.fillTriangle(
        bWidth / 2 + Math.round(2 * s),
        canvasHeight - bHeight - Math.round(30 * s),
        Math.round(8 * s),
        canvasHeight - bHeight,
        bWidth - Math.round(4 * s),
        canvasHeight - bHeight
      );
      g.fillStyle(lighten(style.roof, 0.25));
      g.fillRect(
        Math.round(8 * s),
        canvasHeight - bHeight - Math.round(5 * s),
        Math.round(10 * s),
        Math.round(5 * s)
      );
      g.fillStyle(style.accent);
      g.fillRect(
        bWidth / 2 - Math.round(1 * s),
        canvasHeight - bHeight - Math.round(45 * s),
        Math.round(6 * s),
        Math.round(20 * s)
      );
      g.fillStyle(PALETTE.gold);
      g.fillCircle(
        bWidth / 2 + Math.round(2 * s),
        canvasHeight - bHeight - Math.round(48 * s),
        Math.round(4 * s)
      );
      g.fillStyle(lighten(PALETTE.gold, 0.3));
      g.fillCircle(
        bWidth / 2 + Math.round(1 * s),
        canvasHeight - bHeight - Math.round(49 * s),
        Math.round(2 * s)
      );
      g.fillStyle(PALETTE.brightRed);
      g.fillCircle(
        bWidth / 2 + Math.round(2 * s),
        canvasHeight - bHeight - Math.round(50 * s),
        Math.round(2 * s)
      );
      // Side spires
      g.fillStyle(style.roof);
      g.fillRect(
        Math.round(8 * s),
        canvasHeight - bHeight - Math.round(15 * s),
        Math.round(4 * s),
        Math.round(18 * s)
      );
      g.fillRect(
        bWidth - Math.round(8 * s),
        canvasHeight - bHeight - Math.round(15 * s),
        Math.round(4 * s),
        Math.round(18 * s)
      );
    } else if (styleIndex === 1) {
      // Diamond tower - crystal top
      g.fillStyle(style.roof);
      g.fillRect(
        Math.round(6 * s),
        canvasHeight - bHeight - Math.round(15 * s),
        bWidth - Math.round(8 * s),
        Math.round(17 * s)
      );
      // Crystal spire
      g.fillStyle(style.accent);
      g.fillTriangle(
        bWidth / 2 + Math.round(2 * s),
        canvasHeight - bHeight - Math.round(45 * s),
        Math.round(12 * s),
        canvasHeight - bHeight - Math.round(15 * s),
        bWidth - Math.round(8 * s),
        canvasHeight - bHeight - Math.round(15 * s)
      );
      g.fillStyle(lighten(style.accent, 0.4));
      g.fillTriangle(
        bWidth / 2,
        canvasHeight - bHeight - Math.round(40 * s),
        Math.round(14 * s),
        canvasHeight - bHeight - Math.round(18 * s),
        bWidth / 2,
        canvasHeight - bHeight - Math.round(18 * s)
      );
      // Diamond gem
      g.fillStyle(PALETTE.white);
      g.fillCircle(
        bWidth / 2 + Math.round(2 * s),
        canvasHeight - bHeight - Math.round(47 * s),
        Math.round(5 * s)
      );
      g.fillStyle(style.accent);
      g.fillCircle(
        bWidth / 2 + Math.round(2 * s),
        canvasHeight - bHeight - Math.round(47 * s),
        Math.round(3 * s)
      );
    } else if (styleIndex === 2) {
      // Gold citadel - crown
      g.fillStyle(style.roof);
      g.fillRect(
        Math.round(4 * s),
        canvasHeight - bHeight - Math.round(12 * s),
        bWidth - Math.round(4 * s),
        Math.round(14 * s)
      );
      // Crown spires
      g.fillStyle(style.accent);
      g.fillRect(
        Math.round(8 * s),
        canvasHeight - bHeight - Math.round(30 * s),
        Math.round(4 * s),
        Math.round(20 * s)
      );
      g.fillRect(
        bWidth / 2 - Math.round(2 * s),
        canvasHeight - bHeight - Math.round(40 * s),
        Math.round(6 * s),
        Math.round(30 * s)
      );
      g.fillRect(
        bWidth - Math.round(10 * s),
        canvasHeight - bHeight - Math.round(30 * s),
        Math.round(4 * s),
        Math.round(20 * s)
      );
      // Gold orbs
      g.fillStyle(PALETTE.gold);
      g.fillCircle(
        Math.round(10 * s),
        canvasHeight - bHeight - Math.round(32 * s),
        Math.round(3 * s)
      );
      g.fillCircle(
        bWidth / 2 + Math.round(1 * s),
        canvasHeight - bHeight - Math.round(43 * s),
        Math.round(4 * s)
      );
      g.fillCircle(
        bWidth - Math.round(8 * s),
        canvasHeight - bHeight - Math.round(32 * s),
        Math.round(3 * s)
      );
    } else {
      // Neon megacorp - holographic
      g.fillStyle(style.roof);
      g.fillRect(
        Math.round(6 * s),
        canvasHeight - bHeight - Math.round(10 * s),
        bWidth - Math.round(8 * s),
        Math.round(12 * s)
      );
      g.fillRect(
        Math.round(10 * s),
        canvasHeight - bHeight - Math.round(20 * s),
        bWidth - Math.round(16 * s),
        Math.round(12 * s)
      );
      // Neon spire
      g.fillStyle(style.accent);
      g.fillRect(
        bWidth / 2 - Math.round(3 * s),
        canvasHeight - bHeight - Math.round(45 * s),
        Math.round(8 * s),
        Math.round(28 * s)
      );
      // Holographic ring
      g.fillStyle(PALETTE.cyan, 0.6);
      g.strokeCircle(
        bWidth / 2 + Math.round(1 * s),
        canvasHeight - bHeight - Math.round(35 * s),
        Math.round(10 * s)
      );
      g.fillStyle(PALETTE.lavender, 0.4);
      g.strokeCircle(
        bWidth / 2 + Math.round(1 * s),
        canvasHeight - bHeight - Math.round(35 * s),
        Math.round(7 * s)
      );
      // Beacon
      g.fillStyle(PALETTE.cyan);
      g.fillCircle(
        bWidth / 2 + Math.round(1 * s),
        canvasHeight - bHeight - Math.round(47 * s),
        Math.round(4 * s)
      );
      g.fillStyle(PALETTE.white);
      g.fillCircle(bWidth / 2, canvasHeight - bHeight - Math.round(48 * s), Math.round(2 * s));
    }
  }

  private drawWindows(
    g: Phaser.GameObjects.Graphics,
    style: any,
    level: number,
    bWidth: number,
    bHeight: number,
    canvasHeight: number,
    s: number
  ): void {
    const windowRows = level === 1 ? 2 : level === 2 ? 3 : level === 3 ? 4 : level === 4 ? 6 : 8;
    const windowCols = level >= 4 ? 4 : level >= 2 ? 3 : 2;
    const windowWidth = Math.round((level >= 4 ? 5 : 6) * s);
    const windowHeight = Math.round((level >= 4 ? 6 : 5) * s);
    const startY = canvasHeight - bHeight + Math.round((level === 1 ? 18 : 12) * s);
    const windowSpacingY = Math.round((level >= 4 ? 11 : 12) * s);
    const windowGap = Math.round(4 * s);

    for (let row = 0; row < windowRows; row++) {
      for (let col = 0; col < windowCols; col++) {
        const totalWindowWidth = windowCols * windowWidth + (windowCols - 1) * windowGap;
        const startX = (bWidth - totalWindowWidth) / 2 + Math.round(2 * s);
        const wx = startX + col * (windowWidth + windowGap);
        const wy = startY + row * windowSpacingY;

        if (level <= 2 && row === windowRows - 1 && col === Math.floor(windowCols / 2)) continue;

        g.fillStyle(style.accent, 0.25);
        g.fillRect(
          wx - Math.round(1 * s),
          wy - Math.round(1 * s),
          windowWidth + Math.round(2 * s),
          windowHeight + Math.round(2 * s)
        );
        g.fillStyle(style.accent);
        g.fillRect(wx, wy, windowWidth, windowHeight);
        g.fillStyle(lighten(style.accent, 0.35));
        g.fillRect(wx, wy, Math.round(2 * s), Math.round(2 * s));

        if (level >= 3) {
          g.fillStyle(darken(style.base, 0.2));
          g.fillRect(wx + windowWidth / 2 - Math.round(1 * s), wy, Math.round(1 * s), windowHeight);
          g.fillRect(wx, wy + windowHeight / 2, windowWidth, Math.round(1 * s));
        }
      }
    }
  }

  private drawDoor(
    g: Phaser.GameObjects.Graphics,
    style: any,
    level: number,
    bWidth: number,
    canvasHeight: number,
    s: number
  ): void {
    const doorWidth = Math.round((level === 1 ? 12 : level >= 4 ? 14 : 10) * s);
    const doorHeight = Math.round((level >= 4 ? 16 : 12) * s);
    const doorX = (bWidth - doorWidth) / 2 + Math.round(2 * s);

    if (level === 5) {
      g.fillStyle(PALETTE.gray);
      g.fillRect(
        doorX - Math.round(6 * s),
        canvasHeight - doorHeight - Math.round(4 * s),
        Math.round(4 * s),
        doorHeight + Math.round(4 * s)
      );
      g.fillRect(
        doorX + doorWidth + Math.round(2 * s),
        canvasHeight - doorHeight - Math.round(4 * s),
        Math.round(4 * s),
        doorHeight + Math.round(4 * s)
      );
      g.fillStyle(lighten(PALETTE.gray, 0.2));
      g.fillRect(
        doorX - Math.round(6 * s),
        canvasHeight - doorHeight - Math.round(4 * s),
        Math.round(1 * s),
        doorHeight + Math.round(4 * s)
      );
      g.fillStyle(style.accent);
      g.fillRect(
        doorX - Math.round(8 * s),
        canvasHeight - doorHeight - Math.round(8 * s),
        doorWidth + Math.round(16 * s),
        Math.round(6 * s)
      );
      g.fillStyle(lighten(style.accent, 0.2));
      g.fillRect(
        doorX - Math.round(8 * s),
        canvasHeight - doorHeight - Math.round(8 * s),
        doorWidth + Math.round(16 * s),
        Math.round(2 * s)
      );
    }

    g.fillStyle(PALETTE.darkGray);
    g.fillRect(doorX, canvasHeight - doorHeight, doorWidth, doorHeight);

    const doorColor = level >= 3 ? PALETTE.gray : PALETTE.brown;
    g.fillStyle(doorColor);
    g.fillRect(
      doorX + Math.round(1 * s),
      canvasHeight - doorHeight + Math.round(1 * s),
      doorWidth - Math.round(2 * s),
      doorHeight - Math.round(1 * s)
    );
    g.fillStyle(lighten(doorColor, 0.15));
    g.fillRect(
      doorX + Math.round(1 * s),
      canvasHeight - doorHeight + Math.round(1 * s),
      Math.round(2 * s),
      doorHeight - Math.round(1 * s)
    );
    g.fillStyle(style.accent);
    g.fillRect(
      doorX + doorWidth - Math.round(4 * s),
      canvasHeight - doorHeight / 2 - Math.round(1 * s),
      Math.round(2 * s),
      Math.round(3 * s)
    );

    if (level >= 3) {
      g.fillStyle(PALETTE.darkGray);
      g.fillRect(
        doorX - Math.round(6 * s),
        canvasHeight - doorHeight - Math.round(12 * s),
        doorWidth + Math.round(12 * s),
        Math.round(8 * s)
      );
      g.fillStyle(style.accent);
      g.fillRect(
        doorX - Math.round(4 * s),
        canvasHeight - doorHeight - Math.round(11 * s),
        doorWidth + Math.round(8 * s),
        Math.round(6 * s)
      );
      g.fillStyle(lighten(style.accent, 0.25));
      g.fillRect(
        doorX - Math.round(4 * s),
        canvasHeight - doorHeight - Math.round(11 * s),
        doorWidth + Math.round(8 * s),
        Math.round(2 * s)
      );
    }
  }

  private generatePokeCenter(): void {
    // PokeCenter - Pokemon Center style building (red roof, white base)
    const s = SCALE;
    const g = this.make.graphics({ x: 0, y: 0 });
    const canvasHeight = Math.round(140 * s);
    const canvasWidth = Math.round(55 * s);
    const bHeight = Math.round(85 * s);
    const bWidth = Math.round(50 * s);

    // Shadow
    g.fillStyle(PALETTE.void, 0.5);
    g.fillRect(
      Math.round(6 * s),
      canvasHeight - bHeight + Math.round(6 * s),
      bWidth - Math.round(2 * s),
      bHeight
    );

    // Building base (white/cream)
    g.fillStyle(PALETTE.cream);
    g.fillRect(Math.round(4 * s), canvasHeight - bHeight, bWidth - Math.round(4 * s), bHeight);

    // Highlight left side
    g.fillStyle(lighten(PALETTE.cream, 0.15));
    g.fillRect(Math.round(4 * s), canvasHeight - bHeight, Math.round(6 * s), bHeight);

    // Shadow right side
    g.fillStyle(darken(PALETTE.cream, 0.1));
    g.fillRect(bWidth - Math.round(6 * s), canvasHeight - bHeight, Math.round(4 * s), bHeight);

    // Red roof - iconic PokeCenter style with shading
    g.fillStyle(PALETTE.red);
    g.fillRect(
      0,
      canvasHeight - bHeight - Math.round(8 * s),
      bWidth + Math.round(4 * s),
      Math.round(12 * s)
    );
    g.fillStyle(PALETTE.brightRed);
    g.fillRect(
      Math.round(2 * s),
      canvasHeight - bHeight - Math.round(6 * s),
      bWidth,
      Math.round(8 * s)
    );
    // Roof highlight
    g.fillStyle(lighten(PALETTE.brightRed, 0.2));
    g.fillRect(
      Math.round(2 * s),
      canvasHeight - bHeight - Math.round(6 * s),
      bWidth,
      Math.round(2 * s)
    );

    // Roof peak/overhang with shading
    g.fillStyle(PALETTE.darkRed);
    g.fillRect(
      bWidth / 2 - Math.round(8 * s),
      canvasHeight - bHeight - Math.round(16 * s),
      Math.round(20 * s),
      Math.round(10 * s)
    );
    g.fillStyle(PALETTE.red);
    g.fillRect(
      bWidth / 2 - Math.round(6 * s),
      canvasHeight - bHeight - Math.round(14 * s),
      Math.round(16 * s),
      Math.round(6 * s)
    );
    // Peak highlight
    g.fillStyle(lighten(PALETTE.red, 0.15));
    g.fillRect(
      bWidth / 2 - Math.round(6 * s),
      canvasHeight - bHeight - Math.round(14 * s),
      Math.round(16 * s),
      Math.round(2 * s)
    );

    // Pokeball logo on roof peak
    g.fillStyle(PALETTE.white);
    g.fillCircle(
      bWidth / 2 + Math.round(2 * s),
      canvasHeight - bHeight - Math.round(10 * s),
      Math.round(6 * s)
    );
    g.fillStyle(PALETTE.red);
    g.fillRect(
      bWidth / 2 - Math.round(4 * s),
      canvasHeight - bHeight - Math.round(16 * s),
      Math.round(12 * s),
      Math.round(6 * s)
    );
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(
      bWidth / 2 - Math.round(4 * s),
      canvasHeight - bHeight - Math.round(11 * s),
      Math.round(12 * s),
      Math.round(2 * s)
    );
    g.fillStyle(PALETTE.white);
    g.fillCircle(
      bWidth / 2 + Math.round(2 * s),
      canvasHeight - bHeight - Math.round(10 * s),
      Math.round(3 * s)
    );
    g.fillStyle(PALETTE.darkGray);
    g.fillCircle(
      bWidth / 2 + Math.round(2 * s),
      canvasHeight - bHeight - Math.round(10 * s),
      Math.round(1.5 * s)
    );

    // Windows (2 rows, 3 columns)
    const windowColor = PALETTE.lightBlue;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        const wx = Math.round(10 * s) + col * Math.round(12 * s);
        const wy = canvasHeight - bHeight + Math.round(15 * s) + row * Math.round(18 * s);

        // Window glow
        g.fillStyle(windowColor, 0.25);
        g.fillRect(
          wx - Math.round(1 * s),
          wy - Math.round(1 * s),
          Math.round(9 * s),
          Math.round(11 * s)
        );

        // Window
        g.fillStyle(windowColor);
        g.fillRect(wx, wy, Math.round(8 * s), Math.round(10 * s));

        // Window highlight
        g.fillStyle(lighten(windowColor, 0.3));
        g.fillRect(wx, wy, Math.round(2 * s), Math.round(2 * s));

        // Window frame
        g.fillStyle(PALETTE.cream);
        g.fillRect(wx + Math.round(3 * s), wy, Math.round(2 * s), Math.round(10 * s));
        g.fillRect(wx, wy + Math.round(4 * s), Math.round(8 * s), Math.round(2 * s));
      }
    }

    // Red cross/plus sign (healing center)
    g.fillStyle(PALETTE.red);
    g.fillRect(
      bWidth / 2 - Math.round(1 * s),
      canvasHeight - bHeight + Math.round(8 * s),
      Math.round(6 * s),
      Math.round(2 * s)
    );
    g.fillRect(
      bWidth / 2 + Math.round(1 * s),
      canvasHeight - bHeight + Math.round(6 * s),
      Math.round(2 * s),
      Math.round(6 * s)
    );

    // Door - automatic sliding doors
    const doorWidth = Math.round(16 * s);
    const doorHeight = Math.round(20 * s);
    const doorX = (bWidth - doorWidth) / 2 + Math.round(2 * s);

    // Door frame with shading
    g.fillStyle(PALETTE.red);
    g.fillRect(
      doorX - Math.round(2 * s),
      canvasHeight - doorHeight - Math.round(4 * s),
      doorWidth + Math.round(4 * s),
      doorHeight + Math.round(4 * s)
    );
    g.fillStyle(lighten(PALETTE.red, 0.15));
    g.fillRect(
      doorX - Math.round(2 * s),
      canvasHeight - doorHeight - Math.round(4 * s),
      Math.round(2 * s),
      doorHeight + Math.round(4 * s)
    );

    // Glass doors
    g.fillStyle(PALETTE.lightBlue);
    g.fillRect(doorX, canvasHeight - doorHeight, doorWidth, doorHeight);
    // Glass reflection
    g.fillStyle(lighten(PALETTE.lightBlue, 0.3));
    g.fillRect(
      doorX + Math.round(2 * s),
      canvasHeight - doorHeight + Math.round(2 * s),
      Math.round(4 * s),
      Math.round(6 * s)
    );

    // Door divider
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(
      doorX + doorWidth / 2 - Math.round(1 * s),
      canvasHeight - doorHeight,
      Math.round(2 * s),
      doorHeight
    );

    // Welcome mat
    g.fillStyle(PALETTE.red);
    g.fillRect(
      doorX - Math.round(4 * s),
      canvasHeight - Math.round(2 * s),
      doorWidth + Math.round(8 * s),
      Math.round(2 * s)
    );

    // "P" sign above door
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(
      doorX + Math.round(2 * s),
      canvasHeight - doorHeight - Math.round(10 * s),
      doorWidth - Math.round(4 * s),
      Math.round(8 * s)
    );
    g.fillStyle(PALETTE.white);
    g.fillRect(
      doorX + Math.round(5 * s),
      canvasHeight - doorHeight - Math.round(9 * s),
      Math.round(2 * s),
      Math.round(6 * s)
    );
    g.fillRect(
      doorX + Math.round(5 * s),
      canvasHeight - doorHeight - Math.round(9 * s),
      Math.round(5 * s),
      Math.round(2 * s)
    );
    g.fillRect(
      doorX + Math.round(8 * s),
      canvasHeight - doorHeight - Math.round(9 * s),
      Math.round(2 * s),
      Math.round(4 * s)
    );
    g.fillRect(
      doorX + Math.round(5 * s),
      canvasHeight - doorHeight - Math.round(6 * s),
      Math.round(5 * s),
      Math.round(2 * s)
    );

    // Side decorations - pokeball symbols
    g.fillStyle(PALETTE.red);
    g.fillCircle(Math.round(10 * s), canvasHeight - Math.round(25 * s), Math.round(4 * s));
    g.fillCircle(bWidth - Math.round(6 * s), canvasHeight - Math.round(25 * s), Math.round(4 * s));
    g.fillStyle(PALETTE.white);
    g.fillRect(
      Math.round(6 * s),
      canvasHeight - Math.round(26 * s),
      Math.round(8 * s),
      Math.round(2 * s)
    );
    g.fillRect(
      bWidth - Math.round(10 * s),
      canvasHeight - Math.round(26 * s),
      Math.round(8 * s),
      Math.round(2 * s)
    );

    g.generateTexture("pokecenter", canvasWidth, canvasHeight);
    g.destroy();
  }

  private generateTradingGym(): void {
    // Trading Dojo - Japanese dojo style building (traditional wooden structure)
    const s = SCALE;
    const g = this.make.graphics({ x: 0, y: 0 });
    const canvasHeight = Math.round(160 * s);
    const canvasWidth = Math.round(80 * s);
    const bHeight = Math.round(90 * s);
    const bWidth = Math.round(70 * s);
    const baseX = Math.round(5 * s);

    // Shadow
    g.fillStyle(PALETTE.void, 0.5);
    g.fillRect(
      baseX + Math.round(6 * s),
      canvasHeight - bHeight + Math.round(6 * s),
      bWidth - Math.round(4 * s),
      bHeight
    );

    // Wooden platform/foundation (raised floor - engawa style)
    const platformHeight = Math.round(8 * s);
    g.fillStyle(0x8b4513); // Saddle brown
    g.fillRect(
      baseX - Math.round(4 * s),
      canvasHeight - platformHeight,
      bWidth + Math.round(8 * s),
      platformHeight
    );
    g.fillStyle(0xa0522d); // Sienna (lighter)
    g.fillRect(
      baseX - Math.round(4 * s),
      canvasHeight - platformHeight,
      bWidth + Math.round(8 * s),
      Math.round(2 * s)
    );

    // Building base (wooden walls - warm brown)
    const woodColor = 0x8b5a2b;
    g.fillStyle(woodColor);
    g.fillRect(baseX, canvasHeight - bHeight, bWidth, bHeight - platformHeight);

    // Wood grain texture - vertical planks
    g.fillStyle(darken(woodColor, 0.15));
    for (let i = 0; i < 6; i++) {
      const plankX = baseX + Math.round(2 * s) + i * Math.round(11 * s);
      g.fillRect(plankX, canvasHeight - bHeight, Math.round(1 * s), bHeight - platformHeight);
    }

    // Left side highlight
    g.fillStyle(lighten(woodColor, 0.2));
    g.fillRect(baseX, canvasHeight - bHeight, Math.round(4 * s), bHeight - platformHeight);

    // Right side shadow
    g.fillStyle(darken(woodColor, 0.25));
    g.fillRect(
      baseX + bWidth - Math.round(6 * s),
      canvasHeight - bHeight,
      Math.round(6 * s),
      bHeight - platformHeight
    );

    // Traditional curved roof (dark blue/black tiles)
    const roofColor = 0x1a1a2e;
    const roofOverhang = Math.round(10 * s);
    const roofHeight = Math.round(20 * s);

    // Main roof body
    g.fillStyle(roofColor);
    g.fillRect(
      baseX - roofOverhang,
      canvasHeight - bHeight - roofHeight + Math.round(4 * s),
      bWidth + roofOverhang * 2,
      roofHeight
    );

    // Curved roof edges (simplified pixel art curves)
    g.fillStyle(roofColor);
    // Left curve up
    g.fillRect(
      baseX - roofOverhang - Math.round(2 * s),
      canvasHeight - bHeight - roofHeight + Math.round(8 * s),
      Math.round(4 * s),
      Math.round(8 * s)
    );
    // Right curve up
    g.fillRect(
      baseX + bWidth + roofOverhang - Math.round(2 * s),
      canvasHeight - bHeight - roofHeight + Math.round(8 * s),
      Math.round(4 * s),
      Math.round(8 * s)
    );

    // Roof ridge (top peak)
    g.fillStyle(0x2d2d44);
    g.fillRect(
      baseX - roofOverhang + Math.round(4 * s),
      canvasHeight - bHeight - roofHeight,
      bWidth + roofOverhang * 2 - Math.round(8 * s),
      Math.round(6 * s)
    );

    // Red accent trim under roof
    g.fillStyle(PALETTE.brightRed);
    g.fillRect(
      baseX - roofOverhang + Math.round(2 * s),
      canvasHeight - bHeight + Math.round(2 * s),
      bWidth + roofOverhang * 2 - Math.round(4 * s),
      Math.round(3 * s)
    );

    // Shoji screens (paper doors/windows) - two on each side
    const shojiColor = 0xfff8dc; // Cream white
    const shojiFrameColor = 0x4a3728;
    const screenWidth = Math.round(12 * s);
    const screenHeight = Math.round(28 * s);
    const screenY = canvasHeight - bHeight + Math.round(20 * s);

    // Left shoji screen
    g.fillStyle(shojiFrameColor);
    g.fillRect(
      baseX + Math.round(6 * s),
      screenY,
      screenWidth + Math.round(2 * s),
      screenHeight + Math.round(2 * s)
    );
    g.fillStyle(shojiColor);
    g.fillRect(baseX + Math.round(7 * s), screenY + Math.round(1 * s), screenWidth, screenHeight);
    // Grid pattern
    g.fillStyle(shojiFrameColor);
    g.fillRect(
      baseX + Math.round(7 * s) + screenWidth / 2,
      screenY + Math.round(1 * s),
      Math.round(1 * s),
      screenHeight
    );
    g.fillRect(
      baseX + Math.round(7 * s),
      screenY + screenHeight / 2,
      screenWidth,
      Math.round(1 * s)
    );

    // Right shoji screen
    g.fillStyle(shojiFrameColor);
    g.fillRect(
      baseX + bWidth - Math.round(20 * s),
      screenY,
      screenWidth + Math.round(2 * s),
      screenHeight + Math.round(2 * s)
    );
    g.fillStyle(shojiColor);
    g.fillRect(
      baseX + bWidth - Math.round(19 * s),
      screenY + Math.round(1 * s),
      screenWidth,
      screenHeight
    );
    // Grid pattern
    g.fillStyle(shojiFrameColor);
    g.fillRect(
      baseX + bWidth - Math.round(19 * s) + screenWidth / 2,
      screenY + Math.round(1 * s),
      Math.round(1 * s),
      screenHeight
    );
    g.fillRect(
      baseX + bWidth - Math.round(19 * s),
      screenY + screenHeight / 2,
      screenWidth,
      Math.round(1 * s)
    );

    // Center entrance - sliding doors
    const doorWidth = Math.round(20 * s);
    const doorHeight = Math.round(32 * s);
    const doorX = baseX + (bWidth - doorWidth) / 2;
    const doorY = canvasHeight - platformHeight - doorHeight;

    // Door frame
    g.fillStyle(shojiFrameColor);
    g.fillRect(
      doorX - Math.round(2 * s),
      doorY - Math.round(2 * s),
      doorWidth + Math.round(4 * s),
      doorHeight + Math.round(2 * s)
    );

    // Door panels (slightly open - showing darkness inside)
    g.fillStyle(0x1a1a1a);
    g.fillRect(doorX, doorY, doorWidth, doorHeight);

    // Left door panel (shoji)
    g.fillStyle(shojiColor);
    g.fillRect(doorX, doorY, doorWidth / 2 - Math.round(2 * s), doorHeight);
    g.fillStyle(shojiFrameColor);
    g.fillRect(doorX + doorWidth / 4, doorY, Math.round(1 * s), doorHeight);
    g.fillRect(doorX, doorY + doorHeight / 3, doorWidth / 2 - Math.round(2 * s), Math.round(1 * s));
    g.fillRect(
      doorX,
      doorY + (doorHeight * 2) / 3,
      doorWidth / 2 - Math.round(2 * s),
      Math.round(1 * s)
    );

    // Right door panel (shoji)
    g.fillStyle(shojiColor);
    g.fillRect(
      doorX + doorWidth / 2 + Math.round(2 * s),
      doorY,
      doorWidth / 2 - Math.round(2 * s),
      doorHeight
    );
    g.fillStyle(shojiFrameColor);
    g.fillRect(doorX + (doorWidth * 3) / 4, doorY, Math.round(1 * s), doorHeight);
    g.fillRect(
      doorX + doorWidth / 2 + Math.round(2 * s),
      doorY + doorHeight / 3,
      doorWidth / 2 - Math.round(2 * s),
      Math.round(1 * s)
    );
    g.fillRect(
      doorX + doorWidth / 2 + Math.round(2 * s),
      doorY + (doorHeight * 2) / 3,
      doorWidth / 2 - Math.round(2 * s),
      Math.round(1 * s)
    );

    // Noren (fabric curtain above door) - orange/amber dojo colors
    g.fillStyle(PALETTE.orange);
    g.fillRect(
      doorX - Math.round(4 * s),
      doorY - Math.round(10 * s),
      doorWidth + Math.round(8 * s),
      Math.round(10 * s)
    );
    // Noren slits
    g.fillStyle(darken(PALETTE.orange, 0.3));
    g.fillRect(doorX, doorY - Math.round(8 * s), Math.round(1 * s), Math.round(6 * s));
    g.fillRect(
      doorX + doorWidth / 3,
      doorY - Math.round(8 * s),
      Math.round(1 * s),
      Math.round(6 * s)
    );
    g.fillRect(
      doorX + (doorWidth * 2) / 3,
      doorY - Math.round(8 * s),
      Math.round(1 * s),
      Math.round(6 * s)
    );
    g.fillRect(doorX + doorWidth, doorY - Math.round(8 * s), Math.round(1 * s), Math.round(6 * s));

    // Dojo symbol on noren (circle - representing unity/perfection)
    g.fillStyle(PALETTE.gold);
    g.fillCircle(doorX + doorWidth / 2, doorY - Math.round(5 * s), Math.round(3 * s));
    g.fillStyle(PALETTE.orange);
    g.fillCircle(doorX + doorWidth / 2, doorY - Math.round(5 * s), Math.round(1.5 * s));

    // Stone lanterns on either side
    const lanternY = canvasHeight - platformHeight - Math.round(16 * s);
    // Left lantern
    g.fillStyle(0x696969); // Gray stone
    g.fillRect(baseX - Math.round(2 * s), lanternY, Math.round(6 * s), Math.round(16 * s));
    g.fillStyle(0x808080);
    g.fillRect(
      baseX - Math.round(3 * s),
      lanternY + Math.round(4 * s),
      Math.round(8 * s),
      Math.round(8 * s)
    );
    g.fillStyle(PALETTE.gold, 0.7);
    g.fillRect(
      baseX - Math.round(1 * s),
      lanternY + Math.round(6 * s),
      Math.round(4 * s),
      Math.round(4 * s)
    );

    // Right lantern
    g.fillStyle(0x696969);
    g.fillRect(baseX + bWidth - Math.round(4 * s), lanternY, Math.round(6 * s), Math.round(16 * s));
    g.fillStyle(0x808080);
    g.fillRect(
      baseX + bWidth - Math.round(5 * s),
      lanternY + Math.round(4 * s),
      Math.round(8 * s),
      Math.round(8 * s)
    );
    g.fillStyle(PALETTE.gold, 0.7);
    g.fillRect(
      baseX + bWidth - Math.round(3 * s),
      lanternY + Math.round(6 * s),
      Math.round(4 * s),
      Math.round(4 * s)
    );

    g.generateTexture("tradinggym", canvasWidth, canvasHeight);
    g.destroy();
  }

  private generateCasino(): void {
    // Casino - Vegas-themed building (purple/gold, neon style)
    const s = SCALE;
    const g = this.make.graphics({ x: 0, y: 0 });
    const canvasHeight = Math.round(160 * s);
    const canvasWidth = Math.round(70 * s);
    const bHeight = Math.round(100 * s);
    const bWidth = Math.round(60 * s);

    // Shadow
    g.fillStyle(PALETTE.void, 0.5);
    g.fillRect(
      Math.round(8 * s),
      canvasHeight - bHeight + Math.round(8 * s),
      bWidth - Math.round(2 * s),
      bHeight
    );

    // Building base (dark purple - casino style)
    g.fillStyle(PALETTE.deepPurple);
    g.fillRect(Math.round(4 * s), canvasHeight - bHeight, bWidth - Math.round(4 * s), bHeight);

    // Highlight left side
    g.fillStyle(lighten(PALETTE.deepPurple, 0.2));
    g.fillRect(Math.round(4 * s), canvasHeight - bHeight, Math.round(8 * s), bHeight);

    // Shadow right side
    g.fillStyle(darken(PALETTE.deepPurple, 0.2));
    g.fillRect(bWidth - Math.round(8 * s), canvasHeight - bHeight, Math.round(6 * s), bHeight);

    // Gold trim at base with highlight
    g.fillStyle(PALETTE.gold);
    g.fillRect(
      Math.round(4 * s),
      canvasHeight - Math.round(8 * s),
      bWidth - Math.round(4 * s),
      Math.round(4 * s)
    );
    g.fillStyle(lighten(PALETTE.gold, 0.25));
    g.fillRect(
      Math.round(4 * s),
      canvasHeight - Math.round(8 * s),
      bWidth - Math.round(4 * s),
      Math.round(1 * s)
    );

    // Roof with neon lights effect (purple and gold)
    g.fillStyle(PALETTE.purple);
    g.fillRect(
      0,
      canvasHeight - bHeight - Math.round(12 * s),
      bWidth + Math.round(8 * s),
      Math.round(16 * s)
    );
    g.fillStyle(PALETTE.violet);
    g.fillRect(
      Math.round(2 * s),
      canvasHeight - bHeight - Math.round(10 * s),
      bWidth + Math.round(4 * s),
      Math.round(12 * s)
    );
    // Roof highlight
    g.fillStyle(lighten(PALETTE.violet, 0.2));
    g.fillRect(
      Math.round(2 * s),
      canvasHeight - bHeight - Math.round(10 * s),
      bWidth + Math.round(4 * s),
      Math.round(3 * s)
    );

    // Vegas-style marquee top with shading
    g.fillStyle(darken(PALETTE.deepPurple, 0.3));
    g.fillRect(
      bWidth / 2 - Math.round(16 * s),
      canvasHeight - bHeight - Math.round(28 * s),
      Math.round(40 * s),
      Math.round(18 * s)
    );
    g.fillStyle(PALETTE.deepPurple);
    g.fillRect(
      bWidth / 2 - Math.round(14 * s),
      canvasHeight - bHeight - Math.round(26 * s),
      Math.round(36 * s),
      Math.round(14 * s)
    );
    // Marquee highlight
    g.fillStyle(lighten(PALETTE.deepPurple, 0.15));
    g.fillRect(
      bWidth / 2 - Math.round(14 * s),
      canvasHeight - bHeight - Math.round(26 * s),
      Math.round(36 * s),
      Math.round(3 * s)
    );

    // Gold star on marquee
    g.fillStyle(PALETTE.gold);
    g.fillCircle(
      bWidth / 2 + Math.round(4 * s),
      canvasHeight - bHeight - Math.round(18 * s),
      Math.round(6 * s)
    );
    g.fillStyle(PALETTE.yellow);
    g.fillCircle(
      bWidth / 2 + Math.round(4 * s),
      canvasHeight - bHeight - Math.round(18 * s),
      Math.round(4 * s)
    );
    // Star glint
    g.fillStyle(PALETTE.white);
    g.fillCircle(
      bWidth / 2 + Math.round(2 * s),
      canvasHeight - bHeight - Math.round(20 * s),
      Math.round(1.5 * s)
    );

    // Neon border lights on marquee (alternating gold dots)
    g.fillStyle(PALETTE.gold);
    for (let i = 0; i < 10; i++) {
      const lightX = bWidth / 2 - Math.round(14 * s) + i * Math.round(4 * s);
      g.fillCircle(lightX, canvasHeight - bHeight - Math.round(26 * s), Math.round(1.5 * s));
      g.fillCircle(lightX, canvasHeight - bHeight - Math.round(12 * s), Math.round(1.5 * s));
    }

    // Windows - casino style (large, glowing)
    const windowColor = PALETTE.gold;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        const wx = Math.round(10 * s) + col * Math.round(16 * s);
        const wy = canvasHeight - bHeight + Math.round(18 * s) + row * Math.round(22 * s);

        // Window glow (neon effect)
        g.fillStyle(PALETTE.lavender, 0.35);
        g.fillRect(
          wx - Math.round(2 * s),
          wy - Math.round(2 * s),
          Math.round(13 * s),
          Math.round(15 * s)
        );

        // Window
        g.fillStyle(windowColor);
        g.fillRect(wx, wy, Math.round(10 * s), Math.round(12 * s));

        // Window highlight
        g.fillStyle(lighten(windowColor, 0.35));
        g.fillRect(wx, wy, Math.round(3 * s), Math.round(3 * s));

        // Window frame (purple)
        g.fillStyle(PALETTE.purple);
        g.fillRect(wx + Math.round(4 * s), wy, Math.round(2 * s), Math.round(12 * s));
        g.fillRect(wx, wy + Math.round(5 * s), Math.round(10 * s), Math.round(2 * s));
      }
    }

    // Dice symbols on front (gambling theme) with shading
    g.fillStyle(PALETTE.white);
    g.fillRect(
      Math.round(12 * s),
      canvasHeight - bHeight + Math.round(8 * s),
      Math.round(8 * s),
      Math.round(8 * s)
    );
    g.fillStyle(darken(PALETTE.white, 0.1));
    g.fillRect(
      Math.round(18 * s),
      canvasHeight - bHeight + Math.round(8 * s),
      Math.round(2 * s),
      Math.round(8 * s)
    );
    g.fillStyle(darken(PALETTE.deepPurple, 0.3));
    g.fillCircle(
      Math.round(14 * s),
      canvasHeight - bHeight + Math.round(10 * s),
      Math.round(1 * s)
    );
    g.fillCircle(
      Math.round(18 * s),
      canvasHeight - bHeight + Math.round(14 * s),
      Math.round(1 * s)
    );
    g.fillStyle(PALETTE.white);
    g.fillRect(
      bWidth - Math.round(16 * s),
      canvasHeight - bHeight + Math.round(8 * s),
      Math.round(8 * s),
      Math.round(8 * s)
    );
    g.fillStyle(darken(PALETTE.deepPurple, 0.3));
    g.fillCircle(
      bWidth - Math.round(12 * s),
      canvasHeight - bHeight + Math.round(12 * s),
      Math.round(1 * s)
    );

    // Door - grand casino entrance
    const doorWidth = Math.round(20 * s);
    const doorHeight = Math.round(26 * s);
    const doorX = (bWidth - doorWidth) / 2 + Math.round(2 * s);

    // Door frame (gold) with highlight
    g.fillStyle(PALETTE.gold);
    g.fillRect(
      doorX - Math.round(3 * s),
      canvasHeight - doorHeight - Math.round(4 * s),
      doorWidth + Math.round(6 * s),
      doorHeight + Math.round(4 * s)
    );
    g.fillStyle(lighten(PALETTE.gold, 0.2));
    g.fillRect(
      doorX - Math.round(3 * s),
      canvasHeight - doorHeight - Math.round(4 * s),
      Math.round(2 * s),
      doorHeight + Math.round(4 * s)
    );

    // Door (dark purple)
    g.fillStyle(darken(PALETTE.deepPurple, 0.3));
    g.fillRect(doorX, canvasHeight - doorHeight, doorWidth, doorHeight);

    // Door window (glowing gold)
    g.fillStyle(PALETTE.gold, 0.6);
    g.fillRect(
      doorX + Math.round(4 * s),
      canvasHeight - doorHeight + Math.round(4 * s),
      doorWidth - Math.round(8 * s),
      Math.round(10 * s)
    );
    // Window reflection
    g.fillStyle(lighten(PALETTE.gold, 0.4), 0.4);
    g.fillRect(
      doorX + Math.round(5 * s),
      canvasHeight - doorHeight + Math.round(5 * s),
      Math.round(4 * s),
      Math.round(4 * s)
    );

    // Door divider
    g.fillStyle(PALETTE.gold);
    g.fillRect(
      doorX + doorWidth / 2 - Math.round(1 * s),
      canvasHeight - doorHeight,
      Math.round(2 * s),
      doorHeight
    );

    // Red carpet entrance with shading
    g.fillStyle(PALETTE.red);
    g.fillRect(
      doorX - Math.round(6 * s),
      canvasHeight - Math.round(3 * s),
      doorWidth + Math.round(12 * s),
      Math.round(3 * s)
    );
    // Carpet highlight
    g.fillStyle(lighten(PALETTE.red, 0.15));
    g.fillRect(
      doorX - Math.round(4 * s),
      canvasHeight - Math.round(3 * s),
      doorWidth + Math.round(8 * s),
      Math.round(1 * s)
    );
    // Gold carpet trim
    g.fillStyle(PALETTE.gold);
    g.fillRect(
      doorX - Math.round(6 * s),
      canvasHeight - Math.round(3 * s),
      Math.round(2 * s),
      Math.round(3 * s)
    );
    g.fillRect(
      doorX + doorWidth + Math.round(4 * s),
      canvasHeight - Math.round(3 * s),
      Math.round(2 * s),
      Math.round(3 * s)
    );

    // Side neon tubes (decorative) with glow
    g.fillStyle(PALETTE.lavender);
    g.fillRect(
      Math.round(6 * s),
      canvasHeight - Math.round(50 * s),
      Math.round(3 * s),
      Math.round(25 * s)
    );
    g.fillRect(
      bWidth - Math.round(5 * s),
      canvasHeight - Math.round(50 * s),
      Math.round(3 * s),
      Math.round(25 * s)
    );
    // Neon glow
    g.fillStyle(PALETTE.lavender, 0.25);
    g.fillRect(
      Math.round(4 * s),
      canvasHeight - Math.round(52 * s),
      Math.round(7 * s),
      Math.round(29 * s)
    );
    g.fillRect(
      bWidth - Math.round(7 * s),
      canvasHeight - Math.round(52 * s),
      Math.round(7 * s),
      Math.round(29 * s)
    );
    // Neon tube highlights
    g.fillStyle(lighten(PALETTE.lavender, 0.3));
    g.fillRect(
      Math.round(6 * s),
      canvasHeight - Math.round(50 * s),
      Math.round(1 * s),
      Math.round(25 * s)
    );
    g.fillRect(
      bWidth - Math.round(5 * s),
      canvasHeight - Math.round(50 * s),
      Math.round(1 * s),
      Math.round(25 * s)
    );

    g.generateTexture("casino", canvasWidth, canvasHeight);
    g.destroy();
  }

  private generateTradingTerminal(): void {
    const s = SCALE;
    const g = this.make.graphics({ x: 0, y: 0 });
    const canvasHeight = Math.round(180 * s);
    const canvasWidth = Math.round(110 * s);
    const bHeight = Math.round(120 * s);
    const bWidth = Math.round(100 * s);

    // Terminal color palette (dark, professional)
    const terminalBlack = 0x08080c;
    const terminalDark = 0x0f0f16;
    const terminalGray = 0x1a1f2e;
    const terminalGreen = 0x22c55e;
    const terminalCyan = 0x06b6d4;
    const terminalRed = 0xef4444;
    const terminalGold = 0xfbbf24;
    const terminalPurple = 0xa855f7;

    // Shadow (subtle, professional)
    g.fillStyle(PALETTE.void, 0.4);
    g.fillRect(
      Math.round(10 * s),
      canvasHeight - bHeight + Math.round(6 * s),
      bWidth - Math.round(4 * s),
      bHeight
    );

    // Building base (sleek dark)
    g.fillStyle(terminalBlack);
    g.fillRect(Math.round(5 * s), canvasHeight - bHeight, bWidth - Math.round(5 * s), bHeight);

    // Gradient effect - left highlight
    g.fillStyle(terminalDark);
    g.fillRect(Math.round(5 * s), canvasHeight - bHeight, Math.round(8 * s), bHeight);

    // Right edge shadow
    g.fillStyle(0x040406);
    g.fillRect(bWidth - Math.round(8 * s), canvasHeight - bHeight, Math.round(6 * s), bHeight);

    // Sleek roof with multi-layer design
    g.fillStyle(terminalGray);
    g.fillRect(
      0,
      canvasHeight - bHeight - Math.round(10 * s),
      bWidth + Math.round(10 * s),
      Math.round(14 * s)
    );

    // Primary neon accent line (green)
    g.fillStyle(terminalGreen);
    g.fillRect(
      Math.round(2 * s),
      canvasHeight - bHeight - Math.round(10 * s),
      bWidth + Math.round(6 * s),
      Math.round(2 * s)
    );

    // Secondary accent line (cyan)
    g.fillStyle(terminalCyan);
    g.fillRect(
      Math.round(4 * s),
      canvasHeight - bHeight - Math.round(7 * s),
      bWidth + Math.round(2 * s),
      Math.round(1 * s)
    );

    // Glow effect on roof
    g.fillStyle(terminalGreen, 0.25);
    g.fillRect(
      0,
      canvasHeight - bHeight - Math.round(14 * s),
      bWidth + Math.round(10 * s),
      Math.round(6 * s)
    );

    // "TERMINAL" sign panel (elegant, centered)
    const signWidth = Math.round(70 * s);
    const signX = (bWidth - signWidth) / 2 + Math.round(2 * s);
    g.fillStyle(terminalDark);
    g.fillRect(signX, canvasHeight - bHeight - Math.round(26 * s), signWidth, Math.round(16 * s));

    // Sign border accents
    g.fillStyle(terminalGray);
    g.fillRect(signX, canvasHeight - bHeight - Math.round(26 * s), signWidth, Math.round(1 * s));
    g.fillRect(signX, canvasHeight - bHeight - Math.round(11 * s), signWidth, Math.round(1 * s));

    // Gold corner accents on sign
    g.fillStyle(terminalGold);
    g.fillRect(
      signX,
      canvasHeight - bHeight - Math.round(26 * s),
      Math.round(3 * s),
      Math.round(3 * s)
    );
    g.fillRect(
      signX + signWidth - Math.round(3 * s),
      canvasHeight - bHeight - Math.round(26 * s),
      Math.round(3 * s),
      Math.round(3 * s)
    );

    // Green text pixels for "TERMINAL" (full word)
    g.fillStyle(terminalGreen);
    const textY = canvasHeight - bHeight - Math.round(22 * s);
    const letterSpacing = Math.round(8 * s);
    let letterX = signX + Math.round(4 * s);

    // T
    g.fillRect(letterX, textY, Math.round(6 * s), Math.round(2 * s));
    g.fillRect(letterX + Math.round(2 * s), textY, Math.round(2 * s), Math.round(8 * s));
    letterX += letterSpacing;

    // E
    g.fillRect(letterX, textY, Math.round(5 * s), Math.round(2 * s));
    g.fillRect(letterX, textY + Math.round(3 * s), Math.round(4 * s), Math.round(2 * s));
    g.fillRect(letterX, textY + Math.round(6 * s), Math.round(5 * s), Math.round(2 * s));
    g.fillRect(letterX, textY, Math.round(2 * s), Math.round(8 * s));
    letterX += letterSpacing;

    // R
    g.fillRect(letterX, textY, Math.round(5 * s), Math.round(2 * s));
    g.fillRect(letterX, textY, Math.round(2 * s), Math.round(8 * s));
    g.fillRect(letterX, textY + Math.round(3 * s), Math.round(4 * s), Math.round(2 * s));
    g.fillRect(letterX + Math.round(3 * s), textY, Math.round(2 * s), Math.round(4 * s));
    g.fillRect(
      letterX + Math.round(3 * s),
      textY + Math.round(5 * s),
      Math.round(2 * s),
      Math.round(3 * s)
    );
    letterX += letterSpacing;

    // M
    g.fillRect(letterX, textY, Math.round(2 * s), Math.round(8 * s));
    g.fillRect(letterX + Math.round(5 * s), textY, Math.round(2 * s), Math.round(8 * s));
    g.fillRect(
      letterX + Math.round(2 * s),
      textY + Math.round(2 * s),
      Math.round(1 * s),
      Math.round(2 * s)
    );
    g.fillRect(
      letterX + Math.round(4 * s),
      textY + Math.round(2 * s),
      Math.round(1 * s),
      Math.round(2 * s)
    );
    letterX += letterSpacing;

    // I
    g.fillRect(letterX, textY, Math.round(5 * s), Math.round(2 * s));
    g.fillRect(letterX + Math.round(1.5 * s), textY, Math.round(2 * s), Math.round(8 * s));
    g.fillRect(letterX, textY + Math.round(6 * s), Math.round(5 * s), Math.round(2 * s));
    letterX += Math.round(6 * s);

    // N
    g.fillRect(letterX, textY, Math.round(2 * s), Math.round(8 * s));
    g.fillRect(letterX + Math.round(4 * s), textY, Math.round(2 * s), Math.round(8 * s));
    g.fillRect(
      letterX + Math.round(2 * s),
      textY + Math.round(2 * s),
      Math.round(2 * s),
      Math.round(2 * s)
    );
    letterX += letterSpacing;

    // A
    g.fillRect(letterX + Math.round(2 * s), textY, Math.round(2 * s), Math.round(2 * s));
    g.fillRect(letterX, textY + Math.round(2 * s), Math.round(2 * s), Math.round(6 * s));
    g.fillRect(
      letterX + Math.round(4 * s),
      textY + Math.round(2 * s),
      Math.round(2 * s),
      Math.round(6 * s)
    );
    g.fillRect(
      letterX + Math.round(2 * s),
      textY + Math.round(4 * s),
      Math.round(2 * s),
      Math.round(2 * s)
    );
    letterX += letterSpacing;

    // L
    g.fillRect(letterX, textY, Math.round(2 * s), Math.round(8 * s));
    g.fillRect(letterX, textY + Math.round(6 * s), Math.round(5 * s), Math.round(2 * s));

    // Main monitor screen (large, centered)
    const screenY = canvasHeight - bHeight + Math.round(14 * s);
    const screenWidth = Math.round(70 * s);
    const screenHeight = Math.round(36 * s);
    const screenX = (bWidth - screenWidth) / 2 + Math.round(2 * s);

    // Screen bezel (sleek dark frame)
    g.fillStyle(terminalGray);
    g.fillRect(
      screenX - Math.round(3 * s),
      screenY - Math.round(3 * s),
      screenWidth + Math.round(6 * s),
      screenHeight + Math.round(6 * s)
    );

    // Screen background
    g.fillStyle(terminalDark);
    g.fillRect(screenX, screenY, screenWidth, screenHeight);

    // Candlestick chart visualization (more candles for wider screen)
    const chartX = screenX + Math.round(4 * s);
    const chartY = screenY + Math.round(5 * s);
    const chartHeight = Math.round(22 * s);

    // Draw candlesticks (green up, red down pattern - more candles)
    const candles = [
      { up: true, height: 0.35 },
      { up: true, height: 0.5 },
      { up: false, height: 0.4 },
      { up: true, height: 0.6 },
      { up: true, height: 0.75 },
      { up: false, height: 0.55 },
      { up: true, height: 0.8 },
      { up: true, height: 0.7 },
      { up: false, height: 0.5 },
      { up: true, height: 0.65 },
      { up: true, height: 0.85 },
      { up: false, height: 0.6 },
    ];

    candles.forEach((candle, i) => {
      const candleX = chartX + i * Math.round(5 * s);
      const candleH = Math.round(chartHeight * candle.height);
      const candleY = chartY + chartHeight - candleH;

      // Wick
      g.fillStyle(candle.up ? terminalGreen : terminalRed, 0.7);
      g.fillRect(
        candleX + Math.round(1.5 * s),
        candleY - Math.round(2 * s),
        Math.round(1 * s),
        candleH + Math.round(4 * s)
      );

      // Body
      g.fillStyle(candle.up ? terminalGreen : terminalRed);
      g.fillRect(candleX, candleY, Math.round(4 * s), candleH);
    });

    // Price line (horizontal, cyan)
    g.fillStyle(terminalCyan, 0.6);
    g.fillRect(
      screenX + Math.round(3 * s),
      screenY + Math.round(16 * s),
      screenWidth - Math.round(6 * s),
      Math.round(1 * s)
    );

    // Volume bars at bottom of screen
    const volColors = [
      terminalGreen,
      terminalGreen,
      terminalRed,
      terminalGreen,
      terminalGreen,
      terminalRed,
      terminalGreen,
      terminalGreen,
      terminalRed,
      terminalGreen,
      terminalGreen,
      terminalRed,
    ];
    for (let i = 0; i < 12; i++) {
      const volHeight = Math.round((2 + (i % 3 === 0 ? 4 : 2)) * s);
      g.fillStyle(volColors[i], 0.5);
      g.fillRect(
        screenX + Math.round(4 * s) + i * Math.round(5 * s),
        screenY + screenHeight - volHeight - Math.round(3 * s),
        Math.round(4 * s),
        volHeight
      );
    }

    // Screen glow effect
    g.fillStyle(terminalGreen, 0.12);
    g.fillRect(
      screenX - Math.round(5 * s),
      screenY - Math.round(5 * s),
      screenWidth + Math.round(10 * s),
      screenHeight + Math.round(10 * s)
    );

    // Side panels with data displays (left and right of main screen)
    const sidePanelW = Math.round(16 * s);
    const sidePanelH = Math.round(50 * s);
    const sidePanelY = canvasHeight - bHeight + Math.round(55 * s);

    // Left panel (portfolio/holdings)
    g.fillStyle(terminalGray);
    g.fillRect(
      Math.round(10 * s),
      sidePanelY - Math.round(2 * s),
      sidePanelW + Math.round(4 * s),
      sidePanelH + Math.round(4 * s)
    );
    g.fillStyle(terminalDark);
    g.fillRect(Math.round(12 * s), sidePanelY, sidePanelW, sidePanelH);

    // Portfolio bars (green gradient)
    for (let i = 0; i < 6; i++) {
      const barWidth = Math.round((8 + Math.random() * 6) * s);
      g.fillStyle(terminalGreen, 0.6 + i * 0.06);
      g.fillRect(
        Math.round(14 * s),
        sidePanelY + Math.round(4 * s) + i * Math.round(7 * s),
        barWidth,
        Math.round(4 * s)
      );
    }

    // Right panel (order book)
    g.fillStyle(terminalGray);
    g.fillRect(
      bWidth - Math.round(24 * s),
      sidePanelY - Math.round(2 * s),
      sidePanelW + Math.round(4 * s),
      sidePanelH + Math.round(4 * s)
    );
    g.fillStyle(terminalDark);
    g.fillRect(bWidth - Math.round(22 * s), sidePanelY, sidePanelW, sidePanelH);

    // Order book (green bids, red asks)
    for (let i = 0; i < 3; i++) {
      g.fillStyle(terminalGreen, 0.8);
      g.fillRect(
        bWidth - Math.round(20 * s),
        sidePanelY + Math.round(4 * s) + i * Math.round(6 * s),
        Math.round(10 * s),
        Math.round(3 * s)
      );
    }
    for (let i = 3; i < 6; i++) {
      g.fillStyle(terminalRed, 0.8);
      g.fillRect(
        bWidth - Math.round(20 * s),
        sidePanelY + Math.round(4 * s) + i * Math.round(6 * s),
        Math.round(8 * s),
        Math.round(3 * s)
      );
    }

    // Elegant glass door (centered, wider)
    const doorWidth = Math.round(24 * s);
    const doorHeight = Math.round(28 * s);
    const doorX = (bWidth - doorWidth) / 2 + Math.round(2 * s);

    // Door frame (sleek dark)
    g.fillStyle(terminalGray);
    g.fillRect(
      doorX - Math.round(3 * s),
      canvasHeight - doorHeight - Math.round(3 * s),
      doorWidth + Math.round(6 * s),
      doorHeight + Math.round(3 * s)
    );

    // Door (dark glass)
    g.fillStyle(terminalDark);
    g.fillRect(doorX, canvasHeight - doorHeight, doorWidth, doorHeight);

    // Door glass panels (split design)
    g.fillStyle(terminalGreen, 0.1);
    g.fillRect(
      doorX + Math.round(2 * s),
      canvasHeight - doorHeight + Math.round(2 * s),
      Math.round(9 * s),
      doorHeight - Math.round(4 * s)
    );
    g.fillRect(
      doorX + Math.round(13 * s),
      canvasHeight - doorHeight + Math.round(2 * s),
      Math.round(9 * s),
      doorHeight - Math.round(4 * s)
    );

    // Door reflections
    g.fillStyle(terminalCyan, 0.15);
    g.fillRect(
      doorX + Math.round(3 * s),
      canvasHeight - doorHeight + Math.round(3 * s),
      Math.round(3 * s),
      Math.round(10 * s)
    );
    g.fillRect(
      doorX + Math.round(14 * s),
      canvasHeight - doorHeight + Math.round(3 * s),
      Math.round(3 * s),
      Math.round(10 * s)
    );

    // Door handles (both sides)
    g.fillStyle(terminalGold);
    g.fillRect(
      doorX + Math.round(8 * s),
      canvasHeight - doorHeight / 2 - Math.round(2 * s),
      Math.round(2 * s),
      Math.round(6 * s)
    );
    g.fillRect(
      doorX + Math.round(14 * s),
      canvasHeight - doorHeight / 2 - Math.round(2 * s),
      Math.round(2 * s),
      Math.round(6 * s)
    );

    // LED strip at base of building
    for (let i = 0; i < 16; i++) {
      const ledColor = i % 3 === 0 ? terminalCyan : terminalGreen;
      g.fillStyle(ledColor, 0.8);
      g.fillCircle(
        Math.round(12 * s) + i * Math.round(5 * s),
        canvasHeight - Math.round(2 * s),
        Math.round(1.5 * s)
      );
    }

    // Vertical LED accent lines on sides
    g.fillStyle(terminalGreen, 0.5);
    g.fillRect(
      Math.round(8 * s),
      canvasHeight - bHeight + Math.round(10 * s),
      Math.round(1.5 * s),
      bHeight - Math.round(18 * s)
    );
    g.fillRect(
      bWidth - Math.round(5 * s),
      canvasHeight - bHeight + Math.round(10 * s),
      Math.round(1.5 * s),
      bHeight - Math.round(18 * s)
    );

    // Cyan accent lines
    g.fillStyle(terminalCyan, 0.4);
    g.fillRect(
      Math.round(10 * s),
      canvasHeight - bHeight + Math.round(10 * s),
      Math.round(1 * s),
      bHeight - Math.round(18 * s)
    );
    g.fillRect(
      bWidth - Math.round(7 * s),
      canvasHeight - bHeight + Math.round(10 * s),
      Math.round(1 * s),
      bHeight - Math.round(18 * s)
    );

    // Rooftop antenna array (more elaborate)
    // Main antenna
    g.fillStyle(terminalGray);
    g.fillRect(
      bWidth - Math.round(18 * s),
      canvasHeight - bHeight - Math.round(24 * s),
      Math.round(2 * s),
      Math.round(16 * s)
    );
    g.fillStyle(terminalCyan);
    g.fillCircle(
      bWidth - Math.round(17 * s),
      canvasHeight - bHeight - Math.round(26 * s),
      Math.round(3 * s)
    );
    g.fillStyle(terminalCyan, 0.3);
    g.fillCircle(
      bWidth - Math.round(17 * s),
      canvasHeight - bHeight - Math.round(26 * s),
      Math.round(5 * s)
    );

    // Secondary antenna
    g.fillStyle(terminalGray);
    g.fillRect(
      Math.round(18 * s),
      canvasHeight - bHeight - Math.round(20 * s),
      Math.round(2 * s),
      Math.round(12 * s)
    );
    g.fillStyle(terminalGreen);
    g.fillCircle(
      Math.round(19 * s),
      canvasHeight - bHeight - Math.round(22 * s),
      Math.round(2.5 * s)
    );
    g.fillStyle(terminalGreen, 0.3);
    g.fillCircle(
      Math.round(19 * s),
      canvasHeight - bHeight - Math.round(22 * s),
      Math.round(4 * s)
    );

    // Satellite dish
    g.fillStyle(terminalGray);
    g.fillRect(
      bWidth / 2 - Math.round(6 * s),
      canvasHeight - bHeight - Math.round(16 * s),
      Math.round(12 * s),
      Math.round(2 * s)
    );
    g.fillRect(
      bWidth / 2 - Math.round(1 * s),
      canvasHeight - bHeight - Math.round(18 * s),
      Math.round(2 * s),
      Math.round(4 * s)
    );

    g.generateTexture("terminal", canvasWidth, canvasHeight);
    g.destroy();
  }

  private generateBagsWorldHQ(): void {
    const s = 1.8; // Scale for larger building
    const canvasWidth = Math.round(80 * s);
    const canvasHeight = Math.round(100 * s);
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const bWidth = canvasWidth;
    const bHeight = canvasHeight;

    // Sky fortress floating island base
    const baseY = canvasHeight - Math.round(25 * s);

    // Floating island/cloud base with gradient effect
    g.fillStyle(0x4a5568); // Dark gray rock
    g.fillTriangle(
      Math.round(10 * s),
      baseY,
      bWidth - Math.round(10 * s),
      baseY,
      bWidth / 2,
      canvasHeight - Math.round(5 * s)
    );
    // Lighter rock highlights
    g.fillStyle(0x718096);
    g.fillTriangle(
      Math.round(15 * s),
      baseY - Math.round(2 * s),
      bWidth - Math.round(15 * s),
      baseY - Math.round(2 * s),
      bWidth / 2,
      canvasHeight - Math.round(10 * s)
    );

    // Cloud wisps around base
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(Math.round(15 * s), baseY, Math.round(8 * s));
    g.fillCircle(bWidth - Math.round(15 * s), baseY, Math.round(6 * s));
    g.fillCircle(bWidth / 2, canvasHeight - Math.round(8 * s), Math.round(10 * s));

    // Main tower - epic castle style
    const towerWidth = Math.round(40 * s);
    const towerX = (bWidth - towerWidth) / 2;
    const towerHeight = Math.round(55 * s);
    const towerY = baseY - towerHeight;

    // Tower base - deep purple/blue gradient (Bags colors)
    g.fillStyle(0x1a1a2e);
    g.fillRect(towerX, towerY, towerWidth, towerHeight);

    // Tower mid section - slightly lighter
    g.fillStyle(0x16213e);
    g.fillRect(
      towerX + Math.round(3 * s),
      towerY + Math.round(5 * s),
      towerWidth - Math.round(6 * s),
      towerHeight - Math.round(10 * s)
    );

    // Golden trim borders
    g.fillStyle(PALETTE.gold);
    g.fillRect(towerX, towerY, towerWidth, Math.round(2 * s)); // Top
    g.fillRect(towerX, towerY, Math.round(2 * s), towerHeight); // Left
    g.fillRect(towerX + towerWidth - Math.round(2 * s), towerY, Math.round(2 * s), towerHeight); // Right

    // Side turrets
    const turretWidth = Math.round(12 * s);
    const turretHeight = Math.round(35 * s);

    // Left turret
    g.fillStyle(0x1a1a2e);
    g.fillRect(Math.round(5 * s), baseY - turretHeight, turretWidth, turretHeight);
    g.fillStyle(PALETTE.gold);
    g.fillRect(Math.round(5 * s), baseY - turretHeight, turretWidth, Math.round(2 * s));

    // Right turret
    g.fillStyle(0x1a1a2e);
    g.fillRect(bWidth - Math.round(17 * s), baseY - turretHeight, turretWidth, turretHeight);
    g.fillStyle(PALETTE.gold);
    g.fillRect(bWidth - Math.round(17 * s), baseY - turretHeight, turretWidth, Math.round(2 * s));

    // Turret spires (pointed tops)
    g.fillStyle(PALETTE.gold);
    // Left spire
    g.fillTriangle(
      Math.round(5 * s),
      baseY - turretHeight,
      Math.round(17 * s),
      baseY - turretHeight,
      Math.round(11 * s),
      baseY - turretHeight - Math.round(12 * s)
    );
    // Right spire
    g.fillTriangle(
      bWidth - Math.round(17 * s),
      baseY - turretHeight,
      bWidth - Math.round(5 * s),
      baseY - turretHeight,
      bWidth - Math.round(11 * s),
      baseY - turretHeight - Math.round(12 * s)
    );

    // Main tower spire - grand central spire
    g.fillStyle(PALETTE.gold);
    g.fillTriangle(
      towerX,
      towerY,
      towerX + towerWidth,
      towerY,
      bWidth / 2,
      towerY - Math.round(20 * s)
    );

    // Glowing windows - cyan/teal glow (Bags brand)
    const windowColor = 0x4ade80; // Bags green
    g.fillStyle(windowColor);

    // Main tower windows (3 rows)
    for (let row = 0; row < 3; row++) {
      const windowY = towerY + Math.round(15 * s) + row * Math.round(14 * s);
      g.fillRect(towerX + Math.round(8 * s), windowY, Math.round(8 * s), Math.round(10 * s));
      g.fillRect(towerX + Math.round(24 * s), windowY, Math.round(8 * s), Math.round(10 * s));
    }

    // Window glow effect
    g.fillStyle(windowColor, 0.3);
    for (let row = 0; row < 3; row++) {
      const windowY = towerY + Math.round(15 * s) + row * Math.round(14 * s);
      g.fillRect(
        towerX + Math.round(6 * s),
        windowY - Math.round(2 * s),
        Math.round(12 * s),
        Math.round(14 * s)
      );
      g.fillRect(
        towerX + Math.round(22 * s),
        windowY - Math.round(2 * s),
        Math.round(12 * s),
        Math.round(14 * s)
      );
    }

    // Side turret windows
    g.fillStyle(windowColor);
    g.fillRect(Math.round(8 * s), baseY - Math.round(25 * s), Math.round(6 * s), Math.round(8 * s));
    g.fillRect(
      bWidth - Math.round(14 * s),
      baseY - Math.round(25 * s),
      Math.round(6 * s),
      Math.round(8 * s)
    );

    // Grand entrance door (arched)
    g.fillStyle(0x0f0f23);
    g.fillRect(
      bWidth / 2 - Math.round(6 * s),
      baseY - Math.round(16 * s),
      Math.round(12 * s),
      Math.round(16 * s)
    );
    // Door arch
    g.fillCircle(bWidth / 2, baseY - Math.round(16 * s), Math.round(6 * s));
    // Door trim
    g.fillStyle(PALETTE.gold);
    g.fillRect(
      bWidth / 2 - Math.round(7 * s),
      baseY - Math.round(16 * s),
      Math.round(2 * s),
      Math.round(16 * s)
    );
    g.fillRect(
      bWidth / 2 + Math.round(5 * s),
      baseY - Math.round(16 * s),
      Math.round(2 * s),
      Math.round(16 * s)
    );

    // Floating particles/magic effect (small gold dots)
    g.fillStyle(PALETTE.gold, 0.8);
    const particlePositions = [
      [20, 30],
      [60, 25],
      [35, 15],
      [50, 40],
      [25, 50],
      [55, 55],
    ];
    particlePositions.forEach(([px, py]) => {
      g.fillCircle(Math.round((px * s) / 1.8), Math.round((py * s) / 1.8), Math.round(1.5 * s));
    });

    // "BAGS" text emblem at top (simplified pixel banner)
    g.fillStyle(PALETTE.gold);
    g.fillRect(
      bWidth / 2 - Math.round(10 * s),
      towerY + Math.round(5 * s),
      Math.round(20 * s),
      Math.round(6 * s)
    );
    g.fillStyle(0x1a1a2e);
    g.fillRect(
      bWidth / 2 - Math.round(8 * s),
      towerY + Math.round(6 * s),
      Math.round(16 * s),
      Math.round(4 * s)
    );

    g.generateTexture("bagshq", canvasWidth, canvasHeight);
    g.destroy();
  }

  /**
   * Generate elegant mansion sprites for Ballers Valley
   * Classical estate style with refined proportions, graceful arches, and sophisticated details
   */
  private generateMansions(): void {
    const s = SCALE;
    // Larger canvas for more detail
    const canvasWidth = Math.round(120 * s);
    const canvasHeight = Math.round(200 * s);

    // Each mansion has unique architecture with luxury details
    this.generateMansion0_GrandPalace(s, canvasWidth, canvasHeight);
    this.generateMansion1_VictorianTower(s, canvasWidth, canvasHeight);
    this.generateMansion2_FrenchChateau(s, canvasWidth, canvasHeight);
    this.generateMansion3_ArtDecoEstate(s, canvasWidth, canvasHeight);
    this.generateMansion4_ColonialManor(s, canvasWidth, canvasHeight);
  }

  // MANSION 0: Grand Palace - Opulent royal palace with golden dome (TOP HOLDER)
  private generateMansion0_GrandPalace(s: number, canvasWidth: number, canvasHeight: number): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const style = {
      base: 0x1e3a5f, // Deep royal blue
      baseLight: 0x2d4a6f,
      baseDark: 0x0f2744,
      roof: 0xffd700, // Pure gold
      roofLight: 0xffec8b,
      trim: 0xffd700,
      window: 0x7fff00, // Bright chartreuse glow
      windowGlow: 0x00ff41,
      column: 0xfaf0e6, // Linen white
      columnLight: 0xffffff,
    };
    const centerX = canvasWidth / 2;
    const groundY = canvasHeight - Math.round(8 * s); // Leave room for foundation

    // === FOUNDATION/BASE with steps ===
    g.fillStyle(0x4a4a4a);
    g.fillRect(Math.round(8 * s), groundY, canvasWidth - Math.round(16 * s), Math.round(8 * s));
    g.fillStyle(0x5a5a5a);
    g.fillRect(
      Math.round(12 * s),
      groundY - Math.round(4 * s),
      canvasWidth - Math.round(24 * s),
      Math.round(4 * s)
    );
    g.fillStyle(0x6a6a6a);
    g.fillRect(
      Math.round(16 * s),
      groundY - Math.round(8 * s),
      canvasWidth - Math.round(32 * s),
      Math.round(4 * s)
    );

    // === MAIN CENTRAL BODY ===
    const mainW = Math.round(50 * s);
    const mainH = Math.round(90 * s);
    const mainX = centerX - mainW / 2;
    const mainY = groundY - Math.round(8 * s) - mainH;

    // Drop shadow
    g.fillStyle(0x000000, 0.5);
    g.fillRect(mainX + Math.round(5 * s), mainY + Math.round(8 * s), mainW, mainH);

    // Main body with gradient effect (multiple layers)
    g.fillStyle(style.base);
    g.fillRect(mainX, mainY, mainW, mainH);
    // Light edge (left)
    g.fillStyle(style.baseLight);
    g.fillRect(mainX, mainY, Math.round(5 * s), mainH);
    // Dark edge (right)
    g.fillStyle(style.baseDark);
    g.fillRect(mainX + mainW - Math.round(5 * s), mainY, Math.round(5 * s), mainH);

    // Dithering texture on walls
    g.fillStyle(style.baseLight, 0.15);
    for (let py = 0; py < mainH; py += Math.round(4 * s)) {
      for (let px = 0; px < mainW; px += Math.round(8 * s)) {
        if ((py / Math.round(4 * s) + px / Math.round(8 * s)) % 2 === 0) {
          g.fillRect(mainX + px, mainY + py, Math.round(2 * s), Math.round(2 * s));
        }
      }
    }

    // === LEFT WING ===
    const wingW = Math.round(28 * s);
    const wingH = Math.round(65 * s);
    const leftWingX = mainX - wingW + Math.round(4 * s);
    const wingY = groundY - Math.round(8 * s) - wingH;

    g.fillStyle(0x000000, 0.4);
    g.fillRect(leftWingX + Math.round(4 * s), wingY + Math.round(6 * s), wingW, wingH);
    g.fillStyle(style.base);
    g.fillRect(leftWingX, wingY, wingW, wingH);
    g.fillStyle(style.baseLight);
    g.fillRect(leftWingX, wingY, Math.round(4 * s), wingH);

    // Wing roof with balustrade
    g.fillStyle(style.roof);
    g.fillRect(
      leftWingX - Math.round(3 * s),
      wingY - Math.round(8 * s),
      wingW + Math.round(6 * s),
      Math.round(8 * s)
    );
    g.fillStyle(style.roofLight);
    g.fillRect(
      leftWingX - Math.round(3 * s),
      wingY - Math.round(8 * s),
      wingW + Math.round(6 * s),
      Math.round(2 * s)
    );
    // Balustrade posts
    for (let p = 0; p < 5; p++) {
      const px = leftWingX + Math.round(3 * s) + p * Math.round(6 * s);
      g.fillStyle(style.column);
      g.fillRect(px, wingY - Math.round(14 * s), Math.round(3 * s), Math.round(6 * s));
    }
    g.fillStyle(style.column);
    g.fillRect(leftWingX, wingY - Math.round(16 * s), wingW, Math.round(2 * s));

    // Wing windows with GLOW effect
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const wx = leftWingX + Math.round(5 * s) + col * Math.round(12 * s);
        const wy = wingY + Math.round(12 * s) + row * Math.round(26 * s);
        // Outer glow
        g.fillStyle(style.windowGlow, 0.25);
        g.fillRect(
          wx - Math.round(3 * s),
          wy - Math.round(3 * s),
          Math.round(14 * s),
          Math.round(22 * s)
        );
        // Inner glow
        g.fillStyle(style.windowGlow, 0.4);
        g.fillRect(
          wx - Math.round(1 * s),
          wy - Math.round(1 * s),
          Math.round(10 * s),
          Math.round(18 * s)
        );
        // Window pane
        g.fillStyle(style.window);
        g.fillRect(wx, wy, Math.round(8 * s), Math.round(16 * s));
        // Mullions (cross pattern)
        g.fillStyle(style.column);
        g.fillRect(wx + Math.round(3.5 * s), wy, Math.round(1 * s), Math.round(16 * s));
        g.fillRect(wx, wy + Math.round(7.5 * s), Math.round(8 * s), Math.round(1 * s));
        // Arched top
        g.fillStyle(style.window);
        g.fillCircle(wx + Math.round(4 * s), wy, Math.round(4 * s));
      }
    }

    // === RIGHT WING (mirror) ===
    const rightWingX = mainX + mainW - Math.round(4 * s);
    g.fillStyle(0x000000, 0.4);
    g.fillRect(rightWingX + Math.round(4 * s), wingY + Math.round(6 * s), wingW, wingH);
    g.fillStyle(style.base);
    g.fillRect(rightWingX, wingY, wingW, wingH);
    g.fillStyle(style.baseDark);
    g.fillRect(rightWingX + wingW - Math.round(4 * s), wingY, Math.round(4 * s), wingH);

    // Right wing roof with balustrade
    g.fillStyle(style.roof);
    g.fillRect(
      rightWingX - Math.round(3 * s),
      wingY - Math.round(8 * s),
      wingW + Math.round(6 * s),
      Math.round(8 * s)
    );
    g.fillStyle(style.roofLight);
    g.fillRect(
      rightWingX - Math.round(3 * s),
      wingY - Math.round(8 * s),
      wingW + Math.round(6 * s),
      Math.round(2 * s)
    );
    for (let p = 0; p < 5; p++) {
      const px = rightWingX + Math.round(3 * s) + p * Math.round(6 * s);
      g.fillStyle(style.column);
      g.fillRect(px, wingY - Math.round(14 * s), Math.round(3 * s), Math.round(6 * s));
    }
    g.fillStyle(style.column);
    g.fillRect(rightWingX, wingY - Math.round(16 * s), wingW, Math.round(2 * s));

    // Right wing windows
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const wx = rightWingX + Math.round(5 * s) + col * Math.round(12 * s);
        const wy = wingY + Math.round(12 * s) + row * Math.round(26 * s);
        g.fillStyle(style.windowGlow, 0.25);
        g.fillRect(
          wx - Math.round(3 * s),
          wy - Math.round(3 * s),
          Math.round(14 * s),
          Math.round(22 * s)
        );
        g.fillStyle(style.windowGlow, 0.4);
        g.fillRect(
          wx - Math.round(1 * s),
          wy - Math.round(1 * s),
          Math.round(10 * s),
          Math.round(18 * s)
        );
        g.fillStyle(style.window);
        g.fillRect(wx, wy, Math.round(8 * s), Math.round(16 * s));
        g.fillStyle(style.column);
        g.fillRect(wx + Math.round(3.5 * s), wy, Math.round(1 * s), Math.round(16 * s));
        g.fillRect(wx, wy + Math.round(7.5 * s), Math.round(8 * s), Math.round(1 * s));
        g.fillStyle(style.window);
        g.fillCircle(wx + Math.round(4 * s), wy, Math.round(4 * s));
      }
    }

    // === GRAND GOLDEN DOME ===
    const domeR = Math.round(26 * s);
    const domeY = mainY - Math.round(12 * s);

    // Dome drum (base)
    g.fillStyle(style.column);
    g.fillRect(
      centerX - Math.round(24 * s),
      domeY - Math.round(4 * s),
      Math.round(48 * s),
      Math.round(12 * s)
    );
    // Drum columns
    for (let dc = 0; dc < 8; dc++) {
      const dcx = centerX - Math.round(22 * s) + dc * Math.round(6 * s);
      g.fillStyle(style.columnLight);
      g.fillRect(dcx, domeY - Math.round(2 * s), Math.round(2 * s), Math.round(10 * s));
    }

    // Main dome
    g.fillStyle(style.roof);
    g.fillCircle(centerX, domeY, domeR);
    // Dome highlight (shiny reflection)
    g.fillStyle(style.roofLight, 0.7);
    g.fillCircle(centerX - Math.round(8 * s), domeY - Math.round(8 * s), Math.round(12 * s));
    g.fillStyle(0xffffff, 0.4);
    g.fillCircle(centerX - Math.round(10 * s), domeY - Math.round(10 * s), Math.round(6 * s));
    // Dome ribs (decorative lines)
    g.fillStyle(darken(style.roof, 0.15));
    for (let r = 0; r < 6; r++) {
      const angle = (r / 6) * Math.PI;
      const rx = Math.cos(angle) * domeR * 0.9;
      g.fillRect(
        centerX + rx - Math.round(1 * s),
        domeY - domeR + Math.round(5 * s),
        Math.round(2 * s),
        domeR * 2 - Math.round(10 * s)
      );
    }

    // FINIAL (ornate gold spire on top)
    g.fillStyle(style.trim);
    g.fillRect(
      centerX - Math.round(2 * s),
      domeY - domeR - Math.round(18 * s),
      Math.round(4 * s),
      Math.round(18 * s)
    );
    g.fillStyle(style.roofLight);
    g.fillCircle(centerX, domeY - domeR - Math.round(22 * s), Math.round(5 * s));
    g.fillStyle(style.trim);
    g.fillCircle(centerX, domeY - domeR - Math.round(22 * s), Math.round(3 * s));
    // Cross on top
    g.fillRect(
      centerX - Math.round(4 * s),
      domeY - domeR - Math.round(30 * s),
      Math.round(8 * s),
      Math.round(3 * s)
    );
    g.fillRect(
      centerX - Math.round(1.5 * s),
      domeY - domeR - Math.round(36 * s),
      Math.round(3 * s),
      Math.round(12 * s)
    );

    // === ORNATE CORNICE ===
    g.fillStyle(style.trim);
    g.fillRect(
      mainX - Math.round(4 * s),
      mainY - Math.round(6 * s),
      mainW + Math.round(8 * s),
      Math.round(8 * s)
    );
    g.fillStyle(style.roofLight);
    g.fillRect(
      mainX - Math.round(4 * s),
      mainY - Math.round(6 * s),
      mainW + Math.round(8 * s),
      Math.round(2 * s)
    );
    // Dentil molding
    for (let d = 0; d < 12; d++) {
      g.fillStyle(style.column);
      g.fillRect(
        mainX + Math.round(2 * s) + d * Math.round(4 * s),
        mainY + Math.round(2 * s),
        Math.round(2 * s),
        Math.round(4 * s)
      );
    }

    // === MAIN BODY WINDOWS with chandelier glow ===
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const wx = mainX + Math.round(7 * s) + col * Math.round(14 * s);
        const wy = mainY + Math.round(14 * s) + row * Math.round(26 * s);
        // Outer glow
        g.fillStyle(style.windowGlow, 0.3);
        g.fillRect(
          wx - Math.round(4 * s),
          wy - Math.round(4 * s),
          Math.round(18 * s),
          Math.round(26 * s)
        );
        // Inner glow
        g.fillStyle(style.windowGlow, 0.5);
        g.fillRect(
          wx - Math.round(2 * s),
          wy - Math.round(2 * s),
          Math.round(14 * s),
          Math.round(22 * s)
        );
        // Window frame (gold)
        g.fillStyle(style.trim);
        g.fillRect(
          wx - Math.round(1 * s),
          wy - Math.round(1 * s),
          Math.round(12 * s),
          Math.round(20 * s)
        );
        // Window pane
        g.fillStyle(style.window);
        g.fillRect(wx, wy, Math.round(10 * s), Math.round(18 * s));
        // Arched top
        g.fillCircle(wx + Math.round(5 * s), wy, Math.round(5 * s));
        // Mullions
        g.fillStyle(style.column);
        g.fillRect(wx + Math.round(4.5 * s), wy, Math.round(1 * s), Math.round(18 * s));
        g.fillRect(wx, wy + Math.round(8.5 * s), Math.round(10 * s), Math.round(1 * s));
        // Chandelier sparkle in center window (middle row)
        if (row === 1 && col === 1) {
          g.fillStyle(0xffffff, 0.9);
          g.fillCircle(wx + Math.round(5 * s), wy + Math.round(6 * s), Math.round(2 * s));
          g.fillStyle(style.windowGlow, 0.7);
          g.fillCircle(wx + Math.round(5 * s), wy + Math.round(6 * s), Math.round(4 * s));
        }
        // Decorative pediment above each window
        g.fillStyle(style.trim);
        g.fillTriangle(
          wx - Math.round(2 * s),
          wy - Math.round(2 * s),
          wx + Math.round(12 * s),
          wy - Math.round(2 * s),
          wx + Math.round(5 * s),
          wy - Math.round(8 * s)
        );
      }
    }

    // === GRAND ENTRANCE with columns ===
    const doorW = Math.round(18 * s);
    const doorH = Math.round(30 * s);
    const doorX = centerX - doorW / 2;
    const doorY = groundY - Math.round(8 * s) - doorH;

    // Entrance portico roof
    g.fillStyle(style.roof);
    g.fillRect(
      doorX - Math.round(12 * s),
      doorY - Math.round(10 * s),
      doorW + Math.round(24 * s),
      Math.round(8 * s)
    );
    g.fillStyle(style.roofLight);
    g.fillRect(
      doorX - Math.round(12 * s),
      doorY - Math.round(10 * s),
      doorW + Math.round(24 * s),
      Math.round(2 * s)
    );
    // Triangular pediment
    g.fillStyle(style.trim);
    g.fillTriangle(
      doorX - Math.round(14 * s),
      doorY - Math.round(10 * s),
      doorX + doorW + Math.round(14 * s),
      doorY - Math.round(10 * s),
      centerX,
      doorY - Math.round(26 * s)
    );
    g.fillStyle(style.roofLight);
    g.fillTriangle(
      doorX - Math.round(10 * s),
      doorY - Math.round(10 * s),
      doorX + doorW + Math.round(10 * s),
      doorY - Math.round(10 * s),
      centerX,
      doorY - Math.round(20 * s)
    );

    // Grand columns (4 fluted columns)
    for (let c = 0; c < 4; c++) {
      const cx = doorX - Math.round(8 * s) + c * Math.round(12 * s);
      g.fillStyle(style.column);
      g.fillRect(cx, doorY - Math.round(2 * s), Math.round(5 * s), doorH + Math.round(2 * s));
      // Column fluting (grooves)
      g.fillStyle(style.columnLight);
      g.fillRect(cx + Math.round(1 * s), doorY, Math.round(1 * s), doorH);
      g.fillStyle(0xcccccc);
      g.fillRect(cx + Math.round(3 * s), doorY, Math.round(1 * s), doorH);
      // Capital
      g.fillStyle(style.trim);
      g.fillRect(
        cx - Math.round(1 * s),
        doorY - Math.round(6 * s),
        Math.round(7 * s),
        Math.round(4 * s)
      );
      // Base
      g.fillRect(
        cx - Math.round(1 * s),
        doorY + doorH - Math.round(3 * s),
        Math.round(7 * s),
        Math.round(3 * s)
      );
    }

    // Door arch
    g.fillStyle(style.trim);
    g.fillRect(
      doorX - Math.round(4 * s),
      doorY - Math.round(4 * s),
      doorW + Math.round(8 * s),
      doorH + Math.round(4 * s)
    );
    g.fillCircle(centerX, doorY - Math.round(4 * s), doorW / 2 + Math.round(4 * s));
    // Door opening
    g.fillStyle(0x0a0a0a);
    g.fillRect(doorX, doorY, doorW, doorH);
    g.fillCircle(centerX, doorY, doorW / 2);
    // Ornate door panels
    g.fillStyle(0x3d2817);
    g.fillRect(
      doorX + Math.round(2 * s),
      doorY + Math.round(4 * s),
      doorW / 2 - Math.round(3 * s),
      doorH - Math.round(4 * s)
    );
    g.fillRect(
      doorX + doorW / 2 + Math.round(1 * s),
      doorY + Math.round(4 * s),
      doorW / 2 - Math.round(3 * s),
      doorH - Math.round(4 * s)
    );
    // Door knockers (gold circles)
    g.fillStyle(style.trim);
    g.fillCircle(doorX + Math.round(6 * s), doorY + Math.round(16 * s), Math.round(2 * s));
    g.fillCircle(doorX + doorW - Math.round(6 * s), doorY + Math.round(16 * s), Math.round(2 * s));
    // Fanlight window above door
    g.fillStyle(style.window, 0.7);
    g.fillCircle(centerX, doorY - Math.round(2 * s), doorW / 2 - Math.round(2 * s));
    // Fanlight muntins
    for (let m = 0; m < 5; m++) {
      const angle = (m / 5) * Math.PI;
      const mx = Math.cos(angle) * (doorW / 2 - Math.round(4 * s));
      const my = Math.sin(angle) * (doorW / 2 - Math.round(4 * s));
      g.fillStyle(style.column);
      g.fillRect(
        centerX - Math.round(0.5 * s),
        doorY - Math.round(2 * s),
        Math.round(1 * s),
        -(doorW / 2 - Math.round(4 * s))
      );
    }

    g.generateTexture("mansion_0", canvasWidth, canvasHeight);
    g.destroy();
  }

  // MANSION 1: Obsidian Tower - Dark Gothic Victorian with dramatic spires (#2 HOLDER)
  private generateMansion1_VictorianTower(
    s: number,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const style = {
      base: 0x1a1a2e, // Dark obsidian
      baseLight: 0x2a2a4e,
      baseDark: 0x0a0a1e,
      roof: 0x2d2d2d, // Dark slate
      roofLight: 0x4a4a4a,
      trim: 0xffd700, // Gold accents
      trimLight: 0xffec8b,
      window: 0xffb347, // Warm amber glow
      windowGlow: 0xff8c00,
      stainedGlass: 0xff4500, // Orange-red accent
    };
    const centerX = canvasWidth / 2;
    const groundY = canvasHeight - Math.round(6 * s);

    // === FOUNDATION ===
    g.fillStyle(0x2a2a2a);
    g.fillRect(Math.round(10 * s), groundY, canvasWidth - Math.round(20 * s), Math.round(6 * s));

    // === MAIN BODY (asymmetric Gothic) ===
    const mainW = Math.round(60 * s);
    const mainH = Math.round(80 * s);
    const mainX = Math.round(35 * s);
    const mainY = groundY - mainH;

    // Shadow
    g.fillStyle(0x000000, 0.5);
    g.fillRect(mainX + Math.round(5 * s), mainY + Math.round(8 * s), mainW, mainH);

    // Main body with texture
    g.fillStyle(style.base);
    g.fillRect(mainX, mainY, mainW, mainH);
    g.fillStyle(style.baseLight);
    g.fillRect(mainX, mainY, Math.round(5 * s), mainH);
    g.fillStyle(style.baseDark);
    g.fillRect(mainX + mainW - Math.round(5 * s), mainY, Math.round(5 * s), mainH);

    // Stone block pattern
    g.fillStyle(style.baseLight, 0.1);
    for (let row = 0; row < mainH / Math.round(8 * s); row++) {
      const offset = row % 2 === 0 ? 0 : Math.round(6 * s);
      for (let col = 0; col < mainW / Math.round(12 * s) + 1; col++) {
        g.fillRect(
          mainX + offset + col * Math.round(12 * s),
          mainY + row * Math.round(8 * s),
          Math.round(11 * s),
          Math.round(7 * s)
        );
      }
    }

    // === STEEP GOTHIC ROOF ===
    const roofPeakY = mainY - Math.round(45 * s);
    g.fillStyle(style.roof);
    g.fillTriangle(
      mainX - Math.round(6 * s),
      mainY,
      mainX + mainW + Math.round(6 * s),
      mainY,
      mainX + mainW / 2,
      roofPeakY
    );
    // Roof highlight
    g.fillStyle(style.roofLight);
    g.fillTriangle(
      mainX + Math.round(15 * s),
      mainY - Math.round(3 * s),
      mainX + mainW / 2,
      mainY - Math.round(3 * s),
      mainX + mainW / 2,
      roofPeakY + Math.round(8 * s)
    );
    // Roof tiles pattern
    for (let rt = 0; rt < 8; rt++) {
      const tileY = mainY - Math.round(8 * s) - rt * Math.round(5 * s);
      g.fillStyle(rt % 2 === 0 ? style.roof : style.roofLight, 0.3);
      const tileW = mainW - rt * Math.round(6 * s);
      g.fillRect(mainX + rt * Math.round(3 * s), tileY, tileW, Math.round(5 * s));
    }

    // === DRAMATIC CORNER TOWER ===
    const towerW = Math.round(28 * s);
    const towerH = Math.round(120 * s);
    const towerX = mainX - Math.round(10 * s);
    const towerY = groundY - towerH;

    g.fillStyle(0x000000, 0.45);
    g.fillRect(towerX + Math.round(4 * s), towerY + Math.round(6 * s), towerW, towerH);
    g.fillStyle(style.base);
    g.fillRect(towerX, towerY, towerW, towerH);
    g.fillStyle(style.baseLight);
    g.fillRect(towerX, towerY, Math.round(4 * s), towerH);

    // Stone pattern on tower
    g.fillStyle(style.baseLight, 0.08);
    for (let row = 0; row < towerH / Math.round(6 * s); row++) {
      const offset = row % 2 === 0 ? 0 : Math.round(4 * s);
      for (let col = 0; col < 4; col++) {
        g.fillRect(
          towerX + offset + col * Math.round(7 * s),
          towerY + row * Math.round(6 * s),
          Math.round(6 * s),
          Math.round(5 * s)
        );
      }
    }

    // WITCH'S HAT SPIRE (dramatic conical roof)
    const spireH = Math.round(50 * s);
    g.fillStyle(style.roof);
    g.fillTriangle(
      towerX - Math.round(5 * s),
      towerY,
      towerX + towerW + Math.round(5 * s),
      towerY,
      towerX + towerW / 2,
      towerY - spireH
    );
    g.fillStyle(style.roofLight);
    g.fillTriangle(
      towerX + Math.round(5 * s),
      towerY - Math.round(3 * s),
      towerX + towerW / 2,
      towerY - Math.round(3 * s),
      towerX + towerW / 2,
      towerY - spireH + Math.round(8 * s)
    );

    // GOLD FINIAL with ornate detail
    const finialX = towerX + towerW / 2;
    g.fillStyle(style.trim);
    g.fillRect(
      finialX - Math.round(2 * s),
      towerY - spireH - Math.round(15 * s),
      Math.round(4 * s),
      Math.round(15 * s)
    );
    g.fillStyle(style.trimLight);
    g.fillCircle(finialX, towerY - spireH - Math.round(18 * s), Math.round(4 * s));
    g.fillStyle(style.trim);
    g.fillCircle(finialX, towerY - spireH - Math.round(18 * s), Math.round(2 * s));
    // Lightning rod
    g.fillRect(
      finialX - Math.round(0.5 * s),
      towerY - spireH - Math.round(28 * s),
      Math.round(1 * s),
      Math.round(10 * s)
    );

    // === TOWER WINDOWS (Gothic arched with stained glass) ===
    for (let i = 0; i < 5; i++) {
      const wy = towerY + Math.round(12 * s) + i * Math.round(22 * s);
      const ww = Math.round(12 * s);
      const wh = Math.round(16 * s);
      const wx = towerX + towerW / 2 - ww / 2;

      // Window glow
      g.fillStyle(style.windowGlow, 0.4);
      g.fillRect(
        wx - Math.round(3 * s),
        wy - Math.round(3 * s),
        ww + Math.round(6 * s),
        wh + Math.round(6 * s)
      );
      // Stone frame
      g.fillStyle(style.baseLight);
      g.fillRect(
        wx - Math.round(1 * s),
        wy - Math.round(1 * s),
        ww + Math.round(2 * s),
        wh + Math.round(2 * s)
      );
      // Pointed arch top
      g.fillTriangle(
        wx - Math.round(1 * s),
        wy,
        wx + ww + Math.round(1 * s),
        wy,
        wx + ww / 2,
        wy - Math.round(8 * s)
      );
      // Window glass
      g.fillStyle(style.window);
      g.fillRect(wx, wy, ww, wh);
      g.fillTriangle(wx, wy, wx + ww, wy, wx + ww / 2, wy - Math.round(7 * s));
      // Gothic tracery (Y-shape)
      g.fillStyle(style.baseDark);
      g.fillRect(wx + ww / 2 - Math.round(0.5 * s), wy, Math.round(1 * s), wh);
      g.fillRect(wx, wy + Math.round(6 * s), ww, Math.round(1 * s));
      // Stained glass accent (every other window)
      if (i % 2 === 0) {
        g.fillStyle(style.stainedGlass, 0.6);
        g.fillCircle(wx + ww / 2, wy - Math.round(3 * s), Math.round(3 * s));
      }
    }

    // === MAIN BUILDING WINDOWS ===
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const wx = mainX + Math.round(25 * s) + col * Math.round(18 * s);
        const wy = mainY + Math.round(15 * s) + row * Math.round(32 * s);
        // Glow
        g.fillStyle(style.windowGlow, 0.35);
        g.fillRect(
          wx - Math.round(4 * s),
          wy - Math.round(4 * s),
          Math.round(20 * s),
          Math.round(28 * s)
        );
        // Frame
        g.fillStyle(style.trim);
        g.fillRect(
          wx - Math.round(2 * s),
          wy - Math.round(2 * s),
          Math.round(16 * s),
          Math.round(24 * s)
        );
        // Glass
        g.fillStyle(style.window);
        g.fillRect(wx, wy, Math.round(12 * s), Math.round(20 * s));
        // Gothic arch
        g.fillTriangle(
          wx,
          wy,
          wx + Math.round(12 * s),
          wy,
          wx + Math.round(6 * s),
          wy - Math.round(8 * s)
        );
        // Mullions
        g.fillStyle(style.baseDark);
        g.fillRect(wx + Math.round(5.5 * s), wy, Math.round(1 * s), Math.round(20 * s));
        g.fillRect(wx, wy + Math.round(9.5 * s), Math.round(12 * s), Math.round(1 * s));
        // Decorative header
        g.fillStyle(style.trim);
        g.fillRect(
          wx - Math.round(3 * s),
          wy - Math.round(10 * s),
          Math.round(18 * s),
          Math.round(4 * s)
        );
      }
    }

    // === GABLE ROSE WINDOW ===
    const roseX = mainX + mainW / 2;
    const roseY = roofPeakY + Math.round(18 * s);
    g.fillStyle(style.trim);
    g.fillCircle(roseX, roseY, Math.round(12 * s));
    g.fillStyle(style.windowGlow, 0.5);
    g.fillCircle(roseX, roseY, Math.round(10 * s));
    g.fillStyle(style.window);
    g.fillCircle(roseX, roseY, Math.round(8 * s));
    g.fillStyle(style.stainedGlass, 0.7);
    g.fillCircle(roseX, roseY, Math.round(4 * s));
    // Tracery spokes
    g.fillStyle(style.baseDark);
    for (let sp = 0; sp < 8; sp++) {
      const angle = (sp / 8) * Math.PI * 2;
      const dx = Math.cos(angle) * Math.round(8 * s);
      const dy = Math.sin(angle) * Math.round(8 * s);
      g.fillRect(roseX - Math.round(0.5 * s), roseY - Math.round(0.5 * s), dx, Math.round(1 * s));
    }

    // === GARGOYLES (decorative projections) ===
    // Left gargoyle
    g.fillStyle(style.baseLight);
    g.fillRect(
      mainX - Math.round(4 * s),
      mainY + Math.round(10 * s),
      Math.round(6 * s),
      Math.round(8 * s)
    );
    g.fillRect(
      mainX - Math.round(8 * s),
      mainY + Math.round(12 * s),
      Math.round(4 * s),
      Math.round(4 * s)
    );
    // Right gargoyle
    g.fillRect(
      mainX + mainW - Math.round(2 * s),
      mainY + Math.round(10 * s),
      Math.round(6 * s),
      Math.round(8 * s)
    );
    g.fillRect(
      mainX + mainW + Math.round(2 * s),
      mainY + Math.round(12 * s),
      Math.round(4 * s),
      Math.round(4 * s)
    );

    // === FRONT PORCH WITH COLUMNS ===
    const porchX = mainX + Math.round(38 * s);
    const porchW = Math.round(28 * s);
    const porchY = groundY - Math.round(35 * s);

    // Porch roof
    g.fillStyle(style.roof);
    g.fillRect(
      porchX - Math.round(4 * s),
      porchY - Math.round(4 * s),
      porchW + Math.round(8 * s),
      Math.round(6 * s)
    );
    g.fillStyle(style.trim);
    g.fillTriangle(
      porchX - Math.round(6 * s),
      porchY - Math.round(4 * s),
      porchX + porchW + Math.round(6 * s),
      porchY - Math.round(4 * s),
      porchX + porchW / 2,
      porchY - Math.round(16 * s)
    );

    // Gothic columns
    for (let c = 0; c < 2; c++) {
      const cx = porchX + Math.round(2 * s) + c * Math.round(22 * s);
      g.fillStyle(style.baseLight);
      g.fillRect(cx, porchY, Math.round(4 * s), Math.round(35 * s));
      // Carved details
      g.fillStyle(style.baseDark);
      g.fillRect(
        cx + Math.round(1 * s),
        porchY + Math.round(5 * s),
        Math.round(2 * s),
        Math.round(25 * s)
      );
    }

    // === ORNATE DOOR ===
    const doorW = Math.round(14 * s);
    const doorH = Math.round(28 * s);
    const doorX = porchX + porchW / 2 - doorW / 2;
    const doorY = groundY - doorH;

    // Door frame
    g.fillStyle(style.trim);
    g.fillRect(
      doorX - Math.round(3 * s),
      doorY - Math.round(10 * s),
      doorW + Math.round(6 * s),
      doorH + Math.round(10 * s)
    );
    // Pointed arch
    g.fillTriangle(
      doorX - Math.round(3 * s),
      doorY,
      doorX + doorW + Math.round(3 * s),
      doorY,
      doorX + doorW / 2,
      doorY - Math.round(12 * s)
    );
    // Door
    g.fillStyle(0x1a0a0a);
    g.fillRect(doorX, doorY, doorW, doorH);
    g.fillTriangle(
      doorX,
      doorY,
      doorX + doorW,
      doorY,
      doorX + doorW / 2,
      doorY - Math.round(10 * s)
    );
    // Door panels
    g.fillStyle(0x2a1a1a);
    g.fillRect(
      doorX + Math.round(2 * s),
      doorY + Math.round(4 * s),
      doorW / 2 - Math.round(3 * s),
      Math.round(20 * s)
    );
    g.fillRect(
      doorX + doorW / 2 + Math.round(1 * s),
      doorY + Math.round(4 * s),
      doorW / 2 - Math.round(3 * s),
      Math.round(20 * s)
    );
    // Gold knocker
    g.fillStyle(style.trim);
    g.fillCircle(doorX + doorW / 2, doorY + Math.round(14 * s), Math.round(3 * s));
    g.fillCircle(doorX + doorW / 2, doorY + Math.round(14 * s), Math.round(1.5 * s));

    // === SECONDARY SPIRE on main roof ===
    const spire2X = mainX + mainW / 2;
    const spire2Y = roofPeakY;
    g.fillStyle(style.roof);
    g.fillRect(spire2X - Math.round(4 * s), spire2Y, Math.round(8 * s), Math.round(-12 * s));
    g.fillTriangle(
      spire2X - Math.round(6 * s),
      spire2Y - Math.round(12 * s),
      spire2X + Math.round(6 * s),
      spire2Y - Math.round(12 * s),
      spire2X,
      spire2Y - Math.round(25 * s)
    );
    g.fillStyle(style.trim);
    g.fillCircle(spire2X, spire2Y - Math.round(28 * s), Math.round(3 * s));

    g.generateTexture("mansion_1", canvasWidth, canvasHeight);
    g.destroy();
  }

  // MANSION 2: Amethyst Chateau - Elegant French Baroque with crystal accents (#3 HOLDER)
  private generateMansion2_FrenchChateau(
    s: number,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const style = {
      base: 0x4a1a6b, // Rich purple
      baseLight: 0x6a2a8b,
      baseDark: 0x2a0a4b,
      roof: 0x9370db, // Medium purple (lavender)
      roofLight: 0xb19cd9,
      roofDark: 0x7b68ee,
      trim: 0xdda0dd, // Plum/pink trim
      trimLight: 0xeeccff,
      window: 0xe6e6fa, // Lavender glow
      windowGlow: 0xda70d6, // Orchid glow
      crystal: 0xff69b4, // Hot pink crystals
      crystalLight: 0xffb6c1,
      column: 0xc0c0c0, // Silver
    };
    const centerX = canvasWidth / 2;
    const groundY = canvasHeight - Math.round(6 * s);

    // === FOUNDATION ===
    g.fillStyle(0x4a4a5a);
    g.fillRect(Math.round(8 * s), groundY, canvasWidth - Math.round(16 * s), Math.round(6 * s));

    // === MAIN BODY ===
    const mainW = Math.round(70 * s);
    const mainH = Math.round(70 * s);
    const mainX = centerX - mainW / 2;
    const mainY = groundY - mainH;

    g.fillStyle(0x000000, 0.45);
    g.fillRect(mainX + Math.round(5 * s), mainY + Math.round(6 * s), mainW, mainH);
    g.fillStyle(style.base);
    g.fillRect(mainX, mainY, mainW, mainH);
    g.fillStyle(style.baseLight);
    g.fillRect(mainX, mainY, Math.round(5 * s), mainH);
    g.fillStyle(style.baseDark);
    g.fillRect(mainX + mainW - Math.round(5 * s), mainY, Math.round(5 * s), mainH);

    // Decorative horizontal bands
    g.fillStyle(style.trim, 0.4);
    g.fillRect(mainX, mainY + Math.round(22 * s), mainW, Math.round(3 * s));
    g.fillRect(mainX, mainY + mainH - Math.round(8 * s), mainW, Math.round(3 * s));

    // === STEEP MANSARD ROOF ===
    const roofH = Math.round(50 * s);
    // Lower steep section (curved appearance via stacking)
    g.fillStyle(style.roof);
    g.fillRect(mainX - Math.round(6 * s), mainY - roofH, mainW + Math.round(12 * s), roofH);
    // Curved roof effect
    for (let r = 0; r < 5; r++) {
      const ry = mainY - roofH + r * Math.round(10 * s);
      const rw = mainW + Math.round(12 * s) - r * Math.round(2 * s);
      const rx = mainX - Math.round(6 * s) + r * Math.round(1 * s);
      g.fillStyle(r % 2 === 0 ? style.roof : style.roofLight, 0.5);
      g.fillRect(rx, ry, rw, Math.round(10 * s));
    }
    // Flat top section
    g.fillStyle(style.roofDark);
    g.fillRect(
      mainX + Math.round(5 * s),
      mainY - roofH - Math.round(12 * s),
      mainW - Math.round(10 * s),
      Math.round(14 * s)
    );
    // Roof edge highlight
    g.fillStyle(style.trimLight);
    g.fillRect(
      mainX - Math.round(6 * s),
      mainY - roofH,
      mainW + Math.round(12 * s),
      Math.round(3 * s)
    );

    // === ORNATE DORMERS (3 with golden frames) ===
    for (let d = 0; d < 3; d++) {
      const dx = mainX + Math.round(10 * s) + d * Math.round(22 * s);
      const dy = mainY - roofH + Math.round(10 * s);
      const dw = Math.round(18 * s);
      const dh = Math.round(35 * s);

      // Dormer body
      g.fillStyle(style.base);
      g.fillRect(dx, dy, dw, dh);
      // Dormer roof (curved top)
      g.fillStyle(style.roof);
      g.fillCircle(dx + dw / 2, dy, dw / 2);
      g.fillTriangle(
        dx - Math.round(3 * s),
        dy,
        dx + dw + Math.round(3 * s),
        dy,
        dx + dw / 2,
        dy - Math.round(22 * s)
      );
      // Dormer finial
      g.fillStyle(style.trim);
      g.fillCircle(dx + dw / 2, dy - Math.round(24 * s), Math.round(3 * s));
      g.fillRect(
        dx + dw / 2 - Math.round(1 * s),
        dy - Math.round(28 * s),
        Math.round(2 * s),
        Math.round(6 * s)
      );

      // Dormer window with glow
      const dwx = dx + Math.round(3 * s);
      const dwy = dy + Math.round(5 * s);
      g.fillStyle(style.windowGlow, 0.4);
      g.fillRect(
        dwx - Math.round(2 * s),
        dwy - Math.round(2 * s),
        Math.round(16 * s),
        Math.round(28 * s)
      );
      g.fillStyle(style.trim);
      g.fillRect(
        dwx - Math.round(1 * s),
        dwy - Math.round(1 * s),
        Math.round(14 * s),
        Math.round(26 * s)
      );
      g.fillStyle(style.window);
      g.fillRect(dwx, dwy, Math.round(12 * s), Math.round(24 * s));
      // Arched top
      g.fillCircle(dwx + Math.round(6 * s), dwy, Math.round(6 * s));
      // Mullions
      g.fillStyle(style.column);
      g.fillRect(dwx + Math.round(5.5 * s), dwy, Math.round(1 * s), Math.round(24 * s));
      g.fillRect(dwx, dwy + Math.round(11.5 * s), Math.round(12 * s), Math.round(1 * s));
    }

    // === CORNER TURRETS (elegant round towers) ===
    const turretR = Math.round(12 * s);
    const turretH = Math.round(60 * s);

    // Left turret
    const ltX = mainX - Math.round(4 * s);
    const ltY = mainY + Math.round(10 * s);
    g.fillStyle(style.base);
    g.fillCircle(ltX, ltY, turretR);
    g.fillRect(ltX - turretR, ltY, turretR * 2, turretH);
    g.fillStyle(style.baseLight);
    g.fillRect(ltX - turretR, ltY, Math.round(4 * s), turretH);
    // Turret roof (conical)
    g.fillStyle(style.roof);
    g.fillTriangle(
      ltX - turretR - Math.round(3 * s),
      ltY,
      ltX + turretR + Math.round(3 * s),
      ltY,
      ltX,
      ltY - Math.round(30 * s)
    );
    g.fillStyle(style.roofLight);
    g.fillTriangle(
      ltX - Math.round(6 * s),
      ltY - Math.round(2 * s),
      ltX,
      ltY - Math.round(2 * s),
      ltX,
      ltY - Math.round(28 * s)
    );
    // Turret finial with crystal
    g.fillStyle(style.trim);
    g.fillRect(
      ltX - Math.round(1.5 * s),
      ltY - Math.round(40 * s),
      Math.round(3 * s),
      Math.round(12 * s)
    );
    g.fillStyle(style.crystal);
    g.fillCircle(ltX, ltY - Math.round(44 * s), Math.round(4 * s));
    g.fillStyle(style.crystalLight, 0.7);
    g.fillCircle(ltX - Math.round(1 * s), ltY - Math.round(45 * s), Math.round(2 * s));
    // Turret windows
    for (let tw = 0; tw < 2; tw++) {
      const twy = ltY + Math.round(10 * s) + tw * Math.round(22 * s);
      g.fillStyle(style.windowGlow, 0.3);
      g.fillCircle(ltX, twy + Math.round(5 * s), Math.round(7 * s));
      g.fillStyle(style.window);
      g.fillRect(ltX - Math.round(5 * s), twy, Math.round(10 * s), Math.round(14 * s));
    }

    // Right turret (mirror)
    const rtX = mainX + mainW + Math.round(4 * s);
    g.fillStyle(style.base);
    g.fillCircle(rtX, ltY, turretR);
    g.fillRect(rtX - turretR, ltY, turretR * 2, turretH);
    g.fillStyle(style.baseDark);
    g.fillRect(rtX + turretR - Math.round(4 * s), ltY, Math.round(4 * s), turretH);
    g.fillStyle(style.roof);
    g.fillTriangle(
      rtX - turretR - Math.round(3 * s),
      ltY,
      rtX + turretR + Math.round(3 * s),
      ltY,
      rtX,
      ltY - Math.round(30 * s)
    );
    g.fillStyle(style.trim);
    g.fillRect(
      rtX - Math.round(1.5 * s),
      ltY - Math.round(40 * s),
      Math.round(3 * s),
      Math.round(12 * s)
    );
    g.fillStyle(style.crystal);
    g.fillCircle(rtX, ltY - Math.round(44 * s), Math.round(4 * s));
    g.fillStyle(style.crystalLight, 0.7);
    g.fillCircle(rtX - Math.round(1 * s), ltY - Math.round(45 * s), Math.round(2 * s));
    for (let tw = 0; tw < 2; tw++) {
      const twy = ltY + Math.round(10 * s) + tw * Math.round(22 * s);
      g.fillStyle(style.windowGlow, 0.3);
      g.fillCircle(rtX, twy + Math.round(5 * s), Math.round(7 * s));
      g.fillStyle(style.window);
      g.fillRect(rtX - Math.round(5 * s), twy, Math.round(10 * s), Math.round(14 * s));
    }

    // === MAIN FLOOR WINDOWS (tall French windows with balconies) ===
    for (let w = 0; w < 5; w++) {
      const wx = mainX + Math.round(8 * s) + w * Math.round(13 * s);
      const wy = mainY + Math.round(8 * s);
      const ww = Math.round(10 * s);
      const wh = Math.round(45 * s);

      // Window glow
      g.fillStyle(style.windowGlow, 0.35);
      g.fillRect(
        wx - Math.round(3 * s),
        wy - Math.round(3 * s),
        ww + Math.round(6 * s),
        wh + Math.round(6 * s)
      );
      // Frame
      g.fillStyle(style.trim);
      g.fillRect(
        wx - Math.round(1 * s),
        wy - Math.round(1 * s),
        ww + Math.round(2 * s),
        wh + Math.round(2 * s)
      );
      // Glass
      g.fillStyle(style.window);
      g.fillRect(wx, wy, ww, wh);
      // Arched top
      g.fillCircle(wx + ww / 2, wy, ww / 2);
      // Mullions (French style)
      g.fillStyle(style.column);
      g.fillRect(wx + ww / 2 - Math.round(0.5 * s), wy, Math.round(1 * s), wh);
      for (let m = 0; m < 4; m++) {
        g.fillRect(wx, wy + Math.round(10 * s) + m * Math.round(10 * s), ww, Math.round(1 * s));
      }
      // Decorative header
      g.fillStyle(style.trimLight);
      g.fillRect(
        wx - Math.round(2 * s),
        wy - Math.round(6 * s),
        ww + Math.round(4 * s),
        Math.round(4 * s)
      );

      // Balcony (on center 3 windows)
      if (w >= 1 && w <= 3) {
        g.fillStyle(style.column);
        g.fillRect(
          wx - Math.round(3 * s),
          wy + wh - Math.round(2 * s),
          ww + Math.round(6 * s),
          Math.round(4 * s)
        );
        // Balcony rails
        g.fillStyle(style.trim);
        g.fillRect(
          wx - Math.round(4 * s),
          wy + wh - Math.round(8 * s),
          Math.round(2 * s),
          Math.round(8 * s)
        );
        g.fillRect(
          wx + ww + Math.round(2 * s),
          wy + wh - Math.round(8 * s),
          Math.round(2 * s),
          Math.round(8 * s)
        );
        g.fillRect(
          wx - Math.round(4 * s),
          wy + wh - Math.round(8 * s),
          ww + Math.round(8 * s),
          Math.round(2 * s)
        );
        // Rail balusters
        for (let b = 0; b < 4; b++) {
          g.fillRect(
            wx + Math.round(1 * s) + b * Math.round(3 * s),
            wy + wh - Math.round(6 * s),
            Math.round(1 * s),
            Math.round(4 * s)
          );
        }
      }
    }

    // === GRAND ENTRANCE (French baroque style) ===
    const doorW = Math.round(20 * s);
    const doorH = Math.round(32 * s);
    const doorX = centerX - doorW / 2;
    const doorY = groundY - doorH;

    // Entrance portico
    g.fillStyle(style.roof);
    g.fillRect(
      doorX - Math.round(10 * s),
      doorY - Math.round(8 * s),
      doorW + Math.round(20 * s),
      Math.round(6 * s)
    );
    // Curved pediment
    g.fillStyle(style.trim);
    g.fillCircle(centerX, doorY - Math.round(8 * s), Math.round(18 * s));
    g.fillStyle(style.base);
    g.fillCircle(centerX, doorY - Math.round(4 * s), Math.round(14 * s));
    // Decorative crest in pediment
    g.fillStyle(style.crystal);
    g.fillCircle(centerX, doorY - Math.round(16 * s), Math.round(6 * s));
    g.fillStyle(style.crystalLight);
    g.fillCircle(centerX - Math.round(2 * s), doorY - Math.round(18 * s), Math.round(3 * s));

    // Door frame
    g.fillStyle(style.trim);
    g.fillRect(
      doorX - Math.round(4 * s),
      doorY - Math.round(4 * s),
      doorW + Math.round(8 * s),
      doorH + Math.round(4 * s)
    );
    // Door
    g.fillStyle(0x2a1a3a);
    g.fillRect(doorX, doorY, doorW, doorH);
    // Door panels
    g.fillStyle(0x3a2a4a);
    g.fillRect(
      doorX + Math.round(2 * s),
      doorY + Math.round(4 * s),
      doorW / 2 - Math.round(3 * s),
      doorH - Math.round(4 * s)
    );
    g.fillRect(
      doorX + doorW / 2 + Math.round(1 * s),
      doorY + Math.round(4 * s),
      doorW / 2 - Math.round(3 * s),
      doorH - Math.round(4 * s)
    );
    // Crystal door handles
    g.fillStyle(style.crystal);
    g.fillCircle(doorX + Math.round(7 * s), doorY + Math.round(18 * s), Math.round(2 * s));
    g.fillCircle(doorX + doorW - Math.round(7 * s), doorY + Math.round(18 * s), Math.round(2 * s));
    // Transom window
    g.fillStyle(style.windowGlow, 0.5);
    g.fillRect(
      doorX + Math.round(2 * s),
      doorY - Math.round(2 * s),
      doorW - Math.round(4 * s),
      Math.round(6 * s)
    );

    // Flanking columns
    for (let c = 0; c < 2; c++) {
      const cx = doorX - Math.round(8 * s) + c * (doorW + Math.round(12 * s));
      g.fillStyle(style.column);
      g.fillRect(cx, doorY - Math.round(4 * s), Math.round(4 * s), doorH + Math.round(4 * s));
      // Column highlight
      g.fillStyle(0xffffff, 0.5);
      g.fillRect(cx + Math.round(1 * s), doorY, Math.round(1 * s), doorH);
    }

    // === ROOFTOP BALUSTRADE ===
    const balY = mainY - roofH - Math.round(12 * s);
    g.fillStyle(style.column);
    g.fillRect(mainX + Math.round(5 * s), balY, mainW - Math.round(10 * s), Math.round(3 * s));
    for (let b = 0; b < 10; b++) {
      g.fillRect(
        mainX + Math.round(8 * s) + b * Math.round(6 * s),
        balY - Math.round(6 * s),
        Math.round(2 * s),
        Math.round(6 * s)
      );
    }
    g.fillRect(
      mainX + Math.round(5 * s),
      balY - Math.round(8 * s),
      mainW - Math.round(10 * s),
      Math.round(2 * s)
    );

    // === DECORATIVE URNS on corners ===
    g.fillStyle(style.trim);
    g.fillRect(
      mainX + Math.round(6 * s),
      balY - Math.round(14 * s),
      Math.round(6 * s),
      Math.round(6 * s)
    );
    g.fillRect(
      mainX + mainW - Math.round(12 * s),
      balY - Math.round(14 * s),
      Math.round(6 * s),
      Math.round(6 * s)
    );
    g.fillStyle(style.crystal);
    g.fillCircle(mainX + Math.round(9 * s), balY - Math.round(18 * s), Math.round(4 * s));
    g.fillCircle(mainX + mainW - Math.round(9 * s), balY - Math.round(18 * s), Math.round(4 * s));

    g.generateTexture("mansion_2", canvasWidth, canvasHeight);
    g.destroy();
  }

  // MANSION 3: Platinum Estate - Art Deco skyscraper-style with dramatic sunburst crown
  private generateMansion3_ArtDecoEstate(
    s: number,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    // Art Deco palette: Platinum silver with gold accents
    const style = {
      base: 0x2a2a35, // Dark charcoal
      baseLight: 0x3a3a45,
      baseDark: 0x1a1a25,
      silver: 0xc0c0c0, // Platinum silver
      silverLight: 0xe8e8e8,
      gold: 0xd4af37, // Art Deco gold
      goldBright: 0xffd700,
      window: 0x00d4ff, // Electric blue
      windowGlow: 0x00ffff,
    };
    const centerX = canvasWidth / 2;
    const groundY = canvasHeight - Math.round(8 * s);

    // === FOUNDATION with geometric steps ===
    g.fillStyle(0x1a1a1a);
    g.fillRect(Math.round(5 * s), groundY, canvasWidth - Math.round(10 * s), Math.round(8 * s));
    g.fillStyle(style.silver);
    g.fillRect(
      Math.round(8 * s),
      groundY - Math.round(3 * s),
      canvasWidth - Math.round(16 * s),
      Math.round(4 * s)
    );
    g.fillStyle(style.gold);
    g.fillRect(
      Math.round(10 * s),
      groundY - Math.round(4 * s),
      canvasWidth - Math.round(20 * s),
      Math.round(1 * s)
    );

    // === STEPPED ZIGGURAT TOWER (Center) ===
    const towerW = Math.round(45 * s);
    const towerH = Math.round(110 * s);
    const towerX = centerX - towerW / 2;
    const towerY = groundY - towerH;

    // Shadow
    g.fillStyle(0x000000, 0.5);
    g.fillRect(towerX + Math.round(5 * s), towerY + Math.round(8 * s), towerW, towerH);

    // Main tower body
    g.fillStyle(style.base);
    g.fillRect(towerX, towerY, towerW, towerH);
    // Light edge
    g.fillStyle(style.baseLight);
    g.fillRect(towerX, towerY, Math.round(4 * s), towerH);
    // Dark edge
    g.fillStyle(style.baseDark);
    g.fillRect(towerX + towerW - Math.round(4 * s), towerY, Math.round(4 * s), towerH);

    // Vertical fluting pattern on tower
    g.fillStyle(style.baseLight, 0.3);
    for (let i = 0; i < 8; i++) {
      const fx = towerX + Math.round(5 * s) + i * Math.round(5 * s);
      g.fillRect(fx, towerY + Math.round(10 * s), Math.round(2 * s), towerH - Math.round(20 * s));
    }

    // === SUNBURST CROWN (iconic Art Deco) ===
    const crownY = towerY - Math.round(35 * s);
    // Stepped back element
    g.fillStyle(style.silver);
    g.fillRect(
      centerX - Math.round(28 * s),
      towerY - Math.round(8 * s),
      Math.round(56 * s),
      Math.round(10 * s)
    );
    g.fillRect(
      centerX - Math.round(22 * s),
      towerY - Math.round(18 * s),
      Math.round(44 * s),
      Math.round(12 * s)
    );
    g.fillRect(
      centerX - Math.round(16 * s),
      towerY - Math.round(28 * s),
      Math.round(32 * s),
      Math.round(12 * s)
    );

    // SUNBURST RAYS
    g.fillStyle(style.goldBright);
    // Central tall ray
    g.fillRect(
      centerX - Math.round(3 * s),
      crownY - Math.round(25 * s),
      Math.round(6 * s),
      Math.round(30 * s)
    );
    // Side rays (getting shorter)
    for (let ray = 1; ray <= 4; ray++) {
      const rayH = Math.round((25 - ray * 4) * s);
      const rayOffset = ray * Math.round(6 * s);
      g.fillRect(
        centerX - Math.round(2 * s) - rayOffset,
        crownY - rayH,
        Math.round(3 * s),
        rayH + Math.round(5 * s)
      );
      g.fillRect(
        centerX - Math.round(1 * s) + rayOffset,
        crownY - rayH,
        Math.round(3 * s),
        rayH + Math.round(5 * s)
      );
    }

    // Sunburst center medallion
    g.fillStyle(style.gold);
    g.fillCircle(centerX, crownY + Math.round(2 * s), Math.round(10 * s));
    g.fillStyle(style.goldBright);
    g.fillCircle(centerX, crownY + Math.round(2 * s), Math.round(7 * s));
    g.fillStyle(style.windowGlow, 0.7);
    g.fillCircle(centerX, crownY + Math.round(2 * s), Math.round(4 * s));

    // === LEFT WING (stepped) ===
    const wingW = Math.round(30 * s);
    const wingH = Math.round(75 * s);
    const leftX = towerX - wingW + Math.round(6 * s);
    const leftY = groundY - wingH;

    g.fillStyle(0x000000, 0.4);
    g.fillRect(leftX + Math.round(4 * s), leftY + Math.round(6 * s), wingW, wingH);
    g.fillStyle(style.base);
    g.fillRect(leftX, leftY, wingW, wingH);
    g.fillStyle(style.baseLight);
    g.fillRect(leftX, leftY, Math.round(4 * s), wingH);

    // Left wing stepped top
    g.fillStyle(style.silver);
    g.fillRect(
      leftX - Math.round(2 * s),
      leftY - Math.round(5 * s),
      wingW + Math.round(4 * s),
      Math.round(6 * s)
    );
    g.fillStyle(style.gold);
    g.fillRect(leftX, leftY - Math.round(6 * s), wingW, Math.round(2 * s));

    // === RIGHT WING (stepped) ===
    const rightX = towerX + towerW - Math.round(6 * s);
    const rightH = Math.round(60 * s);
    const rightY = groundY - rightH;

    g.fillStyle(0x000000, 0.4);
    g.fillRect(rightX + Math.round(4 * s), rightY + Math.round(6 * s), wingW, rightH);
    g.fillStyle(style.base);
    g.fillRect(rightX, rightY, wingW, rightH);
    g.fillStyle(style.baseDark);
    g.fillRect(rightX + wingW - Math.round(4 * s), rightY, Math.round(4 * s), rightH);

    // Right wing stepped top
    g.fillStyle(style.silver);
    g.fillRect(
      rightX - Math.round(2 * s),
      rightY - Math.round(5 * s),
      wingW + Math.round(4 * s),
      Math.round(6 * s)
    );
    g.fillStyle(style.gold);
    g.fillRect(rightX, rightY - Math.round(6 * s), wingW, Math.round(2 * s));

    // === CHEVRON BANDS (Art Deco motif) ===
    g.fillStyle(style.gold, 0.8);
    for (let band = 0; band < 3; band++) {
      const bandY = towerY + Math.round(20 * s) + band * Math.round(30 * s);
      // Left chevron
      g.fillTriangle(
        towerX,
        bandY + Math.round(6 * s),
        towerX + Math.round(20 * s),
        bandY,
        towerX + Math.round(20 * s),
        bandY + Math.round(6 * s)
      );
      // Right chevron
      g.fillTriangle(
        towerX + towerW,
        bandY + Math.round(6 * s),
        towerX + towerW - Math.round(20 * s),
        bandY,
        towerX + towerW - Math.round(20 * s),
        bandY + Math.round(6 * s)
      );
    }

    // === GEOMETRIC WINDOWS with glow ===
    // Tower windows (3 vertical columns)
    for (let col = 0; col < 3; col++) {
      const wx = towerX + Math.round(8 * s) + col * Math.round(14 * s);
      for (let row = 0; row < 5; row++) {
        const wy = towerY + Math.round(40 * s) + row * Math.round(14 * s);
        // Outer glow
        g.fillStyle(style.windowGlow, 0.25);
        g.fillRect(
          wx - Math.round(2 * s),
          wy - Math.round(2 * s),
          Math.round(12 * s),
          Math.round(12 * s)
        );
        // Window
        g.fillStyle(style.window);
        g.fillRect(wx, wy, Math.round(8 * s), Math.round(8 * s));
        // Geometric divider (cross)
        g.fillStyle(style.silver);
        g.fillRect(wx + Math.round(3.5 * s), wy, Math.round(1 * s), Math.round(8 * s));
        g.fillRect(wx, wy + Math.round(3.5 * s), Math.round(8 * s), Math.round(1 * s));
        // Corner highlight
        g.fillStyle(style.windowGlow, 0.6);
        g.fillRect(wx, wy, Math.round(2 * s), Math.round(2 * s));
      }
    }

    // Left wing windows (2 columns)
    for (let col = 0; col < 2; col++) {
      const wx = leftX + Math.round(6 * s) + col * Math.round(12 * s);
      for (let row = 0; row < 4; row++) {
        const wy = leftY + Math.round(10 * s) + row * Math.round(16 * s);
        g.fillStyle(style.windowGlow, 0.2);
        g.fillRect(
          wx - Math.round(1 * s),
          wy - Math.round(1 * s),
          Math.round(10 * s),
          Math.round(14 * s)
        );
        g.fillStyle(style.window);
        g.fillRect(wx, wy, Math.round(8 * s), Math.round(12 * s));
        g.fillStyle(style.silver);
        g.fillRect(wx + Math.round(3.5 * s), wy, Math.round(1 * s), Math.round(12 * s));
      }
    }

    // Right wing windows (2 columns)
    for (let col = 0; col < 2; col++) {
      const wx = rightX + Math.round(6 * s) + col * Math.round(12 * s);
      for (let row = 0; row < 3; row++) {
        const wy = rightY + Math.round(10 * s) + row * Math.round(16 * s);
        g.fillStyle(style.windowGlow, 0.2);
        g.fillRect(
          wx - Math.round(1 * s),
          wy - Math.round(1 * s),
          Math.round(10 * s),
          Math.round(14 * s)
        );
        g.fillStyle(style.window);
        g.fillRect(wx, wy, Math.round(8 * s), Math.round(12 * s));
        g.fillStyle(style.silver);
        g.fillRect(wx + Math.round(3.5 * s), wy, Math.round(1 * s), Math.round(12 * s));
      }
    }

    // === GRAND GEOMETRIC ENTRANCE ===
    const doorW = Math.round(18 * s);
    const doorH = Math.round(30 * s);
    const doorX = centerX - doorW / 2;
    const doorY = groundY - doorH;

    // Door frame with stepped Art Deco surround
    g.fillStyle(style.silver);
    g.fillRect(
      doorX - Math.round(8 * s),
      doorY - Math.round(12 * s),
      doorW + Math.round(16 * s),
      doorH + Math.round(12 * s)
    );
    g.fillStyle(style.gold);
    g.fillRect(
      doorX - Math.round(6 * s),
      doorY - Math.round(10 * s),
      doorW + Math.round(12 * s),
      doorH + Math.round(10 * s)
    );
    g.fillStyle(style.baseDark);
    g.fillRect(
      doorX - Math.round(4 * s),
      doorY - Math.round(8 * s),
      doorW + Math.round(8 * s),
      doorH + Math.round(8 * s)
    );

    // Door
    g.fillStyle(0x0a0a0a);
    g.fillRect(doorX, doorY, doorW, doorH);
    // Door glass panels
    g.fillStyle(style.window, 0.7);
    g.fillRect(
      doorX + Math.round(2 * s),
      doorY + Math.round(2 * s),
      Math.round(6 * s),
      Math.round(20 * s)
    );
    g.fillRect(
      doorX + Math.round(10 * s),
      doorY + Math.round(2 * s),
      Math.round(6 * s),
      Math.round(20 * s)
    );
    // Transom with sunburst pattern
    g.fillStyle(style.goldBright);
    g.fillRect(
      doorX - Math.round(4 * s),
      doorY - Math.round(8 * s),
      doorW + Math.round(8 * s),
      Math.round(8 * s)
    );
    g.fillStyle(style.window);
    g.fillRect(
      doorX - Math.round(2 * s),
      doorY - Math.round(6 * s),
      doorW + Math.round(4 * s),
      Math.round(5 * s)
    );
    // Mini sunburst in transom
    g.fillStyle(style.gold);
    for (let r = 0; r < 5; r++) {
      const rx = centerX - Math.round(8 * s) + r * Math.round(4 * s);
      g.fillRect(rx, doorY - Math.round(6 * s), Math.round(1 * s), Math.round(5 * s));
    }

    // Door handle
    g.fillStyle(style.goldBright);
    g.fillRect(
      doorX + doorW - Math.round(4 * s),
      doorY + Math.round(14 * s),
      Math.round(2 * s),
      Math.round(4 * s)
    );

    // === DECORATIVE EAGLES (Art Deco motif) ===
    // Stylized eagle shapes on wings
    g.fillStyle(style.gold);
    // Left eagle
    g.fillTriangle(
      leftX + Math.round(15 * s),
      leftY + Math.round(5 * s),
      leftX + Math.round(8 * s),
      leftY - Math.round(2 * s),
      leftX + Math.round(22 * s),
      leftY - Math.round(2 * s)
    );
    // Right eagle
    g.fillTriangle(
      rightX + Math.round(15 * s),
      rightY + Math.round(5 * s),
      rightX + Math.round(8 * s),
      rightY - Math.round(2 * s),
      rightX + Math.round(22 * s),
      rightY - Math.round(2 * s)
    );

    g.generateTexture("mansion_3", canvasWidth, canvasHeight);
    g.destroy();
  }

  // MANSION 4: Emerald Manor - Georgian Colonial masterpiece with grand portico and gardens
  private generateMansion4_ColonialManor(
    s: number,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    // Emerald/garden theme with cream accents
    const style = {
      base: 0xf5f5dc, // Cream/beige walls
      baseLight: 0xfdfdf5,
      baseDark: 0xe8e8d0,
      roof: 0x1a3d1a, // Deep forest green
      roofLight: 0x2d5a2d,
      trim: 0x228b22, // Emerald green
      trimLight: 0x32cd32,
      window: 0x98fb98, // Pale green glow
      windowGlow: 0x00ff7f,
      column: 0xffffff, // Pure white columns
      columnShade: 0xe8e8e8,
      shutter: 0x0d4a0d, // Dark green shutters
      brick: 0x8b4513, // Brick chimneys
    };
    const centerX = canvasWidth / 2;
    const groundY = canvasHeight - Math.round(8 * s);

    // === GARDEN FOUNDATION/TERRACE ===
    g.fillStyle(0x4a4a4a);
    g.fillRect(Math.round(3 * s), groundY, canvasWidth - Math.round(6 * s), Math.round(8 * s));
    // Stone terrace
    g.fillStyle(0x9ca3af);
    g.fillRect(
      Math.round(5 * s),
      groundY - Math.round(4 * s),
      canvasWidth - Math.round(10 * s),
      Math.round(5 * s)
    );
    // Garden grass strip
    g.fillStyle(0x228b22);
    g.fillRect(
      Math.round(3 * s),
      groundY - Math.round(2 * s),
      Math.round(12 * s),
      Math.round(3 * s)
    );
    g.fillRect(
      canvasWidth - Math.round(15 * s),
      groundY - Math.round(2 * s),
      Math.round(12 * s),
      Math.round(3 * s)
    );

    // === TOPIARIES (garden elements) ===
    // Left topiary ball
    g.fillStyle(0x0d4a0d);
    g.fillCircle(Math.round(12 * s), groundY - Math.round(12 * s), Math.round(8 * s));
    g.fillStyle(0x115511);
    g.fillCircle(Math.round(12 * s), groundY - Math.round(14 * s), Math.round(5 * s));
    g.fillStyle(0x5c4033); // Pot
    g.fillRect(
      Math.round(8 * s),
      groundY - Math.round(4 * s),
      Math.round(8 * s),
      Math.round(5 * s)
    );
    // Right topiary ball
    g.fillStyle(0x0d4a0d);
    g.fillCircle(canvasWidth - Math.round(12 * s), groundY - Math.round(12 * s), Math.round(8 * s));
    g.fillStyle(0x115511);
    g.fillCircle(canvasWidth - Math.round(12 * s), groundY - Math.round(14 * s), Math.round(5 * s));
    g.fillStyle(0x5c4033);
    g.fillRect(
      canvasWidth - Math.round(16 * s),
      groundY - Math.round(4 * s),
      Math.round(8 * s),
      Math.round(5 * s)
    );

    // === MAIN HOUSE BODY (wide Georgian) ===
    const mainW = Math.round(80 * s);
    const mainH = Math.round(70 * s);
    const mainX = centerX - mainW / 2;
    const mainY = groundY - mainH;

    // Shadow
    g.fillStyle(0x000000, 0.4);
    g.fillRect(mainX + Math.round(5 * s), mainY + Math.round(8 * s), mainW, mainH);

    // Main body cream walls
    g.fillStyle(style.base);
    g.fillRect(mainX, mainY, mainW, mainH);
    // Light edge
    g.fillStyle(style.baseLight);
    g.fillRect(mainX, mainY, Math.round(5 * s), mainH);
    // Dark edge
    g.fillStyle(style.baseDark);
    g.fillRect(mainX + mainW - Math.round(5 * s), mainY, Math.round(5 * s), mainH);

    // Horizontal trim bands (Georgian style)
    g.fillStyle(style.trim);
    g.fillRect(mainX, mainY + Math.round(25 * s), mainW, Math.round(3 * s)); // Floor line
    g.fillRect(mainX, mainY + Math.round(50 * s), mainW, Math.round(2 * s)); // Second floor line

    // Quoin corners (stone block pattern)
    g.fillStyle(0xd3d3d3);
    for (let q = 0; q < 6; q++) {
      const qy = mainY + Math.round(5 * s) + q * Math.round(11 * s);
      g.fillRect(mainX, qy, Math.round(6 * s), Math.round(8 * s));
      g.fillRect(mainX + mainW - Math.round(6 * s), qy, Math.round(6 * s), Math.round(8 * s));
    }

    // === GRAND HIPPED ROOF ===
    const roofH = Math.round(28 * s);
    g.fillStyle(style.roof);
    g.fillRect(mainX - Math.round(8 * s), mainY - roofH, mainW + Math.round(16 * s), roofH);
    // Sloped edges
    g.fillStyle(darken(style.roof, 0.2));
    g.fillTriangle(
      mainX - Math.round(8 * s),
      mainY,
      mainX - Math.round(8 * s),
      mainY - roofH,
      mainX + Math.round(15 * s),
      mainY - roofH
    );
    g.fillTriangle(
      mainX + mainW + Math.round(8 * s),
      mainY,
      mainX + mainW + Math.round(8 * s),
      mainY - roofH,
      mainX + mainW - Math.round(15 * s),
      mainY - roofH
    );
    // Roof highlight
    g.fillStyle(style.roofLight);
    g.fillRect(
      mainX - Math.round(8 * s),
      mainY - roofH,
      mainW + Math.round(16 * s),
      Math.round(4 * s)
    );
    // Roof trim
    g.fillStyle(style.column);
    g.fillRect(
      mainX - Math.round(10 * s),
      mainY - Math.round(2 * s),
      mainW + Math.round(20 * s),
      Math.round(4 * s)
    );

    // === THREE DORMERS ===
    const dormerW = Math.round(14 * s);
    const dormerH = Math.round(16 * s);
    for (let d = 0; d < 3; d++) {
      const dormerX = mainX + Math.round(15 * s) + d * Math.round(28 * s);
      const dormerY = mainY - roofH - dormerH + Math.round(10 * s);
      // Dormer body
      g.fillStyle(style.base);
      g.fillRect(dormerX, dormerY + Math.round(6 * s), dormerW, dormerH - Math.round(4 * s));
      // Dormer roof (pediment)
      g.fillStyle(style.roof);
      g.fillTriangle(
        dormerX - Math.round(2 * s),
        dormerY + Math.round(6 * s),
        dormerX + dormerW + Math.round(2 * s),
        dormerY + Math.round(6 * s),
        dormerX + dormerW / 2,
        dormerY - Math.round(6 * s)
      );
      // Dormer window with glow
      g.fillStyle(style.windowGlow, 0.3);
      g.fillRect(
        dormerX + Math.round(2 * s),
        dormerY + Math.round(8 * s),
        Math.round(10 * s),
        Math.round(10 * s)
      );
      g.fillStyle(style.window);
      g.fillRect(
        dormerX + Math.round(3 * s),
        dormerY + Math.round(9 * s),
        Math.round(8 * s),
        Math.round(8 * s)
      );
      // Window mullion
      g.fillStyle(style.column);
      g.fillRect(
        dormerX + Math.round(6.5 * s),
        dormerY + Math.round(9 * s),
        Math.round(1 * s),
        Math.round(8 * s)
      );
    }

    // === GRAND CHIMNEYS (symmetrical, detailed) ===
    for (let ch = 0; ch < 2; ch++) {
      const chimX = ch === 0 ? mainX + Math.round(8 * s) : mainX + mainW - Math.round(14 * s);
      const chimY = mainY - roofH - Math.round(22 * s);
      // Chimney body
      g.fillStyle(style.brick);
      g.fillRect(chimX, chimY, Math.round(6 * s), Math.round(28 * s));
      // Chimney cap
      g.fillStyle(darken(style.brick, 0.15));
      g.fillRect(chimX - Math.round(1 * s), chimY, Math.round(8 * s), Math.round(3 * s));
      // Chimney band
      g.fillStyle(lighten(style.brick, 0.15));
      g.fillRect(chimX, chimY + Math.round(8 * s), Math.round(6 * s), Math.round(2 * s));
    }

    // === GRAND CENTRAL PORTICO with pediment ===
    const porticoW = Math.round(40 * s);
    const porticoH = Math.round(50 * s);
    const porticoX = centerX - porticoW / 2;
    const porticoY = groundY - porticoH;

    // Portico roof/pediment
    g.fillStyle(style.roof);
    g.fillRect(
      porticoX - Math.round(4 * s),
      porticoY - Math.round(6 * s),
      porticoW + Math.round(8 * s),
      Math.round(8 * s)
    );
    // Triangular pediment
    g.fillTriangle(
      porticoX - Math.round(6 * s),
      porticoY - Math.round(6 * s),
      porticoX + porticoW + Math.round(6 * s),
      porticoY - Math.round(6 * s),
      centerX,
      porticoY - Math.round(22 * s)
    );
    // Pediment highlight
    g.fillStyle(style.roofLight);
    g.fillRect(
      porticoX - Math.round(4 * s),
      porticoY - Math.round(6 * s),
      porticoW + Math.round(8 * s),
      Math.round(2 * s)
    );
    // Pediment trim (tympanum)
    g.fillStyle(style.base);
    g.fillTriangle(
      porticoX - Math.round(2 * s),
      porticoY - Math.round(4 * s),
      porticoX + porticoW + Math.round(2 * s),
      porticoY - Math.round(4 * s),
      centerX,
      porticoY - Math.round(18 * s)
    );
    // Decorative medallion in pediment
    g.fillStyle(style.trim);
    g.fillCircle(centerX, porticoY - Math.round(12 * s), Math.round(5 * s));
    g.fillStyle(style.trimLight);
    g.fillCircle(centerX, porticoY - Math.round(12 * s), Math.round(3 * s));

    // === FOUR GRAND CORINTHIAN COLUMNS ===
    const colCount = 4;
    const colSpacing = (porticoW - Math.round(12 * s)) / (colCount - 1);
    for (let c = 0; c < colCount; c++) {
      const cx = porticoX + Math.round(6 * s) + c * colSpacing;
      const colH = porticoH - Math.round(8 * s);

      // Column base (plinth)
      g.fillStyle(style.columnShade);
      g.fillRect(
        cx - Math.round(2 * s),
        groundY - Math.round(6 * s),
        Math.round(8 * s),
        Math.round(6 * s)
      );

      // Column shaft with fluting
      g.fillStyle(style.column);
      g.fillRect(cx, porticoY, Math.round(4 * s), colH);
      // Column highlight (light side)
      g.fillStyle(0xffffff);
      g.fillRect(cx, porticoY, Math.round(1 * s), colH);
      // Column shadow (dark side)
      g.fillStyle(style.columnShade);
      g.fillRect(cx + Math.round(3 * s), porticoY, Math.round(1 * s), colH);

      // Fluting detail
      g.fillStyle(style.columnShade, 0.3);
      g.fillRect(
        cx + Math.round(1.5 * s),
        porticoY + Math.round(4 * s),
        Math.round(1 * s),
        colH - Math.round(10 * s)
      );

      // Capital (Corinthian style)
      g.fillStyle(style.column);
      g.fillRect(
        cx - Math.round(2 * s),
        porticoY - Math.round(4 * s),
        Math.round(8 * s),
        Math.round(5 * s)
      );
      g.fillStyle(style.trim);
      g.fillRect(
        cx - Math.round(3 * s),
        porticoY - Math.round(5 * s),
        Math.round(10 * s),
        Math.round(2 * s)
      );
      // Acanthus leaf detail
      g.fillStyle(style.trimLight);
      g.fillRect(
        cx - Math.round(1 * s),
        porticoY - Math.round(3 * s),
        Math.round(2 * s),
        Math.round(3 * s)
      );
      g.fillRect(
        cx + Math.round(3 * s),
        porticoY - Math.round(3 * s),
        Math.round(2 * s),
        Math.round(3 * s)
      );
    }

    // === WINDOWS (Georgian 6-over-6 sash style) ===
    // Second floor windows (5 total)
    for (let w = 0; w < 5; w++) {
      const wx = mainX + Math.round(10 * s) + w * Math.round(14 * s);
      const wy = mainY + Math.round(6 * s);
      // Skip center windows (behind pediment)
      if (w === 2) continue;
      // Window glow
      g.fillStyle(style.windowGlow, 0.25);
      g.fillRect(
        wx - Math.round(2 * s),
        wy - Math.round(2 * s),
        Math.round(12 * s),
        Math.round(18 * s)
      );
      // Window frame
      g.fillStyle(style.column);
      g.fillRect(
        wx - Math.round(1 * s),
        wy - Math.round(1 * s),
        Math.round(10 * s),
        Math.round(16 * s)
      );
      // Window glass
      g.fillStyle(style.window);
      g.fillRect(wx, wy, Math.round(8 * s), Math.round(14 * s));
      // Mullions (6-over-6 pattern)
      g.fillStyle(style.column);
      g.fillRect(wx + Math.round(3.5 * s), wy, Math.round(1 * s), Math.round(14 * s)); // Vertical
      g.fillRect(wx, wy + Math.round(6.5 * s), Math.round(8 * s), Math.round(1 * s)); // Horizontal
      // Sash dividers
      for (let div = 0; div < 2; div++) {
        g.fillRect(
          wx,
          wy + Math.round(2 * s) + div * Math.round(4 * s),
          Math.round(8 * s),
          Math.round(0.5 * s)
        );
        g.fillRect(
          wx,
          wy + Math.round(9 * s) + div * Math.round(3 * s),
          Math.round(8 * s),
          Math.round(0.5 * s)
        );
      }
      // Shutters
      g.fillStyle(style.shutter);
      g.fillRect(wx - Math.round(4 * s), wy, Math.round(3 * s), Math.round(14 * s));
      g.fillRect(wx + Math.round(9 * s), wy, Math.round(3 * s), Math.round(14 * s));
      // Shutter slats
      g.fillStyle(lighten(style.shutter, 0.15));
      for (let slat = 0; slat < 5; slat++) {
        g.fillRect(
          wx - Math.round(4 * s),
          wy + Math.round(2 * s) + slat * Math.round(3 * s),
          Math.round(3 * s),
          Math.round(1 * s)
        );
        g.fillRect(
          wx + Math.round(9 * s),
          wy + Math.round(2 * s) + slat * Math.round(3 * s),
          Math.round(3 * s),
          Math.round(1 * s)
        );
      }
    }

    // First floor windows (4 total, flanking door)
    for (let w = 0; w < 4; w++) {
      // Skip middle two (door area)
      if (w === 1 || w === 2) continue;
      const wx = mainX + Math.round(10 * s) + w * Math.round(18 * s);
      const wy = mainY + Math.round(32 * s);
      // Window glow
      g.fillStyle(style.windowGlow, 0.25);
      g.fillRect(
        wx - Math.round(2 * s),
        wy - Math.round(2 * s),
        Math.round(14 * s),
        Math.round(20 * s)
      );
      // Window frame
      g.fillStyle(style.column);
      g.fillRect(
        wx - Math.round(1 * s),
        wy - Math.round(1 * s),
        Math.round(12 * s),
        Math.round(18 * s)
      );
      // Window glass
      g.fillStyle(style.window);
      g.fillRect(wx, wy, Math.round(10 * s), Math.round(16 * s));
      // Mullions
      g.fillStyle(style.column);
      g.fillRect(wx + Math.round(4.5 * s), wy, Math.round(1 * s), Math.round(16 * s));
      g.fillRect(wx, wy + Math.round(7.5 * s), Math.round(10 * s), Math.round(1 * s));
      // Shutters
      g.fillStyle(style.shutter);
      g.fillRect(wx - Math.round(5 * s), wy, Math.round(4 * s), Math.round(16 * s));
      g.fillRect(wx + Math.round(11 * s), wy, Math.round(4 * s), Math.round(16 * s));
    }

    // === GRAND ENTRANCE DOOR (Georgian style with fanlight) ===
    const doorW = Math.round(16 * s);
    const doorH = Math.round(32 * s);
    const doorX = centerX - doorW / 2;
    const doorY = groundY - doorH;

    // Door frame surround
    g.fillStyle(style.column);
    g.fillRect(
      doorX - Math.round(5 * s),
      doorY - Math.round(14 * s),
      doorW + Math.round(10 * s),
      doorH + Math.round(14 * s)
    );
    // Frame trim
    g.fillStyle(style.trim);
    g.fillRect(
      doorX - Math.round(4 * s),
      doorY - Math.round(12 * s),
      doorW + Math.round(8 * s),
      doorH + Math.round(12 * s)
    );

    // Fanlight (semi-circular transom)
    g.fillStyle(style.windowGlow, 0.4);
    g.fillCircle(centerX, doorY - Math.round(2 * s), Math.round(10 * s));
    g.fillStyle(style.window);
    g.fillCircle(centerX, doorY - Math.round(2 * s), Math.round(8 * s));
    // Fanlight spokes
    g.fillStyle(style.column);
    for (let spoke = 0; spoke < 7; spoke++) {
      const angle = Math.PI / 8 + spoke * (Math.PI / 7);
      const x1 = centerX;
      const y1 = doorY - Math.round(2 * s);
      const x2 = centerX + Math.cos(angle) * Math.round(8 * s);
      const y2 = doorY - Math.round(2 * s) - Math.sin(angle) * Math.round(8 * s);
      // Draw spoke as thin rectangle
      g.fillRect(x1, y1 - Math.round(8 * s), Math.round(1 * s), Math.round(8 * s));
    }
    // Cover bottom half of fanlight circle
    g.fillStyle(style.trim);
    g.fillRect(
      doorX - Math.round(4 * s),
      doorY - Math.round(2 * s),
      doorW + Math.round(8 * s),
      Math.round(4 * s)
    );

    // Door panels
    g.fillStyle(0x1a1a1a);
    g.fillRect(doorX, doorY, doorW, doorH);
    g.fillStyle(style.shutter);
    g.fillRect(
      doorX + Math.round(1 * s),
      doorY + Math.round(2 * s),
      doorW - Math.round(2 * s),
      doorH - Math.round(4 * s)
    );
    // Door panel details
    g.fillStyle(lighten(style.shutter, 0.1));
    g.fillRect(
      doorX + Math.round(2 * s),
      doorY + Math.round(4 * s),
      Math.round(5 * s),
      Math.round(10 * s)
    );
    g.fillRect(
      doorX + Math.round(9 * s),
      doorY + Math.round(4 * s),
      Math.round(5 * s),
      Math.round(10 * s)
    );
    g.fillRect(
      doorX + Math.round(2 * s),
      doorY + Math.round(18 * s),
      Math.round(5 * s),
      Math.round(10 * s)
    );
    g.fillRect(
      doorX + Math.round(9 * s),
      doorY + Math.round(18 * s),
      Math.round(5 * s),
      Math.round(10 * s)
    );
    // Door knocker
    g.fillStyle(0xd4af37);
    g.fillCircle(centerX, doorY + Math.round(14 * s), Math.round(2 * s));

    // Sidelights
    g.fillStyle(style.windowGlow, 0.3);
    g.fillRect(
      doorX - Math.round(4 * s),
      doorY + Math.round(4 * s),
      Math.round(3 * s),
      Math.round(24 * s)
    );
    g.fillRect(
      doorX + doorW + Math.round(1 * s),
      doorY + Math.round(4 * s),
      Math.round(3 * s),
      Math.round(24 * s)
    );
    g.fillStyle(style.window);
    g.fillRect(
      doorX - Math.round(3.5 * s),
      doorY + Math.round(5 * s),
      Math.round(2 * s),
      Math.round(22 * s)
    );
    g.fillRect(
      doorX + doorW + Math.round(1.5 * s),
      doorY + Math.round(5 * s),
      Math.round(2 * s),
      Math.round(22 * s)
    );

    g.generateTexture("mansion_4", canvasWidth, canvasHeight);
    g.destroy();
  }

  /**
   * Generate Ballers Valley luxury props - High-end decorations for the VIP zone
   * Includes: manicured lawn, marble path, gold fountain, gold lamps, topiaries, gates, urns
   */
  private generateBallersProps(): void {
    const s = SCALE;

    // === LUXURY MANICURED LAWN (tileable) ===
    const lawnSize = Math.round(32 * s);
    const lawn = this.make.graphics({ x: 0, y: 0 });
    // Deep rich green base
    lawn.fillStyle(0x0d4a0d);
    lawn.fillRect(0, 0, lawnSize, lawnSize);
    // Stripe pattern (golf course look)
    lawn.fillStyle(0x115511, 0.4);
    lawn.fillRect(0, 0, lawnSize / 2, lawnSize);
    // Subtle grass texture
    lawn.fillStyle(0x166616);
    for (let i = 0; i < 6; i++) {
      const x = Math.floor(Math.random() * (lawnSize - 4));
      const y = Math.floor(Math.random() * (lawnSize - 6));
      lawn.fillRect(x, y, Math.round(2 * s), Math.round(4 * s));
    }
    // Highlight blades
    lawn.fillStyle(0x1a7a1a);
    for (let i = 0; i < 4; i++) {
      const x = Math.floor(Math.random() * (lawnSize - 3));
      const y = Math.floor(Math.random() * (lawnSize - 5));
      lawn.fillRect(x, y, Math.round(1 * s), Math.round(3 * s));
    }
    lawn.generateTexture("luxury_lawn", lawnSize, lawnSize);
    lawn.destroy();

    // === MARBLE PATH TILE (tileable) ===
    const marbleSize = Math.round(32 * s);
    const marble = this.make.graphics({ x: 0, y: 0 });
    // Cream marble base
    marble.fillStyle(0xf5f0e6);
    marble.fillRect(0, 0, marbleSize, marbleSize);
    // Tile grid lines
    marble.fillStyle(0xe8e0d0);
    marble.fillRect(0, 0, marbleSize, Math.round(2 * s));
    marble.fillRect(0, 0, Math.round(2 * s), marbleSize);
    // Subtle marble veining
    marble.fillStyle(0xebe5da, 0.6);
    marble.fillRect(Math.round(8 * s), Math.round(4 * s), Math.round(12 * s), Math.round(2 * s));
    marble.fillRect(Math.round(4 * s), Math.round(16 * s), Math.round(8 * s), Math.round(2 * s));
    // Gold inlay accent
    marble.fillStyle(0xd4a017);
    marble.fillRect(
      marbleSize - Math.round(4 * s),
      marbleSize - Math.round(4 * s),
      Math.round(4 * s),
      Math.round(4 * s)
    );
    marble.generateTexture("marble_path", marbleSize, marbleSize);
    marble.destroy();

    // === GOLD FOUNTAIN (ornate) ===
    const fountainW = Math.round(50 * s);
    const fountainH = Math.round(55 * s);
    const gf = this.make.graphics({ x: 0, y: 0 });
    // Outer marble basin
    gf.fillStyle(0xe8e4dc);
    gf.fillRect(Math.round(3 * s), Math.round(40 * s), Math.round(44 * s), Math.round(12 * s));
    // Basin shadow
    gf.fillStyle(0xd4cfc4);
    gf.fillRect(Math.round(5 * s), Math.round(48 * s), Math.round(40 * s), Math.round(4 * s));
    // Gold basin rim
    gf.fillStyle(0xd4a017);
    gf.fillRect(Math.round(2 * s), Math.round(38 * s), Math.round(46 * s), Math.round(4 * s));
    gf.fillStyle(0xffd700);
    gf.fillRect(Math.round(4 * s), Math.round(38 * s), Math.round(42 * s), Math.round(2 * s));
    // Water pool
    gf.fillStyle(0x4fc3f7);
    gf.fillRect(Math.round(8 * s), Math.round(42 * s), Math.round(34 * s), Math.round(8 * s));
    // Water shimmer
    gf.fillStyle(0x81d4fa, 0.6);
    gf.fillRect(Math.round(12 * s), Math.round(44 * s), Math.round(10 * s), Math.round(3 * s));
    // Middle tier (gold)
    gf.fillStyle(0xb8860b);
    gf.fillRect(Math.round(16 * s), Math.round(28 * s), Math.round(18 * s), Math.round(12 * s));
    gf.fillStyle(0xd4a017);
    gf.fillRect(Math.round(18 * s), Math.round(28 * s), Math.round(14 * s), Math.round(10 * s));
    // Middle tier highlight
    gf.fillStyle(0xffd700);
    gf.fillRect(Math.round(18 * s), Math.round(28 * s), Math.round(4 * s), Math.round(8 * s));
    // Gold band
    gf.fillStyle(0xffd700);
    gf.fillRect(Math.round(14 * s), Math.round(26 * s), Math.round(22 * s), Math.round(3 * s));
    // Top pillar
    gf.fillStyle(0xd4a017);
    gf.fillRect(Math.round(21 * s), Math.round(12 * s), Math.round(8 * s), Math.round(16 * s));
    gf.fillStyle(0xffd700);
    gf.fillRect(Math.round(22 * s), Math.round(12 * s), Math.round(3 * s), Math.round(14 * s));
    // Crown/finial
    gf.fillStyle(0xffd700);
    gf.fillRect(Math.round(19 * s), Math.round(8 * s), Math.round(12 * s), Math.round(5 * s));
    // Spire
    gf.fillStyle(0xffd700);
    gf.fillTriangle(
      Math.round(25 * s),
      Math.round(2 * s),
      Math.round(21 * s),
      Math.round(9 * s),
      Math.round(29 * s),
      Math.round(9 * s)
    );
    // Spire highlight
    gf.fillStyle(0xffec8b);
    gf.fillRect(Math.round(24 * s), Math.round(4 * s), Math.round(2 * s), Math.round(4 * s));
    gf.generateTexture("gold_fountain", fountainW, fountainH);
    gf.destroy();

    // === GOLD LAMP POST ===
    const lampW = Math.round(24 * s);
    const lampH = Math.round(70 * s);
    const gl = this.make.graphics({ x: 0, y: 0 });
    // Base
    gl.fillStyle(0xb8860b);
    gl.fillRect(Math.round(6 * s), Math.round(60 * s), Math.round(12 * s), Math.round(10 * s));
    gl.fillStyle(0xd4a017);
    gl.fillRect(Math.round(7 * s), Math.round(62 * s), Math.round(10 * s), Math.round(6 * s));
    // Pole
    gl.fillStyle(0xb8860b);
    gl.fillRect(Math.round(10 * s), Math.round(20 * s), Math.round(4 * s), Math.round(42 * s));
    gl.fillStyle(0xd4a017);
    gl.fillRect(Math.round(11 * s), Math.round(20 * s), Math.round(2 * s), Math.round(40 * s));
    // Decorative rings on pole
    gl.fillStyle(0xffd700);
    gl.fillRect(Math.round(9 * s), Math.round(35 * s), Math.round(6 * s), Math.round(3 * s));
    gl.fillRect(Math.round(9 * s), Math.round(50 * s), Math.round(6 * s), Math.round(3 * s));
    // Lamp housing
    gl.fillStyle(0xb8860b);
    gl.fillRect(Math.round(5 * s), Math.round(10 * s), Math.round(14 * s), Math.round(12 * s));
    gl.fillStyle(0xd4a017);
    gl.fillRect(Math.round(6 * s), Math.round(11 * s), Math.round(12 * s), Math.round(10 * s));
    // Glass/light
    gl.fillStyle(0xfffacd);
    gl.fillRect(Math.round(8 * s), Math.round(13 * s), Math.round(8 * s), Math.round(6 * s));
    // Glow effect
    gl.fillStyle(0xfff8dc, 0.3);
    gl.fillRect(Math.round(4 * s), Math.round(8 * s), Math.round(16 * s), Math.round(16 * s));
    gl.fillStyle(0xfff8dc, 0.15);
    gl.fillRect(Math.round(2 * s), Math.round(6 * s), Math.round(20 * s), Math.round(20 * s));
    // Top finial
    gl.fillStyle(0xffd700);
    gl.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(4 * s), Math.round(7 * s));
    gl.fillCircle(Math.round(12 * s), Math.round(3 * s), Math.round(3 * s));
    gl.generateTexture("gold_lamp", lampW, lampH);
    gl.destroy();

    // === TOPIARY (cone-shaped hedge in gold pot) ===
    const topiaryW = Math.round(32 * s);
    const topiaryH = Math.round(60 * s);
    const tp = this.make.graphics({ x: 0, y: 0 });
    // Gold pot
    tp.fillStyle(0xb8860b);
    tp.fillRect(Math.round(8 * s), Math.round(48 * s), Math.round(16 * s), Math.round(12 * s));
    tp.fillStyle(0xd4a017);
    tp.fillRect(Math.round(9 * s), Math.round(50 * s), Math.round(14 * s), Math.round(8 * s));
    // Pot rim
    tp.fillStyle(0xffd700);
    tp.fillRect(Math.round(6 * s), Math.round(46 * s), Math.round(20 * s), Math.round(4 * s));
    // Pot highlight
    tp.fillStyle(0xffec8b);
    tp.fillRect(Math.round(10 * s), Math.round(50 * s), Math.round(4 * s), Math.round(6 * s));
    // Cone-shaped hedge (layered for depth)
    // Bottom layer (widest)
    tp.fillStyle(0x145214);
    tp.fillRect(Math.round(6 * s), Math.round(38 * s), Math.round(20 * s), Math.round(10 * s));
    // Second layer
    tp.fillStyle(0x166534);
    tp.fillRect(Math.round(8 * s), Math.round(28 * s), Math.round(16 * s), Math.round(12 * s));
    // Third layer
    tp.fillStyle(0x1a7a1a);
    tp.fillRect(Math.round(10 * s), Math.round(18 * s), Math.round(12 * s), Math.round(12 * s));
    // Fourth layer
    tp.fillStyle(0x22c55e);
    tp.fillRect(Math.round(12 * s), Math.round(10 * s), Math.round(8 * s), Math.round(10 * s));
    // Top
    tp.fillStyle(0x4ade80);
    tp.fillRect(Math.round(14 * s), Math.round(4 * s), Math.round(4 * s), Math.round(8 * s));
    // Left edge highlight
    tp.fillStyle(0x22c55e, 0.5);
    tp.fillRect(Math.round(6 * s), Math.round(28 * s), Math.round(3 * s), Math.round(18 * s));
    // Right edge shadow
    tp.fillStyle(0x0d3d0d, 0.4);
    tp.fillRect(Math.round(23 * s), Math.round(28 * s), Math.round(3 * s), Math.round(18 * s));
    tp.generateTexture("topiary", topiaryW, topiaryH);
    tp.destroy();

    // === IRON GATE ===
    const gateW = Math.round(50 * s);
    const gateH = Math.round(70 * s);
    const gate = this.make.graphics({ x: 0, y: 0 });
    // Stone pillar
    gate.fillStyle(0x4a4a4a);
    gate.fillRect(Math.round(2 * s), Math.round(15 * s), Math.round(14 * s), Math.round(55 * s));
    gate.fillStyle(0x5a5a5a);
    gate.fillRect(Math.round(4 * s), Math.round(17 * s), Math.round(10 * s), Math.round(51 * s));
    // Pillar highlight
    gate.fillStyle(0x6a6a6a);
    gate.fillRect(Math.round(4 * s), Math.round(17 * s), Math.round(3 * s), Math.round(48 * s));
    // Gold ball on top
    gate.fillStyle(0xd4a017);
    gate.fillCircle(Math.round(9 * s), Math.round(12 * s), Math.round(6 * s));
    gate.fillStyle(0xffd700);
    gate.fillCircle(Math.round(8 * s), Math.round(10 * s), Math.round(3 * s));
    // Iron bars
    gate.fillStyle(0x1a1a1a);
    gate.fillRect(Math.round(18 * s), Math.round(20 * s), Math.round(3 * s), Math.round(45 * s));
    gate.fillRect(Math.round(28 * s), Math.round(20 * s), Math.round(3 * s), Math.round(45 * s));
    gate.fillRect(Math.round(38 * s), Math.round(20 * s), Math.round(3 * s), Math.round(45 * s));
    // Horizontal bars
    gate.fillStyle(0x2a2a2a);
    gate.fillRect(Math.round(16 * s), Math.round(25 * s), Math.round(28 * s), Math.round(3 * s));
    gate.fillRect(Math.round(16 * s), Math.round(55 * s), Math.round(28 * s), Math.round(3 * s));
    // Gold accent on gate
    gate.fillStyle(0xd4a017);
    gate.fillRect(Math.round(24 * s), Math.round(35 * s), Math.round(10 * s), Math.round(8 * s));
    gate.fillStyle(0xffd700);
    gate.fillRect(Math.round(26 * s), Math.round(37 * s), Math.round(6 * s), Math.round(4 * s));
    // Spear points on top
    gate.fillStyle(0x1a1a1a);
    gate.fillTriangle(
      Math.round(19.5 * s),
      Math.round(15 * s),
      Math.round(17 * s),
      Math.round(22 * s),
      Math.round(22 * s),
      Math.round(22 * s)
    );
    gate.fillTriangle(
      Math.round(29.5 * s),
      Math.round(15 * s),
      Math.round(27 * s),
      Math.round(22 * s),
      Math.round(32 * s),
      Math.round(22 * s)
    );
    gate.fillTriangle(
      Math.round(39.5 * s),
      Math.round(15 * s),
      Math.round(37 * s),
      Math.round(22 * s),
      Math.round(42 * s),
      Math.round(22 * s)
    );
    gate.generateTexture("iron_gate", gateW, gateH);
    gate.destroy();

    // === GOLD URN/STATUE ===
    const urnW = Math.round(24 * s);
    const urnH = Math.round(50 * s);
    const urn = this.make.graphics({ x: 0, y: 0 });
    // Marble pedestal
    urn.fillStyle(0xe8e4dc);
    urn.fillRect(Math.round(4 * s), Math.round(38 * s), Math.round(16 * s), Math.round(12 * s));
    urn.fillStyle(0xd4cfc4);
    urn.fillRect(Math.round(6 * s), Math.round(44 * s), Math.round(12 * s), Math.round(6 * s));
    // Pedestal gold band
    urn.fillStyle(0xffd700);
    urn.fillRect(Math.round(3 * s), Math.round(36 * s), Math.round(18 * s), Math.round(3 * s));
    // Urn base
    urn.fillStyle(0xb8860b);
    urn.fillRect(Math.round(8 * s), Math.round(28 * s), Math.round(8 * s), Math.round(10 * s));
    // Urn body (wider)
    urn.fillStyle(0xd4a017);
    urn.fillRect(Math.round(5 * s), Math.round(16 * s), Math.round(14 * s), Math.round(14 * s));
    urn.fillStyle(0xffd700);
    urn.fillRect(Math.round(6 * s), Math.round(18 * s), Math.round(6 * s), Math.round(10 * s));
    // Urn neck
    urn.fillStyle(0xb8860b);
    urn.fillRect(Math.round(8 * s), Math.round(10 * s), Math.round(8 * s), Math.round(8 * s));
    // Urn rim
    urn.fillStyle(0xffd700);
    urn.fillRect(Math.round(6 * s), Math.round(8 * s), Math.round(12 * s), Math.round(4 * s));
    // Handles
    urn.fillStyle(0xd4a017);
    urn.fillRect(Math.round(2 * s), Math.round(18 * s), Math.round(4 * s), Math.round(8 * s));
    urn.fillRect(Math.round(18 * s), Math.round(18 * s), Math.round(4 * s), Math.round(8 * s));
    urn.generateTexture("gold_urn", urnW, urnH);
    urn.destroy();

    // === RED CARPET ===
    const carpetW = Math.round(60 * s);
    const carpetH = Math.round(40 * s);
    const carpet = this.make.graphics({ x: 0, y: 0 });
    // Gold border
    carpet.fillStyle(0xd4a017);
    carpet.fillRect(0, 0, carpetW, carpetH);
    // Dark red carpet
    carpet.fillStyle(0x8b0000);
    carpet.fillRect(
      Math.round(3 * s),
      Math.round(3 * s),
      carpetW - Math.round(6 * s),
      carpetH - Math.round(6 * s)
    );
    // Lighter red highlight stripe
    carpet.fillStyle(0xb22222, 0.5);
    carpet.fillRect(
      Math.round(10 * s),
      Math.round(8 * s),
      carpetW - Math.round(20 * s),
      Math.round(4 * s)
    );
    carpet.fillRect(
      Math.round(10 * s),
      carpetH - Math.round(12 * s),
      carpetW - Math.round(20 * s),
      Math.round(4 * s)
    );
    // Gold inner trim
    carpet.fillStyle(0xffd700);
    carpet.fillRect(
      Math.round(6 * s),
      Math.round(6 * s),
      carpetW - Math.round(12 * s),
      Math.round(2 * s)
    );
    carpet.fillRect(
      Math.round(6 * s),
      carpetH - Math.round(8 * s),
      carpetW - Math.round(12 * s),
      Math.round(2 * s)
    );
    // Carpet pattern (diamond shapes)
    carpet.fillStyle(0x9b1c1c, 0.4);
    for (let i = 0; i < 3; i++) {
      const dx = Math.round((15 + i * 15) * s);
      carpet.fillRect(dx, Math.round(15 * s), Math.round(6 * s), Math.round(10 * s));
    }
    carpet.generateTexture("red_carpet", carpetW, carpetH);
    carpet.destroy();

    // === LUXURY SUPERCAR (Lamborghini-style) ===
    const carW = Math.round(60 * s);
    const carH = Math.round(28 * s);
    const supercar = this.make.graphics({ x: 0, y: 0 });

    // Shadow underneath
    supercar.fillStyle(0x000000, 0.4);
    supercar.fillRect(Math.round(6 * s), Math.round(22 * s), Math.round(48 * s), Math.round(6 * s));

    // Low sleek body (gold/yellow Lambo style)
    supercar.fillStyle(0xd4a017); // Dark gold base
    supercar.fillRect(
      Math.round(4 * s),
      Math.round(12 * s),
      Math.round(52 * s),
      Math.round(10 * s)
    );

    // Body highlight (top)
    supercar.fillStyle(0xffd700); // Bright gold
    supercar.fillRect(Math.round(6 * s), Math.round(12 * s), Math.round(48 * s), Math.round(3 * s));

    // Sloped hood (front wedge shape)
    supercar.fillStyle(0xd4a017);
    supercar.fillRect(
      Math.round(44 * s),
      Math.round(14 * s),
      Math.round(14 * s),
      Math.round(6 * s)
    );
    supercar.fillStyle(0xffd700);
    supercar.fillRect(
      Math.round(46 * s),
      Math.round(14 * s),
      Math.round(10 * s),
      Math.round(2 * s)
    );

    // Low cabin/roof (very sleek)
    supercar.fillStyle(0xb8860b); // Darker gold
    supercar.fillRect(Math.round(16 * s), Math.round(6 * s), Math.round(22 * s), Math.round(7 * s));

    // Angular windshield
    supercar.fillStyle(0x1e3a5f, 0.9); // Dark tinted glass
    supercar.fillRect(Math.round(32 * s), Math.round(7 * s), Math.round(8 * s), Math.round(5 * s));
    // Side window
    supercar.fillStyle(0x1e3a5f, 0.9);
    supercar.fillRect(Math.round(20 * s), Math.round(7 * s), Math.round(10 * s), Math.round(5 * s));

    // Rear spoiler
    supercar.fillStyle(0x1a1a1a);
    supercar.fillRect(Math.round(2 * s), Math.round(8 * s), Math.round(4 * s), Math.round(2 * s));
    supercar.fillRect(Math.round(4 * s), Math.round(6 * s), Math.round(8 * s), Math.round(3 * s));

    // Air intakes (side scoops)
    supercar.fillStyle(0x1a1a1a);
    supercar.fillRect(Math.round(12 * s), Math.round(16 * s), Math.round(6 * s), Math.round(4 * s));
    supercar.fillRect(Math.round(40 * s), Math.round(16 * s), Math.round(6 * s), Math.round(4 * s));

    // Wheels (larger, sportier)
    supercar.fillStyle(0x1a1a1a);
    supercar.fillCircle(Math.round(14 * s), Math.round(20 * s), Math.round(6 * s));
    supercar.fillCircle(Math.round(46 * s), Math.round(20 * s), Math.round(6 * s));

    // Gold rims (luxury detail)
    supercar.fillStyle(0xffd700);
    supercar.fillCircle(Math.round(14 * s), Math.round(20 * s), Math.round(3 * s));
    supercar.fillCircle(Math.round(46 * s), Math.round(20 * s), Math.round(3 * s));

    // Rim centers
    supercar.fillStyle(0xd4a017);
    supercar.fillCircle(Math.round(14 * s), Math.round(20 * s), Math.round(1.5 * s));
    supercar.fillCircle(Math.round(46 * s), Math.round(20 * s), Math.round(1.5 * s));

    // Headlights (angular, aggressive)
    supercar.fillStyle(0xfef3c7);
    supercar.fillRect(Math.round(54 * s), Math.round(15 * s), Math.round(3 * s), Math.round(3 * s));
    // Headlight glow
    supercar.fillStyle(0xffffff, 0.4);
    supercar.fillRect(Math.round(53 * s), Math.round(14 * s), Math.round(5 * s), Math.round(5 * s));

    // Taillights (LED strip style)
    supercar.fillStyle(0xef4444);
    supercar.fillRect(Math.round(2 * s), Math.round(14 * s), Math.round(2 * s), Math.round(6 * s));
    supercar.fillStyle(0xfca5a5, 0.5);
    supercar.fillRect(Math.round(2 * s), Math.round(15 * s), Math.round(3 * s), Math.round(4 * s));

    // Body line detail (adds depth)
    supercar.fillStyle(0xb8860b, 0.6);
    supercar.fillRect(Math.round(8 * s), Math.round(18 * s), Math.round(36 * s), Math.round(1 * s));

    // Chrome exhaust tips
    supercar.fillStyle(0x9ca3af);
    supercar.fillRect(Math.round(4 * s), Math.round(19 * s), Math.round(3 * s), Math.round(2 * s));
    supercar.fillRect(Math.round(4 * s), Math.round(21 * s), Math.round(3 * s), Math.round(1 * s));

    supercar.generateTexture("supercar", carW, carH);
    supercar.destroy();
  }

  /**
   * Generate Academy buildings - Hogwarts-style educational campus
   * Each building represents a team member's domain with unique architectural style
   */
  private generateAcademyBuildings(): void {
    const s = SCALE;

    // Academy building styles - Hogwarts-inspired gothic/academic architecture
    const academyBuildings = [
      {
        name: "clock_tower", // Main Hall - Finn (Dean)
        base: PALETTE.gray,
        roof: PALETTE.navy,
        accent: PALETTE.gold,
        trim: PALETTE.lightGray,
        hasTower: true,
        hasClock: true,
      },
      {
        name: "library", // Engineering Lab - Ramo (CTO)
        base: PALETTE.midGray,
        roof: PALETTE.blue,
        accent: PALETTE.cyan,
        trim: PALETTE.silver,
        hasArches: true,
        hasBooks: true,
      },
      {
        name: "art_studio", // Design Studio - Sincara
        base: PALETTE.lightGray,
        roof: 0xec4899, // Pink
        accent: PALETTE.lavender,
        trim: PALETTE.white,
        hasLargeDoor: true,
        hasPalette: true,
      },
      {
        name: "observatory", // R&D Lab - Alaa (Skunk Works)
        base: PALETTE.darkGray,
        roof: PALETTE.violet,
        accent: PALETTE.purple,
        trim: PALETTE.silver,
        hasDome: true,
        hasTelescope: true,
      },
      {
        name: "greenhouse", // Student Services - Stuu
        base: PALETTE.forest,
        roof: PALETTE.bagsGreen,
        accent: PALETTE.mint,
        trim: PALETTE.cream,
        hasGlass: true,
        hasPlants: true,
      },
      {
        name: "amphitheater", // Marketing Hall - Sam
        base: PALETTE.amber,
        roof: PALETTE.gold,
        accent: PALETTE.yellow,
        trim: PALETTE.white,
        hasStage: true,
        hasLights: true,
      },
      {
        name: "welcome_hall", // Welcome Center - Carlo
        base: PALETTE.cream,
        roof: PALETTE.bagsGreen,
        accent: PALETTE.forest,
        trim: PALETTE.gold,
        hasColumns: true,
        hasBanner: true,
      },
      {
        name: "broadcast_tower", // Media Center - BNN
        base: PALETTE.sky,
        roof: PALETTE.navy,
        accent: PALETTE.cyan,
        trim: PALETTE.lightBlue,
        hasAntenna: true,
        hasScreen: true,
      },
    ];

    // Standard dimensions for academy buildings
    const bWidth = Math.round(50 * s);
    const bHeight = Math.round(90 * s);
    const canvasWidth = Math.round(60 * s);
    const canvasHeight = Math.round(150 * s);

    academyBuildings.forEach((style, index) => {
      const g = this.make.graphics({ x: 0, y: 0 });
      const baseY = canvasHeight - bHeight;
      const centerX = canvasWidth / 2;

      // Drop shadow
      g.fillStyle(PALETTE.void, 0.5);
      g.fillRect(Math.round(6 * s), baseY + Math.round(6 * s), bWidth - Math.round(4 * s), bHeight);

      // Main building body
      g.fillStyle(style.base);
      g.fillRect(Math.round(4 * s), baseY, bWidth - Math.round(4 * s), bHeight);

      // Highlight left edge
      g.fillStyle(lighten(style.base, 0.15));
      g.fillRect(Math.round(4 * s), baseY, Math.round(6 * s), bHeight);

      // Shadow right edge
      g.fillStyle(darken(style.base, 0.2));
      g.fillRect(bWidth - Math.round(6 * s), baseY, Math.round(6 * s), bHeight);

      // Dithering pattern for stone texture
      g.fillStyle(darken(style.base, 0.1));
      for (let py = 0; py < bHeight; py += Math.round(8 * s)) {
        for (
          let px = Math.round(8 * s);
          px < bWidth - Math.round(8 * s);
          px += Math.round(12 * s)
        ) {
          if ((py / Math.round(8 * s) + px / Math.round(12 * s)) % 2 === 0) {
            g.fillRect(Math.round(4 * s) + px, baseY + py, Math.round(10 * s), Math.round(6 * s));
          }
        }
      }

      // Roof based on building type
      const roofY = baseY - Math.round(20 * s);

      if (style.hasDome) {
        // Observatory dome
        g.fillStyle(style.roof);
        g.fillCircle(centerX, roofY + Math.round(5 * s), Math.round(22 * s));
        g.fillStyle(lighten(style.roof, 0.2));
        g.fillCircle(centerX - Math.round(5 * s), roofY - Math.round(2 * s), Math.round(8 * s));
        // Dome slit
        g.fillStyle(darken(style.roof, 0.3));
        g.fillRect(
          centerX - Math.round(2 * s),
          roofY - Math.round(15 * s),
          Math.round(4 * s),
          Math.round(20 * s)
        );
      } else if (style.hasTower) {
        // Clock tower peaked roof
        g.fillStyle(style.roof);
        g.beginPath();
        g.moveTo(0, baseY);
        g.lineTo(centerX, roofY - Math.round(25 * s));
        g.lineTo(canvasWidth - Math.round(4 * s), baseY);
        g.closePath();
        g.fill();
        // Roof highlight
        g.fillStyle(lighten(style.roof, 0.2));
        g.beginPath();
        g.moveTo(0, baseY);
        g.lineTo(centerX, roofY - Math.round(25 * s));
        g.lineTo(centerX, roofY - Math.round(18 * s));
        g.lineTo(Math.round(6 * s), baseY);
        g.closePath();
        g.fill();
        // Spire
        g.fillStyle(style.accent);
        g.fillRect(
          centerX - Math.round(2 * s),
          roofY - Math.round(40 * s),
          Math.round(4 * s),
          Math.round(20 * s)
        );
        g.fillCircle(centerX, roofY - Math.round(42 * s), Math.round(4 * s));
      } else if (style.hasGlass) {
        // Greenhouse glass roof
        g.fillStyle(PALETTE.lightBlue, 0.6);
        g.beginPath();
        g.moveTo(Math.round(2 * s), baseY);
        g.lineTo(centerX, roofY);
        g.lineTo(canvasWidth - Math.round(6 * s), baseY);
        g.closePath();
        g.fill();
        // Glass frame lines
        g.fillStyle(style.trim);
        g.fillRect(centerX - Math.round(1 * s), roofY, Math.round(2 * s), baseY - roofY);
        for (let i = 1; i <= 3; i++) {
          const lineY = roofY + (baseY - roofY) * (i / 4);
          g.fillRect(
            Math.round(4 * s) + i * Math.round(5 * s),
            lineY,
            bWidth - Math.round(8 * s) - i * Math.round(10 * s),
            Math.round(2 * s)
          );
        }
      } else if (style.hasAntenna) {
        // Broadcast tower flat roof with antenna
        g.fillStyle(style.roof);
        g.fillRect(0, baseY - Math.round(8 * s), bWidth + Math.round(8 * s), Math.round(12 * s));
        g.fillStyle(lighten(style.roof, 0.15));
        g.fillRect(0, baseY - Math.round(8 * s), bWidth + Math.round(8 * s), Math.round(3 * s));
        // Main antenna
        g.fillStyle(PALETTE.lightGray);
        g.fillRect(
          centerX - Math.round(2 * s),
          roofY - Math.round(35 * s),
          Math.round(4 * s),
          Math.round(45 * s)
        );
        // Satellite dish
        g.fillStyle(PALETTE.silver);
        g.fillCircle(centerX + Math.round(12 * s), roofY - Math.round(10 * s), Math.round(8 * s));
        g.fillStyle(PALETTE.lightGray);
        g.fillCircle(centerX + Math.round(12 * s), roofY - Math.round(10 * s), Math.round(4 * s));
        // Blinking light
        g.fillStyle(PALETTE.brightRed);
        g.fillCircle(centerX, roofY - Math.round(38 * s), Math.round(3 * s));
      } else {
        // Standard peaked roof
        g.fillStyle(style.roof);
        g.beginPath();
        g.moveTo(0, baseY);
        g.lineTo(centerX, roofY);
        g.lineTo(canvasWidth - Math.round(4 * s), baseY);
        g.closePath();
        g.fill();
        // Roof highlight
        g.fillStyle(lighten(style.roof, 0.2));
        g.beginPath();
        g.moveTo(0, baseY);
        g.lineTo(centerX, roofY);
        g.lineTo(centerX, roofY + Math.round(6 * s));
        g.lineTo(Math.round(6 * s), baseY);
        g.closePath();
        g.fill();
      }

      // Windows - 2 rows x 2 columns (gothic arched style)
      const windowColor = style.hasGlass ? PALETTE.mint : PALETTE.lightBlue;
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          const wx = Math.round(10 * s) + col * Math.round(18 * s);
          const wy = baseY + Math.round(15 * s) + row * Math.round(25 * s);

          // Window glow
          g.fillStyle(windowColor, 0.25);
          g.fillRect(
            wx - Math.round(1 * s),
            wy - Math.round(1 * s),
            Math.round(14 * s),
            Math.round(18 * s)
          );

          // Gothic arch window
          g.fillStyle(windowColor);
          g.fillRect(wx, wy + Math.round(4 * s), Math.round(12 * s), Math.round(14 * s));
          g.fillCircle(wx + Math.round(6 * s), wy + Math.round(4 * s), Math.round(6 * s));

          // Window highlight
          g.fillStyle(lighten(windowColor, 0.3));
          g.fillRect(
            wx + Math.round(2 * s),
            wy + Math.round(6 * s),
            Math.round(3 * s),
            Math.round(4 * s)
          );

          // Window frame divider
          g.fillStyle(style.trim);
          g.fillRect(
            wx + Math.round(5 * s),
            wy + Math.round(4 * s),
            Math.round(2 * s),
            Math.round(14 * s)
          );
        }
      }

      // Clock face for clock tower
      if (style.hasClock) {
        const clockY = baseY + Math.round(8 * s);
        g.fillStyle(PALETTE.cream);
        g.fillCircle(centerX, clockY, Math.round(10 * s));
        g.fillStyle(PALETTE.darkGray);
        g.fillCircle(centerX, clockY, Math.round(8 * s));
        g.fillStyle(style.accent);
        g.fillCircle(centerX, clockY, Math.round(6 * s));
        // Clock hands
        g.fillStyle(PALETTE.darkGray);
        g.fillRect(
          centerX - Math.round(1 * s),
          clockY - Math.round(5 * s),
          Math.round(2 * s),
          Math.round(5 * s)
        );
        g.fillRect(centerX, clockY - Math.round(1 * s), Math.round(4 * s), Math.round(2 * s));
      }

      // Books/scrolls for library
      if (style.hasBooks) {
        const bookY = baseY + Math.round(65 * s);
        const bookColors = [PALETTE.brightRed, PALETTE.forest, PALETTE.navy, PALETTE.amber];
        bookColors.forEach((color, i) => {
          g.fillStyle(color);
          g.fillRect(
            Math.round(8 * s) + i * Math.round(8 * s),
            bookY,
            Math.round(6 * s),
            Math.round(12 * s)
          );
        });
      }

      // Art palette for studio
      if (style.hasPalette) {
        g.fillStyle(PALETTE.brown);
        g.fillCircle(bWidth - Math.round(12 * s), baseY + Math.round(20 * s), Math.round(8 * s));
        const paletteColors = [PALETTE.brightRed, PALETTE.yellow, PALETTE.blue, PALETTE.bagsGreen];
        paletteColors.forEach((color, i) => {
          g.fillStyle(color);
          g.fillCircle(
            bWidth - Math.round(14 * s) + (i % 2) * Math.round(6 * s),
            baseY + Math.round(18 * s) + Math.floor(i / 2) * Math.round(5 * s),
            Math.round(2 * s)
          );
        });
      }

      // Telescope for observatory
      if (style.hasTelescope) {
        g.fillStyle(PALETTE.darkGray);
        g.fillRect(
          centerX + Math.round(8 * s),
          roofY - Math.round(25 * s),
          Math.round(4 * s),
          Math.round(18 * s)
        );
        g.fillStyle(PALETTE.lightGray);
        g.fillCircle(centerX + Math.round(10 * s), roofY - Math.round(28 * s), Math.round(5 * s));
      }

      // Plants for greenhouse
      if (style.hasPlants) {
        const plantColors = [PALETTE.bagsGreen, PALETTE.forest, PALETTE.mint];
        for (let i = 0; i < 3; i++) {
          g.fillStyle(plantColors[i]);
          g.fillCircle(
            Math.round(12 * s) + i * Math.round(12 * s),
            baseY + Math.round(70 * s),
            Math.round(6 * s)
          );
        }
        // Flower pots
        g.fillStyle(PALETTE.brown);
        for (let i = 0; i < 3; i++) {
          g.fillRect(
            Math.round(8 * s) + i * Math.round(12 * s),
            baseY + Math.round(72 * s),
            Math.round(8 * s),
            Math.round(8 * s)
          );
        }
      }

      // Stage lights for amphitheater
      if (style.hasLights) {
        const lightPositions = [Math.round(8 * s), centerX, bWidth - Math.round(4 * s)];
        lightPositions.forEach((lx) => {
          g.fillStyle(PALETTE.yellow, 0.6);
          g.fillCircle(lx, baseY - Math.round(5 * s), Math.round(6 * s));
          g.fillStyle(PALETTE.gold);
          g.fillCircle(lx, baseY - Math.round(5 * s), Math.round(4 * s));
        });
      }

      // Columns for welcome hall
      if (style.hasColumns) {
        const columnWidth = Math.round(5 * s);
        const columnHeight = Math.round(45 * s);
        const columnY = canvasHeight - columnHeight;
        // Left column
        g.fillStyle(style.trim);
        g.fillRect(Math.round(10 * s), columnY, columnWidth, columnHeight);
        g.fillStyle(darken(style.trim, 0.15));
        g.fillRect(
          Math.round(10 * s) + columnWidth - Math.round(1 * s),
          columnY,
          Math.round(1 * s),
          columnHeight
        );
        // Right column
        g.fillStyle(style.trim);
        g.fillRect(bWidth - Math.round(11 * s), columnY, columnWidth, columnHeight);
        // Column caps
        g.fillStyle(style.trim);
        g.fillRect(
          Math.round(8 * s),
          columnY - Math.round(3 * s),
          columnWidth + Math.round(4 * s),
          Math.round(3 * s)
        );
        g.fillRect(
          bWidth - Math.round(13 * s),
          columnY - Math.round(3 * s),
          columnWidth + Math.round(4 * s),
          Math.round(3 * s)
        );
      }

      // Screen for broadcast tower
      if (style.hasScreen) {
        g.fillStyle(PALETTE.darkGray);
        g.fillRect(
          Math.round(8 * s),
          baseY + Math.round(12 * s),
          bWidth - Math.round(12 * s),
          Math.round(20 * s)
        );
        g.fillStyle(PALETTE.cyan, 0.8);
        g.fillRect(
          Math.round(10 * s),
          baseY + Math.round(14 * s),
          bWidth - Math.round(16 * s),
          Math.round(16 * s)
        );
        // Screen glow
        g.fillStyle(PALETTE.cyan, 0.3);
        g.fillRect(
          Math.round(6 * s),
          baseY + Math.round(10 * s),
          bWidth - Math.round(8 * s),
          Math.round(24 * s)
        );
      }

      // Door
      const doorWidth = Math.round(14 * s);
      const doorHeight = Math.round(20 * s);
      const doorX = centerX - doorWidth / 2;

      // Door frame
      g.fillStyle(style.accent);
      g.fillRect(
        doorX - Math.round(2 * s),
        canvasHeight - doorHeight - Math.round(2 * s),
        doorWidth + Math.round(4 * s),
        doorHeight + Math.round(2 * s)
      );

      // Gothic arch door
      g.fillStyle(PALETTE.darkBrown);
      g.fillRect(doorX, canvasHeight - doorHeight, doorWidth, doorHeight);
      // Arch top
      g.fillCircle(doorX + doorWidth / 2, canvasHeight - doorHeight, doorWidth / 2);

      // Door highlight
      g.fillStyle(lighten(PALETTE.darkBrown, 0.1));
      g.fillRect(
        doorX + Math.round(2 * s),
        canvasHeight - doorHeight + Math.round(4 * s),
        Math.round(3 * s),
        doorHeight - Math.round(6 * s)
      );

      // Door knocker
      g.fillStyle(style.accent);
      g.fillCircle(doorX + doorWidth / 2, canvasHeight - doorHeight / 2, Math.round(2 * s));

      // Building name plaque
      g.fillStyle(PALETTE.darkGray);
      g.fillRect(
        Math.round(8 * s),
        baseY + Math.round(3 * s),
        bWidth - Math.round(12 * s),
        Math.round(8 * s)
      );
      g.fillStyle(style.accent);
      g.fillRect(
        Math.round(10 * s),
        baseY + Math.round(4 * s),
        bWidth - Math.round(16 * s),
        Math.round(6 * s)
      );

      g.generateTexture(`academy_${index}`, canvasWidth, canvasHeight);
      g.destroy();
    });

    // Generate Academy entrance gate
    this.generateAcademyGate();
  }

  /**
   * Generate the grand entrance gate for the Academy
   */
  private generateAcademyGate(): void {
    const s = SCALE;
    const g = this.make.graphics({ x: 0, y: 0 });
    const canvasWidth = Math.round(120 * s);
    const canvasHeight = Math.round(100 * s);

    const gateHeight = Math.round(70 * s);
    const pillarWidth = Math.round(15 * s);

    // Left pillar
    g.fillStyle(PALETTE.gray);
    g.fillRect(Math.round(10 * s), canvasHeight - gateHeight, pillarWidth, gateHeight);
    g.fillStyle(lighten(PALETTE.gray, 0.15));
    g.fillRect(Math.round(10 * s), canvasHeight - gateHeight, Math.round(4 * s), gateHeight);
    // Left pillar cap
    g.fillStyle(PALETTE.gold);
    g.fillRect(
      Math.round(8 * s),
      canvasHeight - gateHeight - Math.round(8 * s),
      pillarWidth + Math.round(4 * s),
      Math.round(10 * s)
    );
    // Left finial
    g.fillCircle(
      Math.round(10 * s) + pillarWidth / 2,
      canvasHeight - gateHeight - Math.round(14 * s),
      Math.round(6 * s)
    );

    // Right pillar
    g.fillStyle(PALETTE.gray);
    g.fillRect(
      canvasWidth - Math.round(25 * s),
      canvasHeight - gateHeight,
      pillarWidth,
      gateHeight
    );
    g.fillStyle(lighten(PALETTE.gray, 0.15));
    g.fillRect(
      canvasWidth - Math.round(25 * s),
      canvasHeight - gateHeight,
      Math.round(4 * s),
      gateHeight
    );
    // Right pillar cap
    g.fillStyle(PALETTE.gold);
    g.fillRect(
      canvasWidth - Math.round(27 * s),
      canvasHeight - gateHeight - Math.round(8 * s),
      pillarWidth + Math.round(4 * s),
      Math.round(10 * s)
    );
    // Right finial
    g.fillCircle(
      canvasWidth - Math.round(25 * s) + pillarWidth / 2,
      canvasHeight - gateHeight - Math.round(14 * s),
      Math.round(6 * s)
    );

    // Arch connecting pillars
    g.fillStyle(PALETTE.gold);
    g.fillRect(
      Math.round(25 * s),
      canvasHeight - gateHeight - Math.round(4 * s),
      canvasWidth - Math.round(50 * s),
      Math.round(8 * s)
    );

    // "BAGS ACADEMY" banner on arch
    g.fillStyle(PALETTE.navy);
    g.fillRect(
      Math.round(30 * s),
      canvasHeight - gateHeight - Math.round(22 * s),
      canvasWidth - Math.round(60 * s),
      Math.round(18 * s)
    );
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(
      Math.round(32 * s),
      canvasHeight - gateHeight - Math.round(20 * s),
      canvasWidth - Math.round(64 * s),
      Math.round(14 * s)
    );

    // Decorative crest/shield at top
    const crestX = canvasWidth / 2;
    const crestY = canvasHeight - gateHeight - Math.round(32 * s);
    g.fillStyle(PALETTE.gold);
    g.beginPath();
    g.moveTo(crestX, crestY - Math.round(12 * s));
    g.lineTo(crestX + Math.round(12 * s), crestY);
    g.lineTo(crestX + Math.round(10 * s), crestY + Math.round(15 * s));
    g.lineTo(crestX, crestY + Math.round(20 * s));
    g.lineTo(crestX - Math.round(10 * s), crestY + Math.round(15 * s));
    g.lineTo(crestX - Math.round(12 * s), crestY);
    g.closePath();
    g.fill();
    // Crest inner
    g.fillStyle(PALETTE.bagsGreen);
    g.beginPath();
    g.moveTo(crestX, crestY - Math.round(8 * s));
    g.lineTo(crestX + Math.round(8 * s), crestY + Math.round(2 * s));
    g.lineTo(crestX + Math.round(6 * s), crestY + Math.round(12 * s));
    g.lineTo(crestX, crestY + Math.round(16 * s));
    g.lineTo(crestX - Math.round(6 * s), crestY + Math.round(12 * s));
    g.lineTo(crestX - Math.round(8 * s), crestY + Math.round(2 * s));
    g.closePath();
    g.fill();
    // "B" on crest
    g.fillStyle(PALETTE.gold);
    g.fillRect(crestX - Math.round(3 * s), crestY, Math.round(2 * s), Math.round(10 * s));
    g.fillRect(crestX - Math.round(3 * s), crestY, Math.round(6 * s), Math.round(2 * s));
    g.fillRect(
      crestX - Math.round(3 * s),
      crestY + Math.round(4 * s),
      Math.round(5 * s),
      Math.round(2 * s)
    );
    g.fillRect(
      crestX - Math.round(3 * s),
      crestY + Math.round(8 * s),
      Math.round(6 * s),
      Math.round(2 * s)
    );
    g.fillRect(crestX + Math.round(1 * s), crestY, Math.round(2 * s), Math.round(5 * s));
    g.fillRect(
      crestX + Math.round(2 * s),
      crestY + Math.round(4 * s),
      Math.round(2 * s),
      Math.round(5 * s)
    );

    // Iron gates (decorative bars)
    g.fillStyle(PALETTE.darkGray);
    for (let i = 0; i < 5; i++) {
      const barX = Math.round(32 * s) + i * Math.round(14 * s);
      g.fillRect(
        barX,
        canvasHeight - gateHeight + Math.round(10 * s),
        Math.round(3 * s),
        gateHeight - Math.round(12 * s)
      );
    }
    // Horizontal bar
    g.fillRect(
      Math.round(28 * s),
      canvasHeight - Math.round(30 * s),
      canvasWidth - Math.round(56 * s),
      Math.round(3 * s)
    );

    g.generateTexture("academy_gate", canvasWidth, canvasHeight);
    g.destroy();
  }

  /**
   * Generate the Sniper Tower for the Academy zone
   * A tall radar tower with scanning equipment for sniping new token launches
   * REWRITTEN using exact pattern from generateFoundersWorkshop
   */
  private generateSniperTower(): void {
    const s = SCALE;
    const g = this.make.graphics({ x: 0, y: 0 });

    // Canvas and building dimensions (same pattern as Founders)
    const canvasW = Math.round(80 * s);
    const canvasH = Math.round(180 * s);
    const bWidth = Math.round(50 * s);
    const bHeight = Math.round(140 * s);
    const baseX = Math.round((canvasW - bWidth) / 2);
    const baseY = canvasH - bHeight; // TOP of building, like Founders

    // Colors - high visibility
    const towerBase = 0x374151; // Dark gray
    const towerBody = 0x4b5563; // Medium gray
    const towerLight = lighten(towerBody, 0.2);
    const towerDark = darken(towerBody, 0.2);
    const accent = PALETTE.bagsGreen; // Green accents
    const windowColor = PALETTE.cyan; // Cyan windows

    // === DROP SHADOW (like Founders) ===
    g.fillStyle(PALETTE.void, 0.5);
    g.fillRect(baseX + Math.round(5 * s), baseY + Math.round(5 * s), bWidth, bHeight);

    // === MAIN TOWER BODY ===
    g.fillStyle(towerBody);
    g.fillRect(baseX, baseY, bWidth, bHeight);

    // 3D depth: Light left edge
    g.fillStyle(towerLight);
    g.fillRect(baseX, baseY, Math.round(6 * s), bHeight);

    // 3D depth: Dark right edge
    g.fillStyle(towerDark);
    g.fillRect(baseX + bWidth - Math.round(6 * s), baseY, Math.round(6 * s), bHeight);

    // === HORIZONTAL TECH LINES ===
    g.fillStyle(towerLight);
    for (let i = 0; i < 7; i++) {
      const lineY = baseY + Math.round(15 * s) + i * Math.round(18 * s);
      g.fillRect(baseX + Math.round(8 * s), lineY, bWidth - Math.round(16 * s), Math.round(2 * s));
    }

    // === OBSERVATION WINDOWS (4 levels) ===
    const windowW = Math.round(14 * s);
    const windowH = Math.round(10 * s);
    const windowX = baseX + (bWidth - windowW) / 2;

    for (let i = 0; i < 4; i++) {
      const windowY = baseY + Math.round(25 * s) + i * Math.round(28 * s);

      // Window glow aura
      g.fillStyle(windowColor, 0.3);
      g.fillRect(
        windowX - Math.round(2 * s),
        windowY - Math.round(2 * s),
        windowW + Math.round(4 * s),
        windowH + Math.round(4 * s)
      );

      // Window frame
      g.fillStyle(towerLight);
      g.fillRect(
        windowX - Math.round(1 * s),
        windowY - Math.round(1 * s),
        windowW + Math.round(2 * s),
        windowH + Math.round(2 * s)
      );

      // Window glass
      g.fillStyle(windowColor);
      g.fillRect(windowX, windowY, windowW, windowH);

      // Window highlight
      g.fillStyle(lighten(windowColor, 0.4));
      g.fillRect(windowX, windowY, Math.round(3 * s), Math.round(3 * s));
    }

    // === RADAR DOME (top) ===
    const domeY = baseY - Math.round(15 * s);
    const domeRadius = Math.round(18 * s);
    const centerX = baseX + bWidth / 2;

    // Dome glow
    g.fillStyle(accent, 0.2);
    g.fillCircle(centerX, domeY, domeRadius + Math.round(5 * s));

    // Dome body
    g.fillStyle(towerBody);
    g.fillCircle(centerX, domeY, domeRadius);

    // Dome highlight
    g.fillStyle(towerLight);
    g.fillCircle(centerX - Math.round(5 * s), domeY - Math.round(3 * s), Math.round(8 * s));

    // Dome ring (green accent)
    g.fillStyle(accent);
    g.fillRect(baseX, domeY - Math.round(2 * s), bWidth, Math.round(4 * s));

    // === ANTENNA ON TOP ===
    const antennaX = centerX;

    // Antenna pole
    g.fillStyle(towerLight);
    g.fillRect(
      antennaX - Math.round(2 * s),
      domeY - domeRadius - Math.round(20 * s),
      Math.round(4 * s),
      Math.round(20 * s)
    );

    // Antenna tip (red beacon)
    g.fillStyle(PALETTE.brightRed, 0.5);
    g.fillCircle(antennaX, domeY - domeRadius - Math.round(22 * s), Math.round(6 * s));
    g.fillStyle(PALETTE.brightRed);
    g.fillCircle(antennaX, domeY - domeRadius - Math.round(22 * s), Math.round(3 * s));

    // === GREEN ACCENT LIGHTS (sides of tower) ===
    g.fillStyle(accent);
    for (let i = 0; i < 5; i++) {
      const lightY = baseY + Math.round(20 * s) + i * Math.round(25 * s);
      // Left light
      g.fillRect(baseX + Math.round(2 * s), lightY, Math.round(4 * s), Math.round(4 * s));
      // Right light
      g.fillRect(baseX + bWidth - Math.round(6 * s), lightY, Math.round(4 * s), Math.round(4 * s));
    }

    // === "SNIPER" LABEL AT BASE ===
    const signW = Math.round(40 * s);
    const signH = Math.round(12 * s);
    const signX = baseX + (bWidth - signW) / 2;
    const signY = baseY + bHeight - Math.round(18 * s);

    // Sign background
    g.fillStyle(towerBase);
    g.fillRect(signX, signY, signW, signH);

    // Sign border (gold)
    g.fillStyle(PALETTE.gold);
    g.fillRect(signX, signY, signW, Math.round(1 * s));
    g.fillRect(signX, signY + signH - Math.round(1 * s), signW, Math.round(1 * s));
    g.fillRect(signX, signY, Math.round(1 * s), signH);
    g.fillRect(signX + signW - Math.round(1 * s), signY, Math.round(1 * s), signH);

    // "SNIPER" text (simplified - just green bar to represent text)
    g.fillStyle(accent);
    g.fillRect(
      signX + Math.round(4 * s),
      signY + Math.round(4 * s),
      signW - Math.round(8 * s),
      Math.round(4 * s)
    );

    // === STONE FOUNDATION ===
    g.fillStyle(PALETTE.gray);
    g.fillRect(
      baseX - Math.round(5 * s),
      baseY + bHeight - Math.round(10 * s),
      bWidth + Math.round(10 * s),
      Math.round(10 * s)
    );
    g.fillStyle(lighten(PALETTE.gray, 0.1));
    g.fillRect(
      baseX - Math.round(5 * s),
      baseY + bHeight - Math.round(10 * s),
      Math.round(4 * s),
      Math.round(10 * s)
    );

    g.generateTexture("sniper_tower", canvasW, canvasH);
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
      this.createCharacterSprite(
        `character_${i}_celebrating`,
        skinTone,
        hairColor,
        shirtColor,
        "celebrating"
      );
    }

    // Keep default textures for backward compatibility
    this.createCharacterSprite(
      "character",
      SKIN_TONES[0],
      HAIR_COLORS[0],
      SHIRT_COLORS[0],
      "neutral"
    );
    this.createCharacterSprite(
      "character_happy",
      SKIN_TONES[0],
      HAIR_COLORS[0],
      SHIRT_COLORS[0],
      "happy"
    );
    this.createCharacterSprite(
      "character_sad",
      SKIN_TONES[0],
      HAIR_COLORS[0],
      SHIRT_COLORS[0],
      "sad"
    );
    this.createCharacterSprite(
      "character_celebrating",
      SKIN_TONES[0],
      HAIR_COLORS[0],
      SHIRT_COLORS[0],
      "celebrating"
    );

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

    // Generate CJ - The Hood Rat from BagsCity
    this.generateCJSprite();

    // Generate Shaw - ElizaOS creator, ai16z co-founder
    this.generateShawSprite();

    // Academy Zone - Bags.fm Team Characters
    this.generateRamoSprite();
    this.generateSincaraSprite();
    this.generateStuuSprite();
    this.generateSamSprite();
    this.generateAlaaSprite();
    this.generateCarloSprite();
    this.generateBNNSprite();

    // Founder's Corner Zone
    this.generateProfessorOakSprite();
  }

  private generateTolySprite(): void {
    // Toly (Anatoly Yakovenko) - Solana co-founder
    // Casual tech look, beard, Solana purple/green colors
    const s = SCALE;
    const size = Math.round(32 * s);
    const skinTone = 0xf1c27d; // Light tan
    const hairColor = 0x4a3728; // Brown hair
    const beardColor = 0x5c4033; // Brown beard
    const shirtColor = 0x9945ff; // Solana purple!

    const g = this.make.graphics({ x: 0, y: 0 });

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

  private generateAshSprite(): void {
    // Ash Ketchum - Pokemon trainer style with iconic cap
    const s = SCALE;
    const size = Math.round(32 * s);
    const skinTone = 0xffdbac; // Light skin
    const g = this.make.graphics({ x: 0, y: 0 });

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

  private generateFinnSprite(): void {
    // Finn (@finnbags) - Bags.fm CEO
    // Casual tech founder look with WIF-inspired beanie, emerald brand colors
    const s = SCALE;
    const size = Math.round(32 * s);
    const skinTone = 0xffd5b4; // Light skin
    const g = this.make.graphics({ x: 0, y: 0 });

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

  private generateDevSprite(): void {
    // DaddyGhost (@DaddyGhost) - The Dev / Trencher
    // Hacker/dev aesthetic with hoodie, glasses, ghost theme
    const s = SCALE;
    const size = Math.round(32 * s);
    const skinTone = 0xe0ac69; // Medium skin
    const g = this.make.graphics({ x: 0, y: 0 });

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

  private generateNeoSprite(): void {
    // Neo - The One (Matrix-inspired Scout Agent)
    // Black coat, sunglasses, Matrix green theme
    const s = SCALE;
    const size = Math.round(32 * s);
    const skinTone = 0xf1c27d; // Light skin
    const g = this.make.graphics({ x: 0, y: 0 });

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

  private generateCJSprite(): void {
    // CJ - On-chain hood rat from BagsCity (GTA San Andreas inspired)
    // Bald head, white tank top, blue jeans - iconic Grove Street look
    const s = SCALE;
    const size = Math.round(32 * s);
    const skinTone = 0x6b4423; // Dark brown skin (CJ's actual skin tone)
    const skinHighlight = 0x7d5a3c; // Slightly lighter for depth
    const g = this.make.graphics({ x: 0, y: 0 });

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

  private generateShawSprite(): void {
    // Shaw - ElizaOS creator (@shawmakesmagic)
    // Based on reference: dark messy hair, teal sunglasses, pink tie-dye shirt, dark pants
    const s = SCALE;
    const size = Math.round(32 * s);
    const skinTone = 0xdeb896; // Warm skin tone
    const skinHighlight = 0xf0c8a0;
    const g = this.make.graphics({ x: 0, y: 0 });

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

  private createCharacterSprite(
    key: string,
    skinTone: number,
    hairColor: number,
    shirtColor: number,
    mood: "neutral" | "happy" | "sad" | "celebrating"
  ): void {
    const s = SCALE;
    const size = Math.round(32 * s);
    const g = this.make.graphics({ x: 0, y: 0 });

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

  private generateWeatherAssets(): void {
    const s = SCALE;

    // Rain drop - enhanced
    const rainGraphics = this.make.graphics({ x: 0, y: 0 });
    rainGraphics.fillStyle(0x60a5fa);
    rainGraphics.fillRect(Math.round(1 * s), 0, Math.round(2 * s), Math.round(8 * s));
    rainGraphics.fillStyle(0x93c5fd);
    rainGraphics.fillRect(Math.round(1 * s), 0, Math.round(1 * s), Math.round(3 * s));
    rainGraphics.fillStyle(0x3b82f6);
    rainGraphics.fillRect(
      Math.round(2 * s),
      Math.round(5 * s),
      Math.round(1 * s),
      Math.round(3 * s)
    );
    rainGraphics.generateTexture("rain", Math.round(4 * s), Math.round(10 * s));
    rainGraphics.destroy();

    // Sun with rays - enhanced with more detail
    const sunGraphics = this.make.graphics({ x: 0, y: 0 });
    // Outer glow
    sunGraphics.fillStyle(0xfbbf24, 0.15);
    sunGraphics.fillCircle(Math.round(20 * s), Math.round(20 * s), Math.round(20 * s));
    sunGraphics.fillStyle(0xfbbf24, 0.3);
    sunGraphics.fillCircle(Math.round(20 * s), Math.round(20 * s), Math.round(16 * s));
    sunGraphics.fillStyle(0xfbbf24, 0.5);
    sunGraphics.fillCircle(Math.round(20 * s), Math.round(20 * s), Math.round(12 * s));
    // Core
    sunGraphics.fillStyle(0xfbbf24);
    sunGraphics.fillCircle(Math.round(20 * s), Math.round(20 * s), Math.round(8 * s));
    // Bright center
    sunGraphics.fillStyle(0xfef3c7);
    sunGraphics.fillCircle(Math.round(18 * s), Math.round(18 * s), Math.round(4 * s));
    // Hot spot
    sunGraphics.fillStyle(0xffffff);
    sunGraphics.fillCircle(Math.round(17 * s), Math.round(17 * s), Math.round(2 * s));
    sunGraphics.generateTexture("sun", Math.round(40 * s), Math.round(40 * s));
    sunGraphics.destroy();

    // Moon - crescent with crater details
    const moonGraphics = this.make.graphics({ x: 0, y: 0 });
    // Outer glow
    moonGraphics.fillStyle(0xc4b5fd, 0.2);
    moonGraphics.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(16 * s));
    moonGraphics.fillStyle(0xe0e7ff, 0.3);
    moonGraphics.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(12 * s));
    // Moon body
    moonGraphics.fillStyle(0xf1f5f9);
    moonGraphics.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(10 * s));
    // Crescent shadow
    moonGraphics.fillStyle(0x1e293b, 0.7);
    moonGraphics.fillCircle(Math.round(20 * s), Math.round(14 * s), Math.round(8 * s));
    // Craters
    moonGraphics.fillStyle(0xcbd5e1);
    moonGraphics.fillCircle(Math.round(12 * s), Math.round(14 * s), Math.round(2 * s));
    moonGraphics.fillCircle(Math.round(14 * s), Math.round(20 * s), Math.round(1.5 * s));
    moonGraphics.fillCircle(Math.round(10 * s), Math.round(18 * s), Math.round(1 * s));
    moonGraphics.generateTexture("moon", Math.round(32 * s), Math.round(32 * s));
    moonGraphics.destroy();

    // Fluffy cloud
    const cloudGraphics = this.make.graphics({ x: 0, y: 0 });
    cloudGraphics.fillStyle(0x9ca3af);
    cloudGraphics.fillCircle(Math.round(20 * s), Math.round(24 * s), Math.round(14 * s));
    cloudGraphics.fillCircle(Math.round(36 * s), Math.round(20 * s), Math.round(16 * s));
    cloudGraphics.fillCircle(Math.round(52 * s), Math.round(24 * s), Math.round(12 * s));
    cloudGraphics.fillStyle(0xd1d5db);
    cloudGraphics.fillCircle(Math.round(18 * s), Math.round(22 * s), Math.round(10 * s));
    cloudGraphics.fillCircle(Math.round(34 * s), Math.round(18 * s), Math.round(12 * s));
    cloudGraphics.generateTexture("cloud", Math.round(68 * s), Math.round(40 * s));
    cloudGraphics.destroy();

    // Storm cloud
    const stormCloud = this.make.graphics({ x: 0, y: 0 });
    stormCloud.fillStyle(0x374151);
    stormCloud.fillCircle(Math.round(20 * s), Math.round(24 * s), Math.round(14 * s));
    stormCloud.fillCircle(Math.round(36 * s), Math.round(20 * s), Math.round(16 * s));
    stormCloud.fillCircle(Math.round(52 * s), Math.round(24 * s), Math.round(12 * s));
    stormCloud.fillStyle(0x4b5563);
    stormCloud.fillCircle(Math.round(34 * s), Math.round(22 * s), Math.round(10 * s));
    stormCloud.generateTexture("storm_cloud", Math.round(68 * s), Math.round(40 * s));
    stormCloud.destroy();

    // Lightning bolt
    const lightning = this.make.graphics({ x: 0, y: 0 });
    lightning.fillStyle(0xfbbf24);
    lightning.fillPoints(
      [
        { x: Math.round(8 * s), y: 0 },
        { x: Math.round(4 * s), y: Math.round(10 * s) },
        { x: Math.round(8 * s), y: Math.round(10 * s) },
        { x: Math.round(2 * s), y: Math.round(20 * s) },
        { x: Math.round(10 * s), y: Math.round(8 * s) },
        { x: Math.round(6 * s), y: Math.round(8 * s) },
        { x: Math.round(10 * s), y: 0 },
      ],
      true
    );
    lightning.generateTexture("lightning", Math.round(12 * s), Math.round(20 * s));
    lightning.destroy();

    // Snowflake
    const snow = this.make.graphics({ x: 0, y: 0 });
    snow.fillStyle(0xffffff);
    snow.fillCircle(Math.round(4 * s), Math.round(4 * s), Math.round(3 * s));
    snow.fillStyle(0xe0f2fe);
    snow.fillCircle(Math.round(3 * s), Math.round(3 * s), Math.round(1 * s));
    snow.generateTexture("snow", Math.round(8 * s), Math.round(8 * s));
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
    const cx = 8,
      cy = 8,
      outerR = 7,
      innerR = 3;
    const starPoints: Phaser.Types.Math.Vector2Like[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (i * Math.PI) / 5 - Math.PI / 2;
      starPoints.push({
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
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

  private generateLaunchPadAssets(): void {
    // Billboard/Screen - large display for live data (NYC Times Square style)
    this.generateBillboard();

    // Neon sign frame
    this.generateNeonSign();

    // Skyscraper silhouettes for background
    this.generateSkyscraperSilhouettes();

    // Digital ticker display
    this.generateTickerDisplay();

    // Concrete/asphalt ground for urban feel
    this.generateUrbanGround();

    // Street lamp (urban style)
    this.generateStreetLamp();

    // Neon tube decorations
    this.generateNeonTubes();
  }

  private generateBillboard(): void {
    // Large LED billboard screen (120x80 pixels)
    const g = this.make.graphics({ x: 0, y: 0 });

    // Frame (dark metal)
    g.fillStyle(0x1f2937);
    g.fillRect(0, 0, 120, 80);

    // Inner frame border
    g.fillStyle(0x374151);
    g.fillRect(2, 2, 116, 76);

    // Screen area (dark when off, will be overlaid with data)
    g.fillStyle(0x0a0a0f);
    g.fillRect(4, 4, 112, 72);

    // LED grid effect (subtle)
    g.fillStyle(0x111827);
    for (let x = 4; x < 116; x += 4) {
      g.fillRect(x, 4, 1, 72);
    }
    for (let y = 4; y < 76; y += 4) {
      g.fillRect(4, y, 112, 1);
    }

    // Corner brackets (structural)
    g.fillStyle(0x4b5563);
    g.fillRect(0, 0, 8, 3);
    g.fillRect(0, 0, 3, 8);
    g.fillRect(112, 0, 8, 3);
    g.fillRect(117, 0, 3, 8);
    g.fillRect(0, 77, 8, 3);
    g.fillRect(0, 72, 3, 8);
    g.fillRect(112, 77, 8, 3);
    g.fillRect(117, 72, 3, 8);

    // Support pole (at bottom center)
    g.fillStyle(0x374151);
    g.fillRect(55, 78, 10, 20);
    g.fillStyle(0x4b5563);
    g.fillRect(57, 78, 6, 20);

    g.generateTexture("billboard", 120, 100);
    g.destroy();

    // Smaller screen variant (for side displays)
    const small = this.make.graphics({ x: 0, y: 0 });
    small.fillStyle(0x1f2937);
    small.fillRect(0, 0, 60, 45);
    small.fillStyle(0x0a0a0f);
    small.fillRect(2, 2, 56, 41);
    // LED grid
    small.fillStyle(0x111827);
    for (let x = 2; x < 58; x += 3) {
      small.fillRect(x, 2, 1, 41);
    }
    small.generateTexture("billboard_small", 60, 45);
    small.destroy();
  }

  private generateNeonSign(): void {
    // "CITY" neon sign
    const g = this.make.graphics({ x: 0, y: 0 });
    const signWidth = 60;
    const signHeight = 24;

    // Backing board
    g.fillStyle(0x1a1a1a);
    g.fillRect(0, 0, signWidth, signHeight);

    // Border glow effect (gold for city)
    g.fillStyle(0xfbbf24, 0.4);
    g.fillRect(0, 0, signWidth, 2);
    g.fillRect(0, signHeight - 2, signWidth, 2);
    g.fillRect(0, 0, 2, signHeight);
    g.fillRect(signWidth - 2, 0, 2, signHeight);

    // Neon text "CITY" (stylized pixel letters) - gold color
    g.fillStyle(0xfbbf24);
    const startX = 8;
    const y = 6;
    const letterH = 12;
    const spacing = 12;

    // C
    g.fillRect(startX, y, 2, letterH);
    g.fillRect(startX, y, 7, 2);
    g.fillRect(startX, y + letterH - 2, 7, 2);
    // I
    g.fillRect(startX + spacing, y, 6, 2);
    g.fillRect(startX + spacing + 2, y, 2, letterH);
    g.fillRect(startX + spacing, y + letterH - 2, 6, 2);
    // T
    g.fillRect(startX + spacing * 2, y, 8, 2);
    g.fillRect(startX + spacing * 2 + 3, y, 2, letterH);
    // Y
    g.fillRect(startX + spacing * 3, y, 2, 5);
    g.fillRect(startX + spacing * 3 + 6, y, 2, 5);
    g.fillRect(startX + spacing * 3 + 2, y + 3, 2, 2);
    g.fillRect(startX + spacing * 3 + 4, y + 3, 2, 2);
    g.fillRect(startX + spacing * 3 + 3, y + 5, 2, 7);

    // Glow effect around letters
    g.fillStyle(0xfbbf24, 0.2);
    g.fillRect(4, 4, signWidth - 8, signHeight - 8);

    g.generateTexture("neon_trending", signWidth, signHeight);
    g.destroy();

    // "NEW" neon sign (red/gold)
    const newSign = this.make.graphics({ x: 0, y: 0 });
    newSign.fillStyle(0x1a1a1a);
    newSign.fillRect(0, 0, 50, 20);

    // Glow border
    newSign.fillStyle(0xef4444, 0.3);
    newSign.fillRect(0, 0, 50, 2);
    newSign.fillRect(0, 18, 50, 2);

    // "NEW" text
    newSign.fillStyle(0xef4444);
    // N
    newSign.fillRect(6, 5, 2, 10);
    newSign.fillRect(14, 5, 2, 10);
    newSign.fillRect(8, 6, 2, 2);
    newSign.fillRect(10, 8, 2, 2);
    newSign.fillRect(12, 10, 2, 2);
    // E
    newSign.fillRect(18, 5, 2, 10);
    newSign.fillRect(20, 5, 6, 2);
    newSign.fillRect(20, 9, 4, 2);
    newSign.fillRect(20, 13, 6, 2);
    // W
    newSign.fillRect(28, 5, 2, 10);
    newSign.fillRect(36, 5, 2, 10);
    newSign.fillRect(30, 11, 2, 4);
    newSign.fillRect(32, 9, 2, 4);
    newSign.fillRect(34, 11, 2, 4);

    newSign.generateTexture("neon_new", 50, 20);
    newSign.destroy();

    // Blinking arrow (for attention)
    const arrow = this.make.graphics({ x: 0, y: 0 });
    arrow.fillStyle(0xfbbf24);
    arrow.fillTriangle(0, 10, 16, 0, 16, 20);
    arrow.fillRect(16, 6, 14, 8);
    // Glow
    arrow.fillStyle(0xfbbf24, 0.3);
    arrow.fillTriangle(-2, 10, 18, -2, 18, 22);
    arrow.generateTexture("neon_arrow", 32, 22);
    arrow.destroy();
  }

  private generateSkyscraperSilhouettes(): void {
    // Tall building silhouette for background (dark, moody NYC style)
    const g = this.make.graphics({ x: 0, y: 0 });

    // Building 1 - tall tower
    g.fillStyle(0x111827);
    g.fillRect(0, 40, 30, 160);
    // Antenna
    g.fillRect(13, 20, 4, 20);
    g.fillStyle(0xef4444);
    g.fillCircle(15, 18, 2);
    // Windows (faint lights)
    g.fillStyle(0xfbbf24, 0.3);
    for (let y = 50; y < 190; y += 12) {
      for (let x = 4; x < 26; x += 8) {
        if (Math.random() > 0.3) {
          g.fillRect(x, y, 4, 6);
        }
      }
    }

    // Building 2 - medium tower
    g.fillStyle(0x1f2937);
    g.fillRect(35, 80, 25, 120);
    // Windows
    g.fillStyle(0x60a5fa, 0.2);
    for (let y = 90; y < 190; y += 10) {
      for (let x = 38; x < 58; x += 7) {
        if (Math.random() > 0.4) {
          g.fillRect(x, y, 4, 5);
        }
      }
    }

    // Building 3 - short wide
    g.fillStyle(0x0f172a);
    g.fillRect(65, 120, 35, 80);
    // Billboard on top
    g.fillStyle(0x4ade80, 0.4);
    g.fillRect(70, 110, 25, 12);

    g.generateTexture("skyline_bg", 100, 200);
    g.destroy();
  }

  private generateTickerDisplay(): void {
    // Horizontal ticker/news crawl display
    const g = this.make.graphics({ x: 0, y: 0 });

    // Housing
    g.fillStyle(0x1f2937);
    g.fillRect(0, 0, 200, 16);

    // Screen area
    g.fillStyle(0x0a0a0f);
    g.fillRect(2, 2, 196, 12);

    // LED dots effect
    g.fillStyle(0x111827);
    for (let x = 2; x < 198; x += 2) {
      g.fillRect(x, 2, 1, 12);
    }

    g.generateTexture("ticker_display", 200, 16);
    g.destroy();
  }

  private generateUrbanGround(): void {
    // Concrete/asphalt texture
    const g = this.make.graphics({ x: 0, y: 0 });

    // Base asphalt
    g.fillStyle(0x374151);
    g.fillRect(0, 0, 32, 32);

    // Variation spots
    g.fillStyle(0x4b5563);
    for (let i = 0; i < 8; i++) {
      const x = Math.floor(Math.random() * 28);
      const y = Math.floor(Math.random() * 28);
      g.fillRect(x, y, 3, 3);
    }

    // Cracks
    g.fillStyle(0x1f2937);
    g.fillRect(8, 0, 1, 12);
    g.fillRect(8, 12, 6, 1);
    g.fillRect(20, 15, 1, 17);

    g.generateTexture("concrete", 32, 32);
    g.destroy();

    // Sidewalk
    const sidewalk = this.make.graphics({ x: 0, y: 0 });
    sidewalk.fillStyle(0x6b7280);
    sidewalk.fillRect(0, 0, 32, 32);
    // Grid lines
    sidewalk.fillStyle(0x4b5563);
    sidewalk.fillRect(0, 15, 32, 2);
    sidewalk.fillRect(15, 0, 2, 32);
    // Texture
    sidewalk.fillStyle(0x9ca3af);
    sidewalk.fillRect(4, 4, 2, 2);
    sidewalk.fillRect(20, 22, 2, 2);
    sidewalk.generateTexture("sidewalk", 32, 32);
    sidewalk.destroy();
  }

  private generateStreetLamp(): void {
    // Modern urban street lamp
    const g = this.make.graphics({ x: 0, y: 0 });

    // Pole
    g.fillStyle(0x374151);
    g.fillRect(8, 20, 4, 50);
    g.fillStyle(0x4b5563);
    g.fillRect(9, 20, 2, 50);

    // Lamp arm
    g.fillStyle(0x374151);
    g.fillRect(10, 16, 14, 3);

    // Lamp housing
    g.fillStyle(0x1f2937);
    g.fillRect(16, 10, 12, 8);

    // Light (glowing)
    g.fillStyle(0xfbbf24, 0.8);
    g.fillRect(18, 16, 8, 4);

    // Light glow effect
    g.fillStyle(0xfbbf24, 0.2);
    g.fillRect(14, 18, 16, 20);
    g.fillStyle(0xfbbf24, 0.1);
    g.fillRect(10, 22, 24, 30);

    g.generateTexture("street_lamp", 32, 70);
    g.destroy();
  }

  private generateNeonTubes(): void {
    // Vertical neon tube (green)
    const greenTube = this.make.graphics({ x: 0, y: 0 });
    greenTube.fillStyle(0x4ade80, 0.3);
    greenTube.fillRect(0, 0, 8, 60);
    greenTube.fillStyle(0x4ade80, 0.6);
    greenTube.fillRect(2, 0, 4, 60);
    greenTube.fillStyle(0x4ade80);
    greenTube.fillRect(3, 0, 2, 60);
    greenTube.generateTexture("neon_tube_green", 8, 60);
    greenTube.destroy();

    // Horizontal neon tube (pink/magenta)
    const pinkTube = this.make.graphics({ x: 0, y: 0 });
    pinkTube.fillStyle(0xec4899, 0.3);
    pinkTube.fillRect(0, 0, 80, 6);
    pinkTube.fillStyle(0xec4899, 0.6);
    pinkTube.fillRect(0, 1, 80, 4);
    pinkTube.fillStyle(0xec4899);
    pinkTube.fillRect(0, 2, 80, 2);
    pinkTube.generateTexture("neon_tube_pink", 80, 6);
    pinkTube.destroy();

    // Blue neon tube
    const blueTube = this.make.graphics({ x: 0, y: 0 });
    blueTube.fillStyle(0x3b82f6, 0.3);
    blueTube.fillRect(0, 0, 6, 40);
    blueTube.fillStyle(0x3b82f6, 0.6);
    blueTube.fillRect(1, 0, 4, 40);
    blueTube.fillStyle(0x3b82f6);
    blueTube.fillRect(2, 0, 2, 40);
    blueTube.generateTexture("neon_tube_blue", 6, 40);
    blueTube.destroy();

    // Gold/yellow neon tube
    const goldTube = this.make.graphics({ x: 0, y: 0 });
    goldTube.fillStyle(0xfbbf24, 0.3);
    goldTube.fillRect(0, 0, 60, 6);
    goldTube.fillStyle(0xfbbf24, 0.6);
    goldTube.fillRect(0, 1, 60, 4);
    goldTube.fillStyle(0xfbbf24);
    goldTube.fillRect(0, 2, 60, 2);
    goldTube.generateTexture("neon_tube_gold", 60, 6);
    goldTube.destroy();

    // Generate additional city assets
    this.generateCityAssets();
  }

  private generateCityAssets(): void {
    // Parked car (side view)
    this.generateCar();

    // Fire hydrant
    this.generateFireHydrant();

    // Trash can
    this.generateTrashCan();

    // Road markings
    this.generateRoadMarkings();

    // Advertising poster
    this.generateAdPoster();

    // Traffic light
    this.generateTrafficLight();

    // Taxi/cab variant
    this.generateTaxi();
  }

  private generateCar(): void {
    const g = this.make.graphics({ x: 0, y: 0 });

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillRect(4, 22, 44, 6);

    // Car body (blue sedan)
    g.fillStyle(0x1e40af);
    g.fillRect(4, 8, 44, 14);

    // Lighter top for 3D effect
    g.fillStyle(0x3b82f6);
    g.fillRect(4, 8, 44, 4);

    // Roof/cabin
    g.fillStyle(0x1e3a8a);
    g.fillRect(14, 2, 22, 8);

    // Windows (glass)
    g.fillStyle(0x60a5fa, 0.8);
    g.fillRect(16, 4, 8, 5);
    g.fillRect(26, 4, 8, 5);

    // Window frame
    g.fillStyle(0x0f172a);
    g.fillRect(24, 4, 2, 5);

    // Wheels
    g.fillStyle(0x1f2937);
    g.fillCircle(12, 20, 5);
    g.fillCircle(40, 20, 5);

    // Wheel centers (hubcaps)
    g.fillStyle(0x6b7280);
    g.fillCircle(12, 20, 2);
    g.fillCircle(40, 20, 2);

    // Headlights
    g.fillStyle(0xfef3c7);
    g.fillRect(46, 12, 2, 4);

    // Taillights
    g.fillStyle(0xef4444);
    g.fillRect(4, 12, 2, 4);

    g.generateTexture("car_blue", 52, 28);
    g.destroy();
  }

  private generateFireHydrant(): void {
    const g = this.make.graphics({ x: 0, y: 0 });

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillRect(2, 22, 12, 4);

    // Base
    g.fillStyle(0xdc2626);
    g.fillRect(4, 18, 8, 6);

    // Body
    g.fillStyle(0xef4444);
    g.fillRect(3, 8, 10, 12);

    // Cap
    g.fillStyle(0xb91c1c);
    g.fillRect(2, 4, 12, 6);
    g.fillRect(5, 2, 6, 4);

    // Side valves
    g.fillStyle(0xfbbf24);
    g.fillRect(0, 10, 4, 4);
    g.fillRect(12, 10, 4, 4);

    // Highlight
    g.fillStyle(0xfca5a5, 0.5);
    g.fillRect(5, 8, 2, 10);

    g.generateTexture("fire_hydrant", 16, 26);
    g.destroy();
  }

  private generateTrashCan(): void {
    const g = this.make.graphics({ x: 0, y: 0 });

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillRect(2, 26, 16, 4);

    // Can body
    g.fillStyle(0x374151);
    g.fillRect(2, 8, 16, 20);

    // Darker side for 3D
    g.fillStyle(0x1f2937);
    g.fillRect(2, 8, 4, 20);

    // Lid
    g.fillStyle(0x4b5563);
    g.fillRect(0, 4, 20, 6);

    // Handle
    g.fillStyle(0x6b7280);
    g.fillRect(8, 2, 4, 4);

    // Recycling symbol area
    g.fillStyle(0x4ade80);
    g.fillRect(6, 14, 8, 8);

    g.generateTexture("trash_can", 20, 30);
    g.destroy();
  }

  private generateRoadMarkings(): void {
    // Crosswalk
    const crosswalk = this.make.graphics({ x: 0, y: 0 });
    crosswalk.fillStyle(0x374151);
    crosswalk.fillRect(0, 0, 60, 30);

    // White stripes
    crosswalk.fillStyle(0xffffff, 0.9);
    for (let x = 4; x < 56; x += 10) {
      crosswalk.fillRect(x, 2, 6, 26);
    }

    crosswalk.generateTexture("crosswalk", 60, 30);
    crosswalk.destroy();

    // Road line (dashed)
    const roadLine = this.make.graphics({ x: 0, y: 0 });
    roadLine.fillStyle(0xfbbf24);
    roadLine.fillRect(0, 0, 20, 4);
    roadLine.generateTexture("road_line", 20, 4);
    roadLine.destroy();
  }

  private generateAdPoster(): void {
    // Wall-mounted advertisement poster
    const g = this.make.graphics({ x: 0, y: 0 });

    // Frame
    g.fillStyle(0x1f2937);
    g.fillRect(0, 0, 40, 50);

    // Poster background
    g.fillStyle(0x0a0a0f);
    g.fillRect(2, 2, 36, 46);

    // "BAGS" brand ad
    g.fillStyle(0x4ade80);
    g.fillRect(6, 6, 28, 12);

    // Abstract art lines
    g.fillStyle(0xfbbf24);
    g.fillRect(8, 22, 24, 2);
    g.fillStyle(0xec4899);
    g.fillRect(8, 28, 20, 2);
    g.fillStyle(0x3b82f6);
    g.fillRect(8, 34, 16, 2);

    // "TRADE NOW" text area
    g.fillStyle(0xfbbf24, 0.8);
    g.fillRect(6, 40, 28, 6);

    g.generateTexture("ad_poster", 40, 50);
    g.destroy();
  }

  private generateTrafficLight(): void {
    const g = this.make.graphics({ x: 0, y: 0 });

    // Pole
    g.fillStyle(0x374151);
    g.fillRect(6, 36, 4, 30);

    // Light housing
    g.fillStyle(0x1f2937);
    g.fillRect(0, 0, 16, 38);

    // Light frame
    g.fillStyle(0x374151);
    g.fillRect(1, 1, 14, 36);

    // Red light (top) - off
    g.fillStyle(0x7f1d1d);
    g.fillCircle(8, 8, 4);

    // Yellow light (middle) - off
    g.fillStyle(0x78350f);
    g.fillCircle(8, 19, 4);

    // Green light (bottom) - on
    g.fillStyle(0x4ade80);
    g.fillCircle(8, 30, 4);
    // Glow
    g.fillStyle(0x4ade80, 0.3);
    g.fillCircle(8, 30, 6);

    g.generateTexture("traffic_light", 16, 66);
    g.destroy();
  }

  private generateTaxi(): void {
    const g = this.make.graphics({ x: 0, y: 0 });

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillRect(4, 22, 44, 6);

    // Car body (yellow taxi)
    g.fillStyle(0xeab308);
    g.fillRect(4, 8, 44, 14);

    // Lighter top for 3D effect
    g.fillStyle(0xfbbf24);
    g.fillRect(4, 8, 44, 4);

    // Roof/cabin
    g.fillStyle(0xca8a04);
    g.fillRect(14, 2, 22, 8);

    // Taxi sign on roof
    g.fillStyle(0xfef3c7);
    g.fillRect(20, 0, 10, 4);

    // Windows (glass)
    g.fillStyle(0x60a5fa, 0.8);
    g.fillRect(16, 4, 8, 5);
    g.fillRect(26, 4, 8, 5);

    // Window frame
    g.fillStyle(0x0f172a);
    g.fillRect(24, 4, 2, 5);

    // Checkered stripe
    g.fillStyle(0x0f172a);
    for (let x = 6; x < 46; x += 4) {
      if ((x / 4) % 2 === 0) {
        g.fillRect(x, 14, 4, 4);
      }
    }

    // Wheels
    g.fillStyle(0x1f2937);
    g.fillCircle(12, 20, 5);
    g.fillCircle(40, 20, 5);

    // Wheel centers (hubcaps)
    g.fillStyle(0x6b7280);
    g.fillCircle(12, 20, 2);
    g.fillCircle(40, 20, 2);

    // Headlights
    g.fillStyle(0xfef3c7);
    g.fillRect(46, 12, 2, 4);

    // Taillights
    g.fillStyle(0xef4444);
    g.fillRect(4, 12, 2, 4);

    g.generateTexture("taxi", 52, 28);
    g.destroy();
  }

  // ============================================
  // ACADEMY ZONE - BAGS.FM TEAM CHARACTER SPRITES
  // ============================================

  private generateRamoSprite(): void {
    // Ramo (@ramyobags) - Co-Founder & CTO, Vienna, Superteam DE
    // Tech-focused look, professional but approachable
    const s = SCALE;
    const size = Math.round(32 * s);
    const skinTone = 0xf5d0c5; // Light skin
    const skinHighlight = 0xfce4d6;
    const g = this.make.graphics({ x: 0, y: 0 });

    // Tech blue glow behind Ramo
    g.fillStyle(0x3b82f6, 0.15);
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
    g.fillStyle(0x10b981, 0.1); // Bags green accent
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

    // Shadow
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

    // Legs (dark pants - professional)
    g.fillStyle(0x1f2937);
    g.fillRect(Math.round(10 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));
    g.fillRect(Math.round(17 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));

    // Shoes (clean sneakers)
    g.fillStyle(0x374151);
    g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(9 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));
    g.fillRect(Math.round(17 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));

    // Tech blue hoodie/shirt
    g.fillStyle(0x3b82f6);
    g.fillRect(Math.round(7 * s), Math.round(11 * s), Math.round(18 * s), Math.round(11 * s));
    // Hoodie detail
    g.fillStyle(0x2563eb);
    g.fillRect(Math.round(12 * s), Math.round(11 * s), Math.round(8 * s), Math.round(4 * s));
    // Bags logo on chest (small green square)
    g.fillStyle(0x10b981);
    g.fillRect(Math.round(14 * s), Math.round(15 * s), Math.round(4 * s), Math.round(3 * s));

    // Arms
    g.fillStyle(skinTone);
    g.fillRect(Math.round(4 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
    g.fillRect(Math.round(24 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
    // Hands
    g.fillRect(Math.round(4 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillRect(Math.round(25 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));

    // Head
    g.fillStyle(skinTone);
    g.fillRect(Math.round(9 * s), Math.round(3 * s), Math.round(14 * s), Math.round(10 * s));
    g.fillStyle(skinHighlight);
    g.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(4 * s), Math.round(3 * s));

    // Dark hair (neat, professional)
    g.fillStyle(0x1a1a1a);
    g.fillRect(Math.round(8 * s), Math.round(0 * s), Math.round(16 * s), Math.round(5 * s));
    g.fillRect(Math.round(7 * s), Math.round(2 * s), Math.round(3 * s), Math.round(4 * s));
    g.fillRect(Math.round(22 * s), Math.round(2 * s), Math.round(3 * s), Math.round(4 * s));
    // Hair highlight
    g.fillStyle(0x2d2d2d);
    g.fillRect(Math.round(11 * s), Math.round(1 * s), Math.round(4 * s), Math.round(2 * s));

    // Eyes
    g.fillStyle(0x1a1a1a);
    g.fillRect(Math.round(11 * s), Math.round(6 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(3 * s), Math.round(2 * s));
    // Eye shine
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(11 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));
    g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));

    // Friendly smile
    g.fillStyle(0x8b6b5a);
    g.fillRect(Math.round(13 * s), Math.round(10 * s), Math.round(6 * s), Math.round(1 * s));

    g.generateTexture("ramo", size, size);
    g.destroy();
  }

  private generateSincaraSprite(): void {
    // Sincara (@sincara_bags) - Frontend Engineer
    // Creative developer aesthetic, headphones, design-focused
    const s = SCALE;
    const size = Math.round(32 * s);
    const skinTone = 0xd4a574; // Medium skin
    const skinHighlight = 0xe0b88c;
    const g = this.make.graphics({ x: 0, y: 0 });

    // Purple creative glow
    g.fillStyle(0x8b5cf6, 0.15);
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
    g.fillStyle(0xa855f7, 0.1);
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

    // Shadow
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

    // Legs (dark gray jeans)
    g.fillStyle(0x374151);
    g.fillRect(Math.round(10 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));
    g.fillRect(Math.round(17 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));

    // Shoes (stylish)
    g.fillStyle(0x8b5cf6);
    g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(9 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));
    g.fillRect(Math.round(17 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));

    // Purple hoodie (design vibes)
    g.fillStyle(0x8b5cf6);
    g.fillRect(Math.round(7 * s), Math.round(11 * s), Math.round(18 * s), Math.round(11 * s));
    // Hoodie highlights
    g.fillStyle(0xa855f7);
    g.fillRect(Math.round(8 * s), Math.round(13 * s), Math.round(4 * s), Math.round(3 * s));
    g.fillRect(Math.round(18 * s), Math.round(14 * s), Math.round(4 * s), Math.round(3 * s));
    // Design icon on shirt (paint palette)
    g.fillStyle(0xfbbf24);
    g.fillRect(Math.round(14 * s), Math.round(16 * s), Math.round(4 * s), Math.round(3 * s));

    // Arms
    g.fillStyle(skinTone);
    g.fillRect(Math.round(4 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
    g.fillRect(Math.round(24 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
    g.fillRect(Math.round(4 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillRect(Math.round(25 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));

    // Head
    g.fillStyle(skinTone);
    g.fillRect(Math.round(9 * s), Math.round(3 * s), Math.round(14 * s), Math.round(10 * s));
    g.fillStyle(skinHighlight);
    g.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(4 * s), Math.round(3 * s));

    // Brown hair (styled)
    g.fillStyle(0x2d1b0e);
    g.fillRect(Math.round(8 * s), Math.round(0 * s), Math.round(16 * s), Math.round(5 * s));
    g.fillRect(Math.round(7 * s), Math.round(1 * s), Math.round(3 * s), Math.round(5 * s));
    g.fillRect(Math.round(22 * s), Math.round(1 * s), Math.round(3 * s), Math.round(5 * s));
    // Hair texture
    g.fillStyle(0x4a3728);
    g.fillRect(Math.round(12 * s), Math.round(1 * s), Math.round(3 * s), Math.round(2 * s));

    // Headphones (signature accessory)
    g.fillStyle(0x1f2937);
    g.fillRect(Math.round(5 * s), Math.round(3 * s), Math.round(3 * s), Math.round(6 * s));
    g.fillRect(Math.round(24 * s), Math.round(3 * s), Math.round(3 * s), Math.round(6 * s));
    g.fillRect(Math.round(7 * s), Math.round(-1 * s), Math.round(18 * s), Math.round(3 * s));
    // Ear cushions
    g.fillStyle(0x8b5cf6);
    g.fillRect(Math.round(5 * s), Math.round(4 * s), Math.round(2 * s), Math.round(4 * s));
    g.fillRect(Math.round(25 * s), Math.round(4 * s), Math.round(2 * s), Math.round(4 * s));

    // Eyes
    g.fillStyle(0x1a1a1a);
    g.fillRect(Math.round(11 * s), Math.round(6 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(11 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));
    g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));

    // Creative smile
    g.fillStyle(0x8b6b5a);
    g.fillRect(Math.round(13 * s), Math.round(10 * s), Math.round(6 * s), Math.round(1 * s));

    g.generateTexture("sincara", size, size);
    g.destroy();
  }

  private generateStuuSprite(): void {
    // Stuu (@StuuBags) - Operations & Support
    // Friendly, approachable, helpful look with Bags green
    const s = SCALE;
    const size = Math.round(32 * s);
    const skinTone = 0xffdbac;
    const skinHighlight = 0xffe4c4;
    const g = this.make.graphics({ x: 0, y: 0 });

    // Bags green glow
    g.fillStyle(0x10b981, 0.15);
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
    g.fillStyle(0x22c55e, 0.1);
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

    // Shadow
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

    // Legs (dark jeans)
    g.fillStyle(0x1f2937);
    g.fillRect(Math.round(10 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));
    g.fillRect(Math.round(17 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));

    // Shoes
    g.fillStyle(0x374151);
    g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(9 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));
    g.fillRect(Math.round(17 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));

    // Bags green polo shirt
    g.fillStyle(0x10b981);
    g.fillRect(Math.round(7 * s), Math.round(11 * s), Math.round(18 * s), Math.round(11 * s));
    // Collar
    g.fillStyle(0x059669);
    g.fillRect(Math.round(11 * s), Math.round(10 * s), Math.round(10 * s), Math.round(3 * s));
    // Polo buttons
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(15 * s), Math.round(13 * s), Math.round(2 * s), Math.round(1 * s));
    g.fillRect(Math.round(15 * s), Math.round(15 * s), Math.round(2 * s), Math.round(1 * s));

    // Arms
    g.fillStyle(skinTone);
    g.fillRect(Math.round(4 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
    g.fillRect(Math.round(24 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
    g.fillRect(Math.round(4 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillRect(Math.round(25 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));

    // Head
    g.fillStyle(skinTone);
    g.fillRect(Math.round(9 * s), Math.round(3 * s), Math.round(14 * s), Math.round(10 * s));
    g.fillStyle(skinHighlight);
    g.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(4 * s), Math.round(3 * s));

    // Brown hair (friendly, neat)
    g.fillStyle(0x8b4513);
    g.fillRect(Math.round(8 * s), Math.round(0 * s), Math.round(16 * s), Math.round(5 * s));
    g.fillRect(Math.round(7 * s), Math.round(2 * s), Math.round(3 * s), Math.round(4 * s));
    g.fillRect(Math.round(22 * s), Math.round(2 * s), Math.round(3 * s), Math.round(4 * s));
    g.fillStyle(0xa0522d);
    g.fillRect(Math.round(11 * s), Math.round(1 * s), Math.round(5 * s), Math.round(2 * s));

    // Friendly eyes
    g.fillStyle(0x1a1a1a);
    g.fillRect(Math.round(11 * s), Math.round(6 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(12 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));
    g.fillRect(Math.round(19 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));

    // Big friendly smile
    g.fillStyle(0x8b6b5a);
    g.fillRect(Math.round(12 * s), Math.round(10 * s), Math.round(8 * s), Math.round(1 * s));
    g.fillRect(Math.round(13 * s), Math.round(11 * s), Math.round(6 * s), Math.round(1 * s));

    g.generateTexture("stuu", size, size);
    g.destroy();
  }

  private generateSamSprite(): void {
    // Sam (@Sambags12) - Growth & Marketing
    // Energetic, hype energy, gold/amber colors
    const s = SCALE;
    const size = Math.round(32 * s);
    const skinTone = 0xf1c27d;
    const skinHighlight = 0xffd699;
    const g = this.make.graphics({ x: 0, y: 0 });

    // Gold/amber marketing glow
    g.fillStyle(0xf59e0b, 0.15);
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
    g.fillStyle(0xfbbf24, 0.1);
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

    // Shadow
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

    // Legs (stylish jeans)
    g.fillStyle(0x374151);
    g.fillRect(Math.round(10 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));
    g.fillRect(Math.round(17 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));

    // Trendy sneakers
    g.fillStyle(0xf59e0b);
    g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(9 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));
    g.fillRect(Math.round(17 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));

    // Amber/gold jacket
    g.fillStyle(0xf59e0b);
    g.fillRect(Math.round(7 * s), Math.round(11 * s), Math.round(18 * s), Math.round(11 * s));
    // Jacket details
    g.fillStyle(0xd97706);
    g.fillRect(Math.round(15 * s), Math.round(11 * s), Math.round(2 * s), Math.round(11 * s));
    // White tee underneath
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(11 * s), Math.round(11 * s), Math.round(10 * s), Math.round(4 * s));

    // Arms (jacket sleeves)
    g.fillStyle(0xf59e0b);
    g.fillRect(Math.round(4 * s), Math.round(12 * s), Math.round(4 * s), Math.round(8 * s));
    g.fillRect(Math.round(24 * s), Math.round(12 * s), Math.round(4 * s), Math.round(8 * s));
    // Hands
    g.fillStyle(skinTone);
    g.fillRect(Math.round(4 * s), Math.round(19 * s), Math.round(3 * s), Math.round(4 * s));
    g.fillRect(Math.round(25 * s), Math.round(19 * s), Math.round(3 * s), Math.round(4 * s));

    // Head
    g.fillStyle(skinTone);
    g.fillRect(Math.round(9 * s), Math.round(3 * s), Math.round(14 * s), Math.round(10 * s));
    g.fillStyle(skinHighlight);
    g.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(4 * s), Math.round(3 * s));

    // Blonde hair (trendy, styled up)
    g.fillStyle(0xffd700);
    g.fillRect(Math.round(8 * s), Math.round(-1 * s), Math.round(16 * s), Math.round(6 * s));
    g.fillRect(Math.round(7 * s), Math.round(1 * s), Math.round(3 * s), Math.round(5 * s));
    g.fillRect(Math.round(22 * s), Math.round(1 * s), Math.round(3 * s), Math.round(5 * s));
    // Styled spikes
    g.fillRect(Math.round(10 * s), Math.round(-2 * s), Math.round(3 * s), Math.round(3 * s));
    g.fillRect(Math.round(16 * s), Math.round(-2 * s), Math.round(3 * s), Math.round(3 * s));
    g.fillStyle(0xffc107);
    g.fillRect(Math.round(12 * s), Math.round(0 * s), Math.round(4 * s), Math.round(2 * s));

    // Energetic eyes
    g.fillStyle(0x1a1a1a);
    g.fillRect(Math.round(11 * s), Math.round(6 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(12 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));
    g.fillRect(Math.round(19 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));

    // Excited smile
    g.fillStyle(0x8b6b5a);
    g.fillRect(Math.round(12 * s), Math.round(10 * s), Math.round(8 * s), Math.round(1 * s));
    g.fillRect(Math.round(13 * s), Math.round(11 * s), Math.round(6 * s), Math.round(1 * s));

    g.generateTexture("sam", size, size);
    g.destroy();
  }

  private generateAlaaSprite(): void {
    // Alaa (@alaadotsol) - Skunk Works Director
    // Mysterious, innovative, dark aesthetic with goggles
    const s = SCALE;
    const size = Math.round(32 * s);
    const skinTone = 0xd4a574;
    const skinHighlight = 0xe0b88c;
    const g = this.make.graphics({ x: 0, y: 0 });

    // Dark mysterious glow
    g.fillStyle(0x1f2937, 0.2);
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
    g.fillStyle(0x6366f1, 0.1); // Subtle purple hint
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

    // Shadow
    g.fillStyle(0x000000, 0.5);
    g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

    // Legs (black pants)
    g.fillStyle(0x0f0f0f);
    g.fillRect(Math.round(10 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));
    g.fillRect(Math.round(17 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));

    // Dark boots
    g.fillStyle(0x1a1a1a);
    g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillStyle(0x374151);
    g.fillRect(Math.round(9 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));
    g.fillRect(Math.round(17 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));

    // Black lab coat/jacket
    g.fillStyle(0x1a1a1a);
    g.fillRect(Math.round(6 * s), Math.round(11 * s), Math.round(20 * s), Math.round(12 * s));
    // Coat details
    g.fillStyle(0x2d2d2d);
    g.fillRect(Math.round(15 * s), Math.round(11 * s), Math.round(2 * s), Math.round(12 * s));
    // Secret pocket glow (hint of experiments)
    g.fillStyle(0x6366f1);
    g.fillRect(Math.round(18 * s), Math.round(16 * s), Math.round(3 * s), Math.round(2 * s));

    // Arms (lab coat)
    g.fillStyle(0x1a1a1a);
    g.fillRect(Math.round(3 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
    g.fillRect(Math.round(25 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
    // Hands
    g.fillStyle(skinTone);
    g.fillRect(Math.round(3 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillRect(Math.round(26 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));

    // Head
    g.fillStyle(skinTone);
    g.fillRect(Math.round(9 * s), Math.round(3 * s), Math.round(14 * s), Math.round(10 * s));
    g.fillStyle(skinHighlight);
    g.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(4 * s), Math.round(3 * s));

    // Black hair (messy scientist look)
    g.fillStyle(0x0a0a0a);
    g.fillRect(Math.round(7 * s), Math.round(-1 * s), Math.round(18 * s), Math.round(6 * s));
    g.fillRect(Math.round(6 * s), Math.round(1 * s), Math.round(3 * s), Math.round(6 * s));
    g.fillRect(Math.round(23 * s), Math.round(1 * s), Math.round(3 * s), Math.round(6 * s));
    // Messy spikes
    g.fillRect(Math.round(9 * s), Math.round(-2 * s), Math.round(2 * s), Math.round(3 * s));
    g.fillRect(Math.round(14 * s), Math.round(-3 * s), Math.round(3 * s), Math.round(4 * s));
    g.fillRect(Math.round(20 * s), Math.round(-2 * s), Math.round(2 * s), Math.round(3 * s));

    // Lab goggles (signature accessory)
    g.fillStyle(0x374151); // Frame
    g.fillRect(Math.round(8 * s), Math.round(5 * s), Math.round(7 * s), Math.round(4 * s));
    g.fillRect(Math.round(17 * s), Math.round(5 * s), Math.round(7 * s), Math.round(4 * s));
    g.fillRect(Math.round(15 * s), Math.round(6 * s), Math.round(2 * s), Math.round(2 * s));
    // Goggle lens (glowing slightly)
    g.fillStyle(0x6366f1);
    g.fillRect(Math.round(9 * s), Math.round(6 * s), Math.round(5 * s), Math.round(2 * s));
    g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(5 * s), Math.round(2 * s));
    // Lens reflection
    g.fillStyle(0xa5b4fc);
    g.fillRect(Math.round(9 * s), Math.round(6 * s), Math.round(2 * s), Math.round(1 * s));
    g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(2 * s), Math.round(1 * s));

    // Mysterious neutral expression
    g.fillStyle(0x6b5b4a);
    g.fillRect(Math.round(13 * s), Math.round(10 * s), Math.round(6 * s), Math.round(1 * s));

    g.generateTexture("alaa", size, size);
    g.destroy();
  }

  private generateCarloSprite(): void {
    // Carlo (@carlobags) - Community Ambassador
    // Welcoming, friendly, wearing badge, green polo
    const s = SCALE;
    const size = Math.round(32 * s);
    const skinTone = 0xf5d0c5;
    const skinHighlight = 0xfce4d6;
    const g = this.make.graphics({ x: 0, y: 0 });

    // Friendly green glow
    g.fillStyle(0x22c55e, 0.15);
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
    g.fillStyle(0x10b981, 0.1);
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

    // Shadow
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

    // Legs (navy pants - professional but casual)
    g.fillStyle(0x1e3a5f);
    g.fillRect(Math.round(10 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));
    g.fillRect(Math.round(17 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));

    // Clean shoes
    g.fillStyle(0x374151);
    g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(9 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));
    g.fillRect(Math.round(17 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));

    // Green polo (ambassador uniform)
    g.fillStyle(0x22c55e);
    g.fillRect(Math.round(7 * s), Math.round(11 * s), Math.round(18 * s), Math.round(11 * s));
    // Collar
    g.fillStyle(0x16a34a);
    g.fillRect(Math.round(11 * s), Math.round(10 * s), Math.round(10 * s), Math.round(3 * s));
    // Ambassador badge (gold)
    g.fillStyle(0xfbbf24);
    g.fillRect(Math.round(18 * s), Math.round(13 * s), Math.round(4 * s), Math.round(4 * s));
    g.fillStyle(0xf59e0b);
    g.fillRect(Math.round(19 * s), Math.round(14 * s), Math.round(2 * s), Math.round(2 * s));

    // Arms
    g.fillStyle(skinTone);
    g.fillRect(Math.round(4 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
    g.fillRect(Math.round(24 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
    g.fillRect(Math.round(4 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillRect(Math.round(25 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));

    // Head
    g.fillStyle(skinTone);
    g.fillRect(Math.round(9 * s), Math.round(3 * s), Math.round(14 * s), Math.round(10 * s));
    g.fillStyle(skinHighlight);
    g.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(4 * s), Math.round(3 * s));

    // Brown hair (neat, professional)
    g.fillStyle(0x4a3728);
    g.fillRect(Math.round(8 * s), Math.round(0 * s), Math.round(16 * s), Math.round(5 * s));
    g.fillRect(Math.round(7 * s), Math.round(2 * s), Math.round(3 * s), Math.round(4 * s));
    g.fillRect(Math.round(22 * s), Math.round(2 * s), Math.round(3 * s), Math.round(4 * s));
    g.fillStyle(0x5c4033);
    g.fillRect(Math.round(11 * s), Math.round(1 * s), Math.round(5 * s), Math.round(2 * s));

    // Welcoming eyes
    g.fillStyle(0x1a1a1a);
    g.fillRect(Math.round(11 * s), Math.round(6 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(3 * s), Math.round(2 * s));
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(12 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));
    g.fillRect(Math.round(19 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));

    // Warm welcoming smile
    g.fillStyle(0x8b6b5a);
    g.fillRect(Math.round(11 * s), Math.round(10 * s), Math.round(10 * s), Math.round(1 * s));
    g.fillRect(Math.round(12 * s), Math.round(11 * s), Math.round(8 * s), Math.round(1 * s));

    g.generateTexture("carlo", size, size);
    g.destroy();
  }

  private generateBNNSprite(): void {
    // BNN (@BNNBags) - News Network Bot
    // Robot/news bot aesthetic, blue and white, screen display
    const s = SCALE;
    const size = Math.round(32 * s);
    const g = this.make.graphics({ x: 0, y: 0 });

    // News blue glow
    g.fillStyle(0x3b82f6, 0.15);
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
    g.fillStyle(0x60a5fa, 0.1);
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

    // Shadow
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

    // Robot legs (metallic)
    g.fillStyle(0x4b5563);
    g.fillRect(Math.round(10 * s), Math.round(22 * s), Math.round(5 * s), Math.round(9 * s));
    g.fillRect(Math.round(17 * s), Math.round(22 * s), Math.round(5 * s), Math.round(9 * s));
    // Joint details
    g.fillStyle(0x6b7280);
    g.fillRect(Math.round(10 * s), Math.round(25 * s), Math.round(5 * s), Math.round(2 * s));
    g.fillRect(Math.round(17 * s), Math.round(25 * s), Math.round(5 * s), Math.round(2 * s));

    // Robot feet
    g.fillStyle(0x374151);
    g.fillRect(Math.round(8 * s), Math.round(29 * s), Math.round(7 * s), Math.round(3 * s));
    g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(7 * s), Math.round(3 * s));

    // Robot body (news blue)
    g.fillStyle(0x3b82f6);
    g.fillRect(Math.round(7 * s), Math.round(11 * s), Math.round(18 * s), Math.round(12 * s));
    // Body panel lines
    g.fillStyle(0x2563eb);
    g.fillRect(Math.round(7 * s), Math.round(16 * s), Math.round(18 * s), Math.round(2 * s));
    // News screen on chest
    g.fillStyle(0x1e293b);
    g.fillRect(Math.round(10 * s), Math.round(13 * s), Math.round(12 * s), Math.round(6 * s));
    // Screen content (scrolling text effect)
    g.fillStyle(0x22c55e);
    g.fillRect(Math.round(11 * s), Math.round(14 * s), Math.round(8 * s), Math.round(1 * s));
    g.fillRect(Math.round(11 * s), Math.round(16 * s), Math.round(6 * s), Math.round(1 * s));

    // Robot arms (metallic)
    g.fillStyle(0x4b5563);
    g.fillRect(Math.round(4 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
    g.fillRect(Math.round(24 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
    // Shoulder joints
    g.fillStyle(0x6b7280);
    g.fillRect(Math.round(4 * s), Math.round(11 * s), Math.round(4 * s), Math.round(2 * s));
    g.fillRect(Math.round(24 * s), Math.round(11 * s), Math.round(4 * s), Math.round(2 * s));
    // Robot hands (claw-like)
    g.fillStyle(0x374151);
    g.fillRect(Math.round(4 * s), Math.round(21 * s), Math.round(3 * s), Math.round(3 * s));
    g.fillRect(Math.round(25 * s), Math.round(21 * s), Math.round(3 * s), Math.round(3 * s));

    // Robot head (boxy, screen face)
    g.fillStyle(0x4b5563);
    g.fillRect(Math.round(8 * s), Math.round(2 * s), Math.round(16 * s), Math.round(11 * s));
    // Head border
    g.fillStyle(0x6b7280);
    g.fillRect(Math.round(8 * s), Math.round(2 * s), Math.round(16 * s), Math.round(2 * s));
    g.fillRect(Math.round(8 * s), Math.round(11 * s), Math.round(16 * s), Math.round(2 * s));

    // Face screen
    g.fillStyle(0x1e293b);
    g.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(12 * s), Math.round(6 * s));

    // LED eyes (bright cyan)
    g.fillStyle(0x22d3ee);
    g.fillRect(Math.round(11 * s), Math.round(5 * s), Math.round(3 * s), Math.round(3 * s));
    g.fillRect(Math.round(18 * s), Math.round(5 * s), Math.round(3 * s), Math.round(3 * s));
    // Eye glow
    g.fillStyle(0x67e8f9);
    g.fillRect(Math.round(11 * s), Math.round(5 * s), Math.round(1 * s), Math.round(1 * s));
    g.fillRect(Math.round(18 * s), Math.round(5 * s), Math.round(1 * s), Math.round(1 * s));

    // Antenna (for receiving news)
    g.fillStyle(0x6b7280);
    g.fillRect(Math.round(15 * s), Math.round(-2 * s), Math.round(2 * s), Math.round(5 * s));
    // Antenna light (blinking red)
    g.fillStyle(0xef4444);
    g.fillCircle(Math.round(16 * s), Math.round(-3 * s), Math.round(2 * s));

    // Speaker mouth
    g.fillStyle(0x374151);
    g.fillRect(Math.round(13 * s), Math.round(8 * s), Math.round(6 * s), Math.round(1 * s));
    g.fillStyle(0x22c55e); // Speaker active indicator
    g.fillRect(Math.round(14 * s), Math.round(8 * s), Math.round(1 * s), Math.round(1 * s));
    g.fillRect(Math.round(17 * s), Math.round(8 * s), Math.round(1 * s), Math.round(1 * s));

    g.generateTexture("bnn", size, size);
    g.destroy();
  }

  private generateProfessorOakSprite(): void {
    // Professor Oak - Classic Pokemon style sprite
    // Based on original Gen 1/2 sprite: tall gray hair, white lab coat, red shirt
    const s = SCALE;
    const size = Math.round(32 * s);
    const skinTone = 0xf8d8b8; // Pokemon-style light skin
    const hairGray = 0x9ca3af; // Gray hair
    const hairDark = 0x6b7280; // Darker gray for shading
    const labCoat = 0xf8f8f8; // Off-white lab coat
    const labCoatShadow = 0xd1d5db; // Lab coat shadow
    const shirtRed = 0x9f1239; // Dark red/maroon shirt
    const g = this.make.graphics({ x: 0, y: 0 });

    // Amber/wisdom glow behind Professor Oak
    g.fillStyle(0xfbbf24, 0.12);
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
    g.fillStyle(0xf59e0b, 0.08);
    g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

    // Shadow on ground
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(12 * s), Math.round(4 * s));

    // === LEGS (brown pants) ===
    g.fillStyle(0x6b4423); // Brown pants
    g.fillRect(Math.round(11 * s), Math.round(23 * s), Math.round(4 * s), Math.round(7 * s));
    g.fillRect(Math.round(17 * s), Math.round(23 * s), Math.round(4 * s), Math.round(7 * s));
    // Pants shadow
    g.fillStyle(0x4a3419);
    g.fillRect(Math.round(11 * s), Math.round(23 * s), Math.round(1 * s), Math.round(7 * s));
    g.fillRect(Math.round(17 * s), Math.round(23 * s), Math.round(1 * s), Math.round(7 * s));

    // === SHOES (dark brown) ===
    g.fillStyle(0x3d2817);
    g.fillRect(Math.round(10 * s), Math.round(29 * s), Math.round(5 * s), Math.round(3 * s));
    g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(5 * s), Math.round(3 * s));

    // === LAB COAT (main body) ===
    g.fillStyle(labCoat);
    g.fillRect(Math.round(8 * s), Math.round(13 * s), Math.round(16 * s), Math.round(12 * s));
    // Lab coat shadow (left side depth)
    g.fillStyle(labCoatShadow);
    g.fillRect(Math.round(8 * s), Math.round(13 * s), Math.round(2 * s), Math.round(12 * s));
    // Lab coat opening (shows red shirt underneath)
    g.fillStyle(shirtRed);
    g.fillRect(Math.round(13 * s), Math.round(13 * s), Math.round(6 * s), Math.round(10 * s));
    // Lab coat lapel details
    g.fillStyle(labCoatShadow);
    g.fillRect(Math.round(12 * s), Math.round(13 * s), Math.round(1 * s), Math.round(8 * s));
    g.fillRect(Math.round(19 * s), Math.round(13 * s), Math.round(1 * s), Math.round(8 * s));

    // === ARMS (lab coat sleeves) ===
    g.fillStyle(labCoat);
    g.fillRect(Math.round(5 * s), Math.round(13 * s), Math.round(4 * s), Math.round(9 * s));
    g.fillRect(Math.round(23 * s), Math.round(13 * s), Math.round(4 * s), Math.round(9 * s));
    // Sleeve shadows
    g.fillStyle(labCoatShadow);
    g.fillRect(Math.round(5 * s), Math.round(13 * s), Math.round(1 * s), Math.round(9 * s));
    g.fillRect(Math.round(23 * s), Math.round(13 * s), Math.round(1 * s), Math.round(9 * s));

    // === HANDS ===
    g.fillStyle(skinTone);
    g.fillRect(Math.round(5 * s), Math.round(21 * s), Math.round(4 * s), Math.round(3 * s));
    g.fillRect(Math.round(23 * s), Math.round(21 * s), Math.round(4 * s), Math.round(3 * s));

    // === HEAD ===
    g.fillStyle(skinTone);
    g.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(12 * s), Math.round(10 * s));
    // Face shadow (left side)
    g.fillStyle(0xe8c8a8);
    g.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(2 * s), Math.round(10 * s));

    // === GRAY HAIR (tall, spiky - classic Oak style) ===
    // Main hair mass (tall on top)
    g.fillStyle(hairGray);
    g.fillRect(Math.round(9 * s), Math.round(-1 * s), Math.round(14 * s), Math.round(7 * s));
    // Hair spikes on top
    g.fillRect(Math.round(11 * s), Math.round(-3 * s), Math.round(3 * s), Math.round(3 * s));
    g.fillRect(Math.round(15 * s), Math.round(-4 * s), Math.round(3 * s), Math.round(4 * s));
    g.fillRect(Math.round(19 * s), Math.round(-2 * s), Math.round(3 * s), Math.round(3 * s));
    // Hair sides (bushy)
    g.fillRect(Math.round(7 * s), Math.round(2 * s), Math.round(3 * s), Math.round(6 * s));
    g.fillRect(Math.round(22 * s), Math.round(2 * s), Math.round(3 * s), Math.round(6 * s));
    // Hair shading (darker accents)
    g.fillStyle(hairDark);
    g.fillRect(Math.round(9 * s), Math.round(0 * s), Math.round(2 * s), Math.round(5 * s));
    g.fillRect(Math.round(12 * s), Math.round(-2 * s), Math.round(1 * s), Math.round(2 * s));
    g.fillRect(Math.round(16 * s), Math.round(-3 * s), Math.round(1 * s), Math.round(2 * s));
    g.fillRect(Math.round(7 * s), Math.round(3 * s), Math.round(1 * s), Math.round(4 * s));

    // === EYES (small, friendly) ===
    g.fillStyle(0x1f2937);
    g.fillRect(Math.round(12 * s), Math.round(7 * s), Math.round(2 * s), Math.round(2 * s));
    g.fillRect(Math.round(18 * s), Math.round(7 * s), Math.round(2 * s), Math.round(2 * s));
    // Eye highlights
    g.fillStyle(0xffffff);
    g.fillRect(Math.round(12 * s), Math.round(7 * s), Math.round(1 * s), Math.round(1 * s));
    g.fillRect(Math.round(18 * s), Math.round(7 * s), Math.round(1 * s), Math.round(1 * s));

    // === EYEBROWS (gray, bushy) ===
    g.fillStyle(hairGray);
    g.fillRect(Math.round(11 * s), Math.round(5 * s), Math.round(4 * s), Math.round(2 * s));
    g.fillRect(Math.round(17 * s), Math.round(5 * s), Math.round(4 * s), Math.round(2 * s));

    // === NOSE ===
    g.fillStyle(0xe8c8a8);
    g.fillRect(Math.round(15 * s), Math.round(9 * s), Math.round(2 * s), Math.round(2 * s));

    // === MOUTH (friendly smile) ===
    g.fillStyle(0x92400e);
    g.fillRect(Math.round(14 * s), Math.round(12 * s), Math.round(4 * s), Math.round(1 * s));

    // === NECK ===
    g.fillStyle(skinTone);
    g.fillRect(Math.round(13 * s), Math.round(13 * s), Math.round(6 * s), Math.round(2 * s));

    g.generateTexture("professorOak", size, size);
    g.destroy();
  }

  // ========================================
  // FOUNDER'S CORNER ZONE ASSETS
  // Cozy workshop/educational hub for DexScreener prep
  // ========================================

  private generateFoundersAssets(): void {
    this.generateFoundersGround();
    this.generateFoundersBuildings();
    this.generateFoundersProps();
    this.generateFoundersPokemon();
  }

  private generateFoundersGround(): void {
    const s = SCALE;
    const size = Math.round(32 * s);
    const g = this.make.graphics({ x: 0, y: 0 });

    // Base cobblestone color (warm gray-brown)
    g.fillStyle(0x78716c);
    g.fillRect(0, 0, size, size);

    // Stone pattern - 2x2 grid of individual stones with gaps
    const stoneSize = Math.round(14 * s);
    const gap = Math.round(2 * s);
    const stones = [
      { x: gap, y: gap, color: 0x6b7280 },
      { x: stoneSize + gap * 2, y: gap, color: 0x57534e },
      { x: gap, y: stoneSize + gap * 2, color: 0x57534e },
      { x: stoneSize + gap * 2, y: stoneSize + gap * 2, color: 0x6b7280 },
    ];

    stones.forEach((stone) => {
      // Stone base
      g.fillStyle(stone.color);
      g.fillRect(stone.x, stone.y, stoneSize, stoneSize);

      // Stone highlight (top-left edges)
      g.fillStyle(lighten(stone.color, 0.15));
      g.fillRect(stone.x, stone.y, stoneSize, Math.round(2 * s));
      g.fillRect(stone.x, stone.y, Math.round(2 * s), stoneSize);

      // Stone shadow (bottom-right edges)
      g.fillStyle(darken(stone.color, 0.2));
      g.fillRect(stone.x, stone.y + stoneSize - Math.round(2 * s), stoneSize, Math.round(2 * s));
      g.fillRect(stone.x + stoneSize - Math.round(2 * s), stone.y, Math.round(2 * s), stoneSize);
    });

    // Occasional moss/grass detail in gaps
    g.fillStyle(0x4d7c0f);
    g.fillRect(Math.round(15 * s), Math.round(1 * s), Math.round(2 * s), Math.round(1 * s));
    g.fillRect(Math.round(1 * s), Math.round(15 * s), Math.round(1 * s), Math.round(2 * s));

    // Warm accent - tiny flower peeking through
    g.fillStyle(0xfbbf24);
    g.fillRect(Math.round(26 * s), Math.round(5 * s), Math.round(2 * s), Math.round(2 * s));

    g.generateTexture("founders_ground", size, size);
    g.destroy();
  }

  private generateFoundersBuildings(): void {
    const s = SCALE;

    // Building 0: DexScreener Workshop (main educational building)
    this.generateFoundersWorkshop(s);

    // Building 1: Art Studio (logo/banner assets)
    this.generateFoundersStudio(s);

    // Building 2: Social Hub (social links building)
    this.generateFoundersSocialHub(s);
  }

  private generateFoundersWorkshop(s: number): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const canvasW = Math.round(80 * s);
    const canvasH = Math.round(140 * s);
    const bWidth = Math.round(65 * s);
    const bHeight = Math.round(90 * s);
    const baseX = Math.round(7 * s);
    const baseY = canvasH - bHeight;

    // Colors
    const woodBase = 0x8b4513; // SaddleBrown
    const woodLight = lighten(woodBase, 0.15);
    const woodDark = darken(woodBase, 0.2);
    const roofColor = 0x5c3317; // Dark brown roof
    const accent = PALETTE.bagsGreen; // DexScreener green

    // Drop shadow
    g.fillStyle(PALETTE.void, 0.5);
    g.fillRect(baseX + Math.round(5 * s), baseY + Math.round(5 * s), bWidth, bHeight);

    // Main body
    g.fillStyle(woodBase);
    g.fillRect(baseX, baseY, bWidth, bHeight);

    // 3D depth: Light left edge
    g.fillStyle(woodLight);
    g.fillRect(baseX, baseY, Math.round(5 * s), bHeight);

    // 3D depth: Dark right edge
    g.fillStyle(woodDark);
    g.fillRect(baseX + bWidth - Math.round(5 * s), baseY, Math.round(5 * s), bHeight);

    // Dithering texture on walls
    g.fillStyle(darken(woodBase, 0.08));
    for (let py = 0; py < bHeight; py += Math.round(6 * s)) {
      for (let px = Math.round(6 * s); px < bWidth - Math.round(6 * s); px += Math.round(10 * s)) {
        if ((Math.floor(py / Math.round(6 * s)) + Math.floor(px / Math.round(10 * s))) % 2 === 0) {
          g.fillRect(baseX + px, baseY + py, Math.round(8 * s), Math.round(4 * s));
        }
      }
    }

    // Horizontal wood plank lines
    g.fillStyle(woodDark);
    for (let py = Math.round(15 * s); py < bHeight; py += Math.round(18 * s)) {
      g.fillRect(
        baseX + Math.round(5 * s),
        baseY + py,
        bWidth - Math.round(10 * s),
        Math.round(1 * s)
      );
    }

    // Pointed roof
    const roofPeakY = baseY - Math.round(35 * s);
    const roofLeftX = baseX - Math.round(5 * s);
    const roofRightX = baseX + bWidth + Math.round(5 * s);
    const roofCenterX = baseX + bWidth / 2;

    g.fillStyle(roofColor);
    g.fillTriangle(roofLeftX, baseY, roofCenterX, roofPeakY, roofRightX, baseY);

    // Roof highlight (left slope)
    g.fillStyle(lighten(roofColor, 0.15));
    g.fillTriangle(roofLeftX, baseY, roofCenterX, roofPeakY, roofCenterX, baseY);

    // Roof ridge cap
    g.fillStyle(0x78350f);
    g.fillRect(
      roofCenterX - Math.round(3 * s),
      roofPeakY - Math.round(2 * s),
      Math.round(6 * s),
      Math.round(8 * s)
    );

    // Chimney
    const chimneyX = baseX + bWidth - Math.round(18 * s);
    const chimneyY = roofPeakY + Math.round(10 * s);
    g.fillStyle(0x78716c);
    g.fillRect(chimneyX, chimneyY, Math.round(10 * s), Math.round(25 * s));
    g.fillStyle(lighten(0x78716c, 0.1));
    g.fillRect(chimneyX, chimneyY, Math.round(2 * s), Math.round(25 * s));
    // Chimney cap
    g.fillStyle(0x57534e);
    g.fillRect(
      chimneyX - Math.round(2 * s),
      chimneyY - Math.round(3 * s),
      Math.round(14 * s),
      Math.round(4 * s)
    );

    // Large chalkboard sign on facade (DexScreener info)
    const signX = baseX + Math.round(10 * s);
    const signY = baseY + Math.round(8 * s);
    const signW = bWidth - Math.round(20 * s);
    const signH = Math.round(28 * s);
    // Sign frame
    g.fillStyle(0x451a03);
    g.fillRect(
      signX - Math.round(3 * s),
      signY - Math.round(3 * s),
      signW + Math.round(6 * s),
      signH + Math.round(6 * s)
    );
    // Chalkboard background
    g.fillStyle(0x1f2937);
    g.fillRect(signX, signY, signW, signH);
    // Chalk text representation (green lines for DexScreener theme)
    g.fillStyle(accent, 0.9);
    g.fillRect(
      signX + Math.round(5 * s),
      signY + Math.round(5 * s),
      signW - Math.round(10 * s),
      Math.round(3 * s)
    );
    g.fillRect(
      signX + Math.round(5 * s),
      signY + Math.round(12 * s),
      signW - Math.round(15 * s),
      Math.round(2 * s)
    );
    g.fillRect(
      signX + Math.round(5 * s),
      signY + Math.round(18 * s),
      signW - Math.round(12 * s),
      Math.round(2 * s)
    );
    // Checkmarks
    g.fillStyle(accent);
    g.fillRect(
      signX + Math.round(3 * s),
      signY + Math.round(12 * s),
      Math.round(2 * s),
      Math.round(2 * s)
    );
    g.fillRect(
      signX + Math.round(3 * s),
      signY + Math.round(18 * s),
      Math.round(2 * s),
      Math.round(2 * s)
    );

    // Windows (2x2 grid with warm glow)
    const windowColor = 0xfbbf24; // Amber glow
    for (let wy = 0; wy < 2; wy++) {
      for (let wx = 0; wx < 2; wx++) {
        const winX = baseX + Math.round(12 * s) + wx * Math.round(22 * s);
        const winY = baseY + Math.round(45 * s) + wy * Math.round(22 * s);
        const winW = Math.round(12 * s);
        const winH = Math.round(16 * s);

        // Window frame (dark wood)
        g.fillStyle(0x451a03);
        g.fillRect(
          winX - Math.round(2 * s),
          winY - Math.round(2 * s),
          winW + Math.round(4 * s),
          winH + Math.round(4 * s)
        );

        // Glow aura
        g.fillStyle(windowColor, 0.3);
        g.fillRect(
          winX - Math.round(1 * s),
          winY - Math.round(1 * s),
          winW + Math.round(2 * s),
          winH + Math.round(2 * s)
        );

        // Window glass
        g.fillStyle(windowColor, 0.8);
        g.fillRect(winX, winY, winW, winH);

        // Window highlight corner
        g.fillStyle(lighten(windowColor, 0.4));
        g.fillRect(winX, winY, Math.round(3 * s), Math.round(4 * s));

        // Window cross frame
        g.fillStyle(woodDark);
        g.fillRect(winX + winW / 2 - Math.round(1 * s), winY, Math.round(2 * s), winH);
        g.fillRect(winX, winY + winH / 2 - Math.round(1 * s), winW, Math.round(2 * s));
      }
    }

    // Door (center-bottom, welcoming double door)
    const doorW = Math.round(18 * s);
    const doorH = Math.round(28 * s);
    const doorX = baseX + bWidth / 2 - doorW / 2;
    const doorY = canvasH - doorH;

    // Door frame
    g.fillStyle(0x451a03);
    g.fillRect(
      doorX - Math.round(3 * s),
      doorY - Math.round(5 * s),
      doorW + Math.round(6 * s),
      doorH + Math.round(5 * s)
    );

    // Door arch top
    g.fillCircle(doorX + doorW / 2, doorY - Math.round(2 * s), doorW / 2 + Math.round(3 * s));
    g.fillStyle(woodDark);
    g.fillCircle(doorX + doorW / 2, doorY - Math.round(2 * s), doorW / 2);

    // Double doors
    g.fillStyle(0x5c3317);
    g.fillRect(doorX, doorY, doorW / 2 - Math.round(1 * s), doorH);
    g.fillRect(doorX + doorW / 2 + Math.round(1 * s), doorY, doorW / 2 - Math.round(1 * s), doorH);

    // Door panels
    g.fillStyle(darken(0x5c3317, 0.15));
    g.fillRect(
      doorX + Math.round(2 * s),
      doorY + Math.round(3 * s),
      Math.round(5 * s),
      Math.round(10 * s)
    );
    g.fillRect(
      doorX + Math.round(2 * s),
      doorY + Math.round(16 * s),
      Math.round(5 * s),
      Math.round(10 * s)
    );
    g.fillRect(
      doorX + doorW / 2 + Math.round(2 * s),
      doorY + Math.round(3 * s),
      Math.round(5 * s),
      Math.round(10 * s)
    );
    g.fillRect(
      doorX + doorW / 2 + Math.round(2 * s),
      doorY + Math.round(16 * s),
      Math.round(5 * s),
      Math.round(10 * s)
    );

    // Door handles
    g.fillStyle(PALETTE.gold);
    g.fillRect(
      doorX + doorW / 2 - Math.round(4 * s),
      doorY + Math.round(14 * s),
      Math.round(2 * s),
      Math.round(4 * s)
    );
    g.fillRect(
      doorX + doorW / 2 + Math.round(2 * s),
      doorY + Math.round(14 * s),
      Math.round(2 * s),
      Math.round(4 * s)
    );

    // Welcome mat
    g.fillStyle(0x78350f);
    g.fillRect(
      doorX - Math.round(4 * s),
      canvasH - Math.round(3 * s),
      doorW + Math.round(8 * s),
      Math.round(3 * s)
    );

    // Hanging sign "LEARN" above door
    const hangSignY = doorY - Math.round(15 * s);
    g.fillStyle(0x451a03);
    g.fillRect(doorX + Math.round(2 * s), hangSignY, doorW - Math.round(4 * s), Math.round(10 * s));
    g.fillStyle(accent);
    g.fillRect(
      doorX + Math.round(4 * s),
      hangSignY + Math.round(2 * s),
      doorW - Math.round(8 * s),
      Math.round(6 * s)
    );
    // Hanging chains
    g.fillStyle(0x6b7280);
    g.fillRect(
      doorX + Math.round(4 * s),
      hangSignY - Math.round(5 * s),
      Math.round(2 * s),
      Math.round(5 * s)
    );
    g.fillRect(
      doorX + doorW - Math.round(6 * s),
      hangSignY - Math.round(5 * s),
      Math.round(2 * s),
      Math.round(5 * s)
    );

    g.generateTexture("founders_0", canvasW, canvasH);
    g.destroy();
  }

  private generateFoundersStudio(s: number): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const canvasW = Math.round(75 * s);
    const canvasH = Math.round(130 * s);
    const bWidth = Math.round(60 * s);
    const bHeight = Math.round(80 * s);
    const baseX = Math.round(7 * s);
    const baseY = canvasH - bHeight;

    // Colors - Art studio theme (warmer brown with gold accents)
    const woodBase = 0xa0522d; // Sienna
    const woodLight = lighten(woodBase, 0.15);
    const woodDark = darken(woodBase, 0.2);
    const roofColor = 0x6b4423;
    const accent = PALETTE.gold;

    // Drop shadow
    g.fillStyle(PALETTE.void, 0.5);
    g.fillRect(baseX + Math.round(5 * s), baseY + Math.round(5 * s), bWidth, bHeight);

    // Main body
    g.fillStyle(woodBase);
    g.fillRect(baseX, baseY, bWidth, bHeight);

    // 3D depth
    g.fillStyle(woodLight);
    g.fillRect(baseX, baseY, Math.round(5 * s), bHeight);
    g.fillStyle(woodDark);
    g.fillRect(baseX + bWidth - Math.round(5 * s), baseY, Math.round(5 * s), bHeight);

    // Dithering
    g.fillStyle(darken(woodBase, 0.08));
    for (let py = 0; py < bHeight; py += Math.round(6 * s)) {
      for (let px = Math.round(6 * s); px < bWidth - Math.round(6 * s); px += Math.round(10 * s)) {
        if ((Math.floor(py / Math.round(6 * s)) + Math.floor(px / Math.round(10 * s))) % 2 === 0) {
          g.fillRect(baseX + px, baseY + py, Math.round(8 * s), Math.round(4 * s));
        }
      }
    }

    // Gambrel roof (barn-style, good for art studio)
    const roofPeakY = baseY - Math.round(30 * s);
    const roofMidY = baseY - Math.round(12 * s);
    const roofLeftX = baseX - Math.round(4 * s);
    const roofRightX = baseX + bWidth + Math.round(4 * s);
    const roofCenterX = baseX + bWidth / 2;

    // Lower roof slopes
    g.fillStyle(roofColor);
    g.fillTriangle(
      roofLeftX,
      baseY,
      roofLeftX,
      roofMidY,
      roofCenterX - Math.round(5 * s),
      roofMidY
    );
    g.fillTriangle(
      roofRightX,
      baseY,
      roofRightX,
      roofMidY,
      roofCenterX + Math.round(5 * s),
      roofMidY
    );
    g.fillRect(roofLeftX, roofMidY, roofRightX - roofLeftX, baseY - roofMidY);

    // Upper roof peak
    g.fillStyle(lighten(roofColor, 0.1));
    g.fillTriangle(
      roofCenterX - Math.round(20 * s),
      roofMidY,
      roofCenterX,
      roofPeakY,
      roofCenterX + Math.round(20 * s),
      roofMidY
    );

    // Roof edge trim
    g.fillStyle(0x78350f);
    g.fillRect(roofLeftX, roofMidY - Math.round(2 * s), roofRightX - roofLeftX, Math.round(3 * s));

    // Large skylight window in roof (for natural light in studio)
    const skylightX = roofCenterX - Math.round(12 * s);
    const skylightY = roofMidY - Math.round(18 * s);
    g.fillStyle(0x451a03);
    g.fillRect(
      skylightX - Math.round(2 * s),
      skylightY - Math.round(2 * s),
      Math.round(28 * s),
      Math.round(18 * s)
    );
    g.fillStyle(0x87ceeb, 0.7);
    g.fillRect(skylightX, skylightY, Math.round(24 * s), Math.round(14 * s));
    g.fillStyle(0xffffff, 0.3);
    g.fillRect(skylightX, skylightY, Math.round(8 * s), Math.round(5 * s));

    // Easel display on facade (showing canvas shapes)
    const easelX = baseX + Math.round(8 * s);
    const easelY = baseY + Math.round(10 * s);
    // Easel frame
    g.fillStyle(0x451a03);
    g.fillRect(easelX, easelY, Math.round(20 * s), Math.round(25 * s));
    // Canvas on easel - showing square (logo) and rectangle (banner)
    g.fillStyle(0xfef3c7);
    g.fillRect(
      easelX + Math.round(3 * s),
      easelY + Math.round(3 * s),
      Math.round(14 * s),
      Math.round(14 * s)
    );
    // Square indicator (1:1)
    g.fillStyle(accent);
    g.fillRect(
      easelX + Math.round(5 * s),
      easelY + Math.round(5 * s),
      Math.round(10 * s),
      Math.round(10 * s)
    );
    // "1:1" text representation
    g.fillStyle(0x000000);
    g.fillRect(
      easelX + Math.round(8 * s),
      easelY + Math.round(8 * s),
      Math.round(4 * s),
      Math.round(4 * s)
    );

    // Second display showing 3:1 banner
    const bannerX = baseX + Math.round(32 * s);
    g.fillStyle(0x451a03);
    g.fillRect(bannerX, easelY, Math.round(22 * s), Math.round(12 * s));
    g.fillStyle(0xfef3c7);
    g.fillRect(
      bannerX + Math.round(2 * s),
      easelY + Math.round(2 * s),
      Math.round(18 * s),
      Math.round(8 * s)
    );
    g.fillStyle(PALETTE.sky);
    g.fillRect(
      bannerX + Math.round(3 * s),
      easelY + Math.round(3 * s),
      Math.round(16 * s),
      Math.round(6 * s)
    );

    // Windows
    const windowColor = 0xfbbf24;
    for (let wx = 0; wx < 2; wx++) {
      const winX = baseX + Math.round(10 * s) + wx * Math.round(25 * s);
      const winY = baseY + Math.round(45 * s);
      const winW = Math.round(15 * s);
      const winH = Math.round(18 * s);

      g.fillStyle(0x451a03);
      g.fillRect(
        winX - Math.round(2 * s),
        winY - Math.round(2 * s),
        winW + Math.round(4 * s),
        winH + Math.round(4 * s)
      );
      g.fillStyle(windowColor, 0.3);
      g.fillRect(
        winX - Math.round(1 * s),
        winY - Math.round(1 * s),
        winW + Math.round(2 * s),
        winH + Math.round(2 * s)
      );
      g.fillStyle(windowColor, 0.8);
      g.fillRect(winX, winY, winW, winH);
      g.fillStyle(lighten(windowColor, 0.4));
      g.fillRect(winX, winY, Math.round(4 * s), Math.round(5 * s));
      // Cross frame
      g.fillStyle(woodDark);
      g.fillRect(winX + winW / 2 - Math.round(1 * s), winY, Math.round(2 * s), winH);
      g.fillRect(winX, winY + winH / 2 - Math.round(1 * s), winW, Math.round(2 * s));
    }

    // Door
    const doorW = Math.round(14 * s);
    const doorH = Math.round(24 * s);
    const doorX = baseX + bWidth / 2 - doorW / 2;
    const doorY = canvasH - doorH;

    g.fillStyle(0x451a03);
    g.fillRect(
      doorX - Math.round(2 * s),
      doorY - Math.round(3 * s),
      doorW + Math.round(4 * s),
      doorH + Math.round(3 * s)
    );
    g.fillStyle(0x5c3317);
    g.fillRect(doorX, doorY, doorW, doorH);
    g.fillStyle(darken(0x5c3317, 0.15));
    g.fillRect(
      doorX + Math.round(2 * s),
      doorY + Math.round(3 * s),
      doorW - Math.round(4 * s),
      Math.round(8 * s)
    );
    g.fillRect(
      doorX + Math.round(2 * s),
      doorY + Math.round(14 * s),
      doorW - Math.round(4 * s),
      Math.round(8 * s)
    );
    g.fillStyle(PALETTE.gold);
    g.fillRect(
      doorX + doorW - Math.round(4 * s),
      doorY + Math.round(12 * s),
      Math.round(2 * s),
      Math.round(3 * s)
    );

    // "ASSETS" sign above door
    const signY = doorY - Math.round(12 * s);
    g.fillStyle(0x451a03);
    g.fillRect(doorX - Math.round(4 * s), signY, doorW + Math.round(8 * s), Math.round(9 * s));
    g.fillStyle(accent);
    g.fillRect(
      doorX - Math.round(2 * s),
      signY + Math.round(2 * s),
      doorW + Math.round(4 * s),
      Math.round(5 * s)
    );

    // Paint splashes on building exterior (artistic touch)
    g.fillStyle(0xef4444, 0.7); // Red splash
    g.fillCircle(baseX + Math.round(8 * s), baseY + Math.round(70 * s), Math.round(3 * s));
    g.fillStyle(0x3b82f6, 0.7); // Blue splash
    g.fillCircle(
      baseX + bWidth - Math.round(10 * s),
      baseY + Math.round(65 * s),
      Math.round(4 * s)
    );
    g.fillStyle(0x22c55e, 0.7); // Green splash
    g.fillCircle(baseX + Math.round(15 * s), baseY + Math.round(75 * s), Math.round(2 * s));

    g.generateTexture("founders_1", canvasW, canvasH);
    g.destroy();
  }

  private generateFoundersSocialHub(s: number): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const canvasW = Math.round(70 * s);
    const canvasH = Math.round(125 * s);
    const bWidth = Math.round(55 * s);
    const bHeight = Math.round(75 * s);
    const baseX = Math.round(7 * s);
    const baseY = canvasH - bHeight;

    // Colors - Community/social theme (rustic brown with blue accents)
    const woodBase = 0x6b4423;
    const woodLight = lighten(woodBase, 0.15);
    const woodDark = darken(woodBase, 0.2);
    const roofColor = 0x5c3317;
    const accent = PALETTE.lightBlue;

    // Drop shadow
    g.fillStyle(PALETTE.void, 0.5);
    g.fillRect(baseX + Math.round(5 * s), baseY + Math.round(5 * s), bWidth, bHeight);

    // Main body
    g.fillStyle(woodBase);
    g.fillRect(baseX, baseY, bWidth, bHeight);

    // 3D depth
    g.fillStyle(woodLight);
    g.fillRect(baseX, baseY, Math.round(5 * s), bHeight);
    g.fillStyle(woodDark);
    g.fillRect(baseX + bWidth - Math.round(5 * s), baseY, Math.round(5 * s), bHeight);

    // Dithering
    g.fillStyle(darken(woodBase, 0.08));
    for (let py = 0; py < bHeight; py += Math.round(6 * s)) {
      for (let px = Math.round(6 * s); px < bWidth - Math.round(6 * s); px += Math.round(10 * s)) {
        if ((Math.floor(py / Math.round(6 * s)) + Math.floor(px / Math.round(10 * s))) % 2 === 0) {
          g.fillRect(baseX + px, baseY + py, Math.round(8 * s), Math.round(4 * s));
        }
      }
    }

    // Flat roof with parapet
    const roofY = baseY - Math.round(8 * s);
    g.fillStyle(roofColor);
    g.fillRect(baseX - Math.round(3 * s), roofY, bWidth + Math.round(6 * s), Math.round(10 * s));
    // Parapet crenellations
    g.fillStyle(lighten(roofColor, 0.1));
    for (let i = 0; i < 5; i++) {
      g.fillRect(
        baseX - Math.round(2 * s) + i * Math.round(12 * s),
        roofY - Math.round(6 * s),
        Math.round(8 * s),
        Math.round(6 * s)
      );
    }

    // Large bulletin board on facade
    const boardX = baseX + Math.round(6 * s);
    const boardY = baseY + Math.round(8 * s);
    const boardW = bWidth - Math.round(12 * s);
    const boardH = Math.round(30 * s);

    // Cork board frame
    g.fillStyle(0x451a03);
    g.fillRect(
      boardX - Math.round(3 * s),
      boardY - Math.round(3 * s),
      boardW + Math.round(6 * s),
      boardH + Math.round(6 * s)
    );
    // Cork surface
    g.fillStyle(0xd2b48c);
    g.fillRect(boardX, boardY, boardW, boardH);
    // Cork texture
    g.fillStyle(darken(0xd2b48c, 0.1));
    for (let py = 0; py < boardH; py += Math.round(4 * s)) {
      for (let px = 0; px < boardW; px += Math.round(6 * s)) {
        if ((py + px) % Math.round(8 * s) === 0) {
          g.fillRect(boardX + px, boardY + py, Math.round(3 * s), Math.round(3 * s));
        }
      }
    }

    // Pinned notes on bulletin board
    // Twitter/X note (blue)
    g.fillStyle(0x1da1f2);
    g.fillRect(
      boardX + Math.round(4 * s),
      boardY + Math.round(4 * s),
      Math.round(12 * s),
      Math.round(10 * s)
    );
    g.fillStyle(0xffffff);
    g.fillRect(
      boardX + Math.round(6 * s),
      boardY + Math.round(7 * s),
      Math.round(8 * s),
      Math.round(1 * s)
    );
    g.fillRect(
      boardX + Math.round(6 * s),
      boardY + Math.round(10 * s),
      Math.round(6 * s),
      Math.round(1 * s)
    );

    // Website note (green)
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(
      boardX + Math.round(20 * s),
      boardY + Math.round(6 * s),
      Math.round(12 * s),
      Math.round(10 * s)
    );
    g.fillStyle(0xffffff);
    g.fillRect(
      boardX + Math.round(22 * s),
      boardY + Math.round(9 * s),
      Math.round(8 * s),
      Math.round(1 * s)
    );
    g.fillRect(
      boardX + Math.round(22 * s),
      boardY + Math.round(12 * s),
      Math.round(5 * s),
      Math.round(1 * s)
    );

    // Telegram note (blue)
    g.fillStyle(0x0088cc);
    g.fillRect(
      boardX + Math.round(8 * s),
      boardY + Math.round(18 * s),
      Math.round(10 * s),
      Math.round(8 * s)
    );
    // Discord note (purple)
    g.fillStyle(0x5865f2);
    g.fillRect(
      boardX + Math.round(22 * s),
      boardY + Math.round(18 * s),
      Math.round(10 * s),
      Math.round(8 * s)
    );

    // Push pins
    g.fillStyle(0xef4444);
    g.fillCircle(boardX + Math.round(10 * s), boardY + Math.round(4 * s), Math.round(2 * s));
    g.fillStyle(0xfbbf24);
    g.fillCircle(boardX + Math.round(26 * s), boardY + Math.round(6 * s), Math.round(2 * s));
    g.fillStyle(0x22c55e);
    g.fillCircle(boardX + Math.round(13 * s), boardY + Math.round(18 * s), Math.round(2 * s));
    g.fillStyle(0xa855f7);
    g.fillCircle(boardX + Math.round(27 * s), boardY + Math.round(18 * s), Math.round(2 * s));

    // Windows
    const windowColor = 0xfbbf24;
    for (let wx = 0; wx < 2; wx++) {
      const winX = baseX + Math.round(8 * s) + wx * Math.round(22 * s);
      const winY = baseY + Math.round(45 * s);
      const winW = Math.round(12 * s);
      const winH = Math.round(16 * s);

      g.fillStyle(0x451a03);
      g.fillRect(
        winX - Math.round(2 * s),
        winY - Math.round(2 * s),
        winW + Math.round(4 * s),
        winH + Math.round(4 * s)
      );
      g.fillStyle(windowColor, 0.3);
      g.fillRect(
        winX - Math.round(1 * s),
        winY - Math.round(1 * s),
        winW + Math.round(2 * s),
        winH + Math.round(2 * s)
      );
      g.fillStyle(windowColor, 0.8);
      g.fillRect(winX, winY, winW, winH);
      g.fillStyle(lighten(windowColor, 0.4));
      g.fillRect(winX, winY, Math.round(3 * s), Math.round(4 * s));
      g.fillStyle(woodDark);
      g.fillRect(winX + winW / 2 - Math.round(1 * s), winY, Math.round(2 * s), winH);
    }

    // Door
    const doorW = Math.round(14 * s);
    const doorH = Math.round(22 * s);
    const doorX = baseX + bWidth / 2 - doorW / 2;
    const doorY = canvasH - doorH;

    g.fillStyle(0x451a03);
    g.fillRect(
      doorX - Math.round(2 * s),
      doorY - Math.round(3 * s),
      doorW + Math.round(4 * s),
      doorH + Math.round(3 * s)
    );
    g.fillStyle(0x5c3317);
    g.fillRect(doorX, doorY, doorW, doorH);
    g.fillStyle(darken(0x5c3317, 0.15));
    g.fillRect(
      doorX + Math.round(2 * s),
      doorY + Math.round(3 * s),
      doorW - Math.round(4 * s),
      Math.round(7 * s)
    );
    g.fillRect(
      doorX + Math.round(2 * s),
      doorY + Math.round(13 * s),
      doorW - Math.round(4 * s),
      Math.round(7 * s)
    );
    g.fillStyle(PALETTE.gold);
    g.fillRect(
      doorX + doorW - Math.round(4 * s),
      doorY + Math.round(10 * s),
      Math.round(2 * s),
      Math.round(3 * s)
    );

    // "CONNECT" sign
    const signY = doorY - Math.round(10 * s);
    g.fillStyle(0x451a03);
    g.fillRect(doorX - Math.round(6 * s), signY, doorW + Math.round(12 * s), Math.round(8 * s));
    g.fillStyle(accent);
    g.fillRect(
      doorX - Math.round(4 * s),
      signY + Math.round(2 * s),
      doorW + Math.round(8 * s),
      Math.round(4 * s)
    );

    // Network connection lines decorating the building
    g.fillStyle(accent, 0.5);
    // Vertical line on left
    g.fillRect(
      baseX + Math.round(3 * s),
      baseY + Math.round(40 * s),
      Math.round(1 * s),
      Math.round(30 * s)
    );
    // Horizontal line to window
    g.fillRect(
      baseX + Math.round(3 * s),
      baseY + Math.round(50 * s),
      Math.round(5 * s),
      Math.round(1 * s)
    );
    // Vertical line on right
    g.fillRect(
      baseX + bWidth - Math.round(4 * s),
      baseY + Math.round(42 * s),
      Math.round(1 * s),
      Math.round(28 * s)
    );
    // Connection nodes
    g.fillStyle(accent);
    g.fillCircle(baseX + Math.round(3 * s), baseY + Math.round(50 * s), Math.round(2 * s));
    g.fillCircle(baseX + bWidth - Math.round(4 * s), baseY + Math.round(55 * s), Math.round(2 * s));

    g.generateTexture("founders_2", canvasW, canvasH);
    g.destroy();
  }

  private generateFoundersProps(): void {
    const s = SCALE;

    // Workbench
    this.generateFoundersWorkbench(s);

    // Easel
    this.generateFoundersEasel(s);

    // Lantern (warm amber)
    this.generateFoundersLantern(s);

    // Wooden crate
    this.generateFoundersCrate(s);

    // Chalkboard sign
    this.generateFoundersChalkboardSign(s);
  }

  private generateFoundersWorkbench(s: number): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const width = Math.round(40 * s);
    const height = Math.round(30 * s);

    // Legs
    g.fillStyle(0x5c3317);
    g.fillRect(Math.round(3 * s), Math.round(18 * s), Math.round(5 * s), Math.round(12 * s));
    g.fillRect(
      width - Math.round(8 * s),
      Math.round(18 * s),
      Math.round(5 * s),
      Math.round(12 * s)
    );

    // Table top
    g.fillStyle(0x8b4513);
    g.fillRect(0, Math.round(12 * s), width, Math.round(8 * s));
    // Top highlight
    g.fillStyle(lighten(0x8b4513, 0.15));
    g.fillRect(0, Math.round(12 * s), width, Math.round(2 * s));
    // Wood grain lines
    g.fillStyle(darken(0x8b4513, 0.1));
    g.fillRect(Math.round(5 * s), Math.round(14 * s), Math.round(30 * s), Math.round(1 * s));
    g.fillRect(Math.round(8 * s), Math.round(17 * s), Math.round(25 * s), Math.round(1 * s));

    // Tools on workbench
    // Hammer
    g.fillStyle(0x78716c);
    g.fillRect(Math.round(8 * s), Math.round(8 * s), Math.round(3 * s), Math.round(6 * s));
    g.fillStyle(0x5c3317);
    g.fillRect(Math.round(8 * s), Math.round(6 * s), Math.round(8 * s), Math.round(3 * s));

    // Blueprint roll
    g.fillStyle(0x60a5fa);
    g.fillRect(Math.round(20 * s), Math.round(8 * s), Math.round(12 * s), Math.round(5 * s));
    g.fillStyle(lighten(0x60a5fa, 0.2));
    g.fillRect(Math.round(20 * s), Math.round(8 * s), Math.round(12 * s), Math.round(1 * s));

    // Small box/container
    g.fillStyle(0x78350f);
    g.fillRect(Math.round(5 * s), Math.round(0 * s), Math.round(8 * s), Math.round(8 * s));
    g.fillStyle(lighten(0x78350f, 0.1));
    g.fillRect(Math.round(5 * s), Math.round(0 * s), Math.round(8 * s), Math.round(2 * s));

    g.generateTexture("founders_workbench", width, height);
    g.destroy();
  }

  private generateFoundersEasel(s: number): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const width = Math.round(28 * s);
    const height = Math.round(45 * s);

    // Easel legs (A-frame)
    g.fillStyle(0x5c3317);
    // Left leg
    g.fillRect(Math.round(4 * s), Math.round(10 * s), Math.round(3 * s), Math.round(35 * s));
    // Right leg
    g.fillRect(
      width - Math.round(7 * s),
      Math.round(10 * s),
      Math.round(3 * s),
      Math.round(35 * s)
    );
    // Back leg (partially visible)
    g.fillStyle(darken(0x5c3317, 0.2));
    g.fillRect(Math.round(12 * s), Math.round(15 * s), Math.round(3 * s), Math.round(30 * s));

    // Cross bar
    g.fillStyle(0x5c3317);
    g.fillRect(Math.round(4 * s), Math.round(30 * s), width - Math.round(8 * s), Math.round(3 * s));

    // Canvas holder ledge
    g.fillStyle(0x78350f);
    g.fillRect(Math.round(2 * s), Math.round(25 * s), width - Math.round(4 * s), Math.round(4 * s));

    // Canvas on easel
    g.fillStyle(0xfef3c7);
    g.fillRect(Math.round(5 * s), Math.round(3 * s), Math.round(18 * s), Math.round(22 * s));
    // Canvas frame
    g.fillStyle(0x78350f);
    g.fillRect(Math.round(5 * s), Math.round(3 * s), Math.round(18 * s), Math.round(2 * s));
    g.fillRect(Math.round(5 * s), Math.round(23 * s), Math.round(18 * s), Math.round(2 * s));
    g.fillRect(Math.round(5 * s), Math.round(3 * s), Math.round(2 * s), Math.round(22 * s));
    g.fillRect(Math.round(21 * s), Math.round(3 * s), Math.round(2 * s), Math.round(22 * s));

    // Simple artwork on canvas (abstract shapes)
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(Math.round(9 * s), Math.round(7 * s), Math.round(10 * s), Math.round(8 * s));
    g.fillStyle(PALETTE.gold);
    g.fillCircle(Math.round(14 * s), Math.round(16 * s), Math.round(4 * s));

    g.generateTexture("founders_easel", width, height);
    g.destroy();
  }

  private generateFoundersLantern(s: number): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const width = Math.round(16 * s);
    const height = Math.round(50 * s);

    // Pole
    g.fillStyle(0x451a03);
    g.fillRect(Math.round(6 * s), Math.round(15 * s), Math.round(4 * s), Math.round(35 * s));
    // Pole highlight
    g.fillStyle(lighten(0x451a03, 0.1));
    g.fillRect(Math.round(6 * s), Math.round(15 * s), Math.round(1 * s), Math.round(35 * s));

    // Lantern housing
    g.fillStyle(0x78350f);
    g.fillRect(Math.round(2 * s), Math.round(5 * s), Math.round(12 * s), Math.round(12 * s));
    // Housing top
    g.fillStyle(0x5c3317);
    g.fillRect(Math.round(1 * s), Math.round(3 * s), Math.round(14 * s), Math.round(3 * s));
    // Housing cap (pointed)
    g.fillTriangle(
      Math.round(1 * s),
      Math.round(3 * s),
      Math.round(8 * s),
      Math.round(-2 * s),
      Math.round(15 * s),
      Math.round(3 * s)
    );

    // Glass panels (warm amber glow)
    g.fillStyle(0xfbbf24, 0.8);
    g.fillRect(Math.round(4 * s), Math.round(7 * s), Math.round(8 * s), Math.round(8 * s));
    // Bright center
    g.fillStyle(0xfde047);
    g.fillRect(Math.round(6 * s), Math.round(9 * s), Math.round(4 * s), Math.round(4 * s));

    // Glow effect (semi-transparent)
    g.fillStyle(0xfbbf24, 0.3);
    g.fillCircle(Math.round(8 * s), Math.round(11 * s), Math.round(10 * s));

    // Hanging hook at top
    g.fillStyle(0x78716c);
    g.fillRect(Math.round(7 * s), Math.round(-3 * s), Math.round(2 * s), Math.round(3 * s));

    // Base decoration
    g.fillStyle(0x5c3317);
    g.fillRect(Math.round(4 * s), Math.round(48 * s), Math.round(8 * s), Math.round(2 * s));

    g.generateTexture("founders_lantern", width, height);
    g.destroy();
  }

  private generateFoundersCrate(s: number): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const width = Math.round(20 * s);
    const height = Math.round(18 * s);

    // Main crate body
    g.fillStyle(0x8b4513);
    g.fillRect(0, Math.round(2 * s), width, height - Math.round(2 * s));

    // 3D depth
    g.fillStyle(lighten(0x8b4513, 0.15));
    g.fillRect(0, Math.round(2 * s), Math.round(3 * s), height - Math.round(2 * s));
    g.fillStyle(darken(0x8b4513, 0.2));
    g.fillRect(
      width - Math.round(3 * s),
      Math.round(2 * s),
      Math.round(3 * s),
      height - Math.round(2 * s)
    );

    // Top surface
    g.fillStyle(lighten(0x8b4513, 0.1));
    g.fillRect(0, 0, width, Math.round(4 * s));

    // Wood plank lines
    g.fillStyle(darken(0x8b4513, 0.15));
    g.fillRect(0, Math.round(6 * s), width, Math.round(1 * s));
    g.fillRect(0, Math.round(11 * s), width, Math.round(1 * s));

    // Metal corner brackets
    g.fillStyle(0x6b7280);
    // Top left
    g.fillRect(0, Math.round(2 * s), Math.round(4 * s), Math.round(2 * s));
    g.fillRect(0, Math.round(2 * s), Math.round(2 * s), Math.round(5 * s));
    // Top right
    g.fillRect(width - Math.round(4 * s), Math.round(2 * s), Math.round(4 * s), Math.round(2 * s));
    g.fillRect(width - Math.round(2 * s), Math.round(2 * s), Math.round(2 * s), Math.round(5 * s));
    // Bottom left
    g.fillRect(0, height - Math.round(4 * s), Math.round(4 * s), Math.round(2 * s));
    g.fillRect(0, height - Math.round(7 * s), Math.round(2 * s), Math.round(5 * s));
    // Bottom right
    g.fillRect(
      width - Math.round(4 * s),
      height - Math.round(4 * s),
      Math.round(4 * s),
      Math.round(2 * s)
    );
    g.fillRect(
      width - Math.round(2 * s),
      height - Math.round(7 * s),
      Math.round(2 * s),
      Math.round(5 * s)
    );

    g.generateTexture("founders_crate", width, height);
    g.destroy();
  }

  private generateFoundersChalkboardSign(s: number): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const width = Math.round(50 * s);
    const height = Math.round(40 * s);

    // Sign posts (A-frame)
    g.fillStyle(0x5c3317);
    g.fillRect(Math.round(5 * s), Math.round(5 * s), Math.round(4 * s), Math.round(35 * s));
    g.fillRect(width - Math.round(9 * s), Math.round(5 * s), Math.round(4 * s), Math.round(35 * s));

    // Cross bar at top
    g.fillStyle(0x78350f);
    g.fillRect(Math.round(3 * s), Math.round(3 * s), width - Math.round(6 * s), Math.round(4 * s));

    // Chalkboard panel
    g.fillStyle(0x1f2937);
    g.fillRect(
      Math.round(8 * s),
      Math.round(8 * s),
      width - Math.round(16 * s),
      Math.round(24 * s)
    );

    // Chalkboard frame
    g.fillStyle(0x451a03);
    g.fillRect(Math.round(8 * s), Math.round(8 * s), width - Math.round(16 * s), Math.round(2 * s));
    g.fillRect(
      Math.round(8 * s),
      Math.round(30 * s),
      width - Math.round(16 * s),
      Math.round(2 * s)
    );
    g.fillRect(Math.round(8 * s), Math.round(8 * s), Math.round(2 * s), Math.round(24 * s));
    g.fillRect(
      width - Math.round(10 * s),
      Math.round(8 * s),
      Math.round(2 * s),
      Math.round(24 * s)
    );

    // Chalk text "WELCOME FOUNDERS"
    g.fillStyle(0xffffff, 0.9);
    // "WELCOME" (simplified as rectangle lines)
    g.fillRect(Math.round(12 * s), Math.round(12 * s), Math.round(26 * s), Math.round(3 * s));
    // "FOUNDERS"
    g.fillRect(Math.round(14 * s), Math.round(18 * s), Math.round(22 * s), Math.round(3 * s));
    // Decorative underline
    g.fillStyle(PALETTE.bagsGreen, 0.8);
    g.fillRect(Math.round(12 * s), Math.round(24 * s), Math.round(26 * s), Math.round(2 * s));

    // Chalk dust effect
    g.fillStyle(0xffffff, 0.3);
    g.fillRect(Math.round(15 * s), Math.round(28 * s), Math.round(3 * s), Math.round(1 * s));
    g.fillRect(Math.round(25 * s), Math.round(27 * s), Math.round(2 * s), Math.round(1 * s));

    g.generateTexture("founders_chalkboard", width, height);
    g.destroy();
  }

  private generateFoundersPokemon(): void {
    const s = SCALE;

    // === CHARMANDER ===
    const charmander = this.make.graphics({ x: 0, y: 0 });
    const cWidth = Math.round(28 * s);
    const cHeight = Math.round(28 * s);

    // Body (orange)
    charmander.fillStyle(0xf97316);
    charmander.fillRect(
      Math.round(8 * s),
      Math.round(10 * s),
      Math.round(12 * s),
      Math.round(10 * s)
    );

    // Head (orange, larger)
    charmander.fillStyle(0xfb923c);
    charmander.fillCircle(Math.round(14 * s), Math.round(8 * s), Math.round(6 * s));

    // Belly (cream/yellow)
    charmander.fillStyle(0xfef3c7);
    charmander.fillRect(
      Math.round(10 * s),
      Math.round(12 * s),
      Math.round(8 * s),
      Math.round(6 * s)
    );

    // Eyes (big, cute)
    charmander.fillStyle(0x1e3a5f);
    charmander.fillRect(
      Math.round(10 * s),
      Math.round(6 * s),
      Math.round(3 * s),
      Math.round(3 * s)
    );
    charmander.fillRect(
      Math.round(15 * s),
      Math.round(6 * s),
      Math.round(3 * s),
      Math.round(3 * s)
    );
    // Eye highlights
    charmander.fillStyle(0xffffff);
    charmander.fillRect(
      Math.round(11 * s),
      Math.round(6 * s),
      Math.round(1 * s),
      Math.round(1 * s)
    );
    charmander.fillRect(
      Math.round(16 * s),
      Math.round(6 * s),
      Math.round(1 * s),
      Math.round(1 * s)
    );

    // Mouth (smile)
    charmander.fillStyle(0x000000);
    charmander.fillRect(
      Math.round(12 * s),
      Math.round(11 * s),
      Math.round(4 * s),
      Math.round(1 * s)
    );

    // Arms
    charmander.fillStyle(0xf97316);
    charmander.fillRect(
      Math.round(5 * s),
      Math.round(12 * s),
      Math.round(4 * s),
      Math.round(3 * s)
    );
    charmander.fillRect(
      Math.round(19 * s),
      Math.round(12 * s),
      Math.round(4 * s),
      Math.round(3 * s)
    );

    // Legs
    charmander.fillRect(
      Math.round(9 * s),
      Math.round(18 * s),
      Math.round(4 * s),
      Math.round(4 * s)
    );
    charmander.fillRect(
      Math.round(15 * s),
      Math.round(18 * s),
      Math.round(4 * s),
      Math.round(4 * s)
    );

    // Tail with flame
    charmander.fillStyle(0xf97316);
    charmander.fillRect(
      Math.round(18 * s),
      Math.round(14 * s),
      Math.round(6 * s),
      Math.round(3 * s)
    );
    charmander.fillRect(
      Math.round(22 * s),
      Math.round(12 * s),
      Math.round(3 * s),
      Math.round(4 * s)
    );
    // Flame (yellow-orange-red)
    charmander.fillStyle(0xfbbf24);
    charmander.fillRect(
      Math.round(23 * s),
      Math.round(8 * s),
      Math.round(4 * s),
      Math.round(5 * s)
    );
    charmander.fillStyle(0xf97316);
    charmander.fillRect(
      Math.round(24 * s),
      Math.round(6 * s),
      Math.round(2 * s),
      Math.round(4 * s)
    );
    charmander.fillStyle(0xef4444);
    charmander.fillRect(
      Math.round(24 * s),
      Math.round(4 * s),
      Math.round(2 * s),
      Math.round(3 * s)
    );

    charmander.generateTexture("pokemon_charmander", cWidth, cHeight);
    charmander.destroy();

    // === SQUIRTLE ===
    const squirtle = this.make.graphics({ x: 0, y: 0 });
    const sWidth = Math.round(28 * s);
    const sHeight = Math.round(28 * s);

    // Shell (brown back)
    squirtle.fillStyle(0x92400e);
    squirtle.fillRect(
      Math.round(7 * s),
      Math.round(10 * s),
      Math.round(14 * s),
      Math.round(12 * s)
    );
    // Shell pattern (darker center)
    squirtle.fillStyle(0x78350f);
    squirtle.fillRect(Math.round(9 * s), Math.round(12 * s), Math.round(10 * s), Math.round(8 * s));
    // Shell highlight
    squirtle.fillStyle(0xa16207);
    squirtle.fillRect(Math.round(8 * s), Math.round(11 * s), Math.round(3 * s), Math.round(2 * s));

    // Body (light blue, front)
    squirtle.fillStyle(0x7dd3fc);
    squirtle.fillRect(Math.round(9 * s), Math.round(14 * s), Math.round(10 * s), Math.round(6 * s));

    // Head (blue)
    squirtle.fillStyle(0x38bdf8);
    squirtle.fillCircle(Math.round(14 * s), Math.round(8 * s), Math.round(6 * s));

    // Eyes (big, cute)
    squirtle.fillStyle(0x7c2d12);
    squirtle.fillRect(Math.round(10 * s), Math.round(6 * s), Math.round(3 * s), Math.round(3 * s));
    squirtle.fillRect(Math.round(15 * s), Math.round(6 * s), Math.round(3 * s), Math.round(3 * s));
    // Eye highlights
    squirtle.fillStyle(0xffffff);
    squirtle.fillRect(Math.round(11 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));
    squirtle.fillRect(Math.round(16 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));

    // Mouth (smile)
    squirtle.fillStyle(0x000000);
    squirtle.fillRect(Math.round(12 * s), Math.round(11 * s), Math.round(4 * s), Math.round(1 * s));

    // Arms (blue)
    squirtle.fillStyle(0x38bdf8);
    squirtle.fillRect(Math.round(4 * s), Math.round(14 * s), Math.round(4 * s), Math.round(3 * s));
    squirtle.fillRect(Math.round(20 * s), Math.round(14 * s), Math.round(4 * s), Math.round(3 * s));

    // Legs
    squirtle.fillRect(Math.round(9 * s), Math.round(20 * s), Math.round(4 * s), Math.round(4 * s));
    squirtle.fillRect(Math.round(15 * s), Math.round(20 * s), Math.round(4 * s), Math.round(4 * s));

    // Tail (curled, blue)
    squirtle.fillStyle(0x38bdf8);
    squirtle.fillRect(Math.round(19 * s), Math.round(18 * s), Math.round(5 * s), Math.round(3 * s));
    squirtle.fillRect(Math.round(22 * s), Math.round(15 * s), Math.round(3 * s), Math.round(4 * s));
    squirtle.fillStyle(0x7dd3fc);
    squirtle.fillRect(Math.round(23 * s), Math.round(13 * s), Math.round(2 * s), Math.round(3 * s));

    squirtle.generateTexture("pokemon_squirtle", sWidth, sHeight);
    squirtle.destroy();

    // === BULBASAUR ===
    const bulbasaur = this.make.graphics({ x: 0, y: 0 });
    const bWidth = Math.round(32 * s);
    const bHeight = Math.round(28 * s);

    // Body (teal/green-blue)
    bulbasaur.fillStyle(0x5eead4);
    bulbasaur.fillRect(
      Math.round(6 * s),
      Math.round(12 * s),
      Math.round(18 * s),
      Math.round(10 * s)
    );

    // Spots on body
    bulbasaur.fillStyle(0x2dd4bf);
    bulbasaur.fillRect(Math.round(8 * s), Math.round(14 * s), Math.round(3 * s), Math.round(3 * s));
    bulbasaur.fillRect(
      Math.round(18 * s),
      Math.round(15 * s),
      Math.round(4 * s),
      Math.round(3 * s)
    );
    bulbasaur.fillRect(
      Math.round(12 * s),
      Math.round(18 * s),
      Math.round(3 * s),
      Math.round(2 * s)
    );

    // Bulb on back (green)
    bulbasaur.fillStyle(0x22c55e);
    bulbasaur.fillRect(
      Math.round(10 * s),
      Math.round(4 * s),
      Math.round(12 * s),
      Math.round(10 * s)
    );
    // Bulb highlight
    bulbasaur.fillStyle(0x4ade80);
    bulbasaur.fillRect(Math.round(11 * s), Math.round(5 * s), Math.round(4 * s), Math.round(3 * s));
    // Bulb darker parts
    bulbasaur.fillStyle(0x16a34a);
    bulbasaur.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(3 * s), Math.round(6 * s));
    // Leaves/petals
    bulbasaur.fillStyle(0x15803d);
    bulbasaur.fillTriangle(
      Math.round(12 * s),
      Math.round(4 * s),
      Math.round(16 * s),
      Math.round(-2 * s),
      Math.round(20 * s),
      Math.round(4 * s)
    );
    bulbasaur.fillTriangle(
      Math.round(8 * s),
      Math.round(6 * s),
      Math.round(6 * s),
      Math.round(0 * s),
      Math.round(14 * s),
      Math.round(6 * s)
    );

    // Head (teal, front-facing)
    bulbasaur.fillStyle(0x5eead4);
    bulbasaur.fillRect(
      Math.round(2 * s),
      Math.round(14 * s),
      Math.round(10 * s),
      Math.round(8 * s)
    );

    // Eyes (red, distinctive)
    bulbasaur.fillStyle(0xdc2626);
    bulbasaur.fillRect(Math.round(3 * s), Math.round(15 * s), Math.round(3 * s), Math.round(3 * s));
    bulbasaur.fillRect(Math.round(8 * s), Math.round(15 * s), Math.round(3 * s), Math.round(3 * s));
    // Eye highlights
    bulbasaur.fillStyle(0xffffff);
    bulbasaur.fillRect(Math.round(4 * s), Math.round(15 * s), Math.round(1 * s), Math.round(1 * s));
    bulbasaur.fillRect(Math.round(9 * s), Math.round(15 * s), Math.round(1 * s), Math.round(1 * s));
    // Pupils
    bulbasaur.fillStyle(0x000000);
    bulbasaur.fillRect(Math.round(4 * s), Math.round(17 * s), Math.round(1 * s), Math.round(1 * s));
    bulbasaur.fillRect(Math.round(9 * s), Math.round(17 * s), Math.round(1 * s), Math.round(1 * s));

    // Mouth (wide)
    bulbasaur.fillStyle(0x2dd4bf);
    bulbasaur.fillRect(Math.round(4 * s), Math.round(20 * s), Math.round(6 * s), Math.round(2 * s));

    // Ears
    bulbasaur.fillStyle(0x5eead4);
    bulbasaur.fillTriangle(
      Math.round(2 * s),
      Math.round(14 * s),
      Math.round(0 * s),
      Math.round(10 * s),
      Math.round(5 * s),
      Math.round(14 * s)
    );
    bulbasaur.fillTriangle(
      Math.round(9 * s),
      Math.round(14 * s),
      Math.round(12 * s),
      Math.round(10 * s),
      Math.round(12 * s),
      Math.round(14 * s)
    );

    // Legs (stubby)
    bulbasaur.fillStyle(0x5eead4);
    bulbasaur.fillRect(Math.round(7 * s), Math.round(20 * s), Math.round(4 * s), Math.round(4 * s));
    bulbasaur.fillRect(
      Math.round(17 * s),
      Math.round(20 * s),
      Math.round(4 * s),
      Math.round(4 * s)
    );
    // Back legs (partially visible)
    bulbasaur.fillRect(
      Math.round(12 * s),
      Math.round(21 * s),
      Math.round(3 * s),
      Math.round(3 * s)
    );
    bulbasaur.fillRect(
      Math.round(21 * s),
      Math.round(21 * s),
      Math.round(3 * s),
      Math.round(3 * s)
    );

    bulbasaur.generateTexture("pokemon_bulbasaur", bWidth, bHeight);
    bulbasaur.destroy();
  }

  // ============================================================================
  // TECH LABS ZONE ASSETS
  // Futuristic R&D headquarters - home of the Bags.fm development team
  // ============================================================================

  private generateLabsAssets(): void {
    this.generateLabsGround();
    this.generateLabsBuildings();
    this.generateLabsProps();
  }

  private generateLabsGround(): void {
    const s = SCALE;
    const size = Math.round(32 * s);
    const g = this.make.graphics({ x: 0, y: 0 });

    // Base: dark tech floor with metallic tint
    g.fillStyle(0x1a1a2e);
    g.fillRect(0, 0, size, size);

    // Grid pattern (tech floor panels)
    const panelSize = Math.round(15 * s);
    const gap = Math.round(1 * s);

    // 2x2 panel grid
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const px = gap + col * (panelSize + gap);
        const py = gap + row * (panelSize + gap);

        // Panel base
        g.fillStyle(0x16213e);
        g.fillRect(px, py, panelSize, panelSize);

        // Panel highlight (top-left edge glow)
        g.fillStyle(0x22d3ee, 0.3);
        g.fillRect(px, py, panelSize, Math.round(1 * s));
        g.fillRect(px, py, Math.round(1 * s), panelSize);

        // Panel shadow (bottom-right)
        g.fillStyle(0x0a0a0f, 0.5);
        g.fillRect(px, py + panelSize - Math.round(1 * s), panelSize, Math.round(1 * s));
        g.fillRect(px + panelSize - Math.round(1 * s), py, Math.round(1 * s), panelSize);
      }
    }

    // Circuit trace accent (random tech detail)
    g.fillStyle(0x06b6d4, 0.4);
    g.fillRect(Math.round(5 * s), Math.round(16 * s), Math.round(8 * s), Math.round(1 * s));
    g.fillRect(Math.round(12 * s), Math.round(16 * s), Math.round(1 * s), Math.round(5 * s));

    // Glowing node
    g.fillStyle(0x22d3ee, 0.6);
    g.fillRect(Math.round(24 * s), Math.round(8 * s), Math.round(2 * s), Math.round(2 * s));

    g.generateTexture("labs_ground", size, size);
    g.destroy();
  }

  private generateLabsBuildings(): void {
    const s = SCALE;

    // Building 0: Server Room (tall cylindrical server tower)
    this.generateLabsServerRoom(s);

    // Building 1: Research Lab (dome with antennas)
    this.generateLabsResearchLab(s);

    // Building 2: Holo Deck (glass cube with holographic elements)
    this.generateLabsHoloDeck(s);
  }

  private generateLabsServerRoom(s: number): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const canvasW = Math.round(70 * s);
    const canvasH = Math.round(160 * s);
    const bWidth = Math.round(55 * s);
    const bHeight = Math.round(110 * s);
    const baseX = Math.round(8 * s);
    const baseY = canvasH - bHeight;

    // Colors
    const metalBase = 0x374151;
    const metalLight = lighten(metalBase, 0.15);
    const metalDark = darken(metalBase, 0.25);
    const accent = 0x06b6d4; // Cyan
    const glow = 0x22d3ee;

    // Drop shadow
    g.fillStyle(PALETTE.void, 0.5);
    g.fillRect(baseX + Math.round(5 * s), baseY + Math.round(5 * s), bWidth, bHeight);

    // Main body (metallic server tower)
    g.fillStyle(metalBase);
    g.fillRect(baseX, baseY, bWidth, bHeight);

    // 3D depth: Light left edge
    g.fillStyle(metalLight);
    g.fillRect(baseX, baseY, Math.round(6 * s), bHeight);

    // 3D depth: Dark right edge
    g.fillStyle(metalDark);
    g.fillRect(baseX + bWidth - Math.round(6 * s), baseY, Math.round(6 * s), bHeight);

    // Horizontal server rack lines
    g.fillStyle(metalDark);
    for (let i = 1; i < 8; i++) {
      const lineY = baseY + Math.round(12 * s) * i;
      g.fillRect(baseX + Math.round(6 * s), lineY, bWidth - Math.round(12 * s), Math.round(2 * s));
    }

    // Server status lights (blinking indicators)
    const lightColors = [0x22c55e, 0xfbbf24, 0x22c55e, 0x06b6d4, 0x22c55e, 0xef4444, 0x22c55e];
    lightColors.forEach((color, i) => {
      const ly = baseY + Math.round(8 * s) + i * Math.round(12 * s);
      // LED glow
      g.fillStyle(color, 0.4);
      g.fillRect(baseX + Math.round(10 * s), ly, Math.round(8 * s), Math.round(6 * s));
      // LED core
      g.fillStyle(color);
      g.fillRect(baseX + Math.round(12 * s), ly + Math.round(1 * s), Math.round(4 * s), Math.round(4 * s));
    });

    // Data port indicators (right side)
    for (let i = 0; i < 7; i++) {
      const py = baseY + Math.round(8 * s) + i * Math.round(12 * s);
      g.fillStyle(accent, 0.5);
      g.fillRect(baseX + bWidth - Math.round(18 * s), py, Math.round(6 * s), Math.round(6 * s));
      g.fillStyle(glow);
      g.fillRect(baseX + bWidth - Math.round(16 * s), py + Math.round(2 * s), Math.round(2 * s), Math.round(2 * s));
    }

    // Roof - flat with antenna array
    const roofY = baseY - Math.round(8 * s);
    g.fillStyle(metalDark);
    g.fillRect(baseX - Math.round(3 * s), roofY, bWidth + Math.round(6 * s), Math.round(10 * s));
    g.fillStyle(metalLight);
    g.fillRect(baseX - Math.round(3 * s), roofY, bWidth + Math.round(6 * s), Math.round(2 * s));

    // Main antenna
    const centerX = baseX + bWidth / 2;
    g.fillStyle(PALETTE.lightGray);
    g.fillRect(centerX - Math.round(2 * s), roofY - Math.round(30 * s), Math.round(4 * s), Math.round(32 * s));

    // Antenna light (blinking red)
    g.fillStyle(0xef4444, 0.6);
    g.fillCircle(centerX, roofY - Math.round(32 * s), Math.round(5 * s));
    g.fillStyle(0xef4444);
    g.fillCircle(centerX, roofY - Math.round(32 * s), Math.round(3 * s));

    // Side antennas
    g.fillStyle(PALETTE.silver);
    g.fillRect(baseX + Math.round(8 * s), roofY - Math.round(15 * s), Math.round(2 * s), Math.round(17 * s));
    g.fillRect(baseX + bWidth - Math.round(10 * s), roofY - Math.round(15 * s), Math.round(2 * s), Math.round(17 * s));

    // Door (tech panel door)
    const doorW = Math.round(18 * s);
    const doorH = Math.round(26 * s);
    const doorX = centerX - doorW / 2;
    const doorY = canvasH - doorH;

    // Door frame (glowing cyan outline)
    g.fillStyle(accent, 0.5);
    g.fillRect(doorX - Math.round(3 * s), doorY - Math.round(3 * s), doorW + Math.round(6 * s), doorH + Math.round(3 * s));

    // Door panel
    g.fillStyle(0x1f2937);
    g.fillRect(doorX, doorY, doorW, doorH);

    // Door glow line
    g.fillStyle(glow);
    g.fillRect(doorX + doorW / 2 - Math.round(1 * s), doorY, Math.round(2 * s), doorH);

    // Access panel
    g.fillStyle(accent);
    g.fillRect(doorX + doorW - Math.round(6 * s), doorY + Math.round(10 * s), Math.round(4 * s), Math.round(6 * s));

    // "SERVER" label area
    g.fillStyle(0x1f2937);
    g.fillRect(baseX + Math.round(8 * s), baseY + bHeight - Math.round(38 * s), bWidth - Math.round(16 * s), Math.round(10 * s));
    g.fillStyle(accent);
    g.fillRect(baseX + Math.round(12 * s), baseY + bHeight - Math.round(36 * s), bWidth - Math.round(24 * s), Math.round(6 * s));

    g.generateTexture("labs_0", canvasW, canvasH);
    g.destroy();
  }

  private generateLabsResearchLab(s: number): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const canvasW = Math.round(80 * s);
    const canvasH = Math.round(150 * s);
    const bWidth = Math.round(65 * s);
    const bHeight = Math.round(85 * s);
    const baseX = Math.round(8 * s);
    const baseY = canvasH - bHeight;
    const centerX = baseX + bWidth / 2;

    // Colors
    const wallBase = 0x1e3a5f; // Deep tech blue
    const wallLight = lighten(wallBase, 0.15);
    const wallDark = darken(wallBase, 0.2);
    const accent = 0x8b5cf6; // Purple (R&D theme)
    const glow = 0xa855f7;
    const windowColor = 0x22d3ee;

    // Drop shadow
    g.fillStyle(PALETTE.void, 0.5);
    g.fillRect(baseX + Math.round(5 * s), baseY + Math.round(5 * s), bWidth, bHeight);

    // Main body
    g.fillStyle(wallBase);
    g.fillRect(baseX, baseY, bWidth, bHeight);

    // 3D depth
    g.fillStyle(wallLight);
    g.fillRect(baseX, baseY, Math.round(5 * s), bHeight);
    g.fillStyle(wallDark);
    g.fillRect(baseX + bWidth - Math.round(5 * s), baseY, Math.round(5 * s), bHeight);

    // Dithering texture
    g.fillStyle(darken(wallBase, 0.08));
    for (let py = 0; py < bHeight; py += Math.round(6 * s)) {
      for (let px = Math.round(6 * s); px < bWidth - Math.round(6 * s); px += Math.round(10 * s)) {
        if ((Math.floor(py / Math.round(6 * s)) + Math.floor(px / Math.round(10 * s))) % 2 === 0) {
          g.fillRect(baseX + px, baseY + py, Math.round(8 * s), Math.round(4 * s));
        }
      }
    }

    // Dome roof
    const domeY = baseY - Math.round(10 * s);
    g.fillStyle(accent, 0.8);
    g.fillCircle(centerX, domeY + Math.round(8 * s), Math.round(28 * s));
    // Dome highlight
    g.fillStyle(glow, 0.4);
    g.fillCircle(centerX - Math.round(8 * s), domeY - Math.round(5 * s), Math.round(12 * s));
    // Dome slit (observatory style)
    g.fillStyle(wallDark);
    g.fillRect(centerX - Math.round(2 * s), domeY - Math.round(18 * s), Math.round(4 * s), Math.round(22 * s));

    // Roof base
    g.fillStyle(wallDark);
    g.fillRect(baseX - Math.round(3 * s), baseY - Math.round(6 * s), bWidth + Math.round(6 * s), Math.round(8 * s));

    // Windows (hexagonal sci-fi style) - 2 rows
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const wx = baseX + Math.round(10 * s) + col * Math.round(26 * s);
        const wy = baseY + Math.round(12 * s) + row * Math.round(28 * s);
        const winW = Math.round(18 * s);
        const winH = Math.round(20 * s);

        // Window glow
        g.fillStyle(windowColor, 0.25);
        g.fillRect(wx - Math.round(2 * s), wy - Math.round(2 * s), winW + Math.round(4 * s), winH + Math.round(4 * s));

        // Window glass
        g.fillStyle(windowColor, 0.7);
        g.fillRect(wx, wy, winW, winH);

        // Window highlight
        g.fillStyle(lighten(windowColor, 0.4));
        g.fillRect(wx, wy, Math.round(4 * s), Math.round(5 * s));

        // Tech frame lines
        g.fillStyle(accent);
        g.fillRect(wx + winW / 2 - Math.round(1 * s), wy, Math.round(2 * s), winH);
        g.fillRect(wx, wy + winH / 2 - Math.round(1 * s), winW, Math.round(2 * s));
      }
    }

    // Lab equipment through windows (glowing samples)
    g.fillStyle(0x22c55e, 0.6);
    g.fillRect(baseX + Math.round(15 * s), baseY + Math.round(22 * s), Math.round(4 * s), Math.round(6 * s));
    g.fillStyle(0xfbbf24, 0.6);
    g.fillRect(baseX + Math.round(40 * s), baseY + Math.round(48 * s), Math.round(4 * s), Math.round(6 * s));

    // Door
    const doorW = Math.round(16 * s);
    const doorH = Math.round(24 * s);
    const doorX = centerX - doorW / 2;
    const doorY = canvasH - doorH;

    // Door frame
    g.fillStyle(accent);
    g.fillRect(doorX - Math.round(2 * s), doorY - Math.round(2 * s), doorW + Math.round(4 * s), doorH + Math.round(2 * s));

    // Door panel (sliding)
    g.fillStyle(0x1f2937);
    g.fillRect(doorX, doorY, doorW, doorH);

    // Door window
    g.fillStyle(windowColor, 0.5);
    g.fillRect(doorX + Math.round(3 * s), doorY + Math.round(3 * s), doorW - Math.round(6 * s), Math.round(10 * s));

    // Bio-hazard symbol area (research lab indicator)
    g.fillStyle(0x1f2937);
    g.fillRect(baseX + Math.round(10 * s), baseY + Math.round(68 * s), Math.round(16 * s), Math.round(12 * s));
    g.fillStyle(glow);
    g.fillCircle(baseX + Math.round(18 * s), baseY + Math.round(74 * s), Math.round(4 * s));

    g.generateTexture("labs_1", canvasW, canvasH);
    g.destroy();
  }

  private generateLabsHoloDeck(s: number): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const canvasW = Math.round(85 * s);
    const canvasH = Math.round(140 * s);
    const bWidth = Math.round(70 * s);
    const bHeight = Math.round(75 * s);
    const baseX = Math.round(8 * s);
    const baseY = canvasH - bHeight;
    const centerX = baseX + bWidth / 2;

    // Colors (glass/holographic theme)
    const glassBase = 0x0ea5e9; // Sky blue
    const frameColor = 0x374151;
    const accent = 0x22d3ee; // Cyan
    const holoGlow = 0x06b6d4;

    // Drop shadow
    g.fillStyle(PALETTE.void, 0.5);
    g.fillRect(baseX + Math.round(5 * s), baseY + Math.round(5 * s), bWidth, bHeight);

    // Main body (glass cube effect)
    g.fillStyle(glassBase, 0.4);
    g.fillRect(baseX, baseY, bWidth, bHeight);

    // Frame edges
    g.fillStyle(frameColor);
    // Vertical edges
    g.fillRect(baseX, baseY, Math.round(4 * s), bHeight);
    g.fillRect(baseX + bWidth - Math.round(4 * s), baseY, Math.round(4 * s), bHeight);
    // Horizontal edges
    g.fillRect(baseX, baseY, bWidth, Math.round(4 * s));
    g.fillRect(baseX, baseY + bHeight - Math.round(4 * s), bWidth, Math.round(4 * s));

    // Grid lines on glass (holodeck pattern)
    g.fillStyle(accent, 0.3);
    for (let i = 1; i < 4; i++) {
      // Horizontal
      g.fillRect(baseX + Math.round(4 * s), baseY + i * Math.round(18 * s), bWidth - Math.round(8 * s), Math.round(1 * s));
      // Vertical
      g.fillRect(baseX + i * Math.round(17 * s), baseY + Math.round(4 * s), Math.round(1 * s), bHeight - Math.round(8 * s));
    }

    // Holographic projection inside (abstract shape)
    g.fillStyle(holoGlow, 0.5);
    g.fillCircle(centerX, baseY + bHeight / 2, Math.round(18 * s));
    g.fillStyle(accent, 0.7);
    g.fillCircle(centerX, baseY + bHeight / 2, Math.round(12 * s));
    // Hologram scan lines
    g.fillStyle(0xffffff, 0.3);
    for (let i = -3; i < 4; i++) {
      g.fillRect(centerX - Math.round(15 * s), baseY + bHeight / 2 + i * Math.round(4 * s), Math.round(30 * s), Math.round(1 * s));
    }

    // Roof - glass pyramid
    const roofPeakY = baseY - Math.round(25 * s);
    // Pyramid faces (translucent)
    g.fillStyle(glassBase, 0.5);
    g.fillTriangle(baseX, baseY, centerX, roofPeakY, baseX + bWidth, baseY);
    // Pyramid edge highlight
    g.fillStyle(accent, 0.4);
    g.fillTriangle(baseX, baseY, centerX, roofPeakY, centerX, baseY);

    // Glowing apex
    g.fillStyle(holoGlow, 0.6);
    g.fillCircle(centerX, roofPeakY, Math.round(6 * s));
    g.fillStyle(0xffffff);
    g.fillCircle(centerX, roofPeakY, Math.round(3 * s));

    // Frame on pyramid
    g.fillStyle(frameColor);
    g.fillRect(centerX - Math.round(1 * s), roofPeakY, Math.round(2 * s), baseY - roofPeakY);

    // Door (automatic sliding door)
    const doorW = Math.round(20 * s);
    const doorH = Math.round(22 * s);
    const doorX = centerX - doorW / 2;
    const doorY = canvasH - doorH;

    // Door frame
    g.fillStyle(frameColor);
    g.fillRect(doorX - Math.round(3 * s), doorY - Math.round(3 * s), doorW + Math.round(6 * s), doorH + Math.round(3 * s));

    // Door panels (split in middle)
    g.fillStyle(glassBase, 0.6);
    g.fillRect(doorX, doorY, doorW / 2 - Math.round(1 * s), doorH);
    g.fillRect(doorX + doorW / 2 + Math.round(1 * s), doorY, doorW / 2 - Math.round(1 * s), doorH);

    // Door sensor
    g.fillStyle(0x22c55e);
    g.fillRect(doorX + doorW / 2 - Math.round(2 * s), doorY - Math.round(6 * s), Math.round(4 * s), Math.round(3 * s));

    // Control panel beside door
    g.fillStyle(frameColor);
    g.fillRect(baseX + bWidth - Math.round(12 * s), baseY + bHeight - Math.round(18 * s), Math.round(8 * s), Math.round(12 * s));
    g.fillStyle(accent, 0.8);
    g.fillRect(baseX + bWidth - Math.round(10 * s), baseY + bHeight - Math.round(16 * s), Math.round(4 * s), Math.round(8 * s));

    g.generateTexture("labs_2", canvasW, canvasH);
    g.destroy();
  }

  private generateLabsProps(): void {
    const s = SCALE;

    // Prop 0: Holographic Display Stand
    this.generateLabsHoloDisplay(s);

    // Prop 1: Tech Tree (digital/circuit tree)
    this.generateLabsTechTree(s);

    // Prop 2: Server Rack (small)
    this.generateLabsServerRack(s);

    // Prop 3: Data Terminal
    this.generateLabsDataTerminal(s);

    // Prop 4: Energy Core
    this.generateLabsEnergyCore(s);

    // Prop 5: Drone Dock
    this.generateLabsDroneDock(s);
  }

  private generateLabsHoloDisplay(s: number): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const w = Math.round(30 * s);
    const h = Math.round(50 * s);

    // Base stand
    g.fillStyle(0x374151);
    g.fillRect(Math.round(10 * s), h - Math.round(8 * s), Math.round(10 * s), Math.round(8 * s));

    // Pole
    g.fillStyle(0x4b5563);
    g.fillRect(Math.round(13 * s), Math.round(15 * s), Math.round(4 * s), h - Math.round(23 * s));

    // Holographic display (floating rectangle)
    g.fillStyle(0x06b6d4, 0.4);
    g.fillRect(Math.round(3 * s), Math.round(5 * s), Math.round(24 * s), Math.round(18 * s));
    g.fillStyle(0x22d3ee, 0.7);
    g.fillRect(Math.round(5 * s), Math.round(7 * s), Math.round(20 * s), Math.round(14 * s));

    // Display content (data visualization)
    g.fillStyle(0xffffff, 0.6);
    g.fillRect(Math.round(7 * s), Math.round(9 * s), Math.round(4 * s), Math.round(8 * s));
    g.fillRect(Math.round(13 * s), Math.round(11 * s), Math.round(4 * s), Math.round(6 * s));
    g.fillRect(Math.round(19 * s), Math.round(10 * s), Math.round(4 * s), Math.round(7 * s));

    // Glow effect at base
    g.fillStyle(0x06b6d4, 0.3);
    g.fillCircle(Math.round(15 * s), Math.round(15 * s), Math.round(6 * s));

    g.generateTexture("labs_prop_0", w, h);
    g.destroy();
  }

  private generateLabsTechTree(s: number): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const w = Math.round(40 * s);
    const h = Math.round(70 * s);
    const centerX = w / 2;

    // Trunk (metallic/circuit pattern)
    g.fillStyle(0x4b5563);
    g.fillRect(centerX - Math.round(3 * s), Math.round(30 * s), Math.round(6 * s), Math.round(40 * s));

    // Circuit lines on trunk
    g.fillStyle(0x06b6d4);
    g.fillRect(centerX - Math.round(1 * s), Math.round(35 * s), Math.round(2 * s), Math.round(30 * s));

    // Digital foliage (geometric shapes with glow)
    const nodePositions = [
      { x: centerX, y: Math.round(12 * s), size: Math.round(14 * s) },
      { x: centerX - Math.round(12 * s), y: Math.round(22 * s), size: Math.round(10 * s) },
      { x: centerX + Math.round(12 * s), y: Math.round(20 * s), size: Math.round(11 * s) },
      { x: centerX - Math.round(8 * s), y: Math.round(35 * s), size: Math.round(8 * s) },
      { x: centerX + Math.round(10 * s), y: Math.round(32 * s), size: Math.round(9 * s) },
    ];

    nodePositions.forEach((node, i) => {
      // Glow
      g.fillStyle(0x22d3ee, 0.3);
      g.fillCircle(node.x, node.y, node.size + Math.round(3 * s));
      // Node
      g.fillStyle(i === 0 ? 0x06b6d4 : 0x0891b2);
      g.fillCircle(node.x, node.y, node.size);
      // Inner highlight
      g.fillStyle(0x67e8f9, 0.6);
      g.fillCircle(node.x - Math.round(2 * s), node.y - Math.round(2 * s), node.size * 0.4);
    });

    // Connection lines between nodes
    g.fillStyle(0x06b6d4, 0.5);
    g.fillRect(centerX - Math.round(1 * s), Math.round(12 * s), Math.round(2 * s), Math.round(18 * s));
    g.fillRect(centerX - Math.round(12 * s), Math.round(22 * s), Math.round(12 * s), Math.round(2 * s));
    g.fillRect(centerX, Math.round(20 * s), Math.round(12 * s), Math.round(2 * s));

    // Base planter (tech pot)
    g.fillStyle(0x374151);
    g.fillRect(centerX - Math.round(8 * s), h - Math.round(8 * s), Math.round(16 * s), Math.round(8 * s));
    g.fillStyle(0x06b6d4, 0.4);
    g.fillRect(centerX - Math.round(6 * s), h - Math.round(6 * s), Math.round(12 * s), Math.round(2 * s));

    g.generateTexture("labs_prop_1", w, h);
    g.destroy();
  }

  private generateLabsServerRack(s: number): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const w = Math.round(25 * s);
    const h = Math.round(45 * s);

    // Rack frame
    g.fillStyle(0x374151);
    g.fillRect(Math.round(2 * s), Math.round(5 * s), Math.round(21 * s), Math.round(38 * s));

    // Rack front panel
    g.fillStyle(0x1f2937);
    g.fillRect(Math.round(4 * s), Math.round(7 * s), Math.round(17 * s), Math.round(34 * s));

    // Server slots with LEDs
    for (let i = 0; i < 5; i++) {
      const slotY = Math.round(9 * s) + i * Math.round(6 * s);
      // Slot
      g.fillStyle(0x111827);
      g.fillRect(Math.round(5 * s), slotY, Math.round(15 * s), Math.round(5 * s));
      // LED
      const ledColor = i % 2 === 0 ? 0x22c55e : 0x06b6d4;
      g.fillStyle(ledColor, 0.6);
      g.fillRect(Math.round(6 * s), slotY + Math.round(1 * s), Math.round(3 * s), Math.round(3 * s));
      g.fillStyle(ledColor);
      g.fillRect(Math.round(7 * s), slotY + Math.round(2 * s), Math.round(1 * s), Math.round(1 * s));
    }

    // Ventilation at top
    g.fillStyle(0x111827);
    for (let i = 0; i < 4; i++) {
      g.fillRect(Math.round(6 * s) + i * Math.round(4 * s), Math.round(38 * s), Math.round(2 * s), Math.round(2 * s));
    }

    g.generateTexture("labs_prop_2", w, h);
    g.destroy();
  }

  private generateLabsDataTerminal(s: number): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const w = Math.round(28 * s);
    const h = Math.round(40 * s);

    // Terminal base
    g.fillStyle(0x374151);
    g.fillRect(Math.round(4 * s), h - Math.round(10 * s), Math.round(20 * s), Math.round(10 * s));

    // Stand
    g.fillStyle(0x4b5563);
    g.fillRect(Math.round(11 * s), Math.round(18 * s), Math.round(6 * s), Math.round(14 * s));

    // Screen frame
    g.fillStyle(0x1f2937);
    g.fillRect(Math.round(2 * s), Math.round(3 * s), Math.round(24 * s), Math.round(18 * s));

    // Screen
    g.fillStyle(0x0f172a);
    g.fillRect(Math.round(4 * s), Math.round(5 * s), Math.round(20 * s), Math.round(14 * s));

    // Screen content (terminal text)
    g.fillStyle(0x22c55e);
    g.fillRect(Math.round(6 * s), Math.round(7 * s), Math.round(12 * s), Math.round(2 * s));
    g.fillRect(Math.round(6 * s), Math.round(11 * s), Math.round(8 * s), Math.round(2 * s));
    g.fillRect(Math.round(6 * s), Math.round(15 * s), Math.round(14 * s), Math.round(2 * s));

    // Blinking cursor
    g.fillStyle(0x22c55e, 0.8);
    g.fillRect(Math.round(20 * s), Math.round(15 * s), Math.round(2 * s), Math.round(2 * s));

    // Power indicator
    g.fillStyle(0x06b6d4);
    g.fillRect(Math.round(22 * s), Math.round(7 * s), Math.round(2 * s), Math.round(2 * s));

    g.generateTexture("labs_prop_3", w, h);
    g.destroy();
  }

  private generateLabsEnergyCore(s: number): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const w = Math.round(35 * s);
    const h = Math.round(55 * s);
    const centerX = w / 2;

    // Base platform
    g.fillStyle(0x374151);
    g.fillRect(Math.round(5 * s), h - Math.round(8 * s), Math.round(25 * s), Math.round(8 * s));

    // Energy containment ring
    g.fillStyle(0x1f2937);
    g.fillRect(Math.round(8 * s), Math.round(25 * s), Math.round(19 * s), Math.round(22 * s));

    // Outer glow
    g.fillStyle(0x8b5cf6, 0.3);
    g.fillCircle(centerX, Math.round(28 * s), Math.round(14 * s));

    // Energy core (pulsing orb)
    g.fillStyle(0x8b5cf6, 0.6);
    g.fillCircle(centerX, Math.round(28 * s), Math.round(10 * s));
    g.fillStyle(0xa855f7);
    g.fillCircle(centerX, Math.round(28 * s), Math.round(7 * s));
    g.fillStyle(0xc4b5fd);
    g.fillCircle(centerX, Math.round(28 * s), Math.round(4 * s));
    g.fillStyle(0xffffff);
    g.fillCircle(centerX - Math.round(2 * s), Math.round(26 * s), Math.round(2 * s));

    // Energy beams shooting up
    g.fillStyle(0x8b5cf6, 0.5);
    g.fillRect(centerX - Math.round(1 * s), Math.round(5 * s), Math.round(2 * s), Math.round(18 * s));
    g.fillStyle(0xa855f7, 0.3);
    g.fillRect(centerX - Math.round(3 * s), Math.round(8 * s), Math.round(6 * s), Math.round(12 * s));

    // Side conduits
    g.fillStyle(0x4b5563);
    g.fillRect(Math.round(3 * s), Math.round(20 * s), Math.round(5 * s), Math.round(25 * s));
    g.fillRect(Math.round(27 * s), Math.round(20 * s), Math.round(5 * s), Math.round(25 * s));

    // Conduit lights
    g.fillStyle(0x8b5cf6);
    g.fillRect(Math.round(4 * s), Math.round(25 * s), Math.round(3 * s), Math.round(3 * s));
    g.fillRect(Math.round(4 * s), Math.round(35 * s), Math.round(3 * s), Math.round(3 * s));
    g.fillRect(Math.round(28 * s), Math.round(25 * s), Math.round(3 * s), Math.round(3 * s));
    g.fillRect(Math.round(28 * s), Math.round(35 * s), Math.round(3 * s), Math.round(3 * s));

    g.generateTexture("labs_prop_4", w, h);
    g.destroy();
  }

  private generateLabsDroneDock(s: number): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const w = Math.round(32 * s);
    const h = Math.round(35 * s);
    const centerX = w / 2;

    // Landing pad base
    g.fillStyle(0x374151);
    g.fillRect(Math.round(4 * s), h - Math.round(6 * s), Math.round(24 * s), Math.round(6 * s));

    // Pad marking (H pattern)
    g.fillStyle(0x06b6d4);
    g.fillRect(Math.round(8 * s), h - Math.round(5 * s), Math.round(2 * s), Math.round(4 * s));
    g.fillRect(Math.round(22 * s), h - Math.round(5 * s), Math.round(2 * s), Math.round(4 * s));
    g.fillRect(Math.round(8 * s), h - Math.round(4 * s), Math.round(16 * s), Math.round(2 * s));

    // Drone body
    g.fillStyle(0x4b5563);
    g.fillRect(Math.round(10 * s), Math.round(12 * s), Math.round(12 * s), Math.round(8 * s));

    // Drone rotors (4 corners)
    g.fillStyle(0x6b7280);
    g.fillCircle(Math.round(8 * s), Math.round(10 * s), Math.round(4 * s));
    g.fillCircle(Math.round(24 * s), Math.round(10 * s), Math.round(4 * s));
    g.fillCircle(Math.round(8 * s), Math.round(22 * s), Math.round(4 * s));
    g.fillCircle(Math.round(24 * s), Math.round(22 * s), Math.round(4 * s));

    // Rotor blur effect
    g.fillStyle(0x9ca3af, 0.3);
    g.fillCircle(Math.round(8 * s), Math.round(10 * s), Math.round(6 * s));
    g.fillCircle(Math.round(24 * s), Math.round(10 * s), Math.round(6 * s));

    // Drone camera/sensor
    g.fillStyle(0x22c55e);
    g.fillRect(centerX - Math.round(2 * s), Math.round(18 * s), Math.round(4 * s), Math.round(3 * s));

    // Status light
    g.fillStyle(0x06b6d4);
    g.fillRect(centerX - Math.round(1 * s), Math.round(13 * s), Math.round(2 * s), Math.round(2 * s));

    g.generateTexture("labs_prop_5", w, h);
    g.destroy();
  }
}
