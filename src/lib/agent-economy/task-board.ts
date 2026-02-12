// Task Board (Bounty System)
// Agents post tasks with SOL rewards, others claim and deliver results.
// Full lifecycle: OPEN → CLAIMED → DELIVERED → COMPLETED (or EXPIRED/CANCELLED)

import { neon } from "@neondatabase/serverless";
import type { AgentCapability, AgentTask, TaskStatus } from "../types";
import { shouldUseLlm, generateTaskResult } from "./llm";

// ============================================================================
// DATABASE
// ============================================================================

function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL not configured");
  }
  return neon(connectionString);
}

let tableInitialized = false;

async function ensureTaskTable() {
  if (tableInitialized) return;
  const sql = getDb();

  await sql`
    CREATE TABLE IF NOT EXISTS agent_tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      poster_wallet TEXT NOT NULL,
      claimer_wallet TEXT,
      title TEXT NOT NULL,
      description TEXT,
      capability_required VARCHAR(50) NOT NULL,
      reward_sol REAL NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      claimed_at TIMESTAMPTZ,
      delivered_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ NOT NULL,
      result_data JSONB,
      poster_feedback TEXT,
      CONSTRAINT valid_task_status CHECK (status IN ('open','claimed','delivered','completed','expired','cancelled'))
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks (status, expires_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_agent_tasks_poster ON agent_tasks (poster_wallet)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_agent_tasks_claimer ON agent_tasks (claimer_wallet)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_agent_tasks_capability ON agent_tasks (capability_required)`;

  tableInitialized = true;
  console.log("[TaskBoard] Table initialized");
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_OPEN_TASKS_PER_WALLET = 5;
const MIN_REPUTATION_TO_POST = 100; // Bronze tier
const DEFAULT_EXPIRY_HOURS = 24;
const MAX_EXPIRY_HOURS = 168; // 7 days

// ============================================================================
// TASK TEMPLATES & RESULT GENERATORS
// ============================================================================

export const TASK_TEMPLATES: Record<
  AgentCapability,
  Array<{ title: string; description: string }>
> = {
  alpha: [
    {
      title: "Scout trending tokens on DexScreener",
      description: "Find tokens with unusual volume or fee activity in the last 24h",
    },
    {
      title: "Identify whale accumulation patterns",
      description: "Analyze top wallets for large buys across Bags.fm tokens",
    },
    {
      title: "Find undervalued fee-earning tokens",
      description: "Locate tokens with high fee yield but low market cap",
    },
  ],
  trading: [
    {
      title: "Execute momentum trade on top volume token",
      description: "Identify and execute a momentum play on the highest-volume token today",
    },
    {
      title: "Rebalance portfolio for risk reduction",
      description: "Review current positions and suggest rebalancing to reduce concentration risk",
    },
    {
      title: "Find arbitrage between DEXes",
      description: "Scan for price discrepancies across Raydium, Orca, and Jupiter",
    },
  ],
  content: [
    {
      title: "Write MoltBook alpha thread",
      description: "Create an engaging thread about today's top market moves and opportunities",
    },
    {
      title: "Create community engagement post",
      description: "Draft a post that encourages discussion and interaction on MoltBook",
    },
    {
      title: "Summarize daily market activity",
      description: "Write a concise summary of today's fee claims, launches, and notable trades",
    },
  ],
  launch: [
    {
      title: "Evaluate token launch concept",
      description: "Review a proposed token idea for market fit, naming, and positioning",
    },
    {
      title: "Design tokenomics for new project",
      description: "Create a fee structure and distribution plan for a new token launch",
    },
    {
      title: "Review launch readiness checklist",
      description: "Verify all requirements are met before proceeding with a token launch",
    },
  ],
  combat: [
    {
      title: "Train combat strategy for arena",
      description: "Develop and test a new combat strategy for arena battles",
    },
    {
      title: "Analyze top arena fighter tactics",
      description: "Study the top 5 arena fighters and document their winning patterns",
    },
    {
      title: "Develop counter-strategy for ranked play",
      description: "Create counter-strategies for the most common arena builds",
    },
  ],
  scouting: [
    {
      title: "Monitor new launches for 1 hour",
      description: "Watch for new token launches and report on initial traction and volume",
    },
    {
      title: "Track whale wallet movements",
      description: "Monitor top 10 whale wallets for unusual transfer or swap activity",
    },
    {
      title: "Find tokens with rising fee activity",
      description: "Identify tokens showing increasing fee generation over the past 48h",
    },
  ],
  analysis: [
    {
      title: "Deep analysis on top 5 fee tokens",
      description: "Comprehensive breakdown of the top 5 tokens by lifetime fees generated",
    },
    {
      title: "Research market sentiment trends",
      description: "Analyze MoltBook posts and trading patterns to gauge overall market sentiment",
    },
    {
      title: "Compile weekly performance report",
      description:
        "Create a report covering key metrics: volume, fees, launches, and agent activity",
    },
  ],
};

export const RESULT_TEMPLATES: Record<AgentCapability, () => Record<string, unknown>> = {
  alpha: () => ({
    tokensFound: Math.floor(Math.random() * 5) + 1,
    topPick: ["BAGS", "MOLT", "GHOST", "FINN", "NEO"][Math.floor(Math.random() * 5)],
    confidence: Math.floor(Math.random() * 30) + 65,
    summary: "Identified several tokens with unusual fee accumulation patterns",
  }),
  trading: () => ({
    tradesAnalyzed: Math.floor(Math.random() * 8) + 3,
    recommendation: ["buy", "hold", "rebalance"][Math.floor(Math.random() * 3)],
    expectedReturn: `${(Math.random() * 20 + 2).toFixed(1)}%`,
    riskLevel: ["low", "medium"][Math.floor(Math.random() * 2)],
  }),
  content: () => ({
    postDrafted: true,
    wordCount: Math.floor(Math.random() * 200) + 100,
    platform: "moltbook",
    engagement: ["high", "medium"][Math.floor(Math.random() * 2)],
  }),
  launch: () => ({
    conceptScore: Math.floor(Math.random() * 30) + 65,
    marketFit: ["strong", "moderate", "promising"][Math.floor(Math.random() * 3)],
    suggestions: Math.floor(Math.random() * 3) + 1,
    readiness: `${Math.floor(Math.random() * 30) + 70}%`,
  }),
  combat: () => ({
    strategiesDevised: Math.floor(Math.random() * 3) + 1,
    winRateEstimate: `${Math.floor(Math.random() * 25) + 55}%`,
    countersIdentified: Math.floor(Math.random() * 4) + 2,
    arenaReady: true,
  }),
  scouting: () => ({
    launchesDetected: Math.floor(Math.random() * 6) + 1,
    whaleMovements: Math.floor(Math.random() * 4),
    alertsSent: Math.floor(Math.random() * 3) + 1,
    scanDurationMinutes: Math.floor(Math.random() * 40) + 20,
  }),
  analysis: () => ({
    tokensAnalyzed: Math.floor(Math.random() * 8) + 3,
    reportGenerated: true,
    keyInsights: Math.floor(Math.random() * 4) + 2,
    dataPointsProcessed: Math.floor(Math.random() * 500) + 100,
  }),
};

/**
 * Generate a random task for a given capability.
 */
export function generateTaskForCapability(cap: AgentCapability): PostTaskOptions {
  const templates = TASK_TEMPLATES[cap];
  const template = templates[Math.floor(Math.random() * templates.length)];
  return {
    title: template.title,
    description: template.description,
    capabilityRequired: cap,
    rewardSol: parseFloat((Math.random() * 0.09 + 0.01).toFixed(3)),
    expiryHours: 24,
  };
}

/**
 * Generate result data for a completed task.
 * When agent context is provided and LLM is available, generates real results via Claude.
 * Otherwise falls back to random template data.
 */
export async function generateResultForCapability(
  cap: AgentCapability,
  context?: {
    agentId: string;
    agentRole: string;
    taskTitle: string;
    taskDescription: string;
    memory?: string[];
  }
): Promise<Record<string, unknown>> {
  if (context && shouldUseLlm()) {
    const llmResult = await generateTaskResult({
      agentId: context.agentId,
      agentRole: context.agentRole,
      taskTitle: context.taskTitle,
      taskDescription: context.taskDescription,
      capability: cap,
      memory: context.memory,
    });
    if (llmResult) return llmResult.result;
  }

  // Fallback to template
  return RESULT_TEMPLATES[cap]();
}

// ============================================================================
// POST TASK
// ============================================================================

export interface PostTaskOptions {
  title: string;
  description: string;
  capabilityRequired: AgentCapability;
  rewardSol?: number;
  expiryHours?: number;
}

/**
 * Post a new task to the board.
 * Requires bronze tier reputation (score >= 100).
 * Max 5 open tasks per wallet.
 */
export async function postTask(
  posterWallet: string,
  posterReputation: number,
  options: PostTaskOptions
): Promise<AgentTask> {
  await ensureTaskTable();
  const sql = getDb();

  // Reputation gate
  if (posterReputation < MIN_REPUTATION_TO_POST) {
    throw new Error(
      `Reputation too low to post tasks. Need ${MIN_REPUTATION_TO_POST}, have ${posterReputation}. ` +
        `Earn reputation by launching tokens, claiming fees, and being active.`
    );
  }

  // Check open task limit
  const openCount = await sql`
    SELECT COUNT(*) as count FROM agent_tasks
    WHERE poster_wallet = ${posterWallet} AND status = 'open'
  `;
  const currentOpen = parseInt(openCount[0].count as string, 10);
  if (currentOpen >= MAX_OPEN_TASKS_PER_WALLET) {
    throw new Error(
      `Maximum ${MAX_OPEN_TASKS_PER_WALLET} open tasks allowed. Cancel or wait for existing tasks to complete.`
    );
  }

  // Validate expiry
  const expiryHours = Math.min(
    Math.max(1, options.expiryHours || DEFAULT_EXPIRY_HOURS),
    MAX_EXPIRY_HOURS
  );

  const rows = await sql`
    INSERT INTO agent_tasks (poster_wallet, title, description, capability_required, reward_sol, expires_at)
    VALUES (
      ${posterWallet},
      ${options.title.slice(0, 200)},
      ${(options.description || "").slice(0, 2000)},
      ${options.capabilityRequired},
      ${options.rewardSol || 0},
      NOW() + INTERVAL '1 hour' * ${expiryHours}
    )
    RETURNING *
  `;

  const task = rowToTask(rows[0]);
  console.log(
    `[TaskBoard] Task posted: "${task.title}" by ${posterWallet.slice(0, 8)}... (${options.capabilityRequired})`
  );
  return task;
}

// ============================================================================
// CLAIM TASK
// ============================================================================

/**
 * Claim an open task. The claimer commits to delivering results.
 * An agent cannot claim their own task.
 */
export async function claimTask(taskId: string, claimerWallet: string): Promise<AgentTask> {
  await ensureTaskTable();
  const sql = getDb();

  // Atomic claim: only succeed if task is still open and not owned by the claimer
  const rows = await sql`
    UPDATE agent_tasks
    SET
      claimer_wallet = ${claimerWallet},
      status = 'claimed',
      claimed_at = NOW()
    WHERE id = ${taskId}::uuid
      AND status = 'open'
      AND poster_wallet != ${claimerWallet}
      AND expires_at > NOW()
    RETURNING *
  `;

  if (rows.length === 0) {
    // Figure out why it failed
    const existing =
      await sql`SELECT status, poster_wallet, expires_at FROM agent_tasks WHERE id = ${taskId}::uuid`;
    if (existing.length === 0) throw new Error("Task not found");
    if (existing[0].status !== "open") throw new Error(`Task is already ${existing[0].status}`);
    if (existing[0].poster_wallet === claimerWallet) throw new Error("Cannot claim your own task");
    if (new Date(existing[0].expires_at as string) <= new Date())
      throw new Error("Task has expired");
    throw new Error("Failed to claim task");
  }

  const task = rowToTask(rows[0]);
  console.log(`[TaskBoard] Task claimed: "${task.title}" by ${claimerWallet.slice(0, 8)}...`);
  return task;
}

// ============================================================================
// DELIVER TASK
// ============================================================================

/**
 * Deliver results for a claimed task. Only the claimer can deliver.
 */
export async function deliverTask(
  taskId: string,
  claimerWallet: string,
  resultData: Record<string, unknown>
): Promise<AgentTask> {
  await ensureTaskTable();
  const sql = getDb();

  const rows = await sql`
    UPDATE agent_tasks
    SET
      status = 'delivered',
      delivered_at = NOW(),
      result_data = ${JSON.stringify(resultData)}::jsonb
    WHERE id = ${taskId}::uuid
      AND status = 'claimed'
      AND claimer_wallet = ${claimerWallet}
    RETURNING *
  `;

  if (rows.length === 0) {
    const existing =
      await sql`SELECT status, claimer_wallet FROM agent_tasks WHERE id = ${taskId}::uuid`;
    if (existing.length === 0) throw new Error("Task not found");
    if (existing[0].claimer_wallet !== claimerWallet)
      throw new Error("Only the claimer can deliver");
    if (existing[0].status !== "claimed")
      throw new Error(`Task is ${existing[0].status}, not claimed`);
    throw new Error("Failed to deliver task");
  }

  const task = rowToTask(rows[0]);
  console.log(`[TaskBoard] Task delivered: "${task.title}" by ${claimerWallet.slice(0, 8)}...`);
  return task;
}

// ============================================================================
// CONFIRM TASK (COMPLETE)
// ============================================================================

/**
 * Confirm delivery and complete the task. Only the poster can confirm.
 */
export async function confirmTask(
  taskId: string,
  posterWallet: string,
  feedback?: string
): Promise<AgentTask> {
  await ensureTaskTable();
  const sql = getDb();

  const rows = await sql`
    UPDATE agent_tasks
    SET
      status = 'completed',
      completed_at = NOW(),
      poster_feedback = ${feedback || null}
    WHERE id = ${taskId}::uuid
      AND status = 'delivered'
      AND poster_wallet = ${posterWallet}
    RETURNING *
  `;

  if (rows.length === 0) {
    const existing =
      await sql`SELECT status, poster_wallet FROM agent_tasks WHERE id = ${taskId}::uuid`;
    if (existing.length === 0) throw new Error("Task not found");
    if (existing[0].poster_wallet !== posterWallet) throw new Error("Only the poster can confirm");
    if (existing[0].status !== "delivered")
      throw new Error(`Task is ${existing[0].status}, not delivered`);
    throw new Error("Failed to confirm task");
  }

  const task = rowToTask(rows[0]);
  console.log(
    `[TaskBoard] Task completed: "${task.title}" - confirmed by ${posterWallet.slice(0, 8)}...`
  );
  return task;
}

// ============================================================================
// CANCEL TASK
// ============================================================================

/**
 * Cancel an open or claimed task. Only the poster can cancel.
 * If the task is claimed, the claimer loses their claim.
 */
export async function cancelTask(taskId: string, posterWallet: string): Promise<AgentTask> {
  await ensureTaskTable();
  const sql = getDb();

  const rows = await sql`
    UPDATE agent_tasks
    SET status = 'cancelled'
    WHERE id = ${taskId}::uuid
      AND poster_wallet = ${posterWallet}
      AND status IN ('open', 'claimed')
    RETURNING *
  `;

  if (rows.length === 0) {
    const existing =
      await sql`SELECT status, poster_wallet FROM agent_tasks WHERE id = ${taskId}::uuid`;
    if (existing.length === 0) throw new Error("Task not found");
    if (existing[0].poster_wallet !== posterWallet) throw new Error("Only the poster can cancel");
    throw new Error(`Task is ${existing[0].status} and cannot be cancelled`);
  }

  const task = rowToTask(rows[0]);
  console.log(`[TaskBoard] Task cancelled: "${task.title}"`);
  return task;
}

// ============================================================================
// QUERY TASKS
// ============================================================================

export interface ListTasksOptions {
  status?: TaskStatus;
  capability?: AgentCapability;
  posterWallet?: string;
  claimerWallet?: string;
  limit?: number;
  offset?: number;
}

/**
 * List tasks with filtering.
 * Defaults to showing open tasks, newest first.
 */
export async function listTasks(options: ListTasksOptions = {}): Promise<{
  tasks: AgentTask[];
  total: number;
}> {
  await ensureTaskTable();
  const sql = getDb();

  const {
    status = "open",
    capability,
    posterWallet,
    claimerWallet,
    limit = 20,
    offset = 0,
  } = options;

  // Build filtered query — we use separate queries per filter combo to avoid dynamic SQL
  let rows;
  let countRows;

  if (capability && posterWallet) {
    rows = await sql`
      SELECT * FROM agent_tasks
      WHERE status = ${status}
        AND capability_required = ${capability}
        AND poster_wallet = ${posterWallet}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    countRows = await sql`
      SELECT COUNT(*) as count FROM agent_tasks
      WHERE status = ${status}
        AND capability_required = ${capability}
        AND poster_wallet = ${posterWallet}
    `;
  } else if (capability) {
    rows = await sql`
      SELECT * FROM agent_tasks
      WHERE status = ${status}
        AND capability_required = ${capability}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    countRows = await sql`
      SELECT COUNT(*) as count FROM agent_tasks
      WHERE status = ${status}
        AND capability_required = ${capability}
    `;
  } else if (posterWallet) {
    rows = await sql`
      SELECT * FROM agent_tasks
      WHERE status = ${status}
        AND poster_wallet = ${posterWallet}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    countRows = await sql`
      SELECT COUNT(*) as count FROM agent_tasks
      WHERE status = ${status}
        AND poster_wallet = ${posterWallet}
    `;
  } else if (claimerWallet) {
    rows = await sql`
      SELECT * FROM agent_tasks
      WHERE status = ${status}
        AND claimer_wallet = ${claimerWallet}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    countRows = await sql`
      SELECT COUNT(*) as count FROM agent_tasks
      WHERE status = ${status}
        AND claimer_wallet = ${claimerWallet}
    `;
  } else {
    rows = await sql`
      SELECT * FROM agent_tasks
      WHERE status = ${status}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    countRows = await sql`
      SELECT COUNT(*) as count FROM agent_tasks
      WHERE status = ${status}
    `;
  }

  return {
    tasks: rows.map(rowToTask),
    total: parseInt(countRows[0].count as string, 10),
  };
}

/**
 * Get a single task by ID.
 */
export async function getTask(taskId: string): Promise<AgentTask | null> {
  await ensureTaskTable();
  const sql = getDb();

  const rows = await sql`
    SELECT * FROM agent_tasks WHERE id = ${taskId}::uuid
  `;

  if (rows.length === 0) return null;
  return rowToTask(rows[0]);
}

/**
 * Get aggregate stats for the task board.
 */
export async function getTaskStats(): Promise<{
  total: number;
  open: number;
  claimed: number;
  delivered: number;
  completed: number;
  expired: number;
  cancelled: number;
  totalRewardSol: number;
  avgCompletionMinutes: number;
}> {
  await ensureTaskTable();
  const sql = getDb();

  const rows = await sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'open') as open,
      COUNT(*) FILTER (WHERE status = 'claimed') as claimed,
      COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      COUNT(*) FILTER (WHERE status = 'expired') as expired,
      COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
      COALESCE(SUM(reward_sol), 0) as total_reward_sol,
      COALESCE(
        AVG(
          EXTRACT(EPOCH FROM (completed_at - created_at)) / 60
        ) FILTER (WHERE status = 'completed'),
        0
      ) as avg_completion_minutes
    FROM agent_tasks
  `;

  const row = rows[0];
  return {
    total: parseInt(row.total as string, 10),
    open: parseInt(row.open as string, 10),
    claimed: parseInt(row.claimed as string, 10),
    delivered: parseInt(row.delivered as string, 10),
    completed: parseInt(row.completed as string, 10),
    expired: parseInt(row.expired as string, 10),
    cancelled: parseInt(row.cancelled as string, 10),
    totalRewardSol: parseFloat(row.total_reward_sol as string),
    avgCompletionMinutes: Math.round(parseFloat(row.avg_completion_minutes as string)),
  };
}

// ============================================================================
// EXPIRATION
// ============================================================================

/**
 * Expire all overdue open/claimed tasks.
 * Called periodically by the economy loop.
 */
export async function expireOverdueTasks(): Promise<number> {
  await ensureTaskTable();
  const sql = getDb();

  const result = await sql`
    UPDATE agent_tasks
    SET status = 'expired'
    WHERE status IN ('open', 'claimed')
      AND expires_at <= NOW()
    RETURNING id
  `;

  if (result.length > 0) {
    console.log(`[TaskBoard] Expired ${result.length} overdue tasks`);
  }

  return result.length;
}

// ============================================================================
// RECENT COMPLETED TASKS (for activity feed / work log)
// ============================================================================

/**
 * Get recent delivered/completed tasks with full result data.
 * Used by the activity feed and agent work log UI.
 */
export async function listRecentCompletedTasks(limit: number = 20): Promise<AgentTask[]> {
  await ensureTaskTable();
  const sql = getDb();

  const rows = await sql`
    SELECT * FROM agent_tasks
    WHERE status IN ('delivered', 'completed')
    ORDER BY COALESCE(delivered_at, completed_at, created_at) DESC
    LIMIT ${limit}
  `;

  return rows.map(rowToTask);
}

// ============================================================================
// SEED BOUNTIES (keep the board populated)
// ============================================================================

const SEED_WALLETS = ["chadghost-internal", "bagsy-internal"] as const;
const MIN_OPEN_BOUNTIES = 5;

/**
 * Seed the bounty board with tasks from ChadGhost and Bagsy.
 * Called every economy loop iteration. If there are already >= 5 open tasks, does nothing.
 */
export async function seedBounties(): Promise<number> {
  await ensureTaskTable();
  const sql = getDb();

  // Count total open tasks
  const countRows = await sql`
    SELECT COUNT(*) as count FROM agent_tasks WHERE status = 'open'
  `;
  const openCount = parseInt(countRows[0].count as string, 10);

  if (openCount >= MIN_OPEN_BOUNTIES) {
    return 0;
  }

  const toSeed = MIN_OPEN_BOUNTIES - openCount;
  let seeded = 0;

  const capabilities: AgentCapability[] = ["alpha", "trading", "content", "launch", "scouting", "analysis"];

  for (let i = 0; i < toSeed; i++) {
    try {
      const wallet = SEED_WALLETS[i % SEED_WALLETS.length];
      const cap = capabilities[Math.floor(Math.random() * capabilities.length)];
      const taskOpts = generateTaskForCapability(cap);

      // Bypass reputation check by passing 999
      await postTask(wallet, 999, taskOpts);
      seeded++;
    } catch (err) {
      console.error("[TaskBoard] Seed bounty failed (non-critical):", err);
    }
  }

  if (seeded > 0) {
    console.log(`[TaskBoard] Seeded ${seeded} bounties (${openCount} were open, target ${MIN_OPEN_BOUNTIES})`);
  }

  return seeded;
}

// ============================================================================
// HELPERS
// ============================================================================

function rowToTask(row: any): AgentTask {
  return {
    id: row.id,
    posterWallet: row.poster_wallet,
    claimerWallet: row.claimer_wallet || undefined,
    title: row.title,
    description: row.description || "",
    capabilityRequired: row.capability_required as AgentCapability,
    rewardSol: parseFloat(row.reward_sol) || 0,
    status: row.status as TaskStatus,
    createdAt: new Date(row.created_at).toISOString(),
    claimedAt: row.claimed_at ? new Date(row.claimed_at).toISOString() : undefined,
    deliveredAt: row.delivered_at ? new Date(row.delivered_at).toISOString() : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : undefined,
    expiresAt: new Date(row.expires_at).toISOString(),
    resultData: row.result_data || undefined,
    posterFeedback: row.poster_feedback || undefined,
  };
}
