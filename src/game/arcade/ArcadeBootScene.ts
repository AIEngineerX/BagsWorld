import * as Phaser from "phaser";
import { generatePlayerSprites } from "./sprites/player-sprites";
import { generateEnemySprites } from "./sprites/enemy-sprites";
import { generateLevelSprites } from "./sprites/level-sprites";
import { generateEffectSprites } from "./sprites/effects-sprites";
import { generatePortraitSprites } from "./sprites/portrait-sprites";

export class ArcadeBootScene extends Phaser.Scene {
  constructor() {
    super({ key: "ArcadeBootScene" });
  }

  create(): void {
    generatePlayerSprites(this);
    generateEnemySprites(this);
    generateLevelSprites(this);
    generateEffectSprites(this);
    generatePortraitSprites(this);

    this.scene.start("ArcadeMenuScene");
  }
}
