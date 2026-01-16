import * as Phaser from "phaser";
import type { WorldState, GameCharacter, GameBuilding } from "@/lib/types";

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
  private ground!: Phaser.GameObjects.TileSprite;
  private timeOfDay = 0;
  private overlay!: Phaser.GameObjects.Rectangle;
  private sunSprite: Phaser.GameObjects.Sprite | null = null;
  private fireflies: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private ambientParticles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private musicPlaying = false;
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private musicInterval: number | null = null;

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

    // Listen for music toggle
    window.addEventListener("bagsworld-toggle-music", () => {
      this.toggleMusic();
    });
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
    const skyGradient = this.add.graphics();

    // Beautiful gradient sky
    skyGradient.fillGradientStyle(
      0x0f172a, // Dark blue top
      0x0f172a,
      0x1e293b, // Lighter blue bottom
      0x1e293b,
      1
    );
    skyGradient.fillRect(0, 0, 800, 430);
    skyGradient.setDepth(-2);

    // Add stars
    for (let i = 0; i < 50; i++) {
      const star = this.add.circle(
        Math.random() * 800,
        Math.random() * 300,
        Math.random() * 1.5 + 0.5,
        0xffffff,
        Math.random() * 0.5 + 0.3
      );
      star.setDepth(-1);

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

    // Add fountain in center background
    const fountain = this.add.sprite(400, 420, "fountain");
    fountain.setOrigin(0.5, 1);
    fountain.setDepth(1);
    fountain.setScale(1.2);
    this.decorations.push(fountain);

    // Water spray particles
    const waterSpray = this.add.particles(400, 385, "rain", {
      speed: { min: 20, max: 50 },
      angle: { min: 250, max: 290 },
      lifespan: 600,
      quantity: 2,
      frequency: 100,
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.6, end: 0 },
      gravityY: 50,
    });
    waterSpray.setDepth(1);

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
      this.gainNode.gain.value = 0.15; // Low volume

      this.playPokemonMelody();
      this.musicPlaying = true;
    } catch (e) {
      console.log("Audio not supported");
    }
  }

  private playPokemonMelody(): void {
    if (!this.audioContext || !this.gainNode) return;

    // Pokemon-style pentatonic melody (cheerful, adventurous)
    // Notes: C4, D4, E4, G4, A4, C5 (pentatonic scale)
    const notes = [
      { freq: 523.25, duration: 0.2 },  // C5
      { freq: 440.00, duration: 0.2 },  // A4
      { freq: 392.00, duration: 0.2 },  // G4
      { freq: 329.63, duration: 0.4 },  // E4
      { freq: 392.00, duration: 0.2 },  // G4
      { freq: 440.00, duration: 0.2 },  // A4
      { freq: 523.25, duration: 0.4 },  // C5
      { freq: 0, duration: 0.2 },       // Rest
      { freq: 392.00, duration: 0.2 },  // G4
      { freq: 329.63, duration: 0.2 },  // E4
      { freq: 293.66, duration: 0.2 },  // D4
      { freq: 261.63, duration: 0.4 },  // C4
      { freq: 293.66, duration: 0.2 },  // D4
      { freq: 329.63, duration: 0.2 },  // E4
      { freq: 392.00, duration: 0.4 },  // G4
      { freq: 0, duration: 0.4 },       // Rest
    ];

    // Secondary harmony notes
    const harmony = [
      { freq: 261.63, duration: 0.2 },  // C4
      { freq: 220.00, duration: 0.2 },  // A3
      { freq: 196.00, duration: 0.2 },  // G3
      { freq: 164.81, duration: 0.4 },  // E3
      { freq: 196.00, duration: 0.2 },  // G3
      { freq: 220.00, duration: 0.2 },  // A3
      { freq: 261.63, duration: 0.4 },  // C4
      { freq: 0, duration: 0.2 },       // Rest
      { freq: 196.00, duration: 0.2 },  // G3
      { freq: 164.81, duration: 0.2 },  // E3
      { freq: 146.83, duration: 0.2 },  // D3
      { freq: 130.81, duration: 0.4 },  // C3
      { freq: 146.83, duration: 0.2 },  // D3
      { freq: 164.81, duration: 0.2 },  // E3
      { freq: 196.00, duration: 0.4 },  // G3
      { freq: 0, duration: 0.4 },       // Rest
    ];

    let time = this.audioContext.currentTime;
    const totalDuration = notes.reduce((sum, n) => sum + n.duration, 0);

    // Play melody
    notes.forEach((note) => {
      if (note.freq > 0) {
        this.playNote(note.freq, time, note.duration * 0.9, 0.12);
      }
      time += note.duration;
    });

    // Play harmony (slightly quieter)
    let harmonyTime = this.audioContext.currentTime;
    harmony.forEach((note) => {
      if (note.freq > 0) {
        this.playNote(note.freq, harmonyTime, note.duration * 0.9, 0.06);
      }
      harmonyTime += note.duration;
    });

    // Loop the melody
    this.musicInterval = window.setTimeout(() => {
      if (this.musicPlaying) {
        this.playPokemonMelody();
      }
    }, totalDuration * 1000);
  }

  private playNote(frequency: number, startTime: number, duration: number, volume: number): void {
    if (!this.audioContext || !this.gainNode) return;

    const oscillator = this.audioContext.createOscillator();
    const noteGain = this.audioContext.createGain();

    oscillator.connect(noteGain);
    noteGain.connect(this.gainNode);

    // Square wave for retro chiptune sound
    oscillator.type = "square";
    oscillator.frequency.value = frequency;

    // Envelope for smooth attack/release
    noteGain.gain.setValueAtTime(0, startTime);
    noteGain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
    noteGain.gain.setValueAtTime(volume, startTime + duration - 0.05);
    noteGain.gain.linearRampToValueAtTime(0, startTime + duration);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
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
        this.gainNode.gain.value = 0.15;
      }
      this.playPokemonMelody();
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

    // Update weather
    if (previousState?.weather !== state.weather) {
      this.updateWeather(state.weather);
    }

    // Update day/night based on EST time from server
    if (state.timeInfo) {
      this.updateDayNightFromEST(state.timeInfo);
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
    // Only show sun during daytime
    if (this.currentTimeInfo?.isNight) {
      return; // Don't show sun at night
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
        const isSatoshi = character.isSatoshi === true;
        const isAsh = character.isAsh === true;
        const isSpecial = isSatoshi || isAsh;
        const variant = index % 9;
        this.characterVariants.set(character.id, variant);

        const textureKey = isSatoshi ? "satoshi" : isAsh ? "ash" : this.getCharacterTexture(character.mood, variant);
        sprite = this.add.sprite(character.x, character.y, textureKey);
        sprite.setDepth(isSpecial ? 11 : 10); // Special characters slightly above others
        sprite.setInteractive();
        sprite.setScale(isSpecial ? 1.3 : 1.2); // Special characters slightly larger

        // Hover effects
        sprite.on("pointerover", () => {
          sprite?.setScale(isSpecial ? 1.5 : 1.4);
          if (isSatoshi) {
            this.showSatoshiTooltip(sprite!);
          } else if (isAsh) {
            this.showAshTooltip(sprite!);
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
          if (isSatoshi) {
            // Satoshi opens the AI chat
            window.dispatchEvent(new CustomEvent("bagsworld-satoshi-click"));
          } else if (isAsh) {
            // Ash opens the ecosystem guide chat
            window.dispatchEvent(new CustomEvent("bagsworld-ash-click"));
          } else if (character.profileUrl) {
            // Open profile page in new tab
            window.open(character.profileUrl, "_blank");
          }
        });

        // Idle bounce animation - Special characters have slower, more deliberate movement
        this.tweens.add({
          targets: sprite,
          y: character.y - (isSpecial ? 2 : 3),
          duration: isSpecial ? 1200 : 800 + Math.random() * 400,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });

        // Add golden aura glow effect for Satoshi
        if (isSatoshi) {
          const glow = this.add.sprite(character.x, character.y, "glow");
          glow.setScale(1.0);
          glow.setAlpha(0.3);
          glow.setTint(0xf7931a); // Bitcoin orange
          glow.setDepth(10);

          // Store reference to glow for cleanup
          (sprite as any).satoshiGlow = glow;

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

        this.characterSprites.set(character.id, sprite);
      } else {
        // Update special character glow positions if they exist
        const satoshiGlow = (sprite as any).satoshiGlow;
        if (satoshiGlow) {
          satoshiGlow.x = sprite.x;
          satoshiGlow.y = sprite.y;
        }
        const ashGlow = (sprite as any).ashGlow;
        if (ashGlow) {
          ashGlow.x = sprite.x;
          ashGlow.y = sprite.y;
        }
      }

      // Update texture based on mood (skip for special characters)
      const isSatoshi = character.isSatoshi === true;
      const isAsh = character.isAsh === true;
      if (!isSatoshi && !isAsh) {
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
    const currentIds = new Set(buildings.map((b) => b.id));

    // Remove old buildings
    this.buildingSprites.forEach((container, id) => {
      if (!currentIds.has(id)) {
        container.destroy();
        this.buildingSprites.delete(id);
      }
    });

    // Add or update buildings
    buildings.forEach((building) => {
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

        const sprite = this.add.sprite(0, 0, `building_${building.level}`);
        sprite.setOrigin(0.5, 1);
        sprite.setScale(buildingScale);
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
          const isStarterBuilding = building.id.startsWith("Starter");
          const isTreasuryBuilding = building.id.startsWith("Treasury");

          if (isStarterBuilding) {
            // For starter buildings, show a message
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
        const newTexture = `building_${building.level}`;
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

  private showSatoshiTooltip(sprite: Phaser.GameObjects.Sprite): void {
    this.hideTooltip();

    const container = this.add.container(sprite.x, sprite.y - 70);

    const bg = this.add.rectangle(0, 0, 160, 68, 0x0a0a0f, 0.95);
    bg.setStrokeStyle(2, 0xf7931a); // Bitcoin orange border

    const nameText = this.add.text(0, -22, "₿ Satoshi Nakamoto", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#f7931a",
    });
    nameText.setOrigin(0.5, 0.5);

    const titleText = this.add.text(0, -6, "Creator of Bitcoin", {
      fontFamily: "monospace",
      fontSize: "8px",
      color: "#ffffff",
    });
    titleText.setOrigin(0.5, 0.5);

    const mysteryText = this.add.text(0, 10, "Identity unknown since 2011", {
      fontFamily: "monospace",
      fontSize: "7px",
      color: "#9ca3af",
    });
    mysteryText.setOrigin(0.5, 0.5);

    const clickText = this.add.text(0, 26, "🤖 Click to chat with AI", {
      fontFamily: "monospace",
      fontSize: "7px",
      color: "#60a5fa",
    });
    clickText.setOrigin(0.5, 0.5);

    container.add([bg, nameText, titleText, mysteryText, clickText]);
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
      // Community Rewards Hub tooltip
      const descText = this.add.text(0, -10, "Community Rewards Hub", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#4ade80",
      });
      descText.setOrigin(0.5, 0.5);

      const infoText = this.add.text(0, 6, "10% goes to strongest communities", {
        fontFamily: "monospace",
        fontSize: "7px",
        color: "#9ca3af",
      });
      infoText.setOrigin(0.5, 0.5);

      const clickText = this.add.text(0, 22, "🔍 Click to verify on Solscan", {
        fontFamily: "monospace",
        fontSize: "7px",
        color: "#60a5fa",
      });
      clickText.setOrigin(0.5, 0.5);

      tooltipContainer.add([bg, nameText, descText, infoText, clickText]);
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
}
