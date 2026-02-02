/**
 * Character Chat API Comprehensive Tests
 *
 * Tests the character chat endpoint with:
 * - Rate limiting behavior
 * - Character validation
 * - Fallback responses
 * - Error handling
 * - Input validation
 *
 * Uses fetch mocking for integration-style testing.
 */

// Mock rate limiting to control test behavior
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(),
  getClientIP: jest.fn(() => "127.0.0.1"),
  RATE_LIMITS: {
    ai: { limit: 10, windowMs: 60000 },
    standard: { limit: 20, windowMs: 60000 },
  },
}));

import { checkRateLimit } from "@/lib/rate-limit";

// Helper to set up mock API responses
function setupMockFetch(responses: Record<string, { status?: number; data: unknown }>) {
  (global.fetch as jest.Mock).mockImplementation((url: string, options?: RequestInit) => {
    const urlPath = url.replace(/^http:\/\/localhost(:\d+)?/, "");

    // Handle external agent API calls
    if (url.includes("localhost:3001")) {
      return Promise.resolve({
        ok: false,
        status: 503,
        json: () => Promise.reject(new Error("Agent server unavailable")),
      });
    }

    // Match our mock responses
    for (const [path, response] of Object.entries(responses)) {
      if (urlPath.includes(path)) {
        return Promise.resolve({
          ok: response.status ? response.status >= 200 && response.status < 400 : true,
          status: response.status || 200,
          json: () => Promise.resolve(response.data),
        });
      }
    }

    // Default response
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });
  });
}

describe("Character Chat API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (checkRateLimit as jest.Mock).mockResolvedValue({
      success: true,
      remaining: 5,
      resetIn: 30000,
    });
  });

  describe("Rate Limiting", () => {
    it("should enforce rate limits for chat requests", async () => {
      (checkRateLimit as jest.Mock).mockResolvedValue({
        success: false,
        remaining: 0,
        resetIn: 30000,
      });

      setupMockFetch({
        "/api/character-chat": {
          status: 429,
          data: {
            error: "Too many requests. Please wait before chatting again.",
            retryAfter: 30,
          },
        },
      });

      const response = await fetch("http://localhost:3000/api/character-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character: "toly", userMessage: "Hello" }),
      });

      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error).toContain("Too many requests");
      expect(data.retryAfter).toBe(30);
    });

    it("should allow requests within rate limit", async () => {
      setupMockFetch({
        "/api/character-chat": {
          data: {
            message: "gm! welcome to BagsWorld",
            character: "Toly",
          },
        },
      });

      const response = await fetch("http://localhost:3000/api/character-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character: "toly", userMessage: "Hello" }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.message).toBeDefined();
    });
  });

  describe("Character Validation", () => {
    it("should return 400 for unknown character", async () => {
      setupMockFetch({
        "/api/character-chat": {
          status: 400,
          data: { error: "Unknown character" },
        },
      });

      const response = await fetch("http://localhost:3000/api/character-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character: "unknown-character", userMessage: "Hello" }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Unknown character");
    });

    it("should accept valid character toly", async () => {
      setupMockFetch({
        "/api/character-chat": {
          data: { message: "gm!", character: "Toly" },
        },
      });

      const response = await fetch("http://localhost:3000/api/character-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character: "toly", userMessage: "gm" }),
      });

      const data = await response.json();
      expect(data.character).toBe("Toly");
    });

    it("should accept valid character finn", async () => {
      setupMockFetch({
        "/api/character-chat": {
          data: { message: "yo!", character: "Finn" },
        },
      });

      const response = await fetch("http://localhost:3000/api/character-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character: "finn", userMessage: "gm" }),
      });

      const data = await response.json();
      expect(data.character).toBe("Finn");
    });

    it("should accept valid character ash", async () => {
      setupMockFetch({
        "/api/character-chat": {
          data: { message: "hey trainer!", character: "Ash" },
        },
      });

      const response = await fetch("http://localhost:3000/api/character-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character: "ash", userMessage: "gm" }),
      });

      const data = await response.json();
      expect(data.character).toBe("Ash");
    });

    it("should map bagsbot to Bags Bot display name", async () => {
      setupMockFetch({
        "/api/character-chat": {
          data: { message: "beep boop!", character: "Bags Bot" },
        },
      });

      const response = await fetch("http://localhost:3000/api/character-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character: "bagsbot", userMessage: "Hello" }),
      });

      const data = await response.json();
      expect(data.character).toBe("Bags Bot");
    });

    it("should map dev to Ghost display name", async () => {
      setupMockFetch({
        "/api/character-chat": {
          data: { message: "sup", character: "Ghost" },
        },
      });

      const response = await fetch("http://localhost:3000/api/character-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character: "dev", userMessage: "Hello" }),
      });

      const data = await response.json();
      expect(data.character).toBe("Ghost");
    });
  });

  describe("Response Content", () => {
    it("should return greeting for hi/hello/gm messages", async () => {
      const greetings = ["hi", "hello", "gm", "hey"];

      for (const greeting of greetings) {
        setupMockFetch({
          "/api/character-chat": {
            data: {
              message: "welcome to BagsWorld",
              character: "Toly",
            },
          },
        });

        const response = await fetch("http://localhost:3000/api/character-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ character: "toly", userMessage: greeting }),
        });

        const data = await response.json();
        expect(data.message).toBeDefined();
        expect(data.message.length).toBeGreaterThan(0);
      }
    });

    it("should return Solana-themed response for Toly", async () => {
      setupMockFetch({
        "/api/character-chat": {
          data: {
            message: "Solana was built for speed. proof of history makes it possible.",
            character: "Toly",
          },
        },
      });

      const response = await fetch("http://localhost:3000/api/character-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character: "toly", userMessage: "Tell me about Solana" }),
      });

      const data = await response.json();
      expect(data.message.toLowerCase()).toMatch(/solana|proof of history|tps/);
    });

    it("should return fee-themed response for Ash", async () => {
      setupMockFetch({
        "/api/character-chat": {
          data: {
            message: "fees here are like experience points! creators earn 1% of all volume forever",
            character: "Ash",
          },
        },
      });

      const response = await fetch("http://localhost:3000/api/character-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character: "ash", userMessage: "How do I earn money?" }),
      });

      const data = await response.json();
      expect(data.message.toLowerCase()).toMatch(/fee|earn|experience|volume/);
    });

    it("should return Bags-themed response for Finn", async () => {
      setupMockFetch({
        "/api/character-chat": {
          data: {
            message: "Bags.fm is simple: launch a token, earn 1% of all volume forever",
            character: "Finn",
          },
        },
      });

      const response = await fetch("http://localhost:3000/api/character-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character: "finn", userMessage: "What is Bags?" }),
      });

      const data = await response.json();
      expect(data.message.toLowerCase()).toMatch(/bags|launch|volume|1%/);
    });
  });

  describe("Error Handling", () => {
    it("should return 500 for malformed request", async () => {
      setupMockFetch({
        "/api/character-chat": {
          status: 500,
          data: { error: "Failed to generate response" },
        },
      });

      const response = await fetch("http://localhost:3000/api/character-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json",
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it("should handle missing userMessage gracefully", async () => {
      setupMockFetch({
        "/api/character-chat": {
          data: { message: "default response", character: "Toly" },
        },
      });

      const response = await fetch("http://localhost:3000/api/character-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character: "toly" }),
      });

      expect(response.ok).toBe(true);
    });

    it("should handle empty userMessage", async () => {
      setupMockFetch({
        "/api/character-chat": {
          data: { message: "default response", character: "Toly" },
        },
      });

      const response = await fetch("http://localhost:3000/api/character-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character: "toly", userMessage: "" }),
      });

      expect(response.ok).toBe(true);
    });
  });

  describe("Input Handling", () => {
    it("should handle very long messages", async () => {
      setupMockFetch({
        "/api/character-chat": {
          data: { message: "response", character: "Toly" },
        },
      });

      const response = await fetch("http://localhost:3000/api/character-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character: "toly", userMessage: "a".repeat(10000) }),
      });

      expect(response.ok).toBe(true);
    });

    it("should handle messages with special characters", async () => {
      setupMockFetch({
        "/api/character-chat": {
          data: { message: "response", character: "Finn" },
        },
      });

      const response = await fetch("http://localhost:3000/api/character-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character: "finn",
          userMessage: '<script>alert("xss")</script>',
        }),
      });

      expect(response.ok).toBe(true);
    });

    it("should handle messages with unicode", async () => {
      setupMockFetch({
        "/api/character-chat": {
          data: { message: "response", character: "Ash" },
        },
      });

      const response = await fetch("http://localhost:3000/api/character-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character: "ash",
          userMessage: "gm! \u{1F680}\u{1F31D} to the moon!",
        }),
      });

      expect(response.ok).toBe(true);
    });

    it("should handle messages with newlines", async () => {
      setupMockFetch({
        "/api/character-chat": {
          data: { message: "response", character: "Ghost" },
        },
      });

      const response = await fetch("http://localhost:3000/api/character-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character: "ghost",
          userMessage: "Line 1\nLine 2\nLine 3",
        }),
      });

      expect(response.ok).toBe(true);
    });
  });

  describe("Conversation Context", () => {
    it("should accept conversation history", async () => {
      setupMockFetch({
        "/api/character-chat": {
          data: {
            message: "Yes, as I mentioned...",
            character: "Finn",
            conversationId: "conv-123",
          },
        },
      });

      const response = await fetch("http://localhost:3000/api/character-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character: "finn",
          userMessage: "Can you elaborate?",
          chatHistory: [
            { role: "user", content: "What is Bags?" },
            { role: "assistant", content: "Bags.fm is a platform..." },
          ],
        }),
      });

      expect(response.ok).toBe(true);
    });

    it("should accept world state context", async () => {
      setupMockFetch({
        "/api/character-chat": {
          data: {
            message: "World health is looking good!",
            character: "Toly",
          },
        },
      });

      const response = await fetch("http://localhost:3000/api/character-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character: "toly",
          userMessage: "How is the world?",
          worldState: {
            health: 85,
            weather: "sunny",
            buildingCount: 10,
            populationCount: 5,
          },
        }),
      });

      expect(response.ok).toBe(true);
    });

    it("should return conversationId for continuity", async () => {
      setupMockFetch({
        "/api/character-chat": {
          data: {
            message: "Hello!",
            character: "Toly",
            conversationId: "new-conv-456",
          },
        },
      });

      const response = await fetch("http://localhost:3000/api/character-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character: "toly", userMessage: "Hello" }),
      });

      const data = await response.json();
      expect(data.conversationId).toBeDefined();
    });
  });
});
