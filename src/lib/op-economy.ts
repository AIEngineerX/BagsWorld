// Oracle Points (OP) virtual credit economy
// OP cannot be bought or converted to real money - earned through free gameplay

import { getSql } from "./neon";
import type {
  OracleUser,
  OracleOPLedgerEntry,
  OracleReputationTier,
  OracleOPTxType,
} from "./types";

// Shorthand: cast first row from query result
function firstRow(rows: unknown[]): Record<string, unknown> {
  return rows[0] as Record<string, unknown>;
}

// Parse achievements JSONB from a DB row value
function parseAchievements(val: unknown): Record<string, unknown> {
  if (typeof val === "string") return JSON.parse(val);
  return (val as Record<string, unknown>) ?? {};
}

// Map a database row to OracleUser
function rowToUser(row: Record<string, unknown>): OracleUser {
  return {
    wallet: String(row.wallet),
    opBalance: Number(row.op_balance ?? 1000),
    totalOpEarned: Number(row.total_op_earned ?? 0),
    totalOpSpent: Number(row.total_op_spent ?? 0),
    firstPredictionBonus: Boolean(row.first_prediction_bonus),
    lastDailyClaim: row.last_daily_claim ? String(row.last_daily_claim) : undefined,
    currentStreak: Number(row.current_streak ?? 0),
    bestStreak: Number(row.best_streak ?? 0),
    dailyClaimStreak: Number(row.daily_claim_streak ?? 0),
    bestDailyStreak: Number(row.best_daily_streak ?? 0),
    reputationScore: Number(row.reputation_score ?? 1000),
    reputationTier: String(row.reputation_tier ?? "novice") as OracleReputationTier,
    totalMarketsEntered: Number(row.total_markets_entered ?? 0),
    totalMarketsWon: Number(row.total_markets_won ?? 0),
    achievements: parseAchievements(row.achievements) as Record<
      string,
      { unlockedAt: string; opAwarded: number }
    >,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

// Map a database row to OracleOPLedgerEntry
function rowToLedgerEntry(row: Record<string, unknown>): OracleOPLedgerEntry {
  return {
    id: Number(row.id),
    wallet: String(row.wallet),
    amount: Number(row.amount),
    balanceAfter: Number(row.balance_after),
    txType: String(row.tx_type) as OracleOPTxType,
    referenceId: row.reference_id != null ? Number(row.reference_id) : undefined,
    createdAt: String(row.created_at),
  };
}

export async function getOrCreateUser(wallet: string): Promise<OracleUser | null> {
  const sql = await getSql();
  if (!sql) return null;

  try {
    const rows = await sql`SELECT * FROM oracle_users WHERE wallet = ${wallet}`;
    if (rows.length > 0) {
      return rowToUser(firstRow(rows));
    }

    // Create new user with 1000 OP signup bonus
    const inserted = await sql`
      INSERT INTO oracle_users (wallet, op_balance, total_op_earned)
      VALUES (${wallet}, 1000, 1000)
      RETURNING *
    `;

    // Record signup bonus in ledger
    const newBalance = 1000;
    await sql`
      INSERT INTO oracle_op_ledger (wallet, amount, balance_after, tx_type)
      VALUES (${wallet}, 1000, ${newBalance}, 'signup_bonus')
    `;

    return rowToUser(firstRow(inserted));
  } catch (error) {
    console.error("[OP Economy] getOrCreateUser error:", error);
    return null;
  }
}

export async function addOP(
  wallet: string,
  amount: number,
  txType: OracleOPTxType,
  referenceId?: number
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  const sql = await getSql();
  if (!sql) return { success: false, error: "Database not available" };

  try {
    const updated = await sql`
      UPDATE oracle_users
      SET op_balance = op_balance + ${amount},
          total_op_earned = total_op_earned + ${amount}
      WHERE wallet = ${wallet}
      RETURNING op_balance
    `;

    if (updated.length === 0) {
      return { success: false, error: "User not found" };
    }

    const newBalance = Number(firstRow(updated).op_balance);

    await sql`
      INSERT INTO oracle_op_ledger (wallet, amount, balance_after, tx_type, reference_id)
      VALUES (${wallet}, ${amount}, ${newBalance}, ${txType}, ${referenceId ?? null})
    `;

    return { success: true, newBalance };
  } catch (error) {
    console.error("[OP Economy] addOP error:", error);
    return { success: false, error: "Database error" };
  }
}

export async function deductOP(
  wallet: string,
  amount: number,
  txType: OracleOPTxType,
  referenceId?: number
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  const sql = await getSql();
  if (!sql) return { success: false, error: "Database not available" };

  try {
    // Atomic balance check + deduction in a single query
    const updated = await sql`
      UPDATE oracle_users
      SET op_balance = op_balance - ${amount},
          total_op_spent = total_op_spent + ${amount}
      WHERE wallet = ${wallet} AND op_balance >= ${amount}
      RETURNING op_balance
    `;

    if (updated.length === 0) {
      // Distinguish "user not found" from "insufficient balance"
      const exists = await sql`SELECT 1 FROM oracle_users WHERE wallet = ${wallet}`;
      return {
        success: false,
        error: exists.length === 0 ? "User not found" : "Insufficient OP balance",
      };
    }

    const newBalance = Number(firstRow(updated).op_balance);

    await sql`
      INSERT INTO oracle_op_ledger (wallet, amount, balance_after, tx_type, reference_id)
      VALUES (${wallet}, ${-amount}, ${newBalance}, ${txType}, ${referenceId ?? null})
    `;

    return { success: true, newBalance };
  } catch (error) {
    console.error("[OP Economy] deductOP error:", error);
    return { success: false, error: "Database error" };
  }
}

export async function claimDailyBonus(wallet: string): Promise<{
  success: boolean;
  amount?: number;
  newBalance?: number;
  nextClaimAt?: string;
  error?: string;
}> {
  const sql = await getSql();
  if (!sql) return { success: false, error: "Database not available" };

  try {
    const user = await getOrCreateUser(wallet);
    if (!user) return { success: false, error: "Could not load user" };

    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const THIRTY_SIX_HOURS = 36 * 60 * 60 * 1000;

    if (user.lastDailyClaim) {
      const lastClaim = new Date(user.lastDailyClaim).getTime();
      if (now - lastClaim < TWENTY_FOUR_HOURS) {
        const nextClaimAt = new Date(lastClaim + TWENTY_FOUR_HOURS).toISOString();
        return { success: false, error: "Daily bonus already claimed", nextClaimAt };
      }
    }

    // Calculate daily claim streak (separate from prediction win streak)
    let newDailyStreak = 1;
    if (user.lastDailyClaim) {
      const lastClaim = new Date(user.lastDailyClaim).getTime();
      const timeSinceLast = now - lastClaim;
      if (timeSinceLast <= THIRTY_SIX_HOURS) {
        // Within the streak window (claimed yesterday)
        newDailyStreak = user.dailyClaimStreak + 1;
      }
    }

    const newBestDailyStreak = Math.max(newDailyStreak, user.bestDailyStreak);

    // Base award: 50 OP, with 10% streak bonus at 3+ days
    let amount = 50;
    if (newDailyStreak >= 3) {
      amount += 5; // 10% bonus
    }

    const updated = await sql`
      UPDATE oracle_users
      SET op_balance = op_balance + ${amount},
          total_op_earned = total_op_earned + ${amount},
          last_daily_claim = NOW(),
          daily_claim_streak = ${newDailyStreak},
          best_daily_streak = ${newBestDailyStreak}
      WHERE wallet = ${wallet}
      RETURNING op_balance, achievements
    `;

    const newBalance = Number(firstRow(updated).op_balance);
    const achievements = parseAchievements(firstRow(updated).achievements);

    await sql`
      INSERT INTO oracle_op_ledger (wallet, amount, balance_after, tx_type)
      VALUES (${wallet}, ${amount}, ${newBalance}, 'daily_claim')
    `;

    // Check Daily Devotion achievement (7-day daily claim streak)
    if (newDailyStreak >= 7) {
      await checkAndAwardAchievement(wallet, "daily_devotion", 150, achievements);
    }

    return { success: true, amount, newBalance };
  } catch (error) {
    console.error("[OP Economy] claimDailyBonus error:", error);
    return { success: false, error: "Database error" };
  }
}

export async function claimFirstPredictionBonus(
  wallet: string
): Promise<{ success: boolean; amount?: number; error?: string }> {
  const sql = await getSql();
  if (!sql) return { success: false, error: "Database not available" };

  try {
    const user = await getOrCreateUser(wallet);
    if (!user) return { success: false, error: "Could not load user" };

    if (user.firstPredictionBonus) {
      return { success: false, error: "First prediction bonus already claimed" };
    }

    const amount = 100;

    const updated = await sql`
      UPDATE oracle_users
      SET op_balance = op_balance + ${amount},
          total_op_earned = total_op_earned + ${amount},
          first_prediction_bonus = TRUE
      WHERE wallet = ${wallet}
      RETURNING op_balance
    `;

    const newBalance = Number(firstRow(updated).op_balance);

    await sql`
      INSERT INTO oracle_op_ledger (wallet, amount, balance_after, tx_type)
      VALUES (${wallet}, ${amount}, ${newBalance}, 'achievement')
    `;

    return { success: true, amount };
  } catch (error) {
    console.error("[OP Economy] claimFirstPredictionBonus error:", error);
    return { success: false, error: "Database error" };
  }
}

export async function updateStreak(wallet: string, won: boolean): Promise<void> {
  const sql = await getSql();
  if (!sql) return;

  try {
    // Get current user state
    const rows = await sql`
      SELECT current_streak, best_streak, total_markets_entered, total_markets_won, achievements
      FROM oracle_users WHERE wallet = ${wallet}
    `;
    if (rows.length === 0) return;

    const row = firstRow(rows);
    let currentStreak = Number(row.current_streak ?? 0);
    let bestStreak = Number(row.best_streak ?? 0);
    const totalEntered = Number(row.total_markets_entered ?? 0) + 1;
    const totalWon = Number(row.total_markets_won ?? 0) + (won ? 1 : 0);
    const achievements = parseAchievements(row.achievements);

    if (won) {
      currentStreak += 1;
      if (currentStreak > bestStreak) {
        bestStreak = currentStreak;
      }
    } else {
      currentStreak = 0;
    }

    await sql`
      UPDATE oracle_users
      SET current_streak = ${currentStreak},
          best_streak = ${bestStreak},
          total_markets_entered = ${totalEntered},
          total_markets_won = ${totalWon}
      WHERE wallet = ${wallet}
    `;

    // Check achievements
    if (won && totalWon === 1) {
      await checkAndAwardAchievement(wallet, "first_victory", 100, achievements);
    }
    if (currentStreak === 5) {
      await checkAndAwardAchievement(wallet, "hot_streak", 250, achievements);
    }
    if (currentStreak === 10) {
      await checkAndAwardAchievement(wallet, "oracle_vision", 500, achievements);
    }
    if (totalEntered === 50) {
      await checkAndAwardAchievement(wallet, "market_maker", 300, achievements);
    }
  } catch (error) {
    console.error("[OP Economy] updateStreak error:", error);
  }
}

export async function updateReputation(
  wallet: string,
  won: boolean,
  marketDifficulty?: number
): Promise<void> {
  const sql = await getSql();
  if (!sql) return;

  try {
    const rows = await sql`SELECT reputation_score FROM oracle_users WHERE wallet = ${wallet}`;
    if (rows.length === 0) return;

    const currentRating = Number(firstRow(rows).reputation_score ?? 1000);
    const K = 32;
    const difficulty = marketDifficulty || 1;
    const expected = 1 / (1 + Math.pow(10, (1000 - currentRating) / 400));
    const actual = won ? 1 : 0;
    const change = Math.round(K * difficulty * (actual - expected));
    const newRating = Math.max(0, currentRating + change);

    let tier: OracleReputationTier;
    if (newRating >= 2000) {
      tier = "master";
    } else if (newRating >= 1500) {
      tier = "oracle";
    } else if (newRating >= 1000) {
      tier = "seer";
    } else {
      tier = "novice";
    }

    await sql`
      UPDATE oracle_users
      SET reputation_score = ${newRating},
          reputation_tier = ${tier}
      WHERE wallet = ${wallet}
    `;
  } catch (error) {
    console.error("[OP Economy] updateReputation error:", error);
  }
}

export async function getProfile(wallet: string): Promise<OracleUser | null> {
  const sql = await getSql();
  if (!sql) return null;

  try {
    const rows = await sql`SELECT * FROM oracle_users WHERE wallet = ${wallet}`;
    if (rows.length === 0) return null;
    return rowToUser(firstRow(rows));
  } catch (error) {
    console.error("[OP Economy] getProfile error:", error);
    return null;
  }
}

export async function getOPLedger(
  wallet: string,
  limit: number = 20
): Promise<OracleOPLedgerEntry[]> {
  const sql = await getSql();
  if (!sql) return [];

  try {
    const rows = await sql`
      SELECT * FROM oracle_op_ledger
      WHERE wallet = ${wallet}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return rows.map((row) => rowToLedgerEntry(row as Record<string, unknown>));
  } catch (error) {
    console.error("[OP Economy] getOPLedger error:", error);
    return [];
  }
}

export function getReputationTierBonus(tier: OracleReputationTier): number {
  switch (tier) {
    case "master":
      return 0.3;
    case "oracle":
      return 0.2;
    case "seer":
      return 0.1;
    case "novice":
    default:
      return 0;
  }
}

export async function checkAndAwardAchievement(
  wallet: string,
  achievementId: string,
  opAward: number,
  achievements: Record<string, unknown>
): Promise<boolean> {
  if (achievements[achievementId]) {
    return false; // Already awarded
  }

  const sql = await getSql();
  if (!sql) return false;

  try {
    const achievementData = {
      unlockedAt: new Date().toISOString(),
      opAwarded: opAward,
    };

    // Update achievements JSONB and award OP
    const updated = await sql`
      UPDATE oracle_users
      SET achievements = jsonb_set(
            COALESCE(achievements, '{}')::jsonb,
            ${`{${achievementId}}`}::text[],
            ${JSON.stringify(achievementData)}::jsonb
          ),
          op_balance = op_balance + ${opAward},
          total_op_earned = total_op_earned + ${opAward}
      WHERE wallet = ${wallet}
      RETURNING op_balance
    `;

    if (updated.length > 0) {
      const newBalance = Number(firstRow(updated).op_balance);

      await sql`
        INSERT INTO oracle_op_ledger (wallet, amount, balance_after, tx_type)
        VALUES (${wallet}, ${opAward}, ${newBalance}, 'achievement')
      `;

      return true;
    }

    return false;
  } catch (error) {
    console.error("[OP Economy] checkAndAwardAchievement error:", error);
    return false;
  }
}
