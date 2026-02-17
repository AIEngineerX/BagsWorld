import * as Phaser from "phaser";
import { ARCADE_WIDTH, ARCADE_HEIGHT, CHARACTER_STATS, type ArcadeCharacter } from "./types";

const LIST_START_Y = 125;

const FLAVORS: Record<ArcadeCharacter, string> = {
  ghost: "Community leader. Balanced fighter with reliable firepower.",
  neo: "Fastest agent. Dodges bullets but fragile.",
  cj: "Heavy hitter. Slow but devastating fire rate.",
};

export class ArcadeMenuScene extends Phaser.Scene {
  private selectedIndex = 0;
  private characters: ArcadeCharacter[] = ["ghost", "neo", "cj"];

  // Left panel
  private previewSprite?: Phaser.GameObjects.Sprite;
  private previewAnimTimer = 0;
  private previewAnimFrame = 0;

  // Right panel
  private portraitSprite?: Phaser.GameObjects.Sprite;
  private nameTexts: Phaser.GameObjects.Text[] = [];
  private flavorText?: Phaser.GameObjects.Text;
  private hpBar?: Phaser.GameObjects.Graphics;
  private spdBar?: Phaser.GameObjects.Graphics;
  private fireBar?: Phaser.GameObjects.Graphics;

  // Selection
  private selectArrow?: Phaser.GameObjects.Text;

  // Stat reference values
  private maxHP = 0;
  private maxSpeed = 0;
  private minFireRate = 0;
  private readonly barWidth = 50;
  private readonly barStartY = 185;

  constructor() {
    super({ key: "ArcadeMenuScene" });
  }

  create(): void {
    this.selectedIndex = 0;
    this.previewAnimTimer = 0;
    this.previewAnimFrame = 0;
    this.nameTexts = [];

    // Precompute stat reference values
    this.maxHP = Math.max(...this.characters.map((c) => CHARACTER_STATS[c].maxHP));
    this.maxSpeed = Math.max(...this.characters.map((c) => CHARACTER_STATS[c].speed));
    this.minFireRate = Math.min(...this.characters.map((c) => CHARACTER_STATS[c].fireRate));

    this.cameras.main.setBackgroundColor("#0f172a");

    // --- Title with pulse ---
    const title = this.add
      .text(ARCADE_WIDTH / 2, 30, "METAL BAGS", {
        fontFamily: "monospace",
        fontSize: "24px",
        color: "#4ade80",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: title,
      scaleX: 1.03,
      scaleY: 1.03,
      duration: 2000,
      yoyo: true,
      repeat: -1,
    });

    // Decorative divider
    const divider = this.add.graphics();
    divider.lineStyle(1, 0x4ade80, 0.5);
    divider.lineBetween(ARCADE_WIDTH / 2 - 80, 48, ARCADE_WIDTH / 2 + 80, 48);

    this.add
      .text(ARCADE_WIDTH / 2, 56, "SELECT YOUR FIGHTER", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#9ca3af",
      })
      .setOrigin(0.5);

    // --- Left panel: Large character preview (4x scale, animated idle) ---
    this.previewSprite = this.add.sprite(100, 150, `${this.characters[0]}_idle_1`);
    this.previewSprite.setScale(4);

    // --- Right panel: Portrait ---
    this.portraitSprite = this.add.sprite(280, 100, `${this.characters[0]}_portrait`);
    this.portraitSprite.setScale(2);

    // Character name list
    const listStartY = LIST_START_Y;
    this.characters.forEach((char, i) => {
      const stats = CHARACTER_STATS[char];
      const y = listStartY + i * 18;

      const text = this.add.text(260, y, stats.name.toUpperCase(), {
        fontFamily: "monospace",
        fontSize: "10px",
        color: i === 0 ? "#4ade80" : "#6b7280",
      });
      this.nameTexts.push(text);
    });

    // Selection arrow with oscillation
    this.selectArrow = this.add.text(248, listStartY, ">", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#4ade80",
    });
    this.tweens.add({
      targets: this.selectArrow,
      x: 251,
      duration: 300,
      yoyo: true,
      repeat: -1,
    });

    // --- Stat bars ---
    // Labels
    this.add.text(260, this.barStartY, "HP", {
      fontFamily: "monospace",
      fontSize: "7px",
      color: "#ef4444",
    });
    this.add.text(260, this.barStartY + 12, "SPD", {
      fontFamily: "monospace",
      fontSize: "7px",
      color: "#22d3ee",
    });
    this.add.text(260, this.barStartY + 24, "FIRE", {
      fontFamily: "monospace",
      fontSize: "7px",
      color: "#fde047",
    });

    // Bar backgrounds
    const barBg = this.add.graphics();
    barBg.fillStyle(0x1e293b);
    barBg.fillRect(288, this.barStartY, this.barWidth, 6);
    barBg.fillRect(288, this.barStartY + 12, this.barWidth, 6);
    barBg.fillRect(288, this.barStartY + 24, this.barWidth, 6);

    // Bar fills
    this.hpBar = this.add.graphics();
    this.spdBar = this.add.graphics();
    this.fireBar = this.add.graphics();

    // Flavor text
    this.flavorText = this.add.text(260, this.barStartY + 38, "", {
      fontFamily: "monospace",
      fontSize: "6px",
      color: "#4b5563",
      wordWrap: { width: 120 },
    });

    this.updateCharacterDisplay();

    // --- "INSERT COIN — PRESS Z" (flashing) ---
    const insertCoinText = this.add
      .text(ARCADE_WIDTH / 2, ARCADE_HEIGHT - 20, "INSERT COIN \u2014 PRESS Z", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#4ade80",
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: insertCoinText,
      alpha: 0.2,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    // Controls hint
    this.add
      .text(
        ARCADE_WIDTH / 2,
        ARCADE_HEIGHT - 35,
        "\u2191\u2193 SELECT    Z SHOOT/MELEE    X JUMP    C GRENADE",
        {
          fontFamily: "monospace",
          fontSize: "6px",
          color: "#374151",
        }
      )
      .setOrigin(0.5);

    // --- Scanline overlay ---
    if (this.textures.exists("scanlines")) {
      const scanlines = this.add.sprite(ARCADE_WIDTH / 2, ARCADE_HEIGHT / 2, "scanlines");
      scanlines.setDepth(100);
      scanlines.setAlpha(0.12);
    }

    // --- Input ---
    let lastNav = 0;
    this.input.keyboard!.on("keydown", (event: KeyboardEvent) => {
      const now = Date.now();
      if (now - lastNav < 200) return;
      lastNav = now;

      if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") {
        this.selectedIndex = (this.selectedIndex - 1 + 3) % 3;
        this.updateSelection();
      } else if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") {
        this.selectedIndex = (this.selectedIndex + 1) % 3;
        this.updateSelection();
      } else if (event.key === "z" || event.key === "Z" || event.key === "Enter") {
        this.startGame();
      }
    });
  }

  update(_time: number, delta: number): void {
    // Animate preview sprite idle cycle (idle_1 through idle_4)
    this.previewAnimTimer += delta;
    if (this.previewAnimTimer >= 200) {
      this.previewAnimTimer -= 200;
      this.previewAnimFrame = (this.previewAnimFrame + 1) % 4;
      const char = this.characters[this.selectedIndex];
      if (this.previewSprite) {
        this.previewSprite.setTexture(`${char}_idle_${this.previewAnimFrame + 1}`);
      }
    }
  }

  private updateSelection(): void {
    // Highlight selected name
    this.nameTexts.forEach((text, i) => {
      text.setColor(i === this.selectedIndex ? "#4ade80" : "#6b7280");
    });

    // Move arrow
    const listStartY = LIST_START_Y;
    if (this.selectArrow) {
      this.tweens.killTweensOf(this.selectArrow);
      this.selectArrow.setY(listStartY + this.selectedIndex * 18);
      this.selectArrow.setX(248);
      this.tweens.add({
        targets: this.selectArrow,
        x: 251,
        duration: 300,
        yoyo: true,
        repeat: -1,
      });
    }

    // Update preview + portrait
    const char = this.characters[this.selectedIndex];
    if (this.previewSprite) {
      this.previewSprite.setTexture(`${char}_idle_1`);
      this.previewAnimFrame = 0;
      this.previewAnimTimer = 0;
    }
    if (this.portraitSprite) {
      this.portraitSprite.setTexture(`${char}_portrait`);
    }

    this.updateCharacterDisplay();
  }

  private updateCharacterDisplay(): void {
    const char = this.characters[this.selectedIndex];
    const stats = CHARACTER_STATS[char];

    // HP bar
    if (this.hpBar) {
      this.hpBar.clear();
      this.hpBar.fillStyle(0xef4444);
      this.hpBar.fillRect(
        288,
        this.barStartY,
        Math.floor((this.barWidth * stats.maxHP) / this.maxHP),
        6
      );
    }

    // Speed bar
    if (this.spdBar) {
      this.spdBar.clear();
      this.spdBar.fillStyle(0x22d3ee);
      this.spdBar.fillRect(
        288,
        this.barStartY + 12,
        Math.floor((this.barWidth * stats.speed) / this.maxSpeed),
        6
      );
    }

    // Fire rate bar (inverted — lower fireRate = faster = more fill)
    if (this.fireBar) {
      this.fireBar.clear();
      this.fireBar.fillStyle(0xfde047);
      this.fireBar.fillRect(
        288,
        this.barStartY + 24,
        Math.floor((this.barWidth * this.minFireRate) / stats.fireRate),
        6
      );
    }

    if (this.flavorText) {
      this.flavorText.setText(FLAVORS[char]);
    }
  }

  private startGame(): void {
    const selected = this.characters[this.selectedIndex];
    this.scene.start("ArcadeGameScene", { character: selected });
    this.scene.launch("ArcadeHUDScene", { character: selected });
  }
}
