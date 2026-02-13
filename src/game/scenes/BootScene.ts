import * as Phaser from "phaser";
import {
  generateCoreAssets,
  generateBuildings,
  generateSpecialBuildings,
  generateMansions,
  generateBallersProps,
  generateAcademyBuildings,
  generateDiverseCharacters,
  generateTeamCharacters,
  generateWeatherAssets,
  generateUIAssets,
  generateDecorations,
  generateAnimals,
  generateExtraDecorations,
  generateAmbientParticles,
  generateLaunchPadAssets,
  generateFoundersAssets,
  generateLabsAssets,
  generateMoltbookAssets,
  generateDungeonAssets,
  generateAscensionAssets,
  generateArenaSprites,
  exportAgentSprites,
} from "../textures";

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
    // Generate enhanced grass with flowers and path tiles
    generateCoreAssets(this);

    // Generate diverse buildings (levels 1-5)
    generateBuildings(this);

    // Generate special buildings (PokeCenter, TradingGym, Casino, Terminal, Oracle, HQ)
    generateSpecialBuildings(this);

    // Generate Ballers Valley mansions (for top BagsWorld token holders)
    generateMansions(this);

    // Generate Ballers Valley luxury props (gold fountain, lamps, topiaries, etc.)
    generateBallersProps(this);

    // Generate Academy zone buildings (Hogwarts-style campus)
    generateAcademyBuildings(this);

    // Generate diverse character variants
    generateDiverseCharacters(this);

    // Generate team character sprites
    generateTeamCharacters(this);

    // Generate weather particles
    generateWeatherAssets(this);

    // Generate UI elements
    generateUIAssets(this);

    // Generate trees and decorations
    generateDecorations(this);

    // Generate animals
    generateAnimals(this);

    // Generate extra decorations (flowers, rocks, fountain, etc.)
    generateExtraDecorations(this);

    // Generate ambient particles
    generateAmbientParticles(this);

    // Generate Launch Pad zone assets (NYC Times Square style)
    generateLaunchPadAssets(this);

    // Generate Founder's Corner zone assets (cozy workshop/educational hub)
    generateFoundersAssets(this);

    // Generate Tech Labs zone assets (futuristic R&D headquarters)
    generateLabsAssets(this);

    // Generate Moltbook Beach zone assets (tropical beach for AI agents)
    generateMoltbookAssets(this);

    // Generate BagsDungeon zone assets (dark cave dungeon MMORPG entrance)
    generateDungeonAssets(this);

    // Generate Ascension zone assets (cloud platforms, hall, shrine, crystals)
    generateAscensionAssets(this);

    // Generate Arena combat sprites
    generateArenaSprites(this);
  }

  // Call window.exportAgentSprites() from browser console to download all agent PNGs
  public exportAgentSprites(): void {
    exportAgentSprites(this);
  }
}
