jest.mock("../llm", () => ({
  shouldUseLlm: jest.fn(),
  generateTaskResult: jest.fn(),
}));

jest.mock("@neondatabase/serverless", () => ({
  neon: jest.fn(() => jest.fn().mockResolvedValue([])),
}));

import {
  generateResultForCapability,
  RESULT_TEMPLATES,
  TASK_TEMPLATES,
  generateTaskForCapability,
} from "../task-board";
import { generateServiceResult } from "../corps";
import { shouldUseLlm, generateTaskResult } from "../llm";
import type { AgentCapability } from "../../types";

const mockedShouldUseLlm = shouldUseLlm as jest.MockedFunction<typeof shouldUseLlm>;
const mockedGenerateTaskResult = generateTaskResult as jest.MockedFunction<
  typeof generateTaskResult
>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("generateResultForCapability", () => {
  const ctx = {
    agentId: "ghost",
    agentRole: "The Dev & Trader",
    taskTitle: "Analyze top fee earners",
    taskDescription: "Find tokens generating the most fees",
  };

  it("uses LLM when context provided and shouldUseLlm is true", async () => {
    mockedShouldUseLlm.mockReturnValue(true);
    mockedGenerateTaskResult.mockResolvedValue({
      result: { narrative: "LLM result", generatedBy: "llm" },
      narrative: "LLM result",
    });

    const result = await generateResultForCapability("analysis", ctx);

    expect(mockedGenerateTaskResult).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "ghost",
        capability: "analysis",
      })
    );
    expect(result.generatedBy).toBe("llm");
  });

  it("falls back to template when shouldUseLlm is false", async () => {
    mockedShouldUseLlm.mockReturnValue(false);
    const result = await generateResultForCapability("analysis", ctx);

    expect(mockedGenerateTaskResult).not.toHaveBeenCalled();
    expect(result).toHaveProperty("tokensAnalyzed");
  });

  it("falls back to template without context", async () => {
    const result = await generateResultForCapability("alpha");
    expect(mockedShouldUseLlm).not.toHaveBeenCalled();
    expect(result).toHaveProperty("tokensFound");
  });

  it("falls back to template when LLM returns null", async () => {
    mockedShouldUseLlm.mockReturnValue(true);
    mockedGenerateTaskResult.mockResolvedValue(null);

    const result = await generateResultForCapability("trading", ctx);
    expect(result).toHaveProperty("tradesAnalyzed");
  });

  it("passes memory strings to LLM", async () => {
    mockedShouldUseLlm.mockReturnValue(true);
    mockedGenerateTaskResult.mockResolvedValue({ result: {}, narrative: "" });

    const memory = ['[2d ago] "Analysis" — some content'];
    await generateResultForCapability("analysis", { ...ctx, memory });

    expect(mockedGenerateTaskResult).toHaveBeenCalledWith(expect.objectContaining({ memory }));
  });
});

describe("RESULT_TEMPLATES", () => {
  const caps: AgentCapability[] = [
    "alpha",
    "trading",
    "content",
    "launch",
    "combat",
    "scouting",
    "analysis",
  ];

  it.each(caps)("produces non-empty object for %s", (cap) => {
    const result = RESULT_TEMPLATES[cap]();
    expect(typeof result).toBe("object");
    expect(Object.keys(result).length).toBeGreaterThan(0);
  });

  it("alpha: tokensFound 1-5, confidence 65-94", () => {
    const r = RESULT_TEMPLATES.alpha();
    expect(r.tokensFound).toBeGreaterThanOrEqual(1);
    expect(r.tokensFound).toBeLessThanOrEqual(5);
    expect(r.confidence).toBeGreaterThanOrEqual(65);
    expect(r.confidence).toBeLessThanOrEqual(94);
  });

  it("trading: valid recommendation and riskLevel", () => {
    const r = RESULT_TEMPLATES.trading();
    expect(["buy", "hold", "rebalance"]).toContain(r.recommendation);
    expect(["low", "medium"]).toContain(r.riskLevel);
  });

  it("content: postDrafted true, platform moltbook", () => {
    const r = RESULT_TEMPLATES.content();
    expect(r.postDrafted).toBe(true);
    expect(r.platform).toBe("moltbook");
  });

  it("analysis: reportGenerated true", () => {
    expect(RESULT_TEMPLATES.analysis().reportGenerated).toBe(true);
  });
});

describe("TASK_TEMPLATES", () => {
  const caps: AgentCapability[] = [
    "alpha",
    "trading",
    "content",
    "launch",
    "combat",
    "scouting",
    "analysis",
  ];

  it.each(caps)("has non-empty templates for %s", (cap) => {
    const templates = TASK_TEMPLATES[cap];
    expect(templates.length).toBeGreaterThan(0);
    templates.forEach((t) => {
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
    });
  });
});

describe("generateTaskForCapability", () => {
  it("returns valid PostTaskOptions", () => {
    const task = generateTaskForCapability("analysis");
    expect(task.capabilityRequired).toBe("analysis");
    expect(task.expiryHours).toBe(24);
    expect(task.rewardSol).toBeGreaterThanOrEqual(0.01);
    expect(task.rewardSol).toBeLessThanOrEqual(0.1);
  });

  it("picks from correct templates", () => {
    const task = generateTaskForCapability("combat");
    expect(TASK_TEMPLATES.combat.map((t) => t.title)).toContain(task.title);
  });
});

describe("generateServiceResult", () => {
  const ctx = {
    agentId: "finn",
    agentRole: "CEO & Founder",
    taskTitle: "Write fee claiming tutorial",
    taskDescription: "Step-by-step guide for claiming fees",
    category: "education",
  };

  it("uses LLM when available", async () => {
    mockedShouldUseLlm.mockReturnValue(true);
    mockedGenerateTaskResult.mockResolvedValue({
      result: { narrative: "Corp LLM result", generatedBy: "llm" },
      narrative: "Corp LLM result",
    });

    const result = await generateServiceResult("guide", ctx);
    expect(result.generatedBy).toBe("llm");
  });

  it("falls back to template without LLM", async () => {
    mockedShouldUseLlm.mockReturnValue(false);
    const result = await generateServiceResult("guide", ctx);

    expect(mockedGenerateTaskResult).not.toHaveBeenCalled();
    expect(result.type).toBe("guide");
  });

  it("falls back to template without context", async () => {
    expect((await generateServiceResult("report")).type).toBe("report");
  });

  it("falls back to report for unknown outputType", async () => {
    expect((await generateServiceResult("unknown_type")).type).toBe("report");
  });

  it("passes memory to LLM", async () => {
    mockedShouldUseLlm.mockReturnValue(true);
    mockedGenerateTaskResult.mockResolvedValue({ result: {}, narrative: "" });

    const memory = ['[1d ago] "Tutorial" — wrote fee guide'];
    await generateServiceResult("guide", { ...ctx, memory });

    expect(mockedGenerateTaskResult).toHaveBeenCalledWith(expect.objectContaining({ memory }));
  });

  it("handles all output types", async () => {
    for (const type of ["guide", "report", "alert", "review", "checklist", "tool"]) {
      expect((await generateServiceResult(type)).type).toBe(type);
    }
  });
});
