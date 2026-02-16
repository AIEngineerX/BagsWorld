/**
 * Box2D physics layer for METAL BAGS.
 *
 * Runs as a parallel physics world alongside Arcade Physics.
 * Grenades, crate debris, and enemy ragdolls use Box2D.
 * Ground-only collision: bodies bounce off the main ground plane.
 */

import {
  b2BodyType,
  b2DefaultBodyDef,
  b2DefaultShapeDef,
  b2DefaultWorldDef,
  b2DefaultRevoluteJointDef,
  b2Vec2,
  b2CreateBody,
  b2DestroyBody,
  b2Body_SetLinearVelocity,
  b2Body_ApplyAngularImpulse,
  b2Body_ApplyLinearImpulseToCenter,
  b2Body_GetPosition,
  b2CreateCircleShape,
  b2CreatePolygonShape,
  b2CreateRevoluteJoint,
  b2MakeBox,
  b2DestroyWorld,
  // @ts-expect-error — phaser-box2d has no type declarations
} from "phaser-box2d/src/main.js";

import {
  CreateWorld,
  WorldStep,
  UpdateWorldSprites,
  SetWorldScale,
  AddSpriteToWorld,
  RemoveSpriteFromWorld,
  pxm,
  // @ts-expect-error — phaser-box2d has no type declarations
} from "phaser-box2d/src/physics.js";

import {
  GROUND_Y,
  LEVEL_WIDTH,
  BOX2D_SCALE,
  GRENADE_RESTITUTION,
  GRENADE_FRICTION,
  GRENADE_DENSITY,
  GRENADE_ANGULAR_IMPULSE_RANGE,
  DEBRIS_TTL,
  RAGDOLL_TTL,
  type EnemyType,
} from "./types";

// ---- Module state ----

interface GrenadeEntry {
  sprite: Phaser.GameObjects.Sprite;
  bodyId: unknown;
}

interface DebrisEntry {
  sprite: Phaser.GameObjects.Sprite;
  bodyId: unknown;
}

interface RagdollEntry {
  sprites: Phaser.GameObjects.Sprite[];
  bodyIds: unknown[];
  jointIds: unknown[];
}

let worldId: unknown = null;
const activeGrenades: GrenadeEntry[] = [];
const activeDebris: DebrisEntry[] = [];
const activeRagdolls: RagdollEntry[] = [];

// ---- Public API ----

/**
 * Create the Box2D world and static ground body.
 * Call once in ArcadeGameScene.create().
 */
export function initBox2DWorld(): void {
  SetWorldScale(BOX2D_SCALE);

  // Box2D uses Y-up, so gravity pointing down is negative
  const worldDef = b2DefaultWorldDef();
  worldDef.gravity = new b2Vec2(0, -10);

  const result = CreateWorld({ worldDef });
  worldId = result.worldId;

  // Static ground body — a wide box at GROUND_Y
  const groundDef = b2DefaultBodyDef();
  groundDef.type = b2BodyType.b2_staticBody;
  // Convert screen Y to Box2D Y (negate for Y-up)
  groundDef.position = new b2Vec2(pxm(LEVEL_WIDTH / 2), -pxm(GROUND_Y));

  const groundBodyId = b2CreateBody(worldId, groundDef);

  const groundShapeDef = b2DefaultShapeDef();
  groundShapeDef.friction = 0.8;

  // Half-widths in meters: wide enough for the entire level, 0.5m tall
  const groundBox = b2MakeBox(pxm(LEVEL_WIDTH / 2), 0.5);
  b2CreatePolygonShape(groundBodyId, groundShapeDef, groundBox);
}

/**
 * Spawn a grenade with Box2D physics.
 * Returns a plain Phaser sprite (no Arcade body) driven by Box2D.
 */
export function spawnGrenade(
  scene: Phaser.Scene,
  x: number,
  y: number,
  vx: number,
  vy: number,
): Phaser.GameObjects.Sprite {
  const sprite = scene.add.sprite(x, y, "grenade");
  sprite.setDepth(10);

  // Create dynamic circle body
  const bodyDef = b2DefaultBodyDef();
  bodyDef.type = b2BodyType.b2_dynamicBody;
  // Convert screen coords to Box2D coords (negate Y)
  bodyDef.position = new b2Vec2(pxm(x), -pxm(y));

  const bodyId = b2CreateBody(worldId, bodyDef);

  const shapeDef = b2DefaultShapeDef();
  shapeDef.density = GRENADE_DENSITY;
  shapeDef.friction = GRENADE_FRICTION;
  shapeDef.restitution = GRENADE_RESTITUTION;

  const circle = { center: new b2Vec2(0, 0), radius: pxm(4) };
  b2CreateCircleShape(bodyId, shapeDef, circle);

  // Set initial velocity (negate screen vy for Box2D Y-up)
  b2Body_SetLinearVelocity(bodyId, new b2Vec2(pxm(vx), -pxm(vy)));

  // Apply random angular impulse for spin
  const spin =
    (Math.random() - 0.5) * 2 * GRENADE_ANGULAR_IMPULSE_RANGE;
  b2Body_ApplyAngularImpulse(bodyId, spin, true);

  // Register sprite-body pair for auto-sync
  AddSpriteToWorld(worldId, sprite, { bodyId });

  activeGrenades.push({ sprite, bodyId });

  return sprite;
}

/**
 * Spawn a field of Box2D debris chunks that scatter outward and fade.
 * Used when crates are destroyed.
 */
export function spawnDebrisField(
  scene: Phaser.Scene,
  x: number,
  y: number,
  count: number,
  texturePrefix: string,
): void {
  if (!worldId) return;

  for (let i = 0; i < count; i++) {
    const texKey = `${texturePrefix}_${(i % 4) + 1}`;
    const sprite = scene.add.sprite(x, y, texKey);
    sprite.setDepth(10);

    // Create dynamic box body
    const bodyDef = b2DefaultBodyDef();
    bodyDef.type = b2BodyType.b2_dynamicBody;
    bodyDef.position = new b2Vec2(pxm(x), -pxm(y));

    const bodyId = b2CreateBody(worldId, bodyDef);

    const shapeDef = b2DefaultShapeDef();
    shapeDef.density = 1.5;
    shapeDef.friction = 0.7;
    shapeDef.restitution = 0.3;

    // 6x6 pixel box → half-widths of 3px each
    const box = b2MakeBox(pxm(3), pxm(3));
    b2CreatePolygonShape(bodyId, shapeDef, box);

    // Random outward impulse — spread evenly around the circle
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.8;
    const hSpeed = Math.cos(angle) * (2 + Math.random() * 3);
    const vSpeed = -(1.5 + Math.random() * 3); // upward in Box2D Y-up
    b2Body_SetLinearVelocity(bodyId, new b2Vec2(hSpeed, vSpeed));

    // Random spin
    b2Body_ApplyAngularImpulse(bodyId, (Math.random() - 0.5) * 8, true);

    // Register sprite–body pair for position/rotation sync
    AddSpriteToWorld(worldId, sprite, { bodyId });

    const entry: DebrisEntry = { sprite, bodyId };
    activeDebris.push(entry);

    // Fade out near end of TTL, then destroy
    scene.tweens.add({
      targets: sprite,
      alpha: 0,
      delay: DEBRIS_TTL - 400,
      duration: 400,
      onComplete: () => destroyDebrisEntry(entry),
    });
  }
}

/** Clean up a single debris body and sprite. */
function destroyDebrisEntry(entry: DebrisEntry): void {
  const idx = activeDebris.indexOf(entry);
  if (idx !== -1) {
    if (worldId) {
      RemoveSpriteFromWorld(worldId, entry.sprite, false);
      b2DestroyBody(entry.bodyId);
    }
    activeDebris.splice(idx, 1);
  }
  if (entry.sprite.active) entry.sprite.destroy();
}

// ---- Ragdoll part layout per enemy type ----
// Each part: [textureKey, halfW, halfH, anchorOnParent {x,y}, anchorOnSelf {x,y}]
// Anchors are in pixels relative to the part center.

interface RagdollPartDef {
  texture: string;
  halfW: number;
  halfH: number;
  /** Anchor on parent body in px (0,0 = parent center) */
  parentAnchor: { x: number; y: number };
  /** Anchor on this body in px (0,0 = this center) */
  selfAnchor: { x: number; y: number };
  /** Joint angle limits in radians [lower, upper] */
  angleLimits: [number, number];
}

// Soldier ragdoll: torso is root, head + 2 arms + 2 legs attach to it
const SOLDIER_PARTS: RagdollPartDef[] = [
  // head → top of torso
  {
    texture: "soldier_head",
    halfW: 4, halfH: 4,
    parentAnchor: { x: 0, y: -6 },
    selfAnchor: { x: 0, y: 4 },
    angleLimits: [-0.5, 0.5],
  },
  // left arm → left shoulder
  {
    texture: "soldier_arm",
    halfW: 2, halfH: 5,
    parentAnchor: { x: -4, y: -4 },
    selfAnchor: { x: 2, y: -5 },
    angleLimits: [-1.2, 1.2],
  },
  // right arm → right shoulder
  {
    texture: "soldier_arm",
    halfW: 2, halfH: 5,
    parentAnchor: { x: 4, y: -4 },
    selfAnchor: { x: -2, y: -5 },
    angleLimits: [-1.2, 1.2],
  },
  // left leg → bottom-left of torso
  {
    texture: "soldier_leg",
    halfW: 2, halfH: 6,
    parentAnchor: { x: -2, y: 6 },
    selfAnchor: { x: 0, y: -6 },
    angleLimits: [-0.8, 0.8],
  },
  // right leg → bottom-right of torso
  {
    texture: "soldier_leg",
    halfW: 2, halfH: 6,
    parentAnchor: { x: 2, y: 6 },
    selfAnchor: { x: 0, y: -6 },
    angleLimits: [-0.8, 0.8],
  },
];

const HEAVY_PARTS: RagdollPartDef[] = [
  // head → top of torso
  {
    texture: "heavy_head",
    halfW: 5, halfH: 4,
    parentAnchor: { x: 0, y: -7 },
    selfAnchor: { x: 0, y: 4 },
    angleLimits: [-0.4, 0.4],
  },
  // left arm → left shoulder
  {
    texture: "heavy_arm",
    halfW: 3, halfH: 5,
    parentAnchor: { x: -6, y: -5 },
    selfAnchor: { x: 3, y: -5 },
    angleLimits: [-1.0, 1.0],
  },
  // right arm → right shoulder
  {
    texture: "heavy_arm",
    halfW: 3, halfH: 5,
    parentAnchor: { x: 6, y: -5 },
    selfAnchor: { x: -3, y: -5 },
    angleLimits: [-1.0, 1.0],
  },
  // left leg → bottom-left of torso
  {
    texture: "heavy_leg",
    halfW: 3, halfH: 7,
    parentAnchor: { x: -3, y: 7 },
    selfAnchor: { x: 0, y: -7 },
    angleLimits: [-0.6, 0.6],
  },
  // right leg → bottom-right of torso
  {
    texture: "heavy_leg",
    halfW: 3, halfH: 7,
    parentAnchor: { x: 3, y: 7 },
    selfAnchor: { x: 0, y: -7 },
    angleLimits: [-0.6, 0.6],
  },
];

/** Helper: create a dynamic box body and register its sprite. */
function createRagdollPart(
  scene: Phaser.Scene,
  x: number,
  y: number,
  halfW: number,
  halfH: number,
  texture: string,
  density: number,
): { sprite: Phaser.GameObjects.Sprite; bodyId: unknown } {
  const sprite = scene.add.sprite(x, y, texture);
  sprite.setDepth(10);

  const bodyDef = b2DefaultBodyDef();
  bodyDef.type = b2BodyType.b2_dynamicBody;
  bodyDef.position = new b2Vec2(pxm(x), -pxm(y));

  const bodyId = b2CreateBody(worldId, bodyDef);

  const shapeDef = b2DefaultShapeDef();
  shapeDef.density = density;
  shapeDef.friction = 0.5;
  shapeDef.restitution = 0.2;

  const box = b2MakeBox(pxm(halfW), pxm(halfH));
  b2CreatePolygonShape(bodyId, shapeDef, box);

  AddSpriteToWorld(worldId, sprite, { bodyId });
  return { sprite, bodyId };
}

/**
 * Spawn a multi-segment ragdoll for an enemy death.
 * Soldier/heavy get linked body parts; turret gets debris chunks.
 */
export function spawnRagdoll(
  scene: Phaser.Scene,
  x: number,
  y: number,
  type: EnemyType,
  hitDir: number,
): void {
  if (!worldId) return;

  // Turret: no ragdoll, just debris
  if (type === "turret") {
    spawnDebrisField(scene, x, y, Phaser.Math.Between(5, 8), "crate_chunk");
    return;
  }

  // Boss: large ragdoll (8 segments — torso, head, 2 arms, 2 legs, 2 armor plates)
  if (type === "boss") {
    spawnBossRagdoll(scene, x, y, hitDir);
    return;
  }

  const isSoldier = type === "soldier";
  const parts = isSoldier ? SOLDIER_PARTS : HEAVY_PARTS;
  const torsoHalfW = isSoldier ? 4 : 6;
  const torsoHalfH = isSoldier ? 6 : 7;
  const torsoTex = isSoldier ? "soldier_torso" : "heavy_torso";
  const density = isSoldier ? 1.5 : 3.0;

  // Create torso (root body)
  const torso = createRagdollPart(scene, x, y, torsoHalfW, torsoHalfH, torsoTex, density);

  // Apply hit impulse to torso
  const impulseX = hitDir * (2 + Math.random() * 2);
  const impulseY = -(2 + Math.random() * 2); // upward in Box2D Y-up
  b2Body_SetLinearVelocity(torso.bodyId, new b2Vec2(impulseX, impulseY));
  b2Body_ApplyAngularImpulse(torso.bodyId, hitDir * (2 + Math.random() * 3), true);

  const sprites: Phaser.GameObjects.Sprite[] = [torso.sprite];
  const bodyIds: unknown[] = [torso.bodyId];
  const jointIds: unknown[] = [];

  // Create each limb and attach with revolute joint
  for (const part of parts) {
    const partX = x + part.parentAnchor.x;
    const partY = y + part.parentAnchor.y;

    const limb = createRagdollPart(scene, partX, partY, part.halfW, part.halfH, part.texture, density * 0.7);

    // Small random velocity on each limb
    b2Body_SetLinearVelocity(limb.bodyId, new b2Vec2(
      impulseX * 0.5 + (Math.random() - 0.5) * 2,
      impulseY * 0.5 + (Math.random() - 0.5) * 2,
    ));
    b2Body_ApplyAngularImpulse(limb.bodyId, (Math.random() - 0.5) * 4, true);

    // Revolute joint connecting limb to torso
    const jointDef = b2DefaultRevoluteJointDef();
    jointDef.bodyIdA = torso.bodyId;
    jointDef.bodyIdB = limb.bodyId;
    // Anchors in meters (Box2D coords, Y-up)
    jointDef.localAnchorA = new b2Vec2(pxm(part.parentAnchor.x), -pxm(part.parentAnchor.y));
    jointDef.localAnchorB = new b2Vec2(pxm(part.selfAnchor.x), -pxm(part.selfAnchor.y));
    jointDef.enableLimit = true;
    jointDef.lowerAngle = part.angleLimits[0];
    jointDef.upperAngle = part.angleLimits[1];
    jointDef.collideConnected = false;

    const jointId = b2CreateRevoluteJoint(worldId, jointDef);
    jointIds.push(jointId);

    sprites.push(limb.sprite);
    bodyIds.push(limb.bodyId);
  }

  const entry: RagdollEntry = { sprites, bodyIds, jointIds };
  activeRagdolls.push(entry);

  // Fade out all parts near end of TTL, then destroy
  scene.tweens.add({
    targets: sprites,
    alpha: 0,
    delay: RAGDOLL_TTL - 500,
    duration: 500,
    onComplete: () => destroyRagdollEntry(entry),
  });
}

/** Clean up all bodies, joints, and sprites in a ragdoll entry. */
function destroyRagdollEntry(entry: RagdollEntry): void {
  const idx = activeRagdolls.indexOf(entry);
  if (idx !== -1) {
    if (worldId) {
      // Note: destroying the bodies automatically destroys attached joints
      for (let i = 0; i < entry.bodyIds.length; i++) {
        RemoveSpriteFromWorld(worldId, entry.sprites[i], false);
        b2DestroyBody(entry.bodyIds[i]);
      }
    }
    activeRagdolls.splice(idx, 1);
  }
  for (const sprite of entry.sprites) {
    if (sprite.active) sprite.destroy();
  }
}

/**
 * Spawn a large boss ragdoll with 8 segments:
 * hull, turret, cannon, 2 treads, 2 armor plates, + bonus debris.
 */
function spawnBossRagdoll(
  scene: Phaser.Scene,
  x: number,
  y: number,
  hitDir: number,
): void {
  // Boss parts: [texture, halfW, halfH, offsetX, offsetY]
  const bossParts: Array<{
    tex: string; hw: number; hh: number; ox: number; oy: number;
    parentIdx: number; parentAnchor: { x: number; y: number };
    selfAnchor: { x: number; y: number };
    limits: [number, number];
  }> = [
    // turret → hull top
    { tex: "boss_turret", hw: 8, hh: 5, ox: 0, oy: -12,
      parentIdx: 0, parentAnchor: { x: 0, y: -8 }, selfAnchor: { x: 0, y: 5 },
      limits: [-0.4, 0.4] },
    // cannon → turret right
    { tex: "boss_cannon", hw: 6, hh: 2, ox: 16, oy: -12,
      parentIdx: 0, parentAnchor: { x: 12, y: -6 }, selfAnchor: { x: -6, y: 0 },
      limits: [-0.3, 0.3] },
    // left tread → hull bottom-left
    { tex: "boss_tread", hw: 10, hh: 4, ox: -6, oy: 12,
      parentIdx: 0, parentAnchor: { x: -6, y: 8 }, selfAnchor: { x: 0, y: -4 },
      limits: [-0.2, 0.2] },
    // right tread → hull bottom-right
    { tex: "boss_tread", hw: 10, hh: 4, ox: 6, oy: 12,
      parentIdx: 0, parentAnchor: { x: 6, y: 8 }, selfAnchor: { x: 0, y: -4 },
      limits: [-0.2, 0.2] },
    // left armor plate → hull left
    { tex: "boss_armor_plate", hw: 5, hh: 4, ox: -16, oy: -2,
      parentIdx: 0, parentAnchor: { x: -12, y: 0 }, selfAnchor: { x: 5, y: 0 },
      limits: [-0.8, 0.8] },
    // right armor plate → hull right
    { tex: "boss_armor_plate", hw: 5, hh: 4, ox: 16, oy: -2,
      parentIdx: 0, parentAnchor: { x: 12, y: 0 }, selfAnchor: { x: -5, y: 0 },
      limits: [-0.8, 0.8] },
  ];

  // Create hull (root body) — larger and heavier
  const hull = createRagdollPart(scene, x, y, 12, 8, "boss_hull", 5.0);

  // Strong hit impulse for the boss
  const impulseX = hitDir * (3 + Math.random() * 2);
  const impulseY = -(1.5 + Math.random() * 1.5);
  b2Body_SetLinearVelocity(hull.bodyId, new b2Vec2(impulseX, impulseY));
  b2Body_ApplyAngularImpulse(hull.bodyId, hitDir * (3 + Math.random() * 4), true);

  const sprites: Phaser.GameObjects.Sprite[] = [hull.sprite];
  const bodyIds: unknown[] = [hull.bodyId];
  const jointIds: unknown[] = [];

  for (const part of bossParts) {
    const partX = x + part.ox;
    const partY = y + part.oy;
    const limb = createRagdollPart(scene, partX, partY, part.hw, part.hh, part.tex, 3.0);

    b2Body_SetLinearVelocity(limb.bodyId, new b2Vec2(
      impulseX * 0.4 + (Math.random() - 0.5) * 3,
      impulseY * 0.4 + (Math.random() - 0.5) * 3,
    ));
    b2Body_ApplyAngularImpulse(limb.bodyId, (Math.random() - 0.5) * 6, true);

    const parentBodyId = bodyIds[part.parentIdx];
    const jointDef = b2DefaultRevoluteJointDef();
    jointDef.bodyIdA = parentBodyId;
    jointDef.bodyIdB = limb.bodyId;
    jointDef.localAnchorA = new b2Vec2(pxm(part.parentAnchor.x), -pxm(part.parentAnchor.y));
    jointDef.localAnchorB = new b2Vec2(pxm(part.selfAnchor.x), -pxm(part.selfAnchor.y));
    jointDef.enableLimit = true;
    jointDef.lowerAngle = part.limits[0];
    jointDef.upperAngle = part.limits[1];
    jointDef.collideConnected = false;

    const jointId = b2CreateRevoluteJoint(worldId, jointDef);
    jointIds.push(jointId);

    sprites.push(limb.sprite);
    bodyIds.push(limb.bodyId);
  }

  const entry: RagdollEntry = { sprites, bodyIds, jointIds };
  activeRagdolls.push(entry);

  // Fade out near end of TTL
  scene.tweens.add({
    targets: sprites,
    alpha: 0,
    delay: RAGDOLL_TTL - 500,
    duration: 500,
    onComplete: () => destroyRagdollEntry(entry),
  });
}

/**
 * Apply an outward impulse to all active Box2D bodies within a pixel radius
 * of the given screen position. Creates a shockwave/explosion push effect.
 */
export function spawnShockwave(
  x: number,
  y: number,
  radiusPx: number,
  forceMagnitude: number,
): void {
  if (!worldId) return;

  const centerX = pxm(x);
  const centerY = -pxm(y); // Box2D Y-up
  const radiusM = pxm(radiusPx);
  const radiusSq = radiusM * radiusM;

  // Collect all active body IDs
  const allBodies: unknown[] = [];
  for (const g of activeGrenades) allBodies.push(g.bodyId);
  for (const d of activeDebris) allBodies.push(d.bodyId);
  for (const r of activeRagdolls) {
    for (const b of r.bodyIds) allBodies.push(b);
  }

  for (const bodyId of allBodies) {
    const pos = b2Body_GetPosition(bodyId);
    const dx = pos.x - centerX;
    const dy = pos.y - centerY;
    const distSq = dx * dx + dy * dy;

    if (distSq > 0.001 && distSq < radiusSq) {
      const dist = Math.sqrt(distSq);
      // Impulse falls off linearly with distance
      const falloff = 1 - dist / radiusM;
      const mag = forceMagnitude * falloff;
      const impulse = new b2Vec2((dx / dist) * mag, (dy / dist) * mag);
      b2Body_ApplyLinearImpulseToCenter(bodyId, impulse, true);
    }
  }
}

/**
 * Step the Box2D simulation and sync sprites.
 * Call every frame in ArcadeGameScene.update().
 * @param delta Frame delta in milliseconds
 */
export function stepBox2DWorld(delta: number): void {
  if (!worldId) return;

  WorldStep({
    worldId,
    deltaTime: delta / 1000,
    fixedTimeStep: 1 / 60,
    subStepCount: 4,
  });

  UpdateWorldSprites(worldId);
}

/**
 * Destroy a single grenade body and sprite.
 */
export function destroyGrenade(grenade: Phaser.GameObjects.Sprite): void {
  const idx = activeGrenades.findIndex((g) => g.sprite === grenade);
  if (idx !== -1) {
    const entry = activeGrenades[idx];
    RemoveSpriteFromWorld(worldId, entry.sprite, false);
    b2DestroyBody(entry.bodyId);
    activeGrenades.splice(idx, 1);
  }
  if (grenade.active) grenade.destroy();
}

/**
 * Destroy all Box2D bodies and the world.
 * Call on scene shutdown / restart.
 */
export function destroyAllBodies(): void {
  if (!worldId) return;

  // Clean up all active grenade entries
  for (const entry of activeGrenades) {
    RemoveSpriteFromWorld(worldId, entry.sprite, false);
    if (entry.sprite.active) entry.sprite.destroy();
  }
  activeGrenades.length = 0;

  // Clean up all active debris entries
  for (const entry of activeDebris) {
    RemoveSpriteFromWorld(worldId, entry.sprite, false);
    if (entry.sprite.active) entry.sprite.destroy();
  }
  activeDebris.length = 0;

  // Clean up all active ragdoll entries
  for (const entry of activeRagdolls) {
    for (let i = 0; i < entry.bodyIds.length; i++) {
      RemoveSpriteFromWorld(worldId, entry.sprites[i], false);
      if (entry.sprites[i].active) entry.sprites[i].destroy();
    }
  }
  activeRagdolls.length = 0;

  // Destroy the entire Box2D world (destroys all bodies within it)
  b2DestroyWorld(worldId);
  worldId = null;
}

/**
 * Get the list of active grenade sprites (for damage checks).
 */
export function getActiveGrenades(): Phaser.GameObjects.Sprite[] {
  return activeGrenades.map((g) => g.sprite);
}
