// World routes - world health, world state, multi-agent dialogue
// GET /api/world-health, GET /api/world-state, POST /api/dialogue

import { Router, Request, Response } from 'express';
import { getBagsApiService } from '../services/BagsApiService.js';
import { getLLMService } from '../services/LLMService.js';
import { getCharacter, getCharacterIds } from '../characters/index.js';
import { buildConversationContext } from './shared.js';
import type { Character } from '../types/elizaos.js';

const router = Router();

// Types for dialogue
interface DialogueTurn {
  speaker: string;
  message: string;
  timestamp: number;
}

interface DialogueResult {
  turns: DialogueTurn[];
  sentiment: 'positive' | 'negative' | 'neutral';
  summary?: string;
}

type DialogueStyle = 'casual' | 'formal' | 'debate' | 'collaborative';

// Dialogue helper functions
function buildDialogueSystemPrompt(
  characterDefs: Character[],
  topic: string,
  style: DialogueStyle
): string {
  let prompt = `You are a dialogue director orchestrating a multi-agent conversation between BagsWorld AI characters.

Your task is to generate a natural, in-character conversation about: "${topic}"

The conversation should be ${style === 'casual' ? 'casual and friendly' :
    style === 'formal' ? 'professional and informative' :
    style === 'debate' ? 'a respectful debate with different viewpoints' :
    'collaborative and solution-oriented'}.

CHARACTER PROFILES:
`;

  for (const char of characterDefs) {
    if (!char) continue;
    prompt += `\n**${char.name}**:\n`;
    const bio = char.bio;
    const bioArray = Array.isArray(bio) ? bio : typeof bio === 'string' ? [bio] : [];
    prompt += `- Bio: ${bioArray.slice(0, 2).join('. ')}\n`;
    const styleAll = char.style?.all;
    const styleArray = Array.isArray(styleAll) ? styleAll : [];
    prompt += `- Style: ${styleArray.slice(0, 2).join(', ')}\n`;
    if (char.system) {
      const speechMatch = char.system.match(/SPEECH PATTERNS?:\n([\s\S]*?)(?=\n\n|\nRULES|\nKNOWLEDGE|$)/i);
      if (speechMatch) {
        prompt += `- Speech: ${speechMatch[1].slice(0, 200)}\n`;
      }
    }
  }

  prompt += `
RULES:
1. Each character must stay in their established voice and personality
2. Keep individual turns SHORT (1-3 sentences max)
3. Characters should build on each other's points
4. Include natural reactions and acknowledgments
5. The conversation should feel organic, not scripted
6. End with a natural conclusion or agreement

FORMAT:
Output the dialogue as a series of turns, one per line, in this exact format:
[CharacterName]: Their dialogue here.

Example:
[Neo]: i see something in the chain...
[Finn]: what is it? new launch?
[Neo]: patterns forming. could be interesting.
`;

  return prompt;
}

function buildDialogueUserPrompt(
  characterDefs: Character[],
  topic: string,
  initiator: string,
  maxTurns: number,
  context?: string,
  worldContext?: string
): string {
  const initiatorChar = characterDefs.find(c => c?.name.toLowerCase() === initiator.toLowerCase());
  const initiatorName = initiatorChar?.name || initiator;

  let prompt = `Generate a ${maxTurns}-turn conversation about "${topic}".

The conversation starts with ${initiatorName} initiating.
Participants: ${characterDefs.map(c => c?.name).filter(Boolean).join(', ')}
`;

  if (context) {
    prompt += `\nAdditional context: ${context}\n`;
  }

  if (worldContext) {
    prompt += `\n${worldContext}\n`;
  }

  prompt += `\nGenerate the dialogue now:`;

  return prompt;
}

function parseDialogueResponse(text: string, participants: string[]): DialogueResult {
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
        turns.push({
          speaker: validSpeaker,
          message,
          timestamp: Date.now(),
        });
      }
    }
  }

  const positiveWords = ['great', 'good', 'excellent', 'love', 'amazing', 'bullish', 'pumping', 'wagmi'];
  const negativeWords = ['bad', 'terrible', 'hate', 'bearish', 'dumping', 'ngmi', 'rug'];

  let positiveCount = 0;
  let negativeCount = 0;

  for (const turn of turns) {
    const lowerMessage = turn.message.toLowerCase();
    positiveCount += positiveWords.filter(w => lowerMessage.includes(w)).length;
    negativeCount += negativeWords.filter(w => lowerMessage.includes(w)).length;
  }

  const sentiment: 'positive' | 'negative' | 'neutral' = positiveCount > negativeCount ? 'positive' :
                    negativeCount > positiveCount ? 'negative' : 'neutral';

  return {
    turns,
    sentiment,
    summary: turns.length > 0 ? `${turns.length}-turn conversation about the topic` : undefined,
  };
}

// GET /api/world-health - Get world health
router.get('/world-health', async (req: Request, res: Response) => {
  const api = getBagsApiService();

  const health = await api.getWorldHealth();

  res.json({
    success: true,
    health: health || {
      status: 'unknown',
      message: 'Unable to fetch world health data',
    },
  });
});

// GET /api/world-state - Get world state with context
router.get('/world-state', async (req: Request, res: Response) => {
  const api = getBagsApiService();
  const health = await api.getWorldHealth();
  const recentLaunches = await api.getRecentLaunches(5);
  const topCreators = await api.getTopCreators(5);

  res.json({
    success: true,
    worldState: {
      health: health || { health: 0, weather: 'unknown' },
      recentLaunches,
      topCreators,
    },
    formatted: health ? `World Health: ${health.health}% (${health.weather})` : 'World state unavailable',
  });
});

// POST /api/dialogue - Generate multi-agent dialogue
router.post('/dialogue', async (req: Request, res: Response) => {
  const { topic, participants, initiator, maxTurns = 6, style = 'casual', context } = req.body;

  if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
    res.status(400).json({ error: 'topic is required and must be a non-empty string' });
    return;
  }

  let dialogueParticipants: string[] = participants;
  if (!dialogueParticipants || !Array.isArray(dialogueParticipants) || dialogueParticipants.length < 2) {
    const allIds = getCharacterIds().filter(id => !['bagsbot', 'dev'].includes(id));
    const shuffled = [...allIds].sort(() => Math.random() - 0.5);
    dialogueParticipants = shuffled.slice(0, 3);
  }

  const characterDefs: Character[] = [];
  for (const p of dialogueParticipants) {
    const char = getCharacter(p.toLowerCase());
    if (!char) {
      res.status(400).json({
        error: `Unknown participant: ${p}`,
        availableAgents: getCharacterIds(),
      });
      return;
    }
    characterDefs.push(char);
  }

  try {
    const dialogueInitiator = initiator || dialogueParticipants[0];
    const validStyle: DialogueStyle = ['casual', 'formal', 'debate', 'collaborative'].includes(style)
      ? style as DialogueStyle
      : 'casual';
    const turnCount = Math.min(Math.max(parseInt(String(maxTurns)) || 6, 2), 20);

    const systemPrompt = buildDialogueSystemPrompt(characterDefs, topic, validStyle);

    let worldContext = '';
    const firstChar = characterDefs[0];
    if (firstChar) {
      const contextResult = await buildConversationContext(firstChar, topic);
      if (contextResult.worldState) {
        worldContext = contextResult.worldState;
      }
    }

    const userPrompt = buildDialogueUserPrompt(
      characterDefs,
      topic,
      dialogueInitiator,
      turnCount,
      context,
      worldContext
    );

    const llmService = getLLMService();
    const llmResponse = await llmService.generateWithSystemPrompt(
      systemPrompt,
      userPrompt,
      [],
      undefined,
      500
    );

    const result = parseDialogueResponse(llmResponse.text, dialogueParticipants);

    res.json({
      success: true,
      dialogue: {
        topic,
        participants: dialogueParticipants.map(p => ({
          id: p.toLowerCase(),
          name: getCharacter(p.toLowerCase())?.name || p,
        })),
        turns: result.turns.map(turn => ({
          speaker: turn.speaker,
          speakerName: getCharacter(turn.speaker.toLowerCase())?.name || turn.speaker,
          message: turn.message,
          timestamp: turn.timestamp,
        })),
        sentiment: result.sentiment,
        summary: result.summary,
      },
      model: llmResponse.model,
      usage: llmResponse.usage,
    });
  } catch (err) {
    console.error('[world] Error in /dialogue:', err);
    res.status(500).json({
      error: 'Failed to generate dialogue',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

export default router;
