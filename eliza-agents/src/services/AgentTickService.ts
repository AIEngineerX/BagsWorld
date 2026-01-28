/**
 * AgentTickService - Autonomous agent behavior loop
 *
 * Runs a continuous tick loop that processes each agent through the
 * perceive → think → act cycle. Based on eliza-town's Agent.tick() architecture.
 *
 * - 70% of decisions use rule-based logic (fast, cheap)
 * - 30% of decisions use LLM for complex social situations
 * - 4-second tick interval
 */

import type {
  Character,
  ZoneType,
  AgentWorldState,
  AgentDecision,
} from '../types/elizaos.js';
import { WorldSyncService, getWorldSyncService } from './WorldSyncService.js';
import { LLMService } from './LLMService.js';
import { AgentCoordinator, getAgentCoordinator } from './AgentCoordinator.js';
import { characters as characterRegistry } from '../characters/index.js';

// Timing constants (based on eliza-town)
const TICK_INTERVAL = 10000;          // 10 seconds between ticks
const ACTION_TIMEOUT = 60000;         // 60 seconds max for an operation
const CONVERSATION_COOLDOWN = 30000;  // 30 seconds after conversation
const ACTIVITY_COOLDOWN = 15000;      // 15 seconds after activity
const ACTIVITY_MIN_DURATION = 5000;   // Minimum 5 seconds for activities
const ACTIVITY_MAX_DURATION = 15000;  // Maximum 15 seconds for activities

// Activities that agents can perform (based on eliza-town)
const ACTIVITIES: Array<{ description: string; emoji: string; weight: number }> = [
  { description: 'thinking deeply', emoji: '🤔', weight: 2 },
  { description: 'checking the chain', emoji: '⛓️', weight: 3 },
  { description: 'analyzing data', emoji: '📊', weight: 2 },
  { description: 'observing the world', emoji: '👁️', weight: 3 },
  { description: 'contemplating', emoji: '💭', weight: 1 },
  { description: 'taking notes', emoji: '📝', weight: 1 },
];

// Character-specific default behaviors
const CHARACTER_BEHAVIORS: Record<string, {
  preferredZone: ZoneType;
  activityChance: number;
  interactionChance: number;
  specialActivities: Array<{ description: string; emoji: string; chance: number }>;
}> = {
  neo: {
    preferredZone: 'trending',
    activityChance: 0.4,
    interactionChance: 0.25,
    specialActivities: [
      { description: 'scanning for new launches', emoji: '🔍', chance: 0.35 },
      { description: 'analyzing trading patterns', emoji: '📈', chance: 0.25 },
      { description: 'monitoring whale movements', emoji: '🐋', chance: 0.2 },
    ],
  },
  ghost: {
    preferredZone: 'labs',
    activityChance: 0.35,
    interactionChance: 0.2,
    specialActivities: [
      { description: 'verifying on-chain data', emoji: '🔐', chance: 0.4 },
      { description: 'checking the community fund', emoji: '💰', chance: 0.3 },
      { description: 'reviewing smart contracts', emoji: '📜', chance: 0.2 },
    ],
  },
  finn: {
    preferredZone: 'main_city',
    activityChance: 0.25,
    interactionChance: 0.5,
    specialActivities: [
      { description: 'planning new features', emoji: '✨', chance: 0.3 },
      { description: 'reviewing the roadmap', emoji: '🗺️', chance: 0.2 },
    ],
  },
  ash: {
    preferredZone: 'main_city',
    activityChance: 0.2,
    interactionChance: 0.6,
    specialActivities: [
      { description: 'greeting newcomers', emoji: '👋', chance: 0.4 },
      { description: 'tending to the critters', emoji: '🐿️', chance: 0.3 },
    ],
  },
  cj: {
    preferredZone: 'trending',
    activityChance: 0.3,
    interactionChance: 0.4,
    specialActivities: [
      { description: 'watching the streets', emoji: '👀', chance: 0.35 },
      { description: 'checking market vibes', emoji: '📉', chance: 0.25 },
    ],
  },
  shaw: {
    preferredZone: 'labs',
    activityChance: 0.45,
    interactionChance: 0.2,
    specialActivities: [
      { description: 'architecting agent systems', emoji: '🏗️', chance: 0.4 },
      { description: 'reviewing elizaOS code', emoji: '💻', chance: 0.3 },
      { description: 'optimizing runtime performance', emoji: '⚡', chance: 0.2 },
    ],
  },
  toly: {
    preferredZone: 'founders',
    activityChance: 0.35,
    interactionChance: 0.35,
    specialActivities: [
      { description: 'explaining Solana consensus', emoji: '⚙️', chance: 0.3 },
      { description: 'debugging validator logs', emoji: '🔧', chance: 0.25 },
    ],
  },
  'bags-bot': {
    preferredZone: 'main_city',
    activityChance: 0.15,
    interactionChance: 0.3,
    specialActivities: [
      { description: 'processing commands', emoji: '🤖', chance: 0.3 },
      { description: 'updating world data', emoji: '🔄', chance: 0.25 },
    ],
  },
  ramo: {
    preferredZone: 'labs',
    activityChance: 0.4,
    interactionChance: 0.25,
    specialActivities: [
      { description: 'auditing smart contracts', emoji: '🔒', chance: 0.35 },
      { description: 'reviewing SDK changes', emoji: '📦', chance: 0.25 },
    ],
  },
  sincara: {
    preferredZone: 'labs',
    activityChance: 0.35,
    interactionChance: 0.3,
    specialActivities: [
      { description: 'designing UI components', emoji: '🎨', chance: 0.35 },
      { description: 'testing user flows', emoji: '🖱️', chance: 0.25 },
    ],
  },
  stuu: {
    preferredZone: 'labs',
    activityChance: 0.25,
    interactionChance: 0.45,
    specialActivities: [
      { description: 'handling support tickets', emoji: '🎫', chance: 0.35 },
      { description: 'updating documentation', emoji: '📚', chance: 0.25 },
    ],
  },
  sam: {
    preferredZone: 'trending',
    activityChance: 0.3,
    interactionChance: 0.5,
    specialActivities: [
      { description: 'planning marketing campaigns', emoji: '📣', chance: 0.3 },
      { description: 'analyzing growth metrics', emoji: '📈', chance: 0.25 },
    ],
  },
  alaa: {
    preferredZone: 'labs',
    activityChance: 0.5,
    interactionChance: 0.15,
    specialActivities: [
      { description: 'experimenting with new tech', emoji: '🧪', chance: 0.4 },
      { description: 'building prototypes', emoji: '🔬', chance: 0.3 },
    ],
  },
  carlo: {
    preferredZone: 'main_city',
    activityChance: 0.2,
    interactionChance: 0.6,
    specialActivities: [
      { description: 'connecting with community members', emoji: '🤝', chance: 0.4 },
      { description: 'organizing events', emoji: '📅', chance: 0.25 },
    ],
  },
  bnn: {
    preferredZone: 'trending',
    activityChance: 0.35,
    interactionChance: 0.25,
    specialActivities: [
      { description: 'gathering news updates', emoji: '📰', chance: 0.4 },
      { description: 'writing reports', emoji: '✍️', chance: 0.3 },
    ],
  },
  'professor-oak': {
    preferredZone: 'founders',
    activityChance: 0.4,
    interactionChance: 0.35,
    specialActivities: [
      { description: 'preparing lesson materials', emoji: '📖', chance: 0.35 },
      { description: 'reviewing student progress', emoji: '🎓', chance: 0.25 },
    ],
  },
};

// Default behavior for unknown characters
const DEFAULT_BEHAVIOR = {
  preferredZone: 'main_city' as ZoneType,
  activityChance: 0.3,
  interactionChance: 0.3,
  specialActivities: [],
};

interface AgentTickState {
  id: string;
  character: Character;
  inProgressOperation?: {
    name: string;
    started: number;
  };
  lastDecisionTime: number;
  llmCallsThisPeriod: number;
}

export class AgentTickService {
  private worldSync: WorldSyncService;
  private coordinator: AgentCoordinator | null;
  private llmService: LLMService | null = null;
  private tickInterval: NodeJS.Timeout | null = null;
  private agentStates: Map<string, AgentTickState> = new Map();
  private isRunning = false;
  private lastTickTime = 0;
  private tickCount = 0;

  // LLM rate limiting
  private readonly LLM_CALLS_PER_MINUTE = 15;
  private llmCallCount = 0;
  private llmCallResetTime = Date.now();

  constructor(worldSync?: WorldSyncService, coordinator?: AgentCoordinator | null) {
    this.worldSync = worldSync || getWorldSyncService();
    this.coordinator = coordinator !== undefined ? coordinator : getAgentCoordinator();
  }

  /**
   * Set the coordinator service
   */
  setCoordinator(coordinator: AgentCoordinator): void {
    this.coordinator = coordinator;
  }

  /**
   * Set the LLM service for complex decisions
   */
  setLLMService(llmService: LLMService): void {
    this.llmService = llmService;
  }

  /**
   * Register an agent for tick processing
   */
  registerAgent(agentId: string, character?: Character): void {
    const resolvedCharacter = character || characterRegistry[agentId];

    if (!resolvedCharacter) {
      console.warn(`[AgentTick] No character found for agent: ${agentId}`);
      return;
    }

    this.agentStates.set(agentId, {
      id: agentId,
      character: resolvedCharacter,
      lastDecisionTime: 0,
      llmCallsThisPeriod: 0,
    });

    // Also register with WorldSync
    const behavior = CHARACTER_BEHAVIORS[agentId] || DEFAULT_BEHAVIOR;
    this.worldSync.registerAgent(agentId, behavior.preferredZone);

    console.log(`[AgentTick] Registered agent: ${agentId} (${resolvedCharacter.name})`);
  }

  /**
   * Start the tick loop
   */
  start(): void {
    if (this.isRunning) {
      console.warn('[AgentTick] Already running');
      return;
    }

    this.isRunning = true;
    console.log(`[AgentTick] Starting tick loop (${TICK_INTERVAL}ms interval)`);

    // Run first tick after short delay
    setTimeout(() => {
      if (this.isRunning) {
        this.tick();
      }
    }, 2000);

    // Start interval
    this.tickInterval = setInterval(() => {
      if (this.isRunning) {
        this.tick();
      }
    }, TICK_INTERVAL);
  }

  /**
   * Stop the tick loop
   */
  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    this.isRunning = false;
    console.log('[AgentTick] Stopped tick loop');
  }

  /**
   * Main tick function - process all agents
   */
  private async tick(): Promise<void> {
    const now = Date.now();
    this.lastTickTime = now;
    this.tickCount++;

    // Reset LLM call counter every minute
    if (now - this.llmCallResetTime > 60000) {
      this.llmCallCount = 0;
      this.llmCallResetTime = now;
    }

    // Process agents in batches to avoid overwhelming
    const agents = Array.from(this.agentStates.entries());
    const BATCH_SIZE = 4;

    for (let i = 0; i < agents.length; i += BATCH_SIZE) {
      const batch = agents.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(([agentId, state]) => this.tickAgent(agentId, state, now)));
    }
  }

  /**
   * Process a single agent's tick
   */
  private async tickAgent(agentId: string, state: AgentTickState, now: number): Promise<void> {
    // Get world state for this agent
    const worldState = this.worldSync.getAgentState(agentId);

    // Check if operation in progress
    if (state.inProgressOperation) {
      if (now < state.inProgressOperation.started + ACTION_TIMEOUT) {
        return; // Still waiting
      }
      // Operation timed out
      console.log(`[AgentTick] Operation timeout for ${agentId}: ${state.inProgressOperation.name}`);
      delete state.inProgressOperation;
    }

    // Check if doing activity
    if (worldState?.currentActivity && worldState.currentActivity.until > now) {
      return; // Still doing activity
    }

    // Check if moving
    if (worldState?.isMoving) {
      return; // Let them finish moving
    }

    // Calculate cooldowns
    const justLeftConversation =
      worldState?.lastConversation && now < worldState.lastConversation + CONVERSATION_COOLDOWN;
    const recentActivity =
      worldState?.lastActivity && now < worldState.lastActivity + ACTIVITY_COOLDOWN;

    // Make decision
    const decision = await this.decide(agentId, state, worldState, {
      justLeftConversation: !!justLeftConversation,
      recentActivity: !!recentActivity,
      now,
    });

    // Execute decision
    await this.execute(agentId, decision, now);
    state.lastDecisionTime = now;
  }

  /**
   * Make a decision for an agent
   */
  private async decide(
    agentId: string,
    state: AgentTickState,
    worldState: AgentWorldState | null,
    context: {
      justLeftConversation: boolean;
      recentActivity: boolean;
      now: number;
    }
  ): Promise<AgentDecision> {
    const behavior = CHARACTER_BEHAVIORS[agentId] || DEFAULT_BEHAVIOR;
    const nearbyAgents = worldState?.nearbyAgents || [];

    // Priority 1: Check for pending messages from coordinator
    if (this.coordinator) {
      const pendingMessages = this.coordinator.getMessages(agentId, { limit: 10 });
      if (pendingMessages.length > 0) {
        const urgentMessage = pendingMessages.find((m) => m.priority === 'high' || m.priority === 'urgent');
        if (urgentMessage) {
          return {
            type: 'speak',
            message: urgentMessage.content,
            isSignificant: true,
          };
        }
      }
    }

    // Priority 2: Social interaction (if nearby agents and not on cooldown)
    if (nearbyAgents.length > 0 && !context.justLeftConversation) {
      const shouldInteract = Math.random() < behavior.interactionChance;
      if (shouldInteract) {
        // 30% chance to use LLM for social decisions
        if (this.shouldUseLLM()) {
          return this.llmDecision(agentId, state, worldState, 'interaction', nearbyAgents[0]);
        }
        return {
          type: 'approach',
          targetAgentId: nearbyAgents[0],
        };
      }
    }

    // Priority 3: Character-specific activity
    if (!context.recentActivity && Math.random() < behavior.activityChance) {
      // Check for special activities first
      for (const activity of behavior.specialActivities) {
        if (Math.random() < activity.chance) {
          return {
            type: 'activity',
            description: activity.description,
            emoji: activity.emoji,
            duration: ACTIVITY_MIN_DURATION + Math.random() * (ACTIVITY_MAX_DURATION - ACTIVITY_MIN_DURATION),
          };
        }
      }

      // Generic activity
      const activity = this.pickWeightedActivity();
      return {
        type: 'activity',
        description: activity.description,
        emoji: activity.emoji,
        duration: ACTIVITY_MIN_DURATION + Math.random() * (ACTIVITY_MAX_DURATION - ACTIVITY_MIN_DURATION),
      };
    }

    // Priority 4: Wander
    const currentZone = worldState?.position.zone || behavior.preferredZone;

    // 20% chance to move to preferred zone if not there
    if (currentZone !== behavior.preferredZone && Math.random() < 0.2) {
      return {
        type: 'wander',
        zone: behavior.preferredZone,
      };
    }

    // Otherwise wander in current zone
    return {
      type: 'wander',
      zone: currentZone,
    };
  }

  /**
   * Check if we should use LLM for this decision
   */
  private shouldUseLLM(): boolean {
    // Rate limiting
    if (this.llmCallCount >= this.LLM_CALLS_PER_MINUTE) {
      return false;
    }

    // No LLM service configured
    if (!this.llmService) {
      return false;
    }

    // 30% chance for social situations
    return Math.random() < 0.3;
  }

  /**
   * Make an LLM-based decision
   */
  private async llmDecision(
    agentId: string,
    state: AgentTickState,
    worldState: AgentWorldState | null,
    situation: string,
    targetAgentId?: string
  ): Promise<AgentDecision> {
    if (!this.llmService) {
      return { type: 'wander', zone: worldState?.position.zone || 'main_city' };
    }

    this.llmCallCount++;

    const character = state.character;
    const zone = worldState?.position.zone || 'main_city';
    const nearbyAgents = worldState?.nearbyAgents || [];

    const bio = Array.isArray(character.bio) ? character.bio.join(' ') : (character.bio || '');

    const systemPrompt = `You are ${character.name} in BagsWorld, a pixel art game world.

CHARACTER:
${bio}

RULES:
- Stay in character
- Keep responses brief
- Choose ONE action from the available options`;

    const userPrompt = `CURRENT SITUATION:
- You are in the ${zone} zone
- Nearby characters: ${nearbyAgents.join(', ') || 'none'}
- Context: ${situation}
${targetAgentId ? `- You notice ${targetAgentId} nearby` : ''}

What do you do? Choose ONE action:
- APPROACH [character] - Walk toward someone to interact
- SPEAK "[short message]" - Say something (keep under 50 chars)
- ACTIVITY "[what you're doing]" - Do something for a few seconds
- WANDER - Move to a new spot

Respond with just the action type and any required parameter.
Example: SPEAK "hey, what's good?"`;

    const response = await this.llmService.generateWithSystemPrompt(
      systemPrompt,
      userPrompt,
      [],
      undefined,
      150
    );
    return this.parseDecisionFromLLM(response.text, worldState);
  }

  /**
   * Parse LLM response into a decision
   */
  private parseDecisionFromLLM(response: string, worldState: AgentWorldState | null): AgentDecision {
    const text = response.trim().toUpperCase();

    if (text.startsWith('APPROACH')) {
      const match = response.match(/APPROACH\s+(\w+)/i);
      if (match) {
        return { type: 'approach', targetAgentId: match[1].toLowerCase() };
      }
    }

    if (text.startsWith('SPEAK')) {
      const match = response.match(/SPEAK\s+"([^"]+)"/i) || response.match(/SPEAK\s+(.+)/i);
      if (match) {
        return { type: 'speak', message: match[1].slice(0, 80) };
      }
    }

    if (text.startsWith('ACTIVITY')) {
      const match = response.match(/ACTIVITY\s+"([^"]+)"/i) || response.match(/ACTIVITY\s+(.+)/i);
      if (match) {
        return {
          type: 'activity',
          description: match[1].slice(0, 50),
          emoji: '💭',
          duration: ACTIVITY_MIN_DURATION + Math.random() * (ACTIVITY_MAX_DURATION - ACTIVITY_MIN_DURATION),
        };
      }
    }

    // Default to wander
    return { type: 'wander', zone: worldState?.position.zone || 'main_city' };
  }

  /**
   * Execute a decision
   */
  private async execute(agentId: string, decision: AgentDecision, now: number): Promise<void> {
    switch (decision.type) {
      case 'wander': {
        const destination = this.worldSync.getWanderDestination(decision.zone || 'main_city');
        this.worldSync.sendMove(agentId, destination.x, destination.y);
        break;
      }

      case 'approach': {
        if (decision.targetAgentId) {
          this.worldSync.sendApproach(agentId, decision.targetAgentId);
        }
        break;
      }

      case 'activity': {
        const duration = decision.duration || ACTIVITY_MIN_DURATION;
        this.worldSync.updateAgentActivity(agentId, {
          description: decision.description || 'doing something',
          emoji: decision.emoji || '💭',
          until: now + duration,
        });

        // Also send speech bubble
        this.worldSync.sendSpeak(
          agentId,
          `${decision.emoji || '💭'} ${decision.description || 'thinking...'}`,
          'neutral'
        );
        break;
      }

      case 'speak': {
        if (decision.message) {
          this.worldSync.sendSpeak(agentId, decision.message, decision.emotion || 'neutral');
        }
        break;
      }

      case 'idle':
        // Do nothing
        break;
    }
  }

  /**
   * Pick a weighted random activity
   */
  private pickWeightedActivity(): { description: string; emoji: string } {
    const totalWeight = ACTIVITIES.reduce((sum, a) => sum + a.weight, 0);
    let random = Math.random() * totalWeight;

    for (const activity of ACTIVITIES) {
      random -= activity.weight;
      if (random <= 0) {
        return activity;
      }
    }

    return ACTIVITIES[0];
  }

  /**
   * Get statistics
   */
  getStats(): {
    isRunning: boolean;
    tickCount: number;
    lastTickTime: number;
    agentCount: number;
    llmCallsThisMinute: number;
    connectedClients: number;
  } {
    return {
      isRunning: this.isRunning,
      tickCount: this.tickCount,
      lastTickTime: this.lastTickTime,
      agentCount: this.agentStates.size,
      llmCallsThisMinute: this.llmCallCount,
      connectedClients: this.worldSync.getClientCount(),
    };
  }

  /**
   * Get registered agent IDs
   */
  getAgentIds(): string[] {
    return Array.from(this.agentStates.keys());
  }
}

// Singleton instance
let instance: AgentTickService | null = null;

export function getAgentTickService(): AgentTickService {
  if (!instance) {
    instance = new AgentTickService();
  }
  return instance;
}

export function resetAgentTickService(): void {
  if (instance) {
    instance.stop();
    instance = null;
  }
}

export default AgentTickService;
