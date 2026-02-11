/**
 * Distributed Rate Limiter for Serverless Functions
 *
 * Uses Neon PostgreSQL for persistent rate limiting that survives cold starts.
 * Falls back to in-memory rate limiting for local development or when DB is unavailable.
 */

import { isNeonConfigured, checkDistributedRateLimit, cleanupExpiredRateLimits } from "./neon";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (fallback for local development)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup tracking
let lastInMemoryCleanup = Date.now();
const IN_MEMORY_CLEANUP_INTERVAL = 60000; // 1 minute

// Database cleanup tracking (lazy cleanup)
let lastDbCleanup = Date.now();
const DB_CLEANUP_INTERVAL = 300000; // 5 minutes

/**
 * Clean up expired in-memory entries
 */
function cleanupInMemory(): void {
  const now = Date.now();
  if (now - lastInMemoryCleanup < IN_MEMORY_CLEANUP_INTERVAL) return;

  lastInMemoryCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

export interface RateLimitConfig {
  /** Max requests allowed in the window */
  limit: number;
  /** Time window in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetIn: number;
}

/**
 * Check rate limit for a given identifier (IP, wallet, etc.)
 *
 * Uses distributed (database) rate limiting when Neon is configured,
 * falls back to in-memory for local development.
 *
 * @param identifier - Unique key for rate limiting (e.g., "endpoint:ip")
 * @param config - Rate limit configuration
 * @returns Promise with rate limit result
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  // Use distributed rate limiting if Neon is configured
  if (isNeonConfigured()) {
    // Trigger lazy cleanup periodically (fire and forget)
    const now = Date.now();
    if (now - lastDbCleanup > DB_CLEANUP_INTERVAL) {
      lastDbCleanup = now;
      cleanupExpiredRateLimits().catch(() => {
        // Ignore cleanup errors - non-critical
      });
    }

    return await checkDistributedRateLimit(identifier, config.limit, config.windowMs);
  }

  // Fall back to in-memory for local development
  return checkRateLimitInMemory(identifier, config);
}

/**
 * In-memory rate limit check (for local development)
 *
 * Note: Resets on cold starts. Only use for development.
 */
function checkRateLimitInMemory(identifier: string, config: RateLimitConfig): RateLimitResult {
  cleanupInMemory();

  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // No existing entry or window expired
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return {
      success: true,
      remaining: config.limit - 1,
      resetIn: config.windowMs,
    };
  }

  // Within window
  if (entry.count < config.limit) {
    entry.count++;
    return {
      success: true,
      remaining: config.limit - entry.count,
      resetIn: Math.max(0, entry.resetTime - now),
    };
  }

  // Rate limited
  return {
    success: false,
    remaining: 0,
    resetIn: Math.max(0, entry.resetTime - now),
  };
}

/**
 * Synchronous in-memory rate limit check.
 *
 * Only for use in contexts where async is not possible.
 * Does NOT use distributed rate limiting.
 *
 * @deprecated Prefer async checkRateLimit() for production use
 */
export function checkRateLimitSync(identifier: string, config: RateLimitConfig): RateLimitResult {
  return checkRateLimitInMemory(identifier, config);
}

/**
 * Get client IP from request headers
 */
export function getClientIP(request: Request): string {
  // Netlify/Vercel set these headers
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  // Fallback
  return "unknown";
}

// Pre-configured rate limiters for different endpoints
export const RATE_LIMITS = {
  // Strict: Auth endpoints, expensive operations
  strict: { limit: 5, windowMs: 60000 }, // 5 per minute

  // Standard: Most API endpoints
  standard: { limit: 30, windowMs: 60000 }, // 30 per minute

  // Relaxed: Read-only endpoints
  relaxed: { limit: 100, windowMs: 60000 }, // 100 per minute

  // AI: Expensive AI operations
  ai: { limit: 10, windowMs: 60000 }, // 10 per minute
} as const;
