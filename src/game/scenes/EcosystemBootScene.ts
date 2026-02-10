import * as Phaser from "phaser";
import {
  generateCoreAssets,
  generateSpecialBuildings,
  generateLabsAssets,
  generateFoundersAssets,
  generateDiverseCharacters,
  generateTeamCharacters,
  generateDecorations,
  generateAmbientParticles,
  generateMoltbookAssets,
  generateArenaSprites,
  generateMansions,
  generateBallersProps,
  generateDungeonAssets,
  generateLaunchPadAssets,
} from "@/game/textures";
import { SCALE } from "@/game/textures/constants";

/**
 * Boot scene for the Ecosystem Demo — generates only the textures needed
 * by reusing existing texture generators from src/game/textures/.
 */
export class EcosystemBootScene extends Phaser.Scene {
  constructor() {
    super({ key: "EcosystemBootScene" });
  }

  create(): void {
    // Core: grass, path tiles
    generateCoreAssets(this);

    // Buildings: pokecenter, casino, terminal, oracle_tower, bagshq
    generateSpecialBuildings(this);

    // Labs HQ + props
    generateLabsAssets(this);

    // Founders buildings (founders_0 = Launch Pad)
    generateFoundersAssets(this);

    // Moltbook HQ
    generateMoltbookAssets(this);

    // Named characters: toly, ash, finn, dev, neo, cj, shaw + generic character_0..8
    generateDiverseCharacters(this);

    // Team characters: bagsy, ramo, professorOak, etc.
    generateTeamCharacters(this);

    // Arena: arena_ring, arena_stands, arena_floor, etc.
    generateArenaSprites(this);

    // Trees, lamps, flowers
    generateDecorations(this);

    // Sparkle particles
    generateAmbientParticles(this);

    // Mansions for Ballers Valley
    generateMansions(this);

    // Ballers props: gold fountain, topiary, etc.
    generateBallersProps(this);

    // Dungeon assets: entrance, torches, etc.
    generateDungeonAssets(this);

    // City props: billboards, neon tubes, etc.
    generateLaunchPadAssets(this);

    // Arena entrance building (not in shared textures)
    this.generateArenaBuilding();

    this.scene.start("EcosystemScene");
  }

  private generateArenaBuilding(): void {
    const s = SCALE;
    const w = Math.round(70 * s);
    const h = Math.round(100 * s);
    const g = this.make.graphics({ x: 0, y: 0 });

    // Shadow
    g.fillStyle(0x000000, 0.4);
    g.fillRect(
      Math.round(6 * s),
      Math.round(40 * s),
      w - Math.round(8 * s),
      h - Math.round(40 * s)
    );

    // Arena base (dark stone)
    g.fillStyle(0x374151);
    g.fillRect(
      Math.round(4 * s),
      Math.round(35 * s),
      w - Math.round(8 * s),
      h - Math.round(35 * s)
    );

    // Left tower
    g.fillStyle(0x4b5563);
    g.fillRect(Math.round(4 * s), Math.round(15 * s), Math.round(16 * s), h - Math.round(15 * s));
    g.fillStyle(0xdc2626);
    g.fillRect(Math.round(4 * s), Math.round(10 * s), Math.round(16 * s), Math.round(8 * s));

    // Right tower
    g.fillStyle(0x4b5563);
    g.fillRect(
      w - Math.round(20 * s),
      Math.round(15 * s),
      Math.round(16 * s),
      h - Math.round(15 * s)
    );
    g.fillStyle(0xdc2626);
    g.fillRect(w - Math.round(20 * s), Math.round(10 * s), Math.round(16 * s), Math.round(8 * s));

    // Center arch
    g.fillStyle(0x1f2937);
    g.fillRect(Math.round(22 * s), Math.round(55 * s), Math.round(26 * s), Math.round(35 * s));
    g.fillStyle(0xef4444, 0.3);
    g.fillRect(Math.round(24 * s), Math.round(57 * s), Math.round(22 * s), Math.round(33 * s));

    // Arena banner
    g.fillStyle(0xef4444);
    g.fillRect(Math.round(18 * s), Math.round(30 * s), Math.round(34 * s), Math.round(10 * s));
    g.fillStyle(0xfbbf24);
    g.fillRect(Math.round(20 * s), Math.round(32 * s), Math.round(30 * s), Math.round(6 * s));

    // Flames on towers
    g.fillStyle(0xf97316, 0.8);
    g.fillRect(Math.round(8 * s), Math.round(5 * s), Math.round(8 * s), Math.round(8 * s));
    g.fillRect(w - Math.round(16 * s), Math.round(5 * s), Math.round(8 * s), Math.round(8 * s));
    g.fillStyle(0xfde047, 0.6);
    g.fillRect(Math.round(10 * s), Math.round(3 * s), Math.round(4 * s), Math.round(5 * s));
    g.fillRect(w - Math.round(14 * s), Math.round(3 * s), Math.round(4 * s), Math.round(5 * s));

    g.generateTexture("arena_building", w, h);
    g.destroy();
  }
}
