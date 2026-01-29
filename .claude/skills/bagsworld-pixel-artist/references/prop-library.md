# Prop Library

Real prop generation examples from BagsWorld's BootScene.ts.

## Tree (32x44 pixels)

```typescript
const tree = this.make.graphics({ x: 0, y: 0 });

// Trunk
tree.fillStyle(0x78350f);  // Brown
tree.fillRect(12, 28, 8, 16);
tree.fillStyle(0x92400e);  // Highlight
tree.fillRect(14, 28, 4, 16);

// Foliage layers (dark to light, bottom to top)
tree.fillStyle(0x166534);  // Dark green
tree.fillCircle(16, 20, 14);
tree.fillStyle(0x15803d);  // Medium green
tree.fillCircle(16, 16, 12);
tree.fillStyle(0x22c55e);  // Light green
tree.fillCircle(16, 12, 8);

tree.generateTexture("tree", 32, 44);
tree.destroy();
```

## Bush (32x20 pixels)

```typescript
const bush = this.make.graphics({ x: 0, y: 0 });

// Three overlapping circles
bush.fillStyle(0x166534);  // Dark green
bush.fillCircle(8, 12, 8);
bush.fillCircle(16, 10, 10);
bush.fillCircle(24, 12, 8);

// Highlight on top
bush.fillStyle(0x22c55e);  // Light green
bush.fillCircle(16, 8, 6);

bush.generateTexture("bush", 32, 20);
bush.destroy();
```

## Lamp Post (16x40 pixels)

```typescript
const lamp = this.make.graphics({ x: 0, y: 0 });

// Pole
lamp.fillStyle(0x1f2937);  // Dark gray
lamp.fillRect(6, 8, 4, 32);

// Light housing
lamp.fillStyle(0x374151);  // Medium gray
lamp.fillRect(2, 4, 12, 6);

// Light glow (semi-transparent)
lamp.fillStyle(0xfbbf24, 0.5);  // Gold with 50% alpha
lamp.fillRect(4, 6, 8, 4);

lamp.generateTexture("lamp", 16, 40);
lamp.destroy();
```

## Bench (32x20 pixels)

```typescript
const bench = this.make.graphics({ x: 0, y: 0 });

// Seat
bench.fillStyle(0x78350f);  // Brown
bench.fillRect(0, 8, 32, 4);

// Legs
bench.fillRect(2, 12, 4, 8);
bench.fillRect(26, 12, 4, 8);

// Back (lighter)
bench.fillStyle(0x92400e);  // Light brown
bench.fillRect(0, 4, 32, 4);

bench.generateTexture("bench", 32, 20);
bench.destroy();
```

## Flower (14x20 pixels)

```typescript
const flower = this.make.graphics({ x: 0, y: 0 });

// Stem
flower.fillStyle(0x22c55e);  // Green
flower.fillRect(6, 10, 2, 10);

// Petals (5 around center)
flower.fillStyle(0xfbbf24);  // Yellow
flower.fillCircle(7, 6, 4);
flower.fillCircle(3, 8, 3);
flower.fillCircle(11, 8, 3);
flower.fillCircle(4, 4, 3);
flower.fillCircle(10, 4, 3);

// Center
flower.fillStyle(0xf97316);  // Orange
flower.fillCircle(7, 6, 2);

flower.generateTexture("flower", 14, 20);
flower.destroy();
```

## Rock (20x16 pixels)

```typescript
const rock = this.make.graphics({ x: 0, y: 0 });

// Main shape
rock.fillStyle(0x6b7280);  // Gray
rock.fillCircle(10, 10, 8);

// Highlight
rock.fillStyle(0x9ca3af);  // Light gray
rock.fillCircle(7, 7, 4);

// Shadow detail
rock.fillStyle(0x4b5563);  // Dark gray
rock.fillCircle(13, 12, 3);

rock.generateTexture("rock", 20, 16);
rock.destroy();
```

## Fountain (40x36 pixels)

```typescript
const fountain = this.make.graphics({ x: 0, y: 0 });

// Base (wide)
fountain.fillStyle(0x6b7280);  // Gray
fountain.fillRect(8, 28, 24, 8);

// Rim
fountain.fillStyle(0x9ca3af);  // Light gray
fountain.fillRect(10, 26, 20, 4);

// Middle tier
fountain.fillStyle(0x78716c);  // Stone
fountain.fillRect(14, 18, 12, 10);

// Top bowl
fountain.fillStyle(0x6b7280);
fountain.fillRect(12, 10, 16, 8);

// Water in bowl (semi-transparent)
fountain.fillStyle(0x60a5fa, 0.7);  // Blue
fountain.fillRect(14, 12, 12, 4);

// Spout
fountain.fillStyle(0x9ca3af);
fountain.fillRect(18, 4, 4, 8);

fountain.generateTexture("fountain", 40, 36);
fountain.destroy();
```

## Flag (24x40 pixels)

```typescript
const flag = this.make.graphics({ x: 0, y: 0 });

// Pole
flag.fillStyle(0x78350f);  // Brown
flag.fillRect(2, 0, 3, 40);

// Pole top ball
flag.fillStyle(0xfbbf24);  // Gold
flag.fillCircle(3, 2, 3);

// Flag fabric
flag.fillStyle(0x4ade80);  // Bags green
flag.fillRect(5, 4, 18, 12);

// Flag shadow
flag.fillStyle(0x22c55e);  // Darker green
flag.fillRect(5, 14, 18, 2);

flag.generateTexture("flag", 24, 40);
flag.destroy();
```

## Pond (32x20 pixels)

```typescript
const pond = this.make.graphics({ x: 0, y: 0 });

// Water shape
pond.fillStyle(0x60a5fa, 0.8);  // Blue, semi-transparent
pond.fillEllipse(16, 10, 14, 8);

// Darker edge
pond.fillStyle(0x3b82f6, 0.6);
pond.fillEllipse(16, 12, 12, 5);

// Highlight
pond.fillStyle(0x93c5fd, 0.5);
pond.fillEllipse(12, 8, 4, 2);

pond.generateTexture("pond", 32, 20);
pond.destroy();
```

## Animals

### Dog (32x24 pixels)

```typescript
const dog = this.make.graphics({ x: 0, y: 0 });

// Body
dog.fillStyle(0xc68642);  // Brown
dog.fillRect(4, 8, 16, 10);

// Head
dog.fillRect(18, 4, 10, 10);

// Ears
dog.fillStyle(0x8d5524);  // Dark brown
dog.fillRect(18, 2, 4, 4);
dog.fillRect(24, 2, 4, 4);

// Snout
dog.fillStyle(0xffdbac);  // Skin
dog.fillRect(26, 8, 4, 4);

// Nose
dog.fillStyle(0x1f2937);  // Dark
dog.fillRect(28, 9, 2, 2);

// Eye
dog.fillStyle(0x000000);
dog.fillRect(22, 6, 2, 2);

// Legs
dog.fillStyle(0xc68642);
dog.fillRect(6, 16, 3, 6);
dog.fillRect(14, 16, 3, 6);

// Tail
dog.fillRect(2, 6, 3, 4);

dog.generateTexture("dog", 32, 24);
dog.destroy();
```

### Cat (32x24 pixels)

```typescript
const cat = this.make.graphics({ x: 0, y: 0 });

// Body
cat.fillStyle(0x6b7280);  // Gray
cat.fillRect(6, 10, 14, 8);

// Head
cat.fillRect(16, 4, 10, 10);

// Ears (triangular)
cat.fillStyle(0x4b5563);  // Dark gray
cat.fillTriangle(16, 6, 18, 0, 20, 6);
cat.fillTriangle(24, 6, 26, 0, 28, 6);

// Inner ears
cat.fillStyle(0xfca5a5);  // Pink
cat.fillTriangle(17, 5, 18, 2, 19, 5);
cat.fillTriangle(25, 5, 26, 2, 27, 5);

// Eyes
cat.fillStyle(0x22c55e);  // Green
cat.fillRect(18, 7, 2, 3);
cat.fillRect(23, 7, 2, 3);

// Pupils
cat.fillStyle(0x000000);
cat.fillRect(18, 8, 1, 2);
cat.fillRect(23, 8, 1, 2);

// Nose
cat.fillStyle(0xfca5a5);  // Pink
cat.fillRect(21, 10, 2, 1);

// Whiskers
cat.fillStyle(0x9ca3af);
cat.fillRect(14, 9, 4, 1);
cat.fillRect(26, 9, 4, 1);
cat.fillRect(14, 11, 4, 1);
cat.fillRect(26, 11, 4, 1);

// Legs
cat.fillStyle(0x6b7280);
cat.fillRect(8, 16, 3, 5);
cat.fillRect(15, 16, 3, 5);

// Tail (curved up)
cat.fillRect(4, 8, 3, 2);
cat.fillRect(2, 4, 3, 5);

cat.generateTexture("cat", 32, 24);
cat.destroy();
```

### Bird (24x18 pixels)

```typescript
const bird = this.make.graphics({ x: 0, y: 0 });

// Body
bird.fillStyle(0x8b4513);  // Brown
bird.fillEllipse(8, 8, 8, 6);

// Head
bird.fillCircle(14, 6, 4);

// Beak
bird.fillStyle(0xfbbf24);  // Yellow
bird.fillTriangle(18, 6, 22, 6, 18, 8);

// Eye
bird.fillStyle(0x000000);
bird.fillCircle(15, 5, 1);

// Wing
bird.fillStyle(0x6b4423);  // Dark brown
bird.fillEllipse(6, 8, 5, 4);

// Tail
bird.fillStyle(0x5c3317);
bird.fillTriangle(0, 6, 4, 8, 4, 10);

// Legs
bird.fillStyle(0xfbbf24);
bird.fillRect(7, 12, 1, 4);
bird.fillRect(10, 12, 1, 4);

bird.generateTexture("bird", 24, 18);
bird.destroy();
```

### Butterfly (16x16 pixels)

```typescript
const butterfly = this.make.graphics({ x: 0, y: 0 });

// Body
butterfly.fillStyle(0x1f2937);  // Dark
butterfly.fillRect(7, 4, 2, 8);

// Wings
butterfly.fillStyle(0xf59e0b);  // Amber
butterfly.fillEllipse(4, 6, 5, 4);
butterfly.fillEllipse(12, 6, 5, 4);
butterfly.fillEllipse(4, 10, 4, 3);
butterfly.fillEllipse(12, 10, 4, 3);

// Wing spots
butterfly.fillStyle(0xfbbf24);  // Gold
butterfly.fillCircle(4, 6, 2);
butterfly.fillCircle(12, 6, 2);

// Antennae
butterfly.fillStyle(0x1f2937);
butterfly.fillRect(6, 2, 1, 3);
butterfly.fillRect(9, 2, 1, 3);

butterfly.generateTexture("butterfly", 16, 16);
butterfly.destroy();
```

## Prop Placement Reference

| Prop | Y Position | Depth | Scale Range |
|------|------------|-------|-------------|
| Trees | grassTop (±10) | 2 | 0.9-1.2x |
| Bushes | grassTop + 20-25 | 2 | 0.7-1.0x |
| Flowers | grassTop + 27-35 | 2 | 0.8-1.2x |
| Lamps | pathLevel | 3 | 1.0x |
| Benches | pathLevel - 5 | 3 | 1.0x |
| Rocks | pathLevel + 2-8 | 2 | 0.6-0.9x |
| Fountain | grassTop + 30 | 2 | 1.0x |
| Pond | grassTop + 50 | 0 | 1.5x, alpha 0.8 |
| Flags | grassTop - 20 | 1 | 1.0x |
| Dogs/Cats | pathLevel + 10 | 4 | 1.0-1.2x |
| Birds | grassTop - 10 to -20 | 15 | 0.7-0.8x |
| Butterflies | grassTop - 30 to -40 | 15 | 0.5-0.6x |
