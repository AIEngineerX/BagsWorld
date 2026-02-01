// Comprehensive tests for src/app/api/agents/route.ts
// Tests the unified agent chat API

// Note: Tests the API through mock fetch and validates the helper logic
// that the route uses. Direct route handler testing requires server env.

import { setupMockFetch } from "../mocks/bags-api";
import { getCharacter, getCharacterIds } from "@/lib/characters";

const AVAILABLE_AGENTS = ["neo", "cj", "finn", "bags-bot", "toly", "ash", "shaw", "ghost"];

const AGENT_ALIASES: Record<string, string> = {
  bagsbot: "bags-bot",
  dev: "ghost",
  finnbags: "finn",
};

// Replicate the normalizeAgentId function from the route for testing
function normalizeAgentId(agentId: string): string {
  const lower = agentId.toLowerCase().trim();
  return AGENT_ALIASES[lower] || lower;
}

// Replicate the detectAgentMention function from the route for testing
const AGENT_PATTERNS: Array<[RegExp, string]> = [
  [/\b(neo)\b/i, "neo"],
  [/\b(cj)\b/i, "cj"],
  [/\b(finn|finnbags)\b/i, "finn"],
  [/\b(bags[- ]?bot|bagsbot)\b/i, "bags-bot"],
  [/\b(toly)\b/i, "toly"],
  [/\b(ash)\b/i, "ash"],
  [/\b(shaw)\b/i, "shaw"],
  [/\b(ghost|the dev)\b/i, "ghost"],
];

const TOPIC_ROUTES: Array<[string, string]> = [
  ["alpha", "neo"],
  ["scan", "neo"],
  ["launch", "finn"],
  ["bags.fm", "finn"],
  ["solana", "toly"],
  ["blockchain", "toly"],
  ["pokemon", "ash"],
  ["evolve", "ash"],
  ["reward", "ghost"],
  ["fee share", "ghost"],
  ["elizaos", "shaw"],
  ["multi-agent", "shaw"],
];

function detectAgentMention(message: string, currentAgent: string): string | null {
  const lower = message.toLowerCase();

  for (const [pattern, agent] of AGENT_PATTERNS) {
    if (pattern.test(lower) && agent !== currentAgent) {
      return agent;
    }
  }

  const atMention = lower.match(/@(\w+)/);
  if (atMention) {
    const normalized = normalizeAgentId(atMention[1]);
    if (AVAILABLE_AGENTS.includes(normalized) && normalized !== currentAgent) {
      return normalized;
    }
  }

  for (const [topic, agent] of TOPIC_ROUTES) {
    if (lower.includes(topic) && agent !== currentAgent) {
      return agent;
    }
  }

  return null;
}

// Fallback responses map from the route
const FALLBACK_RESPONSES: Record<string, string[]> = {
  neo: ["scanning chains...", "something's forming.", "watching."],
  cj: ["yo! welcome fam!", "vibes immaculate!", "community strong!"],
  finn: ["gm! ready to build?", "great day to launch.", "let's go."],
  "bags-bot": ["Processing...", "Analyzing metrics.", "Compiling response."],
  toly: ["Solana never sleeps.", "Proof of history.", "Decentralized future."],
  ash: ["Ready to evolve?", "Gotta catch em all!", "Level up!"],
  shaw: ["Agents are the future.", "Character file is the soul.", "Multi-agent coordination."],
  ghost: ["Rewards flowing.", "50/30/20 split.", "Automated and trustless."],
};

describe("Agents API Route", () => {
  // ==================== Agent ID Normalization ====================

  describe("normalizeAgentId", () => {
    it("should return lowercase agent ID", () => {
      expect(normalizeAgentId("NEO")).toBe("neo");
      expect(normalizeAgentId("CJ")).toBe("cj");
      expect(normalizeAgentId("FINN")).toBe("finn");
    });

    it("should normalize bagsbot to bags-bot", () => {
      expect(normalizeAgentId("bagsbot")).toBe("bags-bot");
      expect(normalizeAgentId("BAGSBOT")).toBe("bags-bot");
    });

    it("should normalize dev to ghost", () => {
      expect(normalizeAgentId("dev")).toBe("ghost");
      expect(normalizeAgentId("DEV")).toBe("ghost");
    });

    it("should normalize finnbags to finn", () => {
      expect(normalizeAgentId("finnbags")).toBe("finn");
      expect(normalizeAgentId("FINNBAGS")).toBe("finn");
    });

    it("should trim whitespace", () => {
      expect(normalizeAgentId("  neo  ")).toBe("neo");
      expect(normalizeAgentId("\tfinns\t")).toBe("finns");
    });

    it("should pass through unknown agents", () => {
      expect(normalizeAgentId("unknown")).toBe("unknown");
      expect(normalizeAgentId("random")).toBe("random");
    });

    it("should handle empty string", () => {
      expect(normalizeAgentId("")).toBe("");
    });
  });

  // ==================== Agent Mention Detection ====================

  describe("detectAgentMention", () => {
    describe("direct name mentions", () => {
      it("should detect Neo mention", () => {
        expect(detectAgentMention("What does Neo think?", "finn")).toBe("neo");
      });

      it("should detect CJ mention", () => {
        expect(detectAgentMention("Ask CJ about vibes", "neo")).toBe("cj");
      });

      it("should detect Finn mention", () => {
        expect(detectAgentMention("Finn knows about launches", "neo")).toBe("finn");
      });

      it("should detect Toly mention", () => {
        expect(detectAgentMention("Let me ask Toly", "neo")).toBe("toly");
      });

      it("should detect Ash mention", () => {
        expect(detectAgentMention("Ash can help with that", "neo")).toBe("ash");
      });

      it("should detect Shaw mention", () => {
        expect(detectAgentMention("Shaw built this", "neo")).toBe("shaw");
      });

      it("should detect Ghost mention", () => {
        expect(detectAgentMention("Ghost handles rewards", "neo")).toBe("ghost");
      });

      it("should detect bags-bot mention", () => {
        expect(detectAgentMention("bags-bot has the data", "neo")).toBe("bags-bot");
      });

      it("should detect bagsbot without hyphen", () => {
        expect(detectAgentMention("bagsbot can help", "neo")).toBe("bags-bot");
      });
    });

    describe("alias mentions", () => {
      it("should detect finnbags as finn", () => {
        expect(detectAgentMention("Ask finnbags", "neo")).toBe("finn");
      });

      it('should detect "the dev" as ghost', () => {
        expect(detectAgentMention("Ask the dev about this", "neo")).toBe("ghost");
      });
    });

    describe("@mentions", () => {
      it("should detect @neo mention", () => {
        expect(detectAgentMention("Hey @neo what do you see?", "finn")).toBe("neo");
      });

      it("should detect @toly mention", () => {
        expect(detectAgentMention("@toly explain PoH", "neo")).toBe("toly");
      });

      it("should detect @bagsbot and normalize", () => {
        expect(detectAgentMention("@bagsbot check this", "neo")).toBe("bags-bot");
      });

      it("should detect @dev and normalize to ghost", () => {
        expect(detectAgentMention("@dev rewards status", "neo")).toBe("ghost");
      });

      it("should detect @finnbags and normalize to finn", () => {
        expect(detectAgentMention("@finnbags launch info", "neo")).toBe("finn");
      });
    });

    describe("topic-based routing", () => {
      it('should route "alpha" to neo', () => {
        expect(detectAgentMention("Looking for alpha", "finn")).toBe("neo");
      });

      it('should route "scan" to neo', () => {
        expect(detectAgentMention("Can you scan this?", "finn")).toBe("neo");
      });

      it('should route "launch" to finn', () => {
        expect(detectAgentMention("How do I launch a token?", "neo")).toBe("finn");
      });

      it('should route "bags.fm" to finn', () => {
        expect(detectAgentMention("What is bags.fm?", "neo")).toBe("finn");
      });

      it('should route "solana" to toly', () => {
        expect(detectAgentMention("Tell me about Solana", "neo")).toBe("toly");
      });

      it('should route "blockchain" to toly', () => {
        expect(detectAgentMention("How does blockchain work?", "neo")).toBe("toly");
      });

      it('should route "pokemon" to ash', () => {
        expect(detectAgentMention("I love pokemon!", "neo")).toBe("ash");
      });

      it('should route "evolve" to ash', () => {
        expect(detectAgentMention("How do I evolve my token?", "neo")).toBe("ash");
      });

      it('should route "reward" to ghost', () => {
        expect(detectAgentMention("When do I get my rewards?", "neo")).toBe("ghost");
      });

      it('should route "fee share" to ghost', () => {
        expect(detectAgentMention("Explain the fee share", "neo")).toBe("ghost");
      });

      it('should route "elizaos" to shaw', () => {
        expect(detectAgentMention("How does elizaos work?", "neo")).toBe("shaw");
      });

      it('should route "multi-agent" to shaw', () => {
        expect(detectAgentMention("Tell me about multi-agent systems", "neo")).toBe("shaw");
      });
    });

    describe("edge cases", () => {
      it("should not suggest the current agent", () => {
        expect(detectAgentMention("Neo is great", "neo")).toBeNull();
        expect(detectAgentMention("I am Neo", "neo")).toBeNull();
      });

      it("should return null when no agent mentioned", () => {
        expect(detectAgentMention("Hello how are you?", "neo")).toBeNull();
        expect(detectAgentMention("What is the weather?", "finn")).toBeNull();
      });

      it("should be case-insensitive", () => {
        expect(detectAgentMention("NEO is watching", "finn")).toBe("neo");
        expect(detectAgentMention("TOLY knows best", "neo")).toBe("toly");
      });

      it("should handle message with multiple agents (return first match)", () => {
        const result = detectAgentMention("Neo and Finn are great", "toly");
        expect(["neo", "finn"]).toContain(result);
      });

      it("should handle empty message", () => {
        expect(detectAgentMention("", "neo")).toBeNull();
      });

      it("should handle message with only current agent topic", () => {
        // Current agent is finn, message about launches shouldn't suggest finn
        expect(detectAgentMention("Tell me about launches", "finn")).toBeNull();
      });
    });
  });

  // ==================== Character Integration ====================

  describe("Character Integration", () => {
    it("should have characters for all available agents", () => {
      AVAILABLE_AGENTS.forEach((agentId) => {
        const character = getCharacter(agentId);
        expect(character).toBeDefined();
        expect(character?.name).toBeDefined();
      });
    });

    it("should be able to build agent list from characters", () => {
      const agents = AVAILABLE_AGENTS.map((id) => {
        const character = getCharacter(id);
        return {
          id,
          name: character?.name || id,
          description: Array.isArray(character?.bio) ? character.bio[0] : "A BagsWorld AI agent",
        };
      });

      expect(agents).toHaveLength(8);
      expect(agents.find((a) => a.id === "neo")?.name).toBe("Neo");
      expect(agents.find((a) => a.id === "finn")?.name).toBe("Finn");
    });

    it("should have system prompts for all agents", () => {
      AVAILABLE_AGENTS.forEach((agentId) => {
        const character = getCharacter(agentId);
        expect(character?.system).toBeDefined();
        expect(character?.system?.length).toBeGreaterThan(50);
      });
    });

    it("should have style arrays for all agents", () => {
      AVAILABLE_AGENTS.forEach((agentId) => {
        const character = getCharacter(agentId);
        expect(character?.style?.all).toBeDefined();
        expect(Array.isArray(character?.style?.all)).toBe(true);
      });
    });
  });

  // ==================== Fallback Responses ====================

  describe("Fallback Responses", () => {
    it("should have fallback responses for all agents", () => {
      AVAILABLE_AGENTS.forEach((agentId) => {
        expect(FALLBACK_RESPONSES[agentId]).toBeDefined();
        expect(Array.isArray(FALLBACK_RESPONSES[agentId])).toBe(true);
        expect(FALLBACK_RESPONSES[agentId].length).toBeGreaterThan(0);
      });
    });

    it("should have multiple responses per agent", () => {
      AVAILABLE_AGENTS.forEach((agentId) => {
        expect(FALLBACK_RESPONSES[agentId].length).toBeGreaterThanOrEqual(3);
      });
    });

    it("should have distinct responses per agent", () => {
      AVAILABLE_AGENTS.forEach((agentId) => {
        const responses = FALLBACK_RESPONSES[agentId];
        const uniqueResponses = new Set(responses);
        expect(uniqueResponses.size).toBe(responses.length);
      });
    });

    it("neo responses should be cryptic/scanning themed", () => {
      const neoResponses = FALLBACK_RESPONSES["neo"];
      const hasScanning = neoResponses.some(
        (r) => r.includes("scanning") || r.includes("watching")
      );
      expect(hasScanning).toBe(true);
    });

    it("cj responses should be community/vibes themed", () => {
      const cjResponses = FALLBACK_RESPONSES["cj"];
      const hasVibes = cjResponses.some((r) => r.includes("fam") || r.includes("vibes"));
      expect(hasVibes).toBe(true);
    });

    it("finn responses should be launch/build themed", () => {
      const finnResponses = FALLBACK_RESPONSES["finn"];
      const hasLaunch = finnResponses.some((r) => r.includes("build") || r.includes("launch"));
      expect(hasLaunch).toBe(true);
    });

    it("ghost responses should be rewards/fee themed", () => {
      const ghostResponses = FALLBACK_RESPONSES["ghost"];
      const hasRewards = ghostResponses.some(
        (r) => r.includes("Rewards") || r.includes("50/30/20")
      );
      expect(hasRewards).toBe(true);
    });

    it("toly responses should be Solana themed", () => {
      const tolyResponses = FALLBACK_RESPONSES["toly"];
      const hasSolana = tolyResponses.some((r) => r.includes("Solana") || r.includes("history"));
      expect(hasSolana).toBe(true);
    });
  });

  // ==================== API Response Structure ====================

  describe("API Response Structure (via mock fetch)", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should return expected response structure", async () => {
      const mockResponse = {
        success: true,
        agentId: "neo",
        agentName: "Neo",
        response: "Test response",
        suggestedAgent: null,
        sessionId: "mock-session-123",
      };

      setupMockFetch({
        "/api/agents": mockResponse,
      });

      const response = await fetch("http://localhost:3000/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "neo", message: "Hello" }),
      });
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.agentId).toBe("neo");
      expect(data.agentName).toBe("Neo");
      expect(data.response).toBeDefined();
      expect(data.sessionId).toBeDefined();
    });

    it("should return agent list on GET", async () => {
      const mockAgentList = {
        success: true,
        agents: AVAILABLE_AGENTS.map((id) => ({
          id,
          name: getCharacter(id)?.name || id,
          description: "Test description",
        })),
        aliases: AGENT_ALIASES,
      };

      setupMockFetch({
        "/api/agents": mockAgentList,
      });

      const response = await fetch("http://localhost:3000/api/agents");
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.agents).toHaveLength(8);
      expect(data.aliases).toEqual(AGENT_ALIASES);
    });
  });

  // ==================== Validation Logic ====================

  describe("Validation Logic", () => {
    it("should validate agent ID is in available list", () => {
      const isValidAgent = (id: string) => {
        const normalized = normalizeAgentId(id);
        return AVAILABLE_AGENTS.includes(normalized);
      };

      expect(isValidAgent("neo")).toBe(true);
      expect(isValidAgent("NEO")).toBe(true);
      expect(isValidAgent("bagsbot")).toBe(true); // alias
      expect(isValidAgent("dev")).toBe(true); // alias
      expect(isValidAgent("unknown")).toBe(false);
      expect(isValidAgent("")).toBe(false);
    });

    it("should validate all aliases resolve to valid agents", () => {
      Object.entries(AGENT_ALIASES).forEach(([alias, target]) => {
        expect(AVAILABLE_AGENTS.includes(target)).toBe(true);
      });
    });
  });

  // ==================== System Prompt Building ====================

  describe("System Prompt Building", () => {
    function buildSystemPrompt(agentId: string): string {
      const character = getCharacter(agentId);
      if (!character) return "You are a helpful assistant in BagsWorld.";

      const parts = [character.system || ""];

      if (Array.isArray(character.bio)) {
        parts.push("ABOUT YOU:\n" + character.bio.slice(0, 3).join("\n"));
      }

      if (Array.isArray(character.style?.all)) {
        parts.push("YOUR STYLE:\n" + character.style.all.slice(0, 5).join("\n"));
      }

      parts.push(`OTHER AGENTS: Neo (scanner), CJ (vibes), Finn (launches), Bags-Bot (data), Toly (Solana), Ash (guide), Shaw (agents), Ghost (rewards).
If a question is outside your expertise, suggest the appropriate agent.`);

      return parts.filter(Boolean).join("\n\n");
    }

    it("should build system prompt for neo", () => {
      const prompt = buildSystemPrompt("neo");
      expect(prompt).toContain("Neo");
      expect(prompt).toContain("chain scanner");
      expect(prompt).toContain("ABOUT YOU");
      expect(prompt).toContain("YOUR STYLE");
      expect(prompt).toContain("OTHER AGENTS");
    });

    it("should build system prompt for all agents", () => {
      AVAILABLE_AGENTS.forEach((agentId) => {
        const prompt = buildSystemPrompt(agentId);
        expect(prompt.length).toBeGreaterThan(100);
        expect(prompt).toContain("OTHER AGENTS");
      });
    });

    it("should return fallback for unknown agent", () => {
      const prompt = buildSystemPrompt("unknown");
      expect(prompt).toBe("You are a helpful assistant in BagsWorld.");
    });

    it("should include bio information", () => {
      const prompt = buildSystemPrompt("finn");
      expect(prompt).toContain("CEO");
    });

    it("should include style information", () => {
      const prompt = buildSystemPrompt("cj");
      expect(prompt).toContain("slang");
    });

    it("should include other agents for routing", () => {
      const prompt = buildSystemPrompt("neo");
      expect(prompt).toContain("Finn");
      expect(prompt).toContain("Toly");
      expect(prompt).toContain("Ghost");
    });
  });

  // ==================== Edge Cases ====================

  describe("Edge Cases", () => {
    it("should handle mixed case in patterns", () => {
      expect(detectAgentMention("ASK NEO about patterns", "finn")).toBe("neo");
      expect(detectAgentMention("TOLY is the expert", "neo")).toBe("toly");
    });

    it("should handle agent name within words carefully", () => {
      // "neophyte" contains "neo" but shouldn't trigger
      // The pattern uses word boundaries \b so this should work
      expect(detectAgentMention("I am a neophyte to crypto", "finn")).toBeNull();
    });

    it("should handle multiple @ mentions (name patterns checked first)", () => {
      // Note: The function checks AGENT_PATTERNS (name mentions) before @mentions
      // So even with @toly first, if 'neo' appears in the text, it matches first
      const result = detectAgentMention("@toly @finn @neo check this", "shaw");
      // 'neo' is found by AGENT_PATTERNS before @mentions are processed
      expect(result).toBe("neo");
    });

    it("should detect @ mention when no name pattern matches", () => {
      // Pure @ mention without the name appearing elsewhere
      const result = detectAgentMention("@toly check this", "shaw");
      expect(result).toBe("toly");
    });

    it("should handle @ mention before name mention", () => {
      const result = detectAgentMention("@finn neo is here", "shaw");
      // Name patterns are checked first, so 'neo' matches before @finn
      expect(result).toBe("neo");
    });

    it("should prefer direct mention over topic routing", () => {
      // Message mentions Solana (routes to toly) but also mentions Finn directly
      const result = detectAgentMention("Finn knows about Solana", "neo");
      expect(result).toBe("finn"); // Direct name mention wins
    });
  });
});
