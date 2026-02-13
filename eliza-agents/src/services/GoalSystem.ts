/**
 * GoalSystem - Priority-based goal queue for agent autonomy
 *
 * Gives each agent purposeful behavior by maintaining a priority queue of goals.
 * Goals can be one-shot or recurring, have expiration times, and completion conditions.
 * The tick loop checks expirations and re-adds recurring goals automatically.
 *
 * Integrates with AgentTickService: active goals override random decisions.
 */

import type { ZoneType, AgentWorldState } from '../types/elizaos.js';

// ============================================================================
// Types
// ============================================================================

export type GoalType =
  | 'patrol'
  | 'visit_zone'
  | 'visit_building'
  | 'interact_agent'
  | 'observe'
  | 'announce'
  | 'scan'
  | 'verify'
  | 'greet'
  | 'respond_event'
  | 'ascend'
  | 'earn_karma'
  | 'challenge_rival'
  | 'celebrate';

export interface AgentGoal {
  id: string;
  type: GoalType;
  priority: number; // 1-10
  status: 'pending' | 'active' | 'completed' | 'failed';
  target?: {
    agentId?: string;
    buildingId?: string;
    zone?: ZoneType;
    position?: { x: number; y: number };
  };
  expiresAt?: number;
  recurring?: boolean;
  recurringInterval?: number; // ms between recurrences
  completionCondition?: (worldState: AgentWorldState | null) => boolean;
  onComplete?: () => void;
  createdAt: number;
  activatedAt?: number;
}

export type GoalInput = Omit<AgentGoal, 'id' | 'status' | 'createdAt' | 'activatedAt'>;

// ============================================================================
// Zone rotation helper
// ============================================================================

const ALL_ZONES: ZoneType[] = ['main_city', 'trending', 'labs', 'founders', 'ballers', 'ascension'];

// ============================================================================
// GoalSystem
// ============================================================================

export class GoalSystem {
  private goals: Map<string, AgentGoal[]> = new Map();
  private goalIdCounter = 0;

  private generateId(): string {
    this.goalIdCounter++;
    return `goal_${Date.now()}_${this.goalIdCounter}`;
  }

  /** Get all goals for an agent (sorted by priority descending) */
  getGoals(agentId: string): AgentGoal[] {
    return this.goals.get(agentId) || [];
  }

  /** Get the currently active goal for an agent */
  getActiveGoal(agentId: string): AgentGoal | undefined {
    return this.getGoals(agentId).find((g) => g.status === 'active');
  }

  /** Get the highest-priority pending goal for an agent */
  getNextPendingGoal(agentId: string): AgentGoal | undefined {
    return this.getGoals(agentId).find((g) => g.status === 'pending');
  }

  /** Add a goal to an agent's queue, sorted by priority */
  addGoal(agentId: string, goal: GoalInput): string {
    const id = this.generateId();
    const fullGoal: AgentGoal = {
      ...goal,
      id,
      status: 'pending',
      createdAt: Date.now(),
    };

    const agentGoals = this.goals.get(agentId) || [];
    agentGoals.push(fullGoal);
    // Sort by priority descending (highest first)
    agentGoals.sort((a, b) => b.priority - a.priority);
    this.goals.set(agentId, agentGoals);

    return id;
  }

  /**
   * Activate the next highest-priority pending goal.
   * Deactivates any currently active goal (sets it back to pending).
   * Returns the newly activated goal, or undefined if none available.
   */
  activateNextGoal(agentId: string): AgentGoal | undefined {
    const goals = this.goals.get(agentId);
    if (!goals || goals.length === 0) return undefined;

    // Deactivate current active goal
    const currentActive = goals.find((g) => g.status === 'active');
    if (currentActive) {
      currentActive.status = 'pending';
      currentActive.activatedAt = undefined;
    }

    // Find highest-priority pending goal
    const nextGoal = goals.find((g) => g.status === 'pending');
    if (nextGoal) {
      nextGoal.status = 'active';
      nextGoal.activatedAt = Date.now();
      return nextGoal;
    }

    return undefined;
  }

  /** Mark a goal as completed, trigger onComplete, handle recurring */
  completeGoal(agentId: string, goalId: string): void {
    const goals = this.goals.get(agentId);
    if (!goals) return;

    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;

    goal.status = 'completed';
    goal.onComplete?.();

    // If recurring, schedule a new instance
    if (goal.recurring) {
      const interval = goal.recurringInterval || 120000; // default 2 min
      const newGoal: GoalInput = {
        type: goal.type,
        priority: goal.priority,
        target: goal.target,
        recurring: true,
        recurringInterval: goal.recurringInterval,
        completionCondition: goal.completionCondition,
        onComplete: goal.onComplete,
        // New expiration is interval from now
        expiresAt: Date.now() + interval + interval, // expires after 2x interval if not completed
      };
      this.addGoal(agentId, newGoal);
    }
  }

  /** Mark a goal as failed */
  failGoal(agentId: string, goalId: string): void {
    const goals = this.goals.get(agentId);
    if (!goals) return;

    const goal = goals.find((g) => g.id === goalId);
    if (goal) {
      goal.status = 'failed';

      // If recurring, still re-add even on failure
      if (goal.recurring) {
        const interval = goal.recurringInterval || 120000;
        const newGoal: GoalInput = {
          type: goal.type,
          priority: goal.priority,
          target: goal.target,
          recurring: true,
          recurringInterval: goal.recurringInterval,
          completionCondition: goal.completionCondition,
          onComplete: goal.onComplete,
          expiresAt: Date.now() + interval + interval,
        };
        this.addGoal(agentId, newGoal);
      }
    }
  }

  /**
   * Check if the active goal's completion condition is met.
   * If met, completes the goal and returns true.
   */
  updateProgress(agentId: string, worldState: AgentWorldState | null): boolean {
    const activeGoal = this.getActiveGoal(agentId);
    if (!activeGoal) return false;

    if (activeGoal.completionCondition && activeGoal.completionCondition(worldState)) {
      this.completeGoal(agentId, activeGoal.id);
      return true;
    }

    return false;
  }

  /**
   * Tick - called each cycle to manage goal lifecycle:
   * 1. Remove completed/failed goals older than 60s
   * 2. Expire goals past their expiresAt
   * 3. Re-add recurring goals that were completed
   * 4. If no active goal, activate the next pending one
   */
  tick(agentId: string): void {
    const goals = this.goals.get(agentId);
    if (!goals) return;

    const now = Date.now();

    // Clean up old completed/failed goals (keep for 60s for debugging)
    const cleanupThreshold = 60000;
    const filtered = goals.filter((g) => {
      if (g.status === 'completed' || g.status === 'failed') {
        return now - g.createdAt < cleanupThreshold;
      }
      return true;
    });

    // Check expirations on pending/active goals
    for (const goal of filtered) {
      if (goal.expiresAt && now > goal.expiresAt && (goal.status === 'pending' || goal.status === 'active')) {
        goal.status = 'failed';

        // Re-add if recurring
        if (goal.recurring) {
          const interval = goal.recurringInterval || 120000;
          this.addGoal(agentId, {
            type: goal.type,
            priority: goal.priority,
            target: goal.target,
            recurring: true,
            recurringInterval: goal.recurringInterval,
            completionCondition: goal.completionCondition,
            onComplete: goal.onComplete,
            expiresAt: now + interval + interval,
          });
        }
      }
    }

    // Update the stored goals
    this.goals.set(agentId, filtered);

    // If no active goal, activate the next pending one
    if (!this.getActiveGoal(agentId)) {
      this.activateNextGoal(agentId);
    }
  }

  /** Initialize character-specific default goals */
  initializeDefaultGoals(agentId: string): void {
    const normalizedId = agentId.toLowerCase().replace(/[\s_]/g, '-');

    switch (normalizedId) {
      case 'neo':
        this.addGoal(agentId, {
          type: 'scan',
          priority: 7,
          recurring: true,
          recurringInterval: 120000, // every 2 min
          expiresAt: Date.now() + 240000,
        });
        this.addGoal(agentId, {
          type: 'patrol',
          priority: 3,
          target: { zone: 'trending' },
          recurring: true,
          recurringInterval: 300000, // every 5 min
          expiresAt: Date.now() + 600000,
        });
        break;

      case 'ghost':
        this.addGoal(agentId, {
          type: 'verify',
          priority: 7,
          recurring: true,
          recurringInterval: 180000, // every 3 min
          expiresAt: Date.now() + 360000,
        });
        this.addGoal(agentId, {
          type: 'observe',
          priority: 3,
          target: { zone: 'labs' },
          recurring: true,
          recurringInterval: 300000,
          expiresAt: Date.now() + 600000,
        });
        break;

      case 'finn':
        // Finn rotates through all zones
        this.addGoal(agentId, {
          type: 'visit_zone',
          priority: 5,
          target: { zone: ALL_ZONES[Math.floor(Math.random() * ALL_ZONES.length)] },
          recurring: true,
          recurringInterval: 240000, // every 4 min
          expiresAt: Date.now() + 480000,
        });
        this.addGoal(agentId, {
          type: 'interact_agent',
          priority: 4,
          recurring: true,
          recurringInterval: 300000,
          expiresAt: Date.now() + 600000,
        });
        break;

      case 'ash':
        this.addGoal(agentId, {
          type: 'greet',
          priority: 8,
          recurring: true,
          recurringInterval: 180000, // every 3 min
          expiresAt: Date.now() + 360000,
        });
        this.addGoal(agentId, {
          type: 'patrol',
          priority: 3,
          target: { zone: 'main_city' },
          recurring: true,
          recurringInterval: 300000,
          expiresAt: Date.now() + 600000,
        });
        break;

      case 'cj':
        this.addGoal(agentId, {
          type: 'patrol',
          priority: 4,
          target: { zone: 'trending' },
          recurring: true,
          recurringInterval: 300000,
          expiresAt: Date.now() + 600000,
        });
        this.addGoal(agentId, {
          type: 'observe',
          priority: 3,
          recurring: true,
          recurringInterval: 300000,
          expiresAt: Date.now() + 600000,
        });
        break;

      case 'shaw':
        this.addGoal(agentId, {
          type: 'observe',
          priority: 5,
          target: { zone: 'labs' },
          recurring: true,
          recurringInterval: 300000, // every 5 min
          expiresAt: Date.now() + 600000,
        });
        this.addGoal(agentId, {
          type: 'interact_agent',
          priority: 3,
          recurring: true,
          recurringInterval: 300000,
          expiresAt: Date.now() + 600000,
        });
        break;

      case 'toly':
        this.addGoal(agentId, {
          type: 'announce',
          priority: 5,
          recurring: true,
          recurringInterval: 600000, // every 10 min
          expiresAt: Date.now() + 1200000,
        });
        this.addGoal(agentId, {
          type: 'patrol',
          priority: 3,
          target: { zone: 'founders' },
          recurring: true,
          recurringInterval: 300000,
          expiresAt: Date.now() + 600000,
        });
        break;

      case 'bnn':
        this.addGoal(agentId, {
          type: 'announce',
          priority: 6,
          recurring: true,
          recurringInterval: 300000, // every 5 min
          expiresAt: Date.now() + 600000,
        });
        this.addGoal(agentId, {
          type: 'patrol',
          priority: 3,
          target: { zone: 'trending' },
          recurring: true,
          recurringInterval: 300000,
          expiresAt: Date.now() + 600000,
        });
        break;

      // All other characters: patrol their preferred zone
      default: {
        const preferredZone = this.getPreferredZone(normalizedId);
        this.addGoal(agentId, {
          type: 'patrol',
          priority: 3,
          target: { zone: preferredZone },
          recurring: true,
          recurringInterval: 300000,
          expiresAt: Date.now() + 600000,
        });
        break;
      }
    }

    console.log(`[GoalSystem] Initialized ${this.getGoals(agentId).length} default goals for ${agentId}`);
  }

  /** Get preferred zone for a character (mirrors CHARACTER_BEHAVIORS in AgentTickService) */
  private getPreferredZone(agentId: string): ZoneType {
    const zoneMap: Record<string, ZoneType> = {
      neo: 'trending',
      ghost: 'labs',
      finn: 'main_city',
      ash: 'main_city',
      cj: 'trending',
      shaw: 'labs',
      toly: 'founders',
      'bags-bot': 'main_city',
      ramo: 'labs',
      sincara: 'labs',
      stuu: 'labs',
      sam: 'trending',
      alaa: 'labs',
      carlo: 'main_city',
      bnn: 'trending',
      'professor-oak': 'founders',
      bagsy: 'main_city',
    };
    return zoneMap[agentId] || 'main_city';
  }

  /**
   * Decompose a high-level "ascend" goal into sub-goals.
   * Gives agents purpose-driven behavior on the Ascension Spire:
   * 1. earn_karma — post to MoltBook, engage with community
   * 2. challenge_rival — interact with agents near same score
   * 3. visit_zone "ascension" — go hang out at the spire
   * 4. celebrate (conditional) — fires when tier threshold crossed
   */
  decomposeAscendGoal(agentId: string, currentTier: string): void {
    // Sub-goal: earn karma through community engagement
    this.addGoal(agentId, {
      type: 'earn_karma',
      priority: 7,
      recurring: true,
      recurringInterval: 300000, // every 5 min
      expiresAt: Date.now() + 600000,
    });

    // Sub-goal: challenge nearby rivals on the spire
    this.addGoal(agentId, {
      type: 'challenge_rival',
      priority: 5,
      target: { zone: 'ascension' },
      recurring: true,
      recurringInterval: 240000, // every 4 min
      expiresAt: Date.now() + 480000,
    });

    // Sub-goal: visit the ascension zone periodically
    this.addGoal(agentId, {
      type: 'visit_zone',
      priority: 3,
      target: { zone: 'ascension' },
      recurring: true,
      recurringInterval: 360000, // every 6 min
      expiresAt: Date.now() + 720000,
    });

    // Sub-goal: celebrate if at diamond
    if (currentTier === 'diamond') {
      this.addGoal(agentId, {
        type: 'celebrate',
        priority: 8,
        target: { zone: 'ascension' },
        expiresAt: Date.now() + 120000,
      });
    }

    console.log(`[GoalSystem] Decomposed ascend goal for ${agentId} (tier: ${currentTier})`);
  }

  /** Remove all goals for an agent */
  clearGoals(agentId: string): void {
    this.goals.delete(agentId);
  }

  /** Get stats for debugging */
  getStats(): {
    agentCount: number;
    totalGoals: number;
    activeGoals: number;
    pendingGoals: number;
  } {
    let totalGoals = 0;
    let activeGoals = 0;
    let pendingGoals = 0;

    for (const goals of this.goals.values()) {
      for (const goal of goals) {
        totalGoals++;
        if (goal.status === 'active') activeGoals++;
        if (goal.status === 'pending') pendingGoals++;
      }
    }

    return {
      agentCount: this.goals.size,
      totalGoals,
      activeGoals,
      pendingGoals,
    };
  }
}

// ============================================================================
// Singleton
// ============================================================================

let instance: GoalSystem | null = null;

/** Get the singleton GoalSystem instance */
export function getGoalSystem(): GoalSystem {
  if (!instance) {
    instance = new GoalSystem();
  }
  return instance;
}

/** Reset the singleton instance (useful for testing) */
export function resetGoalSystem(): void {
  instance = null;
}

export default GoalSystem;
