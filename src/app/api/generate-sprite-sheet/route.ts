import { fal } from "@fal-ai/client";
import { NextRequest, NextResponse } from "next/server";

// Configure fal client with API key from environment
fal.config({
  credentials: process.env.FAL_KEY,
});

const WALK_SPRITE_PROMPT = `Create a 4-frame pixel art walk cycle sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid on white background. The character is walking to the right.

Top row (frames 1-2):
Frame 1 (top-left): Right leg forward, left leg back - stride position
Frame 2 (top-right): Legs close together, passing/crossing - transition

Bottom row (frames 3-4):
Frame 3 (bottom-left): Left leg forward, right leg back - opposite stride
Frame 4 (bottom-right): Legs close together, passing/crossing - transition back

Each frame shows a different phase of the walking motion. This creates a smooth looping walk cycle.

Use detailed 32-bit pixel art style with proper shading and highlights. Same character design in all frames. Character facing right.`;

const IDLE_SPRITE_PROMPT = `Create a 4-frame pixel art idle/breathing animation sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid on white background. The character is standing still but with subtle idle animation.

Top row (frames 1-2):
Frame 1 (top-left): Neutral standing pose - relaxed stance
Frame 2 (top-right): Slight inhale - chest/body rises subtly, maybe slight arm movement

Bottom row (frames 3-4):
Frame 3 (bottom-left): Full breath - slight upward posture
Frame 4 (bottom-right): Exhale - returning to neutral, slight settle

Keep movements SUBTLE - this is a gentle breathing/idle loop, not dramatic motion. Character should look alive but relaxed.

Use detailed 32-bit pixel art style with proper shading and highlights. Same character design in all frames. Character facing right.`;

type SpriteType = "walk" | "idle";

const PROMPTS: Record<SpriteType, string> = {
  walk: WALK_SPRITE_PROMPT,
  idle: IDLE_SPRITE_PROMPT,
};

export async function POST(request: NextRequest) {
  try {
    const { characterImageUrl, type = "walk" } = await request.json();

    if (!characterImageUrl) {
      return NextResponse.json({ error: "Character image URL is required" }, { status: 400 });
    }

    const spriteType = (type as SpriteType) || "walk";
    const prompt = PROMPTS[spriteType] || PROMPTS.walk;

    console.log(`[Sprite Sheet] Generating ${spriteType} animation...`);

    // Step 1: Generate sprite sheet
    const result = await fal.subscribe("fal-ai/nano-banana-pro/edit", {
      input: {
        prompt,
        image_urls: [characterImageUrl],
        num_images: 1,
        aspect_ratio: "1:1", // 2x2 grid
        output_format: "png",
        resolution: "1K",
      },
    });

    const data = result.data as {
      images: Array<{ url: string; width: number; height: number }>;
    };

    if (!data.images || data.images.length === 0) {
      console.error("[Sprite Sheet] No sprite sheet generated");
      return NextResponse.json({ error: "No sprite sheet generated" }, { status: 500 });
    }

    const generatedUrl = data.images[0].url;
    console.log("[Sprite Sheet] Generated:", generatedUrl);

    // Step 2: Remove background from sprite sheet
    console.log("[Sprite Sheet] Removing background...");
    try {
      const bgRemoveResult = await fal.subscribe("fal-ai/bria/background/remove", {
        input: {
          image_url: generatedUrl,
        },
      });

      const bgRemoveData = bgRemoveResult.data as {
        image: { url: string; width: number; height: number };
      };

      if (bgRemoveData.image) {
        console.log("[Sprite Sheet] Background removed:", bgRemoveData.image.url);
        return NextResponse.json({
          imageUrl: bgRemoveData.image.url,
          width: bgRemoveData.image.width,
          height: bgRemoveData.image.height,
          type: spriteType,
        });
      }
    } catch (bgError) {
      console.warn("[Sprite Sheet] Background removal failed, using original:", bgError);
    }

    // Fallback to original if background removal fails
    return NextResponse.json({
      imageUrl: generatedUrl,
      width: data.images[0].width,
      height: data.images[0].height,
      type: spriteType,
    });
  } catch (error: unknown) {
    console.error("[Sprite Sheet] Error generating:", error);

    if (error && typeof error === "object" && "body" in error) {
      console.error(
        "[Sprite Sheet] Error body:",
        JSON.stringify((error as { body: unknown }).body, null, 2)
      );
    }

    return NextResponse.json({ error: "Failed to generate sprite sheet" }, { status: 500 });
  }
}
