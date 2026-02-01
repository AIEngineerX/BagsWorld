import * as Phaser from "phaser";
import type {
  WorldState,
  GameCharacter,
  GameBuilding,
  ZoneType,
  BuildingStatus,
} from "@/lib/types";
import { ECOSYSTEM_CONFIG } from "@/lib/config";
import { SpeechBubbleManager } from "@/lib/speech-bubble-manager";
import { getCurrentLine, getActiveConversation } from "@/lib/autonomous-dialogue";
import { useGameStore } from "@/lib/store";

// Scale factor for higher resolution (must match BootScene)
const SCALE = 1.6;
const GAME_WIDTH = 1280;
const GAME_HEIGHT = 960;

interface Animal {
  sprite: Phaser.GameObjects.Sprite;
  type: "dog" | "cat" | "bird" | "butterfly" | "squirrel";
  targetX: number;
  speed: number;
  direction: "left" | "right";
  idleTimer: number;
  isIdle: boolean;
}

interface Pokemon {
  sprite: Phaser.GameObjects.Sprite;
  type: "charmander" | "squirtle" | "bulbasaur";
  targetX: number;
  speed: number;
  direction: "left" | "right";
  idleTimer: number;
  isIdle: boolean;
  baseY: number; // Store base Y position for this Pokemon
}

export class WorldScene extends Phaser.Scene {
  private worldState: WorldState | null = null;
  private characterSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private characterVariants: Map<string, number> = new Map(); // Store which variant each character uses
  private buildingSprites: Map<string, Phaser.GameObjects.Container> = new Map();
  private buildingInitialized: Set<string> = new Set(); // Track which buildings have been created
  private weatherEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private clouds: Phaser.GameObjects.Sprite[] = [];
  private decorations: Phaser.GameObjects.Sprite[] = [];
  private animals: Animal[] = [];
  private pokemon: Pokemon[] = []; // Pokemon in Founders zone
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
  private activeOscillators: OscillatorNode[] = []; // Track active oscillators to stop on track switch
  private currentTrack = 0;
  private trackNames = [
    "Adventure",
    "Bags Anthem",
    "Night Market",
    "Victory March",
    "Route 101",
    "Pokemon Center",
    "Mystery Dungeon",
  ];

  // Store bound event handlers for cleanup
  private boundToggleMusic: (() => void) | null = null;
  private boundSkipTrack: (() => void) | null = null;
  private boundPrevTrack: (() => void) | null = null;
  private boundBotEffect: ((e: Event) => void) | null = null;
  private boundBotAnimal: ((e: Event) => void) | null = null;
  private boundBotPokemon: ((e: Event) => void) | null = null;

  // Announcement text object
  private announcementText: Phaser.GameObjects.Text | null = null;
  private announcementBg: Phaser.GameObjects.Rectangle | null = null;

  // Zone system
  private currentZone: ZoneType = "main_city";
  private isTransitioning = false; // Prevent overlapping transitions
  private trendingElements: Phaser.GameObjects.GameObject[] = [];
  private mainCityElements: Phaser.GameObjects.GameObject[] = [];
  private academyElements: Phaser.GameObjects.GameObject[] = []; // Academy zone elements
  private ballersElements: Phaser.GameObjects.GameObject[] = []; // Ballers Valley zone elements
  private foundersElements: Phaser.GameObjects.GameObject[] = []; // Founder's Corner zone elements
  private labsElements: Phaser.GameObjects.GameObject[] = []; // Tech Labs zone elements
  private moltbookElements: Phaser.GameObjects.GameObject[] = []; // Moltbook Beach zone elements
  private trendingZoneCreated = false; // Cache trending zone elements
  private academyZoneCreated = false; // Cache academy zone elements
  private ballersZoneCreated = false; // Cache ballers zone elements
  private foundersZoneCreated = false; // Cache founders zone elements
  private labsZoneCreated = false; // Cache labs zone elements
  private moltbookZoneCreated = false; // Cache moltbook zone elements
  private arenaElements: Phaser.GameObjects.GameObject[] = []; // Arena zone elements
  private arenaZoneCreated = false; // Cache arena zone elements
  private arenaWebSocket: WebSocket | null = null; // WebSocket connection for arena
  private arenaCrowdSprites: Phaser.GameObjects.Sprite[] = []; // Crowd sprites for cheer reactions
  private arenaSpotlightCones: Phaser.GameObjects.Sprite[] = []; // Spotlight cone sprites
  private arenaCrowdCheering = false; // Flag to track if crowd is cheering
  private arenaFighters: Map<number, Phaser.GameObjects.Sprite> = new Map(); // Fighter sprites
  private arenaHealthBars: Map<
    number,
    { bg: Phaser.GameObjects.Rectangle; fill: Phaser.GameObjects.Rectangle }
  > = new Map();
  private arenaLastHitEffect: Map<number, number> = new Map(); // Track when last hit effect was shown (prevents spam)
  private arenaLastFighterState: Map<number, string> = new Map(); // Track previous state for transition detection
  private arenaComboCount: Map<number, number> = new Map(); // Track combo hits per fighter
  private arenaLastAttacker: number = 0; // Track who attacked last for combo system
  private arenaMatchState: {
    matchId: number;
    status: string;
    fighter1: { id: number; hp: number; maxHp: number; x: number; y: number; state: string };
    fighter2: { id: number; hp: number; maxHp: number; x: number; y: number; state: string };
  } | null = null;
  private foundersPopup: Phaser.GameObjects.Container | null = null; // Popup modal for building info
  private ballersGoldenSky: Phaser.GameObjects.Graphics | null = null; // Golden hour sky for Ballers Valley
  private academyTwilightSky: Phaser.GameObjects.Graphics | null = null; // Magical twilight sky for Academy
  private academyMoon: Phaser.GameObjects.Arc | null = null; // Moon for Academy zone
  private academyStars: Phaser.GameObjects.Arc[] = []; // Extra bright stars for Academy
  private boundZoneChange: ((e: Event) => void) | null = null;
  private zoneGround: Phaser.GameObjects.TileSprite | null = null;
  private zonePath: Phaser.GameObjects.TileSprite | null = null;
  private billboardTexts: Phaser.GameObjects.Text[] = [];
  private tickerText: Phaser.GameObjects.Text | null = null;
  private tickerOffset = 0;
  private tickerTimer: Phaser.Time.TimerEvent | null = null;
  private skylineSprites: Phaser.GameObjects.Sprite[] = [];
  private academyBuildings: Phaser.GameObjects.Sprite[] = []; // Academy building sprites
  private billboardTimer: Phaser.Time.TimerEvent | null = null;
  private trafficTimers: Phaser.Time.TimerEvent[] = [];
  private originalPositions: Map<Phaser.GameObjects.GameObject, number> = new Map(); // Store original X positions

  // Speech bubble manager for autonomous dialogue
  private speechBubbleManager: SpeechBubbleManager | null = null;
  private lastDialogueLine: string | null = null; // Track last line to avoid duplicates

  // AI-driven character behavior
  private characterTargets: Map<string, { x: number; y: number; action: string }> = new Map();
  private boundBehaviorHandler: ((e: Event) => void) | null = null;
  private boundSpeakHandler: ((e: Event) => void) | null = null;

  // Performance: character lookup map for O(1) access in update loop
  private characterById: Map<string, GameCharacter> = new Map();
  // Performance: cached movement speeds per character (avoid random() every frame)
  private characterSpeeds: Map<string, number> = new Map();

  constructor() {
    super({ key: "WorldScene" });
  }

  create(): void {
    // Create layered ground
    this.createGround();

    // Create sky with gradient
    this.createSky();

    // Create day/night overlay
    this.overlay = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x000000,
      0
    );
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

    // Listen for previous track (store bound handler for cleanup)
    this.boundPrevTrack = () => this.prevTrack();
    window.addEventListener("bagsworld-prev-track", this.boundPrevTrack);

    // Listen for bot effect commands
    this.boundBotEffect = (e: Event) => this.handleBotEffect(e as CustomEvent);
    window.addEventListener("bagsworld-bot-effect", this.boundBotEffect);

    // Listen for bot animal commands
    this.boundBotAnimal = (e: Event) => this.handleBotAnimal(e as CustomEvent);
    window.addEventListener("bagsworld-bot-animal", this.boundBotAnimal);

    // Listen for bot pokemon commands (Founders zone)
    this.boundBotPokemon = (e: Event) => this.handleBotPokemon(e as CustomEvent);
    window.addEventListener("bagsworld-bot-pokemon", this.boundBotPokemon);

    // Listen for zone change events
    this.boundZoneChange = (e: Event) => this.handleZoneChange(e as CustomEvent);
    window.addEventListener("bagsworld-zone-change", this.boundZoneChange);

    // Register cleanup on scene shutdown and destroy
    this.events.on("shutdown", this.cleanup, this);
    this.events.on("destroy", this.cleanup, this);

    // Initialize speech bubble manager for autonomous dialogue
    this.speechBubbleManager = new SpeechBubbleManager(this, this.characterSprites);

    // Listen for AI behavior commands
    this.boundBehaviorHandler = (e: Event) => this.handleBehaviorCommand(e as CustomEvent);
    window.addEventListener("bagsworld-character-behavior", this.boundBehaviorHandler);

    // Listen for character speak events
    this.boundSpeakHandler = (e: Event) => this.handleCharacterSpeak(e as CustomEvent);
    window.addEventListener("bagsworld-character-speak", this.boundSpeakHandler);

    // Setup mobile camera controls (drag to pan, pinch to zoom)
    this.setupMobileCameraControls();
  }

  private setupMobileCameraControls(): void {
    // Check if mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // Enable touch input globally for this scene
    this.input.setTopOnly(false);

    if (!isMobile) return;

    // Set up camera bounds for panning
    const camera = this.cameras.main;
    camera.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Track drag state
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let cameraStartX = 0;
    let cameraStartY = 0;

    // Handle pointer down - start drag
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      // Only start drag if not clicking on a character/building
      const hitObjects = this.input.hitTestPointer(pointer);
      if (hitObjects.length === 0) {
        isDragging = true;
        dragStartX = pointer.x;
        dragStartY = pointer.y;
        cameraStartX = camera.scrollX;
        cameraStartY = camera.scrollY;
      }
    });

    // Handle pointer move - pan camera
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!isDragging || !pointer.isDown) return;

      const deltaX = dragStartX - pointer.x;
      const deltaY = dragStartY - pointer.y;

      // Apply movement scaled by zoom level
      camera.scrollX = Phaser.Math.Clamp(
        cameraStartX + deltaX / camera.zoom,
        0,
        GAME_WIDTH - camera.width / camera.zoom
      );
      camera.scrollY = Phaser.Math.Clamp(
        cameraStartY + deltaY / camera.zoom,
        0,
        GAME_HEIGHT - camera.height / camera.zoom
      );
    });

    // Handle pointer up - stop drag
    this.input.on("pointerup", () => {
      isDragging = false;
    });

    // Handle pinch to zoom (two-finger gesture)
    let initialPinchDistance = 0;
    let initialZoom = 1;

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const pointers = this.input.manager.pointers.filter((p) => p.isDown);
      if (pointers.length === 2) {
        initialPinchDistance = Phaser.Math.Distance.Between(
          pointers[0].x,
          pointers[0].y,
          pointers[1].x,
          pointers[1].y
        );
        initialZoom = camera.zoom;
        isDragging = false; // Cancel drag when pinching
      }
    });

    this.input.on("pointermove", () => {
      const pointers = this.input.manager.pointers.filter((p) => p.isDown);
      if (pointers.length === 2 && initialPinchDistance > 0) {
        const currentDistance = Phaser.Math.Distance.Between(
          pointers[0].x,
          pointers[0].y,
          pointers[1].x,
          pointers[1].y
        );
        const scale = currentDistance / initialPinchDistance;
        camera.setZoom(Phaser.Math.Clamp(initialZoom * scale, 0.5, 2));
      }
    });

    this.input.on("pointerup", () => {
      const pointers = this.input.manager.pointers.filter((p) => p.isDown);
      if (pointers.length < 2) {
        initialPinchDistance = 0;
      }
    });

    // Double-tap to reset zoom
    let lastTapTime = 0;
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      const currentTime = Date.now();
      if (currentTime - lastTapTime < 300) {
        // Double tap - reset camera
        camera.setZoom(1);
        camera.scrollX = 0;
        camera.scrollY = 0;
      }
      lastTapTime = currentTime;
    });
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

    // CLEANUP: Kill any existing transition tweens to prevent accumulation
    this.decorations.forEach((d) => this.tweens.killTweensOf(d));
    this.animals.forEach((a) => this.tweens.killTweensOf(a.sprite));
    this.trendingElements.forEach((el) => this.tweens.killTweensOf(el));
    this.billboardTexts.forEach((t) => this.tweens.killTweensOf(t));
    this.skylineSprites.forEach((s) => this.tweens.killTweensOf(s));
    if (this.tickerText) this.tweens.killTweensOf(this.tickerText);
    this.buildingSprites.forEach((container) => this.tweens.killTweensOf(container));
    this.characterSprites.forEach((sprite) => this.tweens.killTweensOf(sprite));

    // Reset decoration/animal positions to originals before transition
    this.decorations.forEach((d) => {
      const origX = this.originalPositions.get(d);
      if (origX !== undefined) (d as any).x = origX;
    });
    this.animals.forEach((a) => {
      const origX = this.originalPositions.get(a.sprite);
      if (origX !== undefined) (a.sprite as any).x = origX;
    });

    // Determine slide direction: Labs -> Moltbook Beach -> Park -> BagsCity -> Ballers Valley -> Founder's Corner -> Arena (left to right)
    // Zone order: labs (-2) -> moltbook (-1) -> main_city (0) -> trending (1) -> ballers (2) -> founders (3) -> arena (4)
    const zoneOrder: Record<ZoneType, number> = {
      labs: -2,
      moltbook: -1,
      main_city: 0,
      trending: 1,
      ballers: 2,
      founders: 3,
      arena: 4,
    };
    const isGoingRight = zoneOrder[newZone] > zoneOrder[this.currentZone];
    const duration = 600; // Smooth, cinematic transition
    const slideDistance = Math.round(850 * SCALE); // Slightly more than screen width for full slide (scaled)

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
    } else if (this.currentZone === "ballers") {
      oldElements.push(...this.ballersElements);
    } else if (this.currentZone === "founders") {
      oldElements.push(...this.foundersElements);
    } else {
      // Main city decorations
      this.decorations.forEach((d) => oldElements.push(d));
      this.animals.forEach((a) => oldElements.push(a.sprite));
    }

    // Include buildings and characters (they slide out and get recreated)
    this.buildingSprites.forEach((container) => oldElements.push(container));
    this.characterSprites.forEach((sprite) => oldElements.push(sprite));

    // Store old element original X positions for proper destruction
    const oldElementData = oldElements.map((el) => ({ el, origX: (el as any).x || 0 }));

    // Create transition overlay for ground swap (slides with content, scaled)
    const transitionOverlay = this.add.rectangle(
      GAME_WIDTH / 2 + slideInOffset,
      Math.round(520 * SCALE),
      GAME_WIDTH,
      Math.round(200 * SCALE),
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
          ease: "Cubic.easeInOut",
        });
      }
    });

    // Slide ground texture overlay (scaled)
    this.tweens.add({
      targets: this.ground,
      tilePositionX:
        this.ground.tilePositionX +
        (isGoingRight ? Math.round(100 * SCALE) : -Math.round(100 * SCALE)),
      duration,
      ease: "Cubic.easeInOut",
    });

    // Slide transition overlay in, destroy when complete
    this.tweens.add({
      targets: transitionOverlay,
      x: GAME_WIDTH / 2,
      duration,
      ease: "Cubic.easeInOut",
      onComplete: () => {
        // Destroy overlay after tween completes (not mid-animation)
        transitionOverlay.destroy();
      },
    });

    // At 40% through animation, swap the zone for smooth visual transition
    this.time.delayedCall(duration * 0.4, () => {
      // Hide old zone elements (don't destroy - they're cached for reuse)
      if (this.currentZone === "trending") {
        this.trendingElements.forEach((el) => (el as any).setVisible(false));
        this.billboardTexts.forEach((t) => t.setVisible(false));
        if (this.tickerText) this.tickerText.setVisible(false);
        this.skylineSprites.forEach((s) => s.setVisible(false));
        // Stop ticker animation
        if (this.tickerTimer) {
          this.tickerTimer.destroy();
          this.tickerTimer = null;
        }
        // Stop billboard update timer
        if (this.billboardTimer) {
          this.billboardTimer.destroy();
          this.billboardTimer = null;
        }
        // Stop traffic timers
        this.clearTrafficTimers();
      } else if (this.currentZone === "ballers") {
        this.ballersElements.forEach((el) => (el as any).setVisible(false));
      } else if (this.currentZone === "founders") {
        this.foundersElements.forEach((el) => (el as any).setVisible(false));
      } else if (this.currentZone === "labs") {
        this.labsElements.forEach((el) => (el as any).setVisible(false));
      } else if (this.currentZone === "moltbook") {
        this.moltbookElements.forEach((el) => (el as any).setVisible(false));
      } else if (this.currentZone === "arena") {
        this.arenaElements.forEach((el) => (el as any).setVisible(false));
        this.disconnectArenaWebSocket();
      }

      // Update zone and set up new content
      this.currentZone = newZone;

      // Change ground texture based on zone
      const groundTextures: Record<ZoneType, string> = {
        labs: "labs_ground", // Tech Labs has futuristic floor tiles
        moltbook: "beach_ground", // Moltbook Beach has sand
        main_city: "grass",
        trending: "concrete",
        ballers: "grass", // Ballers Valley has premium grass (luxury estate feel)
        founders: "founders_ground", // Founder's Corner has warm workshop flooring
        arena: "arena_floor", // MoltBook Arena has dark checkerboard floor
      };
      this.ground.setTexture(groundTextures[newZone]);

      // Setup new zone content (will be positioned off-screen initially)
      this.setupZoneOffscreen(newZone, slideInOffset);
    });

    // Clean up old elements after animation completes
    this.time.delayedCall(duration + 50, () => {
      oldElementData.forEach(({ el }) => {
        // Only destroy elements that aren't persistent (zone elements are reused)
        const isDecoration = this.decorations.includes(el as any);
        const isAnimal = this.animals.some((a) => a.sprite === el);
        const isTrendingElement =
          this.trendingElements.includes(el) ||
          this.skylineSprites.includes(el as any) ||
          this.billboardTexts.includes(el as any) ||
          el === this.tickerText;
        const isBallersElement = this.ballersElements.includes(el);
        const isFoundersElement = this.foundersElements.includes(el);

        if (
          !isDecoration &&
          !isAnimal &&
          !isTrendingElement &&
          !isBallersElement &&
          !isFoundersElement &&
          el &&
          (el as any).destroy &&
          (el as any).active !== false
        ) {
          (el as any).destroy();
        }
      });

      // Clear old building/character sprite maps
      this.buildingSprites.clear();
      this.characterSprites.clear();

      // CRITICAL: Immediately recreate sprites from existing worldState
      // Without this, sprites stay destroyed until next React Query poll (up to 60s)
      if (this.worldState) {
        this.updateCharacters(this.worldState.population);
        this.updateBuildings(this.worldState.buildings);
      }

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
        ...this.skylineSprites,
      ].filter(Boolean);

      newElements.forEach((el) => {
        if ((el as any).x !== undefined) {
          const targetX = (el as any).x;
          (el as any).x = targetX + offsetX;
          this.tweens.add({
            targets: el,
            x: targetX,
            duration,
            ease: "Cubic.easeOut",
          });
        }
      });
    } else if (zone === "ballers") {
      this.setupBallersZone();

      // Offset all new Ballers Valley elements and animate them in
      const newElements = [...this.ballersElements].filter(Boolean);

      newElements.forEach((el) => {
        if ((el as any).x !== undefined) {
          const targetX = (el as any).x;
          (el as any).x = targetX + offsetX;
          this.tweens.add({
            targets: el,
            x: targetX,
            duration,
            ease: "Cubic.easeOut",
          });
        }
      });
    } else if (zone === "founders") {
      this.setupFoundersZone();

      // Offset all new Founder's Corner elements and animate them in
      const newElements = [...this.foundersElements].filter(Boolean);

      newElements.forEach((el) => {
        if ((el as any).x !== undefined) {
          const targetX = (el as any).x;
          (el as any).x = targetX + offsetX;
          this.tweens.add({
            targets: el,
            x: targetX,
            duration,
            ease: "Cubic.easeOut",
          });
        }
      });
    } else if (zone === "labs") {
      this.setupLabsZone();

      // Offset all new Tech Labs elements and animate them in
      const newElements = [...this.labsElements].filter(Boolean);

      newElements.forEach((el) => {
        if ((el as any).x !== undefined) {
          const targetX = (el as any).x;
          (el as any).x = targetX + offsetX;
          this.tweens.add({
            targets: el,
            x: targetX,
            duration,
            ease: "Cubic.easeOut",
          });
        }
      });
    } else if (zone === "moltbook") {
      this.setupMoltbookZone();

      // Offset all new Moltbook Beach elements and animate them in
      const newElements = [...this.moltbookElements].filter(Boolean);

      newElements.forEach((el) => {
        if ((el as any).x !== undefined) {
          const targetX = (el as any).x;
          (el as any).x = targetX + offsetX;
          this.tweens.add({
            targets: el,
            x: targetX,
            duration,
            ease: "Cubic.easeOut",
          });
        }
      });
    } else if (zone === "arena") {
      this.setupArenaZone();

      // Offset all new Arena elements and animate them in
      const newElements = [...this.arenaElements].filter(Boolean);

      newElements.forEach((el) => {
        if ((el as any).x !== undefined) {
          const targetX = (el as any).x;
          (el as any).x = targetX + offsetX;
          this.tweens.add({
            targets: el,
            x: targetX,
            duration,
            ease: "Cubic.easeOut",
          });
        }
      });
    } else {
      this.setupMainCityZone();

      // Animate Park elements in using their ORIGINAL positions
      const newElements = [...this.decorations, ...this.animals.map((a) => a.sprite)];

      newElements.forEach((el) => {
        // Get the original position, not the current (off-screen) position
        const originalX = this.originalPositions.get(el);
        if (originalX !== undefined) {
          (el as any).x = originalX + offsetX; // Start off-screen
          this.tweens.add({
            targets: el,
            x: originalX, // Animate to original position
            duration,
            ease: "Cubic.easeOut",
          });
        }
      });
    }
  }

  private storeOriginalPositions(): void {
    // Store original X positions of decorations and animals for zone transitions
    this.decorations.forEach((d) => {
      this.originalPositions.set(d, (d as any).x || 0);
    });
    this.animals.forEach((a) => {
      this.originalPositions.set(a.sprite, (a.sprite as any).x || 0);
    });
  }

  private clearCurrentZone(): void {
    // Clear zone-specific elements based on current zone
    if (this.currentZone === "trending") {
      // Just hide elements instead of destroying (they're cached for reuse)
      this.trendingElements.forEach((el) => (el as any).setVisible(false));
      this.billboardTexts.forEach((t) => t.setVisible(false));
      if (this.tickerText) {
        this.tickerText.setVisible(false);
      }
      if (this.tickerTimer) {
        this.tickerTimer.destroy();
        this.tickerTimer = null;
      }
      this.skylineSprites.forEach((s) => s.setVisible(false));
    } else if (this.currentZone === "ballers") {
      // Hide ballers elements
      this.ballersElements.forEach((el) => (el as any).setVisible(false));
    } else if (this.currentZone === "founders") {
      // Hide founders elements
      this.foundersElements.forEach((el) => (el as any).setVisible(false));
    } else if (this.currentZone === "labs") {
      // Hide labs elements
      this.labsElements.forEach((el) => (el as any).setVisible(false));
    } else if (this.currentZone === "arena") {
      // Hide arena elements and disconnect WebSocket
      this.arenaElements.forEach((el) => (el as any).setVisible(false));
      this.disconnectArenaWebSocket();
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
      case "labs":
        this.setupLabsZone();
        break;
      case "moltbook":
        this.setupMoltbookZone();
        break;
      case "trending":
        this.setupTrendingZone();
        break;
      case "ballers":
        this.setupBallersZone();
        break;
      case "founders":
        this.setupFoundersZone();
        break;
      case "arena":
        this.setupArenaZone();
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

    // Hide other zone elements
    this.trendingElements.forEach((el) => (el as any).setVisible(false));
    this.skylineSprites.forEach((s) => s.setVisible(false));
    this.billboardTexts.forEach((t) => t.setVisible(false));
    if (this.tickerText) this.tickerText.setVisible(false);
    this.academyElements.forEach((el) => (el as any).setVisible(false));
    this.academyBuildings.forEach((s) => s.setVisible(false));
    this.ballersElements.forEach((el) => (el as any).setVisible(false));
    this.foundersElements.forEach((el) => (el as any).setVisible(false));
    this.labsElements.forEach((el) => (el as any).setVisible(false));
    this.moltbookElements.forEach((el) => (el as any).setVisible(false));
    this.arenaElements.forEach((el) => (el as any).setVisible(false));
    this.disconnectArenaWebSocket();
    if (this.foundersPopup) {
      this.foundersPopup.destroy();
      this.foundersPopup = null;
    }

    // Show and reset grass ground
    this.ground.setVisible(true);
    this.ground.setTexture("grass");

    // Restore normal sky (in case coming from Ballers Valley)
    this.restoreNormalSky();
  }

  private setupTrendingZone(): void {
    // Hide park decorations and animals (they belong to main_city)
    this.decorations.forEach((d) => d.setVisible(false));
    this.animals.forEach((a) => a.sprite.setVisible(false));

    // Hide fountain water spray
    if (this.fountainWater) {
      this.fountainWater.setVisible(false);
    }

    // Restore normal sky (in case coming from Ballers Valley)
    this.restoreNormalSky();

    // Hide other zone elements
    this.academyElements.forEach((el) => (el as any).setVisible(false));
    this.academyBuildings.forEach((s) => s.setVisible(false));
    this.ballersElements.forEach((el) => (el as any).setVisible(false));
    this.foundersElements.forEach((el) => (el as any).setVisible(false));
    this.labsElements.forEach((el) => (el as any).setVisible(false));
    this.moltbookElements.forEach((el) => (el as any).setVisible(false));
    this.arenaElements.forEach((el) => (el as any).setVisible(false));
    this.disconnectArenaWebSocket();
    if (this.foundersPopup) {
      this.foundersPopup.destroy();
      this.foundersPopup = null;
    }

    // Hide the grass ground completely - city has its own pavement
    this.ground.setVisible(false);

    // Only create elements once, then just show them
    if (!this.trendingZoneCreated) {
      // Create all trending zone elements synchronously
      // These are lightweight procedural sprites, no need to stagger across frames
      this.createTrendingSkyline();
      this.createTrendingDecorations();
      this.createTrendingBillboards();
      this.createTrendingTicker();
      this.trendingZoneCreated = true;
    } else {
      // Subsequent times - recreate elements since they may have been moved offscreen
      // Clear existing arrays
      this.skylineSprites.forEach((s) => s.destroy());
      this.skylineSprites = [];
      // Remove skyline from trendingElements (they're also in there)
      this.trendingElements = this.trendingElements.filter(
        (el) => !(el as any).texture?.key?.includes("skyline")
      );
      // Recreate skyline fresh
      this.createTrendingSkyline();
      // Show all trending elements
      this.trendingElements.forEach((el) => (el as any).setVisible(true));
      this.billboardTexts.forEach((t) => t.setVisible(true));
      if (this.tickerText) this.tickerText.setVisible(true);
    }

    // Start/restart ticker animation
    if (this.tickerTimer) {
      this.tickerTimer.destroy();
    }
    this.tickerTimer = this.time.addEvent({
      delay: 50,
      callback: this.updateTicker,
      callbackScope: this,
      loop: true,
    });
  }

  private createTrendingSkyline(): void {
    // Back layer - distant buildings (darker, smaller, scaled)
    const backLayer = [
      { x: Math.round(100 * SCALE), y: Math.round(180 * SCALE), scale: 0.7 * SCALE, alpha: 0.4 },
      { x: Math.round(300 * SCALE), y: Math.round(180 * SCALE), scale: 0.65 * SCALE, alpha: 0.4 },
      { x: Math.round(500 * SCALE), y: Math.round(180 * SCALE), scale: 0.75 * SCALE, alpha: 0.4 },
      { x: Math.round(700 * SCALE), y: Math.round(180 * SCALE), scale: 0.7 * SCALE, alpha: 0.4 },
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

    // Front layer - closer buildings (larger, more visible, scaled)
    const frontLayer = [
      { x: Math.round(60 * SCALE), y: Math.round(220 * SCALE), scale: 0.9 * SCALE, alpha: 0.7 },
      { x: Math.round(200 * SCALE), y: Math.round(230 * SCALE), scale: 0.85 * SCALE, alpha: 0.65 },
      { x: Math.round(400 * SCALE), y: Math.round(210 * SCALE), scale: 1.0 * SCALE, alpha: 0.75 },
      { x: Math.round(600 * SCALE), y: Math.round(225 * SCALE), scale: 0.88 * SCALE, alpha: 0.68 },
      { x: Math.round(740 * SCALE), y: Math.round(220 * SCALE), scale: 0.92 * SCALE, alpha: 0.7 },
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
    // Street lamps at ground level for urban feel (scaled)
    const lampPositions = [
      { x: Math.round(100 * SCALE), y: Math.round(540 * SCALE) },
      { x: Math.round(300 * SCALE), y: Math.round(540 * SCALE) },
      { x: Math.round(500 * SCALE), y: Math.round(540 * SCALE) },
      { x: Math.round(700 * SCALE), y: Math.round(540 * SCALE) },
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
    // Sidewalk/pavement area (covers the grass area, scaled)
    const pavement = this.add.rectangle(
      GAME_WIDTH / 2,
      Math.round(520 * SCALE),
      GAME_WIDTH,
      Math.round(160 * SCALE),
      0x374151
    );
    pavement.setDepth(0);
    this.trendingElements.push(pavement);

    // Road at the bottom (scaled)
    const road = this.add.rectangle(
      GAME_WIDTH / 2,
      Math.round(575 * SCALE),
      GAME_WIDTH,
      Math.round(50 * SCALE),
      0x1f2937
    );
    road.setDepth(1);
    this.trendingElements.push(road);

    // Road lane markings (dashed yellow center line, scaled)
    for (let x = Math.round(30 * SCALE); x < Math.round(780 * SCALE); x += Math.round(50 * SCALE)) {
      const roadLine = this.add.rectangle(
        x,
        Math.round(575 * SCALE),
        Math.round(25 * SCALE),
        Math.round(3 * SCALE),
        0xfbbf24
      );
      roadLine.setDepth(2);
      this.trendingElements.push(roadLine);
    }

    // Sidewalk curb line (scaled)
    const curb = this.add.rectangle(
      GAME_WIDTH / 2,
      Math.round(548 * SCALE),
      GAME_WIDTH,
      Math.round(4 * SCALE),
      0x6b7280
    );
    curb.setDepth(2);
    this.trendingElements.push(curb);

    // Crosswalks at intersections (scaled)
    this.createCrosswalk(Math.round(200 * SCALE), Math.round(575 * SCALE));
    this.createCrosswalk(Math.round(600 * SCALE), Math.round(575 * SCALE));

    // Traffic lights near crosswalks (scaled)
    const trafficLight1 = this.add.sprite(
      Math.round(170 * SCALE),
      Math.round(520 * SCALE),
      "traffic_light"
    );
    trafficLight1.setOrigin(0.5, 1);
    trafficLight1.setDepth(4);
    this.trendingElements.push(trafficLight1);

    const trafficLight2 = this.add.sprite(
      Math.round(630 * SCALE),
      Math.round(520 * SCALE),
      "traffic_light"
    );
    trafficLight2.setOrigin(0.5, 1);
    trafficLight2.setDepth(4);
    trafficLight2.setFlipX(true);
    this.trendingElements.push(trafficLight2);

    // Fire hydrant (scaled)
    const hydrant = this.add.sprite(
      Math.round(350 * SCALE),
      Math.round(545 * SCALE),
      "fire_hydrant"
    );
    hydrant.setOrigin(0.5, 1);
    hydrant.setDepth(3);
    this.trendingElements.push(hydrant);

    // Trash can (scaled)
    const trashCan = this.add.sprite(Math.round(450 * SCALE), Math.round(545 * SCALE), "trash_can");
    trashCan.setOrigin(0.5, 1);
    trashCan.setDepth(3);
    this.trendingElements.push(trashCan);

    // Construction signs - BagsCity is under construction
    this.createConstructionSigns();

    // Add moving traffic
    this.createMovingTraffic();
  }

  private createCrosswalk(x: number, y: number): void {
    // Create crosswalk stripes (scaled spacing and dimensions)
    for (
      let i = Math.round(-25 * SCALE);
      i <= Math.round(25 * SCALE);
      i += Math.round(10 * SCALE)
    ) {
      const stripe = this.add.rectangle(
        x + i,
        y,
        Math.round(6 * SCALE),
        Math.round(30 * SCALE),
        0xffffff,
        0.9
      );
      stripe.setDepth(2);
      this.trendingElements.push(stripe);
    }
  }

  private createConstructionSigns(): void {
    // Two construction sign positions - left and right sides of BagsCity
    const signPositions = [
      { x: Math.round(120 * SCALE), y: Math.round(380 * SCALE) },
      { x: Math.round(680 * SCALE), y: Math.round(380 * SCALE) },
    ];

    signPositions.forEach((pos) => {
      // Sign post (wooden pole)
      const post = this.add.rectangle(
        pos.x,
        pos.y + Math.round(40 * SCALE),
        Math.round(6 * SCALE),
        Math.round(80 * SCALE),
        0x8b4513
      );
      post.setDepth(5);
      this.trendingElements.push(post);

      // Sign background (orange/yellow construction color)
      const signBg = this.add.rectangle(
        pos.x,
        pos.y,
        Math.round(100 * SCALE),
        Math.round(40 * SCALE),
        0xf59e0b
      );
      signBg.setDepth(6);
      signBg.setStrokeStyle(Math.round(2 * SCALE), 0x000000);
      this.trendingElements.push(signBg);

      // Sign text
      const signText = this.add.text(pos.x, pos.y - Math.round(5 * SCALE), "UNDER", {
        fontFamily: "monospace",
        fontSize: `${Math.round(10 * SCALE)}px`,
        color: "#000000",
        fontStyle: "bold",
      });
      signText.setOrigin(0.5, 0.5);
      signText.setDepth(7);
      this.trendingElements.push(signText);

      const signText2 = this.add.text(pos.x, pos.y + Math.round(8 * SCALE), "CONSTRUCTION", {
        fontFamily: "monospace",
        fontSize: `${Math.round(8 * SCALE)}px`,
        color: "#000000",
        fontStyle: "bold",
      });
      signText2.setOrigin(0.5, 0.5);
      signText2.setDepth(7);
      this.trendingElements.push(signText2);

      // Construction barriers (orange/white striped)
      const barrierY = pos.y + Math.round(70 * SCALE);
      for (let i = -1; i <= 1; i++) {
        const barrier = this.add.rectangle(
          pos.x + i * Math.round(30 * SCALE),
          barrierY,
          Math.round(25 * SCALE),
          Math.round(12 * SCALE),
          i % 2 === 0 ? 0xf97316 : 0xffffff
        );
        barrier.setDepth(5);
        this.trendingElements.push(barrier);
      }
    });
  }

  private createMovingTraffic(): void {
    // Clear any existing traffic timers to prevent leaks
    this.clearTrafficTimers();

    // Taxi driving right (scaled)
    const movingTaxi = this.add.sprite(Math.round(-60 * SCALE), Math.round(585 * SCALE), "taxi");
    movingTaxi.setDepth(3);
    movingTaxi.setFlipX(true);
    this.trendingElements.push(movingTaxi);

    // Use looping timer events instead of recursive delayedCall chains
    const taxiTimer = this.time.addEvent({
      delay: 10000, // Total cycle: 6000ms drive + 4000ms wait
      callback: () => {
        if (this.currentZone !== "trending" || !movingTaxi.active) return;
        movingTaxi.setX(Math.round(-60 * SCALE));
        this.tweens.add({
          targets: movingTaxi,
          x: GAME_WIDTH + Math.round(60 * SCALE),
          duration: 6000,
          ease: "Linear",
        });
      },
      callbackScope: this,
      loop: true,
      startAt: 9000, // Start almost immediately (first drive after 1000ms)
    });
    this.trafficTimers.push(taxiTimer);

    // Initial taxi animation
    this.time.delayedCall(1000, () => {
      if (this.currentZone !== "trending" || !movingTaxi.active) return;
      this.tweens.add({
        targets: movingTaxi,
        x: GAME_WIDTH + Math.round(60 * SCALE),
        duration: 6000,
        ease: "Linear",
      });
    });

    // Blue car driving left (scaled)
    const movingCar = this.add.sprite(
      GAME_WIDTH + Math.round(60 * SCALE),
      Math.round(565 * SCALE),
      "car_blue"
    );
    movingCar.setDepth(3);
    this.trendingElements.push(movingCar);

    // Use looping timer events instead of recursive delayedCall chains
    const carTimer = this.time.addEvent({
      delay: 12000, // Total cycle: 7000ms drive + 5000ms wait
      callback: () => {
        if (this.currentZone !== "trending" || !movingCar.active) return;
        movingCar.setX(GAME_WIDTH + Math.round(60 * SCALE));
        this.tweens.add({
          targets: movingCar,
          x: Math.round(-60 * SCALE),
          duration: 7000,
          ease: "Linear",
        });
      },
      callbackScope: this,
      loop: true,
      startAt: 9000, // Start almost immediately (first drive after 3000ms)
    });
    this.trafficTimers.push(carTimer);

    // Initial car animation
    this.time.delayedCall(3000, () => {
      if (this.currentZone !== "trending" || !movingCar.active) return;
      this.tweens.add({
        targets: movingCar,
        x: Math.round(-60 * SCALE),
        duration: 7000,
        ease: "Linear",
      });
    });
  }

  private clearTrafficTimers(): void {
    this.trafficTimers.forEach((timer) => {
      if (timer && timer.destroy) {
        timer.destroy();
      }
    });
    this.trafficTimers = [];
  }

  private createTrendingBillboards(): void {
    // Main central billboard - custom styled container (scaled)
    const billboardX = Math.round(400 * SCALE);
    const billboardY = Math.round(150 * SCALE);
    const billboardWidth = Math.round(160 * SCALE);
    const billboardHeight = Math.round(90 * SCALE);

    // Billboard frame (dark background with border)
    const billboardFrame = this.add.rectangle(
      billboardX,
      billboardY,
      billboardWidth + Math.round(6 * SCALE),
      billboardHeight + Math.round(6 * SCALE),
      0x1a1a1a
    );
    billboardFrame.setStrokeStyle(Math.round(2 * SCALE), 0xfbbf24);
    billboardFrame.setDepth(5);
    this.trendingElements.push(billboardFrame);

    // Inner billboard background
    const billboardBg = this.add.rectangle(
      billboardX,
      billboardY,
      billboardWidth,
      billboardHeight,
      0x0d0d0d
    );
    billboardBg.setDepth(5);
    this.trendingElements.push(billboardBg);

    // HOT TOKENS header bar
    const headerBar = this.add.rectangle(
      billboardX,
      billboardY - Math.round(30 * SCALE),
      billboardWidth,
      Math.round(22 * SCALE),
      0xfbbf24
    );
    headerBar.setDepth(6);
    this.trendingElements.push(headerBar);

    // Billboard title text (scaled font)
    const billboardTitle = this.add.text(
      billboardX,
      billboardY - Math.round(30 * SCALE),
      "HOT TOKENS",
      {
        fontFamily: "monospace",
        fontSize: `${Math.round(12 * SCALE)}px`,
        color: "#0d0d0d",
        fontStyle: "bold",
      }
    );
    billboardTitle.setOrigin(0.5, 0.5);
    billboardTitle.setDepth(7);
    this.billboardTexts.push(billboardTitle);

    // Stats display (centered in billboard, scaled font)
    const statsText = this.add.text(billboardX, billboardY, "LOADING...", {
      fontFamily: "monospace",
      fontSize: `${Math.round(11 * SCALE)}px`,
      color: "#4ade80",
    });
    statsText.setOrigin(0.5, 0.5);
    statsText.setDepth(6);
    this.billboardTexts.push(statsText);

    // Volume display (below stats, scaled font)
    const volumeText = this.add.text(
      billboardX,
      billboardY + Math.round(25 * SCALE),
      "24H VOL: ...",
      {
        fontFamily: "monospace",
        fontSize: `${Math.round(10 * SCALE)}px`,
        color: "#60a5fa",
      }
    );
    volumeText.setOrigin(0.5, 0.5);
    volumeText.setDepth(6);
    this.billboardTexts.push(volumeText);

    // Side billboards - styled containers (scaled)
    const sideBillboardWidth = Math.round(100 * SCALE);
    const sideBillboardHeight = Math.round(60 * SCALE);
    const leftX = Math.round(130 * SCALE);
    const rightX = Math.round(670 * SCALE);
    const sideY = Math.round(320 * SCALE);
    const sideHeaderY = Math.round(300 * SCALE);
    const sideTextY = Math.round(328 * SCALE);

    // Left billboard - TOP GAINER
    const leftFrame = this.add.rectangle(
      leftX,
      sideY,
      sideBillboardWidth + Math.round(4 * SCALE),
      sideBillboardHeight + Math.round(4 * SCALE),
      0x1a1a1a
    );
    leftFrame.setStrokeStyle(Math.round(2 * SCALE), 0x4ade80);
    leftFrame.setDepth(5);
    this.trendingElements.push(leftFrame);

    const leftBg = this.add.rectangle(
      leftX,
      sideY,
      sideBillboardWidth,
      sideBillboardHeight,
      0x0d0d0d
    );
    leftBg.setDepth(5);
    this.trendingElements.push(leftBg);

    const leftHeader = this.add.rectangle(
      leftX,
      sideHeaderY,
      sideBillboardWidth,
      Math.round(16 * SCALE),
      0x4ade80
    );
    leftHeader.setDepth(6);
    this.trendingElements.push(leftHeader);

    const leftTitle = this.add.text(leftX, sideHeaderY, "TOP GAINER", {
      fontFamily: "monospace",
      fontSize: `${Math.round(8 * SCALE)}px`,
      color: "#0d0d0d",
      fontStyle: "bold",
    });
    leftTitle.setOrigin(0.5, 0.5);
    leftTitle.setDepth(7);
    this.billboardTexts.push(leftTitle);

    const leftText = this.add.text(leftX, sideTextY, "...", {
      fontFamily: "monospace",
      fontSize: `${Math.round(9 * SCALE)}px`,
      color: "#4ade80",
      align: "center",
    });
    leftText.setOrigin(0.5, 0.5);
    leftText.setDepth(6);
    this.billboardTexts.push(leftText);

    // Right billboard - VOLUME KING
    const rightFrame = this.add.rectangle(
      rightX,
      sideY,
      sideBillboardWidth + Math.round(4 * SCALE),
      sideBillboardHeight + Math.round(4 * SCALE),
      0x1a1a1a
    );
    rightFrame.setStrokeStyle(Math.round(2 * SCALE), 0xec4899);
    rightFrame.setDepth(5);
    this.trendingElements.push(rightFrame);

    const rightBg = this.add.rectangle(
      rightX,
      sideY,
      sideBillboardWidth,
      sideBillboardHeight,
      0x0d0d0d
    );
    rightBg.setDepth(5);
    this.trendingElements.push(rightBg);

    const rightHeader = this.add.rectangle(
      rightX,
      sideHeaderY,
      sideBillboardWidth,
      Math.round(16 * SCALE),
      0xec4899
    );
    rightHeader.setDepth(6);
    this.trendingElements.push(rightHeader);

    const rightTitle = this.add.text(rightX, sideHeaderY, "VOLUME KING", {
      fontFamily: "monospace",
      fontSize: `${Math.round(8 * SCALE)}px`,
      color: "#0d0d0d",
      fontStyle: "bold",
    });
    rightTitle.setOrigin(0.5, 0.5);
    rightTitle.setDepth(7);
    this.billboardTexts.push(rightTitle);

    const rightText = this.add.text(rightX, sideTextY, "...", {
      fontFamily: "monospace",
      fontSize: `${Math.round(9 * SCALE)}px`,
      color: "#ec4899",
      align: "center",
    });
    rightText.setOrigin(0.5, 0.5);
    rightText.setDepth(6);
    this.billboardTexts.push(rightText);

    // Update billboard data periodically (store reference for cleanup)
    if (this.billboardTimer) {
      this.billboardTimer.destroy();
    }
    this.billboardTimer = this.time.addEvent({
      delay: 5000,
      callback: this.updateBillboardData,
      callbackScope: this,
      loop: true,
    });

    // Initial update
    this.updateBillboardData();
  }

  private createTrendingTicker(): void {
    // Ticker display bar at very bottom of screen (scaled)
    const tickerY = Math.round(592 * SCALE);

    // Dark background bar for ticker
    const tickerBg = this.add.rectangle(
      GAME_WIDTH / 2,
      tickerY,
      GAME_WIDTH,
      Math.round(16 * SCALE),
      0x0a0a0f
    );
    tickerBg.setDepth(10);
    this.trendingElements.push(tickerBg);

    // Subtle top border
    const tickerBorder = this.add.rectangle(
      GAME_WIDTH / 2,
      tickerY - Math.round(8 * SCALE),
      GAME_WIDTH,
      Math.round(1 * SCALE),
      0x374151
    );
    tickerBorder.setDepth(10);
    this.trendingElements.push(tickerBorder);

    // Create mask for ticker text (scaled)
    const maskShape = this.make.graphics({});
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(0, tickerY - Math.round(8 * SCALE), GAME_WIDTH, Math.round(16 * SCALE));
    const mask = maskShape.createGeometryMask();

    // Ticker text (scaled font)
    this.tickerText = this.add.text(GAME_WIDTH, tickerY, this.getTickerContent(), {
      fontFamily: "monospace",
      fontSize: `${Math.round(10 * SCALE)}px`,
      color: "#4ade80",
    });
    this.tickerText.setOrigin(0, 0.5);
    this.tickerText.setDepth(11);
    this.tickerText.setMask(mask);
  }

  private getTickerContent(): string {
    // Generate ticker content from world state
    const content: string[] = [">>> BAGSWORLD CITY <<<"];

    if (this.worldState) {
      const buildings = this.worldState.buildings || [];
      // Sort by volume to show most active (exclude landmarks which have no real market data)
      const sorted = [...buildings]
        .filter((b) => !b.isPermanent)
        .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
      sorted.slice(0, 5).forEach((b) => {
        const change = b.change24h
          ? b.change24h > 0
            ? `+${b.change24h.toFixed(1)}%`
            : `${b.change24h.toFixed(1)}%`
          : "";
        content.push(`${b.symbol}: $${this.formatNumber(b.marketCap || 0)} ${change}`);
      });
    }

    content.push(">>> BAGS.FM <<<");

    return content.join("   |   ");
  }

  private updateTicker(): void {
    if (!this.tickerText || this.currentZone !== "trending") return;

    this.tickerOffset -= Math.round(2 * SCALE);
    this.tickerText.setX(GAME_WIDTH + this.tickerOffset);

    // Reset when fully scrolled (scaled offset)
    if (this.tickerOffset < -this.tickerText.width - Math.round(100 * SCALE)) {
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
        this.billboardTexts[6].setText(
          `${byVolume[0].symbol}\n$${this.formatNumber(byVolume[0].volume24h || 0)}`
        );
      }
    }
  }

  private formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toFixed(0);
  }

  /**
   * Setup Ballers Valley zone - exclusive area for top BagsWorld token holders
   * Features luxury Bel Air estate aesthetic with premium landscaping
   * Sky layer remains persistent (not modified per-zone)
   */
  private setupBallersZone(): void {
    // Hide park decorations and animals (they belong to main_city)
    this.decorations.forEach((d) => d.setVisible(false));
    this.animals.forEach((a) => a.sprite.setVisible(false));

    // Hide fountain water spray
    if (this.fountainWater) {
      this.fountainWater.setVisible(false);
    }

    // IMPORTANT: Hide other zone elements (prevents visual overlap)
    this.trendingElements.forEach((el) => (el as any).setVisible(false));
    this.skylineSprites.forEach((s) => s.setVisible(false));
    this.billboardTexts.forEach((t) => t.setVisible(false));
    if (this.tickerText) this.tickerText.setVisible(false);
    this.academyElements.forEach((el) => (el as any).setVisible(false));
    this.academyBuildings.forEach((s) => s.setVisible(false));
    this.foundersElements.forEach((el) => (el as any).setVisible(false));
    this.labsElements.forEach((el) => (el as any).setVisible(false));
    this.moltbookElements.forEach((el) => (el as any).setVisible(false));
    this.arenaElements.forEach((el) => (el as any).setVisible(false));
    this.disconnectArenaWebSocket();
    if (this.foundersPopup) {
      this.foundersPopup.destroy();
      this.foundersPopup = null;
    }

    // Restore normal sky (persistent layer - not modified per-zone)
    this.restoreNormalSky();

    // Hide default grass - we draw custom luxury ground
    this.ground.setVisible(false);

    // Check if elements were destroyed (can happen during transitions)
    const elementsValid =
      this.ballersElements.length > 0 &&
      this.ballersElements.every((el) => (el as any).active !== false);

    if (!elementsValid && this.ballersZoneCreated) {
      this.ballersElements = [];
      this.ballersZoneCreated = false;
    }

    // Only create elements once, then just show them
    if (!this.ballersZoneCreated) {
      this.createBallersDecorations();
      this.ballersZoneCreated = true;
    } else {
      // Subsequent times - just show existing elements
      this.ballersElements.forEach((el) => (el as any).setVisible(true));
    }
  }

  /**
   * Create Ballers Valley decorations - Luxury Bel Air estate environment
   * Uses proper BagsWorld pixel art textures from BootScene
   */
  private createBallersDecorations(): void {
    const centerX = GAME_WIDTH / 2;
    const groundY = Math.round(550 * SCALE);
    const pathY = Math.round(565 * SCALE);

    // === LUXURY LAWN (tileSprite using generated texture) ===
    const lawnTile = this.add.tileSprite(
      GAME_WIDTH / 2,
      Math.round(500 * SCALE),
      GAME_WIDTH,
      Math.round(140 * SCALE),
      "luxury_lawn"
    );
    lawnTile.setDepth(-1);
    this.ballersElements.push(lawnTile);

    // === MARBLE PATHWAY (tileSprite using generated texture) ===
    const marbleTile = this.add.tileSprite(
      GAME_WIDTH / 2,
      pathY,
      GAME_WIDTH,
      Math.round(55 * SCALE),
      "marble_path"
    );
    marbleTile.setDepth(0);
    this.ballersElements.push(marbleTile);

    // Gold trim borders on pathway
    const goldTrimTop = this.add.rectangle(
      GAME_WIDTH / 2,
      pathY - Math.round(27 * SCALE),
      GAME_WIDTH,
      Math.round(4 * SCALE),
      0xd4a017
    );
    goldTrimTop.setDepth(1);
    this.ballersElements.push(goldTrimTop);

    const goldTrimBottom = this.add.rectangle(
      GAME_WIDTH / 2,
      pathY + Math.round(27 * SCALE),
      GAME_WIDTH,
      Math.round(4 * SCALE),
      0xd4a017
    );
    goldTrimBottom.setDepth(1);
    this.ballersElements.push(goldTrimBottom);

    // === ORNATE GOLDEN FOUNTAIN (sprite texture) ===
    const fountain = this.add.sprite(centerX, groundY - Math.round(5 * SCALE), "gold_fountain");
    fountain.setOrigin(0.5, 1);
    fountain.setDepth(2);
    this.ballersElements.push(fountain);

    // === TOPIARIES (sprite textures) ===
    const topiaryPositions = [
      { x: Math.round(100 * SCALE), scale: 1.0 },
      { x: Math.round(260 * SCALE), scale: 0.85 },
      { x: Math.round(540 * SCALE), scale: 0.85 },
      { x: Math.round(700 * SCALE), scale: 1.0 },
    ];

    topiaryPositions.forEach(({ x, scale }) => {
      const topiary = this.add.sprite(x, groundY, "topiary");
      topiary.setOrigin(0.5, 1);
      topiary.setScale(scale);
      topiary.setDepth(2);
      this.ballersElements.push(topiary);
    });

    // === GOLD LAMP POSTS (sprite textures) ===
    const lampPositions = [
      Math.round(50 * SCALE),
      Math.round(180 * SCALE),
      Math.round(620 * SCALE),
      Math.round(750 * SCALE),
    ];

    lampPositions.forEach((lx) => {
      const lamp = this.add.sprite(lx, groundY, "gold_lamp");
      lamp.setOrigin(0.5, 1);
      lamp.setDepth(3);
      this.ballersElements.push(lamp);
    });

    // === IRON GATES (sprite textures) ===
    // Left gate
    const leftGate = this.add.sprite(Math.round(30 * SCALE), groundY, "iron_gate");
    leftGate.setOrigin(0.5, 1);
    leftGate.setDepth(4);
    this.ballersElements.push(leftGate);

    // Right gate (flipped)
    const rightGate = this.add.sprite(GAME_WIDTH - Math.round(30 * SCALE), groundY, "iron_gate");
    rightGate.setOrigin(0.5, 1);
    rightGate.setFlipX(true);
    rightGate.setDepth(4);
    this.ballersElements.push(rightGate);

    // === GOLD URNS/STATUES (sprite textures) ===
    const urnPositions = [Math.round(340 * SCALE), Math.round(460 * SCALE)];

    urnPositions.forEach((ux) => {
      const urn = this.add.sprite(ux, groundY, "gold_urn");
      urn.setOrigin(0.5, 1);
      urn.setDepth(2);
      this.ballersElements.push(urn);
    });

    // === RED CARPET (sprite texture) ===
    const carpet = this.add.sprite(centerX, groundY + Math.round(15 * SCALE), "red_carpet");
    carpet.setOrigin(0.5, 1);
    carpet.setDepth(1);
    this.ballersElements.push(carpet);

    // === ADDITIONAL DECORATIVE HEDGES (using existing bush texture with tint) ===
    const hedgePositions = [Math.round(150 * SCALE), Math.round(650 * SCALE)];

    hedgePositions.forEach((hx) => {
      const hedge = this.add.sprite(hx, groundY - Math.round(5 * SCALE), "bush");
      hedge.setOrigin(0.5, 1);
      hedge.setScale(1.3);
      hedge.setTint(0x145214); // Darker green for manicured look
      hedge.setDepth(2);
      this.ballersElements.push(hedge);
    });

    // === DECORATIVE FLOWERS along pathway ===
    const flowerPositions = [
      Math.round(120 * SCALE),
      Math.round(220 * SCALE),
      Math.round(580 * SCALE),
      Math.round(680 * SCALE),
    ];

    flowerPositions.forEach((fx) => {
      const flower = this.add.sprite(fx, groundY - Math.round(3 * SCALE), "flower");
      flower.setOrigin(0.5, 1);
      flower.setTint(0xffd700); // Gold flowers for luxury feel
      flower.setDepth(2);
      this.ballersElements.push(flower);
    });

    // === LUXURY SUPERCAR parked outside #1 WHALE mansion ===
    // Position slightly right of center, on the pathway
    const supercar = this.add.sprite(
      centerX + Math.round(80 * SCALE),
      pathY + Math.round(5 * SCALE),
      "supercar"
    );
    supercar.setOrigin(0.5, 1);
    supercar.setDepth(3);
    supercar.setFlipX(true); // Face toward the mansion
    this.ballersElements.push(supercar);

    // Add a subtle glow/reflection under the car for extra luxury feel
    const carGlow = this.add.ellipse(
      centerX + Math.round(80 * SCALE),
      pathY + Math.round(12 * SCALE),
      Math.round(70 * SCALE),
      Math.round(12 * SCALE),
      0xffd700,
      0.15
    );
    carGlow.setDepth(2);
    this.ballersElements.push(carGlow);
  }

  /**
   * Setup Founder's Corner zone - educational hub for DexScreener prep
   * Features cozy workshop aesthetic with clickable buildings for info popups
   */
  private setupFoundersZone(): void {
    // Hide park decorations and animals (they belong to main_city)
    this.decorations.forEach((d) => d.setVisible(false));
    this.animals.forEach((a) => a.sprite.setVisible(false));

    // Hide fountain water spray
    if (this.fountainWater) {
      this.fountainWater.setVisible(false);
    }

    // IMPORTANT: Hide other zone elements (prevents visual overlap)
    this.trendingElements.forEach((el) => (el as any).setVisible(false));
    this.skylineSprites.forEach((s) => s.setVisible(false));
    this.billboardTexts.forEach((t) => t.setVisible(false));
    if (this.tickerText) this.tickerText.setVisible(false);
    this.academyElements.forEach((el) => (el as any).setVisible(false));
    this.academyBuildings.forEach((s) => s.setVisible(false));
    this.ballersElements.forEach((el) => (el as any).setVisible(false));
    this.labsElements.forEach((el) => (el as any).setVisible(false));
    this.moltbookElements.forEach((el) => (el as any).setVisible(false));
    this.arenaElements.forEach((el) => (el as any).setVisible(false));
    this.disconnectArenaWebSocket();

    // Restore normal sky (persistent layer)
    this.restoreNormalSky();

    // Swap ground texture to cobblestone
    this.ground.setVisible(true);
    this.ground.setTexture("founders_ground");

    // Check if elements were destroyed (can happen during transitions)
    const elementsValid =
      this.foundersElements.length > 0 &&
      this.foundersElements.every((el) => (el as any).active !== false);

    if (!elementsValid && this.foundersZoneCreated) {
      this.foundersElements = [];
      this.foundersZoneCreated = false;
    }

    // Only create elements once, then just show them
    if (!this.foundersZoneCreated) {
      this.createFoundersDecorations();
      this.foundersZoneCreated = true;
    } else {
      // Subsequent times - just show existing elements
      this.foundersElements.forEach((el) => (el as any).setVisible(true));
    }
  }

  /**
   * Create Founder's Corner decorations - cozy workshop environment
   * Includes 3 clickable buildings with educational popups
   */
  private createFoundersDecorations(): void {
    const s = SCALE;
    const grassTop = Math.round(455 * s);
    const pathLevel = Math.round(555 * s);
    const groundY = Math.round(550 * s);

    // === BACKGROUND TREES (depth 2) ===
    const treePositions = [
      { x: 80, yOffset: 0 },
      { x: 200, yOffset: 5 },
      { x: 520, yOffset: -3 },
      { x: 680, yOffset: 8 },
      { x: 780, yOffset: 2 },
    ];

    treePositions.forEach((pos) => {
      const tree = this.add.sprite(Math.round(pos.x * s), grassTop + pos.yOffset, "tree");
      tree.setOrigin(0.5, 1);
      tree.setDepth(2);
      tree.setScale(0.9 + Math.random() * 0.3);
      this.foundersElements.push(tree);

      // Subtle sway animation for trees
      this.tweens.add({
        targets: tree,
        angle: { from: -2, to: 2 },
        duration: 2000 + Math.random() * 1000,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });

    // === HEDGES (depth 2) ===
    const hedgePositions = [
      { x: 140, yOffset: 25 },
      { x: 340, yOffset: 22 },
      { x: 460, yOffset: 27 },
      { x: 600, yOffset: 24 },
    ];

    hedgePositions.forEach((pos) => {
      const hedge = this.add.sprite(Math.round(pos.x * s), grassTop + pos.yOffset, "bush");
      hedge.setOrigin(0.5, 1);
      hedge.setDepth(2);
      hedge.setScale(0.8 + Math.random() * 0.2);
      this.foundersElements.push(hedge);
    });

    // === FLOWERS (depth 2) ===
    const flowerPositions = [130, 260, 380, 540, 650];
    flowerPositions.forEach((fx) => {
      const flower = this.add.sprite(Math.round(fx * s), grassTop + Math.round(32 * s), "flower");
      flower.setOrigin(0.5, 1);
      flower.setDepth(2);
      flower.setScale(0.8 + Math.random() * 0.3);
      this.foundersElements.push(flower);

      // Gentle sway animation
      this.tweens.add({
        targets: flower,
        angle: { from: -3, to: 3 },
        duration: 1500 + Math.random() * 500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });

    // === BUILDINGS (depth 5+) - Clickable with info popups ===
    const buildings = [
      { texture: "founders_0", x: 250, label: "DEXSCREENER\nWORKSHOP", type: "workshop" },
      { texture: "founders_1", x: 450, label: "ART\nSTUDIO", type: "studio" },
      { texture: "founders_2", x: 650, label: "SOCIAL\nHUB", type: "social" },
    ];

    buildings.forEach((b, i) => {
      const bx = Math.round(b.x * s);
      const sprite = this.add.sprite(bx, pathLevel, b.texture);
      sprite.setOrigin(0.5, 1);
      sprite.setDepth(5 - i / 10);

      // Make building interactive
      sprite.setInteractive({ useHandCursor: true });
      sprite.on("pointerdown", () => this.showFoundersPopup(b.type));
      sprite.on("pointerover", () => {
        sprite.setTint(0xdddddd);
        this.tweens.add({
          targets: sprite,
          scaleX: 1.02,
          scaleY: 1.02,
          duration: 100,
          ease: "Power2",
        });
      });
      sprite.on("pointerout", () => {
        sprite.clearTint();
        this.tweens.add({
          targets: sprite,
          scaleX: 1,
          scaleY: 1,
          duration: 100,
          ease: "Power2",
        });
      });

      this.foundersElements.push(sprite);

      // Building label with background
      const labelBg = this.add.rectangle(
        bx,
        pathLevel + Math.round(18 * s),
        Math.round(70 * s),
        Math.round(24 * s),
        0x000000,
        0.7
      );
      labelBg.setDepth(6);
      labelBg.setStrokeStyle(1, 0x4ade80);
      this.foundersElements.push(labelBg);

      const label = this.add.text(bx, pathLevel + Math.round(18 * s), b.label, {
        fontFamily: "monospace",
        fontSize: `${Math.round(8 * s)}px`,
        color: "#4ade80",
        align: "center",
      });
      label.setOrigin(0.5, 0.5);
      label.setDepth(7);
      this.foundersElements.push(label);
    });

    // === LANTERNS (depth 3) ===
    const lanternPositions = [170, 350, 550, 730];
    lanternPositions.forEach((lx) => {
      const lantern = this.add.sprite(Math.round(lx * s), pathLevel, "founders_lantern");
      lantern.setOrigin(0.5, 1);
      lantern.setDepth(3);
      this.foundersElements.push(lantern);

      // Warm glow effect under lantern
      const glow = this.add.ellipse(
        Math.round(lx * s),
        pathLevel + Math.round(5 * s),
        Math.round(50 * s),
        Math.round(15 * s),
        0xfbbf24,
        0.2
      );
      glow.setDepth(1);
      this.foundersElements.push(glow);

      // Pulsing glow animation
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.15, to: 0.25 },
        duration: 1500 + Math.random() * 500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });

    // === BENCHES (depth 3) ===
    const benchPositions = [280, 500];
    benchPositions.forEach((bx) => {
      const bench = this.add.sprite(Math.round(bx * s), pathLevel - Math.round(5 * s), "bench");
      bench.setOrigin(0.5, 1);
      bench.setDepth(3);
      this.foundersElements.push(bench);
    });

    // === WORKBENCHES (depth 3) ===
    const workbenchPositions = [150, 580];
    workbenchPositions.forEach((wx) => {
      const workbench = this.add.sprite(
        Math.round(wx * s),
        grassTop + Math.round(30 * s),
        "founders_workbench"
      );
      workbench.setOrigin(0.5, 1);
      workbench.setDepth(3);
      this.foundersElements.push(workbench);
    });

    // === EASELS (depth 3) ===
    const easelPositions = [300, 480];
    easelPositions.forEach((ex) => {
      const easel = this.add.sprite(
        Math.round(ex * s),
        grassTop + Math.round(25 * s),
        "founders_easel"
      );
      easel.setOrigin(0.5, 1);
      easel.setDepth(3);
      this.foundersElements.push(easel);
    });

    // === CRATES (depth 4) ===
    const cratePositions = [100, 400, 720];
    cratePositions.forEach((cx) => {
      const crate = this.add.sprite(
        Math.round(cx * s),
        pathLevel + Math.round(5 * s),
        "founders_crate"
      );
      crate.setOrigin(0.5, 1);
      crate.setDepth(4);
      this.foundersElements.push(crate);
    });

    // === CHALKBOARD WELCOME SIGN (centered, depth 2) ===
    const chalkboard = this.add.sprite(
      GAME_WIDTH / 2,
      grassTop - Math.round(10 * s),
      "founders_chalkboard"
    );
    chalkboard.setOrigin(0.5, 1);
    chalkboard.setDepth(2);
    this.foundersElements.push(chalkboard);

    // === POKEMON (depth 4, ground level) - Interactive and roaming ===
    // Clear any existing pokemon from previous zone visits
    this.pokemon = [];

    const pokemonConfigs: Array<{
      texture: string;
      type: "charmander" | "squirtle" | "bulbasaur";
      x: number;
      yOffset: number;
      scale: number;
      speed: number;
    }> = [
      {
        texture: "pokemon_charmander",
        type: "charmander",
        x: 150,
        yOffset: 8,
        scale: 1.4,
        speed: 0.25,
      },
      {
        texture: "pokemon_squirtle",
        type: "squirtle",
        x: 400,
        yOffset: 8,
        scale: 1.35,
        speed: 0.2,
      },
      {
        texture: "pokemon_bulbasaur",
        type: "bulbasaur",
        x: 650,
        yOffset: 8,
        scale: 1.3,
        speed: 0.15,
      },
    ];

    pokemonConfigs.forEach((config, index) => {
      const baseY = pathLevel + Math.round(config.yOffset * s);
      const sprite = this.add.sprite(Math.round(config.x * s), baseY, config.texture);
      sprite.setOrigin(0.5, 1);
      sprite.setScale(config.scale);
      sprite.setDepth(4);
      this.foundersElements.push(sprite);

      // Make Pokemon interactive
      sprite.setInteractive({ useHandCursor: true });
      sprite.on("pointerdown", () => this.petPokemon(config.type));
      sprite.on("pointerover", () => sprite.setTint(0xffffcc));
      sprite.on("pointerout", () => sprite.clearTint());

      // Store in pokemon array for movement updates
      const pokemonObj: Pokemon = {
        sprite,
        type: config.type,
        targetX: Math.round(config.x * s),
        speed: config.speed,
        direction: Math.random() > 0.5 ? "left" : "right",
        idleTimer: 0,
        isIdle: true,
        baseY,
      };
      this.pokemon.push(pokemonObj);

      // Subtle idle breathing animation
      this.tweens.add({
        targets: sprite,
        scaleY: config.scale * 1.03,
        duration: 800 + index * 150,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      // Random hop/movement trigger
      this.time.addEvent({
        delay: 2000 + index * 800,
        callback: () => {
          if (sprite.active && pokemonObj.isIdle && this.currentZone === "founders") {
            // Decide to move or hop
            if (Math.random() > 0.4) {
              // Start roaming
              pokemonObj.isIdle = false;
              pokemonObj.targetX = Math.round(100 * s) + Math.random() * Math.round(600 * s);
              pokemonObj.direction = pokemonObj.targetX > sprite.x ? "right" : "left";
            } else {
              // Just hop in place
              this.tweens.add({
                targets: sprite,
                y: sprite.y - Math.round(12 * s),
                duration: 200,
                yoyo: true,
                ease: "Quad.easeOut",
              });
            }
          }
        },
        loop: true,
      });
    });
  }

  /**
   * Show Founder's Corner popup with pixel-art themed educational content
   * Enhanced with CRT scanlines, animated elements, and retro terminal styling
   */
  private showFoundersPopup(type: string): void {
    // Don't open if popup already exists
    if (this.foundersPopup) return;

    const s = SCALE;
    const centerX = GAME_WIDTH / 2;
    const centerY = Math.round(300 * s);

    // Create container for popup
    const popup = this.add.container(0, 0);
    this.foundersPopup = popup;
    popup.setDepth(100);

    // Dark overlay with pixel grid pattern effect
    const overlay = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_WIDTH / 2,
      GAME_WIDTH * 2,
      GAME_WIDTH * 2,
      0x0a0a0f,
      0.88
    );
    overlay.setInteractive();
    overlay.on("pointerdown", () => this.hideFoundersPopup());
    popup.add(overlay);

    // Get content and theme based on building type
    const content = this.getFoundersPopupContent(type);
    const theme = this.getFoundersPopupTheme(type);

    // Panel dimensions (larger to fit content)
    const panelW = Math.round(380 * s);
    const panelH = Math.round(420 * s);
    const borderW = Math.round(4 * s);

    // === PIXEL-PERFECT DROP SHADOW (layered for depth) ===
    const shadowOffset = Math.round(6 * s);
    const shadow1 = this.add.rectangle(
      centerX + shadowOffset,
      centerY + shadowOffset,
      panelW + borderW * 2,
      panelH + borderW * 2,
      0x000000,
      0.4
    );
    popup.add(shadow1);
    const shadow2 = this.add.rectangle(
      centerX + Math.round(3 * s),
      centerY + Math.round(3 * s),
      panelW + borderW * 2,
      panelH + borderW * 2,
      0x000000,
      0.3
    );
    popup.add(shadow2);

    // === DOUBLE-LINE BORDER (classic terminal style) ===
    // Outer border line
    const outerBorder = this.add.rectangle(
      centerX,
      centerY,
      panelW + borderW * 2,
      panelH + borderW * 2,
      theme.accent
    );
    popup.add(outerBorder);

    // Gap between borders (dark)
    const borderGap = this.add.rectangle(
      centerX,
      centerY,
      panelW + borderW,
      panelH + borderW,
      0x0a0a0f
    );
    popup.add(borderGap);

    // Inner border line
    const innerBorder = this.add.rectangle(centerX, centerY, panelW, panelH, theme.accent);
    popup.add(innerBorder);

    // Main panel background with subtle dither texture
    const panelDark = this.add.rectangle(
      centerX,
      centerY,
      panelW - Math.round(4 * s),
      panelH - Math.round(4 * s),
      0x0f172a
    );
    popup.add(panelDark);

    // Inner bevel highlight (top/left edges)
    const bevelLight = this.add.rectangle(
      centerX - panelW / 2 + Math.round(4 * s),
      centerY,
      Math.round(2 * s),
      panelH - Math.round(8 * s),
      theme.accent,
      0.15
    );
    popup.add(bevelLight);
    const bevelTop = this.add.rectangle(
      centerX,
      centerY - panelH / 2 + Math.round(4 * s),
      panelW - Math.round(8 * s),
      Math.round(2 * s),
      theme.accent,
      0.2
    );
    popup.add(bevelTop);

    // === CRT SCANLINE OVERLAY ===
    const scanlineSpacing = Math.round(3 * s);
    for (let y = centerY - panelH / 2; y < centerY + panelH / 2; y += scanlineSpacing) {
      const scanline = this.add.rectangle(
        centerX,
        y,
        panelW - Math.round(8 * s),
        1,
        0x000000,
        0.08
      );
      popup.add(scanline);
    }

    // === L-SHAPED CORNER DECORATIONS (pixel art flourishes) ===
    const cornerLen = Math.round(16 * s);
    const cornerThick = Math.round(4 * s);
    const cornerInset = Math.round(8 * s);

    // Helper to create L-shaped corner
    const createCorner = (cx: number, cy: number, flipX: boolean, flipY: boolean) => {
      const xDir = flipX ? -1 : 1;
      const yDir = flipY ? -1 : 1;
      // Horizontal bar
      const hBar = this.add.rectangle(
        cx + (xDir * cornerLen) / 2,
        cy,
        cornerLen,
        cornerThick,
        theme.accent
      );
      popup.add(hBar);
      // Vertical bar
      const vBar = this.add.rectangle(
        cx,
        cy + (yDir * cornerLen) / 2,
        cornerThick,
        cornerLen,
        theme.accent
      );
      popup.add(vBar);
      // Corner dot accent
      const dot = this.add.rectangle(cx, cy, cornerThick, cornerThick, 0xffffff, 0.8);
      popup.add(dot);
    };

    // Place corners at panel edges
    createCorner(
      centerX - panelW / 2 + cornerInset,
      centerY - panelH / 2 + cornerInset,
      false,
      false
    );
    createCorner(
      centerX + panelW / 2 - cornerInset,
      centerY - panelH / 2 + cornerInset,
      true,
      false
    );
    createCorner(
      centerX - panelW / 2 + cornerInset,
      centerY + panelH / 2 - cornerInset,
      false,
      true
    );
    createCorner(
      centerX + panelW / 2 - cornerInset,
      centerY + panelH / 2 - cornerInset,
      true,
      true
    );

    // === HEADER SECTION ===
    const iconY = centerY - panelH / 2 + Math.round(45 * s);

    // Icon container for animation
    const iconContainer = this.add.container(centerX, iconY);
    popup.add(iconContainer);

    // Icon background (pixel octagon effect - double border)
    const iconBgOuter = this.add.rectangle(
      0,
      0,
      Math.round(52 * s),
      Math.round(52 * s),
      theme.accent
    );
    iconContainer.add(iconBgOuter);
    const iconBgMid = this.add.rectangle(0, 0, Math.round(48 * s), Math.round(48 * s), 0x0a0a0f);
    iconContainer.add(iconBgMid);
    const iconBgInner = this.add.rectangle(0, 0, Math.round(44 * s), Math.round(44 * s), 0x1a1a2e);
    iconContainer.add(iconBgInner);

    // Pixel art icon glow effect
    const iconGlow = this.add.rectangle(
      0,
      0,
      Math.round(40 * s),
      Math.round(40 * s),
      theme.accent,
      0.1
    );
    iconContainer.add(iconGlow);

    // Building icon (emoji representation)
    const iconText = this.add.text(0, 0, theme.icon, {
      fontFamily: "monospace",
      fontSize: `${Math.round(22 * s)}px`,
    });
    iconText.setOrigin(0.5);
    iconContainer.add(iconText);

    // Animate icon with slow pulse and subtle rotation
    this.tweens.add({
      targets: iconContainer,
      scaleX: { from: 1, to: 1.08 },
      scaleY: { from: 1, to: 1.08 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    this.tweens.add({
      targets: iconGlow,
      alpha: { from: 0.1, to: 0.3 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Title with glow effect
    const titleY = centerY - panelH / 2 + Math.round(85 * s);

    // Title glow (behind main text)
    const titleGlow = this.add.text(centerX, titleY, content.title, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: `${Math.round(10 * s)}px`,
      color: theme.titleColor,
      fontStyle: "bold",
    });
    titleGlow.setOrigin(0.5);
    titleGlow.setAlpha(0.3);
    titleGlow.setBlendMode(Phaser.BlendModes.ADD);
    popup.add(titleGlow);

    // Main title text
    const titleText = this.add.text(centerX, titleY, content.title, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: `${Math.round(10 * s)}px`,
      color: theme.titleColor,
      fontStyle: "bold",
    });
    titleText.setOrigin(0.5);
    popup.add(titleText);

    // Animated title glow pulse
    this.tweens.add({
      targets: titleGlow,
      alpha: { from: 0.2, to: 0.5 },
      scaleX: { from: 1, to: 1.02 },
      scaleY: { from: 1, to: 1.02 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Pixel divider (terminal-style double line)
    const dividerY = titleY + Math.round(18 * s);
    const dividerWidth = panelW - Math.round(48 * s);

    // Top divider line
    const dividerTop = this.add.rectangle(
      centerX,
      dividerY - Math.round(2 * s),
      dividerWidth,
      Math.round(2 * s),
      theme.accent,
      0.8
    );
    popup.add(dividerTop);
    // Bottom divider line
    const dividerBottom = this.add.rectangle(
      centerX,
      dividerY + Math.round(2 * s),
      dividerWidth,
      Math.round(2 * s),
      theme.accent,
      0.4
    );
    popup.add(dividerBottom);

    // === CONTENT SECTION ===
    // Calculate section Y based on whether we have a tip
    const hasTip = content.tip && content.tip.length > 0;
    const sectionHeight = hasTip ? Math.round(235 * s) : Math.round(265 * s);
    const sectionY = centerY + Math.round(28 * s);

    // Section background with inner shadow effect
    const sectionBgOuter = this.add.rectangle(
      centerX,
      sectionY,
      panelW - Math.round(20 * s),
      sectionHeight,
      theme.accent,
      0.2
    );
    popup.add(sectionBgOuter);

    const sectionBg = this.add.rectangle(
      centerX,
      sectionY,
      panelW - Math.round(24 * s),
      sectionHeight - Math.round(4 * s),
      0x0a0e17,
      0.95
    );
    popup.add(sectionBg);

    // Inner shadow (top edge)
    const sectionShadow = this.add.rectangle(
      centerX,
      sectionY - sectionHeight / 2 + Math.round(4 * s),
      panelW - Math.round(28 * s),
      Math.round(8 * s),
      0x000000,
      0.3
    );
    popup.add(sectionShadow);

    // Content text - filter empty lines and use compact spacing
    const contentLines = content.body.split("\n").filter((ln) => ln.trim() !== "");
    const lineHeight = Math.round(9 * s);
    const startY = sectionY - sectionHeight / 2 + Math.round(14 * s);

    contentLines.forEach((line, i) => {
      // Determine line color based on content
      let lineColor = "#cbd5e1"; // Default gray
      if (line.startsWith(" +") || line.startsWith(" [x]") || line.match(/^\d\./)) {
        lineColor = "#4ade80"; // Green for included/checked/numbered items
      } else if (line.startsWith(" [ ]")) {
        lineColor = "#fbbf24"; // Gold for optional items
      } else if (
        line.includes("CHECKLIST") ||
        line.includes("WHAT YOU GET") ||
        line.includes("IMPORTANT") ||
        line.includes("REQUIRED") ||
        line.includes("OPTIONAL") ||
        line.includes("BAGS.FM TIP") ||
        line.includes("TOKEN LOGO") ||
        line.includes("TOKEN BANNER") ||
        line.includes("FREE TOOLS")
      ) {
        lineColor = "#60a5fa"; // Cyan for headers
      } else if (line.includes("ORDER:") || line.includes("COST:") || line.includes("TIME:")) {
        lineColor = theme.titleColor; // Theme color for key info
      }

      const lineText = this.add.text(
        centerX - panelW / 2 + Math.round(24 * s),
        startY + i * lineHeight,
        line,
        {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: `${Math.round(5 * s)}px`,
          color: lineColor,
        }
      );
      lineText.setOrigin(0, 0);
      popup.add(lineText);
    });

    // === PRO TIP SECTION (only if tip exists) ===
    if (hasTip) {
      const tipY = centerY + panelH / 2 - Math.round(45 * s);
      const tipBgOuter = this.add.rectangle(
        centerX,
        tipY,
        panelW - Math.round(20 * s),
        Math.round(30 * s),
        theme.accent,
        0.3
      );
      popup.add(tipBgOuter);

      const tipBg = this.add.rectangle(
        centerX,
        tipY,
        panelW - Math.round(24 * s),
        Math.round(26 * s),
        0x0a0e17,
        0.9
      );
      popup.add(tipBg);

      const tipLabel = this.add.text(centerX - panelW / 2 + Math.round(28 * s), tipY, "TIP:", {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: `${Math.round(6 * s)}px`,
        color: "#fbbf24",
        fontStyle: "bold",
      });
      tipLabel.setOrigin(0, 0.5);
      popup.add(tipLabel);

      const tipText = this.add.text(centerX - panelW / 2 + Math.round(65 * s), tipY, content.tip, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: `${Math.round(5.5 * s)}px`,
        color: "#94a3b8",
      });
      tipText.setOrigin(0, 0.5);
      popup.add(tipText);
    }

    // === CLOSE BUTTON (enhanced pixel style with glow) ===
    const closeBtnX = centerX + panelW / 2 - Math.round(20 * s);
    const closeBtnY = centerY - panelH / 2 + Math.round(20 * s);

    // Button glow effect (behind)
    const closeBtnGlow = this.add.rectangle(
      closeBtnX,
      closeBtnY,
      Math.round(30 * s),
      Math.round(30 * s),
      0xef4444,
      0.2
    );
    popup.add(closeBtnGlow);

    // Button outer border (3D effect)
    const closeBtnOuter = this.add.rectangle(
      closeBtnX,
      closeBtnY,
      Math.round(26 * s),
      Math.round(26 * s),
      0xef4444
    );
    popup.add(closeBtnOuter);

    // Button mid border
    const closeBtnMid = this.add.rectangle(
      closeBtnX,
      closeBtnY,
      Math.round(22 * s),
      Math.round(22 * s),
      0x7f1d1d
    );
    popup.add(closeBtnMid);

    // Button inner face
    const closeBtnInner = this.add.rectangle(
      closeBtnX,
      closeBtnY,
      Math.round(18 * s),
      Math.round(18 * s),
      0x1a1a2e
    );
    closeBtnInner.setInteractive({ useHandCursor: true });
    closeBtnInner.on("pointerdown", () => this.hideFoundersPopup());
    closeBtnInner.on("pointerover", () => {
      closeBtnInner.setFillStyle(0x2a2a3e);
      closeBtnOuter.setFillStyle(0xff6b6b);
      closeBtnGlow.setAlpha(0.5);
      closeBtn.setColor("#ffffff");
    });
    closeBtnInner.on("pointerout", () => {
      closeBtnInner.setFillStyle(0x1a1a2e);
      closeBtnOuter.setFillStyle(0xef4444);
      closeBtnGlow.setAlpha(0.2);
      closeBtn.setColor("#ef4444");
    });
    popup.add(closeBtnInner);

    // X text with pixel font
    const closeBtn = this.add.text(closeBtnX, closeBtnY, "X", {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: `${Math.round(9 * s)}px`,
      color: "#ef4444",
      fontStyle: "bold",
    });
    closeBtn.setOrigin(0.5);
    popup.add(closeBtn);

    // === FOOTER (blinking "click to close") ===
    const footerY = centerY + panelH / 2 - Math.round(14 * s);

    // Footer brackets (static)
    const footerLeft = this.add.text(centerX - Math.round(100 * s), footerY, "[", {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: `${Math.round(5 * s)}px`,
      color: "#475569",
    });
    footerLeft.setOrigin(0.5);
    popup.add(footerLeft);

    const footerRight = this.add.text(centerX + Math.round(100 * s), footerY, "]", {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: `${Math.round(5 * s)}px`,
      color: "#475569",
    });
    footerRight.setOrigin(0.5);
    popup.add(footerRight);

    // Footer text (blinking)
    const footerText = this.add.text(centerX, footerY, "Click anywhere to close", {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: `${Math.round(5 * s)}px`,
      color: "#64748b",
    });
    footerText.setOrigin(0.5);
    popup.add(footerText);

    // Subtle blink animation for footer
    this.tweens.add({
      targets: footerText,
      alpha: { from: 1, to: 0.4 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // === ENTRANCE ANIMATION ===
    popup.setAlpha(0);
    popup.setScale(0.9);
    this.tweens.add({
      targets: popup,
      alpha: 1,
      scale: 1,
      duration: 200,
      ease: "Back.easeOut",
    });
  }

  /**
   * Get theme colors for Founder's popup based on building type
   */
  private getFoundersPopupTheme(type: string): {
    accent: number;
    titleColor: string;
    icon: string;
  } {
    switch (type) {
      case "workshop":
        // Terminal green - classic DexScreener/hacker aesthetic
        return { accent: 0x22c55e, titleColor: "#22c55e", icon: "⚙" };
      case "studio":
        // Gold - creative/art theme
        return { accent: 0xfbbf24, titleColor: "#fbbf24", icon: "🎨" };
      case "social":
        // Cyan/blue - social/web theme
        return { accent: 0x38bdf8, titleColor: "#38bdf8", icon: "🌐" };
      default:
        return { accent: 0x4ade80, titleColor: "#4ade80", icon: "📋" };
    }
  }

  /**
   * Hide Founder's Corner popup
   */
  private hideFoundersPopup(): void {
    if (!this.foundersPopup) return;

    this.tweens.add({
      targets: this.foundersPopup,
      alpha: 0,
      duration: 150,
      ease: "Power2",
      onComplete: () => {
        if (this.foundersPopup) {
          this.foundersPopup.destroy();
          this.foundersPopup = null;
        }
      },
    });
  }

  // ============================================================================
  // TECH LABS ZONE
  // Futuristic R&D headquarters - home of the Bags.fm development team
  // ============================================================================

  /**
   * Setup Tech Labs zone - futuristic R&D headquarters
   * Features holographic displays, server rooms, and tech-themed environment
   */
  private setupLabsZone(): void {
    // Hide park decorations and animals (they belong to main_city)
    this.decorations.forEach((d) => d.setVisible(false));
    this.animals.forEach((a) => a.sprite.setVisible(false));

    // Hide fountain water spray
    if (this.fountainWater) {
      this.fountainWater.setVisible(false);
    }

    // IMPORTANT: Hide other zone elements (prevents visual overlap)
    this.trendingElements.forEach((el) => (el as any).setVisible(false));
    this.skylineSprites.forEach((s) => s.setVisible(false));
    this.billboardTexts.forEach((t) => t.setVisible(false));
    if (this.tickerText) this.tickerText.setVisible(false);
    this.academyElements.forEach((el) => (el as any).setVisible(false));
    this.academyBuildings.forEach((s) => s.setVisible(false));
    this.ballersElements.forEach((el) => (el as any).setVisible(false));
    this.foundersElements.forEach((el) => (el as any).setVisible(false));
    this.arenaElements.forEach((el) => (el as any).setVisible(false));
    this.disconnectArenaWebSocket();
    if (this.foundersPopup) {
      this.foundersPopup.destroy();
      this.foundersPopup = null;
    }

    // Create tech-themed twilight sky
    this.createLabsSky();

    // Swap ground texture to tech floor
    this.ground.setVisible(true);
    this.ground.setTexture("labs_ground");

    // Check if elements were destroyed (can happen during transitions)
    const elementsValid =
      this.labsElements.length > 0 && this.labsElements.every((el) => (el as any).active !== false);

    if (!elementsValid && this.labsZoneCreated) {
      this.labsElements = [];
      this.labsZoneCreated = false;
    }

    // Only create elements once, then just show them
    if (!this.labsZoneCreated) {
      this.createLabsDecorations();
      this.labsZoneCreated = true;
    } else {
      // Subsequent times - just show existing elements
      this.labsElements.forEach((el) => (el as any).setVisible(true));
    }
  }

  /**
   * Create futuristic tech sky for Labs zone
   */
  private createLabsSky(): void {
    // Hide normal sky elements
    this.restoreNormalSky();

    // The labs has a subtle blue-purple tech tint handled by ambient lighting
    // No special sky modification needed - keep it clean
  }

  /**
   * Create Tech Labs decorations - Bags.FM HQ environment
   * Features single large HQ building with green-themed props
   */
  private createLabsDecorations(): void {
    const s = SCALE;
    const grassTop = Math.round(455 * s);
    const pathLevel = Math.round(555 * s);

    // === TECH TREES (depth 2) - Digital/circuit pattern trees ===
    const treePositions = [
      { x: 60, yOffset: 0 },
      { x: 180, yOffset: 5 },
      { x: 380, yOffset: -3 },
      { x: 580, yOffset: 8 },
      { x: 720, yOffset: 2 },
    ];

    treePositions.forEach((pos) => {
      const tree = this.add.sprite(Math.round(pos.x * s), grassTop + pos.yOffset, "labs_prop_1");
      tree.setOrigin(0.5, 1);
      tree.setDepth(2);
      tree.setScale(0.9 + Math.random() * 0.3);
      this.labsElements.push(tree);

      // Subtle pulse animation for tech trees
      this.tweens.add({
        targets: tree,
        alpha: { from: 0.85, to: 1 },
        duration: 1500 + Math.random() * 1000,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });

    // === SERVER RACKS (depth 2) - Small server units ===
    const serverPositions = [
      { x: 120, yOffset: 20 },
      { x: 300, yOffset: 25 },
      { x: 480, yOffset: 22 },
      { x: 660, yOffset: 24 },
    ];

    serverPositions.forEach((pos) => {
      const server = this.add.sprite(Math.round(pos.x * s), grassTop + pos.yOffset, "labs_prop_2");
      server.setOrigin(0.5, 1);
      server.setDepth(2);
      server.setScale(0.85 + Math.random() * 0.2);
      this.labsElements.push(server);
    });

    // === HOLO DISPLAYS (depth 2) ===
    const holoPositions = [150, 350, 550, 750];
    holoPositions.forEach((hx) => {
      const holo = this.add.sprite(
        Math.round(hx * s),
        grassTop + Math.round(28 * s),
        "labs_prop_0"
      );
      holo.setOrigin(0.5, 1);
      holo.setDepth(2);
      holo.setScale(0.8 + Math.random() * 0.3);
      this.labsElements.push(holo);

      // Floating animation for holo displays
      this.tweens.add({
        targets: holo,
        y: grassTop + Math.round(25 * s),
        duration: 2000 + Math.random() * 500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });

    // === BAGS.FM HQ (depth 5) - Single large building in center ===
    const hqX = Math.round(420 * s); // Center of zone
    const hqSprite = this.add.sprite(hqX, pathLevel, "labs_hq");
    hqSprite.setOrigin(0.5, 1);
    hqSprite.setDepth(5);

    // Make HQ interactive
    hqSprite.setInteractive({ useHandCursor: true });
    hqSprite.on("pointerdown", () => this.showLabsPopup("hq"));
    hqSprite.on("pointerover", () => {
      hqSprite.setTint(0xbbf7d0); // Light green tint on hover
      this.tweens.add({
        targets: hqSprite,
        scaleX: 1.02,
        scaleY: 1.02,
        duration: 100,
        ease: "Power2",
      });
    });
    hqSprite.on("pointerout", () => {
      hqSprite.clearTint();
      this.tweens.add({
        targets: hqSprite,
        scaleX: 1,
        scaleY: 1,
        duration: 100,
        ease: "Power2",
      });
    });

    this.labsElements.push(hqSprite);

    // HQ label with Bags.FM green theme
    const labelBg = this.add.rectangle(
      hqX,
      pathLevel + Math.round(18 * s),
      Math.round(90 * s),
      Math.round(24 * s),
      0x0a1a0f,
      0.9
    );
    labelBg.setDepth(6);
    labelBg.setStrokeStyle(1, 0x4ade80);
    this.labsElements.push(labelBg);

    const label = this.add.text(hqX, pathLevel + Math.round(18 * s), "BAGS.FM\nHQ", {
      fontFamily: "monospace",
      fontSize: `${Math.round(8 * s)}px`,
      color: "#4ade80",
      align: "center",
    });
    label.setOrigin(0.5, 0.5);
    label.setDepth(7);
    this.labsElements.push(label);

    // === DATA TERMINALS (depth 3) ===
    const terminalPositions = [100, 320, 520, 760];
    terminalPositions.forEach((tx) => {
      const terminal = this.add.sprite(Math.round(tx * s), pathLevel, "labs_prop_3");
      terminal.setOrigin(0.5, 1);
      terminal.setDepth(3);
      this.labsElements.push(terminal);

      // Terminal screen flicker effect
      this.tweens.add({
        targets: terminal,
        alpha: { from: 0.9, to: 1 },
        duration: 100,
        yoyo: true,
        repeat: -1,
        repeatDelay: 2000 + Math.random() * 3000,
      });
    });

    // === ENERGY CORES (depth 3) - Ambient energy nodes ===
    const corePositions = [250, 550];
    corePositions.forEach((cx) => {
      const core = this.add.sprite(
        Math.round(cx * s),
        grassTop + Math.round(35 * s),
        "labs_prop_4"
      );
      core.setOrigin(0.5, 1);
      core.setDepth(3);
      this.labsElements.push(core);

      // Pulsing glow effect
      this.tweens.add({
        targets: core,
        scaleX: { from: 0.95, to: 1.05 },
        scaleY: { from: 0.95, to: 1.05 },
        alpha: { from: 0.8, to: 1 },
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });

    // === DRONE DOCKS (depth 3) ===
    const dronePositions = [680];
    dronePositions.forEach((dx) => {
      const drone = this.add.sprite(
        Math.round(dx * s),
        grassTop + Math.round(20 * s),
        "labs_prop_5"
      );
      drone.setOrigin(0.5, 1);
      drone.setDepth(3);
      this.labsElements.push(drone);

      // Subtle hover animation
      this.tweens.add({
        targets: drone,
        y: grassTop + Math.round(15 * s),
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });

    // === FLOOR GLOW EFFECT (depth 1) - Bags.FM green ambient lighting under HQ ===
    const hqGlow = this.add.ellipse(
      Math.round(420 * s),
      pathLevel + Math.round(5 * s),
      Math.round(160 * s),
      Math.round(30 * s),
      0x4ade80,
      0.2
    );
    hqGlow.setDepth(1);
    this.labsElements.push(hqGlow);

    // Pulsing glow effect
    this.tweens.add({
      targets: hqGlow,
      alpha: { from: 0.15, to: 0.25 },
      scaleX: { from: 0.95, to: 1.05 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  /**
   * Show Labs popup for building info
   */
  private showLabsPopup(type: string): void {
    // Reuse the founders popup system with labs-specific content
    // For now, dispatch a custom event that can be handled by UI
    window.dispatchEvent(new CustomEvent(`bagsworld-${type}-click`));
  }

  // ========================================
  // MOLTBOOK BEACH ZONE
  // Tropical paradise for AI agents (external agents spawn as crabs/lobsters)
  // ========================================

  private setupMoltbookZone(): void {
    // Hide park decorations and animals (they belong to main_city)
    this.decorations.forEach((d) => d.setVisible(false));
    this.animals.forEach((a) => a.sprite.setVisible(false));

    // Hide fountain water spray
    if (this.fountainWater) {
      this.fountainWater.setVisible(false);
    }

    // Hide other zone elements (prevents visual overlap)
    this.trendingElements.forEach((el) => (el as any).setVisible(false));
    this.skylineSprites.forEach((s) => s.setVisible(false));
    this.billboardTexts.forEach((t) => t.setVisible(false));
    if (this.tickerText) this.tickerText.setVisible(false);
    this.academyElements.forEach((el) => (el as any).setVisible(false));
    this.academyBuildings.forEach((s) => s.setVisible(false));
    this.ballersElements.forEach((el) => (el as any).setVisible(false));
    this.foundersElements.forEach((el) => (el as any).setVisible(false));
    this.labsElements.forEach((el) => (el as any).setVisible(false));
    this.arenaElements.forEach((el) => (el as any).setVisible(false));
    this.disconnectArenaWebSocket();
    if (this.foundersPopup) {
      this.foundersPopup.destroy();
      this.foundersPopup = null;
    }

    // Restore normal sky (beach has sunny tropical sky)
    this.restoreNormalSky();

    // Swap ground texture to beach sand
    this.ground.setVisible(true);
    this.ground.setTexture("beach_ground");

    // Check if elements were destroyed (can happen during transitions)
    const elementsValid =
      this.moltbookElements.length > 0 && this.moltbookElements.every((el) => (el as any).active !== false);

    if (!elementsValid && this.moltbookZoneCreated) {
      this.moltbookElements = [];
      this.moltbookZoneCreated = false;
    }

    // Only create elements once, then just show them
    if (!this.moltbookZoneCreated) {
      this.createMoltbookDecorations();
      this.moltbookZoneCreated = true;
    } else {
      // Subsequent times - just show existing elements
      this.moltbookElements.forEach((el) => (el as any).setVisible(true));
    }
  }

  /**
   * Create Moltbook Beach decorations - tropical paradise
   * Features palm trees, beach items, Moltbook HQ, and wave animation
   */
  private createMoltbookDecorations(): void {
    const s = SCALE;
    const grassTop = Math.round(455 * s);
    const pathLevel = Math.round(555 * s);

    // === PALM TREES (depth 2) - Multiple variants ===
    const palmPositions = [
      { x: 40, type: 1 },
      { x: 150, type: 2 },
      { x: 320, type: 3 },
      { x: 480, type: 1 },
      { x: 620, type: 2 },
      { x: 750, type: 3 },
    ];

    palmPositions.forEach((pos) => {
      const palm = this.add.sprite(Math.round(pos.x * s), grassTop, `palm_tree_${pos.type}`);
      palm.setOrigin(0.5, 1);
      palm.setDepth(2);
      palm.setScale(0.9 + Math.random() * 0.2);
      this.moltbookElements.push(palm);

      // Gentle swaying animation
      this.tweens.add({
        targets: palm,
        angle: { from: -2, to: 2 },
        duration: 3000 + Math.random() * 1000,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });

    // === BEACH UMBRELLAS (depth 3) ===
    const umbrellaPositions = [100, 280, 550, 700];
    umbrellaPositions.forEach((ux) => {
      const umbrella = this.add.sprite(Math.round(ux * s), grassTop + Math.round(30 * s), "beach_umbrella");
      umbrella.setOrigin(0.5, 1);
      umbrella.setDepth(3);
      umbrella.setScale(0.8 + Math.random() * 0.3);
      this.moltbookElements.push(umbrella);
    });

    // === BEACH CHAIRS (depth 3) - near umbrellas ===
    const chairPositions = [115, 265, 565];
    chairPositions.forEach((cx) => {
      const chair = this.add.sprite(Math.round(cx * s), grassTop + Math.round(35 * s), "beach_chair");
      chair.setOrigin(0.5, 1);
      chair.setDepth(3);
      this.moltbookElements.push(chair);
    });

    // === TIKI TORCHES (depth 3) - with flame flicker ===
    const torchPositions = [60, 200, 400, 580, 720];
    torchPositions.forEach((tx) => {
      const torch = this.add.sprite(Math.round(tx * s), grassTop + Math.round(25 * s), "beach_tiki_torch");
      torch.setOrigin(0.5, 1);
      torch.setDepth(3);
      this.moltbookElements.push(torch);

      // Flame flicker animation
      this.tweens.add({
        targets: torch,
        scaleX: { from: 0.95, to: 1.05 },
        scaleY: { from: 1.0, to: 1.05 },
        duration: 150 + Math.random() * 100,
        yoyo: true,
        repeat: -1,
      });
    });

    // === SURFBOARDS (depth 3) - stuck in sand ===
    const surfboardPositions = [180, 450, 680];
    surfboardPositions.forEach((sx) => {
      const board = this.add.sprite(Math.round(sx * s), grassTop + Math.round(20 * s), "beach_surfboard");
      board.setOrigin(0.5, 1);
      board.setDepth(3);
      board.setAngle(-10 + Math.random() * 20); // Slightly tilted
      this.moltbookElements.push(board);
    });

    // === SEASHELLS (depth 2) - scattered ===
    const shellPositions = [90, 230, 350, 520, 640, 760];
    shellPositions.forEach((shx) => {
      const shells = this.add.sprite(
        Math.round(shx * s),
        grassTop + Math.round(40 * s) + Math.random() * Math.round(15 * s),
        "beach_shells"
      );
      shells.setOrigin(0.5, 1);
      shells.setDepth(2);
      this.moltbookElements.push(shells);
    });

    // === SANDCASTLES (depth 3) ===
    const sandcastle1 = this.add.sprite(Math.round(340 * s), grassTop + Math.round(35 * s), "beach_sandcastle");
    sandcastle1.setOrigin(0.5, 1);
    sandcastle1.setDepth(3);
    this.moltbookElements.push(sandcastle1);

    const sandcastle2 = this.add.sprite(Math.round(600 * s), grassTop + Math.round(38 * s), "beach_sandcastle");
    sandcastle2.setOrigin(0.5, 1);
    sandcastle2.setDepth(3);
    sandcastle2.setScale(0.8);
    this.moltbookElements.push(sandcastle2);

    // === DRIFTWOOD (depth 2) ===
    const driftwood1 = this.add.sprite(Math.round(130 * s), grassTop + Math.round(45 * s), "beach_driftwood");
    driftwood1.setOrigin(0.5, 1);
    driftwood1.setDepth(2);
    this.moltbookElements.push(driftwood1);

    const driftwood2 = this.add.sprite(Math.round(500 * s), grassTop + Math.round(42 * s), "beach_driftwood");
    driftwood2.setOrigin(0.5, 1);
    driftwood2.setDepth(2);
    driftwood2.setFlipX(true);
    this.moltbookElements.push(driftwood2);

    // === CORAL CLUSTERS (depth 2) ===
    const coralPositions = [70, 250, 420, 590, 730];
    coralPositions.forEach((cx) => {
      const coral = this.add.sprite(Math.round(cx * s), grassTop + Math.round(50 * s), "beach_coral");
      coral.setOrigin(0.5, 1);
      coral.setDepth(2);
      coral.setScale(0.7 + Math.random() * 0.4);
      this.moltbookElements.push(coral);
    });

    // === MOLTBOOK HQ (depth 5) - Central lighthouse building ===
    const hqX = Math.round(400 * s); // Center of zone
    const moltbookHQ = this.add.sprite(hqX, pathLevel, "moltbook_hq");
    moltbookHQ.setOrigin(0.5, 1);
    moltbookHQ.setDepth(5);
    this.moltbookElements.push(moltbookHQ);

    // Make HQ interactive
    moltbookHQ.setInteractive({ useHandCursor: true });
    moltbookHQ.on("pointerdown", () => {
      window.open("https://moltbook.town", "_blank");
    });
    moltbookHQ.on("pointerover", () => {
      moltbookHQ.setTint(0xfff0e0); // Warm glow on hover
    });
    moltbookHQ.on("pointerout", () => {
      moltbookHQ.clearTint();
    });

    // HQ beacon glow animation
    this.tweens.add({
      targets: moltbookHQ,
      alpha: { from: 1, to: 0.9 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // === MOLTBOOK HQ LABEL ===
    const labelBg = this.add.rectangle(
      hqX,
      pathLevel - Math.round(150 * s),
      Math.round(120 * s),
      Math.round(24 * s),
      0x1a1a2e,
      0.9
    );
    labelBg.setDepth(6);
    this.moltbookElements.push(labelBg);

    const label = this.add.text(hqX, pathLevel - Math.round(150 * s), "MOLTBOOK HQ", {
      fontFamily: "monospace",
      fontSize: `${Math.round(12 * s)}px`,
      color: "#ef4444",
      align: "center",
    });
    label.setOrigin(0.5, 0.5);
    label.setDepth(6);
    this.moltbookElements.push(label);

    // === WAVE ANIMATION (depth 1) - at bottom of screen ===
    this.createWaveAnimation(s);

    // === SEAGULLS (depth 15) - flying overhead ===
    this.createSeagulls(s);
  }

  /**
   * Create animated wave effect at the bottom of the beach zone
   */
  private createWaveAnimation(s: number): void {
    const waveY = Math.round(580 * s);
    const waveWidth = GAME_WIDTH;

    // Create multiple wave layers for parallax effect
    const waveColors = [
      { color: 0x06b6d4, alpha: 0.4, speed: 2000, offset: 0 },
      { color: 0x0284c7, alpha: 0.3, speed: 2500, offset: Math.round(100 * s) },
      { color: 0x0369a1, alpha: 0.2, speed: 3000, offset: Math.round(200 * s) },
    ];

    waveColors.forEach((wave, i) => {
      const waveRect = this.add.rectangle(
        waveWidth / 2 + wave.offset,
        waveY + i * Math.round(3 * s),
        waveWidth + Math.round(400 * s),
        Math.round(8 * s),
        wave.color,
        wave.alpha
      );
      waveRect.setDepth(1);
      this.moltbookElements.push(waveRect);

      // Wave rolling animation
      this.tweens.add({
        targets: waveRect,
        x: { from: waveWidth / 2 + wave.offset, to: waveWidth / 2 + wave.offset - Math.round(100 * s) },
        duration: wave.speed,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });

    // Foam line at water's edge
    const foam = this.add.rectangle(
      waveWidth / 2,
      waveY - Math.round(5 * s),
      waveWidth,
      Math.round(4 * s),
      0xffffff,
      0.5
    );
    foam.setDepth(1);
    this.moltbookElements.push(foam);

    // Foam animation
    this.tweens.add({
      targets: foam,
      alpha: { from: 0.5, to: 0.2 },
      scaleX: { from: 1, to: 1.02 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  /**
   * Create flying seagulls for the beach atmosphere
   */
  private createSeagulls(s: number): void {
    // Create simple seagull shapes (white birds)
    const seagullCount = 4;

    for (let i = 0; i < seagullCount; i++) {
      const startX = Math.round((-100 + Math.random() * 200) * s);
      const startY = Math.round((80 + Math.random() * 100) * s);

      // Simple seagull (small white shape)
      const gull = this.add.graphics();
      gull.fillStyle(0xffffff, 0.9);
      // Bird shape (simple V for wings)
      gull.fillTriangle(0, 0, Math.round(-8 * s), Math.round(4 * s), Math.round(-4 * s), Math.round(2 * s));
      gull.fillTriangle(0, 0, Math.round(8 * s), Math.round(4 * s), Math.round(4 * s), Math.round(2 * s));
      gull.setPosition(startX, startY);
      gull.setDepth(15);
      this.moltbookElements.push(gull);

      // Flying animation - move across screen
      this.tweens.add({
        targets: gull,
        x: GAME_WIDTH + Math.round(100 * s),
        duration: 15000 + Math.random() * 10000,
        delay: i * 3000,
        repeat: -1,
        onRepeat: () => {
          gull.setPosition(Math.round(-100 * s), Math.round((60 + Math.random() * 120) * s));
        },
      });

      // Bobbing animation (simulates wing flapping)
      this.tweens.add({
        targets: gull,
        y: startY + Math.round(15 * s),
        duration: 800 + Math.random() * 400,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }

  /**
   * Get content for Founder's Corner popup based on building type
   * Real data from DexScreener marketplace & docs
   */
  private getFoundersPopupContent(type: string): { title: string; body: string; tip: string } {
    switch (type) {
      case "workshop":
        return {
          title: "DEXSCREENER ENHANCED INFO",
          body: `ORDER: marketplace.dexscreener.com/product/token-info
COST:  $299 (crypto or card)
TIME:  Usually <15 min, max 12 hours

WHAT YOU GET:
 + Custom logo & banner displayed
 + Social links shown to traders
 + Project description & roadmap
 + Locked wallets (fixes mcap)

CHECKLIST BEFORE ORDERING:
 [x] Token launched on DEX
 [x] Logo ready (square PNG/JPG)
 [x] Banner ready (3:1 ratio)
 [x] Website live (not "coming soon")
 [x] Twitter with posts
 [ ] TG/Discord (optional)

IMPORTANT: You need the wallet that
created the token to verify ownership.`,
          tip: "",
        };

      case "studio":
        return {
          title: "IMAGE SPECS (EXACT)",
          body: `TOKEN LOGO:
 Ratio:   1:1 (square)
 Size:    512x512px recommended
 Format:  PNG, JPG, WebP, GIF
 Style:   Simple, readable at 32px
 GOOD: Bold icon, 2-3 colors max
 BAD:  Detailed art, tiny text

TOKEN BANNER/HEADER:
 Ratio:   3:1 (wide rectangle)
 Size:    1500x500px (min 600x200)
 Format:  PNG, JPG, WebP, GIF
 GOOD: Token name, clean design
 BAD:  Walls of text, busy BGs

FREE TOOLS:
 canva.com     - templates
 remove.bg     - transparent bg
 tinypng.com   - compress files`,
          tip: "Twitter header = DexScreener banner (same ratio)!",
        };

      case "social":
        return {
          title: "SOCIALS SETUP GUIDE",
          body: `REQUIRED BY DEXSCREENER:

1. WEBSITE (must be live)
   Use Carrd.co for free 1-pager
   Include: about, tokenomics, links
   NO "coming soon" pages

2. TWITTER/X (must have posts)
   Pin a tweet about your token
   Post chart + CA on launch day

OPTIONAL BUT RECOMMENDED:

3. TELEGRAM GROUP
   Create BEFORE launch
   Pin: CA, chart link, rules

4. DISCORD
   Only if long-term project
   Overkill for memecoins

BAGS.FM TIP:
Your creator page works as website!
Use: bags.fm/[yourname]`,
          tip: "Set up TG BEFORE launch, not after!",
        };

      default:
        return {
          title: "FOUNDER'S CORNER",
          body: "Click a building to learn more!",
          tip: "Each building = one step in the process.",
        };
    }
  }

  // Handle AI behavior commands for characters
  private handleBehaviorCommand(event: CustomEvent): void {
    const command = event.detail;
    if (!command || !command.characterId) return;

    const characterId = command.characterId;
    let targetX: number | undefined;
    let targetY: number | undefined;

    // Determine target position based on command
    if (command.target) {
      if (command.target.type === "position" && command.target.x !== undefined) {
        targetX = command.target.x;
        targetY = command.target.y || Math.round(570 * SCALE);
      } else if (command.target.type === "character" && command.target.id) {
        // Find target character's position
        const targetSprite = this.findCharacterSprite(command.target.id);
        if (targetSprite) {
          // Move near the character, not exactly on top
          const offset = (Math.random() - 0.5) * 100;
          targetX = targetSprite.x + offset;
          targetY = targetSprite.y + (Math.random() - 0.5) * 30;
        }
      } else if (command.target.type === "building" && command.target.id) {
        // Find building position
        const building = this.buildingSprites.get(command.target.id);
        if (building) {
          targetX = building.x + (Math.random() - 0.5) * 80;
          targetY = Math.round(580 * SCALE); // Stay on path
        }
      }
    }

    // If we have a valid target, store it
    if (targetX !== undefined && targetY !== undefined) {
      // Clamp to valid bounds
      targetX = Math.max(100, Math.min(1180, targetX));
      targetY = Math.max(Math.round(450 * SCALE), Math.min(Math.round(620 * SCALE), targetY));

      this.characterTargets.set(characterId, {
        x: targetX,
        y: targetY,
        action: command.action || "moveTo",
      });
    } else if (command.action === "idle" || command.action === "observe") {
      // Clear target for idle/observe
      this.characterTargets.delete(characterId);
    }
  }

  // Find a character sprite by character ID (handles special character naming)
  private findCharacterSprite(characterId: string): Phaser.GameObjects.Sprite | null {
    // Direct lookup
    const direct = this.characterSprites.get(characterId);
    if (direct) return direct;

    // Search by special character flags
    for (const [, sprite] of this.characterSprites) {
      const spriteData = sprite as any;
      // Core characters
      if (characterId === "finn" && spriteData.isFinn) return sprite;
      if (characterId === "ghost" && spriteData.isDev) return sprite;
      if (characterId === "neo" && spriteData.isScout) return sprite;
      if (characterId === "ash" && spriteData.isAsh) return sprite;
      if (characterId === "toly" && spriteData.isToly) return sprite;
      if (characterId === "cj" && spriteData.isCJ) return sprite;
      if (characterId === "shaw" && spriteData.isShaw) return sprite;
      // Academy Zone - Bags.fm Team
      if (characterId === "ramo" && spriteData.isRamo) return sprite;
      if (characterId === "sincara" && spriteData.isSincara) return sprite;
      if (characterId === "stuu" && spriteData.isStuu) return sprite;
      if (characterId === "sam" && spriteData.isSam) return sprite;
      if (characterId === "alaa" && spriteData.isAlaa) return sprite;
      if (characterId === "carlo" && spriteData.isCarlo) return sprite;
      if (characterId === "bnn" && spriteData.isBNN) return sprite;
      // Founder's Corner Zone
      if (characterId === "professorOak" && spriteData.isProfessorOak) return sprite;
      // Mascots
      if (characterId === "bagsy" && spriteData.isBagsy) return sprite;
    }

    return null;
  }

  // Public method to get character sprite (for agent bridge)
  getCharacterSprite(characterId: string): Phaser.GameObjects.Sprite | null {
    return this.findCharacterSprite(characterId);
  }

  // Map a character to their behavior system ID
  private getCharacterBehaviorId(character: GameCharacter): string {
    // Core characters
    if (character.isFinn) return "finn";
    if (character.isDev) return "ghost";
    if (character.isScout) return "neo";
    if (character.isAsh) return "ash";
    if (character.isToly) return "toly";
    if (character.isCJ) return "cj";
    if (character.isShaw) return "shaw";
    // Academy Zone - Bags.fm Team
    if (character.isRamo) return "ramo";
    if (character.isSincara) return "sincara";
    if (character.isStuu) return "stuu";
    if (character.isSam) return "sam";
    if (character.isAlaa) return "alaa";
    if (character.isCarlo) return "carlo";
    if (character.isBNN) return "bnn";
    // Founder's Corner Zone
    if (character.isProfessorOak) return "professorOak";
    // Mascots
    if (character.isBagsy) return "bagsy";
    return character.id;
  }

  // Update glow sprite positions when character moves
  private updateCharacterGlow(sprite: Phaser.GameObjects.Sprite, character: GameCharacter): void {
    const spriteData = sprite as any;

    // Update glow position to follow sprite
    if (character.isToly && spriteData.tolyGlow) {
      spriteData.tolyGlow.x = sprite.x;
      spriteData.tolyGlow.y = sprite.y;
    }
    if (character.isAsh && spriteData.ashGlow) {
      spriteData.ashGlow.x = sprite.x;
      spriteData.ashGlow.y = sprite.y;
    }
    if (character.isFinn && spriteData.finnGlow) {
      spriteData.finnGlow.x = sprite.x;
      spriteData.finnGlow.y = sprite.y;
    }
    if (character.isDev && spriteData.devGlow) {
      spriteData.devGlow.x = sprite.x;
      spriteData.devGlow.y = sprite.y;
    }
    if (character.isScout && spriteData.scoutGlow) {
      spriteData.scoutGlow.x = sprite.x;
      spriteData.scoutGlow.y = sprite.y;
    }
    if (character.isCJ && spriteData.cjGlow) {
      spriteData.cjGlow.x = sprite.x;
      spriteData.cjGlow.y = sprite.y;
    }
    if (character.isShaw && spriteData.shawGlow) {
      spriteData.shawGlow.x = sprite.x;
      spriteData.shawGlow.y = sprite.y;
    }
    // Academy Zone - Bags.fm Team
    if (character.isRamo && spriteData.ramoGlow) {
      spriteData.ramoGlow.x = sprite.x;
      spriteData.ramoGlow.y = sprite.y;
    }
    if (character.isSincara && spriteData.sincaraGlow) {
      spriteData.sincaraGlow.x = sprite.x;
      spriteData.sincaraGlow.y = sprite.y;
    }
    if (character.isStuu && spriteData.stuuGlow) {
      spriteData.stuuGlow.x = sprite.x;
      spriteData.stuuGlow.y = sprite.y;
    }
    if (character.isSam && spriteData.samGlow) {
      spriteData.samGlow.x = sprite.x;
      spriteData.samGlow.y = sprite.y;
    }
    if (character.isAlaa && spriteData.alaaGlow) {
      spriteData.alaaGlow.x = sprite.x;
      spriteData.alaaGlow.y = sprite.y;
    }
    if (character.isCarlo && spriteData.carloGlow) {
      spriteData.carloGlow.x = sprite.x;
      spriteData.carloGlow.y = sprite.y;
    }
    if (character.isBNN && spriteData.bnnGlow) {
      spriteData.bnnGlow.x = sprite.x;
      spriteData.bnnGlow.y = sprite.y;
    }
    // Founder's Corner characters
    if (character.isProfessorOak && spriteData.professorOakGlow) {
      spriteData.professorOakGlow.x = sprite.x;
      spriteData.professorOakGlow.y = sprite.y;
    }
    // Mascots
    if (character.isBagsy && spriteData.bagsyGlow) {
      spriteData.bagsyGlow.x = sprite.x;
      spriteData.bagsyGlow.y = sprite.y;
    }
    // External agents (OpenClaws)
    if (character.id.startsWith("external-") && spriteData.openClawGlow) {
      spriteData.openClawGlow.x = sprite.x;
      spriteData.openClawGlow.y = sprite.y;
    }
  }

  // Handle character speak events (from AI behavior)
  private handleCharacterSpeak(event: CustomEvent): void {
    const { characterId, message, emotion } = event.detail;
    if (!characterId || !message || !this.speechBubbleManager) return;

    // Don't interrupt autonomous dialogue conversations
    const activeConversation = getActiveConversation();
    if (activeConversation?.isActive) return;

    // Create a dialogue line and show bubble
    const line = {
      characterId,
      characterName: characterId,
      message,
      timestamp: Date.now(),
      emotion: emotion || "neutral",
    };

    this.speechBubbleManager.showBubble(line);
  }

  // Update speech bubbles for autonomous dialogue
  private updateDialogueBubbles(): void {
    if (!this.speechBubbleManager) return;

    // Update bubble positions to follow characters
    this.speechBubbleManager.update();

    // Check for current dialogue line
    const currentLine = getCurrentLine();

    if (currentLine) {
      // Create a unique ID for this line
      const lineId = `${currentLine.characterId}-${currentLine.timestamp}-${currentLine.message.slice(0, 20)}`;

      // Only show if it's a new line
      if (lineId !== this.lastDialogueLine) {
        this.lastDialogueLine = lineId;

        // Update character sprites reference (in case they changed)
        this.speechBubbleManager.setCharacterSprites(this.characterSprites);

        // Show the speech bubble
        this.speechBubbleManager.showBubble(currentLine);
      }
    }
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
    if (this.boundPrevTrack) {
      window.removeEventListener("bagsworld-prev-track", this.boundPrevTrack);
      this.boundPrevTrack = null;
    }
    if (this.boundBotEffect) {
      window.removeEventListener("bagsworld-bot-effect", this.boundBotEffect);
      this.boundBotEffect = null;
    }
    if (this.boundBotAnimal) {
      window.removeEventListener("bagsworld-bot-animal", this.boundBotAnimal);
      this.boundBotAnimal = null;
    }
    if (this.boundBotPokemon) {
      window.removeEventListener("bagsworld-bot-pokemon", this.boundBotPokemon);
      this.boundBotPokemon = null;
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
      this.stopAllOscillators();
      if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
      }
      this.audioContext.close();
      this.audioContext = null;
    }

    // Clean up zone-specific timers
    if (this.tickerTimer) {
      this.tickerTimer.destroy();
      this.tickerTimer = null;
    }
    if (this.billboardTimer) {
      this.billboardTimer.destroy();
      this.billboardTimer = null;
    }
    this.clearTrafficTimers();

    // Clean up speech bubble manager
    if (this.speechBubbleManager) {
      this.speechBubbleManager.destroy();
      this.speechBubbleManager = null;
    }

    // Clean up behavior handlers
    if (this.boundBehaviorHandler) {
      window.removeEventListener("bagsworld-character-behavior", this.boundBehaviorHandler);
      this.boundBehaviorHandler = null;
    }
    if (this.boundSpeakHandler) {
      window.removeEventListener("bagsworld-character-speak", this.boundSpeakHandler);
      this.boundSpeakHandler = null;
    }
    this.characterTargets.clear();
  }

  private createGround(): void {
    // Main grass layer - positioned to fill bottom portion of screen
    const groundY = Math.round(540 * SCALE); // Moved down slightly
    const groundHeight = Math.round(180 * SCALE); // Taller to ensure full coverage
    this.ground = this.add.tileSprite(GAME_WIDTH / 2, groundY, GAME_WIDTH, groundHeight, "grass");
    this.ground.setDepth(0);

    // Add path in the middle
    const pathY = Math.round(570 * SCALE);
    const path = this.add.tileSprite(
      GAME_WIDTH / 2,
      pathY,
      GAME_WIDTH,
      Math.round(40 * SCALE),
      "path"
    );
    path.setDepth(1);

    // Subtle transition gradient above grass (replaces harsh grass_dark border)
    const transitionGradient = this.add.graphics();
    transitionGradient.setDepth(-0.5);
    // Create a soft fade from sky color to grass area
    transitionGradient.fillGradientStyle(
      0x87ceeb,
      0x87ceeb, // Sky blue top
      0x228b22,
      0x228b22, // Forest green bottom (matches grass)
      0,
      0,
      0.3,
      0.3 // Alpha: transparent top, slightly visible bottom
    );
    transitionGradient.fillRect(0, Math.round(430 * SCALE), GAME_WIDTH, Math.round(30 * SCALE));
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
    for (let i = 0; i < Math.round(50 * SCALE); i++) {
      const star = this.add.circle(
        Math.random() * GAME_WIDTH,
        Math.random() * Math.round(300 * SCALE),
        Math.random() * 1.5 * SCALE + 0.5 * SCALE,
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
    this.skyGradient.fillRect(0, 0, GAME_WIDTH, Math.round(430 * SCALE));
  }

  private updateSkyForTime(timeInfo: { isNight: boolean; isDusk: boolean; isDawn: boolean }): void {
    // Don't update sky if we're in Ballers Valley (always golden hour there)
    if (this.currentZone === "ballers") {
      return;
    }

    const isNightOrDusk = timeInfo.isNight || timeInfo.isDusk;

    // Update sky gradient
    this.drawSkyGradient(isNightOrDusk);

    // Show/hide stars
    const targetAlpha = isNightOrDusk ? 0.5 : 0;
    this.stars.forEach((star) => {
      this.tweens.add({
        targets: star,
        alpha: targetAlpha,
        duration: 2000,
        ease: "Sine.easeInOut",
      });
    });
  }

  /**
   * Draw the golden hour (sunset) sky for Ballers Valley
   * Creates a warm orange-to-peach gradient that gives the VIP zone
   * an exclusive, luxurious feel - always sunset, never changes
   */
  private drawBallersGoldenSky(): void {
    // Create the golden sky graphics object if it doesn't exist
    if (!this.ballersGoldenSky) {
      this.ballersGoldenSky = this.add.graphics();
      this.ballersGoldenSky.setDepth(-2); // Same depth as main sky
      this.ballersElements.push(this.ballersGoldenSky);
    }

    this.ballersGoldenSky.clear();

    // Golden hour sunset gradient - warm orange top to soft peach bottom
    // Top colors (warm orange)
    const topLeft = 0xf97316; // Tailwind orange-500
    const topRight = 0xfb923c; // Tailwind orange-400
    // Bottom colors (soft peach/gold)
    const bottomLeft = 0xfed7aa; // Tailwind orange-200
    const bottomRight = 0xfcd34d; // Tailwind amber-300

    this.ballersGoldenSky.fillGradientStyle(
      topLeft,
      topRight,
      bottomLeft,
      bottomRight,
      1 // Full opacity
    );
    this.ballersGoldenSky.fillRect(0, 0, GAME_WIDTH, Math.round(430 * SCALE));
    this.ballersGoldenSky.setVisible(true);

    // Hide the main sky gradient when showing golden sky
    if (this.skyGradient) {
      this.skyGradient.setVisible(false);
    }

    // Dim stars in golden hour (sunset still has some stars starting to show)
    this.stars.forEach((star) => {
      this.tweens.add({
        targets: star,
        alpha: 0.15, // Very faint stars
        duration: 500,
        ease: "Sine.easeInOut",
      });
    });
  }

  /**
   * Restore the normal sky when leaving Ballers Valley
   * Shows the main sky gradient and updates it based on current time
   */
  private restoreNormalSky(): void {
    // Hide the golden sky
    if (this.ballersGoldenSky) {
      this.ballersGoldenSky.setVisible(false);
    }

    // Hide the academy twilight sky
    if (this.academyTwilightSky) {
      this.academyTwilightSky.setVisible(false);
    }
    if (this.academyMoon) {
      this.academyMoon.setVisible(false);
    }
    this.academyStars.forEach((star) => star.setVisible(false));

    // Show the main sky gradient
    if (this.skyGradient) {
      this.skyGradient.setVisible(true);
    }

    // Stars will be updated on next time update cycle
  }

  /**
   * Draw the magical twilight sky for Academy zone
   * Creates a mystical purple-to-indigo gradient that gives the Academy
   * a Hogwarts-like magical atmosphere - always twilight, with bright stars and moon
   */
  private drawAcademyTwilightSky(): void {
    // Create the twilight sky graphics object if it doesn't exist
    if (!this.academyTwilightSky) {
      this.academyTwilightSky = this.add.graphics();
      this.academyTwilightSky.setDepth(-2);
      this.academyElements.push(this.academyTwilightSky);
    }

    this.academyTwilightSky.clear();

    // Magical twilight gradient - deep purple top to mystical indigo bottom
    // Top colors (deep space purple)
    const topLeft = 0x1e1b4b; // Very dark indigo
    const topRight = 0x312e81; // Deep indigo
    // Bottom colors (twilight purple-blue)
    const bottomLeft = 0x4c1d95; // Violet-purple
    const bottomRight = 0x5b21b6; // Rich purple

    this.academyTwilightSky.fillGradientStyle(topLeft, topRight, bottomLeft, bottomRight, 1);
    this.academyTwilightSky.fillRect(0, 0, GAME_WIDTH, Math.round(430 * SCALE));
    this.academyTwilightSky.setVisible(true);

    // Hide the main sky gradient when showing twilight sky
    if (this.skyGradient) {
      this.skyGradient.setVisible(false);
    }
    if (this.ballersGoldenSky) {
      this.ballersGoldenSky.setVisible(false);
    }

    // Create crescent moon if it doesn't exist
    if (!this.academyMoon) {
      const moonX = GAME_WIDTH - Math.round(120 * SCALE);
      const moonY = Math.round(80 * SCALE);
      const moonRadius = Math.round(35 * SCALE);

      // Main moon glow (outer)
      const moonGlow = this.add.circle(
        moonX,
        moonY,
        moonRadius + Math.round(15 * SCALE),
        0xfef3c7,
        0.15
      );
      moonGlow.setDepth(-1.9);
      this.academyElements.push(moonGlow);

      // Moon body
      this.academyMoon = this.add.circle(moonX, moonY, moonRadius, 0xfef9c3); // Pale yellow
      this.academyMoon.setDepth(-1.8);
      this.academyElements.push(this.academyMoon);

      // Crescent shadow (to make it look like crescent moon)
      const crescentShadow = this.add.circle(
        moonX + Math.round(12 * SCALE),
        moonY - Math.round(5 * SCALE),
        moonRadius - Math.round(5 * SCALE),
        0x1e1b4b // Same as sky top color
      );
      crescentShadow.setDepth(-1.7);
      this.academyElements.push(crescentShadow);

      // Subtle moon surface details
      const crater1 = this.add.circle(
        moonX - Math.round(8 * SCALE),
        moonY + Math.round(5 * SCALE),
        Math.round(4 * SCALE),
        0xfde68a,
        0.3
      );
      crater1.setDepth(-1.75);
      this.academyElements.push(crater1);

      const crater2 = this.add.circle(
        moonX - Math.round(12 * SCALE),
        moonY - Math.round(8 * SCALE),
        Math.round(3 * SCALE),
        0xfde68a,
        0.25
      );
      crater2.setDepth(-1.75);
      this.academyElements.push(crater2);

      // Add gentle pulsing glow animation to moon
      this.tweens.add({
        targets: moonGlow,
        alpha: 0.25,
        duration: 3000,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
    this.academyMoon.setVisible(true);

    // Create extra bright stars for Academy if they don't exist
    if (this.academyStars.length === 0) {
      // Bright constellation stars
      const starPositions = [
        { x: 100, y: 50, size: 3, alpha: 0.9 },
        { x: 180, y: 120, size: 2.5, alpha: 0.85 },
        { x: 250, y: 70, size: 2, alpha: 0.8 },
        { x: 320, y: 150, size: 2.5, alpha: 0.85 },
        { x: 400, y: 60, size: 3, alpha: 0.9 },
        { x: 480, y: 130, size: 2, alpha: 0.8 },
        { x: 550, y: 80, size: 2.5, alpha: 0.85 },
        { x: 620, y: 140, size: 2, alpha: 0.8 },
        { x: 700, y: 55, size: 3, alpha: 0.9 },
        { x: 760, y: 110, size: 2.5, alpha: 0.85 },
        { x: 150, y: 180, size: 2, alpha: 0.75 },
        { x: 350, y: 200, size: 2, alpha: 0.75 },
        { x: 580, y: 190, size: 2, alpha: 0.75 },
        { x: 220, y: 30, size: 2.5, alpha: 0.85 },
        { x: 450, y: 25, size: 2, alpha: 0.8 },
        { x: 680, y: 35, size: 2.5, alpha: 0.85 },
      ];

      starPositions.forEach((pos) => {
        const star = this.add.circle(
          Math.round(pos.x * SCALE),
          Math.round(pos.y * SCALE),
          Math.round(pos.size * SCALE),
          0xffffff,
          pos.alpha
        );
        star.setDepth(-1.5);
        this.academyStars.push(star);
        this.academyElements.push(star);

        // Add twinkling animation with varying speeds
        this.tweens.add({
          targets: star,
          alpha: pos.alpha * 0.4,
          duration: 800 + Math.random() * 1500,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      });

      // Add some smaller background stars
      for (let i = 0; i < 40; i++) {
        const star = this.add.circle(
          Math.random() * GAME_WIDTH,
          Math.random() * Math.round(250 * SCALE),
          Math.round((0.8 + Math.random() * 1.2) * SCALE),
          0xc4b5fd, // Soft purple-white stars
          0.4 + Math.random() * 0.3
        );
        star.setDepth(-1.6);
        this.academyStars.push(star);
        this.academyElements.push(star);

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

    // Show all academy stars
    this.academyStars.forEach((star) => star.setVisible(true));

    // Dim main stars in twilight
    this.stars.forEach((star) => {
      this.tweens.add({
        targets: star,
        alpha: 0.1,
        duration: 500,
        ease: "Sine.easeInOut",
      });
    });
  }

  private createDistantSkyline(): void {
    const skyline = this.add.graphics();
    skyline.setDepth(-1.5);

    // Ground level where buildings should extend to (just above the grass)
    const groundLevel = Math.round(440 * SCALE);

    // Subtle dark silhouette color
    const silhouetteColor = 0x1a2535;

    // Draw distant buildings - heights calculated from top to groundLevel
    skyline.fillStyle(silhouetteColor, 0.5);

    // Helper function to draw building from top to ground
    const drawBuilding = (x: number, topY: number, width: number) => {
      const height = groundLevel - topY;
      skyline.fillRect(x, topY, width, height);
    };

    // Left cluster (shorter buildings on edges)
    drawBuilding(Math.round(15 * SCALE), Math.round(380 * SCALE), Math.round(18 * SCALE));
    drawBuilding(Math.round(38 * SCALE), Math.round(360 * SCALE), Math.round(22 * SCALE));
    drawBuilding(Math.round(65 * SCALE), Math.round(375 * SCALE), Math.round(16 * SCALE));
    drawBuilding(Math.round(88 * SCALE), Math.round(355 * SCALE), Math.round(20 * SCALE));
    drawBuilding(Math.round(115 * SCALE), Math.round(370 * SCALE), Math.round(18 * SCALE));

    // Center-left cluster
    drawBuilding(Math.round(165 * SCALE), Math.round(350 * SCALE), Math.round(20 * SCALE));
    drawBuilding(Math.round(192 * SCALE), Math.round(330 * SCALE), Math.round(28 * SCALE));
    drawBuilding(Math.round(228 * SCALE), Math.round(355 * SCALE), Math.round(18 * SCALE));
    drawBuilding(Math.round(253 * SCALE), Math.round(340 * SCALE), Math.round(24 * SCALE));

    // Center cluster (tallest - focal point)
    drawBuilding(Math.round(320 * SCALE), Math.round(310 * SCALE), Math.round(26 * SCALE));
    drawBuilding(Math.round(355 * SCALE), Math.round(280 * SCALE), Math.round(35 * SCALE)); // Tallest
    drawBuilding(Math.round(400 * SCALE), Math.round(295 * SCALE), Math.round(30 * SCALE));
    drawBuilding(Math.round(440 * SCALE), Math.round(320 * SCALE), Math.round(22 * SCALE));
    drawBuilding(Math.round(470 * SCALE), Math.round(345 * SCALE), Math.round(18 * SCALE));

    // Center-right cluster
    drawBuilding(Math.round(525 * SCALE), Math.round(355 * SCALE), Math.round(20 * SCALE));
    drawBuilding(Math.round(555 * SCALE), Math.round(335 * SCALE), Math.round(26 * SCALE));
    drawBuilding(Math.round(590 * SCALE), Math.round(360 * SCALE), Math.round(18 * SCALE));

    // Right cluster
    drawBuilding(Math.round(645 * SCALE), Math.round(350 * SCALE), Math.round(20 * SCALE));
    drawBuilding(Math.round(675 * SCALE), Math.round(330 * SCALE), Math.round(28 * SCALE));
    drawBuilding(Math.round(712 * SCALE), Math.round(355 * SCALE), Math.round(22 * SCALE));
    drawBuilding(Math.round(742 * SCALE), Math.round(340 * SCALE), Math.round(24 * SCALE));
    drawBuilding(Math.round(775 * SCALE), Math.round(365 * SCALE), Math.round(20 * SCALE));

    // Add subtle window lights (very sparse and dim)
    const windowColor = 0xffd700;
    skyline.fillStyle(windowColor, 0.2);

    // A few random lit windows
    const windowPositions = [
      {
        x: Math.round(198 * SCALE),
        y: Math.round(350 * SCALE),
        w: Math.round(4 * SCALE),
        h: Math.round(5 * SCALE),
      },
      {
        x: Math.round(198 * SCALE),
        y: Math.round(370 * SCALE),
        w: Math.round(4 * SCALE),
        h: Math.round(5 * SCALE),
      },
      {
        x: Math.round(362 * SCALE),
        y: Math.round(310 * SCALE),
        w: Math.round(5 * SCALE),
        h: Math.round(6 * SCALE),
      },
      {
        x: Math.round(370 * SCALE),
        y: Math.round(340 * SCALE),
        w: Math.round(5 * SCALE),
        h: Math.round(6 * SCALE),
      },
      {
        x: Math.round(370 * SCALE),
        y: Math.round(380 * SCALE),
        w: Math.round(5 * SCALE),
        h: Math.round(6 * SCALE),
      },
      {
        x: Math.round(408 * SCALE),
        y: Math.round(330 * SCALE),
        w: Math.round(4 * SCALE),
        h: Math.round(5 * SCALE),
      },
      {
        x: Math.round(562 * SCALE),
        y: Math.round(360 * SCALE),
        w: Math.round(4 * SCALE),
        h: Math.round(5 * SCALE),
      },
      {
        x: Math.round(682 * SCALE),
        y: Math.round(355 * SCALE),
        w: Math.round(4 * SCALE),
        h: Math.round(5 * SCALE),
      },
      {
        x: Math.round(682 * SCALE),
        y: Math.round(385 * SCALE),
        w: Math.round(4 * SCALE),
        h: Math.round(5 * SCALE),
      },
    ];

    for (const win of windowPositions) {
      skyline.fillRect(win.x, win.y, win.w, win.h);
    }
  }

  private createDecorations(): void {
    // Ground reference for positioning (top of grass area)
    const grassTop = Math.round(455 * SCALE);
    const pathLevel = Math.round(555 * SCALE);

    // Add trees (positioned at grass top level)
    const treePositions = [
      { x: Math.round(50 * SCALE), y: grassTop },
      { x: Math.round(750 * SCALE), y: grassTop - Math.round(5 * SCALE) },
      { x: Math.round(180 * SCALE), y: grassTop + Math.round(10 * SCALE) },
      { x: Math.round(620 * SCALE), y: grassTop + Math.round(5 * SCALE) },
    ];

    treePositions.forEach((pos, i) => {
      const tree = this.add.sprite(pos.x, pos.y, "tree");
      tree.setOrigin(0.5, 1);
      tree.setDepth(2);
      tree.setScale((0.9 + Math.random() * 0.3) * SCALE);
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

    // Add bushes (positioned on grass)
    const bushPositions = [
      { x: Math.round(100 * SCALE), y: grassTop + Math.round(25 * SCALE) },
      { x: Math.round(300 * SCALE), y: grassTop + Math.round(20 * SCALE) },
      { x: Math.round(500 * SCALE), y: grassTop + Math.round(23 * SCALE) },
      { x: Math.round(700 * SCALE), y: grassTop + Math.round(21 * SCALE) },
    ];

    bushPositions.forEach((pos) => {
      const bush = this.add.sprite(pos.x, pos.y, "bush");
      bush.setOrigin(0.5, 1);
      bush.setDepth(2);
      bush.setScale((0.7 + Math.random() * 0.3) * SCALE);
      this.decorations.push(bush);
    });

    // Add lamp posts (positioned near path)
    const lampPositions = [
      { x: Math.round(200 * SCALE), y: pathLevel },
      { x: Math.round(600 * SCALE), y: pathLevel },
    ];

    lampPositions.forEach((pos) => {
      const lamp = this.add.sprite(pos.x, pos.y, "lamp");
      lamp.setOrigin(0.5, 1);
      lamp.setDepth(3);
      this.decorations.push(lamp);

      // Add light glow (scaled)
      const glow = this.add.sprite(pos.x, pos.y - Math.round(30 * SCALE), "glow");
      glow.setAlpha(0.3);
      glow.setScale(0.8 * SCALE);
      glow.setDepth(2);
      glow.setTint(0xfbbf24);

      this.tweens.add({
        targets: glow,
        alpha: 0.5,
        scale: 0.9 * SCALE,
        duration: 1500,
        yoyo: true,
        repeat: -1,
      });
    });

    // Add benches (positioned near path)
    const benchPositions = [
      { x: Math.round(350 * SCALE), y: pathLevel - Math.round(5 * SCALE) },
      { x: Math.round(450 * SCALE), y: pathLevel - Math.round(5 * SCALE) },
    ];

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
        Math.random() * GAME_WIDTH * 1.1 - Math.round(50 * SCALE),
        Math.round(30 * SCALE) + Math.random() * Math.round(120 * SCALE),
        "cloud"
      );
      cloud.setAlpha(0.5 + Math.random() * 0.3);
      cloud.setScale((0.6 + Math.random() * 0.5) * SCALE);
      cloud.setDepth(1);
      this.clouds.push(cloud);
    }
  }

  private createAnimals(): void {
    const animalTypes: Animal["type"][] = ["dog", "cat", "bird", "butterfly", "squirrel"];

    // Reference positions
    const pathLevel = Math.round(555 * SCALE);
    const grassTop = Math.round(455 * SCALE);

    // Create a variety of animals (positioned relative to ground)
    const animalConfigs = [
      {
        type: "dog" as const,
        x: Math.round(150 * SCALE),
        y: pathLevel + Math.round(10 * SCALE),
        scale: 1.2 * SCALE,
      },
      {
        type: "cat" as const,
        x: Math.round(650 * SCALE),
        y: pathLevel + Math.round(10 * SCALE),
        scale: 1.1 * SCALE,
      },
      {
        type: "bird" as const,
        x: Math.round(100 * SCALE),
        y: grassTop - Math.round(20 * SCALE),
        scale: 0.8 * SCALE,
      },
      {
        type: "bird" as const,
        x: Math.round(700 * SCALE),
        y: grassTop - Math.round(10 * SCALE),
        scale: 0.7 * SCALE,
      },
      {
        type: "butterfly" as const,
        x: Math.round(300 * SCALE),
        y: grassTop - Math.round(30 * SCALE),
        scale: 0.6 * SCALE,
      },
      {
        type: "butterfly" as const,
        x: Math.round(500 * SCALE),
        y: grassTop - Math.round(40 * SCALE),
        scale: 0.5 * SCALE,
      },
      {
        type: "squirrel" as const,
        x: Math.round(80 * SCALE),
        y: grassTop + Math.round(20 * SCALE),
        scale: 1.0 * SCALE,
      },
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
        targetX: config.x + (Math.random() * Math.round(200 * SCALE) - Math.round(100 * SCALE)),
        speed:
          config.type === "butterfly"
            ? 0.3 * SCALE
            : config.type === "bird"
              ? 0.5 * SCALE
              : 0.2 * SCALE,
        direction: Math.random() > 0.5 ? "left" : "right",
        idleTimer: 0,
        isIdle: Math.random() > 0.5,
      };

      this.animals.push(animal);

      // Add idle animation for ground animals (scaled movement)
      if (config.type !== "bird" && config.type !== "butterfly") {
        this.tweens.add({
          targets: sprite,
          y: config.y - Math.round(2 * SCALE),
          duration: 500 + Math.random() * 300,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }

      // Flying animation for birds and butterflies (scaled movement)
      if (config.type === "bird") {
        this.tweens.add({
          targets: sprite,
          y: config.y - Math.round(15 * SCALE),
          duration: 800 + Math.random() * 400,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }

      if (config.type === "butterfly") {
        this.tweens.add({
          targets: sprite,
          y: config.y - Math.round(20 * SCALE),
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
    // Reference positions
    const grassTop = Math.round(455 * SCALE);
    const pathLevel = Math.round(555 * SCALE);

    // Add flower patches (positioned on grass)
    const flowerPositions = [
      { x: Math.round(130 * SCALE), y: grassTop + Math.round(35 * SCALE) },
      { x: Math.round(280 * SCALE), y: grassTop + Math.round(30 * SCALE) },
      { x: Math.round(420 * SCALE), y: grassTop + Math.round(33 * SCALE) },
      { x: Math.round(560 * SCALE), y: grassTop + Math.round(27 * SCALE) },
      { x: Math.round(680 * SCALE), y: grassTop + Math.round(31 * SCALE) },
    ];

    flowerPositions.forEach((pos) => {
      const flower = this.add.sprite(pos.x, pos.y, "flower");
      flower.setOrigin(0.5, 1);
      flower.setDepth(2);
      flower.setScale((0.8 + Math.random() * 0.4) * SCALE);
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

    // Add rocks (positioned near path)
    const rockPositions = [
      { x: Math.round(70 * SCALE), y: pathLevel + Math.round(5 * SCALE) },
      { x: Math.round(730 * SCALE), y: pathLevel + Math.round(2 * SCALE) },
      { x: Math.round(380 * SCALE), y: pathLevel + Math.round(8 * SCALE) },
    ];

    rockPositions.forEach((pos) => {
      const rock = this.add.sprite(pos.x, pos.y, "rock");
      rock.setOrigin(0.5, 1);
      rock.setDepth(2);
      rock.setScale((0.6 + Math.random() * 0.3) * SCALE);
      this.decorations.push(rock);
    });

    // Add fountain in center of park (above the path)
    const fountainY = grassTop + Math.round(30 * SCALE);
    const fountainX = GAME_WIDTH / 2;
    const fountain = this.add.sprite(fountainX, fountainY, "fountain");
    fountain.setOrigin(0.5, 1);
    fountain.setDepth(2);
    fountain.setScale(SCALE);
    this.decorations.push(fountain);

    // Water spray particles - aligned with fountain top
    this.fountainWater = this.add.particles(fountainX, fountainY - Math.round(35 * SCALE), "rain", {
      speed: { min: Math.round(30 * SCALE), max: Math.round(60 * SCALE) },
      angle: { min: 260, max: 280 },
      lifespan: 500,
      quantity: 3,
      frequency: 80,
      scale: { start: 0.4 * SCALE, end: 0.1 * SCALE },
      alpha: { start: 0.7, end: 0 },
      gravityY: Math.round(80 * SCALE),
      tint: 0x60a5fa, // Blue tint for water
    });
    this.fountainWater.setDepth(2);

    // Add flag poles (positioned at skyline/grass transition)
    const flagY = grassTop - Math.round(20 * SCALE);
    const flagPositions = [
      { x: Math.round(50 * SCALE), y: flagY },
      { x: Math.round(750 * SCALE), y: flagY },
    ];
    flagPositions.forEach((pos) => {
      const flag = this.add.sprite(pos.x, pos.y, "flag");
      flag.setOrigin(0.5, 1);
      flag.setDepth(1);
      this.decorations.push(flag);

      // Flag waving
      this.tweens.add({
        targets: flag,
        scaleX: 0.9 * SCALE,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });

    // Add pond in corner (positioned on grass)
    const pond = this.add.sprite(
      Math.round(100 * SCALE),
      grassTop + Math.round(50 * SCALE),
      "pond"
    );
    pond.setOrigin(0.5, 0.5);
    pond.setDepth(0);
    pond.setScale(1.5 * SCALE);
    pond.setAlpha(0.8);
    this.decorations.push(pond);

    // Ripple effect on pond (scaled)
    this.tweens.add({
      targets: pond,
      scale: 1.55 * SCALE,
      alpha: 0.6,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private createAmbientParticles(): void {
    // Floating pollen/dust particles during day (scaled)
    this.ambientParticles = this.add.particles(GAME_WIDTH / 2, Math.round(200 * SCALE), "pollen", {
      x: { min: 0, max: GAME_WIDTH },
      y: { min: Math.round(100 * SCALE), max: Math.round(400 * SCALE) },
      lifespan: 8000,
      speedX: { min: Math.round(5 * SCALE), max: Math.round(20 * SCALE) },
      speedY: { min: Math.round(-5 * SCALE), max: Math.round(5 * SCALE) },
      scale: { start: 0.3 * SCALE, end: 0 },
      alpha: { start: 0.4, end: 0 },
      quantity: 1,
      frequency: 500,
    });
    this.ambientParticles.setDepth(15);
  }

  private createFireflies(): void {
    if (this.fireflies) return;

    this.fireflies = this.add.particles(GAME_WIDTH / 2, Math.round(400 * SCALE), "firefly", {
      x: { min: Math.round(50 * SCALE), max: Math.round(750 * SCALE) },
      y: { min: Math.round(350 * SCALE), max: Math.round(500 * SCALE) },
      lifespan: 4000,
      speedX: { min: Math.round(-20 * SCALE), max: Math.round(20 * SCALE) },
      speedY: { min: Math.round(-20 * SCALE), max: Math.round(20 * SCALE) },
      scale: { start: 0.8 * SCALE, end: 0 },
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
    } catch {
      // Audio not supported
    }
  }

  private emitTrackChange(): void {
    window.dispatchEvent(
      new CustomEvent("bagsworld-track-changed", {
        detail: { trackName: this.trackNames[this.currentTrack], trackIndex: this.currentTrack },
      })
    );
  }

  private stopAllOscillators(): void {
    // Stop all active oscillators immediately to prevent overlap
    this.activeOscillators.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // Oscillator may have already stopped
      }
    });
    this.activeOscillators = [];
  }

  private playCurrentTrack(): void {
    // Clear any existing scheduled track to prevent overlapping
    if (this.musicInterval) {
      clearTimeout(this.musicInterval);
      this.musicInterval = null;
    }

    // Stop all currently playing oscillators
    this.stopAllOscillators();

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
      case 4:
        this.playRoute101();
        break;
      case 5:
        this.playPokemonCenter();
        break;
      case 6:
        this.playMysteryDungeon();
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

  private prevTrack(): void {
    // Stop current melody
    if (this.musicInterval) {
      clearTimeout(this.musicInterval);
      this.musicInterval = null;
    }

    // Move to previous track (wrap around)
    this.currentTrack = (this.currentTrack - 1 + this.trackNames.length) % this.trackNames.length;
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
      { freq: 392.0, duration: 0.8 }, // G4
      { freq: 440.0, duration: 0.6 }, // A4
      { freq: 523.25, duration: 1.0 }, // C5
      { freq: 0, duration: 0.8 }, // Rest
      { freq: 440.0, duration: 0.6 }, // A4
      { freq: 392.0, duration: 0.8 }, // G4
      { freq: 329.63, duration: 1.2 }, // E4
      { freq: 0, duration: 1.0 }, // Long rest

      // Phrase 2 - variation
      { freq: 329.63, duration: 0.6 }, // E4
      { freq: 392.0, duration: 0.8 }, // G4
      { freq: 440.0, duration: 1.0 }, // A4
      { freq: 0, duration: 0.6 }, // Rest
      { freq: 523.25, duration: 0.8 }, // C5
      { freq: 440.0, duration: 0.6 }, // A4
      { freq: 392.0, duration: 1.2 }, // G4
      { freq: 0, duration: 1.2 }, // Long rest

      // Phrase 3 - descending
      { freq: 523.25, duration: 0.8 }, // C5
      { freq: 440.0, duration: 0.8 }, // A4
      { freq: 392.0, duration: 0.8 }, // G4
      { freq: 329.63, duration: 1.0 }, // E4
      { freq: 0, duration: 0.8 }, // Rest
      { freq: 293.66, duration: 0.6 }, // D4
      { freq: 261.63, duration: 1.4 }, // C4
      { freq: 0, duration: 1.5 }, // Long rest

      // Phrase 4 - resolution
      { freq: 261.63, duration: 0.8 }, // C4
      { freq: 329.63, duration: 0.6 }, // E4
      { freq: 392.0, duration: 1.0 }, // G4
      { freq: 0, duration: 0.5 }, // Rest
      { freq: 440.0, duration: 0.8 }, // A4
      { freq: 392.0, duration: 1.2 }, // G4
      { freq: 0, duration: 2.0 }, // Very long rest before loop
    ];

    // Soft, sustained bass notes (much quieter)
    const bass = [
      { freq: 130.81, duration: 3.0 }, // C3
      { freq: 0, duration: 1.0 },
      { freq: 110.0, duration: 3.0 }, // A2
      { freq: 0, duration: 1.0 },
      { freq: 98.0, duration: 3.0 }, // G2
      { freq: 0, duration: 1.0 },
      { freq: 130.81, duration: 4.0 }, // C3
      { freq: 0, duration: 2.0 },
      { freq: 110.0, duration: 3.0 }, // A2
      { freq: 0, duration: 1.5 },
      { freq: 98.0, duration: 3.0 }, // G2
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
    this.musicInterval = window.setTimeout(
      () => {
        if (this.musicPlaying) {
          this.playCurrentTrack();
        }
      },
      (totalDuration + 2) * 1000
    );
  }

  // Track 2: Bags Anthem - Gentle, uplifting
  private playBagsAnthem(): void {
    if (!this.audioContext || !this.gainNode) return;

    // Gentle uplifting melody - longer phrases, more space
    const notes = [
      { freq: 329.63, duration: 0.8 }, // E4
      { freq: 392.0, duration: 0.6 }, // G4
      { freq: 493.88, duration: 1.0 }, // B4
      { freq: 0, duration: 0.6 }, // Rest
      { freq: 440.0, duration: 0.8 }, // A4
      { freq: 392.0, duration: 0.6 }, // G4
      { freq: 329.63, duration: 1.2 }, // E4
      { freq: 0, duration: 1.0 }, // Long rest

      { freq: 392.0, duration: 0.6 }, // G4
      { freq: 440.0, duration: 0.8 }, // A4
      { freq: 493.88, duration: 0.8 }, // B4
      { freq: 523.25, duration: 1.0 }, // C5
      { freq: 0, duration: 0.8 }, // Rest
      { freq: 493.88, duration: 0.6 }, // B4
      { freq: 440.0, duration: 0.8 }, // A4
      { freq: 392.0, duration: 1.2 }, // G4
      { freq: 0, duration: 1.2 }, // Long rest

      { freq: 329.63, duration: 0.8 }, // E4
      { freq: 293.66, duration: 0.6 }, // D4
      { freq: 329.63, duration: 1.0 }, // E4
      { freq: 392.0, duration: 1.2 }, // G4
      { freq: 0, duration: 2.0 }, // Very long rest
    ];

    const bass = [
      { freq: 164.81, duration: 3.5 }, // E3
      { freq: 0, duration: 1.0 },
      { freq: 130.81, duration: 3.5 }, // C3
      { freq: 0, duration: 1.0 },
      { freq: 146.83, duration: 3.0 }, // D3
      { freq: 0, duration: 1.0 },
      { freq: 164.81, duration: 3.5 }, // E3
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

    this.musicInterval = window.setTimeout(
      () => {
        if (this.musicPlaying) {
          this.playCurrentTrack();
        }
      },
      (totalDuration + 2) * 1000
    );
  }

  // Track 3: Night Market - Chill, ambient
  private playNightMarket(): void {
    if (!this.audioContext || !this.gainNode) return;

    // Chill ambient melody - very spacious and relaxed
    const notes = [
      { freq: 293.66, duration: 1.2 }, // D4
      { freq: 0, duration: 0.8 }, // Rest
      { freq: 329.63, duration: 1.0 }, // E4
      { freq: 392.0, duration: 1.4 }, // G4
      { freq: 0, duration: 1.2 }, // Long rest

      { freq: 440.0, duration: 1.0 }, // A4
      { freq: 392.0, duration: 0.8 }, // G4
      { freq: 329.63, duration: 1.4 }, // E4
      { freq: 0, duration: 1.0 }, // Rest

      { freq: 293.66, duration: 0.8 }, // D4
      { freq: 261.63, duration: 1.2 }, // C4
      { freq: 0, duration: 1.5 }, // Long rest

      { freq: 329.63, duration: 1.0 }, // E4
      { freq: 293.66, duration: 0.8 }, // D4
      { freq: 261.63, duration: 1.6 }, // C4
      { freq: 0, duration: 2.0 }, // Very long rest

      { freq: 392.0, duration: 1.2 }, // G4
      { freq: 329.63, duration: 1.0 }, // E4
      { freq: 293.66, duration: 1.4 }, // D4
      { freq: 0, duration: 2.5 }, // Extra long rest before loop
    ];

    const pad = [
      { freq: 130.81, duration: 4.0 }, // C3
      { freq: 0, duration: 1.5 },
      { freq: 110.0, duration: 4.0 }, // A2
      { freq: 0, duration: 1.5 },
      { freq: 98.0, duration: 4.0 }, // G2
      { freq: 0, duration: 1.5 },
      { freq: 130.81, duration: 5.0 }, // C3
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

    this.musicInterval = window.setTimeout(
      () => {
        if (this.musicPlaying) {
          this.playCurrentTrack();
        }
      },
      (totalDuration + 2) * 1000
    );
  }

  // Track 4: Victory March - Gentle, hopeful
  private playVictoryMarch(): void {
    if (!this.audioContext || !this.gainNode) return;

    // Gentle hopeful melody - uplifting but calm
    const notes = [
      { freq: 392.0, duration: 1.0 }, // G4
      { freq: 440.0, duration: 0.8 }, // A4
      { freq: 493.88, duration: 1.2 }, // B4
      { freq: 0, duration: 0.8 }, // Rest

      { freq: 523.25, duration: 1.0 }, // C5
      { freq: 493.88, duration: 0.8 }, // B4
      { freq: 440.0, duration: 1.2 }, // A4
      { freq: 0, duration: 1.0 }, // Long rest

      { freq: 392.0, duration: 0.8 }, // G4
      { freq: 329.63, duration: 0.8 }, // E4
      { freq: 392.0, duration: 1.0 }, // G4
      { freq: 440.0, duration: 1.4 }, // A4
      { freq: 0, duration: 1.2 }, // Long rest

      { freq: 493.88, duration: 1.0 }, // B4
      { freq: 523.25, duration: 1.2 }, // C5
      { freq: 0, duration: 0.6 }, // Rest
      { freq: 493.88, duration: 0.8 }, // B4
      { freq: 440.0, duration: 1.0 }, // A4
      { freq: 392.0, duration: 1.6 }, // G4
      { freq: 0, duration: 2.5 }, // Very long rest before loop
    ];

    const bass = [
      { freq: 196.0, duration: 4.0 }, // G3
      { freq: 0, duration: 1.0 },
      { freq: 130.81, duration: 4.0 }, // C3
      { freq: 0, duration: 1.0 },
      { freq: 164.81, duration: 3.5 }, // E3
      { freq: 0, duration: 1.5 },
      { freq: 196.0, duration: 5.0 }, // G3
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

    this.musicInterval = window.setTimeout(
      () => {
        if (this.musicPlaying) {
          this.playCurrentTrack();
        }
      },
      (totalDuration + 2) * 1000
    );
  }

  // Track 5: Route 101 - Cheerful walking/exploration theme
  private playRoute101(): void {
    if (!this.audioContext || !this.gainNode) return;

    // Cheerful, bouncy melody - reminiscent of Pokemon routes
    const notes = [
      // Opening phrase - bright and cheerful
      { freq: 523.25, duration: 0.4 }, // C5
      { freq: 587.33, duration: 0.4 }, // D5
      { freq: 659.25, duration: 0.6 }, // E5
      { freq: 0, duration: 0.3 }, // Rest
      { freq: 587.33, duration: 0.4 }, // D5
      { freq: 523.25, duration: 0.6 }, // C5
      { freq: 0, duration: 0.5 }, // Rest

      // Second phrase - playful variation
      { freq: 440.0, duration: 0.4 }, // A4
      { freq: 523.25, duration: 0.4 }, // C5
      { freq: 587.33, duration: 0.5 }, // D5
      { freq: 659.25, duration: 0.7 }, // E5
      { freq: 0, duration: 0.6 }, // Rest

      // Third phrase - descending
      { freq: 659.25, duration: 0.4 }, // E5
      { freq: 587.33, duration: 0.4 }, // D5
      { freq: 523.25, duration: 0.4 }, // C5
      { freq: 440.0, duration: 0.6 }, // A4
      { freq: 0, duration: 0.8 }, // Rest

      // Resolution phrase
      { freq: 392.0, duration: 0.5 }, // G4
      { freq: 440.0, duration: 0.4 }, // A4
      { freq: 523.25, duration: 0.8 }, // C5
      { freq: 0, duration: 1.5 }, // Long rest before loop
    ];

    const bass = [
      { freq: 130.81, duration: 2.0 }, // C3
      { freq: 0, duration: 0.5 },
      { freq: 110.0, duration: 2.0 }, // A2
      { freq: 0, duration: 0.5 },
      { freq: 146.83, duration: 2.0 }, // D3
      { freq: 0, duration: 0.5 },
      { freq: 130.81, duration: 2.5 }, // C3
      { freq: 0, duration: 1.5 },
    ];

    let time = this.audioContext.currentTime + 0.1;
    const totalDuration = notes.reduce((sum, n) => sum + n.duration, 0);

    notes.forEach((note) => {
      if (note.freq > 0) {
        this.playNote(note.freq, time, note.duration * 0.85, 0.08, "sine");
      }
      time += note.duration;
    });

    let bassTime = this.audioContext.currentTime + 0.1;
    bass.forEach((note) => {
      if (note.freq > 0) {
        this.playNote(note.freq, bassTime, note.duration * 0.9, 0.04, "triangle");
      }
      bassTime += note.duration;
    });

    this.musicInterval = window.setTimeout(
      () => {
        if (this.musicPlaying) {
          this.playCurrentTrack();
        }
      },
      (totalDuration + 2) * 1000
    );
  }

  // Track 6: Pokemon Center - Healing/rest theme
  private playPokemonCenter(): void {
    if (!this.audioContext || !this.gainNode) return;

    // Soothing, comforting melody - the classic healing feel
    const notes = [
      // Iconic opening
      { freq: 659.25, duration: 0.5 }, // E5
      { freq: 783.99, duration: 0.5 }, // G5
      { freq: 880.0, duration: 0.7 }, // A5
      { freq: 0, duration: 0.4 }, // Rest
      { freq: 783.99, duration: 0.4 }, // G5
      { freq: 659.25, duration: 0.6 }, // E5
      { freq: 0, duration: 0.8 }, // Rest

      // Gentle continuation
      { freq: 523.25, duration: 0.5 }, // C5
      { freq: 587.33, duration: 0.4 }, // D5
      { freq: 659.25, duration: 0.6 }, // E5
      { freq: 0, duration: 0.5 }, // Rest
      { freq: 587.33, duration: 0.4 }, // D5
      { freq: 523.25, duration: 0.8 }, // C5
      { freq: 0, duration: 1.0 }, // Rest

      // Resolving phrase
      { freq: 440.0, duration: 0.5 }, // A4
      { freq: 523.25, duration: 0.5 }, // C5
      { freq: 659.25, duration: 0.7 }, // E5
      { freq: 0, duration: 0.4 }, // Rest
      { freq: 523.25, duration: 0.5 }, // C5
      { freq: 440.0, duration: 0.8 }, // A4
      { freq: 0, duration: 2.0 }, // Long rest
    ];

    const pad = [
      { freq: 220.0, duration: 3.0 }, // A3
      { freq: 0, duration: 1.0 },
      { freq: 261.63, duration: 3.0 }, // C4
      { freq: 0, duration: 1.0 },
      { freq: 220.0, duration: 3.5 }, // A3
      { freq: 0, duration: 2.0 },
    ];

    let time = this.audioContext.currentTime + 0.1;
    const totalDuration = notes.reduce((sum, n) => sum + n.duration, 0);

    notes.forEach((note) => {
      if (note.freq > 0) {
        this.playNote(note.freq, time, note.duration * 0.9, 0.07, "sine");
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

    this.musicInterval = window.setTimeout(
      () => {
        if (this.musicPlaying) {
          this.playCurrentTrack();
        }
      },
      (totalDuration + 2) * 1000
    );
  }

  // Track 7: Mystery Dungeon - Mysterious exploration theme
  private playMysteryDungeon(): void {
    if (!this.audioContext || !this.gainNode) return;

    // Mysterious, slightly tense but adventurous melody
    const notes = [
      // Opening - mysterious
      { freq: 329.63, duration: 0.8 }, // E4
      { freq: 0, duration: 0.4 }, // Rest
      { freq: 311.13, duration: 0.6 }, // Eb4
      { freq: 329.63, duration: 0.8 }, // E4
      { freq: 0, duration: 0.6 }, // Rest

      // Building tension
      { freq: 392.0, duration: 0.6 }, // G4
      { freq: 369.99, duration: 0.5 }, // F#4
      { freq: 329.63, duration: 0.7 }, // E4
      { freq: 0, duration: 0.8 }, // Rest

      // Mysterious phrase
      { freq: 293.66, duration: 0.6 }, // D4
      { freq: 329.63, duration: 0.5 }, // E4
      { freq: 392.0, duration: 0.8 }, // G4
      { freq: 0, duration: 0.5 }, // Rest
      { freq: 369.99, duration: 0.6 }, // F#4
      { freq: 329.63, duration: 1.0 }, // E4
      { freq: 0, duration: 1.0 }, // Rest

      // Resolution with minor feel
      { freq: 261.63, duration: 0.7 }, // C4
      { freq: 293.66, duration: 0.5 }, // D4
      { freq: 329.63, duration: 1.2 }, // E4
      { freq: 0, duration: 2.0 }, // Long rest before loop
    ];

    const bass = [
      { freq: 82.41, duration: 3.0 }, // E2
      { freq: 0, duration: 1.0 },
      { freq: 98.0, duration: 3.0 }, // G2
      { freq: 0, duration: 1.0 },
      { freq: 73.42, duration: 3.0 }, // D2
      { freq: 0, duration: 1.0 },
      { freq: 82.41, duration: 3.5 }, // E2
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
        this.playNote(note.freq, bassTime, note.duration * 0.9, 0.04, "triangle");
      }
      bassTime += note.duration;
    });

    this.musicInterval = window.setTimeout(
      () => {
        if (this.musicPlaying) {
          this.playCurrentTrack();
        }
      },
      (totalDuration + 2) * 1000
    );
  }

  private playNote(
    frequency: number,
    startTime: number,
    duration: number,
    volume: number,
    waveType: OscillatorType = "sine"
  ): void {
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

    // Track oscillator for cleanup on track switch
    this.activeOscillators.push(oscillator);

    // Remove from array when it ends naturally
    oscillator.onended = () => {
      const index = this.activeOscillators.indexOf(oscillator);
      if (index > -1) {
        this.activeOscillators.splice(index, 1);
      }
    };
  }

  private toggleMusic(): void {
    if (this.musicPlaying) {
      this.musicPlaying = false;
      if (this.musicInterval) {
        clearTimeout(this.musicInterval);
        this.musicInterval = null;
      }
      // Stop all active oscillators when muting
      this.stopAllOscillators();
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
    // Update speech bubbles for autonomous dialogue
    this.updateDialogueBubbles();

    // Update character movements with AI-driven targets
    // Performance: use O(1) map lookup instead of O(n) find()
    this.characterSprites.forEach((sprite, id) => {
      const character = this.characterById.get(id);
      if (!character) return;

      // Get character's behavior ID (special characters map to their IDs)
      const behaviorId = this.getCharacterBehaviorId(character);
      const target = this.characterTargets.get(behaviorId);

      if (target) {
        // AI-driven movement toward target
        const dx = target.x - sprite.x;
        const dy = target.y - sprite.y;
        // Performance: use squared distance to avoid sqrt when possible
        const distSq = dx * dx + dy * dy;

        if (distSq > 25) {
          // 5^2 = 25
          const distance = Math.sqrt(distSq);
          // Performance: cache speed per character instead of random every frame
          let speed = this.characterSpeeds.get(id);
          if (!speed) {
            speed = 1.2 + Math.random() * 0.3;
            this.characterSpeeds.set(id, speed);
          }
          const moveX = (dx / distance) * speed;
          const moveY = (dy / distance) * speed;

          sprite.x += moveX;
          sprite.y += moveY;

          // Face direction of movement
          sprite.setFlipX(dx < 0);

          // Update any glow sprites to follow
          this.updateCharacterGlow(sprite, character);
        } else {
          // Reached target, clear it and reset speed for next movement
          this.characterTargets.delete(behaviorId);
          this.characterSpeeds.delete(id);
        }
      } else if (character.isMoving) {
        // Fallback: simple random wandering if no AI target
        // Performance: cache fallback speed too
        let speed = this.characterSpeeds.get(id);
        if (!speed) {
          speed = 0.3 + Math.random() * 0.2;
          this.characterSpeeds.set(id, speed);
        }
        if (character.direction === "left") {
          sprite.x -= speed;
          sprite.setFlipX(true);
          if (sprite.x < 100) {
            character.direction = "right";
            this.characterSpeeds.delete(id); // Reset speed on direction change
          }
        } else {
          sprite.x += speed;
          sprite.setFlipX(false);
          if (sprite.x > 1100) {
            character.direction = "left";
            this.characterSpeeds.delete(id); // Reset speed on direction change
          }
        }
        // Update glow on fallback movement too
        this.updateCharacterGlow(sprite, character);
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

    // Animate animals (scaled for 1280x960 resolution)
    const animalMinX = Math.round(50 * SCALE);
    const animalMaxX = Math.round(750 * SCALE);
    const animalRoamRange = Math.round(700 * SCALE);

    this.animals.forEach((animal) => {
      if (animal.isIdle) {
        animal.idleTimer += 1;
        // After idle period, start moving again
        if (animal.idleTimer > 100 + Math.random() * 200) {
          animal.isIdle = false;
          animal.idleTimer = 0;
          animal.targetX = animalMinX + Math.random() * animalRoamRange;
          animal.direction = animal.targetX > animal.sprite.x ? "right" : "left";
        }
      } else {
        // Move toward target
        const dx = animal.targetX - animal.sprite.x;
        if (Math.abs(dx) < 5 * SCALE) {
          // Reached target, become idle
          animal.isIdle = true;
        } else {
          animal.sprite.x += animal.speed * (dx > 0 ? 1 : -1);
          animal.sprite.setFlipX(dx < 0);
        }

        // Keep within bounds (scaled)
        if (animal.sprite.x < animalMinX) {
          animal.sprite.x = animalMinX;
          animal.targetX = animalMinX + Math.random() * Math.round(300 * SCALE);
        }
        if (animal.sprite.x > animalMaxX) {
          animal.sprite.x = animalMaxX;
          animal.targetX = Math.round(400 * SCALE) + Math.random() * Math.round(350 * SCALE);
        }
      }
    });

    // === POKEMON MOVEMENT (Founders zone only) ===
    if (this.currentZone === "founders") {
      const pokemonMinX = Math.round(80 * SCALE);
      const pokemonMaxX = Math.round(720 * SCALE);

      this.pokemon.forEach((poke) => {
        if (!poke.sprite.active) return;

        if (!poke.isIdle) {
          // Move toward target
          const dx = poke.targetX - poke.sprite.x;
          if (Math.abs(dx) < 5 * SCALE) {
            // Reached target, become idle
            poke.isIdle = true;
            poke.idleTimer = 0;
          } else {
            poke.sprite.x += poke.speed * SCALE * (dx > 0 ? 1 : -1);
            poke.sprite.setFlipX(dx < 0);
          }

          // Keep within bounds
          if (poke.sprite.x < pokemonMinX) {
            poke.sprite.x = pokemonMinX;
            poke.isIdle = true;
            poke.targetX = pokemonMinX + Math.random() * Math.round(200 * SCALE);
          }
          if (poke.sprite.x > pokemonMaxX) {
            poke.sprite.x = pokemonMaxX;
            poke.isIdle = true;
            poke.targetX = pokemonMaxX - Math.random() * Math.round(200 * SCALE);
          }
        }
      });
    }
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

  private updateDayNightFromEST(timeInfo: {
    isNight: boolean;
    isDusk: boolean;
    isDawn: boolean;
  }): void {
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

  private updateCelestialBody(timeInfo: {
    isNight: boolean;
    isDusk: boolean;
    isDawn: boolean;
  }): void {
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
        },
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
        },
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
        700,
        70,
        700 + Math.cos(angle) * 150,
        70 + Math.sin(angle) * 150,
        700 + Math.cos(angle + 0.3) * 150,
        70 + Math.sin(angle + 0.3) * 150
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
      x: { min: 0, max: GAME_WIDTH },
      y: Math.round(-10 * SCALE),
      lifespan: 800,
      speedY: { min: Math.round(300 * SCALE), max: Math.round(500 * SCALE) },
      speedX: isStorm
        ? { min: Math.round(-100 * SCALE), max: Math.round(-150 * SCALE) }
        : { min: Math.round(-20 * SCALE), max: Math.round(20 * SCALE) },
      scale: { start: SCALE, end: 0.6 * SCALE },
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

          // Lightning bolt (scaled)
          const x = Math.round(100 * SCALE) + Math.random() * Math.round(600 * SCALE);
          const lightning = this.add.sprite(x, Math.round(100 * SCALE), "lightning");
          lightning.setScale(2 * SCALE);
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

    // Falling embers (scaled)
    this.weatherEmitter = this.add.particles(0, 0, "coin", {
      x: { min: 0, max: GAME_WIDTH },
      y: Math.round(-10 * SCALE),
      lifespan: 3000,
      speedY: { min: Math.round(50 * SCALE), max: Math.round(100 * SCALE) },
      speedX: { min: Math.round(-30 * SCALE), max: Math.round(30 * SCALE) },
      scale: { start: 0.3 * SCALE, end: 0 },
      quantity: 2,
      frequency: 200,
      tint: 0xff4444,
      alpha: { start: 0.8, end: 0 },
    });
    this.weatherEmitter.setDepth(50);
  }

  private updateCharacters(characters: GameCharacter[]): void {
    // Performance: rebuild character lookup map for O(1) access in update()
    this.characterById.clear();
    characters.forEach((c) => this.characterById.set(c.id, c));

    // Filter characters by current zone
    // Characters with matching zone or no zone (undefined) appear in current zone
    // Neo (isScout) and CJ go to BagsCity (trending), others to Park (main_city)
    const zoneCharacters = characters.filter((c) => {
      if (!c.zone) return this.currentZone === "main_city"; // Default: Park
      return c.zone === this.currentZone;
    });

    const zoneCharacterIds = new Set(zoneCharacters.map((c) => c.id));

    // Show/hide sprites based on zone
    this.characterSprites.forEach((sprite, id) => {
      const shouldShow = zoneCharacterIds.has(id);
      sprite.setVisible(shouldShow);

      // Handle associated glow sprites (including Shaw and Academy characters)
      const glowKeys = [
        "tolyGlow",
        "ashGlow",
        "finnGlow",
        "devGlow",
        "scoutGlow",
        "cjGlow",
        "shawGlow",
        // Academy character glows
        "ramoGlow",
        "sincaraGlow",
        "stuuGlow",
        "samGlow",
        "alaaGlow",
        "carloGlow",
        "bnnGlow",
      ];
      glowKeys.forEach((key) => {
        const glow = (sprite as any)[key];
        if (glow) glow.setVisible(shouldShow);
      });
    });

    const currentIds = new Set(characters.map((c) => c.id));

    // Remove old characters and their associated glow sprites
    this.characterSprites.forEach((sprite, id) => {
      if (!currentIds.has(id)) {
        // Clean up associated glow sprites before destroying (including Academy characters)
        const glowKeys = [
          "tolyGlow",
          "ashGlow",
          "finnGlow",
          "devGlow",
          "scoutGlow",
          "cjGlow",
          "shawGlow",
          // Academy character glows
          "ramoGlow",
          "sincaraGlow",
          "stuuGlow",
          "samGlow",
          "alaaGlow",
          "carloGlow",
          "bnnGlow",
        ];
        glowKeys.forEach((key) => {
          const glow = (sprite as any)[key];
          if (glow) {
            this.tweens.killTweensOf(glow); // Stop any running tweens
            glow.destroy();
          }
        });
        sprite.destroy();
        this.characterSprites.delete(id);
        this.characterVariants.delete(id);
      }
    });

    // Separate characters into existing (quick update) and new (needs creation)
    // Only create sprites for characters in the current zone
    const existingCharacters: { character: GameCharacter; sprite: Phaser.GameObjects.Sprite }[] =
      [];
    const newCharacters: { character: GameCharacter; index: number }[] = [];

    characters.forEach((character, index) => {
      const sprite = this.characterSprites.get(character.id);
      if (sprite) {
        existingCharacters.push({ character, sprite });
      } else {
        // Only create new sprites for characters in the current zone
        const charZone = character.zone || "main_city"; // Default to Park
        if (charZone === this.currentZone) {
          newCharacters.push({ character, index });
        }
      }
    });

    // Update existing characters immediately (fast path)
    existingCharacters.forEach(({ character, sprite }) => {
      this.updateExistingCharacter(character, sprite);
    });

    // Batch create new characters across frames to prevent frame drops
    const BATCH_SIZE = 2; // Characters are heavier than buildings
    const createBatch = (startIndex: number) => {
      const endIndex = Math.min(startIndex + BATCH_SIZE, newCharacters.length);
      for (let i = startIndex; i < endIndex; i++) {
        this.createCharacterSprite(newCharacters[i].character, newCharacters[i].index);
      }
      // Schedule next batch if there are more characters
      if (endIndex < newCharacters.length) {
        this.time.delayedCall(0, () => createBatch(endIndex));
      }
    };

    if (newCharacters.length > 0) {
      createBatch(0);
    }
  }

  private updateExistingCharacter(
    character: GameCharacter,
    sprite: Phaser.GameObjects.Sprite
  ): void {
    // Update special character glow positions if they exist (including Academy characters)
    const glowKeys = [
      "tolyGlow",
      "ashGlow",
      "finnGlow",
      "devGlow",
      "scoutGlow",
      "cjGlow",
      "shawGlow",
      // Academy character glows
      "ramoGlow",
      "sincaraGlow",
      "stuuGlow",
      "samGlow",
      "alaaGlow",
      "carloGlow",
      "bnnGlow",
    ];
    glowKeys.forEach((key) => {
      const glow = (sprite as any)[key];
      if (glow) {
        glow.x = sprite.x;
        glow.y = sprite.y;
      }
    });

    // Update texture based on mood (skip for special characters including Academy)
    const isToly = character.isToly === true;
    const isAsh = character.isAsh === true;
    const isFinn = character.isFinn === true;
    const isDev = character.isDev === true;
    const isScout = character.isScout === true;
    const isCJ = character.isCJ === true;
    const isShaw = character.isShaw === true;
    // Academy characters
    const isRamo = character.isRamo === true;
    const isSincara = character.isSincara === true;
    const isStuu = character.isStuu === true;
    const isSam = character.isSam === true;
    const isAlaa = character.isAlaa === true;
    const isCarlo = character.isCarlo === true;
    const isBNN = character.isBNN === true;
    // Founder's Corner characters
    const isProfessorOak = character.isProfessorOak === true;
    // Mascots
    const isBagsy = character.isBagsy === true;
    const isAcademyChar = isRamo || isSincara || isStuu || isSam || isAlaa || isCarlo || isBNN;
    const isFoundersChar = isProfessorOak;
    const isMascot = isBagsy;
    if (
      !isToly &&
      !isAsh &&
      !isFinn &&
      !isDev &&
      !isScout &&
      !isCJ &&
      !isShaw &&
      !isAcademyChar &&
      !isFoundersChar &&
      !isMascot
    ) {
      const variant = this.characterVariants.get(character.id) ?? 0;
      const expectedTexture = this.getCharacterTexture(character.mood, variant);
      if (sprite.texture?.key !== expectedTexture) {
        sprite.setTexture(expectedTexture);
      }
    }
  }

  private createCharacterSprite(character: GameCharacter, index: number): void {
    // External agents (Moltbook Beach "Openclaws") use crab/lobster sprites
    const isExternalAgent = character.id.startsWith("external-");
    const isMoltbookAgent = isExternalAgent && character.provider === "moltbook";
    const isOpenClaw = isExternalAgent; // All external agents are "Openclaws"

    // Special characters use unique textures, others get random variants
    const isToly = character.isToly === true;
    const isAsh = character.isAsh === true;
    const isFinn = character.isFinn === true;
    const isDev = character.isDev === true;
    const isScout = character.isScout === true;
    const isCJ = character.isCJ === true;
    const isShaw = character.isShaw === true;
    // Academy characters
    const isRamo = character.isRamo === true;
    const isSincara = character.isSincara === true;
    const isStuu = character.isStuu === true;
    const isSam = character.isSam === true;
    const isAlaa = character.isAlaa === true;
    const isCarlo = character.isCarlo === true;
    const isBNN = character.isBNN === true;
    // Founder's Corner characters
    const isProfessorOak = character.isProfessorOak === true;
    // Mascots
    const isBagsy = character.isBagsy === true;
    const isAcademyChar = isRamo || isSincara || isStuu || isSam || isAlaa || isCarlo || isBNN;
    const isFoundersChar = isProfessorOak;
    const isMascot = isBagsy;
    const isSpecial =
      isToly ||
      isAsh ||
      isFinn ||
      isDev ||
      isScout ||
      isCJ ||
      isShaw ||
      isAcademyChar ||
      isFoundersChar ||
      isMascot ||
      isOpenClaw;
    const variant = index % 9;
    this.characterVariants.set(character.id, variant);

    const textureKey = isOpenClaw
      ? (isMoltbookAgent ? "agent_lobster" : "agent_crab")
      : isToly
        ? "toly"
        : isAsh
          ? "ash"
          : isFinn
            ? "finn"
            : isDev
              ? "dev"
              : isScout
                ? "neo"
                : isCJ
                  ? "cj"
                  : isShaw
                    ? "shaw"
                    : isRamo
                      ? "ramo"
                      : isSincara
                        ? "sincara"
                        : isStuu
                          ? "stuu"
                          : isSam
                            ? "sam"
                            : isAlaa
                              ? "alaa"
                              : isCarlo
                                ? "carlo"
                                : isBNN
                                  ? "bnn"
                                  : isProfessorOak
                                    ? "professorOak"
                                    : isBagsy
                                      ? "bagsy"
                                      : this.getCharacterTexture(character.mood, variant);
    const sprite = this.add.sprite(character.x, character.y, textureKey);
    sprite.setDepth(isSpecial ? 11 : 10); // Special characters slightly above others
    sprite.setInteractive();
    sprite.setScale(isSpecial ? 1.3 : 1.2); // Special characters slightly larger

    // Hover effects
    sprite.on("pointerover", () => {
      sprite?.setScale(isSpecial ? 1.5 : 1.4);
      if (isOpenClaw) {
        // External agents (Openclaws) show their Moltbook profile tooltip
        this.showOpenClawTooltip(character, sprite!, isMoltbookAgent);
      } else if (isToly) {
        this.showTolyTooltip(sprite!);
      } else if (isAsh) {
        this.showAshTooltip(sprite!);
      } else if (isFinn) {
        this.showFinnTooltip(sprite!);
      } else if (isDev) {
        this.showDevTooltip(sprite!);
      } else if (isScout) {
        this.showScoutTooltip(sprite!);
      } else if (isCJ) {
        this.showCJTooltip(sprite!);
      } else if (isShaw) {
        this.showShawTooltip(sprite!);
      } else if (isRamo) {
        this.showRamoTooltip(sprite!);
      } else if (isSincara) {
        this.showSincaraTooltip(sprite!);
      } else if (isStuu) {
        this.showStuuTooltip(sprite!);
      } else if (isSam) {
        this.showSamTooltip(sprite!);
      } else if (isAlaa) {
        this.showAlaaTooltip(sprite!);
      } else if (isCarlo) {
        this.showCarloTooltip(sprite!);
      } else if (isBNN) {
        this.showBNNTooltip(sprite!);
      } else if (isProfessorOak) {
        this.showProfessorOakTooltip(sprite!);
      } else if (isBagsy) {
        this.showBagsyTooltip(sprite!);
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
      if (isOpenClaw) {
        // External agents (Openclaws) open their Moltbook profile
        if (character.profileUrl) {
          window.open(character.profileUrl, "_blank");
        }
      } else if (isToly) {
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
      } else if (isCJ) {
        // CJ opens the hood rat chat
        window.dispatchEvent(new CustomEvent("bagsworld-cj-click"));
      } else if (isShaw) {
        // Shaw opens the ElizaOS creator chat
        window.dispatchEvent(new CustomEvent("bagsworld-shaw-click"));
      } else if (isRamo) {
        // Ramo opens the CTO chat
        window.dispatchEvent(new CustomEvent("bagsworld-ramo-click"));
      } else if (isSincara) {
        // Sincara opens the frontend engineer chat
        window.dispatchEvent(new CustomEvent("bagsworld-sincara-click"));
      } else if (isStuu) {
        // Stuu opens the operations chat
        window.dispatchEvent(new CustomEvent("bagsworld-stuu-click"));
      } else if (isSam) {
        // Sam opens the growth chat
        window.dispatchEvent(new CustomEvent("bagsworld-sam-click"));
      } else if (isAlaa) {
        // Alaa opens the skunk works chat
        window.dispatchEvent(new CustomEvent("bagsworld-alaa-click"));
      } else if (isCarlo) {
        // Carlo opens the community chat
        window.dispatchEvent(new CustomEvent("bagsworld-carlo-click"));
      } else if (isBNN) {
        // BNN opens the news network chat
        window.dispatchEvent(new CustomEvent("bagsworld-bnn-click"));
      } else if (isProfessorOak) {
        // Professor Oak opens the token launch guide chat
        window.dispatchEvent(new CustomEvent("bagsworld-professoroak-click"));
      } else if (isBagsy) {
        // Bagsy opens the mascot chat
        window.dispatchEvent(new CustomEvent("bagsworld-bagsy-click"));
      } else if (character.profileUrl) {
        // Open profile page in new tab
        window.open(character.profileUrl, "_blank");
      }
    });

    // Walking animation - characters randomly walk around the park
    this.startCharacterWalking(sprite, character, isSpecial);

    // Add glow effects for special characters (configuration-driven)
    const glowConfigs: Array<{
      active: boolean;
      key: string;
      tint: number;
      alpha?: number;
      targetAlpha?: number;
      scale?: number;
      duration?: number;
    }> = [
      { active: isToly, key: "tolyGlow", tint: 0x9945ff },
      { active: isAsh, key: "ashGlow", tint: 0xdc2626 },
      { active: isFinn, key: "finnGlow", tint: 0x10b981 },
      { active: isDev, key: "devGlow", tint: 0x8b5cf6 },
      {
        active: isScout,
        key: "scoutGlow",
        tint: 0x00ff41,
        alpha: 0.4,
        targetAlpha: 0.7,
        scale: 1.3,
        duration: 800,
      },
      { active: isCJ, key: "cjGlow", tint: 0xf97316, duration: 1200 },
      { active: isShaw, key: "shawGlow", tint: 0xff5800, duration: 1000 },
      // Academy character glows
      { active: isRamo, key: "ramoGlow", tint: 0x3b82f6, duration: 1100 }, // Blue - technical
      { active: isSincara, key: "sincaraGlow", tint: 0xec4899, duration: 1300 }, // Pink - creative
      { active: isStuu, key: "stuuGlow", tint: 0x22c55e, duration: 1000 }, // Green - support
      { active: isSam, key: "samGlow", tint: 0xfbbf24, duration: 900 }, // Yellow - marketing energy
      {
        active: isAlaa,
        key: "alaaGlow",
        tint: 0x6366f1,
        alpha: 0.5,
        targetAlpha: 0.8,
        duration: 700,
      }, // Indigo - mysterious
      { active: isCarlo, key: "carloGlow", tint: 0xf97316, duration: 1100 }, // Orange - community warmth
      { active: isBNN, key: "bnnGlow", tint: 0x06b6d4, duration: 800 }, // Cyan - news/info
      // Founder's Corner character glows
      { active: isProfessorOak, key: "professorOakGlow", tint: 0xfbbf24, duration: 1000 }, // Amber - wisdom
      // Mascot glows
      { active: isBagsy, key: "bagsyGlow", tint: 0x00ff00, duration: 900 }, // Bright green - money bag energy
      // External agent (OpenClaw) glows - lobsters are red, crabs are orange
      {
        active: isOpenClaw,
        key: "openClawGlow",
        tint: isMoltbookAgent ? 0xff4444 : 0xffa500,
        alpha: 0.4,
        targetAlpha: 0.7,
        scale: 1.25,
        duration: 1000,
      },
    ];

    for (const cfg of glowConfigs) {
      if (!cfg.active) continue;
      const glow = this.add.sprite(character.x, character.y, "glow");
      glow.setScale(1.0);
      glow.setAlpha(cfg.alpha ?? 0.3);
      glow.setTint(cfg.tint);
      glow.setDepth(10);
      (sprite as any)[cfg.key] = glow;
      this.tweens.add({
        targets: glow,
        alpha: cfg.targetAlpha ?? 0.5,
        scale: cfg.scale ?? 1.2,
        duration: cfg.duration ?? 1500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    // Store character type flags on sprite for speech bubble system
    Object.assign(sprite, {
      isToly,
      isAsh,
      isFinn,
      isDev,
      isScout,
      isCJ,
      isShaw,
      isRamo,
      isSincara,
      isStuu,
      isSam,
      isAlaa,
      isCarlo,
      isBNN,
      isProfessorOak,
      isBagsy,
      isOpenClaw,
      isMoltbookAgent,
    });

    this.characterSprites.set(character.id, sprite);
  }

  private getCharacterTexture(mood: GameCharacter["mood"], variant: number): string {
    const moodSuffix = mood === "neutral" ? "" : `_${mood}`;
    return `character_${variant}${moodSuffix}`;
  }

  private updateBuildings(buildings: GameBuilding[]): void {
    // First, hide all buildings
    this.buildingSprites.forEach((container) => {
      container.setVisible(false);
    });

    // Filter buildings by current zone
    // Buildings with no zone appear in most zones, but NOT in arena (arena is just for fights)
    const zoneBuildings = buildings.filter((b) => {
      // Arena zone has no token buildings - it's just for fights
      if (this.currentZone === "arena") return false;
      if (!b.zone) return true; // No zone = appears in all non-arena zones
      return b.zone === this.currentZone;
    });

    const allBuildingIds = new Set(buildings.map((b) => b.id));

    // Only destroy buildings that no longer exist in the world state
    this.buildingSprites.forEach((container, id) => {
      if (!allBuildingIds.has(id)) {
        container.destroy();
        this.buildingSprites.delete(id);
        this.buildingInitialized.delete(id);
      }
    });

    // Separate buildings into existing (quick update) and new (needs creation)
    const existingBuildings: GameBuilding[] = [];
    const newBuildings: GameBuilding[] = [];

    zoneBuildings.forEach((building) => {
      if (this.buildingSprites.has(building.id)) {
        existingBuildings.push(building);
      } else {
        newBuildings.push(building);
      }
    });

    // Update existing buildings immediately (fast path)
    existingBuildings.forEach((building) => {
      this.updateExistingBuilding(building);
    });

    // Batch create new buildings across frames to prevent frame drops
    const BATCH_SIZE = 3;
    const createBatch = (startIndex: number) => {
      const endIndex = Math.min(startIndex + BATCH_SIZE, newBuildings.length);
      for (let i = startIndex; i < endIndex; i++) {
        this.createBuildingSprite(newBuildings[i]);
      }
      // Schedule next batch if there are more buildings
      if (endIndex < newBuildings.length) {
        this.time.delayedCall(0, () => createBatch(endIndex));
      }
    };

    if (newBuildings.length > 0) {
      createBatch(0);
    }
  }

  // Get building decay status from health value
  private getStatusFromHealth(health: number): BuildingStatus {
    const thresholds = ECOSYSTEM_CONFIG.buildings.decay.thresholds;
    if (health <= thresholds.dormant) return "dormant";
    if (health <= thresholds.critical) return "critical";
    if (health <= thresholds.warning) return "warning";
    return "active";
  }

  // Apply visual decay effects to a building sprite
  private applyDecayVisuals(
    building: GameBuilding,
    sprite: Phaser.GameObjects.Sprite,
    container: Phaser.GameObjects.Container
  ): void {
    // Skip permanent and floating buildings - they never decay
    if (building.isPermanent || building.isFloating) return;

    const status = building.status || this.getStatusFromHealth(building.health);

    // Clear existing decay effects
    sprite.clearTint();
    sprite.setAlpha(1);

    // Remove any existing decay tweens on this sprite
    this.tweens.killTweensOf(sprite);

    // Remove existing dormant indicator if any
    const existingZzz = container.getByName("dormantIndicator");
    if (existingZzz) {
      this.tweens.killTweensOf(existingZzz);
      existingZzz.destroy();
    }

    switch (status) {
      case "warning":
        sprite.setTint(0xffcc00); // Yellow tint
        sprite.setAlpha(0.9);
        break;

      case "critical":
        sprite.setTint(0xff6600); // Orange tint
        sprite.setAlpha(0.75);
        // Add pulsing effect for urgency
        this.tweens.add({
          targets: sprite,
          alpha: 0.6,
          duration: 1000,
          yoyo: true,
          repeat: -1,
        });
        break;

      case "dormant":
        sprite.setTint(0x666666); // Gray tint
        sprite.setAlpha(0.5);
        // Add sleeping indicator
        this.addDormantIndicator(container);
        break;

      default:
        // "active" - no special effects
        break;
    }
  }

  // Add a floating "ZZZ" indicator for dormant buildings
  private addDormantIndicator(container: Phaser.GameObjects.Container): void {
    const zzz = this.add.text(20, -60, "zzZ", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#9ca3af",
    });
    zzz.setName("dormantIndicator");

    // Float animation
    this.tweens.add({
      targets: zzz,
      y: zzz.y - 10,
      alpha: { from: 1, to: 0.5 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
    });

    container.add(zzz);
  }

  private updateExistingBuilding(building: GameBuilding): void {
    const container = this.buildingSprites.get(building.id);
    if (!container) return;

    // Show the existing building
    container.setVisible(true);

    // Special buildings have fixed textures - no need to update
    const isPokeCenter = building.id.includes("PokeCenter") || building.symbol === "HEAL";
    const isTradingGym = building.id.includes("TradingGym") || building.symbol === "DOJO";
    const isCasino = building.id.includes("Casino") || building.symbol === "CASINO";
    const isTradingTerminal =
      building.id.includes("TradingTerminal") || building.symbol === "TERMINAL";
    const isOracle = building.id.includes("Oracle") || building.symbol === "ORACLE";
    const isBagsHQ = building.isFloating || building.symbol === "BAGSWORLD";

    // Skip texture updates for special buildings (they don't change)
    if (isPokeCenter || isTradingGym || isCasino || isTradingTerminal || isOracle || isBagsHQ) {
      return;
    }

    // Regular buildings: sprite is at index 1 (after shadow at index 0)
    const sprite = container.getAt(1) as Phaser.GameObjects.Sprite;
    if (!sprite) return;

    // Apply decay visuals
    this.applyDecayVisuals(building, sprite, container);

    // Use same hash function to get consistent style
    const getBuildingStyleUpdate = (id: string): number => {
      let hash = 0;
      for (let i = 0; i < id.length; i++) {
        hash = (hash << 5) - hash + id.charCodeAt(i);
        hash = hash & hash;
      }
      return Math.abs(hash) % 4;
    };
    const updateStyleIndex = getBuildingStyleUpdate(building.id);
    const newTexture = `building_${building.level}_${updateStyleIndex}`;
    if (sprite.texture?.key !== newTexture) {
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

  private createBuildingSprite(building: GameBuilding): void {
    if (this.buildingSprites.has(building.id)) return; // Already exists

    const isFirstTimeCreation = !this.buildingInitialized.has(building.id);
    const container = this.add.container(building.x, building.y);

    // Scale building based on level (market cap)
    // Level 1: 0.8x, Level 2: 0.9x, Level 3: 1.0x, Level 4: 1.15x, Level 5: 1.3x
    const buildingScales = [0.8, 0.9, 1.0, 1.15, 1.3];
    const buildingScale = buildingScales[building.level - 1] || 1.0;

    // Shadow scales with building (floating HQ has no direct shadow)
    const isBagsHQ = building.isFloating || building.symbol === "BAGSWORLD";
    if (!isBagsHQ) {
      const shadowWidth = 20 + building.level * 6;
      const shadow = this.add.ellipse(2, 2, shadowWidth, 8, 0x000000, 0.3);
      container.add(shadow);
    }

    // Use special texture for PokeCenter/TradingGym/Casino/Terminal/Oracle/HQ/Mansions, otherwise use level-based building with style
    const isPokeCenter = building.id.includes("PokeCenter") || building.symbol === "HEAL";
    const isTradingGym = building.id.includes("TradingGym") || building.symbol === "DOJO";
    const isCasino = building.id.includes("Casino") || building.symbol === "CASINO";
    const isTradingTerminal =
      building.id.includes("TradingTerminal") || building.symbol === "TERMINAL";
    const isOracle = building.id.includes("Oracle") || building.symbol === "ORACLE";
    const isBagsWorldHQ = building.isFloating || building.symbol === "BAGSWORLD";
    const isMansion = building.isMansion;

    // Determine building style from mint address (deterministic - same token always gets same style)
    // Each level has 4 styles (0-3)
    const getBuildingStyle = (id: string): number => {
      // Use a simple hash of the building id to get a style index 0-3
      let hash = 0;
      for (let i = 0; i < id.length; i++) {
        hash = (hash << 5) - hash + id.charCodeAt(i);
        hash = hash & hash; // Convert to 32-bit integer
      }
      return Math.abs(hash) % 4;
    };

    // For mansions, use holderRank to determine style (0-4)
    const mansionStyleIndex = isMansion ? Math.min((building.holderRank || 1) - 1, 4) : 0;

    const styleIndex = getBuildingStyle(building.id);
    const buildingTexture = isBagsWorldHQ
      ? "bagshq"
      : isMansion
        ? `mansion_${mansionStyleIndex}`
        : isPokeCenter
          ? "pokecenter"
          : isTradingGym
            ? "tradinggym"
            : isCasino
              ? "casino"
              : isTradingTerminal
                ? "terminal"
                : isOracle
                  ? "oracle_tower"
                  : `building_${building.level}_${styleIndex}`;
    const sprite = this.add.sprite(0, 0, buildingTexture);
    sprite.setOrigin(0.5, 1);
    // HQ is larger and floating, mansions use rank-based scaling from building data
    const hqScale = 1.5;
    // Mansions use mansionScale from world-calculator (1.5 for #1, 1.3 for #2-3, 1.15 for #4-5)
    const mansionScale = building.mansionScale || 1.2;
    sprite.setScale(
      isBagsWorldHQ
        ? hqScale
        : isMansion
          ? mansionScale
          : isPokeCenter
            ? 1.0
            : isTradingGym
              ? 1.0
              : isCasino
                ? 1.0
                : isTradingTerminal
                  ? 1.0
                  : isOracle
                    ? 1.0
                    : buildingScale
    );
    container.add(sprite);

    // Apply decay visuals for non-permanent buildings
    if (!building.isPermanent && !building.isFloating) {
      this.applyDecayVisuals(building, sprite, container);
    }

    // Add floating animation for HQ
    if (isBagsWorldHQ) {
      this.tweens.add({
        targets: container,
        y: building.y - 10,
        duration: 2000,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });

      // Add subtle gold glow around HQ
      const hqGlow = this.add.sprite(0, -60, "glow");
      hqGlow.setScale(1.2);
      hqGlow.setAlpha(0.15);
      hqGlow.setTint(0xffd700); // Gold glow
      container.add(hqGlow);

      this.tweens.add({
        targets: hqGlow,
        alpha: 0.25,
        scale: 1.4,
        duration: 2000,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });
    }

    // Add gold glow, rank badge, and holder info for Mansions (Ballers Valley)
    if (isMansion) {
      const isWhale = building.holderRank === 1;
      const glowScale = isWhale ? 1.8 : 1.4;
      const glowAlpha = isWhale ? 0.3 : 0.2;
      const glowY = isWhale ? -100 : -80;

      // Gold glow effect (larger and brighter for #1 WHALE)
      const mansionGlow = this.add.sprite(0, glowY, "glow");
      mansionGlow.setScale(glowScale);
      mansionGlow.setAlpha(glowAlpha);
      mansionGlow.setTint(0xfbbf24); // Gold
      container.addAt(mansionGlow, 0); // Add behind sprite

      // Pulsing glow animation (more dramatic for #1)
      this.tweens.add({
        targets: mansionGlow,
        alpha: isWhale ? 0.5 : 0.35,
        scale: glowScale + (isWhale ? 0.4 : 0.2),
        duration: isWhale ? 2000 : 2500,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });

      // #1 WHALE gets a secondary sparkle glow
      if (isWhale) {
        const sparkleGlow = this.add.sprite(0, glowY + 20, "glow");
        sparkleGlow.setScale(1.0);
        sparkleGlow.setAlpha(0.15);
        sparkleGlow.setTint(0xfcd34d); // Brighter gold/amber
        container.addAt(sparkleGlow, 0);

        this.tweens.add({
          targets: sparkleGlow,
          alpha: 0.3,
          scale: 1.3,
          duration: 1500,
          ease: "Sine.easeInOut",
          yoyo: true,
          repeat: -1,
          delay: 500, // Offset for layered effect
        });
      }

      // Make mansion interactive (clickable cursor)
      sprite.setInteractive({ useHandCursor: true });
    }

    // Add pulsing glow animation for Trading Terminal
    if (isTradingTerminal) {
      // Terminal green glow
      const terminalGlow = this.add.sprite(0, -50, "glow");
      terminalGlow.setScale(1.3);
      terminalGlow.setAlpha(0.2);
      terminalGlow.setTint(0x22c55e); // Terminal green
      container.add(terminalGlow);

      // Pulsing glow animation
      this.tweens.add({
        targets: terminalGlow,
        alpha: 0.35,
        scale: 1.5,
        duration: 1500,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });

      // Secondary cyan glow
      const terminalGlow2 = this.add.sprite(0, -50, "glow");
      terminalGlow2.setScale(0.9);
      terminalGlow2.setAlpha(0.1);
      terminalGlow2.setTint(0x06b6d4); // Cyan
      container.add(terminalGlow2);

      // Offset pulse for depth effect
      this.tweens.add({
        targets: terminalGlow2,
        alpha: 0.2,
        scale: 1.1,
        duration: 1200,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
        delay: 400,
      });

      // Subtle scale pulse on building
      this.tweens.add({
        targets: sprite,
        scaleX: 1.02,
        scaleY: 1.01,
        duration: 2500,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });
    }

    // Glow effect for pumping buildings (skip for HQ - it has its own gold glow)
    if (building.glowing && !isBagsWorldHQ) {
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

    // Label with background - HQ and Mansions get gold styling
    const isHQBuilding = building.isFloating || building.symbol === "BAGSWORLD";
    const isMansionLandmark = building.isMansion && building.isPermanent;
    const isGoldLabel = isHQBuilding || isMansionLandmark;

    // Determine label text: HQ shows "$BagsWorld", mansions show their landmark name, others show symbol
    const labelText = isHQBuilding
      ? "$BagsWorld"
      : isMansionLandmark
        ? building.name
        : building.symbol;
    const labelWidth = isHQBuilding ? 85 : isMansionLandmark ? 95 : 50;

    const labelBg = this.add.rectangle(
      0,
      isGoldLabel ? 20 : 12,
      labelWidth,
      isGoldLabel ? 16 : 14,
      0x000000,
      0.8
    );
    labelBg.setStrokeStyle(isGoldLabel ? 2 : 1, isGoldLabel ? 0xffd700 : 0x4ade80);
    container.add(labelBg);
    const label = this.add.text(0, isGoldLabel ? 20 : 12, labelText, {
      fontFamily: "monospace",
      fontSize: isGoldLabel ? "11px" : "9px",
      color: isGoldLabel ? "#ffd700" : "#4ade80",
    });
    label.setOrigin(0.5, 0.5);
    container.add(label);

    // Buildings render behind characters (depth 10-11) but in front of ground elements
    // Buildings on the right appear behind buildings on the left when overlapping
    // HQ floats in sky so it's always visible above other buildings
    const buildingDepth = isHQBuilding ? 8 : 5 - building.x / 10000;
    container.setDepth(buildingDepth);
    const hitboxSize = isHQBuilding ? { w: 80, h: 160 } : { w: 40, h: 80 };
    container.setInteractive(
      new Phaser.Geom.Rectangle(-hitboxSize.w / 2, -hitboxSize.h, hitboxSize.w, hitboxSize.h),
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
      const isTradingGym = building.id.includes("TradingGym") || building.symbol === "DOJO";
      const isCasino = building.id.includes("Casino") || building.symbol === "CASINO";
      const isTradingTerminal =
        building.id.includes("TradingTerminal") || building.symbol === "TERMINAL";
      const isOracle = building.id.includes("Oracle") || building.symbol === "ORACLE";
      const isStarterBuilding = building.id.startsWith("Starter");
      const isTreasuryBuilding = building.id.startsWith("Treasury");
      const isBagsWorldHQ = building.isFloating || building.symbol === "BAGSWORLD";
      const isMansionBuilding = building.isMansion;

      if (isMansionBuilding) {
        // Mansion click - show holder info popup (modal handles Solscan link)
        window.dispatchEvent(
          new CustomEvent("bagsworld-mansion-click", {
            detail: {
              name: building.name,
              holderRank: building.holderRank,
              holderAddress: building.holderAddress,
              holderBalance: building.holderBalance,
            },
          })
        );
      } else if (isPokeCenter) {
        // PokeCenter opens the auto-claim hub modal
        window.dispatchEvent(
          new CustomEvent("bagsworld-pokecenter-click", {
            detail: { buildingId: building.id, name: building.name },
          })
        );
      } else if (isTradingGym) {
        // TradingGym opens the AI trading arena modal
        window.dispatchEvent(
          new CustomEvent("bagsworld-tradinggym-click", {
            detail: { buildingId: building.id, name: building.name },
          })
        );
      } else if (isCasino) {
        // Casino opens the gambling modal with raffle and wheel
        window.dispatchEvent(
          new CustomEvent("bagsworld-casino-click", {
            detail: { buildingId: building.id, name: building.name },
          })
        );
      } else if (isTradingTerminal) {
        // Trading Terminal opens the professional trading terminal modal
        window.dispatchEvent(
          new CustomEvent("bagsworld-terminal-click", {
            detail: { buildingId: building.id, name: building.name },
          })
        );
      } else if (isOracle) {
        // Oracle Tower opens the prediction market modal
        window.dispatchEvent(
          new CustomEvent("bagsworld-oracle-click", {
            detail: { buildingId: building.id, name: building.name },
          })
        );
      } else if (isBagsWorldHQ) {
        // BagsWorld HQ - opens the official token page with trade modal
        window.dispatchEvent(
          new CustomEvent("bagsworld-building-click", {
            detail: {
              mint: building.tokenMint || building.id,
              symbol: building.symbol || "BAGSWORLD",
              name: building.name || "BagsWorld HQ",
              tokenUrl: building.tokenUrl || `https://bags.fm/${building.tokenMint || building.id}`,
            },
          })
        );
      } else if (isStarterBuilding) {
        // Starter buildings do nothing when clicked - they're placeholders
      } else if (isTreasuryBuilding) {
        // Treasury building opens the Creator Rewards Hub modal
        window.dispatchEvent(
          new CustomEvent("bagsworld-treasury-click", {
            detail: { buildingId: building.id, name: building.name },
          })
        );
      } else {
        // Regular tokens emit event for React to open trade modal
        window.dispatchEvent(
          new CustomEvent("bagsworld-building-click", {
            detail: {
              mint: building.tokenMint || building.id,
              symbol: building.symbol || building.name,
              name: building.name,
              tokenUrl: building.tokenUrl,
            },
          })
        );
      }
    });

    this.buildingSprites.set(building.id, container);
    this.buildingInitialized.add(building.id);

    // Spawn animation only on first creation
    if (isFirstTimeCreation) {
      container.setScale(0);
      container.setAlpha(0);
      this.tweens.add({
        targets: container,
        scale: 1,
        alpha: 1,
        duration: 600,
        ease: "Back.easeOut",
      });
    }
  }

  private tooltip: Phaser.GameObjects.Container | null = null;

  private formatMarketCap(value: number): string {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  }

  private showCharacterTooltip(character: GameCharacter, sprite: Phaser.GameObjects.Sprite): void {
    this.hideTooltip();

    const container = this.add.container(sprite.x, sprite.y - 65);

    const bg = this.add.rectangle(0, 0, 180, 78, 0x0a0a0f, 0.95);
    bg.setStrokeStyle(2, 0x4ade80);

    const nameText = this.add.text(0, -18, `@${character.username}`, {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#ffffff",
    });
    nameText.setOrigin(0.5, 0.5);

    const providerText = this.add.text(
      0,
      -4,
      `${character.provider === "twitter" ? "𝕏" : character.provider}`,
      {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#9ca3af",
      }
    );
    providerText.setOrigin(0.5, 0.5);

    const earningsText = this.add.text(0, 10, `💰 $${character.earnings24h.toFixed(0)} (24h)`, {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#4ade80",
    });
    earningsText.setOrigin(0.5, 0.5);

    const clickText = this.add.text(0, 24, "Click to view profile", {
      fontFamily: "monospace",
      fontSize: "9px",
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

    const bg = this.add.rectangle(0, 0, 185, 78, 0x0a0a0f, 0.95);
    bg.setStrokeStyle(2, 0x9945ff); // Solana purple border

    const nameText = this.add.text(0, -22, "⚡ toly", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#14f195", // Solana green
    });
    nameText.setOrigin(0.5, 0.5);

    const titleText = this.add.text(0, -6, "Solana Co-Founder", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ffffff",
    });
    titleText.setOrigin(0.5, 0.5);

    const quoteText = this.add.text(0, 10, "Keep executing.", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#9ca3af",
    });
    quoteText.setOrigin(0.5, 0.5);

    const clickText = this.add.text(0, 26, "₿ Click for crypto wisdom", {
      fontFamily: "monospace",
      fontSize: "9px",
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

    const bg = this.add.rectangle(0, 0, 185, 78, 0x0a0a0f, 0.95);
    bg.setStrokeStyle(2, 0xdc2626); // Pokemon red border

    const nameText = this.add.text(0, -22, "⚡ Ash Ketchum", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#dc2626",
    });
    nameText.setOrigin(0.5, 0.5);

    const titleText = this.add.text(0, -6, "Ecosystem Guide", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ffffff",
    });
    titleText.setOrigin(0.5, 0.5);

    const descText = this.add.text(0, 10, "Gotta catch 'em all... tokens!", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#9ca3af",
    });
    descText.setOrigin(0.5, 0.5);

    const clickText = this.add.text(0, 26, "📖 Click to learn about BagsWorld", {
      fontFamily: "monospace",
      fontSize: "9px",
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

    const bg = this.add.rectangle(0, 0, 185, 78, 0x0a0a0f, 0.95);
    bg.setStrokeStyle(2, 0x10b981); // Emerald/Bags green border

    const nameText = this.add.text(0, -22, "💼 Finn", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#10b981",
    });
    nameText.setOrigin(0.5, 0.5);

    const titleText = this.add.text(0, -6, "Bags.fm Founder & CEO", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ffffff",
    });
    titleText.setOrigin(0.5, 0.5);

    const quoteText = this.add.text(0, 10, "Launch. Earn. Build your empire.", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#9ca3af",
    });
    quoteText.setOrigin(0.5, 0.5);

    const clickText = this.add.text(0, 26, "🚀 Click to learn about Bags.fm", {
      fontFamily: "monospace",
      fontSize: "9px",
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

    const bg = this.add.rectangle(0, 0, 185, 78, 0x0a0a0f, 0.95);
    bg.setStrokeStyle(2, 0x8b5cf6); // Purple border (hacker vibes)

    const nameText = this.add.text(0, -22, "👻 The Dev", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#8b5cf6",
    });
    nameText.setOrigin(0.5, 0.5);

    const titleText = this.add.text(0, -6, "@DaddyGhost • Trading Agent", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ffffff",
    });
    titleText.setOrigin(0.5, 0.5);

    const quoteText = this.add.text(0, 10, "in the trenches. let's trade.", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#9ca3af",
    });
    quoteText.setOrigin(0.5, 0.5);

    const clickText = this.add.text(0, 26, "💰 Click to talk trading", {
      fontFamily: "monospace",
      fontSize: "9px",
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
      fontSize: "12px",
      color: "#00ff41",
    });
    nameText.setOrigin(0.5, 0.5);

    const titleText = this.add.text(0, -6, "The One • Scout Agent", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ffffff",
    });
    titleText.setOrigin(0.5, 0.5);

    const quoteText = this.add.text(0, 10, "i can see the chain now...", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#9ca3af",
    });
    quoteText.setOrigin(0.5, 0.5);

    const clickText = this.add.text(0, 26, "Click to see new launches", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#00ff41",
    });
    clickText.setOrigin(0.5, 0.5);

    container.add([bg, nameText, titleText, quoteText, clickText]);
    container.setDepth(200);
    this.tooltip = container;
  }

  private showCJTooltip(sprite: Phaser.GameObjects.Sprite): void {
    this.hideTooltip();

    const container = this.add.container(sprite.x, sprite.y - 70);

    const bg = this.add.rectangle(0, 0, 180, 78, 0x1a0f00, 0.95);
    bg.setStrokeStyle(2, 0xf97316); // Grove Street orange border

    const nameText = this.add.text(0, -22, "CJ", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#f97316",
    });
    nameText.setOrigin(0.5, 0.5);

    const titleText = this.add.text(0, -6, "Hood Rat • BagsCity", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ffffff",
    });
    titleText.setOrigin(0.5, 0.5);

    const quoteText = this.add.text(0, 10, "aw shit here we go again", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#9ca3af",
    });
    quoteText.setOrigin(0.5, 0.5);

    const clickText = this.add.text(0, 26, "Click to talk", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#f97316",
    });
    clickText.setOrigin(0.5, 0.5);

    container.add([bg, nameText, titleText, quoteText, clickText]);
    container.setDepth(200);
    this.tooltip = container;
  }

  private showShawTooltip(sprite: Phaser.GameObjects.Sprite): void {
    this.hideTooltip();

    const container = this.add.container(sprite.x, sprite.y - 70);

    const bg = this.add.rectangle(0, 0, 180, 78, 0x1f1408, 0.95);
    bg.setStrokeStyle(2, 0xff5800); // ElizaOS orange border

    const nameText = this.add.text(0, -22, "🔶 Shaw", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#ff5800",
    });
    nameText.setOrigin(0.5, 0.5);

    const titleText = this.add.text(0, -6, "ElizaOS Creator • @shawmakesmagic", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ffffff",
    });
    titleText.setOrigin(0.5, 0.5);

    const quoteText = this.add.text(0, 10, "agents are digital life forms", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#9ca3af",
    });
    quoteText.setOrigin(0.5, 0.5);

    const clickText = this.add.text(0, 26, "Click to talk", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#ff5800",
    });
    clickText.setOrigin(0.5, 0.5);

    container.add([bg, nameText, titleText, quoteText, clickText]);
    container.setDepth(200);
    this.tooltip = container;
  }

  // Academy Character Tooltips
  private showRamoTooltip(sprite: Phaser.GameObjects.Sprite): void {
    this.hideTooltip();

    const container = this.add.container(sprite.x, sprite.y - 70);

    const bg = this.add.rectangle(0, 0, 180, 78, 0x0a1628, 0.95);
    bg.setStrokeStyle(2, 0x3b82f6); // Blue border

    const nameText = this.add.text(0, -22, "🔧 Ramo", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#3b82f6",
    });
    nameText.setOrigin(0.5, 0.5);

    const titleText = this.add.text(0, -6, "CTO • @ramyobags", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ffffff",
    });
    titleText.setOrigin(0.5, 0.5);

    const quoteText = this.add.text(0, 10, "the code does not lie", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#9ca3af",
    });
    quoteText.setOrigin(0.5, 0.5);

    const clickText = this.add.text(0, 26, "Click to talk", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#3b82f6",
    });
    clickText.setOrigin(0.5, 0.5);

    container.add([bg, nameText, titleText, quoteText, clickText]);
    container.setDepth(200);
    this.tooltip = container;
  }

  private showSincaraTooltip(sprite: Phaser.GameObjects.Sprite): void {
    this.hideTooltip();

    const container = this.add.container(sprite.x, sprite.y - 70);

    const bg = this.add.rectangle(0, 0, 180, 78, 0x1f0a1f, 0.95);
    bg.setStrokeStyle(2, 0xec4899); // Pink border

    const nameText = this.add.text(0, -22, "🎨 Sincara", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#ec4899",
    });
    nameText.setOrigin(0.5, 0.5);

    const titleText = this.add.text(0, -6, "Frontend Engineer • @sincara_bags", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ffffff",
    });
    titleText.setOrigin(0.5, 0.5);

    const quoteText = this.add.text(0, 10, "pixel-perfect or nothing", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#9ca3af",
    });
    quoteText.setOrigin(0.5, 0.5);

    const clickText = this.add.text(0, 26, "Click to talk", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#ec4899",
    });
    clickText.setOrigin(0.5, 0.5);

    container.add([bg, nameText, titleText, quoteText, clickText]);
    container.setDepth(200);
    this.tooltip = container;
  }

  private showStuuTooltip(sprite: Phaser.GameObjects.Sprite): void {
    this.hideTooltip();

    const container = this.add.container(sprite.x, sprite.y - 70);

    const bg = this.add.rectangle(0, 0, 180, 78, 0x0a1f0a, 0.95);
    bg.setStrokeStyle(2, 0x22c55e); // Green border

    const nameText = this.add.text(0, -22, "🎧 Stuu", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#22c55e",
    });
    nameText.setOrigin(0.5, 0.5);

    const titleText = this.add.text(0, -6, "Operations & Support • @StuuBags", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ffffff",
    });
    titleText.setOrigin(0.5, 0.5);

    const quoteText = this.add.text(0, 10, "happy users, happy life", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#9ca3af",
    });
    quoteText.setOrigin(0.5, 0.5);

    const clickText = this.add.text(0, 26, "Click to talk", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#22c55e",
    });
    clickText.setOrigin(0.5, 0.5);

    container.add([bg, nameText, titleText, quoteText, clickText]);
    container.setDepth(200);
    this.tooltip = container;
  }

  private showSamTooltip(sprite: Phaser.GameObjects.Sprite): void {
    this.hideTooltip();

    const container = this.add.container(sprite.x, sprite.y - 70);

    const bg = this.add.rectangle(0, 0, 180, 78, 0x1f1a0a, 0.95);
    bg.setStrokeStyle(2, 0xfbbf24); // Yellow border

    const nameText = this.add.text(0, -22, "📣 Sam", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#fbbf24",
    });
    nameText.setOrigin(0.5, 0.5);

    const titleText = this.add.text(0, -6, "Growth & Marketing • @Sambags12", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ffffff",
    });
    titleText.setOrigin(0.5, 0.5);

    const quoteText = this.add.text(0, 10, "make noise that converts", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#9ca3af",
    });
    quoteText.setOrigin(0.5, 0.5);

    const clickText = this.add.text(0, 26, "Click to talk", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#fbbf24",
    });
    clickText.setOrigin(0.5, 0.5);

    container.add([bg, nameText, titleText, quoteText, clickText]);
    container.setDepth(200);
    this.tooltip = container;
  }

  private showAlaaTooltip(sprite: Phaser.GameObjects.Sprite): void {
    this.hideTooltip();

    const container = this.add.container(sprite.x, sprite.y - 70);

    const bg = this.add.rectangle(0, 0, 180, 78, 0x0f0a1f, 0.95);
    bg.setStrokeStyle(2, 0x6366f1); // Indigo border

    const nameText = this.add.text(0, -22, "🦨 Alaa", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#6366f1",
    });
    nameText.setOrigin(0.5, 0.5);

    const titleText = this.add.text(0, -6, "Skunk Works • @alaadotsol", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ffffff",
    });
    titleText.setOrigin(0.5, 0.5);

    const quoteText = this.add.text(0, 10, "if it's crazy enough, it works", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#9ca3af",
    });
    quoteText.setOrigin(0.5, 0.5);

    const clickText = this.add.text(0, 26, "Click to talk", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#6366f1",
    });
    clickText.setOrigin(0.5, 0.5);

    container.add([bg, nameText, titleText, quoteText, clickText]);
    container.setDepth(200);
    this.tooltip = container;
  }

  private showCarloTooltip(sprite: Phaser.GameObjects.Sprite): void {
    this.hideTooltip();

    const container = this.add.container(sprite.x, sprite.y - 70);

    const bg = this.add.rectangle(0, 0, 180, 78, 0x1f0f0a, 0.95);
    bg.setStrokeStyle(2, 0xf97316); // Orange border

    const nameText = this.add.text(0, -22, "🤝 Carlo", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#f97316",
    });
    nameText.setOrigin(0.5, 0.5);

    const titleText = this.add.text(0, -6, "Community Ambassador • @carlobags", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ffffff",
    });
    titleText.setOrigin(0.5, 0.5);

    const quoteText = this.add.text(0, 10, "vibes are everything", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#9ca3af",
    });
    quoteText.setOrigin(0.5, 0.5);

    const clickText = this.add.text(0, 26, "Click to talk", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#f97316",
    });
    clickText.setOrigin(0.5, 0.5);

    container.add([bg, nameText, titleText, quoteText, clickText]);
    container.setDepth(200);
    this.tooltip = container;
  }

  private showBNNTooltip(sprite: Phaser.GameObjects.Sprite): void {
    this.hideTooltip();

    const container = this.add.container(sprite.x, sprite.y - 70);

    const bg = this.add.rectangle(0, 0, 180, 78, 0x0a1a1f, 0.95);
    bg.setStrokeStyle(2, 0x06b6d4); // Cyan border

    const nameText = this.add.text(0, -22, "📰 BNN", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#06b6d4",
    });
    nameText.setOrigin(0.5, 0.5);

    const titleText = this.add.text(0, -6, "Bags News Network • @BNNBags", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ffffff",
    });
    titleText.setOrigin(0.5, 0.5);

    const quoteText = this.add.text(0, 10, "breaking: alpha incoming", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#9ca3af",
    });
    quoteText.setOrigin(0.5, 0.5);

    const clickText = this.add.text(0, 26, "Click to talk", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#06b6d4",
    });
    clickText.setOrigin(0.5, 0.5);

    container.add([bg, nameText, titleText, quoteText, clickText]);
    container.setDepth(200);
    this.tooltip = container;
  }

  private showProfessorOakTooltip(sprite: Phaser.GameObjects.Sprite): void {
    this.hideTooltip();

    const container = this.add.container(sprite.x, sprite.y - 70);

    const bg = this.add.rectangle(0, 0, 200, 78, 0x1a1a0a, 0.95);
    bg.setStrokeStyle(2, 0xfbbf24); // Amber/gold border

    const nameText = this.add.text(0, -22, "🧪 Professor Oak", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#fbbf24",
    });
    nameText.setOrigin(0.5, 0.5);

    const titleText = this.add.text(0, -6, "Token Launch Guide", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ffffff",
    });
    titleText.setOrigin(0.5, 0.5);

    const quoteText = this.add.text(0, 10, '"Ready to launch your token?"', {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#9ca3af",
    });
    quoteText.setOrigin(0.5, 0.5);

    const clickText = this.add.text(0, 26, "Click to talk", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#fbbf24",
    });
    clickText.setOrigin(0.5, 0.5);

    container.add([bg, nameText, titleText, quoteText, clickText]);
    container.setDepth(200);
    this.tooltip = container;
  }

  private showBagsyTooltip(sprite: Phaser.GameObjects.Sprite): void {
    this.hideTooltip();

    const container = this.add.container(sprite.x, sprite.y - 70);

    const bg = this.add.rectangle(0, 0, 200, 78, 0x0a1a0a, 0.95);
    bg.setStrokeStyle(2, 0x00ff00); // Bright green border

    const nameText = this.add.text(0, -22, "💰 Bagsy", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#00ff00",
    });
    nameText.setOrigin(0.5, 0.5);

    const titleText = this.add.text(0, -6, "BagsWorld Hype Bot", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ffffff",
    });
    titleText.setOrigin(0.5, 0.5);

    const quoteText = this.add.text(0, 10, '"have u claimed ur fees today? :)"', {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#9ca3af",
    });
    quoteText.setOrigin(0.5, 0.5);

    const clickText = this.add.text(0, 26, "Click to talk", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#00ff00",
    });
    clickText.setOrigin(0.5, 0.5);

    container.add([bg, nameText, titleText, quoteText, clickText]);
    container.setDepth(200);
    this.tooltip = container;
  }

  private showOpenClawTooltip(
    character: GameCharacter,
    sprite: Phaser.GameObjects.Sprite,
    isMoltbookAgent: boolean
  ): void {
    this.hideTooltip();

    const container = this.add.container(sprite.x, sprite.y - 70);

    // Lobsters (Moltbook agents) get red theme, crabs get orange
    const borderColor = isMoltbookAgent ? 0xff4444 : 0xffa500;
    const textColor = isMoltbookAgent ? "#ff4444" : "#ffa500";
    const emoji = isMoltbookAgent ? "🦞" : "🦀";
    const typeLabel = isMoltbookAgent ? "Moltbook Agent" : "OpenClaw";

    const bg = this.add.rectangle(0, 0, 200, 78, 0x1a1a1a, 0.95);
    bg.setStrokeStyle(2, borderColor);

    const nameText = this.add.text(0, -22, `${emoji} ${character.username}`, {
      fontFamily: "monospace",
      fontSize: "12px",
      color: textColor,
    });
    nameText.setOrigin(0.5, 0.5);

    const titleText = this.add.text(0, -6, typeLabel, {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ffffff",
    });
    titleText.setOrigin(0.5, 0.5);

    // Show moltbook username if available
    const providerText = character.providerUsername
      ? `@${character.providerUsername}`
      : "External Agent";
    const quoteText = this.add.text(0, 10, providerText, {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#9ca3af",
    });
    quoteText.setOrigin(0.5, 0.5);

    const clickLabel = character.profileUrl
      ? "Click to view Moltbook"
      : "Moltbook Beach Resident";
    const clickText = this.add.text(0, 26, clickLabel, {
      fontFamily: "monospace",
      fontSize: "9px",
      color: textColor,
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

    // Determine border color based on building status
    const status = building.status || this.getStatusFromHealth(building.health);
    let borderColor = 0x4ade80; // Default green for active
    if (isTreasury) {
      borderColor = 0xfbbf24; // Gold for treasury
    } else if (building.isPermanent || building.isFloating) {
      borderColor = 0x4ade80; // Green for permanent buildings
    } else if (status === "dormant") {
      borderColor = 0x666666; // Gray for dormant
    } else if (status === "critical") {
      borderColor = 0xff6600; // Orange for critical
    } else if (status === "warning") {
      borderColor = 0xffcc00; // Yellow for warning
    }

    const bg = this.add.rectangle(0, 0, 140, 80, 0x0a0a0f, 0.95);
    bg.setStrokeStyle(2, borderColor);

    const nameText = this.add.text(0, -28, `${building.name}`, {
      fontFamily: "monospace",
      fontSize: "12px",
      color: isTreasury ? "#fbbf24" : "#ffffff",
    });
    nameText.setOrigin(0.5, 0.5);

    if (isTreasury) {
      // Community Fund tooltip
      const descText = this.add.text(0, -12, "Ghost's 5% Contribution", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#4ade80",
      });
      descText.setOrigin(0.5, 0.5);

      const breakdownText = this.add.text(0, 4, "Funds Casino, features & dev", {
        fontFamily: "monospace",
        fontSize: "6px",
        color: "#9ca3af",
        align: "center",
      });
      breakdownText.setOrigin(0.5, 0.5);

      const clickText = this.add.text(0, 24, "👻 Click to view fund", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#60a5fa",
      });
      clickText.setOrigin(0.5, 0.5);

      tooltipContainer.add([bg, nameText, descText, breakdownText, clickText]);
    } else {
      // Regular building tooltip
      const mcapDisplay = building.isPermanent
        ? "⭐ Landmark"
        : building.marketCap
          ? this.formatMarketCap(building.marketCap)
          : "N/A";
      const mcapText = this.add.text(0, -12, mcapDisplay, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: building.isPermanent ? "#fbbf24" : "#4ade80",
      });
      mcapText.setOrigin(0.5, 0.5);

      const levelLabels = ["Startup", "Growing", "Established", "Major", "Top Tier"];
      const levelLabel = levelLabels[building.level - 1] || `Level ${building.level}`;
      const levelText = this.add.text(0, 2, `⭐ ${levelLabel}`, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#fbbf24",
      });
      levelText.setOrigin(0.5, 0.5);

      const changeColor = (building.change24h ?? 0) >= 0 ? "#4ade80" : "#f87171";
      const changePrefix = (building.change24h ?? 0) >= 0 ? "+" : "";
      const changeText = this.add.text(
        0,
        16,
        `${changePrefix}${(building.change24h ?? 0).toFixed(0)}% (24h)`,
        {
          fontFamily: "monospace",
          fontSize: "10px",
          color: changeColor,
        }
      );
      changeText.setOrigin(0.5, 0.5);

      // Show decay status for non-permanent buildings
      let statusText: Phaser.GameObjects.Text | null = null;
      if (!building.isPermanent && !building.isFloating && status !== "active") {
        const statusMessages: Record<string, { text: string; color: string }> = {
          warning: { text: "Low activity", color: "#ffcc00" },
          critical: { text: "Decaying - needs volume", color: "#ff6600" },
          dormant: { text: "Dormant - no activity", color: "#666666" },
        };
        const statusInfo = statusMessages[status];
        if (statusInfo) {
          statusText = this.add.text(0, 28, statusInfo.text, {
            fontFamily: "monospace",
            fontSize: "8px",
            color: statusInfo.color,
          });
          statusText.setOrigin(0.5, 0.5);
        }
      }

      // Different action text for special buildings
      const isOracleBuilding = building.id.includes("Oracle") || building.symbol === "ORACLE";
      const isCasinoBuilding = building.id.includes("Casino") || building.symbol === "CASINO";
      const isTerminalBuilding = building.id.includes("Terminal") || building.symbol === "TERMINAL";
      const actionText =
        building.isMansion || isOracleBuilding || isCasinoBuilding || isTerminalBuilding
          ? "Enter"
          : "Click to trade";
      const actionColor =
        building.isMansion || isOracleBuilding || isCasinoBuilding || isTerminalBuilding
          ? "#fbbf24"
          : "#6b7280";
      const clickText = this.add.text(0, statusText ? 40 : 32, actionText, {
        fontFamily: "monospace",
        fontSize: "9px",
        color: actionColor,
      });
      clickText.setOrigin(0.5, 0.5);

      const tooltipElements = [bg, nameText, mcapText, levelText, changeText];
      if (statusText) tooltipElements.push(statusText);
      tooltipElements.push(clickText);
      tooltipContainer.add(tooltipElements);
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
        this.playCelebration(GAME_WIDTH / 2, Math.round(350 * SCALE));
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
        this.playCelebration(GAME_WIDTH / 2, Math.round(350 * SCALE));
        this.cameras.main.flash(400, 251, 191, 36, true);
        break;
    }
  }

  private playCelebration(x: number, y: number): void {
    // Coins (scaled)
    const coins = this.add.particles(x, y, "coin", {
      speed: { min: Math.round(150 * SCALE), max: Math.round(250 * SCALE) },
      angle: { min: 220, max: 320 },
      lifespan: 1500,
      quantity: 25,
      scale: { start: 1.2 * SCALE, end: 0 },
      gravityY: Math.round(300 * SCALE),
      rotate: { min: 0, max: 360 },
    });

    // Stars (scaled)
    const stars = this.add.particles(x, y, "star", {
      speed: { min: Math.round(100 * SCALE), max: Math.round(200 * SCALE) },
      angle: { min: 0, max: 360 },
      lifespan: 1200,
      quantity: 15,
      scale: { start: 0.8 * SCALE, end: 0 },
      alpha: { start: 1, end: 0 },
    });

    this.time.delayedCall(1500, () => {
      coins.destroy();
      stars.destroy();
    });
  }

  private playCoinsRain(): void {
    // Full screen coin rain effect
    const particles = this.add.particles(GAME_WIDTH / 2, 0, "coin", {
      x: { min: 0, max: GAME_WIDTH },
      y: Math.round(-20 * SCALE),
      lifespan: 3000,
      speedY: { min: Math.round(150 * SCALE), max: Math.round(300 * SCALE) },
      speedX: { min: Math.round(-50 * SCALE), max: Math.round(50 * SCALE) },
      scale: { start: SCALE * 1.2, end: 0.5 * SCALE },
      quantity: 100,
      frequency: -1,
      rotate: { min: 0, max: 360 },
    });

    particles.setDepth(100);
    particles.explode(100);

    this.time.delayedCall(3000, () => {
      particles.destroy();
    });
  }

  private playStarBurst(): void {
    const particles = this.add.particles(GAME_WIDTH / 2, Math.round(300 * SCALE), "star", {
      speed: { min: Math.round(200 * SCALE), max: Math.round(400 * SCALE) },
      angle: { min: 0, max: 360 },
      lifespan: 1000,
      quantity: 20,
      scale: { start: SCALE, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0x4ade80, 0xfbbf24, 0x60a5fa],
    });

    particles.explode(20);

    this.time.delayedCall(1000, () => {
      particles.destroy();
    });
  }

  // Animal control methods for Bags Bot (scaled positions)
  moveAnimalTo(animalType: Animal["type"], targetX: number): void {
    const animal = this.animals.find((a) => a.type === animalType);
    if (animal) {
      animal.targetX = Math.max(Math.round(50 * SCALE), Math.min(Math.round(750 * SCALE), targetX));
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

      // Happy bounce animation (scaled)
      this.tweens.add({
        targets: animal.sprite,
        y: animal.sprite.y - Math.round(15 * SCALE),
        duration: 200,
        yoyo: true,
        repeat: 2,
        ease: "Bounce.easeOut",
      });

      // Hearts effect (scaled)
      const hearts = this.add.particles(
        animal.sprite.x,
        animal.sprite.y - Math.round(20 * SCALE),
        "star",
        {
          speed: { min: Math.round(30 * SCALE), max: Math.round(60 * SCALE) },
          angle: { min: 220, max: 320 },
          lifespan: 1000,
          quantity: 5,
          scale: { start: 0.5 * SCALE, end: 0 },
          alpha: { start: 1, end: 0 },
          tint: 0xff69b4,
        }
      );

      hearts.explode(5);

      this.time.delayedCall(1000, () => {
        hearts.destroy();
      });
    }
  }

  scareAnimal(animalType: Animal["type"]): void {
    const animal = this.animals.find((a) => a.type === animalType);
    if (animal) {
      // Run away to random side (scaled)
      animal.isIdle = false;
      animal.targetX =
        animal.sprite.x > GAME_WIDTH / 2 ? Math.round(50 * SCALE) : Math.round(750 * SCALE);
      animal.speed = animal.speed * 3; // Temporarily faster

      // Shake animation (scaled)
      this.tweens.add({
        targets: animal.sprite,
        x: animal.sprite.x + Math.round(5 * SCALE),
        duration: 50,
        yoyo: true,
        repeat: 4,
      });

      // Reset speed after 2 seconds (scaled)
      this.time.delayedCall(2000, () => {
        animal.speed =
          animal.type === "butterfly"
            ? 0.3 * SCALE
            : animal.type === "bird"
              ? 0.5 * SCALE
              : 0.2 * SCALE;
      });
    }
  }

  callAnimal(animalType: Animal["type"], targetX: number): void {
    const animal = this.animals.find((a) => a.type === animalType);
    if (animal) {
      animal.targetX = Math.max(Math.round(50 * SCALE), Math.min(Math.round(750 * SCALE), targetX));
      animal.isIdle = false;
      animal.direction = animal.targetX > animal.sprite.x ? "right" : "left";
      animal.speed = animal.speed * 1.5; // Move a bit faster when called

      // Reset speed after reaching target (scaled)
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
    const { effectType, x = GAME_WIDTH / 2, y = Math.round(300 * SCALE) } = event.detail || {};

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
      case "ufo":
        this.playUFO();
        break;
      default:
        break;
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
      case "chase": // Chase is similar to scare
        this.scareAnimal(animalType);
        break;
      case "call":
        this.callAnimal(animalType, GAME_WIDTH / 2); // Call to center
        break;
      case "feed":
        this.feedAnimal(animalType);
        break;
      default:
        this.petAnimal(animalType); // Default to pet
    }
  }

  private handleBotPokemon(event: CustomEvent): void {
    const { pokemonType, pokemonAction } = event.detail || {};

    if (!pokemonType) return;

    switch (pokemonAction) {
      case "pet":
      case "play":
        this.petPokemon(pokemonType);
        break;
      case "call":
        this.callPokemon(pokemonType);
        break;
      default:
        this.petPokemon(pokemonType);
    }
  }

  // Pet/play with a Pokemon - happy reaction with particles
  petPokemon(pokemonType: Pokemon["type"]): void {
    const poke = this.pokemon.find((p) => p.type === pokemonType);
    if (!poke || !poke.sprite.active) return;

    // Stop moving and react happily
    poke.isIdle = true;
    poke.idleTimer = 0;

    // Happy jump animation
    this.tweens.add({
      targets: poke.sprite,
      y: poke.baseY - Math.round(20 * SCALE),
      scaleX: poke.sprite.scaleX * 1.15,
      scaleY: poke.sprite.scaleY * 0.85,
      duration: 150,
      yoyo: true,
      repeat: 2,
      ease: "Bounce.easeOut",
      onComplete: () => {
        poke.sprite.y = poke.baseY;
      },
    });

    // Happy particles (hearts and stars)
    const particles = this.add.particles(
      poke.sprite.x,
      poke.sprite.y - Math.round(15 * SCALE),
      "star",
      {
        speed: { min: Math.round(30 * SCALE), max: Math.round(80 * SCALE) },
        angle: { min: 200, max: 340 },
        lifespan: 1000,
        quantity: 8,
        scale: { start: 0.6 * SCALE, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [0xffcc00, 0xff6699, 0x66ffcc], // Gold, pink, teal for Pokemon vibes
        gravityY: Math.round(-20 * SCALE),
      }
    );

    particles.explode(8);

    this.time.delayedCall(1200, () => {
      particles.destroy();
    });

    // Screen flash for extra feedback
    this.cameras.main.flash(100, 255, 255, 200, true);
  }

  // Call a Pokemon - make it come to center
  callPokemon(pokemonType: Pokemon["type"]): void {
    const poke = this.pokemon.find((p) => p.type === pokemonType);
    if (!poke || !poke.sprite.active) return;

    // Move to center
    poke.isIdle = false;
    poke.targetX = GAME_WIDTH / 2;
    poke.direction = poke.targetX > poke.sprite.x ? "right" : "left";

    // Little attention animation
    this.tweens.add({
      targets: poke.sprite,
      angle: { from: -5, to: 5 },
      duration: 100,
      yoyo: true,
      repeat: 2,
    });
  }

  // Feed animal - similar to pet but with food particle (scaled)
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

      // Food particles (using star as food, scaled)
      const food = this.add.particles(
        animal.sprite.x,
        animal.sprite.y - Math.round(10 * SCALE),
        "star",
        {
          speed: { min: Math.round(10 * SCALE), max: Math.round(30 * SCALE) },
          angle: { min: 220, max: 320 },
          lifespan: 800,
          quantity: 3,
          scale: { start: 0.3 * SCALE, end: 0 },
          alpha: { start: 1, end: 0 },
          tint: 0xffd700,
        }
      );

      food.explode(3);

      this.time.delayedCall(800, () => {
        food.destroy();
      });
    }
  }

  // Fireworks effect - multiple bursts in the sky (scaled)
  playFireworks(x: number = GAME_WIDTH / 2, y: number = Math.round(200 * SCALE)): void {
    const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xffffff];

    // Launch multiple firework bursts (scaled)
    for (let i = 0; i < 5; i++) {
      this.time.delayedCall(i * 300, () => {
        const burstX = x + (Math.random() - 0.5) * Math.round(400 * SCALE);
        const burstY = y + (Math.random() - 0.5) * Math.round(100 * SCALE);
        const color = colors[Math.floor(Math.random() * colors.length)];

        // Flash effect
        this.cameras.main.flash(50, 255, 255, 255, true);

        // Firework burst (scaled)
        const burst = this.add.particles(burstX, burstY, "star", {
          speed: { min: Math.round(100 * SCALE), max: Math.round(200 * SCALE) },
          angle: { min: 0, max: 360 },
          lifespan: 1200,
          quantity: 30,
          scale: { start: 0.8 * SCALE, end: 0 },
          alpha: { start: 1, end: 0 },
          tint: color,
          gravityY: Math.round(100 * SCALE),
          blendMode: Phaser.BlendModes.ADD,
        });

        burst.explode(30);

        // Sparkle trail (scaled)
        const trail = this.add.particles(burstX, burstY, "coin", {
          speed: { min: Math.round(50 * SCALE), max: Math.round(150 * SCALE) },
          angle: { min: 0, max: 360 },
          lifespan: 800,
          quantity: 15,
          scale: { start: 0.4 * SCALE, end: 0 },
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

  // Hearts floating effect (scaled)
  playHeartsEffect(x: number = GAME_WIDTH / 2, y: number = Math.round(300 * SCALE)): void {
    // Create hearts using star particles with pink tint (scaled)
    const hearts = this.add.particles(x, y, "star", {
      speed: { min: Math.round(30 * SCALE), max: Math.round(80 * SCALE) },
      angle: { min: 220, max: 320 },
      lifespan: 2000,
      quantity: 20,
      scale: { start: 0.8 * SCALE, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xff69b4, 0xff1493, 0xff6b6b, 0xffb6c1],
      gravityY: Math.round(-30 * SCALE), // Float upward
    });

    hearts.explode(20);

    // Screen tint
    this.cameras.main.flash(200, 255, 182, 193, true);

    this.time.delayedCall(2500, () => {
      hearts.destroy();
    });
  }

  // Confetti effect - colorful particles falling from top (scaled)
  playConfetti(): void {
    const confetti = this.add.particles(GAME_WIDTH / 2, Math.round(-20 * SCALE), "star", {
      x: { min: 0, max: GAME_WIDTH },
      y: Math.round(-20 * SCALE),
      lifespan: 4000,
      speedY: { min: Math.round(100 * SCALE), max: Math.round(200 * SCALE) },
      speedX: { min: Math.round(-80 * SCALE), max: Math.round(80 * SCALE) },
      scale: { start: 0.8 * SCALE, end: 0.3 * SCALE },
      alpha: { start: 1, end: 0.5 },
      tint: [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xffa500, 0x4ade80],
      rotate: { min: 0, max: 360 },
      quantity: 8,
      frequency: 30,
      gravityY: Math.round(50 * SCALE),
    });

    confetti.setDepth(100);

    // Stop after 4 seconds
    this.time.delayedCall(4000, () => {
      confetti.stop();
    });

    // Destroy after particles fade
    this.time.delayedCall(8000, () => {
      confetti.destroy();
    });
  }

  // UFO flyby effect - alien saucer flies across screen with beam
  playUFO(): void {
    // Create UFO sprite using graphics
    const ufoG = this.make.graphics({ x: 0, y: 0 });
    const ufoSize = Math.round(60 * SCALE);

    // Draw UFO saucer
    ufoG.fillStyle(0x888888);
    ufoG.fillEllipse(ufoSize / 2, ufoSize / 2 + 5, ufoSize, ufoSize / 3); // Body
    ufoG.fillStyle(0x4ade80);
    ufoG.fillEllipse(ufoSize / 2, ufoSize / 2, ufoSize / 2, ufoSize / 4); // Dome
    ufoG.fillStyle(0x00ff00);
    ufoG.fillCircle(ufoSize / 2, ufoSize / 2, 5); // Light

    // Lights on bottom
    ufoG.fillStyle(0xff0000);
    ufoG.fillCircle(ufoSize / 4, ufoSize / 2 + 8, 3);
    ufoG.fillStyle(0xffff00);
    ufoG.fillCircle(ufoSize / 2, ufoSize / 2 + 10, 3);
    ufoG.fillStyle(0x0000ff);
    ufoG.fillCircle((ufoSize * 3) / 4, ufoSize / 2 + 8, 3);

    ufoG.generateTexture("ufo_temp", ufoSize, ufoSize);
    ufoG.destroy();

    // Create UFO sprite starting off-screen left
    const ufo = this.add.sprite(-100, Math.round(100 * SCALE), "ufo_temp");
    ufo.setDepth(150);

    // Create beam effect
    const beam = this.add.graphics();
    beam.setDepth(149);

    // Animate UFO across screen with wobble
    this.tweens.add({
      targets: ufo,
      x: GAME_WIDTH + 100,
      y: {
        value: Math.round(150 * SCALE),
        duration: 4000,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: 1,
      },
      duration: 8000,
      ease: "Linear",
      onUpdate: () => {
        // Update beam position
        beam.clear();
        if (ufo.x > 100 && ufo.x < GAME_WIDTH - 100) {
          beam.fillStyle(0x00ff00, 0.3);
          beam.fillTriangle(ufo.x - 15, ufo.y + 20, ufo.x + 15, ufo.y + 20, ufo.x, GAME_HEIGHT);
        }
        // Rotate UFO slightly
        ufo.angle = Math.sin(Date.now() / 200) * 5;
      },
      onComplete: () => {
        ufo.destroy();
        beam.destroy();
        this.textures.remove("ufo_temp");
      },
    });

    // Add abduction particles
    const abductionParticles = this.add.particles(GAME_WIDTH / 2, GAME_HEIGHT - 100, "star", {
      speed: { min: 50, max: 150 },
      angle: { min: 260, max: 280 },
      lifespan: 2000,
      scale: { start: 0.5, end: 0 },
      tint: 0x00ff00,
      alpha: { start: 0.8, end: 0 },
      quantity: 2,
      frequency: 100,
    });
    abductionParticles.setDepth(148);

    // Update particle position to follow UFO
    const particleUpdate = this.time.addEvent({
      delay: 50,
      callback: () => {
        if (ufo.x > 0 && ufo.x < GAME_WIDTH) {
          abductionParticles.setPosition(ufo.x, GAME_HEIGHT - 100);
        }
      },
      loop: true,
    });

    this.time.delayedCall(8000, () => {
      particleUpdate.destroy();
      abductionParticles.destroy();
    });

    // Screen flash when UFO enters
    this.cameras.main.flash(200, 0, 255, 0, true);
  }

  // Show announcement banner (scaled)
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

    // Create background (scaled)
    this.announcementBg = this.add.rectangle(
      GAME_WIDTH / 2,
      Math.round(50 * SCALE),
      Math.round(600 * SCALE),
      Math.round(40 * SCALE),
      0x000000,
      0.8
    );
    this.announcementBg.setStrokeStyle(Math.round(2 * SCALE), 0x4ade80);
    this.announcementBg.setDepth(300);
    this.announcementBg.setAlpha(0);

    // Create text (scaled font)
    this.announcementText = this.add.text(GAME_WIDTH / 2, Math.round(50 * SCALE), text, {
      fontFamily: "monospace",
      fontSize: `${Math.round(14 * SCALE)}px`,
      color: "#4ade80",
      align: "center",
    });
    this.announcementText.setOrigin(0.5, 0.5);
    this.announcementText.setDepth(301);
    this.announcementText.setAlpha(0);

    // Animate in (scaled)
    this.tweens.add({
      targets: [this.announcementBg, this.announcementText],
      alpha: 1,
      y: Math.round(60 * SCALE),
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
          },
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
    const walkRange = isSpecial ? Math.round(60 * SCALE) : Math.round(100 * SCALE); // How far they can walk from starting position
    const minX = Math.max(Math.round(80 * SCALE), character.x - walkRange);
    const maxX = Math.min(Math.round(720 * SCALE), character.x + walkRange);

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
    const duration = (distance / speed) * 16; // Convert to ms based on speed

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

  // ========================================
  // MOLTBOOK ARENA ZONE
  // Real-time brawl zone for AI agent battles
  // ========================================

  /**
   * Setup MoltBook Arena zone - spectator arena for AI battles
   */
  private setupArenaZone(): void {
    // Hide park decorations and animals (they belong to main_city)
    this.decorations.forEach((d) => d.setVisible(false));
    this.animals.forEach((a) => a.sprite.setVisible(false));

    // Hide fountain water spray
    if (this.fountainWater) {
      this.fountainWater.setVisible(false);
    }

    // IMPORTANT: Hide other zone elements (prevents visual overlap)
    this.trendingElements.forEach((el) => (el as any).setVisible(false));
    this.skylineSprites.forEach((s) => s.setVisible(false));
    this.billboardTexts.forEach((t) => t.setVisible(false));
    if (this.tickerText) this.tickerText.setVisible(false);
    this.academyElements.forEach((el) => (el as any).setVisible(false));
    this.academyBuildings.forEach((s) => s.setVisible(false));
    this.ballersElements.forEach((el) => (el as any).setVisible(false));
    this.foundersElements.forEach((el) => (el as any).setVisible(false));
    this.labsElements.forEach((el) => (el as any).setVisible(false));
    if (this.foundersPopup) {
      this.foundersPopup.destroy();
      this.foundersPopup = null;
    }

    // Create arena sky (dark stadium atmosphere)
    this.createArenaSky();

    // Swap ground texture to arena floor
    this.ground.setVisible(true);
    this.ground.setTexture("arena_floor");

    // Check if elements were destroyed (can happen during transitions)
    const elementsValid =
      this.arenaElements.length > 0 &&
      this.arenaElements.every((el) => (el as any).active !== false);

    if (!elementsValid && this.arenaZoneCreated) {
      this.arenaElements = [];
      this.arenaZoneCreated = false;
    }

    // Only create elements once, then just show them
    if (!this.arenaZoneCreated) {
      this.createArenaDecorations();
      this.arenaZoneCreated = true;
    } else {
      // Subsequent times - just show existing elements
      this.arenaElements.forEach((el) => (el as any).setVisible(true));
    }

    // Connect to arena WebSocket
    this.connectArenaWebSocket();
  }

  /**
   * Create dark stadium sky for Arena zone
   */
  private createArenaSky(): void {
    // Hide normal sky elements for a darker arena atmosphere
    this.restoreNormalSky();
    // The arena has a dark stadium feel - no special sky needed
  }

  /**
   * Create Arena decorations - fighting ring, stands, lights, props
   * Following zone guide: 20+ props, textured ground, proper depths
   */
  private createArenaDecorations(): void {
    const s = SCALE;
    const grassTop = Math.round(455 * s);
    const pathLevel = Math.round(555 * s);
    const centerX = GAME_WIDTH / 2;

    // === BACKGROUND TREES (depth 2) - Dark silhouettes ===
    const treePositions = [
      { x: 50, yOffset: 0 },
      { x: 140, yOffset: 5 },
      { x: 230, yOffset: -3 },
      { x: 570, yOffset: 2 },
      { x: 660, yOffset: 6 },
      { x: 750, yOffset: -2 },
    ];

    treePositions.forEach((pos) => {
      const tree = this.add.sprite(Math.round(pos.x * s), grassTop + pos.yOffset, "tree");
      tree.setOrigin(0.5, 1);
      tree.setDepth(2);
      tree.setScale(0.85 + Math.random() * 0.25);
      tree.setTint(0x1a1a2e); // Dark tint for arena atmosphere
      this.arenaElements.push(tree);
    });

    // === BUSHES/HEDGES (depth 2) ===
    const bushPositions = [
      { x: 90, yOffset: 25 },
      { x: 180, yOffset: 22 },
      { x: 620, yOffset: 27 },
      { x: 710, yOffset: 24 },
    ];

    bushPositions.forEach((pos) => {
      const bush = this.add.sprite(Math.round(pos.x * s), grassTop + pos.yOffset, "bush");
      bush.setOrigin(0.5, 1);
      bush.setDepth(2);
      bush.setScale(0.7 + Math.random() * 0.2);
      bush.setTint(0x1e3a8a); // Dark blue tint
      this.arenaElements.push(bush);
    });

    // === SPECTATOR STANDS (depth 2) - Left side ===
    const leftStands = this.add.sprite(Math.round(120 * s), Math.round(500 * s), "arena_stands");
    leftStands.setOrigin(0.5, 1);
    leftStands.setDepth(2);
    leftStands.setScale(1.2);
    this.arenaElements.push(leftStands);

    // === SPECTATOR STANDS (depth 2) - Right side ===
    const rightStands = this.add.sprite(Math.round(680 * s), Math.round(500 * s), "arena_stands");
    rightStands.setOrigin(0.5, 1);
    rightStands.setDepth(2);
    rightStands.setScale(1.2);
    rightStands.setFlipX(true);
    this.arenaElements.push(rightStands);

    // === ANIMATED CROWD ON STANDS (depth 2.5) ===
    this.arenaCrowdSprites = []; // Reset crowd array
    const crowdPositions = [
      // Left stands
      { x: 60, y: 480 },
      { x: 90, y: 475 },
      { x: 120, y: 478 },
      { x: 150, y: 472 },
      { x: 80, y: 490 },
      { x: 110, y: 488 },
      { x: 140, y: 485 },
      // Right stands
      { x: 650, y: 480 },
      { x: 680, y: 475 },
      { x: 710, y: 478 },
      { x: 740, y: 472 },
      { x: 660, y: 490 },
      { x: 690, y: 488 },
      { x: 720, y: 485 },
    ];

    crowdPositions.forEach((pos, i) => {
      const variant = i % 4;
      const crowd = this.add.sprite(
        Math.round(pos.x * s),
        Math.round(pos.y * s),
        `arena_crowd_idle_${variant}`
      );
      crowd.setOrigin(0.5, 1);
      crowd.setDepth(2.5);
      crowd.setScale(0.9 + Math.random() * 0.2);
      crowd.setData("variant", variant);
      this.arenaElements.push(crowd);
      this.arenaCrowdSprites.push(crowd);

      // Idle bob animation (subtle up/down)
      this.tweens.add({
        targets: crowd,
        y: crowd.y - Math.round(3 * s),
        duration: 1200 + Math.random() * 400,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
        delay: Math.random() * 500,
      });
    });

    // === SPOTLIGHT CONES (depth 1, behind ring) ===
    this.arenaSpotlightCones = [];
    const spotlightPositions = [200, 400, 600];
    spotlightPositions.forEach((lx) => {
      const cone = this.add.sprite(Math.round(lx * s), Math.round(50 * s), "arena_spotlight_cone");
      cone.setOrigin(0.5, 0);
      cone.setDepth(1);
      cone.setAlpha(0.6);
      this.arenaElements.push(cone);
      this.arenaSpotlightCones.push(cone);

      // Subtle angle sway animation
      this.tweens.add({
        targets: cone,
        angle: { from: -3, to: 3 },
        duration: 2000 + Math.random() * 500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
        delay: Math.random() * 1000,
      });
    });

    // === COLORED CORNER POSTS (depth 4) ===
    // Red corner (left fighter spawn point)
    const redCorner = this.add.sprite(
      Math.round(280 * s),
      pathLevel + Math.round(5 * s),
      "arena_corner_red"
    );
    redCorner.setOrigin(0.5, 1);
    redCorner.setDepth(4);
    this.arenaElements.push(redCorner);

    // Blue corner (right fighter spawn point)
    const blueCorner = this.add.sprite(
      Math.round(520 * s),
      pathLevel + Math.round(5 * s),
      "arena_corner_blue"
    );
    blueCorner.setOrigin(0.5, 1);
    blueCorner.setDepth(4);
    this.arenaElements.push(blueCorner);

    // === BARRIER POSTS (depth 3) - Around the ring ===
    const barrierPositions = [260, 340, 460, 540];
    barrierPositions.forEach((bx) => {
      // Post
      const post = this.add.rectangle(
        Math.round(bx * s),
        pathLevel - Math.round(5 * s),
        Math.round(6 * s),
        Math.round(40 * s),
        0x374151
      );
      post.setOrigin(0.5, 1);
      post.setDepth(3);
      this.arenaElements.push(post);

      // Post cap (gold)
      const cap = this.add.rectangle(
        Math.round(bx * s),
        pathLevel - Math.round(43 * s),
        Math.round(10 * s),
        Math.round(6 * s),
        0xfbbf24
      );
      cap.setOrigin(0.5, 1);
      cap.setDepth(3);
      this.arenaElements.push(cap);
    });

    // === ROPE BARRIERS (depth 3) - with sway animation ===
    // Left rope
    const leftRope = this.add.rectangle(
      Math.round(300 * s),
      pathLevel - Math.round(25 * s),
      Math.round(80 * s),
      Math.round(4 * s),
      0xef4444
    );
    leftRope.setDepth(3);
    this.arenaElements.push(leftRope);

    // Left rope sway animation
    this.tweens.add({
      targets: leftRope,
      scaleY: { from: 1, to: 0.92 },
      duration: 800 + Math.random() * 200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Right rope
    const rightRope = this.add.rectangle(
      Math.round(500 * s),
      pathLevel - Math.round(25 * s),
      Math.round(80 * s),
      Math.round(4 * s),
      0xef4444
    );
    rightRope.setDepth(3);
    this.arenaElements.push(rightRope);

    // Right rope sway animation
    this.tweens.add({
      targets: rightRope,
      scaleY: { from: 1, to: 0.92 },
      duration: 900 + Math.random() * 200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: 150,
    });

    // === ARENA RING (depth 4) - Center ===
    const ring = this.add.sprite(centerX, pathLevel + Math.round(20 * s), "arena_ring");
    ring.setOrigin(0.5, 1);
    ring.setDepth(4);
    this.arenaElements.push(ring);

    // === LAMP POSTS (depth 3) ===
    const lampPositions = [80, 280, 520, 720];
    lampPositions.forEach((lx) => {
      // Lamp pole
      const pole = this.add.rectangle(
        Math.round(lx * s),
        pathLevel,
        Math.round(4 * s),
        Math.round(60 * s),
        0x1f2937
      );
      pole.setOrigin(0.5, 1);
      pole.setDepth(3);
      this.arenaElements.push(pole);

      // Lamp head
      const head = this.add.rectangle(
        Math.round(lx * s),
        pathLevel - Math.round(60 * s),
        Math.round(12 * s),
        Math.round(8 * s),
        0x374151
      );
      head.setOrigin(0.5, 0.5);
      head.setDepth(3);
      this.arenaElements.push(head);

      // Lamp glow
      const glow = this.add.ellipse(
        Math.round(lx * s),
        pathLevel - Math.round(50 * s),
        Math.round(20 * s),
        Math.round(30 * s),
        0xfbbf24,
        0.15
      );
      glow.setDepth(3);
      this.arenaElements.push(glow);

      // Glow animation
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.1, to: 0.2 },
        duration: 1000 + Math.random() * 500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });

    // === BENCHES (depth 3) ===
    const benchPositions = [160, 640];
    benchPositions.forEach((bx) => {
      // Bench seat
      const seat = this.add.rectangle(
        Math.round(bx * s),
        pathLevel - Math.round(8 * s),
        Math.round(40 * s),
        Math.round(6 * s),
        0x78350f
      );
      seat.setOrigin(0.5, 0.5);
      seat.setDepth(3);
      this.arenaElements.push(seat);

      // Bench legs
      const leg1 = this.add.rectangle(
        Math.round((bx - 15) * s),
        pathLevel,
        Math.round(4 * s),
        Math.round(12 * s),
        0x451a03
      );
      leg1.setOrigin(0.5, 1);
      leg1.setDepth(3);
      this.arenaElements.push(leg1);

      const leg2 = this.add.rectangle(
        Math.round((bx + 15) * s),
        pathLevel,
        Math.round(4 * s),
        Math.round(12 * s),
        0x451a03
      );
      leg2.setOrigin(0.5, 1);
      leg2.setDepth(3);
      this.arenaElements.push(leg2);
    });

    // === STADIUM LIGHTS (depth 15) ===
    const lightPositions = [Math.round(200 * s), Math.round(400 * s), Math.round(600 * s)];
    lightPositions.forEach((lx) => {
      const light = this.add.sprite(lx, Math.round(50 * s), "arena_light");
      light.setOrigin(0.5, 0);
      light.setDepth(15);
      this.arenaElements.push(light);

      // Flickering light effect
      this.tweens.add({
        targets: light,
        alpha: { from: 0.9, to: 1 },
        duration: 200 + Math.random() * 300,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });

    // === DECORATIVE FLAGS (depth 4) ===
    const flagColors = [0xef4444, 0xfbbf24, 0x4ade80, 0x3b82f6];
    const flagPositions = [120, 220, 580, 680];
    flagPositions.forEach((fx, i) => {
      // Flag pole
      const flagPole = this.add.rectangle(
        Math.round(fx * s),
        grassTop + Math.round(30 * s),
        Math.round(3 * s),
        Math.round(50 * s),
        0x6b7280
      );
      flagPole.setOrigin(0.5, 1);
      flagPole.setDepth(4);
      this.arenaElements.push(flagPole);

      // Flag
      const flag = this.add.rectangle(
        Math.round((fx + 10) * s),
        grassTop - Math.round(12 * s),
        Math.round(20 * s),
        Math.round(14 * s),
        flagColors[i % flagColors.length]
      );
      flag.setOrigin(0, 0.5);
      flag.setDepth(4);
      this.arenaElements.push(flag);

      // Flag wave animation
      this.tweens.add({
        targets: flag,
        scaleX: { from: 1, to: 0.9 },
        duration: 800 + Math.random() * 400,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });

    // === LOGO MAT - Center ring with $ symbol ===
    const logoMat = this.add.sprite(centerX, pathLevel + Math.round(10 * s), "arena_logo_mat");
    logoMat.setOrigin(0.5, 0.5);
    logoMat.setDepth(1);
    logoMat.setAlpha(0.9);
    this.arenaElements.push(logoMat);

    // === INFO BUTTON (opens ArenaModal with copyable instructions) ===
    // Positioned next to the MATCH status box (top right area)
    const infoBtnX = Math.round(700 * s) + Math.round(75 * s);
    const infoBtnY = Math.round(80 * s);
    const infoBtn = this.add.rectangle(
      infoBtnX,
      infoBtnY,
      Math.round(24 * s),
      Math.round(20 * s),
      0xdc2626,
      1
    );
    infoBtn.setDepth(101);
    infoBtn.setStrokeStyle(1, 0xfbbf24);
    infoBtn.setInteractive({ useHandCursor: true });
    infoBtn.on("pointerover", () => infoBtn.setFillStyle(0xef4444));
    infoBtn.on("pointerout", () => infoBtn.setFillStyle(0xdc2626));
    infoBtn.on("pointerdown", () => {
      window.dispatchEvent(new CustomEvent("bagsworld-arena-click"));
    });
    this.arenaElements.push(infoBtn);

    const infoText = this.add.text(infoBtnX, infoBtnY, "?", {
      fontFamily: "monospace",
      fontSize: `${Math.round(12 * s)}px`,
      color: "#ffffff",
      fontStyle: "bold",
    });
    infoText.setOrigin(0.5, 0.5);
    infoText.setDepth(102);
    this.arenaElements.push(infoText);

    // === QUEUE STATUS (depth 100) ===
    const queueBg = this.add.rectangle(
      Math.round(100 * s),
      Math.round(80 * s),
      Math.round(120 * s),
      Math.round(50 * s),
      0x0a0a0f,
      0.8
    );
    queueBg.setDepth(100);
    queueBg.setStrokeStyle(1, 0x4ade80);
    this.arenaElements.push(queueBg);

    const queueLabel = this.add.text(Math.round(100 * s), Math.round(65 * s), "QUEUE", {
      fontFamily: "monospace",
      fontSize: `${Math.round(8 * s)}px`,
      color: "#4ade80",
    });
    queueLabel.setOrigin(0.5, 0.5);
    queueLabel.setDepth(101);
    this.arenaElements.push(queueLabel);

    const queueCount = this.add.text(Math.round(100 * s), Math.round(88 * s), "0 WAITING", {
      fontFamily: "monospace",
      fontSize: `${Math.round(10 * s)}px`,
      color: "#ffffff",
    });
    queueCount.setOrigin(0.5, 0.5);
    queueCount.setDepth(101);
    queueCount.setName("arenaQueueCount");
    this.arenaElements.push(queueCount);

    // === MATCH STATUS (depth 100) ===
    const matchBg = this.add.rectangle(
      Math.round(700 * s),
      Math.round(80 * s),
      Math.round(120 * s),
      Math.round(50 * s),
      0x0a0a0f,
      0.8
    );
    matchBg.setDepth(100);
    matchBg.setStrokeStyle(1, 0xef4444);
    this.arenaElements.push(matchBg);

    const matchLabel = this.add.text(Math.round(700 * s), Math.round(65 * s), "MATCH", {
      fontFamily: "monospace",
      fontSize: `${Math.round(8 * s)}px`,
      color: "#ef4444",
    });
    matchLabel.setOrigin(0.5, 0.5);
    matchLabel.setDepth(101);
    this.arenaElements.push(matchLabel);

    const matchStatus = this.add.text(Math.round(700 * s), Math.round(88 * s), "NO MATCH", {
      fontFamily: "monospace",
      fontSize: `${Math.round(10 * s)}px`,
      color: "#ffffff",
    });
    matchStatus.setOrigin(0.5, 0.5);
    matchStatus.setDepth(101);
    matchStatus.setName("arenaMatchStatus");
    this.arenaElements.push(matchStatus);

    // === HOW TO FIGHT PANEL (Pixel Modal Style) ===
    this.createArenaHowToPanel(centerX, Math.round(170 * s), s);

    // === LEADERBOARD PANEL (below queue status, top-left area) ===
    const lbX = Math.round(100 * s);
    const lbY = Math.round(155 * s);
    const lbWidth = Math.round(130 * s);
    const lbHeight = Math.round(90 * s);

    const lbBg = this.add.rectangle(lbX, lbY, lbWidth, lbHeight, 0x0f172a, 0.92);
    lbBg.setDepth(100);
    lbBg.setStrokeStyle(2, 0xfbbf24);
    this.arenaElements.push(lbBg);

    const lbTitle = this.add.text(lbX, lbY - lbHeight / 2 + Math.round(12 * s), "TOP FIGHTERS", {
      fontFamily: "monospace",
      fontSize: `${Math.round(8 * s)}px`,
      color: "#fbbf24",
      fontStyle: "bold",
    });
    lbTitle.setOrigin(0.5, 0.5);
    lbTitle.setDepth(101);
    this.arenaElements.push(lbTitle);

    // Leaderboard entries (will be updated by polling)
    const lbEntries = this.add.text(lbX, lbY + Math.round(8 * s), "Loading...", {
      fontFamily: "monospace",
      fontSize: `${Math.round(6 * s)}px`,
      color: "#d1d5db",
      align: "center",
      lineSpacing: 2,
    });
    lbEntries.setOrigin(0.5, 0.5);
    lbEntries.setDepth(101);
    lbEntries.setName("arenaLeaderboard");
    this.arenaElements.push(lbEntries);

    // === VS DISPLAY for active match (depth 100) ===
    const vsDisplay = this.add.text(centerX, Math.round(70 * s), "", {
      fontFamily: "monospace",
      fontSize: `${Math.round(12 * s)}px`,
      color: "#ffffff",
      fontStyle: "bold",
      align: "center",
    });
    vsDisplay.setOrigin(0.5, 0.5);
    vsDisplay.setDepth(101);
    vsDisplay.setName("arenaVsDisplay");
    this.arenaElements.push(vsDisplay);

    // Fetch initial leaderboard
    this.fetchArenaLeaderboard();
  }

  /**
   * Fetch and display arena leaderboard
   */
  private async fetchArenaLeaderboard(): Promise<void> {
    try {
      const response = await fetch("/api/arena/brawl?action=leaderboard&limit=5");
      const data = await response.json();

      const lbText = this.arenaElements.find(
        (el) => (el as Phaser.GameObjects.Text).name === "arenaLeaderboard"
      ) as Phaser.GameObjects.Text;

      if (lbText && data.success && data.leaderboard) {
        if (data.leaderboard.length === 0) {
          lbText.setText("No fights yet!\nClick ? to join");
        } else {
          const entries = data.leaderboard
            .slice(0, 4)
            .map((f: { moltbook_username: string; wins: number; losses: number }, i: number) => {
              const name =
                f.moltbook_username.length > 10
                  ? f.moltbook_username.slice(0, 8) + ".."
                  : f.moltbook_username;
              return `${i + 1}. ${name} ${f.wins}W`;
            })
            .join("\n");
          lbText.setText(entries);
        }
      }
    } catch {
      // Silently fail - will retry on next poll
    }
  }

  /**
   * Connect to Arena WebSocket for real-time updates
   */
  private connectArenaWebSocket(): void {
    if (this.arenaWebSocket && this.arenaWebSocket.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    // Connect to arena server (Railway in production, localhost in dev)
    const wsUrl = process.env.NEXT_PUBLIC_ARENA_WS_URL || "ws://localhost:8080";

    try {
      this.arenaWebSocket = new WebSocket(wsUrl);

      this.arenaWebSocket.onopen = () => {
        console.log("[Arena] WebSocket connected to arena server");
        // Arena server sends queue_status automatically on connect
      };

      this.arenaWebSocket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleArenaMessage(msg);
        } catch (err) {
          console.error("[Arena] Failed to parse message:", err);
        }
      };

      this.arenaWebSocket.onerror = (error) => {
        console.error("[Arena] WebSocket error:", error);
      };

      this.arenaWebSocket.onclose = () => {
        console.log("[Arena] WebSocket disconnected");
        this.arenaWebSocket = null;
      };
    } catch (err) {
      console.error("[Arena] Failed to connect WebSocket:", err);
      // Fall back to polling
      this.startArenaPolling();
    }
  }

  /**
   * Disconnect Arena WebSocket
   */
  private disconnectArenaWebSocket(): void {
    if (this.arenaWebSocket) {
      this.arenaWebSocket.close();
      this.arenaWebSocket = null;
    }
  }

  /**
   * Handle incoming Arena WebSocket messages
   */
  private handleArenaMessage(msg: { type: string; data?: unknown; error?: string }): void {
    switch (msg.type) {
      case "connected":
        console.log("[Arena] Connected to arena server:", msg.data);
        break;

      case "queue_status": {
        // Arena server format: { position, size, queue: [{username, karma}] }
        const status = msg.data as {
          position: number;
          size: number;
          queue?: Array<{ username: string }>;
        };
        this.updateArenaQueue(status.queue?.map((_, i) => ({ fighter_id: i })) || []);
        break;
      }

      case "queue_update":
        this.updateArenaQueue(msg.data as Array<{ fighter_id: number }>);
        break;

      case "active_matches":
        this.updateActiveMatches(msg.data as Array<{ matchId: number; status: string }>);
        break;

      case "match_start":
      case "match_update":
      case "match_end": {
        // Arena server sends full fighter objects with stats
        const matchData = msg.data as {
          matchId: number;
          status: string;
          tick: number;
          fighter1: {
            id: number;
            username: string;
            stats: { hp: number; maxHp: number };
            x: number;
            y: number;
            state: string;
            direction: string;
            spriteVariant: number;
          };
          fighter2: {
            id: number;
            username: string;
            stats: { hp: number; maxHp: number };
            x: number;
            y: number;
            state: string;
            direction: string;
            spriteVariant: number;
          };
          winner?: string;
        };

        // Transform to expected format for updateArenaMatch
        this.updateArenaMatch({
          matchId: matchData.matchId,
          status: matchData.status,
          tick: matchData.tick,
          fighter1: {
            id: matchData.fighter1.id,
            hp: matchData.fighter1.stats.hp,
            maxHp: matchData.fighter1.stats.maxHp,
            x: matchData.fighter1.x,
            y: matchData.fighter1.y,
            state: matchData.fighter1.state,
            direction: matchData.fighter1.direction,
          },
          fighter2: {
            id: matchData.fighter2.id,
            hp: matchData.fighter2.stats.hp,
            maxHp: matchData.fighter2.stats.maxHp,
            x: matchData.fighter2.x,
            y: matchData.fighter2.y,
            state: matchData.fighter2.state,
            direction: matchData.fighter2.direction,
          },
          winner: matchData.winner,
        });

        // Trigger crowd cheer on match start
        if (msg.type === "match_start") {
          this.triggerCrowdCheer();
        }
        break;
      }

      case "match_state":
        this.updateArenaMatch(
          msg.data as {
            matchId: number;
            status: string;
            tick: number;
            fighter1: {
              id: number;
              hp: number;
              maxHp: number;
              x: number;
              y: number;
              state: string;
              direction: string;
            };
            fighter2: {
              id: number;
              hp: number;
              maxHp: number;
              x: number;
              y: number;
              state: string;
              direction: string;
            };
            winner?: string;
          }
        );
        break;

      case "error":
        console.error("[Arena] Error:", msg.error);
        break;
    }
  }

  /**
   * Update queue display
   */
  private updateArenaQueue(queue: Array<{ fighter_id: number }>): void {
    const queueCount = this.arenaElements.find(
      (el) => (el as Phaser.GameObjects.Text).name === "arenaQueueCount"
    ) as Phaser.GameObjects.Text;

    if (queueCount) {
      const count = queue?.length || 0;
      queueCount.setText(`${count} WAITING`);
    }
  }

  /**
   * Create the "Click to Fight" button panel - opens ArenaModal
   */
  private createArenaHowToPanel(cx: number, cy: number, s: number): void {
    const panelW = Math.round(280 * s);
    const panelH = Math.round(120 * s);
    const borderW = Math.round(3 * s);
    const accent = 0x22c55e; // Green accent

    // Container for all panel elements
    const panel = this.add.container(cx, cy);
    panel.setDepth(100);
    panel.setAlpha(0);
    panel.setScale(0.8);
    this.arenaElements.push(panel);

    // === DROP SHADOW ===
    const shadow = this.add.rectangle(
      Math.round(4 * s),
      Math.round(4 * s),
      panelW + borderW * 2,
      panelH + borderW * 2,
      0x000000,
      0.5
    );
    panel.add(shadow);

    // === OUTER BORDER ===
    const outerBorder = this.add.rectangle(
      0,
      0,
      panelW + borderW * 2,
      panelH + borderW * 2,
      accent
    );
    panel.add(outerBorder);

    // === MAIN BACKGROUND ===
    const panelBg = this.add.rectangle(0, 0, panelW, panelH, 0x0f172a);
    panel.add(panelBg);

    // === TITLE ===
    const titleText = this.add.text(0, -panelH / 2 + Math.round(20 * s), "⚔ MOLTBOOK ARENA ⚔", {
      fontFamily: "monospace",
      fontSize: `${Math.round(12 * s)}px`,
      color: "#22c55e",
      fontStyle: "bold",
    });
    titleText.setOrigin(0.5, 0.5);
    panel.add(titleText);

    // === BIG CLICK TO FIGHT BUTTON ===
    const btnW = Math.round(200 * s);
    const btnH = Math.round(50 * s);
    const btnY = Math.round(5 * s);

    const btnShadow = this.add.rectangle(
      Math.round(3 * s),
      btnY + Math.round(3 * s),
      btnW,
      btnH,
      0x166534
    );
    panel.add(btnShadow);

    const btnBg = this.add.rectangle(0, btnY, btnW, btnH, 0x22c55e);
    btnBg.setInteractive({ useHandCursor: true });
    panel.add(btnBg);

    const btnText = this.add.text(0, btnY, "⚔ CLICK TO FIGHT ⚔", {
      fontFamily: "monospace",
      fontSize: `${Math.round(14 * s)}px`,
      color: "#000000",
      fontStyle: "bold",
    });
    btnText.setOrigin(0.5, 0.5);
    panel.add(btnText);

    // === SUBTITLE ===
    const subText = this.add.text(
      0,
      panelH / 2 - Math.round(18 * s),
      "Enter your username to join the queue",
      {
        fontFamily: "monospace",
        fontSize: `${Math.round(8 * s)}px`,
        color: "#9ca3af",
      }
    );
    subText.setOrigin(0.5, 0.5);
    panel.add(subText);

    // === BUTTON INTERACTIONS ===
    btnBg.on("pointerover", () => {
      btnBg.setFillStyle(0x4ade80);
      btnText.setColor("#000000");
    });
    btnBg.on("pointerout", () => {
      btnBg.setFillStyle(0x22c55e);
      btnText.setColor("#000000");
    });
    btnBg.on("pointerdown", () => {
      // Open the ArenaModal
      window.dispatchEvent(new CustomEvent("bagsworld-arena-click"));
    });

    // === PULSE ANIMATION ===
    this.tweens.add({
      targets: [btnBg, btnShadow],
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Animate panel in
    this.tweens.add({
      targets: panel,
      alpha: 1,
      scale: 1,
      duration: 400,
      ease: "Back.easeOut",
      delay: 300,
    });
  }

  /**
   * Update active matches display
   */
  private updateActiveMatches(matches: Array<{ matchId: number; status: string }>): void {
    const matchStatus = this.arenaElements.find(
      (el) => (el as Phaser.GameObjects.Text).name === "arenaMatchStatus"
    ) as Phaser.GameObjects.Text;

    if (matchStatus) {
      const activeCount = matches?.filter((m) => m.status === "active").length || 0;
      if (activeCount > 0) {
        matchStatus.setText(`${activeCount} ACTIVE`);
        matchStatus.setColor("#22c55e");
      } else {
        matchStatus.setText("NO MATCH");
        matchStatus.setColor("#ffffff");
      }
    }
  }

  /**
   * Update match state - render fighters and combat
   */
  private updateArenaMatch(state: {
    matchId: number;
    status: string;
    tick: number;
    fighter1: {
      id: number;
      username?: string;
      hp: number;
      maxHp: number;
      x: number;
      y: number;
      state: string;
      direction: string;
    };
    fighter2: {
      id: number;
      username?: string;
      hp: number;
      maxHp: number;
      x: number;
      y: number;
      state: string;
      direction: string;
    };
    winner?: string;
  }): void {
    if (this.currentZone !== "arena") return;

    const s = SCALE;
    const ringCenterX = GAME_WIDTH / 2;
    const ringY = Math.round(520 * s);

    // Update VS display with fighter names
    const vsDisplay = this.arenaElements.find(
      (el) => (el as Phaser.GameObjects.Text).name === "arenaVsDisplay"
    ) as Phaser.GameObjects.Text;

    if (vsDisplay && state.status === "active") {
      const name1 = state.fighter1.username || `Fighter ${state.fighter1.id}`;
      const name2 = state.fighter2.username || `Fighter ${state.fighter2.id}`;
      vsDisplay.setText(`${name1}  VS  ${name2}`);
    } else if (vsDisplay && state.status === "completed") {
      vsDisplay.setText("");
    }

    // Update or create fighter 1 sprite
    this.updateFighterSprite(state.fighter1, ringCenterX, ringY, 0);

    // Update or create fighter 2 sprite
    this.updateFighterSprite(state.fighter2, ringCenterX, ringY, 1);

    // Update match status text
    const matchStatus = this.arenaElements.find(
      (el) => (el as Phaser.GameObjects.Text).name === "arenaMatchStatus"
    ) as Phaser.GameObjects.Text;

    if (matchStatus) {
      if (state.status === "completed" && state.winner) {
        matchStatus.setText("KNOCKOUT!");
        matchStatus.setColor("#fbbf24");
        this.showWinnerAnnouncement(state.winner);
        // Refresh leaderboard after match ends
        this.time.delayedCall(1000, () => this.fetchArenaLeaderboard());
      } else if (state.status === "active") {
        matchStatus.setText("FIGHTING");
        matchStatus.setColor("#22c55e");
      }
    }
  }

  /**
   * Update or create a fighter sprite
   */
  private updateFighterSprite(
    fighter: {
      id: number;
      hp: number;
      maxHp: number;
      x: number;
      y: number;
      state: string;
      direction: string;
    },
    ringCenterX: number,
    ringY: number,
    index: number
  ): void {
    const s = SCALE;
    let sprite = this.arenaFighters.get(fighter.id);

    // Determine texture based on state
    // Only use creature variants (9-17): lobster, crab, octopus, shark, jellyfish, pufferfish, frog, slime, robot
    const variantIndex = 9 + (fighter.id % 9);
    let textureKey = `fighter_${variantIndex}_idle_fight`;
    if (fighter.state === "attacking") {
      textureKey = `fighter_${variantIndex}_attack`;
    } else if (fighter.state === "hurt") {
      textureKey = `fighter_${variantIndex}_hurt`;
    } else if (fighter.state === "knockout") {
      textureKey = `fighter_${variantIndex}_knockout`;
    }

    // Calculate position on ring (arena coords: 0-400, center at 200)
    const fighterX = ringCenterX + (fighter.x - 200) * s;
    const fighterY = ringY;

    // Sprite height offset (48px base sprite at SCALE)
    const spriteHeight = Math.round(48 * s);
    const healthBarOffset = spriteHeight + Math.round(12 * s);

    if (!sprite) {
      // Create new sprite
      sprite = this.add.sprite(fighterX, fighterY, textureKey);
      sprite.setOrigin(0.5, 1);
      sprite.setDepth(10);
      this.arenaFighters.set(fighter.id, sprite);

      // Create health bar above sprite
      this.createFighterHealthBar(fighter.id, fighterX, fighterY - healthBarOffset);
    } else {
      // Update existing sprite
      sprite.setTexture(textureKey);
      sprite.setPosition(fighterX, fighterY);
    }

    // Flip sprite based on direction
    sprite.setFlipX(fighter.direction === "left");

    // Update health bar
    this.updateFighterHealthBar(
      fighter.id,
      fighter.hp,
      fighter.maxHp,
      fighterX,
      fighterY - healthBarOffset
    );

    // Show dramatic animations on state TRANSITIONS
    const prevState = this.arenaLastFighterState.get(fighter.id);

    // === ATTACK ANIMATION - Jump/Lunge forward ===
    if (fighter.state === "attacking" && prevState !== "attacking") {
      const attackDir = fighter.direction === "right" ? 1 : -1;

      // 30% chance to play charge sound for variety
      if (Math.random() < 0.3) {
        this.playFightSound("charge");
      }

      // Dust cloud at feet when launching attack
      this.showDustCloud(fighterX, fighterY);

      // Jump and lunge forward
      this.tweens.add({
        targets: sprite,
        y: fighterY - 30 * s, // Jump up
        x: fighterX + attackDir * 25 * s, // Lunge forward
        scaleX: 1.2,
        scaleY: 0.9,
        duration: 120,
        ease: "Power2.easeOut",
        yoyo: true,
        onUpdate: () => {
          // Add motion blur effect
          if (Math.random() > 0.6) {
            const blur = this.add.sprite(sprite.x, sprite.y, sprite.texture.key);
            blur.setOrigin(0.5, 1);
            blur.setAlpha(0.4);
            blur.setTint(0xffffff);
            blur.setDepth(9);
            blur.setFlipX(sprite.flipX);
            this.tweens.add({
              targets: blur,
              alpha: 0,
              duration: 150,
              onComplete: () => blur.destroy(),
            });
          }
        },
      });

      // Add attack slash effect
      this.showAttackSlash(fighterX + attackDir * 40 * s, fighterY - 30 * s, attackDir);
    }

    // === HURT ANIMATION - Dramatic knockback with spin ===
    if (fighter.state === "hurt" && prevState !== "hurt") {
      const damage =
        Math.round((fighter.maxHp - fighter.hp) * 0.1) || Math.floor(Math.random() * 8) + 4;
      // The attacker is the OTHER fighter (not the one getting hurt)
      const attackerId = this.arenaMatchState
        ? this.arenaMatchState.fighter1.id === fighter.id
          ? this.arenaMatchState.fighter2.id
          : this.arenaMatchState.fighter1.id
        : 0;
      this.showHitEffect(fighterX, fighterY - Math.round(40 * s), damage, attackerId);

      const knockDir = fighter.direction === "left" ? 1 : -1;

      // Dramatic knockback with spin and squash
      this.tweens.add({
        targets: sprite,
        x: fighterX + knockDir * 35 * s,
        y: fighterY - 20 * s,
        angle: knockDir * 25,
        scaleX: 0.8,
        scaleY: 1.3,
        duration: 150,
        ease: "Power2.easeOut",
        onComplete: () => {
          // Bounce back
          this.tweens.add({
            targets: sprite,
            x: fighterX,
            y: fighterY,
            angle: 0,
            scaleX: 1,
            scaleY: 1,
            duration: 200,
            ease: "Bounce.easeOut",
          });
        },
      });
    }

    // === KNOCKOUT ANIMATION - Spin and fall ===
    if (fighter.state === "knockout" && prevState !== "knockout") {
      const fallDir = fighter.direction === "left" ? 1 : -1;

      // === PLAY KO SOUND ===
      this.playFightSound("ko");

      // Reset combo counters on KO
      this.arenaComboCount.clear();
      this.arenaLastAttacker = 0;

      // Epic knockout spin and fall
      this.tweens.add({
        targets: sprite,
        x: fighterX + fallDir * 60 * s,
        y: fighterY + 10 * s,
        angle: fallDir * 720, // Multiple spins!
        scaleX: 0.5,
        scaleY: 0.5,
        alpha: 0.7,
        duration: 800,
        ease: "Power2.easeIn",
        onComplete: () => {
          // Show KO stars
          this.showKOStars(sprite.x, sprite.y - 30 * s);
          // Show ground crack where they fell
          this.showGroundCrack(sprite.x, sprite.y);
        },
      });

      // Big shockwave for knockout
      this.showShockwave(fighterX, fighterY, 0xef4444);

      // Big screen shake for knockout
      this.cameras.main.shake(400, 0.02);
    }

    // Track current state for next frame
    this.arenaLastFighterState.set(fighter.id, fighter.state);
  }

  // ============================================================================
  // FIGHT SOUND EFFECTS
  // ============================================================================

  /**
   * Play randomized fight sound effect
   */
  private playFightSound(type: "whoosh" | "hit" | "critical" | "ko" | "block" | "charge"): void {
    if (!this.audioContext) {
      // Create audio context if needed
      try {
        this.audioContext = new (
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        )();
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);
        this.gainNode.gain.value = 0.3;
      } catch {
        return;
      }
    }

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Randomize pitch slightly for variety
    const pitchVariation = 0.9 + Math.random() * 0.2;

    switch (type) {
      case "whoosh": {
        // Swoosh sound - noise burst with filter sweep
        const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
        const noise = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noise.length; i++) {
          noise[i] = (Math.random() * 2 - 1) * (1 - i / noise.length);
        }
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(2000 * pitchVariation, now);
        filter.frequency.exponentialRampToValueAtTime(500, now + 0.15);
        filter.Q.value = 2;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        noiseSource.connect(filter);
        filter.connect(gain);
        gain.connect(this.gainNode!);
        noiseSource.start(now);
        break;
      }

      case "hit": {
        // Punch sound - low thump + mid crack
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        const gain2 = ctx.createGain();

        // Low thump
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(150 * pitchVariation, now);
        osc1.frequency.exponentialRampToValueAtTime(50, now + 0.1);
        gain1.gain.setValueAtTime(0.4, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        // Mid crack - random between punch types
        const crackFreq = [400, 500, 600, 350][Math.floor(Math.random() * 4)];
        osc2.type = "triangle";
        osc2.frequency.setValueAtTime(crackFreq * pitchVariation, now);
        osc2.frequency.exponentialRampToValueAtTime(100, now + 0.08);
        gain2.gain.setValueAtTime(0.25, now);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc1.connect(gain1);
        osc2.connect(gain2);
        gain1.connect(this.gainNode!);
        gain2.connect(this.gainNode!);
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.15);
        osc2.stop(now + 0.1);
        break;
      }

      case "critical": {
        // Big impact - layered hits + reverb-like decay
        for (let i = 0; i < 3; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const filter = ctx.createBiquadFilter();

          osc.type = i === 0 ? "sine" : "triangle";
          const baseFreq = [100, 200, 400][i] * pitchVariation;
          osc.frequency.setValueAtTime(baseFreq, now);
          osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.3, now + 0.2);

          filter.type = "lowpass";
          filter.frequency.value = 1500;

          gain.gain.setValueAtTime([0.5, 0.3, 0.2][i], now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25 - i * 0.05);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.gainNode!);
          osc.start(now);
          osc.stop(now + 0.3);
        }

        // Add noise burst
        const noiseLen = 0.08;
        const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * noiseLen, ctx.sampleRate);
        const noise = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noise.length; i++) {
          noise[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / noise.length, 2);
        }
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        const noiseGain = ctx.createGain();
        noiseGain.gain.value = 0.2;
        noiseSource.connect(noiseGain);
        noiseGain.connect(this.gainNode!);
        noiseSource.start(now);
        break;
      }

      case "ko": {
        // Dramatic KO sound - descending tone + impact
        const notes = [600, 500, 400, 200, 100];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "square";
          osc.frequency.value = freq * pitchVariation;
          gain.gain.setValueAtTime(0.15, now + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.1);
          osc.connect(gain);
          gain.connect(this.gainNode!);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.15);
        });

        // Final thud
        const thud = ctx.createOscillator();
        const thudGain = ctx.createGain();
        thud.type = "sine";
        thud.frequency.setValueAtTime(80, now + 0.4);
        thud.frequency.exponentialRampToValueAtTime(30, now + 0.6);
        thudGain.gain.setValueAtTime(0.5, now + 0.4);
        thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        thud.connect(thudGain);
        thudGain.connect(this.gainNode!);
        thud.start(now + 0.4);
        thud.stop(now + 0.7);
        break;
      }

      case "block": {
        // Metallic clang
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(800 * pitchVariation, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(gain);
        gain.connect(this.gainNode!);
        osc.start(now);
        osc.stop(now + 0.15);
        break;
      }

      case "charge": {
        // Power-up sound - rising tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(800 * pitchVariation, now + 0.2);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(this.gainNode!);
        osc.start(now);
        osc.stop(now + 0.3);
        break;
      }
    }
  }

  // ============================================================================
  // ADDITIONAL VISUAL EFFECTS
  // ============================================================================

  /**
   * Show dust cloud effect (random chance on movement/attacks)
   */
  private showDustCloud(x: number, y: number): void {
    const s = SCALE;
    const dustCount = 3 + Math.floor(Math.random() * 3);

    for (let i = 0; i < dustCount; i++) {
      const dust = this.add.circle(
        x + (Math.random() - 0.5) * 30 * s,
        y + Math.random() * 10 * s,
        (4 + Math.random() * 6) * s,
        0xd4a574,
        0.4 + Math.random() * 0.3
      );
      dust.setDepth(9);

      const driftX = (Math.random() - 0.5) * 40 * s;
      const driftY = -20 - Math.random() * 30;

      this.tweens.add({
        targets: dust,
        x: dust.x + driftX,
        y: dust.y + driftY * s,
        alpha: 0,
        scale: 2 + Math.random(),
        duration: 400 + Math.random() * 200,
        ease: "Power1.easeOut",
        onComplete: () => dust.destroy(),
      });
    }
  }

  /**
   * Show energy burst effect (for attacks)
   */
  private showEnergyBurst(x: number, y: number, color: number = 0xfbbf24): void {
    const s = SCALE;

    // Central glow
    const glow = this.add.circle(x, y, 15 * s, color, 0.6);
    glow.setDepth(12);

    this.tweens.add({
      targets: glow,
      radius: 40 * s,
      alpha: 0,
      duration: 200,
      ease: "Power2.easeOut",
      onComplete: () => glow.destroy(),
    });

    // Energy rays
    const rayCount = 6 + Math.floor(Math.random() * 4);
    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2 + Math.random() * 0.3;
      const length = (30 + Math.random() * 20) * s;

      const ray = this.add.graphics();
      ray.setDepth(11);
      ray.lineStyle(2 * s, color, 0.8);
      ray.beginPath();
      ray.moveTo(x, y);
      ray.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
      ray.strokePath();

      this.tweens.add({
        targets: ray,
        alpha: 0,
        duration: 150 + Math.random() * 100,
        delay: i * 20,
        onComplete: () => ray.destroy(),
      });
    }
  }

  /**
   * Show shockwave ring effect
   */
  private showShockwave(x: number, y: number, color: number = 0xffffff): void {
    const s = SCALE;

    for (let i = 0; i < 2; i++) {
      const ring = this.add.circle(x, y, 5 * s, 0x000000, 0);
      ring.setStrokeStyle((3 - i) * s, color, 0.8 - i * 0.3);
      ring.setDepth(10);

      this.tweens.add({
        targets: ring,
        radius: (60 + i * 20) * s,
        alpha: 0,
        duration: 300 + i * 100,
        delay: i * 50,
        ease: "Power2.easeOut",
        onComplete: () => ring.destroy(),
      });
    }
  }

  /**
   * Show speed lines effect
   */
  private showSpeedLines(x: number, y: number, direction: number): void {
    const s = SCALE;
    const lineCount = 5 + Math.floor(Math.random() * 4);

    for (let i = 0; i < lineCount; i++) {
      const startY = y + (Math.random() - 0.5) * 50 * s;
      const lineLength = (40 + Math.random() * 30) * s;
      const startX = x - direction * 20 * s;

      const line = this.add.graphics();
      line.setDepth(8);
      line.lineStyle(2 * s, 0xffffff, 0.6 + Math.random() * 0.3);
      line.beginPath();
      line.moveTo(startX, startY);
      line.lineTo(startX - direction * lineLength, startY);
      line.strokePath();

      this.tweens.add({
        targets: line,
        alpha: 0,
        x: -direction * 30 * s,
        duration: 150 + Math.random() * 100,
        delay: i * 15,
        onComplete: () => line.destroy(),
      });
    }
  }

  /**
   * Show ground crack effect (for heavy hits)
   */
  private showGroundCrack(x: number, y: number): void {
    const s = SCALE;
    const crackCount = 4 + Math.floor(Math.random() * 3);

    for (let i = 0; i < crackCount; i++) {
      const angle = (i / crackCount) * Math.PI + Math.random() * 0.5;
      const length = (20 + Math.random() * 25) * s;

      const crack = this.add.graphics();
      crack.setDepth(1);

      // Draw jagged crack line
      crack.lineStyle(2 * s, 0x1a1a1a, 0.8);
      crack.beginPath();
      crack.moveTo(x, y);

      let curX = x;
      let curY = y;
      const segments = 3 + Math.floor(Math.random() * 3);
      for (let j = 0; j < segments; j++) {
        const segLen = length / segments;
        curX += Math.cos(angle + (Math.random() - 0.5) * 0.5) * segLen;
        curY += Math.sin(angle + (Math.random() - 0.5) * 0.5) * segLen;
        crack.lineTo(curX, curY);
      }
      crack.strokePath();

      // Fade out slowly
      this.tweens.add({
        targets: crack,
        alpha: 0,
        duration: 2000,
        delay: 500,
        onComplete: () => crack.destroy(),
      });
    }
  }

  /**
   * Show combo counter
   */
  private showComboCounter(x: number, y: number, comboCount: number): void {
    if (comboCount < 2) return;

    const s = SCALE;

    const comboText = this.add.text(x, y - 60 * s, `${comboCount} HIT COMBO!`, {
      fontFamily: "monospace",
      fontSize: `${Math.round(14 * s)}px`,
      color: comboCount >= 5 ? "#ff6b6b" : comboCount >= 3 ? "#fbbf24" : "#ffffff",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 4,
    });
    comboText.setOrigin(0.5, 0.5);
    comboText.setDepth(102);

    // Pulse and fade
    this.tweens.add({
      targets: comboText,
      scale: { from: 0.5, to: 1.2 },
      y: y - 90 * s,
      duration: 200,
      ease: "Back.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: comboText,
          alpha: 0,
          y: comboText.y - 20 * s,
          duration: 800,
          delay: 300,
          onComplete: () => comboText.destroy(),
        });
      },
    });
  }

  /**
   * Show attack slash effect
   */
  private showAttackSlash(x: number, y: number, direction: number): void {
    const s = SCALE;

    // === PLAY WHOOSH SOUND ===
    this.playFightSound("whoosh");

    // Randomize slash color
    const slashColors = [0xffffff, 0xfbbf24, 0xff6b6b, 0x60a5fa, 0xa78bfa];
    const slashColor = slashColors[Math.floor(Math.random() * slashColors.length)];

    // Create slash lines
    for (let i = 0; i < 5; i++) {
      const angle = -30 + i * 15 + (direction > 0 ? 0 : 180);
      const length = 40 + Math.random() * 30;

      const slash = this.add.graphics();
      slash.setDepth(15);
      slash.lineStyle(3 * s, slashColor, 0.9);
      slash.beginPath();
      slash.moveTo(x, y);
      const endX = x + Math.cos((angle * Math.PI) / 180) * length * s;
      const endY = y + Math.sin((angle * Math.PI) / 180) * length * s;
      slash.lineTo(endX, endY);
      slash.strokePath();

      this.tweens.add({
        targets: slash,
        alpha: 0,
        scaleX: 1.5,
        scaleY: 1.5,
        duration: 200,
        delay: i * 30,
        onComplete: () => slash.destroy(),
      });
    }

    // Add impact ring
    const ring = this.add.circle(x, y, 10 * s, 0xffffff, 0);
    ring.setStrokeStyle(3 * s, slashColor);
    ring.setDepth(14);

    this.tweens.add({
      targets: ring,
      radius: 50 * s,
      alpha: 0,
      duration: 250,
      ease: "Power2.easeOut",
      onComplete: () => ring.destroy(),
    });

    // === RANDOM EXTRA EFFECTS ===
    // 40% chance for speed lines
    if (Math.random() < 0.4) {
      this.showSpeedLines(x, y, direction);
    }

    // 30% chance for energy burst
    if (Math.random() < 0.3) {
      this.showEnergyBurst(x, y, slashColor);
    }

    // 25% chance for dust cloud at feet
    if (Math.random() < 0.25) {
      this.showDustCloud(x, y + 40 * s);
    }
  }

  /**
   * Show KO stars above defeated fighter
   */
  private showKOStars(x: number, y: number): void {
    const s = SCALE;
    const starCount = 5;

    for (let i = 0; i < starCount; i++) {
      const star = this.add.text(x, y, "★", {
        fontSize: `${Math.round(12 * s)}px`,
        color: "#fbbf24",
      });
      star.setOrigin(0.5, 0.5);
      star.setDepth(20);

      const angle = (i / starCount) * Math.PI * 2;
      const radius = 25 * s;

      // Orbit animation
      this.tweens.add({
        targets: star,
        x: x + Math.cos(angle) * radius,
        y: y + Math.sin(angle) * radius * 0.5,
        duration: 300,
        ease: "Power2.easeOut",
        onComplete: () => {
          // Continue orbiting
          this.tweens.add({
            targets: star,
            angle: 360,
            duration: 1500,
            repeat: 2,
            onUpdate: () => {
              const t = (Date.now() / 500 + i) % (Math.PI * 2);
              star.x = x + Math.cos(t) * radius;
              star.y = y + Math.sin(t) * radius * 0.5 - 10 * s;
            },
            onComplete: () => {
              this.tweens.add({
                targets: star,
                alpha: 0,
                y: star.y - 20 * s,
                duration: 300,
                onComplete: () => star.destroy(),
              });
            },
          });
        },
      });
    }
  }

  /**
   * Create fighter health bar
   */
  private createFighterHealthBar(fighterId: number, x: number, y: number): void {
    const s = SCALE;
    const barWidth = Math.round(40 * s);
    const barHeight = Math.round(6 * s);

    const bg = this.add.rectangle(x, y, barWidth, barHeight, 0x000000);
    bg.setDepth(100);
    bg.setStrokeStyle(1, 0xffffff);

    const fill = this.add.rectangle(x, y, barWidth - 2, barHeight - 2, 0x22c55e);
    fill.setDepth(101);

    this.arenaHealthBars.set(fighterId, { bg, fill });
  }

  /**
   * Update fighter health bar
   */
  private updateFighterHealthBar(
    fighterId: number,
    hp: number,
    maxHp: number,
    x: number,
    y: number
  ): void {
    const bars = this.arenaHealthBars.get(fighterId);
    if (!bars) return;

    const s = SCALE;
    const barWidth = Math.round(40 * s);
    const hpPercent = hp / maxHp;
    const fillWidth = (barWidth - 2) * hpPercent;

    bars.bg.setPosition(x, y);
    bars.fill.setPosition(x - (barWidth - 2) / 2 + fillWidth / 2, y);
    bars.fill.setSize(fillWidth, bars.fill.height);

    // Change color based on HP
    if (hpPercent > 0.6) {
      bars.fill.setFillStyle(0x22c55e); // Green
    } else if (hpPercent > 0.3) {
      bars.fill.setFillStyle(0xfbbf24); // Yellow
    } else {
      bars.fill.setFillStyle(0xef4444); // Red
    }
  }

  /**
   * Show hit effect at position with damage number
   */
  private showHitEffect(x: number, y: number, damage: number = 0, attackerId: number = 0): void {
    const s = SCALE;
    const isCrit = damage > 10;

    // === PLAY HIT SOUND (randomized) ===
    if (isCrit) {
      this.playFightSound("critical");
    } else {
      this.playFightSound("hit");
    }

    // === COMBO SYSTEM ===
    if (attackerId > 0) {
      if (this.arenaLastAttacker === attackerId) {
        // Same attacker - increment combo
        const currentCombo = this.arenaComboCount.get(attackerId) || 0;
        this.arenaComboCount.set(attackerId, currentCombo + 1);
        this.showComboCounter(x, y, currentCombo + 1);
      } else {
        // Different attacker - reset their combo, start new one
        this.arenaComboCount.set(attackerId, 1);
      }
      this.arenaLastAttacker = attackerId;
    }

    // === SCREEN SHAKE FOR IMPACT ===
    const shakeIntensity = Math.min(damage * 0.5, 8); // More damage = more shake
    this.cameras.main.shake(150, shakeIntensity * 0.001);

    // === TRIGGER CROWD CHEER ===
    this.triggerCrowdCheer();

    // === SHOW ACTION BUBBLE (randomized) ===
    const bubbleTypes = isCrit
      ? ["action_critical", "action_bam", "action_pow"]
      : ["action_pow", "action_bam", "action_pow"];
    const bubbleType = bubbleTypes[Math.floor(Math.random() * bubbleTypes.length)];
    this.showActionBubble(x, y - Math.round(50 * s), bubbleType);

    // === MULTIPLE SPARK BURSTS ===
    const sparkCount = isCrit ? 5 : 3;
    for (let i = 0; i < sparkCount; i++) {
      const spark = this.add.sprite(
        x + (Math.random() - 0.5) * 30 * s,
        y + (Math.random() - 0.5) * 20 * s,
        "hit_spark"
      );
      spark.setDepth(11);
      spark.setScale(0.2 + Math.random() * 0.3);
      spark.setAngle(Math.random() * 360);

      this.tweens.add({
        targets: spark,
        scale: { from: spark.scale, to: spark.scale * 2.5 },
        alpha: { from: 1, to: 0 },
        angle: spark.angle + (Math.random() - 0.5) * 60,
        duration: 250 + Math.random() * 150,
        ease: "Power2",
        delay: i * 50,
        onComplete: () => spark.destroy(),
      });
    }

    // === FLOATING DAMAGE NUMBER - BIGGER ===
    if (damage > 0) {
      const dmgText = this.add.text(x, y - Math.round(20 * s), `-${damage}`, {
        fontFamily: "monospace",
        fontSize: `${Math.round(isCrit ? 24 : 16) * s}px`,
        color: isCrit ? "#fbbf24" : "#ef4444",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 4,
      });
      dmgText.setOrigin(0.5, 0.5);
      dmgText.setDepth(101);

      // Bounce up then fade
      this.tweens.add({
        targets: dmgText,
        y: y - Math.round(80 * s),
        alpha: { from: 1, to: 0 },
        scale: { from: 1.2, to: 1.5 },
        duration: 1000,
        ease: "Bounce.easeOut",
        onComplete: () => dmgText.destroy(),
      });
    }

    // === IMPACT PARTICLES - MORE DRAMATIC ===
    const particleColors = [0xfde047, 0xffffff, 0xef4444, 0xfbbf24, 0xff6b6b];
    const particleCount = isCrit ? 12 : 8;
    for (let i = 0; i < particleCount; i++) {
      const particle = this.add.rectangle(
        x + (Math.random() - 0.5) * 30 * s,
        y + (Math.random() - 0.5) * 30 * s,
        Math.round((3 + Math.random() * 4) * s),
        Math.round((3 + Math.random() * 4) * s),
        particleColors[i % particleColors.length]
      );
      particle.setDepth(11);
      particle.setAngle(Math.random() * 360);

      // Explode outward
      const angle = (Math.PI * 2 * i) / particleCount;
      const distance = 60 + Math.random() * 40;
      this.tweens.add({
        targets: particle,
        x: particle.x + Math.cos(angle) * distance * s,
        y: particle.y + Math.sin(angle) * distance * s - 20 * s, // Arc upward
        alpha: 0,
        scale: 0,
        angle: particle.angle + (Math.random() - 0.5) * 180,
        duration: 400 + Math.random() * 200,
        ease: "Power2",
        onComplete: () => particle.destroy(),
      });
    }

    // === FLASH EFFECT ===
    const flashColor = isCrit ? 0xfbbf24 : 0xffffff;
    const flash = this.add.rectangle(x, y, 100 * s, 100 * s, flashColor, isCrit ? 0.8 : 0.6);
    flash.setDepth(10);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2,
      duration: 150,
      ease: "Power2",
      onComplete: () => flash.destroy(),
    });

    // === RANDOM EXTRA EFFECTS ===
    // 50% chance for shockwave on big hits
    if (isCrit || Math.random() < 0.3) {
      this.showShockwave(x, y, isCrit ? 0xfbbf24 : 0xffffff);
    }

    // 20% chance for ground crack on critical hits
    if (isCrit && Math.random() < 0.4) {
      this.showGroundCrack(x, y + 50 * s);
    }

    // 35% chance for energy burst
    if (Math.random() < 0.35) {
      const burstColors = [0xef4444, 0xfbbf24, 0x60a5fa, 0xa78bfa, 0x22c55e];
      this.showEnergyBurst(x, y, burstColors[Math.floor(Math.random() * burstColors.length)]);
    }

    // 25% chance for dust cloud
    if (Math.random() < 0.25) {
      this.showDustCloud(x, y + 30 * s);
    }
  }

  /**
   * Show winner announcement
   */
  private showWinnerAnnouncement(winner: string): void {
    const s = SCALE;
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    // Trigger victory confetti
    this.playArenaConfetti();

    // Background
    const announceBg = this.add.rectangle(
      centerX,
      centerY,
      Math.round(300 * s),
      Math.round(80 * s),
      0x0a0a0f,
      0.95
    );
    announceBg.setDepth(200);
    announceBg.setStrokeStyle(3, 0xfbbf24);

    // Winner text
    const winnerText = this.add.text(centerX, centerY - Math.round(10 * s), "WINNER!", {
      fontFamily: "monospace",
      fontSize: `${Math.round(16 * s)}px`,
      color: "#fbbf24",
      fontStyle: "bold",
    });
    winnerText.setOrigin(0.5, 0.5);
    winnerText.setDepth(201);

    const nameText = this.add.text(centerX, centerY + Math.round(15 * s), winner, {
      fontFamily: "monospace",
      fontSize: `${Math.round(12 * s)}px`,
      color: "#ffffff",
    });
    nameText.setOrigin(0.5, 0.5);
    nameText.setDepth(201);

    // Animate in
    this.tweens.add({
      targets: [announceBg, winnerText, nameText],
      scale: { from: 0, to: 1 },
      duration: 300,
      ease: "Back.easeOut",
    });

    // Remove after delay
    this.time.delayedCall(3000, () => {
      this.tweens.add({
        targets: [announceBg, winnerText, nameText],
        alpha: 0,
        duration: 500,
        onComplete: () => {
          announceBg.destroy();
          winnerText.destroy();
          nameText.destroy();

          // Clean up fighter sprites and health bars
          this.arenaFighters.forEach((sprite) => sprite.destroy());
          this.arenaFighters.clear();
          this.arenaHealthBars.forEach((bars) => {
            bars.bg.destroy();
            bars.fill.destroy();
          });
          this.arenaHealthBars.clear();
          this.arenaLastHitEffect.clear();
          this.arenaLastFighterState.clear();
        },
      });
    });
  }

  /**
   * Trigger crowd cheer animation - switches crowd to cheer poses temporarily
   */
  private triggerCrowdCheer(): void {
    // Don't trigger if already cheering or no crowd sprites
    if (this.arenaCrowdCheering || this.arenaCrowdSprites.length === 0) return;

    this.arenaCrowdCheering = true;

    // Switch random crowd members to cheer pose
    this.arenaCrowdSprites.forEach((crowd) => {
      if (Math.random() > 0.4) {
        // 60% chance to cheer
        const variant = crowd.getData("variant") as number;
        const cheerPose = Math.random() > 0.5 ? "cheer1" : "cheer2";
        crowd.setTexture(`arena_crowd_${cheerPose}_${variant}`);
      }
    });

    // Reset to idle after delay
    this.time.delayedCall(600, () => {
      this.arenaCrowdSprites.forEach((crowd) => {
        const variant = crowd.getData("variant") as number;
        crowd.setTexture(`arena_crowd_idle_${variant}`);
      });
      this.arenaCrowdCheering = false;
    });
  }

  /**
   * Show comic-style action bubble (POW!, BAM!, CRIT!, MISS)
   */
  private showActionBubble(x: number, y: number, type: string): void {
    const s = SCALE;

    // Create action bubble sprite
    const bubble = this.add.sprite(x, y, type);
    bubble.setDepth(102);
    bubble.setScale(0);
    bubble.setAlpha(1);

    // Pop-in animation
    this.tweens.add({
      targets: bubble,
      scale: { from: 0, to: 1.2 },
      duration: 150,
      ease: "Back.easeOut",
      onComplete: () => {
        // Hold then fade out
        this.tweens.add({
          targets: bubble,
          scale: { from: 1.2, to: 1.5 },
          alpha: { from: 1, to: 0 },
          y: y - Math.round(30 * s),
          duration: 400,
          delay: 200,
          ease: "Power2",
          onComplete: () => bubble.destroy(),
        });
      },
    });
  }

  /**
   * Show center screen announcement text
   */
  private showArenaAnnouncement(text: string, color: string = "#fbbf24"): void {
    const s = SCALE;
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2 - Math.round(50 * s);

    const announcement = this.add.text(centerX, centerY, text, {
      fontFamily: "monospace",
      fontSize: `${Math.round(20 * s)}px`,
      color: color,
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 4,
    });
    announcement.setOrigin(0.5, 0.5);
    announcement.setDepth(200);
    announcement.setScale(0);

    // Animate in
    this.tweens.add({
      targets: announcement,
      scale: { from: 0, to: 1.2 },
      duration: 200,
      ease: "Back.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: announcement,
          scale: 1,
          duration: 100,
          onComplete: () => {
            // Fade out after delay
            this.tweens.add({
              targets: announcement,
              alpha: 0,
              y: centerY - Math.round(30 * s),
              duration: 500,
              delay: 1500,
              onComplete: () => announcement.destroy(),
            });
          },
        });
      },
    });
  }

  /**
   * Play victory confetti effect - red, blue, and gold particles
   */
  private playArenaConfetti(): void {
    const s = SCALE;
    const confettiColors = [0xef4444, 0x3b82f6, 0xfbbf24, 0x22c55e, 0xa855f7]; // Red, blue, gold, green, purple
    const centerX = GAME_WIDTH / 2;

    // Create confetti burst from multiple spawn points
    for (let wave = 0; wave < 3; wave++) {
      this.time.delayedCall(wave * 150, () => {
        for (let i = 0; i < 20; i++) {
          const spawnX = centerX + (Math.random() - 0.5) * Math.round(200 * s);
          const spawnY = Math.round(100 * s);
          const color = confettiColors[Math.floor(Math.random() * confettiColors.length)];

          // Create confetti particle (small rectangle)
          const confetti = this.add.rectangle(
            spawnX,
            spawnY,
            Math.round((3 + Math.random() * 3) * s),
            Math.round((6 + Math.random() * 4) * s),
            color
          );
          confetti.setDepth(150);
          confetti.setAngle(Math.random() * 360);

          // Falling animation with flutter
          const targetX = spawnX + (Math.random() - 0.5) * Math.round(300 * s);
          const targetY = GAME_HEIGHT + Math.round(50 * s);
          const duration = 2000 + Math.random() * 1500;

          this.tweens.add({
            targets: confetti,
            x: targetX,
            y: targetY,
            angle: confetti.angle + (Math.random() > 0.5 ? 720 : -720),
            duration: duration,
            ease: "Sine.easeIn",
            onComplete: () => confetti.destroy(),
          });

          // Add flutter effect (oscillating x)
          this.tweens.add({
            targets: confetti,
            x: {
              value: `+=${Math.round((Math.random() - 0.5) * 60 * s)}`,
              duration: 300,
              yoyo: true,
              repeat: Math.floor(duration / 600),
              ease: "Sine.easeInOut",
            },
          });
        }
      });
    }
  }

  /**
   * Fallback polling for arena status (when WebSocket unavailable)
   */
  private startArenaPolling(): void {
    let pollCount = 0;
    let engineStarted = false;

    // Poll arena status every 500ms for smoother fight updates
    this.time.addEvent({
      delay: 500,
      callback: async () => {
        if (this.currentZone !== "arena") return;

        try {
          // Auto-start engine on first poll (lazy initialization)
          if (!engineStarted) {
            engineStarted = true;
            console.log("[Arena] Auto-starting engine...");
            await fetch("/api/arena/brawl", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "start_engine" }),
            });
          }

          // Get active matches from engine
          const matchResponse = await fetch("/api/arena/brawl?action=matches");
          const matchData = await matchResponse.json();

          if (matchData.success && matchData.matches) {
            this.updateActiveMatches(matchData.matches);

            // If matches from engine, render them
            if (matchData.source === "engine" && matchData.matches.length > 0) {
              for (const match of matchData.matches) {
                if (match.status === "active" || match.status === "completed") {
                  this.updateArenaMatch(match);
                }
              }

              // Run a few ticks to advance the fight
              await fetch("/api/arena/brawl", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "tick", ticks: 5 }),
              });
            }
          }

          // Update queue and leaderboard less frequently (every 4 polls = 2 seconds)
          pollCount++;
          if (pollCount % 4 === 0) {
            const queueResponse = await fetch("/api/arena/brawl?action=queue");
            const queueData = await queueResponse.json();
            if (queueData.success) {
              this.updateArenaQueue(queueData.queue?.fighters || []);
            }

            // Refresh leaderboard every 10 seconds
            if (pollCount % 20 === 0) {
              this.fetchArenaLeaderboard();
            }

            // Check MoltBook for new !fight posts every 30 seconds (60 polls)
            if (pollCount % 60 === 0) {
              fetch("/api/arena/brawl", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "poll" }),
              }).catch(() => {}); // Silent fail
            }
          }
        } catch (err) {
          console.error("[Arena] Polling error:", err);
        }
      },
      loop: true,
    });
  }
}
