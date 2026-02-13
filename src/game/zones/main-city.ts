import type { WorldScene } from "../scenes/WorldScene";

export function setupMainCityZone(scene: WorldScene): void {
  scene.decorations.forEach((d) => d.setVisible(true));
  scene.animals.forEach((a) => a.sprite.setVisible(true));

  if (scene.fountainWater) {
    scene.fountainWater.setVisible(true);
  }

  scene.ground.setVisible(true);
  scene.ground.setTexture("grass");

  scene.restoreNormalSky();

  // Show treeline for Park zone
  if (scene.treeline) scene.treeline.setVisible(true);
}
