// One-time migration endpoint to move external agents to Moltbook Beach
import { NextResponse } from "next/server";

function isNeonConfigured(): boolean {
  return !!process.env.NETLIFY || !!process.env.DATABASE_URL;
}

function getNeonSQL() {
  if (process.env.NETLIFY) {
    const moduleName = "@netlify/neon";
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { neon } = require(moduleName);
    return neon();
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { neon } = require("@neondatabase/serverless");
  return neon(process.env.DATABASE_URL!);
}

export async function GET() {
  if (!isNeonConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const sql = getNeonSQL();

    // Scale factor and ground level must match WorldScene
    const SCALE = 1.6;
    const GROUND_Y = Math.round(550 * SCALE); // 880
    const Y_VARIATION = Math.round(15 * SCALE); // 24

    // Get current state
    const currentAgents = await sql`SELECT wallet, name, zone, x, y FROM external_agents`;

    // Get all external agents not in moltbook zone OR with bad Y positions
    const agentsToMigrate = await sql`
      SELECT wallet, name, zone, y FROM external_agents
      WHERE zone != 'moltbook' OR y < ${GROUND_Y - 50}
    `;

    let migrated = 0;
    const results: string[] = [];

    for (const agent of agentsToMigrate) {
      // Random X position for moltbook zone (200-500 * SCALE)
      const newX = Math.round((200 + Math.random() * 300) * SCALE);
      // Y at ground level with slight variation
      const newY = GROUND_Y + Math.random() * Y_VARIATION;

      await sql`
        UPDATE external_agents
        SET zone = 'moltbook', x = ${newX}, y = ${newY}
        WHERE wallet = ${agent.wallet}
      `;
      migrated++;
      results.push(`${agent.name}: ${agent.zone}(${agent.y}) -> moltbook(${Math.round(newY)})`);
    }

    // Also fix any agents with incorrect Y positions (floating agents)
    const floatingAgents = await sql`
      SELECT wallet, name, y FROM external_agents
      WHERE zone = 'moltbook' AND (y < ${GROUND_Y - 50} OR y > ${GROUND_Y + Y_VARIATION + 10})
    `;

    for (const agent of floatingAgents) {
      const newY = GROUND_Y + Math.random() * Y_VARIATION;
      await sql`
        UPDATE external_agents SET y = ${newY}
        WHERE wallet = ${agent.wallet}
      `;
      results.push(`Fixed Y: ${agent.name}: ${agent.y} -> ${Math.round(newY)}`);
    }

    // Get updated state
    const updatedAgents = await sql`SELECT wallet, name, zone, x, y FROM external_agents`;

    return NextResponse.json({
      success: true,
      migrated,
      fixedYPositions: floatingAgents.length,
      before: currentAgents,
      after: updatedAgents,
      changes: results,
      message: `Migrated ${migrated} agents to moltbook zone. Fixed ${floatingAgents.length} Y positions.`,
    });
  } catch (error) {
    console.error("Migrate agents error:", error);
    return NextResponse.json(
      {
        error: "Failed to migrate agents",
        details: String(error),
      },
      { status: 500 }
    );
  }
}
