/**
 * Deep-link handler for Capacitor iOS app.
 *
 * Listens for appUrlOpen events (when another app redirects back to bagsworld://)
 * and routes them to the appropriate handler:
 *   - bagsworld://phantom/*  → Phantom wallet callbacks
 *   - bagsworld://auth/*     → OAuth callbacks (X/Twitter)
 */

"use client";

import { useEffect } from "react";
import { isNativePlatform } from "@/lib/platform";
import { handlePhantomDeepLink } from "@/lib/phantom-deeplink";

export function useDeepLinks() {
  useEffect(() => {
    if (!isNativePlatform()) return;

    let cleanup: (() => void) | undefined;

    async function setupListener() {
      try {
        const { App } = await import("@capacitor/app");

        const listener = await App.addListener("appUrlOpen", (event) => {
          const url = event.url;

          // Route to Phantom deep-link handler
          if (url.startsWith("bagsworld://phantom/")) {
            handlePhantomDeepLink(url);
            return;
          }

          // Route OAuth callbacks
          if (url.startsWith("bagsworld://auth/")) {
            handleOAuthCallback(url);
            return;
          }
        });

        cleanup = () => listener.remove();
      } catch {
        // Capacitor App plugin not available (running in browser)
      }
    }

    setupListener();

    return () => {
      cleanup?.();
    };
  }, []);
}

/**
 * Handle OAuth callback deep-links.
 * Extracts auth params and redirects to the appropriate page.
 */
function handleOAuthCallback(url: string) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;

    if (path.includes("x/callback")) {
      // X/Twitter OAuth callback — reconstruct as a web URL and navigate
      const code = parsed.searchParams.get("code");
      const state = parsed.searchParams.get("state");
      if (code && state) {
        window.location.href = `/api/auth/x/callback?code=${code}&state=${state}`;
      }
    }
  } catch {
    // Invalid URL, ignore
  }
}
