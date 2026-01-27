// World routes - world health, world state, multi-agent dialogue
// GET /api/world-health, GET /api/world-state, POST /api/dialogue

import { Router, Request, Response } from 'express';
import { getBagsApiService } from '../services/BagsApiService.js';
import { getLLMService } from '../services/LLMService.js';
import { getCharacter, getCharacterIds } from '../characters/index.js';
import { buildConversationContext } from './shared.js';
import type { Character } from '../types/elizaos.js';

const router = Router();

// ============================================================================
// TYPES
// ============================================================================

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

interface LiveTokenData {
  mint: string;
  symbol: string;
  name: string;
  marketCap: number;
  volume24h: number;
  change24h: number;
  priceUsd: number;
}

interface LiveCreatorData {
  username: string;
  estimatedEarnings: number;
  topToken: string;
}

interface LiveMarketData {
  tokens: LiveTokenData[];
  creators: LiveCreatorData[];
  totalVolume24h: number;
  totalMarketCap: number;
  timestamp: number;
}

// ============================================================================
// DEXSCREENER LIVE DATA FETCHING
// ============================================================================

async function fetchLiveMarketData(): Promise<LiveMarketData> {
  const data: LiveMarketData = {
    tokens: [],
    creators: [],
    totalVolume24h: 0,
    totalMarketCap: 0,
    timestamp: Date.now(),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  let response: Response;
  try {
    response = await fetch('https://api.dexscreener.com/latest/dex/search?q=BAGS', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BagsWorld-ElizaOS/1.0',
      },
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('[world] DexScreener fetch failed:', err instanceof Error ? err.message : 'timeout');
    return data;
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    console.warn('[world] DexScreener API error:', response.status);
    return data;
  }

  const json = await response.json();
  const pairs = json.pairs || [];

  const EXCLUDED_SYMBOLS = ['REWARDS', 'POKECENTER', 'GYM', 'TREASURY', 'CASINO'];
  const seenMints = new Set<string>();
  const seenCreators = new Set<string>();

  for (const pair of pairs) {
    const isBagsDex = pair.dexId === 'bags';
    const caEndsBags = pair.baseToken?.address?.endsWith('BAGS');
    const symbol = pair.baseToken?.symbol?.toUpperCase() || '';
    const isExcluded = EXCLUDED_SYMBOLS.includes(symbol);
    const mint = pair.baseToken?.address;

    if ((isBagsDex || caEndsBags) && mint && !isExcluded && !seenMints.has(mint)) {
      seenMints.add(mint);

      const token: LiveTokenData = {
        mint,
        symbol: pair.baseToken.symbol || '???',
        name: pair.baseToken.name || 'Unknown',
        marketCap: pair.marketCap || pair.fdv || 0,
        volume24h: pair.volume?.h24 || 0,
        change24h: pair.priceChange?.h24 || 0,
        priceUsd: parseFloat(pair.priceUsd) || 0,
      };

      data.tokens.push(token);
      data.totalVolume24h += token.volume24h;
      data.totalMarketCap += token.marketCap;

      const socials = pair.info?.socials || [];
      for (const social of socials) {
        if (social.url && social.url.includes('x.com/')) {
          const match = social.url.match(/x\.com\/([^\/\?]+)/);
          if (match && match[1] && !seenCreators.has(match[1])) {
            seenCreators.add(match[1]);
            data.creators.push({
              username: match[1],
              estimatedEarnings: token.volume24h * 0.01,
              topToken: token.symbol,
            });
          }
        }
      }
    }
  }

  data.tokens.sort((a, b) => b.volume24h - a.volume24h);
  data.tokens = data.tokens.slice(0, 10);

  data.creators.sort((a, b) => b.estimatedEarnings - a.estimatedEarnings);
  data.creators = data.creators.slice(0, 5);

  console.log(`[world] Fetched ${data.tokens.length} live tokens, ${data.creators.length} creators`);

  return data;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  if (num >= 1) return num.toFixed(2);
  return num.toFixed(4);
}

function formatLiveDataContext(data: LiveMarketData, worldContext?: string): string {
  const hasLiveData = data.tokens.length > 0 || data.creators.length > 0;

  if (!hasLiveData && worldContext) {
    // Fall back to world state data when DexScreener is unavailable
    return `\n=== BAGSWORLD STATE DATA ===\nYOU MUST REFERENCE THIS DATA IN YOUR DIALOGUE.\n\n${worldContext}\n`;
  }

  if (!hasLiveData) {
    // No data at all - discuss the world conceptually
    return `\n=== BAGSWORLD CONTEXT ===\nDiscuss the Bags.fm ecosystem, creator economy, and token mechanics based on your character knowledge.\n`;
  }

  let context = `\n=== LIVE BAGS.FM MARKET DATA (${new Date(data.timestamp).toISOString()}) ===\n`;
  context += `YOU MUST REFERENCE THIS DATA IN YOUR DIALOGUE.\n\n`;

  if (data.tokens.length > 0) {
    context += `TOP TOKENS BY VOLUME:\n`;
    for (let i = 0; i < Math.min(data.tokens.length, 5); i++) {
      const t = data.tokens[i];
      const changeSign = t.change24h >= 0 ? '+' : '';
      context += `${i + 1}. $${t.symbol} - MC: $${formatNumber(t.marketCap)}, Vol: $${formatNumber(t.volume24h)}, ${changeSign}${t.change24h.toFixed(1)}%\n`;
    }
    context += '\n';
  }

  if (data.creators.length > 0) {
    context += `TOP CREATORS:\n`;
    for (let i = 0; i < Math.min(data.creators.length, 3); i++) {
      const c = data.creators[i];
      context += `${i + 1}. @${c.username} - ~${c.estimatedEarnings.toFixed(2)} SOL earned (top: $${c.topToken})\n`;
    }
    context += '\n';
  }

  context += `MARKET TOTALS:\n`;
  context += `- 24h Volume: $${formatNumber(data.totalVolume24h)}\n`;
  context += `- Total Market Cap: $${formatNumber(data.totalMarketCap)}\n`;

  return context;
}

// ============================================================================
// DIALOGUE GENERATION
// ============================================================================

function buildDialogueSystemPrompt(
  characterDefs: Character[],
  topic: string,
  style: DialogueStyle,
  liveData: LiveMarketData,
  worldContext?: string
): string {
  const topToken = liveData.tokens[0];
  const topCreator = liveData.creators[0];
  const hasLiveData = liveData.tokens.length > 0 || liveData.creators.length > 0;

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
CRITICAL RULES - YOU MUST FOLLOW ALL OF THESE:
1. Each character must stay in their established voice and personality
2. Keep individual turns SHORT (1-3 sentences max)
3. Characters should build on each other's points
4. Include natural reactions and acknowledgments
5. The conversation should feel organic, not scripted
6. End with a natural conclusion or agreement
`;

  if (hasLiveData) {
    prompt += `
**MANDATORY DATA REQUIREMENT:**
You MUST mention SPECIFIC data from the live market data below in the conversation.
- At least 2 turns MUST reference a specific token symbol (e.g., $${topToken?.symbol || 'TOKEN'})
- At least 1 turn MUST mention a specific number (volume, market cap, or % change)
${topCreator ? `- At least 1 turn SHOULD mention a creator (@${topCreator.username})` : ''}

DO NOT generate generic dialogue. Every conversation must reference REAL, SPECIFIC data points.
`;
  } else if (worldContext) {
    prompt += `
**WORLD STATE REQUIREMENT:**
Reference the world state data provided (health status, weather, activity levels).
Discuss actual ecosystem mechanics, creator economy, and Bags.fm features.
Stay grounded in real platform knowledge - no invented statistics.
`;
  } else {
    prompt += `
**KNOWLEDGE-BASED DIALOGUE:**
Discuss the Bags.fm ecosystem based on character expertise.
Focus on platform mechanics, creator tools, and community.
Use general knowledge - do not invent specific statistics or token names.
`;
  }

  prompt += `
FORMAT:
Output the dialogue as a series of turns, one per line, in this exact format:
[CharacterName]: Their dialogue here.
`;

  if (hasLiveData && topToken) {
    prompt += `
Example with real data:
[Neo]: i see $${topToken.symbol} moving... ${topToken.change24h >= 0 ? '+' : ''}${topToken.change24h.toFixed(0)}% in 24h.
[Finn]: $${formatNumber(topToken.volume24h)} in volume. builders are shipping.
[Ghost]: confirmed on-chain. ${topCreator ? `@${topCreator.username} leading the pack.` : 'creator fees flowing.'}
`;
  }

  return prompt;
}

function buildDialogueUserPrompt(
  characterDefs: Character[],
  topic: string,
  initiator: string,
  maxTurns: number,
  liveData: LiveMarketData,
  additionalContext?: string,
  worldContext?: string
): string {
  const initiatorChar = characterDefs.find(c => c?.name.toLowerCase() === initiator.toLowerCase());
  const initiatorName = initiatorChar?.name || initiator;
  const hasLiveData = liveData.tokens.length > 0 || liveData.creators.length > 0;

  let prompt = `Generate a ${maxTurns}-turn conversation about "${topic}".

The conversation starts with ${initiatorName} initiating.
Participants: ${characterDefs.map(c => c?.name).filter(Boolean).join(', ')}

${formatLiveDataContext(liveData, worldContext)}
`;

  if (additionalContext) {
    prompt += `\nAdditional context: ${additionalContext}\n`;
  }

  if (hasLiveData) {
    prompt += `
REMINDER: You MUST reference specific tokens ($SYMBOL), numbers, and creators from the data above.
Generic dialogue without data references is NOT acceptable.
`;
  } else if (worldContext) {
    prompt += `
REMINDER: Reference the world state data above. Discuss real ecosystem mechanics.
`;
  } else {
    prompt += `
REMINDER: Stay in character and discuss Bags.fm based on your knowledge.
`;
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

  const positiveWords = ['great', 'good', 'excellent', 'love', 'amazing', 'bullish', 'pumping', 'wagmi', 'lfg'];
  const negativeWords = ['bad', 'terrible', 'hate', 'bearish', 'dumping', 'ngmi', 'rug', 'down'];

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

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

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

// GET /api/live-market - Get live market data from DexScreener
router.get('/live-market', async (req: Request, res: Response) => {
  const liveData = await fetchLiveMarketData();

  res.json({
    success: true,
    data: liveData,
    topToken: liveData.tokens[0] || null,
    topCreator: liveData.creators[0] || null,
  });
});

// POST /api/dialogue - Generate multi-agent dialogue with live data
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

  const dialogueInitiator = initiator || dialogueParticipants[0];
  const validStyle: DialogueStyle = ['casual', 'formal', 'debate', 'collaborative'].includes(style)
    ? style as DialogueStyle
    : 'casual';
  const turnCount = Math.min(Math.max(parseInt(String(maxTurns)) || 6, 2), 20);

  const liveData = await fetchLiveMarketData();

  // Get world context as fallback when DexScreener data is unavailable
  let worldContext = '';
  const firstChar = characterDefs[0];
  if (firstChar) {
    const contextResult = await buildConversationContext(firstChar, topic);
    if (contextResult.worldState) {
      worldContext = contextResult.worldState;
    }
  }

  const systemPrompt = buildDialogueSystemPrompt(characterDefs, topic, validStyle, liveData, worldContext);

  const userPrompt = buildDialogueUserPrompt(
    characterDefs,
    topic,
    dialogueInitiator,
    turnCount,
    liveData,
    context,
    worldContext
  );

  const hasLiveData = liveData.tokens.length > 0 || liveData.creators.length > 0;

  try {
    const llmService = getLLMService();
    const llmResponse = await llmService.generateWithSystemPrompt(
      systemPrompt,
      userPrompt,
      [],
      undefined,
      800
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
      dataSource: hasLiveData ? 'dexscreener' : worldContext ? 'world_state' : 'character_knowledge',
      liveData: hasLiveData ? {
        topToken: liveData.tokens[0]?.symbol || null,
        topCreator: liveData.creators[0]?.username || null,
        totalVolume24h: liveData.totalVolume24h,
        tokenCount: liveData.tokens.length,
      } : null,
      model: llmResponse.model,
      usage: llmResponse.usage,
    });
  } catch (err) {
    console.error('[world] Dialogue generation failed:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to generate dialogue',
      message: err instanceof Error ? err.message : 'Unknown error',
      dataSource: hasLiveData ? 'dexscreener' : worldContext ? 'world_state' : 'character_knowledge',
      liveData: hasLiveData ? {
        topToken: liveData.tokens[0]?.symbol || null,
        topCreator: liveData.creators[0]?.username || null,
        totalVolume24h: liveData.totalVolume24h,
        tokenCount: liveData.tokens.length,
      } : null,
    });
  }
});

export default router;
