// Professor Oak AI Generator API
// Generates token names, tickers, descriptions, logos, and banners
// Uses Claude for creative text and Replicate for image generation

import { NextRequest, NextResponse } from "next/server";

// =============================================================================
// TYPES
// =============================================================================

type GenerateAction =
  | "suggest-names"
  | "generate-logo"
  | "generate-banner"
  | "resize-image"
  | "full-wizard";

interface GenerateRequest {
  action: GenerateAction;
  concept?: string;
  style?: "pixel-art" | "cartoon" | "minimalist" | "abstract" | "cute";
  selectedName?: string;
  selectedTicker?: string;
  imageData?: string; // base64 for resize
  targetWidth?: number;
  targetHeight?: number;
}

interface NameSuggestion {
  name: string;
  ticker: string;
  description: string;
}

interface GenerateResponse {
  success: boolean;
  names?: NameSuggestion[];
  imageUrl?: string; // base64 data URL
  logoUrl?: string;
  bannerUrl?: string;
  error?: string;
  source?: string;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

// Style-specific prompt modifiers for image generation
const STYLE_PROMPTS: Record<string, string> = {
  "pixel-art":
    "pixel art style, 16-bit retro game aesthetic, crisp pixels, no anti-aliasing, limited color palette, nostalgic gaming vibe",
  cartoon:
    "cartoon style, bold outlines, vibrant colors, playful and fun, mascot-like, clean vector look",
  minimalist:
    "minimalist design, simple shapes, clean lines, modern, flat design, professional, single focal point",
  abstract:
    "abstract art style, geometric shapes, bold colors, artistic interpretation, creative and unique",
  cute: "kawaii cute style, adorable, big eyes, pastel colors, chibi proportions, friendly and approachable",
};

// =============================================================================
// NAME/TICKER GENERATION (Claude)
// =============================================================================

async function generateNames(concept: string): Promise<NameSuggestion[]> {
  if (!ANTHROPIC_API_KEY) {
    // Fallback: Generate basic suggestions without AI
    return generateFallbackNames(concept);
  }

  const systemPrompt = `You are a memecoin naming expert who creates viral, memorable token names for Solana. You understand crypto culture, memes, and what makes tokens go viral.

RULES:
- Names: 3-32 characters, catchy, memorable, often plays on words or memes
- Tickers: 2-10 characters, ALL CAPS, no $ symbol, easy to remember
- Avoid offensive or controversial names
- Make them fun, shareable, and community-friendly
- Consider crypto slang: moon, ape, degen, fren, wagmi, gm, etc.
- Descriptions should be 1-2 punchy sentences that tell a story

OUTPUT FORMAT: Return ONLY a JSON array with exactly 5 objects. No markdown, no explanation, just the raw JSON array.
Each object: { "name": "TokenName", "ticker": "TICK", "description": "Short catchy description" }`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Create 5 creative memecoin names based on this concept: "${concept}"`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[oak-generate] Anthropic API error:", errorText);
    return generateFallbackNames(concept);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text;

  if (!content) {
    return generateFallbackNames(concept);
  }

  // Parse JSON from response (handle potential markdown wrapping)
  let jsonString = content.trim();
  if (jsonString.startsWith("```")) {
    jsonString = jsonString.replace(/```json?\n?/g, "").replace(/```/g, "");
  }

  const parsed = JSON.parse(jsonString);

  // Validate and clean the response
  if (!Array.isArray(parsed)) {
    return generateFallbackNames(concept);
  }

  return parsed.slice(0, 5).map((item: any) => ({
    name: String(item.name || "").slice(0, 32),
    ticker: String(item.ticker || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 10),
    description: String(item.description || "").slice(0, 200),
  }));
}

function generateFallbackNames(concept: string): NameSuggestion[] {
  // Extract key words from concept
  const words = concept
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const mainWord = words[0] || "token";
  const capitalWord = mainWord.charAt(0).toUpperCase() + mainWord.slice(1);

  const suffixes = ["Coin", "Moon", "Inu", "Doge", "Fi"];
  const prefixes = ["Baby", "Super", "Mega", "Ultra", "Giga"];

  return [
    {
      name: `${capitalWord}Coin`,
      ticker: mainWord.toUpperCase().slice(0, 4),
      description: `The official ${mainWord} of the blockchain. To the moon!`,
    },
    {
      name: `${prefixes[Math.floor(Math.random() * prefixes.length)]}${capitalWord}`,
      ticker: `S${mainWord.toUpperCase().slice(0, 3)}`,
      description: `${capitalWord} but super powered. WAGMI.`,
    },
    {
      name: `${capitalWord}${suffixes[Math.floor(Math.random() * suffixes.length)]}`,
      ticker: `${mainWord.toUpperCase().slice(0, 3)}I`,
      description: `Community-driven ${mainWord} for the people.`,
    },
    {
      name: `$${capitalWord}`,
      ticker: mainWord.toUpperCase().slice(0, 5),
      description: `The money ${mainWord}. Built different.`,
    },
    {
      name: `${capitalWord}World`,
      ticker: `${mainWord.toUpperCase().slice(0, 2)}W`,
      description: `Enter the world of ${mainWord}. A new era begins.`,
    },
  ];
}

// =============================================================================
// IMAGE GENERATION (Replicate or Procedural Fallback)
// =============================================================================

async function generateImage(
  prompt: string,
  width: number,
  height: number,
  style: string
): Promise<string> {
  // If Replicate is configured, use it
  if (REPLICATE_API_TOKEN) {
    return generateImageWithReplicate(prompt, width, height, style);
  }

  // Otherwise use procedural generation
  return generateProceduralImage(prompt, width, height, style);
}

async function generateImageWithReplicate(
  prompt: string,
  width: number,
  height: number,
  style: string
): Promise<string> {
  const styleModifier = STYLE_PROMPTS[style] || STYLE_PROMPTS["pixel-art"];

  // Use SDXL for high quality
  const fullPrompt = `${prompt}, ${styleModifier}, high quality, professional, centered composition, solid background`;

  // Create prediction
  const createResponse = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Token ${REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // SDXL model for high quality
      version: "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
      input: {
        prompt: fullPrompt,
        negative_prompt:
          "blurry, low quality, distorted, ugly, bad anatomy, watermark, signature, text",
        width: width,
        height: height,
        num_outputs: 1,
        scheduler: "K_EULER",
        num_inference_steps: 25,
        guidance_scale: 7.5,
      },
    }),
  });

  if (!createResponse.ok) {
    const error = await createResponse.text();
    console.error("[oak-generate] Replicate create error:", error);
    return generateProceduralImage(prompt, width, height, style);
  }

  const prediction = await createResponse.json();
  const predictionId = prediction.id;

  // Poll for completion (max 60 seconds)
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: {
        Authorization: `Token ${REPLICATE_API_TOKEN}`,
      },
    });

    if (!statusResponse.ok) {
      continue;
    }

    const status = await statusResponse.json();

    if (status.status === "succeeded" && status.output?.[0]) {
      // Fetch the image and convert to base64
      const imageUrl = status.output[0];
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      const base64 = Buffer.from(imageBuffer).toString("base64");
      const mimeType = imageResponse.headers.get("content-type") || "image/png";
      return `data:${mimeType};base64,${base64}`;
    }

    if (status.status === "failed") {
      console.error("[oak-generate] Replicate generation failed:", status.error);
      return generateProceduralImage(prompt, width, height, style);
    }
  }

  // Timeout - fall back to procedural
  console.warn("[oak-generate] Replicate timeout, using procedural fallback");
  return generateProceduralImage(prompt, width, height, style);
}

// =============================================================================
// PROCEDURAL PIXEL ART GENERATION (No API needed)
// =============================================================================

function generateProceduralImage(
  prompt: string,
  width: number,
  height: number,
  style: string
): string {
  // Generate a deterministic seed from the prompt
  let seed = 0;
  for (let i = 0; i < prompt.length; i++) {
    seed = (seed * 31 + prompt.charCodeAt(i)) & 0xffffffff;
  }

  // Seeded random function
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  // Color palettes based on style
  const palettes: Record<string, string[][]> = {
    "pixel-art": [
      ["#1a1c2c", "#5d275d", "#b13e53", "#ef7d57", "#ffcd75", "#a7f070", "#38b764", "#257179"],
      ["#29366f", "#3b5dc9", "#41a6f6", "#73eff7", "#f4f4f4", "#94b0c2", "#566c86", "#333c57"],
      ["#2e222f", "#3e3546", "#625565", "#966c6c", "#ab947a", "#694f62", "#7f708a", "#9babb2"],
    ],
    cartoon: [
      ["#ff6b6b", "#feca57", "#48dbfb", "#ff9ff3", "#54a0ff", "#5f27cd", "#00d2d3", "#1dd1a1"],
      ["#fd79a8", "#a29bfe", "#74b9ff", "#81ecec", "#55efc4", "#ffeaa7", "#fab1a0", "#ff7675"],
    ],
    minimalist: [
      ["#2d3436", "#636e72", "#b2bec3", "#dfe6e9", "#ffffff"],
      ["#0984e3", "#74b9ff", "#dfe6e9", "#ffffff", "#2d3436"],
      ["#00b894", "#55efc4", "#dfe6e9", "#ffffff", "#2d3436"],
    ],
    abstract: [
      ["#6c5ce7", "#a29bfe", "#fd79a8", "#ff7675", "#fab1a0", "#ffeaa7", "#81ecec", "#74b9ff"],
      ["#e17055", "#fdcb6e", "#00b894", "#00cec9", "#0984e3", "#6c5ce7", "#fd79a8", "#d63031"],
    ],
    cute: [
      ["#ffb8b8", "#ffc9c9", "#ffd8d8", "#ffe3e3", "#fff0f0", "#ffb3ba", "#bae1ff", "#baffc9"],
      ["#ffd1dc", "#ffdac1", "#fff5ba", "#d0f0c0", "#aec6cf", "#c3b1e1", "#f5c2c1", "#fff0f5"],
    ],
  };

  const stylePalettes = palettes[style] || palettes["pixel-art"];
  const colors = stylePalettes[Math.floor(random() * stylePalettes.length)];

  // Create SVG-based pixel art
  const pixelSize = style === "pixel-art" ? 16 : 8;
  const gridWidth = Math.floor(width / pixelSize);
  const gridHeight = Math.floor(height / pixelSize);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;

  // Background
  const bgColor = colors[0];
  svg += `<rect width="${width}" height="${height}" fill="${bgColor}"/>`;

  // Generate pattern based on style
  if (style === "pixel-art" || style === "cute") {
    // Symmetric pixel art (for logos)
    const halfWidth = Math.floor(gridWidth / 2);
    const pattern: number[][] = [];

    for (let y = 0; y < gridHeight; y++) {
      pattern[y] = [];
      for (let x = 0; x < halfWidth; x++) {
        // Create organic shapes with higher probability near center
        const distFromCenter =
          Math.abs(x - halfWidth / 2) / (halfWidth / 2) +
          Math.abs(y - gridHeight / 2) / (gridHeight / 2);
        const fillProbability = Math.max(0, 0.7 - distFromCenter * 0.4);
        pattern[y][x] = random() < fillProbability ? Math.floor(random() * (colors.length - 1)) + 1 : 0;
      }
    }

    // Draw symmetric pattern
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < halfWidth; x++) {
        if (pattern[y][x] > 0) {
          const color = colors[pattern[y][x]];
          // Left side
          svg += `<rect x="${x * pixelSize}" y="${y * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="${color}"/>`;
          // Right side (mirrored)
          svg += `<rect x="${(gridWidth - 1 - x) * pixelSize}" y="${y * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="${color}"/>`;
        }
      }
    }

    // Add eyes if it's a creature-like shape (for cute/pixel-art)
    if (style === "cute" || random() > 0.5) {
      const eyeY = Math.floor(gridHeight * 0.35);
      const eyeX1 = Math.floor(gridWidth * 0.35);
      const eyeX2 = gridWidth - 1 - eyeX1;
      svg += `<rect x="${eyeX1 * pixelSize}" y="${eyeY * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="#ffffff"/>`;
      svg += `<rect x="${eyeX2 * pixelSize}" y="${eyeY * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="#ffffff"/>`;
      // Pupils
      svg += `<rect x="${(eyeX1 + 0.3) * pixelSize}" y="${(eyeY + 0.3) * pixelSize}" width="${pixelSize * 0.5}" height="${pixelSize * 0.5}" fill="#000000"/>`;
      svg += `<rect x="${(eyeX2 + 0.3) * pixelSize}" y="${(eyeY + 0.3) * pixelSize}" width="${pixelSize * 0.5}" height="${pixelSize * 0.5}" fill="#000000"/>`;
    }
  } else if (style === "minimalist") {
    // Simple geometric shape
    const shapes = ["circle", "square", "triangle"];
    const shape = shapes[Math.floor(random() * shapes.length)];
    const mainColor = colors[Math.floor(random() * (colors.length - 1)) + 1];

    if (shape === "circle") {
      const cx = width / 2;
      const cy = height / 2;
      const r = Math.min(width, height) * 0.35;
      svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${mainColor}"/>`;
    } else if (shape === "square") {
      const size = Math.min(width, height) * 0.6;
      const x = (width - size) / 2;
      const y = (height - size) / 2;
      svg += `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${mainColor}" rx="${size * 0.1}"/>`;
    } else {
      const size = Math.min(width, height) * 0.7;
      const cx = width / 2;
      const cy = height / 2;
      const points = `${cx},${cy - size / 2} ${cx - size / 2},${cy + size / 3} ${cx + size / 2},${cy + size / 3}`;
      svg += `<polygon points="${points}" fill="${mainColor}"/>`;
    }
  } else if (style === "abstract") {
    // Multiple overlapping shapes
    for (let i = 0; i < 5; i++) {
      const color = colors[Math.floor(random() * colors.length)];
      const cx = random() * width;
      const cy = random() * height;
      const size = (random() * 0.4 + 0.2) * Math.min(width, height);

      if (random() > 0.5) {
        svg += `<circle cx="${cx}" cy="${cy}" r="${size / 2}" fill="${color}" opacity="0.7"/>`;
      } else {
        svg += `<rect x="${cx - size / 2}" y="${cy - size / 2}" width="${size}" height="${size}" fill="${color}" opacity="0.7" rx="${random() * size * 0.3}"/>`;
      }
    }
  } else if (style === "cartoon") {
    // Bold character with outline
    const bodyColor = colors[Math.floor(random() * (colors.length - 1)) + 1];
    const outlineColor = "#2d3436";

    // Body (rounded square)
    const size = Math.min(width, height) * 0.7;
    const x = (width - size) / 2;
    const y = (height - size) / 2;
    svg += `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${bodyColor}" stroke="${outlineColor}" stroke-width="4" rx="${size * 0.2}"/>`;

    // Eyes
    const eyeSize = size * 0.15;
    const eyeY = y + size * 0.35;
    svg += `<circle cx="${x + size * 0.35}" cy="${eyeY}" r="${eyeSize}" fill="white" stroke="${outlineColor}" stroke-width="2"/>`;
    svg += `<circle cx="${x + size * 0.65}" cy="${eyeY}" r="${eyeSize}" fill="white" stroke="${outlineColor}" stroke-width="2"/>`;
    // Pupils
    svg += `<circle cx="${x + size * 0.35}" cy="${eyeY}" r="${eyeSize * 0.5}" fill="${outlineColor}"/>`;
    svg += `<circle cx="${x + size * 0.65}" cy="${eyeY}" r="${eyeSize * 0.5}" fill="${outlineColor}"/>`;

    // Smile
    svg += `<path d="M ${x + size * 0.3} ${y + size * 0.65} Q ${x + size * 0.5} ${y + size * 0.8} ${x + size * 0.7} ${y + size * 0.65}" fill="none" stroke="${outlineColor}" stroke-width="3" stroke-linecap="round"/>`;
  }

  svg += "</svg>";

  // Convert SVG to base64 data URL
  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

// =============================================================================
// IMAGE RESIZING
// =============================================================================

async function resizeImage(
  imageData: string,
  targetWidth: number,
  targetHeight: number
): Promise<string> {
  // For server-side, we'll use a canvas-like approach with SVG
  // Extract the base64 data and return it wrapped in an SVG that scales it

  // Parse the data URL
  const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error("Invalid image data URL");
  }

  const mimeType = matches[1];
  const base64Data = matches[2];

  // Create an SVG that embeds the image at the target size
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${targetWidth}" height="${targetHeight}">
    <image href="data:${mimeType};base64,${base64Data}" width="${targetWidth}" height="${targetHeight}" preserveAspectRatio="xMidYMid slice"/>
  </svg>`;

  const svgBase64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${svgBase64}`;
}

// =============================================================================
// FULL WIZARD (Generate everything at once)
// =============================================================================

async function fullWizard(
  concept: string,
  style: string
): Promise<{
  names: NameSuggestion[];
  logoUrl: string;
  bannerUrl: string;
}> {
  // Generate names first
  const names = await generateNames(concept);

  // Use the first name for image prompts
  const primaryName = names[0]?.name || concept;

  // Generate logo (512x512)
  const logoPrompt = `Token logo mascot for "${primaryName}", ${concept} theme, iconic, memorable, centered`;
  const logoUrl = await generateImage(logoPrompt, 512, 512, style);

  // Generate banner (600x200)
  const bannerPrompt = `Wide banner for "${primaryName}" token, ${concept} theme, landscape scene, promotional, dynamic`;
  const bannerUrl = await generateImage(bannerPrompt, 600, 200, style);

  return { names, logoUrl, bannerUrl };
}

// =============================================================================
// MAIN API HANDLER
// =============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<GenerateResponse>> {
  const body: GenerateRequest = await request.json();
  const { action, concept, style = "pixel-art", imageData, targetWidth, targetHeight } = body;

  if (!action) {
    return NextResponse.json({ success: false, error: "Missing action parameter" }, { status: 400 });
  }

  switch (action) {
    case "suggest-names": {
      if (!concept) {
        return NextResponse.json(
          { success: false, error: "Missing concept for name generation" },
          { status: 400 }
        );
      }

      const names = await generateNames(concept);
      return NextResponse.json({
        success: true,
        names,
        source: ANTHROPIC_API_KEY ? "claude" : "fallback",
      });
    }

    case "generate-logo": {
      if (!concept) {
        return NextResponse.json(
          { success: false, error: "Missing concept for logo generation" },
          { status: 400 }
        );
      }

      const logoPrompt = `Token logo mascot for ${concept}, iconic symbol, memorable, centered, professional`;
      const logoUrl = await generateImage(logoPrompt, 512, 512, style);

      return NextResponse.json({
        success: true,
        imageUrl: logoUrl,
        source: REPLICATE_API_TOKEN ? "replicate" : "procedural",
      });
    }

    case "generate-banner": {
      if (!concept) {
        return NextResponse.json(
          { success: false, error: "Missing concept for banner generation" },
          { status: 400 }
        );
      }

      const bannerPrompt = `Wide promotional banner for ${concept}, landscape scene, dynamic composition, engaging`;
      const bannerUrl = await generateImage(bannerPrompt, 600, 200, style);

      return NextResponse.json({
        success: true,
        imageUrl: bannerUrl,
        source: REPLICATE_API_TOKEN ? "replicate" : "procedural",
      });
    }

    case "resize-image": {
      if (!imageData) {
        return NextResponse.json(
          { success: false, error: "Missing imageData for resize" },
          { status: 400 }
        );
      }

      const width = targetWidth || 512;
      const height = targetHeight || 512;
      const resizedUrl = await resizeImage(imageData, width, height);

      return NextResponse.json({
        success: true,
        imageUrl: resizedUrl,
        source: "resize",
      });
    }

    case "full-wizard": {
      if (!concept) {
        return NextResponse.json(
          { success: false, error: "Missing concept for full wizard" },
          { status: 400 }
        );
      }

      const result = await fullWizard(concept, style);

      return NextResponse.json({
        success: true,
        names: result.names,
        logoUrl: result.logoUrl,
        bannerUrl: result.bannerUrl,
        source: REPLICATE_API_TOKEN ? "replicate" : "procedural",
      });
    }

    default:
      return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  }
}

// GET endpoint to check configuration status
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: "ready",
    features: {
      nameGeneration: ANTHROPIC_API_KEY ? "claude" : "fallback",
      imageGeneration: REPLICATE_API_TOKEN ? "replicate" : "procedural",
    },
    capabilities: ["suggest-names", "generate-logo", "generate-banner", "resize-image", "full-wizard"],
  });
}
