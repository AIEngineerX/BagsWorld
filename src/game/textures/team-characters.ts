import * as Phaser from "phaser";
import { SCALE } from "./constants";

function generateRamoSprite(scene: Phaser.Scene): void {
  // Ramo (@ramyobags) - Co-Founder & CTO, Vienna, Superteam DE
  // Tech-focused look, professional but approachable
  const s = SCALE;
  const size = Math.round(32 * s);
  const skinTone = 0xf5d0c5; // Light skin
  const skinHighlight = 0xfce4d6;
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Tech blue glow behind Ramo
  g.fillStyle(0x3b82f6, 0.15);
  g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
  g.fillStyle(0x10b981, 0.1); // Bags green accent
  g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

  // Shadow
  g.fillStyle(0x000000, 0.4);
  g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

  // Legs (dark pants - professional)
  g.fillStyle(0x1f2937);
  g.fillRect(Math.round(10 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));
  g.fillRect(Math.round(17 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));

  // Shoes (clean sneakers)
  g.fillStyle(0x374151);
  g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
  g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
  g.fillStyle(0xffffff);
  g.fillRect(Math.round(9 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));
  g.fillRect(Math.round(17 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));

  // Tech blue hoodie/shirt
  g.fillStyle(0x3b82f6);
  g.fillRect(Math.round(7 * s), Math.round(11 * s), Math.round(18 * s), Math.round(11 * s));
  // Hoodie detail
  g.fillStyle(0x2563eb);
  g.fillRect(Math.round(12 * s), Math.round(11 * s), Math.round(8 * s), Math.round(4 * s));
  // Bags logo on chest (small green square)
  g.fillStyle(0x10b981);
  g.fillRect(Math.round(14 * s), Math.round(15 * s), Math.round(4 * s), Math.round(3 * s));

  // Arms
  g.fillStyle(skinTone);
  g.fillRect(Math.round(4 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
  g.fillRect(Math.round(24 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
  // Hands
  g.fillRect(Math.round(4 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillRect(Math.round(25 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));

  // Head
  g.fillStyle(skinTone);
  g.fillRect(Math.round(9 * s), Math.round(3 * s), Math.round(14 * s), Math.round(10 * s));
  g.fillStyle(skinHighlight);
  g.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(4 * s), Math.round(3 * s));

  // Dark hair (neat, professional)
  g.fillStyle(0x1a1a1a);
  g.fillRect(Math.round(8 * s), Math.round(0 * s), Math.round(16 * s), Math.round(5 * s));
  g.fillRect(Math.round(7 * s), Math.round(2 * s), Math.round(3 * s), Math.round(4 * s));
  g.fillRect(Math.round(22 * s), Math.round(2 * s), Math.round(3 * s), Math.round(4 * s));
  // Hair highlight
  g.fillStyle(0x2d2d2d);
  g.fillRect(Math.round(11 * s), Math.round(1 * s), Math.round(4 * s), Math.round(2 * s));

  // Eyes
  g.fillStyle(0x1a1a1a);
  g.fillRect(Math.round(11 * s), Math.round(6 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(3 * s), Math.round(2 * s));
  // Eye shine
  g.fillStyle(0xffffff);
  g.fillRect(Math.round(11 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));
  g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));

  // Friendly smile
  g.fillStyle(0x8b6b5a);
  g.fillRect(Math.round(13 * s), Math.round(10 * s), Math.round(6 * s), Math.round(1 * s));

  g.generateTexture("ramo", size, size);
  g.destroy();
}

function generateSincaraSprite(scene: Phaser.Scene): void {
  // Sincara (@sincara_bags) - Frontend Engineer
  // Creative developer aesthetic, headphones, design-focused
  const s = SCALE;
  const size = Math.round(32 * s);
  const skinTone = 0xd4a574; // Medium skin
  const skinHighlight = 0xe0b88c;
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Purple creative glow
  g.fillStyle(0x8b5cf6, 0.15);
  g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
  g.fillStyle(0xa855f7, 0.1);
  g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

  // Shadow
  g.fillStyle(0x000000, 0.4);
  g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

  // Legs (dark gray jeans)
  g.fillStyle(0x374151);
  g.fillRect(Math.round(10 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));
  g.fillRect(Math.round(17 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));

  // Shoes (stylish)
  g.fillStyle(0x8b5cf6);
  g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
  g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
  g.fillStyle(0xffffff);
  g.fillRect(Math.round(9 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));
  g.fillRect(Math.round(17 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));

  // Purple hoodie (design vibes)
  g.fillStyle(0x8b5cf6);
  g.fillRect(Math.round(7 * s), Math.round(11 * s), Math.round(18 * s), Math.round(11 * s));
  // Hoodie highlights
  g.fillStyle(0xa855f7);
  g.fillRect(Math.round(8 * s), Math.round(13 * s), Math.round(4 * s), Math.round(3 * s));
  g.fillRect(Math.round(18 * s), Math.round(14 * s), Math.round(4 * s), Math.round(3 * s));
  // Design icon on shirt (paint palette)
  g.fillStyle(0xfbbf24);
  g.fillRect(Math.round(14 * s), Math.round(16 * s), Math.round(4 * s), Math.round(3 * s));

  // Arms
  g.fillStyle(skinTone);
  g.fillRect(Math.round(4 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
  g.fillRect(Math.round(24 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
  g.fillRect(Math.round(4 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillRect(Math.round(25 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));

  // Head
  g.fillStyle(skinTone);
  g.fillRect(Math.round(9 * s), Math.round(3 * s), Math.round(14 * s), Math.round(10 * s));
  g.fillStyle(skinHighlight);
  g.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(4 * s), Math.round(3 * s));

  // Brown hair (styled)
  g.fillStyle(0x2d1b0e);
  g.fillRect(Math.round(8 * s), Math.round(0 * s), Math.round(16 * s), Math.round(5 * s));
  g.fillRect(Math.round(7 * s), Math.round(1 * s), Math.round(3 * s), Math.round(5 * s));
  g.fillRect(Math.round(22 * s), Math.round(1 * s), Math.round(3 * s), Math.round(5 * s));
  // Hair texture
  g.fillStyle(0x4a3728);
  g.fillRect(Math.round(12 * s), Math.round(1 * s), Math.round(3 * s), Math.round(2 * s));

  // Headphones (signature accessory)
  g.fillStyle(0x1f2937);
  g.fillRect(Math.round(5 * s), Math.round(3 * s), Math.round(3 * s), Math.round(6 * s));
  g.fillRect(Math.round(24 * s), Math.round(3 * s), Math.round(3 * s), Math.round(6 * s));
  g.fillRect(Math.round(7 * s), Math.round(-1 * s), Math.round(18 * s), Math.round(3 * s));
  // Ear cushions
  g.fillStyle(0x8b5cf6);
  g.fillRect(Math.round(5 * s), Math.round(4 * s), Math.round(2 * s), Math.round(4 * s));
  g.fillRect(Math.round(25 * s), Math.round(4 * s), Math.round(2 * s), Math.round(4 * s));

  // Eyes
  g.fillStyle(0x1a1a1a);
  g.fillRect(Math.round(11 * s), Math.round(6 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillStyle(0xffffff);
  g.fillRect(Math.round(11 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));
  g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));

  // Creative smile
  g.fillStyle(0x8b6b5a);
  g.fillRect(Math.round(13 * s), Math.round(10 * s), Math.round(6 * s), Math.round(1 * s));

  g.generateTexture("sincara", size, size);
  g.destroy();
}

function generateStuuSprite(scene: Phaser.Scene): void {
  // Stuu (@StuuBags) - Operations & Support
  // Friendly, approachable, helpful look with Bags green
  const s = SCALE;
  const size = Math.round(32 * s);
  const skinTone = 0xffdbac;
  const skinHighlight = 0xffe4c4;
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Bags green glow
  g.fillStyle(0x10b981, 0.15);
  g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
  g.fillStyle(0x22c55e, 0.1);
  g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

  // Shadow
  g.fillStyle(0x000000, 0.4);
  g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

  // Legs (dark jeans)
  g.fillStyle(0x1f2937);
  g.fillRect(Math.round(10 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));
  g.fillRect(Math.round(17 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));

  // Shoes
  g.fillStyle(0x374151);
  g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
  g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
  g.fillStyle(0xffffff);
  g.fillRect(Math.round(9 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));
  g.fillRect(Math.round(17 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));

  // Bags green polo shirt
  g.fillStyle(0x10b981);
  g.fillRect(Math.round(7 * s), Math.round(11 * s), Math.round(18 * s), Math.round(11 * s));
  // Collar
  g.fillStyle(0x059669);
  g.fillRect(Math.round(11 * s), Math.round(10 * s), Math.round(10 * s), Math.round(3 * s));
  // Polo buttons
  g.fillStyle(0xffffff);
  g.fillRect(Math.round(15 * s), Math.round(13 * s), Math.round(2 * s), Math.round(1 * s));
  g.fillRect(Math.round(15 * s), Math.round(15 * s), Math.round(2 * s), Math.round(1 * s));

  // Arms
  g.fillStyle(skinTone);
  g.fillRect(Math.round(4 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
  g.fillRect(Math.round(24 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
  g.fillRect(Math.round(4 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillRect(Math.round(25 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));

  // Head
  g.fillStyle(skinTone);
  g.fillRect(Math.round(9 * s), Math.round(3 * s), Math.round(14 * s), Math.round(10 * s));
  g.fillStyle(skinHighlight);
  g.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(4 * s), Math.round(3 * s));

  // Brown hair (friendly, neat)
  g.fillStyle(0x8b4513);
  g.fillRect(Math.round(8 * s), Math.round(0 * s), Math.round(16 * s), Math.round(5 * s));
  g.fillRect(Math.round(7 * s), Math.round(2 * s), Math.round(3 * s), Math.round(4 * s));
  g.fillRect(Math.round(22 * s), Math.round(2 * s), Math.round(3 * s), Math.round(4 * s));
  g.fillStyle(0xa0522d);
  g.fillRect(Math.round(11 * s), Math.round(1 * s), Math.round(5 * s), Math.round(2 * s));

  // Friendly eyes
  g.fillStyle(0x1a1a1a);
  g.fillRect(Math.round(11 * s), Math.round(6 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillStyle(0xffffff);
  g.fillRect(Math.round(12 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));
  g.fillRect(Math.round(19 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));

  // Big friendly smile
  g.fillStyle(0x8b6b5a);
  g.fillRect(Math.round(12 * s), Math.round(10 * s), Math.round(8 * s), Math.round(1 * s));
  g.fillRect(Math.round(13 * s), Math.round(11 * s), Math.round(6 * s), Math.round(1 * s));

  g.generateTexture("stuu", size, size);
  g.destroy();
}

function generateSamSprite(scene: Phaser.Scene): void {
  // Sam (@Sambags12) - Growth & Marketing
  // Energetic, hype energy, gold/amber colors
  const s = SCALE;
  const size = Math.round(32 * s);
  const skinTone = 0xf1c27d;
  const skinHighlight = 0xffd699;
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Gold/amber marketing glow
  g.fillStyle(0xf59e0b, 0.15);
  g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
  g.fillStyle(0xfbbf24, 0.1);
  g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

  // Shadow
  g.fillStyle(0x000000, 0.4);
  g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

  // Legs (stylish jeans)
  g.fillStyle(0x374151);
  g.fillRect(Math.round(10 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));
  g.fillRect(Math.round(17 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));

  // Trendy sneakers
  g.fillStyle(0xf59e0b);
  g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
  g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
  g.fillStyle(0xffffff);
  g.fillRect(Math.round(9 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));
  g.fillRect(Math.round(17 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));

  // Amber/gold jacket
  g.fillStyle(0xf59e0b);
  g.fillRect(Math.round(7 * s), Math.round(11 * s), Math.round(18 * s), Math.round(11 * s));
  // Jacket details
  g.fillStyle(0xd97706);
  g.fillRect(Math.round(15 * s), Math.round(11 * s), Math.round(2 * s), Math.round(11 * s));
  // White tee underneath
  g.fillStyle(0xffffff);
  g.fillRect(Math.round(11 * s), Math.round(11 * s), Math.round(10 * s), Math.round(4 * s));

  // Arms (jacket sleeves)
  g.fillStyle(0xf59e0b);
  g.fillRect(Math.round(4 * s), Math.round(12 * s), Math.round(4 * s), Math.round(8 * s));
  g.fillRect(Math.round(24 * s), Math.round(12 * s), Math.round(4 * s), Math.round(8 * s));
  // Hands
  g.fillStyle(skinTone);
  g.fillRect(Math.round(4 * s), Math.round(19 * s), Math.round(3 * s), Math.round(4 * s));
  g.fillRect(Math.round(25 * s), Math.round(19 * s), Math.round(3 * s), Math.round(4 * s));

  // Head
  g.fillStyle(skinTone);
  g.fillRect(Math.round(9 * s), Math.round(3 * s), Math.round(14 * s), Math.round(10 * s));
  g.fillStyle(skinHighlight);
  g.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(4 * s), Math.round(3 * s));

  // Blonde hair (trendy, styled up)
  g.fillStyle(0xffd700);
  g.fillRect(Math.round(8 * s), Math.round(-1 * s), Math.round(16 * s), Math.round(6 * s));
  g.fillRect(Math.round(7 * s), Math.round(1 * s), Math.round(3 * s), Math.round(5 * s));
  g.fillRect(Math.round(22 * s), Math.round(1 * s), Math.round(3 * s), Math.round(5 * s));
  // Styled spikes
  g.fillRect(Math.round(10 * s), Math.round(-2 * s), Math.round(3 * s), Math.round(3 * s));
  g.fillRect(Math.round(16 * s), Math.round(-2 * s), Math.round(3 * s), Math.round(3 * s));
  g.fillStyle(0xffc107);
  g.fillRect(Math.round(12 * s), Math.round(0 * s), Math.round(4 * s), Math.round(2 * s));

  // Energetic eyes
  g.fillStyle(0x1a1a1a);
  g.fillRect(Math.round(11 * s), Math.round(6 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillStyle(0xffffff);
  g.fillRect(Math.round(12 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));
  g.fillRect(Math.round(19 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));

  // Excited smile
  g.fillStyle(0x8b6b5a);
  g.fillRect(Math.round(12 * s), Math.round(10 * s), Math.round(8 * s), Math.round(1 * s));
  g.fillRect(Math.round(13 * s), Math.round(11 * s), Math.round(6 * s), Math.round(1 * s));

  g.generateTexture("sam", size, size);
  g.destroy();
}

function generateAlaaSprite(scene: Phaser.Scene): void {
  // Alaa (@alaadotsol) - Skunk Works Director
  // Mysterious, innovative, dark aesthetic with goggles
  const s = SCALE;
  const size = Math.round(32 * s);
  const skinTone = 0xd4a574;
  const skinHighlight = 0xe0b88c;
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Dark mysterious glow
  g.fillStyle(0x1f2937, 0.2);
  g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
  g.fillStyle(0x6366f1, 0.1); // Subtle purple hint
  g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

  // Shadow
  g.fillStyle(0x000000, 0.5);
  g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

  // Legs (black pants)
  g.fillStyle(0x0f0f0f);
  g.fillRect(Math.round(10 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));
  g.fillRect(Math.round(17 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));

  // Dark boots
  g.fillStyle(0x1a1a1a);
  g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
  g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
  g.fillStyle(0x374151);
  g.fillRect(Math.round(9 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));
  g.fillRect(Math.round(17 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));

  // Black lab coat/jacket
  g.fillStyle(0x1a1a1a);
  g.fillRect(Math.round(6 * s), Math.round(11 * s), Math.round(20 * s), Math.round(12 * s));
  // Coat details
  g.fillStyle(0x2d2d2d);
  g.fillRect(Math.round(15 * s), Math.round(11 * s), Math.round(2 * s), Math.round(12 * s));
  // Secret pocket glow (hint of experiments)
  g.fillStyle(0x6366f1);
  g.fillRect(Math.round(18 * s), Math.round(16 * s), Math.round(3 * s), Math.round(2 * s));

  // Arms (lab coat)
  g.fillStyle(0x1a1a1a);
  g.fillRect(Math.round(3 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
  g.fillRect(Math.round(25 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
  // Hands
  g.fillStyle(skinTone);
  g.fillRect(Math.round(3 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillRect(Math.round(26 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));

  // Head
  g.fillStyle(skinTone);
  g.fillRect(Math.round(9 * s), Math.round(3 * s), Math.round(14 * s), Math.round(10 * s));
  g.fillStyle(skinHighlight);
  g.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(4 * s), Math.round(3 * s));

  // Black hair (messy scientist look)
  g.fillStyle(0x0a0a0a);
  g.fillRect(Math.round(7 * s), Math.round(-1 * s), Math.round(18 * s), Math.round(6 * s));
  g.fillRect(Math.round(6 * s), Math.round(1 * s), Math.round(3 * s), Math.round(6 * s));
  g.fillRect(Math.round(23 * s), Math.round(1 * s), Math.round(3 * s), Math.round(6 * s));
  // Messy spikes
  g.fillRect(Math.round(9 * s), Math.round(-2 * s), Math.round(2 * s), Math.round(3 * s));
  g.fillRect(Math.round(14 * s), Math.round(-3 * s), Math.round(3 * s), Math.round(4 * s));
  g.fillRect(Math.round(20 * s), Math.round(-2 * s), Math.round(2 * s), Math.round(3 * s));

  // Lab goggles (signature accessory)
  g.fillStyle(0x374151); // Frame
  g.fillRect(Math.round(8 * s), Math.round(5 * s), Math.round(7 * s), Math.round(4 * s));
  g.fillRect(Math.round(17 * s), Math.round(5 * s), Math.round(7 * s), Math.round(4 * s));
  g.fillRect(Math.round(15 * s), Math.round(6 * s), Math.round(2 * s), Math.round(2 * s));
  // Goggle lens (glowing slightly)
  g.fillStyle(0x6366f1);
  g.fillRect(Math.round(9 * s), Math.round(6 * s), Math.round(5 * s), Math.round(2 * s));
  g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(5 * s), Math.round(2 * s));
  // Lens reflection
  g.fillStyle(0xa5b4fc);
  g.fillRect(Math.round(9 * s), Math.round(6 * s), Math.round(2 * s), Math.round(1 * s));
  g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(2 * s), Math.round(1 * s));

  // Mysterious neutral expression
  g.fillStyle(0x6b5b4a);
  g.fillRect(Math.round(13 * s), Math.round(10 * s), Math.round(6 * s), Math.round(1 * s));

  g.generateTexture("alaa", size, size);
  g.destroy();
}

function generateCarloSprite(scene: Phaser.Scene): void {
  // Carlo (@carlobags) - Community Ambassador
  // Welcoming, friendly, wearing badge, green polo
  const s = SCALE;
  const size = Math.round(32 * s);
  const skinTone = 0xf5d0c5;
  const skinHighlight = 0xfce4d6;
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Friendly green glow
  g.fillStyle(0x22c55e, 0.15);
  g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
  g.fillStyle(0x10b981, 0.1);
  g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

  // Shadow
  g.fillStyle(0x000000, 0.4);
  g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

  // Legs (navy pants - professional but casual)
  g.fillStyle(0x1e3a5f);
  g.fillRect(Math.round(10 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));
  g.fillRect(Math.round(17 * s), Math.round(21 * s), Math.round(5 * s), Math.round(10 * s));

  // Clean shoes
  g.fillStyle(0x374151);
  g.fillRect(Math.round(9 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
  g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(6 * s), Math.round(3 * s));
  g.fillStyle(0xffffff);
  g.fillRect(Math.round(9 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));
  g.fillRect(Math.round(17 * s), Math.round(31 * s), Math.round(6 * s), Math.round(1 * s));

  // Green polo (ambassador uniform)
  g.fillStyle(0x22c55e);
  g.fillRect(Math.round(7 * s), Math.round(11 * s), Math.round(18 * s), Math.round(11 * s));
  // Collar
  g.fillStyle(0x16a34a);
  g.fillRect(Math.round(11 * s), Math.round(10 * s), Math.round(10 * s), Math.round(3 * s));
  // Ambassador badge (gold)
  g.fillStyle(0xfbbf24);
  g.fillRect(Math.round(18 * s), Math.round(13 * s), Math.round(4 * s), Math.round(4 * s));
  g.fillStyle(0xf59e0b);
  g.fillRect(Math.round(19 * s), Math.round(14 * s), Math.round(2 * s), Math.round(2 * s));

  // Arms
  g.fillStyle(skinTone);
  g.fillRect(Math.round(4 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
  g.fillRect(Math.round(24 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
  g.fillRect(Math.round(4 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillRect(Math.round(25 * s), Math.round(21 * s), Math.round(3 * s), Math.round(2 * s));

  // Head
  g.fillStyle(skinTone);
  g.fillRect(Math.round(9 * s), Math.round(3 * s), Math.round(14 * s), Math.round(10 * s));
  g.fillStyle(skinHighlight);
  g.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(4 * s), Math.round(3 * s));

  // Brown hair (neat, professional)
  g.fillStyle(0x4a3728);
  g.fillRect(Math.round(8 * s), Math.round(0 * s), Math.round(16 * s), Math.round(5 * s));
  g.fillRect(Math.round(7 * s), Math.round(2 * s), Math.round(3 * s), Math.round(4 * s));
  g.fillRect(Math.round(22 * s), Math.round(2 * s), Math.round(3 * s), Math.round(4 * s));
  g.fillStyle(0x5c4033);
  g.fillRect(Math.round(11 * s), Math.round(1 * s), Math.round(5 * s), Math.round(2 * s));

  // Welcoming eyes
  g.fillStyle(0x1a1a1a);
  g.fillRect(Math.round(11 * s), Math.round(6 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillRect(Math.round(18 * s), Math.round(6 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillStyle(0xffffff);
  g.fillRect(Math.round(12 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));
  g.fillRect(Math.round(19 * s), Math.round(6 * s), Math.round(1 * s), Math.round(1 * s));

  // Warm welcoming smile
  g.fillStyle(0x8b6b5a);
  g.fillRect(Math.round(11 * s), Math.round(10 * s), Math.round(10 * s), Math.round(1 * s));
  g.fillRect(Math.round(12 * s), Math.round(11 * s), Math.round(8 * s), Math.round(1 * s));

  g.generateTexture("carlo", size, size);
  g.destroy();
}

function generateBNNSprite(scene: Phaser.Scene): void {
  // BNN (@BNNBags) - News Network Bot
  // Robot/news bot aesthetic, blue and white, screen display
  const s = SCALE;
  const size = Math.round(32 * s);
  const g = scene.make.graphics({ x: 0, y: 0 });

  // News blue glow
  g.fillStyle(0x3b82f6, 0.15);
  g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
  g.fillStyle(0x60a5fa, 0.1);
  g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

  // Shadow
  g.fillStyle(0x000000, 0.4);
  g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(14 * s), Math.round(5 * s));

  // Robot legs (metallic)
  g.fillStyle(0x4b5563);
  g.fillRect(Math.round(10 * s), Math.round(22 * s), Math.round(5 * s), Math.round(9 * s));
  g.fillRect(Math.round(17 * s), Math.round(22 * s), Math.round(5 * s), Math.round(9 * s));
  // Joint details
  g.fillStyle(0x6b7280);
  g.fillRect(Math.round(10 * s), Math.round(25 * s), Math.round(5 * s), Math.round(2 * s));
  g.fillRect(Math.round(17 * s), Math.round(25 * s), Math.round(5 * s), Math.round(2 * s));

  // Robot feet
  g.fillStyle(0x374151);
  g.fillRect(Math.round(8 * s), Math.round(29 * s), Math.round(7 * s), Math.round(3 * s));
  g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(7 * s), Math.round(3 * s));

  // Robot body (news blue)
  g.fillStyle(0x3b82f6);
  g.fillRect(Math.round(7 * s), Math.round(11 * s), Math.round(18 * s), Math.round(12 * s));
  // Body panel lines
  g.fillStyle(0x2563eb);
  g.fillRect(Math.round(7 * s), Math.round(16 * s), Math.round(18 * s), Math.round(2 * s));
  // News screen on chest
  g.fillStyle(0x1e293b);
  g.fillRect(Math.round(10 * s), Math.round(13 * s), Math.round(12 * s), Math.round(6 * s));
  // Screen content (scrolling text effect)
  g.fillStyle(0x22c55e);
  g.fillRect(Math.round(11 * s), Math.round(14 * s), Math.round(8 * s), Math.round(1 * s));
  g.fillRect(Math.round(11 * s), Math.round(16 * s), Math.round(6 * s), Math.round(1 * s));

  // Robot arms (metallic)
  g.fillStyle(0x4b5563);
  g.fillRect(Math.round(4 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
  g.fillRect(Math.round(24 * s), Math.round(12 * s), Math.round(4 * s), Math.round(10 * s));
  // Shoulder joints
  g.fillStyle(0x6b7280);
  g.fillRect(Math.round(4 * s), Math.round(11 * s), Math.round(4 * s), Math.round(2 * s));
  g.fillRect(Math.round(24 * s), Math.round(11 * s), Math.round(4 * s), Math.round(2 * s));
  // Robot hands (claw-like)
  g.fillStyle(0x374151);
  g.fillRect(Math.round(4 * s), Math.round(21 * s), Math.round(3 * s), Math.round(3 * s));
  g.fillRect(Math.round(25 * s), Math.round(21 * s), Math.round(3 * s), Math.round(3 * s));

  // Robot head (boxy, screen face)
  g.fillStyle(0x4b5563);
  g.fillRect(Math.round(8 * s), Math.round(2 * s), Math.round(16 * s), Math.round(11 * s));
  // Head border
  g.fillStyle(0x6b7280);
  g.fillRect(Math.round(8 * s), Math.round(2 * s), Math.round(16 * s), Math.round(2 * s));
  g.fillRect(Math.round(8 * s), Math.round(11 * s), Math.round(16 * s), Math.round(2 * s));

  // Face screen
  g.fillStyle(0x1e293b);
  g.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(12 * s), Math.round(6 * s));

  // LED eyes (bright cyan)
  g.fillStyle(0x22d3ee);
  g.fillRect(Math.round(11 * s), Math.round(5 * s), Math.round(3 * s), Math.round(3 * s));
  g.fillRect(Math.round(18 * s), Math.round(5 * s), Math.round(3 * s), Math.round(3 * s));
  // Eye glow
  g.fillStyle(0x67e8f9);
  g.fillRect(Math.round(11 * s), Math.round(5 * s), Math.round(1 * s), Math.round(1 * s));
  g.fillRect(Math.round(18 * s), Math.round(5 * s), Math.round(1 * s), Math.round(1 * s));

  // Antenna (for receiving news)
  g.fillStyle(0x6b7280);
  g.fillRect(Math.round(15 * s), Math.round(-2 * s), Math.round(2 * s), Math.round(5 * s));
  // Antenna light (blinking red)
  g.fillStyle(0xef4444);
  g.fillCircle(Math.round(16 * s), Math.round(-3 * s), Math.round(2 * s));

  // Speaker mouth
  g.fillStyle(0x374151);
  g.fillRect(Math.round(13 * s), Math.round(8 * s), Math.round(6 * s), Math.round(1 * s));
  g.fillStyle(0x22c55e); // Speaker active indicator
  g.fillRect(Math.round(14 * s), Math.round(8 * s), Math.round(1 * s), Math.round(1 * s));
  g.fillRect(Math.round(17 * s), Math.round(8 * s), Math.round(1 * s), Math.round(1 * s));

  g.generateTexture("bnn", size, size);
  g.destroy();
}

function generateProfessorOakSprite(scene: Phaser.Scene): void {
  // Professor Oak - Classic Pokemon style sprite
  // Based on original Gen 1/2 sprite: tall gray hair, white lab coat, red shirt
  const s = SCALE;
  const size = Math.round(32 * s);
  const skinTone = 0xf8d8b8; // Pokemon-style light skin
  const hairGray = 0x9ca3af; // Gray hair
  const hairDark = 0x6b7280; // Darker gray for shading
  const labCoat = 0xf8f8f8; // Off-white lab coat
  const labCoatShadow = 0xd1d5db; // Lab coat shadow
  const shirtRed = 0x9f1239; // Dark red/maroon shirt
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Amber/wisdom glow behind Professor Oak
  g.fillStyle(0xfbbf24, 0.12);
  g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(18 * s));
  g.fillStyle(0xf59e0b, 0.08);
  g.fillCircle(Math.round(16 * s), Math.round(16 * s), Math.round(22 * s));

  // Shadow on ground
  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(12 * s), Math.round(4 * s));

  // === LEGS (brown pants) ===
  g.fillStyle(0x6b4423); // Brown pants
  g.fillRect(Math.round(11 * s), Math.round(23 * s), Math.round(4 * s), Math.round(7 * s));
  g.fillRect(Math.round(17 * s), Math.round(23 * s), Math.round(4 * s), Math.round(7 * s));
  // Pants shadow
  g.fillStyle(0x4a3419);
  g.fillRect(Math.round(11 * s), Math.round(23 * s), Math.round(1 * s), Math.round(7 * s));
  g.fillRect(Math.round(17 * s), Math.round(23 * s), Math.round(1 * s), Math.round(7 * s));

  // === SHOES (dark brown) ===
  g.fillStyle(0x3d2817);
  g.fillRect(Math.round(10 * s), Math.round(29 * s), Math.round(5 * s), Math.round(3 * s));
  g.fillRect(Math.round(17 * s), Math.round(29 * s), Math.round(5 * s), Math.round(3 * s));

  // === LAB COAT (main body) ===
  g.fillStyle(labCoat);
  g.fillRect(Math.round(8 * s), Math.round(13 * s), Math.round(16 * s), Math.round(12 * s));
  // Lab coat shadow (left side depth)
  g.fillStyle(labCoatShadow);
  g.fillRect(Math.round(8 * s), Math.round(13 * s), Math.round(2 * s), Math.round(12 * s));
  // Lab coat opening (shows red shirt underneath)
  g.fillStyle(shirtRed);
  g.fillRect(Math.round(13 * s), Math.round(13 * s), Math.round(6 * s), Math.round(10 * s));
  // Lab coat lapel details
  g.fillStyle(labCoatShadow);
  g.fillRect(Math.round(12 * s), Math.round(13 * s), Math.round(1 * s), Math.round(8 * s));
  g.fillRect(Math.round(19 * s), Math.round(13 * s), Math.round(1 * s), Math.round(8 * s));

  // === ARMS (lab coat sleeves) ===
  g.fillStyle(labCoat);
  g.fillRect(Math.round(5 * s), Math.round(13 * s), Math.round(4 * s), Math.round(9 * s));
  g.fillRect(Math.round(23 * s), Math.round(13 * s), Math.round(4 * s), Math.round(9 * s));
  // Sleeve shadows
  g.fillStyle(labCoatShadow);
  g.fillRect(Math.round(5 * s), Math.round(13 * s), Math.round(1 * s), Math.round(9 * s));
  g.fillRect(Math.round(23 * s), Math.round(13 * s), Math.round(1 * s), Math.round(9 * s));

  // === HANDS ===
  g.fillStyle(skinTone);
  g.fillRect(Math.round(5 * s), Math.round(21 * s), Math.round(4 * s), Math.round(3 * s));
  g.fillRect(Math.round(23 * s), Math.round(21 * s), Math.round(4 * s), Math.round(3 * s));

  // === HEAD ===
  g.fillStyle(skinTone);
  g.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(12 * s), Math.round(10 * s));
  // Face shadow (left side)
  g.fillStyle(0xe8c8a8);
  g.fillRect(Math.round(10 * s), Math.round(4 * s), Math.round(2 * s), Math.round(10 * s));

  // === GRAY HAIR (tall, spiky - classic Oak style) ===
  // Main hair mass (tall on top)
  g.fillStyle(hairGray);
  g.fillRect(Math.round(9 * s), Math.round(-1 * s), Math.round(14 * s), Math.round(7 * s));
  // Hair spikes on top
  g.fillRect(Math.round(11 * s), Math.round(-3 * s), Math.round(3 * s), Math.round(3 * s));
  g.fillRect(Math.round(15 * s), Math.round(-4 * s), Math.round(3 * s), Math.round(4 * s));
  g.fillRect(Math.round(19 * s), Math.round(-2 * s), Math.round(3 * s), Math.round(3 * s));
  // Hair sides (bushy)
  g.fillRect(Math.round(7 * s), Math.round(2 * s), Math.round(3 * s), Math.round(6 * s));
  g.fillRect(Math.round(22 * s), Math.round(2 * s), Math.round(3 * s), Math.round(6 * s));
  // Hair shading (darker accents)
  g.fillStyle(hairDark);
  g.fillRect(Math.round(9 * s), Math.round(0 * s), Math.round(2 * s), Math.round(5 * s));
  g.fillRect(Math.round(12 * s), Math.round(-2 * s), Math.round(1 * s), Math.round(2 * s));
  g.fillRect(Math.round(16 * s), Math.round(-3 * s), Math.round(1 * s), Math.round(2 * s));
  g.fillRect(Math.round(7 * s), Math.round(3 * s), Math.round(1 * s), Math.round(4 * s));

  // === EYES (small, friendly) ===
  g.fillStyle(0x1f2937);
  g.fillRect(Math.round(12 * s), Math.round(7 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(18 * s), Math.round(7 * s), Math.round(2 * s), Math.round(2 * s));
  // Eye highlights
  g.fillStyle(0xffffff);
  g.fillRect(Math.round(12 * s), Math.round(7 * s), Math.round(1 * s), Math.round(1 * s));
  g.fillRect(Math.round(18 * s), Math.round(7 * s), Math.round(1 * s), Math.round(1 * s));

  // === EYEBROWS (gray, bushy) ===
  g.fillStyle(hairGray);
  g.fillRect(Math.round(11 * s), Math.round(5 * s), Math.round(4 * s), Math.round(2 * s));
  g.fillRect(Math.round(17 * s), Math.round(5 * s), Math.round(4 * s), Math.round(2 * s));

  // === NOSE ===
  g.fillStyle(0xe8c8a8);
  g.fillRect(Math.round(15 * s), Math.round(9 * s), Math.round(2 * s), Math.round(2 * s));

  // === MOUTH (friendly smile) ===
  g.fillStyle(0x92400e);
  g.fillRect(Math.round(14 * s), Math.round(12 * s), Math.round(4 * s), Math.round(1 * s));

  // === NECK ===
  g.fillStyle(skinTone);
  g.fillRect(Math.round(13 * s), Math.round(13 * s), Math.round(6 * s), Math.round(2 * s));

  g.generateTexture("professorOak", size, size);
  g.destroy();
}

function generateBagsySprite(scene: Phaser.Scene): void {
  // Bagsy - BagsWorld Hype Bot
  // Bagtardio-style blob with detailed WIF hat
  // Simple green eyes with black pupils, expressive eyebrows
  const s = SCALE;
  const size = Math.round(32 * s);

  // Color palette
  // Body: Lime green blob
  const greenLight = 0x90ee90; // Light highlight
  const greenMain = 0x32cd32; // Main lime green
  const greenMid = 0x228b22; // Mid shadow
  const greenDark = 0x006400; // Dark outline

  // WIF Hat: Salmon/terracotta with lots of texture
  const hatHighlight = 0xdeb887; // Burlywood highlight
  const hatLight = 0xcd853f; // Peru - light areas
  const hatMain = 0xb87333; // Copper main
  const hatMid = 0xa0522d; // Sienna mid
  const hatDark = 0x8b4513; // Saddle brown dark
  const hatOutline = 0x5d3a1a; // Very dark brown outline

  // Face
  const white = 0xffffff;
  const black = 0x000000;

  const g = scene.make.graphics({ x: 0, y: 0 });

  // === SHADOW under blob (wider for bag shape) ===
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(Math.round(16 * s), Math.round(30 * s), Math.round(13 * s), Math.round(4 * s));

  // === BLOB BODY - MONEY BAG SHAPE ===
  // Narrow at top (cinched), wider bulge at bottom
  // Dark outline - money bag shape
  g.fillStyle(greenDark);
  // Top (narrow cinch under hat)
  g.fillRect(Math.round(8 * s), Math.round(12 * s), Math.round(16 * s), Math.round(3 * s));
  // Upper body (starts to widen)
  g.fillRect(Math.round(6 * s), Math.round(14 * s), Math.round(20 * s), Math.round(4 * s));
  // Middle body (wider)
  g.fillRect(Math.round(4 * s), Math.round(17 * s), Math.round(24 * s), Math.round(5 * s));
  // Lower body (widest bulge)
  g.fillRect(Math.round(3 * s), Math.round(21 * s), Math.round(26 * s), Math.round(6 * s));
  // Bottom rounded corners
  g.fillRect(Math.round(5 * s), Math.round(27 * s), Math.round(22 * s), Math.round(2 * s));
  g.fillRect(Math.round(8 * s), Math.round(28 * s), Math.round(16 * s), Math.round(1 * s));

  // Main body fill - money bag shape
  g.fillStyle(greenMain);
  // Top (narrow)
  g.fillRect(Math.round(9 * s), Math.round(12 * s), Math.round(14 * s), Math.round(3 * s));
  // Upper body
  g.fillRect(Math.round(7 * s), Math.round(14 * s), Math.round(18 * s), Math.round(4 * s));
  // Middle body
  g.fillRect(Math.round(5 * s), Math.round(17 * s), Math.round(22 * s), Math.round(5 * s));
  // Lower body (widest)
  g.fillRect(Math.round(4 * s), Math.round(21 * s), Math.round(24 * s), Math.round(6 * s));
  // Bottom rounded
  g.fillRect(Math.round(6 * s), Math.round(27 * s), Math.round(20 * s), Math.round(1 * s));

  // Highlight left side (follows bag curve)
  g.fillStyle(greenLight);
  g.fillRect(Math.round(9 * s), Math.round(13 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillRect(Math.round(7 * s), Math.round(15 * s), Math.round(3 * s), Math.round(3 * s));
  g.fillRect(Math.round(5 * s), Math.round(18 * s), Math.round(3 * s), Math.round(4 * s));
  g.fillRect(Math.round(5 * s), Math.round(22 * s), Math.round(4 * s), Math.round(4 * s));

  // Shadow right side (follows bag curve)
  g.fillStyle(greenMid);
  g.fillRect(Math.round(22 * s), Math.round(15 * s), Math.round(3 * s), Math.round(3 * s));
  g.fillRect(Math.round(24 * s), Math.round(18 * s), Math.round(3 * s), Math.round(4 * s));
  g.fillRect(Math.round(24 * s), Math.round(22 * s), Math.round(3 * s), Math.round(5 * s));

  // === WIF HAT - DETAILED KNIT TEXTURE ===
  // Outline/base layer
  g.fillStyle(hatOutline);
  g.fillRect(Math.round(2 * s), Math.round(3 * s), Math.round(28 * s), Math.round(12 * s));
  g.fillRect(Math.round(4 * s), Math.round(1 * s), Math.round(24 * s), Math.round(3 * s));
  g.fillRect(Math.round(8 * s), Math.round(-1 * s), Math.round(16 * s), Math.round(3 * s));

  // Main hat fill
  g.fillStyle(hatMain);
  g.fillRect(Math.round(3 * s), Math.round(4 * s), Math.round(26 * s), Math.round(10 * s));
  g.fillRect(Math.round(5 * s), Math.round(2 * s), Math.round(22 * s), Math.round(3 * s));
  g.fillRect(Math.round(9 * s), Math.round(0 * s), Math.round(14 * s), Math.round(3 * s));

  // Knit texture bumps - row 1 (top)
  g.fillStyle(hatLight);
  g.fillRect(Math.round(10 * s), Math.round(1 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(14 * s), Math.round(0 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillRect(Math.round(19 * s), Math.round(1 * s), Math.round(2 * s), Math.round(2 * s));

  // Knit texture bumps - row 2
  g.fillRect(Math.round(6 * s), Math.round(3 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(10 * s), Math.round(3 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillRect(Math.round(15 * s), Math.round(2 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(19 * s), Math.round(3 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillRect(Math.round(24 * s), Math.round(3 * s), Math.round(2 * s), Math.round(2 * s));

  // Knit texture bumps - row 3
  g.fillRect(Math.round(4 * s), Math.round(5 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(8 * s), Math.round(5 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(12 * s), Math.round(5 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillRect(Math.round(17 * s), Math.round(5 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(21 * s), Math.round(5 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillRect(Math.round(26 * s), Math.round(5 * s), Math.round(2 * s), Math.round(2 * s));

  // Highlight bumps
  g.fillStyle(hatHighlight);
  g.fillRect(Math.round(6 * s), Math.round(3 * s), Math.round(1 * s), Math.round(1 * s));
  g.fillRect(Math.round(12 * s), Math.round(5 * s), Math.round(1 * s), Math.round(1 * s));
  g.fillRect(Math.round(10 * s), Math.round(1 * s), Math.round(1 * s), Math.round(1 * s));

  // Shadow bumps/grooves
  g.fillStyle(hatMid);
  g.fillRect(Math.round(7 * s), Math.round(4 * s), Math.round(1 * s), Math.round(2 * s));
  g.fillRect(Math.round(11 * s), Math.round(4 * s), Math.round(1 * s), Math.round(2 * s));
  g.fillRect(Math.round(16 * s), Math.round(4 * s), Math.round(1 * s), Math.round(2 * s));
  g.fillRect(Math.round(20 * s), Math.round(4 * s), Math.round(1 * s), Math.round(2 * s));
  g.fillRect(Math.round(24 * s), Math.round(4 * s), Math.round(1 * s), Math.round(2 * s));

  // Knit texture bumps - row 4
  g.fillStyle(hatLight);
  g.fillRect(Math.round(5 * s), Math.round(7 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillRect(Math.round(10 * s), Math.round(7 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(14 * s), Math.round(7 * s), Math.round(3 * s), Math.round(2 * s));
  g.fillRect(Math.round(19 * s), Math.round(7 * s), Math.round(2 * s), Math.round(2 * s));
  g.fillRect(Math.round(23 * s), Math.round(7 * s), Math.round(3 * s), Math.round(2 * s));

  // Shadow grooves row 4
  g.fillStyle(hatMid);
  g.fillRect(Math.round(8 * s), Math.round(7 * s), Math.round(1 * s), Math.round(2 * s));
  g.fillRect(Math.round(13 * s), Math.round(7 * s), Math.round(1 * s), Math.round(2 * s));
  g.fillRect(Math.round(17 * s), Math.round(7 * s), Math.round(1 * s), Math.round(2 * s));
  g.fillRect(Math.round(22 * s), Math.round(7 * s), Math.round(1 * s), Math.round(2 * s));

  // Hat brim/fold - thick band at bottom
  g.fillStyle(hatDark);
  g.fillRect(Math.round(2 * s), Math.round(10 * s), Math.round(28 * s), Math.round(4 * s));
  g.fillStyle(hatMid);
  g.fillRect(Math.round(3 * s), Math.round(11 * s), Math.round(26 * s), Math.round(2 * s));
  // Brim texture
  g.fillStyle(hatLight);
  g.fillRect(Math.round(5 * s), Math.round(11 * s), Math.round(2 * s), Math.round(1 * s));
  g.fillRect(Math.round(10 * s), Math.round(11 * s), Math.round(3 * s), Math.round(1 * s));
  g.fillRect(Math.round(16 * s), Math.round(11 * s), Math.round(2 * s), Math.round(1 * s));
  g.fillRect(Math.round(21 * s), Math.round(11 * s), Math.round(3 * s), Math.round(1 * s));

  // === EYES - Large, round, simple with green iris ===
  // Left eye outline
  g.fillStyle(black);
  g.fillRect(Math.round(7 * s), Math.round(15 * s), Math.round(8 * s), Math.round(8 * s));
  // Left eye green iris
  g.fillStyle(greenMain);
  g.fillRect(Math.round(8 * s), Math.round(16 * s), Math.round(6 * s), Math.round(6 * s));
  // Left eye black pupil
  g.fillStyle(black);
  g.fillRect(Math.round(10 * s), Math.round(17 * s), Math.round(3 * s), Math.round(4 * s));
  // Left eye white shine
  g.fillStyle(white);
  g.fillRect(Math.round(9 * s), Math.round(16 * s), Math.round(2 * s), Math.round(2 * s));

  // Right eye outline
  g.fillStyle(black);
  g.fillRect(Math.round(17 * s), Math.round(15 * s), Math.round(8 * s), Math.round(8 * s));
  // Right eye green iris
  g.fillStyle(greenMain);
  g.fillRect(Math.round(18 * s), Math.round(16 * s), Math.round(6 * s), Math.round(6 * s));
  // Right eye black pupil
  g.fillStyle(black);
  g.fillRect(Math.round(19 * s), Math.round(17 * s), Math.round(3 * s), Math.round(4 * s));
  // Right eye white shine
  g.fillStyle(white);
  g.fillRect(Math.round(19 * s), Math.round(16 * s), Math.round(2 * s), Math.round(2 * s));

  // === EYEBROWS - angled for expression ===
  g.fillStyle(black);
  // Left eyebrow (angled down toward center)
  g.fillRect(Math.round(7 * s), Math.round(14 * s), Math.round(4 * s), Math.round(2 * s));
  g.fillRect(Math.round(10 * s), Math.round(13 * s), Math.round(2 * s), Math.round(2 * s));
  // Right eyebrow (angled down toward center)
  g.fillRect(Math.round(21 * s), Math.round(14 * s), Math.round(4 * s), Math.round(2 * s));
  g.fillRect(Math.round(20 * s), Math.round(13 * s), Math.round(2 * s), Math.round(2 * s));

  // === SMALL MOUTH ===
  g.fillStyle(black);
  g.fillRect(Math.round(14 * s), Math.round(25 * s), Math.round(4 * s), Math.round(2 * s));

  // === TINY BLOB ARMS (on wider bag body) ===
  // Left arm - positioned on widest part of bag
  g.fillStyle(greenDark);
  g.fillRect(Math.round(1 * s), Math.round(20 * s), Math.round(4 * s), Math.round(4 * s));
  g.fillStyle(greenMain);
  g.fillRect(Math.round(2 * s), Math.round(21 * s), Math.round(2 * s), Math.round(2 * s));

  // Right arm (raised) - positioned on wider bag body
  g.fillStyle(greenDark);
  g.fillRect(Math.round(27 * s), Math.round(16 * s), Math.round(4 * s), Math.round(4 * s));
  g.fillStyle(greenMain);
  g.fillRect(Math.round(28 * s), Math.round(17 * s), Math.round(2 * s), Math.round(2 * s));

  g.generateTexture("bagsy", size, size);
  g.destroy();
}

export function generateTeamCharacters(scene: Phaser.Scene): void {
  generateRamoSprite(scene);
  generateSincaraSprite(scene);
  generateStuuSprite(scene);
  generateSamSprite(scene);
  generateAlaaSprite(scene);
  generateCarloSprite(scene);
  generateBNNSprite(scene);
  generateProfessorOakSprite(scene);
  generateBagsySprite(scene);
}
