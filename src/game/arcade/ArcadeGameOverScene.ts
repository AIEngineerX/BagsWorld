import * as Phaser from "phaser";
import { ARCADE_WIDTH, ARCADE_HEIGHT, type ArcadeCharacter } from "./types";

export class ArcadeGameOverScene extends Phaser.Scene {
  private victory = false;
  private finalScore = 0;
  private character: ArcadeCharacter = "ghost";

  constructor() {
    super({ key: "ArcadeGameOverScene" });
  }

  init(data: { victory: boolean; score: number; character: ArcadeCharacter }): void {
    this.victory = data.victory;
    this.finalScore = data.score;
    this.character = data.character;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(this.victory ? "#0a2e0a" : "#2e0a0a");

    this.add
      .text(ARCADE_WIDTH / 2, 45, this.victory ? "MISSION COMPLETE!" : "GAME OVER", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: this.victory ? "#4ade80" : "#ef4444",
        stroke: "#000",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    // Character portrait
    this.add.sprite(ARCADE_WIDTH / 2, 85, `${this.character}_portrait`).setScale(2);

    // Score counter — counts up from 0
    const scoreText = this.add
      .text(ARCADE_WIDTH / 2, 115, "0", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#fde047",
        stroke: "#000",
        strokeThickness: 1,
      })
      .setOrigin(0.5);

    const counter = { val: 0 };
    this.tweens.add({
      targets: counter,
      val: this.finalScore,
      duration: Math.min(1500, Math.max(500, this.finalScore * 2)),
      ease: "Linear",
      onUpdate: () => {
        scoreText.setText(`${Math.floor(counter.val)}`);
      },
    });

    // Character idle sprite
    this.add.sprite(ARCADE_WIDTH / 2, 160, `${this.character}_idle_1`).setScale(3);

    // Flashing "PRESS START"
    const retryText = this.add
      .text(ARCADE_WIDTH / 2, 200, "PRESS START", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#4ade80",
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: retryText,
      alpha: 0.2,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    this.add
      .text(ARCADE_WIDTH / 2, 216, "Z - RETRY    X - MENU", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#6b7280",
      })
      .setOrigin(0.5);

    // Scanline overlay
    if (this.textures.exists("scanlines")) {
      const scanlines = this.add.sprite(ARCADE_WIDTH / 2, ARCADE_HEIGHT / 2, "scanlines");
      scanlines.setDepth(100);
      scanlines.setAlpha(0.12);
    }

    this.input.keyboard!.on("keydown", (event: KeyboardEvent) => {
      if (event.key === "z" || event.key === "Z") {
        this.scene.stop("ArcadeHUDScene");
        this.scene.start("ArcadeGameScene", { character: this.character });
        this.scene.launch("ArcadeHUDScene", { character: this.character });
      } else if (event.key === "x" || event.key === "X") {
        this.scene.stop("ArcadeHUDScene");
        this.scene.start("ArcadeMenuScene");
      }
    });
  }
}
