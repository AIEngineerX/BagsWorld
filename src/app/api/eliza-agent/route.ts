// API Route: Agent Chat - Claude-powered character responses
// Direct Claude integration for fast, reliable responses

import { NextRequest, NextResponse } from 'next/server';

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
    const { character, message, worldState } = body;

    if (!character || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: character and message' },
        { status: 400 }
      );
    }

    // Direct Claude API call - no ElizaOS overhead
    return handleCharacterChat(character, message, worldState);

  } catch (error) {
    console.error('[agent-chat] Error:', error);
    return NextResponse.json(
      { error: 'Agent communication failed' },
      { status: 500 }
    );
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
  return NextResponse.json({
    status: 'ready',
    provider: 'claude',
    agents: ['neo', 'cj', 'finn', 'bags-bot', 'ash', 'toly'],
  });
}
