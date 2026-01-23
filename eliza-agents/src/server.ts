// BagsWorld Agent Server
// Provides REST API for BagsWorld frontend to communicate with ElizaOS agents

import type { Character, Memory } from './types/elizaos';
import { stringToUuid } from './types/elizaos';
import { characters, getCharacter } from './characters';

interface ChatRequest {
  character: string;
  message: string;
  userId?: string;
  roomId?: string;
}

interface ChatResponse {
  character: string;
  response: string;
  action?: string;
  data?: any;
}

// Agent runtime instances
const agentRuntimes: Map<string, AgentRuntime> = new Map();

/**
 * Initialize all agent runtimes
 */
export async function initializeAgents(): Promise<void> {
  console.log('[BagsWorld Agents] Initializing agent runtimes...');

  for (const [id, character] of Object.entries(characters)) {
    try {
      const runtime = new AgentRuntime({
        character,
        // Database and other config loaded from env
      });

      await runtime.initialize();
      agentRuntimes.set(id, runtime);
      console.log(`[BagsWorld Agents] ${character.name} initialized`);
    } catch (error) {
      console.error(`[BagsWorld Agents] Failed to initialize ${id}:`, error);
    }
  }

  console.log(`[BagsWorld Agents] ${agentRuntimes.size} agents ready`);
}

/**
 * Get runtime for a specific character
 */
export function getAgentRuntime(characterId: string): AgentRuntime | undefined {
  return agentRuntimes.get(characterId.toLowerCase());
}

/**
 * Send a message to an agent and get a response
 */
export async function chatWithAgent(request: ChatRequest): Promise<ChatResponse> {
  const { character, message, userId = 'anonymous', roomId } = request;

  const runtime = getAgentRuntime(character);
  if (!runtime) {
    throw new Error(`Agent "${character}" not found`);
  }

  const characterData = getCharacter(character);
  if (!characterData) {
    throw new Error(`Character "${character}" not found`);
  }

  // Create memory for the message
  const memory: Memory = {
    id: stringToUuid(`msg-${Date.now()}`),
    agentId: runtime.agentId,
    userId: stringToUuid(userId),
    roomId: stringToUuid(roomId || `room-${character}-${userId}`),
    content: {
      text: message,
      source: 'bagsworld',
    },
    createdAt: Date.now(),
  };

  try {
    // Process the message through the runtime
    const responses = await runtime.processActions(memory, [], undefined, async (response) => {
      // Callback for streaming responses (if needed)
    });

    // Get the response text
    const responseText = responses.map(r => r.text).join('\n') || 'No response generated';

    return {
      character: characterData.name,
      response: responseText,
      action: responses[0]?.action,
      data: responses[0]?.data,
    };
  } catch (error) {
    console.error(`[BagsWorld Agents] Error processing message for ${character}:`, error);
    throw error;
  }
}

/**
 * Get status of all agents
 */
export function getAgentStatus(): Record<string, { name: string; ready: boolean }> {
  const status: Record<string, { name: string; ready: boolean }> = {};

  for (const [id, character] of Object.entries(characters)) {
    status[id] = {
      name: character.name,
      ready: agentRuntimes.has(id),
    };
  }

  return status;
}

/**
 * Trigger autonomous action for an agent
 */
export async function triggerAutonomousAction(
  characterId: string,
  eventType: string,
  eventData: any
): Promise<void> {
  const runtime = getAgentRuntime(characterId);
  if (!runtime) {
    console.warn(`[BagsWorld Agents] Cannot trigger action: ${characterId} not found`);
    return;
  }

  // Create an event-triggered memory
  const memory: Memory = {
    id: stringToUuid(`event-${Date.now()}`),
    agentId: runtime.agentId,
    userId: stringToUuid('system'),
    roomId: stringToUuid('bagsworld-events'),
    content: {
      text: `[SYSTEM EVENT] ${eventType}: ${JSON.stringify(eventData)}`,
      source: 'system',
      eventType,
      eventData,
    },
    createdAt: Date.now(),
  };

  try {
    await runtime.processActions(memory, [], undefined, async (response) => {
      // Handle autonomous response (e.g., post to Twitter)
      console.log(`[${characterId}] Autonomous response:`, response.text);
    });
  } catch (error) {
    console.error(`[BagsWorld Agents] Autonomous action failed:`, error);
  }
}

// Export for use in API routes
export { characters };
