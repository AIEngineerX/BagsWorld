// Unified Agent API Route
// Handles all agent interactions for BagsWorld frontend

import { NextResponse } from 'next/server';
import { getCharacter } from '@/lib/characters';

const AVAILABLE_AGENTS = ['neo', 'cj', 'finn', 'bags-bot', 'toly', 'ash', 'shaw', 'ghost'] as const;
type AgentId = typeof AVAILABLE_AGENTS[number];

const AGENT_ALIASES: Record<string, AgentId> = {
  'bagsbot': 'bags-bot',
  'dev': 'ghost',
  'finnbags': 'finn',
};

function normalizeAgentId(agentId: string): string {
  const lower = agentId.toLowerCase().trim();
  return AGENT_ALIASES[lower] || lower;
}

// Detect if user is mentioning another agent
const AGENT_PATTERNS: Array<[RegExp, AgentId]> = [
  [/\b(neo)\b/i, 'neo'],
  [/\b(cj)\b/i, 'cj'],
  [/\b(finn|finnbags)\b/i, 'finn'],
  [/\b(bags[- ]?bot|bagsbot)\b/i, 'bags-bot'],
  [/\b(toly)\b/i, 'toly'],
  [/\b(ash)\b/i, 'ash'],
  [/\b(shaw)\b/i, 'shaw'],
  [/\b(ghost|the dev)\b/i, 'ghost'],
];

const TOPIC_ROUTES: Array<[string, AgentId]> = [
  ['alpha', 'neo'], ['scan', 'neo'],
  ['launch', 'finn'], ['bags.fm', 'finn'],
  ['solana', 'toly'], ['blockchain', 'toly'],
  ['pokemon', 'ash'], ['evolve', 'ash'],
  ['reward', 'ghost'], ['fee share', 'ghost'],
  ['elizaos', 'shaw'], ['multi-agent', 'shaw'],
];

function detectAgentMention(message: string, currentAgent: string): AgentId | null {
  const lower = message.toLowerCase();

  for (const [pattern, agent] of AGENT_PATTERNS) {
    if (pattern.test(lower) && agent !== currentAgent) {
      return agent;
    }
  }

  const atMention = lower.match(/@(\w+)/);
  if (atMention) {
    const normalized = normalizeAgentId(atMention[1]);
    if (AVAILABLE_AGENTS.includes(normalized as AgentId) && normalized !== currentAgent) {
      return normalized as AgentId;
    }
  }

  for (const [topic, agent] of TOPIC_ROUTES) {
    if (lower.includes(topic) && agent !== currentAgent) {
      return agent;
    }
  }

  return null;
}

// Build system prompt for an agent
function buildSystemPrompt(character: ReturnType<typeof getCharacter>): string {
  if (!character) return 'You are a helpful assistant in BagsWorld.';

  const parts = [character.system || ''];

  if (Array.isArray(character.bio)) {
    parts.push('ABOUT YOU:\n' + character.bio.slice(0, 3).join('\n'));
  }

  if (Array.isArray(character.style?.all)) {
    parts.push('YOUR STYLE:\n' + character.style.all.slice(0, 5).join('\n'));
  }

  parts.push(`OTHER AGENTS: Neo (scanner), CJ (vibes), Finn (launches), Bags-Bot (data), Toly (Solana), Ash (guide), Shaw (agents), Ghost (rewards).
If a question is outside your expertise, suggest the appropriate agent.`);

  return parts.filter(Boolean).join('\n\n');
}

// Generate response using Claude API (native fetch)
async function generateResponse(
  apiKey: string,
  agentId: string,
  message: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const character = getCharacter(agentId);
  const systemPrompt = buildSystemPrompt(character);

  const messages = [
    ...conversationHistory.map(msg => ({
      role: msg.role,
      content: msg.content,
    })),
    { role: 'user', content: message },
  ];

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.content?.[0];

  if (content?.type !== 'text') {
    throw new Error('Unexpected response format from Claude API');
  }

  return content.text;
}

// Fallback responses when no API key configured
const FALLBACK_RESPONSES: Record<string, string[]> = {
  'neo': ['scanning chains...', 'something\'s forming.', 'watching.'],
  'cj': ['yo! welcome fam!', 'vibes immaculate!', 'community strong!'],
  'finn': ['gm! ready to build?', 'great day to launch.', 'let\'s go.'],
  'bags-bot': ['Processing...', 'Analyzing metrics.', 'Compiling response.'],
  'toly': ['Solana never sleeps.', 'Proof of history.', 'Decentralized future.'],
  'ash': ['Ready to evolve?', 'Gotta catch em all!', 'Level up!'],
  'shaw': ['Agents are the future.', 'Character file is the soul.', 'Multi-agent coordination.'],
  'ghost': ['Rewards flowing.', '50/30/20 split.', 'Automated and trustless.'],
};

function getFallbackResponse(agentId: string): string {
  const responses = FALLBACK_RESPONSES[agentId] || ['thinking...'];
  return responses[Math.floor(Math.random() * responses.length)];
}

// POST handler
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      agentId: rawAgentId,
      message,
      sessionId,
      conversationHistory = []
    } = body;

    if (!rawAgentId || !message) {
      return NextResponse.json(
        { error: 'agentId and message are required' },
        { status: 400 }
      );
    }

    const agentId = normalizeAgentId(rawAgentId);

    if (!(AVAILABLE_AGENTS as readonly string[]).includes(agentId)) {
      return NextResponse.json(
        { error: `Unknown agent: ${agentId}. Available: ${AVAILABLE_AGENTS.join(', ')}` },
        { status: 400 }
      );
    }

    const character = getCharacter(agentId);
    if (!character) {
      return NextResponse.json(
        { error: `Character not found: ${agentId}` },
        { status: 404 }
      );
    }

    const mentionedAgent = detectAgentMention(message, agentId);

    // Generate response
    const apiKey = process.env.ANTHROPIC_API_KEY;
    let response: string;
    let debug: string | undefined;

    if (apiKey) {
      try {
        response = await generateResponse(apiKey, agentId, message, conversationHistory);
      } catch (err) {
        console.error('[Agents API] Claude error:', err);
        response = getFallbackResponse(agentId);
        debug = `claude_error: ${err instanceof Error ? err.message : String(err)}`;
      }
    } else {
      console.warn('[Agents API] No ANTHROPIC_API_KEY configured');
      response = getFallbackResponse(agentId);
      debug = 'no_api_key';
    }

    return NextResponse.json({
      success: true,
      agentId,
      agentName: character.name,
      response,
      suggestedAgent: mentionedAgent,
      sessionId: sessionId || crypto.randomUUID(),
      ...(debug && { debug }),
    });

  } catch (error) {
    console.error('[Agents API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

// GET handler - list available agents
export async function GET() {
  const agents = AVAILABLE_AGENTS.map(id => {
    const character = getCharacter(id);
    return {
      id,
      name: character?.name || id,
      description: Array.isArray(character?.bio)
        ? character.bio[0]
        : 'A BagsWorld AI agent',
    };
  });

  return NextResponse.json({
    success: true,
    agents,
    aliases: AGENT_ALIASES,
  });
}
