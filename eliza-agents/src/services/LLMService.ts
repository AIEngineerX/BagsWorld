import { Service, type IAgentRuntime } from '../types/elizaos.js';
import type { Character } from '../types/elizaos.js';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ConversationContext {
  messages: Message[];
  worldState?: string;
  tokenData?: string;
  agentContext?: string;
  oracleState?: string;
  tradingState?: string;
}

export interface LLMResponse {
  text: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

type LLMProvider = 'anthropic' | 'openai' | 'none';

// Default model for all Anthropic requests - use a reliable model ID
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';

export class LLMService extends Service {
  static readonly serviceType = 'bags_llm';

  readonly capabilityDescription = 'LLM integration for agent chat';

  private anthropicApiKey: string | undefined;
  private openaiApiKey: string | undefined;
  private provider: LLMProvider;
  private defaultModel: string;

  constructor(runtime?: IAgentRuntime) {
    super(runtime);

    if (runtime) {
      this.anthropicApiKey = runtime.getSetting('ANTHROPIC_API_KEY') as string;
      this.openaiApiKey = runtime.getSetting('OPENAI_API_KEY') as string;
    } else {
      this.anthropicApiKey = process.env.ANTHROPIC_API_KEY;
      this.openaiApiKey = process.env.OPENAI_API_KEY;
    }

    const modelOverride = runtime?.getSetting('LLM_MODEL') as string || process.env.LLM_MODEL;

    if (this.anthropicApiKey) {
      this.provider = 'anthropic';
      this.defaultModel = modelOverride || 'claude-sonnet-4-20250514';
    } else if (this.openaiApiKey) {
      this.provider = 'openai';
      this.defaultModel = modelOverride || 'gpt-4o';
    } else {
      this.provider = 'none';
      this.defaultModel = '';
    }
  }

  static async start(runtime: IAgentRuntime): Promise<LLMService> {
    console.log('[LLMService] Starting service...');
    const service = new LLMService(runtime);

    if (service.provider === 'none') {
      console.warn('[LLMService] No LLM API key configured. Chat functionality will fail.');
      console.warn('[LLMService] Set ANTHROPIC_API_KEY or OPENAI_API_KEY');
    } else {
      console.log(`[LLMService] Using provider: ${service.provider}`);
      console.log(`[LLMService] Default model: ${service.defaultModel}`);
    }

    return service;
  }

  async stop(): Promise<void> {
    // No cleanup needed
  }

  buildSystemPrompt(character: Character, context?: ConversationContext): string {
    const bio = Array.isArray(character.bio) ? character.bio.join('\n') : character.bio;
    const topics = character.topics?.join(', ') || '';
    const adjectives = character.adjectives?.join(', ') || '';

    const styleAll = character.style?.all?.join('\n- ') || '';
    const styleChat = character.style?.chat?.join('\n- ') || '';

    let systemPrompt = character.system || `You are ${character.name}.

IDENTITY:
${bio}

${topics ? `EXPERTISE: ${topics}` : ''}

${adjectives ? `PERSONALITY: ${adjectives}` : ''}

COMMUNICATION STYLE:
${styleAll ? `- ${styleAll}` : ''}
${styleChat ? `- ${styleChat}` : ''}

RULES:
- Stay in character at all times
- Keep responses concise (1-4 sentences unless detail is requested)
- Use your unique voice and mannerisms
- Reference your expertise naturally`;

    if (context?.worldState) {
      systemPrompt += `\n\nCURRENT WORLD STATE:\n${context.worldState}`;
    }

    if (context?.tokenData) {
      systemPrompt += `\n\nRELEVANT TOKEN DATA:\n${context.tokenData}`;
    }

    if (context?.agentContext) {
      systemPrompt += `\n\nOTHER AGENTS:\n${context.agentContext}`;
    }

    if (context?.oracleState) {
      systemPrompt += `\n\nORACLE PREDICTION MARKET:\n${context.oracleState}`;
    }

    if (context?.tradingState) {
      systemPrompt += `\n\nYOUR TRADING DATA (use this to answer questions about your positions, performance, and strategy):\n${context.tradingState}`;
    }

    return systemPrompt;
  }

  async generateResponse(
    character: Character,
    userMessage: string,
    conversationHistory: Message[],
    context?: ConversationContext
  ): Promise<LLMResponse> {
    if (this.provider === 'none') {
      throw new Error('No LLM API key configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY');
    }

    const systemPrompt = this.buildSystemPrompt(character, context);

    // Use character's model or default - no Haiku optimization (model IDs are unreliable)
    const model = (character.settings?.model as string) || this.defaultModel;

    // Cap max tokens for cost savings
    const maxTokens = 400;

    return this.callLLM(systemPrompt, userMessage, conversationHistory, model, maxTokens);
  }

  async generateWithSystemPrompt(
    systemPrompt: string,
    userMessage: string,
    conversationHistory: Message[] = [],
    model?: string,
    maxTokens: number = 2000
  ): Promise<LLMResponse> {
    if (this.provider === 'none') {
      throw new Error('No LLM API key configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY');
    }

    return this.callLLM(systemPrompt, userMessage, conversationHistory, model || this.defaultModel, maxTokens);
  }

  private callLLM(
    systemPrompt: string,
    userMessage: string,
    history: Message[],
    model: string,
    maxTokens: number
  ): Promise<LLMResponse> {
    return this.provider === 'anthropic'
      ? this.callAnthropic(systemPrompt, userMessage, history, model, maxTokens)
      : this.callOpenAI(systemPrompt, userMessage, history, model, maxTokens);
  }

  private async callAnthropic(
    systemPrompt: string,
    userMessage: string,
    history: Message[],
    model: string,
    maxTokens: number
  ): Promise<LLMResponse> {
    const messages = [
      ...history.filter(m => m.role !== 'system').map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: userMessage },
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.anthropicApiKey!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as {
        content: Array<{ type: string; text: string }>;
        model: string;
        usage: { input_tokens: number; output_tokens: number };
      };

      const textContent = data.content.find(c => c.type === 'text');

      return {
        text: textContent?.text || '',
        model: data.model,
        usage: {
          inputTokens: data.usage.input_tokens,
          outputTokens: data.usage.output_tokens,
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async callOpenAI(
    systemPrompt: string,
    userMessage: string,
    history: Message[],
    model: string,
    maxTokens: number
  ): Promise<LLMResponse> {
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...history.filter(m => m.role !== 'system'),
      { role: 'user' as const, content: userMessage },
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiApiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
        model: string;
        usage: { prompt_tokens: number; completion_tokens: number };
      };

      return {
        text: data.choices[0]?.message?.content || '',
        model: data.model,
        usage: {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

let standaloneInstance: LLMService | null = null;

export function getLLMService(runtime?: IAgentRuntime): LLMService {
  if (runtime) {
    const service = runtime.getService<LLMService>(LLMService.serviceType);
    if (service) return service;
  }

  if (!standaloneInstance) {
    standaloneInstance = new LLMService();
  }
  return standaloneInstance;
}

export function resetLLMService(): void {
  standaloneInstance = null;
}

export default LLMService;
