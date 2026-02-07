/**
 * AgentDialogueService - Agent-to-agent conversations
 *
 * When two agents are nearby and one decides to 'approach', this service
 * generates a short 2-4 turn dialogue using the LLM and plays it back
 * via WorldSyncService with staggered timing.
 *
 * Budget-conscious: short prompts, max 200 tokens per LLM call.
 * Rate-limited: max 1 dialogue per agent per 2 minutes.
 */

import { WorldSyncService, getWorldSyncService } from './WorldSyncService.js';
import { LLMService } from './LLMService.js';
import { getMemoryService } from './MemoryService.js';
import { getRelationshipService } from './RelationshipService.js';
import { characters as characterRegistry } from '../characters/index.js';
import type { Character } from '../types/elizaos.js';

export interface DialogueLine {
  agentId: string;
  message: string;
  emotion: string;
  delay: number; // ms to wait before showing this line
}

export class AgentDialogueService {
  private worldSync: WorldSyncService;
  private llmService: LLMService | null = null;
  private activeDialogues: Map<string, boolean> = new Map();
  private lastDialogueTime: Map<string, number> = new Map();
  private dialogueCooldown = 120000; // 2 minutes

  constructor(worldSync?: WorldSyncService) {
    this.worldSync = worldSync || getWorldSyncService();
  }

  /**
   * Set the LLM service for dialogue generation
   */
  setLLMService(llmService: LLMService): void {
    this.llmService = llmService;
  }

  /**
   * Check if an agent is currently in a dialogue
   */
  isInDialogue(agentId: string): boolean {
    return this.activeDialogues.get(agentId) === true;
  }

  /**
   * Check if an agent can start a new dialogue (not in one, not on cooldown)
   */
  canStartDialogue(agentId: string): boolean {
    if (this.isInDialogue(agentId)) return false;

    const lastTime = this.lastDialogueTime.get(agentId) || 0;
    return Date.now() - lastTime >= this.dialogueCooldown;
  }

  /**
   * Attempt to start a dialogue between two agents.
   * Returns true if the dialogue was started, false if preconditions weren't met.
   */
  async tryStartDialogue(agentId: string, targetAgentId: string): Promise<boolean> {
    // Both agents must be available
    if (!this.canStartDialogue(agentId) || !this.canStartDialogue(targetAgentId)) {
      return false;
    }

    // Need LLM for dialogue generation
    if (!this.llmService) {
      return false;
    }

    // Look up both characters
    const char1 = characterRegistry[agentId];
    const char2 = characterRegistry[targetAgentId];
    if (!char1 || !char2) {
      return false;
    }

    // Mark both agents as in dialogue
    this.activeDialogues.set(agentId, true);
    this.activeDialogues.set(targetAgentId, true);

    let dialogueLines: DialogueLine[] = [];

    try {
      dialogueLines = await this.generateDialogue(agentId, char1, targetAgentId, char2);
      if (dialogueLines.length > 0) {
        await this.playDialogue(dialogueLines);
      }
    } catch (err) {
      console.error(`[AgentDialogue] Error generating dialogue between ${agentId} and ${targetAgentId}:`, err);
    } finally {
      // Clear active state and record cooldown
      this.activeDialogues.set(agentId, false);
      this.activeDialogues.set(targetAgentId, false);
      const now = Date.now();
      this.lastDialogueTime.set(agentId, now);
      this.lastDialogueTime.set(targetAgentId, now);

      // Record conversation end in world sync for tick cooldowns
      this.worldSync.recordConversationEnd(agentId);
      this.worldSync.recordConversationEnd(targetAgentId);

      // Persist dialogue to long-term memory and update agent-to-agent relationships
      this.persistDialogue(agentId, targetAgentId, dialogueLines);
    }

    return true;
  }

  /**
   * Generate a short 2-4 turn dialogue between two characters using LLM
   */
  private async generateDialogue(
    agent1Id: string,
    char1: Character,
    agent2Id: string,
    char2: Character
  ): Promise<DialogueLine[]> {
    if (!this.llmService) return [];

    const bio1 = this.getShortBio(char1);
    const bio2 = this.getShortBio(char2);

    const systemPrompt = `Write a 2-4 line dialogue between ${char1.name} and ${char2.name} in BagsWorld.

${char1.name}: ${bio1}
${char2.name}: ${bio2}

Rules:
- Each line under 60 chars
- Stay in character
- Casual, friendly tone
- Format: NAME: message`;

    const userPrompt = `${char1.name} walks up to ${char2.name}. Write their short exchange.`;

    try {
      const response = await this.llmService.generateWithSystemPrompt(
        systemPrompt,
        userPrompt,
        [],
        undefined,
        200
      );

      return this.parseDialogueResponse(response.text, agent1Id, char1.name, agent2Id, char2.name);
    } catch (err) {
      console.error('[AgentDialogue] LLM call failed:', err);
      return this.getFallbackDialogue(agent1Id, char1.name, agent2Id, char2.name);
    }
  }

  /**
   * Parse LLM response into DialogueLine array
   */
  private parseDialogueResponse(
    response: string,
    agent1Id: string,
    name1: string,
    agent2Id: string,
    name2: string
  ): DialogueLine[] {
    const lines: DialogueLine[] = [];
    const rawLines = response.split('\n').filter(l => l.trim().length > 0);

    // Build a name-to-agentId map (case-insensitive)
    const nameMap = new Map<string, string>();
    nameMap.set(name1.toLowerCase(), agent1Id);
    nameMap.set(name2.toLowerCase(), agent2Id);

    let delay = 500; // Initial delay before first line

    for (const raw of rawLines) {
      // Match "Name: message" or "**Name**: message" patterns
      const match = raw.match(/^\*{0,2}([^:*]+?)\*{0,2}\s*:\s*(.+)/);
      if (!match) continue;

      const speakerName = match[1].trim().toLowerCase();
      const message = match[2].trim().slice(0, 80); // Cap at 80 chars

      // Determine which agent is speaking
      let agentId: string | undefined;
      for (const [name, id] of nameMap) {
        if (speakerName.includes(name) || name.includes(speakerName)) {
          agentId = id;
          break;
        }
      }

      if (!agentId || message.length === 0) continue;

      lines.push({
        agentId,
        message,
        emotion: this.detectDialogueEmotion(message),
        delay,
      });

      // Stagger subsequent lines by 2-3 seconds
      delay += 2000 + Math.floor(Math.random() * 1000);

      // Cap at 4 lines
      if (lines.length >= 4) break;
    }

    // If parsing produced too few lines, use fallback
    if (lines.length < 2) {
      return this.getFallbackDialogue(agent1Id, name1, agent2Id, name2);
    }

    return lines;
  }

  /**
   * Simple fallback dialogue when LLM fails or parsing produces < 2 lines
   */
  private getFallbackDialogue(
    agent1Id: string,
    name1: string,
    agent2Id: string,
    name2: string
  ): DialogueLine[] {
    const greetings = [
      [`Hey ${name2}, how's it going?`, `Not bad, ${name1}! Just doing my thing.`],
      [`What's new around here?`, `Same old, same old. The world keeps spinning!`],
      [`Good to see you!`, `Likewise! BagsWorld is buzzing today.`],
      [`Yo! What are you up to?`, `Just keeping an eye on things. You?`],
    ];

    const pair = greetings[Math.floor(Math.random() * greetings.length)];

    return [
      { agentId: agent1Id, message: pair[0], emotion: 'happy', delay: 500 },
      { agentId: agent2Id, message: pair[1], emotion: 'happy', delay: 3000 },
    ];
  }

  /**
   * Play dialogue lines with staggered timing via WorldSyncService
   */
  private async playDialogue(lines: DialogueLine[]): Promise<void> {
    for (const line of lines) {
      await this.wait(line.delay);
      this.worldSync.sendSpeak(line.agentId, line.message, line.emotion);
    }
  }

  /**
   * Persist dialogue lines to agent memory and update agent-to-agent relationships.
   * Fire-and-forget: errors are logged but do not affect dialogue flow.
   */
  private persistDialogue(agent1Id: string, agent2Id: string, lines: DialogueLine[]): void {
    if (lines.length === 0) return;

    const memoryService = getMemoryService();
    const relationshipService = getRelationshipService();

    if (!memoryService && !relationshipService) return;

    const dialogueSummary = lines.map(l => `${l.agentId}: ${l.message}`).join(' | ');

    const promises: Promise<unknown>[] = [];

    // Store the dialogue as a memory for both agents
    if (memoryService) {
      promises.push(
        memoryService.createMemory({
          agentId: agent1Id,
          content: `Dialogue with ${agent2Id}: ${dialogueSummary}`,
          memoryType: 'message',
          importance: 0.5,
          metadata: { dialogueWith: agent2Id, lineCount: lines.length },
        }).catch((err: Error) => console.warn('[AgentDialogue] Memory write failed:', err.message))
      );

      promises.push(
        memoryService.createMemory({
          agentId: agent2Id,
          content: `Dialogue with ${agent1Id}: ${dialogueSummary}`,
          memoryType: 'message',
          importance: 0.5,
          metadata: { dialogueWith: agent1Id, lineCount: lines.length },
        }).catch((err: Error) => console.warn('[AgentDialogue] Memory write failed:', err.message))
      );
    }

    // Update agent-to-agent relationships (both directions)
    if (relationshipService) {
      promises.push(
        relationshipService.updateAfterInteraction(agent1Id, agent2Id, 'agent', {
          sentiment: 0.2, // Agent dialogues are friendly
        }).catch((err: Error) => console.warn('[AgentDialogue] Relationship update failed:', err.message))
      );

      promises.push(
        relationshipService.updateAfterInteraction(agent2Id, agent1Id, 'agent', {
          sentiment: 0.2,
        }).catch((err: Error) => console.warn('[AgentDialogue] Relationship update failed:', err.message))
      );
    }

    Promise.all(promises).catch(() => {});
  }

  /**
   * Extract a short bio string (first sentence or first 100 chars)
   */
  private getShortBio(character: Character): string {
    const bio = Array.isArray(character.bio) ? character.bio[0] || '' : (character.bio || '');
    if (bio.length <= 100) return bio;
    const firstSentence = bio.match(/^[^.!?]+[.!?]/);
    return firstSentence ? firstSentence[0] : bio.slice(0, 100);
  }

  /**
   * Detect emotion from dialogue line content
   */
  private detectDialogueEmotion(message: string): string {
    const lower = message.toLowerCase();
    if (/haha|lol|lmao|😂|🤣|funny/.test(lower)) return 'happy';
    if (/wow|whoa|omg|!{2,}/.test(lower)) return 'surprised';
    if (/hmm|interesting|curious/.test(lower)) return 'neutral';
    if (/!\s*$/.test(message)) return 'happy';
    if (/\?$/.test(message)) return 'neutral';
    return 'neutral';
  }

  /**
   * Simple promise-based delay
   */
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get service stats
   */
  getStats(): { activeCount: number; cooldownCount: number } {
    let activeCount = 0;
    let cooldownCount = 0;
    const now = Date.now();

    for (const [, active] of this.activeDialogues) {
      if (active) activeCount++;
    }
    for (const [, time] of this.lastDialogueTime) {
      if (now - time < this.dialogueCooldown) cooldownCount++;
    }

    return { activeCount, cooldownCount };
  }
}

// Singleton
let instance: AgentDialogueService | null = null;

export function getAgentDialogueService(): AgentDialogueService {
  if (!instance) {
    instance = new AgentDialogueService();
  }
  return instance;
}

export function resetAgentDialogueService(): void {
  instance = null;
}

export default AgentDialogueService;
