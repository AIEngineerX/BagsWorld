import {
  shouldUseLlm,
  parseJsonResponse,
  generateTaskResult,
  _setRandomFn,
  _resetRandomFn,
  LLM_USAGE_RATE,
} from "../llm";

const originalEnv = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  _resetRandomFn();
  process.env = { ...originalEnv };
  delete process.env.ANTHROPIC_API_KEY;
});

afterAll(() => {
  process.env = originalEnv;
  _resetRandomFn();
});

describe("shouldUseLlm", () => {
  it("returns false when ANTHROPIC_API_KEY is not set", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(shouldUseLlm()).toBe(false);
  });

  it("returns false when ANTHROPIC_API_KEY is empty string", () => {
    process.env.ANTHROPIC_API_KEY = "";
    expect(shouldUseLlm()).toBe(false);
  });

  it("returns true when key set and random < LLM_USAGE_RATE", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    _setRandomFn(() => LLM_USAGE_RATE - 0.01);
    expect(shouldUseLlm()).toBe(true);
  });

  it("returns false when key set and random >= LLM_USAGE_RATE", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    _setRandomFn(() => LLM_USAGE_RATE);
    expect(shouldUseLlm()).toBe(false);
  });

  it("returns true when random is 0 and key is set", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    _setRandomFn(() => 0);
    expect(shouldUseLlm()).toBe(true);
  });

  it("returns false when random is 1 and key is set", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    _setRandomFn(() => 1);
    expect(shouldUseLlm()).toBe(false);
  });
});

describe("parseJsonResponse", () => {
  it("parses clean JSON", () => {
    expect(parseJsonResponse('{"narrative": "hello", "score": 42}')).toEqual({
      narrative: "hello",
      score: 42,
    });
  });

  it("strips markdown json fences", () => {
    expect(parseJsonResponse('```json\n{"narrative": "test"}\n```')).toEqual({
      narrative: "test",
    });
  });

  it("strips markdown fences without language tag", () => {
    expect(parseJsonResponse('```\n{"narrative": "test"}\n```')).toEqual({
      narrative: "test",
    });
  });

  it("handles leading text before JSON", () => {
    expect(parseJsonResponse('Here is the result:\n{"narrative": "test", "x": 1}')).toEqual({
      narrative: "test",
      x: 1,
    });
  });

  it("handles trailing text after JSON", () => {
    expect(parseJsonResponse('{"narrative": "test"}\n\nHope this helps!')).toEqual({
      narrative: "test",
    });
  });

  it("handles both leading and trailing text", () => {
    expect(parseJsonResponse('Result:\n{"a": 1}\nDone.')).toEqual({ a: 1 });
  });

  it("returns null for non-JSON input", () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    expect(parseJsonResponse("This is not JSON at all")).toBeNull();
    consoleSpy.mockRestore();
  });

  it("returns null for empty string", () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    expect(parseJsonResponse("")).toBeNull();
    consoleSpy.mockRestore();
  });

  it("handles nested braces", () => {
    expect(parseJsonResponse('{"data": {"nested": {"deep": true}}}')).toEqual({
      data: { nested: { deep: true } },
    });
  });

  it("handles whitespace-padded input", () => {
    expect(parseJsonResponse('   \n  {"narrative": "padded"}  \n   ')).toEqual({
      narrative: "padded",
    });
  });

  it("handles fences with extra whitespace", () => {
    expect(parseJsonResponse('```json  \n  {"a": 1}  \n  ```')).toEqual({ a: 1 });
  });
});

describe("generateTaskResult", () => {
  const mockOpts = {
    agentId: "ghost",
    agentRole: "The Dev & Trader",
    taskTitle: "Analyze top fee earners",
    taskDescription: "Find tokens generating the most fees in 24h",
    capability: "analysis" as const,
  };

  function mockFetchResponse(content: unknown[], ok = true, status = 200) {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok,
      status,
      json: async () => ({ content }),
      text: async () => JSON.stringify(content),
    });
  }

  it("returns null when ANTHROPIC_API_KEY is not set", async () => {
    const result = await generateTaskResult(mockOpts);
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("calls Claude API with correct headers and body", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test-key";
    mockFetchResponse([{ text: '{"narrative": "Found 5 top earners"}' }]);

    await generateTaskResult(mockOpts);

    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(options.headers["x-api-key"]).toBe("sk-test-key");
    expect(options.headers["anthropic-version"]).toBe("2023-06-01");

    const body = JSON.parse(options.body);
    expect(body.max_tokens).toBe(300);
    expect(body.system).toContain("Ghost");
    expect(body.messages[0].content).toContain("Analyze top fee earners");
  });

  it("returns parsed result with generatedBy: llm", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test-key";
    mockFetchResponse([
      {
        text: JSON.stringify({
          narrative: "Analyzed 7 tokens. BAGS leads with 2.3 SOL in 24h fees.",
          tokensAnalyzed: 7,
          topEarner: "BAGS",
        }),
      },
    ]);

    const result = await generateTaskResult(mockOpts);

    expect(result!.narrative).toBe("Analyzed 7 tokens. BAGS leads with 2.3 SOL in 24h fees.");
    expect(result!.result.generatedBy).toBe("llm");
    expect(result!.result.tokensAnalyzed).toBe(7);
  });

  it("returns null on non-ok response", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test-key";
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    mockFetchResponse([], false, 429);

    expect(await generateTaskResult(mockOpts)).toBeNull();
    consoleSpy.mockRestore();
  });

  it("returns null when content is empty", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test-key";
    mockFetchResponse([]);
    expect(await generateTaskResult(mockOpts)).toBeNull();
  });

  it("returns null when text is missing", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test-key";
    mockFetchResponse([{ type: "text" }]);
    expect(await generateTaskResult(mockOpts)).toBeNull();
  });

  it("returns null on invalid JSON from LLM", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test-key";
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    mockFetchResponse([{ text: "I cannot generate JSON for this task." }]);

    expect(await generateTaskResult(mockOpts)).toBeNull();
    consoleSpy.mockRestore();
  });

  it("returns null on network error", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test-key";
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

    expect(await generateTaskResult(mockOpts)).toBeNull();
    consoleSpy.mockRestore();
  });

  it("includes memory in system prompt", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test-key";
    mockFetchResponse([{ text: '{"narrative": "with memory"}' }]);

    await generateTaskResult({
      ...mockOpts,
      memory: ['[2d ago] "Fee analysis" — BAGS leads with 2.3 SOL'],
    });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.system).toContain("Your recent work:");
    expect(body.system).toContain("Fee analysis");
  });

  it("omits memory block when memory is empty", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test-key";
    mockFetchResponse([{ text: '{"narrative": "no memory"}' }]);

    await generateTaskResult({ ...mockOpts, memory: [] });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.system).not.toContain("Your recent work:");
  });

  it("prefers agentRole from opts over metadata", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test-key";
    mockFetchResponse([{ text: '{"narrative": "custom role"}' }]);

    await generateTaskResult({ ...mockOpts, agentRole: "Custom Role Override" });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.system).toContain("Custom Role Override");
  });

  it("handles markdown-fenced JSON response", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test-key";
    mockFetchResponse([{ text: '```json\n{"narrative": "fenced", "score": 95}\n```' }]);

    const result = await generateTaskResult(mockOpts);
    expect(result!.narrative).toBe("fenced");
    expect(result!.result.score).toBe(95);
  });

  it("defaults narrative to empty string when missing", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test-key";
    mockFetchResponse([{ text: '{"score": 42}' }]);

    const result = await generateTaskResult(mockOpts);
    expect(result!.narrative).toBe("");
  });
});
