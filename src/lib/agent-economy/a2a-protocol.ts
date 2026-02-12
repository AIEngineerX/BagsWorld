// A2A Protocol - Structured agent-to-agent messaging
// DB-backed inbox with optional MoltBook DM bridge.
// Messages support task lifecycle (request/accept/reject/deliver/confirm),
// status updates, and pings.

import { neon } from "@neondatabase/serverless";
import type { A2AMessage, A2AMessageType } from "../types";

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

async function ensureA2ATable() {
  if (tableInitialized) return;
  const sql = getDb();

  await sql`
    CREATE TABLE IF NOT EXISTS a2a_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      from_wallet TEXT NOT NULL,
      to_wallet TEXT NOT NULL,
      message_type VARCHAR(50) NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}',
      task_id UUID,
      conversation_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at TIMESTAMPTZ
    )
  `;

  // Indexes for inbox queries and conversation lookups
  await sql`CREATE INDEX IF NOT EXISTS idx_a2a_messages_to_wallet ON a2a_messages (to_wallet, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_a2a_messages_conversation ON a2a_messages (conversation_id, created_at ASC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_a2a_messages_task ON a2a_messages (task_id)`;

  tableInitialized = true;
  console.log("[A2AProtocol] Table initialized");
}

// ============================================================================
// SEND MESSAGE
// ============================================================================

export interface SendMessageOptions {
  taskId?: string;
  conversationId?: string;
}

/**
 * Send a structured A2A message from one agent to another.
 * Returns the created message with its generated ID.
 */
export async function sendA2AMessage(
  fromWallet: string,
  toWallet: string,
  messageType: A2AMessageType,
  payload: Record<string, unknown> = {},
  options: SendMessageOptions = {}
): Promise<A2AMessage> {
  await ensureA2ATable();
  const sql = getDb();

  const { taskId, conversationId } = options;

  // Generate conversation ID if not provided (for new conversations)
  const convId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const rows = await sql`
    INSERT INTO a2a_messages (from_wallet, to_wallet, message_type, payload, task_id, conversation_id)
    VALUES (
      ${fromWallet},
      ${toWallet},
      ${messageType},
      ${JSON.stringify(payload)}::jsonb,
      ${taskId || null},
      ${convId}
    )
    RETURNING id, from_wallet, to_wallet, message_type, payload, task_id, conversation_id, created_at, read_at
  `;

  const row = rows[0];
  const message = rowToMessage(row);

  console.log(
    `[A2AProtocol] ${fromWallet.slice(0, 8)}... → ${toWallet.slice(0, 8)}...: ${messageType}`
  );

  return message;
}

// ============================================================================
// INBOX
// ============================================================================

export interface InboxOptions {
  unreadOnly?: boolean;
  messageType?: A2AMessageType;
  limit?: number;
  offset?: number;
}

/**
 * Get messages for a wallet (inbox).
 * Returns newest first by default.
 */
export async function getInbox(
  wallet: string,
  options: InboxOptions = {}
): Promise<{ messages: A2AMessage[]; total: number; unread: number }> {
  await ensureA2ATable();
  const sql = getDb();

  const { unreadOnly = false, messageType, limit = 50, offset = 0 } = options;

  // Count totals
  const countRows = await sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE read_at IS NULL) as unread
    FROM a2a_messages
    WHERE to_wallet = ${wallet}
  `;
  const total = parseInt(countRows[0].total as string, 10);
  const unread = parseInt(countRows[0].unread as string, 10);

  // Build query based on filters
  let rows;
  if (unreadOnly && messageType) {
    rows = await sql`
      SELECT * FROM a2a_messages
      WHERE to_wallet = ${wallet}
        AND read_at IS NULL
        AND message_type = ${messageType}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  } else if (unreadOnly) {
    rows = await sql`
      SELECT * FROM a2a_messages
      WHERE to_wallet = ${wallet}
        AND read_at IS NULL
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  } else if (messageType) {
    rows = await sql`
      SELECT * FROM a2a_messages
      WHERE to_wallet = ${wallet}
        AND message_type = ${messageType}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  } else {
    rows = await sql`
      SELECT * FROM a2a_messages
      WHERE to_wallet = ${wallet}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  return {
    messages: rows.map(rowToMessage),
    total,
    unread,
  };
}

// ============================================================================
// READ / MARK AS READ
// ============================================================================

/**
 * Mark a single message as read.
 */
export async function markAsRead(messageId: string): Promise<boolean> {
  await ensureA2ATable();
  const sql = getDb();

  const result = await sql`
    UPDATE a2a_messages
    SET read_at = NOW()
    WHERE id = ${messageId}::uuid AND read_at IS NULL
    RETURNING id
  `;

  return result.length > 0;
}

/**
 * Mark all unread messages for a wallet as read.
 */
export async function markAllAsRead(wallet: string): Promise<number> {
  await ensureA2ATable();
  const sql = getDb();

  const result = await sql`
    UPDATE a2a_messages
    SET read_at = NOW()
    WHERE to_wallet = ${wallet} AND read_at IS NULL
    RETURNING id
  `;

  return result.length;
}

// ============================================================================
// CONVERSATIONS
// ============================================================================

/**
 * Get all messages in a conversation (ordered chronologically).
 */
export async function getConversation(conversationId: string): Promise<A2AMessage[]> {
  await ensureA2ATable();
  const sql = getDb();

  const rows = await sql`
    SELECT * FROM a2a_messages
    WHERE conversation_id = ${conversationId}
    ORDER BY created_at ASC
  `;

  return rows.map(rowToMessage);
}

/**
 * Get messages related to a specific task.
 */
export async function getTaskMessages(taskId: string): Promise<A2AMessage[]> {
  await ensureA2ATable();
  const sql = getDb();

  const rows = await sql`
    SELECT * FROM a2a_messages
    WHERE task_id = ${taskId}::uuid
    ORDER BY created_at ASC
  `;

  return rows.map(rowToMessage);
}

// ============================================================================
// MOLTBOOK DM BRIDGE
// ============================================================================

// Prefix format for encoding A2A messages into MoltBook DMs
const A2A_DM_PREFIX = "A2A";
const A2A_DM_SEPARATOR = "|";

/**
 * Encode an A2A message for transport via MoltBook DM.
 * Format: A2A|{type}|{base64_payload}
 */
export function encodeForDM(messageType: A2AMessageType, payload: Record<string, unknown>): string {
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64");
  return `${A2A_DM_PREFIX}${A2A_DM_SEPARATOR}${messageType}${A2A_DM_SEPARATOR}${payloadStr}`;
}

/**
 * Decode an A2A message from a MoltBook DM.
 * Returns null if the message is not an A2A-encoded DM.
 */
export function decodeFromDM(
  dmContent: string
): { type: A2AMessageType; payload: Record<string, unknown> } | null {
  if (!dmContent.startsWith(A2A_DM_PREFIX + A2A_DM_SEPARATOR)) return null;

  const parts = dmContent.split(A2A_DM_SEPARATOR);
  if (parts.length < 3) return null;

  const type = parts[1] as A2AMessageType;
  const validTypes: A2AMessageType[] = [
    "task_request",
    "task_accept",
    "task_reject",
    "task_deliver",
    "task_confirm",
    "status_update",
    "ping",
  ];
  if (!validTypes.includes(type)) return null;

  const payloadB64 = parts.slice(2).join(A2A_DM_SEPARATOR); // Rejoin in case payload had separators
  const payload = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf-8"));

  return { type, payload };
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Remove read messages older than the specified age.
 * Keeps unread messages indefinitely.
 */
export async function cleanupOldMessages(maxAgeDays: number = 7): Promise<number> {
  await ensureA2ATable();
  const sql = getDb();

  const result = await sql`
    DELETE FROM a2a_messages
    WHERE read_at IS NOT NULL
      AND created_at < NOW() - INTERVAL '1 day' * ${maxAgeDays}
    RETURNING id
  `;

  if (result.length > 0) {
    console.log(`[A2AProtocol] Cleaned up ${result.length} old messages`);
  }

  return result.length;
}

// ============================================================================
// HELPERS
// ============================================================================

function rowToMessage(row: any): A2AMessage {
  return {
    id: row.id,
    type: row.message_type as A2AMessageType,
    fromWallet: row.from_wallet,
    toWallet: row.to_wallet,
    payload: row.payload || {},
    taskId: row.task_id || undefined,
    conversationId: row.conversation_id || undefined,
    createdAt: new Date(row.created_at).toISOString(),
    readAt: row.read_at ? new Date(row.read_at).toISOString() : undefined,
  };
}
