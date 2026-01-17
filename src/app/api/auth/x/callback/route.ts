import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  fetchXUserInfo,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
} from "@/lib/x-oauth";

// Force dynamic rendering for OAuth callback
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    // Handle OAuth errors
    if (error) {
      const errorMessage = errorDescription || error;
      return redirectToCallback({ error: errorMessage }, request);
    }

    // Validate required parameters
    if (!code || !state) {
      return redirectToCallback({ error: "Missing authorization code or state" }, request);
    }

    // Retrieve stored state and verifier from cookies
    const storedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
    const codeVerifier = request.cookies.get(OAUTH_VERIFIER_COOKIE)?.value;

    // Verify state matches (CSRF protection)
    if (!storedState || state !== storedState) {
      return redirectToCallback({ error: "Invalid state parameter" }, request);
    }

    if (!codeVerifier) {
      return redirectToCallback({ error: "Missing code verifier" }, request);
    }

    // Get environment variables
    const clientId = process.env.X_CLIENT_ID;
    const clientSecret = process.env.X_CLIENT_SECRET;
    const redirectUri = process.env.NEXT_PUBLIC_X_CALLBACK_URL;

    if (!clientId || !clientSecret || !redirectUri) {
      return redirectToCallback({ error: "X OAuth not configured" }, request);
    }

    // Exchange code for access token
    const tokenResponse = await exchangeCodeForToken({
      code,
      codeVerifier,
      clientId,
      clientSecret,
      redirectUri,
    });

    // Fetch user info
    const userInfo = await fetchXUserInfo(tokenResponse.access_token);

    // Redirect to client callback page with username
    const response = redirectToCallback({
      username: userInfo.username,
      name: userInfo.name,
      profileImage: userInfo.profile_image_url,
    }, request);

    // Clear OAuth cookies
    response.cookies.delete(OAUTH_STATE_COOKIE);
    response.cookies.delete(OAUTH_VERIFIER_COOKIE);

    return response;
  } catch (error) {
    console.error("X OAuth callback error:", error);
    return redirectToCallback({
      error: error instanceof Error ? error.message : "OAuth callback failed",
    }, request);
  }
}

function redirectToCallback(
  params: {
    username?: string;
    name?: string;
    profileImage?: string;
    error?: string;
  },
  request?: NextRequest
): NextResponse {
  // Get base URL from callback URL or request
  let baseUrl = process.env.NEXT_PUBLIC_X_CALLBACK_URL?.replace("/api/auth/x/callback", "");

  if (!baseUrl && request) {
    // Fallback to request origin
    baseUrl = request.nextUrl.origin;
  }

  if (!baseUrl) {
    // Final fallback - should not happen in production
    baseUrl = "http://localhost:3000";
  }

  const callbackUrl = new URL("/auth/x/callback", baseUrl);

  if (params.username) {
    callbackUrl.searchParams.set("username", params.username);
  }
  if (params.name) {
    callbackUrl.searchParams.set("name", params.name);
  }
  if (params.profileImage) {
    callbackUrl.searchParams.set("profile_image", params.profileImage);
  }
  if (params.error) {
    callbackUrl.searchParams.set("error", params.error);
  }

  return NextResponse.redirect(callbackUrl);
}
