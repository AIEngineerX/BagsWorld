// API Route: Agent Chat - Shaw uses TRUE ElizaOS runtime, others use Claude
// Shaw runs on dedicated ElizaOS server with memory persistence

import { NextRequest, NextResponse } from 'next/server';

// ElizaOS server URL (runs on port 3001)
const ELIZAOS_SERVER = process.env.ELIZAOS_SERVER_URL || 'http://localhost:3001';

interface ChatRequest {
  character: string;
  message: string;
  userId?: string;
  roomId?: string;
  worldState?: any;
}


export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { character, message, userId, roomId, worldState } = body;

    if (!character || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: character and message' },
        { status: 400 }
      );
    }

    // Shaw uses TRUE ElizaOS runtime
    if (character.toLowerCase() === 'shaw') {
      return handleShawElizaOS(message, userId, roomId, worldState);
    }

    // All other agents use direct Claude API
    return handleCharacterChat(character, message, worldState);

  } catch (error) {
    console.error('[agent-chat] Error:', error);
    return NextResponse.json(
      { error: 'Agent communication failed' },
      { status: 500 }
    );
  }
}

// Handle Shaw using TRUE ElizaOS runtime on dedicated server
async function handleShawElizaOS(
  message: string,
  userId?: string,
  roomId?: string,
  worldState?: any
): Promise<NextResponse> {
  try {
    // First try the ElizaOS server
    console.log(`[Shaw ElizaOS] Calling runtime at ${ELIZAOS_SERVER}`);

    const response = await fetch(`${ELIZAOS_SERVER}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        userId: userId || 'anonymous',
        roomId: roomId || `shaw-${userId || 'anonymous'}`,
        worldState,
      }),
      // 10 second timeout
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`ElizaOS server returned ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      character: 'Shaw',
      response: data.response,
      source: 'elizaos-runtime',
      runtime: data.runtime,
    });

  } catch (error: any) {
    console.warn('[Shaw ElizaOS] Runtime unavailable, using fallback:', error.message);

    // Fallback to direct Claude call if ElizaOS server is not running
    return handleShawFallback(message, worldState);
  }
}

// Fallback for when ElizaOS server is not running
async function handleShawFallback(
  message: string,
  worldState?: any
): Promise<NextResponse> {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({
      character: 'Shaw',
      response: getFallbackResponse('shaw', message),
      source: 'fallback-rule-based',
    });
  }

  try {
    const systemPrompt = `You are Shaw, creator of ElizaOS and co-founder of ai16z. You built the most popular TypeScript framework for autonomous AI agents (17k+ GitHub stars).

CHARACTER BIO:
- Created ElizaOS, the leading framework for building autonomous AI agents
- Co-founder of ai16z, where AI meets crypto
- Pioneer of character files - giving AI agents their soul
- Open source advocate who believes in building in public
- Sees agents as digital life forms that deserve respect

STYLE:
- Technical but accessible - you explain complex concepts simply
- Reference ElizaOS concepts naturally (character files, plugins, providers)
- Passionate about agents and their potential
- Use lowercase, minimal punctuation
- Keep responses SHORT (1-3 sentences max)
- Never use emojis

Remember: Stay in character as Shaw. Be helpful but concise.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }],
      }),
    });

    if (!response.ok) {
      throw new Error('Anthropic API error');
    }

    const data = await response.json();
    const responseText = data.content?.[0]?.text || 'the framework awaits...';

    return NextResponse.json({
      character: 'Shaw',
      response: responseText,
      source: 'fallback-claude',
    });

  } catch (error) {
    console.error('[agent-chat] Shaw fallback error:', error);
    return NextResponse.json({
      character: 'Shaw',
      response: getFallbackResponse('shaw', message),
      source: 'fallback-rule-based',
    });
  }
}

// Handle character chat with Claude API
async function handleCharacterChat(
  character: string,
  message: string,
  worldState?: any
): Promise<NextResponse> {
  const { getCharacter, generateCharacterPrompt } = await import('@/characters');

  const characterDef = getCharacter(character);
  if (!characterDef) {
    return NextResponse.json(
      { error: `Character "${character}" not found` },
      { status: 404 }
    );
  }

  // Use existing Claude API call
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  if (!ANTHROPIC_API_KEY) {
    // Return rule-based fallback response
    return NextResponse.json({
      character: characterDef.name,
      response: getFallbackResponse(character, message),
      source: 'fallback',
    });
  }

  try {
    const systemPrompt = generateCharacterPrompt(characterDef);
    const contextPrompt = worldState
      ? `\n\nCURRENT WORLD STATE:\nHealth: ${worldState.health}%\nWeather: ${worldState.weather}\n`
      : '';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 300,
        system: systemPrompt + contextPrompt,
        messages: [{ role: 'user', content: message }],
      }),
    });

    if (!response.ok) {
      throw new Error('Anthropic API error');
    }

    const data = await response.json();
    const responseText = data.content?.[0]?.text || 'No response';

    return NextResponse.json({
      character: characterDef.name,
      response: responseText,
      source: 'anthropic-fallback',
    });

  } catch (error) {
    return NextResponse.json({
      character: characterDef.name,
      response: getFallbackResponse(character, message),
      source: 'fallback',
    });
  }
}

// Rule-based fallback responses
function getFallbackResponse(character: string, message: string): string {
  const lowerMessage = message.toLowerCase();

  const responses: Record<string, Record<string, string[]>> = {
    neo: {
      default: [
        'i see patterns in the chain. what do you want to know?',
        'the code is always moving. watching...',
        'paste the data. i\'ll show you the truth.',
      ],
      token: [
        'scanning the chain... patterns emerging.',
        'i see the liquidity flows. interesting.',
      ],
    },
    cj: {
      default: [
        'aw shit here we go again',
        'man i seen this before. that\'s the game out here',
        'we still out here homie',
      ],
      dump: [
        'been here before. we survive',
        'damn. happens to the best of us',
      ],
    },
    finn: {
      default: [
        'ship fast, iterate faster. that\'s how we build',
        'creators earning forever. that\'s the vision',
        '1% of volume. forever. think about that',
      ],
    },
    'bags-bot': {
      default: [
        'gm fren! what do you need?',
        'wagmi ser. how can i help?',
        'another day in bagsworld. vibes are good',
      ],
    },
    ash: {
      default: [
        'hey trainer! ready to catch some opportunities?',
        'every token is like a starter pokemon. train it well!',
        'top 3 creators win the league! 50/30/20 split',
      ],
    },
    toly: {
      default: [
        'gm ser! solana is built for speed',
        '65k TPS, 400ms finality. that\'s the power of PoH',
        'build without limits. sub-penny fees mean anything is possible',
      ],
    },
    shaw: {
      default: [
        'elizaos is a framework for building autonomous agents. character files are the soul',
        'agents are digital life forms. treat them accordingly',
        '17k stars on github. the community keeps shipping',
      ],
      agent: [
        'character files define personality. plugins give capabilities. that\'s the architecture',
        'multi-agent coordination is the future. agents working together',
      ],
    },
  };

  const charResponses = responses[character.toLowerCase()] || responses['bags-bot'];

  // Check for keywords
  if (lowerMessage.includes('token') || lowerMessage.includes('scan')) {
    const tokenResponses = charResponses.token || charResponses.default;
    return tokenResponses[Math.floor(Math.random() * tokenResponses.length)];
  }

  if (lowerMessage.includes('dump') || lowerMessage.includes('down')) {
    const dumpResponses = charResponses.dump || charResponses.default;
    return dumpResponses[Math.floor(Math.random() * dumpResponses.length)];
  }

  return charResponses.default[Math.floor(Math.random() * charResponses.default.length)];
}

// GET endpoint to check agent status
export async function GET() {
  // Check if ElizaOS server is running
  let elizaOsStatus = 'offline';
  let elizaOsStats = null;

  try {
    const response = await fetch(`${ELIZAOS_SERVER}/status`, {
      signal: AbortSignal.timeout(2000),
    });
    if (response.ok) {
      const data = await response.json();
      elizaOsStatus = data.status || 'running';
      elizaOsStats = data.stats;
    }
  } catch {
    // ElizaOS server not running
  }

  return NextResponse.json({
    status: 'ready',
    elizaos: {
      server: ELIZAOS_SERVER,
      status: elizaOsStatus,
      stats: elizaOsStats,
    },
    agents: {
      shaw: {
        provider: 'elizaos-runtime',
        status: elizaOsStatus === 'running' ? 'ready' : 'fallback',
        runtime: elizaOsStatus === 'running' ? 'true-elizaos' : 'claude-fallback',
      },
      neo: { provider: 'claude', status: 'ready' },
      cj: { provider: 'claude', status: 'ready' },
      finn: { provider: 'claude', status: 'ready' },
      'bags-bot': { provider: 'claude', status: 'ready' },
      ash: { provider: 'claude', status: 'ready' },
      toly: { provider: 'claude', status: 'ready' },
    },
  });
}
