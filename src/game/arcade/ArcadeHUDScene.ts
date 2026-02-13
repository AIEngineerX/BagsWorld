import * as Phaser from "phaser";
import {
  ARCADE_WIDTH,
  ARCADE_HEIGHT,
  CHARACTER_STATS,
  WEAPONS,
  type ArcadeCharacter,
  type WeaponType,
  type HUDData,
} from "./types";

export class ArcadeHUDScene extends Phaser.Scene {
  private character?: ArcadeCharacter;

  // Health bar
  private hpBarFill?: Phaser.GameObjects.Graphics;

  // Score
  private scoreText?: Phaser.GameObjects.Text;
  private lastScore = 0;

  // Lives
  private livesSprites: Phaser.GameObjects.Sprite[] = [];
  private lastLives = -1;

  // Weapon
  private weaponIndicator?: Phaser.GameObjects.Graphics;
  private weaponText?: Phaser.GameObjects.Text;
  private lastWeapon: WeaponType | "" = "";
  private lastAmmo = 0;

  // Grenades
  private grenadeSprites: Phaser.GameObjects.Sprite[] = [];
  private grenadeExtraText?: Phaser.GameObjects.Text;
  private lastGrenades = -1;

  // Boss HP
  private bossBarContainer?: Phaser.GameObjects.Container;
  private bossBarFill?: Phaser.GameObjects.Graphics;
  private bossBarVisible = false;

  // HP
  private lastHP = -1;

  constructor() {
    super({ key: "ArcadeHUDScene" });
  }

  init(data: { character: ArcadeCharacter }): void {
    this.character = data.character;
  }

  create(): void {
    this.lastScore = 0;
    this.lastLives = -1;
    this.lastGrenades = -1;
    this.lastHP = -1;
    this.lastWeapon = "";
    this.lastAmmo = 0;
    this.livesSprites = [];
    this.grenadeSprites = [];
    this.bossBarVisible = false;

    const char = this.character!;
    const stats = CHARACTER_STATS[char];

    // --- Semi-transparent backing panels ---
    const panelGfx = this.add.graphics();

    // Top-left panel (portrait + HP + lives)
    panelGfx.fillStyle(0x0a0a0f, 0.5);
    panelGfx.fillRect(0, 0, 104, 52);
    panelGfx.lineStyle(1, 0x4ade80, 0.8);
    panelGfx.lineBetween(104, 0, 104, 52); // right border
    panelGfx.lineBetween(0, 52, 104, 52); // bottom border

    // Bottom-left panel (weapon)
    panelGfx.fillStyle(0x0a0a0f, 0.5);
    panelGfx.fillRect(0, ARCADE_HEIGHT - 20, 80, 20);
    panelGfx.lineStyle(1, 0x4ade80, 0.8);
    panelGfx.lineBetween(0, ARCADE_HEIGHT - 20, 80, ARCADE_HEIGHT - 20); // top border
    panelGfx.lineBetween(80, ARCADE_HEIGHT - 20, 80, ARCADE_HEIGHT); // right border

    // Bottom-right panel (grenades)
    panelGfx.fillStyle(0x0a0a0f, 0.5);
    panelGfx.fillRect(ARCADE_WIDTH - 70, ARCADE_HEIGHT - 20, 70, 20);
    panelGfx.lineStyle(1, 0x4ade80, 0.8);
    panelGfx.lineBetween(ARCADE_WIDTH - 70, ARCADE_HEIGHT - 20, ARCADE_WIDTH, ARCADE_HEIGHT - 20); // top border
    panelGfx.lineBetween(ARCADE_WIDTH - 70, ARCADE_HEIGHT - 20, ARCADE_WIDTH - 70, ARCADE_HEIGHT); // left border

    // --- Portrait (top-left, 32x32) ---
    this.add.sprite(18, 18, `${char}_portrait`);
    const border = this.add.graphics();
    border.lineStyle(1, 0x4ade80);
    border.strokeRect(2, 2, 32, 32);

    // Corner bracket decorations (BagsWorld signature UI)
    const bracketGfx = this.add.graphics();
    bracketGfx.lineStyle(1, 0x4ade80, 0.6);
    // Top-left bracket
    bracketGfx.lineBetween(0, 0, 6, 0);
    bracketGfx.lineBetween(0, 0, 0, 6);
    // Top-right bracket
    bracketGfx.lineBetween(34, 0, 36, 0);
    bracketGfx.lineBetween(36, 0, 36, 6);
    // Bottom-left bracket
    bracketGfx.lineBetween(0, 36, 6, 36);
    bracketGfx.lineBetween(0, 30, 0, 36);
    // Bottom-right bracket
    bracketGfx.lineBetween(34, 36, 36, 36);
    bracketGfx.lineBetween(36, 30, 36, 36);

    // --- HP Bar (next to portrait) ---
    const hpBarBg = this.add.graphics();
    hpBarBg.fillStyle(0x1a1a2e);
    hpBarBg.fillRect(38, 8, 60, 6);
    hpBarBg.lineStyle(1, 0x4ade80);
    hpBarBg.strokeRect(38, 8, 60, 6);

    this.hpBarFill = this.add.graphics();
    this.drawHPBar(stats.maxHP, stats.maxHP);

    this.add.text(38, 16, "HP", {
      fontFamily: "monospace",
      fontSize: "6px",
      color: "#4ade80",
    });

    // --- Score (top-right) ---
    this.scoreText = this.add
      .text(ARCADE_WIDTH - 4, 4, "0", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#4ade80",
        stroke: "#000",
        strokeThickness: 1,
      })
      .setOrigin(1, 0);

    // --- Lives (below portrait) ---
    this.drawLives(3);

    // --- Weapon/Ammo (bottom-left) ---
    this.weaponIndicator = this.add.graphics();
    this.weaponText = this.add.text(14, ARCADE_HEIGHT - 14, "PISTOL \u221E", {
      fontFamily: "monospace",
      fontSize: "7px",
      color: "#4ade80",
    });
    this.drawWeaponIndicator("pistol");

    // --- Grenades (bottom-right) ---
    this.drawGrenades(3);

    // --- Boss HP Bar (top-center, hidden off-screen) ---
    this.bossBarContainer = this.add.container(ARCADE_WIDTH / 2, -16);

    const bossBarBg = this.add.graphics();
    bossBarBg.fillStyle(0x1a1a2e);
    bossBarBg.fillRect(-100, -4, 200, 8);
    bossBarBg.lineStyle(1, 0x4ade80);
    bossBarBg.strokeRect(-100, -4, 200, 8);
    this.bossBarContainer.add(bossBarBg);

    this.bossBarFill = this.add.graphics();
    this.bossBarContainer.add(this.bossBarFill);

    const bossLabel = this.add.text(-100, -14, "BOSS", {
      fontFamily: "monospace",
      fontSize: "7px",
      color: "#4ade80",
      stroke: "#000",
      strokeThickness: 1,
    });
    this.bossBarContainer.add(bossLabel);

    // --- Listen for HUD updates ---
    const gameScene = this.scene.get("ArcadeGameScene");
    if (gameScene) {
      gameScene.events.on("updateHUD", this.onUpdateHUD, this);
    }

    this.events.on("shutdown", () => {
      const gs = this.scene.get("ArcadeGameScene");
      if (gs) gs.events.off("updateHUD", this.onUpdateHUD, this);
    });
  }

  private drawHPBar(hp: number, maxHP: number): void {
    if (!this.hpBarFill) return;
    this.hpBarFill.clear();
    const ratio = Math.max(0, hp) / maxHP;
    const barW = Math.floor(60 * ratio);
    const color =
      ratio > 0.5 ? 0x4ade80 : ratio > 0.25 ? 0xf97316 : 0xfbbf24;
    this.hpBarFill.fillStyle(color);
    this.hpBarFill.fillRect(38, 8, barW, 6);
    this.hpBarFill.fillStyle(0xffffff, 0.3);
    this.hpBarFill.fillRect(38, 8, barW, 1);
  }

  private drawLives(count: number): void {
    this.livesSprites.forEach((s) => s.destroy());
    this.livesSprites = [];
    const char = this.character!;
    for (let i = 0; i < count; i++) {
      const s = this.add.sprite(8 + i * 12, 42, `${char}_idle_1`);
      s.setScale(0.5);
      this.livesSprites.push(s);
    }
  }

  private drawWeaponIndicator(weapon: WeaponType): void {
    if (!this.weaponIndicator) return;
    this.weaponIndicator.clear();
    const color = WEAPONS[weapon].color;
    this.weaponIndicator.fillStyle(color);
    this.weaponIndicator.fillRect(4, ARCADE_HEIGHT - 14, 8, 8);
    this.weaponIndicator.fillStyle(0xffffff, 0.3);
    this.weaponIndicator.fillRect(4, ARCADE_HEIGHT - 14, 8, 1);
  }

  private drawGrenades(count: number): void {
    this.grenadeSprites.forEach((s) => s.destroy());
    this.grenadeSprites = [];
    if (this.grenadeExtraText) {
      this.grenadeExtraText.destroy();
      this.grenadeExtraText = undefined;
    }

    const shown = Math.min(count, 5);
    for (let i = 0; i < shown; i++) {
      const s = this.add.sprite(
        ARCADE_WIDTH - 8 - i * 10,
        ARCADE_HEIGHT - 10,
        "grenade",
      );
      this.grenadeSprites.push(s);
    }
    if (count > 5) {
      this.grenadeExtraText = this.add.text(
        ARCADE_WIDTH - 60,
        ARCADE_HEIGHT - 14,
        `+${count - 5}`,
        { fontFamily: "monospace", fontSize: "7px", color: "#4ade80" },
      );
    }
  }

  private drawBossBar(hp: number, maxHP: number): void {
    if (!this.bossBarFill) return;
    this.bossBarFill.clear();
    const barW = Math.floor((200 * Math.max(0, hp)) / maxHP);
    this.bossBarFill.fillStyle(0xef4444);
    this.bossBarFill.fillRect(-100, -4, barW, 8);
    this.bossBarFill.fillStyle(0xffffff, 0.3);
    this.bossBarFill.fillRect(-100, -4, barW, 1);
  }

  private onUpdateHUD = (data: HUDData) => {
    // HP bar — only redraw when changed
    if (data.hp !== this.lastHP) {
      this.drawHPBar(data.hp, data.maxHP);
      this.lastHP = data.hp;
    }

    // Score with pop tween
    if (this.scoreText && data.score !== this.lastScore) {
      this.scoreText.setText(`${data.score}`);
      this.tweens.add({
        targets: this.scoreText,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 75,
        yoyo: true,
      });
      this.lastScore = data.score;
    }

    // Lives
    if (data.lives !== this.lastLives) {
      this.drawLives(data.lives);
      this.lastLives = data.lives;
    }

    // Weapon — only redraw when weapon or ammo changes
    if (data.weapon !== this.lastWeapon || data.ammo !== this.lastAmmo) {
      if (this.weaponText) {
        const ammoStr = data.ammo === -1 ? "\u221E" : `${data.ammo}`;
        this.weaponText.setText(`${data.weapon.toUpperCase()} ${ammoStr}`);
      }
      if (data.weapon !== this.lastWeapon) {
        this.drawWeaponIndicator(data.weapon);
      }
      this.lastWeapon = data.weapon;
      this.lastAmmo = data.ammo;
    }

    // Grenades
    if (data.grenades !== this.lastGrenades) {
      this.drawGrenades(data.grenades);
      this.lastGrenades = data.grenades;
    }

    // Boss HP bar — slide in when boss spawns
    if (data.bossHP > 0 && !this.bossBarVisible) {
      this.bossBarVisible = true;
      this.tweens.add({
        targets: this.bossBarContainer,
        y: 16,
        duration: 500,
        ease: "Bounce.easeOut",
      });
    }
    if (this.bossBarVisible && data.bossMaxHP > 0) {
      this.drawBossBar(data.bossHP, data.bossMaxHP);
    }
  };
}
