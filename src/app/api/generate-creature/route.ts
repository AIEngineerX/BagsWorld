import { fal } from "@fal-ai/client";
import { NextRequest, NextResponse } from "next/server";

fal.config({
  credentials: process.env.FAL_KEY,
});

const CREATURE_STYLE_PROMPT = `Generate a single creature only, centered in the frame on a plain white background.
The creature should be rendered in 16-bit pixel art style (like SNES / Game Boy Advance era).
Use bold outlines, flat shading, and a limited color palette for authentic retro feel.
Show the FULL BODY in a front-facing or 3/4 view idle pose.
No background elements, props, or other characters.`;

export async function POST(request: NextRequest) {
  if (!process.env.FAL_KEY) {
    return NextResponse.json(
      { error: "AI creature generation is not configured." },
      { status: 503 }
    );
  }

  try {
    const { zone, creatureType, creatureName } = await request.json();

    if (!creatureName) {
      return NextResponse.json({ error: "creatureName is required" }, { status: 400 });
    }

    const fullPrompt = `A ${creatureName}, a cute ${creatureType || "fantasy"} creature. ${CREATURE_STYLE_PROMPT}`;

    console.log("[Creature Gen] Generating:", creatureName);

    // Step 1: Generate creature image
    const generateResult = await fal.subscribe("fal-ai/nano-banana-pro", {
      input: {
        prompt: fullPrompt,
        num_images: 1,
        aspect_ratio: "1:1",
        output_format: "png",
        resolution: "1K",
      },
    });

    const generateData = generateResult.data as {
      images: Array<{ url: string; width: number; height: number }>;
    };

    if (!generateData.images || generateData.images.length === 0) {
      console.error("[Creature Gen] No image generated");
      return NextResponse.json({ error: "No image generated" }, { status: 500 });
    }

    const generatedImageUrl = generateData.images[0].url;

    // Step 2: Remove background
    console.log("[Creature Gen] Removing background...");
    const bgRemoveResult = await fal.subscribe("fal-ai/bria/background/remove", {
      input: {
        image_url: generatedImageUrl,
      },
    });

    const bgRemoveData = bgRemoveResult.data as {
      image: { url: string; width: number; height: number };
    };

    if (!bgRemoveData.image) {
      console.warn("[Creature Gen] Background removal failed, using original");
      return NextResponse.json({
        imageUrl: generatedImageUrl,
        zone,
        creatureType,
      });
    }

    console.log("[Creature Gen] Generated successfully:", bgRemoveData.image.url);

    return NextResponse.json({
      imageUrl: bgRemoveData.image.url,
      zone,
      creatureType,
    });
  } catch (error: unknown) {
    console.error("[Creature Gen] Error:", error);

    if (error && typeof error === "object" && "body" in error) {
      console.error(
        "[Creature Gen] Error body:",
        JSON.stringify((error as { body: unknown }).body, null, 2)
      );
    }

    return NextResponse.json(
      { error: "Failed to generate creature sprite." },
      { status: 500 }
    );
  }
}
