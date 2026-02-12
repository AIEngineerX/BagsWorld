import { BAGSWORLD_AGENTS } from "../agent-data";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

export const LLM_USAGE_RATE = 0.5;

let randomFn: () => number = Math.random;
export function _setRandomFn(fn: () => number) {
  randomFn = fn;
}
export function _resetRandomFn() {
  randomFn = Math.random;
}

export interface TaskResultInput {
  agentId: string;
  agentRole: string;
  taskTitle: string;
  taskDescription: string;
  capability: string;
  category?: string;
  memory?: string[];
}

export interface TaskResultOutput {
  result: Record<string, unknown>;
  narrative: string;
}

export function shouldUseLlm(): boolean {
  if (!process.env.ANTHROPIC_API_KEY) return false;
  return randomFn() < LLM_USAGE_RATE;
}

function getAgentContext(agentId: string): { name: string; role: string } {
  const cleanId = agentId.replace(/^agent-/, "");
  const agent = BAGSWORLD_AGENTS.find(
    (a) => a.id === cleanId || a.id === agentId || a.name.toLowerCase() === cleanId.toLowerCase()
  );
  return agent
    ? { name: agent.name, role: agent.role }
    : { name: cleanId, role: "Agent" };
}

/** Extract JSON from LLM output — handles fences, leading/trailing text. */
export function parseJsonResponse(raw: string): Record<string, unknown> | null {
  const text = raw.trim();

  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // fall through
    }
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    } catch {
      // fall through
    }
  }

  try {
    return JSON.parse(text);
  } catch {
    console.error("[AgentLLM] Failed to parse JSON from LLM response:", text.slice(0, 200));
    return null;
  }
}

/** Returns null on failure — caller should fall back to templates. */
export async function generateTaskResult(
  opts: TaskResultInput
): Promise<TaskResultOutput | null> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return null;

  const agentCtx = getAgentContext(opts.agentId);

  const memoryBlock =
    opts.memory && opts.memory.length > 0
      ? `\n\nYour recent work:\n${opts.memory.map((m) => `- ${m}`).join("\n")}`
      : "";

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        system: `You are ${agentCtx.name} (${opts.agentRole || agentCtx.role}) working at Bags.fm Corp in the BagsWorld ecosystem. Bags.fm is a Solana token launchpad where creators earn 1% trading royalties on every trade.${memoryBlock}

You are completing a task. Respond with ONLY valid JSON (no markdown fences). The JSON must have:
- "narrative": a 2-4 sentence human-readable summary of your work and findings
- Additional structured fields relevant to the task (numbers, lists, recommendations)
- "generatedBy": "llm"

Be specific, opinionated, and use concrete numbers/examples where possible. Stay in character.`,
        messages: [
          {
            role: "user",
            content: `Complete this task and return your findings as JSON.

Task: ${opts.taskTitle}
Description: ${opts.taskDescription}
Category: ${opts.category || opts.capability}

Return JSON with a "narrative" field (your summary) plus relevant data fields.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[AgentLLM] API error:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const text = data.content?.[0]?.text;
    if (!text) return null;

    const parsed = parseJsonResponse(text);
    if (!parsed) return null;

    parsed.generatedBy = "llm";
    const narrative = typeof parsed.narrative === "string" ? parsed.narrative : "";

    return { result: parsed, narrative };
  } catch (error) {
    console.error("[AgentLLM] Failed to generate task result:", error);
    return null;
  }
}
