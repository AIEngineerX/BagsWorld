import * as Phaser from "phaser";

export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: "UIScene" });
  }

  create(): void {
    // This scene runs on top of WorldScene for UI elements
    // Currently handled by React components, but can add Phaser UI here

    // Add corner decorations
    this.addCornerDecorations();
  }

  private addCornerDecorations(): void {
    const graphics = this.add.graphics();
    const width = 1280;
    const height = 960;

    // Top-left corner
    graphics.lineStyle(2, 0x4ade80, 1);
    graphics.strokeLineShape(
      new Phaser.Geom.Line(0, 20, 0, 0)
    );
    graphics.strokeLineShape(
      new Phaser.Geom.Line(0, 0, 20, 0)
    );

    // Top-right corner
    graphics.strokeLineShape(
      new Phaser.Geom.Line(width, 20, width, 0)
    );
    graphics.strokeLineShape(
      new Phaser.Geom.Line(width - 20, 0, width, 0)
    );

    // Bottom-left corner
    graphics.strokeLineShape(
      new Phaser.Geom.Line(0, height - 20, 0, height)
    );
    graphics.strokeLineShape(
      new Phaser.Geom.Line(0, height, 20, height)
    );

    // Bottom-right corner
    graphics.strokeLineShape(
      new Phaser.Geom.Line(width, height - 20, width, height)
    );
    graphics.strokeLineShape(
      new Phaser.Geom.Line(width - 20, height, width, height)
    );
  }
}
