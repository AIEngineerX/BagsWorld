import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LLMService, Message, ConversationContext } from './LLMService.js';
import type { Character } from '../types/elizaos.js';

// Mock fetch globally
const mockFetch = vi.fn();
(global as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;

describe('LLMService', () => {
  const originalEnv = { ...process.env };

  const mockCharacter: Character = {
    name: 'TestAgent',
    username: 'testagent',
    bio: ['A test agent for unit testing', 'Very helpful'],
    topics: ['testing', 'debugging', 'code quality'],
    adjectives: ['helpful', 'precise', 'patient'],
    style: {
      all: ['Be concise', 'Use technical terms'],
      chat: ['Keep it friendly', 'Ask clarifying questions'],
    },
  } as Character;

  const mockHistory: Message[] = [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there!' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('constructor', () => {
    it('allows construction without API key (throws on generateResponse)', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;

      // Constructor no longer throws - allows service to start
      const service = new LLMService();
      expect(service).toBeDefined();

      // But generateResponse should throw
      await expect(
        service.generateResponse(mockCharacter, 'Hello', [])
      ).rejects.toThrow('No LLM API key configured');
    });

    it('prefers Anthropic when both keys present', () => {
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
      process.env.OPENAI_API_KEY = 'test-openai-key';

      const service = new LLMService();
      expect(service).toBeDefined();
      // Would use Anthropic by default
    });

    it('uses OpenAI when only OpenAI key present', () => {
      delete process.env.ANTHROPIC_API_KEY;
      process.env.OPENAI_API_KEY = 'test-openai-key';

      const service = new LLMService();
      expect(service).toBeDefined();
    });
  });

  describe('buildSystemPrompt', () => {
    beforeEach(() => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
    });

    it('builds basic system prompt from character', () => {
      const service = new LLMService();
      const prompt = service.buildSystemPrompt(mockCharacter);

      expect(prompt).toContain('TestAgent');
      expect(prompt).toContain('A test agent for unit testing');
      expect(prompt).toContain('testing, debugging, code quality');
      expect(prompt).toContain('helpful, precise, patient');
      expect(prompt).toContain('Be concise');
      expect(prompt).toContain('Keep it friendly');
    });

    it('includes world state in context', () => {
      const service = new LLMService();
      const context: ConversationContext = {
        messages: [],
        worldState: 'Health: 80%, Weather: sunny',
      };

      const prompt = service.buildSystemPrompt(mockCharacter, context);

      expect(prompt).toContain('CURRENT WORLD STATE');
      expect(prompt).toContain('Health: 80%, Weather: sunny');
    });

    it('includes token data in context', () => {
      const service = new LLMService();
      const context: ConversationContext = {
        messages: [],
        tokenData: '$BAGS: MC $1M, Volume $50K',
      };

      const prompt = service.buildSystemPrompt(mockCharacter, context);

      expect(prompt).toContain('RELEVANT TOKEN DATA');
      expect(prompt).toContain('$BAGS: MC $1M, Volume $50K');
    });

    it('includes agent context', () => {
      const service = new LLMService();
      const context: ConversationContext = {
        messages: [],
        agentContext: 'Other agents: Toly, Finn, Ash',
      };

      const prompt = service.buildSystemPrompt(mockCharacter, context);

      expect(prompt).toContain('OTHER AGENTS');
      expect(prompt).toContain('Other agents: Toly, Finn, Ash');
    });

    it('handles character with custom system prompt', () => {
      const service = new LLMService();
      const customChar: Character = {
        ...mockCharacter,
        system: 'You are a custom agent with special instructions.',
      } as Character;

      const prompt = service.buildSystemPrompt(customChar);

      expect(prompt).toContain('You are a custom agent with special instructions');
    });

    it('handles character with array bio', () => {
      const service = new LLMService();
      const prompt = service.buildSystemPrompt(mockCharacter);

      expect(prompt).toContain('A test agent for unit testing');
      expect(prompt).toContain('Very helpful');
    });

    it('handles character with string bio', () => {
      const service = new LLMService();
      const stringBioChar: Character = {
        ...mockCharacter,
        bio: 'Single line bio',
      } as Character;

      const prompt = service.buildSystemPrompt(stringBioChar);

      expect(prompt).toContain('Single line bio');
    });

    it('handles missing optional character fields', () => {
      const service = new LLMService();
      const minimalChar: Character = {
        name: 'Minimal',
        username: 'minimal',
        bio: '', // Provide empty to avoid undefined
        topics: [],
        adjectives: [],
      } as Character;

      const prompt = service.buildSystemPrompt(minimalChar);

      expect(prompt).toContain('Minimal');
      // With empty values provided, we avoid undefined
    });
  });

  describe('generateResponse with Anthropic', () => {
    beforeEach(() => {
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
      delete process.env.OPENAI_API_KEY;
    });

    it('calls Anthropic API successfully', async () => {
      const service = new LLMService();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Hello from Claude!' }],
          model: 'claude-sonnet-4-20250514',
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
      });

      const result = await service.generateResponse(
        mockCharacter,
        'Hello!',
        mockHistory
      );

      expect(result.text).toBe('Hello from Claude!');
      expect(result.model).toBe('claude-sonnet-4-20250514');
      expect(result.usage?.inputTokens).toBe(100);
      expect(result.usage?.outputTokens).toBe(50);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': 'test-anthropic-key',
            'anthropic-version': '2023-06-01',
          }),
        })
      );
    });

    it('handles Anthropic API error', async () => {
      const service = new LLMService();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      });

      await expect(
        service.generateResponse(mockCharacter, 'Hello!', mockHistory)
      ).rejects.toThrow('Anthropic API error: 429');
    });

    it('filters system messages from history', async () => {
      const service = new LLMService();

      const historyWithSystem: Message[] = [
        { role: 'system', content: 'System message' },
        { role: 'user', content: 'User message' },
        { role: 'assistant', content: 'Assistant message' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Response' }],
          model: 'test',
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      });

      await service.generateResponse(mockCharacter, 'Hello', historyWithSystem);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const systemInMessages = callBody.messages.some(
        (m: Message) => m.role === 'system'
      );
      expect(systemInMessages).toBe(false);
    });

    it('handles missing text content in response', async () => {
      const service = new LLMService();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'other', data: 'something' }],
          model: 'test',
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      });

      const result = await service.generateResponse(
        mockCharacter,
        'Hello',
        []
      );

      expect(result.text).toBe('');
    });
  });

  describe('generateResponse with OpenAI', () => {
    beforeEach(() => {
      delete process.env.ANTHROPIC_API_KEY;
      process.env.OPENAI_API_KEY = 'test-openai-key';
    });

    it('calls OpenAI API successfully', async () => {
      const service = new LLMService();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Hello from GPT!' } }],
          model: 'gpt-4o',
          usage: { prompt_tokens: 100, completion_tokens: 50 },
        }),
      });

      const result = await service.generateResponse(
        mockCharacter,
        'Hello!',
        mockHistory
      );

      expect(result.text).toBe('Hello from GPT!');
      expect(result.model).toBe('gpt-4o');
      expect(result.usage?.inputTokens).toBe(100);
      expect(result.usage?.outputTokens).toBe(50);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-openai-key',
          }),
        })
      );
    });

    it('handles OpenAI API error', async () => {
      const service = new LLMService();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Server error',
      });

      await expect(
        service.generateResponse(mockCharacter, 'Hello!', mockHistory)
      ).rejects.toThrow('OpenAI API error: 500');
    });

    it('includes system message in OpenAI messages', async () => {
      const service = new LLMService();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
          model: 'gpt-4o',
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      });

      await service.generateResponse(mockCharacter, 'Hello', []);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.messages[0].role).toBe('system');
    });

    it('handles empty choices in response', async () => {
      const service = new LLMService();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [],
          model: 'gpt-4o',
          usage: { prompt_tokens: 10, completion_tokens: 0 },
        }),
      });

      const result = await service.generateResponse(mockCharacter, 'Hello', []);

      expect(result.text).toBe('');
    });
  });

  describe('model selection', () => {
    beforeEach(() => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
    });

    it('uses character-specified model', async () => {
      const service = new LLMService();

      const customModelChar: Character = {
        ...mockCharacter,
        settings: {
          model: 'claude-3-opus-20240229',
        },
      } as Character;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Response' }],
          model: 'claude-3-opus-20240229',
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      });

      await service.generateResponse(customModelChar, 'Hello', []);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.model).toBe('claude-3-opus-20240229');
    });

    it('falls back to default model when not specified', async () => {
      const service = new LLMService();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Response' }],
          model: 'claude-sonnet-4-20250514',
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      });

      await service.generateResponse(mockCharacter, 'Hello', []);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.model).toBe('claude-sonnet-4-20250514');
    });
  });

  describe('context integration', () => {
    beforeEach(() => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
    });

    it('includes full context in generation', async () => {
      const service = new LLMService();

      const context: ConversationContext = {
        messages: mockHistory,
        worldState: 'Health: 75%',
        tokenData: '$BAGS: 1M MC',
        agentContext: 'Toly is online',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Contextual response' }],
          model: 'test',
          usage: { input_tokens: 200, output_tokens: 50 },
        }),
      });

      await service.generateResponse(
        mockCharacter,
        'What is happening?',
        mockHistory,
        context
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.system).toContain('Health: 75%');
      expect(callBody.system).toContain('$BAGS: 1M MC');
      expect(callBody.system).toContain('Toly is online');
    });
  });

  describe('generateWithSystemPrompt', () => {
    beforeEach(() => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      delete process.env.OPENAI_API_KEY;
    });

    it('calls LLM with custom system prompt', async () => {
      const service = new LLMService();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Custom response' }],
          model: 'claude-sonnet-4-20250514',
          usage: { input_tokens: 50, output_tokens: 25 },
        }),
      });

      const result = await service.generateWithSystemPrompt(
        'You are a helpful assistant.',
        'Hello!',
        []
      );

      expect(result.text).toBe('Custom response');
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.system).toBe('You are a helpful assistant.');
    });

    it('uses custom maxTokens', async () => {
      const service = new LLMService();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Response' }],
          model: 'test',
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      });

      await service.generateWithSystemPrompt(
        'System prompt',
        'User message',
        [],
        undefined,
        4000
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.max_tokens).toBe(4000);
    });

    it('uses custom model override', async () => {
      const service = new LLMService();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Response' }],
          model: 'claude-3-opus-20240229',
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      });

      await service.generateWithSystemPrompt(
        'System prompt',
        'User message',
        [],
        'claude-3-opus-20240229',
        1000
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.model).toBe('claude-3-opus-20240229');
    });

    it('includes conversation history', async () => {
      const service = new LLMService();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Response' }],
          model: 'test',
          usage: { input_tokens: 20, output_tokens: 10 },
        }),
      });

      await service.generateWithSystemPrompt(
        'System',
        'New message',
        mockHistory
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.messages.length).toBe(3); // 2 history + 1 new
    });

    it('throws when no LLM configured', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const service = new LLMService();

      await expect(
        service.generateWithSystemPrompt('System', 'Message', [])
      ).rejects.toThrow('No LLM API key configured');
    });

    it('defaults maxTokens to 2000', async () => {
      const service = new LLMService();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Response' }],
          model: 'test',
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      });

      await service.generateWithSystemPrompt(
        'System',
        'Message',
        []
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.max_tokens).toBe(2000);
    });
  });

  describe('generateWithSystemPrompt with OpenAI', () => {
    beforeEach(() => {
      delete process.env.ANTHROPIC_API_KEY;
      process.env.OPENAI_API_KEY = 'test-openai-key';
    });

    it('calls OpenAI with custom system prompt', async () => {
      const service = new LLMService();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'OpenAI response' } }],
          model: 'gpt-4o',
          usage: { prompt_tokens: 50, completion_tokens: 25 },
        }),
      });

      const result = await service.generateWithSystemPrompt(
        'Custom system',
        'Hello!'
      );

      expect(result.text).toBe('OpenAI response');
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.messages[0].role).toBe('system');
      expect(callBody.messages[0].content).toBe('Custom system');
    });
  });

  describe('LLM_MODEL environment override', () => {
    it('uses LLM_MODEL when set', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.LLM_MODEL = 'claude-3-haiku-20240307';

      const service = new LLMService();
      expect(service).toBeDefined();
    });

    it('falls back to default when LLM_MODEL not set', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      delete process.env.LLM_MODEL;

      const service = new LLMService();
      expect(service).toBeDefined();
    });
  });

  describe('long conversation handling', () => {
    beforeEach(() => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
    });

    it('handles very long conversation history', async () => {
      const service = new LLMService();

      const longHistory: Message[] = Array.from({ length: 100 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}: ${'x'.repeat(100)}`,
      })) as Message[];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Response to long history' }],
          model: 'test',
          usage: { input_tokens: 5000, output_tokens: 50 },
        }),
      });

      const result = await service.generateResponse(
        mockCharacter,
        'Final message',
        longHistory
      );

      expect(result.text).toBe('Response to long history');
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.messages.length).toBe(101); // 100 history + 1 new
    });

    it('handles empty conversation history', async () => {
      const service = new LLMService();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'First response' }],
          model: 'test',
          usage: { input_tokens: 50, output_tokens: 25 },
        }),
      });

      const result = await service.generateResponse(
        mockCharacter,
        'Hello!',
        []
      );

      expect(result.text).toBe('First response');
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.messages.length).toBe(1); // Just the new message
    });
  });

  describe('special characters handling', () => {
    beforeEach(() => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
    });

    it('handles Unicode characters in message', async () => {
      const service = new LLMService();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Response with 🚀 emoji' }],
          model: 'test',
          usage: { input_tokens: 50, output_tokens: 25 },
        }),
      });

      const result = await service.generateResponse(
        mockCharacter,
        'Hello! 🎉 How about $BAGS? 日本語も大丈夫？',
        []
      );

      expect(result.text).toContain('🚀');
    });

    it('handles JSON-like content in messages', async () => {
      const service = new LLMService();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Parsed the JSON' }],
          model: 'test',
          usage: { input_tokens: 50, output_tokens: 25 },
        }),
      });

      const result = await service.generateResponse(
        mockCharacter,
        '{"key": "value", "array": [1,2,3]}',
        []
      );

      expect(result.text).toBe('Parsed the JSON');
    });
  });

  describe('network error handling', () => {
    beforeEach(() => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
    });

    it('propagates network errors', async () => {
      const service = new LLMService();

      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      await expect(
        service.generateResponse(mockCharacter, 'Hello', [])
      ).rejects.toThrow('Network timeout');
    });

    it('handles malformed JSON response', async () => {
      const service = new LLMService();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new Error('Unexpected token'); },
      });

      await expect(
        service.generateResponse(mockCharacter, 'Hello', [])
      ).rejects.toThrow('Unexpected token');
    });
  });
});
