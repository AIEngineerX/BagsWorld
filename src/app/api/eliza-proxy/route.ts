// Server-side proxy for ElizaOS agent server
// Avoids CORS issues when the client fetches from a different origin (e.g. Railway)

import { NextRequest, NextResponse } from "next/server";

const AGENTS_API_URL = process.env.AGENTS_API_URL || "http://localhost:3001";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint");

  if (!endpoint) {
    return NextResponse.json({ error: "Missing endpoint parameter" }, { status: 400 });
  }

  // Whitelist allowed endpoints
  const allowed = ["/health", "/api/coordination/statuses", "/api/coordination/shared-context"];
  if (!allowed.includes(endpoint)) {
    return NextResponse.json({ error: "Endpoint not allowed" }, { status: 403 });
  }

  try {
    const response = await fetch(`${AGENTS_API_URL}${endpoint}`, {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    // Server unreachable — return appropriate fallback
    if (endpoint === "/health") {
      return NextResponse.json({ status: "unreachable" });
    }
    if (endpoint === "/api/coordination/statuses") {
      return NextResponse.json({ success: false, agents: [], count: 0, online: 0 });
    }
    return NextResponse.json({ error: "Agent server unreachable" }, { status: 503 });
  }
}
