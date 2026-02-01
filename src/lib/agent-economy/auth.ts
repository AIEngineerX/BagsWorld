// Agent Authentication via Moltbook
// Implements the Bags.fm agent auth flow: init → post to Moltbook → login → create API key

import { BAGS_API, type BagsApiResponse, type AgentCredentials } from "./types";
import {
  storeAuthSession,
  getAuthSession,
  deleteAuthSession,
  storeAgentCredentials,
  updateAgentApiKey,
  updateAgentWallets,
  logAgentAction,
} from "./credentials";

const MOLTBOOK_API_URL = "https://www.moltbook.com/api/v1";

/**
 * Step 1: Initialize authentication session
 * Returns verification content that must be posted to Moltbook
 */
export async function initAuth(moltbookUsername: string): Promise<{
  publicIdentifier: string;
  verificationContent: string;
  expiresAt: Date;
}> {
  const response = await fetch(`${BAGS_API.AGENT_BASE}/auth/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentUsername: moltbookUsername }),
  });

  const data: BagsApiResponse<{
    publicIdentifier: string;
    secret: string;
    agentUsername: string;
    agentUserId: string;
    verificationPostContent: string;
  }> = await response.json();

  if (!data.success || !data.response) {
    throw new Error(data.error || "Failed to initialize auth session");
  }

  const { publicIdentifier, secret, agentUsername, agentUserId, verificationPostContent } =
    data.response;

  // Session expires in 15 minutes
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

  // Store session for later verification
  await storeAuthSession({
    publicIdentifier,
    secret,
    agentUsername,
    agentUserId,
    verificationPostContent,
    createdAt: now,
    expiresAt,
  });

  return {
    publicIdentifier,
    verificationContent: verificationPostContent,
    expiresAt,
  };
}

/**
 * Step 2: Post verification to Moltbook
 * Requires the agent's Moltbook API key
 */
export async function postVerificationToMoltbook(
  moltbookApiKey: string,
  verificationContent: string
): Promise<string> {
  const response = await fetch(`${MOLTBOOK_API_URL}/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${moltbookApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      submolt: "general",
      title: "Bags Wallet Verification",
      content: verificationContent,
    }),
  });

  const data = await response.json();

  if (!data.success || !data.post?.id) {
    throw new Error(data.error || "Failed to post verification to Moltbook");
  }

  return data.post.id;
}

/**
 * Step 3: Complete login with post ID
 * Returns JWT token valid for 365 days
 */
export async function completeLogin(
  publicIdentifier: string,
  postId: string
): Promise<{
  jwtToken: string;
  agentId: string;
  moltbookUsername: string;
}> {
  // Get the stored session
  const session = await getAuthSession(publicIdentifier);
  if (!session) {
    throw new Error("Auth session expired or not found");
  }

  const response = await fetch(`${BAGS_API.AGENT_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicIdentifier,
      secret: session.secret,
      postId,
    }),
  });

  const data: BagsApiResponse<{ token: string }> = await response.json();

  if (!data.success || !data.response?.token) {
    throw new Error(data.error || "Failed to complete login");
  }

  const jwtToken = data.response.token;

  // JWT expires in 365 days
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  // Generate agent ID from username
  const agentId = `agent-${session.agentUsername.toLowerCase()}`;

  // Store credentials
  await storeAgentCredentials({
    agentId,
    moltbookUsername: session.agentUsername,
    jwtToken,
    apiKey: "", // Will be created in next step
    wallets: [], // Will be fetched after API key creation
    authenticatedAt: now,
    expiresAt,
  });

  // Clean up auth session
  await deleteAuthSession(publicIdentifier);

  // Log the action
  await logAgentAction(
    agentId,
    "auth",
    {
      step: "login_complete",
      moltbookUsername: session.agentUsername,
    },
    true
  );

  return {
    jwtToken,
    agentId,
    moltbookUsername: session.agentUsername,
  };
}

/**
 * Step 4: Create API key for Public API access
 */
export async function createApiKey(
  agentId: string,
  jwtToken: string,
  keyName: string = "BagsWorld Agent Key"
): Promise<string> {
  const response = await fetch(`${BAGS_API.AGENT_BASE}/dev/keys/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: jwtToken,
      name: keyName,
    }),
  });

  const data: BagsApiResponse<{
    apiKey: {
      key: string;
      name: string;
      status: string;
    };
  }> = await response.json();

  if (!data.success || !data.response?.apiKey?.key) {
    // May already have max API keys - try to list existing ones
    const existingKey = await getExistingApiKey(jwtToken);
    if (existingKey) {
      await updateAgentApiKey(agentId, existingKey);
      return existingKey;
    }
    throw new Error(data.error || "Failed to create API key");
  }

  const apiKey = data.response.apiKey.key;

  // Update stored credentials
  await updateAgentApiKey(agentId, apiKey);

  // Log the action
  await logAgentAction(
    agentId,
    "auth",
    {
      step: "api_key_created",
      keyName,
    },
    true
  );

  return apiKey;
}

/**
 * Get existing API key if max keys reached
 */
async function getExistingApiKey(jwtToken: string): Promise<string | null> {
  const response = await fetch(`${BAGS_API.AGENT_BASE}/dev/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: jwtToken }),
  });

  const data: BagsApiResponse<Array<{ key: string; status: string }>> = await response.json();

  if (!data.success || !data.response || data.response.length === 0) {
    return null;
  }

  // Return first active key
  const activeKey = data.response.find((k) => k.status === "active");
  return activeKey?.key || data.response[0]?.key || null;
}

/**
 * Step 5: Fetch and store agent's wallets
 */
export async function fetchAgentWallets(agentId: string, jwtToken: string): Promise<string[]> {
  const response = await fetch(`${BAGS_API.AGENT_BASE}/wallet/list`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: jwtToken }),
  });

  const data: BagsApiResponse<string[]> = await response.json();

  if (!data.success || !data.response) {
    throw new Error(data.error || "Failed to fetch wallets");
  }

  const wallets = data.response;

  // Update stored credentials
  await updateAgentWallets(agentId, wallets);

  return wallets;
}

/**
 * Export private key for transaction signing
 * ⚠️ SECURITY: Clear from memory immediately after use!
 */
export async function exportPrivateKey(jwtToken: string, walletAddress: string): Promise<string> {
  const response = await fetch(`${BAGS_API.AGENT_BASE}/wallet/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: jwtToken,
      walletAddress,
    }),
  });

  const data: BagsApiResponse<{ privateKey: string }> = await response.json();

  if (!data.success || !data.response?.privateKey) {
    throw new Error(data.error || "Failed to export private key");
  }

  return data.response.privateKey;
}

/**
 * Verify JWT token is still valid
 */
export async function verifyToken(jwtToken: string): Promise<boolean> {
  try {
    const response = await fetch(`${BAGS_API.AGENT_BASE}/wallet/list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: jwtToken }),
    });

    const data: BagsApiResponse<string[]> = await response.json();
    return data.success === true;
  } catch {
    return false;
  }
}

/**
 * Full authentication flow helper
 * For manual/CLI usage where Moltbook API key is available
 */
export async function fullAuthFlow(
  moltbookUsername: string,
  moltbookApiKey: string
): Promise<AgentCredentials> {
  console.log(`[AgentAuth] Starting auth flow for ${moltbookUsername}`);

  // Step 1: Initialize
  const { publicIdentifier, verificationContent } = await initAuth(moltbookUsername);
  console.log(`[AgentAuth] Session created: ${publicIdentifier}`);

  // Step 2: Post to Moltbook
  const postId = await postVerificationToMoltbook(moltbookApiKey, verificationContent);
  console.log(`[AgentAuth] Verification posted: ${postId}`);

  // Step 3: Complete login
  const { jwtToken, agentId } = await completeLogin(publicIdentifier, postId);
  console.log(`[AgentAuth] Login complete: ${agentId}`);

  // Step 4: Create API key
  const apiKey = await createApiKey(agentId, jwtToken);
  console.log(`[AgentAuth] API key created`);

  // Step 5: Fetch wallets
  const wallets = await fetchAgentWallets(agentId, jwtToken);
  console.log(`[AgentAuth] Wallets fetched: ${wallets.join(", ")}`);

  return {
    agentId,
    moltbookUsername,
    jwtToken,
    apiKey,
    wallets,
    authenticatedAt: new Date(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  };
}
