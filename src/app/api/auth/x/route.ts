import { NextResponse } from "next/server";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  buildXAuthUrl,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
} from "@/lib/x-oauth";

export async function GET() {
  try {
    const clientId = process.env.X_CLIENT_ID;
    const redirectUri = process.env.NEXT_PUBLIC_X_CALLBACK_URL;

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { error: "X OAuth not configured. Set X_CLIENT_ID and NEXT_PUBLIC_X_CALLBACK_URL." },
        { status: 500 }
      );
    }

    // Generate PKCE values
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateState();

    // Build authorization URL
    const authUrl = buildXAuthUrl({
      clientId,
      redirectUri,
      state,
      codeChallenge,
    });

    // Create response with auth URL
    const response = NextResponse.json({ authUrl });

    // Store state and verifier in HTTP-only cookies (secure, short-lived)
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 600, // 10 minutes
      path: "/",
    };

    response.cookies.set(OAUTH_STATE_COOKIE, state, cookieOptions);
    response.cookies.set(OAUTH_VERIFIER_COOKIE, codeVerifier, cookieOptions);

    return response;
  } catch (error) {
    console.error("X OAuth init error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to initialize OAuth" },
      { status: 500 }
    );
  }
}
