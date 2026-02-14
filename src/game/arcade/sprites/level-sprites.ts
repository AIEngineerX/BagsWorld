import * as Phaser from "phaser";
import { PALETTE, darken, lighten } from "../../textures/constants";

export function generateLevelSprites(scene: Phaser.Scene): void {
  generatePlatforms(scene);
  generateProps(scene);
  generateBackgrounds(scene);
}

// --- Platforms (16x16) ---

function generatePlatforms(scene: Phaser.Scene): void {
  const T = 16;

  // platform_wood — Dark Brick
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const brick = 0x2a1a3e;
    g.fillStyle(brick);
    g.fillRect(0, 0, T, T);
    // Brick mortar lines at y=4,8,12
    g.fillStyle(darken(brick, 0.25));
    g.fillRect(0, 4, T, 1);
    g.fillRect(0, 8, T, 1);
    g.fillRect(0, 12, T, 1);
    // Staggered vertical mortar
    g.fillRect(4, 0, 1, 4);
    g.fillRect(12, 0, 1, 4);
    g.fillRect(8, 4, 1, 4);
    g.fillRect(0, 8, 1, 4);
    g.fillRect(4, 8, 1, 4);
    g.fillRect(12, 8, 1, 4);
    g.fillRect(8, 12, 1, 4);
    // Surface variation
    g.fillStyle(lighten(brick, 0.08));
    g.fillRect(2, 1, 2, 2);
    g.fillRect(9, 5, 2, 2);
    g.fillRect(5, 9, 3, 2);
    g.fillRect(13, 13, 2, 2);
    g.generateTexture("platform_wood", T, T);
    g.destroy();
  }

  // platform_metal — BagsCity Pavement
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const pavement = PALETTE.gray;
    g.fillStyle(pavement);
    g.fillRect(0, 0, T, T);
    // Top highlight (curb edge)
    g.fillStyle(PALETTE.lightGray);
    g.fillRect(0, 0, T, 2);
    // Crack detail at y=7
    g.fillStyle(darken(pavement, 0.2));
    g.fillRect(3, 7, 5, 1);
    g.fillRect(10, 7, 3, 1);
    // Drain grate at (3,9)
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(3, 9, 4, 3);
    g.fillStyle(PALETTE.void);
    g.fillRect(4, 10, 2, 1);
    // Scattered texture dots
    g.fillStyle(darken(pavement, 0.1));
    g.fillRect(1, 3, 1, 1);
    g.fillRect(8, 5, 1, 1);
    g.fillRect(14, 4, 1, 1);
    g.fillRect(11, 11, 1, 1);
    // Yellow lane dash
    g.fillStyle(PALETTE.gold);
    g.fillRect(6, 13, 4, 1);
    g.generateTexture("platform_metal", T, T);
    g.destroy();
  }
}

// --- Props ---

function generateProps(scene: Phaser.Scene): void {
  const T = 16;

  // crate — Tech Supply Crate
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(0, 0, T, T);
    // Border
    g.fillStyle(PALETTE.midGray);
    g.fillRect(0, 0, T, 1);
    g.fillRect(0, 0, 1, T);
    g.fillRect(T - 1, 0, 1, T);
    g.fillRect(0, T - 1, T, 1);
    // Cross beams
    g.fillStyle(PALETTE.gray);
    g.fillRect(7, 1, 2, 14);
    g.fillRect(1, 7, 14, 2);
    // Bolts (corners)
    g.fillStyle(PALETTE.lightGray);
    g.fillRect(2, 2, 1, 1);
    g.fillRect(13, 2, 1, 1);
    g.fillRect(2, 13, 1, 1);
    g.fillRect(13, 13, 1, 1);
    // Green supply marking (2x2 at center)
    g.fillStyle(PALETTE.bagsGreen);
    g.fillRect(7, 7, 2, 2);
    g.generateTexture("crate", T, T);
    g.destroy();
  }
}

// --- Backgrounds (parallax layers) ---

function generateBackgrounds(scene: Phaser.Scene): void {
  // bg_city (480x270) — BagsWorld City Skyline
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const sky = 0x0f172a;
    const building1 = 0x1e293b;
    const building2 = 0x1a2332;
    const windowColors = [PALETTE.sky, PALETTE.bagsGreen, PALETTE.gold, PALETTE.cyan];

    // Sky fill
    g.fillStyle(sky);
    g.fillRect(0, 0, 480, 270);

    // Distant buildings (varying heights)
    const buildings = [
      { x: 10, w: 30, h: 80 },
      { x: 45, w: 20, h: 60 },
      { x: 70, w: 35, h: 100 },
      { x: 110, w: 25, h: 70 },
      { x: 140, w: 40, h: 120 },
      { x: 185, w: 22, h: 55 },
      { x: 212, w: 38, h: 95 },
      { x: 255, w: 28, h: 75 },
      { x: 288, w: 42, h: 110 },
      { x: 335, w: 20, h: 50 },
      { x: 360, w: 32, h: 85 },
      { x: 397, w: 26, h: 65 },
      { x: 428, w: 35, h: 90 },
      { x: 465, w: 15, h: 45 },
    ];

    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      const bColor = i % 2 === 0 ? building1 : building2;
      g.fillStyle(bColor);
      g.fillRect(b.x, 270 - b.h, b.w, b.h);
      // Left edge highlight
      g.fillStyle(lighten(bColor, 0.08));
      g.fillRect(b.x, 270 - b.h, 1, b.h);

      // Window grid with BagsWorld glow technique
      let windowIdx = 0;
      for (let wy = 270 - b.h + 6; wy < 260; wy += 10) {
        for (let wx = b.x + 4; wx < b.x + b.w - 4; wx += 7) {
          if ((wx + wy) % 3 !== 0) {
            // Deterministic window color selection
            const color = windowColors[(wx * 7 + wy * 3 + i) % windowColors.length];
            // 25% opacity glow border
            g.fillStyle(color, 0.25);
            g.fillRect(wx - 1, wy - 1, 4, 5);
            // Solid accent fill
            g.fillStyle(color);
            g.fillRect(wx, wy, 2, 3);
            // Corner highlight
            g.fillStyle(PALETTE.white, 0.5);
            g.fillRect(wx, wy, 1, 1);
            windowIdx++;
          }
        }
      }
    }

    g.generateTexture("bg_city", 480, 270);
    g.destroy();
  }

  // bg_mountains (480x135) — Distant Ruin Silhouettes (replaces mountain ranges)
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const H = 135;

    // Dark sky base
    g.fillStyle(0x0a0f1a);
    g.fillRect(0, 0, 480, H);

    // Far layer: PALETTE.night colored building silhouettes, heights 20-60px
    g.fillStyle(PALETTE.night);
    g.fillRect(0, H - 30, 25, 30);
    g.fillRect(30, H - 45, 20, 45);
    g.fillRect(55, H - 25, 30, 25);
    g.fillRect(90, H - 55, 15, 55);
    g.fillRect(110, H - 35, 25, 35);
    g.fillRect(140, H - 60, 20, 60);
    g.fillRect(165, H - 40, 30, 40);
    g.fillRect(200, H - 20, 25, 20);
    g.fillRect(230, H - 50, 18, 50);
    g.fillRect(255, H - 30, 22, 30);
    g.fillRect(282, H - 55, 15, 55);
    g.fillRect(302, H - 25, 28, 25);
    g.fillRect(335, H - 45, 20, 45);
    g.fillRect(360, H - 35, 25, 35);
    g.fillRect(390, H - 50, 18, 50);
    g.fillRect(415, H - 30, 22, 30);
    g.fillRect(442, H - 40, 20, 40);
    g.fillRect(467, H - 25, 13, 25);
    // Antenna spires on far layer
    g.fillRect(95, H - 62, 2, 7);
    g.fillRect(148, H - 66, 2, 6);
    g.fillRect(287, H - 60, 2, 5);
    g.fillRect(396, H - 55, 2, 5);

    // Near layer: PALETTE.shadow colored, heights 30-70px
    g.fillStyle(PALETTE.shadow);
    g.fillRect(10, H - 50, 22, 50);
    g.fillRect(40, H - 65, 18, 65);
    g.fillRect(65, H - 40, 28, 40);
    g.fillRect(100, H - 70, 20, 70);
    g.fillRect(125, H - 45, 30, 45);
    g.fillRect(160, H - 55, 22, 55);
    g.fillRect(190, H - 35, 25, 35);
    g.fillRect(220, H - 60, 16, 60);
    g.fillRect(245, H - 45, 24, 45);
    g.fillRect(275, H - 65, 18, 65);
    g.fillRect(300, H - 40, 26, 40);
    g.fillRect(332, H - 55, 20, 55);
    g.fillRect(358, H - 30, 24, 30);
    g.fillRect(388, H - 50, 16, 50);
    g.fillRect(410, H - 65, 22, 65);
    g.fillRect(438, H - 35, 20, 35);
    g.fillRect(462, H - 45, 18, 45);
    // Antenna spires on near layer
    g.fillRect(108, H - 75, 2, 5);
    g.fillRect(226, H - 65, 2, 5);
    g.fillRect(418, H - 70, 2, 5);

    // Faint window lights on near layer (bagsGreen at 0.15 alpha)
    g.fillStyle(PALETTE.bagsGreen, 0.15);
    g.fillRect(15, H - 40, 1, 1);
    g.fillRect(18, H - 30, 1, 1);
    g.fillRect(46, H - 55, 1, 1);
    g.fillRect(48, H - 45, 1, 1);
    g.fillRect(105, H - 60, 1, 1);
    g.fillRect(110, H - 50, 1, 1);
    g.fillRect(165, H - 45, 1, 1);
    g.fillRect(222, H - 50, 1, 1);
    g.fillRect(280, H - 55, 1, 1);
    g.fillRect(338, H - 45, 1, 1);
    g.fillRect(414, H - 55, 1, 1);
    g.fillRect(420, H - 45, 1, 1);

    g.generateTexture("bg_mountains", 480, H);
    g.destroy();
  }

  // bg_sky (480x270) — BagsWorld Night Sky
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    // Top: PALETTE.void, Bottom: 0x0f172a
    g.fillStyle(PALETTE.void);
    g.fillRect(0, 0, 480, 135);
    g.fillStyle(0x0f172a);
    g.fillRect(0, 135, 480, 135);
    // Scattered 1px stars (keep existing positions)
    g.fillStyle(PALETTE.white);
    const stars = [
      [23, 12],
      [67, 45],
      [112, 8],
      [156, 34],
      [198, 22],
      [234, 55],
      [270, 15],
      [310, 40],
      [345, 9],
      [389, 52],
      [420, 28],
      [450, 18],
      [38, 70],
      [88, 88],
      [145, 65],
      [200, 92],
      [255, 78],
      [320, 85],
      [378, 62],
      [440, 72],
      [15, 110],
      [60, 125],
      [130, 105],
      [185, 118],
      [250, 108],
      [330, 120],
      [410, 95],
    ];
    stars.forEach(([sx, sy]) => g.fillRect(sx, sy, 1, 1));
    // Brighter 2px stars
    g.fillStyle(0xe2e8f0);
    g.fillRect(100, 30, 2, 2);
    g.fillRect(290, 20, 2, 2);
    g.fillRect(400, 50, 2, 2);
    // Faint green-tinted star
    g.fillStyle(PALETTE.bagsGreen, 0.4);
    g.fillRect(170, 42, 2, 2);
    // Faint purple-tinted star
    g.fillStyle(PALETTE.purple, 0.4);
    g.fillRect(350, 35, 2, 2);
    g.generateTexture("bg_sky", 480, 270);
    g.destroy();
  }

  // bg_midground (480x135) — Close Silhouettes with Lights
  {
    const g = scene.make.graphics({ x: 0, y: 0 });
    const MH = 135;
    const sil = PALETTE.void; // Darkened to PALETTE.void for more contrast
    g.fillStyle(0x0c1222);
    g.fillRect(0, 0, 480, MH);
    g.fillStyle(sil);
    // Keep existing building rectangles
    g.fillRect(20, MH - 60, 25, 60);
    g.fillRect(30, MH - 75, 10, 75);
    g.fillRect(80, MH - 50, 20, 50);
    g.fillRect(95, MH - 40, 15, 40);
    g.fillRect(150, MH - 70, 30, 70);
    g.fillRect(160, MH - 85, 10, 85);
    g.fillRect(175, MH - 55, 15, 55);
    g.fillRect(230, MH - 45, 25, 45);
    g.fillRect(250, MH - 65, 12, 65);
    g.fillRect(300, MH - 80, 20, 80);
    g.fillRect(315, MH - 60, 18, 60);
    g.fillRect(328, MH - 50, 12, 50);
    g.fillRect(380, MH - 55, 22, 55);
    g.fillRect(395, MH - 70, 15, 70);
    g.fillRect(440, MH - 45, 20, 45);
    g.fillRect(455, MH - 60, 15, 60);
    // Jagged ruin tops
    g.fillRect(22, MH - 62, 3, 5);
    g.fillRect(152, MH - 72, 4, 5);
    g.fillRect(302, MH - 83, 5, 6);
    g.fillRect(397, MH - 73, 3, 6);
    // Lit windows across buildings using accent colors at 0.3 alpha
    g.fillStyle(PALETTE.bagsGreen, 0.3);
    g.fillRect(25, MH - 45, 2, 2);
    g.fillRect(165, MH - 70, 2, 2);
    g.fillStyle(PALETTE.sky, 0.3);
    g.fillRect(85, MH - 35, 2, 2);
    g.fillRect(305, MH - 65, 2, 2);
    g.fillStyle(PALETTE.gold, 0.3);
    g.fillRect(235, MH - 30, 2, 2);
    g.fillRect(385, MH - 40, 2, 2);
    g.fillStyle(PALETTE.cyan, 0.3);
    g.fillRect(445, MH - 30, 2, 2);
    g.fillRect(155, MH - 55, 2, 2);
    // Ground line at y=134
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(0, MH - 1, 480, 1);
    g.generateTexture("bg_midground", 480, MH);
    g.destroy();
  }
}
