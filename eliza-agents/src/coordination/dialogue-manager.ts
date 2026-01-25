// Dialogue Manager - Multi-agent conversation orchestration
// Enables agents to have conversations with each other

import Anthropic from '@anthropic-ai/sdk';
import { getAgentBus } from './agent-bus';
import { getSharedContext } from './shared-context';
import { getCharacter } from '../characters';
import { createLogger } from '../utils/logger';
import type {
  DialogueRequest,
  DialogueResult,
  DialogueTurn,
  DialoguePayload,
  CoordinationMessage,
} from './types';

const log = createLogger('DialogueManager');

export class DialogueManager {
  private anthropic: Anthropic;
  private activeDialogues: Map<string, DialoguePayload> = new Map();
  private bus = getAgentBus();
  private sharedContext = getSharedContext();

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required for DialogueManager');
    }
    this.anthropic = new Anthropic({ apiKey });
  }

  // ==================== Dialogue Generation ====================

  async generateDialogue(request: DialogueRequest): Promise<DialogueResult> {
    const { topic, participants, initiator, context, maxTurns = 6, style = 'casual' } = request;

    log.info(`Generating dialogue: "${topic}" with ${participants.join(', ')}`);

    // Get character definitions for participants
    const characterDefs = participants.map(p => {
      const char = getCharacter(p);
      if (!char) {
        throw new Error(`Unknown participant: ${p}`);
      }
      return char;
    });

    // Build system prompt for dialogue generation
    const systemPrompt = this.buildDialogueSystemPrompt(characterDefs, topic, style);

    // Get world context
    const worldContext = this.sharedContext.formatWorldStateForPrompt();

    // Generate the dialogue
    const userPrompt = this.buildDialogueUserPrompt(
      characterDefs,
      topic,
      initiator,
      maxTurns,
      context,
      worldContext
    );

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    // Parse the response
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response format');
    }

    const result = this.parseDialogueResponse(content.text, participants);

    log.info(`Generated ${result.turns.length} dialogue turns`);
    return result;
  }

  private buildDialogueSystemPrompt(
    characters: Array<ReturnType<typeof getCharacter>>,
    topic: string,
    style: DialogueRequest['style']
  ): string {
    let prompt = `You are a dialogue director orchestrating a multi-agent conversation between BagsWorld AI characters.

Your task is to generate a natural, in-character conversation about: "${topic}"

The conversation should be ${style === 'casual' ? 'casual and friendly' :
      style === 'formal' ? 'professional and informative' :
      style === 'debate' ? 'a respectful debate with different viewpoints' :
      'collaborative and solution-oriented'}.

CHARACTER PROFILES:
`;

    for (const char of characters) {
      if (!char) continue;
      prompt += `\n**${char.name}**:\n`;
      prompt += `- Bio: ${(char.bio as string[]).slice(0, 2).join('. ')}\n`;
      prompt += `- Style: ${(char.style?.all as string[] || []).slice(0, 2).join(', ')}\n`;
      if (char.system) {
        // Extract speech patterns from system prompt
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

  private buildDialogueUserPrompt(
    characters: Array<ReturnType<typeof getCharacter>>,
    topic: string,
    initiator: string,
    maxTurns: number,
    context?: string,
    worldContext?: string
  ): string {
    const initiatorChar = characters.find(c => c?.name.toLowerCase() === initiator.toLowerCase());
    const initiatorName = initiatorChar?.name || initiator;

    let prompt = `Generate a ${maxTurns}-turn conversation about "${topic}".

The conversation starts with ${initiatorName} initiating.
Participants: ${characters.map(c => c?.name).filter(Boolean).join(', ')}
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

  private parseDialogueResponse(text: string, participants: string[]): DialogueResult {
    const turns: DialogueTurn[] = [];
    const lines = text.split('\n').filter(line => line.trim());

    for (const line of lines) {
      // Match pattern: [Name]: message or Name: message
      const match = line.match(/^\[?(\w+)\]?:\s*(.+)$/);
      if (match) {
        const speaker = match[1];
        const message = match[2].trim();

        // Verify speaker is a participant (case-insensitive)
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

    // Determine overall sentiment
    const positiveWords = ['great', 'good', 'excellent', 'love', 'amazing', 'bullish', 'pumping', 'wagmi'];
    const negativeWords = ['bad', 'terrible', 'hate', 'bearish', 'dumping', 'ngmi', 'rug'];

    let positiveCount = 0;
    let negativeCount = 0;

    for (const turn of turns) {
      const lowerMessage = turn.message.toLowerCase();
      positiveCount += positiveWords.filter(w => lowerMessage.includes(w)).length;
      negativeCount += negativeWords.filter(w => lowerMessage.includes(w)).length;
    }

    const sentiment = positiveCount > negativeCount ? 'positive' :
                      negativeCount > positiveCount ? 'negative' : 'neutral';

    return {
      turns,
      sentiment,
      summary: turns.length > 0 ? `${turns.length}-turn conversation about the topic` : undefined,
    };
  }

  // ==================== Active Dialogue Management ====================

  startDialogue(
    dialogueId: string,
    topic: string,
    participants: string[],
    initiator: string,
    maxTurns: number = 6
  ): void {
    const dialogue: DialoguePayload = {
      topic,
      participants,
      initiator,
      currentSpeaker: initiator,
      turn: 0,
      history: [],
      maxTurns,
    };

    this.activeDialogues.set(dialogueId, dialogue);

    // Broadcast dialogue start
    this.bus.broadcast(initiator, 'dialogue', dialogue);

    log.info(`Started dialogue ${dialogueId}: "${topic}"`);
  }

  async addTurn(dialogueId: string, speaker: string, message: string): Promise<boolean> {
    const dialogue = this.activeDialogues.get(dialogueId);
    if (!dialogue) {
      log.warn(`Dialogue ${dialogueId} not found`);
      return false;
    }

    // Verify it's the current speaker's turn
    if (dialogue.currentSpeaker.toLowerCase() !== speaker.toLowerCase()) {
      log.warn(`Not ${speaker}'s turn in dialogue ${dialogueId}`);
      return false;
    }

    // Add turn
    dialogue.history.push({
      speaker,
      message,
      timestamp: Date.now(),
    });

    dialogue.turn++;

    // Determine next speaker
    const currentIndex = dialogue.participants.findIndex(
      p => p.toLowerCase() === speaker.toLowerCase()
    );
    const nextIndex = (currentIndex + 1) % dialogue.participants.length;
    dialogue.currentSpeaker = dialogue.participants[nextIndex];

    // Check if dialogue is complete
    if (dialogue.turn >= dialogue.maxTurns!) {
      this.endDialogue(dialogueId);
      return true;
    }

    // Broadcast updated dialogue state
    this.bus.broadcast(speaker, 'dialogue', dialogue);

    return true;
  }

  endDialogue(dialogueId: string): DialoguePayload | null {
    const dialogue = this.activeDialogues.get(dialogueId);
    if (!dialogue) return null;

    this.activeDialogues.delete(dialogueId);
    log.info(`Ended dialogue ${dialogueId} after ${dialogue.turn} turns`);

    return dialogue;
  }

  getActiveDialogue(dialogueId: string): DialoguePayload | null {
    return this.activeDialogues.get(dialogueId) || null;
  }

  getActiveDialogues(): Map<string, DialoguePayload> {
    return this.activeDialogues;
  }

  // ==================== Response Generation ====================

  async generateResponse(
    agentId: string,
    message: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    mentionedAgents?: string[]
  ): Promise<{ response: string; shouldHandoff?: string }> {
    const character = getCharacter(agentId);
    if (!character) {
      throw new Error(`Unknown agent: ${agentId}`);
    }

    // Build system prompt with character and context
    const worldContext = this.sharedContext.formatWorldStateForPrompt();

    let systemPrompt = character.system || '';
    systemPrompt += `\n\n${worldContext}`;

    // Add mention awareness
    if (mentionedAgents && mentionedAgents.length > 0) {
      systemPrompt += `\n\nNOTE: The user mentioned these other agents: ${mentionedAgents.join(', ')}. `;
      systemPrompt += `If their question is better suited for one of them, suggest asking that agent instead.`;
    }

    // Add other active agents for potential handoff
    const otherAgents = this.bus.getActiveAgents()
      .filter(a => a.id !== agentId)
      .map(a => a.character.name);

    if (otherAgents.length > 0) {
      systemPrompt += `\n\nOther available agents: ${otherAgents.join(', ')}. `;
      systemPrompt += `If a question is outside your expertise, you can suggest the user talk to a more appropriate agent.`;
    }

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        ...conversationHistory,
        { role: 'user', content: message },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response format');
    }

    // Check for handoff suggestion
    const handoffMatch = content.text.match(/\b(ask|talk to|check with)\s+(neo|cj|finn|ash|toly|shaw|ghost|bags[- ]?bot)\b/i);
    const shouldHandoff = handoffMatch ? handoffMatch[2].toLowerCase().replace(/\s+/g, '-') : undefined;

    return {
      response: content.text,
      shouldHandoff,
    };
  }

  // ==================== Mention Handling ====================

  async handleMention(message: CoordinationMessage): Promise<string | null> {
    const payload = message.payload as { mentionedAgent: string; userMessage: string; context: unknown[] };
    const mentionedAgentId = payload.mentionedAgent;

    const character = getCharacter(mentionedAgentId);
    if (!character) {
      log.warn(`Mentioned agent not found: ${mentionedAgentId}`);
      return null;
    }

    // Generate a brief acknowledgment that the agent was mentioned
    const worldContext = this.sharedContext.formatWorldStateForPrompt();

    const systemPrompt = `${character.system || ''}

${worldContext}

You were just mentioned by another user. Provide a brief, in-character response.
Keep it short (1-2 sentences) and relevant to what was said.`;

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 200,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Someone mentioned you in a conversation: "${payload.userMessage}". Respond briefly.`,
      }],
    });

    const content = response.content[0];
    if (content.type !== 'text') return null;

    return content.text;
  }
}

// Singleton instance
let dialogueInstance: DialogueManager | null = null;

export function getDialogueManager(): DialogueManager {
  if (!dialogueInstance) {
    dialogueInstance = new DialogueManager();
  }
  return dialogueInstance;
}

export default DialogueManager;
