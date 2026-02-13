import * as Phaser from "phaser";
import { SCALE, PALETTE, darken, lighten } from "./constants";

export function generateArcadeBuilding(scene: Phaser.Scene): void {
  const s = SCALE;
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Bigger canvas for the upgraded arcade
  const canvasWidth = Math.round(110 * s);
  const canvasHeight = Math.round(220 * s);
  const bWidth = Math.round(90 * s);
  const bHeight = Math.round(150 * s);
  const bLeft = Math.round(10 * s);
  const bTop = canvasHeight - bHeight;

  // ===== DROP SHADOW =====
  g.fillStyle(PALETTE.void, 0.45);
  g.fillRect(bLeft + Math.round(6 * s), bTop + Math.round(6 * s), bWidth, bHeight);

  // ===== BUILDING BODY (brick texture) =====
  const bodyColor = 0x2a1a3e; // Dark purple-gray for retro arcade
  g.fillStyle(bodyColor);
  g.fillRect(bLeft, bTop, bWidth, bHeight);

  // Brick dithering pattern
  const brickColor = lighten(bodyColor, 0.08);
  for (let row = 0; row < bHeight; row += Math.round(6 * s)) {
    const offset = (row / Math.round(6 * s)) % 2 === 0 ? 0 : Math.round(5 * s);
    for (let col = offset; col < bWidth; col += Math.round(10 * s)) {
      g.fillStyle(brickColor);
      g.fillRect(bLeft + col, bTop + row, Math.round(9 * s), Math.round(5 * s));
      // Mortar lines (darker)
      g.fillStyle(darken(bodyColor, 0.15));
      g.fillRect(bLeft + col + Math.round(9 * s), bTop + row, Math.round(1 * s), Math.round(5 * s));
      g.fillRect(
        bLeft + col,
        bTop + row + Math.round(5 * s),
        Math.round(10 * s),
        Math.round(1 * s)
      );
    }
  }

  // 3D depth - light left edge
  g.fillStyle(lighten(bodyColor, 0.18));
  g.fillRect(bLeft, bTop, Math.round(3 * s), bHeight);
  // 3D depth - dark right edge
  g.fillStyle(darken(bodyColor, 0.25));
  g.fillRect(bLeft + bWidth - Math.round(3 * s), bTop, Math.round(3 * s), bHeight);

  // ===== ROOFTOP DETAILS =====
  // Roof cap
  const roofY = bTop - Math.round(6 * s);
  g.fillStyle(PALETTE.darkGray);
  g.fillRect(bLeft - Math.round(2 * s), roofY, bWidth + Math.round(4 * s), Math.round(6 * s));
  g.fillStyle(lighten(PALETTE.darkGray, 0.15));
  g.fillRect(bLeft - Math.round(2 * s), roofY, bWidth + Math.round(4 * s), Math.round(2 * s));

  // AC unit (left)
  const acX = bLeft + Math.round(8 * s);
  const acY = roofY - Math.round(10 * s);
  g.fillStyle(PALETTE.midGray);
  g.fillRect(acX, acY, Math.round(14 * s), Math.round(10 * s));
  g.fillStyle(lighten(PALETTE.midGray, 0.15));
  g.fillRect(acX, acY, Math.round(14 * s), Math.round(2 * s));
  g.fillStyle(darken(PALETTE.midGray, 0.2));
  g.fillRect(acX + Math.round(12 * s), acY, Math.round(2 * s), Math.round(10 * s));
  // AC vent lines
  for (let i = 0; i < 3; i++) {
    g.fillStyle(PALETTE.darkGray);
    g.fillRect(
      acX + Math.round(2 * s),
      acY + Math.round((3 + i * 2) * s),
      Math.round(10 * s),
      Math.round(1 * s)
    );
  }

  // Antenna (right)
  const antX = bLeft + bWidth - Math.round(18 * s);
  const antY = roofY - Math.round(18 * s);
  g.fillStyle(PALETTE.silver);
  g.fillRect(antX, antY, Math.round(2 * s), Math.round(18 * s));
  g.fillStyle(PALETTE.brightRed);
  g.fillCircle(antX + Math.round(1 * s), antY, Math.round(2 * s));
  // Antenna crossbar
  g.fillStyle(PALETTE.silver);
  g.fillRect(
    antX - Math.round(4 * s),
    antY + Math.round(6 * s),
    Math.round(10 * s),
    Math.round(1 * s)
  );

  // ===== MARQUEE SIGN (large "ARCADE" billboard) =====
  const marqueeW = Math.round(80 * s);
  const marqueeH = Math.round(24 * s);
  const marqueeX = bLeft + (bWidth - marqueeW) / 2;
  const marqueeY = roofY - Math.round(28 * s);

  // Marquee backing (dark)
  g.fillStyle(darken(PALETTE.night, 0.3));
  g.fillRect(
    marqueeX - Math.round(2 * s),
    marqueeY - Math.round(2 * s),
    marqueeW + Math.round(4 * s),
    marqueeH + Math.round(4 * s)
  );

  // Marquee face
  g.fillStyle(PALETTE.night);
  g.fillRect(marqueeX, marqueeY, marqueeW, marqueeH);

  // Marquee highlight top
  g.fillStyle(lighten(PALETTE.night, 0.12));
  g.fillRect(marqueeX, marqueeY, marqueeW, Math.round(3 * s));

  // Chase light bulbs around marquee border (static frame - animation in zone)
  // We draw all bulb positions in alternating green/purple
  const bulbR = Math.round(1.8 * s);
  const bulbSpacing = Math.round(5 * s);

  // Top row of bulbs
  for (let i = 0; i < 16; i++) {
    const bx = marqueeX + Math.round(2 * s) + i * bulbSpacing;
    const by = marqueeY + Math.round(1 * s);
    const col = i % 2 === 0 ? PALETTE.bagsGreen : PALETTE.lavender;
    g.fillStyle(col, 0.5);
    g.fillCircle(bx, by, bulbR + Math.round(1 * s)); // glow
    g.fillStyle(col);
    g.fillCircle(bx, by, bulbR);
  }
  // Bottom row of bulbs
  for (let i = 0; i < 16; i++) {
    const bx = marqueeX + Math.round(2 * s) + i * bulbSpacing;
    const by = marqueeY + marqueeH - Math.round(1 * s);
    const col = i % 2 === 0 ? PALETTE.lavender : PALETTE.bagsGreen;
    g.fillStyle(col, 0.5);
    g.fillCircle(bx, by, bulbR + Math.round(1 * s));
    g.fillStyle(col);
    g.fillCircle(bx, by, bulbR);
  }
  // Left column of bulbs
  for (let i = 0; i < 4; i++) {
    const bx = marqueeX + Math.round(1 * s);
    const by = marqueeY + Math.round(4 * s) + i * bulbSpacing;
    const col = i % 2 === 0 ? PALETTE.bagsGreen : PALETTE.lavender;
    g.fillStyle(col, 0.5);
    g.fillCircle(bx, by, bulbR + Math.round(1 * s));
    g.fillStyle(col);
    g.fillCircle(bx, by, bulbR);
  }
  // Right column of bulbs
  for (let i = 0; i < 4; i++) {
    const bx = marqueeX + marqueeW - Math.round(1 * s);
    const by = marqueeY + Math.round(4 * s) + i * bulbSpacing;
    const col = i % 2 === 0 ? PALETTE.lavender : PALETTE.bagsGreen;
    g.fillStyle(col, 0.5);
    g.fillCircle(bx, by, bulbR + Math.round(1 * s));
    g.fillStyle(col);
    g.fillCircle(bx, by, bulbR);
  }

  // "ARCADE" text rendered as pixel blocks inside marquee
  drawPixelText(
    g,
    "ARCADE",
    marqueeX + Math.round(6 * s),
    marqueeY + Math.round(7 * s),
    Math.round(2 * s),
    PALETTE.bagsGreen
  );

  // ===== UPPER FLOOR - WINDOWS WITH CRT GLOW =====
  const winRowY = bTop + Math.round(15 * s);
  for (let i = 0; i < 3; i++) {
    const wx = bLeft + Math.round(8 * s) + i * Math.round(28 * s);
    const wy = winRowY;
    const ww = Math.round(22 * s);
    const wh = Math.round(28 * s);

    // Window frame (darker brick)
    g.fillStyle(darken(bodyColor, 0.3));
    g.fillRect(
      wx - Math.round(2 * s),
      wy - Math.round(2 * s),
      ww + Math.round(4 * s),
      wh + Math.round(4 * s)
    );

    // Window sill
    g.fillStyle(PALETTE.midGray);
    g.fillRect(wx - Math.round(3 * s), wy + wh, ww + Math.round(6 * s), Math.round(3 * s));

    // Glass (dark interior)
    g.fillStyle(darken(PALETTE.night, 0.4));
    g.fillRect(wx, wy, ww, wh);

    // CRT greenish glow inside
    g.fillStyle(PALETTE.green, 0.2);
    g.fillRect(
      wx + Math.round(2 * s),
      wy + Math.round(2 * s),
      ww - Math.round(4 * s),
      wh - Math.round(4 * s)
    );

    // Arcade cabinet silhouette inside each window
    const cabX = wx + Math.round(5 * s);
    const cabY = wy + Math.round(4 * s);
    // Cabinet body
    g.fillStyle(PALETTE.darkGray, 0.7);
    g.fillRect(cabX, cabY, Math.round(12 * s), Math.round(20 * s));
    // Cabinet screen (bright CRT)
    const screenColor = i === 0 ? PALETTE.bagsGreen : i === 1 ? PALETTE.cyan : PALETTE.amber;
    g.fillStyle(screenColor, 0.6);
    g.fillRect(
      cabX + Math.round(2 * s),
      cabY + Math.round(2 * s),
      Math.round(8 * s),
      Math.round(8 * s)
    );
    // Screen glow aura
    g.fillStyle(screenColor, 0.15);
    g.fillRect(cabX, cabY, Math.round(12 * s), Math.round(12 * s));

    // Window divider (cross pane)
    g.fillStyle(PALETTE.midGray);
    g.fillRect(wx + ww / 2 - Math.round(1 * s), wy, Math.round(2 * s), wh);
    g.fillRect(wx, wy + wh / 2 - Math.round(1 * s), ww, Math.round(2 * s));

    // Highlight corner
    g.fillStyle(PALETTE.white, 0.2);
    g.fillRect(
      wx + Math.round(1 * s),
      wy + Math.round(1 * s),
      Math.round(4 * s),
      Math.round(3 * s)
    );
  }

  // ===== "OPEN 24HR" NEON SIGN (left side) =====
  const signX = bLeft + Math.round(4 * s);
  const signY = bTop + Math.round(52 * s);
  // Sign backing
  g.fillStyle(PALETTE.void, 0.6);
  g.fillRect(signX, signY, Math.round(18 * s), Math.round(10 * s));
  // Neon glow
  g.fillStyle(PALETTE.brightRed, 0.2);
  g.fillRect(
    signX - Math.round(1 * s),
    signY - Math.round(1 * s),
    Math.round(20 * s),
    Math.round(12 * s)
  );
  // Sign text as small pixel blocks
  drawPixelText(
    g,
    "OPEN",
    signX + Math.round(2 * s),
    signY + Math.round(2 * s),
    Math.round(1 * s),
    PALETTE.brightRed
  );

  // ===== "HIGH SCORES" SIGN (right side) =====
  const hsX = bLeft + bWidth - Math.round(24 * s);
  const hsY = bTop + Math.round(52 * s);
  g.fillStyle(PALETTE.void, 0.6);
  g.fillRect(hsX, hsY, Math.round(20 * s), Math.round(10 * s));
  g.fillStyle(PALETTE.amber, 0.2);
  g.fillRect(
    hsX - Math.round(1 * s),
    hsY - Math.round(1 * s),
    Math.round(22 * s),
    Math.round(12 * s)
  );
  drawPixelText(
    g,
    "HI-SC",
    hsX + Math.round(1 * s),
    hsY + Math.round(2 * s),
    Math.round(1 * s),
    PALETTE.amber
  );

  // ===== AWNING / CANOPY WITH STRIPES =====
  const awningY = bTop + Math.round(68 * s);
  const awningW = bWidth + Math.round(6 * s);
  const awningH = Math.round(10 * s);
  const awningX = bLeft - Math.round(3 * s);

  // Awning body
  g.fillStyle(PALETTE.purple);
  g.fillRect(awningX, awningY, awningW, awningH);
  // Stripes
  for (let i = 0; i < awningW; i += Math.round(8 * s)) {
    g.fillStyle(PALETTE.violet);
    g.fillRect(awningX + i, awningY, Math.round(4 * s), awningH);
  }
  // Awning edge shadow
  g.fillStyle(darken(PALETTE.purple, 0.3));
  g.fillRect(awningX, awningY + awningH - Math.round(2 * s), awningW, Math.round(2 * s));
  // Awning highlight
  g.fillStyle(lighten(PALETTE.purple, 0.2));
  g.fillRect(awningX, awningY, awningW, Math.round(2 * s));
  // Scalloped edge (triangles)
  for (let i = 0; i < awningW; i += Math.round(6 * s)) {
    g.fillStyle(PALETTE.purple);
    g.fillTriangle(
      awningX + i,
      awningY + awningH,
      awningX + i + Math.round(3 * s),
      awningY + awningH + Math.round(4 * s),
      awningX + i + Math.round(6 * s),
      awningY + awningH
    );
  }

  // ===== GAME POSTERS ON WALL (below awning, flanking door) =====
  // Left poster - "METAL BAGS"
  const posterW = Math.round(14 * s);
  const posterH = Math.round(18 * s);
  const posterLX = bLeft + Math.round(6 * s);
  const posterY = awningY + awningH + Math.round(8 * s);

  g.fillStyle(PALETTE.navy);
  g.fillRect(posterLX, posterY, posterW, posterH);
  // Poster art (simple pixel character)
  g.fillStyle(PALETTE.amber);
  g.fillRect(
    posterLX + Math.round(3 * s),
    posterY + Math.round(3 * s),
    Math.round(8 * s),
    Math.round(10 * s)
  );
  g.fillStyle(PALETTE.brightRed);
  g.fillRect(
    posterLX + Math.round(5 * s),
    posterY + Math.round(5 * s),
    Math.round(4 * s),
    Math.round(4 * s)
  );
  // Poster border
  g.fillStyle(PALETTE.gold);
  g.fillRect(posterLX, posterY, posterW, Math.round(1 * s));
  g.fillRect(posterLX, posterY + posterH - Math.round(1 * s), posterW, Math.round(1 * s));
  g.fillRect(posterLX, posterY, Math.round(1 * s), posterH);
  g.fillRect(posterLX + posterW - Math.round(1 * s), posterY, Math.round(1 * s), posterH);

  // Right poster - "COIN OP"
  const posterRX = bLeft + bWidth - Math.round(20 * s);
  g.fillStyle(PALETTE.deepPurple);
  g.fillRect(posterRX, posterY, posterW, posterH);
  // Coin icon
  g.fillStyle(PALETTE.gold);
  g.fillCircle(posterRX + posterW / 2, posterY + Math.round(8 * s), Math.round(5 * s));
  g.fillStyle(PALETTE.amber);
  g.fillCircle(posterRX + posterW / 2, posterY + Math.round(8 * s), Math.round(3 * s));
  // Dollar sign on coin
  g.fillStyle(PALETTE.gold);
  g.fillRect(
    posterRX + posterW / 2 - Math.round(1 * s),
    posterY + Math.round(5 * s),
    Math.round(2 * s),
    Math.round(6 * s)
  );
  // Poster border
  g.fillStyle(PALETTE.lavender);
  g.fillRect(posterRX, posterY, posterW, Math.round(1 * s));
  g.fillRect(posterRX, posterY + posterH - Math.round(1 * s), posterW, Math.round(1 * s));
  g.fillRect(posterRX, posterY, Math.round(1 * s), posterH);
  g.fillRect(posterRX + posterW - Math.round(1 * s), posterY, Math.round(1 * s), posterH);

  // ===== SIDE NEON TUBES =====
  const tubeLen = Math.round(40 * s);
  // Left tube
  g.fillStyle(PALETTE.bagsGreen, 0.2);
  g.fillRect(
    bLeft + Math.round(2 * s),
    bTop + Math.round(20 * s),
    Math.round(5 * s),
    tubeLen + Math.round(4 * s)
  );
  g.fillStyle(PALETTE.bagsGreen);
  g.fillRect(bLeft + Math.round(3 * s), bTop + Math.round(22 * s), Math.round(3 * s), tubeLen);
  g.fillStyle(lighten(PALETTE.bagsGreen, 0.4));
  g.fillRect(bLeft + Math.round(3 * s), bTop + Math.round(22 * s), Math.round(1 * s), tubeLen);

  // Right tube
  g.fillStyle(PALETTE.lavender, 0.2);
  g.fillRect(
    bLeft + bWidth - Math.round(7 * s),
    bTop + Math.round(20 * s),
    Math.round(5 * s),
    tubeLen + Math.round(4 * s)
  );
  g.fillStyle(PALETTE.lavender);
  g.fillRect(
    bLeft + bWidth - Math.round(6 * s),
    bTop + Math.round(22 * s),
    Math.round(3 * s),
    tubeLen
  );
  g.fillStyle(lighten(PALETTE.lavender, 0.4));
  g.fillRect(
    bLeft + bWidth - Math.round(6 * s),
    bTop + Math.round(22 * s),
    Math.round(1 * s),
    tubeLen
  );

  // ===== RECESSED ENTRANCE WITH DOUBLE DOORS =====
  const doorW = Math.round(30 * s);
  const doorH = Math.round(34 * s);
  const doorX = bLeft + (bWidth - doorW) / 2;
  const doorY = canvasHeight - doorH;

  // Steps / stoop (3 steps)
  for (let step = 0; step < 3; step++) {
    const stepW = doorW + Math.round((6 - step * 2) * s);
    const stepX = doorX - Math.round((3 - step) * s);
    const stepY = canvasHeight - Math.round((step + 1) * 3 * s);
    g.fillStyle(lighten(PALETTE.gray, 0.05 + step * 0.05));
    g.fillRect(stepX, stepY, stepW, Math.round(3 * s));
    g.fillStyle(lighten(PALETTE.gray, 0.15 + step * 0.05));
    g.fillRect(stepX, stepY, stepW, Math.round(1 * s));
  }

  // Recessed entrance wall (darker)
  g.fillStyle(darken(bodyColor, 0.35));
  g.fillRect(
    doorX - Math.round(2 * s),
    doorY - Math.round(6 * s),
    doorW + Math.round(4 * s),
    doorH + Math.round(6 * s) - Math.round(9 * s)
  );

  // Door frame (green neon)
  g.fillStyle(PALETTE.green);
  g.fillRect(
    doorX - Math.round(3 * s),
    doorY - Math.round(7 * s),
    doorW + Math.round(6 * s),
    Math.round(2 * s)
  );
  g.fillRect(
    doorX - Math.round(3 * s),
    doorY - Math.round(7 * s),
    Math.round(2 * s),
    doorH + Math.round(7 * s) - Math.round(9 * s)
  );
  g.fillRect(
    doorX + doorW + Math.round(1 * s),
    doorY - Math.round(7 * s),
    Math.round(2 * s),
    doorH + Math.round(7 * s) - Math.round(9 * s)
  );
  // Neon frame glow
  g.fillStyle(PALETTE.green, 0.15);
  g.fillRect(
    doorX - Math.round(5 * s),
    doorY - Math.round(9 * s),
    doorW + Math.round(10 * s),
    doorH + Math.round(9 * s) - Math.round(7 * s)
  );

  // Left door panel
  const halfDoor = (doorW - Math.round(2 * s)) / 2;
  g.fillStyle(darken(bodyColor, 0.45));
  g.fillRect(
    doorX,
    doorY - Math.round(5 * s),
    halfDoor,
    doorH + Math.round(5 * s) - Math.round(9 * s)
  );
  // Right door panel
  g.fillStyle(darken(bodyColor, 0.5));
  g.fillRect(
    doorX + halfDoor + Math.round(2 * s),
    doorY - Math.round(5 * s),
    halfDoor,
    doorH + Math.round(5 * s) - Math.round(9 * s)
  );
  // Door divider
  g.fillStyle(PALETTE.green);
  g.fillRect(
    doorX + halfDoor,
    doorY - Math.round(5 * s),
    Math.round(2 * s),
    doorH + Math.round(5 * s) - Math.round(9 * s)
  );

  // Glass panels on doors (reflection)
  const glassH = Math.round(16 * s);
  const glassY = doorY;
  // Left glass
  g.fillStyle(PALETTE.green, 0.12);
  g.fillRect(doorX + Math.round(3 * s), glassY, halfDoor - Math.round(6 * s), glassH);
  g.fillStyle(PALETTE.white, 0.08);
  g.fillRect(
    doorX + Math.round(4 * s),
    glassY + Math.round(1 * s),
    Math.round(4 * s),
    Math.round(6 * s)
  );
  // Right glass
  g.fillStyle(PALETTE.green, 0.12);
  g.fillRect(doorX + halfDoor + Math.round(5 * s), glassY, halfDoor - Math.round(6 * s), glassH);
  g.fillStyle(PALETTE.white, 0.08);
  g.fillRect(
    doorX + halfDoor + Math.round(6 * s),
    glassY + Math.round(1 * s),
    Math.round(4 * s),
    Math.round(6 * s)
  );

  // Door handles
  g.fillStyle(PALETTE.silver);
  g.fillRect(
    doorX + halfDoor - Math.round(3 * s),
    doorY + Math.round(8 * s),
    Math.round(2 * s),
    Math.round(5 * s)
  );
  g.fillRect(
    doorX + halfDoor + Math.round(3 * s),
    doorY + Math.round(8 * s),
    Math.round(2 * s),
    Math.round(5 * s)
  );

  // ===== LIGHT SPILL FROM ENTRANCE =====
  // Warm glow cone on the ground in front of door
  g.fillStyle(PALETTE.gold, 0.08);
  g.fillTriangle(
    doorX,
    canvasHeight - Math.round(9 * s),
    doorX + doorW,
    canvasHeight - Math.round(9 * s),
    doorX + doorW / 2,
    canvasHeight
  );
  g.fillStyle(PALETTE.bagsGreen, 0.06);
  g.fillTriangle(
    doorX + Math.round(4 * s),
    canvasHeight - Math.round(9 * s),
    doorX + doorW - Math.round(4 * s),
    canvasHeight - Math.round(9 * s),
    doorX + doorW / 2,
    canvasHeight - Math.round(2 * s)
  );

  // ===== JOYSTICK DECORATIVE ICON (left of door) =====
  const joyX = bLeft + Math.round(14 * s);
  const joyY = doorY - Math.round(14 * s);
  // Joystick base
  g.fillStyle(PALETTE.silver);
  g.fillRect(
    joyX - Math.round(4 * s),
    joyY + Math.round(4 * s),
    Math.round(8 * s),
    Math.round(3 * s)
  );
  // Stick
  g.fillStyle(PALETTE.lightGray);
  g.fillRect(
    joyX - Math.round(1 * s),
    joyY - Math.round(3 * s),
    Math.round(2 * s),
    Math.round(7 * s)
  );
  // Ball top
  g.fillStyle(PALETTE.brightRed);
  g.fillCircle(joyX, joyY - Math.round(3 * s), Math.round(3 * s));
  g.fillStyle(lighten(PALETTE.brightRed, 0.3));
  g.fillCircle(joyX - Math.round(1 * s), joyY - Math.round(4 * s), Math.round(1 * s));

  // ===== COIN SLOT ICON (right of door) =====
  const coinX = bLeft + bWidth - Math.round(14 * s);
  const coinY = doorY - Math.round(12 * s);
  // Coin insert plate
  g.fillStyle(PALETTE.darkGray);
  g.fillRect(
    coinX - Math.round(5 * s),
    coinY - Math.round(4 * s),
    Math.round(10 * s),
    Math.round(10 * s)
  );
  g.fillStyle(PALETTE.midGray);
  g.fillRect(
    coinX - Math.round(4 * s),
    coinY - Math.round(3 * s),
    Math.round(8 * s),
    Math.round(8 * s)
  );
  // Coin slot
  g.fillStyle(PALETTE.void);
  g.fillRect(coinX - Math.round(2 * s), coinY, Math.round(4 * s), Math.round(2 * s));
  // Coin (dropping in)
  g.fillStyle(PALETTE.gold);
  g.fillCircle(coinX, coinY - Math.round(1 * s), Math.round(2.5 * s));
  g.fillStyle(PALETTE.yellow);
  g.fillCircle(coinX, coinY - Math.round(1 * s), Math.round(1.5 * s));

  // ===== GREEN NEON TRIM AT BASE =====
  g.fillStyle(PALETTE.green);
  g.fillRect(bLeft, canvasHeight - Math.round(9 * s), bWidth, Math.round(3 * s));
  g.fillStyle(PALETTE.bagsGreen);
  g.fillRect(bLeft, canvasHeight - Math.round(9 * s), bWidth, Math.round(1 * s));

  g.generateTexture("arcade_building", canvasWidth, canvasHeight);
  g.destroy();
}

/**
 * Draw simple pixel-font text. Each letter is a 3x5 grid of pixels.
 * Only supports A-Z, 0-9, dash, and space.
 */
function drawPixelText(
  g: Phaser.GameObjects.Graphics,
  text: string,
  startX: number,
  startY: number,
  pixelSize: number,
  color: number
): void {
  const font: Record<string, number[]> = {
    A: [0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1],
    R: [1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1],
    C: [0, 1, 1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 1],
    D: [1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0],
    E: [1, 1, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1],
    O: [0, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 0],
    P: [1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 0, 1, 0, 0],
    N: [1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1],
    H: [1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1],
    I: [1, 1, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 1, 1],
    S: [0, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 0],
    "-": [0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0],
    " ": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  };

  let cursorX = startX;
  for (const char of text.toUpperCase()) {
    const glyph = font[char];
    if (glyph) {
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 3; col++) {
          if (glyph[row * 3 + col]) {
            g.fillStyle(color);
            g.fillRect(cursorX + col * pixelSize, startY + row * pixelSize, pixelSize, pixelSize);
          }
        }
      }
    }
    cursorX += pixelSize * 4; // 3px char + 1px spacing
  }
}
