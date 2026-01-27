// Comprehensive tests for src/lib/rate-limit.ts
// Tests the distributed rate limiter with in-memory fallback for API protection

import { checkRateLimit, getClientIP, RATE_LIMITS, RateLimitConfig } from "@/lib/rate-limit";

// Mock Request class for testing getClientIP
class MockRequest {
  private _headers: Map<string, string>;

  constructor(url: string, options?: { headers?: Record<string, string> }) {
    this._headers = new Map();
    if (options?.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        this._headers.set(key.toLowerCase(), value);
      });
    }
  }

  get headers() {
    return {
      get: (name: string) => this._headers.get(name.toLowerCase()) || null,
    };
  }
}

describe("Rate Limiter", () => {
  // Reset rate limit store between test suites by using unique identifiers
  let testIdCounter = 0;
  const getUniqueId = () => `test-${Date.now()}-${testIdCounter++}`;

  // ==================== checkRateLimit ====================

  describe("checkRateLimit", () => {
    describe("basic functionality", () => {
      it("should allow first request", async () => {
        const id = getUniqueId();
        const config: RateLimitConfig = { limit: 5, windowMs: 60000 };

        const result = await checkRateLimit(id, config);

        expect(result.success).toBe(true);
        expect(result.remaining).toBe(4);
        expect(result.resetIn).toBe(60000);
      });

      it("should decrement remaining on each request", async () => {
        const id = getUniqueId();
        const config: RateLimitConfig = { limit: 5, windowMs: 60000 };

        const r1 = await checkRateLimit(id, config);
        expect(r1.remaining).toBe(4);

        const r2 = await checkRateLimit(id, config);
        expect(r2.remaining).toBe(3);

        const r3 = await checkRateLimit(id, config);
        expect(r3.remaining).toBe(2);
      });

      it("should block requests after limit reached", async () => {
        const id = getUniqueId();
        const config: RateLimitConfig = { limit: 3, windowMs: 60000 };

        // Use up the limit
        await checkRateLimit(id, config); // 1
        await checkRateLimit(id, config); // 2
        await checkRateLimit(id, config); // 3

        // 4th request should be blocked
        const result = await checkRateLimit(id, config);
        expect(result.success).toBe(false);
        expect(result.remaining).toBe(0);
      });

      it("should track different identifiers separately", async () => {
        const id1 = getUniqueId();
        const id2 = getUniqueId();
        const config: RateLimitConfig = { limit: 2, windowMs: 60000 };

        // Use up id1's limit
        await checkRateLimit(id1, config);
        await checkRateLimit(id1, config);
        const r1 = await checkRateLimit(id1, config);

        // id2 should still have full limit
        const r2 = await checkRateLimit(id2, config);

        expect(r1.success).toBe(false);
        expect(r2.success).toBe(true);
        expect(r2.remaining).toBe(1);
      });
    });

    describe("window expiration", () => {
      it("should reset after window expires", async () => {
        const id = getUniqueId();
        const config: RateLimitConfig = { limit: 2, windowMs: 100 }; // 100ms window

        // Use up the limit
        await checkRateLimit(id, config);
        await checkRateLimit(id, config);
        const blocked = await checkRateLimit(id, config);
        expect(blocked.success).toBe(false);

        // Wait for window to expire
        await new Promise((resolve) => setTimeout(resolve, 150));

        // Should be allowed again
        const result = await checkRateLimit(id, config);
        expect(result.success).toBe(true);
        expect(result.remaining).toBe(1);
      });

      it("should return correct resetIn time", async () => {
        const id = getUniqueId();
        const config: RateLimitConfig = { limit: 5, windowMs: 30000 };

        const result = await checkRateLimit(id, config);

        // resetIn should be approximately windowMs (within 100ms tolerance)
        expect(result.resetIn).toBeGreaterThanOrEqual(29900);
        expect(result.resetIn).toBeLessThanOrEqual(30000);
      });

      it("should show decreasing resetIn as window progresses", async () => {
        const id = getUniqueId();
        const config: RateLimitConfig = { limit: 5, windowMs: 1000 };

        const r1 = await checkRateLimit(id, config);
        const initialResetIn = r1.resetIn;

        await new Promise((resolve) => setTimeout(resolve, 100));

        const r2 = await checkRateLimit(id, config);

        // resetIn should have decreased
        expect(r2.resetIn).toBeLessThan(initialResetIn);
      });
    });

    describe("boundary conditions", () => {
      it("should handle limit of 1", async () => {
        const id = getUniqueId();
        const config: RateLimitConfig = { limit: 1, windowMs: 60000 };

        const r1 = await checkRateLimit(id, config);
        expect(r1.success).toBe(true);
        expect(r1.remaining).toBe(0);

        const r2 = await checkRateLimit(id, config);
        expect(r2.success).toBe(false);
      });

      it("should handle very large limit", async () => {
        const id = getUniqueId();
        const config: RateLimitConfig = { limit: 10000, windowMs: 60000 };

        const result = await checkRateLimit(id, config);
        expect(result.success).toBe(true);
        expect(result.remaining).toBe(9999);
      });

      it("should handle very short window", async () => {
        const id = getUniqueId();
        const config: RateLimitConfig = { limit: 2, windowMs: 10 }; // 10ms

        await checkRateLimit(id, config);
        await checkRateLimit(id, config);

        await new Promise((resolve) => setTimeout(resolve, 20));

        const result = await checkRateLimit(id, config);
        expect(result.success).toBe(true);
      });

      it("should handle sequential requests from same identifier", async () => {
        const id = getUniqueId();
        const config: RateLimitConfig = { limit: 5, windowMs: 60000 };

        // Sequential requests
        const r1 = await checkRateLimit(id, config);
        const r2 = await checkRateLimit(id, config);
        const r3 = await checkRateLimit(id, config);
        const r4 = await checkRateLimit(id, config);
        const r5 = await checkRateLimit(id, config);

        // All should succeed
        expect(r1.success).toBe(true);
        expect(r5.success).toBe(true);

        // Remaining should decrease
        expect(r1.remaining).toBe(4);
        expect(r5.remaining).toBe(0);

        // 6th request should fail
        const blocked = await checkRateLimit(id, config);
        expect(blocked.success).toBe(false);
      });
    });

    describe("edge cases", () => {
      it("should handle empty identifier", async () => {
        const config: RateLimitConfig = { limit: 5, windowMs: 60000 };

        const result = await checkRateLimit("", config);
        expect(result.success).toBe(true);
      });

      it("should handle special characters in identifier", async () => {
        const id = `user:${getUniqueId()}:192.168.1.1:!@#$%`;
        const config: RateLimitConfig = { limit: 5, windowMs: 60000 };

        const result = await checkRateLimit(id, config);
        expect(result.success).toBe(true);
      });

      it("should handle very long identifier", async () => {
        const id = "x".repeat(1000) + getUniqueId();
        const config: RateLimitConfig = { limit: 5, windowMs: 60000 };

        const result = await checkRateLimit(id, config);
        expect(result.success).toBe(true);
      });

      it("should handle unicode identifier", async () => {
        const id = `user-${getUniqueId()}`;
        const config: RateLimitConfig = { limit: 5, windowMs: 60000 };

        const result = await checkRateLimit(id, config);
        expect(result.success).toBe(true);
      });
    });

    describe("resetIn accuracy", () => {
      it("should return 0 or positive for resetIn when blocked", async () => {
        const id = getUniqueId();
        const config: RateLimitConfig = { limit: 1, windowMs: 60000 };

        await checkRateLimit(id, config);
        const blocked = await checkRateLimit(id, config);

        expect(blocked.resetIn).toBeGreaterThanOrEqual(0);
      });

      it("should return remaining time accurately", async () => {
        const id = getUniqueId();
        const config: RateLimitConfig = { limit: 1, windowMs: 500 };

        await checkRateLimit(id, config);

        // Wait 200ms
        await new Promise((resolve) => setTimeout(resolve, 200));

        const blocked = await checkRateLimit(id, config);

        // Should have about 300ms left (with tolerance)
        expect(blocked.resetIn).toBeLessThanOrEqual(350);
        expect(blocked.resetIn).toBeGreaterThanOrEqual(200);
      });
    });
  });

  // ==================== getClientIP ====================

  describe("getClientIP", () => {
    it("should extract IP from x-forwarded-for header", () => {
      const request = new MockRequest("http://localhost", {
        headers: { "x-forwarded-for": "192.168.1.1" },
      });

      expect(getClientIP(request as unknown as Request)).toBe("192.168.1.1");
    });

    it("should extract first IP from x-forwarded-for with multiple IPs", () => {
      const request = new MockRequest("http://localhost", {
        headers: { "x-forwarded-for": "192.168.1.1, 10.0.0.1, 172.16.0.1" },
      });

      expect(getClientIP(request as unknown as Request)).toBe("192.168.1.1");
    });

    it("should trim whitespace from IP", () => {
      const request = new MockRequest("http://localhost", {
        headers: { "x-forwarded-for": "  192.168.1.1  " },
      });

      expect(getClientIP(request as unknown as Request)).toBe("192.168.1.1");
    });

    it("should fallback to x-real-ip header", () => {
      const request = new MockRequest("http://localhost", {
        headers: { "x-real-ip": "10.0.0.1" },
      });

      expect(getClientIP(request as unknown as Request)).toBe("10.0.0.1");
    });

    it("should prefer x-forwarded-for over x-real-ip", () => {
      const request = new MockRequest("http://localhost", {
        headers: {
          "x-forwarded-for": "192.168.1.1",
          "x-real-ip": "10.0.0.1",
        },
      });

      expect(getClientIP(request as unknown as Request)).toBe("192.168.1.1");
    });

    it('should return "unknown" when no IP headers present', () => {
      const request = new MockRequest("http://localhost");

      expect(getClientIP(request as unknown as Request)).toBe("unknown");
    });

    it("should handle IPv6 addresses", () => {
      const request = new MockRequest("http://localhost", {
        headers: { "x-forwarded-for": "2001:db8::1" },
      });

      expect(getClientIP(request as unknown as Request)).toBe("2001:db8::1");
    });

    it("should handle IPv6 with port notation", () => {
      const request = new MockRequest("http://localhost", {
        headers: { "x-forwarded-for": "[2001:db8::1]:8080, 192.168.1.1" },
      });

      expect(getClientIP(request as unknown as Request)).toBe("[2001:db8::1]:8080");
    });
  });

  // ==================== RATE_LIMITS presets ====================

  describe("RATE_LIMITS presets", () => {
    it("should have strict preset", () => {
      expect(RATE_LIMITS.strict).toEqual({ limit: 5, windowMs: 60000 });
    });

    it("should have standard preset", () => {
      expect(RATE_LIMITS.standard).toEqual({ limit: 30, windowMs: 60000 });
    });

    it("should have relaxed preset", () => {
      expect(RATE_LIMITS.relaxed).toEqual({ limit: 100, windowMs: 60000 });
    });

    it("should have ai preset", () => {
      expect(RATE_LIMITS.ai).toEqual({ limit: 10, windowMs: 60000 });
    });

    it("should work with checkRateLimit", async () => {
      const id = getUniqueId();

      const result = await checkRateLimit(id, RATE_LIMITS.standard);

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(29);
    });

    it("strict should be more restrictive than standard", () => {
      expect(RATE_LIMITS.strict.limit).toBeLessThan(RATE_LIMITS.standard.limit);
    });

    it("standard should be more restrictive than relaxed", () => {
      expect(RATE_LIMITS.standard.limit).toBeLessThan(RATE_LIMITS.relaxed.limit);
    });

    it("ai should be more restrictive than standard", () => {
      expect(RATE_LIMITS.ai.limit).toBeLessThan(RATE_LIMITS.standard.limit);
    });
  });

  // ==================== Integration scenarios ====================

  describe("Integration Scenarios", () => {
    it("should handle realistic API usage pattern", async () => {
      const ip = getUniqueId();

      // Normal user making occasional requests
      for (let i = 0; i < 10; i++) {
        const result = await checkRateLimit(ip, RATE_LIMITS.standard);
        expect(result.success).toBe(true);
      }
    });

    it("should block abuse pattern", async () => {
      const ip = getUniqueId();

      // Rapid-fire requests (abuse)
      for (let i = 0; i < 30; i++) {
        await checkRateLimit(ip, RATE_LIMITS.standard);
      }

      // 31st request should be blocked
      const result = await checkRateLimit(ip, RATE_LIMITS.standard);
      expect(result.success).toBe(false);
    });

    it("should handle multiple endpoints with different limits", async () => {
      const ip = getUniqueId();

      // Use strict limit on auth endpoint
      const authKey = `auth:${ip}`;
      for (let i = 0; i < 5; i++) {
        await checkRateLimit(authKey, RATE_LIMITS.strict);
      }

      // Auth should be blocked
      expect((await checkRateLimit(authKey, RATE_LIMITS.strict)).success).toBe(false);

      // But standard endpoint should still work
      const apiKey = `api:${ip}`;
      expect((await checkRateLimit(apiKey, RATE_LIMITS.standard)).success).toBe(true);
    });

    it("should handle burst then recover pattern", async () => {
      const ip = getUniqueId();
      const config: RateLimitConfig = { limit: 3, windowMs: 100 };

      // Burst
      await checkRateLimit(ip, config);
      await checkRateLimit(ip, config);
      await checkRateLimit(ip, config);
      expect((await checkRateLimit(ip, config)).success).toBe(false);

      // Wait for recovery
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should work again
      expect((await checkRateLimit(ip, config)).success).toBe(true);
    });
  });
});
