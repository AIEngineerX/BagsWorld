import * as Phaser from "phaser";
import { SCALE, darken, lighten } from "./constants";

function generateBeachGround(scene: Phaser.Scene): void {
  const s = SCALE;
  const size = Math.round(32 * s);
  const g = scene.make.graphics({ x: 0, y: 0 });

  const sandBase = 0xf4d58d;
  const sandLight = 0xfae6b1;
  const sandDark = 0xc4a35d;
  const sandShadow = 0xa08040;
  const shellPink = 0xffc0cb;
  const shellWhite = 0xfff8f0;
  const pebbleGray = 0x9ca3af;

  g.fillStyle(sandBase);
  g.fillRect(0, 0, size, size);

  g.fillStyle(sandDark);
  for (let y = 0; y < size; y += Math.round(4 * s)) {
    for (let x = 0; x < size; x += Math.round(4 * s)) {
      const offset = ((y / Math.round(4 * s)) % 2) * Math.round(2 * s);
      if ((x + offset) % Math.round(8 * s) < Math.round(2 * s)) {
        g.fillRect(x, y, Math.round(2 * s), Math.round(2 * s));
      }
    }
  }

  g.fillStyle(sandLight);
  g.fillRect(Math.round(5 * s), Math.round(3 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillRect(Math.round(20 * s), Math.round(12 * s), Math.round(4 * s), Math.round(2 * s));
  g.fillRect(Math.round(8 * s), Math.round(22 * s), Math.round(3 * s), Math.round(2 * s));

  g.fillStyle(shellPink);
  g.fillRect(Math.round(12 * s), Math.round(8 * s), Math.round(2 * s), Math.round(1 * s));
  g.fillRect(Math.round(12 * s), Math.round(9 * s), Math.round(3 * s), Math.round(1 * s));

  g.fillStyle(shellWhite);
  g.fillRect(Math.round(25 * s), Math.round(20 * s), Math.round(2 * s), Math.round(2 * s));

  g.fillStyle(pebbleGray);
  g.fillRect(Math.round(3 * s), Math.round(15 * s), Math.round(1 * s), Math.round(1 * s));
  g.fillRect(Math.round(28 * s), Math.round(5 * s), Math.round(1 * s), Math.round(1 * s));

  g.fillStyle(0xffffff, 0.3);
  g.fillRect(0, size - Math.round(2 * s), size, Math.round(1 * s));
  g.fillStyle(0xffffff, 0.15);
  g.fillRect(0, size - Math.round(4 * s), size, Math.round(1 * s));

  g.generateTexture("beach_ground", size, size);
  g.destroy();
}

function generateBeachShack(scene: Phaser.Scene, s: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const w = Math.round(60 * s);
  const h = Math.round(70 * s);

  const woodBase = 0x8b7355;
  const woodDark = 0x6b5344;
  const woodLight = 0xa08563;
  const thatchBase = 0xd4a574;
  const thatchDark = 0xb08050;
  const thatchLight = 0xe8c498;

  g.fillStyle(0x000000, 0.3);
  g.fillRect(Math.round(5 * s), h - Math.round(5 * s), w - Math.round(10 * s), Math.round(5 * s));

  const stiltWidth = Math.round(4 * s);
  const stiltHeight = Math.round(20 * s);
  const stiltY = h - stiltHeight;
  g.fillStyle(woodDark);
  g.fillRect(Math.round(10 * s), stiltY, stiltWidth, stiltHeight);
  g.fillRect(w - Math.round(14 * s), stiltY, stiltWidth, stiltHeight);
  g.fillStyle(woodBase);
  g.fillRect(Math.round(11 * s), stiltY, Math.round(2 * s), stiltHeight);
  g.fillRect(w - Math.round(13 * s), stiltY, Math.round(2 * s), stiltHeight);

  const hutY = Math.round(25 * s);
  const hutHeight = Math.round(30 * s);
  g.fillStyle(woodBase);
  g.fillRect(Math.round(5 * s), hutY, w - Math.round(10 * s), hutHeight);

  g.fillStyle(woodDark);
  for (let py = hutY; py < hutY + hutHeight; py += Math.round(6 * s)) {
    g.fillRect(Math.round(5 * s), py, w - Math.round(10 * s), Math.round(1 * s));
  }

  g.fillStyle(woodLight);
  g.fillRect(Math.round(5 * s), hutY, Math.round(2 * s), hutHeight);

  g.fillStyle(0x3d2817);
  g.fillRect(Math.round(22 * s), hutY + Math.round(10 * s), Math.round(12 * s), Math.round(20 * s));

  g.fillStyle(0x87ceeb);
  g.fillRect(Math.round(40 * s), hutY + Math.round(8 * s), Math.round(8 * s), Math.round(8 * s));
  g.fillStyle(woodDark);
  g.fillRect(Math.round(43 * s), hutY + Math.round(8 * s), Math.round(2 * s), Math.round(8 * s));
  g.fillRect(Math.round(40 * s), hutY + Math.round(11 * s), Math.round(8 * s), Math.round(2 * s));

  const roofY = Math.round(5 * s);
  const roofHeight = Math.round(22 * s);
  g.fillStyle(thatchBase);
  for (let row = 0; row < roofHeight; row += Math.round(2 * s)) {
    const inset = Math.round(row * 0.8);
    g.fillRect(inset, roofY + row, w - inset * 2, Math.round(3 * s));
  }

  g.fillStyle(thatchDark);
  for (let row = roofY; row < roofY + roofHeight; row += Math.round(4 * s)) {
    const inset = Math.round((row - roofY) * 0.8);
    g.fillRect(inset, row, w - inset * 2, Math.round(1 * s));
  }

  g.fillStyle(thatchLight);
  g.fillRect(Math.round(10 * s), roofY + Math.round(4 * s), Math.round(8 * s), Math.round(2 * s));
  g.fillRect(Math.round(35 * s), roofY + Math.round(8 * s), Math.round(6 * s), Math.round(2 * s));

  g.generateTexture("beach_building_1", w, h);
  g.destroy();
}

function generateTikiBar(scene: Phaser.Scene, s: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const w = Math.round(80 * s);
  const h = Math.round(85 * s);

  const bambooBase = 0xc4a35d;
  const bambooDark = 0x8b7355;
  const bambooLight = 0xe8d4a0;
  const thatchBase = 0xd4a574;
  const thatchDark = 0xb08050;
  const counterTop = 0x654321;

  g.fillStyle(0x000000, 0.3);
  g.fillRect(Math.round(5 * s), h - Math.round(5 * s), w - Math.round(10 * s), Math.round(5 * s));

  const poleWidth = Math.round(5 * s);
  const poleHeight = Math.round(50 * s);
  const poleY = h - poleHeight;
  g.fillStyle(bambooBase);
  g.fillRect(Math.round(8 * s), poleY, poleWidth, poleHeight);
  g.fillRect(w - Math.round(13 * s), poleY, poleWidth, poleHeight);
  g.fillRect(w / 2 - Math.round(2 * s), poleY, poleWidth, poleHeight);

  g.fillStyle(bambooDark);
  for (let seg = poleY; seg < h; seg += Math.round(10 * s)) {
    g.fillRect(Math.round(8 * s), seg, poleWidth, Math.round(2 * s));
    g.fillRect(w - Math.round(13 * s), seg, poleWidth, Math.round(2 * s));
    g.fillRect(w / 2 - Math.round(2 * s), seg, poleWidth, Math.round(2 * s));
  }

  const counterY = h - Math.round(25 * s);
  const counterH = Math.round(20 * s);
  g.fillStyle(counterTop);
  g.fillRect(Math.round(5 * s), counterY, w - Math.round(10 * s), counterH);

  g.fillStyle(0x8b4513);
  g.fillRect(Math.round(5 * s), counterY, w - Math.round(10 * s), Math.round(3 * s));

  g.fillStyle(bambooLight);
  for (let bx = Math.round(8 * s); bx < w - Math.round(10 * s); bx += Math.round(6 * s)) {
    g.fillRect(bx, counterY + Math.round(5 * s), Math.round(4 * s), counterH - Math.round(7 * s));
  }

  g.fillStyle(0x654321);
  g.fillRect(
    Math.round(20 * s),
    counterY + Math.round(6 * s),
    Math.round(8 * s),
    Math.round(10 * s)
  );
  g.fillStyle(0xffd700);
  g.fillRect(
    Math.round(22 * s),
    counterY + Math.round(8 * s),
    Math.round(2 * s),
    Math.round(2 * s)
  );
  g.fillRect(
    Math.round(25 * s),
    counterY + Math.round(8 * s),
    Math.round(2 * s),
    Math.round(2 * s)
  );

  const roofY = Math.round(5 * s);
  const roofHeight = Math.round(30 * s);
  g.fillStyle(thatchBase);
  for (let row = 0; row < roofHeight; row += Math.round(2 * s)) {
    const inset = Math.round(row * 0.6);
    const roofWidth = w + Math.round(10 * s) - inset * 2;
    g.fillRect(-Math.round(5 * s) + inset, roofY + row, roofWidth, Math.round(3 * s));
  }

  g.fillStyle(thatchDark);
  for (let row = roofY; row < roofY + roofHeight; row += Math.round(5 * s)) {
    const inset = Math.round((row - roofY) * 0.6);
    g.fillRect(
      -Math.round(5 * s) + inset,
      row,
      w + Math.round(10 * s) - inset * 2,
      Math.round(1 * s)
    );
  }

  g.fillStyle(0x8b4513);
  g.fillRect(Math.round(15 * s), roofY + roofHeight, Math.round(3 * s), Math.round(8 * s));
  g.fillRect(w - Math.round(18 * s), roofY + roofHeight, Math.round(3 * s), Math.round(8 * s));

  g.generateTexture("beach_building_2", w, h);
  g.destroy();
}

function generateBeachHouse(scene: Phaser.Scene, s: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const w = Math.round(90 * s);
  const h = Math.round(100 * s);

  const wallBase = 0xf5f5dc;
  const wallLight = 0xffffff;
  const wallShadow = 0xd4d4aa;
  const roofBase = 0x4a90a4;
  const roofDark = 0x3a7084;
  const roofLight = 0x6ab0c4;
  const woodTrim = 0xffffff;
  const deckWood = 0xc4a35d;

  g.fillStyle(0x000000, 0.25);
  g.fillRect(Math.round(8 * s), h - Math.round(5 * s), w - Math.round(16 * s), Math.round(5 * s));

  const deckY = h - Math.round(15 * s);
  g.fillStyle(deckWood);
  g.fillRect(Math.round(3 * s), deckY, w - Math.round(6 * s), Math.round(15 * s));
  g.fillStyle(0xa08040);
  for (let dx = Math.round(3 * s); dx < w - Math.round(6 * s); dx += Math.round(8 * s)) {
    g.fillRect(dx, deckY, Math.round(1 * s), Math.round(15 * s));
  }

  const houseY = Math.round(25 * s);
  const houseH = h - Math.round(40 * s);
  g.fillStyle(wallBase);
  g.fillRect(Math.round(8 * s), houseY, w - Math.round(16 * s), houseH);

  g.fillStyle(wallShadow);
  for (let sy = houseY; sy < houseY + houseH; sy += Math.round(5 * s)) {
    g.fillRect(Math.round(8 * s), sy, w - Math.round(16 * s), Math.round(1 * s));
  }

  g.fillStyle(wallLight);
  g.fillRect(Math.round(8 * s), houseY, Math.round(2 * s), houseH);

  const winWidth = Math.round(12 * s);
  const winHeight = Math.round(14 * s);
  g.fillStyle(0x87ceeb);
  g.fillRect(Math.round(15 * s), houseY + Math.round(8 * s), winWidth, winHeight);
  g.fillRect(w - Math.round(27 * s), houseY + Math.round(8 * s), winWidth, winHeight);

  g.fillStyle(woodTrim);
  g.fillRect(Math.round(15 * s), houseY + Math.round(8 * s), winWidth, Math.round(2 * s));
  g.fillRect(
    Math.round(15 * s),
    houseY + Math.round(8 * s) + winHeight - Math.round(2 * s),
    winWidth,
    Math.round(2 * s)
  );
  g.fillRect(Math.round(20 * s), houseY + Math.round(8 * s), Math.round(2 * s), winHeight);

  g.fillRect(w - Math.round(27 * s), houseY + Math.round(8 * s), winWidth, Math.round(2 * s));
  g.fillRect(
    w - Math.round(27 * s),
    houseY + Math.round(8 * s) + winHeight - Math.round(2 * s),
    winWidth,
    Math.round(2 * s)
  );
  g.fillRect(w - Math.round(22 * s), houseY + Math.round(8 * s), Math.round(2 * s), winHeight);

  g.fillStyle(0x8b4513);
  g.fillRect(
    w / 2 - Math.round(8 * s),
    houseY + Math.round(35 * s),
    Math.round(16 * s),
    Math.round(25 * s)
  );
  g.fillStyle(0xffd700);
  g.fillRect(
    w / 2 + Math.round(4 * s),
    houseY + Math.round(47 * s),
    Math.round(2 * s),
    Math.round(2 * s)
  );

  g.fillStyle(0x87ceeb);
  g.fillRect(
    Math.round(15 * s),
    houseY + Math.round(38 * s),
    Math.round(10 * s),
    Math.round(12 * s)
  );
  g.fillRect(
    w - Math.round(25 * s),
    houseY + Math.round(38 * s),
    Math.round(10 * s),
    Math.round(12 * s)
  );

  const roofY = Math.round(3 * s);
  const roofH = Math.round(25 * s);
  g.fillStyle(roofBase);
  for (let ry = 0; ry < roofH; ry += Math.round(2 * s)) {
    const inset = Math.round(ry * 0.7);
    g.fillRect(
      Math.round(3 * s) + inset,
      roofY + ry,
      w - Math.round(6 * s) - inset * 2,
      Math.round(3 * s)
    );
  }

  g.fillStyle(roofDark);
  for (let ry = roofY; ry < roofY + roofH; ry += Math.round(4 * s)) {
    const inset = Math.round((ry - roofY) * 0.7);
    g.fillRect(Math.round(3 * s) + inset, ry, w - Math.round(6 * s) - inset * 2, Math.round(1 * s));
  }

  g.fillStyle(roofLight);
  g.fillRect(Math.round(15 * s), roofY + Math.round(4 * s), Math.round(12 * s), Math.round(2 * s));

  g.generateTexture("beach_building_3", w, h);
  g.destroy();
}

function generateSurfShop(scene: Phaser.Scene, s: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const w = Math.round(100 * s);
  const h = Math.round(110 * s);

  const wallBase = 0xfff8dc;
  const wallShadow = 0xe8dcc0;
  const roofBase = 0xf97316;
  const roofDark = 0xc45a10;
  const woodTrim = 0x8b4513;
  const surfboardColors = [0xff6b6b, 0x4ecdc4, 0xffd93d, 0xff8c42];

  g.fillStyle(0x000000, 0.25);
  g.fillRect(Math.round(8 * s), h - Math.round(6 * s), w - Math.round(16 * s), Math.round(6 * s));

  const buildY = Math.round(30 * s);
  const buildH = h - Math.round(36 * s);
  g.fillStyle(wallBase);
  g.fillRect(Math.round(8 * s), buildY, w - Math.round(16 * s), buildH);

  g.fillStyle(wallShadow);
  for (let wy = buildY; wy < buildY + buildH; wy += Math.round(6 * s)) {
    g.fillRect(Math.round(8 * s), wy, w - Math.round(16 * s), Math.round(1 * s));
  }

  g.fillStyle(0x87ceeb);
  g.fillRect(
    Math.round(15 * s),
    buildY + Math.round(15 * s),
    Math.round(25 * s),
    Math.round(35 * s)
  );
  g.fillRect(
    w - Math.round(40 * s),
    buildY + Math.round(15 * s),
    Math.round(25 * s),
    Math.round(35 * s)
  );

  g.fillStyle(woodTrim);
  g.fillRect(
    Math.round(15 * s),
    buildY + Math.round(15 * s),
    Math.round(25 * s),
    Math.round(3 * s)
  );
  g.fillRect(
    w - Math.round(40 * s),
    buildY + Math.round(15 * s),
    Math.round(25 * s),
    Math.round(3 * s)
  );

  g.fillStyle(0x5d3a1a);
  g.fillRect(
    w / 2 - Math.round(7 * s),
    buildY + Math.round(25 * s),
    Math.round(14 * s),
    Math.round(28 * s)
  );
  g.fillStyle(0x87ceeb);
  g.fillRect(
    w / 2 - Math.round(5 * s),
    buildY + Math.round(28 * s),
    Math.round(10 * s),
    Math.round(15 * s)
  );

  const roofY = Math.round(5 * s);
  const roofH = Math.round(28 * s);
  g.fillStyle(roofBase);
  g.fillRect(Math.round(3 * s), roofY, w - Math.round(6 * s), roofH);

  g.fillStyle(roofDark);
  for (let rx = Math.round(3 * s); rx < w - Math.round(6 * s); rx += Math.round(12 * s)) {
    g.fillRect(rx, roofY, Math.round(6 * s), roofH);
  }

  g.fillStyle(0xffffff);
  g.fillRect(
    Math.round(3 * s),
    roofY + roofH - Math.round(3 * s),
    w - Math.round(6 * s),
    Math.round(3 * s)
  );

  const rackX = w - Math.round(12 * s);
  g.fillStyle(woodTrim);
  g.fillRect(rackX, buildY + Math.round(5 * s), Math.round(4 * s), buildH - Math.round(10 * s));

  surfboardColors.forEach((color, i) => {
    const sbX = rackX - Math.round(8 * s) - i * Math.round(5 * s);
    const sbY = buildY + Math.round(8 * s) + i * Math.round(3 * s);
    g.fillStyle(color);
    g.fillRect(sbX, sbY, Math.round(6 * s), Math.round(40 * s));
    g.fillStyle(0xffffff);
    g.fillRect(
      sbX + Math.round(2 * s),
      sbY + Math.round(10 * s),
      Math.round(2 * s),
      Math.round(20 * s)
    );
  });

  g.fillStyle(0xffffff);
  g.fillRect(Math.round(30 * s), roofY + Math.round(8 * s), Math.round(40 * s), Math.round(12 * s));
  g.fillStyle(roofBase);
  g.fillRect(Math.round(32 * s), roofY + Math.round(10 * s), Math.round(36 * s), Math.round(8 * s));

  g.generateTexture("beach_building_4", w, h);
  g.destroy();
}

function generateBeachBuildings(scene: Phaser.Scene): void {
  const s = SCALE;
  generateBeachShack(scene, s);
  generateTikiBar(scene, s);
  generateBeachHouse(scene, s);
  generateSurfShop(scene, s);
  generateBeachResort(scene, s);
}

function generateBeachResort(scene: Phaser.Scene, s: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const w = Math.round(120 * s);
  const h = Math.round(130 * s);

  const wallBase = 0xfaf0e6;
  const wallShadow = 0xe8dcc8;
  const roofBase = 0xdc143c;
  const roofDark = 0xa01030;
  const balconyRail = 0xffffff;
  const poolBlue = 0x40e0d0;
  const palmGreen = 0x228b22;

  g.fillStyle(0x000000, 0.3);
  g.fillRect(Math.round(10 * s), h - Math.round(8 * s), w - Math.round(20 * s), Math.round(8 * s));

  g.fillStyle(poolBlue);
  g.fillRect(Math.round(75 * s), h - Math.round(15 * s), Math.round(35 * s), Math.round(10 * s));
  g.fillStyle(0x30c0b0);
  g.fillRect(Math.round(78 * s), h - Math.round(13 * s), Math.round(29 * s), Math.round(6 * s));

  const buildY = Math.round(25 * s);
  const buildH = h - Math.round(40 * s);
  const buildW = w - Math.round(40 * s);
  g.fillStyle(wallBase);
  g.fillRect(Math.round(10 * s), buildY, buildW, buildH);

  g.fillStyle(wallShadow);
  const floorHeight = Math.round(buildH / 3);
  for (let floor = 0; floor < 3; floor++) {
    g.fillRect(Math.round(10 * s), buildY + floor * floorHeight, buildW, Math.round(2 * s));
  }

  for (let floor = 0; floor < 3; floor++) {
    const floorY = buildY + floor * floorHeight + Math.round(5 * s);

    for (let win = 0; win < 3; win++) {
      const winX = Math.round(18 * s) + win * Math.round(22 * s);
      g.fillStyle(0x87ceeb);
      g.fillRect(winX, floorY, Math.round(15 * s), Math.round(18 * s));

      if (floor < 2) {
        g.fillStyle(balconyRail);
        g.fillRect(
          winX - Math.round(2 * s),
          floorY + Math.round(20 * s),
          Math.round(19 * s),
          Math.round(2 * s)
        );
        g.fillRect(
          winX - Math.round(2 * s),
          floorY + Math.round(16 * s),
          Math.round(2 * s),
          Math.round(6 * s)
        );
        g.fillRect(
          winX + Math.round(15 * s),
          floorY + Math.round(16 * s),
          Math.round(2 * s),
          Math.round(6 * s)
        );
      }
    }
  }

  g.fillStyle(0x8b4513);
  g.fillRect(
    Math.round(35 * s),
    buildY + buildH - Math.round(25 * s),
    Math.round(20 * s),
    Math.round(25 * s)
  );
  g.fillStyle(0xffd700);
  g.fillRect(
    Math.round(40 * s),
    buildY + buildH - Math.round(22 * s),
    Math.round(10 * s),
    Math.round(18 * s)
  );

  g.fillStyle(roofBase);
  g.fillRect(
    Math.round(30 * s),
    buildY + buildH - Math.round(28 * s),
    Math.round(30 * s),
    Math.round(5 * s)
  );

  const roofY = Math.round(5 * s);
  const roofH = Math.round(22 * s);
  g.fillStyle(roofBase);
  g.fillRect(Math.round(5 * s), roofY, buildW + Math.round(10 * s), roofH);

  g.fillStyle(roofDark);
  for (let ry = roofY; ry < roofY + roofH; ry += Math.round(5 * s)) {
    g.fillRect(Math.round(5 * s), ry, buildW + Math.round(10 * s), Math.round(1 * s));
  }

  g.fillStyle(0x8b4513);
  g.fillRect(Math.round(70 * s), h - Math.round(35 * s), Math.round(4 * s), Math.round(20 * s));
  g.fillStyle(palmGreen);
  g.fillRect(Math.round(62 * s), h - Math.round(40 * s), Math.round(20 * s), Math.round(8 * s));
  g.fillRect(Math.round(65 * s), h - Math.round(45 * s), Math.round(14 * s), Math.round(6 * s));

  g.fillStyle(0xffd700);
  g.fillRect(Math.round(20 * s), roofY + Math.round(5 * s), Math.round(50 * s), Math.round(10 * s));
  g.fillStyle(roofBase);
  g.fillRect(Math.round(22 * s), roofY + Math.round(7 * s), Math.round(46 * s), Math.round(6 * s));

  g.generateTexture("beach_building_5", w, h);
  g.destroy();
}

function generateCrabSprite(scene: Phaser.Scene): void {
  const s = SCALE;
  const g = scene.make.graphics({ x: 0, y: 0 });
  const w = Math.round(24 * s);
  const h = Math.round(20 * s);

  const shellBase = 0xf97316;
  const shellDark = 0xc45a10;
  const shellLight = 0xfb923c;
  const clawColor = 0xef4444;
  const clawDark = 0xb91c1c;
  const eyeWhite = 0xffffff;
  const eyeBlack = 0x000000;
  const legColor = 0xea580c;

  const centerX = w / 2;
  const bodyY = Math.round(8 * s);

  g.fillStyle(legColor);
  g.fillRect(Math.round(4 * s), bodyY + Math.round(4 * s), Math.round(5 * s), Math.round(2 * s));
  g.fillRect(Math.round(3 * s), bodyY + Math.round(6 * s), Math.round(6 * s), Math.round(2 * s));
  g.fillRect(Math.round(4 * s), bodyY + Math.round(8 * s), Math.round(5 * s), Math.round(2 * s));
  g.fillRect(
    w - Math.round(9 * s),
    bodyY + Math.round(4 * s),
    Math.round(5 * s),
    Math.round(2 * s)
  );
  g.fillRect(
    w - Math.round(9 * s),
    bodyY + Math.round(6 * s),
    Math.round(6 * s),
    Math.round(2 * s)
  );
  g.fillRect(
    w - Math.round(9 * s),
    bodyY + Math.round(8 * s),
    Math.round(5 * s),
    Math.round(2 * s)
  );

  g.fillStyle(shellBase);
  g.fillRect(Math.round(6 * s), bodyY, Math.round(12 * s), Math.round(10 * s));

  g.fillStyle(shellDark);
  g.fillRect(Math.round(6 * s), bodyY + Math.round(8 * s), Math.round(12 * s), Math.round(2 * s));
  g.fillRect(w - Math.round(8 * s), bodyY, Math.round(2 * s), Math.round(10 * s));

  g.fillStyle(shellLight);
  g.fillRect(Math.round(8 * s), bodyY + Math.round(2 * s), Math.round(6 * s), Math.round(3 * s));

  g.fillStyle(clawColor);
  g.fillRect(Math.round(1 * s), bodyY - Math.round(2 * s), Math.round(6 * s), Math.round(6 * s));
  g.fillStyle(clawDark);
  g.fillRect(Math.round(1 * s), bodyY + Math.round(2 * s), Math.round(6 * s), Math.round(2 * s));
  g.fillStyle(shellBase);
  g.fillRect(Math.round(1 * s), bodyY, Math.round(2 * s), Math.round(2 * s));

  g.fillStyle(clawColor);
  g.fillRect(
    w - Math.round(7 * s),
    bodyY - Math.round(2 * s),
    Math.round(6 * s),
    Math.round(6 * s)
  );
  g.fillStyle(clawDark);
  g.fillRect(
    w - Math.round(7 * s),
    bodyY + Math.round(2 * s),
    Math.round(6 * s),
    Math.round(2 * s)
  );
  g.fillStyle(shellBase);
  g.fillRect(w - Math.round(3 * s), bodyY, Math.round(2 * s), Math.round(2 * s));

  g.fillStyle(shellBase);
  g.fillRect(
    centerX - Math.round(4 * s),
    bodyY - Math.round(4 * s),
    Math.round(2 * s),
    Math.round(5 * s)
  );
  g.fillRect(
    centerX + Math.round(2 * s),
    bodyY - Math.round(4 * s),
    Math.round(2 * s),
    Math.round(5 * s)
  );

  g.fillStyle(eyeWhite);
  g.fillRect(
    centerX - Math.round(5 * s),
    bodyY - Math.round(6 * s),
    Math.round(4 * s),
    Math.round(3 * s)
  );
  g.fillRect(
    centerX + Math.round(1 * s),
    bodyY - Math.round(6 * s),
    Math.round(4 * s),
    Math.round(3 * s)
  );

  g.fillStyle(eyeBlack);
  g.fillRect(
    centerX - Math.round(4 * s),
    bodyY - Math.round(5 * s),
    Math.round(2 * s),
    Math.round(2 * s)
  );
  g.fillRect(
    centerX + Math.round(2 * s),
    bodyY - Math.round(5 * s),
    Math.round(2 * s),
    Math.round(2 * s)
  );

  g.generateTexture("agent_crab", w, h);
  g.destroy();
}

function generateLobsterSprite(scene: Phaser.Scene): void {
  const s = SCALE;
  const g = scene.make.graphics({ x: 0, y: 0 });
  const w = Math.round(32 * s);
  const h = Math.round(24 * s);

  const shellBase = 0xef4444;
  const shellDark = 0xb91c1c;
  const shellLight = 0xf87171;
  const clawColor = 0xdc2626;
  const clawDark = 0x991b1b;
  const antennaColor = 0xfca5a5;
  const eyeWhite = 0xffffff;
  const eyeBlack = 0x000000;
  const legColor = 0xf87171;

  const bodyY = Math.round(10 * s);
  const bodyX = Math.round(8 * s);
  const bodyW = Math.round(18 * s);
  const bodyH = Math.round(10 * s);

  g.fillStyle(shellBase);
  g.fillRect(
    bodyX + bodyW - Math.round(2 * s),
    bodyY + Math.round(2 * s),
    Math.round(8 * s),
    Math.round(6 * s)
  );
  g.fillStyle(shellDark);
  for (let tx = bodyX + bodyW; tx < bodyX + bodyW + Math.round(6 * s); tx += Math.round(3 * s)) {
    g.fillRect(tx, bodyY + Math.round(2 * s), Math.round(1 * s), Math.round(6 * s));
  }
  g.fillStyle(shellLight);
  g.fillRect(bodyX + bodyW + Math.round(4 * s), bodyY, Math.round(4 * s), Math.round(10 * s));
  g.fillStyle(shellDark);
  g.fillRect(
    bodyX + bodyW + Math.round(5 * s),
    bodyY + Math.round(4 * s),
    Math.round(1 * s),
    Math.round(2 * s)
  );

  g.fillStyle(legColor);
  for (let leg = 0; leg < 4; leg++) {
    const legX = bodyX + Math.round(4 * s) + leg * Math.round(4 * s);
    g.fillRect(legX, bodyY + bodyH - Math.round(2 * s), Math.round(2 * s), Math.round(4 * s));
  }

  g.fillStyle(shellBase);
  g.fillRect(bodyX, bodyY, bodyW, bodyH);

  g.fillStyle(shellDark);
  for (let seg = bodyX + Math.round(4 * s); seg < bodyX + bodyW; seg += Math.round(5 * s)) {
    g.fillRect(seg, bodyY, Math.round(1 * s), bodyH);
  }

  g.fillStyle(shellLight);
  g.fillRect(
    bodyX + Math.round(2 * s),
    bodyY + Math.round(2 * s),
    Math.round(10 * s),
    Math.round(3 * s)
  );

  g.fillStyle(shellBase);
  g.fillRect(
    bodyX - Math.round(4 * s),
    bodyY + Math.round(1 * s),
    Math.round(6 * s),
    Math.round(8 * s)
  );

  g.fillStyle(clawColor);
  g.fillRect(Math.round(1 * s), bodyY - Math.round(4 * s), Math.round(8 * s), Math.round(7 * s));
  g.fillStyle(clawDark);
  g.fillRect(Math.round(1 * s), bodyY + Math.round(1 * s), Math.round(8 * s), Math.round(2 * s));
  g.fillStyle(shellLight);
  g.fillRect(Math.round(1 * s), bodyY - Math.round(4 * s), Math.round(3 * s), Math.round(3 * s));

  g.fillStyle(antennaColor);
  g.fillRect(
    bodyX - Math.round(6 * s),
    bodyY - Math.round(6 * s),
    Math.round(8 * s),
    Math.round(2 * s)
  );
  g.fillRect(
    bodyX - Math.round(8 * s),
    bodyY - Math.round(8 * s),
    Math.round(6 * s),
    Math.round(2 * s)
  );
  g.fillRect(
    bodyX - Math.round(4 * s),
    bodyY - Math.round(4 * s),
    Math.round(6 * s),
    Math.round(2 * s)
  );
  g.fillRect(
    bodyX - Math.round(6 * s),
    bodyY - Math.round(2 * s),
    Math.round(4 * s),
    Math.round(2 * s)
  );

  g.fillStyle(shellBase);
  g.fillRect(
    bodyX - Math.round(2 * s),
    bodyY - Math.round(2 * s),
    Math.round(3 * s),
    Math.round(4 * s)
  );
  g.fillRect(
    bodyX + Math.round(2 * s),
    bodyY - Math.round(2 * s),
    Math.round(3 * s),
    Math.round(4 * s)
  );

  g.fillStyle(eyeWhite);
  g.fillRect(
    bodyX - Math.round(2 * s),
    bodyY - Math.round(4 * s),
    Math.round(3 * s),
    Math.round(3 * s)
  );
  g.fillRect(
    bodyX + Math.round(2 * s),
    bodyY - Math.round(4 * s),
    Math.round(3 * s),
    Math.round(3 * s)
  );

  g.fillStyle(eyeBlack);
  g.fillRect(
    bodyX - Math.round(1 * s),
    bodyY - Math.round(3 * s),
    Math.round(2 * s),
    Math.round(2 * s)
  );
  g.fillRect(
    bodyX + Math.round(3 * s),
    bodyY - Math.round(3 * s),
    Math.round(2 * s),
    Math.round(2 * s)
  );

  g.generateTexture("agent_lobster", w, h);
  g.destroy();
}

function generateHermitCrabSprite(scene: Phaser.Scene): void {
  const s = SCALE;
  const g = scene.make.graphics({ x: 0, y: 0 });
  const w = Math.round(16 * s);
  const h = Math.round(14 * s);

  const shellBase = 0xd4a574;
  const shellDark = 0xa0785a;
  const shellLight = 0xe8c9a0;
  const shellSpiral = 0x8b6f4e;
  const bodyColor = 0xfca5a5;
  const bodyDark = 0xf87171;
  const legColor = 0xfb923c;
  const eyeWhite = 0xffffff;
  const eyeBlack = 0x000000;

  const shellX = Math.round(5 * s);
  const shellY = Math.round(2 * s);
  const shellW = Math.round(10 * s);
  const shellH = Math.round(9 * s);

  g.fillStyle(shellBase);
  g.fillRect(shellX, shellY, shellW, shellH);
  g.fillRect(
    shellX + Math.round(2 * s),
    shellY - Math.round(2 * s),
    shellW - Math.round(4 * s),
    Math.round(3 * s)
  );
  g.fillStyle(shellDark);
  g.fillRect(shellX, shellY + shellH - Math.round(2 * s), shellW, Math.round(2 * s));
  g.fillRect(shellX + shellW - Math.round(2 * s), shellY, Math.round(2 * s), shellH);
  g.fillStyle(shellLight);
  g.fillRect(
    shellX + Math.round(2 * s),
    shellY + Math.round(1 * s),
    Math.round(4 * s),
    Math.round(3 * s)
  );
  g.fillStyle(shellSpiral);
  g.fillRect(
    shellX + Math.round(4 * s),
    shellY + Math.round(3 * s),
    Math.round(3 * s),
    Math.round(2 * s)
  );
  g.fillRect(
    shellX + Math.round(6 * s),
    shellY + Math.round(4 * s),
    Math.round(2 * s),
    Math.round(3 * s)
  );
  g.fillRect(
    shellX + Math.round(3 * s),
    shellY + Math.round(5 * s),
    Math.round(4 * s),
    Math.round(1 * s)
  );

  g.fillStyle(bodyColor);
  g.fillRect(Math.round(1 * s), shellY + Math.round(3 * s), Math.round(6 * s), Math.round(5 * s));
  g.fillStyle(bodyDark);
  g.fillRect(Math.round(1 * s), shellY + Math.round(7 * s), Math.round(6 * s), Math.round(1 * s));

  g.fillStyle(legColor);
  g.fillRect(Math.round(2 * s), shellY + Math.round(8 * s), Math.round(1 * s), Math.round(3 * s));
  g.fillRect(Math.round(4 * s), shellY + Math.round(8 * s), Math.round(1 * s), Math.round(3 * s));
  g.fillRect(Math.round(7 * s), shellY + Math.round(9 * s), Math.round(1 * s), Math.round(2 * s));
  g.fillRect(Math.round(9 * s), shellY + Math.round(9 * s), Math.round(1 * s), Math.round(2 * s));

  g.fillStyle(legColor);
  g.fillRect(0, shellY + Math.round(2 * s), Math.round(3 * s), Math.round(3 * s));

  g.fillStyle(bodyColor);
  g.fillRect(Math.round(2 * s), shellY, Math.round(1 * s), Math.round(4 * s));
  g.fillRect(Math.round(4 * s), shellY, Math.round(1 * s), Math.round(4 * s));
  g.fillStyle(eyeWhite);
  g.fillRect(Math.round(1 * s), shellY - Math.round(2 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(4 * s), shellY - Math.round(2 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillStyle(eyeBlack);
  g.fillRect(Math.round(1 * s), shellY - Math.round(2 * s), Math.round(1 * s), Math.round(1 * s));
  g.fillRect(Math.round(4 * s), shellY - Math.round(2 * s), Math.round(1 * s), Math.round(1 * s));

  g.generateTexture("hermit_crab", w, h);
  g.destroy();
}

function generateCoconutSprite(scene: Phaser.Scene): void {
  const s = SCALE;
  const g = scene.make.graphics({ x: 0, y: 0 });
  const w = Math.round(10 * s);
  const h = Math.round(10 * s);

  const huskOuter = 0x8b6914;
  const huskInner = 0x6b4f12;
  const shellBrown = 0x5c3317;
  const shellDark = 0x3e2210;
  const eyeSpot = 0x2e1a0d;

  g.fillStyle(huskOuter);
  g.fillRect(Math.round(1 * s), Math.round(1 * s), Math.round(8 * s), Math.round(8 * s));
  g.fillStyle(shellBrown);
  g.fillRect(Math.round(2 * s), Math.round(2 * s), Math.round(6 * s), Math.round(6 * s));
  g.fillStyle(shellDark);
  g.fillRect(Math.round(6 * s), Math.round(2 * s), Math.round(2 * s), Math.round(6 * s));
  g.fillRect(Math.round(2 * s), Math.round(6 * s), Math.round(6 * s), Math.round(2 * s));
  g.fillStyle(huskInner);
  g.fillRect(Math.round(1 * s), Math.round(3 * s), Math.round(1 * s), Math.round(4 * s));
  g.fillRect(Math.round(3 * s), Math.round(1 * s), Math.round(4 * s), Math.round(1 * s));
  g.fillStyle(eyeSpot);
  g.fillRect(Math.round(3 * s), Math.round(3 * s), Math.round(1 * s), Math.round(1 * s));
  g.fillRect(Math.round(5 * s), Math.round(3 * s), Math.round(1 * s), Math.round(1 * s));
  g.fillRect(Math.round(4 * s), Math.round(5 * s), Math.round(1 * s), Math.round(1 * s));

  g.generateTexture("coconut", w, h);
  g.destroy();
}

function generateTidepoolSprite(scene: Phaser.Scene): void {
  const s = SCALE;
  const g = scene.make.graphics({ x: 0, y: 0 });
  const w = Math.round(28 * s);
  const h = Math.round(20 * s);

  const rockOuter = 0x6b7280;
  const rockInner = 0x4b5563;
  const rockLight = 0x9ca3af;
  const waterShallow = 0x38bdf8;
  const waterDeep = 0x0ea5e9;
  const waterHighlight = 0x7dd3fc;
  const seaweedGreen = 0x22c55e;
  const seaweedDark = 0x16a34a;

  g.fillStyle(rockOuter);
  g.fillRect(Math.round(1 * s), Math.round(3 * s), Math.round(26 * s), Math.round(14 * s));
  g.fillRect(Math.round(3 * s), Math.round(1 * s), Math.round(22 * s), Math.round(2 * s));
  g.fillRect(Math.round(3 * s), Math.round(17 * s), Math.round(22 * s), Math.round(2 * s));

  g.fillStyle(rockInner);
  g.fillRect(Math.round(3 * s), Math.round(5 * s), Math.round(22 * s), Math.round(10 * s));
  g.fillRect(Math.round(5 * s), Math.round(3 * s), Math.round(18 * s), Math.round(2 * s));
  g.fillRect(Math.round(5 * s), Math.round(15 * s), Math.round(18 * s), Math.round(2 * s));

  g.fillStyle(waterShallow);
  g.fillRect(Math.round(5 * s), Math.round(6 * s), Math.round(18 * s), Math.round(8 * s));
  g.fillRect(Math.round(7 * s), Math.round(5 * s), Math.round(14 * s), Math.round(1 * s));
  g.fillRect(Math.round(7 * s), Math.round(14 * s), Math.round(14 * s), Math.round(1 * s));

  g.fillStyle(waterDeep);
  g.fillRect(Math.round(8 * s), Math.round(8 * s), Math.round(12 * s), Math.round(4 * s));

  g.fillStyle(waterHighlight);
  g.fillRect(Math.round(9 * s), Math.round(7 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillRect(Math.round(15 * s), Math.round(9 * s), Math.round(2 * s), Math.round(1 * s));
  g.fillRect(Math.round(11 * s), Math.round(12 * s), Math.round(2 * s), Math.round(1 * s));

  g.fillStyle(rockLight);
  g.fillRect(Math.round(2 * s), Math.round(4 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillRect(Math.round(22 * s), Math.round(3 * s), Math.round(2 * s), Math.round(1 * s));
  g.fillRect(Math.round(4 * s), Math.round(16 * s), Math.round(2 * s), Math.round(1 * s));

  g.fillStyle(seaweedGreen);
  g.fillRect(Math.round(4 * s), Math.round(5 * s), Math.round(2 * s), Math.round(3 * s));
  g.fillRect(Math.round(20 * s), Math.round(13 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillStyle(seaweedDark);
  g.fillRect(Math.round(4 * s), Math.round(7 * s), Math.round(1 * s), Math.round(1 * s));
  g.fillRect(Math.round(21 * s), Math.round(14 * s), Math.round(1 * s), Math.round(1 * s));

  g.fillStyle(0xfb923c);
  g.fillRect(Math.round(13 * s), Math.round(10 * s), Math.round(3 * s), Math.round(1 * s));
  g.fillRect(Math.round(14 * s), Math.round(9 * s), Math.round(1 * s), Math.round(3 * s));

  g.generateTexture("tidepool", w, h);
  g.destroy();
}

function generatePalmTree1(scene: Phaser.Scene, s: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const w = Math.round(60 * s);
  const h = Math.round(90 * s);

  const trunkBase = 0x8b7355;
  const trunkDark = 0x6b5344;
  const trunkLight = 0xa08563;
  const leafBase = 0x22c55e;
  const leafDark = 0x166534;

  const centerX = w / 2;
  const trunkBottom = h - Math.round(5 * s);
  const trunkTop = Math.round(35 * s);
  const trunkWidth = Math.round(8 * s);

  g.fillStyle(trunkBase);
  g.fillRect(centerX - trunkWidth / 2, trunkTop, trunkWidth, trunkBottom - trunkTop);

  g.fillStyle(trunkDark);
  for (let ty = trunkTop; ty < trunkBottom; ty += Math.round(6 * s)) {
    g.fillRect(centerX - trunkWidth / 2, ty, trunkWidth, Math.round(2 * s));
  }

  g.fillStyle(trunkLight);
  g.fillRect(centerX - trunkWidth / 2, trunkTop, Math.round(2 * s), trunkBottom - trunkTop);

  const frondLength = Math.round(28 * s);
  const frondWidth = Math.round(8 * s);

  const frondAngles = [-60, -30, 0, 30, 60, 90, 120, 150, 180, 210];

  frondAngles.forEach((angle, i) => {
    const radians = (angle * Math.PI) / 180;
    const endX = centerX + Math.cos(radians) * frondLength;
    const endY = trunkTop + Math.sin(radians) * Math.round(frondLength * 0.6);

    g.fillStyle(i % 2 === 0 ? leafBase : leafDark);
    const steps = 8;
    for (let step = 0; step < steps; step++) {
      const t = step / steps;
      const px = centerX + (endX - centerX) * t;
      const py = trunkTop - Math.round(5 * s) + (endY - trunkTop) * t;
      const sw = Math.round(frondWidth * (1 - t * 0.7));
      g.fillRect(px - sw / 2, py, sw, Math.round(4 * s));
    }
  });

  g.fillStyle(0x8b4513);
  g.fillRect(
    centerX - Math.round(4 * s),
    trunkTop - Math.round(2 * s),
    Math.round(5 * s),
    Math.round(5 * s)
  );
  g.fillRect(centerX, trunkTop - Math.round(4 * s), Math.round(5 * s), Math.round(5 * s));
  g.fillRect(
    centerX - Math.round(6 * s),
    trunkTop + Math.round(2 * s),
    Math.round(4 * s),
    Math.round(4 * s)
  );

  g.generateTexture("palm_tree_1", w, h);
  g.destroy();
}

function generatePalmTree2(scene: Phaser.Scene, s: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const w = Math.round(50 * s);
  const h = Math.round(70 * s);

  const trunkBase = 0x9a8875;
  const trunkDark = 0x7a6855;
  const leafBase = 0x16a34a;
  const leafLight = 0x22c55e;

  const centerX = w / 2;
  const trunkBottom = h - Math.round(5 * s);
  const trunkTop = Math.round(30 * s);
  const trunkWidth = Math.round(6 * s);

  g.fillStyle(trunkBase);
  g.fillRect(centerX - trunkWidth / 2, trunkTop, trunkWidth, trunkBottom - trunkTop);
  g.fillStyle(trunkDark);
  for (let ty = trunkTop; ty < trunkBottom; ty += Math.round(5 * s)) {
    g.fillRect(centerX - trunkWidth / 2, ty, trunkWidth, Math.round(1 * s));
  }

  const frondRadius = Math.round(22 * s);
  g.fillStyle(leafBase);
  g.fillRect(
    centerX - frondRadius,
    trunkTop - Math.round(15 * s),
    frondRadius * 2,
    Math.round(20 * s)
  );

  g.fillStyle(leafLight);
  for (
    let fx = centerX - frondRadius + Math.round(4 * s);
    fx < centerX + frondRadius;
    fx += Math.round(6 * s)
  ) {
    g.fillRect(fx, trunkTop - Math.round(18 * s), Math.round(4 * s), Math.round(25 * s));
  }

  g.fillStyle(leafBase);
  g.fillRect(
    centerX - frondRadius - Math.round(5 * s),
    trunkTop - Math.round(5 * s),
    Math.round(10 * s),
    Math.round(8 * s)
  );
  g.fillRect(
    centerX + frondRadius - Math.round(5 * s),
    trunkTop - Math.round(5 * s),
    Math.round(10 * s),
    Math.round(8 * s)
  );

  g.generateTexture("palm_tree_2", w, h);
  g.destroy();
}

function generatePalmTree3(scene: Phaser.Scene, s: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const w = Math.round(70 * s);
  const h = Math.round(100 * s);

  const trunkBase = 0x7a6855;
  const trunkDark = 0x5a4835;
  const leafBase = 0x15803d;
  const leafLight = 0x22c55e;
  const leafDark = 0x14532d;

  const centerX = w / 2;
  const trunkBottom = h - Math.round(5 * s);
  const trunkTop = Math.round(25 * s);
  const trunkWidth = Math.round(7 * s);

  g.fillStyle(trunkBase);
  for (let ty = trunkTop; ty < trunkBottom; ty += Math.round(2 * s)) {
    const progress = (ty - trunkTop) / (trunkBottom - trunkTop);
    const curveOffset = Math.sin(progress * Math.PI * 0.3) * Math.round(8 * s);
    g.fillRect(centerX - trunkWidth / 2 + curveOffset, ty, trunkWidth, Math.round(3 * s));
  }

  g.fillStyle(trunkDark);
  for (let ty = trunkTop; ty < trunkBottom; ty += Math.round(8 * s)) {
    const progress = (ty - trunkTop) / (trunkBottom - trunkTop);
    const curveOffset = Math.sin(progress * Math.PI * 0.3) * Math.round(8 * s);
    g.fillRect(centerX - trunkWidth / 2 + curveOffset, ty, trunkWidth, Math.round(2 * s));
  }

  const frondLength = Math.round(32 * s);

  g.fillStyle(leafBase);
  g.fillRect(
    centerX - frondLength,
    trunkTop - Math.round(20 * s),
    frondLength * 2,
    Math.round(25 * s)
  );

  const frondCount = 12;
  for (let i = 0; i < frondCount; i++) {
    const angle = (i / frondCount) * Math.PI * 2 - Math.PI / 2;
    const length = frondLength * (0.8 + Math.random() * 0.4);

    g.fillStyle(i % 3 === 0 ? leafLight : i % 3 === 1 ? leafBase : leafDark);

    for (let step = 0; step < 10; step++) {
      const t = step / 10;
      const px = centerX + Math.cos(angle) * length * t;
      const py =
        trunkTop -
        Math.round(10 * s) +
        Math.sin(angle) * length * t * 0.5 +
        t * t * Math.round(15 * s);
      const fw = Math.round(6 * s * (1 - t * 0.8));
      g.fillRect(px - fw / 2, py, fw, Math.round(3 * s));
    }
  }

  g.generateTexture("palm_tree_3", w, h);
  g.destroy();
}

function generatePalmTrees(scene: Phaser.Scene): void {
  const s = SCALE;
  generatePalmTree1(scene, s);
  generatePalmTree2(scene, s);
  generatePalmTree3(scene, s);
}

function generateBeachUmbrella(scene: Phaser.Scene, s: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const w = Math.round(40 * s);
  const h = Math.round(50 * s);

  const poleColor = 0xc4a35d;
  const stripeRed = 0xef4444;
  const stripeWhite = 0xffffff;

  const centerX = w / 2;

  g.fillStyle(poleColor);
  g.fillRect(
    centerX - Math.round(2 * s),
    Math.round(20 * s),
    Math.round(4 * s),
    Math.round(30 * s)
  );

  const canopyTop = Math.round(5 * s);
  const canopyH = Math.round(18 * s);
  const canopyW = Math.round(36 * s);

  const stripeWidth = Math.round(6 * s);
  for (let sx = 0; sx < canopyW; sx += stripeWidth * 2) {
    g.fillStyle(stripeRed);
    g.fillRect(centerX - canopyW / 2 + sx, canopyTop, stripeWidth, canopyH);
    g.fillStyle(stripeWhite);
    g.fillRect(centerX - canopyW / 2 + sx + stripeWidth, canopyTop, stripeWidth, canopyH);
  }

  g.fillStyle(0xdc2626);
  g.fillRect(
    centerX - canopyW / 2,
    canopyTop + canopyH - Math.round(3 * s),
    canopyW,
    Math.round(3 * s)
  );

  g.fillStyle(stripeRed);
  g.fillRect(
    centerX - Math.round(3 * s),
    canopyTop - Math.round(3 * s),
    Math.round(6 * s),
    Math.round(5 * s)
  );

  g.generateTexture("beach_umbrella", w, h);
  g.destroy();
}

function generateSeashells(scene: Phaser.Scene, s: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const w = Math.round(20 * s);
  const h = Math.round(12 * s);

  const shellPink = 0xffc0cb;
  const shellWhite = 0xfff8f0;
  const shellTan = 0xdeb887;

  g.fillStyle(shellPink);
  g.fillRect(Math.round(2 * s), Math.round(3 * s), Math.round(6 * s), Math.round(5 * s));
  g.fillStyle(0xffb6c1);
  g.fillRect(Math.round(3 * s), Math.round(2 * s), Math.round(4 * s), Math.round(2 * s));

  g.fillStyle(shellWhite);
  g.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(4 * s), Math.round(4 * s));
  g.fillRect(Math.round(12 * s), Math.round(3 * s), Math.round(3 * s), Math.round(2 * s));

  g.fillStyle(shellTan);
  g.fillRect(Math.round(16 * s), Math.round(5 * s), Math.round(3 * s), Math.round(4 * s));

  g.generateTexture("beach_shells", w, h);
  g.destroy();
}

function generateSurfboard(scene: Phaser.Scene, s: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const w = Math.round(12 * s);
  const h = Math.round(50 * s);

  const boardColor = 0x4ecdc4;
  const stripeColor = 0xffffff;

  g.fillStyle(boardColor);
  g.fillRect(Math.round(2 * s), Math.round(5 * s), Math.round(8 * s), Math.round(42 * s));

  g.fillRect(Math.round(3 * s), Math.round(2 * s), Math.round(6 * s), Math.round(5 * s));
  g.fillRect(Math.round(4 * s), 0, Math.round(4 * s), Math.round(3 * s));

  g.fillRect(Math.round(3 * s), h - Math.round(6 * s), Math.round(6 * s), Math.round(4 * s));

  g.fillStyle(stripeColor);
  g.fillRect(Math.round(5 * s), Math.round(8 * s), Math.round(2 * s), Math.round(35 * s));

  g.fillStyle(0x1a1a2e);
  g.fillRect(Math.round(4 * s), h - Math.round(3 * s), Math.round(4 * s), Math.round(3 * s));

  g.generateTexture("beach_surfboard", w, h);
  g.destroy();
}

function generateTikiTorch(scene: Phaser.Scene, s: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const w = Math.round(16 * s);
  const h = Math.round(60 * s);

  const bambooColor = 0xc4a35d;
  const bambooDark = 0x8b7355;
  const flameOrange = 0xf97316;
  const flameYellow = 0xfde047;

  const centerX = w / 2;

  g.fillStyle(bambooColor);
  g.fillRect(
    centerX - Math.round(2 * s),
    Math.round(15 * s),
    Math.round(4 * s),
    h - Math.round(15 * s)
  );

  g.fillStyle(bambooDark);
  for (let by = Math.round(20 * s); by < h; by += Math.round(10 * s)) {
    g.fillRect(centerX - Math.round(2 * s), by, Math.round(4 * s), Math.round(2 * s));
  }

  g.fillStyle(0x654321);
  g.fillRect(centerX - Math.round(4 * s), Math.round(10 * s), Math.round(8 * s), Math.round(8 * s));

  g.fillStyle(flameOrange);
  g.fillRect(centerX - Math.round(3 * s), Math.round(3 * s), Math.round(6 * s), Math.round(10 * s));
  g.fillStyle(flameYellow);
  g.fillRect(centerX - Math.round(2 * s), Math.round(5 * s), Math.round(4 * s), Math.round(6 * s));
  g.fillStyle(0xffffff);
  g.fillRect(centerX - Math.round(1 * s), Math.round(7 * s), Math.round(2 * s), Math.round(3 * s));

  g.generateTexture("beach_tiki_torch", w, h);
  g.destroy();
}

function generateBeachChair(scene: Phaser.Scene, s: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const w = Math.round(30 * s);
  const h = Math.round(25 * s);

  const frameColor = 0xc4a35d;
  const fabricBlue = 0x3b82f6;
  const fabricStripe = 0xffffff;

  g.fillStyle(frameColor);
  g.fillRect(Math.round(3 * s), Math.round(15 * s), Math.round(3 * s), Math.round(10 * s));
  g.fillRect(w - Math.round(6 * s), Math.round(15 * s), Math.round(3 * s), Math.round(10 * s));
  g.fillRect(Math.round(12 * s), Math.round(18 * s), Math.round(3 * s), Math.round(7 * s));

  g.fillRect(Math.round(2 * s), Math.round(12 * s), w - Math.round(4 * s), Math.round(3 * s));

  const stripeW = Math.round(4 * s);
  for (let fx = Math.round(4 * s); fx < w - Math.round(4 * s); fx += stripeW * 2) {
    g.fillStyle(fabricBlue);
    g.fillRect(fx, Math.round(5 * s), stripeW, Math.round(8 * s));
    g.fillStyle(fabricStripe);
    g.fillRect(fx + stripeW, Math.round(5 * s), stripeW, Math.round(8 * s));
  }

  g.fillStyle(fabricBlue);
  g.fillRect(Math.round(2 * s), Math.round(2 * s), Math.round(8 * s), Math.round(12 * s));

  g.generateTexture("beach_chair", w, h);
  g.destroy();
}

function generateSandcastle(scene: Phaser.Scene, s: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const w = Math.round(35 * s);
  const h = Math.round(30 * s);

  const sandBase = 0xf4d58d;
  const sandDark = 0xc4a35d;
  const sandLight = 0xfae6b1;
  const flagRed = 0xef4444;

  g.fillStyle(sandBase);
  g.fillRect(Math.round(3 * s), h - Math.round(10 * s), w - Math.round(6 * s), Math.round(10 * s));

  g.fillRect(Math.round(12 * s), Math.round(8 * s), Math.round(12 * s), Math.round(15 * s));

  g.fillRect(Math.round(10 * s), Math.round(5 * s), Math.round(4 * s), Math.round(5 * s));
  g.fillRect(Math.round(15 * s), Math.round(5 * s), Math.round(4 * s), Math.round(5 * s));
  g.fillRect(Math.round(20 * s), Math.round(5 * s), Math.round(4 * s), Math.round(5 * s));

  g.fillRect(Math.round(4 * s), Math.round(12 * s), Math.round(8 * s), Math.round(10 * s));
  g.fillRect(w - Math.round(12 * s), Math.round(12 * s), Math.round(8 * s), Math.round(10 * s));

  g.fillStyle(sandDark);
  g.fillRect(Math.round(12 * s), Math.round(20 * s), Math.round(12 * s), Math.round(3 * s));
  g.fillRect(Math.round(22 * s), Math.round(8 * s), Math.round(2 * s), Math.round(15 * s));

  g.fillStyle(sandLight);
  g.fillRect(Math.round(13 * s), Math.round(10 * s), Math.round(4 * s), Math.round(8 * s));

  g.fillStyle(sandDark);
  g.fillRect(Math.round(16 * s), Math.round(17 * s), Math.round(4 * s), Math.round(6 * s));

  g.fillStyle(0x8b4513);
  g.fillRect(Math.round(17 * s), Math.round(2 * s), Math.round(1 * s), Math.round(6 * s));
  g.fillStyle(flagRed);
  g.fillRect(Math.round(18 * s), Math.round(2 * s), Math.round(5 * s), Math.round(3 * s));

  g.generateTexture("beach_sandcastle", w, h);
  g.destroy();
}

function generateDriftwood(scene: Phaser.Scene, s: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const w = Math.round(40 * s);
  const h = Math.round(15 * s);

  const woodGray = 0x9ca3af;
  const woodDark = 0x6b7280;
  const woodLight = 0xd1d5db;

  g.fillStyle(woodGray);
  g.fillRect(Math.round(2 * s), Math.round(5 * s), Math.round(35 * s), Math.round(8 * s));

  g.fillStyle(woodDark);
  g.fillRect(Math.round(5 * s), Math.round(6 * s), Math.round(8 * s), Math.round(2 * s));
  g.fillRect(Math.round(18 * s), Math.round(9 * s), Math.round(10 * s), Math.round(2 * s));
  g.fillRect(Math.round(30 * s), Math.round(7 * s), Math.round(5 * s), Math.round(3 * s));

  g.fillStyle(woodLight);
  g.fillRect(Math.round(8 * s), Math.round(5 * s), Math.round(12 * s), Math.round(2 * s));
  g.fillRect(Math.round(25 * s), Math.round(5 * s), Math.round(8 * s), Math.round(2 * s));

  g.fillStyle(woodGray);
  g.fillRect(Math.round(12 * s), Math.round(3 * s), Math.round(4 * s), Math.round(4 * s));

  g.generateTexture("beach_driftwood", w, h);
  g.destroy();
}

function generateCoralCluster(scene: Phaser.Scene, s: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const w = Math.round(25 * s);
  const h = Math.round(20 * s);

  const coralPink = 0xfb7185;
  const coralDark = 0xe11d48;
  const coralLight = 0xfda4af;
  const coralOrange = 0xf97316;

  g.fillStyle(coralPink);
  g.fillRect(Math.round(8 * s), Math.round(5 * s), Math.round(4 * s), Math.round(12 * s));
  g.fillRect(Math.round(5 * s), Math.round(8 * s), Math.round(6 * s), Math.round(3 * s));
  g.fillRect(Math.round(10 * s), Math.round(6 * s), Math.round(5 * s), Math.round(3 * s));

  g.fillStyle(coralOrange);
  g.fillRect(Math.round(15 * s), Math.round(7 * s), Math.round(5 * s), Math.round(10 * s));
  g.fillRect(Math.round(17 * s), Math.round(5 * s), Math.round(4 * s), Math.round(4 * s));

  g.fillStyle(coralLight);
  g.fillRect(Math.round(9 * s), Math.round(5 * s), Math.round(2 * s), Math.round(3 * s));
  g.fillRect(Math.round(16 * s), Math.round(7 * s), Math.round(2 * s), Math.round(3 * s));

  g.fillStyle(coralDark);
  g.fillRect(Math.round(11 * s), Math.round(12 * s), Math.round(2 * s), Math.round(5 * s));

  g.generateTexture("beach_coral", w, h);
  g.destroy();
}

function generateBeachDecorations(scene: Phaser.Scene): void {
  const s = SCALE;
  generateBeachUmbrella(scene, s);
  generateSeashells(scene, s);
  generateSurfboard(scene, s);
  generateTikiTorch(scene, s);
  generateBeachChair(scene, s);
  generateSandcastle(scene, s);
  generateDriftwood(scene, s);
  generateCoralCluster(scene, s);
}

function generateMoltbookHQ(scene: Phaser.Scene): void {
  const s = SCALE;
  const g = scene.make.graphics({ x: 0, y: 0 });
  const w = Math.round(100 * s);
  const h = Math.round(140 * s);

  const stoneBase = 0xfaf0e6;
  const stoneDark = 0xd4c4b0;
  const stoneLight = 0xffffff;
  const roofRed = 0xef4444;
  const roofDark = 0xb91c1c;
  const woodBase = 0x8b7355;
  const windowGlow = 0xfde047;
  const beaconGold = 0xfbbf24;

  const centerX = w / 2;
  const baseY = h - Math.round(10 * s);

  g.fillStyle(0x000000, 0.3);
  g.fillRect(Math.round(15 * s), baseY, Math.round(70 * s), Math.round(10 * s));

  g.fillStyle(woodBase);
  g.fillRect(Math.round(10 * s), baseY - Math.round(8 * s), Math.round(80 * s), Math.round(8 * s));
  g.fillStyle(0x6b5344);
  for (let px = Math.round(10 * s); px < Math.round(90 * s); px += Math.round(8 * s)) {
    g.fillRect(px, baseY - Math.round(8 * s), Math.round(1 * s), Math.round(8 * s));
  }

  const towerBottom = baseY - Math.round(8 * s);
  const towerTop = Math.round(35 * s);
  const towerBottomW = Math.round(50 * s);
  const towerTopW = Math.round(35 * s);

  for (let ty = towerTop; ty < towerBottom; ty += Math.round(2 * s)) {
    const progress = (ty - towerTop) / (towerBottom - towerTop);
    const currentW = towerTopW + (towerBottomW - towerTopW) * progress;
    g.fillStyle(stoneBase);
    g.fillRect(centerX - currentW / 2, ty, currentW, Math.round(3 * s));
  }

  const stripeHeight = Math.round(15 * s);
  let isRed = true;
  for (let sy = towerTop; sy < towerBottom; sy += stripeHeight) {
    const progress = (sy - towerTop) / (towerBottom - towerTop);
    const currentW = towerTopW + (towerBottomW - towerTopW) * progress;

    if (isRed) {
      g.fillStyle(roofRed);
      g.fillRect(centerX - currentW / 2, sy, currentW, Math.min(stripeHeight, towerBottom - sy));
    }
    isRed = !isRed;
  }

  g.fillStyle(stoneDark);
  for (let ty = towerTop + Math.round(10 * s); ty < towerBottom; ty += Math.round(20 * s)) {
    const progress = (ty - towerTop) / (towerBottom - towerTop);
    const currentW = towerTopW + (towerBottomW - towerTopW) * progress;
    g.fillRect(centerX - currentW / 2, ty, currentW, Math.round(2 * s));
  }

  g.fillStyle(windowGlow);
  g.fillRect(
    centerX - Math.round(5 * s),
    towerTop + Math.round(20 * s),
    Math.round(10 * s),
    Math.round(12 * s)
  );
  g.fillRect(
    centerX - Math.round(5 * s),
    towerTop + Math.round(50 * s),
    Math.round(10 * s),
    Math.round(12 * s)
  );

  g.fillStyle(0x1a1a2e);
  g.fillRect(
    centerX - Math.round(1 * s),
    towerTop + Math.round(20 * s),
    Math.round(2 * s),
    Math.round(12 * s)
  );
  g.fillRect(
    centerX - Math.round(5 * s),
    towerTop + Math.round(25 * s),
    Math.round(10 * s),
    Math.round(2 * s)
  );

  g.fillStyle(woodBase);
  g.fillRect(
    centerX - Math.round(8 * s),
    towerBottom - Math.round(25 * s),
    Math.round(16 * s),
    Math.round(25 * s)
  );
  g.fillStyle(0x5d3a1a);
  g.fillRect(
    centerX - Math.round(6 * s),
    towerBottom - Math.round(23 * s),
    Math.round(12 * s),
    Math.round(23 * s)
  );
  g.fillStyle(beaconGold);
  g.fillRect(
    centerX + Math.round(2 * s),
    towerBottom - Math.round(12 * s),
    Math.round(2 * s),
    Math.round(2 * s)
  );

  const lanternY = Math.round(20 * s);
  const lanternH = Math.round(18 * s);
  const lanternW = Math.round(40 * s);

  g.fillStyle(stoneDark);
  g.fillRect(centerX - lanternW / 2, towerTop - Math.round(3 * s), lanternW, Math.round(5 * s));

  g.fillStyle(0x87ceeb, 0.7);
  g.fillRect(
    centerX - lanternW / 2 + Math.round(3 * s),
    lanternY,
    lanternW - Math.round(6 * s),
    lanternH
  );

  g.fillStyle(beaconGold);
  g.fillRect(
    centerX - Math.round(8 * s),
    lanternY + Math.round(4 * s),
    Math.round(16 * s),
    Math.round(10 * s)
  );
  g.fillStyle(0xfef3c7);
  g.fillRect(
    centerX - Math.round(5 * s),
    lanternY + Math.round(6 * s),
    Math.round(10 * s),
    Math.round(6 * s)
  );

  g.fillStyle(roofDark);
  g.fillRect(centerX - lanternW / 2, lanternY, Math.round(3 * s), lanternH);
  g.fillRect(centerX + lanternW / 2 - Math.round(3 * s), lanternY, Math.round(3 * s), lanternH);
  g.fillRect(centerX - lanternW / 2, lanternY, lanternW, Math.round(3 * s));

  const roofY = Math.round(5 * s);
  g.fillStyle(roofRed);
  g.fillRect(
    centerX - Math.round(22 * s),
    lanternY - Math.round(5 * s),
    Math.round(44 * s),
    Math.round(8 * s)
  );
  g.fillRect(
    centerX - Math.round(18 * s),
    roofY + Math.round(5 * s),
    Math.round(36 * s),
    Math.round(8 * s)
  );
  g.fillRect(centerX - Math.round(12 * s), roofY, Math.round(24 * s), Math.round(8 * s));

  g.fillStyle(beaconGold);
  g.fillRect(
    centerX - Math.round(3 * s),
    roofY - Math.round(5 * s),
    Math.round(6 * s),
    Math.round(8 * s)
  );
  g.fillRect(
    centerX - Math.round(2 * s),
    roofY - Math.round(8 * s),
    Math.round(4 * s),
    Math.round(4 * s)
  );

  g.fillStyle(roofRed);
  g.fillRect(
    centerX - Math.round(4 * s),
    towerBottom - Math.round(35 * s),
    Math.round(8 * s),
    Math.round(6 * s)
  );
  g.fillRect(
    centerX - Math.round(7 * s),
    towerBottom - Math.round(33 * s),
    Math.round(4 * s),
    Math.round(3 * s)
  );
  g.fillRect(
    centerX + Math.round(3 * s),
    towerBottom - Math.round(33 * s),
    Math.round(4 * s),
    Math.round(3 * s)
  );

  g.fillStyle(woodBase);
  g.fillRect(
    centerX - Math.round(20 * s),
    towerBottom - Math.round(45 * s),
    Math.round(40 * s),
    Math.round(8 * s)
  );
  g.fillStyle(stoneLight);
  g.fillRect(
    centerX - Math.round(18 * s),
    towerBottom - Math.round(43 * s),
    Math.round(36 * s),
    Math.round(4 * s)
  );

  g.generateTexture("moltbook_hq", w, h);
  g.destroy();
}

function generateBeachHut(scene: Phaser.Scene): void {
  const s = SCALE;
  const w = Math.round(80 * s);
  const h = Math.round(70 * s);
  const g = scene.make.graphics({ x: 0, y: 0 });

  const thatchLight = 0xc4a35d;
  const thatchDark = 0x8b7355;
  const thatchShadow = 0x654321;
  const woodBase = 0xa0522d;
  const woodDark = 0x8b4513;
  const woodLight = 0xcd853f;

  const roofTop = Math.round(5 * s);
  const roofBottom = Math.round(35 * s);
  const roofWidth = Math.round(75 * s);
  const roofCenterX = w / 2;

  for (let layer = 0; layer < 6; layer++) {
    const layerY = roofTop + layer * Math.round(5 * s);
    const layerWidth = roofWidth - layer * Math.round(8 * s);
    const layerX = roofCenterX - layerWidth / 2;

    g.fillStyle(layer % 2 === 0 ? thatchLight : thatchDark);
    g.fillRect(layerX, layerY, layerWidth, Math.round(7 * s));

    g.fillStyle(thatchShadow);
    for (let tx = layerX; tx < layerX + layerWidth; tx += Math.round(6 * s)) {
      g.fillRect(tx, layerY + Math.round(2 * s), Math.round(2 * s), Math.round(4 * s));
    }
  }

  g.fillStyle(thatchDark);
  g.fillRect(
    roofCenterX - Math.round(15 * s),
    roofTop - Math.round(3 * s),
    Math.round(30 * s),
    Math.round(5 * s)
  );

  const hutTop = Math.round(32 * s);
  const hutBottom = h;
  const hutWidth = Math.round(50 * s);
  const hutX = roofCenterX - hutWidth / 2;

  g.fillStyle(woodBase);
  g.fillRect(hutX, hutTop, hutWidth, hutBottom - hutTop);

  g.fillStyle(woodDark);
  for (let py = hutTop; py < hutBottom; py += Math.round(8 * s)) {
    g.fillRect(hutX, py, hutWidth, Math.round(2 * s));
  }

  g.fillStyle(woodLight);
  g.fillRect(hutX, hutTop, Math.round(4 * s), hutBottom - hutTop);
  g.fillRect(hutX + hutWidth - Math.round(4 * s), hutTop, Math.round(4 * s), hutBottom - hutTop);

  const doorWidth = Math.round(18 * s);
  const doorHeight = Math.round(30 * s);
  const doorX = roofCenterX - doorWidth / 2;
  const doorY = hutBottom - doorHeight;

  g.fillStyle(0x1a1a2e);
  g.fillRect(doorX, doorY, doorWidth, doorHeight);

  g.fillStyle(woodLight);
  g.fillRect(doorX - Math.round(2 * s), doorY, Math.round(2 * s), doorHeight);
  g.fillRect(doorX + doorWidth, doorY, Math.round(2 * s), doorHeight);
  g.fillRect(
    doorX - Math.round(2 * s),
    doorY - Math.round(2 * s),
    doorWidth + Math.round(4 * s),
    Math.round(2 * s)
  );

  g.fillStyle(0xfde047, 0.4);
  g.fillRect(
    doorX + Math.round(3 * s),
    doorY + Math.round(3 * s),
    doorWidth - Math.round(6 * s),
    doorHeight - Math.round(6 * s)
  );

  g.fillStyle(woodBase);
  g.fillRect(hutX, hutBottom - Math.round(8 * s), hutWidth, Math.round(4 * s));

  g.generateTexture("beach_hut", w, h);
  g.destroy();
}

function generateMoltBar(scene: Phaser.Scene): void {
  const s = SCALE;
  const w = Math.round(140 * s);
  const h = Math.round(100 * s);
  const g = scene.make.graphics({ x: 0, y: 0 });

  const bambooLight = 0xc4a35d;
  const bambooDark = 0x8b7355;
  const bambooMid = 0xa08040;
  const thatchLight = 0xd4a574;
  const thatchDark = 0x8b6914;
  const thatchMid = 0xb8860b;
  const woodBase = 0xa0522d;
  const woodDark = 0x8b4513;
  const woodLight = 0xcd853f;
  const barTop = 0x654321;
  const barTopLight = 0x8b7355;
  const stoolSeat = 0xdeb887;
  const stoolLeg = 0x654321;
  const neonPink = 0xff69b4;
  const neonCyan = 0x00ced1;
  const bottleGreen = 0x228b22;
  const bottleAmber = 0xffbf00;
  const bottleClear = 0xe0ffff;
  const glassBlue = 0x87ceeb;

  const roofTop = Math.round(5 * s);
  const roofBottom = Math.round(45 * s);
  const roofWidth = Math.round(135 * s);
  const roofCenterX = w / 2;

  for (let layer = 0; layer < 8; layer++) {
    const layerY = roofTop + layer * Math.round(5 * s);
    const layerWidth = roofWidth - layer * Math.round(6 * s);
    const layerX = roofCenterX - layerWidth / 2;

    const thatchColor = layer % 3 === 0 ? thatchLight : layer % 3 === 1 ? thatchMid : thatchDark;
    g.fillStyle(thatchColor);
    g.fillRect(layerX, layerY, layerWidth, Math.round(7 * s));

    g.fillStyle(darken(thatchColor, 0.2));
    for (let tx = layerX; tx < layerX + layerWidth; tx += Math.round(5 * s)) {
      g.fillRect(tx, layerY + Math.round(1 * s), Math.round(1 * s), Math.round(5 * s));
    }

    g.fillStyle(lighten(thatchColor, 0.15));
    for (let tx = layerX + Math.round(3 * s); tx < layerX + layerWidth; tx += Math.round(10 * s)) {
      g.fillRect(tx, layerY + Math.round(2 * s), Math.round(1 * s), Math.round(3 * s));
    }
  }

  g.fillStyle(thatchDark);
  g.fillRect(
    roofCenterX - Math.round(20 * s),
    roofTop - Math.round(4 * s),
    Math.round(40 * s),
    Math.round(6 * s)
  );

  g.fillStyle(woodDark);
  g.fillRect(
    roofCenterX - Math.round(6 * s),
    roofTop - Math.round(2 * s),
    Math.round(12 * s),
    Math.round(8 * s)
  );
  g.fillStyle(0xffffff);
  g.fillRect(roofCenterX - Math.round(4 * s), roofTop, Math.round(3 * s), Math.round(2 * s));
  g.fillRect(roofCenterX + Math.round(1 * s), roofTop, Math.round(3 * s), Math.round(2 * s));
  g.fillStyle(0xff0000);
  g.fillRect(
    roofCenterX - Math.round(3 * s),
    roofTop + Math.round(4 * s),
    Math.round(6 * s),
    Math.round(2 * s)
  );

  const polePositions = [
    Math.round(15 * s),
    Math.round(45 * s),
    Math.round(95 * s),
    Math.round(125 * s),
  ];

  polePositions.forEach((px) => {
    g.fillStyle(bambooMid);
    g.fillRect(
      px - Math.round(3 * s),
      roofBottom - Math.round(5 * s),
      Math.round(6 * s),
      h - roofBottom + Math.round(5 * s)
    );

    g.fillStyle(bambooDark);
    for (let jointY = roofBottom; jointY < h; jointY += Math.round(15 * s)) {
      g.fillRect(px - Math.round(4 * s), jointY, Math.round(8 * s), Math.round(3 * s));
    }

    g.fillStyle(bambooLight);
    g.fillRect(
      px - Math.round(3 * s),
      roofBottom - Math.round(5 * s),
      Math.round(2 * s),
      h - roofBottom + Math.round(5 * s)
    );
  });

  const barTop_y = Math.round(60 * s);
  const barHeight = Math.round(12 * s);
  const barX = Math.round(25 * s);
  const barWidth = Math.round(90 * s);

  g.fillStyle(barTop);
  g.fillRect(barX, barTop_y, barWidth, barHeight);

  g.fillStyle(barTopLight);
  g.fillRect(barX, barTop_y, barWidth, Math.round(3 * s));

  g.fillStyle(woodBase);
  g.fillRect(barX, barTop_y + barHeight, barWidth, Math.round(25 * s));

  g.fillStyle(bambooDark);
  for (let bx = barX + Math.round(8 * s); bx < barX + barWidth; bx += Math.round(12 * s)) {
    g.fillRect(bx, barTop_y + barHeight + Math.round(3 * s), Math.round(4 * s), Math.round(19 * s));
  }

  const stoolPositions = [
    Math.round(35 * s),
    Math.round(55 * s),
    Math.round(75 * s),
    Math.round(95 * s),
  ];

  stoolPositions.forEach((sx) => {
    g.fillStyle(stoolLeg);
    g.fillRect(
      sx - Math.round(5 * s),
      h - Math.round(22 * s),
      Math.round(3 * s),
      Math.round(22 * s)
    );
    g.fillRect(
      sx + Math.round(2 * s),
      h - Math.round(22 * s),
      Math.round(3 * s),
      Math.round(22 * s)
    );

    g.fillStyle(stoolSeat);
    g.fillRect(
      sx - Math.round(7 * s),
      h - Math.round(25 * s),
      Math.round(14 * s),
      Math.round(5 * s)
    );

    g.fillStyle(lighten(stoolSeat, 0.2));
    g.fillRect(
      sx - Math.round(6 * s),
      h - Math.round(25 * s),
      Math.round(12 * s),
      Math.round(2 * s)
    );
  });

  const shelfY = Math.round(48 * s);
  const bottlePositions = [
    { x: Math.round(30 * s), color: bottleGreen, h: Math.round(10 * s) },
    { x: Math.round(38 * s), color: bottleAmber, h: Math.round(12 * s) },
    { x: Math.round(46 * s), color: bottleClear, h: Math.round(9 * s) },
    { x: Math.round(54 * s), color: bottleGreen, h: Math.round(11 * s) },
    { x: Math.round(62 * s), color: 0x8b0000, h: Math.round(10 * s) },
    { x: Math.round(70 * s), color: bottleAmber, h: Math.round(12 * s) },
    { x: Math.round(78 * s), color: bottleClear, h: Math.round(9 * s) },
    { x: Math.round(86 * s), color: 0x4169e1, h: Math.round(11 * s) },
    { x: Math.round(94 * s), color: bottleGreen, h: Math.round(10 * s) },
    { x: Math.round(102 * s), color: bottleAmber, h: Math.round(8 * s) },
  ];

  bottlePositions.forEach((bottle) => {
    g.fillStyle(bottle.color);
    g.fillRect(bottle.x, shelfY - bottle.h, Math.round(5 * s), bottle.h);
    g.fillRect(
      bottle.x + Math.round(1 * s),
      shelfY - bottle.h - Math.round(3 * s),
      Math.round(3 * s),
      Math.round(4 * s)
    );
    g.fillStyle(lighten(bottle.color, 0.4), 0.5);
    g.fillRect(
      bottle.x + Math.round(1 * s),
      shelfY - bottle.h + Math.round(2 * s),
      Math.round(1 * s),
      bottle.h - Math.round(4 * s)
    );
  });

  g.fillStyle(woodDark);
  g.fillRect(Math.round(25 * s), shelfY, Math.round(90 * s), Math.round(3 * s));

  g.fillStyle(glassBlue, 0.7);
  g.fillRect(
    Math.round(40 * s),
    barTop_y - Math.round(8 * s),
    Math.round(6 * s),
    Math.round(7 * s)
  );
  g.fillStyle(0xff6347);
  g.fillRect(
    Math.round(41 * s),
    barTop_y - Math.round(7 * s),
    Math.round(4 * s),
    Math.round(4 * s)
  );
  g.fillStyle(neonPink);
  g.fillRect(
    Math.round(44 * s),
    barTop_y - Math.round(12 * s),
    Math.round(1 * s),
    Math.round(8 * s)
  );

  g.fillStyle(glassBlue, 0.7);
  g.fillRect(
    Math.round(80 * s),
    barTop_y - Math.round(8 * s),
    Math.round(6 * s),
    Math.round(7 * s)
  );
  g.fillStyle(0x32cd32);
  g.fillRect(
    Math.round(81 * s),
    barTop_y - Math.round(7 * s),
    Math.round(4 * s),
    Math.round(4 * s)
  );
  g.fillStyle(0xff1493);
  g.fillRect(
    Math.round(82 * s),
    barTop_y - Math.round(14 * s),
    Math.round(6 * s),
    Math.round(3 * s)
  );
  g.fillStyle(woodDark);
  g.fillRect(
    Math.round(84 * s),
    barTop_y - Math.round(14 * s),
    Math.round(1 * s),
    Math.round(10 * s)
  );

  g.fillStyle(0x1a1a2e);
  g.fillRect(Math.round(35 * s), Math.round(15 * s), Math.round(70 * s), Math.round(18 * s));
  g.fillStyle(0x2d2d44);
  g.fillRect(Math.round(36 * s), Math.round(16 * s), Math.round(68 * s), Math.round(16 * s));

  g.fillStyle(neonPink, 0.3);
  g.fillRect(Math.round(33 * s), Math.round(13 * s), Math.round(76 * s), Math.round(22 * s));

  g.fillStyle(neonPink);
  g.fillRect(Math.round(40 * s), Math.round(19 * s), Math.round(4 * s), Math.round(10 * s));
  g.fillRect(Math.round(44 * s), Math.round(19 * s), Math.round(1 * s), Math.round(2 * s));
  g.fillRect(Math.round(40 * s), Math.round(24 * s), Math.round(5 * s), Math.round(2 * s));

  g.fillRect(Math.round(48 * s), Math.round(19 * s), Math.round(4 * s), Math.round(10 * s));
  g.fillRect(Math.round(52 * s), Math.round(19 * s), Math.round(1 * s), Math.round(4 * s));
  g.fillRect(Math.round(52 * s), Math.round(25 * s), Math.round(1 * s), Math.round(4 * s));

  g.fillRect(Math.round(56 * s), Math.round(19 * s), Math.round(4 * s), Math.round(10 * s));
  g.fillRect(Math.round(60 * s), Math.round(19 * s), Math.round(1 * s), Math.round(2 * s));
  g.fillRect(Math.round(56 * s), Math.round(24 * s), Math.round(5 * s), Math.round(2 * s));

  g.fillRect(Math.round(64 * s), Math.round(19 * s), Math.round(4 * s), Math.round(10 * s));
  g.fillRect(Math.round(68 * s), Math.round(19 * s), Math.round(1 * s), Math.round(5 * s));
  g.fillRect(Math.round(68 * s), Math.round(25 * s), Math.round(2 * s), Math.round(4 * s));

  g.fillStyle(neonCyan);
  g.fillRect(Math.round(38 * s), Math.round(31 * s), Math.round(64 * s), Math.round(2 * s));

  g.fillStyle(bambooDark);
  g.fillRect(Math.round(5 * s), Math.round(40 * s), Math.round(4 * s), Math.round(55 * s));
  g.fillStyle(0xff6600);
  g.fillRect(Math.round(4 * s), Math.round(32 * s), Math.round(6 * s), Math.round(10 * s));
  g.fillStyle(0xffcc00);
  g.fillRect(Math.round(5 * s), Math.round(34 * s), Math.round(4 * s), Math.round(6 * s));
  g.fillStyle(0xffff00);
  g.fillRect(Math.round(6 * s), Math.round(36 * s), Math.round(2 * s), Math.round(3 * s));

  g.fillStyle(bambooDark);
  g.fillRect(w - Math.round(9 * s), Math.round(40 * s), Math.round(4 * s), Math.round(55 * s));
  g.fillStyle(0xff6600);
  g.fillRect(w - Math.round(10 * s), Math.round(32 * s), Math.round(6 * s), Math.round(10 * s));
  g.fillStyle(0xffcc00);
  g.fillRect(w - Math.round(9 * s), Math.round(34 * s), Math.round(4 * s), Math.round(6 * s));
  g.fillStyle(0xffff00);
  g.fillRect(w - Math.round(8 * s), Math.round(36 * s), Math.round(2 * s), Math.round(3 * s));

  const lightColors = [neonPink, neonCyan, 0xffff00, 0x00ff00, 0xff6600];
  for (let lx = Math.round(20 * s); lx < w - Math.round(15 * s); lx += Math.round(12 * s)) {
    const lightColor = lightColors[Math.floor((lx / Math.round(12 * s)) % lightColors.length)];
    g.fillStyle(0x333333);
    g.fillRect(lx, Math.round(42 * s), Math.round(12 * s), Math.round(1 * s));
    g.fillStyle(lightColor);
    g.fillRect(lx + Math.round(5 * s), Math.round(43 * s), Math.round(3 * s), Math.round(4 * s));
    g.fillStyle(lightColor, 0.3);
    g.fillRect(lx + Math.round(4 * s), Math.round(42 * s), Math.round(5 * s), Math.round(6 * s));
  }

  g.generateTexture("molt_bar", w, h);
  g.destroy();
}

// Bounty Board — wooden bulletin board with pinned notices
function generateBountyBoard(scene: Phaser.Scene): void {
  const s = SCALE;
  const g = scene.make.graphics({ x: 0, y: 0 });
  const w = Math.round(55 * s);
  const h = Math.round(80 * s);

  // Board colors
  const woodDark = 0x5c3d2e;
  const woodBase = 0x7a5033;
  const woodLight = 0x96643f;
  const boardBg = 0xc4a36e; // Cork-like background
  const boardFrame = 0x4a2d1c;
  const paperWhite = 0xfff8e7;
  const paperYellow = 0xfff3b0;
  const paperGreen = 0xc8e6c9;
  const paperBlue = 0xbbdefb;
  const pinRed = 0xe53935;
  const pinYellow = 0xfdd835;
  const pinGreen = 0x43a047;

  // Posts / legs
  const postW = Math.round(5 * s);
  const postH = Math.round(30 * s);
  const boardTop = Math.round(10 * s);
  const boardH = Math.round(40 * s);
  const boardLeft = Math.round(5 * s);
  const boardW = w - Math.round(10 * s);

  // Left post
  g.fillStyle(woodDark);
  g.fillRect(Math.round(10 * s), boardTop + boardH, postW, postH);
  g.fillStyle(woodBase);
  g.fillRect(Math.round(11 * s), boardTop + boardH, Math.round(3 * s), postH);

  // Right post
  g.fillStyle(woodDark);
  g.fillRect(w - Math.round(15 * s), boardTop + boardH, postW, postH);
  g.fillStyle(woodBase);
  g.fillRect(w - Math.round(14 * s), boardTop + boardH, Math.round(3 * s), postH);

  // Board frame
  g.fillStyle(boardFrame);
  g.fillRect(boardLeft, boardTop, boardW, boardH);

  // Cork background
  g.fillStyle(boardBg);
  g.fillRect(
    boardLeft + Math.round(2 * s),
    boardTop + Math.round(2 * s),
    boardW - Math.round(4 * s),
    boardH - Math.round(4 * s)
  );

  // Cork texture dots
  g.fillStyle(darken(boardBg, 15));
  for (let dy = 0; dy < boardH - Math.round(8 * s); dy += Math.round(5 * s)) {
    for (let dx = 0; dx < boardW - Math.round(8 * s); dx += Math.round(7 * s)) {
      g.fillRect(
        boardLeft + Math.round(4 * s) + dx,
        boardTop + Math.round(4 * s) + dy,
        Math.round(1 * s),
        Math.round(1 * s)
      );
    }
  }

  // Frame highlight on top & left
  g.fillStyle(woodLight);
  g.fillRect(boardLeft, boardTop, boardW, Math.round(1 * s));
  g.fillRect(boardLeft, boardTop, Math.round(1 * s), boardH);

  // Pinned notices (3 small paper rectangles)
  const notices = [
    {
      x: boardLeft + Math.round(5 * s),
      y: boardTop + Math.round(5 * s),
      color: paperWhite,
      pin: pinRed,
    },
    {
      x: boardLeft + Math.round(18 * s),
      y: boardTop + Math.round(8 * s),
      color: paperYellow,
      pin: pinGreen,
    },
    {
      x: boardLeft + Math.round(5 * s),
      y: boardTop + Math.round(20 * s),
      color: paperGreen,
      pin: pinYellow,
    },
    {
      x: boardLeft + Math.round(22 * s),
      y: boardTop + Math.round(22 * s),
      color: paperBlue,
      pin: pinRed,
    },
  ];

  const noteW = Math.round(14 * s);
  const noteH = Math.round(12 * s);
  for (const note of notices) {
    // Paper shadow
    g.fillStyle(0x000000, 0.15);
    g.fillRect(note.x + Math.round(1 * s), note.y + Math.round(1 * s), noteW, noteH);
    // Paper
    g.fillStyle(note.color);
    g.fillRect(note.x, note.y, noteW, noteH);
    // Text lines on paper
    g.fillStyle(0x999999);
    g.fillRect(
      note.x + Math.round(2 * s),
      note.y + Math.round(3 * s),
      noteW - Math.round(4 * s),
      Math.round(1 * s)
    );
    g.fillRect(
      note.x + Math.round(2 * s),
      note.y + Math.round(6 * s),
      noteW - Math.round(6 * s),
      Math.round(1 * s)
    );
    g.fillRect(
      note.x + Math.round(2 * s),
      note.y + Math.round(9 * s),
      noteW - Math.round(5 * s),
      Math.round(1 * s)
    );
    // Pin
    g.fillStyle(note.pin);
    g.fillRect(
      note.x + Math.round(6 * s),
      note.y - Math.round(1 * s),
      Math.round(3 * s),
      Math.round(3 * s)
    );
    // Pin highlight
    g.fillStyle(lighten(note.pin, 40));
    g.fillRect(
      note.x + Math.round(7 * s),
      note.y - Math.round(1 * s),
      Math.round(1 * s),
      Math.round(1 * s)
    );
  }

  // "BOUNTY" sign on top
  const signW = Math.round(36 * s);
  const signH = Math.round(10 * s);
  const signX = Math.round((w - signW) / 2);
  const signY = boardTop - Math.round(2 * s);

  g.fillStyle(woodDark);
  g.fillRect(signX, signY, signW, signH);
  g.fillStyle(woodBase);
  g.fillRect(
    signX + Math.round(1 * s),
    signY + Math.round(1 * s),
    signW - Math.round(2 * s),
    signH - Math.round(2 * s)
  );

  g.generateTexture("bounty_board", w, h);
  g.destroy();
}

export function generateMoltbookAssets(scene: Phaser.Scene): void {
  generateBeachGround(scene);
  generateBeachBuildings(scene);
  generateCrabSprite(scene);
  generateLobsterSprite(scene);
  generateHermitCrabSprite(scene);
  generateCoconutSprite(scene);
  generateTidepoolSprite(scene);
  generatePalmTrees(scene);
  generateBeachDecorations(scene);
  generateMoltbookHQ(scene);
  generateBeachHut(scene);
  generateMoltBar(scene);
  generateBountyBoard(scene);
}
