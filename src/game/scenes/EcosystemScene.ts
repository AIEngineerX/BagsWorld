import * as Phaser from "phaser";

// ----- Layout Constants -----
const CANVAS_W = 1200;
const CANVAS_H = 500;
const WORLD_W = 3600;

// Ground anchors
const GROUND_Y = CANVAS_H * 0.78; // top of grass
const PATH_Y = CANVAS_H * 0.82; // path strip
const BUILDING_Y = CANVAS_H * 0.86; // building origin bottom
const AGENT_Y = CANVAS_H * 0.89; // characters walk here

// Sky palette (dusk)
const SKY_TOP = 0x1a1a2e;
const SKY_MID = 0x2d1b4e;
const SKY_HORIZON = 0xf59e0b;

// ----- Zone Cluster Definitions -----
interface ZoneCluster {
  name: string;
  x: number; // center X
  scrollX: number; // camera scrollX to frame this cluster
  color: number;
  features: string[];
}

const ZONE_CLUSTERS: ZoneCluster[] = [
  {
    name: "HQ",
    x: 250,
    scrollX: 0,
    color: 0x22c55e,
    features: ["Agent Dashboard", "AI Agent HQ", "Team Operations"],
  },
  {
    name: "Park",
    x: 750,
    scrollX: 350,
    color: 0x4ade80,
    features: ["Token Care Center", "Leaderboard", "Fee Claiming"],
  },
  {
    name: "BagsCity",
    x: 1300,
    scrollX: 900,
    color: 0xfbbf24,
    features: ["Casino (1M gate)", "Trading Terminal", "Oracle Predictions"],
  },
  {
    name: "Founders",
    x: 1850,
    scrollX: 1450,
    color: 0xf59e0b,
    features: ["Launch Pad", "Prof. Oak AI Gen", "Sol Incinerator"],
  },
  {
    name: "Moltbook",
    x: 2350,
    scrollX: 1950,
    color: 0xdc2626,
    features: ["Social Feed", "Agent Hangout", "AI Network"],
  },
  {
    name: "Ballers",
    x: 2850,
    scrollX: 2450,
    color: 0xeab308,
    features: ["Top Holder Mansions", "VIP Lounge"],
  },
  {
    name: "Arena+Dungeon",
    x: 3350,
    scrollX: 2950,
    color: 0xef4444,
    features: ["AI Combat Arena", "MMORPG Dungeon"],
  },
];

// ----- Building Definitions -----
interface BuildingDef {
  texture: string;
  label: string;
  route: string;
  x: number;
  scale: number;
  labelColor: number;
  fallbackColor?: number;
  fallbackW?: number;
  fallbackH?: number;
}

const BUILDINGS: BuildingDef[] = [
  // HQ cluster
  {
    texture: "labs_hq",
    label: "AGENT DASHBOARD",
    route: "/?zone=labs",
    x: 180,
    scale: 1.2,
    labelColor: 0x22c55e,
    fallbackColor: 0x1a5c3a,
    fallbackW: 70,
    fallbackH: 90,
  },
  {
    texture: "bagshq",
    label: "AI AGENTS",
    route: "/?zone=labs",
    x: 320,
    scale: 1.5,
    labelColor: 0x22c55e,
  },
  // Park cluster
  {
    texture: "pokecenter",
    label: "TOKEN CARE",
    route: "/?zone=main_city",
    x: 680,
    scale: 1.0,
    labelColor: 0xef4444,
  },
  {
    texture: "tradinggym",
    label: "LEADERBOARD",
    route: "/?zone=main_city",
    x: 830,
    scale: 1.0,
    labelColor: 0x4ade80,
    fallbackColor: 0x2d5a3d,
    fallbackW: 60,
    fallbackH: 80,
  },
  // BagsCity cluster
  {
    texture: "casino",
    label: "GAMING",
    route: "/?zone=trending",
    x: 1200,
    scale: 1.0,
    labelColor: 0xfbbf24,
  },
  {
    texture: "terminal",
    label: "TRADING",
    route: "/?zone=trending",
    x: 1320,
    scale: 1.0,
    labelColor: 0x06b6d4,
  },
  {
    texture: "oracle_tower",
    label: "PREDICTIONS",
    route: "/?zone=trending",
    x: 1440,
    scale: 1.0,
    labelColor: 0xa855f7,
  },
  // Founders cluster
  {
    texture: "founders_0",
    label: "LAUNCH PAD",
    route: "/?zone=founders",
    x: 1760,
    scale: 1.0,
    labelColor: 0xf59e0b,
  },
  {
    texture: "founders_2",
    label: "PROF. OAK",
    route: "/?zone=founders",
    x: 1880,
    scale: 1.0,
    labelColor: 0xf59e0b,
    fallbackColor: 0x5a3d1b,
    fallbackW: 55,
    fallbackH: 75,
  },
  {
    texture: "incinerator_truck",
    label: "INCINERATOR",
    route: "/?zone=founders",
    x: 2000,
    scale: 1.0,
    labelColor: 0xf59e0b,
    fallbackColor: 0x8b2500,
    fallbackW: 65,
    fallbackH: 50,
  },
  // Moltbook cluster
  {
    texture: "moltbook_hq",
    label: "SOCIAL FEED",
    route: "/?zone=moltbook",
    x: 2280,
    scale: 1.0,
    labelColor: 0xdc2626,
  },
  {
    texture: "beach_hut",
    label: "AGENT HUT",
    route: "/?zone=moltbook",
    x: 2420,
    scale: 1.0,
    labelColor: 0xdc2626,
    fallbackColor: 0xc4a35a,
    fallbackW: 55,
    fallbackH: 65,
  },
  // Ballers cluster
  {
    texture: "mansion_0",
    label: "BALLERS",
    route: "/?zone=ballers",
    x: 2780,
    scale: 1.0,
    labelColor: 0xeab308,
  },
  {
    texture: "mansion_1",
    label: "VIP LOUNGE",
    route: "/?zone=ballers",
    x: 2930,
    scale: 1.0,
    labelColor: 0xeab308,
  },
  // Arena+Dungeon cluster
  {
    texture: "arena_building",
    label: "COMBAT",
    route: "/?zone=arena",
    x: 3280,
    scale: 1.0,
    labelColor: 0xef4444,
  },
  {
    texture: "dungeon_entrance",
    label: "DUNGEON",
    route: "/?zone=dungeon",
    x: 3430,
    scale: 1.0,
    labelColor: 0xa855f7,
    fallbackColor: 0x2a1a3a,
    fallbackW: 60,
    fallbackH: 85,
  },
];

// Map building textures to their index for agent referencing
function buildingIndex(texture: string): number {
  return BUILDINGS.findIndex((b) => b.texture === texture);
}

// ----- Agent Definitions -----
interface AgentDef {
  texture: string;
  name: string;
  fromBuilding: number;
  toBuilding: number;
  duration: number;
}

const AGENTS: AgentDef[] = [
  {
    texture: "ramo",
    name: "Ramo",
    fromBuilding: buildingIndex("labs_hq"),
    toBuilding: buildingIndex("bagshq"),
    duration: 6000,
  },
  {
    texture: "sincara",
    name: "Sincara",
    fromBuilding: buildingIndex("labs_hq"),
    toBuilding: buildingIndex("bagshq"),
    duration: 7000,
  },
  {
    texture: "toly",
    name: "Toly",
    fromBuilding: buildingIndex("pokecenter"),
    toBuilding: buildingIndex("tradinggym"),
    duration: 5500,
  },
  {
    texture: "ash",
    name: "Ash",
    fromBuilding: buildingIndex("pokecenter"),
    toBuilding: buildingIndex("tradinggym"),
    duration: 6500,
  },
  {
    texture: "neo",
    name: "Neo",
    fromBuilding: buildingIndex("casino"),
    toBuilding: buildingIndex("terminal"),
    duration: 5000,
  },
  {
    texture: "cj",
    name: "CJ",
    fromBuilding: buildingIndex("terminal"),
    toBuilding: buildingIndex("oracle_tower"),
    duration: 5800,
  },
  {
    texture: "finn",
    name: "Finn",
    fromBuilding: buildingIndex("founders_0"),
    toBuilding: buildingIndex("founders_2"),
    duration: 6000,
  },
  {
    texture: "professorOak",
    name: "Prof. Oak",
    fromBuilding: buildingIndex("founders_0"),
    toBuilding: buildingIndex("incinerator_truck"),
    duration: 7500,
  },
  {
    texture: "bagsy",
    name: "Bagsy",
    fromBuilding: buildingIndex("moltbook_hq"),
    toBuilding: buildingIndex("beach_hut"),
    duration: 6000,
  },
  {
    texture: "shaw",
    name: "Shaw",
    fromBuilding: buildingIndex("moltbook_hq"),
    toBuilding: buildingIndex("beach_hut"),
    duration: 5500,
  },
  {
    texture: "dev",
    name: "Dev",
    fromBuilding: buildingIndex("mansion_0"),
    toBuilding: buildingIndex("mansion_1"),
    duration: 5800,
  },
  {
    texture: "carlo",
    name: "Carlo",
    fromBuilding: buildingIndex("arena_building"),
    toBuilding: buildingIndex("dungeon_entrance"),
    duration: 6200,
  },
];

// ----- Tour timeline -----
interface TourStop {
  scrollX: number;
  holdTime: number; // ms to hold at this stop
  panTime: number; // ms to pan TO this stop (0 for first)
  clusterIndex: number;
}

const TOUR_STOPS: TourStop[] = [
  { scrollX: 0, holdTime: 3000, panTime: 0, clusterIndex: 0 },
  { scrollX: 350, holdTime: 3000, panTime: 2500, clusterIndex: 1 },
  { scrollX: 900, holdTime: 3000, panTime: 2500, clusterIndex: 2 },
  { scrollX: 1450, holdTime: 3000, panTime: 2500, clusterIndex: 3 },
  { scrollX: 1950, holdTime: 3000, panTime: 2500, clusterIndex: 4 },
  { scrollX: 2450, holdTime: 3000, panTime: 2500, clusterIndex: 5 },
  { scrollX: 2950, holdTime: 3000, panTime: 2500, clusterIndex: 6 },
];

export class EcosystemScene extends Phaser.Scene {
  private infoCallout: Phaser.GameObjects.Container | null = null;
  private hintText: Phaser.GameObjects.Text | null = null;

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
    this.ensureFallbackTextures();
    this.placeDecorations();
    this.placeBuildings();
    this.placeAgents();
    this.createDataPulses();
    this.createAmbientParticles();
    this.createHintText();
    this.startGuidedTour();
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

  // ===== Fallback Texture Generation =====

  private ensureFallbackTextures(): void {
    for (const def of BUILDINGS) {
      if (!this.textures.exists(def.texture)) {
        const baseColor = def.fallbackColor ?? 0x3a3a5a;
        const w = def.fallbackW ?? 60;
        const h = def.fallbackH ?? 80;
        const g = this.make.graphics({ x: 0, y: 0 });

        // Main body
        g.fillStyle(baseColor);
        g.fillRect(0, 0, w, h);

        // Lighter inset
        const lighter = this.lerpColor(baseColor, 0xffffff, 0.2);
        g.fillStyle(lighter);
        g.fillRect(3, 3, w - 6, h - 6);

        // Dark right edge for depth
        const darker = this.lerpColor(baseColor, 0x000000, 0.3);
        g.fillStyle(darker);
        g.fillRect(w - 4, 0, 4, h);

        // Window row
        g.fillStyle(0xfbbf24, 0.6);
        const windowSize = 6;
        const windowGap = 12;
        const windowsPerRow = Math.floor((w - 16) / windowGap);
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < windowsPerRow; col++) {
            g.fillRect(8 + col * windowGap, 10 + row * (windowSize + 8), windowSize, windowSize);
          }
        }

        // Door
        g.fillStyle(0x1a1a2e);
        g.fillRect(Math.floor(w / 2) - 5, h - 16, 10, 16);

        g.generateTexture(def.texture, w, h);
        g.destroy();
      }
    }
  }

  // ===== Decorations =====

  private placeDecorations(): void {
    let seed = 777;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    // Trees scattered across the world
    const treeTextures = ["tree_a", "tree_b"];
    for (let i = 0; i < 30; i++) {
      const tex = treeTextures[i % treeTextures.length];
      if (!this.textures.exists(tex)) continue;
      const x = rand() * WORLD_W;
      const y = GROUND_Y + rand() * 15;
      const tree = this.add.sprite(x, y, tex);
      tree.setOrigin(0.5, 1);
      tree.setScale(0.9 + rand() * 0.3);
      tree.setDepth(3);
    }

    // Street lamps along the entire path
    if (this.textures.exists("streetlamp")) {
      const lampCount = 18;
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

    // Zone-specific props
    this.placeZoneProps(rand);
  }

  private placeZoneProps(rand: () => number): void {
    // HQ: lab props
    this.placePropIfExists("labs_prop_0", 210, GROUND_Y + 5, 1.0, 3);
    this.placePropIfExists("labs_prop_1", 290, GROUND_Y + 3, 1.0, 3);
    this.placePropIfExists("labs_prop_2", 350, GROUND_Y + 6, 0.9, 3);

    // Park: benches and extra trees
    this.placePropIfExists("bench", 720, GROUND_Y + 8, 1.0, 3);
    this.placePropIfExists("bench", 800, GROUND_Y + 8, 1.0, 3);

    // BagsCity: neon signs
    this.placePropIfExists("neon_sign", 1250, GROUND_Y - 10, 0.8, 4);
    this.placePropIfExists("neon_sign", 1380, GROUND_Y - 10, 0.8, 4);

    // Founders: lanterns and crates
    this.placePropIfExists("founders_lantern", 1800, GROUND_Y + 2, 0.9, 3);
    this.placePropIfExists("founders_crate", 1940, GROUND_Y + 8, 0.8, 3);
    this.placePropIfExists("founders_lantern", 2030, GROUND_Y + 2, 0.9, 3);

    // Moltbook: palm trees and umbrellas
    this.placePropIfExists("palm_tree_1", 2240, GROUND_Y - 5, 1.0, 3);
    this.placePropIfExists("palm_tree_2", 2450, GROUND_Y - 5, 1.0, 3);
    this.placePropIfExists("beach_umbrella", 2340, GROUND_Y + 6, 0.9, 3);

    // Ballers: gold fountain and topiary
    this.placePropIfExists("gold_fountain", 2850, GROUND_Y + 5, 1.0, 4);
    this.placePropIfExists("topiary", 2750, GROUND_Y + 3, 0.9, 3);
    this.placePropIfExists("topiary", 2950, GROUND_Y + 3, 0.9, 3);

    // Arena+Dungeon: torches
    this.placePropIfExists("dungeon_torch", 3310, GROUND_Y - 5, 0.9, 4);
    this.placePropIfExists("dungeon_torch", 3460, GROUND_Y - 5, 0.9, 4);

    // Generate simple inline props for zones that likely have no texture
    this.generateSimpleProps(rand);
  }

  private placePropIfExists(
    texture: string,
    x: number,
    y: number,
    scale: number,
    depth: number
  ): void {
    if (!this.textures.exists(texture)) return;
    const sprite = this.add.sprite(x, y, texture);
    sprite.setOrigin(0.5, 1);
    sprite.setScale(scale);
    sprite.setDepth(depth);
  }

  private generateSimpleProps(rand: () => number): void {
    const g = this.add.graphics();
    g.setDepth(3);

    // Park benches (simple brown rectangles if no bench texture)
    if (!this.textures.exists("bench")) {
      g.fillStyle(0x8b6914, 0.7);
      g.fillRect(715, GROUND_Y + 2, 20, 8);
      g.fillRect(795, GROUND_Y + 2, 20, 8);
    }

    // Moltbook beach umbrellas (if no texture)
    if (!this.textures.exists("beach_umbrella")) {
      g.fillStyle(0xdc2626, 0.6);
      g.fillTriangle(2340, GROUND_Y - 20, 2325, GROUND_Y, 2355, GROUND_Y);
      g.fillStyle(0x8b6914, 0.8);
      g.fillRect(2338, GROUND_Y - 20, 4, 25);
    }

    // Ballers gold fountain (if no texture)
    if (!this.textures.exists("gold_fountain")) {
      g.fillStyle(0xeab308, 0.5);
      g.fillCircle(2850, GROUND_Y + 2, 12);
      g.fillStyle(0xeab308, 0.8);
      g.fillRect(2846, GROUND_Y - 12, 8, 14);
    }

    // Dungeon torches (if no texture)
    if (!this.textures.exists("dungeon_torch")) {
      for (const tx of [3310, 3460]) {
        g.fillStyle(0x8b6914, 0.8);
        g.fillRect(tx - 2, GROUND_Y - 18, 4, 20);
        g.fillStyle(0xef4444, 0.7);
        g.fillCircle(tx, GROUND_Y - 22, 5);
        g.fillStyle(0xfbbf24, 0.5);
        g.fillCircle(tx, GROUND_Y - 24, 3);
      }
    }
  }

  // ===== Buildings =====

  private placeBuildings(): void {
    for (const def of BUILDINGS) {
      // Texture is guaranteed by ensureFallbackTextures
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

      // Building sprite
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
      if (agent.fromBuilding < 0 || agent.toBuilding < 0) continue;
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

      // Walk cycle: right -> left -> repeat
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

      // Stagger start
      this.time.delayedCall(Math.random() * 3000, () => walkRight());
    }
  }

  // ===== Data Pulses =====

  private createDataPulses(): void {
    const pulseColors = [0x4ade80, 0x06b6d4, 0xfbbf24, 0xa855f7, 0xef4444];

    for (let i = 0; i < 8; i++) {
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
    for (let i = 0; i < 16; i++) {
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

  // ===== Hint Text =====

  private createHintText(): void {
    this.hintText = this.add.text(CANVAS_W / 2, CANVAS_H - 20, "Click any building to explore", {
      fontFamily: "'Press Start 2P', monospace",
      fontSize: "8px",
      color: "#ffffff",
    });
    this.hintText.setOrigin(0.5, 0.5);
    this.hintText.setDepth(20);
    this.hintText.setScrollFactor(0); // Fixed to camera viewport
    this.hintText.setAlpha(0.4);

    this.tweens.add({
      targets: this.hintText,
      alpha: { from: 0.4, to: 0.7 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  // ===== Info Callout =====

  private showInfoCallout(cluster: ZoneCluster): void {
    // Remove existing callout
    this.hideInfoCallout();

    const padX = 14;
    const padY = 10;
    const lineHeight = 14;
    const titleSize = 12;
    const featureSize = 8;

    // Calculate dimensions
    const maxTextW = Math.max(
      cluster.name.length * (titleSize * 0.65),
      ...cluster.features.map((f) => f.length * (featureSize * 0.65))
    );
    const boxW = Math.max(maxTextW + padX * 2, 160);
    const boxH = padY + titleSize + 8 + cluster.features.length * lineHeight + padY;

    // Position: top-right of viewport, fixed to camera
    const calloutX = CANVAS_W - boxW - 16;
    const calloutY = 16;

    const container = this.add.container(calloutX, calloutY);
    container.setDepth(25);
    container.setScrollFactor(0); // Fixed to viewport
    container.setAlpha(0);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x0f172a, 0.92);
    bg.fillRoundedRect(0, 0, boxW, boxH, 4);

    // Colored top bar
    bg.fillStyle(cluster.color, 1);
    bg.fillRect(0, 0, boxW, 4);

    // Corner brackets
    const bracketLen = 8;
    bg.lineStyle(1, cluster.color, 0.6);
    // Top-left
    bg.beginPath();
    bg.moveTo(0, bracketLen);
    bg.lineTo(0, 0);
    bg.lineTo(bracketLen, 0);
    bg.strokePath();
    // Top-right
    bg.beginPath();
    bg.moveTo(boxW - bracketLen, 0);
    bg.lineTo(boxW, 0);
    bg.lineTo(boxW, bracketLen);
    bg.strokePath();
    // Bottom-left
    bg.beginPath();
    bg.moveTo(0, boxH - bracketLen);
    bg.lineTo(0, boxH);
    bg.lineTo(bracketLen, boxH);
    bg.strokePath();
    // Bottom-right
    bg.beginPath();
    bg.moveTo(boxW - bracketLen, boxH);
    bg.lineTo(boxW, boxH);
    bg.lineTo(boxW, boxH - bracketLen);
    bg.strokePath();

    container.add(bg);

    // Zone name
    const colorHex = "#" + cluster.color.toString(16).padStart(6, "0");
    const title = this.add.text(padX, padY + 4, cluster.name.toUpperCase(), {
      fontFamily: "'Press Start 2P', monospace",
      fontSize: `${titleSize}px`,
      color: colorHex,
    });
    container.add(title);

    // Feature bullets
    let yOffset = padY + titleSize + 12;
    for (const feature of cluster.features) {
      const bullet = this.add.text(padX + 4, yOffset, `> ${feature}`, {
        fontFamily: "'Press Start 2P', monospace",
        fontSize: `${featureSize}px`,
        color: "#ffffff",
      });
      bullet.setAlpha(0.85);
      container.add(bullet);
      yOffset += lineHeight;
    }

    this.infoCallout = container;

    // Fade in with Back.easeOut
    this.tweens.add({
      targets: container,
      alpha: 1,
      duration: 200,
      ease: "Back.easeOut",
    });
  }

  private hideInfoCallout(): void {
    if (this.infoCallout) {
      const callout = this.infoCallout;
      this.infoCallout = null;
      this.tweens.add({
        targets: callout,
        alpha: 0,
        duration: 150,
        ease: "Sine.easeIn",
        onComplete: () => {
          callout.destroy();
        },
      });
    }
  }

  // ===== Guided Camera Tour =====

  private startGuidedTour(): void {
    this.runTourLoop();
  }

  private runTourLoop(): void {
    let totalDelay = 0;

    for (let i = 0; i < TOUR_STOPS.length; i++) {
      const stop = TOUR_STOPS[i];
      const cluster = ZONE_CLUSTERS[stop.clusterIndex];

      if (i === 0) {
        // First stop: just hold and show info
        this.cameras.main.scrollX = stop.scrollX;
        this.time.delayedCall(totalDelay, () => {
          this.showInfoCallout(cluster);
        });
        totalDelay += stop.holdTime;
      } else {
        // Hide callout before panning
        const hideTime = totalDelay;
        this.time.delayedCall(hideTime, () => {
          this.hideInfoCallout();
        });

        // Pan to next stop
        const panStart = totalDelay;
        this.time.delayedCall(panStart, () => {
          this.tweens.add({
            targets: this.cameras.main,
            scrollX: stop.scrollX,
            duration: stop.panTime,
            ease: "Sine.easeInOut",
          });
        });
        totalDelay += stop.panTime;

        // Show info callout after arriving
        const arriveTime = totalDelay;
        this.time.delayedCall(arriveTime, () => {
          this.showInfoCallout(cluster);
        });
        totalDelay += stop.holdTime;
      }
    }

    // After last stop: hide callout, then fast pan back to start
    const hideBeforeReturn = totalDelay;
    this.time.delayedCall(hideBeforeReturn, () => {
      this.hideInfoCallout();
    });

    // Hold for a moment at the end
    totalDelay += 500;

    // Fast pan back to HQ
    const returnPanStart = totalDelay;
    const returnPanDuration = 4000;
    this.time.delayedCall(returnPanStart, () => {
      this.tweens.add({
        targets: this.cameras.main,
        scrollX: 0,
        duration: returnPanDuration,
        ease: "Sine.easeInOut",
      });
    });
    totalDelay += returnPanDuration;

    // Loop the entire tour
    this.time.delayedCall(totalDelay, () => {
      this.runTourLoop();
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
