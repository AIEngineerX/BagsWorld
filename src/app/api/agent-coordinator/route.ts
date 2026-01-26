import { NextResponse } from "next/server";
import {
  startCoordinator,
  stopCoordinator,
  getCoordinatorState,
  getRecentEvents,
  getEventStats,
  emitEvent,
  subscribe,
  type AgentEventType,
  type AgentSource,
  type EventPriority,
  type AgentEvent,
} from "@/lib/agent-coordinator";
import { connectToCoordinator as connectAIAgent } from "@/lib/ai-agent";
import {
  isNeonConfigured,
  getRecentEmittedEvents,
  initializeAgentFeedTables,
} from "@/lib/neon";
import {
  startLiveFeed,
  stopLiveFeed,
  getLiveFeedState,
} from "@/lib/bags-live-feed";

// 24 hour TTL for events
const EVENT_TTL_MS = 24 * 60 * 60 * 1000;

// ============================================================================
// ANNOUNCEMENT QUEUE
// ============================================================================

// Queue of announcements to be displayed in the game
let announcementQueue: Array<{
  id: string;
  message: string;
  priority: EventPriority;
  timestamp: number;
  eventType: AgentEventType;
  read: boolean;
}> = [];

const MAX_ANNOUNCEMENTS = 50;

// Subscribe to events and generate announcements
let announcementSubscription: (() => void) | null = null;

function addEventToAnnouncements(event: AgentEvent): void {
  if (!event.announcement) return;

  // Don't add if already in queue
  if (announcementQueue.some((a) => a.id === event.id)) return;

  announcementQueue.unshift({
    id: event.id,
    message: event.announcement,
    priority: event.priority,
    timestamp: event.timestamp,
    eventType: event.type,
    read: false,
  });

  // Trim queue
  if (announcementQueue.length > MAX_ANNOUNCEMENTS) {
    announcementQueue = announcementQueue.slice(0, MAX_ANNOUNCEMENTS);
  }
}

function initAnnouncementHandler(): void {
  if (announcementSubscription) return;

  // First, replay any existing events to the announcement queue
  const existingEvents = getRecentEvents(MAX_ANNOUNCEMENTS);
  const mediumHighUrgent = ["medium", "high", "urgent"];

  for (const event of existingEvents) {
    if (mediumHighUrgent.includes(event.priority)) {
      addEventToAnnouncements(event);
    }
  }

  // Then subscribe to future events
  announcementSubscription = subscribe(
    "*", // Subscribe to all events
    (event: AgentEvent) => {
      addEventToAnnouncements(event);
    },
    ["medium", "high", "urgent"] // Only announce important events
  );

  console.log(
    "[Agent Coordinator API] Announcement handler initialized with",
    existingEvents.length,
    "existing events"
  );
}

// ============================================================================
// API HANDLERS
// ============================================================================

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "status";

  switch (action) {
    case "status": {
      const state = getCoordinatorState();
      const liveFeedState = getLiveFeedState();
      return NextResponse.json({
        isRunning: state.isRunning,
        stats: state.stats,
        subscriptionCount: state.subscriptions.length,
        queueSize: state.eventQueue.length,
        liveFeed: {
          isRunning: liveFeedState.isRunning,
          launchesFound: liveFeedState.launchesFound,
          tradesFound: liveFeedState.tradesFound,
          whaleAlertsFound: liveFeedState.whaleAlertsFound,
          lastLaunchCheck: liveFeedState.lastLaunchCheck,
          errors: liveFeedState.errors.slice(-5),
        },
      });
    }

    case "events": {
      const count = parseInt(searchParams.get("count") || "20");
      const type = searchParams.get("type") as AgentEventType | undefined;
      const events = getRecentEvents(count, type);
      return NextResponse.json({ events });
    }

    case "stats": {
      const stats = getEventStats();
      return NextResponse.json({ stats });
    }

    case "announcements": {
      const unreadOnly = searchParams.get("unread") === "true";
      const count = parseInt(searchParams.get("count") || "10");
      const cutoff = Date.now() - EVENT_TTL_MS;

      // Filter out old events first
      let announcements = announcementQueue.filter((a) => a.timestamp > cutoff);

      if (unreadOnly) {
        announcements = announcements.filter((a) => !a.read);
      }

      announcements = announcements.slice(0, count);

      return NextResponse.json({
        announcements,
        totalUnread: announcementQueue.filter((a) => !a.read && a.timestamp > cutoff).length,
      });
    }

    case "poll": {
      // Long-poll for new announcements (for game client)
      const since = parseInt(searchParams.get("since") || "0");
      const cutoff = Date.now() - EVENT_TTL_MS;

      // Filter: newer than 'since', not read, and not older than 24 hours
      const newAnnouncements = announcementQueue.filter(
        (a) => a.timestamp > since && !a.read && a.timestamp > cutoff
      );

      return NextResponse.json({
        announcements: newAnnouncements,
        lastTimestamp: newAnnouncements[0]?.timestamp || since,
      });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "start": {
        startCoordinator();
        initAnnouncementHandler();
        connectAIAgent();
        startLiveFeed(); // Start platform-wide Bags.fm monitoring
        return NextResponse.json({ success: true, message: "Coordinator started with live feed" });
      }

      case "stop": {
        stopCoordinator();
        stopLiveFeed();
        return NextResponse.json({ success: true, message: "Coordinator and live feed stopped" });
      }

      case "emit": {
        const { type, source, data, priority } = body as {
          type: AgentEventType;
          source: AgentSource;
          data: Record<string, unknown>;
          priority?: EventPriority;
        };

        if (!type || !source || !data) {
          return NextResponse.json({ error: "Missing type, source, or data" }, { status: 400 });
        }

        const event = await emitEvent(type, source, data, priority || "medium");
        return NextResponse.json({ success: true, event });
      }

      case "mark_read": {
        const { ids } = body as { ids: string[] };
        if (!ids || !Array.isArray(ids)) {
          return NextResponse.json({ error: "Missing ids array" }, { status: 400 });
        }

        let markedCount = 0;
        for (const id of ids) {
          const announcement = announcementQueue.find((a) => a.id === id);
          if (announcement) {
            announcement.read = true;
            markedCount++;
          }
        }

        return NextResponse.json({ success: true, markedCount });
      }

      case "clear_announcements": {
        announcementQueue = [];
        return NextResponse.json({ success: true, message: "Announcements cleared" });
      }

      case "test_event": {
        // Emit a test event for development
        const testEvent = await emitEvent(
          "system",
          "manual",
          { message: "Test event from API" },
          "medium"
        );
        return NextResponse.json({ success: true, event: testEvent });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[Agent Coordinator API] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Auto-initialize on first request
let initialized = false;
async function initializeCoordinator(): Promise<void> {
  if (initialized) return;
  initialized = true;

  startCoordinator();
  initAnnouncementHandler();
  connectAIAgent();
  startLiveFeed(); // Start platform-wide Bags.fm monitoring

  // Load recent events from database on cold start
  if (isNeonConfigured()) {
    try {
      await initializeAgentFeedTables();
      const recentEvents = await getRecentEmittedEvents(24);

      // Populate announcement queue with database events
      for (const event of recentEvents) {
        const exists = announcementQueue.some((a) => a.id === event.id);
        if (!exists) {
          announcementQueue.push({
            id: event.id,
            message: event.message,
            priority: event.priority as EventPriority,
            timestamp: new Date(event.emitted_at).getTime(),
            eventType: event.event_type as AgentEventType,
            read: true, // Mark as read since they're historical
          });
        }
      }

      // Sort by timestamp (newest first)
      announcementQueue.sort((a, b) => b.timestamp - a.timestamp);

      // Trim to max size
      if (announcementQueue.length > MAX_ANNOUNCEMENTS) {
        announcementQueue = announcementQueue.slice(0, MAX_ANNOUNCEMENTS);
      }

      console.log(`[Agent Coordinator API] Loaded ${recentEvents.length} events from database`);
    } catch (error) {
      console.error("[Agent Coordinator API] Failed to load events from database:", error);
    }
  }

  console.log("[Agent Coordinator API] Auto-initialized");
}

// Clean up old announcements from the queue (call periodically)
function cleanupOldAnnouncements(): void {
  const cutoff = Date.now() - EVENT_TTL_MS;
  announcementQueue = announcementQueue.filter((a) => a.timestamp > cutoff);
}

// Initialize when this module loads on the server
if (typeof window === "undefined") {
  initializeCoordinator();

  // Set up periodic cleanup
  setInterval(cleanupOldAnnouncements, 5 * 60 * 1000); // Every 5 minutes
}
