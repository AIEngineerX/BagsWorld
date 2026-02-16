/**
 * Box2D physics layer for grenade simulation in METAL BAGS.
 *
 * Runs as a parallel physics world alongside Arcade Physics.
 * Only grenades use Box2D — everything else stays on Arcade.
 * Ground-only collision: grenades bounce off the main ground plane.
 */

import {
  b2BodyType,
  b2DefaultBodyDef,
  b2DefaultShapeDef,
  b2DefaultWorldDef,
  b2Vec2,
  b2CreateBody,
  b2DestroyBody,
  b2Body_SetLinearVelocity,
  b2Body_ApplyAngularImpulse,
  b2CreateCircleShape,
  b2CreatePolygonShape,
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
} from "./types";

// ---- Module state ----

interface GrenadeEntry {
  sprite: Phaser.GameObjects.Sprite;
  bodyId: unknown;
}

let worldId: unknown = null;
const activeGrenades: GrenadeEntry[] = [];

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
