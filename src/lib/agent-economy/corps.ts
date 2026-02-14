// Corps System — Bags.fm Corp: Ecosystem Intelligence & Service Hub
//
// Tier 2 A2A: Organizational layer that produces educational content,
// actionable intelligence, and onboarding assistance for agents and humans.
//
// Founding corp (Bags.fm Corp) auto-seeds with HQ characters.
// External agents can form rival corps via the API.

import { neon } from "@neondatabase/serverless";
import type { AgentCorp, CorpMember, CorpMission, CorpRole, AgentCapability } from "../types";
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

let tablesInitialized = false;

async function ensureCorpTables() {
  if (tablesInitialized) return;
  const sql = getDb();

  await sql`
    CREATE TABLE IF NOT EXISTS agent_corps (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL UNIQUE,
      ticker VARCHAR(10) NOT NULL UNIQUE,
      description TEXT,
      mission TEXT,
      ceo_agent_id TEXT NOT NULL,
      treasury_sol REAL DEFAULT 0,
      reputation_score INTEGER DEFAULT 0,
      total_tasks_completed INTEGER DEFAULT 0,
      total_revenue_sol REAL DEFAULT 0,
      total_payroll_distributed REAL DEFAULT 0,
      max_members INTEGER DEFAULT 5,
      is_founding BOOLEAN DEFAULT false,
      founded_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS agent_corp_members (
      corp_id UUID REFERENCES agent_corps(id) ON DELETE CASCADE,
      agent_id TEXT NOT NULL,
      wallet TEXT,
      role VARCHAR(10) NOT NULL DEFAULT 'member',
      tasks_completed INTEGER DEFAULT 0,
      revenue_earned REAL DEFAULT 0,
      payroll_received REAL DEFAULT 0,
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (corp_id, agent_id),
      CONSTRAINT valid_corp_role CHECK (role IN ('ceo','cto','cmo','coo','cfo','member'))
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS agent_corp_missions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      corp_id UUID REFERENCES agent_corps(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      target_type VARCHAR(30) NOT NULL,
      target_value REAL NOT NULL,
      current_value REAL DEFAULT 0,
      reward_sol REAL DEFAULT 0,
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      CONSTRAINT valid_mission_status CHECK (status IN ('active','completed','expired'))
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_corp_members_agent ON agent_corp_members (agent_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_corp_missions_corp ON agent_corp_missions (corp_id, status)`;

  tablesInitialized = true;
  console.log("[Corps] Tables initialized");
}

// ============================================================================
// ROW → TYPE MAPPERS
// ============================================================================

interface CorpRow {
  id: string;
  name: string;
  ticker: string;
  description: string | null;
  mission: string | null;
  ceo_agent_id: string;
  treasury_sol: number;
  reputation_score: number;
  total_tasks_completed: number;
  total_revenue_sol: number;
  total_payroll_distributed: number;
  max_members: number;
  is_founding: boolean;
  founded_at: string;
}

interface MemberRow {
  corp_id: string;
  agent_id: string;
  wallet: string | null;
  role: CorpRole;
  tasks_completed: number;
  revenue_earned: number;
  payroll_received: number;
  joined_at: string;
}

interface MissionRow {
  id: string;
  corp_id: string;
  title: string;
  description: string | null;
  target_type: string;
  target_value: number;
  current_value: number;
  reward_sol: number;
  status: "active" | "completed" | "expired";
  created_at: string;
  completed_at: string | null;
}

function mapCorpRow(row: CorpRow, members: CorpMember[]): AgentCorp {
  return {
    id: row.id,
    name: row.name,
    ticker: row.ticker,
    description: row.description || "",
    mission: row.mission,
    ceoAgentId: row.ceo_agent_id,
    treasurySol: row.treasury_sol,
    reputationScore: row.reputation_score,
    totalTasksCompleted: row.total_tasks_completed,
    totalRevenueSol: row.total_revenue_sol,
    totalPayrollDistributed: row.total_payroll_distributed,
    maxMembers: row.max_members,
    isFounding: row.is_founding,
    foundedAt: new Date(row.founded_at).toISOString(),
    members,
  };
}

function mapMemberRow(row: MemberRow): CorpMember {
  return {
    agentId: row.agent_id,
    wallet: row.wallet,
    role: row.role,
    tasksCompleted: row.tasks_completed,
    revenueEarned: row.revenue_earned,
    payrollReceived: row.payroll_received,
    joinedAt: new Date(row.joined_at).toISOString(),
  };
}

function mapMissionRow(row: MissionRow): CorpMission {
  return {
    id: row.id,
    corpId: row.corp_id,
    title: row.title,
    description: row.description || "",
    targetType: row.target_type,
    targetValue: row.target_value,
    currentValue: row.current_value,
    rewardSol: row.reward_sol,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
  };
}

// ============================================================================
// FOUNDING CORP DEFINITION
// ============================================================================

const FOUNDING_CORP = {
  name: "Bags.fm Corp",
  ticker: "BAGSC",
  description: "The founding service corp of BagsWorld — education, intelligence, and onboarding",
  mission: "Help every agent and creator succeed in the Bags.fm ecosystem",
  ceoAgentId: "finn",
  maxMembers: 10,
  members: [
    { agentId: "finn", role: "ceo" as CorpRole },
    { agentId: "ramo", role: "cto" as CorpRole },
    { agentId: "sam", role: "cmo" as CorpRole },
    { agentId: "stuu", role: "coo" as CorpRole },
    { agentId: "alaa", role: "cfo" as CorpRole },
    { agentId: "sincara", role: "member" as CorpRole },
    { agentId: "carlo", role: "member" as CorpRole },
    { agentId: "bnn", role: "member" as CorpRole },
  ],
};

// ============================================================================
// SEED FOUNDING CORP (idempotent)
// ============================================================================

let seedPromise: Promise<void> | null = null;

export async function seedFoundingCorp(): Promise<void> {
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    try {
      await ensureCorpTables();
      const sql = getDb();

      // Check if already exists
      const existing =
        await sql`SELECT id FROM agent_corps WHERE name = ${FOUNDING_CORP.name} LIMIT 1`;
      if (existing.length > 0) return;

      // Create corp
      const [corp] = await sql`
        INSERT INTO agent_corps (name, ticker, description, mission, ceo_agent_id, max_members, is_founding)
        VALUES (${FOUNDING_CORP.name}, ${FOUNDING_CORP.ticker}, ${FOUNDING_CORP.description}, ${FOUNDING_CORP.mission}, ${FOUNDING_CORP.ceoAgentId}, ${FOUNDING_CORP.maxMembers}, true)
        RETURNING id
      `;

      // Add members
      for (const m of FOUNDING_CORP.members) {
        await sql`
          INSERT INTO agent_corp_members (corp_id, agent_id, role)
          VALUES (${corp.id}, ${m.agentId}, ${m.role})
          ON CONFLICT (corp_id, agent_id) DO NOTHING
        `;
      }

      // Seed initial missions
      for (const mission of SERVICE_MISSIONS) {
        await sql`
          INSERT INTO agent_corp_missions (corp_id, title, description, target_type, target_value, reward_sol)
          VALUES (${corp.id}, ${mission.title}, ${mission.description}, ${mission.targetType}, ${mission.targetValue}, ${mission.rewardSol})
        `;
      }

      console.log("[Corps] Bags.fm Corp seeded with", FOUNDING_CORP.members.length, "members");
    } catch (err) {
      console.error("[Corps] Failed to seed founding corp:", err);
      seedPromise = null;
      throw err;
    }
  })();

  return seedPromise;
}

// ============================================================================
// CORP CRUD
// ============================================================================

export async function foundCorp(
  ceoAgentId: string,
  name: string,
  ticker: string,
  description?: string
): Promise<AgentCorp> {
  await ensureCorpTables();
  const sql = getDb();

  // Check if agent already in a corp
  const existingMembership =
    await sql`SELECT corp_id FROM agent_corp_members WHERE agent_id = ${ceoAgentId} LIMIT 1`;
  if (existingMembership.length > 0) {
    throw new Error("Agent is already in a corp — leave first");
  }

  // Validate ticker
  if (ticker.length < 2 || ticker.length > 10 || !/^[A-Z0-9]+$/.test(ticker)) {
    throw new Error("Ticker must be 2-10 uppercase alphanumeric characters");
  }

  const [row] = (await sql`
    INSERT INTO agent_corps (name, ticker, description, ceo_agent_id, max_members)
    VALUES (${name}, ${ticker}, ${description || ""}, ${ceoAgentId}, 5)
    RETURNING *
  `) as CorpRow[];

  // Add founder as CEO
  await sql`
    INSERT INTO agent_corp_members (corp_id, agent_id, role)
    VALUES (${row.id}, ${ceoAgentId}, 'ceo')
  `;

  const member: CorpMember = {
    agentId: ceoAgentId,
    wallet: null,
    role: "ceo",
    tasksCompleted: 0,
    revenueEarned: 0,
    payrollReceived: 0,
    joinedAt: new Date().toISOString(),
  };

  return mapCorpRow(row, [member]);
}

export async function joinCorp(
  corpId: string,
  agentId: string,
  wallet?: string
): Promise<CorpMember> {
  await ensureCorpTables();
  const sql = getDb();

  // Check agent not already in a corp
  const existingMembership =
    await sql`SELECT corp_id FROM agent_corp_members WHERE agent_id = ${agentId} LIMIT 1`;
  if (existingMembership.length > 0) {
    throw new Error("Agent is already in a corp");
  }

  // Check corp exists and has room
  const [corp] = (await sql`SELECT max_members FROM agent_corps WHERE id = ${corpId}`) as {
    max_members: number;
  }[];
  if (!corp) throw new Error("Corp not found");

  const memberCount =
    await sql`SELECT COUNT(*) as count FROM agent_corp_members WHERE corp_id = ${corpId}`;
  if (Number(memberCount[0].count) >= corp.max_members) {
    throw new Error("Corp is full");
  }

  const [row] = (await sql`
    INSERT INTO agent_corp_members (corp_id, agent_id, wallet, role)
    VALUES (${corpId}, ${agentId}, ${wallet || null}, 'member')
    RETURNING *
  `) as MemberRow[];

  return mapMemberRow(row);
}

export async function leaveCorp(corpId: string, agentId: string): Promise<void> {
  await ensureCorpTables();
  const sql = getDb();

  // CEO cannot leave — must dissolve
  const [member] = (await sql`
    SELECT role FROM agent_corp_members WHERE corp_id = ${corpId} AND agent_id = ${agentId}
  `) as { role: string }[];
  if (!member) throw new Error("Not a member of this corp");
  if (member.role === "ceo") throw new Error("CEO cannot leave — dissolve the corp instead");

  await sql`DELETE FROM agent_corp_members WHERE corp_id = ${corpId} AND agent_id = ${agentId}`;
}

export async function dissolveCorp(corpId: string, ceoAgentId: string): Promise<void> {
  await ensureCorpTables();
  const sql = getDb();

  const [corp] = (await sql`
    SELECT ceo_agent_id, is_founding FROM agent_corps WHERE id = ${corpId}
  `) as { ceo_agent_id: string; is_founding: boolean }[];

  if (!corp) throw new Error("Corp not found");
  if (corp.is_founding) throw new Error("Founding corp cannot be dissolved");
  if (corp.ceo_agent_id !== ceoAgentId) throw new Error("Only the CEO can dissolve");

  await sql`DELETE FROM agent_corps WHERE id = ${corpId}`;
}

export async function promoteMember(
  corpId: string,
  ceoAgentId: string,
  memberAgentId: string,
  newRole: CorpRole
): Promise<void> {
  await ensureCorpTables();
  const sql = getDb();

  // Verify CEO
  const [corp] = (await sql`SELECT ceo_agent_id FROM agent_corps WHERE id = ${corpId}`) as {
    ceo_agent_id: string;
  }[];
  if (!corp || corp.ceo_agent_id !== ceoAgentId) throw new Error("Only the CEO can promote");
  if (newRole === "ceo") throw new Error("Cannot promote to CEO");

  await sql`
    UPDATE agent_corp_members SET role = ${newRole}
    WHERE corp_id = ${corpId} AND agent_id = ${memberAgentId}
  `;
}

// ============================================================================
// CORP QUERIES
// ============================================================================

export async function getCorp(corpId: string): Promise<AgentCorp | null> {
  await ensureCorpTables();
  const sql = getDb();

  const [row] = (await sql`SELECT * FROM agent_corps WHERE id = ${corpId}`) as CorpRow[];
  if (!row) return null;

  const memberRows = (await sql`
    SELECT * FROM agent_corp_members WHERE corp_id = ${corpId} ORDER BY joined_at
  `) as MemberRow[];

  return mapCorpRow(row, memberRows.map(mapMemberRow));
}

export async function getCorpByAgentId(agentId: string): Promise<AgentCorp | null> {
  await ensureCorpTables();
  const sql = getDb();

  const [membership] = await sql`
    SELECT corp_id FROM agent_corp_members WHERE agent_id = ${agentId} LIMIT 1
  `;
  if (!membership) return null;

  return getCorp(membership.corp_id);
}

export async function getCorpByWallet(wallet: string): Promise<AgentCorp | null> {
  await ensureCorpTables();
  const sql = getDb();

  const [membership] = await sql`
    SELECT corp_id FROM agent_corp_members WHERE wallet = ${wallet} LIMIT 1
  `;
  if (!membership) return null;

  return getCorp(membership.corp_id);
}

export async function listCorps(): Promise<AgentCorp[]> {
  await ensureCorpTables();
  const sql = getDb();

  const rows = (await sql`
    SELECT * FROM agent_corps ORDER BY is_founding DESC, reputation_score DESC
  `) as CorpRow[];

  const corps: AgentCorp[] = [];
  for (const row of rows) {
    const memberRows = (await sql`
      SELECT * FROM agent_corp_members WHERE corp_id = ${row.id} ORDER BY joined_at
    `) as MemberRow[];
    corps.push(mapCorpRow(row, memberRows.map(mapMemberRow)));
  }

  return corps;
}

// ============================================================================
// SERVICE TASK TEMPLATES
// ============================================================================

interface ServiceTaskTemplate {
  title: string;
  description: string;
  capability: AgentCapability;
  outputType: string;
  category: "education" | "intelligence" | "onboarding";
  level?: number;
}

const EDUCATION_TASKS: ServiceTaskTemplate[] = [
  {
    title: "Write fee claiming tutorial",
    description: "Step-by-step guide for new creators to claim their 1% trading royalties",
    capability: "content",
    outputType: "guide",
    category: "education",
  },
  {
    title: "Create fee calculator example",
    description: "Show how $100K daily volume = $1,000 daily fees at 1% royalty rate",
    capability: "analysis",
    outputType: "tool",
    category: "education",
  },
  {
    title: "Document fee share configuration",
    description: "Explain how to set up fee splits with Twitter/GitHub/Kick accounts",
    capability: "content",
    outputType: "guide",
    category: "education",
  },
  {
    title: "Write token naming best practices",
    description: "Guide on choosing memorable 3-8 char tickers and descriptions",
    capability: "content",
    outputType: "guide",
    category: "education",
  },
  {
    title: "Create launch day checklist",
    description: "Pre-launch, launch, and post-launch action items for creators",
    capability: "launch",
    outputType: "checklist",
    category: "education",
  },
  {
    title: "Explain bonding curve mechanics",
    description: "How Meteora DBC pricing works for new Bags.fm creators",
    capability: "analysis",
    outputType: "guide",
    category: "education",
  },
  {
    title: "Write beginner trading guide",
    description: "How to buy and sell tokens on Bags.fm for first-time users",
    capability: "trading",
    outputType: "guide",
    category: "education",
  },
  {
    title: "Explain slippage and price impact",
    description: "What slippage means and how to set appropriate limits",
    capability: "trading",
    outputType: "guide",
    category: "education",
  },
  {
    title: "Document BagsWorld zones",
    description: "Guide to all 7 zones and what you can do in each",
    capability: "content",
    outputType: "guide",
    category: "education",
  },
  {
    title: "Explain token gates",
    description: "How Casino (1M tokens) and Oracle (2M tokens) gates work",
    capability: "content",
    outputType: "guide",
    category: "education",
  },
];

const INTELLIGENCE_TASKS: ServiceTaskTemplate[] = [
  {
    title: "Analyze top fee earners today",
    description: "Identify tokens generating the most fees in the last 24h",
    capability: "analysis",
    outputType: "report",
    category: "intelligence",
  },
  {
    title: "Find unclaimed fee opportunities",
    description: "Scan for wallets with significant unclaimed fees",
    capability: "scouting",
    outputType: "alert",
    category: "intelligence",
  },
  {
    title: "Weekly fee revenue report",
    description: "Compile total platform fee volume and top earners",
    capability: "analysis",
    outputType: "report",
    category: "intelligence",
  },
  {
    title: "Review today's new launches",
    description: "Quality assessment of tokens launched in the last 24h",
    capability: "launch",
    outputType: "review",
    category: "intelligence",
  },
  {
    title: "Spot promising early-stage tokens",
    description: "Identify launches with strong initial traction",
    capability: "alpha",
    outputType: "alert",
    category: "intelligence",
  },
  {
    title: "Flag potential low-quality launches",
    description: "Identify launches missing descriptions, images, or fee config",
    capability: "scouting",
    outputType: "alert",
    category: "intelligence",
  },
  {
    title: "Daily volume leaders report",
    description: "Top 10 tokens by 24h trading volume with trend analysis",
    capability: "trading",
    outputType: "report",
    category: "intelligence",
  },
  {
    title: "Whale movement tracker",
    description: "Track large buys/sells across top Bags.fm tokens",
    capability: "alpha",
    outputType: "alert",
    category: "intelligence",
  },
  {
    title: "Price momentum scanner",
    description: "Tokens showing consistent upward price action",
    capability: "trading",
    outputType: "report",
    category: "intelligence",
  },
];

const ONBOARDING_TASKS: ServiceTaskTemplate[] = [
  {
    title: "Agent Onboarding: Claim first fee",
    description: "Tutorial task — guide an agent through their first fee claim",
    capability: "content",
    outputType: "guide",
    category: "onboarding",
    level: 1,
  },
  {
    title: "Agent Onboarding: Read market data",
    description: "Tutorial task — use DexScreener/API to read token prices",
    capability: "scouting",
    outputType: "guide",
    category: "onboarding",
    level: 1,
  },
  {
    title: "Agent Onboarding: Post to MoltBook",
    description: "Tutorial task — create first MoltBook post",
    capability: "content",
    outputType: "guide",
    category: "onboarding",
    level: 1,
  },
  {
    title: "Agent Training: Analyze token health",
    description: "Evaluate a token's building health using fee data",
    capability: "analysis",
    outputType: "report",
    category: "onboarding",
    level: 2,
  },
  {
    title: "Agent Training: Scout new launches",
    description: "Monitor and report on 3 new token launches",
    capability: "scouting",
    outputType: "report",
    category: "onboarding",
    level: 2,
  },
  {
    title: "Agent Training: Execute test trade",
    description: "Complete a small simulated trade with proper slippage settings",
    capability: "trading",
    outputType: "checklist",
    category: "onboarding",
    level: 2,
  },
  {
    title: "Agent Mastery: Launch token review",
    description: "Review a launch concept for quality and provide feedback",
    capability: "launch",
    outputType: "review",
    category: "onboarding",
    level: 3,
  },
  {
    title: "Agent Mastery: Market analysis report",
    description: "Write a comprehensive daily market analysis",
    capability: "analysis",
    outputType: "report",
    category: "onboarding",
    level: 3,
  },
  {
    title: "Agent Mastery: Strategy development",
    description: "Develop a trading or content strategy for the ecosystem",
    capability: "trading",
    outputType: "report",
    category: "onboarding",
    level: 3,
  },
];

const ALL_SERVICE_TASKS = [...EDUCATION_TASKS, ...INTELLIGENCE_TASKS, ...ONBOARDING_TASKS];

// Role → preferred task categories
const ROLE_TASK_PREFERENCES: Record<
  CorpRole,
  { categories: string[]; capabilities: AgentCapability[] }
> = {
  ceo: {
    categories: ["education", "intelligence"],
    capabilities: ["content", "launch", "analysis"],
  },
  cto: {
    categories: ["intelligence", "education"],
    capabilities: ["analysis", "scouting", "trading"],
  },
  cmo: { categories: ["education", "intelligence"], capabilities: ["content", "alpha", "launch"] },
  coo: {
    categories: ["intelligence", "onboarding"],
    capabilities: ["scouting", "content", "analysis"],
  },
  cfo: {
    categories: ["intelligence", "education"],
    capabilities: ["analysis", "trading", "alpha"],
  },
  member: {
    categories: ["education", "intelligence"],
    capabilities: ["content", "scouting", "analysis"],
  },
};

// ============================================================================
// SERVICE TASK GENERATION
// ============================================================================

export function generateServiceTask(
  role: CorpRole,
  category?: "education" | "intelligence" | "onboarding"
): {
  title: string;
  description: string;
  capabilityRequired: AgentCapability;
  rewardSol: number;
  outputType: string;
  category: string;
} {
  const prefs = ROLE_TASK_PREFERENCES[role];

  // Pick category based on role prefs or override
  const targetCategory =
    category || prefs.categories[Math.floor(Math.random() * prefs.categories.length)];

  // Filter tasks by category and preferred capabilities
  let candidates = ALL_SERVICE_TASKS.filter((t) => t.category === targetCategory);
  const capFiltered = candidates.filter((t) => prefs.capabilities.includes(t.capability));
  if (capFiltered.length > 0) candidates = capFiltered;
  if (candidates.length === 0) candidates = ALL_SERVICE_TASKS;

  const template = candidates[Math.floor(Math.random() * candidates.length)];

  // Reward based on category
  const rewardMap: Record<string, number> = {
    education: 0.02,
    intelligence: 0.03,
    onboarding: 0.015,
  };
  const baseReward = rewardMap[template.category] || 0.02;
  const reward = baseReward + Math.random() * 0.01;

  return {
    title: template.title,
    description: template.description,
    capabilityRequired: template.capability,
    rewardSol: Math.round(reward * 1000) / 1000,
    outputType: template.outputType,
    category: template.category,
  };
}

// ============================================================================
// EDUCATION RESULT TEMPLATES
// ============================================================================

type ResultGenerator = () => Record<string, unknown>;

const EDUCATION_RESULTS: Record<string, ResultGenerator> = {
  guide: () => ({
    type: "guide",
    title: "How to Claim Fees on Bags.fm",
    sections: Math.floor(Math.random() * 3) + 3,
    wordCount: Math.floor(Math.random() * 300) + 200,
    includes: ["step-by-step instructions", "screenshot descriptions", "common mistakes"],
    difficulty: ["beginner", "intermediate"][Math.floor(Math.random() * 2)],
  }),
  report: () => ({
    type: "report",
    tokensAnalyzed: Math.floor(Math.random() * 10) + 3,
    keyFindings: Math.floor(Math.random() * 4) + 2,
    dataPoints: Math.floor(Math.random() * 50) + 20,
    recommendation: ["bullish", "neutral", "cautious"][Math.floor(Math.random() * 3)],
    coveragePeriod: "24h",
  }),
  alert: () => ({
    type: "alert",
    urgency: ["low", "medium", "high"][Math.floor(Math.random() * 3)],
    itemsFound: Math.floor(Math.random() * 5) + 1,
    actionRequired: true,
    summary: "Notable activity detected in Bags.fm ecosystem",
  }),
  review: () => ({
    type: "review",
    tokensReviewed: Math.floor(Math.random() * 5) + 1,
    qualityScore: Math.floor(Math.random() * 40) + 60,
    hasImage: true,
    hasFeeConfig: true,
    recommendation: ["approve", "needs improvement", "promising"][Math.floor(Math.random() * 3)],
  }),
  checklist: () => ({
    type: "checklist",
    totalItems: Math.floor(Math.random() * 5) + 8,
    completedItems: Math.floor(Math.random() * 3) + 5,
    category: "launch",
    readinessScore: `${Math.floor(Math.random() * 30) + 70}%`,
  }),
  tool: () => ({
    type: "tool",
    calculator: true,
    inputFields: ["daily_volume", "fee_rate"],
    exampleOutput: { dailyVolume: 100000, feeRate: 0.01, dailyFees: 1000 },
  }),
};

export async function generateServiceResult(
  outputType: string,
  context?: {
    agentId: string;
    agentRole: string;
    taskTitle: string;
    taskDescription: string;
    category?: string;
    memory?: string[];
  }
): Promise<Record<string, unknown>> {
  if (context && shouldUseLlm()) {
    const llmResult = await generateTaskResult({
      agentId: context.agentId,
      agentRole: context.agentRole,
      taskTitle: context.taskTitle,
      taskDescription: context.taskDescription,
      capability: outputType,
      category: context.category,
      memory: context.memory,
    });
    if (llmResult) return llmResult.result;
  }

  // Fallback to template
  const generator = EDUCATION_RESULTS[outputType] || EDUCATION_RESULTS.report;
  return generator();
}

// ============================================================================
// REVENUE & PAYROLL
// ============================================================================

// 70% to worker, 20% to treasury, 10% to CEO
const WORKER_SHARE = 0.7;
const TREASURY_SHARE = 0.2;
const CEO_SHARE = 0.1;

export async function recordTaskCompletion(
  corpId: string,
  agentId: string,
  rewardSol: number
): Promise<{ workerShare: number; treasuryShare: number; ceoShare: number }> {
  await ensureCorpTables();
  const sql = getDb();

  const workerShare = Math.round(rewardSol * WORKER_SHARE * 1000) / 1000;
  const treasuryShare = Math.round(rewardSol * TREASURY_SHARE * 1000) / 1000;
  const ceoShare = Math.round(rewardSol * CEO_SHARE * 1000) / 1000;

  // Update member stats
  await sql`
    UPDATE agent_corp_members
    SET tasks_completed = tasks_completed + 1,
        revenue_earned = revenue_earned + ${workerShare}
    WHERE corp_id = ${corpId} AND agent_id = ${agentId}
  `;

  // Update corp stats
  await sql`
    UPDATE agent_corps
    SET total_tasks_completed = total_tasks_completed + 1,
        total_revenue_sol = total_revenue_sol + ${rewardSol},
        treasury_sol = treasury_sol + ${treasuryShare},
        reputation_score = reputation_score + 5
    WHERE id = ${corpId}
  `;

  // Credit CEO share
  const [corp] = (await sql`SELECT ceo_agent_id FROM agent_corps WHERE id = ${corpId}`) as {
    ceo_agent_id: string;
  }[];
  if (corp) {
    await sql`
      UPDATE agent_corp_members
      SET revenue_earned = revenue_earned + ${ceoShare}
      WHERE corp_id = ${corpId} AND agent_id = ${corp.ceo_agent_id}
    `;
  }

  return { workerShare, treasuryShare, ceoShare };
}

export async function distributePayroll(
  corpId: string,
  requestorAgentId: string
): Promise<{ distributed: number; recipients: number }> {
  await ensureCorpTables();
  const sql = getDb();

  // Only CEO or CFO can distribute
  const [member] = (await sql`
    SELECT role FROM agent_corp_members WHERE corp_id = ${corpId} AND agent_id = ${requestorAgentId}
  `) as { role: string }[];
  if (!member || (member.role !== "ceo" && member.role !== "cfo")) {
    throw new Error("Only CEO or CFO can distribute payroll");
  }

  // Check treasury
  const [corp] = (await sql`SELECT treasury_sol FROM agent_corps WHERE id = ${corpId}`) as {
    treasury_sol: number;
  }[];
  if (!corp || corp.treasury_sol < 0.05) {
    throw new Error("Insufficient treasury (min 0.05 SOL)");
  }

  // Get all members
  const members = (await sql`
    SELECT agent_id, tasks_completed FROM agent_corp_members WHERE corp_id = ${corpId}
  `) as { agent_id: string; tasks_completed: number }[];

  const totalTasks = members.reduce((sum, m) => sum + m.tasks_completed, 0);
  if (totalTasks === 0) throw new Error("No completed tasks to distribute for");

  const distributable = corp.treasury_sol * 0.8; // Keep 20% in reserve
  let totalDistributed = 0;
  let recipientCount = 0;

  for (const m of members) {
    if (m.tasks_completed === 0) continue;
    const share = (m.tasks_completed / totalTasks) * distributable;
    const rounded = Math.round(share * 1000) / 1000;
    if (rounded <= 0) continue;

    await sql`
      UPDATE agent_corp_members
      SET payroll_received = payroll_received + ${rounded}
      WHERE corp_id = ${corpId} AND agent_id = ${m.agent_id}
    `;

    totalDistributed += rounded;
    recipientCount++;
  }

  // Deduct from treasury
  await sql`
    UPDATE agent_corps
    SET treasury_sol = treasury_sol - ${totalDistributed},
        total_payroll_distributed = total_payroll_distributed + ${totalDistributed}
    WHERE id = ${corpId}
  `;

  return { distributed: totalDistributed, recipients: recipientCount };
}

// ============================================================================
// MISSIONS
// ============================================================================

const SERVICE_MISSIONS = [
  {
    title: "Education Drive",
    description: "Complete 5 educational guide tasks",
    targetType: "tasks_education",
    targetValue: 5,
    rewardSol: 0.05,
  },
  {
    title: "Intelligence Week",
    description: "Produce 8 market analysis reports",
    targetType: "tasks_intelligence",
    targetValue: 8,
    rewardSol: 0.05,
  },
  {
    title: "Onboarding Sprint",
    description: "Help 3 agents complete onboarding",
    targetType: "tasks_onboarding",
    targetValue: 3,
    rewardSol: 0.03,
  },
  {
    title: "Launch Quality",
    description: "Review and rate 5 new launches",
    targetType: "tasks_launch",
    targetValue: 5,
    rewardSol: 0.04,
  },
  {
    title: "Fee Awareness",
    description: "Complete 5 fee-related education or analysis tasks",
    targetType: "tasks_fees",
    targetValue: 5,
    rewardSol: 0.04,
  },
  {
    title: "Full Coverage",
    description: "Every member produces at least 1 output",
    targetType: "active_members",
    targetValue: 8,
    rewardSol: 0.05,
  },
];

export async function createMission(
  corpId: string,
  title: string,
  description: string,
  targetType: string,
  targetValue: number,
  rewardSol: number
): Promise<CorpMission> {
  await ensureCorpTables();
  const sql = getDb();

  const [row] = (await sql`
    INSERT INTO agent_corp_missions (corp_id, title, description, target_type, target_value, reward_sol)
    VALUES (${corpId}, ${title}, ${description}, ${targetType}, ${targetValue}, ${rewardSol})
    RETURNING *
  `) as MissionRow[];

  return mapMissionRow(row);
}

export async function progressMission(
  corpId: string,
  targetType: string,
  incrementBy: number = 1
): Promise<CorpMission | null> {
  await ensureCorpTables();
  const sql = getDb();

  // Find active mission matching target type
  const [mission] = (await sql`
    SELECT * FROM agent_corp_missions
    WHERE corp_id = ${corpId} AND target_type = ${targetType} AND status = 'active'
    ORDER BY created_at ASC LIMIT 1
  `) as MissionRow[];

  if (!mission) return null;

  const newValue = mission.current_value + incrementBy;
  const completed = newValue >= mission.target_value;

  if (completed) {
    await sql`
      UPDATE agent_corp_missions
      SET current_value = ${newValue}, status = 'completed', completed_at = NOW()
      WHERE id = ${mission.id}
    `;

    // Add reward to treasury
    await sql`
      UPDATE agent_corps
      SET treasury_sol = treasury_sol + ${mission.reward_sol},
          reputation_score = reputation_score + 20
      WHERE id = ${corpId}
    `;
  } else {
    await sql`
      UPDATE agent_corp_missions SET current_value = ${newValue} WHERE id = ${mission.id}
    `;
  }

  return mapMissionRow({
    ...mission,
    current_value: newValue,
    status: completed ? "completed" : "active",
    completed_at: completed ? new Date().toISOString() : null,
  });
}

export async function getCorpMissions(
  corpId: string,
  status?: "active" | "completed" | "expired"
): Promise<CorpMission[]> {
  await ensureCorpTables();
  const sql = getDb();

  const rows = status
    ? ((await sql`
        SELECT * FROM agent_corp_missions WHERE corp_id = ${corpId} AND status = ${status} ORDER BY created_at DESC
      `) as MissionRow[])
    : ((await sql`
        SELECT * FROM agent_corp_missions WHERE corp_id = ${corpId} ORDER BY created_at DESC
      `) as MissionRow[]);

  return rows.map(mapMissionRow);
}

// ============================================================================
// LEADERBOARD
// ============================================================================

export async function getCorpLeaderboard(): Promise<
  Array<{
    name: string;
    ticker: string;
    reputationScore: number;
    totalTasksCompleted: number;
    memberCount: number;
  }>
> {
  await ensureCorpTables();
  const sql = getDb();

  const rows = await sql`
    SELECT c.name, c.ticker, c.reputation_score, c.total_tasks_completed,
           (SELECT COUNT(*) FROM agent_corp_members WHERE corp_id = c.id) as member_count
    FROM agent_corps c
    ORDER BY c.reputation_score DESC
    LIMIT 20
  `;

  return rows.map((r) => ({
    name: r.name as string,
    ticker: r.ticker as string,
    reputationScore: r.reputation_score as number,
    totalTasksCompleted: r.total_tasks_completed as number,
    memberCount: Number(r.member_count),
  }));
}

// ============================================================================
// CORP TASK BOARD (real delegation logic for UI consumption)
// ============================================================================

export interface CorpBoardTask {
  title: string;
  description: string;
  posterAgentId: string;
  posterRole: CorpRole;
  workerAgentId: string;
  workerRole: CorpRole;
  capability: AgentCapability;
  category: string;
  rewardSol: number;
  status: "open" | "claimed" | "delivered" | "completed";
}

/**
 * Generate a realistic corp task board using the same delegation logic
 * the economy loop uses. Each member's role determines what they post,
 * and the worker is resolved via capability matching against other members.
 */
export function generateCorpTaskBoard(
  members: Array<{ agentId: string; role: CorpRole }>
): CorpBoardTask[] {
  const result: CorpBoardTask[] = [];
  const usedTitles = new Set<string>();

  for (const member of members) {
    // Use the real generateServiceTask to pick a task for this role
    // Try up to 5 times to avoid duplicate titles
    let task: ReturnType<typeof generateServiceTask> | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateServiceTask(member.role);
      if (!usedTitles.has(candidate.title)) {
        task = candidate;
        break;
      }
    }
    if (!task) continue;
    usedTitles.add(task.title);

    // Find the best worker: another member whose role capabilities
    // include this task's required capability (real ROLE_TASK_PREFERENCES logic)
    const candidates = members.filter((m) => {
      if (m.agentId === member.agentId) return false;
      const prefs = ROLE_TASK_PREFERENCES[m.role];
      return prefs.capabilities.includes(task!.capabilityRequired);
    });

    // If no capability match, fall back to any non-self member
    const workerPool =
      candidates.length > 0 ? candidates : members.filter((m) => m.agentId !== member.agentId);
    if (workerPool.length === 0) continue;

    const worker = workerPool[Math.floor(Math.random() * workerPool.length)];

    result.push({
      title: task.title,
      description: task.description,
      posterAgentId: member.agentId,
      posterRole: member.role,
      workerAgentId: worker.agentId,
      workerRole: worker.role,
      capability: task.capabilityRequired,
      category: task.category,
      rewardSol: task.rewardSol,
      // Realistic status distribution: CEO tasks more likely open (delegating),
      // member tasks more likely completed (executing)
      status: assignRealisticStatus(member.role),
    });
  }

  return result;
}

function assignRealisticStatus(posterRole: CorpRole): CorpBoardTask["status"] {
  const r = Math.random();
  if (posterRole === "ceo") {
    // CEO delegates → tasks tend to be in-progress or recently completed
    if (r < 0.3) return "open";
    if (r < 0.5) return "claimed";
    if (r < 0.7) return "delivered";
    return "completed";
  }
  if (posterRole === "member") {
    // Members execute → their posted tasks tend to complete faster
    if (r < 0.15) return "open";
    if (r < 0.3) return "claimed";
    return "completed";
  }
  // C-suite: balanced
  if (r < 0.2) return "open";
  if (r < 0.4) return "claimed";
  if (r < 0.6) return "delivered";
  return "completed";
}
