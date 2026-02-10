import * as Phaser from "phaser";

// ----- Layout Constants -----
const CANVAS_W = 1200;
const CANVAS_H = 500;
const WORLD_W = 2400;

// Ground anchors (consistent with BannerScene ratios)
const GROUND_Y = CANVAS_H * 0.78; // top of grass
const PATH_Y = CANVAS_H * 0.82; // path strip
const BUILDING_Y = CANVAS_H * 0.86; // building origin bottom
const AGENT_Y = CANVAS_H * 0.89; // characters walk here

// Sky palette (dusk)
const SKY_TOP = 0x1a1a2e;
const SKY_MID = 0x2d1b4e;
const SKY_HORIZON = 0xf59e0b;

// ----- Building definitions -----
interface BuildingDef {
  texture: string;
  label: string;
  route: string;
  x: number; // absolute px in world
  scale: number;
  labelColor: number;
}

// Even spacing: 8 buildings across 2400px world (300px apart, starting at 150)
const BUILDINGS: BuildingDef[] = [
  {
    texture: "bagshq",
    label: "AI AGENTS",
    route: "/?zone=labs",
    x: 150,
    scale: 1.5,
    labelColor: 0x22c55e,
  },
  {
    texture: "oracle_tower",
    label: "PREDICTIONS",
    route: "/?zone=trending",
    x: 450,
    scale: 1.0,
    labelColor: 0xa855f7,
  },
  {
    texture: "casino",
    label: "GAMING",
    route: "/?zone=trending",
    x: 750,
    scale: 1.0,
    labelColor: 0xfbbf24,
  },
  {
    texture: "terminal",
    label: "TRADING",
    route: "/?zone=trending",
    x: 1050,
    scale: 1.0,
    labelColor: 0x06b6d4,
  },
  {
    texture: "pokecenter",
    label: "TOKEN CARE",
    route: "/?zone=main_city",
    x: 1350,
    scale: 1.0,
    labelColor: 0xef4444,
  },
  {
    texture: "founders_0",
    label: "LAUNCHES",
    route: "/?zone=founders",
    x: 1650,
    scale: 1.0,
    labelColor: 0xf59e0b,
  },
  {
    texture: "moltbook_hq",
    label: "SOCIAL",
    route: "/?zone=moltbook",
    x: 1950,
    scale: 1.0,
    labelColor: 0xdc2626,
  },
  {
    texture: "arena_building",
    label: "COMBAT",
    route: "/?zone=arena",
    x: 2250,
    scale: 1.0,
    labelColor: 0xef4444,
  },
];

// ----- Agent definitions -----
interface AgentDef {
  texture: string;
  name: string;
  fromBuilding: number; // index into BUILDINGS
  toBuilding: number;
  duration: number; // ms for one leg
}

const AGENTS: AgentDef[] = [
  { texture: "toly", name: "Toly", fromBuilding: 0, toBuilding: 1, duration: 6000 },
  { texture: "ash", name: "Ash", fromBuilding: 1, toBuilding: 2, duration: 5500 },
  { texture: "finn", name: "Finn", fromBuilding: 2, toBuilding: 3, duration: 7000 },
  { texture: "neo", name: "Neo", fromBuilding: 4, toBuilding: 5, duration: 5000 },
  { texture: "bagsy", name: "Bagsy", fromBuilding: 5, toBuilding: 6, duration: 6500 },
  { texture: "shaw", name: "Shaw", fromBuilding: 6, toBuilding: 7, duration: 5800 },
];

export class EcosystemScene extends Phaser.Scene {
  constructor() {
    super({ key: "EcosystemScene" });
  }

  create(): void {
    this.cameras.main.setBounds(0, 0, WORLD_W, CANVAS_H);

    this.drawSky();
    this.drawStars();
    this.drawSkyline();
    this.drawGround();
    this.drawPath();
    this.placeDecorations();
    this.placeBuildings();
    this.placeAgents();
    this.createDataPulses();
    this.createAmbientParticles();
    this.startCameraTour();
  }

  // ===== Sky =====

  private drawSky(): void {
    const g = this.add.graphics();
    g.setDepth(-2);
    const bands = 20;
    const bandH = CANVAS_H / bands;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      let color: number;
      if (t < 0.5) {
        color = this.lerpColor(SKY_TOP, SKY_MID, t / 0.5);
      } else {
        color = this.lerpColor(SKY_MID, SKY_HORIZON, (t - 0.5) / 0.5);
      }
      g.fillStyle(color);
      g.fillRect(0, Math.floor(i * bandH), WORLD_W, Math.ceil(bandH) + 1);
    }
  }

  private drawStars(): void {
    const g = this.add.graphics();
    g.setDepth(-1);
    let seed = 12345;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 60; i++) {
      const x = rand() * WORLD_W;
      const y = rand() * CANVAS_H * 0.4;
      const size = 1 + rand() * 2;
      g.fillStyle(0xffffff, 0.3 + rand() * 0.5);
      g.fillRect(Math.floor(x), Math.floor(y), Math.ceil(size), Math.ceil(size));
    }
  }

  private drawSkyline(): void {
    const g = this.add.graphics();
    g.setDepth(0);
    g.fillStyle(0x0f0f1a, 0.25);
    const baseY = CANVAS_H * 0.55;
    let seed = 42;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const count = Math.floor(WORLD_W / 40);
    for (let i = 0; i < count; i++) {
      const bx = i * 40 + rand() * 20;
      const bw = 20 + rand() * 25;
      const bh = 30 + rand() * 80;
      g.fillRect(Math.floor(bx), Math.floor(baseY - bh), Math.ceil(bw), Math.ceil(bh));
    }
  }

  // ===== Ground & Path =====

  private drawGround(): void {
    if (!this.textures.exists("grass")) return;
    const tileSize = 52;
    for (let x = 0; x < WORLD_W; x += tileSize) {
      for (let y = GROUND_Y; y < CANVAS_H; y += tileSize) {
        const sprite = this.add.sprite(x, y, "grass");
        sprite.setOrigin(0, 0);
        sprite.setDepth(1);
      }
    }
  }

  private drawPath(): void {
    if (!this.textures.exists("path")) return;
    const tileSize = 52;
    for (let x = 0; x < WORLD_W; x += tileSize) {
      const sprite = this.add.sprite(x, PATH_Y, "path");
      sprite.setOrigin(0, 0);
      sprite.setDepth(2);
    }
  }

  // ===== Decorations =====

  private placeDecorations(): void {
    let seed = 777;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    // Trees between and around buildings
    const treeTextures = ["tree_a", "tree_b"];
    for (let i = 0; i < 20; i++) {
      const tex = treeTextures[i % treeTextures.length];
      if (!this.textures.exists(tex)) continue;
      const x = rand() * WORLD_W;
      const y = GROUND_Y + rand() * 15;
      const tree = this.add.sprite(x, y, tex);
      tree.setOrigin(0.5, 1);
      tree.setScale(0.9 + rand() * 0.3);
      tree.setDepth(3);
    }

    // Street lamps along the path
    if (this.textures.exists("streetlamp")) {
      const lampCount = 12;
      const spacing = WORLD_W / lampCount;
      for (let i = 0; i < lampCount; i++) {
        const x = spacing * 0.5 + i * spacing;
        const lamp = this.add.sprite(x, GROUND_Y, "streetlamp");
        lamp.setOrigin(0.5, 1);
        lamp.setScale(1.0);
        lamp.setDepth(3);

        // Lamp glow
        const glow = this.add.graphics();
        glow.setDepth(2);
        glow.fillStyle(0xfbbf24, 0.12);
        glow.fillCircle(x, GROUND_Y - 30, 18);
        this.tweens.add({
          targets: glow,
          alpha: { from: 0.4, to: 0.8 },
          duration: 1500 + rand() * 1000,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    }
  }

  // ===== Buildings =====

  private placeBuildings(): void {
    for (const def of BUILDINGS) {
      if (!this.textures.exists(def.texture)) continue;

      // Glow behind building
      const glow = this.add.graphics();
      glow.setDepth(4);
      glow.fillStyle(def.labelColor, 0.08);
      glow.fillEllipse(def.x, BUILDING_Y + 5, 90, 18);
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.3, to: 0.6 },
        duration: 2500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      // Building sprite — origin at bottom center, sitting on ground
      const building = this.add.sprite(def.x, BUILDING_Y, def.texture);
      building.setOrigin(0.5, 1);
      building.setScale(def.scale);
      building.setDepth(5);
      building.setInteractive({ cursor: "pointer" });

      // Hover
      const baseScale = def.scale;
      building.on("pointerover", () => {
        this.tweens.add({
          targets: building,
          scaleX: baseScale * 1.06,
          scaleY: baseScale * 1.06,
          duration: 120,
          ease: "Back.easeOut",
        });
      });
      building.on("pointerout", () => {
        this.tweens.add({
          targets: building,
          scaleX: baseScale,
          scaleY: baseScale,
          duration: 120,
          ease: "Sine.easeOut",
        });
      });
      building.on("pointerdown", () => {
        window.open(def.route, "_self");
      });

      // Sign label below building
      const signW = def.label.length * 7 + 14;
      const signH = 16;
      const signY = BUILDING_Y + 6;

      const signBg = this.add.graphics();
      signBg.setDepth(6);
      signBg.fillStyle(0x000000, 0.75);
      signBg.fillRect(def.x - signW / 2, signY, signW, signH);
      signBg.lineStyle(1, def.labelColor, 0.7);
      signBg.strokeRect(def.x - signW / 2, signY, signW, signH);

      const signText = this.add.text(def.x, signY + signH / 2, def.label, {
        fontFamily: "'Press Start 2P', monospace",
        fontSize: "6px",
        color: "#ffffff",
      });
      signText.setOrigin(0.5, 0.5);
      signText.setDepth(7);

      // Subtle sign glow pulse
      this.tweens.add({
        targets: signText,
        alpha: { from: 0.8, to: 1 },
        duration: 900 + Math.random() * 500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }

  // ===== Agents =====

  private placeAgents(): void {
    for (const agent of AGENTS) {
      if (!this.textures.exists(agent.texture)) continue;

      const startX = BUILDINGS[agent.fromBuilding].x;
      const endX = BUILDINGS[agent.toBuilding].x;

      const sprite = this.add.sprite(startX, AGENT_Y, agent.texture);
      sprite.setOrigin(0.5, 1);
      sprite.setScale(2.5);
      sprite.setDepth(10);

      // Name label above character
      const nameLabel = this.add.text(startX, AGENT_Y - 58, agent.name, {
        fontFamily: "'Press Start 2P', monospace",
        fontSize: "5px",
        color: "#4ade80",
      });
      nameLabel.setOrigin(0.5, 1);
      nameLabel.setDepth(11);
      nameLabel.setAlpha(0.7);

      // Walk cycle: right → left → repeat
      const walkRight = () => {
        sprite.setFlipX(false);
        this.tweens.add({
          targets: [sprite, nameLabel],
          x: endX,
          duration: agent.duration,
          ease: "Linear",
          onComplete: () => walkLeft(),
        });
      };

      const walkLeft = () => {
        sprite.setFlipX(true);
        this.tweens.add({
          targets: [sprite, nameLabel],
          x: startX,
          duration: agent.duration,
          ease: "Linear",
          onComplete: () => walkRight(),
        });
      };

      // Stagger start so they don't all move at once
      this.time.delayedCall(Math.random() * 3000, () => walkRight());
    }
  }

  // ===== Data Pulses =====

  private createDataPulses(): void {
    const pulseColors = [0x4ade80, 0x06b6d4, 0xfbbf24, 0xa855f7, 0xef4444];

    for (let i = 0; i < 6; i++) {
      const dot = this.add.graphics();
      dot.setDepth(8);
      const color = pulseColors[i % pulseColors.length];
      dot.fillStyle(color, 0.8);
      dot.fillCircle(0, 0, 2);
      dot.fillStyle(color, 0.25);
      dot.fillCircle(0, 0, 5);
      dot.setPosition(0, PATH_Y + 26);

      this.tweens.add({
        targets: dot,
        x: { from: 0, to: WORLD_W },
        duration: 10000 + i * 1500,
        delay: i * 1800,
        repeat: -1,
        ease: "Linear",
        onUpdate: () => {
          const progress = (dot.x as number) / WORLD_W;
          if (progress < 0.05) {
            dot.setAlpha(progress / 0.05);
          } else if (progress > 0.95) {
            dot.setAlpha((1 - progress) / 0.05);
          } else {
            dot.setAlpha(0.8);
          }
        },
      });
    }
  }

  // ===== Ambient Particles =====

  private createAmbientParticles(): void {
    for (let i = 0; i < 12; i++) {
      const particle = this.add.graphics();
      particle.setDepth(15);
      const brightness = 0.2 + Math.random() * 0.3;
      particle.fillStyle(0x4ade80, brightness);
      particle.fillCircle(0, 0, 1 + Math.random());

      const startX = Math.random() * WORLD_W;
      const startY = CANVAS_H * 0.3 + Math.random() * CANVAS_H * 0.35;
      particle.setPosition(startX, startY);

      this.tweens.add({
        targets: particle,
        x: startX + (Math.random() - 0.5) * 80,
        y: startY - 15 - Math.random() * 30,
        alpha: { from: brightness, to: 0 },
        duration: 3000 + Math.random() * 4000,
        delay: Math.random() * 5000,
        repeat: -1,
        ease: "Sine.easeOut",
      });
    }
  }

  // ===== Camera Tour =====

  private startCameraTour(): void {
    this.tweens.add({
      targets: this.cameras.main,
      scrollX: WORLD_W - CANVAS_W,
      duration: 15000,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
      hold: 2000,
    });
  }

  // ===== Utility =====

  private lerpColor(a: number, b: number, t: number): number {
    const ar = (a >> 16) & 0xff,
      ag = (a >> 8) & 0xff,
      ab = a & 0xff;
    const br = (b >> 16) & 0xff,
      bg = (b >> 8) & 0xff,
      bb = b & 0xff;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return (r << 16) | (g << 8) | bl;
  }
}
