// Rate limiter: uses Neon PostgreSQL when configured, falls back to in-memory.

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
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetIn: number;
}

export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  if (isNeonConfigured()) {
    const now = Date.now();
    if (now - lastDbCleanup > DB_CLEANUP_INTERVAL) {
      lastDbCleanup = now;
      cleanupExpiredRateLimits().catch(() => {});
    }

    return await checkDistributedRateLimit(identifier, config.limit, config.windowMs);
  }

  return checkRateLimitInMemory(identifier, config);
}

function checkRateLimitInMemory(identifier: string, config: RateLimitConfig): RateLimitResult {
  cleanupInMemory();

  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

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

  if (entry.count < config.limit) {
    entry.count++;
    return {
      success: true,
      remaining: config.limit - entry.count,
      resetIn: Math.max(0, entry.resetTime - now),
    };
  }

  return {
    success: false,
    remaining: 0,
    resetIn: Math.max(0, entry.resetTime - now),
  };
}

/** @deprecated Use async checkRateLimit() instead. */
export function checkRateLimitSync(identifier: string, config: RateLimitConfig): RateLimitResult {
  return checkRateLimitInMemory(identifier, config);
}

export function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  return "unknown";
}

export const RATE_LIMITS = {
  strict: { limit: 5, windowMs: 60000 },
  standard: { limit: 30, windowMs: 60000 },
  relaxed: { limit: 100, windowMs: 60000 },
  ai: { limit: 10, windowMs: 60000 },
} as const;
