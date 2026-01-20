// Server-side singleton for BagsApiClient
// Use this in API routes and server-side code instead of creating separate instances

import { BagsApiClient } from "./bags-api";

let serverApiClient: BagsApiClient | null = null;

/**
 * Get the server-side BagsApiClient singleton.
 * Throws an error if BAGS_API_KEY is not configured.
 */
export function getServerBagsApi(): BagsApiClient {
  if (!serverApiClient) {
    const apiKey = process.env.BAGS_API_KEY;
    if (!apiKey) {
      throw new Error("BAGS_API_KEY environment variable not set");
    }
    serverApiClient = new BagsApiClient(apiKey);
  }
  return serverApiClient;
}

/**
 * Check if the Bags API is configured (has API key).
 * Use this for graceful handling when API is optional.
 */
export function isServerBagsApiConfigured(): boolean {
  return !!process.env.BAGS_API_KEY;
}

/**
 * Get the server-side BagsApiClient singleton, or null if not configured.
 * Use this when you want to handle missing API key gracefully.
 */
export function getServerBagsApiOrNull(): BagsApiClient | null {
  if (!process.env.BAGS_API_KEY) {
    return null;
  }
  return getServerBagsApi();
}
