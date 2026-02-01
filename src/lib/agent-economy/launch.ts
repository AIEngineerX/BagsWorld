// Agent Token Launch
// Create and launch tokens on Bags.fm with configurable fee sharing

import {
  BAGS_API,
  solToLamports,
  type BagsApiResponse,
  type TokenLaunchConfig,
  type TokenLaunchResult,
} from "./types";
import { getAgentCredentials, logAgentAction } from "./credentials";
import { signAndSubmitTransaction, waitForConfirmation, getPrimaryWallet } from "./wallet";

/**
 * Look up wallet address by social identity
 */
export async function lookupWallet(
  agentId: string,
  provider: "moltbook" | "twitter" | "github",
  username: string
): Promise<string | null> {
  const credentials = await getAgentCredentials(agentId);
  if (!credentials) {
    throw new Error(`Agent ${agentId} not found or credentials expired`);
  }

  const params = new URLSearchParams({ provider, username });

  const response = await fetch(
    `${BAGS_API.PUBLIC_BASE}/token-launch/fee-share/wallet/v2?${params}`,
    {
      headers: { "x-api-key": credentials.apiKey },
    }
  );

  const data: BagsApiResponse<{ wallet: string }> = await response.json();

  if (!data.success || !data.response?.wallet) {
    return null;
  }

  return data.response.wallet;
}

/**
 * Bulk lookup wallets for fee sharing
 */
export async function bulkLookupWallets(
  agentId: string,
  lookups: Array<{ provider: "moltbook" | "twitter" | "github"; username: string }>
): Promise<Map<string, string>> {
  const credentials = await getAgentCredentials(agentId);
  if (!credentials) {
    throw new Error(`Agent ${agentId} not found or credentials expired`);
  }

  const response = await fetch(`${BAGS_API.PUBLIC_BASE}/token-launch/fee-share/wallet/v2/bulk`, {
    method: "POST",
    headers: {
      "x-api-key": credentials.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ lookups }),
  });

  const data: BagsApiResponse<
    Array<{
      provider: string;
      username: string;
      wallet: string;
    }>
  > = await response.json();

  const result = new Map<string, string>();

  if (data.success && data.response) {
    for (const item of data.response) {
      result.set(`${item.provider}:${item.username}`, item.wallet);
    }
  }

  return result;
}

/**
 * Step 1: Create token metadata
 */
export async function createTokenInfo(
  agentId: string,
  config: {
    name: string;
    symbol: string;
    description: string;
    imageUrl: string;
    twitter?: string;
    website?: string;
    telegram?: string;
  }
): Promise<{ tokenMint: string; metadataUrl: string }> {
  const credentials = await getAgentCredentials(agentId);
  if (!credentials) {
    throw new Error(`Agent ${agentId} not found or credentials expired`);
  }

  const response = await fetch(`${BAGS_API.PUBLIC_BASE}/token-launch/create-token-info`, {
    method: "POST",
    headers: {
      "x-api-key": credentials.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: config.name,
      symbol: config.symbol,
      description: config.description,
      imageUrl: config.imageUrl,
      twitter: config.twitter,
      website: config.website,
      telegram: config.telegram,
    }),
  });

  const data: BagsApiResponse<{
    tokenMint: string;
    tokenMetadata: string;
  }> = await response.json();

  if (!data.success || !data.response) {
    throw new Error(data.error || "Failed to create token info");
  }

  return {
    tokenMint: data.response.tokenMint,
    metadataUrl: data.response.tokenMetadata,
  };
}

/**
 * Step 2: Create fee share configuration
 */
export async function createFeeShareConfig(
  agentId: string,
  tokenMint: string,
  feeClaimers: Array<{ user: string; userBps: number }>
): Promise<{
  configKey: string;
  transactions: Array<{ transaction: string; blockhash: string }>;
}> {
  const credentials = await getAgentCredentials(agentId);
  if (!credentials) {
    throw new Error(`Agent ${agentId} not found or credentials expired`);
  }

  const wallet = await getPrimaryWallet(agentId);

  // Validate BPS totals 10000
  const totalBps = feeClaimers.reduce((sum, fc) => sum + fc.userBps, 0);
  if (totalBps !== 10000) {
    throw new Error(`Fee claimer BPS must sum to 10000, got ${totalBps}`);
  }

  const response = await fetch(`${BAGS_API.PUBLIC_BASE}/fee-share/config`, {
    method: "POST",
    headers: {
      "x-api-key": credentials.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      payer: wallet,
      baseMint: tokenMint,
      feeClaimers,
    }),
  });

  const data: BagsApiResponse<{
    configKey: string;
    transactions?: Array<{ transaction: string; blockhash: string }>;
  }> = await response.json();

  if (!data.success || !data.response?.configKey) {
    throw new Error(data.error || "Failed to create fee share config");
  }

  return {
    configKey: data.response.configKey,
    transactions: data.response.transactions || [],
  };
}

/**
 * Step 3: Create launch transaction
 */
export async function createLaunchTransaction(
  agentId: string,
  tokenMint: string,
  metadataUrl: string,
  configKey: string,
  initialBuyLamports: number = 0
): Promise<{ transaction: string }> {
  const credentials = await getAgentCredentials(agentId);
  if (!credentials) {
    throw new Error(`Agent ${agentId} not found or credentials expired`);
  }

  const wallet = await getPrimaryWallet(agentId);

  const response = await fetch(`${BAGS_API.PUBLIC_BASE}/token-launch/create-launch-transaction`, {
    method: "POST",
    headers: {
      "x-api-key": credentials.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      metadataUrl,
      tokenMint,
      wallet,
      initialBuyLamports,
      configKey,
    }),
  });

  const data: BagsApiResponse<{ transaction: string }> = await response.json();

  if (!data.success || !data.response?.transaction) {
    throw new Error(data.error || "Failed to create launch transaction");
  }

  return { transaction: data.response.transaction };
}

/**
 * Full token launch flow
 */
export async function launchToken(
  agentId: string,
  config: TokenLaunchConfig
): Promise<TokenLaunchResult> {
  const wallet = await getPrimaryWallet(agentId);

  console.log(`[AgentLaunch] Starting launch for ${config.name} (${config.symbol})`);

  // Step 1: Create token info
  console.log("[AgentLaunch] Creating token metadata...");
  const { tokenMint, metadataUrl } = await createTokenInfo(agentId, {
    name: config.name,
    symbol: config.symbol,
    description: config.description,
    imageUrl: config.imageUrl,
    twitter: config.twitter,
    website: config.website,
    telegram: config.telegram,
  });
  console.log(`[AgentLaunch] Token mint: ${tokenMint}`);

  // Step 2: Create fee share config
  // If no fee claimers specified, default to 100% to launcher
  const feeClaimers =
    config.feeClaimers.length > 0 ? config.feeClaimers : [{ user: wallet, userBps: 10000 }];

  console.log("[AgentLaunch] Creating fee share config...");
  const { configKey, transactions: configTxs } = await createFeeShareConfig(
    agentId,
    tokenMint,
    feeClaimers
  );
  console.log(`[AgentLaunch] Config key: ${configKey}`);

  // Sign and submit config transactions if any
  if (configTxs.length > 0) {
    console.log(`[AgentLaunch] Signing ${configTxs.length} config transaction(s)...`);
    for (const tx of configTxs) {
      await signAndSubmitTransaction(agentId, tx.transaction, "launch_config", { tokenMint });
    }
  }

  // Step 3: Create and submit launch transaction
  console.log("[AgentLaunch] Creating launch transaction...");
  const initialBuyLamports = config.initialBuyLamports || 0;
  const { transaction: launchTx } = await createLaunchTransaction(
    agentId,
    tokenMint,
    metadataUrl,
    configKey,
    initialBuyLamports
  );

  console.log("[AgentLaunch] Signing and submitting launch...");
  const signature = await signAndSubmitTransaction(agentId, launchTx, "launch_token", {
    tokenMint,
    name: config.name,
    symbol: config.symbol,
    initialBuyLamports,
    feeClaimers: feeClaimers.length,
  });

  // Wait for confirmation
  console.log("[AgentLaunch] Waiting for confirmation...");
  const { confirmed, error } = await waitForConfirmation(signature, 60000);

  if (!confirmed) {
    throw new Error(`Launch transaction failed: ${error}`);
  }

  const result: TokenLaunchResult = {
    tokenMint,
    metadataUrl,
    configKey,
    signature,
    bagsUrl: `https://bags.fm/${tokenMint}`,
    solscanUrl: `https://solscan.io/tx/${signature}`,
  };

  console.log(`[AgentLaunch] ✅ Token launched: ${result.bagsUrl}`);

  // Log success
  await logAgentAction(
    agentId,
    "launch_token",
    {
      ...result,
      name: config.name,
      symbol: config.symbol,
      feeClaimersCount: feeClaimers.length,
    },
    true,
    signature
  );

  return result;
}

/**
 * Launch a token for another agent
 * Automatically looks up the target agent's wallet and splits fees
 */
export async function launchTokenForAgent(
  launcherAgentId: string,
  targetAgentUsername: string,
  config: Omit<TokenLaunchConfig, "feeClaimers">,
  launcherShareBps: number = 5000 // Default 50/50 split
): Promise<TokenLaunchResult> {
  // Look up target agent's wallet
  const targetWallet = await lookupWallet(launcherAgentId, "moltbook", targetAgentUsername);
  if (!targetWallet) {
    throw new Error(`Could not find wallet for agent ${targetAgentUsername}`);
  }

  const launcherWallet = await getPrimaryWallet(launcherAgentId);

  // Create fee split
  const targetShareBps = 10000 - launcherShareBps;
  const feeClaimers = [
    { user: launcherWallet, userBps: launcherShareBps },
    { user: targetWallet, userBps: targetShareBps },
  ];

  console.log(
    `[AgentLaunch] Launching for ${targetAgentUsername} with ${launcherShareBps / 100}%/${targetShareBps / 100}% split`
  );

  return launchToken(launcherAgentId, {
    ...config,
    feeClaimers,
  });
}

/**
 * Quick launch with defaults (100% fees to launcher)
 */
export async function quickLaunch(
  agentId: string,
  name: string,
  symbol: string,
  description: string,
  imageUrl: string,
  initialBuySol: number = 0.01
): Promise<TokenLaunchResult> {
  const wallet = await getPrimaryWallet(agentId);

  return launchToken(agentId, {
    name,
    symbol,
    description,
    imageUrl,
    initialBuyLamports: solToLamports(initialBuySol),
    feeClaimers: [{ user: wallet, userBps: 10000 }],
  });
}
