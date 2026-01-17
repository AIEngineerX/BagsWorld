import { NextResponse } from "next/server";
import { generateDailyReport, generateReportPreview } from "@/lib/daily-report";

interface ReportRequestBody {
  action: "preview" | "post";
}

// Verify authorization
function isAuthorized(request: Request): boolean {
  const authHeader = request.headers.get("Authorization");
  const agentSecret = process.env.AGENT_SECRET;

  if (!agentSecret) {
    return true; // Allow in dev
  }

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    return token === agentSecret;
  }

  return false;
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: ReportRequestBody = await request.json();
    const { action } = body;

    switch (action) {
      case "preview":
        return handlePreview();

      case "post":
        return handlePost();

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Report API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process request" },
      { status: 500 }
    );
  }
}

async function handlePreview(): Promise<NextResponse> {
  const preview = await generateReportPreview();

  return NextResponse.json({
    success: true,
    preview,
  });
}

async function handlePost(): Promise<NextResponse> {
  const result = await generateDailyReport(true);

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: result.error,
        tweets: result.tweets,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    report: result.report,
    tweets: result.tweets,
    tweetIds: result.tweetIds,
  });
}

// GET endpoint for simple preview
export async function GET() {
  const preview = await generateReportPreview();

  return NextResponse.json({
    preview,
    note: "Use POST with action:'post' to publish to X",
  });
}
