---
name: ai-agent-builder
description: Build autonomous AI agents that operate on websites, interact with APIs, and perform automated tasks. Use when creating browser automation agents, API-driven bots, trading agents, social media automation, data scraping agents, or any autonomous system that needs to interact with web services. Triggers on requests for "AI agent", "autonomous bot", "web automation", "browser agent", "API agent", "trading bot", "scraper", "autonomous system", or any task requiring an AI to independently operate on websites or services.
---

# AI Agent Builder

Build production-ready autonomous AI agents that interact with websites, APIs, and blockchain.

## Architecture

Every agent has 5 layers:

```
agent/
├── perception/     # How agent sees (browser, API, WebSocket, chain)
├── brain/          # How agent thinks (LLM integration)
├── actions/        # What agent can do (click, type, transact)
├── memory/         # What agent remembers (context, patterns)
└── orchestrator/   # Decision loop (ReAct pattern)
```

## Build Workflow

1. **Define objective** — What should agent accomplish autonomously?
2. **Choose perception** — Browser (Playwright), API polling, WebSockets, or hybrid
3. **Design actions** — What operations can agent perform?
4. **Select brain** — Which LLM and reasoning pattern
5. **Implement memory** — Short-term context + optional long-term learning
6. **Build orchestrator** — The ReAct loop tying everything together
7. **Add safeguards** — Max steps, confirmations, error handling

## Perception Layer

| Target          | Tool                    | Use When                           |
| --------------- | ----------------------- | ---------------------------------- |
| Modern web apps | Playwright              | JS-heavy, SPAs, auth required      |
| Static sites    | Cheerio + fetch         | Simple scraping, speed priority    |
| APIs            | fetch/axios             | Direct API access available        |
| Real-time data  | WebSockets              | Live feeds, trading, notifications |
| Blockchain      | @solana/web3.js, ethers | On-chain data, wallet ops          |

See `references/perception.md` for implementation patterns.

## Brain Layer

| Provider  | Model         | Best For                    |
| --------- | ------------- | --------------------------- |
| Anthropic | Claude 3.5/4  | Complex reasoning, tool use |
| OpenAI    | GPT-4o        | General tasks, vision       |
| Groq      | Llama/Mixtral | Speed-critical              |
| Local     | Ollama        | Privacy, no API costs       |

See `references/brain.md` for LLM integration and prompt patterns.

## Action Layer

Actions are tools the LLM can call:

```javascript
const tools = [
  { name: "navigate", description: "Go to URL", input: { url: "string" } },
  { name: "click", description: "Click element", input: { selector: "string" } },
  { name: "type", description: "Type text", input: { selector: "string", text: "string" } },
  { name: "extract", description: "Get text from element", input: { selector: "string" } },
  { name: "screenshot", description: "Capture page state" },
  { name: "wait", description: "Wait milliseconds", input: { ms: "number" } },
  { name: "complete", description: "Mark task done", input: { summary: "string" } },
];
```

See `references/actions.md` for full action catalog.

## Memory Layer

**Short-term**: Sliding window of recent actions + observations (fits in context)

**Long-term** (optional): SQLite/JSON for pattern persistence across sessions

```javascript
class Memory {
  constructor(maxHistory = 20) {
    this.history = [];
    this.maxHistory = maxHistory;
  }

  add(entry) {
    this.history.push({ ...entry, timestamp: Date.now() });
    if (this.history.length > this.maxHistory) this.history.shift();
  }

  getContext() {
    return this.history.map((h) => `[${h.type}] ${h.content}`).join("\n");
  }
}
```

See `references/memory.md` for advanced patterns.

## Orchestrator (ReAct Loop)

The core decision loop:

```javascript
async function agentLoop(objective, maxSteps = 50) {
  const memory = new Memory();

  for (let step = 0; step < maxSteps; step++) {
    // 1. Build prompt with objective + memory
    const prompt = buildPrompt(objective, memory.getContext());

    // 2. Get LLM decision (tool call)
    const decision = await brain.decide(prompt, tools);

    // 3. Execute action
    const result = await executeAction(decision.tool, decision.input);

    // 4. Store in memory
    memory.add({ type: "action", content: `${decision.tool}: ${JSON.stringify(decision.input)}` });
    memory.add({ type: "observation", content: result });

    // 5. Check completion
    if (decision.tool === "complete") {
      return { success: true, summary: decision.input.summary };
    }
  }

  return { success: false, reason: "max_steps_exceeded" };
}
```

## Quick Start Template

Use `assets/templates/general-agent/` for a working foundation:

```bash
cp -r assets/templates/general-agent ./my-agent
cd my-agent
npm install
# Edit config in agent.js
node agent.js "Your objective here"
```

## Safety Rules

1. **Max steps** — Always set a limit (default: 50)
2. **Confirmation** — Require human approval for destructive actions
3. **Rate limiting** — Don't hammer APIs/sites
4. **Error recovery** — Graceful handling, retry with backoff
5. **Logging** — Record all actions for debugging
6. **Scope limits** — Restrict domains/actions agent can access

## Reference Files

- `references/perception.md` — Browser, API, WebSocket, blockchain patterns
- `references/brain.md` — LLM integration, prompts, tool calling
- `references/actions.md` — Full action catalog with examples
- `references/memory.md` — Context management, persistence
- `references/use-cases.md` — Complete implementations: trading bots, scrapers, social agents
