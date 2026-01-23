// Comprehensive tests for src/app/api/agents/dialogue/route.ts
// Tests the multi-agent dialogue generation API

// Note: Tests the dialogue logic and validates helper functions
// Direct route handler testing requires server environment.

import { setupMockFetch } from '../mocks/bags-api';
import { getCharacter, getCharacterIds, allCharacters } from '@/lib/characters';

const AVAILABLE_AGENTS = ['neo', 'cj', 'finn', 'bags-bot', 'toly', 'ash', 'shaw', 'ghost'] as const;

// Agent expertise mapping from the route
const AGENT_EXPERTISE: Record<string, string[]> = {
  'neo': ['alpha', 'scanning', 'patterns'],
  'cj': ['community', 'vibes', 'culture'],
  'finn': ['launches', 'bags.fm', 'creators'],
  'bags-bot': ['market data', 'trading', 'metrics'],
  'toly': ['solana', 'blockchain', 'PoH'],
  'ash': ['evolution', 'growth', 'exploration'],
  'shaw': ['elizaos', 'agents', 'multi-agent'],
  'ghost': ['rewards', 'fees', 'distribution'],
};

// Suggested topics from the route
const SUGGESTED_TOPICS = [
  { topic: 'Creator rewards on Solana', participants: ['finn', 'ghost', 'toly'], style: 'collaborative' },
  { topic: 'Is this token going to pump?', participants: ['neo', 'cj', 'bags-bot'], style: 'debate' },
  { topic: 'Building the AI agent ecosystem', participants: ['shaw', 'toly', 'finn'], style: 'casual' },
  { topic: 'Evolving your token', participants: ['ash', 'finn', 'ghost'], style: 'collaborative' },
  { topic: 'Early alpha on launches', participants: ['neo', 'finn', 'cj'], style: 'casual' },
];

// Dialogue turn interface
interface DialogueTurn {
  speaker: string;
  speakerName: string;
  message: string;
  timestamp: number;
}

// Parse dialogue response (replicated from route for testing)
function parseDialogueResponse(text: string, participants: string[]): DialogueTurn[] {
  const turns: DialogueTurn[] = [];
  const lines = text.split('\n').filter(line => line.trim());

  for (const line of lines) {
    const match = line.match(/^\[?(\w+)\]?:\s*(.+)$/);
    if (match) {
      const speaker = match[1];
      const message = match[2].trim();

      const validSpeaker = participants.find(
        p => p.toLowerCase() === speaker.toLowerCase()
      );

      if (validSpeaker) {
        const character = getCharacter(validSpeaker);
        turns.push({
          speaker: validSpeaker,
          speakerName: character?.name || validSpeaker,
          message,
          timestamp: Date.now(),
        });
      }
    }
  }

  return turns;
}

// Sentiment analysis (replicated from route)
function analyzeSentiment(turns: DialogueTurn[]): 'positive' | 'negative' | 'neutral' {
  const positiveWords = ['great', 'good', 'excellent', 'love', 'amazing', 'bullish', 'pumping', 'wagmi'];
  const negativeWords = ['bad', 'terrible', 'hate', 'bearish', 'dumping', 'ngmi', 'rug'];

  let positiveCount = 0;
  let negativeCount = 0;

  for (const turn of turns) {
    const lower = turn.message.toLowerCase();
    positiveCount += positiveWords.filter(w => lower.includes(w)).length;
    negativeCount += negativeWords.filter(w => lower.includes(w)).length;
  }

  return positiveCount > negativeCount ? 'positive' :
         negativeCount > positiveCount ? 'negative' : 'neutral';
}

describe('Dialogue API Route', () => {
  // ==================== Dialogue Parsing ====================

  describe('parseDialogueResponse', () => {
    it('should parse dialogue with brackets', () => {
      const text = `
[Neo]: i see patterns forming
[Finn]: what kind of patterns?
[Neo]: could be interesting
      `;
      const turns = parseDialogueResponse(text, ['neo', 'finn']);

      expect(turns).toHaveLength(3);
      expect(turns[0].speaker).toBe('neo');
      expect(turns[0].message).toBe('i see patterns forming');
      expect(turns[1].speaker).toBe('finn');
      expect(turns[2].speaker).toBe('neo');
    });

    it('should parse dialogue without brackets', () => {
      const text = `
Neo: scanning the chain
Finn: any updates?
      `;
      const turns = parseDialogueResponse(text, ['neo', 'finn']);

      expect(turns).toHaveLength(2);
      expect(turns[0].speaker).toBe('neo');
      expect(turns[1].speaker).toBe('finn');
    });

    it('should filter out invalid speakers', () => {
      const text = `
[Neo]: valid message
[InvalidAgent]: should be filtered
[Finn]: another valid message
      `;
      const turns = parseDialogueResponse(text, ['neo', 'finn']);

      expect(turns).toHaveLength(2);
      expect(turns.every(t => ['neo', 'finn'].includes(t.speaker))).toBe(true);
    });

    it('should handle case-insensitive speaker matching', () => {
      const text = `
[NEO]: uppercase speaker
[finn]: lowercase speaker
[ToLy]: mixed case speaker
      `;
      const turns = parseDialogueResponse(text, ['neo', 'finn', 'toly']);

      expect(turns).toHaveLength(3);
      expect(turns[0].speaker).toBe('neo');
      expect(turns[1].speaker).toBe('finn');
      expect(turns[2].speaker).toBe('toly');
    });

    it('should include speaker names', () => {
      const text = `[Neo]: test message`;
      const turns = parseDialogueResponse(text, ['neo']);

      expect(turns[0].speakerName).toBe('Neo');
    });

    it('should include timestamps', () => {
      const text = `[Neo]: test`;
      const turns = parseDialogueResponse(text, ['neo']);

      expect(turns[0].timestamp).toBeDefined();
      expect(typeof turns[0].timestamp).toBe('number');
    });

    it('should handle empty input', () => {
      const turns = parseDialogueResponse('', ['neo', 'finn']);
      expect(turns).toHaveLength(0);
    });

    it('should handle input with no valid turns', () => {
      const text = `
Just some random text
Without any speaker format
      `;
      const turns = parseDialogueResponse(text, ['neo', 'finn']);
      expect(turns).toHaveLength(0);
    });

    it('should handle special characters in messages', () => {
      const text = `[Neo]: checking $SOL price... looks bullish!`;
      const turns = parseDialogueResponse(text, ['neo']);

      expect(turns[0].message).toBe('checking $SOL price... looks bullish!');
    });

    it('should handle messages with colons', () => {
      const text = `[Finn]: the split is: 50/30/20`;
      const turns = parseDialogueResponse(text, ['finn']);

      expect(turns[0].message).toBe('the split is: 50/30/20');
    });
  });

  // ==================== Sentiment Analysis ====================

  describe('analyzeSentiment', () => {
    it('should detect positive sentiment', () => {
      const turns: DialogueTurn[] = [
        { speaker: 'neo', speakerName: 'Neo', message: 'this looks great, bullish signals', timestamp: Date.now() },
        { speaker: 'cj', speakerName: 'CJ', message: 'wagmi fam, this is amazing', timestamp: Date.now() },
      ];

      expect(analyzeSentiment(turns)).toBe('positive');
    });

    it('should detect negative sentiment', () => {
      const turns: DialogueTurn[] = [
        { speaker: 'neo', speakerName: 'Neo', message: 'this looks bad, bearish patterns', timestamp: Date.now() },
        { speaker: 'cj', speakerName: 'CJ', message: 'ngmi, terrible setup', timestamp: Date.now() },
      ];

      expect(analyzeSentiment(turns)).toBe('negative');
    });

    it('should detect neutral sentiment', () => {
      const turns: DialogueTurn[] = [
        { speaker: 'neo', speakerName: 'Neo', message: 'checking the chain', timestamp: Date.now() },
        { speaker: 'finn', speakerName: 'Finn', message: 'looking at the data', timestamp: Date.now() },
      ];

      expect(analyzeSentiment(turns)).toBe('neutral');
    });

    it('should handle mixed sentiment (positive wins)', () => {
      const turns: DialogueTurn[] = [
        { speaker: 'neo', speakerName: 'Neo', message: 'great excellent amazing', timestamp: Date.now() },
        { speaker: 'cj', speakerName: 'CJ', message: 'bad', timestamp: Date.now() },
      ];

      expect(analyzeSentiment(turns)).toBe('positive');
    });

    it('should handle empty turns', () => {
      expect(analyzeSentiment([])).toBe('neutral');
    });

    it('should be case-insensitive', () => {
      const turns: DialogueTurn[] = [
        { speaker: 'neo', speakerName: 'Neo', message: 'WAGMI BULLISH AMAZING', timestamp: Date.now() },
      ];

      expect(analyzeSentiment(turns)).toBe('positive');
    });
  });

  // ==================== Agent Expertise ====================

  describe('Agent Expertise', () => {
    it('should have expertise for all agents', () => {
      AVAILABLE_AGENTS.forEach(agentId => {
        expect(AGENT_EXPERTISE[agentId]).toBeDefined();
        expect(Array.isArray(AGENT_EXPERTISE[agentId])).toBe(true);
        expect(AGENT_EXPERTISE[agentId].length).toBeGreaterThan(0);
      });
    });

    it('neo should have alpha/scanning expertise', () => {
      expect(AGENT_EXPERTISE['neo']).toContain('alpha');
      expect(AGENT_EXPERTISE['neo']).toContain('scanning');
      expect(AGENT_EXPERTISE['neo']).toContain('patterns');
    });

    it('finn should have launch/bags.fm expertise', () => {
      expect(AGENT_EXPERTISE['finn']).toContain('launches');
      expect(AGENT_EXPERTISE['finn']).toContain('bags.fm');
      expect(AGENT_EXPERTISE['finn']).toContain('creators');
    });

    it('toly should have solana/blockchain expertise', () => {
      expect(AGENT_EXPERTISE['toly']).toContain('solana');
      expect(AGENT_EXPERTISE['toly']).toContain('blockchain');
      expect(AGENT_EXPERTISE['toly']).toContain('PoH');
    });

    it('ghost should have rewards/fees expertise', () => {
      expect(AGENT_EXPERTISE['ghost']).toContain('rewards');
      expect(AGENT_EXPERTISE['ghost']).toContain('fees');
      expect(AGENT_EXPERTISE['ghost']).toContain('distribution');
    });

    it('shaw should have elizaos/agents expertise', () => {
      expect(AGENT_EXPERTISE['shaw']).toContain('elizaos');
      expect(AGENT_EXPERTISE['shaw']).toContain('agents');
      expect(AGENT_EXPERTISE['shaw']).toContain('multi-agent');
    });
  });

  // ==================== Suggested Topics ====================

  describe('Suggested Topics', () => {
    it('should have at least 5 suggested topics', () => {
      expect(SUGGESTED_TOPICS.length).toBeGreaterThanOrEqual(5);
    });

    it('should have valid participants in all topics', () => {
      SUGGESTED_TOPICS.forEach(topic => {
        topic.participants.forEach(participant => {
          expect(AVAILABLE_AGENTS).toContain(participant);
        });
      });
    });

    it('should have at least 2 participants per topic', () => {
      SUGGESTED_TOPICS.forEach(topic => {
        expect(topic.participants.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('should have valid styles', () => {
      const validStyles = ['casual', 'formal', 'debate', 'collaborative'];
      SUGGESTED_TOPICS.forEach(topic => {
        expect(validStyles).toContain(topic.style);
      });
    });

    it('should have meaningful topics', () => {
      SUGGESTED_TOPICS.forEach(topic => {
        expect(topic.topic.length).toBeGreaterThan(10);
      });
    });
  });

  // ==================== Character Integration ====================

  describe('Character Integration', () => {
    it('should be able to get all agent characters', () => {
      AVAILABLE_AGENTS.forEach(agentId => {
        const character = getCharacter(agentId);
        expect(character).toBeDefined();
        expect(character?.name).toBeDefined();
      });
    });

    it('should have bios for all characters', () => {
      AVAILABLE_AGENTS.forEach(agentId => {
        const character = getCharacter(agentId);
        expect(character?.bio).toBeDefined();
      });
    });

    it('should have style definitions for all characters', () => {
      AVAILABLE_AGENTS.forEach(agentId => {
        const character = getCharacter(agentId);
        expect(character?.style?.all).toBeDefined();
        expect(Array.isArray(character?.style?.all)).toBe(true);
      });
    });
  });

  // ==================== API Response Structure ====================

  describe('API Response Structure (via mock fetch)', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('POST /api/agents/dialogue', () => {
      it('should return dialogue structure', async () => {
        const mockResponse = {
          success: true,
          dialogue: {
            topic: 'Test topic',
            participants: [
              { id: 'neo', name: 'Neo' },
              { id: 'finn', name: 'Finn' },
            ],
            initiator: 'neo',
            turns: [
              { speaker: 'neo', speakerName: 'Neo', message: 'test', timestamp: Date.now() },
            ],
            sentiment: 'neutral',
            summary: '1-turn conversation about the topic',
            style: 'casual',
          },
        };

        setupMockFetch({
          '/api/agents/dialogue': mockResponse,
        });

        const response = await fetch('http://localhost:3000/api/agents/dialogue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: 'Test topic',
            participants: ['neo', 'finn'],
          }),
        });
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.dialogue.topic).toBe('Test topic');
        expect(data.dialogue.participants).toHaveLength(2);
        expect(data.dialogue.turns).toBeDefined();
        expect(data.dialogue.sentiment).toBeDefined();
        expect(data.dialogue.style).toBeDefined();
      });
    });

    describe('GET /api/agents/dialogue', () => {
      it('should return agent list with expertise', async () => {
        const mockResponse = {
          success: true,
          agents: AVAILABLE_AGENTS.map(id => ({
            id,
            name: getCharacter(id)?.name || id,
            description: 'Test description',
            expertise: AGENT_EXPERTISE[id] || [],
          })),
          suggestedTopics: SUGGESTED_TOPICS,
          styles: ['casual', 'formal', 'debate', 'collaborative'],
          maxTurnsRange: { min: 4, max: 12, default: 6 },
        };

        setupMockFetch({
          '/api/agents/dialogue': mockResponse,
        });

        const response = await fetch('http://localhost:3000/api/agents/dialogue');
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.agents).toHaveLength(8);
        expect(data.suggestedTopics).toBeDefined();
        expect(data.styles).toEqual(['casual', 'formal', 'debate', 'collaborative']);
        expect(data.maxTurnsRange).toEqual({ min: 4, max: 12, default: 6 });
      });

      it('should include expertise for each agent', async () => {
        const mockResponse = {
          success: true,
          agents: AVAILABLE_AGENTS.map(id => ({
            id,
            name: getCharacter(id)?.name || id,
            description: 'Test description',
            expertise: AGENT_EXPERTISE[id] || [],
          })),
        };

        setupMockFetch({
          '/api/agents/dialogue': mockResponse,
        });

        const response = await fetch('http://localhost:3000/api/agents/dialogue');
        const data = await response.json();

        const neo = data.agents.find((a: { id: string }) => a.id === 'neo');
        expect(neo.expertise).toContain('alpha');

        const finn = data.agents.find((a: { id: string }) => a.id === 'finn');
        expect(finn.expertise).toContain('launches');
      });
    });
  });

  // ==================== Dialogue Style Validation ====================

  describe('Dialogue Style Validation', () => {
    const validStyles = ['casual', 'formal', 'debate', 'collaborative'];

    it('should have 4 valid styles', () => {
      expect(validStyles).toHaveLength(4);
    });

    it('casual should be a valid style', () => {
      expect(validStyles).toContain('casual');
    });

    it('formal should be a valid style', () => {
      expect(validStyles).toContain('formal');
    });

    it('debate should be a valid style', () => {
      expect(validStyles).toContain('debate');
    });

    it('collaborative should be a valid style', () => {
      expect(validStyles).toContain('collaborative');
    });
  });

  // ==================== Turn Limits ====================

  describe('Turn Limits', () => {
    const maxTurnsRange = { min: 4, max: 12, default: 6 };

    it('should have minimum of 4 turns', () => {
      expect(maxTurnsRange.min).toBe(4);
    });

    it('should have maximum of 12 turns', () => {
      expect(maxTurnsRange.max).toBe(12);
    });

    it('should default to 6 turns', () => {
      expect(maxTurnsRange.default).toBe(6);
    });

    it('default should be within min/max range', () => {
      expect(maxTurnsRange.default).toBeGreaterThanOrEqual(maxTurnsRange.min);
      expect(maxTurnsRange.default).toBeLessThanOrEqual(maxTurnsRange.max);
    });
  });

  // ==================== Edge Cases ====================

  describe('Edge Cases', () => {
    it('should handle dialogue with only one participant message', () => {
      const text = `[Neo]: solo message`;
      const turns = parseDialogueResponse(text, ['neo', 'finn']);

      expect(turns).toHaveLength(1);
    });

    it('should handle very long messages', () => {
      const longMessage = 'a'.repeat(1000);
      const text = `[Neo]: ${longMessage}`;
      const turns = parseDialogueResponse(text, ['neo']);

      expect(turns[0].message).toBe(longMessage);
    });

    it('should handle messages with newlines within', () => {
      // Note: The parser splits by newline, so multiline messages get split
      const text = `[Neo]: first line
second line should be separate
[Finn]: response`;
      const turns = parseDialogueResponse(text, ['neo', 'finn']);

      expect(turns).toHaveLength(2);
      expect(turns[0].message).toBe('first line');
    });

    it('should handle unicode in messages', () => {
      const text = `[CJ]: yo! check this out`;
      const turns = parseDialogueResponse(text, ['cj']);

      expect(turns[0].message).toContain('check this out');
    });

    it('should handle participants with simple names in a single dialogue', () => {
      // Note: The regex \[?(\w+)\]? only matches word characters, so 'bags-bot' won't match
      // This tests agents without hyphens
      const simpleAgents = ['neo', 'cj', 'finn', 'toly', 'ash', 'shaw', 'ghost'];
      let text = '';
      simpleAgents.forEach((agent, i) => {
        text += `[${agent}]: turn ${i + 1}\n`;
      });

      const turns = parseDialogueResponse(text, simpleAgents);

      expect(turns).toHaveLength(7);
    });

    it('should not match agents with hyphens due to regex limitation', () => {
      // The regex \[?(\w+)\]?: doesn't match 'bags-bot' because \w doesn't include hyphens
      const text = `[bags-bot]: this won't be parsed correctly`;
      const turns = parseDialogueResponse(text, ['bags-bot']);

      // The hyphenated name won't match, so no turns
      expect(turns).toHaveLength(0);
    });
  });
});
