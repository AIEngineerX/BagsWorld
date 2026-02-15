import * as Phaser from "phaser";
import {
  ARCADE_WIDTH,
  ARCADE_HEIGHT,
  GROUND_Y,
  LEVEL_WIDTH,
  CHARACTER_STATS,
  WEAPONS,
  ENEMY_STATS,
  PICKUPS,
  STARTING_LIVES,
  STARTING_GRENADES,
  GRENADE_DAMAGE,
  INVINCIBILITY_TIME,
  TILE_SIZE,
  SECTION_THEMES,
  type ArcadeCharacter,
  type WeaponType,
  type EnemyType,
  type PickupType,
} from "./types";
import { getGroundPlatforms, getSectionData, type EnemySpawn } from "./level-data";

const ANIM_SPEEDS: Record<string, number> = {
  idle: 200,
  run: 120,
  shoot: 100,
  die: 150,
  jump: 200,
  fall: 200,
};
const ANIM_FRAMES: Record<string, number> = {
  idle: 4,
  run: 4,
  jump: 2,
  fall: 2,
  shoot: 3,
  die: 5,
};

export class ArcadeGameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private character!: ArcadeCharacter;
  private hp!: number;
  private maxHP!: number;
  private lives!: number;
  private score!: number;
  private weapon!: WeaponType;
  private ammo!: number;
  private grenades!: number;
  private facing: "left" | "right" = "right";
  private isCrouching = false;
  private isHurt = false;
  private isDead = false;
  private lastFireTime = 0;
  private invincibleUntil = 0;

  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private bullets!: Phaser.Physics.Arcade.Group;
  private enemyBullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private pickups!: Phaser.Physics.Arcade.Group;
  private grenadeGroup!: Phaser.Physics.Arcade.Group;
  private crates!: Phaser.Physics.Arcade.Group;

  private boss?: Phaser.Physics.Arcade.Sprite;
  private bossHP = 0;
  private bossPhase = 1;
  private bossLastFire = 0;
  private bossShootUntil = 0;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyZ!: Phaser.Input.Keyboard.Key;
  private keyX!: Phaser.Input.Keyboard.Key;
  private keyC!: Phaser.Input.Keyboard.Key;

  private animTimer = 0;
  private animFrame = 0;
  private animState = "idle";
  private wasOnGround = true;
  private spawnedSections = new Set<number>();
  private enemyAnimTimer = 0;
  private enemyAnimFrame = 0;

  constructor() {
    super({ key: "ArcadeGameScene" });
  }

  init(data: { character: ArcadeCharacter }): void {
    this.character = data.character;
  }

  create(): void {
    const stats = CHARACTER_STATS[this.character];

    this.hp = stats.maxHP;
    this.maxHP = stats.maxHP;
    this.lives = STARTING_LIVES;
    this.score = 0;
    this.weapon = "pistol";
    this.ammo = -1;
    this.grenades = STARTING_GRENADES;
    this.facing = "right";
    this.isCrouching = false;
    this.isHurt = false;
    this.isDead = false;
    this.lastFireTime = 0;
    this.invincibleUntil = 0;
    this.animState = "idle";
    this.wasOnGround = true;
    this.spawnedSections.clear();
    this.boss = undefined;
    this.bossHP = 0;
    this.bossPhase = 1;
    this.bossLastFire = 0;
    this.bossShootUntil = 0;

    this.physics.world.setBounds(0, 0, LEVEL_WIDTH, ARCADE_HEIGHT);

    // 4-layer parallax background
    this.add
      .tileSprite(0, 0, LEVEL_WIDTH, ARCADE_HEIGHT, "bg_sky")
      .setOrigin(0, 0)
      .setDepth(-4)
      .setScrollFactor(0);
    this.add
      .tileSprite(0, 0, LEVEL_WIDTH, ARCADE_HEIGHT, "bg_city")
      .setOrigin(0, 0)
      .setDepth(-3)
      .setScrollFactor(0.1);
    this.add
      .tileSprite(0, 100, LEVEL_WIDTH, 135, "bg_mountains")
      .setOrigin(0, 0)
      .setDepth(-2)
      .setScrollFactor(0.3);
    this.add
      .tileSprite(0, 100, LEVEL_WIDTH, 135, "bg_midground")
      .setOrigin(0, 0)
      .setDepth(-1)
      .setScrollFactor(0.5);

    this.platforms = this.physics.add.staticGroup();
    this.bullets = this.physics.add.group({
      maxSize: 30,
      allowGravity: false,
    });
    this.enemyBullets = this.physics.add.group({
      maxSize: 20,
      allowGravity: false,
    });
    this.enemies = this.physics.add.group();
    this.pickups = this.physics.add.group({ allowGravity: false });
    this.grenadeGroup = this.physics.add.group();
    this.crates = this.physics.add.group();

    for (const gp of getGroundPlatforms()) {
      for (let i = 0; i < gp.width; i++) {
        const tile = this.platforms.create(
          gp.x + i * TILE_SIZE + TILE_SIZE / 2,
          gp.y + TILE_SIZE / 2,
          gp.texture
        ) as Phaser.Physics.Arcade.Sprite;
        tile.setImmovable(true);
        tile.refreshBody();
      }
    }

    this.createPlayer();

    this.cameras.main.setBounds(0, 0, LEVEL_WIDTH, ARCADE_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.5);
    this.cameras.main.setDeadzone(60, 40);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyZ = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.keyX = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    this.keyC = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C);

    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.enemies, this.platforms);
    this.physics.add.collider(this.crates, this.platforms);
    this.physics.add.overlap(
      this.bullets,
      this.enemies,
      this.onBulletHitEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    );
    this.physics.add.overlap(
      this.enemyBullets,
      this.player,
      this.onEnemyBulletHitPlayer as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    );
    this.physics.add.overlap(
      this.player,
      this.pickups,
      this.onCollectPickup as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    );
    this.physics.add.overlap(
      this.player,
      this.enemies,
      this.onPlayerTouchEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    );
    this.physics.add.overlap(
      this.bullets,
      this.crates,
      this.onBulletHitCrate as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    );
    this.physics.add.overlap(
      this.grenadeGroup,
      this.crates,
      this.onGrenadeHitCrate as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    );

    this.enemyAnimTimer = 0;
    this.enemyAnimFrame = 0;

    // Ambient dust mote particles (follow camera)
    if (this.textures.exists("particle_dust_mote")) {
      const dustEmitter = this.add.particles(0, 0, "particle_dust_mote", {
        x: { min: 0, max: ARCADE_WIDTH },
        y: { min: 0, max: ARCADE_HEIGHT },
        lifespan: 4000,
        speedX: { min: -5, max: 5 },
        speedY: { min: -8, max: -2 },
        alpha: { start: 0.3, end: 0 },
        scale: { start: 1, end: 0.5 },
        frequency: 1500,
        maxParticles: 3,
      });
      dustEmitter.setScrollFactor(0);
      dustEmitter.setDepth(15);
    }

    // Vignette overlay
    if (this.textures.exists("vignette")) {
      const vignette = this.add.sprite(ARCADE_WIDTH / 2, ARCADE_HEIGHT / 2, "vignette");
      vignette.setScrollFactor(0);
      vignette.setDepth(90);
      vignette.setAlpha(0.6);
    }

    this.emitHUD();
    this.checkSectionSpawns();
  }

  update(time: number, delta: number): void {
    if (this.isDead) return;

    // State-aware animation timer
    const animSpeed = ANIM_SPEEDS[this.animState] || 200;
    const frameCount = ANIM_FRAMES[this.animState] || 2;
    this.animTimer += delta;
    if (this.animTimer >= animSpeed) {
      this.animTimer -= animSpeed;
      this.animFrame = (this.animFrame + 1) % frameCount;
    }

    // Enemy idle animation timer (separate from player)
    this.enemyAnimTimer += delta;
    if (this.enemyAnimTimer >= 500) {
      this.enemyAnimTimer -= 500;
      this.enemyAnimFrame = (this.enemyAnimFrame + 1) % 2;
    }

    const stats = CHARACTER_STATS[this.character];
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down;

    this.isCrouching = this.cursors.down.isDown && onGround;

    if (this.isCrouching) {
      body.setVelocityX(0);
    } else if (this.cursors.left.isDown) {
      body.setVelocityX(-stats.speed);
      this.facing = "left";
      this.player.setFlipX(true);
    } else if (this.cursors.right.isDown) {
      body.setVelocityX(stats.speed);
      this.facing = "right";
      this.player.setFlipX(false);
    } else {
      body.setVelocityX(0);
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyX) && onGround) {
      body.setVelocityY(stats.jumpForce);
    }

    if (this.keyZ.isDown && time - this.lastFireTime > stats.fireRate) {
      this.shoot(time);
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyC) && this.grenades > 0) {
      this.throwGrenade();
    }

    this.updatePlayerTexture(onGround);

    // Landing dust puff
    if (onGround && !this.wasOnGround) {
      const dust = this.add.particles(this.player.x, this.player.y + 14, "particle_dust", {
        speed: { min: 15, max: 40 },
        angle: { min: 0, max: 360 },
        lifespan: 300,
        gravityY: 50,
        scale: { start: 1, end: 0 },
        emitting: false,
      });
      dust.explode(Phaser.Math.Between(4, 6));
      this.time.delayedCall(400, () => dust.destroy());
    }
    this.wasOnGround = onGround;

    if (time < this.invincibleUntil) {
      this.player.setAlpha(Math.sin(time * 0.02) > 0 ? 1 : 0.3);
    } else {
      this.player.setAlpha(1);
    }

    this.checkSectionSpawns();
    this.updateEnemies(time);

    if (this.boss?.active) {
      this.updateBoss(time);
    }

    this.cleanupBullets();
    this.emitHUD();
  }

  private createPlayer(): void {
    this.player = this.physics.add.sprite(50, GROUND_Y - 32, `${this.character}_idle_1`);
    this.player.setCollideWorldBounds(true);
    this.player.body!.setSize(16, 30);
    this.player.body!.setOffset(4, 2);
  }

  private updatePlayerTexture(onGround: boolean): void {
    const id = this.character;
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    // Determine current animation state
    let state: string;
    if (this.isHurt) {
      state = "hurt";
    } else if (!onGround) {
      state = body.velocity.y < 0 ? "jump" : "fall";
    } else if (this.isCrouching) {
      state = this.keyZ.isDown ? "crouch_shoot" : "crouch";
    } else if (this.keyZ.isDown) {
      state = "shoot";
    } else if (Math.abs(body.velocity.x) > 10) {
      state = "run";
    } else {
      state = "idle";
    }

    // Reset frame counter on state change
    if (state !== this.animState) {
      this.animState = state;
      this.animFrame = 0;
      this.animTimer = 0;
    }

    // Map state to texture key
    const f = this.animFrame + 1; // 1-indexed texture names
    let textureKey: string;
    switch (state) {
      case "hurt":
        textureKey = `${id}_hurt`;
        break;
      case "jump":
        textureKey = this.animFrame === 0 ? `${id}_jump` : `${id}_jump_2`;
        break;
      case "fall":
        textureKey = this.animFrame === 0 ? `${id}_fall` : `${id}_fall_2`;
        break;
      case "crouch":
        textureKey = `${id}_crouch`;
        break;
      case "crouch_shoot":
        textureKey = `${id}_crouch_shoot`;
        break;
      case "shoot":
        textureKey = `${id}_shoot_${f}`;
        break;
      case "run":
        textureKey = `${id}_run_${f}`;
        break;
      default:
        textureKey = `${id}_idle_${f}`;
        break;
    }

    this.player.setTexture(textureKey);
  }

  private shoot(time: number): void {
    this.lastFireTime = time;
    const currentWeapon = this.weapon;
    const weaponInfo = WEAPONS[currentWeapon];

    // Determine texture BEFORE consuming ammo (weapon may revert to pistol)
    const bulletTexture =
      currentWeapon === "spread"
        ? "bullet_red"
        : currentWeapon === "heavy"
          ? "bullet_blue"
          : "bullet_yellow";

    if (this.ammo > 0) {
      this.ammo--;
      if (this.ammo <= 0) {
        this.weapon = "pistol";
        this.ammo = -1;
      }
    }

    const bulletY = this.isCrouching ? this.player.y + 4 : this.player.y - 4;
    const dir = this.facing === "right" ? 1 : -1;

    if (weaponInfo.spread === 1) {
      this.fireBullet(this.player.x + dir * 12, bulletY, dir, 0, weaponInfo, bulletTexture);
    } else {
      for (let i = -1; i <= 1; i++) {
        this.fireBullet(
          this.player.x + dir * 12,
          bulletY,
          dir,
          i * 0.26,
          weaponInfo,
          bulletTexture
        );
      }
    }

    // Muzzle flash particles
    const muzzleX = this.player.x + dir * 14;
    const muzzle = this.add.particles(muzzleX, bulletY, "particle_muzzle", {
      speed: { min: 20, max: 60 },
      lifespan: 80,
      scale: { start: 1, end: 0 },
      emitting: false,
    });
    muzzle.explode(Phaser.Math.Between(3, 5));
    this.time.delayedCall(100, () => muzzle.destroy());

    // Shell casing
    const shellAngle = this.facing === "right" ? { min: 200, max: 250 } : { min: 290, max: 340 };
    const shell = this.add.particles(this.player.x, this.player.y - 2, "particle_shell", {
      speed: { min: 30, max: 60 },
      angle: shellAngle,
      lifespan: 500,
      gravityY: 200,
      emitting: false,
    });
    shell.explode(1);
    this.time.delayedCall(600, () => shell.destroy());
  }

  private fireBullet(
    x: number,
    y: number,
    dirX: number,
    angleOffset: number,
    weaponInfo: { bulletSpeed: number; damage: number },
    texture: string
  ): void {
    const bullet = this.bullets.get(x, y, texture) as Phaser.Physics.Arcade.Sprite;
    if (!bullet) return;

    bullet.setActive(true).setVisible(true);
    bullet.body!.enable = true;
    (bullet.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

    const vx = dirX * weaponInfo.bulletSpeed;
    const vy = angleOffset * weaponInfo.bulletSpeed;
    (bullet.body as Phaser.Physics.Arcade.Body).setVelocity(vx, vy);

    // Store damage on bullet for collision handler
    (bullet as any).damage = weaponInfo.damage;

    // Auto-destroy after 2 seconds
    this.time.delayedCall(2000, () => {
      if (bullet.active) this.deactivateBullet(bullet);
    });
  }

  private deactivateBullet(b: Phaser.Physics.Arcade.Sprite): void {
    b.setActive(false).setVisible(false);
    b.body!.enable = false;
  }

  private fireEnemyBullet(
    x: number,
    y: number,
    vx: number,
    vy: number,
    damage: number,
    texture: string
  ): void {
    const bullet = this.enemyBullets.get(x, y, texture) as Phaser.Physics.Arcade.Sprite;
    if (!bullet) return;
    bullet.setActive(true).setVisible(true);
    bullet.body!.enable = true;
    (bullet.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    (bullet.body as Phaser.Physics.Arcade.Body).setVelocity(vx, vy);
    (bullet as any).damage = damage;
    this.time.delayedCall(3000, () => {
      if (bullet.active) this.deactivateBullet(bullet);
    });
  }

  private throwGrenade(): void {
    this.grenades--;
    const dir = this.facing === "right" ? 1 : -1;
    const grenade = this.grenadeGroup.create(
      this.player.x + dir * 10,
      this.player.y - 10,
      "grenade"
    ) as Phaser.Physics.Arcade.Sprite;
    (grenade.body as Phaser.Physics.Arcade.Body).setVelocity(dir * 200, -200);
    grenade.setBounce(0.3);

    // Explode after 1.5 seconds
    this.time.delayedCall(1500, () => {
      if (!grenade.active) return;

      this.createLargeExplosion(grenade.x, grenade.y);

      // Grenade-specific: extra shake + fire particles
      this.cameras.main.shake(200, 0.012);
      const fire = this.add.particles(grenade.x, grenade.y, "particle_fire", {
        speed: { min: 30, max: 80 },
        angle: { min: 0, max: 360 },
        lifespan: 400,
        scale: { start: 1, end: 0 },
        emitting: false,
      });
      fire.explode(6);
      this.time.delayedCall(500, () => fire.destroy());

      this.enemies.getChildren().forEach((obj) => {
        const e = obj as Phaser.Physics.Arcade.Sprite;
        if (e.active && Phaser.Math.Distance.Between(grenade.x, grenade.y, e.x, e.y) < 60) {
          if ((e as any).isBoss) {
            this.damageBoss(GRENADE_DAMAGE);
          } else {
            this.damageEnemy(e, GRENADE_DAMAGE);
          }
        }
      });

      grenade.destroy();
    });
  }

  private takeDamage(amount: number): void {
    const now = this.time.now;
    if (now < this.invincibleUntil || this.isDead) return;

    this.hp -= amount;
    this.isHurt = true;
    this.invincibleUntil = now + INVINCIBILITY_TIME;

    // Hit-flash (Metal Slug signature damage feedback)
    this.player.setTintFill(0xffffff);
    this.time.delayedCall(60, () => {
      if (this.player.active) this.player.clearTint();
    });

    // Screen red flash on damage
    this.cameras.main.flash(100, 255, 50, 50, true);

    // Screen shake on heavy hits
    if (amount >= 2) {
      this.cameras.main.shake(80, 0.004);
    }

    // Knockback
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocityY(-150);
    body.setVelocityX(this.facing === "right" ? -100 : 100);

    this.time.delayedCall(300, () => {
      this.isHurt = false;
    });

    if (this.hp <= 0) {
      this.playerDie();
    }
  }

  private playerDie(): void {
    this.isDead = true;
    this.animState = "die";
    this.animFrame = 0;
    this.player.setTexture(`${this.character}_die_1`);
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, -200);

    // 5-frame death animation sequence
    this.time.delayedCall(150, () => this.player.setTexture(`${this.character}_die_2`));
    this.time.delayedCall(300, () => this.player.setTexture(`${this.character}_die_3`));
    this.time.delayedCall(450, () => this.player.setTexture(`${this.character}_die_4`));
    this.time.delayedCall(600, () => this.player.setTexture(`${this.character}_die_5`));

    this.time.delayedCall(1000, () => {
      this.lives--;
      if (this.lives <= 0) {
        this.gameOver(false);
      } else {
        this.respawn();
      }
    });
  }

  private respawn(): void {
    // Respawn at current section start
    const currentSection = Math.floor(this.player.x / 800);
    const respawnX = currentSection * 800 + 50;

    this.player.setPosition(respawnX, GROUND_Y - 32);
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.hp = this.maxHP;
    this.isDead = false;
    this.isHurt = false;
    this.weapon = "pistol";
    this.ammo = -1;
    this.invincibleUntil = this.time.now + INVINCIBILITY_TIME * 2;

    // Clear stale enemy bullets to prevent instant damage on respawn
    this.enemyBullets.getChildren().forEach((obj) => {
      this.deactivateBullet(obj as Phaser.Physics.Arcade.Sprite);
    });

    this.emitHUD();
  }

  private gameOver(victory: boolean): void {
    this.scene.stop("ArcadeHUDScene");
    this.scene.start("ArcadeGameOverScene", {
      victory,
      score: this.score,
      character: this.character,
    });
  }

  private onBulletHitEnemy(
    bullet: Phaser.GameObjects.GameObject,
    enemy: Phaser.GameObjects.GameObject
  ): void {
    const b = bullet as Phaser.Physics.Arcade.Sprite;
    const e = enemy as Phaser.Physics.Arcade.Sprite;

    this.deactivateBullet(b);

    const damage = (b as any).damage ?? 1;

    if ((e as any).isBoss) {
      this.damageBoss(damage);
    } else {
      this.damageEnemy(e, damage);
    }
  }

  private onEnemyBulletHitPlayer(
    _player: Phaser.GameObjects.GameObject,
    bullet: Phaser.GameObjects.GameObject
  ): void {
    const b = bullet as Phaser.Physics.Arcade.Sprite;
    this.deactivateBullet(b);
    this.takeDamage((b as any).damage ?? 1);
  }

  private onPlayerTouchEnemy(
    _player: Phaser.GameObjects.GameObject,
    enemy: Phaser.GameObjects.GameObject
  ): void {
    const e = enemy as Phaser.Physics.Arcade.Sprite;
    if (e.active) {
      const type = (e as any).enemyType as EnemyType | undefined;
      this.takeDamage(type ? ENEMY_STATS[type].damage : 1);
    }
  }

  private onCollectPickup(
    _player: Phaser.GameObjects.GameObject,
    pickup: Phaser.GameObjects.GameObject
  ): void {
    const p = pickup as Phaser.Physics.Arcade.Sprite;
    const type = (p as any).pickupType as PickupType | undefined;
    if (!type || !PICKUPS[type]) {
      p.destroy();
      return;
    }
    const info = PICKUPS[type];

    if (info.weapon) {
      this.weapon = info.weapon;
      this.ammo = WEAPONS[info.weapon].ammo;
    }
    if (info.healAmount) {
      this.hp = Math.min(this.maxHP, this.hp + info.healAmount);
    }
    if (info.grenades) {
      this.grenades += info.grenades;
    }

    this.score += 50;
    this.showScorePopup(p.x, p.y, 50);
    p.destroy();
    this.emitHUD();
  }

  private onBulletHitCrate(
    bullet: Phaser.GameObjects.GameObject,
    crate: Phaser.GameObjects.GameObject
  ): void {
    const b = bullet as Phaser.Physics.Arcade.Sprite;
    this.deactivateBullet(b);

    const c = crate as Phaser.Physics.Arcade.Sprite;
    (c as any).crateHP = ((c as any).crateHP ?? 2) - 1;
    if ((c as any).crateHP <= 0) {
      this.createExplosion(c.x, c.y);
      // Debris particle burst
      const debris = this.add.particles(c.x, c.y, "particle_debris", {
        speed: { min: 40, max: 100 },
        angle: { min: 0, max: 360 },
        lifespan: 400,
        gravityY: 150,
        scale: { start: 1, end: 0 },
        emitting: false,
      });
      debris.explode(Phaser.Math.Between(6, 8));
      this.time.delayedCall(500, () => debris.destroy());
      this.showScorePopup(c.x, c.y, 25);
      c.destroy();
      this.score += 25;
    }
  }

  private onGrenadeHitCrate(
    _grenade: Phaser.GameObjects.GameObject,
    crate: Phaser.GameObjects.GameObject
  ): void {
    const c = crate as Phaser.Physics.Arcade.Sprite;
    this.createExplosion(c.x, c.y);
    c.destroy();
    this.score += 25;
  }

  private damageEnemy(enemy: Phaser.Physics.Arcade.Sprite, damage: number): void {
    if ((enemy as any).isDying) return;

    (enemy as any).hp = ((enemy as any).hp ?? 1) - damage;

    // Sharp hit-flash
    enemy.setTintFill(0xffffff);
    this.time.delayedCall(60, () => {
      if (enemy.active) enemy.clearTint();
    });

    if ((enemy as any).hp <= 0) {
      const type = (enemy as any).enemyType as EnemyType;
      this.score += ENEMY_STATS[type].score;
      this.playEnemyDeath(enemy, type);
      this.emitHUD();
    } else {
      // Non-lethal hit: stagger
      const body = enemy.body as Phaser.Physics.Arcade.Body;
      const hitDir = this.player.x < enemy.x ? 1 : -1;
      body.setVelocityX(hitDir * 80);
      body.setVelocityY(-50);
      (enemy as any).staggerUntil = this.time.now + 300;
    }
  }

  private playEnemyDeath(enemy: Phaser.Physics.Arcade.Sprite, type: EnemyType): void {
    (enemy as any).isDying = true;
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    body.enable = false;

    const hitDir = this.player.x < enemy.x ? 1 : -1;

    // Frame 1: recoil
    enemy.setTexture(`${type}_die_1`);
    this.tweens.add({
      targets: enemy,
      x: enemy.x + hitDir * 8,
      y: enemy.y - 4,
      duration: 100,
    });

    // Frame 2: ragdoll
    this.time.delayedCall(100, () => {
      if (!enemy.active) return;
      enemy.setTexture(`${type}_die_2`);
      this.tweens.add({
        targets: enemy,
        x: enemy.x + hitDir * 6,
        y: enemy.y + 4,
        duration: 100,
      });
    });

    // Frame 3: crumple
    this.time.delayedCall(200, () => {
      if (!enemy.active) return;
      enemy.setTexture(`${type}_die_3`);
    });

    // Frame 4: ground + explosion + cleanup
    this.time.delayedCall(320, () => {
      if (!enemy.active) return;
      enemy.setTexture(`${type}_die_4`);
    });

    this.time.delayedCall(420, () => {
      if (!enemy.active) return;
      this.showScorePopup(enemy.x, enemy.y, ENEMY_STATS[type].score);
      this.createExplosion(enemy.x, enemy.y);
      enemy.destroy();
    });
  }

  private checkSectionSpawns(): void {
    const cameraX = this.cameras.main.scrollX;
    const section = Math.floor((cameraX + ARCADE_WIDTH / 2) / 800);

    // Spawn enemies for current and next section
    for (let s = Math.max(0, section); s <= Math.min(5, section + 1); s++) {
      if (this.spawnedSections.has(s)) continue;
      this.spawnedSections.add(s);

      const sectionData = getSectionData(s);

      sectionData.platforms.forEach((p) => {
        for (let i = 0; i < p.width; i++) {
          const tile = this.platforms.create(
            p.x + i * TILE_SIZE + TILE_SIZE / 2,
            p.y + TILE_SIZE / 2,
            p.texture
          ) as Phaser.Physics.Arcade.Sprite;
          tile.setImmovable(true);
          tile.refreshBody();
        }
      });

      sectionData.enemies.forEach((e) => this.spawnEnemy(e));

      sectionData.pickups.forEach((p) => {
        const pickup = this.pickups.create(
          p.x,
          p.y,
          `pickup_${p.type}`
        ) as Phaser.Physics.Arcade.Sprite;
        (pickup as any).pickupType = p.type;
        (pickup.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
        // Floating animation
        this.tweens.add({
          targets: pickup,
          y: p.y - 4,
          duration: 800,
          yoyo: true,
          repeat: -1,
        });
      });

      // Spawn decorations (purely visual, no physics)
      sectionData.decorations.forEach((d) => {
        const deco = this.add.sprite(d.x, d.y, d.type);
        deco.setOrigin(0.5, 1);
        deco.setDepth(d.depth ?? 2);
      });

      // Spawn section-specific ember particles for warzone/fortress sections
      if ((s === 2 || s === 4) && this.textures.exists("particle_ember")) {
        const base = s * 800;
        const embers = this.add.particles(base + 400, GROUND_Y, "particle_ember", {
          x: { min: base, max: base + 800 },
          y: { min: GROUND_Y - 40, max: GROUND_Y },
          lifespan: 3000,
          speedY: { min: -20, max: -8 },
          speedX: { min: -5, max: 5 },
          alpha: { start: 0.7, end: 0 },
          scale: { start: 1, end: 0.3 },
          frequency: 800,
          maxParticles: 4,
        });
        embers.setDepth(15);
      }

      // Spawn section-specific ambient lights
      const theme = SECTION_THEMES[s];
      if (theme) {
        for (let li = 0; li < 8; li++) {
          const base = s * 800;
          const lx = base + 50 + li * 95 + Phaser.Math.Between(-20, 20);
          const ly = Phaser.Math.Between(60, 200);
          const light = this.add.rectangle(lx, ly, 2, 2, theme.ambientColor, 0.15);
          light.setDepth(-0.5);
          this.tweens.add({
            targets: light,
            alpha: { from: 0.05, to: 0.3 },
            duration: Phaser.Math.Between(800, 2000),
            yoyo: true,
            repeat: -1,
            delay: Phaser.Math.Between(0, 1500),
          });
        }
      }

      // Spawn crates for sections 2 and 3
      if (s === 2 || s === 3) {
        const base = s * 800;
        const cratePositions =
          s === 2
            ? [
                { x: base + 300, y: GROUND_Y - 16 },
                { x: base + 500, y: GROUND_Y - 16 },
              ]
            : [
                { x: base + 200, y: GROUND_Y - 16 },
                { x: base + 400, y: GROUND_Y - 16 },
                { x: base + 600, y: GROUND_Y - 16 },
              ];
        cratePositions.forEach((pos) => {
          const crate = this.crates.create(pos.x, pos.y, "crate") as Phaser.Physics.Arcade.Sprite;
          (crate as any).crateHP = 2;
          (crate.body as Phaser.Physics.Arcade.Body).setImmovable(true);
        });
      }
    }
  }

  private spawnEnemy(data: EnemySpawn): void {
    const stats = ENEMY_STATS[data.type];

    if (data.type === "boss") {
      const textureKey = "boss_idle";
      this.boss = this.physics.add.sprite(data.x, data.y, textureKey);
      this.boss.setCollideWorldBounds(true);
      this.boss.body!.setSize(stats.width - 8, stats.height - 8);
      (this.boss as any).isBoss = true;
      (this.boss as any).enemyType = "boss";
      this.bossHP = stats.hp;
      this.bossPhase = 1;

      // Add boss to enemies group for bullet collision
      this.enemies.add(this.boss);

      this.physics.add.collider(this.boss, this.platforms);
      return;
    }

    const textureKey = `${data.type}_idle`;

    // Spawn enemies above their target position and drop them in
    const spawnOffsetY = data.type === "turret" ? 0 : -40;
    const enemy = this.enemies.create(
      data.x,
      data.y + spawnOffsetY,
      textureKey
    ) as Phaser.Physics.Arcade.Sprite;
    enemy.body!.setSize(stats.width - 4, stats.height - 4);
    (enemy as any).hp = stats.hp;
    (enemy as any).enemyType = data.type;
    (enemy as any).patrolRange = data.patrolRange || 100;
    (enemy as any).patrolStart = data.x;
    (enemy as any).lastFire = 0;
    (enemy as any).facing = data.facing || "left";

    if (data.type === "turret") {
      (enemy.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
      (enemy.body as Phaser.Physics.Arcade.Body).setImmovable(true);
    } else {
      // Drop-in spawn animation: start transparent, fall to position, land with dust
      enemy.setAlpha(0);
      (enemy as any).staggerUntil = this.time.now + 600;
      this.tweens.add({
        targets: enemy,
        alpha: 1,
        duration: 200,
      });
      // Landing dust when they reach ground
      this.time.delayedCall(500, () => {
        if (!enemy.active) return;
        const dust = this.add.particles(enemy.x, enemy.y + stats.height / 2, "particle_dust", {
          speed: { min: 10, max: 30 },
          angle: { min: 0, max: 360 },
          lifespan: 250,
          gravityY: 40,
          scale: { start: 1, end: 0 },
          emitting: false,
        });
        dust.explode(3);
        this.time.delayedCall(300, () => dust.destroy());
      });
    }
  }

  private updateEnemies(time: number): void {
    this.enemies.getChildren().forEach((obj) => {
      const enemy = obj as Phaser.Physics.Arcade.Sprite;
      if (!enemy.active || (enemy as any).isBoss || (enemy as any).isDying) return;

      // Skip AI during stagger
      if ((enemy as any).staggerUntil && time < (enemy as any).staggerUntil) return;

      const type = (enemy as any).enemyType as EnemyType;
      const stats = ENEMY_STATS[type];
      const distToPlayer = Phaser.Math.Distance.Between(
        enemy.x,
        enemy.y,
        this.player.x,
        this.player.y
      );

      // Texture animation: idle cycling for stationary, walk for moving
      if (type === "turret") {
        enemy.setTexture(this.enemyAnimFrame === 0 ? "turret_idle" : "turret_idle_2");
      } else {
        const body = enemy.body as Phaser.Physics.Arcade.Body;
        if (Math.abs(body.velocity.x) > 5) {
          enemy.setTexture(this.animFrame % 2 === 0 ? `${type}_walk_1` : `${type}_walk_2`);
        } else {
          enemy.setTexture(this.enemyAnimFrame === 0 ? `${type}_idle` : `${type}_idle_2`);
        }
      }

      if (type !== "turret") {
        const body = enemy.body as Phaser.Physics.Arcade.Body;
        const hp = (enemy as any).hp ?? stats.hp;
        const lowHP = hp <= stats.hp * 0.3;

        // Panic behavior: low HP enemies flee when player is close
        if (lowHP && distToPlayer < 150) {
          const fleeDir = this.player.x < enemy.x ? 1 : -1;
          body.setVelocityX(fleeDir * stats.speed * 1.5);
          enemy.setFlipX(fleeDir < 0);
        } else if (distToPlayer > 200) {
          const patrolStart = (enemy as any).patrolStart as number;
          const patrolRange = (enemy as any).patrolRange as number;

          if (enemy.x < patrolStart - patrolRange) {
            body.setVelocityX(stats.speed);
            (enemy as any).facing = "right";
            enemy.setFlipX(false);
          } else if (enemy.x > patrolStart + patrolRange) {
            body.setVelocityX(-stats.speed);
            (enemy as any).facing = "left";
            enemy.setFlipX(true);
          } else if (Math.abs(body.velocity.x) < 1) {
            const dir = (enemy as any).facing === "right" ? 1 : -1;
            body.setVelocityX(dir * stats.speed);
            enemy.setFlipX(dir < 0);
          }
        } else {
          const dir = this.player.x < enemy.x ? -1 : 1;
          body.setVelocityX(dir * stats.speed);
          enemy.setFlipX(dir < 0);
        }
      }

      if (distToPlayer < 300 && time - ((enemy as any).lastFire || 0) > stats.fireRate) {
        (enemy as any).lastFire = time;
        enemy.setTexture(`${type}_shoot`);

        const bulletTexture = type === "heavy" ? "rocket" : "bullet_enemy";
        const dir = this.player.x < enemy.x ? -1 : 1;
        const bulletX = enemy.x + dir * 12;
        const bulletY = enemy.y - (type === "turret" ? 0 : 4);
        const angle = Phaser.Math.Angle.Between(bulletX, bulletY, this.player.x, this.player.y);
        const speed = type === "heavy" ? 150 : 200;
        this.fireEnemyBullet(
          bulletX,
          bulletY,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          stats.damage,
          bulletTexture
        );
      }
    });
  }

  private damageBoss(damage: number): void {
    this.bossHP -= damage;

    if (this.boss) {
      this.boss.setTintFill(0xffffff);
      this.time.delayedCall(60, () => {
        if (this.boss?.active) this.boss.clearTint();
      });
    }

    // Phase 2 at 50% HP — switch to damaged textures
    if (this.bossHP <= ENEMY_STATS.boss.hp / 2 && this.bossPhase === 1) {
      this.bossPhase = 2;
      if (this.boss) {
        // Flash red for phase transition
        this.boss.setTint(0xff4444);
        this.cameras.main.shake(300, 0.01);
        this.time.delayedCall(200, () => {
          if (this.boss?.active) {
            this.boss.clearTint();
            // Switch to damaged Phase 2 textures if they exist
            if (this.textures.exists("boss_p2_idle")) {
              this.boss.setTexture("boss_p2_idle");
            }
          }
        });
      }
    }

    if (this.bossHP <= 0) {
      this.score += ENEMY_STATS.boss.score;

      if (this.boss) {
        // Multi-explosion death sequence
        for (let i = 0; i < 5; i++) {
          this.time.delayedCall(i * 200, () => {
            if (this.boss) {
              this.createExplosion(
                this.boss.x + Phaser.Math.Between(-30, 30),
                this.boss.y + Phaser.Math.Between(-30, 30)
              );
            }
          });
        }
        this.time.delayedCall(1000, () => {
          if (this.boss) this.boss.destroy();
          this.gameOver(true);
        });
      }
    }
  }

  private updateBoss(time: number): void {
    if (!this.boss?.active) return;

    const body = this.boss.body as Phaser.Physics.Arcade.Body;
    const stats = ENEMY_STATS.boss;
    const dist = this.player.x - this.boss.x;

    if (Math.abs(dist) > 100) {
      body.setVelocityX(dist > 0 ? stats.speed : -stats.speed);
      this.boss.setFlipX(dist < 0);
    } else {
      body.setVelocityX(0);
    }

    const fireRate = this.bossPhase === 2 ? stats.fireRate / 2 : stats.fireRate;
    // Texture prefix based on phase (use p2 damaged textures if available)
    const p2 = this.bossPhase === 2 && this.textures.exists("boss_p2_idle");
    const bp = p2 ? "boss_p2_" : "boss_";

    if (time - this.bossLastFire > fireRate) {
      this.bossLastFire = time;
      this.bossShootUntil = time + 200;

      if (this.bossPhase === 1) {
        // Phase 1: Single cannon shot
        this.boss.setTexture("boss_shoot_1");

        const dir = dist > 0 ? 1 : -1;
        this.fireEnemyBullet(
          this.boss.x + dir * 32,
          this.boss.y - 10,
          dir * 180,
          0,
          stats.damage,
          "rocket"
        );
      } else {
        // Phase 2: Triple missile spread
        this.boss.setTexture(`${bp}shoot_2`);

        for (let i = -1; i <= 1; i++) {
          const angle =
            Phaser.Math.Angle.Between(this.boss.x, this.boss.y, this.player.x, this.player.y) +
            i * 0.3;
          this.fireEnemyBullet(
            this.boss.x,
            this.boss.y - 20,
            Math.cos(angle) * 160,
            Math.sin(angle) * 160,
            stats.damage,
            "rocket"
          );
        }
      }
    } else if (time > this.bossShootUntil) {
      // Boss walk/idle animation (only when not in shoot pose)
      if (Math.abs(body.velocity.x) > 5) {
        this.boss.setTexture(this.animFrame % 2 === 0 ? `${bp}walk_1` : `${bp}walk_2`);
      } else {
        this.boss.setTexture(this.enemyAnimFrame === 0 ? `${bp}idle` : `${bp}idle_2`);
      }
    }
  }

  private createExplosion(x: number, y: number): void {
    // Screen shake
    this.cameras.main.shake(100, 0.005);

    // Spark particle burst
    const sparks = this.add.particles(x, y, "particle_spark", {
      speed: { min: 50, max: 150 },
      angle: { min: 0, max: 360 },
      lifespan: 300,
      scale: { start: 1, end: 0 },
      emitting: false,
    });
    sparks.explode(8);
    this.time.delayedCall(400, () => sparks.destroy());

    // Explosion sprite animation
    const exp = this.add.sprite(x, y, "explosion_1");
    exp.setDepth(20);

    let frame = 1;
    const timer = this.time.addEvent({
      delay: 80,
      callback: () => {
        frame++;
        if (frame > 4) {
          exp.destroy();
          timer.destroy();
        } else {
          exp.setTexture(`explosion_${frame}`);
        }
      },
      repeat: 3,
    });
  }

  private createLargeExplosion(x: number, y: number): void {
    // Heavy screen shake
    this.cameras.main.shake(150, 0.008);

    // Spark particle burst (more particles than regular)
    const sparks = this.add.particles(x, y, "particle_spark", {
      speed: { min: 80, max: 200 },
      angle: { min: 0, max: 360 },
      lifespan: 400,
      scale: { start: 1.5, end: 0 },
      emitting: false,
    });
    sparks.explode(14);
    this.time.delayedCall(500, () => sparks.destroy());

    // Large explosion sprite animation (6 frames, 32x32)
    const exp = this.add.sprite(x, y, "explosion_large_1");
    exp.setDepth(20);

    let frame = 1;
    const timer = this.time.addEvent({
      delay: 90,
      callback: () => {
        frame++;
        if (frame > 6) {
          exp.destroy();
          timer.destroy();
        } else {
          exp.setTexture(`explosion_large_${frame}`);
        }
      },
      repeat: 5,
    });
  }

  private cleanupBullets(): void {
    const cam = this.cameras.main;
    const cleanup = (group: Phaser.Physics.Arcade.Group) => {
      group.getChildren().forEach((obj) => {
        const b = obj as Phaser.Physics.Arcade.Sprite;
        if (
          b.active &&
          (b.x < cam.scrollX - 50 ||
            b.x > cam.scrollX + ARCADE_WIDTH + 50 ||
            b.y < -50 ||
            b.y > ARCADE_HEIGHT + 50)
        ) {
          this.deactivateBullet(b);
        }
      });
    };
    cleanup(this.bullets);
    cleanup(this.enemyBullets);
  }

  private showScorePopup(x: number, y: number, points: number): void {
    const text = this.add
      .text(x, y - 10, `+${points}`, {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#4ade80",
        stroke: "#000",
        strokeThickness: 1,
      })
      .setOrigin(0.5)
      .setDepth(25);

    this.tweens.add({
      targets: text,
      y: y - 30,
      alpha: 0,
      duration: 600,
      onComplete: () => text.destroy(),
    });
  }

  private emitHUD(): void {
    this.events.emit("updateHUD", {
      hp: this.hp,
      maxHP: this.maxHP,
      score: this.score,
      lives: this.lives,
      weapon: this.weapon,
      ammo: this.ammo,
      grenades: this.grenades,
      bossHP: this.bossHP,
      bossMaxHP: ENEMY_STATS.boss.hp,
      character: this.character,
    });
  }
}
