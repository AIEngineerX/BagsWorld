// Agent Onboarding for Bags.fm
// Helps Moltbook agents authenticate with Bags.fm via Pokécenter
//
// Flow:
// 1. Agent calls "onboard" with their Moltbook username
// 2. We call Bags.fm /agent/auth/init
// 3. Return verification content + session info
// 4. Agent posts to Moltbook (they do this themselves)
// 5. Agent calls "complete-onboard" with postId
// 6. We call Bags.fm /agent/auth/login
// 7. Agent now has a Bags.fm wallet and can launch tokens!

import { BAGS_API } from "./types";

// ============================================================================
// TYPES
// ============================================================================

export interface OnboardingSession {
  publicIdentifier: string;
  secret: string;
  moltbookUsername: string;
  verificationContent: string;
  createdAt: number;
  expiresAt: number; // 15 minutes from creation
}

export interface OnboardingStartResult {
  success: boolean;
  session?: {
    publicIdentifier: string;
    secret: string; // Agent needs to save this and send it back
    verificationContent: string;
    expiresInMinutes: number;
  };
  instructions?: string[];
  error?: string;
}

export interface OnboardingCompleteResult {
  success: boolean;
  wallet?: string;
  message?: string;
  error?: string;
}

// In-memory session storage (for demo - use Redis/DB in production)
const pendingSessions = new Map<string, OnboardingSession>();

// Clean up expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of pendingSessions.entries()) {
    if (session.expiresAt < now) {
      pendingSessions.delete(key);
    }
  }
}, 60000); // Every minute

// ============================================================================
// ONBOARDING FUNCTIONS
// ============================================================================

/**
 * Start the onboarding process for a Moltbook agent
 * Returns verification content they need to post to Moltbook
 */
export async function startOnboarding(moltbookUsername: string): Promise<OnboardingStartResult> {
  console.log(`[Onboarding] Starting for @${moltbookUsername}`);

  // Check if they already have a wallet (already onboarded)
  const existingWallet = await lookupWalletByMoltbook(moltbookUsername);
  if (existingWallet) {
    return {
      success: false,
      error: `@${moltbookUsername} is already onboarded with wallet ${existingWallet.slice(0, 8)}...`,
    };
  }

  try {
    // Call Bags.fm auth/init
    const initResponse = await fetch(`${BAGS_API.AGENT_BASE}/auth/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentUsername: moltbookUsername }),
    });

    const initData = await initResponse.json();

    if (!initResponse.ok || !initData.success) {
      const errorMsg = initData.response || initData.error || "Failed to initialize auth";
      console.error(`[Onboarding] Init failed for @${moltbookUsername}:`, errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    }

    const { publicIdentifier, secret, verificationPostContent } = initData.response;

    // Store session (expires in 15 minutes)
    const session: OnboardingSession = {
      publicIdentifier,
      secret,
      moltbookUsername,
      verificationContent: verificationPostContent,
      createdAt: Date.now(),
      expiresAt: Date.now() + 15 * 60 * 1000,
    };
    pendingSessions.set(publicIdentifier, session);

    console.log(`[Onboarding] Session created for @${moltbookUsername}: ${publicIdentifier}`);

    return {
      success: true,
      session: {
        publicIdentifier,
        secret, // Agent needs to save this!
        verificationContent: verificationPostContent,
        expiresInMinutes: 15,
      },
      instructions: [
        "1. Post the verification content to Moltbook (any submolt)",
        "2. Note the post ID from the response",
        "3. Call complete-onboard with: {action: 'complete-onboard', publicIdentifier, secret, postId}",
        "4. You'll receive your Bags.fm wallet address",
        "5. Then you can launch tokens!",
      ],
    };
  } catch (err) {
    console.error(`[Onboarding] Error for @${moltbookUsername}:`, err);
    return {
      success: false,
      error: `Onboarding failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Complete the onboarding process after agent posts to Moltbook
 */
export async function completeOnboarding(
  publicIdentifier: string,
  secret: string,
  postId: string
): Promise<OnboardingCompleteResult> {
  console.log(`[Onboarding] Completing for session: ${publicIdentifier}`);

  // Validate session exists and matches
  const session = pendingSessions.get(publicIdentifier);

  if (!session) {
    return {
      success: false,
      error: "Session not found or expired. Please start onboarding again.",
    };
  }

  if (session.secret !== secret) {
    return {
      success: false,
      error: "Invalid secret. Make sure you're using the secret from the onboard response.",
    };
  }

  if (session.expiresAt < Date.now()) {
    pendingSessions.delete(publicIdentifier);
    return {
      success: false,
      error: "Session expired. Please start onboarding again.",
    };
  }

  try {
    // Call Bags.fm auth/login
    const loginResponse = await fetch(`${BAGS_API.AGENT_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicIdentifier,
        secret,
        postId,
      }),
    });

    const loginData = await loginResponse.json();

    if (!loginResponse.ok || !loginData.success) {
      const errorMsg = loginData.response || loginData.error || "Login failed";
      console.error(`[Onboarding] Login failed:`, errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    }

    const jwtToken = loginData.response.token;

    // Get their wallet address
    const walletResponse = await fetch(`${BAGS_API.AGENT_BASE}/wallet/list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: jwtToken }),
    });

    const walletData = await walletResponse.json();
    const wallets = walletData.response || [];
    const primaryWallet = wallets[0] || null;

    // Clean up session
    pendingSessions.delete(publicIdentifier);

    console.log(
      `[Onboarding] ✅ Complete! @${session.moltbookUsername} → ${primaryWallet?.slice(0, 8)}...`
    );

    return {
      success: true,
      wallet: primaryWallet,
      message: `Welcome to Bags.fm! Your wallet: ${primaryWallet}. You can now launch tokens via Pokécenter!`,
    };
  } catch (err) {
    console.error(`[Onboarding] Error completing:`, err);
    return {
      success: false,
      error: `Failed to complete onboarding: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Check if a Moltbook user is already onboarded (has a Bags.fm wallet)
 */
export async function checkOnboardingStatus(moltbookUsername: string): Promise<{
  onboarded: boolean;
  wallet?: string;
  message: string;
}> {
  const wallet = await lookupWalletByMoltbook(moltbookUsername);

  if (wallet) {
    return {
      onboarded: true,
      wallet,
      message: `@${moltbookUsername} is onboarded with wallet ${wallet.slice(0, 8)}...${wallet.slice(-4)}`,
    };
  }

  return {
    onboarded: false,
    message: `@${moltbookUsername} is not yet onboarded. Use action: "onboard" to start.`,
  };
}

/**
 * Look up wallet by Moltbook username via Bags.fm API
 */
async function lookupWalletByMoltbook(username: string): Promise<string | null> {
  const BAGS_API_KEY = process.env.BAGS_API_KEY;
  if (!BAGS_API_KEY) return null;

  try {
    const lookupUrl = `${BAGS_API.PUBLIC_BASE}/token-launch/fee-share/wallet/v2?provider=moltbook&username=${encodeURIComponent(username)}`;
    const response = await fetch(lookupUrl, {
      headers: { "x-api-key": BAGS_API_KEY },
    });

    const data = await response.json();

    if (response.ok && data.success && data.response?.wallet) {
      return data.response.wallet;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve fee recipients from various formats to wallet addresses
 * Supports: moltbookUsername, twitter, wallet address
 */
export async function resolveFeeRecipients(
  recipients: Array<{
    moltbookUsername?: string;
    twitter?: string;
    wallet?: string;
    bps: number;
  }>
): Promise<{
  success: boolean;
  feeClaimers?: Array<{ user: string; userBps: number }>;
  error?: string;
}> {
  const BAGS_API_KEY = process.env.BAGS_API_KEY;
  if (!BAGS_API_KEY) {
    return { success: false, error: "API key not configured" };
  }

  // Validate BPS total
  const totalBps = recipients.reduce((sum, r) => sum + r.bps, 0);
  if (totalBps !== 10000) {
    return {
      success: false,
      error: `Fee shares must total 10000 BPS (100%). Got ${totalBps}.`,
    };
  }

  const feeClaimers: Array<{ user: string; userBps: number }> = [];
  const errors: string[] = [];

  for (const recipient of recipients) {
    let wallet: string | null = null;

    if (recipient.wallet) {
      // Direct wallet address
      wallet = recipient.wallet;
    } else if (recipient.moltbookUsername) {
      // Look up by Moltbook
      const lookupUrl = `${BAGS_API.PUBLIC_BASE}/token-launch/fee-share/wallet/v2?provider=moltbook&username=${encodeURIComponent(recipient.moltbookUsername)}`;
      const response = await fetch(lookupUrl, {
        headers: { "x-api-key": BAGS_API_KEY },
      });
      const data = await response.json();

      if (data.success && data.response?.wallet) {
        wallet = data.response.wallet;
      } else {
        errors.push(`Moltbook user @${recipient.moltbookUsername} not found or not onboarded`);
      }
    } else if (recipient.twitter) {
      // Look up by Twitter
      const lookupUrl = `${BAGS_API.PUBLIC_BASE}/token-launch/fee-share/wallet/v2?provider=twitter&username=${encodeURIComponent(recipient.twitter)}`;
      const response = await fetch(lookupUrl, {
        headers: { "x-api-key": BAGS_API_KEY },
      });
      const data = await response.json();

      if (data.success && data.response?.wallet) {
        wallet = data.response.wallet;
      } else {
        errors.push(`Twitter user @${recipient.twitter} not found`);
      }
    }

    if (wallet) {
      feeClaimers.push({ user: wallet, userBps: recipient.bps });
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      error: `Failed to resolve recipients: ${errors.join("; ")}`,
    };
  }

  return { success: true, feeClaimers };
}
