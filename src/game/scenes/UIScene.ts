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
      new Phaser.Geom.Line(800, 20, 800, 0)
    );
    graphics.strokeLineShape(
      new Phaser.Geom.Line(780, 0, 800, 0)
    );

    // Bottom-left corner
    graphics.strokeLineShape(
      new Phaser.Geom.Line(0, 580, 0, 600)
    );
    graphics.strokeLineShape(
      new Phaser.Geom.Line(0, 600, 20, 600)
    );

    // Bottom-right corner
    graphics.strokeLineShape(
      new Phaser.Geom.Line(800, 580, 800, 600)
    );
    graphics.strokeLineShape(
      new Phaser.Geom.Line(780, 600, 800, 600)
    );
  }
}
