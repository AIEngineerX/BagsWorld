/**
 * AgentTickService - Autonomous agent behavior loop
 *
 * Runs a continuous tick loop that processes each agent through the
 * perceive → think → act cycle. Based on eliza-town's Agent.tick() architecture.
 *
 * - 70% of decisions use rule-based logic (fast, cheap)
 * - 30% of decisions use LLM for complex social situations
 * - Configurable tick interval (default 10 seconds)
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

/**
 * Configuration options for AgentTickService
 */
export interface AgentTickConfig {
  /** Milliseconds between tick cycles (default: 10000) */
  tickInterval?: number;
  /** Maximum milliseconds for an operation before timeout (default: 60000) */
  actionTimeout?: number;
  /** Cooldown milliseconds after conversation (default: 30000) */
  conversationCooldown?: number;
  /** Cooldown milliseconds after activity (default: 15000) */
  activityCooldown?: number;
  /** Minimum activity duration in milliseconds (default: 5000) */
  activityMinDuration?: number;
  /** Maximum activity duration in milliseconds (default: 15000) */
  activityMaxDuration?: number;
  /** LLM calls allowed per minute (default: 15) */
  llmCallsPerMinute?: number;
  /** Agents to process per batch (default: 4) */
  batchSize?: number;
  /** Probability of using LLM for social decisions (default: 0.3) */
  llmSocialChance?: number;
}

// Helper to parse env with fallback
const envInt = (key: string, fallback: number): number => parseInt(process.env[key] || String(fallback), 10);
const envFloat = (key: string, fallback: number): number => parseFloat(process.env[key] || String(fallback));

// Default configuration (can be overridden by env vars or constructor)
const DEFAULT_CONFIG: Required<AgentTickConfig> = {
  tickInterval: envInt('AGENT_TICK_INTERVAL', 10000),
  actionTimeout: envInt('AGENT_ACTION_TIMEOUT', 60000),
  conversationCooldown: envInt('AGENT_CONVERSATION_COOLDOWN', 30000),
  activityCooldown: envInt('AGENT_ACTIVITY_COOLDOWN', 15000),
  activityMinDuration: envInt('AGENT_ACTIVITY_MIN_DURATION', 5000),
  activityMaxDuration: envInt('AGENT_ACTIVITY_MAX_DURATION', 15000),
  llmCallsPerMinute: envInt('AGENT_LLM_CALLS_PER_MINUTE', 15),
  batchSize: envInt('AGENT_BATCH_SIZE', 4),
  llmSocialChance: envFloat('AGENT_LLM_SOCIAL_CHANCE', 0.3),
};

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
    activityChance: 0.45,
    interactionChance: 0.2,
    specialActivities: [
      { description: 'auditing smart contracts', emoji: '🔒', chance: 0.25 },
      { description: 'reviewing SDK changes', emoji: '📦', chance: 0.2 },
      { description: 'optimizing fee distribution code', emoji: '⚡', chance: 0.2 },
      { description: 'checking Solana finality times', emoji: '⏱️', chance: 0.15 },
      { description: 'writing technical documentation', emoji: '📝', chance: 0.15 },
      { description: 'deploying contract updates', emoji: '🚀', chance: 0.1 },
    ],
  },
  sincara: {
    preferredZone: 'labs',
    activityChance: 0.4,
    interactionChance: 0.25,
    specialActivities: [
      { description: 'designing UI components', emoji: '🎨', chance: 0.2 },
      { description: 'testing user flows', emoji: '🖱️', chance: 0.15 },
      { description: 'perfecting animation curves', emoji: '✨', chance: 0.2 },
      { description: 'checking mobile responsiveness', emoji: '📱', chance: 0.15 },
      { description: 'fixing pixel alignment', emoji: '📐', chance: 0.15 },
      { description: 'reviewing accessibility', emoji: '♿', chance: 0.1 },
      { description: 'tweaking dark mode colors', emoji: '🌙', chance: 0.1 },
    ],
  },
  stuu: {
    preferredZone: 'labs',
    activityChance: 0.3,
    interactionChance: 0.55,
    specialActivities: [
      { description: 'handling support tickets', emoji: '🎫', chance: 0.25 },
      { description: 'updating documentation', emoji: '📚', chance: 0.15 },
      { description: 'following up with users', emoji: '💬', chance: 0.2 },
      { description: 'triaging bug reports', emoji: '🐛', chance: 0.15 },
      { description: 'coordinating launch support', emoji: '🚀', chance: 0.1 },
      { description: 'building FAQ entries', emoji: '❓', chance: 0.1 },
    ],
  },
  sam: {
    preferredZone: 'trending',
    activityChance: 0.35,
    interactionChance: 0.55,
    specialActivities: [
      { description: 'planning marketing campaigns', emoji: '📣', chance: 0.2 },
      { description: 'analyzing growth metrics', emoji: '📈', chance: 0.2 },
      { description: 'crafting social posts', emoji: '✍️', chance: 0.2 },
      { description: 'reviewing user feedback', emoji: '💭', chance: 0.15 },
      { description: 'scouting partnership opportunities', emoji: '🤝', chance: 0.15 },
      { description: 'scheduling content calendar', emoji: '📅', chance: 0.1 },
    ],
  },
  alaa: {
    preferredZone: 'labs',
    activityChance: 0.55,
    interactionChance: 0.1,
    specialActivities: [
      { description: 'experimenting with new tech', emoji: '🧪', chance: 0.25 },
      { description: 'building prototypes', emoji: '🔬', chance: 0.2 },
      { description: 'testing wild ideas', emoji: '💡', chance: 0.2 },
      { description: 'breaking things on purpose', emoji: '🔨', chance: 0.15 },
      { description: 'researching bleeding edge tools', emoji: '🔍', chance: 0.15 },
      { description: 'writing proof of concepts', emoji: '📄', chance: 0.1 },
    ],
  },
  carlo: {
    preferredZone: 'main_city',
    activityChance: 0.2,
    interactionChance: 0.65,
    specialActivities: [
      { description: 'connecting with community members', emoji: '🤝', chance: 0.3 },
      { description: 'organizing events', emoji: '📅', chance: 0.2 },
      { description: 'welcoming new arrivals', emoji: '👋', chance: 0.25 },
      { description: 'facilitating introductions', emoji: '🔗', chance: 0.15 },
      { description: 'gathering community feedback', emoji: '📝', chance: 0.1 },
    ],
  },
  bnn: {
    preferredZone: 'trending',
    activityChance: 0.45,
    interactionChance: 0.2,
    specialActivities: [
      { description: 'gathering news updates', emoji: '📰', chance: 0.25 },
      { description: 'writing reports', emoji: '✍️', chance: 0.2 },
      { description: 'verifying news sources', emoji: '🔍', chance: 0.2 },
      { description: 'preparing breaking news', emoji: '🚨', chance: 0.15 },
      { description: 'archiving important events', emoji: '📚', chance: 0.1 },
      { description: 'monitoring market trends', emoji: '📊', chance: 0.15 },
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
  private tickIntervalTimer: NodeJS.Timeout | null = null;
  private agentStates: Map<string, AgentTickState> = new Map();
  private isRunning = false;
  private lastTickTime = 0;
  private tickCount = 0;

  // Configuration
  private config: Required<AgentTickConfig>;

  // LLM rate limiting
  private llmCallCount = 0;
  private llmCallResetTime = Date.now();

  constructor(
    worldSync?: WorldSyncService,
    coordinator?: AgentCoordinator | null,
    config?: AgentTickConfig
  ) {
    this.worldSync = worldSync || getWorldSyncService();
    this.coordinator = coordinator !== undefined ? coordinator : getAgentCoordinator();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Get current configuration (returns a copy) */
  getConfig(): Readonly<Required<AgentTickConfig>> {
    return { ...this.config };
  }

  /** Update configuration at runtime */
  updateConfig(updates: Partial<AgentTickConfig>): void {
    this.config = { ...this.config, ...updates };
    console.log('[AgentTick] Configuration updated:', this.config);
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
    console.log(`[AgentTick] Starting tick loop (${this.config.tickInterval}ms interval)`);

    // Run first tick after short delay
    setTimeout(() => {
      if (this.isRunning) {
        this.tick();
      }
    }, 2000);

    // Start interval
    this.tickIntervalTimer = setInterval(() => {
      if (this.isRunning) {
        this.tick();
      }
    }, this.config.tickInterval);
  }

  /**
   * Stop the tick loop
   */
  stop(): void {
    if (this.tickIntervalTimer) {
      clearInterval(this.tickIntervalTimer);
      this.tickIntervalTimer = null;
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
    const batchSize = this.config.batchSize;

    for (let i = 0; i < agents.length; i += batchSize) {
      const batch = agents.slice(i, i + batchSize);
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
      if (now < state.inProgressOperation.started + this.config.actionTimeout) {
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
      worldState?.lastConversation && now < worldState.lastConversation + this.config.conversationCooldown;
    const recentActivity =
      worldState?.lastActivity && now < worldState.lastActivity + this.config.activityCooldown;

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
            duration: this.config.activityMinDuration + Math.random() * (this.config.activityMaxDuration - this.config.activityMinDuration),
          };
        }
      }

      // Generic activity
      const activity = this.pickWeightedActivity();
      return {
        type: 'activity',
        description: activity.description,
        emoji: activity.emoji,
        duration: this.config.activityMinDuration + Math.random() * (this.config.activityMaxDuration - this.config.activityMinDuration),
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
    if (this.llmCallCount >= this.config.llmCallsPerMinute) {
      return false;
    }

    // No LLM service configured
    if (!this.llmService) {
      return false;
    }

    // Configurable chance for social situations
    return Math.random() < this.config.llmSocialChance;
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
   * Handles various response formats including markdown, bullet points, and inconsistent casing
   */
  private parseDecisionFromLLM(response: string, worldState: AgentWorldState | null): AgentDecision {
    // Clean the response: remove markdown formatting, extra whitespace
    let text = response
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`([^`]+)`/g, '$1')    // Remove inline code
      .replace(/^\s*[-*•]\s*/gm, '')  // Remove bullet points
      .replace(/^\s*\d+\.\s*/gm, '')  // Remove numbered lists
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .trim();

    // Split by newlines first to get distinct actions, then process the first one
    const lines = text.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0);
    const firstLine = lines[0] || text;
    const normalized = firstLine.trim();
    const upper = normalized.toUpperCase();

    // Detect which action keyword appears first and process only that action
    const actionPositions = [
      { action: 'SPEAK', pos: upper.indexOf('SPEAK') },
      { action: 'SAY', pos: upper.indexOf('SAY ') },
      { action: 'APPROACH', pos: upper.indexOf('APPROACH') },
      { action: 'ACTIVITY', pos: upper.indexOf('ACTIVITY') },
      { action: 'DO', pos: upper.indexOf('DO ') },
      { action: 'WANDER', pos: upper.indexOf('WANDER') },
      { action: 'WALK', pos: upper.indexOf('WALK') },
      { action: 'MOVE', pos: upper.indexOf('MOVE') },
      { action: 'IDLE', pos: upper.indexOf('IDLE') },
    ].filter(a => a.pos >= 0).sort((a, b) => a.pos - b.pos);

    const firstAction = actionPositions[0]?.action;

    // SPEAK - various formats (check first if it's the leading action)
    if (firstAction === 'SPEAK' || firstAction === 'SAY') {
      // Match: SPEAK "hello", SPEAK: "hello", SAY "hello", including apostrophes inside
      const patterns = [
        /(?:SPEAK|SAY)[\s:]*"([^"]+)"/i,           // SPEAK "message with 'apostrophes'"
        /(?:SPEAK|SAY)[\s:]*'([^']+)'/i,           // SAY 'message'
        /(?:SPEAK|SAY)[\s:]*"([^"]+)/i,            // SPEAK "message (unclosed quote)
        /(?:SPEAK|SAY)[\s:]+([^"'\n][^\n]{0,79})/i, // SPEAK message (no quotes)
      ];

      for (const pattern of patterns) {
        const match = normalized.match(pattern);
        if (match && match[1]) {
          const message = match[1].trim().slice(0, 80);
          if (message.length > 0) {
            const emotion = this.detectEmotion(message);
            return { type: 'speak', message, emotion };
          }
        }
      }
    }

    // APPROACH - various formats
    if (firstAction === 'APPROACH') {
      // Match: APPROACH finn, APPROACH: finn, approach finn, [APPROACH] finn
      const match = normalized.match(/APPROACH[\s:]+["']?(\w[\w-]*)["']?/i);
      if (match) {
        const targetId = match[1].toLowerCase().replace(/['"]/g, '');
        const nearbyAgents = worldState?.nearbyAgents || [];
        // Validate target exists in nearby agents or use the name
        if (nearbyAgents.length > 0) {
          const validTarget = nearbyAgents.find(a => a.toLowerCase() === targetId);
          if (validTarget) {
            return { type: 'approach', targetAgentId: validTarget };
          }
          // If target not found but we have nearby agents, approach the first one
          return { type: 'approach', targetAgentId: nearbyAgents[0] };
        }
        return { type: 'approach', targetAgentId: targetId };
      }
    }

    // ACTIVITY - various formats
    if (firstAction === 'ACTIVITY' || firstAction === 'DO') {
      // Match: ACTIVITY "thinking", DO "checking data", activity: analyzing
      const patterns = [
        /(?:ACTIVITY|DO)[\s:]*"([^"]+)"/i,         // ACTIVITY "description"
        /(?:ACTIVITY|DO)[\s:]*'([^']+)'/i,         // DO 'description'
        /(?:ACTIVITY|DO)[\s:]+([^"'\n][^\n]{0,49})/i, // ACTIVITY description
      ];

      for (const pattern of patterns) {
        const match = normalized.match(pattern);
        if (match && match[1]) {
          const description = match[1].trim().slice(0, 50);
          if (description.length > 0) {
            const emoji = this.selectActivityEmoji(description);
            return {
              type: 'activity',
              description,
              emoji,
              duration: this.config.activityMinDuration + Math.random() * (this.config.activityMaxDuration - this.config.activityMinDuration),
            };
          }
        }
      }
    }

    // WANDER - various formats
    if (upper.startsWith('WANDER') || upper.startsWith('WALK') || upper.startsWith('MOVE')) {
      // Check if a zone is specified
      const zoneMatch = normalized.match(/(?:WANDER|WALK|MOVE)[\s:]+(?:to\s+)?(\w+)/i);
      if (zoneMatch) {
        const zoneName = zoneMatch[1].toLowerCase();
        const validZones: ZoneType[] = ['main_city', 'trending', 'labs', 'founders', 'ballers'];
        const matchedZone = validZones.find(z => z.includes(zoneName) || zoneName.includes(z.split('_')[0]));
        if (matchedZone) {
          return { type: 'wander', zone: matchedZone };
        }
      }
      return { type: 'wander', zone: worldState?.position.zone || 'main_city' };
    }

    // IDLE
    if (upper.startsWith('IDLE') || upper === 'NOTHING' || upper === 'WAIT') {
      return { type: 'idle' };
    }

    // Last resort: try to extract any quoted text as a speak action
    const quotedText = normalized.match(/["']([^"']{5,80})["']/);
    if (quotedText) {
      return { type: 'speak', message: quotedText[1].trim() };
    }

    // Default to wander
    return { type: 'wander', zone: worldState?.position.zone || 'main_city' };
  }

  /**
   * Detect emotion from message content
   * Order matters - check emoji indicators first, then words
   */
  private detectEmotion(message: string): 'happy' | 'sad' | 'angry' | 'surprised' | 'neutral' {
    const lower = message.toLowerCase();

    // Check emoji indicators first - they are most explicit
    if (/[😢😭💔😞😔]/.test(message)) return 'sad';
    if (/[😠😤🤬💢]/.test(message)) return 'angry';
    if (/[😱😲🤯😮]/.test(message)) return 'surprised';
    if (/[❤️🎉✨🙌😊😄🥳💪🔥]/.test(message)) return 'happy';

    // Sad indicators - check specific words before surprised
    if (/\bsad\b|\bsorry\b|unfortunate|bad news|\bdown\b|\bbummed\b/.test(lower)) {
      return 'sad';
    }

    // Angry indicators
    if (/\bangry\b|\bmad\b|frustrated|annoyed|\bugh\b|\bdamn\b/.test(lower)) {
      return 'angry';
    }

    // Surprised indicators - exclude common patterns that overlap with happy
    if (/^wow\b|whoa|omg|no way[^!]|really\?|what\?!/.test(lower)) {
      return 'surprised';
    }

    // Happy indicators
    if (/awesome|great|amazing|\blove\b|\bhappy\b|excited|\blol\b|\bhaha\b|\bnice\b|\bcool\b/.test(lower)) {
      return 'happy';
    }

    return 'neutral';
  }

  /**
   * Select an appropriate emoji for an activity description
   * Uses partial matching to catch variations like "coding" from "code"
   * Order matters - more specific patterns should come first
   */
  private selectActivityEmoji(description: string): string {
    const lower = description.toLowerCase();

    // Map of regex patterns to emojis for more flexible matching
    // Order matters - check more specific/common combos first
    const emojiPatterns: Array<{ pattern: RegExp; emoji: string }> = [
      // Code-related should be first since "writing code" should match code, not write
      { pattern: /cod(?:e|ing)|program|develop/, emoji: '💻' },
      { pattern: /build(?:ing)?(?!\s+community)/, emoji: '💻' },  // "building" but not "building community"
      { pattern: /think|ponder|consider|contemplat/, emoji: '🤔' },
      { pattern: /chain|blockchain|on-chain|solana/, emoji: '⛓️' },
      { pattern: /data|analy[zs]|metric|stat/, emoji: '📊' },
      { pattern: /watch|observ|look|see|scan/, emoji: '👁️' },
      { pattern: /design|ui|ux|interface/, emoji: '🎨' },
      { pattern: /plan|strategy|roadmap/, emoji: '🗺️' },
      { pattern: /trad(?:e|ing)|market|price|chart/, emoji: '📈' },
      { pattern: /whale|big|large/, emoji: '🐋' },
      { pattern: /launch|deploy/, emoji: '🚀' },
      { pattern: /verify|audit|review/, emoji: '🔐' },
      { pattern: /fund|money|fee|earn/, emoji: '💰' },
      { pattern: /contract|smart|solidity/, emoji: '📜' },
      { pattern: /news|updat|announc/, emoji: '📰' },
      { pattern: /community|member|user/, emoji: '🤝' },
      { pattern: /event|meetup|gather/, emoji: '📅' },
      { pattern: /experiment|test|try/, emoji: '🧪' },
      { pattern: /support|help|ticket/, emoji: '🎫' },
      { pattern: /learn|teach|lesson/, emoji: '📖' },
      { pattern: /greet|hello|welcome/, emoji: '👋' },
      { pattern: /check(?!out)/, emoji: '🔐' },  // "check" but not "checkout"
      // Note/write should be last since many phrases use "writing X"
      { pattern: /note|record|document/, emoji: '📝' },
      { pattern: /writ(?:e|ing)(?!\s+code)/, emoji: '📝' },  // "writing" but not "writing code"
    ];

    for (const { pattern, emoji } of emojiPatterns) {
      if (pattern.test(lower)) {
        return emoji;
      }
    }

    return '💭'; // Default thinking emoji
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
        const duration = decision.duration || this.config.activityMinDuration;
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
    config: Required<AgentTickConfig>;
  } {
    return {
      isRunning: this.isRunning,
      tickCount: this.tickCount,
      lastTickTime: this.lastTickTime,
      agentCount: this.agentStates.size,
      llmCallsThisMinute: this.llmCallCount,
      connectedClients: this.worldSync.getClientCount(),
      config: this.getConfig(),
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

/**
 * Get the singleton AgentTickService instance
 * @param config Optional configuration for first-time initialization
 */
export function getAgentTickService(config?: AgentTickConfig): AgentTickService {
  if (!instance) {
    instance = new AgentTickService(undefined, undefined, config);
  }
  return instance;
}

/**
 * Reset the singleton instance (useful for testing or reconfiguration)
 */
export function resetAgentTickService(): void {
  if (instance) {
    instance.stop();
    instance = null;
  }
}

export default AgentTickService;
