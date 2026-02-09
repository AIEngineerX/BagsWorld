// Visitor Sprite Generator - Creates unique pixel art sprites for platform visitors via fal.ai
// Falls back gracefully when FAL_KEY is not set (visitors use standard character textures)

import { NextRequest, NextResponse } from "next/server";

// In-memory cache: wallet -> { url, generatedAt }
const spriteCache = new Map<string, { url: string; generatedAt: number }>();
const SPRITE_CACHE_TTL = 24 * 60 * 60_000; // 24 hours

// 3 pre-built character templates, selected deterministically by wallet hash
// Generated at 256x256 then downscaled by Phaser for crisp pixel art at game resolution
const VISITOR_TEMPLATES = [
  {
    name: "Explorer",
    prompt:
      "single pixel art character centered in frame, full body visible, adventure hat, small backpack, standing idle pose, 16-bit SNES RPG style, chibi proportions, facing forward, solid white background, no other objects, clean hard pixel edges, vibrant colors, game sprite sheet style",
  },
  {
    name: "Trader",
    prompt:
      "single pixel art character centered in frame, full body visible, business suit with gold coin necklace, standing idle pose, 16-bit SNES RPG style, chibi proportions, facing forward, solid white background, no other objects, clean hard pixel edges, vibrant colors, game sprite sheet style",
  },
  {
    name: "Creator",
    prompt:
      "single pixel art character centered in frame, full body visible, artist beret with paint palette, standing idle pose, 16-bit SNES RPG style, chibi proportions, facing forward, solid white background, no other objects, clean hard pixel edges, vibrant colors, game sprite sheet style",
  },
];

function walletHash(wallet: string): number {
  let hash = 0;
  for (let i = 0; i < wallet.length; i++) {
    hash = (hash << 5) - hash + wallet.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export async function POST(request: NextRequest) {
  try {
    const { wallet, username, tokenSymbol } = await request.json();

    if (!wallet) {
      return NextResponse.json({ success: false, error: "wallet is required" }, { status: 400 });
    }

    // Check cache
    const cached = spriteCache.get(wallet);
    if (cached && Date.now() - cached.generatedAt < SPRITE_CACHE_TTL) {
      return NextResponse.json({ success: true, imageUrl: cached.url, cached: true });
    }

    const falKey = process.env.FAL_KEY;
    const replicateToken = process.env.REPLICATE_API_TOKEN;

    if (!falKey && !replicateToken) {
      return NextResponse.json({
        success: false,
        error: "Image generation not configured (set FAL_KEY or REPLICATE_API_TOKEN)",
      });
    }

    // Select template deterministically from wallet
    const templateIndex = walletHash(wallet) % VISITOR_TEMPLATES.length;
    const template = VISITOR_TEMPLATES[templateIndex];

    // Build prompt with visitor context
    const contextHint = tokenSymbol ? `, ${tokenSymbol}-themed color accent` : "";
    const nameHint = username ? `, inspired by @${username}` : "";
    const fullPrompt = `${template.prompt}${contextHint}${nameHint}, vibrant colors`;

    let imageUrl: string | null = null;

    // Try fal.ai first
    if (falKey) {
      try {
        const falResponse = await fetch("https://fal.run/fal-ai/flux/schnell", {
          method: "POST",
          headers: {
            Authorization: `Key ${falKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: fullPrompt,
            image_size: { width: 256, height: 256 },
            num_images: 1,
            num_inference_steps: 4,
            enable_safety_checker: true,
            output_format: "png",
          }),
        });

        if (falResponse.ok) {
          const result = await falResponse.json();
          if (result.images?.[0]?.url) {
            imageUrl = result.images[0].url;
          }
        }
      } catch (error) {
        console.warn("[visitor-sprite] fal.ai failed:", error);
      }
    }

    // Fallback to Replicate SDXL
    if (!imageUrl && replicateToken) {
      try {
        const createResponse = await fetch("https://api.replicate.com/v1/predictions", {
          method: "POST",
          headers: {
            Authorization: `Token ${replicateToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            version: "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
            input: {
              prompt: fullPrompt,
              width: 256,
              height: 256,
              num_outputs: 1,
            },
          }),
        });

        const prediction = await createResponse.json();
        if (createResponse.ok && prediction.urls?.get) {
          // Poll for completion (max 30 seconds)
          for (let i = 0; i < 15; i++) {
            const pollResponse = await fetch(prediction.urls.get, {
              headers: { Authorization: `Token ${replicateToken}` },
            });
            const result = await pollResponse.json();
            if (result.status === "succeeded" && result.output?.[0]) {
              imageUrl = result.output[0];
              break;
            }
            if (result.status === "failed") break;
            await new Promise((r) => setTimeout(r, 2000));
          }
        }
      } catch (error) {
        console.warn("[visitor-sprite] Replicate fallback failed:", error);
      }
    }

    if (!imageUrl) {
      return NextResponse.json({ success: false, error: "Sprite generation failed" });
    }

    // Remove background using fal.ai BiRefNet for transparent sprite
    let finalUrl: string = imageUrl;
    if (falKey) {
      try {
        const bgRemoveResponse = await fetch("https://fal.run/fal-ai/birefnet", {
          method: "POST",
          headers: {
            Authorization: `Key ${falKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image_url: imageUrl,
            model: "General Use (Light)",
            operating_resolution: "256x256",
            output_format: "png",
          }),
        });

        if (bgRemoveResponse.ok) {
          const bgResult = await bgRemoveResponse.json();
          if (bgResult.image?.url) {
            finalUrl = bgResult.image.url;
            console.log(
              `[visitor-sprite] Background removed for ${username || wallet.slice(0, 8)}`
            );
          }
        }
      } catch (error) {
        console.warn("[visitor-sprite] Background removal failed, using original:", error);
      }
    }

    // Cache the result
    spriteCache.set(wallet, { url: finalUrl, generatedAt: Date.now() });

    console.log(
      `[visitor-sprite] Generated ${template.name} sprite for ${username || wallet.slice(0, 8)}`
    );

    return NextResponse.json({ success: true, imageUrl: finalUrl, template: template.name });
  } catch (error) {
    console.error("[visitor-sprite] Error:", error);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
