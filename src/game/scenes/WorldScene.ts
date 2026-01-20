import * as Phaser from "phaser";
import type { WorldState, GameCharacter, GameBuilding, ZoneType } from "@/lib/types";

interface Animal {
  sprite: Phaser.GameObjects.Sprite;
  type: "dog" | "cat" | "bird" | "butterfly" | "squirrel";
  targetX: number;
  speed: number;
  direction: "left" | "right";
  idleTimer: number;
  isIdle: boolean;
}

export class WorldScene extends Phaser.Scene {
  private worldState: WorldState | null = null;
  private characterSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private characterVariants: Map<string, number> = new Map(); // Store which variant each character uses
  private buildingSprites: Map<string, Phaser.GameObjects.Container> = new Map();
  private weatherEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private clouds: Phaser.GameObjects.Sprite[] = [];
  private decorations: Phaser.GameObjects.Sprite[] = [];
  private animals: Animal[] = [];
  private fountainWater: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private ground!: Phaser.GameObjects.TileSprite;
  private timeOfDay = 0;
  private overlay!: Phaser.GameObjects.Rectangle;
  private sunSprite: Phaser.GameObjects.Sprite | null = null;
  private fireflies: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private ambientParticles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private skyGradient: Phaser.GameObjects.Graphics | null = null;
  private stars: Phaser.GameObjects.Arc[] = [];
  private musicPlaying = false;
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private musicInterval: number | null = null;
  private currentTrack = 0;
  private trackNames = ["Adventure", "Bags Anthem", "Night Market", "Victory March"];

  // Store bound event handlers for cleanup
  private boundToggleMusic: (() => void) | null = null;
  private boundSkipTrack: (() => void) | null = null;
  private boundBotEffect: ((e: Event) => void) | null = null;
  private boundBotAnimal: ((e: Event) => void) | null = null;

  // Announcement text object
  private announcementText: Phaser.GameObjects.Text | null = null;
  private announcementBg: Phaser.GameObjects.Rectangle | null = null;

  // Zone system
  private currentZone: ZoneType = "main_city";
  private isTransitioning = false; // Prevent overlapping transitions
  private trendingElements: Phaser.GameObjects.GameObject[] = [];
  private mainCityElements: Phaser.GameObjects.GameObject[] = [];
  private boundZoneChange: ((e: Event) => void) | null = null;
  private zoneGround: Phaser.GameObjects.TileSprite | null = null;
  private zonePath: Phaser.GameObjects.TileSprite | null = null;
  private billboardTexts: Phaser.GameObjects.Text[] = [];
  private tickerText: Phaser.GameObjects.Text | null = null;
  private tickerOffset = 0;
  private skylineSprites: Phaser.GameObjects.Sprite[] = [];
  private originalPositions: Map<Phaser.GameObjects.GameObject, number> = new Map(); // Store original X positions

  constructor() {
    super({ key: "WorldScene" });
  }

  create(): void {
    // Create layered ground
    this.createGround();

    // Create sky with gradient
    this.createSky();

    // Create day/night overlay
    this.overlay = this.add.rectangle(400, 300, 800, 600, 0x000000, 0);
    this.overlay.setDepth(100);

    // Add decorations (trees, bushes, benches, lamps)
    this.createDecorations();

    // Add extra decorations (flowers, rocks, fountain)
    this.createExtraDecorations();

    // Initialize clouds
    this.createClouds();

    // Add animals to the world
    this.createAnimals();

    // Store original positions of decorations and animals for zone transitions
    this.storeOriginalPositions();

    // Create ambient particles (pollen/leaves)
    this.createAmbientParticles();

    // Start day/night cycle
    this.startDayNightCycle();

    // Add subtle ground animation
    this.tweens.add({
      targets: this.ground,
      tilePositionX: 16,
      duration: 20000,
      repeat: -1,
      ease: "Linear",
    });

    // Start background music
    this.startPokemonMusic();

    // Listen for music toggle (store bound handler for cleanup)
    this.boundToggleMusic = () => this.toggleMusic();
    window.addEventListener("bagsworld-toggle-music", this.boundToggleMusic);

    // Listen for track skip (store bound handler for cleanup)
    this.boundSkipTrack = () => this.skipTrack();
    window.addEventListener("bagsworld-skip-track", this.boundSkipTrack);

    // Listen for bot effect commands
    this.boundBotEffect = (e: Event) => this.handleBotEffect(e as CustomEvent);
    window.addEventListener("bagsworld-bot-effect", this.boundBotEffect);

    // Listen for bot animal commands
    this.boundBotAnimal = (e: Event) => this.handleBotAnimal(e as CustomEvent);
    window.addEventListener("bagsworld-bot-animal", this.boundBotAnimal);

    // Listen for zone change events
    this.boundZoneChange = (e: Event) => this.handleZoneChange(e as CustomEvent);
    window.addEventListener("bagsworld-zone-change", this.boundZoneChange);

    // Register cleanup on scene shutdown
    this.events.on("shutdown", this.cleanup, this);
  }

  private handleZoneChange(event: CustomEvent<{ zone: ZoneType }>): void {
    const newZone = event.detail.zone;
    if (newZone === this.currentZone || this.isTransitioning) return;

    // Transition to new zone
    this.transitionToZone(newZone);
  }

  private transitionToZone(newZone: ZoneType): void {
    // Mark transition in progress
    this.isTransitioning = true;

    // Determine slide direction: BagsCity is "to the right" of Park
    const isGoingRight = newZone === "trending";
    const duration = 600; // Smooth, cinematic transition
    const slideDistance = 850; // Slightly more than screen width for full slide

    // Calculate offsets
    const slideOutOffset = isGoingRight ? -slideDistance : slideDistance;
    const slideInOffset = isGoingRight ? slideDistance : -slideDistance;

    // Collect current zone elements to slide out
    const oldElements: (Phaser.GameObjects.GameObject & { x?: number })[] = [];

    if (this.currentZone === "trending") {
      oldElements.push(...this.trendingElements);
      oldElements.push(...this.billboardTexts);
      if (this.tickerText) oldElements.push(this.tickerText);
      oldElements.push(...this.skylineSprites);
    } else {
      // Main city decorations
      this.decorations.forEach(d => oldElements.push(d));
      this.animals.forEach(a => oldElements.push(a.sprite));
    }

    // Include buildings and characters (they slide out and get recreated)
    this.buildingSprites.forEach(container => oldElements.push(container));
    this.characterSprites.forEach(sprite => oldElements.push(sprite));

    // Store old element original X positions for proper destruction
    const oldElementData = oldElements.map(el => ({ el, origX: (el as any).x || 0 }));

    // Create transition overlay for ground swap (slides with content)
    const transitionOverlay = this.add.rectangle(
      400 + slideInOffset,
      520,
      800,
      200,
      this.currentZone === "main_city" ? 0x374151 : 0x22c55e, // concrete or grass color
      1
    );
    transitionOverlay.setDepth(0);

    // Slide out old elements with smooth easing
    oldElementData.forEach(({ el }) => {
      if ((el as any).x !== undefined) {
        this.tweens.add({
          targets: el,
          x: (el as any).x + slideOutOffset,
          duration,
          ease: 'Cubic.easeInOut',
        });
      }
    });

    // Slide ground texture overlay
    this.tweens.add({
      targets: this.ground,
      tilePositionX: this.ground.tilePositionX + (isGoingRight ? 100 : -100),
      duration,
      ease: 'Cubic.easeInOut',
    });

    // Slide transition overlay in
    this.tweens.add({
      targets: transitionOverlay,
      x: 400,
      duration,
      ease: 'Cubic.easeInOut',
    });

    // At 40% through animation, swap the zone for smooth visual transition
    this.time.delayedCall(duration * 0.4, () => {
      // Clear old zone references (elements are still animating)
      if (this.currentZone === "trending") {
        this.trendingElements = [];
        this.billboardTexts = [];
        this.tickerText = null;
        this.skylineSprites = [];
      }

      // Update zone and set up new content
      this.currentZone = newZone;

      // Change ground texture
      this.ground.setTexture(newZone === "trending" ? "concrete" : "grass");

      // Setup new zone content (will be positioned off-screen initially)
      this.setupZoneOffscreen(newZone, slideInOffset);

      // Destroy transition overlay
      transitionOverlay.destroy();
    });

    // Clean up old elements after animation completes
    this.time.delayedCall(duration + 50, () => {
      oldElementData.forEach(({ el }) => {
        // Only destroy elements that aren't persistent (decorations/animals are reused)
        const isDecoration = this.decorations.includes(el as any);
        const isAnimal = this.animals.some(a => a.sprite === el);

        if (!isDecoration && !isAnimal && el && (el as any).destroy && (el as any).active !== false) {
          (el as any).destroy();
        }
      });

      // Clear old building/character sprite maps
      this.buildingSprites.clear();
      this.characterSprites.clear();

      // Mark transition complete
      this.isTransitioning = false;
    });
  }

  private setupZoneOffscreen(zone: ZoneType, offsetX: number): void {
    // Setup zone with elements offset, then animate them into position
    const duration = 400; // Smooth slide-in matching the overall transition feel

    if (zone === "trending") {
      this.setupTrendingZone();

      // Offset all new BagsCity elements and animate them in
      const newElements = [
        ...this.trendingElements,
        ...this.billboardTexts,
        this.tickerText,
        ...this.skylineSprites
      ].filter(Boolean);

      newElements.forEach(el => {
        if ((el as any).x !== undefined) {
          const targetX = (el as any).x;
          (el as any).x = targetX + offsetX;
          this.tweens.add({
            targets: el,
            x: targetX,
            duration,
            ease: 'Cubic.easeOut',
          });
        }
      });
    } else {
      this.setupMainCityZone();

      // Animate Park elements in using their ORIGINAL positions
      const newElements = [
        ...this.decorations,
        ...this.animals.map(a => a.sprite)
      ];

      newElements.forEach(el => {
        // Get the original position, not the current (off-screen) position
        const originalX = this.originalPositions.get(el);
        if (originalX !== undefined) {
          (el as any).x = originalX + offsetX; // Start off-screen
          this.tweens.add({
            targets: el,
            x: originalX, // Animate to original position
            duration,
            ease: 'Cubic.easeOut',
          });
        }
      });
    }
  }

  private storeOriginalPositions(): void {
    // Store original X positions of decorations and animals for zone transitions
    this.decorations.forEach(d => {
      this.originalPositions.set(d, (d as any).x || 0);
    });
    this.animals.forEach(a => {
      this.originalPositions.set(a.sprite, (a.sprite as any).x || 0);
    });
  }

  private clearCurrentZone(): void {
    // Clear zone-specific elements based on current zone
    if (this.currentZone === "trending") {
      this.trendingElements.forEach((el) => el.destroy());
      this.trendingElements = [];
      this.billboardTexts.forEach((t) => t.destroy());
      this.billboardTexts = [];
      if (this.tickerText) {
        this.tickerText.destroy();
        this.tickerText = null;
      }
      this.skylineSprites.forEach((s) => s.destroy());
      this.skylineSprites = [];
    } else if (this.currentZone === "main_city") {
      // Main city uses shared decorations, don't destroy them
      // Just hide them
      this.decorations.forEach((d) => d.setVisible(false));
      this.animals.forEach((a) => a.sprite.setVisible(false));
    }

    // Reset ground
    if (this.zoneGround) {
      this.zoneGround.destroy();
      this.zoneGround = null;
    }
    if (this.zonePath) {
      this.zonePath.destroy();
      this.zonePath = null;
    }
  }

  private setupZone(zone: ZoneType): void {
    switch (zone) {
      case "trending":
        this.setupTrendingZone();
        break;
      case "main_city":
      default:
        this.setupMainCityZone();
        break;
    }
  }

  private setupMainCityZone(): void {
    // Show main city decorations
    this.decorations.forEach((d) => d.setVisible(true));
    this.animals.forEach((a) => a.sprite.setVisible(true));

    // Show fountain water spray
    if (this.fountainWater) {
      this.fountainWater.setVisible(true);
    }

    // Show and reset grass ground
    this.ground.setVisible(true);
    this.ground.setTexture("grass");
  }

  private setupTrendingZone(): void {
    // Hide park decorations and animals (they belong to main_city)
    this.decorations.forEach((d) => d.setVisible(false));
    this.animals.forEach((a) => a.sprite.setVisible(false));

    // Hide fountain water spray
    if (this.fountainWater) {
      this.fountainWater.setVisible(false);
    }

    // Hide the grass ground completely - city has its own pavement
    this.ground.setVisible(false);

    // Add NYC-style skyline background
    this.createTrendingSkyline();

    // Add street elements and decorations
    this.createTrendingDecorations();

    // Add billboards with live data displays
    this.createTrendingBillboards();

    // Add ticker display at bottom
    this.createTrendingTicker();

    // Start ticker animation
    this.time.addEvent({
      delay: 50,
      callback: this.updateTicker,
      callbackScope: this,
      loop: true,
    });
  }

  private createTrendingSkyline(): void {
    // Back layer - distant buildings (darker, smaller)
    const backLayer = [
      { x: 100, y: 180, scale: 0.7, alpha: 0.4 },
      { x: 300, y: 180, scale: 0.65, alpha: 0.4 },
      { x: 500, y: 180, scale: 0.75, alpha: 0.4 },
      { x: 700, y: 180, scale: 0.7, alpha: 0.4 },
    ];

    backLayer.forEach((pos) => {
      const skyline = this.add.sprite(pos.x, pos.y, "skyline_bg");
      skyline.setOrigin(0.5, 0);
      skyline.setScale(pos.scale);
      skyline.setDepth(-2);
      skyline.setAlpha(pos.alpha);
      skyline.setTint(0x111827);
      this.skylineSprites.push(skyline);
      this.trendingElements.push(skyline);
    });

    // Front layer - closer buildings (larger, more visible)
    const frontLayer = [
      { x: 60, y: 220, scale: 0.9, alpha: 0.7 },
      { x: 200, y: 230, scale: 0.85, alpha: 0.65 },
      { x: 400, y: 210, scale: 1.0, alpha: 0.75 },
      { x: 600, y: 225, scale: 0.88, alpha: 0.68 },
      { x: 740, y: 220, scale: 0.92, alpha: 0.7 },
    ];

    frontLayer.forEach((pos) => {
      const skyline = this.add.sprite(pos.x, pos.y, "skyline_bg");
      skyline.setOrigin(0.5, 0);
      skyline.setScale(pos.scale);
      skyline.setDepth(-1);
      skyline.setAlpha(pos.alpha);
      this.skylineSprites.push(skyline);
      this.trendingElements.push(skyline);
    });
  }

  private createTrendingDecorations(): void {
    // Street lamps at ground level for urban feel
    const lampPositions = [
      { x: 100, y: 540 },
      { x: 300, y: 540 },
      { x: 500, y: 540 },
      { x: 700, y: 540 },
    ];
    lampPositions.forEach((pos) => {
      const lamp = this.add.sprite(pos.x, pos.y, "street_lamp");
      lamp.setOrigin(0.5, 1);
      lamp.setDepth(3);
      this.trendingElements.push(lamp);
    });

    // Add city street elements
    this.createCityStreetElements();
  }

  private createCityStreetElements(): void {
    // Sidewalk/pavement area (covers the grass area)
    const pavement = this.add.rectangle(400, 520, 800, 160, 0x374151);
    pavement.setDepth(0);
    this.trendingElements.push(pavement);

    // Road at the bottom
    const road = this.add.rectangle(400, 575, 800, 50, 0x1f2937);
    road.setDepth(1);
    this.trendingElements.push(road);

    // Road lane markings (dashed yellow center line)
    for (let x = 30; x < 780; x += 50) {
      const roadLine = this.add.rectangle(x, 575, 25, 3, 0xfbbf24);
      roadLine.setDepth(2);
      this.trendingElements.push(roadLine);
    }

    // Sidewalk curb line
    const curb = this.add.rectangle(400, 548, 800, 4, 0x6b7280);
    curb.setDepth(2);
    this.trendingElements.push(curb);

    // Crosswalks at intersections
    this.createCrosswalk(200, 575);
    this.createCrosswalk(600, 575);

    // Traffic lights near crosswalks
    const trafficLight1 = this.add.sprite(170, 520, "traffic_light");
    trafficLight1.setOrigin(0.5, 1);
    trafficLight1.setDepth(4);
    this.trendingElements.push(trafficLight1);

    const trafficLight2 = this.add.sprite(630, 520, "traffic_light");
    trafficLight2.setOrigin(0.5, 1);
    trafficLight2.setDepth(4);
    trafficLight2.setFlipX(true);
    this.trendingElements.push(trafficLight2);

    // Fire hydrant
    const hydrant = this.add.sprite(350, 545, "fire_hydrant");
    hydrant.setOrigin(0.5, 1);
    hydrant.setDepth(3);
    this.trendingElements.push(hydrant);

    // Trash can
    const trashCan = this.add.sprite(450, 545, "trash_can");
    trashCan.setOrigin(0.5, 1);
    trashCan.setDepth(3);
    this.trendingElements.push(trashCan);

    // Add moving traffic
    this.createMovingTraffic();
  }

  private createCrosswalk(x: number, y: number): void {
    // Create crosswalk stripes
    for (let i = -25; i <= 25; i += 10) {
      const stripe = this.add.rectangle(x + i, y, 6, 30, 0xffffff, 0.9);
      stripe.setDepth(2);
      this.trendingElements.push(stripe);
    }
  }

  private createMovingTraffic(): void {
    // Taxi driving right
    const movingTaxi = this.add.sprite(-60, 585, "taxi");
    movingTaxi.setDepth(3);
    movingTaxi.setFlipX(true);
    this.trendingElements.push(movingTaxi);

    const driveTaxi = () => {
      movingTaxi.setX(-60);
      this.tweens.add({
        targets: movingTaxi,
        x: 860,
        duration: 6000,
        ease: "Linear",
        onComplete: () => {
          this.time.delayedCall(4000, driveTaxi);
        },
      });
    };
    this.time.delayedCall(1000, driveTaxi);

    // Blue car driving left
    const movingCar = this.add.sprite(860, 565, "car_blue");
    movingCar.setDepth(3);
    this.trendingElements.push(movingCar);

    const driveCar = () => {
      movingCar.setX(860);
      this.tweens.add({
        targets: movingCar,
        x: -60,
        duration: 7000,
        ease: "Linear",
        onComplete: () => {
          this.time.delayedCall(5000, driveCar);
        },
      });
    };
    this.time.delayedCall(3000, driveCar);
  }

  private createTrendingBillboards(): void {
    // Main central billboard - custom styled container
    const billboardX = 400;
    const billboardY = 150;
    const billboardWidth = 160;
    const billboardHeight = 90;

    // Billboard frame (dark background with border)
    const billboardFrame = this.add.rectangle(
      billboardX, billboardY,
      billboardWidth + 6, billboardHeight + 6,
      0x1a1a1a
    );
    billboardFrame.setStrokeStyle(2, 0xfbbf24);
    billboardFrame.setDepth(5);
    this.trendingElements.push(billboardFrame);

    // Inner billboard background
    const billboardBg = this.add.rectangle(
      billboardX, billboardY,
      billboardWidth, billboardHeight,
      0x0d0d0d
    );
    billboardBg.setDepth(5);
    this.trendingElements.push(billboardBg);

    // HOT TOKENS header bar
    const headerBar = this.add.rectangle(
      billboardX, billboardY - 30,
      billboardWidth, 22,
      0xfbbf24
    );
    headerBar.setDepth(6);
    this.trendingElements.push(headerBar);

    // Billboard title text
    const billboardTitle = this.add.text(billboardX, billboardY - 30, "HOT TOKENS", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#0d0d0d",
      fontStyle: "bold",
    });
    billboardTitle.setOrigin(0.5, 0.5);
    billboardTitle.setDepth(7);
    this.billboardTexts.push(billboardTitle);

    // Stats display (centered in billboard)
    const statsText = this.add.text(billboardX, billboardY, "LOADING...", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#4ade80",
    });
    statsText.setOrigin(0.5, 0.5);
    statsText.setDepth(6);
    this.billboardTexts.push(statsText);

    // Volume display (below stats)
    const volumeText = this.add.text(billboardX, billboardY + 25, "24H VOL: ...", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#60a5fa",
    });
    volumeText.setOrigin(0.5, 0.5);
    volumeText.setDepth(6);
    this.billboardTexts.push(volumeText);

    // Side billboards - styled containers
    const sideBillboardWidth = 100;
    const sideBillboardHeight = 60;

    // Left billboard - TOP GAINER
    const leftFrame = this.add.rectangle(130, 320, sideBillboardWidth + 4, sideBillboardHeight + 4, 0x1a1a1a);
    leftFrame.setStrokeStyle(2, 0x4ade80);
    leftFrame.setDepth(5);
    this.trendingElements.push(leftFrame);

    const leftBg = this.add.rectangle(130, 320, sideBillboardWidth, sideBillboardHeight, 0x0d0d0d);
    leftBg.setDepth(5);
    this.trendingElements.push(leftBg);

    const leftHeader = this.add.rectangle(130, 300, sideBillboardWidth, 16, 0x4ade80);
    leftHeader.setDepth(6);
    this.trendingElements.push(leftHeader);

    const leftTitle = this.add.text(130, 300, "TOP GAINER", {
      fontFamily: "monospace",
      fontSize: "8px",
      color: "#0d0d0d",
      fontStyle: "bold",
    });
    leftTitle.setOrigin(0.5, 0.5);
    leftTitle.setDepth(7);
    this.billboardTexts.push(leftTitle);

    const leftText = this.add.text(130, 328, "...", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#4ade80",
      align: "center",
    });
    leftText.setOrigin(0.5, 0.5);
    leftText.setDepth(6);
    this.billboardTexts.push(leftText);

    // Right billboard - VOLUME KING
    const rightFrame = this.add.rectangle(670, 320, sideBillboardWidth + 4, sideBillboardHeight + 4, 0x1a1a1a);
    rightFrame.setStrokeStyle(2, 0xec4899);
    rightFrame.setDepth(5);
    this.trendingElements.push(rightFrame);

    const rightBg = this.add.rectangle(670, 320, sideBillboardWidth, sideBillboardHeight, 0x0d0d0d);
    rightBg.setDepth(5);
    this.trendingElements.push(rightBg);

    const rightHeader = this.add.rectangle(670, 300, sideBillboardWidth, 16, 0xec4899);
    rightHeader.setDepth(6);
    this.trendingElements.push(rightHeader);

    const rightTitle = this.add.text(670, 300, "VOLUME KING", {
      fontFamily: "monospace",
      fontSize: "8px",
      color: "#0d0d0d",
      fontStyle: "bold",
    });
    rightTitle.setOrigin(0.5, 0.5);
    rightTitle.setDepth(7);
    this.billboardTexts.push(rightTitle);

    const rightText = this.add.text(670, 328, "...", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#ec4899",
      align: "center",
    });
    rightText.setOrigin(0.5, 0.5);
    rightText.setDepth(6);
    this.billboardTexts.push(rightText);

    // Update billboard data periodically
    this.time.addEvent({
      delay: 5000,
      callback: this.updateBillboardData,
      callbackScope: this,
      loop: true,
    });

    // Initial update
    this.updateBillboardData();
  }

  private createTrendingTicker(): void {
    // Ticker display bar at very bottom of screen
    const tickerY = 592;

    // Dark background bar for ticker
    const tickerBg = this.add.rectangle(400, tickerY, 800, 16, 0x0a0a0f);
    tickerBg.setDepth(10);
    this.trendingElements.push(tickerBg);

    // Subtle top border
    const tickerBorder = this.add.rectangle(400, tickerY - 8, 800, 1, 0x374151);
    tickerBorder.setDepth(10);
    this.trendingElements.push(tickerBorder);

    // Create mask for ticker text
    const maskShape = this.make.graphics({});
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(0, tickerY - 8, 800, 16);
    const mask = maskShape.createGeometryMask();

    // Ticker text
    this.tickerText = this.add.text(800, tickerY, this.getTickerContent(), {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#4ade80",
    });
    this.tickerText.setOrigin(0, 0.5);
    this.tickerText.setDepth(11);
    this.tickerText.setMask(mask);
  }

  private getTickerContent(): string {
    // Generate ticker content from world state
    const content: string[] = [
      ">>> BAGSWORLD CITY <<<",
    ];

    if (this.worldState) {
      const buildings = this.worldState.buildings || [];
      // Sort by volume to show most active
      const sorted = [...buildings].sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
      sorted.slice(0, 5).forEach((b) => {
        const change = b.change24h ? (b.change24h > 0 ? `+${b.change24h.toFixed(1)}%` : `${b.change24h.toFixed(1)}%`) : "";
        content.push(`${b.symbol}: $${this.formatNumber(b.marketCap || 0)} ${change}`);
      });
    }

    content.push(">>> BAGS.FM <<<");

    return content.join("   |   ");
  }

  private updateTicker(): void {
    if (!this.tickerText || this.currentZone !== "trending") return;

    this.tickerOffset -= 2;
    this.tickerText.setX(800 + this.tickerOffset);

    // Reset when fully scrolled
    if (this.tickerOffset < -this.tickerText.width - 100) {
      this.tickerOffset = 0;
      this.tickerText.setText(this.getTickerContent());
    }
  }

  private updateBillboardData(): void {
    if (this.currentZone !== "trending" || !this.worldState) return;

    const buildings = this.worldState.buildings || [];

    // Billboard text indices:
    // [0] = HOT TOKENS title (static)
    // [1] = stats text (main billboard)
    // [2] = volume text (main billboard)
    // [3] = TOP GAINER title (static)
    // [4] = left content
    // [5] = VOLUME KING title (static)
    // [6] = right content

    // Update main billboard stats
    if (this.billboardTexts.length >= 3) {
      this.billboardTexts[1].setText(`${buildings.length} ACTIVE TOKENS`);

      const totalVolume = buildings.reduce((sum, b) => sum + (b.volume24h || 0), 0);
      this.billboardTexts[2].setText(`24H VOL: $${this.formatNumber(totalVolume)}`);
    }

    // Update side billboards content (skip title texts at indices 3 and 5)
    if (this.billboardTexts.length >= 7) {
      // Top gainer by price change
      const byGain = [...buildings].sort((a, b) => (b.change24h || 0) - (a.change24h || 0));
      if (byGain.length > 0 && byGain[0].change24h) {
        this.billboardTexts[4].setText(`${byGain[0].symbol}\n+${byGain[0].change24h.toFixed(1)}%`);
      }

      // Volume king - highest 24h volume
      const byVolume = [...buildings].sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
      if (byVolume.length > 0) {
        this.billboardTexts[6].setText(`${byVolume[0].symbol}\n$${this.formatNumber(byVolume[0].volume24h || 0)}`);
      }
    }
  }

  private formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toFixed(0);
  }

  // Cleanup method to prevent memory leaks
  private cleanup(): void {
    // Remove window event listeners
    if (this.boundToggleMusic) {
      window.removeEventListener("bagsworld-toggle-music", this.boundToggleMusic);
      this.boundToggleMusic = null;
    }
    if (this.boundSkipTrack) {
      window.removeEventListener("bagsworld-skip-track", this.boundSkipTrack);
      this.boundSkipTrack = null;
    }
    if (this.boundBotEffect) {
      window.removeEventListener("bagsworld-bot-effect", this.boundBotEffect);
      this.boundBotEffect = null;
    }
    if (this.boundBotAnimal) {
      window.removeEventListener("bagsworld-bot-animal", this.boundBotAnimal);
      this.boundBotAnimal = null;
    }
    if (this.boundZoneChange) {
      window.removeEventListener("bagsworld-zone-change", this.boundZoneChange);
      this.boundZoneChange = null;
    }

    // Stop music and clean up audio context
    if (this.musicInterval) {
      clearTimeout(this.musicInterval);
      this.musicInterval = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  private createGround(): void {
    // Main grass layer
    this.ground = this.add.tileSprite(400, 520, 800, 160, "grass");
    this.ground.setDepth(0);

    // Add path in the middle
    const path = this.add.tileSprite(400, 560, 800, 40, "path");
    path.setDepth(1);

    // Dark grass border at top
    const topGrass = this.add.tileSprite(400, 445, 800, 30, "grass_dark");
    topGrass.setDepth(0);
  }

  private createSky(): void {
    this.skyGradient = this.add.graphics();
    this.skyGradient.setDepth(-2);

    // Start with night sky (will be updated by timeInfo)
    this.drawSkyGradient(true);

    // Add distant city skyline silhouette
    this.createDistantSkyline();

    // Add stars (store references for day/night toggle)
    this.stars = [];
    for (let i = 0; i < 50; i++) {
      const star = this.add.circle(
        Math.random() * 800,
        Math.random() * 300,
        Math.random() * 1.5 + 0.5,
        0xffffff,
        Math.random() * 0.5 + 0.3
      );
      star.setDepth(-1);
      this.stars.push(star);

      // Twinkle animation
      this.tweens.add({
        targets: star,
        alpha: 0.2,
        duration: 1000 + Math.random() * 2000,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }

  private drawSkyGradient(isNight: boolean): void {
    if (!this.skyGradient) return;

    this.skyGradient.clear();

    if (isNight) {
      // Night sky - dark blue
      this.skyGradient.fillGradientStyle(
        0x0f172a, // Dark blue top
        0x0f172a,
        0x1e293b, // Lighter blue bottom
        0x1e293b,
        1
      );
    } else {
      // Day sky - bright blue
      this.skyGradient.fillGradientStyle(
        0x1e90ff, // Bright blue top (dodger blue)
        0x1e90ff,
        0x87ceeb, // Sky blue bottom
        0x87ceeb,
        1
      );
    }
    this.skyGradient.fillRect(0, 0, 800, 430);
  }

  private updateSkyForTime(timeInfo: { isNight: boolean; isDusk: boolean; isDawn: boolean }): void {
    const isNightOrDusk = timeInfo.isNight || timeInfo.isDusk;

    // Update sky gradient
    this.drawSkyGradient(isNightOrDusk);

    // Show/hide stars
    const targetAlpha = isNightOrDusk ? 0.5 : 0;
    this.stars.forEach(star => {
      this.tweens.add({
        targets: star,
        alpha: targetAlpha,
        duration: 2000,
        ease: "Sine.easeInOut",
      });
    });
  }

  private createDistantSkyline(): void {
    const skyline = this.add.graphics();
    skyline.setDepth(-1.5);

    // Subtle dark silhouette color
    const silhouetteColor = 0x0a1020;

    // Draw distant buildings as simple rectangles
    skyline.fillStyle(silhouetteColor, 0.6);

    // Left cluster
    skyline.fillRect(20, 340, 15, 60);
    skyline.fillRect(40, 320, 20, 80);
    skyline.fillRect(65, 350, 12, 50);
    skyline.fillRect(82, 330, 18, 70);
    skyline.fillRect(105, 355, 14, 45);

    // Center-left cluster
    skyline.fillRect(160, 335, 16, 65);
    skyline.fillRect(180, 310, 25, 90);
    skyline.fillRect(210, 345, 14, 55);
    skyline.fillRect(230, 325, 20, 75);

    // Center cluster (taller - focal point)
    skyline.fillRect(320, 300, 22, 100);
    skyline.fillRect(348, 280, 30, 120);
    skyline.fillRect(385, 295, 24, 105);
    skyline.fillRect(415, 315, 18, 85);
    skyline.fillRect(438, 330, 16, 70);

    // Center-right cluster
    skyline.fillRect(520, 340, 18, 60);
    skyline.fillRect(545, 320, 22, 80);
    skyline.fillRect(572, 350, 14, 50);

    // Right cluster
    skyline.fillRect(640, 335, 16, 65);
    skyline.fillRect(662, 315, 24, 85);
    skyline.fillRect(692, 345, 18, 55);
    skyline.fillRect(715, 325, 20, 75);
    skyline.fillRect(740, 355, 15, 45);
    skyline.fillRect(760, 338, 22, 62);

    // Add subtle window lights (very sparse and dim)
    const windowColor = 0xffd700;
    skyline.fillStyle(windowColor, 0.15);

    // A few random lit windows
    const windowPositions = [
      { x: 185, y: 330, w: 3, h: 4 },
      { x: 185, y: 345, w: 3, h: 4 },
      { x: 352, y: 300, w: 4, h: 5 },
      { x: 360, y: 320, w: 4, h: 5 },
      { x: 360, y: 350, w: 4, h: 5 },
      { x: 390, y: 315, w: 3, h: 4 },
      { x: 550, y: 340, w: 3, h: 4 },
      { x: 668, y: 335, w: 3, h: 4 },
      { x: 668, y: 360, w: 3, h: 4 },
    ];

    for (const win of windowPositions) {
      skyline.fillRect(win.x, win.y, win.w, win.h);
    }
  }

  private createDecorations(): void {
    // Add trees
    const treePositions = [
      { x: 50, y: 460 },
      { x: 750, y: 455 },
      { x: 180, y: 470 },
      { x: 620, y: 465 },
    ];

    treePositions.forEach((pos, i) => {
      const tree = this.add.sprite(pos.x, pos.y, "tree");
      tree.setOrigin(0.5, 1);
      tree.setDepth(2);
      tree.setScale(0.9 + Math.random() * 0.3);
      this.decorations.push(tree);

      // Gentle sway animation
      this.tweens.add({
        targets: tree,
        angle: 2,
        duration: 2000 + i * 500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });

    // Add bushes
    const bushPositions = [
      { x: 100, y: 480 },
      { x: 300, y: 475 },
      { x: 500, y: 478 },
      { x: 700, y: 476 },
    ];

    bushPositions.forEach((pos) => {
      const bush = this.add.sprite(pos.x, pos.y, "bush");
      bush.setOrigin(0.5, 1);
      bush.setDepth(2);
      bush.setScale(0.7 + Math.random() * 0.3);
      this.decorations.push(bush);
    });

    // Add lamp posts
    const lampPositions = [{ x: 200, y: 540 }, { x: 600, y: 540 }];

    lampPositions.forEach((pos) => {
      const lamp = this.add.sprite(pos.x, pos.y, "lamp");
      lamp.setOrigin(0.5, 1);
      lamp.setDepth(3);
      this.decorations.push(lamp);

      // Add light glow
      const glow = this.add.sprite(pos.x, pos.y - 30, "glow");
      glow.setAlpha(0.3);
      glow.setScale(0.8);
      glow.setDepth(2);
      glow.setTint(0xfbbf24);

      this.tweens.add({
        targets: glow,
        alpha: 0.5,
        scale: 0.9,
        duration: 1500,
        yoyo: true,
        repeat: -1,
      });
    });

    // Add benches
    const benchPositions = [{ x: 350, y: 545 }, { x: 450, y: 545 }];

    benchPositions.forEach((pos) => {
      const bench = this.add.sprite(pos.x, pos.y, "bench");
      bench.setOrigin(0.5, 1);
      bench.setDepth(3);
      this.decorations.push(bench);
    });
  }

  private createClouds(): void {
    for (let i = 0; i < 6; i++) {
      const cloud = this.add.sprite(
        Math.random() * 900 - 50,
        30 + Math.random() * 120,
        "cloud"
      );
      cloud.setAlpha(0.5 + Math.random() * 0.3);
      cloud.setScale(0.6 + Math.random() * 0.5);
      cloud.setDepth(1);
      this.clouds.push(cloud);
    }
  }

  private createAnimals(): void {
    const animalTypes: Animal["type"][] = ["dog", "cat", "bird", "butterfly", "squirrel"];

    // Create a variety of animals
    const animalConfigs = [
      { type: "dog" as const, x: 150, y: 555, scale: 1.2 },
      { type: "cat" as const, x: 650, y: 555, scale: 1.1 },
      { type: "bird" as const, x: 100, y: 480, scale: 0.8 },
      { type: "bird" as const, x: 700, y: 490, scale: 0.7 },
      { type: "butterfly" as const, x: 300, y: 470, scale: 0.6 },
      { type: "butterfly" as const, x: 500, y: 460, scale: 0.5 },
      { type: "squirrel" as const, x: 80, y: 475, scale: 1.0 },
    ];

    animalConfigs.forEach((config) => {
      const sprite = this.add.sprite(config.x, config.y, config.type);
      sprite.setScale(config.scale);
      sprite.setDepth(4);

      // Flying animals have higher depth
      if (config.type === "bird" || config.type === "butterfly") {
        sprite.setDepth(15);
      }

      const animal: Animal = {
        sprite,
        type: config.type,
        targetX: config.x + (Math.random() * 200 - 100),
        speed: config.type === "butterfly" ? 0.3 : config.type === "bird" ? 0.5 : 0.2,
        direction: Math.random() > 0.5 ? "left" : "right",
        idleTimer: 0,
        isIdle: Math.random() > 0.5,
      };

      this.animals.push(animal);

      // Add idle animation for ground animals
      if (config.type !== "bird" && config.type !== "butterfly") {
        this.tweens.add({
          targets: sprite,
          y: config.y - 2,
          duration: 500 + Math.random() * 300,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }

      // Flying animation for birds and butterflies
      if (config.type === "bird") {
        this.tweens.add({
          targets: sprite,
          y: config.y - 15,
          duration: 800 + Math.random() * 400,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }

      if (config.type === "butterfly") {
        this.tweens.add({
          targets: sprite,
          y: config.y - 20,
          angle: 5,
          duration: 600 + Math.random() * 300,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    });
  }

  private createExtraDecorations(): void {
    // Add flower patches
    const flowerPositions = [
      { x: 130, y: 490 },
      { x: 280, y: 485 },
      { x: 420, y: 488 },
      { x: 560, y: 482 },
      { x: 680, y: 486 },
    ];

    flowerPositions.forEach((pos) => {
      const flower = this.add.sprite(pos.x, pos.y, "flower");
      flower.setOrigin(0.5, 1);
      flower.setDepth(2);
      flower.setScale(0.8 + Math.random() * 0.4);
      this.decorations.push(flower);

      // Gentle sway
      this.tweens.add({
        targets: flower,
        angle: 3,
        duration: 1500 + Math.random() * 500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });

    // Add rocks
    const rockPositions = [
      { x: 70, y: 555 },
      { x: 730, y: 552 },
      { x: 380, y: 558 },
    ];

    rockPositions.forEach((pos) => {
      const rock = this.add.sprite(pos.x, pos.y, "rock");
      rock.setOrigin(0.5, 1);
      rock.setDepth(2);
      rock.setScale(0.6 + Math.random() * 0.3);
      this.decorations.push(rock);
    });

    // Add fountain in center of park (above the path)
    const fountainY = 480; // Position fountain base on grass, above path
    const fountain = this.add.sprite(400, fountainY, "fountain");
    fountain.setOrigin(0.5, 1);
    fountain.setDepth(2);
    fountain.setScale(1.0);
    this.decorations.push(fountain);

    // Water spray particles - aligned with fountain top
    this.fountainWater = this.add.particles(400, fountainY - 35, "rain", {
      speed: { min: 30, max: 60 },
      angle: { min: 260, max: 280 },
      lifespan: 500,
      quantity: 3,
      frequency: 80,
      scale: { start: 0.4, end: 0.1 },
      alpha: { start: 0.7, end: 0 },
      gravityY: 80,
      tint: 0x60a5fa, // Blue tint for water
    });
    this.fountainWater.setDepth(2);

    // Add flag poles
    const flagPositions = [{ x: 50, y: 430 }, { x: 750, y: 430 }];
    flagPositions.forEach((pos) => {
      const flag = this.add.sprite(pos.x, pos.y, "flag");
      flag.setOrigin(0.5, 1);
      flag.setDepth(1);
      this.decorations.push(flag);

      // Flag waving
      this.tweens.add({
        targets: flag,
        scaleX: 0.9,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });

    // Add pond in corner
    const pond = this.add.sprite(100, 500, "pond");
    pond.setOrigin(0.5, 0.5);
    pond.setDepth(0);
    pond.setScale(1.5);
    pond.setAlpha(0.8);
    this.decorations.push(pond);

    // Ripple effect on pond
    this.tweens.add({
      targets: pond,
      scale: 1.55,
      alpha: 0.6,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private createAmbientParticles(): void {
    // Floating pollen/dust particles during day
    this.ambientParticles = this.add.particles(400, 200, "pollen", {
      x: { min: 0, max: 800 },
      y: { min: 100, max: 400 },
      lifespan: 8000,
      speedX: { min: 5, max: 20 },
      speedY: { min: -5, max: 5 },
      scale: { start: 0.3, end: 0 },
      alpha: { start: 0.4, end: 0 },
      quantity: 1,
      frequency: 500,
    });
    this.ambientParticles.setDepth(15);
  }

  private createFireflies(): void {
    if (this.fireflies) return;

    this.fireflies = this.add.particles(400, 400, "firefly", {
      x: { min: 50, max: 750 },
      y: { min: 350, max: 500 },
      lifespan: 4000,
      speedX: { min: -20, max: 20 },
      speedY: { min: -20, max: 20 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0, end: 1, ease: "Sine.easeInOut" },
      quantity: 1,
      frequency: 300,
      tint: 0xffff00,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.fireflies.setDepth(20);
  }

  private destroyFireflies(): void {
    if (this.fireflies) {
      this.fireflies.destroy();
      this.fireflies = null;
    }
  }

  private startPokemonMusic(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
      this.gainNode.gain.value = 0.08; // Very low volume for ambient background

      this.playCurrentTrack();
      this.musicPlaying = true;
      this.emitTrackChange();
    } catch (e) {
      console.log("Audio not supported");
    }
  }

  private emitTrackChange(): void {
    window.dispatchEvent(new CustomEvent("bagsworld-track-changed", {
      detail: { trackName: this.trackNames[this.currentTrack], trackIndex: this.currentTrack }
    }));
  }

  private playCurrentTrack(): void {
    // Clear any existing scheduled track to prevent overlapping
    if (this.musicInterval) {
      clearTimeout(this.musicInterval);
      this.musicInterval = null;
    }

    switch (this.currentTrack) {
      case 0:
        this.playPokemonMelody();
        break;
      case 1:
        this.playBagsAnthem();
        break;
      case 2:
        this.playNightMarket();
        break;
      case 3:
        this.playVictoryMarch();
        break;
      default:
        this.playPokemonMelody();
    }
  }

  private skipTrack(): void {
    // Stop current melody
    if (this.musicInterval) {
      clearTimeout(this.musicInterval);
      this.musicInterval = null;
    }

    // Move to next track
    this.currentTrack = (this.currentTrack + 1) % this.trackNames.length;
    this.emitTrackChange();

    // Play new track if music is on
    if (this.musicPlaying && this.audioContext && this.gainNode) {
      this.playCurrentTrack();
    }
  }

  private playPokemonMelody(): void {
    if (!this.audioContext || !this.gainNode) return;

    // Ambient, relaxed pentatonic melody - much longer and less repetitive
    // Slower tempo, longer notes, more space between phrases
    const notes = [
      // Phrase 1 - gentle opening
      { freq: 392.00, duration: 0.8 },   // G4
      { freq: 440.00, duration: 0.6 },   // A4
      { freq: 523.25, duration: 1.0 },   // C5
      { freq: 0, duration: 0.8 },        // Rest
      { freq: 440.00, duration: 0.6 },   // A4
      { freq: 392.00, duration: 0.8 },   // G4
      { freq: 329.63, duration: 1.2 },   // E4
      { freq: 0, duration: 1.0 },        // Long rest

      // Phrase 2 - variation
      { freq: 329.63, duration: 0.6 },   // E4
      { freq: 392.00, duration: 0.8 },   // G4
      { freq: 440.00, duration: 1.0 },   // A4
      { freq: 0, duration: 0.6 },        // Rest
      { freq: 523.25, duration: 0.8 },   // C5
      { freq: 440.00, duration: 0.6 },   // A4
      { freq: 392.00, duration: 1.2 },   // G4
      { freq: 0, duration: 1.2 },        // Long rest

      // Phrase 3 - descending
      { freq: 523.25, duration: 0.8 },   // C5
      { freq: 440.00, duration: 0.8 },   // A4
      { freq: 392.00, duration: 0.8 },   // G4
      { freq: 329.63, duration: 1.0 },   // E4
      { freq: 0, duration: 0.8 },        // Rest
      { freq: 293.66, duration: 0.6 },   // D4
      { freq: 261.63, duration: 1.4 },   // C4
      { freq: 0, duration: 1.5 },        // Long rest

      // Phrase 4 - resolution
      { freq: 261.63, duration: 0.8 },   // C4
      { freq: 329.63, duration: 0.6 },   // E4
      { freq: 392.00, duration: 1.0 },   // G4
      { freq: 0, duration: 0.5 },        // Rest
      { freq: 440.00, duration: 0.8 },   // A4
      { freq: 392.00, duration: 1.2 },   // G4
      { freq: 0, duration: 2.0 },        // Very long rest before loop
    ];

    // Soft, sustained bass notes (much quieter)
    const bass = [
      { freq: 130.81, duration: 3.0 },   // C3
      { freq: 0, duration: 1.0 },
      { freq: 110.00, duration: 3.0 },   // A2
      { freq: 0, duration: 1.0 },
      { freq: 98.00, duration: 3.0 },    // G2
      { freq: 0, duration: 1.0 },
      { freq: 130.81, duration: 4.0 },   // C3
      { freq: 0, duration: 2.0 },
      { freq: 110.00, duration: 3.0 },   // A2
      { freq: 0, duration: 1.5 },
      { freq: 98.00, duration: 3.0 },    // G2
      { freq: 0, duration: 2.5 },
    ];

    let time = this.audioContext.currentTime + 0.1;
    const totalDuration = notes.reduce((sum, n) => sum + n.duration, 0);

    // Play melody with sine waves
    notes.forEach((note) => {
      if (note.freq > 0) {
        this.playNote(note.freq, time, note.duration * 0.85, 0.08, "sine");
      }
      time += note.duration;
    });

    // Play bass with triangle waves (very quiet)
    let bassTime = this.audioContext.currentTime + 0.1;
    bass.forEach((note) => {
      if (note.freq > 0) {
        this.playNote(note.freq, bassTime, note.duration * 0.9, 0.04, "triangle");
      }
      bassTime += note.duration;
    });

    // Loop with extra pause
    this.musicInterval = window.setTimeout(() => {
      if (this.musicPlaying) {
        this.playCurrentTrack();
      }
    }, (totalDuration + 2) * 1000);
  }

  // Track 2: Bags Anthem - Gentle, uplifting
  private playBagsAnthem(): void {
    if (!this.audioContext || !this.gainNode) return;

    // Gentle uplifting melody - longer phrases, more space
    const notes = [
      { freq: 329.63, duration: 0.8 },   // E4
      { freq: 392.00, duration: 0.6 },   // G4
      { freq: 493.88, duration: 1.0 },   // B4
      { freq: 0, duration: 0.6 },        // Rest
      { freq: 440.00, duration: 0.8 },   // A4
      { freq: 392.00, duration: 0.6 },   // G4
      { freq: 329.63, duration: 1.2 },   // E4
      { freq: 0, duration: 1.0 },        // Long rest

      { freq: 392.00, duration: 0.6 },   // G4
      { freq: 440.00, duration: 0.8 },   // A4
      { freq: 493.88, duration: 0.8 },   // B4
      { freq: 523.25, duration: 1.0 },   // C5
      { freq: 0, duration: 0.8 },        // Rest
      { freq: 493.88, duration: 0.6 },   // B4
      { freq: 440.00, duration: 0.8 },   // A4
      { freq: 392.00, duration: 1.2 },   // G4
      { freq: 0, duration: 1.2 },        // Long rest

      { freq: 329.63, duration: 0.8 },   // E4
      { freq: 293.66, duration: 0.6 },   // D4
      { freq: 329.63, duration: 1.0 },   // E4
      { freq: 392.00, duration: 1.2 },   // G4
      { freq: 0, duration: 2.0 },        // Very long rest
    ];

    const bass = [
      { freq: 164.81, duration: 3.5 },   // E3
      { freq: 0, duration: 1.0 },
      { freq: 130.81, duration: 3.5 },   // C3
      { freq: 0, duration: 1.0 },
      { freq: 146.83, duration: 3.0 },   // D3
      { freq: 0, duration: 1.0 },
      { freq: 164.81, duration: 3.5 },   // E3
      { freq: 0, duration: 2.0 },
    ];

    let time = this.audioContext.currentTime + 0.1;
    const totalDuration = notes.reduce((sum, n) => sum + n.duration, 0);

    notes.forEach((note) => {
      if (note.freq > 0) {
        this.playNote(note.freq, time, note.duration * 0.85, 0.07, "sine");
      }
      time += note.duration;
    });

    let bassTime = this.audioContext.currentTime + 0.1;
    bass.forEach((note) => {
      if (note.freq > 0) {
        this.playNote(note.freq, bassTime, note.duration * 0.9, 0.03, "triangle");
      }
      bassTime += note.duration;
    });

    this.musicInterval = window.setTimeout(() => {
      if (this.musicPlaying) {
        this.playCurrentTrack();
      }
    }, (totalDuration + 2) * 1000);
  }

  // Track 3: Night Market - Chill, ambient
  private playNightMarket(): void {
    if (!this.audioContext || !this.gainNode) return;

    // Chill ambient melody - very spacious and relaxed
    const notes = [
      { freq: 293.66, duration: 1.2 },   // D4
      { freq: 0, duration: 0.8 },        // Rest
      { freq: 329.63, duration: 1.0 },   // E4
      { freq: 392.00, duration: 1.4 },   // G4
      { freq: 0, duration: 1.2 },        // Long rest

      { freq: 440.00, duration: 1.0 },   // A4
      { freq: 392.00, duration: 0.8 },   // G4
      { freq: 329.63, duration: 1.4 },   // E4
      { freq: 0, duration: 1.0 },        // Rest

      { freq: 293.66, duration: 0.8 },   // D4
      { freq: 261.63, duration: 1.2 },   // C4
      { freq: 0, duration: 1.5 },        // Long rest

      { freq: 329.63, duration: 1.0 },   // E4
      { freq: 293.66, duration: 0.8 },   // D4
      { freq: 261.63, duration: 1.6 },   // C4
      { freq: 0, duration: 2.0 },        // Very long rest

      { freq: 392.00, duration: 1.2 },   // G4
      { freq: 329.63, duration: 1.0 },   // E4
      { freq: 293.66, duration: 1.4 },   // D4
      { freq: 0, duration: 2.5 },        // Extra long rest before loop
    ];

    const pad = [
      { freq: 130.81, duration: 4.0 },   // C3
      { freq: 0, duration: 1.5 },
      { freq: 110.00, duration: 4.0 },   // A2
      { freq: 0, duration: 1.5 },
      { freq: 98.00, duration: 4.0 },    // G2
      { freq: 0, duration: 1.5 },
      { freq: 130.81, duration: 5.0 },   // C3
      { freq: 0, duration: 2.0 },
    ];

    let time = this.audioContext.currentTime + 0.1;
    const totalDuration = notes.reduce((sum, n) => sum + n.duration, 0);

    notes.forEach((note) => {
      if (note.freq > 0) {
        this.playNote(note.freq, time, note.duration * 0.9, 0.06, "sine");
      }
      time += note.duration;
    });

    let padTime = this.audioContext.currentTime + 0.1;
    pad.forEach((note) => {
      if (note.freq > 0) {
        this.playNote(note.freq, padTime, note.duration * 0.95, 0.03, "sine");
      }
      padTime += note.duration;
    });

    this.musicInterval = window.setTimeout(() => {
      if (this.musicPlaying) {
        this.playCurrentTrack();
      }
    }, (totalDuration + 2) * 1000);
  }

  // Track 4: Victory March - Gentle, hopeful
  private playVictoryMarch(): void {
    if (!this.audioContext || !this.gainNode) return;

    // Gentle hopeful melody - uplifting but calm
    const notes = [
      { freq: 392.00, duration: 1.0 },   // G4
      { freq: 440.00, duration: 0.8 },   // A4
      { freq: 493.88, duration: 1.2 },   // B4
      { freq: 0, duration: 0.8 },        // Rest

      { freq: 523.25, duration: 1.0 },   // C5
      { freq: 493.88, duration: 0.8 },   // B4
      { freq: 440.00, duration: 1.2 },   // A4
      { freq: 0, duration: 1.0 },        // Long rest

      { freq: 392.00, duration: 0.8 },   // G4
      { freq: 329.63, duration: 0.8 },   // E4
      { freq: 392.00, duration: 1.0 },   // G4
      { freq: 440.00, duration: 1.4 },   // A4
      { freq: 0, duration: 1.2 },        // Long rest

      { freq: 493.88, duration: 1.0 },   // B4
      { freq: 523.25, duration: 1.2 },   // C5
      { freq: 0, duration: 0.6 },        // Rest
      { freq: 493.88, duration: 0.8 },   // B4
      { freq: 440.00, duration: 1.0 },   // A4
      { freq: 392.00, duration: 1.6 },   // G4
      { freq: 0, duration: 2.5 },        // Very long rest before loop
    ];

    const bass = [
      { freq: 196.00, duration: 4.0 },   // G3
      { freq: 0, duration: 1.0 },
      { freq: 130.81, duration: 4.0 },   // C3
      { freq: 0, duration: 1.0 },
      { freq: 164.81, duration: 3.5 },   // E3
      { freq: 0, duration: 1.5 },
      { freq: 196.00, duration: 5.0 },   // G3
      { freq: 0, duration: 2.0 },
    ];

    let time = this.audioContext.currentTime + 0.1;
    const totalDuration = notes.reduce((sum, n) => sum + n.duration, 0);

    notes.forEach((note) => {
      if (note.freq > 0) {
        this.playNote(note.freq, time, note.duration * 0.85, 0.07, "sine");
      }
      time += note.duration;
    });

    let bassTime = this.audioContext.currentTime + 0.1;
    bass.forEach((note) => {
      if (note.freq > 0) {
        this.playNote(note.freq, bassTime, note.duration * 0.9, 0.03, "triangle");
      }
      bassTime += note.duration;
    });

    this.musicInterval = window.setTimeout(() => {
      if (this.musicPlaying) {
        this.playCurrentTrack();
      }
    }, (totalDuration + 2) * 1000);
  }

  private playNote(frequency: number, startTime: number, duration: number, volume: number, waveType: OscillatorType = "sine"): void {
    if (!this.audioContext || !this.gainNode) return;

    const oscillator = this.audioContext.createOscillator();
    const noteGain = this.audioContext.createGain();

    // Add a low-pass filter for smoother sound
    const filter = this.audioContext.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2000;
    filter.Q.value = 0.5;

    oscillator.connect(filter);
    filter.connect(noteGain);
    noteGain.connect(this.gainNode);

    // Use sine wave for clean, smooth sound (triangle for slight warmth)
    oscillator.type = waveType;
    oscillator.frequency.value = frequency;

    // Smooth envelope with longer attack/release for ambient feel
    const attackTime = Math.min(0.08, duration * 0.15);
    const releaseTime = Math.min(0.15, duration * 0.3);

    noteGain.gain.setValueAtTime(0, startTime);
    noteGain.gain.linearRampToValueAtTime(volume, startTime + attackTime);
    noteGain.gain.setValueAtTime(volume * 0.8, startTime + duration - releaseTime);
    noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.01);
  }

  private toggleMusic(): void {
    if (this.musicPlaying) {
      this.musicPlaying = false;
      if (this.musicInterval) {
        clearTimeout(this.musicInterval);
        this.musicInterval = null;
      }
      if (this.gainNode) {
        this.gainNode.gain.value = 0;
      }
    } else {
      this.musicPlaying = true;
      if (this.gainNode) {
        this.gainNode.gain.value = 0.08;
      }
      this.playCurrentTrack();
    }
  }

  update(): void {
    // Update character movements with smoother motion
    this.characterSprites.forEach((sprite, id) => {
      const character = this.worldState?.population.find((c) => c.id === id);
      if (character?.isMoving) {
        const speed = 0.3 + Math.random() * 0.2;
        if (character.direction === "left") {
          sprite.x -= speed;
          sprite.setFlipX(true);
          if (sprite.x < 80) {
            character.direction = "right";
          }
        } else {
          sprite.x += speed;
          sprite.setFlipX(false);
          if (sprite.x > 720) {
            character.direction = "left";
          }
        }
      }
    });

    // Animate clouds with parallax
    this.clouds.forEach((cloud, i) => {
      cloud.x += 0.15 + i * 0.05;
      if (cloud.x > 870) {
        cloud.x = -70;
        cloud.y = 30 + Math.random() * 120;
      }
    });

    // Animate animals
    this.animals.forEach((animal) => {
      if (animal.isIdle) {
        animal.idleTimer += 1;
        // After idle period, start moving again
        if (animal.idleTimer > 100 + Math.random() * 200) {
          animal.isIdle = false;
          animal.idleTimer = 0;
          animal.targetX = 50 + Math.random() * 700;
          animal.direction = animal.targetX > animal.sprite.x ? "right" : "left";
        }
      } else {
        // Move toward target
        const dx = animal.targetX - animal.sprite.x;
        if (Math.abs(dx) < 5) {
          // Reached target, become idle
          animal.isIdle = true;
        } else {
          animal.sprite.x += animal.speed * (dx > 0 ? 1 : -1);
          animal.sprite.setFlipX(dx < 0);
        }

        // Keep within bounds
        if (animal.sprite.x < 30) {
          animal.sprite.x = 30;
          animal.targetX = 50 + Math.random() * 300;
        }
        if (animal.sprite.x > 770) {
          animal.sprite.x = 770;
          animal.targetX = 500 + Math.random() * 250;
        }
      }
    });
  }

  updateWorldState(state: WorldState): void {
    const previousState = this.worldState;
    this.worldState = state;

    // IMPORTANT: Update day/night FIRST so weather effects know the time
    // Always update time info to ensure correct celestial bodies
    if (state.timeInfo) {
      this.updateDayNightFromEST(state.timeInfo);
    } else {
      console.warn("[BagsWorld] No timeInfo in state!");
    }

    // Update weather AFTER time is set (check if weather changed OR if this is first load)
    if (!previousState || previousState.weather !== state.weather) {
      this.updateWeather(state.weather);
    }

    // Update characters
    this.updateCharacters(state.population);

    // Update buildings
    this.updateBuildings(state.buildings);

    // Trigger events
    if (state.events.length > 0 && previousState) {
      const newEvents = state.events.filter(
        (e) => !previousState.events.find((pe) => pe.id === e.id)
      );
      newEvents.forEach((event) => this.triggerEvent(event));
    }
  }

  private currentTimeInfo: { isNight: boolean; isDusk: boolean; isDawn: boolean } | null = null;

  private updateDayNightFromEST(timeInfo: { isNight: boolean; isDusk: boolean; isDawn: boolean }): void {
    console.log("[BagsWorld] Time update:", timeInfo);
    const wasNight = this.currentTimeInfo?.isNight;
    this.currentTimeInfo = timeInfo;
    let alpha = 0;
    let tint = 0x000000;

    if (timeInfo.isNight) {
      // Night (8 PM to 6 AM EST) - deep blue overlay
      alpha = 0.45;
      tint = 0x0a0a2e;
      // Create fireflies at night
      this.createFireflies();
      // Hide ambient particles at night
      if (this.ambientParticles) {
        this.ambientParticles.setVisible(false);
      }
    } else if (timeInfo.isDusk) {
      // Dusk (6 PM to 8 PM EST) - warm orange/purple
      alpha = 0.25;
      tint = 0x4a2a3e;
      // Start showing some fireflies at dusk
      this.createFireflies();
    } else if (timeInfo.isDawn) {
      // Dawn (6 AM to 8 AM EST) - soft golden
      alpha = 0.2;
      tint = 0x3a2a1e;
      // Remove fireflies at dawn
      this.destroyFireflies();
      if (this.ambientParticles) {
        this.ambientParticles.setVisible(true);
      }
    } else {
      // Daytime - remove fireflies, show ambient particles
      if (wasNight || this.currentTimeInfo === null) {
        this.destroyFireflies();
        if (this.ambientParticles) {
          this.ambientParticles.setVisible(true);
        }
      }
    }

    // Set the fill style first, then animate alpha
    if (alpha > 0) {
      this.overlay.setFillStyle(tint, 1); // Set full color, alpha controlled by tween
    }

    // Smoothly transition the overlay alpha
    this.tweens.add({
      targets: this.overlay,
      alpha,
      duration: 3000,
      ease: "Sine.easeInOut",
    });

    // Update sun/moon based on time - IMPORTANT: do this AFTER setting currentTimeInfo
    this.updateCelestialBody(timeInfo);

    // Update sky color and stars based on time
    this.updateSkyForTime(timeInfo);

    // If it's night and we have a sun, remove it immediately
    if (timeInfo.isNight && this.sunSprite) {
      this.sunSprite.destroy();
      this.sunSprite = null;
    }
  }

  private moonSprite: Phaser.GameObjects.Sprite | null = null;
  private starsContainer: Phaser.GameObjects.Container | null = null;

  private updateCelestialBody(timeInfo: { isNight: boolean; isDusk: boolean; isDawn: boolean }): void {
    // Remove existing sun if it's nighttime
    if (timeInfo.isNight && this.sunSprite) {
      this.tweens.add({
        targets: this.sunSprite,
        alpha: 0,
        y: 150,
        duration: 2000,
        onComplete: () => {
          this.sunSprite?.destroy();
          this.sunSprite = null;
        }
      });
    }

    // Show moon at night
    if (timeInfo.isNight && !this.moonSprite) {
      this.moonSprite = this.add.sprite(650, 80, "moon");
      this.moonSprite.setScale(1.5);
      this.moonSprite.setAlpha(0);
      this.moonSprite.setDepth(0);

      this.tweens.add({
        targets: this.moonSprite,
        alpha: 0.9,
        duration: 2000,
      });

      // Gentle moon glow
      this.tweens.add({
        targets: this.moonSprite,
        scale: 1.6,
        duration: 4000,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    // Hide moon during day
    if (!timeInfo.isNight && this.moonSprite) {
      this.tweens.add({
        targets: this.moonSprite,
        alpha: 0,
        duration: 2000,
        onComplete: () => {
          this.moonSprite?.destroy();
          this.moonSprite = null;
        }
      });
    }

    // Show sun during daytime (not night, not dusk)
    if (!timeInfo.isNight && !timeInfo.isDusk && !this.sunSprite) {
      this.sunSprite = this.add.sprite(150, 80, "sun");
      this.sunSprite.setScale(2);
      this.sunSprite.setAlpha(0);
      this.sunSprite.setDepth(0);
      this.sunSprite.setTint(0xffdd44);

      // Fade in the sun
      this.tweens.add({
        targets: this.sunSprite,
        alpha: 0.9,
        y: 60,
        duration: 2000,
      });

      // Gentle sun pulse
      this.tweens.add({
        targets: this.sunSprite,
        scale: 2.1,
        duration: 3000,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    // Hide sun at dusk (transition period)
    if (timeInfo.isDusk && this.sunSprite) {
      this.tweens.add({
        targets: this.sunSprite,
        alpha: 0.4,
        y: 120,
        duration: 2000,
      });
    }
  }

  private startDayNightCycle(): void {
    // This now serves as a fallback for smooth transitions
    // The actual day/night state comes from EST time via API
    this.time.addEvent({
      delay: 5000,
      callback: () => {
        // Smooth overlay transitions are handled by updateDayNightFromEST
      },
      loop: true,
    });
  }

  private updateWeather(weather: WorldState["weather"]): void {
    // Clear existing weather effects
    if (this.weatherEmitter) {
      this.weatherEmitter.stop();
      this.weatherEmitter.destroy();
      this.weatherEmitter = null;
    }

    if (this.sunSprite) {
      this.sunSprite.destroy();
      this.sunSprite = null;
    }

    // Update cloud appearance
    this.clouds.forEach((cloud) => {
      let tint = 0xffffff;
      let alpha = 0.5;

      switch (weather) {
        case "sunny":
          tint = 0xffffff;
          alpha = 0.3;
          break;
        case "cloudy":
          tint = 0xaaaaaa;
          alpha = 0.7;
          break;
        case "rain":
          tint = 0x666666;
          alpha = 0.85;
          break;
        case "storm":
          tint = 0x444444;
          alpha = 0.95;
          break;
        case "apocalypse":
          tint = 0x442222;
          alpha = 1;
          break;
      }

      this.tweens.add({
        targets: cloud,
        alpha,
        duration: 1000,
      });
      cloud.setTint(tint);
    });

    // Weather-specific effects
    switch (weather) {
      case "sunny":
        this.createSunnyEffect();
        break;
      case "rain":
        this.createRainEffect(false);
        break;
      case "storm":
        this.createRainEffect(true);
        this.createLightningEffect();
        break;
      case "apocalypse":
        this.createApocalypseEffect();
        break;
    }
  }

  private createSunnyEffect(): void {
    // Only show sun during daytime - check multiple conditions
    if (this.currentTimeInfo?.isNight || this.currentTimeInfo?.isDusk) {
      // At night or dusk, don't show sun - moon will be shown instead
      return;
    }

    // Also destroy any existing sun to prevent duplicates
    if (this.sunSprite) {
      this.sunSprite.destroy();
      this.sunSprite = null;
    }

    this.sunSprite = this.add.sprite(700, 70, "sun");
    this.sunSprite.setScale(2.5);
    this.sunSprite.setAlpha(0.9);
    this.sunSprite.setDepth(0);

    this.tweens.add({
      targets: this.sunSprite,
      scale: 2.7,
      alpha: 0.7,
      duration: 3000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Sun rays
    const rays = this.add.graphics();
    rays.setDepth(-1);
    rays.fillStyle(0xfbbf24, 0.1);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      rays.fillTriangle(
        700, 70,
        700 + Math.cos(angle) * 150, 70 + Math.sin(angle) * 150,
        700 + Math.cos(angle + 0.3) * 150, 70 + Math.sin(angle + 0.3) * 150
      );
    }

    this.tweens.add({
      targets: rays,
      alpha: 0.5,
      angle: 360,
      duration: 30000,
      repeat: -1,
    });
  }

  private createRainEffect(isStorm: boolean): void {
    this.weatherEmitter = this.add.particles(0, 0, "rain", {
      x: { min: 0, max: 800 },
      y: -10,
      lifespan: 800,
      speedY: { min: 300, max: 500 },
      speedX: isStorm ? { min: -100, max: -150 } : { min: -20, max: 20 },
      scale: { start: 1, end: 0.6 },
      quantity: isStorm ? 15 : 8,
      frequency: 30,
      alpha: { start: 0.8, end: 0.3 },
    });
    this.weatherEmitter.setDepth(50);
  }

  private createLightningEffect(): void {
    this.time.addEvent({
      delay: 3000 + Math.random() * 5000,
      callback: () => {
        if (this.worldState?.weather === "storm") {
          // Flash
          this.cameras.main.flash(100, 255, 255, 255, true);

          // Lightning bolt
          const x = 100 + Math.random() * 600;
          const lightning = this.add.sprite(x, 100, "lightning");
          lightning.setScale(2);
          lightning.setDepth(60);

          this.tweens.add({
            targets: lightning,
            alpha: 0,
            duration: 200,
            onComplete: () => lightning.destroy(),
          });

          // Schedule next lightning
          this.time.delayedCall(3000 + Math.random() * 5000, () => {
            this.createLightningEffect();
          });
        }
      },
      loop: false,
    });
  }

  private createApocalypseEffect(): void {
    this.cameras.main.setBackgroundColor(0x1a0505);
    this.overlay.setFillStyle(0xff0000, 0.15);

    // Shake periodically
    this.time.addEvent({
      delay: 2000,
      callback: () => {
        if (this.worldState?.weather === "apocalypse") {
          this.cameras.main.shake(500, 0.005);
        }
      },
      loop: true,
    });

    // Falling embers
    this.weatherEmitter = this.add.particles(0, 0, "coin", {
      x: { min: 0, max: 800 },
      y: -10,
      lifespan: 3000,
      speedY: { min: 50, max: 100 },
      speedX: { min: -30, max: 30 },
      scale: { start: 0.3, end: 0 },
      quantity: 2,
      frequency: 200,
      tint: 0xff4444,
      alpha: { start: 0.8, end: 0 },
    });
    this.weatherEmitter.setDepth(50);
  }

  private updateCharacters(characters: GameCharacter[]): void {
    // Characters only appear in Park (main_city), not in BagsCity
    if (this.currentZone !== "main_city") {
      // Hide all characters when in BagsCity
      this.characterSprites.forEach((sprite) => {
        sprite.setVisible(false);
      });
      return;
    }

    // Show characters when in Park
    this.characterSprites.forEach((sprite) => {
      sprite.setVisible(true);
    });

    const currentIds = new Set(characters.map((c) => c.id));

    // Remove old characters
    this.characterSprites.forEach((sprite, id) => {
      if (!currentIds.has(id)) {
        sprite.destroy();
        this.characterSprites.delete(id);
        this.characterVariants.delete(id);
      }
    });

    // Add or update characters
    characters.forEach((character, index) => {
      let sprite = this.characterSprites.get(character.id);

      if (!sprite) {
        // Special characters use unique textures, others get random variants
        const isToly = character.isToly === true;
        const isAsh = character.isAsh === true;
        const isFinn = character.isFinn === true;
        const isDev = character.isDev === true;
        const isScout = character.isScout === true;
        const isSpecial = isToly || isAsh || isFinn || isDev || isScout;
        const variant = index % 9;
        this.characterVariants.set(character.id, variant);

        const textureKey = isToly ? "toly" : isAsh ? "ash" : isFinn ? "finn" : isDev ? "dev" : isScout ? "neo" : this.getCharacterTexture(character.mood, variant);
        sprite = this.add.sprite(character.x, character.y, textureKey);
        sprite.setDepth(isSpecial ? 11 : 10); // Special characters slightly above others
        sprite.setInteractive();
        sprite.setScale(isSpecial ? 1.3 : 1.2); // Special characters slightly larger

        // Hover effects
        sprite.on("pointerover", () => {
          sprite?.setScale(isSpecial ? 1.5 : 1.4);
          if (isToly) {
            this.showTolyTooltip(sprite!);
          } else if (isAsh) {
            this.showAshTooltip(sprite!);
          } else if (isFinn) {
            this.showFinnTooltip(sprite!);
          } else if (isDev) {
            this.showDevTooltip(sprite!);
          } else if (isScout) {
            this.showScoutTooltip(sprite!);
          } else {
            this.showCharacterTooltip(character, sprite!);
          }
          this.input.setDefaultCursor("pointer");
        });
        sprite.on("pointerout", () => {
          sprite?.setScale(isSpecial ? 1.3 : 1.2);
          this.hideTooltip();
          this.input.setDefaultCursor("default");
        });
        sprite.on("pointerdown", () => {
          if (isToly) {
            // Toly opens the Solana wisdom chat
            window.dispatchEvent(new CustomEvent("bagsworld-toly-click"));
          } else if (isAsh) {
            // Ash opens the ecosystem guide chat
            window.dispatchEvent(new CustomEvent("bagsworld-ash-click"));
          } else if (isFinn) {
            // Finn opens the Bags.fm guide chat
            window.dispatchEvent(new CustomEvent("bagsworld-finn-click"));
          } else if (isDev) {
            // The Dev opens the trading agent chat
            window.dispatchEvent(new CustomEvent("bagsworld-dev-click"));
          } else if (isScout) {
            // Neo opens the scout panel
            window.dispatchEvent(new CustomEvent("bagsworld-scout-click"));
          } else if (character.profileUrl) {
            // Open profile page in new tab
            window.open(character.profileUrl, "_blank");
          }
        });

        // Walking animation - characters randomly walk around the park
        this.startCharacterWalking(sprite, character, isSpecial);

        // Add Solana gradient aura glow effect for Toly
        if (isToly) {
          const glow = this.add.sprite(character.x, character.y, "glow");
          glow.setScale(1.0);
          glow.setAlpha(0.3);
          glow.setTint(0x9945ff); // Solana purple
          glow.setDepth(10);

          // Store reference to glow for cleanup
          (sprite as any).tolyGlow = glow;

          this.tweens.add({
            targets: glow,
            alpha: 0.5,
            scale: 1.2,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
        }

        // Add red/blue aura glow effect for Ash
        if (isAsh) {
          const glow = this.add.sprite(character.x, character.y, "glow");
          glow.setScale(1.0);
          glow.setAlpha(0.3);
          glow.setTint(0xdc2626); // Pokemon red
          glow.setDepth(10);

          // Store reference to glow for cleanup
          (sprite as any).ashGlow = glow;

          this.tweens.add({
            targets: glow,
            alpha: 0.5,
            scale: 1.2,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
        }

        // Add emerald glow effect for Finn
        if (isFinn) {
          const glow = this.add.sprite(character.x, character.y, "glow");
          glow.setScale(1.0);
          glow.setAlpha(0.3);
          glow.setTint(0x10b981); // Emerald/Bags green
          glow.setDepth(10);

          // Store reference to glow for cleanup
          (sprite as any).finnGlow = glow;

          this.tweens.add({
            targets: glow,
            alpha: 0.5,
            scale: 1.2,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
        }

        // Add purple/cyan glow effect for The Dev
        if (isDev) {
          const glow = this.add.sprite(character.x, character.y, "glow");
          glow.setScale(1.0);
          glow.setAlpha(0.3);
          glow.setTint(0x8b5cf6); // Purple (hacker vibes)
          glow.setDepth(10);

          // Store reference to glow for cleanup
          (sprite as any).devGlow = glow;

          this.tweens.add({
            targets: glow,
            alpha: 0.5,
            scale: 1.2,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
        }

        // Add Matrix green glow effect for Neo (Scout)
        if (isScout) {
          const glow = this.add.sprite(character.x, character.y, "glow");
          glow.setScale(1.0);
          glow.setAlpha(0.4);
          glow.setTint(0x00ff41); // Matrix green
          glow.setDepth(10);

          // Store reference to glow for cleanup
          (sprite as any).scoutGlow = glow;

          // Faster, more digital-feeling pulse for Neo
          this.tweens.add({
            targets: glow,
            alpha: 0.7,
            scale: 1.3,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
        }

        this.characterSprites.set(character.id, sprite);
      } else {
        // Update special character glow positions if they exist
        const tolyGlow = (sprite as any).tolyGlow;
        if (tolyGlow) {
          tolyGlow.x = sprite.x;
          tolyGlow.y = sprite.y;
        }
        const ashGlow = (sprite as any).ashGlow;
        if (ashGlow) {
          ashGlow.x = sprite.x;
          ashGlow.y = sprite.y;
        }
        const finnGlow = (sprite as any).finnGlow;
        if (finnGlow) {
          finnGlow.x = sprite.x;
          finnGlow.y = sprite.y;
        }
        const devGlow = (sprite as any).devGlow;
        if (devGlow) {
          devGlow.x = sprite.x;
          devGlow.y = sprite.y;
        }
        const scoutGlow = (sprite as any).scoutGlow;
        if (scoutGlow) {
          scoutGlow.x = sprite.x;
          scoutGlow.y = sprite.y;
        }
      }

      // Update texture based on mood (skip for special characters)
      const isToly = character.isToly === true;
      const isAsh = character.isAsh === true;
      const isFinn = character.isFinn === true;
      const isDev = character.isDev === true;
      const isScout = character.isScout === true;
      if (!isToly && !isAsh && !isFinn && !isDev && !isScout) {
        const variant = this.characterVariants.get(character.id) ?? 0;
        const expectedTexture = this.getCharacterTexture(character.mood, variant);
        if (sprite.texture.key !== expectedTexture) {
          sprite.setTexture(expectedTexture);
        }
      }
    });
  }

  private getCharacterTexture(mood: GameCharacter["mood"], variant: number): string {
    const moodSuffix = mood === "neutral" ? "" : `_${mood}`;
    return `character_${variant}${moodSuffix}`;
  }

  private updateBuildings(buildings: GameBuilding[]): void {
    // Filter buildings by current zone
    // Buildings with no zone appear in both, buildings with specific zone only in that zone
    const zoneBuildings = buildings.filter((b) => {
      if (!b.zone) return true; // No zone = appears everywhere
      return b.zone === this.currentZone;
    });

    const currentIds = new Set(zoneBuildings.map((b) => b.id));

    // Remove old buildings (including those no longer in this zone)
    this.buildingSprites.forEach((container, id) => {
      if (!currentIds.has(id)) {
        container.destroy();
        this.buildingSprites.delete(id);
      }
    });

    // Add or update buildings
    zoneBuildings.forEach((building) => {
      let container = this.buildingSprites.get(building.id);

      if (!container) {
        container = this.add.container(building.x, building.y);

        // Scale building based on level (market cap)
        // Level 1: 0.8x, Level 2: 0.9x, Level 3: 1.0x, Level 4: 1.15x, Level 5: 1.3x
        const buildingScales = [0.8, 0.9, 1.0, 1.15, 1.3];
        const buildingScale = buildingScales[building.level - 1] || 1.0;

        // Shadow scales with building
        const shadowWidth = 20 + building.level * 6;
        const shadow = this.add.ellipse(2, 2, shadowWidth, 8, 0x000000, 0.3);
        container.add(shadow);

        // Use special texture for PokeCenter/TradingGym, otherwise use level-based building
        const isPokeCenter = building.id.includes("PokeCenter") || building.symbol === "HEAL";
        const isTradingGym = building.id.includes("TradingGym") || building.symbol === "GYM";
        const buildingTexture = isPokeCenter ? "pokecenter" : isTradingGym ? "tradinggym" : `building_${building.level}`;
        const sprite = this.add.sprite(0, 0, buildingTexture);
        sprite.setOrigin(0.5, 1);
        sprite.setScale(isPokeCenter ? 1.0 : isTradingGym ? 1.0 : buildingScale);
        container.add(sprite);

        // Glow effect for pumping buildings
        if (building.glowing) {
          const glow = this.add.sprite(0, -40, "glow");
          glow.setScale(1.5);
          glow.setAlpha(0.4);
          glow.setTint(0x4ade80);
          container.add(glow);

          this.tweens.add({
            targets: glow,
            alpha: 0.7,
            scale: 1.8,
            duration: 800,
            yoyo: true,
            repeat: -1,
          });
        }

        // Label with background
        const labelBg = this.add.rectangle(0, 12, 50, 14, 0x000000, 0.7);
        labelBg.setStrokeStyle(1, 0x4ade80);
        container.add(labelBg);

        const label = this.add.text(0, 12, building.symbol, {
          fontFamily: "monospace",
          fontSize: "9px",
          color: "#4ade80",
        });
        label.setOrigin(0.5, 0.5);
        container.add(label);

        container.setDepth(5);
        container.setInteractive(
          new Phaser.Geom.Rectangle(-20, -80, 40, 80),
          Phaser.Geom.Rectangle.Contains
        );

        container.on("pointerover", () => {
          container?.setScale(1.1);
          this.showBuildingTooltip(building, container!);
          this.input.setDefaultCursor("pointer");
        });
        container.on("pointerout", () => {
          container?.setScale(1);
          this.hideTooltip();
          this.input.setDefaultCursor("default");
        });
        container.on("pointerdown", () => {
          const isPokeCenter = building.id.includes("PokeCenter");
          const isTradingGym = building.id.includes("TradingGym") || building.symbol === "GYM";
          const isStarterBuilding = building.id.startsWith("Starter");
          const isTreasuryBuilding = building.id.startsWith("Treasury");

          if (isPokeCenter) {
            // PokeCenter opens the auto-claim hub modal
            window.dispatchEvent(new CustomEvent("bagsworld-pokecenter-click", {
              detail: { buildingId: building.id, name: building.name }
            }));
          } else if (isTradingGym) {
            // TradingGym opens the AI trading arena modal
            window.dispatchEvent(new CustomEvent("bagsworld-tradinggym-click", {
              detail: { buildingId: building.id, name: building.name }
            }));
          } else if (isStarterBuilding) {
            // Other starter buildings show a message
            console.log(`${building.name} - Launch a token to create a real building!`);
          } else if (isTreasuryBuilding && building.tokenUrl) {
            // Treasury building opens Solscan directly for transparency
            window.open(building.tokenUrl, "_blank");
          } else {
            // Regular tokens emit event for React to open trade modal
            window.dispatchEvent(new CustomEvent("bagsworld-building-click", {
              detail: {
                mint: building.tokenMint || building.id,
                symbol: building.symbol || building.name,
                name: building.name,
                tokenUrl: building.tokenUrl,
              }
            }));
          }
        });

        this.buildingSprites.set(building.id, container);

        // Spawn animation
        container.setScale(0);
        container.setAlpha(0);
        this.tweens.add({
          targets: container,
          scale: 1,
          alpha: 1,
          duration: 600,
          ease: "Back.easeOut",
        });
      } else {
        // Update existing building
        const sprite = container.getAt(1) as Phaser.GameObjects.Sprite;
        const isPokeCenter = building.id.includes("PokeCenter") || building.symbol === "HEAL";
        const isTradingGym = building.id.includes("TradingGym") || building.symbol === "GYM";
        const newTexture = isPokeCenter ? "pokecenter" : isTradingGym ? "tradinggym" : `building_${building.level}`;
        if (sprite.texture.key !== newTexture) {
          this.tweens.add({
            targets: container,
            scale: 1.15,
            duration: 150,
            yoyo: true,
            onComplete: () => {
              sprite.setTexture(newTexture);
            },
          });
        }
      }
    });
  }

  private tooltip: Phaser.GameObjects.Container | null = null;

  private formatMarketCap(value: number): string {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  }

  private showCharacterTooltip(
    character: GameCharacter,
    sprite: Phaser.GameObjects.Sprite
  ): void {
    this.hideTooltip();

    const container = this.add.container(sprite.x, sprite.y - 65);

    const bg = this.add.rectangle(0, 0, 140, 58, 0x0a0a0f, 0.95);
    bg.setStrokeStyle(2, 0x4ade80);

    const nameText = this.add.text(0, -18, `@${character.username}`, {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ffffff",
    });
    nameText.setOrigin(0.5, 0.5);

    const providerText = this.add.text(0, -4, `${character.provider === "twitter" ? "𝕏" : character.provider}`, {
      fontFamily: "monospace",
      fontSize: "8px",
      color: "#9ca3af",
    });
    providerText.setOrigin(0.5, 0.5);

    const earningsText = this.add.text(0, 10, `💰 $${character.earnings24h.toFixed(0)} (24h)`, {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#4ade80",
    });
    earningsText.setOrigin(0.5, 0.5);

    const clickText = this.add.text(0, 24, "Click to view profile", {
      fontFamily: "monospace",
      fontSize: "7px",
      color: "#6b7280",
    });
    clickText.setOrigin(0.5, 0.5);

    container.add([bg, nameText, providerText, earningsText, clickText]);
    container.setDepth(200);
    this.tooltip = container;
  }

  private showTolyTooltip(sprite: Phaser.GameObjects.Sprite): void {
    this.hideTooltip();

    const container = this.add.container(sprite.x, sprite.y - 70);

    const bg = this.add.rectangle(0, 0, 165, 68, 0x0a0a0f, 0.95);
    bg.setStrokeStyle(2, 0x9945ff); // Solana purple border

    const nameText = this.add.text(0, -22, "◎ toly", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#14f195", // Solana green
    });
    nameText.setOrigin(0.5, 0.5);

    const titleText = this.add.text(0, -6, "Solana Co-Founder", {
      fontFamily: "monospace",
      fontSize: "8px",
      color: "#ffffff",
    });
    titleText.setOrigin(0.5, 0.5);

    const quoteText = this.add.text(0, 10, "Keep executing.", {
      fontFamily: "monospace",
      fontSize: "7px",
      color: "#9ca3af",
    });
    quoteText.setOrigin(0.5, 0.5);

    const clickText = this.add.text(0, 26, "₿ Click for crypto wisdom", {
      fontFamily: "monospace",
      fontSize: "7px",
      color: "#f7931a",
    });
    clickText.setOrigin(0.5, 0.5);

    container.add([bg, nameText, titleText, quoteText, clickText]);
    container.setDepth(200);
    this.tooltip = container;
  }

  private showAshTooltip(sprite: Phaser.GameObjects.Sprite): void {
    this.hideTooltip();

    const container = this.add.container(sprite.x, sprite.y - 70);

    const bg = this.add.rectangle(0, 0, 165, 68, 0x0a0a0f, 0.95);
    bg.setStrokeStyle(2, 0xdc2626); // Pokemon red border

    const nameText = this.add.text(0, -22, "⚡ Ash Ketchum", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#dc2626",
    });
    nameText.setOrigin(0.5, 0.5);

    const titleText = this.add.text(0, -6, "Ecosystem Guide", {
      fontFamily: "monospace",
      fontSize: "8px",
      color: "#ffffff",
    });
    titleText.setOrigin(0.5, 0.5);

    const descText = this.add.text(0, 10, "Gotta catch 'em all... tokens!", {
      fontFamily: "monospace",
      fontSize: "7px",
      color: "#9ca3af",
    });
    descText.setOrigin(0.5, 0.5);

    const clickText = this.add.text(0, 26, "📖 Click to learn about BagsWorld", {
      fontFamily: "monospace",
      fontSize: "7px",
      color: "#fbbf24",
    });
    clickText.setOrigin(0.5, 0.5);

    container.add([bg, nameText, titleText, descText, clickText]);
    container.setDepth(200);
    this.tooltip = container;
  }

  private showFinnTooltip(sprite: Phaser.GameObjects.Sprite): void {
    this.hideTooltip();

    const container = this.add.container(sprite.x, sprite.y - 70);

    const bg = this.add.rectangle(0, 0, 165, 68, 0x0a0a0f, 0.95);
    bg.setStrokeStyle(2, 0x10b981); // Emerald/Bags green border

    const nameText = this.add.text(0, -22, "💼 Finn", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#10b981",
    });
    nameText.setOrigin(0.5, 0.5);

    const titleText = this.add.text(0, -6, "Bags.fm Founder & CEO", {
      fontFamily: "monospace",
      fontSize: "8px",
      color: "#ffffff",
    });
    titleText.setOrigin(0.5, 0.5);

    const quoteText = this.add.text(0, 10, "Launch. Earn. Build your empire.", {
      fontFamily: "monospace",
      fontSize: "7px",
      color: "#9ca3af",
    });
    quoteText.setOrigin(0.5, 0.5);

    const clickText = this.add.text(0, 26, "🚀 Click to learn about Bags.fm", {
      fontFamily: "monospace",
      fontSize: "7px",
      color: "#fbbf24",
    });
    clickText.setOrigin(0.5, 0.5);

    container.add([bg, nameText, titleText, quoteText, clickText]);
    container.setDepth(200);
    this.tooltip = container;
  }

  private showDevTooltip(sprite: Phaser.GameObjects.Sprite): void {
    this.hideTooltip();

    const container = this.add.container(sprite.x, sprite.y - 70);

    const bg = this.add.rectangle(0, 0, 165, 68, 0x0a0a0f, 0.95);
    bg.setStrokeStyle(2, 0x8b5cf6); // Purple border (hacker vibes)

    const nameText = this.add.text(0, -22, "👻 The Dev", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#8b5cf6",
    });
    nameText.setOrigin(0.5, 0.5);

    const titleText = this.add.text(0, -6, "@DaddyGhost • Trading Agent", {
      fontFamily: "monospace",
      fontSize: "8px",
      color: "#ffffff",
    });
    titleText.setOrigin(0.5, 0.5);

    const quoteText = this.add.text(0, 10, "in the trenches. let's trade.", {
      fontFamily: "monospace",
      fontSize: "7px",
      color: "#9ca3af",
    });
    quoteText.setOrigin(0.5, 0.5);

    const clickText = this.add.text(0, 26, "💰 Click to talk trading", {
      fontFamily: "monospace",
      fontSize: "7px",
      color: "#4ade80",
    });
    clickText.setOrigin(0.5, 0.5);

    container.add([bg, nameText, titleText, quoteText, clickText]);
    container.setDepth(200);
    this.tooltip = container;
  }

  private showScoutTooltip(sprite: Phaser.GameObjects.Sprite): void {
    this.hideTooltip();

    const container = this.add.container(sprite.x, sprite.y - 70);

    const bg = this.add.rectangle(0, 0, 170, 68, 0x0a0a0f, 0.95);
    bg.setStrokeStyle(2, 0x00ff41); // Matrix green border

    const nameText = this.add.text(0, -22, "Neo", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#00ff41",
    });
    nameText.setOrigin(0.5, 0.5);

    const titleText = this.add.text(0, -6, "The One • Scout Agent", {
      fontFamily: "monospace",
      fontSize: "8px",
      color: "#ffffff",
    });
    titleText.setOrigin(0.5, 0.5);

    const quoteText = this.add.text(0, 10, "i can see the chain now...", {
      fontFamily: "monospace",
      fontSize: "7px",
      color: "#9ca3af",
    });
    quoteText.setOrigin(0.5, 0.5);

    const clickText = this.add.text(0, 26, "Click to see new launches", {
      fontFamily: "monospace",
      fontSize: "7px",
      color: "#00ff41",
    });
    clickText.setOrigin(0.5, 0.5);

    container.add([bg, nameText, titleText, quoteText, clickText]);
    container.setDepth(200);
    this.tooltip = container;
  }

  private showBuildingTooltip(
    building: GameBuilding,
    container: Phaser.GameObjects.Container
  ): void {
    this.hideTooltip();

    const isTreasury = building.id.startsWith("Treasury");
    const tooltipContainer = this.add.container(container.x, container.y - 110);

    // Treasury gets a special gold border
    const bg = this.add.rectangle(0, 0, 140, 80, 0x0a0a0f, 0.95);
    bg.setStrokeStyle(2, isTreasury ? 0xfbbf24 : (building.health > 50 ? 0x4ade80 : 0xf87171));

    const nameText = this.add.text(0, -28, `${building.name}`, {
      fontFamily: "monospace",
      fontSize: "10px",
      color: isTreasury ? "#fbbf24" : "#ffffff",
    });
    nameText.setOrigin(0.5, 0.5);

    if (isTreasury) {
      // Buyback & Burn Hub tooltip - threshold-based system
      const descText = this.add.text(0, -12, "Threshold: 1 SOL", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#4ade80",
      });
      descText.setOrigin(0.5, 0.5);

      const breakdownText = this.add.text(0, 4, "Hit threshold → Claim → Buy top 5 → Burn\n80% buyback | 20% operations", {
        fontFamily: "monospace",
        fontSize: "6px",
        color: "#9ca3af",
        align: "center",
      });
      breakdownText.setOrigin(0.5, 0.5);

      const clickText = this.add.text(0, 24, "🔥 Click to verify burns on Solscan", {
        fontFamily: "monospace",
        fontSize: "7px",
        color: "#60a5fa",
      });
      clickText.setOrigin(0.5, 0.5);

      tooltipContainer.add([bg, nameText, descText, breakdownText, clickText]);
    } else {
      // Regular building tooltip
      const mcapText = this.add.text(0, -12, building.marketCap ? this.formatMarketCap(building.marketCap) : "N/A", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#4ade80",
      });
      mcapText.setOrigin(0.5, 0.5);

      const levelLabels = ["Startup", "Growing", "Established", "Major", "Top Tier"];
      const levelLabel = levelLabels[building.level - 1] || `Level ${building.level}`;
      const levelText = this.add.text(0, 2, `⭐ ${levelLabel}`, {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#fbbf24",
      });
      levelText.setOrigin(0.5, 0.5);

      const changeColor = (building.change24h ?? 0) >= 0 ? "#4ade80" : "#f87171";
      const changePrefix = (building.change24h ?? 0) >= 0 ? "+" : "";
      const changeText = this.add.text(0, 16, `${changePrefix}${(building.change24h ?? 0).toFixed(0)}% (24h)`, {
        fontFamily: "monospace",
        fontSize: "8px",
        color: changeColor,
      });
      changeText.setOrigin(0.5, 0.5);

      const clickText = this.add.text(0, 32, "Click to trade", {
        fontFamily: "monospace",
        fontSize: "7px",
        color: "#6b7280",
      });
      clickText.setOrigin(0.5, 0.5);

      tooltipContainer.add([bg, nameText, mcapText, levelText, changeText, clickText]);
    }

    tooltipContainer.setDepth(200);
    this.tooltip = tooltipContainer;
  }

  private hideTooltip(): void {
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
  }

  private triggerEvent(event: WorldState["events"][0]): void {
    switch (event.type) {
      case "token_launch":
        this.playCelebration(400, 350);
        break;
      case "fee_claim":
        this.playCoinsRain();
        break;
      case "price_pump":
        this.cameras.main.flash(400, 74, 222, 128, true);
        this.playStarBurst();
        break;
      case "price_dump":
        this.cameras.main.shake(400, 0.008);
        break;
      case "milestone":
        this.playCelebration(400, 350);
        this.cameras.main.flash(400, 251, 191, 36, true);
        break;
    }
  }

  private playCelebration(x: number, y: number): void {
    // Coins
    const coins = this.add.particles(x, y, "coin", {
      speed: { min: 150, max: 250 },
      angle: { min: 220, max: 320 },
      lifespan: 1500,
      quantity: 25,
      scale: { start: 1.2, end: 0 },
      gravityY: 300,
      rotate: { min: 0, max: 360 },
    });

    // Stars
    const stars = this.add.particles(x, y, "star", {
      speed: { min: 100, max: 200 },
      angle: { min: 0, max: 360 },
      lifespan: 1200,
      quantity: 15,
      scale: { start: 0.8, end: 0 },
      alpha: { start: 1, end: 0 },
    });

    this.time.delayedCall(1500, () => {
      coins.destroy();
      stars.destroy();
    });
  }

  private playCoinsRain(): void {
    const particles = this.add.particles(400, 0, "coin", {
      x: { min: 50, max: 750 },
      y: -20,
      lifespan: 2500,
      speedY: { min: 150, max: 250 },
      speedX: { min: -30, max: 30 },
      scale: { start: 1, end: 0.5 },
      quantity: 40,
      frequency: -1,
      rotate: { min: 0, max: 360 },
    });

    particles.explode(40);

    this.time.delayedCall(2500, () => {
      particles.destroy();
    });
  }

  private playStarBurst(): void {
    const particles = this.add.particles(400, 300, "star", {
      speed: { min: 200, max: 400 },
      angle: { min: 0, max: 360 },
      lifespan: 1000,
      quantity: 20,
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0x4ade80, 0xfbbf24, 0x60a5fa],
    });

    particles.explode(20);

    this.time.delayedCall(1000, () => {
      particles.destroy();
    });
  }

  // Animal control methods for Bags Bot
  moveAnimalTo(animalType: Animal["type"], targetX: number): void {
    const animal = this.animals.find((a) => a.type === animalType);
    if (animal) {
      animal.targetX = Math.max(50, Math.min(750, targetX));
      animal.isIdle = false;
      animal.direction = animal.targetX > animal.sprite.x ? "right" : "left";
    }
  }

  petAnimal(animalType: Animal["type"]): void {
    const animal = this.animals.find((a) => a.type === animalType);
    if (animal) {
      // Stop the animal
      animal.isIdle = true;
      animal.idleTimer = 0;

      // Happy bounce animation
      this.tweens.add({
        targets: animal.sprite,
        y: animal.sprite.y - 15,
        duration: 200,
        yoyo: true,
        repeat: 2,
        ease: "Bounce.easeOut",
      });

      // Hearts effect
      const hearts = this.add.particles(animal.sprite.x, animal.sprite.y - 20, "star", {
        speed: { min: 30, max: 60 },
        angle: { min: 220, max: 320 },
        lifespan: 1000,
        quantity: 5,
        scale: { start: 0.5, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: 0xff69b4,
      });

      hearts.explode(5);

      this.time.delayedCall(1000, () => {
        hearts.destroy();
      });
    }
  }

  scareAnimal(animalType: Animal["type"]): void {
    const animal = this.animals.find((a) => a.type === animalType);
    if (animal) {
      // Run away to random side
      animal.isIdle = false;
      animal.targetX = animal.sprite.x > 400 ? 50 : 750;
      animal.speed = animal.speed * 3; // Temporarily faster

      // Shake animation
      this.tweens.add({
        targets: animal.sprite,
        x: animal.sprite.x + 5,
        duration: 50,
        yoyo: true,
        repeat: 4,
      });

      // Reset speed after 2 seconds
      this.time.delayedCall(2000, () => {
        animal.speed = animal.type === "butterfly" ? 0.3 : animal.type === "bird" ? 0.5 : 0.2;
      });
    }
  }

  callAnimal(animalType: Animal["type"], targetX: number): void {
    const animal = this.animals.find((a) => a.type === animalType);
    if (animal) {
      animal.targetX = Math.max(50, Math.min(750, targetX));
      animal.isIdle = false;
      animal.direction = animal.targetX > animal.sprite.x ? "right" : "left";
      animal.speed = animal.speed * 1.5; // Move a bit faster when called

      // Reset speed after reaching target
      this.time.delayedCall(3000, () => {
        animal.speed = animal.type === "butterfly" ? 0.3 : animal.type === "bird" ? 0.5 : 0.2;
      });
    }
  }

  getAnimalPosition(animalType: Animal["type"]): { x: number; y: number } | null {
    const animal = this.animals.find((a) => a.type === animalType);
    if (animal) {
      return { x: animal.sprite.x, y: animal.sprite.y };
    }
    return null;
  }

  getAllAnimals(): Array<{ type: Animal["type"]; x: number; y: number; isIdle: boolean }> {
    return this.animals.map((a) => ({
      type: a.type,
      x: a.sprite.x,
      y: a.sprite.y,
      isIdle: a.isIdle,
    }));
  }

  // ===========================================
  // BOT EFFECT HANDLERS
  // ===========================================

  private handleBotEffect(event: CustomEvent): void {
    const { effectType, x = 400, y = 300 } = event.detail || {};

    switch (effectType) {
      case "fireworks":
        this.playFireworks(x, y);
        break;
      case "celebration":
        this.playCelebration(x, y);
        break;
      case "coins":
        this.playCoinsRain();
        break;
      case "hearts":
        this.playHeartsEffect(x, y);
        break;
      case "confetti":
        this.playConfetti();
        break;
      case "stars":
        this.playStarBurst();
        break;
      default:
        console.log("[WorldScene] Unknown effect:", effectType);
    }
  }

  private handleBotAnimal(event: CustomEvent): void {
    const { animalType, animalAction } = event.detail || {};

    if (!animalType) return;

    switch (animalAction) {
      case "pet":
        this.petAnimal(animalType);
        break;
      case "scare":
        this.scareAnimal(animalType);
        break;
      case "call":
        this.callAnimal(animalType, 400); // Call to center
        break;
      case "feed":
        this.feedAnimal(animalType);
        break;
      default:
        this.petAnimal(animalType); // Default to pet
    }
  }

  // Feed animal - similar to pet but with food particle
  feedAnimal(animalType: Animal["type"]): void {
    const animal = this.animals.find((a) => a.type === animalType);
    if (animal) {
      // Stop the animal
      animal.isIdle = true;
      animal.idleTimer = 0;

      // Eating animation - bounce and grow slightly
      this.tweens.add({
        targets: animal.sprite,
        scaleX: animal.sprite.scaleX * 1.1,
        scaleY: animal.sprite.scaleY * 1.1,
        duration: 200,
        yoyo: true,
        repeat: 2,
        ease: "Bounce.easeOut",
      });

      // Food particles (using star as food)
      const food = this.add.particles(animal.sprite.x, animal.sprite.y - 10, "star", {
        speed: { min: 10, max: 30 },
        angle: { min: 220, max: 320 },
        lifespan: 800,
        quantity: 3,
        scale: { start: 0.3, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: 0xffd700,
      });

      food.explode(3);

      this.time.delayedCall(800, () => {
        food.destroy();
      });
    }
  }

  // Fireworks effect - multiple bursts in the sky
  playFireworks(x: number = 400, y: number = 200): void {
    const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xffffff];

    // Launch multiple firework bursts
    for (let i = 0; i < 5; i++) {
      this.time.delayedCall(i * 300, () => {
        const burstX = x + (Math.random() - 0.5) * 400;
        const burstY = y + (Math.random() - 0.5) * 100;
        const color = colors[Math.floor(Math.random() * colors.length)];

        // Flash effect
        this.cameras.main.flash(50, 255, 255, 255, true);

        // Firework burst
        const burst = this.add.particles(burstX, burstY, "star", {
          speed: { min: 100, max: 200 },
          angle: { min: 0, max: 360 },
          lifespan: 1200,
          quantity: 30,
          scale: { start: 0.8, end: 0 },
          alpha: { start: 1, end: 0 },
          tint: color,
          gravityY: 100,
          blendMode: Phaser.BlendModes.ADD,
        });

        burst.explode(30);

        // Sparkle trail
        const trail = this.add.particles(burstX, burstY, "coin", {
          speed: { min: 50, max: 150 },
          angle: { min: 0, max: 360 },
          lifespan: 800,
          quantity: 15,
          scale: { start: 0.4, end: 0 },
          alpha: { start: 0.8, end: 0 },
          tint: color,
        });

        trail.explode(15);

        this.time.delayedCall(1500, () => {
          burst.destroy();
          trail.destroy();
        });
      });
    }
  }

  // Hearts floating effect
  playHeartsEffect(x: number = 400, y: number = 300): void {
    // Create hearts using star particles with pink tint
    const hearts = this.add.particles(x, y, "star", {
      speed: { min: 30, max: 80 },
      angle: { min: 220, max: 320 },
      lifespan: 2000,
      quantity: 20,
      scale: { start: 0.8, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xff69b4, 0xff1493, 0xff6b6b, 0xffb6c1],
      gravityY: -30, // Float upward
    });

    hearts.explode(20);

    // Screen tint
    this.cameras.main.flash(200, 255, 182, 193, true);

    this.time.delayedCall(2500, () => {
      hearts.destroy();
    });
  }

  // Confetti effect - colorful particles falling from top
  playConfetti(): void {
    const confetti = this.add.particles(400, -20, "star", {
      x: { min: 0, max: 800 },
      y: -20,
      lifespan: 4000,
      speedY: { min: 100, max: 200 },
      speedX: { min: -50, max: 50 },
      scale: { start: 0.6, end: 0.2 },
      alpha: { start: 1, end: 0.5 },
      tint: [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xffa500],
      rotate: { min: 0, max: 360 },
      quantity: 3,
      frequency: 50,
      gravityY: 50,
    });

    confetti.setDepth(100);

    // Stop after 3 seconds
    this.time.delayedCall(3000, () => {
      confetti.stop();
    });

    // Destroy after particles fade
    this.time.delayedCall(7000, () => {
      confetti.destroy();
    });
  }

  // Show announcement banner
  showAnnouncement(text: string, duration: number = 5000): void {
    // Remove existing announcement
    if (this.announcementText) {
      this.announcementText.destroy();
      this.announcementText = null;
    }
    if (this.announcementBg) {
      this.announcementBg.destroy();
      this.announcementBg = null;
    }

    // Create background
    this.announcementBg = this.add.rectangle(400, 50, 600, 40, 0x000000, 0.8);
    this.announcementBg.setStrokeStyle(2, 0x4ade80);
    this.announcementBg.setDepth(300);
    this.announcementBg.setAlpha(0);

    // Create text
    this.announcementText = this.add.text(400, 50, text, {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#4ade80",
      align: "center",
    });
    this.announcementText.setOrigin(0.5, 0.5);
    this.announcementText.setDepth(301);
    this.announcementText.setAlpha(0);

    // Animate in
    this.tweens.add({
      targets: [this.announcementBg, this.announcementText],
      alpha: 1,
      y: 60,
      duration: 300,
      ease: "Back.easeOut",
    });

    // Animate out after duration
    this.time.delayedCall(duration, () => {
      if (this.announcementBg && this.announcementText) {
        this.tweens.add({
          targets: [this.announcementBg, this.announcementText],
          alpha: 0,
          y: 40,
          duration: 300,
          ease: "Back.easeIn",
          onComplete: () => {
            this.announcementText?.destroy();
            this.announcementBg?.destroy();
            this.announcementText = null;
            this.announcementBg = null;
          }
        });
      }
    });
  }

  // Character walking system
  private startCharacterWalking(
    sprite: Phaser.GameObjects.Sprite,
    character: GameCharacter,
    isSpecial: boolean
  ): void {
    // Store the original Y position for the character
    const baseY = character.y;
    const walkSpeed = isSpecial ? 0.3 : 0.5;
    const walkRange = isSpecial ? 60 : 100; // How far they can walk from starting position
    const minX = Math.max(80, character.x - walkRange);
    const maxX = Math.min(720, character.x + walkRange);

    // Walking state stored on sprite
    (sprite as any).isWalking = false;
    (sprite as any).walkDirection = 1;
    (sprite as any).baseY = baseY;

    // Idle bounce when not walking
    const idleTween = this.tweens.add({
      targets: sprite,
      y: baseY - (isSpecial ? 2 : 3),
      duration: isSpecial ? 1200 : 800 + Math.random() * 400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Store tween reference for cleanup
    (sprite as any).idleTween = idleTween;

    // Randomly decide to walk
    const maybeWalk = () => {
      if (!sprite.active) return;

      // 30% chance to start walking
      if (Math.random() < 0.3 && !(sprite as any).isWalking) {
        this.walkCharacter(sprite, minX, maxX, baseY, walkSpeed, isSpecial);
      }

      // Schedule next check (every 3-8 seconds)
      this.time.delayedCall(3000 + Math.random() * 5000, maybeWalk);
    };

    // Start the walking checks after initial delay
    this.time.delayedCall(1000 + Math.random() * 3000, maybeWalk);
  }

  private walkCharacter(
    sprite: Phaser.GameObjects.Sprite,
    minX: number,
    maxX: number,
    baseY: number,
    speed: number,
    isSpecial: boolean
  ): void {
    if (!sprite.active) return;

    (sprite as any).isWalking = true;

    // Pick a random destination within range
    const currentX = sprite.x;
    const targetX = minX + Math.random() * (maxX - minX);
    const distance = Math.abs(targetX - currentX);
    const duration = distance / speed * 16; // Convert to ms based on speed

    // Flip sprite based on direction
    const goingRight = targetX > currentX;
    sprite.setFlipX(!goingRight);

    // Stop idle bounce while walking
    const idleTween = (sprite as any).idleTween as Phaser.Tweens.Tween;
    if (idleTween) {
      idleTween.pause();
    }

    // Walking bob animation
    const walkBob = this.tweens.add({
      targets: sprite,
      y: baseY - 4,
      duration: 150,
      yoyo: true,
      repeat: Math.floor(duration / 300),
      ease: "Sine.easeInOut",
    });

    // Move to target
    this.tweens.add({
      targets: sprite,
      x: targetX,
      duration: duration,
      ease: "Linear",
      onComplete: () => {
        (sprite as any).isWalking = false;
        walkBob.stop();
        sprite.setY(baseY);

        // Resume idle bounce
        if (idleTween) {
          idleTween.resume();
        }

        // Update any attached glow effects
        const glowKeys = ["tolyGlow", "ashGlow", "finnGlow", "devGlow", "scoutGlow"];
        glowKeys.forEach((key) => {
          const glow = (sprite as any)[key];
          if (glow && glow.active) {
            glow.setX(sprite.x);
          }
        });
      },
      onUpdate: () => {
        // Update glow position while walking
        const glowKeys = ["tolyGlow", "ashGlow", "finnGlow", "devGlow", "scoutGlow"];
        glowKeys.forEach((key) => {
          const glow = (sprite as any)[key];
          if (glow && glow.active) {
            glow.setX(sprite.x);
          }
        });
      },
    });
  }
}
