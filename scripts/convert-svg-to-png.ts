#!/usr/bin/env npx tsx
/**
 * Convert all SVG character assets to PNG
 * Usage: npx tsx scripts/convert-svg-to-png.ts
 */

import fs from "fs";
import path from "path";
import sharp from "sharp";

const ASSETS_DIR = path.join(process.cwd(), "character-assets");
const PROFILES_DIR = path.join(ASSETS_DIR, "profiles");
const BANNERS_DIR = path.join(ASSETS_DIR, "banners");

async function convertSvgToPng(svgPath: string, pngPath: string, width: number, height: number) {
  const svgContent = fs.readFileSync(svgPath);

  await sharp(svgContent)
    .resize(width, height)
    .png()
    .toFile(pngPath);

  console.log(`  ✓ ${path.basename(pngPath)}`);
}

async function main() {
  console.log("\n🔄 Converting SVGs to PNGs\n");

  // Convert profiles (512x512)
  console.log("📷 Profiles (512x512):");
  const profileFiles = fs.readdirSync(PROFILES_DIR).filter(f => f.endsWith(".svg"));
  for (const file of profileFiles) {
    const svgPath = path.join(PROFILES_DIR, file);
    const pngPath = path.join(PROFILES_DIR, file.replace(".svg", ".png"));
    await convertSvgToPng(svgPath, pngPath, 512, 512);
  }

  // Convert banners (1500x500)
  console.log("\n🖼️  Banners (1500x500):");
  const bannerFiles = fs.readdirSync(BANNERS_DIR).filter(f => f.endsWith(".svg"));
  for (const file of bannerFiles) {
    const svgPath = path.join(BANNERS_DIR, file);
    const pngPath = path.join(BANNERS_DIR, file.replace(".svg", ".png"));
    await convertSvgToPng(svgPath, pngPath, 1500, 500);
  }

  console.log("\n✅ All conversions complete!");
  console.log(`📁 Output: ${ASSETS_DIR}\n`);
}

main().catch(console.error);
