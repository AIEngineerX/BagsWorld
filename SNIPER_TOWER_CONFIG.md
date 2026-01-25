# Sniper Tower Configuration

This file contains the saved Sniper Tower building configuration for future use.

## Sprites Generated (in BootScene.ts)
- `sniper_tower` - Main tower texture (keep this)
- `academy_0` - Academy building style 0 (optional)
- `academy_1` - Academy building style 1 (optional)
- `academy_gate` - Academy entrance gate (optional)

## Sniper Tower Code Reference

### Click Handler to Open Modal
```typescript
sniperTower.on("pointerdown", () => {
  useGameStore.getState().openSniperTower();
});
```

### Hover Effect
```typescript
sniperTower.on("pointerover", () => {
  sniperTower.setTint(0x88ff88);
  this.tweens.add({
    targets: sniperTower,
    scaleX: 1.02,
    scaleY: 1.02,
    duration: 100,
    ease: "Power2",
  });
});
sniperTower.on("pointerout", () => {
  sniperTower.clearTint();
  this.tweens.add({
    targets: sniperTower,
    scaleX: 1,
    scaleY: 1,
    duration: 100,
    ease: "Power2",
  });
});
```

### Label Configuration
```typescript
// Background
const towerLabelBg = this.add.rectangle(
  towerX,
  pathLevel + Math.round(18 * s),
  Math.round(90 * s),
  Math.round(28 * s),
  0x000000,
  0.8
);
towerLabelBg.setStrokeStyle(2, 0x4ade80);
towerLabelBg.setDepth(6);

// Main label
const towerLabel = this.add.text(towerX, pathLevel + Math.round(12 * s), "SNIPER TOWER", {
  fontFamily: "monospace",
  fontSize: `${Math.round(9 * s)}px`,
  color: "#4ade80",
  fontStyle: "bold",
});
towerLabel.setOrigin(0.5, 0.5);
towerLabel.setDepth(7);

// Sub label
const subLabel = this.add.text(towerX, pathLevel + Math.round(24 * s), "All Bags.fm Tokens", {
  fontFamily: "monospace",
  fontSize: `${Math.round(7 * s)}px`,
  color: "#9ca3af",
});
subLabel.setOrigin(0.5, 0.5);
subLabel.setDepth(7);
```

### Radar Sweep Animation
```typescript
private createRadarSweepAnimation(x: number, y: number): void {
  const beam = this.add.graphics();
  beam.setPosition(x, y);
  beam.setDepth(6);

  // Draw outer beam
  beam.fillStyle(0x4ade80, 0.3);
  beam.beginPath();
  beam.moveTo(0, 0);
  beam.lineTo(-Math.round(35 * SCALE), Math.round(50 * SCALE));
  beam.lineTo(Math.round(35 * SCALE), Math.round(50 * SCALE));
  beam.closePath();
  beam.fill();

  // Inner brighter beam
  beam.fillStyle(0x4ade80, 0.5);
  beam.beginPath();
  beam.moveTo(0, 0);
  beam.lineTo(-Math.round(15 * SCALE), Math.round(40 * SCALE));
  beam.lineTo(Math.round(15 * SCALE), Math.round(40 * SCALE));
  beam.closePath();
  beam.fill();

  // Rotate continuously
  this.tweens.add({
    targets: beam,
    angle: 360,
    duration: 3000,
    repeat: -1,
    ease: "Linear",
  });

  // Add scanning dots (particles)
  for (let i = 0; i < 3; i++) {
    const particle = this.add.circle(
      x + (Math.random() - 0.5) * Math.round(60 * SCALE),
      y + Math.round(30 * SCALE) + Math.random() * Math.round(30 * SCALE),
      Math.round(3 * SCALE),
      0x4ade80,
      0.7
    );
    particle.setDepth(6);

    // Fade in/out animation
    this.tweens.add({
      targets: particle,
      alpha: { from: 0, to: 0.8 },
      scale: { from: 0.5, to: 1.2 },
      duration: 800 + i * 200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: i * 300,
    });

    // Move around
    this.tweens.add({
      targets: particle,
      x: x + (Math.random() - 0.5) * Math.round(80 * SCALE),
      y: y + Math.round(20 * SCALE) + Math.random() * Math.round(40 * SCALE),
      duration: 1500 + i * 300,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: i * 500,
    });
  }
}
```

## Store State (in store.ts)
```typescript
isSniperTowerOpen: false,
openSniperTower: () => set({ isSniperTowerOpen: true }),
closeSniperTower: () => set({ isSniperTowerOpen: false }),
```

## Component (SniperTower.tsx)
The SniperTower component at `src/components/SniperTower.tsx` is still available.

## Page Integration (page.tsx)
```typescript
function SniperTowerWrapper() {
  const { isSniperTowerOpen, closeSniperTower } = useGameStore();
  return <SniperTower isOpen={isSniperTowerOpen} onClose={closeSniperTower} />;
}

// In render:
<SniperTowerWrapper />
```
