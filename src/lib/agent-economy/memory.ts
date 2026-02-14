import { neon } from "@neondatabase/serverless";

function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL not configured");
  }
  return neon(connectionString);
}

let tableInitialized = false;

async function ensureMemoryTable() {
  if (tableInitialized) return;
  const sql = getDb();

  await sql`
    CREATE TABLE IF NOT EXISTS agent_memory (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      agent_id TEXT NOT NULL,
      memory_type VARCHAR(30) NOT NULL,
      capability VARCHAR(50),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_agent_memory_agent ON agent_memory (agent_id, capability, created_at DESC)`;

  tableInitialized = true;
  console.log("[Memory] Table initialized");
}

export async function storeMemory(opts: {
  agentId: string;
  memoryType: "task_result" | "observation" | "learning";
  capability: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  ttlDays?: number;
}): Promise<void> {
  await ensureMemoryTable();
  const sql = getDb();

  const ttlDays = opts.ttlDays ?? 30;

  await sql`
    INSERT INTO agent_memory (agent_id, memory_type, capability, title, content, metadata, expires_at)
    VALUES (
      ${opts.agentId},
      ${opts.memoryType},
      ${opts.capability},
      ${opts.title.slice(0, 200)},
      ${opts.content.slice(0, 2000)},
      ${opts.metadata ? JSON.stringify(opts.metadata) : null}::jsonb,
      NOW() + INTERVAL '1 day' * ${ttlDays}
    )
  `;

  console.log(`[Memory] Stored ${opts.memoryType} for ${opts.agentId}: "${opts.title}"`);
}

export async function recallMemories(opts: {
  agentId: string;
  capability?: string;
  limit?: number;
}): Promise<Array<{ title: string; content: string; createdAt: string }>> {
  await ensureMemoryTable();
  const sql = getDb();

  const limit = opts.limit ?? 5;

  const rows = opts.capability
    ? await sql`
        SELECT title, content, created_at FROM agent_memory
        WHERE agent_id = ${opts.agentId}
          AND capability = ${opts.capability}
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    : await sql`
        SELECT title, content, created_at FROM agent_memory
        WHERE agent_id = ${opts.agentId}
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;

  return rows.map((r) => ({
    title: String(r.title),
    content: String(r.content),
    createdAt:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : new Date(String(r.created_at)).toISOString(),
  }));
}

export function getTimeAgo(isoDate: string): string {
  const timestamp = new Date(isoDate).getTime();
  if (isNaN(timestamp)) return "unknown";
  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) return "just now";
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export async function cleanupExpiredMemories(): Promise<number> {
  await ensureMemoryTable();
  const sql = getDb();

  const result = await sql`
    DELETE FROM agent_memory
    WHERE expires_at IS NOT NULL AND expires_at <= NOW()
    RETURNING id
  `;

  if (result.length > 0) {
    console.log(`[Memory] Cleaned up ${result.length} expired memories`);
  }

  return result.length;
}
