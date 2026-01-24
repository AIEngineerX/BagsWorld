/**
 * Simple in-memory rate limiter for serverless functions
 *
 * Note: This resets on cold starts. For distributed rate limiting,
 * use Redis (Upstash) or put Cloudflare in front.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (resets on cold start)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries periodically
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60000; // 1 minute

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
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
 */
export function checkRateLimit(identifier: string, config: RateLimitConfig): RateLimitResult {
  cleanup();

  const now = Date.now();
  const key = identifier;
  const entry = rateLimitStore.get(key);

  // No existing entry or window expired
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, {
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
