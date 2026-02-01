#!/usr/bin/env npx tsx
/**
 * Generate character profile pictures and banners for X/Telegram
 *
 * Usage: npx tsx scripts/generate-character-assets.ts
 *
 * Output: ./character-assets/
 *   ├── profiles/      (512x512 square for profile pics)
 *   │   ├── ghost.png
 *   │   ├── ash.png
 *   │   └── ...
 *   └── banners/       (1500x500 for X headers)
 *       ├── ghost.png
 *       ├── ash.png
 *       └── ...
 */

import fs from "fs";
import path from "path";
import https from "https";

// Character definitions with visual descriptions for AI generation
const CHARACTERS = [
  {
    id: "ghost",
    name: "Ghost",
    description: "Mysterious developer with dark hoodie and hood up, glasses, purple ghost icon on chest, hacker aesthetic, nocturnal coder vibes",
    colors: ["#1a1a2e", "#4a0080", "#9945ff"],
    style: "cyberpunk hacker",
  },
  {
    id: "ash",
    name: "Ash",
    description: "Pokemon trainer inspired, red cap with white front, blue vest over black shirt, spiky black hair, Z-marks on cheeks, determined expression",
    colors: ["#ef4444", "#3b82f6", "#000000"],
    style: "anime pokemon trainer",
  },
  {
    id: "professor-oak",
    name: "Professor Oak",
    description: "Elderly professor with white lab coat, gray hair, kind grandfatherly face, glasses, holding a clipboard or pokeball, wise expression",
    colors: ["#ffffff", "#6b7280", "#78716c"],
    style: "anime professor scientist",
  },
  {
    id: "finn",
    name: "Finn",
    description: "Crypto founder with pink beanie hat, emerald green Bags hoodie, confident smile, startup CEO vibes, money bag icon",
    colors: ["#ec4899", "#4ade80", "#ffffff"],
    style: "tech startup founder",
  },
  {
    id: "toly",
    name: "Toly",
    description: "Solana co-founder inspired, purple Solana hoodie, beard, Solana green glow aura, blockchain visionary, technical genius look",
    colors: ["#9945ff", "#14f195", "#1a1a2e"],
    style: "tech visionary blockchain",
  },
  {
    id: "shaw",
    name: "Shaw",
    description: "AI agent architect, casual tech style, ElizaOS creator, thoughtful expression, glasses, coding on laptop, futuristic AI vibes",
    colors: ["#3b82f6", "#1e293b", "#f8fafc"],
    style: "AI researcher developer",
  },
  {
    id: "neo",
    name: "Neo",
    description: "Matrix-inspired scout, long black coat, sunglasses, seeing code in the matrix, on-chain data visualizer, mysterious watcher",
    colors: ["#000000", "#22c55e", "#1a1a2e"],
    style: "matrix cyberpunk hacker",
  },
  {
    id: "cj",
    name: "CJ",
    description: "GTA San Andreas inspired, white tank top, gold chain, bandana, street smart expression, Los Santos vibes, confident pose",
    colors: ["#ffffff", "#fbbf24", "#1f2937"],
    style: "GTA gangster street",
  },
  {
    id: "ramo",
    name: "Ramo",
    description: "CTO developer, smart casual, coding at multiple monitors, backend wizard, serious focused expression, tech lead vibes",
    colors: ["#3b82f6", "#1e293b", "#4ade80"],
    style: "senior software engineer",
  },
  {
    id: "sincara",
    name: "Sincara",
    description: "Frontend engineer, creative designer aesthetic, colorful outfit, working on UI designs, artistic and technical, modern style",
    colors: ["#ec4899", "#8b5cf6", "#06b6d4"],
    style: "creative UI designer",
  },
  {
    id: "stuu",
    name: "Stuu",
    description: "Operations manager, professional but approachable, headset for support, organized desk, helpful expression, community support vibes",
    colors: ["#4ade80", "#1e293b", "#ffffff"],
    style: "customer support professional",
  },
  {
    id: "sam",
    name: "Sam",
    description: "Growth marketer, energetic expression, social media icons around, megaphone or phone, marketing genius, viral content creator",
    colors: ["#f97316", "#fbbf24", "#1e293b"],
    style: "social media marketer",
  },
  {
    id: "alaa",
    name: "Alaa",
    description: "Skunk works R&D, lab coat with goggles, experimental gadgets, mad scientist vibes but friendly, innovation focused",
    colors: ["#8b5cf6", "#4ade80", "#1a1a2e"],
    style: "mad scientist inventor",
  },
  {
    id: "carlo",
    name: "Carlo",
    description: "Community ambassador, welcoming smile, Bags branded shirt, helping newcomers, friendly guide, community leader vibes",
    colors: ["#4ade80", "#fbbf24", "#1e293b"],
    style: "community manager friendly",
  },
  {
    id: "bnn",
    name: "BNN",
    description: "News anchor bot, professional news desk, microphone, breaking news graphics, robotic but charismatic, news network style",
    colors: ["#ef4444", "#1e293b", "#ffffff"],
    style: "news anchor broadcaster",
  },
  {
    id: "bags-bot",
    name: "Bags Bot",
    description: "Friendly mascot robot, Bags green color scheme, helpful assistant vibes, cute but capable, pixel art robot aesthetic",
    colors: ["#4ade80", "#1a1a2e", "#ffffff"],
    style: "cute helpful robot mascot",
  },
];

const OUTPUT_DIR = path.join(process.cwd(), "character-assets");
const PROFILES_DIR = path.join(OUTPUT_DIR, "profiles");
const BANNERS_DIR = path.join(OUTPUT_DIR, "banners");

// Ensure output directories exist
function ensureDirectories() {
  [OUTPUT_DIR, PROFILES_DIR, BANNERS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
}

// Generate procedural pixel art SVG (fallback when no API)
function generateProceduralProfile(character: typeof CHARACTERS[0]): string {
  const seed = character.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const random = (i: number) => {
    const x = Math.sin(seed * 9999 + i) * 10000;
    return x - Math.floor(x);
  };

  const [primary, secondary, accent] = character.colors;
  const size = 512;
  const gridSize = 32;
  const cellSize = size / gridSize;

  let pixels = "";

  // Generate symmetric pixel pattern
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize / 2; x++) {
      const i = y * gridSize + x;
      const val = random(i);

      let color = "transparent";
      if (val > 0.7) color = primary;
      else if (val > 0.5) color = secondary;
      else if (val > 0.35) color = accent;

      if (color !== "transparent") {
        // Left side
        pixels += `<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="${color}"/>`;
        // Right side (mirror)
        pixels += `<rect x="${(gridSize - 1 - x) * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="${color}"/>`;
      }
    }
  }

  // Add character initial in center
  const initial = character.name[0].toUpperCase();

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#0a0a0f"/>
  ${pixels}
  <text x="${size/2}" y="${size/2 + 40}" font-family="monospace" font-size="120" font-weight="bold" fill="${primary}" text-anchor="middle" opacity="0.8">${initial}</text>
  <text x="${size/2}" y="${size - 30}" font-family="monospace" font-size="28" fill="#ffffff" text-anchor="middle" opacity="0.6">${character.name}</text>
</svg>`;
}

// Generate procedural banner SVG
function generateProceduralBanner(character: typeof CHARACTERS[0]): string {
  const seed = character.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const random = (i: number) => {
    const x = Math.sin(seed * 7777 + i) * 10000;
    return x - Math.floor(x);
  };

  const [primary, secondary, accent] = character.colors;
  const width = 1500;
  const height = 500;

  // Generate abstract wave pattern
  let waves = "";
  for (let i = 0; i < 5; i++) {
    const y = 100 + i * 80;
    const amplitude = 30 + random(i) * 50;
    const frequency = 0.005 + random(i + 100) * 0.01;
    const phase = random(i + 200) * Math.PI * 2;

    let path = `M 0 ${y}`;
    for (let x = 0; x <= width; x += 20) {
      const yOffset = Math.sin(x * frequency + phase) * amplitude;
      path += ` L ${x} ${y + yOffset}`;
    }
    path += ` L ${width} ${height} L 0 ${height} Z`;

    const color = i % 3 === 0 ? primary : i % 3 === 1 ? secondary : accent;
    const opacity = 0.1 + (i * 0.1);
    waves += `<path d="${path}" fill="${color}" opacity="${opacity}"/>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg-${character.id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a0a0f"/>
      <stop offset="100%" style="stop-color:#1a1a2e"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg-${character.id})"/>
  ${waves}
  <text x="80" y="${height/2 + 20}" font-family="monospace" font-size="72" font-weight="bold" fill="${primary}">${character.name}</text>
  <text x="80" y="${height/2 + 70}" font-family="monospace" font-size="24" fill="#888888">${character.style}</text>
  <circle cx="${width - 150}" cy="${height/2}" r="80" fill="${primary}" opacity="0.3"/>
  <circle cx="${width - 150}" cy="${height/2}" r="50" fill="${secondary}" opacity="0.5"/>
  <text x="${width - 150}" y="${height/2 + 20}" font-family="monospace" font-size="64" font-weight="bold" fill="#ffffff" text-anchor="middle">${character.name[0]}</text>
</svg>`;
}

// Convert SVG to PNG using Replicate (if available)
async function svgToPngWithReplicate(svgContent: string, width: number, height: number): Promise<Buffer | null> {
  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) return null;

  // For now, just return null - we'll use SVG directly
  // In a full implementation, you'd use SDXL to generate based on the prompt
  return null;
}

// Generate AI image using Replicate SDXL
async function generateWithSDXL(
  prompt: string,
  width: number,
  height: number
): Promise<Buffer | null> {
  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) {
    console.log("  No REPLICATE_API_TOKEN - using procedural generation");
    return null;
  }

  console.log("  Generating with SDXL...");

  const requestBody = JSON.stringify({
    version: "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
    input: {
      prompt: prompt,
      negative_prompt: "blurry, low quality, distorted, ugly, deformed",
      width,
      height,
      num_inference_steps: 25,
      guidance_scale: 7.5,
    },
  });

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "api.replicate.com",
        path: "/v1/predictions",
        method: "POST",
        headers: {
          Authorization: `Token ${apiToken}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(requestBody),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", async () => {
          const result = JSON.parse(data);
          if (result.error) {
            console.log(`  SDXL error: ${result.error}`);
            resolve(null);
            return;
          }

          // Poll for completion
          const pollUrl = result.urls?.get;
          if (!pollUrl) {
            resolve(null);
            return;
          }

          // Wait for result (simplified polling)
          for (let i = 0; i < 60; i++) {
            await new Promise((r) => setTimeout(r, 2000));

            const pollResult = await new Promise<any>((pollResolve) => {
              https.get(
                pollUrl,
                { headers: { Authorization: `Token ${apiToken}` } },
                (pollRes) => {
                  let pollData = "";
                  pollRes.on("data", (c) => (pollData += c));
                  pollRes.on("end", () => pollResolve(JSON.parse(pollData)));
                }
              );
            });

            if (pollResult.status === "succeeded" && pollResult.output?.[0]) {
              // Download the image
              const imageUrl = pollResult.output[0];
              https.get(imageUrl, (imgRes) => {
                const chunks: Buffer[] = [];
                imgRes.on("data", (c) => chunks.push(c));
                imgRes.on("end", () => resolve(Buffer.concat(chunks)));
              });
              return;
            } else if (pollResult.status === "failed") {
              console.log(`  SDXL failed: ${pollResult.error}`);
              resolve(null);
              return;
            }
          }
          resolve(null);
        });
      }
    );
    req.on("error", () => resolve(null));
    req.write(requestBody);
    req.end();
  });
}

// Save SVG content to file
function saveSvg(content: string, filePath: string) {
  fs.writeFileSync(filePath, content);
  console.log(`  Saved: ${filePath}`);
}

// Main generation function
async function generateAllAssets() {
  console.log("\n🎨 BagsWorld Character Asset Generator\n");
  console.log("=====================================\n");

  ensureDirectories();

  const useAI = !!process.env.REPLICATE_API_TOKEN;
  console.log(`Mode: ${useAI ? "AI Generation (SDXL)" : "Procedural Pixel Art"}\n`);

  for (const character of CHARACTERS) {
    console.log(`\n📦 ${character.name} (${character.id})`);

    // Generate profile picture
    console.log("  → Profile (512x512)");
    if (useAI) {
      const prompt = `Portrait of ${character.description}, pixel art style, 16-bit retro game aesthetic, vibrant colors, black background, centered composition, character portrait, high quality`;
      const imageBuffer = await generateWithSDXL(prompt, 512, 512);
      if (imageBuffer) {
        fs.writeFileSync(path.join(PROFILES_DIR, `${character.id}.png`), imageBuffer);
        console.log(`  Saved: profiles/${character.id}.png`);
      } else {
        const svg = generateProceduralProfile(character);
        saveSvg(svg, path.join(PROFILES_DIR, `${character.id}.svg`));
      }
    } else {
      const svg = generateProceduralProfile(character);
      saveSvg(svg, path.join(PROFILES_DIR, `${character.id}.svg`));
    }

    // Generate banner
    console.log("  → Banner (1500x500)");
    if (useAI) {
      const prompt = `Wide banner featuring ${character.description}, ${character.style} aesthetic, abstract geometric background with colors ${character.colors.join(", ")}, modern design, suitable for social media header`;
      const imageBuffer = await generateWithSDXL(prompt, 1536, 512); // Closest SDXL size
      if (imageBuffer) {
        fs.writeFileSync(path.join(BANNERS_DIR, `${character.id}.png`), imageBuffer);
        console.log(`  Saved: banners/${character.id}.png`);
      } else {
        const svg = generateProceduralBanner(character);
        saveSvg(svg, path.join(BANNERS_DIR, `${character.id}.svg`));
      }
    } else {
      const svg = generateProceduralBanner(character);
      saveSvg(svg, path.join(BANNERS_DIR, `${character.id}.svg`));
    }
  }

  console.log("\n=====================================");
  console.log(`✅ Generated assets for ${CHARACTERS.length} characters`);
  console.log(`📁 Output: ${OUTPUT_DIR}`);
  console.log("\nTo use AI generation, set REPLICATE_API_TOKEN in your environment.\n");
}

// Run
generateAllAssets().catch(console.error);
