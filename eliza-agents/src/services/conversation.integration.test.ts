// Integration test for conversation memory flow
// Tests that the refactored services properly handle conversation history

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Character, IAgentRuntime, Memory, State } from '../types/elizaos.js';
import { LLMService, Message, ConversationContext } from './LLMService.js';
import { BagsApiService } from './BagsApiService.js';
import { worldStateProvider } from '../providers/worldState.js';
import { tokenDataProvider } from '../providers/tokenData.js';
import { agentContextProvider } from '../providers/agentContext.js';

// Mock fetch globally
const mockFetch = vi.fn();
(global as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;

// Test character
const testCharacter: Character = {
  name: 'TestBot',
  username: 'testbot',
  bio: ['A test bot for integration testing'],
  topics: ['testing', 'integration'],
  adjectives: ['helpful', 'precise'],
  style: {
    all: ['Be concise'],
    chat: ['Be friendly'],
  },
} as Character;

// Helper to create a mock runtime with getService
function createMockRuntimeWithService(
  character: Character,
  services: Map<string, unknown> = new Map()
): IAgentRuntime {
  return {
    character,
    agentId: character.name.toLowerCase(),
    getService: vi.fn((serviceType: string) => services.get(serviceType)),
    getSetting: vi.fn((key: string) => {
      const settings: Record<string, string> = {
        'ANTHROPIC_API_KEY': 'test-key',
        'BAGS_API_URL': 'https://test-api.bags.fm',
      };
      return settings[key];
    }),
  } as unknown as IAgentRuntime;
}

describe('Conversation Memory Integration', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('LLMService with conversation history', () => {
    it('passes conversation history to API call', async () => {
      const llmService = new LLMService();

      const conversationHistory: Message[] = [
        { role: 'user', content: 'Hello!' },
        { role: 'assistant', content: 'Hi there! How can I help?' },
        { role: 'user', content: 'What is Bags.fm?' },
        { role: 'assistant', content: 'Bags.fm is a token launchpad on Solana.' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Based on our conversation...' }],
          model: 'claude-sonnet-4-20250514',
          usage: { input_tokens: 500, output_tokens: 100 },
        }),
      });

      const response = await llmService.generateResponse(
        testCharacter,
        'Tell me more about fees',
        conversationHistory
      );

      expect(response.text).toBe('Based on our conversation...');

      // Verify history was included in API call
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.messages).toHaveLength(5); // 4 history + 1 new message
      expect(callBody.messages[0].content).toBe('Hello!');
      expect(callBody.messages[3].content).toBe('Bags.fm is a token launchpad on Solana.');
      expect(callBody.messages[4].content).toBe('Tell me more about fees');
    });

    it('includes context in system prompt', async () => {
      const llmService = new LLMService();

      const context: ConversationContext = {
        messages: [],
        worldState: 'Health: 85%, Weather: sunny',
        tokenData: '$BAGS: MC $5M, Volume $500K',
        agentContext: 'Other agents: Toly, Finn, Ash',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'The world is thriving!' }],
          model: 'claude-sonnet-4-20250514',
          usage: { input_tokens: 200, output_tokens: 50 },
        }),
      });

      await llmService.generateResponse(
        testCharacter,
        'How is the world doing?',
        [],
        context
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.system).toContain('Health: 85%, Weather: sunny');
      expect(callBody.system).toContain('$BAGS: MC $5M, Volume $500K');
      expect(callBody.system).toContain('Other agents: Toly, Finn, Ash');
    });

    it('maintains conversation state across multiple calls', async () => {
      const llmService = new LLMService();
      const history: Message[] = [];

      // First turn
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Hello! I am TestBot.' }],
          model: 'test',
          usage: { input_tokens: 50, output_tokens: 20 },
        }),
      });

      const response1 = await llmService.generateResponse(
        testCharacter,
        'Hi, who are you?',
        history
      );

      // Add to history
      history.push({ role: 'user', content: 'Hi, who are you?' });
      history.push({ role: 'assistant', content: response1.text });

      // Second turn
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'I specialize in testing and integration.' }],
          model: 'test',
          usage: { input_tokens: 100, output_tokens: 30 },
        }),
      });

      await llmService.generateResponse(
        testCharacter,
        'What do you specialize in?',
        history
      );

      // Verify second call includes full history
      const secondCallBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(secondCallBody.messages).toHaveLength(3);
      expect(secondCallBody.messages[0].content).toBe('Hi, who are you?');
      expect(secondCallBody.messages[1].content).toBe('Hello! I am TestBot.');
      expect(secondCallBody.messages[2].content).toBe('What do you specialize in?');
    });
  });

  describe('Service retrieval via runtime.getService()', () => {
    it('actions can retrieve BagsApiService from runtime', () => {
      const bagsService = new BagsApiService({ baseUrl: 'https://test.api' });
      const services = new Map<string, unknown>([
        [BagsApiService.serviceType, bagsService],
      ]);

      const runtime = createMockRuntimeWithService(testCharacter, services);
      const retrievedService = runtime.getService(BagsApiService.serviceType);

      expect(retrievedService).toBe(bagsService);
    });

    it('actions can retrieve LLMService from runtime', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      const llmService = new LLMService();
      const services = new Map<string, unknown>([
        [LLMService.serviceType, llmService],
      ]);

      const runtime = createMockRuntimeWithService(testCharacter, services);
      const retrievedService = runtime.getService(LLMService.serviceType);

      expect(retrievedService).toBe(llmService);
    });

    it('returns undefined when service not registered', () => {
      const runtime = createMockRuntimeWithService(testCharacter);
      const service = runtime.getService('nonexistent');

      expect(service).toBeUndefined();
    });
  });

  describe('Context building for conversations', () => {
    it('worldStateProvider injects health data', async () => {
      // Mock BagsApiService response
      const mockBagsService = {
        getWorldHealth: vi.fn().mockResolvedValue({
          health: 75,
          weather: 'cloudy',
          totalVolume24h: 1000000,
          totalFees24h: 250,
          activeTokens: 50,
          topCreators: [],
        }),
      };

      const services = new Map<string, unknown>([
        [BagsApiService.serviceType, mockBagsService],
      ]);

      const runtime = createMockRuntimeWithService(testCharacter, services);
      const memory: Memory = {
        id: 'test',
        content: { text: 'test message' },
        userId: 'user',
        agentId: 'agent',
        roomId: 'room',
        entityId: 'entity',
      } as Memory;
      const state = {} as State;

      const result = await worldStateProvider.get(runtime, memory, state);

      expect(result.text).toContain('75%');
      expect(result.text).toContain('HEALTHY');
      expect(result.values?.worldHealth).toBe(75);
    });

    it('agentContextProvider provides cross-agent awareness', async () => {
      const runtime = createMockRuntimeWithService(testCharacter);
      const memory: Memory = {
        id: 'test',
        content: { text: 'What does Finn think about this?' },
        userId: 'user',
        agentId: 'agent',
        roomId: 'room',
        entityId: 'entity',
      } as Memory;
      const state = {} as State;

      const result = await agentContextProvider.get(runtime, memory, state);

      expect(result.text).toContain('OTHER BAGSWORLD AGENTS');
      expect(result.values?.otherAgentCount).toBeGreaterThan(0);
    });
  });

  describe('Full conversation flow simulation', () => {
    it('simulates multi-turn conversation with context', async () => {
      const llmService = new LLMService();
      const conversationHistory: Message[] = [];

      // Turn 1: User asks about world health
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'The world is at 80% health - THRIVING!' }],
          model: 'test',
          usage: { input_tokens: 100, output_tokens: 30 },
        }),
      });

      const context1: ConversationContext = {
        messages: conversationHistory,
        worldState: 'Health: 80%, Weather: sunny',
      };

      const response1 = await llmService.generateResponse(
        testCharacter,
        'How is the world doing?',
        conversationHistory,
        context1
      );

      // Update history
      conversationHistory.push({ role: 'user', content: 'How is the world doing?' });
      conversationHistory.push({ role: 'assistant', content: response1.text });

      // Turn 2: User asks follow-up
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'The sunny weather indicates high activity!' }],
          model: 'test',
          usage: { input_tokens: 150, output_tokens: 25 },
        }),
      });

      const context2: ConversationContext = {
        messages: conversationHistory,
        worldState: 'Health: 80%, Weather: sunny',
      };

      const response2 = await llmService.generateResponse(
        testCharacter,
        'Why is the weather sunny?',
        conversationHistory,
        context2
      );

      // Verify full conversation flow
      expect(response1.text).toContain('THRIVING');
      expect(response2.text).toContain('sunny');

      // Verify history was used
      const turn2Body = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(turn2Body.messages).toHaveLength(3);
      expect(turn2Body.messages[0].content).toBe('How is the world doing?');
      expect(turn2Body.messages[1].content).toContain('THRIVING');
    });
  });

  describe('Token mention context injection', () => {
    it('tokenDataProvider extracts mentioned tokens', async () => {
      const mockBagsService = {
        getToken: vi.fn().mockResolvedValue({
          mint: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
          name: 'Test Token',
          symbol: 'TEST',
          marketCap: 1000000,
          volume24h: 50000,
          lifetimeFees: 100,
        }),
        searchTokens: vi.fn().mockResolvedValue([]),
        getRecentLaunches: vi.fn().mockResolvedValue([]),
      };

      const services = new Map<string, unknown>([
        [BagsApiService.serviceType, mockBagsService],
      ]);

      const runtime = createMockRuntimeWithService(testCharacter, services);
      const memory: Memory = {
        id: 'test',
        content: { text: 'Check this token 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU' },
        userId: 'user',
        agentId: 'agent',
        roomId: 'room',
        entityId: 'entity',
      } as Memory;
      const state = {} as State;

      const result = await tokenDataProvider.get(runtime, memory, state);

      expect(result.text).toContain('MENTIONED TOKENS');
      expect(result.text).toContain('Test Token');
      expect(result.values?.mentionedTokenCount).toBe(1);
    });
  });
});
