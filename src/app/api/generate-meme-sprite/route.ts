import { fal } from "@fal-ai/client";
import { NextRequest, NextResponse } from "next/server";

// Configure fal client with API key from environment
fal.config({
  credentials: process.env.FAL_KEY,
});

const CHARACTER_STYLE_PROMPT = `Generate a single character only, centered in the frame on a plain white background.
The character should be rendered in detailed 32-bit pixel art style (like PlayStation 1 / SNES era games).
Include proper shading, highlights, and anti-aliased edges for a polished look.
The character should have well-defined features, expressive details, and rich colors.
Show FULL BODY from head to feet in a front-facing or 3/4 view pose, standing idle.
No background elements, props, or other characters.`;

export async function POST(request: NextRequest) {
  if (!process.env.FAL_KEY) {
    return NextResponse.json(
      { error: "AI sprite generation is not configured. Use a default sprite instead." },
      { status: 503 }
    );
  }

  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Build the full prompt for meme character generation
    const fullPrompt = `${prompt} meme character. ${CHARACTER_STYLE_PROMPT}`;

    console.log("[Meme Sprite] Generating with nano-banana-pro:", prompt);

    // Step 1: Generate character with nano-banana-pro (better for pixel art)
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
      console.error("[Meme Sprite] No image generated");
      return NextResponse.json({ error: "No image generated" }, { status: 500 });
    }

    const generatedImageUrl = generateData.images[0].url;
    console.log("[Meme Sprite] Character generated:", generatedImageUrl);

    // Step 2: Remove background with Bria
    console.log("[Meme Sprite] Removing background...");
    const bgRemoveResult = await fal.subscribe("fal-ai/bria/background/remove", {
      input: {
        image_url: generatedImageUrl,
      },
    });

    const bgRemoveData = bgRemoveResult.data as {
      image: { url: string; width: number; height: number };
    };

    if (!bgRemoveData.image) {
      // Fall back to original image if bg removal fails
      console.warn("[Meme Sprite] Background removal failed, using original");
      return NextResponse.json({
        imageUrl: generatedImageUrl,
        width: generateData.images[0].width,
        height: generateData.images[0].height,
      });
    }

    console.log("[Meme Sprite] Generated successfully:", bgRemoveData.image.url);

    return NextResponse.json({
      imageUrl: bgRemoveData.image.url,
      width: bgRemoveData.image.width,
      height: bgRemoveData.image.height,
    });
  } catch (error: unknown) {
    console.error("[Meme Sprite] Error generating:", error);

    // Log full error details for debugging
    if (error && typeof error === "object" && "body" in error) {
      console.error(
        "[Meme Sprite] Error body:",
        JSON.stringify((error as { body: unknown }).body, null, 2)
      );
    }

    return NextResponse.json(
      { error: "Failed to generate sprite. Try a simpler prompt." },
      { status: 500 }
    );
  }
}
