import * as Phaser from "phaser";

export function generateLaunchPadAssets(scene: Phaser.Scene): void {
  // Billboard/Screen - large display for live data (NYC Times Square style)
  generateBillboard(scene);

  // Neon sign frame
  generateNeonSign(scene);

  // Skyscraper silhouettes for background
  generateSkyscraperSilhouettes(scene);

  // Digital ticker display
  generateTickerDisplay(scene);

  // Concrete/asphalt ground for urban feel
  generateUrbanGround(scene);

  // Street lamp (urban style)
  generateStreetLamp(scene);

  // Neon tube decorations
  generateNeonTubes(scene);
}

function generateBillboard(scene: Phaser.Scene): void {
  // Large LED billboard screen (120x80 pixels)
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Frame (dark metal)
  g.fillStyle(0x1f2937);
  g.fillRect(0, 0, 120, 80);

  // Inner frame border
  g.fillStyle(0x374151);
  g.fillRect(2, 2, 116, 76);

  // Screen area (dark when off, will be overlaid with data)
  g.fillStyle(0x0a0a0f);
  g.fillRect(4, 4, 112, 72);

  // LED grid effect (subtle)
  g.fillStyle(0x111827);
  for (let x = 4; x < 116; x += 4) {
    g.fillRect(x, 4, 1, 72);
  }
  for (let y = 4; y < 76; y += 4) {
    g.fillRect(4, y, 112, 1);
  }

  // Corner brackets (structural)
  g.fillStyle(0x4b5563);
  g.fillRect(0, 0, 8, 3);
  g.fillRect(0, 0, 3, 8);
  g.fillRect(112, 0, 8, 3);
  g.fillRect(117, 0, 3, 8);
  g.fillRect(0, 77, 8, 3);
  g.fillRect(0, 72, 3, 8);
  g.fillRect(112, 77, 8, 3);
  g.fillRect(117, 72, 3, 8);

  // Support pole (at bottom center)
  g.fillStyle(0x374151);
  g.fillRect(55, 78, 10, 20);
  g.fillStyle(0x4b5563);
  g.fillRect(57, 78, 6, 20);

  g.generateTexture("billboard", 120, 100);
  g.destroy();

  // Smaller screen variant (for side displays)
  const small = scene.make.graphics({ x: 0, y: 0 });
  small.fillStyle(0x1f2937);
  small.fillRect(0, 0, 60, 45);
  small.fillStyle(0x0a0a0f);
  small.fillRect(2, 2, 56, 41);
  // LED grid
  small.fillStyle(0x111827);
  for (let x = 2; x < 58; x += 3) {
    small.fillRect(x, 2, 1, 41);
  }
  small.generateTexture("billboard_small", 60, 45);
  small.destroy();
}

function generateNeonSign(scene: Phaser.Scene): void {
  // "CITY" neon sign
  const g = scene.make.graphics({ x: 0, y: 0 });
  const signWidth = 60;
  const signHeight = 24;

  // Backing board
  g.fillStyle(0x1a1a1a);
  g.fillRect(0, 0, signWidth, signHeight);

  // Border glow effect (gold for city)
  g.fillStyle(0xfbbf24, 0.4);
  g.fillRect(0, 0, signWidth, 2);
  g.fillRect(0, signHeight - 2, signWidth, 2);
  g.fillRect(0, 0, 2, signHeight);
  g.fillRect(signWidth - 2, 0, 2, signHeight);

  // Neon text "CITY" (stylized pixel letters) - gold color
  g.fillStyle(0xfbbf24);
  const startX = 8;
  const y = 6;
  const letterH = 12;
  const spacing = 12;

  // C
  g.fillRect(startX, y, 2, letterH);
  g.fillRect(startX, y, 7, 2);
  g.fillRect(startX, y + letterH - 2, 7, 2);
  // I
  g.fillRect(startX + spacing, y, 6, 2);
  g.fillRect(startX + spacing + 2, y, 2, letterH);
  g.fillRect(startX + spacing, y + letterH - 2, 6, 2);
  // T
  g.fillRect(startX + spacing * 2, y, 8, 2);
  g.fillRect(startX + spacing * 2 + 3, y, 2, letterH);
  // Y
  g.fillRect(startX + spacing * 3, y, 2, 5);
  g.fillRect(startX + spacing * 3 + 6, y, 2, 5);
  g.fillRect(startX + spacing * 3 + 2, y + 3, 2, 2);
  g.fillRect(startX + spacing * 3 + 4, y + 3, 2, 2);
  g.fillRect(startX + spacing * 3 + 3, y + 5, 2, 7);

  // Glow effect around letters
  g.fillStyle(0xfbbf24, 0.2);
  g.fillRect(4, 4, signWidth - 8, signHeight - 8);

  g.generateTexture("neon_trending", signWidth, signHeight);
  g.destroy();

  // "NEW" neon sign (red/gold)
  const newSign = scene.make.graphics({ x: 0, y: 0 });
  newSign.fillStyle(0x1a1a1a);
  newSign.fillRect(0, 0, 50, 20);

  // Glow border
  newSign.fillStyle(0xef4444, 0.3);
  newSign.fillRect(0, 0, 50, 2);
  newSign.fillRect(0, 18, 50, 2);

  // "NEW" text
  newSign.fillStyle(0xef4444);
  // N
  newSign.fillRect(6, 5, 2, 10);
  newSign.fillRect(14, 5, 2, 10);
  newSign.fillRect(8, 6, 2, 2);
  newSign.fillRect(10, 8, 2, 2);
  newSign.fillRect(12, 10, 2, 2);
  // E
  newSign.fillRect(18, 5, 2, 10);
  newSign.fillRect(20, 5, 6, 2);
  newSign.fillRect(20, 9, 4, 2);
  newSign.fillRect(20, 13, 6, 2);
  // W
  newSign.fillRect(28, 5, 2, 10);
  newSign.fillRect(36, 5, 2, 10);
  newSign.fillRect(30, 11, 2, 4);
  newSign.fillRect(32, 9, 2, 4);
  newSign.fillRect(34, 11, 2, 4);

  newSign.generateTexture("neon_new", 50, 20);
  newSign.destroy();

  // Blinking arrow (for attention)
  const arrow = scene.make.graphics({ x: 0, y: 0 });
  arrow.fillStyle(0xfbbf24);
  arrow.fillTriangle(0, 10, 16, 0, 16, 20);
  arrow.fillRect(16, 6, 14, 8);
  // Glow
  arrow.fillStyle(0xfbbf24, 0.3);
  arrow.fillTriangle(-2, 10, 18, -2, 18, 22);
  arrow.generateTexture("neon_arrow", 32, 22);
  arrow.destroy();
}

function generateSkyscraperSilhouettes(scene: Phaser.Scene): void {
  // Tall building silhouette for background (dark, moody NYC style)
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Building 1 - tall tower
  g.fillStyle(0x111827);
  g.fillRect(0, 40, 30, 160);
  // Antenna
  g.fillRect(13, 20, 4, 20);
  g.fillStyle(0xef4444);
  g.fillCircle(15, 18, 2);
  // Windows (faint lights)
  g.fillStyle(0xfbbf24, 0.3);
  for (let y = 50; y < 190; y += 12) {
    for (let x = 4; x < 26; x += 8) {
      if (Math.random() > 0.3) {
        g.fillRect(x, y, 4, 6);
      }
    }
  }

  // Building 2 - medium tower
  g.fillStyle(0x1f2937);
  g.fillRect(35, 80, 25, 120);
  // Windows
  g.fillStyle(0x60a5fa, 0.2);
  for (let y = 90; y < 190; y += 10) {
    for (let x = 38; x < 58; x += 7) {
      if (Math.random() > 0.4) {
        g.fillRect(x, y, 4, 5);
      }
    }
  }

  // Building 3 - short wide
  g.fillStyle(0x0f172a);
  g.fillRect(65, 120, 35, 80);
  // Billboard on top
  g.fillStyle(0x4ade80, 0.4);
  g.fillRect(70, 110, 25, 12);

  g.generateTexture("skyline_bg", 100, 200);
  g.destroy();
}

function generateTickerDisplay(scene: Phaser.Scene): void {
  // Horizontal ticker/news crawl display
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Housing
  g.fillStyle(0x1f2937);
  g.fillRect(0, 0, 200, 16);

  // Screen area
  g.fillStyle(0x0a0a0f);
  g.fillRect(2, 2, 196, 12);

  // LED dots effect
  g.fillStyle(0x111827);
  for (let x = 2; x < 198; x += 2) {
    g.fillRect(x, 2, 1, 12);
  }

  g.generateTexture("ticker_display", 200, 16);
  g.destroy();
}

function generateUrbanGround(scene: Phaser.Scene): void {
  // Concrete/asphalt texture
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Base asphalt
  g.fillStyle(0x374151);
  g.fillRect(0, 0, 32, 32);

  // Variation spots
  g.fillStyle(0x4b5563);
  for (let i = 0; i < 8; i++) {
    const x = Math.floor(Math.random() * 28);
    const y = Math.floor(Math.random() * 28);
    g.fillRect(x, y, 3, 3);
  }

  // Cracks
  g.fillStyle(0x1f2937);
  g.fillRect(8, 0, 1, 12);
  g.fillRect(8, 12, 6, 1);
  g.fillRect(20, 15, 1, 17);

  g.generateTexture("concrete", 32, 32);
  g.destroy();

  // Sidewalk
  const sidewalk = scene.make.graphics({ x: 0, y: 0 });
  sidewalk.fillStyle(0x6b7280);
  sidewalk.fillRect(0, 0, 32, 32);
  // Grid lines
  sidewalk.fillStyle(0x4b5563);
  sidewalk.fillRect(0, 15, 32, 2);
  sidewalk.fillRect(15, 0, 2, 32);
  // Texture
  sidewalk.fillStyle(0x9ca3af);
  sidewalk.fillRect(4, 4, 2, 2);
  sidewalk.fillRect(20, 22, 2, 2);
  sidewalk.generateTexture("sidewalk", 32, 32);
  sidewalk.destroy();
}

function generateStreetLamp(scene: Phaser.Scene): void {
  // Modern urban street lamp
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Pole
  g.fillStyle(0x374151);
  g.fillRect(8, 20, 4, 50);
  g.fillStyle(0x4b5563);
  g.fillRect(9, 20, 2, 50);

  // Lamp arm
  g.fillStyle(0x374151);
  g.fillRect(10, 16, 14, 3);

  // Lamp housing
  g.fillStyle(0x1f2937);
  g.fillRect(16, 10, 12, 8);

  // Light (glowing)
  g.fillStyle(0xfbbf24, 0.8);
  g.fillRect(18, 16, 8, 4);

  // Light glow effect
  g.fillStyle(0xfbbf24, 0.2);
  g.fillRect(14, 18, 16, 20);
  g.fillStyle(0xfbbf24, 0.1);
  g.fillRect(10, 22, 24, 30);

  g.generateTexture("street_lamp", 32, 70);
  g.destroy();
}

function generateNeonTubes(scene: Phaser.Scene): void {
  // Vertical neon tube (green)
  const greenTube = scene.make.graphics({ x: 0, y: 0 });
  greenTube.fillStyle(0x4ade80, 0.3);
  greenTube.fillRect(0, 0, 8, 60);
  greenTube.fillStyle(0x4ade80, 0.6);
  greenTube.fillRect(2, 0, 4, 60);
  greenTube.fillStyle(0x4ade80);
  greenTube.fillRect(3, 0, 2, 60);
  greenTube.generateTexture("neon_tube_green", 8, 60);
  greenTube.destroy();

  // Horizontal neon tube (pink/magenta)
  const pinkTube = scene.make.graphics({ x: 0, y: 0 });
  pinkTube.fillStyle(0xec4899, 0.3);
  pinkTube.fillRect(0, 0, 80, 6);
  pinkTube.fillStyle(0xec4899, 0.6);
  pinkTube.fillRect(0, 1, 80, 4);
  pinkTube.fillStyle(0xec4899);
  pinkTube.fillRect(0, 2, 80, 2);
  pinkTube.generateTexture("neon_tube_pink", 80, 6);
  pinkTube.destroy();

  // Blue neon tube
  const blueTube = scene.make.graphics({ x: 0, y: 0 });
  blueTube.fillStyle(0x3b82f6, 0.3);
  blueTube.fillRect(0, 0, 6, 40);
  blueTube.fillStyle(0x3b82f6, 0.6);
  blueTube.fillRect(1, 0, 4, 40);
  blueTube.fillStyle(0x3b82f6);
  blueTube.fillRect(2, 0, 2, 40);
  blueTube.generateTexture("neon_tube_blue", 6, 40);
  blueTube.destroy();

  // Gold/yellow neon tube
  const goldTube = scene.make.graphics({ x: 0, y: 0 });
  goldTube.fillStyle(0xfbbf24, 0.3);
  goldTube.fillRect(0, 0, 60, 6);
  goldTube.fillStyle(0xfbbf24, 0.6);
  goldTube.fillRect(0, 1, 60, 4);
  goldTube.fillStyle(0xfbbf24);
  goldTube.fillRect(0, 2, 60, 2);
  goldTube.generateTexture("neon_tube_gold", 60, 6);
  goldTube.destroy();

  // Generate additional city assets
  generateCityAssets(scene);
}

function generateCityAssets(scene: Phaser.Scene): void {
  // Parked car (side view)
  generateCar(scene);

  // Fire hydrant
  generateFireHydrant(scene);

  // Trash can
  generateTrashCan(scene);

  // Road markings
  generateRoadMarkings(scene);

  // Advertising poster
  generateAdPoster(scene);

  // Traffic light
  generateTrafficLight(scene);

  // Taxi/cab variant
  generateTaxi(scene);
}

function generateCar(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Shadow
  g.fillStyle(0x000000, 0.3);
  g.fillRect(4, 22, 44, 6);

  // Car body (blue sedan)
  g.fillStyle(0x1e40af);
  g.fillRect(4, 8, 44, 14);

  // Lighter top for 3D effect
  g.fillStyle(0x3b82f6);
  g.fillRect(4, 8, 44, 4);

  // Roof/cabin
  g.fillStyle(0x1e3a8a);
  g.fillRect(14, 2, 22, 8);

  // Windows (glass)
  g.fillStyle(0x60a5fa, 0.8);
  g.fillRect(16, 4, 8, 5);
  g.fillRect(26, 4, 8, 5);

  // Window frame
  g.fillStyle(0x0f172a);
  g.fillRect(24, 4, 2, 5);

  // Wheels
  g.fillStyle(0x1f2937);
  g.fillCircle(12, 20, 5);
  g.fillCircle(40, 20, 5);

  // Wheel centers (hubcaps)
  g.fillStyle(0x6b7280);
  g.fillCircle(12, 20, 2);
  g.fillCircle(40, 20, 2);

  // Headlights
  g.fillStyle(0xfef3c7);
  g.fillRect(46, 12, 2, 4);

  // Taillights
  g.fillStyle(0xef4444);
  g.fillRect(4, 12, 2, 4);

  g.generateTexture("car_blue", 52, 28);
  g.destroy();
}

function generateFireHydrant(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Shadow
  g.fillStyle(0x000000, 0.3);
  g.fillRect(2, 22, 12, 4);

  // Base
  g.fillStyle(0xdc2626);
  g.fillRect(4, 18, 8, 6);

  // Body
  g.fillStyle(0xef4444);
  g.fillRect(3, 8, 10, 12);

  // Cap
  g.fillStyle(0xb91c1c);
  g.fillRect(2, 4, 12, 6);
  g.fillRect(5, 2, 6, 4);

  // Side valves
  g.fillStyle(0xfbbf24);
  g.fillRect(0, 10, 4, 4);
  g.fillRect(12, 10, 4, 4);

  // Highlight
  g.fillStyle(0xfca5a5, 0.5);
  g.fillRect(5, 8, 2, 10);

  g.generateTexture("fire_hydrant", 16, 26);
  g.destroy();
}

function generateTrashCan(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Shadow
  g.fillStyle(0x000000, 0.3);
  g.fillRect(2, 26, 16, 4);

  // Can body
  g.fillStyle(0x374151);
  g.fillRect(2, 8, 16, 20);

  // Darker side for 3D
  g.fillStyle(0x1f2937);
  g.fillRect(2, 8, 4, 20);

  // Lid
  g.fillStyle(0x4b5563);
  g.fillRect(0, 4, 20, 6);

  // Handle
  g.fillStyle(0x6b7280);
  g.fillRect(8, 2, 4, 4);

  // Recycling symbol area
  g.fillStyle(0x4ade80);
  g.fillRect(6, 14, 8, 8);

  g.generateTexture("trash_can", 20, 30);
  g.destroy();
}

function generateRoadMarkings(scene: Phaser.Scene): void {
  // Crosswalk
  const crosswalk = scene.make.graphics({ x: 0, y: 0 });
  crosswalk.fillStyle(0x374151);
  crosswalk.fillRect(0, 0, 60, 30);

  // White stripes
  crosswalk.fillStyle(0xffffff, 0.9);
  for (let x = 4; x < 56; x += 10) {
    crosswalk.fillRect(x, 2, 6, 26);
  }

  crosswalk.generateTexture("crosswalk", 60, 30);
  crosswalk.destroy();

  // Road line (dashed)
  const roadLine = scene.make.graphics({ x: 0, y: 0 });
  roadLine.fillStyle(0xfbbf24);
  roadLine.fillRect(0, 0, 20, 4);
  roadLine.generateTexture("road_line", 20, 4);
  roadLine.destroy();
}

function generateAdPoster(scene: Phaser.Scene): void {
  // Wall-mounted advertisement poster
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Frame
  g.fillStyle(0x1f2937);
  g.fillRect(0, 0, 40, 50);

  // Poster background
  g.fillStyle(0x0a0a0f);
  g.fillRect(2, 2, 36, 46);

  // "BAGS" brand ad
  g.fillStyle(0x4ade80);
  g.fillRect(6, 6, 28, 12);

  // Abstract art lines
  g.fillStyle(0xfbbf24);
  g.fillRect(8, 22, 24, 2);
  g.fillStyle(0xec4899);
  g.fillRect(8, 28, 20, 2);
  g.fillStyle(0x3b82f6);
  g.fillRect(8, 34, 16, 2);

  // "TRADE NOW" text area
  g.fillStyle(0xfbbf24, 0.8);
  g.fillRect(6, 40, 28, 6);

  g.generateTexture("ad_poster", 40, 50);
  g.destroy();
}

function generateTrafficLight(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Pole
  g.fillStyle(0x374151);
  g.fillRect(6, 36, 4, 30);

  // Light housing
  g.fillStyle(0x1f2937);
  g.fillRect(0, 0, 16, 38);

  // Light frame
  g.fillStyle(0x374151);
  g.fillRect(1, 1, 14, 36);

  // Red light (top) - off
  g.fillStyle(0x7f1d1d);
  g.fillCircle(8, 8, 4);

  // Yellow light (middle) - off
  g.fillStyle(0x78350f);
  g.fillCircle(8, 19, 4);

  // Green light (bottom) - on
  g.fillStyle(0x4ade80);
  g.fillCircle(8, 30, 4);
  // Glow
  g.fillStyle(0x4ade80, 0.3);
  g.fillCircle(8, 30, 6);

  g.generateTexture("traffic_light", 16, 66);
  g.destroy();
}

function generateTaxi(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Shadow
  g.fillStyle(0x000000, 0.3);
  g.fillRect(4, 22, 44, 6);

  // Car body (yellow taxi)
  g.fillStyle(0xeab308);
  g.fillRect(4, 8, 44, 14);

  // Lighter top for 3D effect
  g.fillStyle(0xfbbf24);
  g.fillRect(4, 8, 44, 4);

  // Roof/cabin
  g.fillStyle(0xca8a04);
  g.fillRect(14, 2, 22, 8);

  // Taxi sign on roof
  g.fillStyle(0xfef3c7);
  g.fillRect(20, 0, 10, 4);

  // Windows (glass)
  g.fillStyle(0x60a5fa, 0.8);
  g.fillRect(16, 4, 8, 5);
  g.fillRect(26, 4, 8, 5);

  // Window frame
  g.fillStyle(0x0f172a);
  g.fillRect(24, 4, 2, 5);

  // Checkered stripe
  g.fillStyle(0x0f172a);
  for (let x = 6; x < 46; x += 4) {
    if ((x / 4) % 2 === 0) {
      g.fillRect(x, 14, 4, 4);
    }
  }

  // Wheels
  g.fillStyle(0x1f2937);
  g.fillCircle(12, 20, 5);
  g.fillCircle(40, 20, 5);

  // Wheel centers (hubcaps)
  g.fillStyle(0x6b7280);
  g.fillCircle(12, 20, 2);
  g.fillCircle(40, 20, 2);

  // Headlights
  g.fillStyle(0xfef3c7);
  g.fillRect(46, 12, 2, 4);

  // Taillights
  g.fillStyle(0xef4444);
  g.fillRect(4, 12, 2, 4);

  g.generateTexture("taxi", 52, 28);
  g.destroy();
}
