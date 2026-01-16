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

    // Initialize clouds
    this.createClouds();

    // Add animals to the world
    this.createAnimals();

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

  private updateDayNightFromEST(timeInfo: { isNight: boolean; isDusk: boolean; isDawn: boolean }): void {
    let alpha = 0;
    let tint = 0x000000;

    if (timeInfo.isNight) {
      // Night (8 PM to 6 AM EST)
      alpha = 0.4;
      tint = 0x1a1a4e;
    } else if (timeInfo.isDusk) {
      // Dusk (6 PM to 8 PM EST)
      alpha = 0.2;
      tint = 0x4a2a4e;
    } else if (timeInfo.isDawn) {
      // Dawn (6 AM to 8 AM EST)
      alpha = 0.15;
      tint = 0x4a3a2e;
    }

    this.tweens.add({
      targets: this.overlay,
      alpha,
      duration: 2000,
      ease: "Linear",
    });

    if (alpha > 0) {
      this.overlay.setFillStyle(tint, alpha);
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
        // Assign a random variant to this character for diversity
        const variant = index % 9;
        this.characterVariants.set(character.id, variant);

        const textureKey = this.getCharacterTexture(character.mood, variant);
        sprite = this.add.sprite(character.x, character.y, textureKey);
        sprite.setDepth(10);
        sprite.setInteractive();
        sprite.setScale(1.2);

        // Hover effects
        sprite.on("pointerover", () => {
          sprite?.setScale(1.4);
          this.showCharacterTooltip(character, sprite!);
          this.input.setDefaultCursor("pointer");
        });
        sprite.on("pointerout", () => {
          sprite?.setScale(1.2);
          this.hideTooltip();
          this.input.setDefaultCursor("default");
        });
        sprite.on("pointerdown", () => {
          // Open profile page in new tab
          if (character.profileUrl) {
            window.open(character.profileUrl, "_blank");
          }
        });

        // Idle bounce animation
        this.tweens.add({
          targets: sprite,
          y: character.y - 3,
          duration: 800 + Math.random() * 400,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });

        this.characterSprites.set(character.id, sprite);
      }

      // Update texture based on mood
      const variant = this.characterVariants.get(character.id) ?? 0;
      const expectedTexture = this.getCharacterTexture(character.mood, variant);
      if (sprite.texture.key !== expectedTexture) {
        sprite.setTexture(expectedTexture);
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

        // Shadow
        const shadow = this.add.ellipse(2, 2, 30, 8, 0x000000, 0.3);
        container.add(shadow);

        const sprite = this.add.sprite(0, 0, `building_${building.level}`);
        sprite.setOrigin(0.5, 1);
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
          // Open token page in new tab
          if (building.tokenUrl) {
            window.open(building.tokenUrl, "_blank");
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

  private showBuildingTooltip(
    building: GameBuilding,
    container: Phaser.GameObjects.Container
  ): void {
    this.hideTooltip();

    const tooltipContainer = this.add.container(container.x, container.y - 110);

    const bg = this.add.rectangle(0, 0, 130, 80, 0x0a0a0f, 0.95);
    bg.setStrokeStyle(2, building.health > 50 ? 0x4ade80 : 0xf87171);

    const nameText = this.add.text(0, -28, `${building.name}`, {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ffffff",
    });
    nameText.setOrigin(0.5, 0.5);

    // Market cap
    const mcapText = this.add.text(0, -12, building.marketCap ? this.formatMarketCap(building.marketCap) : "N/A", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#4ade80",
    });
    mcapText.setOrigin(0.5, 0.5);

    // Level label based on market cap tier
    const levelLabels = ["Startup", "Growing", "Established", "Major", "Top Tier"];
    const levelLabel = levelLabels[building.level - 1] || `Level ${building.level}`;
    const levelText = this.add.text(0, 2, `⭐ ${levelLabel}`, {
      fontFamily: "monospace",
      fontSize: "8px",
      color: "#fbbf24",
    });
    levelText.setOrigin(0.5, 0.5);

    // 24h change
    const changeColor = (building.change24h ?? 0) >= 0 ? "#4ade80" : "#f87171";
    const changePrefix = (building.change24h ?? 0) >= 0 ? "+" : "";
    const changeText = this.add.text(0, 16, `${changePrefix}${(building.change24h ?? 0).toFixed(0)}% (24h)`, {
      fontFamily: "monospace",
      fontSize: "8px",
      color: changeColor,
    });
    changeText.setOrigin(0.5, 0.5);

    const clickText = this.add.text(0, 32, "Click to view on Bags.fm", {
      fontFamily: "monospace",
      fontSize: "7px",
      color: "#6b7280",
    });
    clickText.setOrigin(0.5, 0.5);

    tooltipContainer.add([bg, nameText, mcapText, levelText, changeText, clickText]);
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
}
