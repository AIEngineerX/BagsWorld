# Testing Reference

Comprehensive testing patterns for elizaOS agents.

## Test Framework

elizaOS uses **bun:test** (compatible with Jest/Vitest patterns).

```bash
# Run all tests
elizaos test

# Component tests only
elizaos test component

# End-to-end tests only
elizaos test e2e
```

## Test Types

| Type | Purpose | Runtime |
|------|---------|---------|
| **Unit** | Individual functions, utilities | bun:test |
| **Component** | Actions, providers, evaluators | bun:test |
| **Integration** | Plugin interactions | bun:test |
| **E2E** | Full agent runtime | Actual runtime |

**Note:** E2E tests cannot use bun:test state (interferes with internal elizaOS instance).

---

## Character Testing

### Basic Validation
```typescript
import { describe, it, expect } from 'bun:test';
import { validateCharacter } from '@elizaos/core';
import { character } from '../characters/my-agent';

describe('Character Configuration', () => {
  it('should have required fields', () => {
    expect(character.name).toBeDefined();
    expect(character.bio).toBeDefined();
  });

  it('should pass validation', () => {
    const result = validateCharacter(character);
    expect(result.valid).toBe(true);
    if (!result.valid) {
      console.log('Errors:', result.errors);
    }
  });

  it('should have consistent personality', () => {
    // Check adjectives don't contradict
    const adjectives = character.adjectives || [];
    expect(adjectives).not.toContain('aggressive');
    expect(adjectives).not.toContain('rude');
  });
});
```

### Message Examples Test
```typescript
describe('Message Examples', () => {
  it('should have valid format', () => {
    expect(character.messageExamples).toBeInstanceOf(Array);

    character.messageExamples?.forEach((conversation, i) => {
      expect(conversation.length).toBeGreaterThan(1);

      conversation.forEach((message, j) => {
        expect(message).toHaveProperty('name');
        expect(message).toHaveProperty('content');
        expect(message.content).toHaveProperty('text');
        expect(typeof message.content.text).toBe('string');
      });
    });
  });

  it('should demonstrate agent personality', () => {
    const agentResponses = character.messageExamples
      ?.flatMap(conv => conv.filter(m => m.name === character.name))
      .map(m => m.content.text) || [];

    // Check style is reflected
    agentResponses.forEach(response => {
      // Example: verify response length matches style
      if (character.style?.chat?.includes('concise')) {
        expect(response.length).toBeLessThan(500);
      }
    });
  });
});
```

### Post Examples Test
```typescript
describe('Post Examples', () => {
  it('should have valid posts', () => {
    expect(character.postExamples).toBeInstanceOf(Array);
    expect(character.postExamples?.length).toBeGreaterThan(0);
  });

  it('should match post style', () => {
    character.postExamples?.forEach(post => {
      // Check Twitter length limit if client includes twitter
      if (character.clients?.includes('twitter')) {
        expect(post.length).toBeLessThanOrEqual(280);
      }
    });
  });
});
```

---

## Action Testing

### Mock Runtime
```typescript
const mockRuntime = {
  agentId: 'test-agent-id',
  getSetting: (key: string) => process.env[key],
  getMemories: async () => [],
  searchMemories: async () => [],
  createMemory: async () => 'memory-id',
  completion: async ({ messages }) => 'Mock LLM response',
  embed: async (text: string) => new Array(1536).fill(0),
  getEntity: async (id: string) => ({ name: 'Test User', metadata: {} }),
  getService: (name: string) => null,
};
```

### Action Validation Test
```typescript
import { describe, it, expect, beforeEach } from 'bun:test';
import { helpAction } from '../src/actions/help';

describe('Help Action', () => {
  let mockRuntime: any;
  let mockState: any;

  beforeEach(() => {
    mockRuntime = createMockRuntime();
    mockState = { text: '', values: {}, data: {} };
  });

  describe('validate', () => {
    it('should return true for help keyword', async () => {
      const message = { content: { text: 'Can you help me?' } };
      const result = await helpAction.validate(mockRuntime, message, mockState);
      expect(result).toBe(true);
    });

    it('should return true for similar phrases', async () => {
      const phrases = ['I need assistance', 'support please', 'help'];

      for (const phrase of phrases) {
        const message = { content: { text: phrase } };
        const result = await helpAction.validate(mockRuntime, message, mockState);
        expect(result).toBe(true);
      }
    });

    it('should return false for unrelated messages', async () => {
      const message = { content: { text: 'What is the weather?' } };
      const result = await helpAction.validate(mockRuntime, message, mockState);
      expect(result).toBe(false);
    });
  });
});
```

### Action Handler Test
```typescript
describe('Help Action Handler', () => {
  it('should return helpful response', async () => {
    const message = { content: { text: 'help me' }, roomId: 'room-1' };
    let capturedResponse = '';

    const result = await helpAction.handler(
      mockRuntime,
      message,
      mockState,
      {},
      (response) => { capturedResponse = response; }
    );

    expect(capturedResponse).toContain('help');
    expect(typeof result).toBe('string');
  });

  it('should handle errors gracefully', async () => {
    const failingRuntime = {
      ...mockRuntime,
      searchMemories: async () => { throw new Error('DB error'); }
    };

    const message = { content: { text: 'help' } };

    // Should not throw
    await expect(
      helpAction.handler(failingRuntime, message, mockState, {}, () => {})
    ).resolves.toBeDefined();
  });
});
```

---

## Provider Testing

### Basic Provider Test
```typescript
import { describe, it, expect } from 'bun:test';
import { timeProvider } from '../src/providers/time';

describe('Time Provider', () => {
  it('should return text and data', async () => {
    const message = { content: { text: 'test' } };
    const result = await timeProvider.get(mockRuntime, message, mockState);

    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('data');
    expect(typeof result.text).toBe('string');
  });

  it('should include timestamp in data', async () => {
    const message = { content: { text: 'test' } };
    const result = await timeProvider.get(mockRuntime, message, mockState);

    expect(result.data).toHaveProperty('timestamp');
    expect(typeof result.data.timestamp).toBe('number');
  });

  it('should detect time of day correctly', async () => {
    const message = { content: { text: 'test' } };
    const result = await timeProvider.get(mockRuntime, message, mockState);

    expect(['morning', 'afternoon', 'evening']).toContain(result.data.timeOfDay);
  });
});
```

### Provider with External API Test
```typescript
import { describe, it, expect, mock } from 'bun:test';
import { priceProvider } from '../src/providers/price';

describe('Price Provider', () => {
  it('should return empty for no token mentions', async () => {
    const message = { content: { text: 'hello world' } };
    const result = await priceProvider.get(mockRuntime, message, mockState);

    expect(result.text).toBe('');
    expect(result.data).toEqual({});
  });

  it('should fetch prices for mentioned tokens', async () => {
    // Mock fetch
    global.fetch = mock(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        pairs: [{ priceUsd: '100.00', priceChange24h: 5.5 }]
      })
    }));

    const message = { content: { text: 'What is the price of SOL?' } };
    const result = await priceProvider.get(mockRuntime, message, mockState);

    expect(result.text).toContain('SOL');
    expect(result.data.prices).toBeDefined();
  });

  it('should handle API errors gracefully', async () => {
    global.fetch = mock(() => Promise.reject(new Error('Network error')));

    const message = { content: { text: 'price of BTC' } };

    // Should not throw, return empty
    const result = await priceProvider.get(mockRuntime, message, mockState);
    expect(result.text).toBe('');
  });
});
```

---

## Evaluator Testing

### Basic Evaluator Test
```typescript
import { describe, it, expect } from 'bun:test';
import { qualityEvaluator } from '../src/evaluators/quality';

describe('Quality Evaluator', () => {
  it('should evaluate response quality', async () => {
    const message = { content: { text: 'test question' }, roomId: 'room-1' };
    const responses = [{ content: { text: 'This is a detailed response with lots of content.' } }];

    const result = await qualityEvaluator.handler(
      mockRuntime,
      message,
      mockState,
      {},
      () => {},
      responses
    );

    expect(['detailed', 'brief', 'empty']).toContain(result);
  });

  it('should handle empty responses', async () => {
    const message = { content: { text: 'test' }, roomId: 'room-1' };
    const responses = [{ content: { text: '' } }];

    const result = await qualityEvaluator.handler(
      mockRuntime,
      message,
      mockState,
      {},
      () => {},
      responses
    );

    expect(result).toBe('empty');
  });
});
```

### Conditional Evaluator Test
```typescript
describe('Fact Extraction Evaluator', () => {
  it('should run on personal statements', () => {
    const message = { content: { text: 'My name is John' } };
    const shouldRun = factEvaluator.shouldRun?.(message, mockState);
    expect(shouldRun).toBe(true);
  });

  it('should not run on general questions', () => {
    const message = { content: { text: 'What is the weather?' } };
    const shouldRun = factEvaluator.shouldRun?.(message, mockState);
    expect(shouldRun).toBe(false);
  });
});
```

---

## Plugin Testing

### Plugin Structure Test
```typescript
import { describe, it, expect } from 'bun:test';
import { myPlugin } from '../src/plugins/my-plugin';

describe('My Plugin', () => {
  it('should have required properties', () => {
    expect(myPlugin.name).toBeDefined();
    expect(typeof myPlugin.name).toBe('string');
  });

  it('should have valid actions', () => {
    myPlugin.actions?.forEach(action => {
      expect(action.name).toBeDefined();
      expect(action.handler).toBeDefined();
      expect(typeof action.handler).toBe('function');
    });
  });

  it('should have valid providers', () => {
    myPlugin.providers?.forEach(provider => {
      expect(provider.name).toBeDefined();
      expect(provider.get).toBeDefined();
      expect(typeof provider.get).toBe('function');
    });
  });
});
```

### Plugin Lifecycle Test
```typescript
describe('Plugin Lifecycle', () => {
  it('should initialize without error', async () => {
    if (myPlugin.init) {
      await expect(myPlugin.init({}, mockRuntime)).resolves.not.toThrow();
    }
  });

  it('should start without error', async () => {
    if (myPlugin.start) {
      await expect(myPlugin.start(mockRuntime)).resolves.not.toThrow();
    }
  });

  it('should stop without error', async () => {
    if (myPlugin.stop) {
      await expect(myPlugin.stop(mockRuntime)).resolves.not.toThrow();
    }
  });
});
```

---

## Integration Testing

### Action + Provider Integration
```typescript
describe('Action with Provider Context', () => {
  it('should use provider data in action', async () => {
    // Build state with provider data
    const providerResult = await priceProvider.get(mockRuntime, message, {});
    const stateWithProvider = {
      ...mockState,
      data: {
        providers: { tokenPrices: providerResult.data }
      }
    };

    // Action should have access to provider data
    const result = await tradeAction.handler(
      mockRuntime,
      message,
      stateWithProvider,
      {},
      () => {}
    );

    expect(result).toContain('price');
  });
});
```

---

## E2E Testing

### Full Agent Test
```typescript
// e2e/agent.test.ts
import { AgentRuntime } from '@elizaos/core';
import { character } from '../characters/my-agent';

describe('Agent E2E', () => {
  let runtime: AgentRuntime;

  beforeAll(async () => {
    runtime = new AgentRuntime({
      character,
      adapter: testDatabaseAdapter,
    });
    await runtime.initialize();
  });

  afterAll(async () => {
    await runtime.shutdown();
  });

  it('should respond to messages', async () => {
    const response = await runtime.processMessage({
      content: { text: 'Hello!' },
      roomId: 'test-room',
      entityId: 'test-user'
    });

    expect(response).toBeDefined();
    expect(response.content.text).toBeDefined();
  });

  it('should remember context', async () => {
    await runtime.processMessage({
      content: { text: 'My name is Alice' },
      roomId: 'test-room',
      entityId: 'test-user'
    });

    const response = await runtime.processMessage({
      content: { text: 'What is my name?' },
      roomId: 'test-room',
      entityId: 'test-user'
    });

    expect(response.content.text.toLowerCase()).toContain('alice');
  });
});
```

---

## Test Utilities

### Mock Factory
```typescript
// test/utils/mocks.ts
export function createMockRuntime(overrides = {}) {
  return {
    agentId: 'test-agent',
    getSetting: (key: string) => process.env[key],
    getMemories: async () => [],
    searchMemories: async () => [],
    createMemory: async () => 'memory-id',
    completion: async () => 'Mock response',
    embed: async () => new Array(1536).fill(0),
    getEntity: async () => ({ name: 'User', metadata: {} }),
    getService: () => null,
    ...overrides,
  };
}

export function createMockMessage(text: string, overrides = {}) {
  return {
    content: { text },
    roomId: 'test-room',
    entityId: 'test-user',
    ...overrides,
  };
}

export function createMockState(overrides = {}) {
  return {
    text: '',
    values: {},
    data: {},
    ...overrides,
  };
}
```

### Test Fixtures
```typescript
// test/fixtures/characters.ts
export const minimalCharacter = {
  name: 'TestBot',
  bio: 'A test bot',
};

export const fullCharacter = {
  name: 'FullBot',
  bio: ['Line 1', 'Line 2'],
  lore: ['Fact 1', 'Fact 2'],
  adjectives: ['helpful'],
  topics: ['testing'],
  style: {
    all: ['be concise'],
    chat: ['be friendly'],
    post: ['be engaging'],
  },
  messageExamples: [[
    { name: '{{user}}', content: { text: 'Hello' } },
    { name: 'FullBot', content: { text: 'Hi there!' } },
  ]],
};
```

---

## Best Practices

1. **Test validation separately from handlers** — they have different concerns
2. **Mock external APIs** — don't hit real APIs in unit tests
3. **Test error cases** — ensure graceful degradation
4. **Use meaningful assertions** — not just "exists"
5. **Keep tests fast** — mock expensive operations
6. **Test personality consistency** — ensure character traits are reflected
7. **Isolate tests** — each test should be independent
