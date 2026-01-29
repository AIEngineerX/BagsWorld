import Anthropic from '@anthropic-ai/sdk';
import { chromium } from 'playwright';

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  objective: process.argv[2] || 'Navigate to example.com and extract the page title',
  maxSteps: 50,
  headless: true,
  model: 'claude-sonnet-4-20250514',
};

// ============================================
// TOOLS DEFINITION
// ============================================

const TOOLS = [
  {
    name: 'navigate',
    description: 'Navigate browser to a URL',
    input_schema: {
      type: 'object',
      properties: { url: { type: 'string', description: 'URL to navigate to' } },
      required: ['url'],
    },
  },
  {
    name: 'click',
    description: 'Click on an element',
    input_schema: {
      type: 'object',
      properties: { selector: { type: 'string', description: 'CSS selector' } },
      required: ['selector'],
    },
  },
  {
    name: 'type',
    description: 'Type text into an input field',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector' },
        text: { type: 'string', description: 'Text to type' },
      },
      required: ['selector', 'text'],
    },
  },
  {
    name: 'extract',
    description: 'Extract text content from an element',
    input_schema: {
      type: 'object',
      properties: { selector: { type: 'string', description: 'CSS selector' } },
      required: ['selector'],
    },
  },
  {
    name: 'screenshot',
    description: 'Take a screenshot of the current page',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'wait',
    description: 'Wait for specified milliseconds',
    input_schema: {
      type: 'object',
      properties: { ms: { type: 'number', description: 'Milliseconds to wait' } },
      required: ['ms'],
    },
  },
  {
    name: 'complete',
    description: 'Mark the objective as complete',
    input_schema: {
      type: 'object',
      properties: { summary: { type: 'string', description: 'Summary of what was accomplished' } },
      required: ['summary'],
    },
  },
];

// ============================================
// MEMORY
// ============================================

class Memory {
  constructor(maxEntries = 20) {
    this.entries = [];
    this.maxEntries = maxEntries;
  }

  add(type, content) {
    this.entries.push({ type, content, timestamp: Date.now() });
    if (this.entries.length > this.maxEntries) this.entries.shift();
  }

  getContext() {
    return this.entries.map(e => `[${e.type.toUpperCase()}] ${e.content}`).join('\n');
  }
}

// ============================================
// AGENT
// ============================================

class Agent {
  constructor(config) {
    this.config = config;
    this.claude = new Anthropic();
    this.memory = new Memory();
    this.browser = null;
    this.page = null;
  }

  async init() {
    this.browser = await chromium.launch({ headless: this.config.headless });
    const context = await this.browser.newContext();
    this.page = await context.newPage();
    console.log('🤖 Agent initialized');
  }

  async run() {
    await this.init();
    console.log(`📋 Objective: ${this.config.objective}\n`);

    try {
      for (let step = 0; step < this.config.maxSteps; step++) {
        console.log(`\n--- Step ${step + 1} ---`);

        const decision = await this.decide();
        console.log(`🧠 Decision: ${decision.tool}`, decision.input || '');

        const result = await this.execute(decision);
        console.log(`📝 Result: ${result.slice(0, 200)}${result.length > 200 ? '...' : ''}`);

        this.memory.add('action', `${decision.tool}(${JSON.stringify(decision.input || {})})`);
        this.memory.add('observation', result);

        if (decision.tool === 'complete') {
          console.log('\n✅ Objective complete!');
          console.log(`Summary: ${decision.input.summary}`);
          break;
        }
      }
    } finally {
      await this.cleanup();
    }
  }

  async decide() {
    const systemPrompt = `You are an autonomous browser agent. Your objective: ${this.config.objective}

You can use these tools to accomplish your objective. Take one action at a time.

Rules:
1. Observe the result of each action before deciding the next
2. If something fails, try an alternative approach
3. Call 'complete' when the objective is achieved
4. Be efficient - don't take unnecessary actions`;

    const response = await this.claude.messages.create({
      model: this.config.model,
      max_tokens: 1024,
      system: systemPrompt,
      tools: TOOLS,
      messages: [
        {
          role: 'user',
          content: this.memory.entries.length
            ? `History:\n${this.memory.getContext()}\n\nWhat's your next action?`
            : 'Begin working on the objective. What\'s your first action?',
        },
      ],
    });

    const toolUse = response.content.find(c => c.type === 'tool_use');
    if (toolUse) {
      return { tool: toolUse.name, input: toolUse.input };
    }

    return { tool: 'complete', input: { summary: 'No clear action determined' } };
  }

  async execute(decision) {
    const { tool, input } = decision;

    try {
      switch (tool) {
        case 'navigate':
          await this.page.goto(input.url, { waitUntil: 'networkidle' });
          return `Navigated to ${input.url}. Title: ${await this.page.title()}`;

        case 'click':
          await this.page.click(input.selector);
          return `Clicked ${input.selector}`;

        case 'type':
          await this.page.fill(input.selector, input.text);
          return `Typed "${input.text}" into ${input.selector}`;

        case 'extract':
          const text = await this.page.innerText(input.selector);
          return `Extracted: ${text}`;

        case 'screenshot':
          await this.page.screenshot({ path: 'screenshot.png' });
          return 'Screenshot saved to screenshot.png';

        case 'wait':
          await new Promise(r => setTimeout(r, input.ms));
          return `Waited ${input.ms}ms`;

        case 'complete':
          return input.summary;

        default:
          return `Unknown tool: ${tool}`;
      }
    } catch (error) {
      return `ERROR: ${error.message}`;
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      console.log('🔒 Browser closed');
    }
  }
}

// ============================================
// RUN
// ============================================

const agent = new Agent(CONFIG);
agent.run().catch(console.error);
