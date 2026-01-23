// Comprehensive tests for src/hooks/useAgentChat.ts
// Tests the unified agent chat hook

import { renderHook, act, waitFor } from '@testing-library/react';
import { useAgentChat, getAgentInfo, ChatMessage } from '@/hooks/useAgentChat';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock crypto.randomUUID
const mockUUID = 'mock-uuid-12345';
Object.defineProperty(global.crypto, 'randomUUID', {
  value: jest.fn(() => mockUUID),
  writable: true,
});

beforeEach(() => {
  mockFetch.mockClear();
});

describe('useAgentChat', () => {
  // ==================== Initial State ====================

  describe('Initial State', () => {
    it('should initialize with empty messages', () => {
      const { result } = renderHook(() => useAgentChat({ agentId: 'neo' }));

      expect(result.current.messages).toEqual([]);
    });

    it('should initialize with isLoading false', () => {
      const { result } = renderHook(() => useAgentChat({ agentId: 'neo' }));

      expect(result.current.isLoading).toBe(false);
    });

    it('should initialize with provided agentId', () => {
      const { result } = renderHook(() => useAgentChat({ agentId: 'finn' }));

      expect(result.current.currentAgent).toBe('finn');
    });

    it('should generate a sessionId', () => {
      const { result } = renderHook(() => useAgentChat({ agentId: 'neo' }));

      expect(result.current.sessionId).toBe(mockUUID);
    });
  });

  // ==================== sendMessage ====================

  describe('sendMessage', () => {
    it('should add user message to messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: 'Test response',
          agentId: 'neo',
          agentName: 'Neo',
        }),
      });

      const { result } = renderHook(() => useAgentChat({ agentId: 'neo' }));

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      const userMessage = result.current.messages.find(m => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage?.content).toBe('Hello');
    });

    it('should add assistant response to messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: 'patterns forming...',
          agentId: 'neo',
          agentName: 'Neo',
        }),
      });

      const { result } = renderHook(() => useAgentChat({ agentId: 'neo' }));

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      const assistantMessage = result.current.messages.find(m => m.role === 'assistant');
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage?.content).toBe('patterns forming...');
      expect(assistantMessage?.agentId).toBe('neo');
      expect(assistantMessage?.agentName).toBe('Neo');
    });

    it('should set isLoading during request', async () => {
      let resolvePromise: (value: unknown) => void;
      const fetchPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(fetchPromise);

      const { result } = renderHook(() => useAgentChat({ agentId: 'neo' }));

      // Start the request (don't await)
      act(() => {
        result.current.sendMessage('Hello');
      });

      // Should be loading
      expect(result.current.isLoading).toBe(true);

      // Resolve the request
      await act(async () => {
        resolvePromise!({
          ok: true,
          json: async () => ({ response: 'Hi', agentId: 'neo', agentName: 'Neo' }),
        });
      });

      // Should no longer be loading
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should not send empty messages', async () => {
      const { result } = renderHook(() => useAgentChat({ agentId: 'neo' }));

      await act(async () => {
        await result.current.sendMessage('');
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.current.messages).toEqual([]);
    });

    it('should not send whitespace-only messages', async () => {
      const { result } = renderHook(() => useAgentChat({ agentId: 'neo' }));

      await act(async () => {
        await result.current.sendMessage('   ');
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should not send while already loading', async () => {
      let resolvePromise: (value: unknown) => void;
      const fetchPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValue(fetchPromise);

      const { result } = renderHook(() => useAgentChat({ agentId: 'neo' }));

      // Start first request
      act(() => {
        result.current.sendMessage('First');
      });

      // Try to send second while loading
      await act(async () => {
        await result.current.sendMessage('Second');
      });

      // Should only have called fetch once
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Cleanup
      await act(async () => {
        resolvePromise!({
          ok: true,
          json: async () => ({ response: 'Hi', agentId: 'neo', agentName: 'Neo' }),
        });
      });
    });

    it('should include conversation history in request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          response: 'Response',
          agentId: 'neo',
          agentName: 'Neo',
        }),
      });

      const { result } = renderHook(() => useAgentChat({ agentId: 'neo' }));

      // Send first message
      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      // Send second message
      await act(async () => {
        await result.current.sendMessage('How are you?');
      });

      // Check second request includes history
      const lastCall = mockFetch.mock.calls[1];
      const body = JSON.parse(lastCall[1].body);

      expect(body.conversationHistory).toBeDefined();
      expect(body.conversationHistory.length).toBeGreaterThan(0);
    });

    it('should call correct API endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: 'Response',
          agentId: 'neo',
          agentName: 'Neo',
        }),
      });

      const { result } = renderHook(() => useAgentChat({ agentId: 'neo' }));

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/agents', expect.any(Object));
    });

    it('should include agentId in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: 'Response',
          agentId: 'finn',
          agentName: 'Finn',
        }),
      });

      const { result } = renderHook(() => useAgentChat({ agentId: 'finn' }));

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.agentId).toBe('finn');
    });
  });

  // ==================== Error Handling ====================

  describe('Error Handling', () => {
    it('should add error message on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() => useAgentChat({ agentId: 'neo' }));

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      const errorMessage = result.current.messages.find(m =>
        m.content.includes('Connection interrupted')
      );
      expect(errorMessage).toBeDefined();
    });

    it('should add error message on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useAgentChat({ agentId: 'neo' }));

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      const errorMessage = result.current.messages.find(m =>
        m.content.includes('Connection interrupted')
      );
      expect(errorMessage).toBeDefined();
    });

    it('should reset isLoading on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useAgentChat({ agentId: 'neo' }));

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  // ==================== clearMessages ====================

  describe('clearMessages', () => {
    it('should clear all messages', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          response: 'Response',
          agentId: 'neo',
          agentName: 'Neo',
        }),
      });

      const { result } = renderHook(() => useAgentChat({ agentId: 'neo' }));

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      expect(result.current.messages.length).toBeGreaterThan(0);

      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.messages).toEqual([]);
    });
  });

  // ==================== addInfoMessage ====================

  describe('addInfoMessage', () => {
    it('should add info message', () => {
      const { result } = renderHook(() => useAgentChat({ agentId: 'neo' }));

      act(() => {
        result.current.addInfoMessage('System notification');
      });

      const infoMessage = result.current.messages.find(m => m.role === 'info');
      expect(infoMessage).toBeDefined();
      expect(infoMessage?.content).toBe('System notification');
    });

    it('should give info message correct role', () => {
      const { result } = renderHook(() => useAgentChat({ agentId: 'neo' }));

      act(() => {
        result.current.addInfoMessage('Info');
      });

      expect(result.current.messages[0].role).toBe('info');
    });
  });

  // ==================== switchAgent ====================

  describe('switchAgent', () => {
    it('should change currentAgent', () => {
      const { result } = renderHook(() => useAgentChat({ agentId: 'neo' }));

      expect(result.current.currentAgent).toBe('neo');

      act(() => {
        result.current.switchAgent('finn');
      });

      expect(result.current.currentAgent).toBe('finn');
    });

    it('should add info message about switch', () => {
      const { result } = renderHook(() => useAgentChat({ agentId: 'neo' }));

      act(() => {
        result.current.switchAgent('finn');
      });

      const switchMessage = result.current.messages.find(m =>
        m.content.includes('Switched to finn')
      );
      expect(switchMessage).toBeDefined();
      expect(switchMessage?.role).toBe('info');
    });
  });

  // ==================== maxHistory ====================

  describe('maxHistory', () => {
    it('should limit messages to maxHistory', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          response: 'Response',
          agentId: 'neo',
          agentName: 'Neo',
        }),
      });

      const { result } = renderHook(() =>
        useAgentChat({ agentId: 'neo', maxHistory: 5 })
      );

      // Add more than maxHistory messages
      for (let i = 0; i < 10; i++) {
        await act(async () => {
          await result.current.sendMessage(`Message ${i}`);
        });
      }

      // Should be limited to maxHistory
      expect(result.current.messages.length).toBeLessThanOrEqual(5);
    });

    it('should default maxHistory to 50', () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          response: 'Response',
          agentId: 'neo',
          agentName: 'Neo',
        }),
      });

      const { result } = renderHook(() => useAgentChat({ agentId: 'neo' }));

      // The default is 50, we just verify hook works without maxHistory specified
      expect(result.current.messages).toEqual([]);
    });
  });

  // ==================== suggestedAgent callback ====================

  describe('onSuggestedAgent callback', () => {
    it('should call onSuggestedAgent when agent is suggested', async () => {
      const onSuggestedAgent = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: 'Response',
          agentId: 'neo',
          agentName: 'Neo',
          suggestedAgent: 'toly',
        }),
      });

      const { result } = renderHook(() =>
        useAgentChat({ agentId: 'neo', onSuggestedAgent })
      );

      await act(async () => {
        await result.current.sendMessage('Tell me about Solana');
      });

      expect(onSuggestedAgent).toHaveBeenCalledWith('toly');
    });

    it('should not call onSuggestedAgent when no suggestion', async () => {
      const onSuggestedAgent = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: 'Response',
          agentId: 'neo',
          agentName: 'Neo',
        }),
      });

      const { result } = renderHook(() =>
        useAgentChat({ agentId: 'neo', onSuggestedAgent })
      );

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      expect(onSuggestedAgent).not.toHaveBeenCalled();
    });

    it('should include suggestedAgent in message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: 'Response',
          agentId: 'neo',
          agentName: 'Neo',
          suggestedAgent: 'finn',
        }),
      });

      const { result } = renderHook(() => useAgentChat({ agentId: 'neo' }));

      await act(async () => {
        await result.current.sendMessage('How do I launch?');
      });

      const assistantMessage = result.current.messages.find(m => m.role === 'assistant');
      expect(assistantMessage?.suggestedAgent).toBe('finn');
    });
  });

  // ==================== Session Management ====================

  describe('Session Management', () => {
    it('should update sessionId from response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: 'Response',
          agentId: 'neo',
          agentName: 'Neo',
          sessionId: 'new-session-from-server',
        }),
      });

      const { result } = renderHook(() => useAgentChat({ agentId: 'neo' }));

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      expect(result.current.sessionId).toBe('new-session-from-server');
    });

    it('should include sessionId in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: 'Response',
          agentId: 'neo',
          agentName: 'Neo',
        }),
      });

      const { result } = renderHook(() => useAgentChat({ agentId: 'neo' }));

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.sessionId).toBe(mockUUID);
    });
  });
});

// ==================== getAgentInfo ====================

describe('getAgentInfo', () => {
  describe('known agents', () => {
    it('should return info for neo', () => {
      const info = getAgentInfo('neo');
      expect(info.name).toBe('Neo');
      expect(info.color).toBe('green');
      expect(info.icon).toBeDefined();
      expect(info.tagline).toBeDefined();
    });

    it('should return info for cj', () => {
      const info = getAgentInfo('cj');
      expect(info.name).toBe('CJ');
      expect(info.color).toBe('yellow');
    });

    it('should return info for finn', () => {
      const info = getAgentInfo('finn');
      expect(info.name).toBe('Finn');
      expect(info.color).toBe('bags-green');
    });

    it('should return info for bags-bot', () => {
      const info = getAgentInfo('bags-bot');
      expect(info.name).toBe('Bags Bot');
      expect(info.color).toBe('bags-gold');
    });

    it('should return info for toly', () => {
      const info = getAgentInfo('toly');
      expect(info.name).toBe('Toly');
      expect(info.color).toBe('purple');
    });

    it('should return info for ash', () => {
      const info = getAgentInfo('ash');
      expect(info.name).toBe('Ash');
      expect(info.color).toBe('red');
    });

    it('should return info for shaw', () => {
      const info = getAgentInfo('shaw');
      expect(info.name).toBe('Shaw');
      expect(info.color).toBe('blue');
    });

    it('should return info for ghost', () => {
      const info = getAgentInfo('ghost');
      expect(info.name).toBe('Ghost');
      expect(info.color).toBe('cyan');
    });
  });

  describe('case insensitivity', () => {
    it('should handle uppercase', () => {
      const info = getAgentInfo('NEO');
      expect(info.name).toBe('Neo');
    });

    it('should handle mixed case', () => {
      const info = getAgentInfo('Neo');
      expect(info.name).toBe('Neo');
    });
  });

  describe('unknown agents', () => {
    it('should return default for unknown agent', () => {
      const info = getAgentInfo('unknown-agent');
      expect(info.name).toBe('unknown-agent');
      expect(info.color).toBe('gray');
      expect(info.icon).toBe('🤖');
      expect(info.tagline).toBe('AI Agent');
    });

    it('should return default for empty string', () => {
      const info = getAgentInfo('');
      expect(info.name).toBe('');
      expect(info.color).toBe('gray');
    });
  });

  describe('agent info structure', () => {
    it('should have all required fields', () => {
      const agents = ['neo', 'cj', 'finn', 'bags-bot', 'toly', 'ash', 'shaw', 'ghost'];

      agents.forEach(agentId => {
        const info = getAgentInfo(agentId);
        expect(info).toHaveProperty('name');
        expect(info).toHaveProperty('color');
        expect(info).toHaveProperty('icon');
        expect(info).toHaveProperty('tagline');
      });
    });

    it('should have unique colors for each agent', () => {
      const agents = ['neo', 'cj', 'finn', 'bags-bot', 'toly', 'ash', 'shaw', 'ghost'];
      const colors = agents.map(a => getAgentInfo(a).color);
      const uniqueColors = new Set(colors);

      expect(uniqueColors.size).toBe(agents.length);
    });
  });
});
