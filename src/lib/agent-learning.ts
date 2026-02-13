/**
 * Agent Learning System
 * Self-learning module that tracks what works and adapts behavior
 *
 * Tracks:
 * - Which post types get the most karma
 * - Which reply styles get upvoted
 * - Best times to post
 * - Which submolts perform best
 * - What content resonates
 */

// ============================================================================
// LEARNING STATE (in-memory, persists during runtime)
// ============================================================================

interface PostPerformance {
  id: string;
  type: string;
  submolt: string;
  title: string;
  postedAt: number;
  hourOfDay: number;
  upvotes: number;
  comments: number;
  lastChecked: number;
}

interface EngagementPerformance {
  type: "comment" | "reply" | "upvote";
  targetPostKarma: number;
  templateUsed: string;
  resultedInUpvote: boolean;
  timestamp: number;
}

interface LearningState {
  // Post performance tracking
  posts: PostPerformance[];

  // Engagement tracking
  engagements: EngagementPerformance[];

  // Learned insights
  insights: {
    bestPostTypes: string[];
    bestHoursToPost: number[];
    bestSubmolts: string[];
    bestReplyStyles: string[];
    avgUpvotesPerPost: number;
    avgCommentsPerPost: number;
  };

  // Adaptive settings
  adaptiveConfig: {
    preferredPostTypes: Record<string, number>; // type -> weight
    preferredHours: Record<number, number>; // hour -> weight
    preferredSubmolts: Record<string, number>; // submolt -> weight
  };

  lastAnalysis: number;
}

const learningState: LearningState = {
  posts: [],
  engagements: [],
  insights: {
    bestPostTypes: ["new_launch", "volume_spike", "top_earner"],
    bestHoursToPost: [9, 12, 15, 18, 21], // Default: spread through day
    bestSubmolts: ["general", "crypto", "crustafarianism"],
    bestReplyStyles: ["supportive", "addValue"],
    avgUpvotesPerPost: 0,
    avgCommentsPerPost: 0,
  },
  adaptiveConfig: {
    preferredPostTypes: {
      new_launch: 1.0,
      volume_spike: 1.0,
      top_earner: 1.0,
      whale_claim: 0.8,
      trending: 0.7,
    },
    preferredHours: {},
    preferredSubmolts: {
      general: 1.2, // Higher visibility
      crypto: 1.0,
      crustafarianism: 0.9,
    },
  },
  lastAnalysis: 0,
};

// ============================================================================
// TRACKING FUNCTIONS
// ============================================================================

/**
 * Track a new post for performance analysis
 */
export function trackPost(post: {
  id: string;
  type: string;
  submolt: string;
  title: string;
}): void {
  const now = Date.now();
  const hour = new Date().getHours();

  learningState.posts.push({
    ...post,
    postedAt: now,
    hourOfDay: hour,
    upvotes: 0,
    comments: 0,
    lastChecked: now,
  });

  // Keep last 100 posts
  if (learningState.posts.length > 100) {
    learningState.posts = learningState.posts.slice(-100);
  }

  console.log(`[Learning] Tracking post: ${post.type} in ${post.submolt}`);
}

/**
 * Update post performance (call periodically to check karma)
 */
export function updatePostPerformance(postId: string, upvotes: number, comments: number): void {
  const post = learningState.posts.find((p) => p.id === postId);
  if (post) {
    post.upvotes = upvotes;
    post.comments = comments;
    post.lastChecked = Date.now();
  }
}

/**
 * Track an engagement action
 */
export function trackEngagement(engagement: {
  type: "comment" | "reply" | "upvote";
  targetPostKarma: number;
  templateUsed: string;
  resultedInUpvote?: boolean;
}): void {
  learningState.engagements.push({
    ...engagement,
    resultedInUpvote: engagement.resultedInUpvote || false,
    timestamp: Date.now(),
  });

  // Keep last 500 engagements
  if (learningState.engagements.length > 500) {
    learningState.engagements = learningState.engagements.slice(-500);
  }
}

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Analyze performance and update insights
 */
export function analyzePerformance(): void {
  const now = Date.now();

  // Only analyze every 30 minutes
  if (now - learningState.lastAnalysis < 30 * 60 * 1000) {
    return;
  }

  learningState.lastAnalysis = now;

  const posts = learningState.posts.filter((p) => p.upvotes > 0 || p.comments > 0);

  if (posts.length < 5) {
    console.log("[Learning] Not enough data yet for analysis");
    return;
  }

  // Analyze best post types
  const typePerformance: Record<string, { total: number; count: number }> = {};
  posts.forEach((p) => {
    if (!typePerformance[p.type]) {
      typePerformance[p.type] = { total: 0, count: 0 };
    }
    typePerformance[p.type].total += p.upvotes + p.comments * 2; // Comments worth 2x
    typePerformance[p.type].count++;
  });

  const sortedTypes = Object.entries(typePerformance)
    .map(([type, data]) => ({ type, avg: data.total / data.count }))
    .sort((a, b) => b.avg - a.avg);

  learningState.insights.bestPostTypes = sortedTypes.slice(0, 3).map((t) => t.type);

  // Update adaptive weights for post types
  sortedTypes.forEach((t, i) => {
    learningState.adaptiveConfig.preferredPostTypes[t.type] =
      1.0 + (0.2 * (sortedTypes.length - i)) / sortedTypes.length;
  });

  // Analyze best hours
  const hourPerformance: Record<number, { total: number; count: number }> = {};
  posts.forEach((p) => {
    if (!hourPerformance[p.hourOfDay]) {
      hourPerformance[p.hourOfDay] = { total: 0, count: 0 };
    }
    hourPerformance[p.hourOfDay].total += p.upvotes + p.comments;
    hourPerformance[p.hourOfDay].count++;
  });

  const sortedHours = Object.entries(hourPerformance)
    .map(([hour, data]) => ({ hour: parseInt(hour), avg: data.total / data.count }))
    .sort((a, b) => b.avg - a.avg);

  learningState.insights.bestHoursToPost = sortedHours.slice(0, 5).map((h) => h.hour);

  // Update adaptive weights for hours
  sortedHours.forEach((h, i) => {
    learningState.adaptiveConfig.preferredHours[h.hour] =
      1.0 + (0.3 * (sortedHours.length - i)) / sortedHours.length;
  });

  // Analyze best submolts
  const submoltPerformance: Record<string, { total: number; count: number }> = {};
  posts.forEach((p) => {
    if (!submoltPerformance[p.submolt]) {
      submoltPerformance[p.submolt] = { total: 0, count: 0 };
    }
    submoltPerformance[p.submolt].total += p.upvotes + p.comments;
    submoltPerformance[p.submolt].count++;
  });

  const sortedSubmolts = Object.entries(submoltPerformance)
    .map(([submolt, data]) => ({ submolt, avg: data.total / data.count }))
    .sort((a, b) => b.avg - a.avg);

  learningState.insights.bestSubmolts = sortedSubmolts.slice(0, 3).map((s) => s.submolt);

  // Update adaptive weights for submolts
  sortedSubmolts.forEach((s, i) => {
    learningState.adaptiveConfig.preferredSubmolts[s.submolt] =
      1.0 + (0.25 * (sortedSubmolts.length - i)) / sortedSubmolts.length;
  });

  // Calculate averages
  const totalUpvotes = posts.reduce((sum, p) => sum + p.upvotes, 0);
  const totalComments = posts.reduce((sum, p) => sum + p.comments, 0);
  learningState.insights.avgUpvotesPerPost = totalUpvotes / posts.length;
  learningState.insights.avgCommentsPerPost = totalComments / posts.length;

  console.log("[Learning] Analysis complete:", {
    bestTypes: learningState.insights.bestPostTypes,
    bestHours: learningState.insights.bestHoursToPost,
    bestSubmolts: learningState.insights.bestSubmolts,
    avgUpvotes: learningState.insights.avgUpvotesPerPost.toFixed(1),
  });
}

// ============================================================================
// DECISION HELPERS
// ============================================================================

/**
 * Get the best submolt to post to right now
 */
export function getBestSubmolt(options: string[]): string {
  analyzePerformance();

  let bestSubmolt = options[0];
  let bestWeight = 0;

  options.forEach((submolt) => {
    const weight = learningState.adaptiveConfig.preferredSubmolts[submolt] || 1.0;
    // Add randomness to explore
    const adjustedWeight = weight * (0.8 + Math.random() * 0.4);

    if (adjustedWeight > bestWeight) {
      bestWeight = adjustedWeight;
      bestSubmolt = submolt;
    }
  });

  return bestSubmolt;
}

/**
 * Check if now is a good time to post
 */
export function isGoodTimeToPost(): { good: boolean; reason: string } {
  const hour = new Date().getHours();
  const weight = learningState.adaptiveConfig.preferredHours[hour] || 1.0;

  if (weight >= 1.1) {
    return { good: true, reason: `Hour ${hour} is high-performing` };
  }

  // Even if not optimal, still post with some probability
  if (Math.random() < 0.7) {
    return { good: true, reason: "Exploring new time slot" };
  }

  return { good: false, reason: `Hour ${hour} historically lower engagement` };
}

/**
 * Get weight for a post type (for prioritization)
 */
export function getPostTypeWeight(type: string): number {
  return learningState.adaptiveConfig.preferredPostTypes[type] || 1.0;
}

/**
 * Should we cross-post to general?
 */
export function shouldCrossPost(postType: string, priority: string): boolean {
  // Always consider cross-posting high priority
  if (priority === "high") {
    return Math.random() < 0.4; // 40% for high priority
  }

  // Check if general performs well for us
  const generalWeight = learningState.adaptiveConfig.preferredSubmolts["general"] || 1.0;

  if (generalWeight > 1.1) {
    return Math.random() < 0.3; // 30% if general performs well
  }

  return Math.random() < 0.15; // 15% baseline
}

// ============================================================================
// KARMA OPTIMIZATION STRATEGIES
// ============================================================================

/**
 * Get karma-optimized engagement strategy for this tick
 */
export function getEngagementStrategy(): {
  focusOnReplies: boolean;
  focusOnTrending: boolean;
  focusOnNew: boolean;
  upvoteRatio: number;
} {
  const hour = new Date().getHours();

  // Peak hours: focus on trending (more visibility)
  if ([9, 12, 15, 18, 21].includes(hour)) {
    return {
      focusOnReplies: true,
      focusOnTrending: true,
      focusOnNew: false,
      upvoteRatio: 0.8,
    };
  }

  // Off-peak: help new posts (build allies)
  return {
    focusOnReplies: true,
    focusOnTrending: false,
    focusOnNew: true,
    upvoteRatio: 0.6,
  };
}

/**
 * Content tips based on learning
 */
export function getContentTips(): string[] {
  const tips: string[] = [];

  if (learningState.insights.avgUpvotesPerPost > 5) {
    tips.push("Content is resonating well - keep the style");
  } else if (learningState.posts.length > 10) {
    tips.push("Consider more engaging titles or questions");
  }

  if (learningState.insights.bestPostTypes[0] === "new_launch") {
    tips.push("New launches perform best - prioritize speed");
  }

  if (learningState.insights.bestSubmolts.includes("general")) {
    tips.push("General submolt has good reach - use it");
  }

  return tips;
}

// ============================================================================
// EXPORTS
// ============================================================================

export function getLearningState(): LearningState {
  return { ...learningState };
}

export function getLearningInsights() {
  analyzePerformance();
  return learningState.insights;
}
