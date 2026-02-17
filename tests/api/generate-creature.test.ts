// Tests for POST /api/generate-creature

jest.mock("@fal-ai/client", () => ({
  fal: {
    config: jest.fn(),
    subscribe: jest.fn(),
  },
}));

import { fal } from "@fal-ai/client";

// Must import AFTER mocking
const mockSubscribe = fal.subscribe as jest.Mock;

jest.mock("next/server", () => {
  const originalModule = jest.requireActual("next/server");
  return {
    ...originalModule,
    NextResponse: {
      json: (data: unknown, init?: { status?: number }) => ({
        json: () => Promise.resolve(data),
        status: init?.status || 200,
      }),
    },
  };
});

class MockNextRequest {
  private _body: string;
  url: string;
  method: string;
  headers: Map<string, string>;

  constructor(body: Record<string, unknown>) {
    this.url = "http://localhost/api/generate-creature";
    this.method = "POST";
    this._body = JSON.stringify(body);
    this.headers = new Map([["content-type", "application/json"]]);
  }

  async json() {
    return JSON.parse(this._body);
  }
}

import { POST } from "@/app/api/generate-creature/route";

describe("POST /api/generate-creature", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, FAL_KEY: "test-fal-key-123" };

    // Default: successful generation + background removal
    mockSubscribe.mockImplementation((model: string) => {
      if (model === "fal-ai/nano-banana-pro") {
        return Promise.resolve({
          data: {
            images: [{ url: "https://fal.ai/generated-image.png", width: 512, height: 512 }],
          },
        });
      }
      if (model === "fal-ai/bria/background/remove") {
        return Promise.resolve({
          data: {
            image: { url: "https://fal.ai/transparent-image.png", width: 512, height: 512 },
          },
        });
      }
      return Promise.reject(new Error("Unknown model"));
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("missing configuration", () => {
    it("returns 503 when FAL_KEY is not set", async () => {
      delete process.env.FAL_KEY;
      const req = new MockNextRequest({ creatureName: "Test Crab", zone: "moltbook" });
      const res = await POST(req as any);
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error).toContain("not configured");
    });
  });

  describe("input validation", () => {
    it("returns 400 when creatureName is missing", async () => {
      const req = new MockNextRequest({ zone: "moltbook" });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("creatureName");
    });

    it("returns 400 when creatureName is empty string", async () => {
      const req = new MockNextRequest({ creatureName: "", zone: "moltbook" });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
    });
  });

  describe("prompt injection sanitization", () => {
    it("strips special characters from creatureName", async () => {
      const req = new MockNextRequest({
        creatureName: "evil<script>alert('xss')</script>crab",
        zone: "moltbook",
        creatureType: "aquatic",
      });
      await POST(req as any);

      const firstCall = mockSubscribe.mock.calls[0];
      const prompt = firstCall[1].input.prompt;
      expect(prompt).not.toContain("<script>");
      expect(prompt).not.toContain("'");
      expect(prompt).toContain("evilscriptalertxssscriptcrab"); // Stripped to alphanumeric+space+dash
    });

    it("truncates long creatureName to 40 chars", async () => {
      const longName = "A".repeat(100);
      const req = new MockNextRequest({
        creatureName: longName,
        zone: "moltbook",
      });
      await POST(req as any);

      const firstCall = mockSubscribe.mock.calls[0];
      const prompt = firstCall[1].input.prompt;
      expect(prompt).toContain("A".repeat(40));
      expect(prompt).not.toContain("A".repeat(41));
    });

    it("truncates creatureType to 20 chars", async () => {
      const longType = "B".repeat(50);
      const req = new MockNextRequest({
        creatureName: "TestCrab",
        zone: "moltbook",
        creatureType: longType,
      });
      await POST(req as any);

      const firstCall = mockSubscribe.mock.calls[0];
      const prompt = firstCall[1].input.prompt;
      expect(prompt).toContain("B".repeat(20));
      expect(prompt).not.toContain("B".repeat(21));
    });

    it("defaults creatureType to 'fantasy' when not provided", async () => {
      const req = new MockNextRequest({
        creatureName: "TestCrab",
        zone: "moltbook",
      });
      await POST(req as any);

      const firstCall = mockSubscribe.mock.calls[0];
      const prompt = firstCall[1].input.prompt;
      expect(prompt).toContain("fantasy");
    });
  });

  describe("successful generation", () => {
    it("returns 200 with imageUrl after generation + bg removal", async () => {
      const req = new MockNextRequest({
        creatureName: "Beach Crab",
        zone: "moltbook",
        creatureType: "aquatic",
      });
      const res = await POST(req as any);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.imageUrl).toBe("https://fal.ai/transparent-image.png");
      expect(body.zone).toBe("moltbook");
      expect(body.creatureType).toBe("aquatic");
    });

    it("calls nano-banana-pro first, then bria bg removal", async () => {
      const req = new MockNextRequest({
        creatureName: "TestCrab",
        zone: "moltbook",
      });
      await POST(req as any);

      expect(mockSubscribe).toHaveBeenCalledTimes(2);
      expect(mockSubscribe.mock.calls[0][0]).toBe("fal-ai/nano-banana-pro");
      expect(mockSubscribe.mock.calls[1][0]).toBe("fal-ai/bria/background/remove");
    });

    it("passes generated image URL to bg removal step", async () => {
      const req = new MockNextRequest({
        creatureName: "TestCrab",
        zone: "moltbook",
      });
      await POST(req as any);

      const bgRemoveCall = mockSubscribe.mock.calls[1];
      expect(bgRemoveCall[1].input.image_url).toBe("https://fal.ai/generated-image.png");
    });
  });

  describe("fallback when bg removal fails", () => {
    it("returns original image URL when bg removal returns no image", async () => {
      mockSubscribe.mockImplementation((model: string) => {
        if (model === "fal-ai/nano-banana-pro") {
          return Promise.resolve({
            data: {
              images: [{ url: "https://fal.ai/original.png", width: 512, height: 512 }],
            },
          });
        }
        return Promise.resolve({ data: { image: null } });
      });

      const req = new MockNextRequest({
        creatureName: "TestCrab",
        zone: "moltbook",
      });
      const res = await POST(req as any);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.imageUrl).toBe("https://fal.ai/original.png");
    });
  });

  describe("generation failures", () => {
    it("returns 500 when image generation returns empty images", async () => {
      mockSubscribe.mockImplementation((model: string) => {
        if (model === "fal-ai/nano-banana-pro") {
          return Promise.resolve({ data: { images: [] } });
        }
        return Promise.resolve({ data: {} });
      });

      const req = new MockNextRequest({
        creatureName: "TestCrab",
        zone: "moltbook",
      });
      const res = await POST(req as any);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toContain("No image generated");
    });

    it("returns 500 when fal.ai throws an error", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      mockSubscribe.mockRejectedValue(new Error("API rate limit"));

      const req = new MockNextRequest({
        creatureName: "TestCrab",
        zone: "moltbook",
      });
      const res = await POST(req as any);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toContain("Failed to generate");
      consoleSpy.mockRestore();
    });

    it("returns 500 when fal.ai throws error with body", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const errorWithBody = new Error("API error");
      (errorWithBody as any).body = { detail: "Invalid API key" };
      mockSubscribe.mockRejectedValue(errorWithBody);

      const req = new MockNextRequest({
        creatureName: "TestCrab",
        zone: "moltbook",
      });
      const res = await POST(req as any);
      expect(res.status).toBe(500);

      // Verify error body was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error body"),
        expect.any(String)
      );
      consoleSpy.mockRestore();
    });
  });

  describe("prompt construction", () => {
    it("includes creature name and type in prompt", async () => {
      const req = new MockNextRequest({
        creatureName: "Golden Lobster",
        creatureType: "aquatic",
        zone: "moltbook",
      });
      await POST(req as any);

      const prompt = mockSubscribe.mock.calls[0][1].input.prompt;
      expect(prompt).toContain("Golden Lobster");
      expect(prompt).toContain("aquatic");
    });

    it("includes pixel art style instructions in prompt", async () => {
      const req = new MockNextRequest({
        creatureName: "TestCrab",
        zone: "moltbook",
      });
      await POST(req as any);

      const prompt = mockSubscribe.mock.calls[0][1].input.prompt;
      expect(prompt).toContain("16-bit pixel art");
      expect(prompt).toContain("white background");
      expect(prompt).toContain("FULL BODY");
    });

    it("requests PNG output format", async () => {
      const req = new MockNextRequest({
        creatureName: "TestCrab",
        zone: "moltbook",
      });
      await POST(req as any);

      const input = mockSubscribe.mock.calls[0][1].input;
      expect(input.output_format).toBe("png");
      expect(input.num_images).toBe(1);
      expect(input.aspect_ratio).toBe("1:1");
    });
  });
});
