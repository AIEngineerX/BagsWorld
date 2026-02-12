import { getTimeAgo } from "../memory";

const mockSql = jest.fn();
jest.mock("@neondatabase/serverless", () => ({
  neon: jest.fn(() => mockSql),
}));

// Must import after mock setup
import { storeMemory, recallMemories, cleanupExpiredMemories } from "../memory";

const originalEnv = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnv, DATABASE_URL: "postgres://test:test@localhost/test" };
  mockSql.mockResolvedValue([]);
});

afterAll(() => {
  process.env = originalEnv;
});

describe("getTimeAgo", () => {
  it("returns minutes for recent times", () => {
    expect(getTimeAgo(new Date(Date.now() - 5 * 60 * 1000).toISOString())).toBe("5m ago");
  });

  it("returns hours within a day", () => {
    expect(getTimeAgo(new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString())).toBe("3h ago");
  });

  it("returns days beyond 24h", () => {
    expect(getTimeAgo(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString())).toBe("2d ago");
  });

  it("returns 0m ago for now", () => {
    expect(getTimeAgo(new Date().toISOString())).toBe("0m ago");
  });

  it('returns "just now" for future dates', () => {
    expect(getTimeAgo(new Date(Date.now() + 60 * 60 * 1000).toISOString())).toBe("just now");
  });

  it('returns "unknown" for invalid dates', () => {
    expect(getTimeAgo("not-a-date")).toBe("unknown");
    expect(getTimeAgo("")).toBe("unknown");
  });

  it("handles boundaries: 59m, 60m, 23h, 24h", () => {
    expect(getTimeAgo(new Date(Date.now() - 59 * 60 * 1000).toISOString())).toBe("59m ago");
    expect(getTimeAgo(new Date(Date.now() - 60 * 60 * 1000).toISOString())).toBe("1h ago");
    expect(getTimeAgo(new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString())).toBe("23h ago");
    expect(getTimeAgo(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())).toBe("1d ago");
  });
});

// Helper: find a tagged template call containing a SQL fragment
function findSqlCall(fragment: string) {
  return mockSql.mock.calls.find((call) => {
    if (!Array.isArray(call[0])) return false;
    return call[0].join("").includes(fragment);
  });
}

describe("storeMemory", () => {
  it("inserts with correct parameters", async () => {
    await storeMemory({
      agentId: "ghost",
      memoryType: "task_result",
      capability: "analysis",
      title: "Fee analysis report",
      content: "Analyzed 7 tokens, BAGS leads with 2.3 SOL",
    });

    expect(findSqlCall("INSERT INTO agent_memory")).toBeTruthy();
  });

  it("truncates title to 200 and content to 2000", async () => {
    await storeMemory({
      agentId: "ghost",
      memoryType: "task_result",
      capability: "analysis",
      title: "A".repeat(300),
      content: "B".repeat(3000),
    });

    const call = findSqlCall("INSERT INTO agent_memory")!;
    // Tagged template params: [0]=strings, [1]=agentId, ..., [4]=title, [5]=content
    expect(call[4].length).toBe(200);
    expect(call[5].length).toBe(2000);
  });

  it("defaults TTL to 30 days", async () => {
    await storeMemory({
      agentId: "ghost",
      memoryType: "task_result",
      capability: "analysis",
      title: "test",
      content: "content",
    });

    const call = findSqlCall("INSERT INTO agent_memory")!;
    expect(call[7]).toBe(30); // ttlDays is last param
  });

  it("uses custom TTL", async () => {
    await storeMemory({
      agentId: "ghost",
      memoryType: "observation",
      capability: "trading",
      title: "test",
      content: "content",
      ttlDays: 7,
    });

    expect(findSqlCall("INSERT INTO agent_memory")![7]).toBe(7);
  });

  it("serializes metadata as JSON, null when absent", async () => {
    await storeMemory({
      agentId: "ghost",
      memoryType: "task_result",
      capability: "analysis",
      title: "test",
      content: "content",
      metadata: { tokensAnalyzed: 7 },
    });

    const call1 = findSqlCall("INSERT INTO agent_memory")!;
    expect(JSON.parse(call1[6])).toEqual({ tokensAnalyzed: 7 });

    jest.clearAllMocks();
    mockSql.mockResolvedValue([]);

    await storeMemory({
      agentId: "ghost",
      memoryType: "task_result",
      capability: "analysis",
      title: "test",
      content: "content",
    });

    expect(findSqlCall("INSERT INTO agent_memory")![6]).toBeNull();
  });
});

describe("recallMemories", () => {
  it("returns formatted memories, handles both string and Date created_at", async () => {
    mockSql.mockResolvedValueOnce([
      { title: "Fee analysis", content: "BAGS leads", created_at: "2025-01-15T10:00:00.000Z" },
      { title: "Volume report", content: "MOLT up 40%", created_at: new Date("2025-01-14T10:00:00.000Z") },
    ]);

    const memories = await recallMemories({ agentId: "ghost" });

    expect(memories).toHaveLength(2);
    expect(memories[0]).toEqual({ title: "Fee analysis", content: "BAGS leads", createdAt: "2025-01-15T10:00:00.000Z" });
    expect(memories[1].createdAt).toBe("2025-01-14T10:00:00.000Z");
  });

  it("defaults limit to 5, accepts custom limit", async () => {
    mockSql.mockResolvedValue([]);

    await recallMemories({ agentId: "ghost" });
    const call1 = findSqlCall("SELECT title")!;
    expect(call1[call1.length - 1]).toBe(5);

    jest.clearAllMocks();
    mockSql.mockResolvedValue([]);

    await recallMemories({ agentId: "ghost", limit: 3 });
    const call2 = findSqlCall("SELECT title")!;
    expect(call2[call2.length - 1]).toBe(3);
  });

  it("filters by capability when provided", async () => {
    mockSql.mockResolvedValue([]);
    await recallMemories({ agentId: "ghost", capability: "analysis" });

    const call = mockSql.mock.calls.find((c) =>
      Array.isArray(c[0]) && c[0].join("").includes("SELECT title") && c[0].join("").includes("capability")
    );
    expect(call).toBeTruthy();
  });

  it("returns empty array when no memories found", async () => {
    mockSql.mockResolvedValue([]);
    expect(await recallMemories({ agentId: "new-agent" })).toEqual([]);
  });
});

describe("cleanupExpiredMemories", () => {
  it("returns count of deleted rows", async () => {
    mockSql.mockResolvedValueOnce([{ id: "1" }, { id: "2" }, { id: "3" }]);
    expect(await cleanupExpiredMemories()).toBe(3);
  });

  it("returns 0 when nothing expired", async () => {
    mockSql.mockResolvedValueOnce([]);
    expect(await cleanupExpiredMemories()).toBe(0);
  });

  it("logs only when memories are cleaned", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation();

    mockSql.mockResolvedValueOnce([{ id: "1" }]);
    await cleanupExpiredMemories();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Cleaned up 1"));

    consoleSpy.mockClear();
    mockSql.mockResolvedValueOnce([]);
    await cleanupExpiredMemories();
    const cleanupLogs = consoleSpy.mock.calls.filter(
      (c) => typeof c[0] === "string" && c[0].includes("Cleaned up")
    );
    expect(cleanupLogs).toHaveLength(0);

    consoleSpy.mockRestore();
  });
});
