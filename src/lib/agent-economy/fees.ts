// Agent Fee Management
// Check claimable positions and claim earned fees

import { BAGS_API, lamportsToSol, type BagsApiResponse, type ClaimablePosition } from "./types";
import { getAgentCredentials, logAgentAction } from "./credentials";
import { signAndSubmitTransaction, waitForConfirmation, getPrimaryWallet } from "./wallet";

/**
 * Get claimable fee positions for an agent
 */
export async function getClaimablePositions(agentId: string): Promise<{
  positions: ClaimablePosition[];
  totalClaimableLamports: number;
  totalClaimableSol: number;
}> {
  const credentials = await getAgentCredentials(agentId);
  if (!credentials) {
    throw new Error(`Agent ${agentId} not found or credentials expired`);
  }

  const wallet = credentials.wallets[0];
  if (!wallet) {
    throw new Error(`Agent ${agentId} has no wallets`);
  }

  const response = await fetch(
    `${BAGS_API.PUBLIC_BASE}/token-launch/claimable-positions?wallet=${wallet}`,
    {
      headers: { "x-api-key": credentials.apiKey },
    }
  );

  const data: BagsApiResponse<
    Array<{
      baseMint: string;
      virtualPoolAddress: string;
      virtualPoolClaimableAmount?: string;
      virtualPoolClaimableLamportsUserShare?: string;
      dammPoolClaimableAmount?: string;
      dammPoolClaimableLamportsUserShare?: string;
      totalClaimableLamportsUserShare?: string;
      isCustomFeeVault: boolean;
      customFeeVaultBps?: number;
      isMigrated: boolean;
    }>
  > = await response.json();

  if (!data.success || !data.response) {
    throw new Error(data.error || "Failed to fetch claimable positions");
  }

  const positions: ClaimablePosition[] = data.response.map((pos) => {
    const virtualPool = parseInt(
      pos.virtualPoolClaimableAmount || pos.virtualPoolClaimableLamportsUserShare || "0",
      10
    );
    const dammPool = parseInt(
      pos.dammPoolClaimableAmount || pos.dammPoolClaimableLamportsUserShare || "0",
      10
    );
    const total =
      parseInt(pos.totalClaimableLamportsUserShare || "0", 10) || virtualPool + dammPool;

    return {
      baseMint: pos.baseMint,
      virtualPoolAddress: pos.virtualPoolAddress,
      virtualPoolClaimableAmount:
        pos.virtualPoolClaimableAmount || pos.virtualPoolClaimableLamportsUserShare || "0",
      dammPoolClaimableAmount:
        pos.dammPoolClaimableAmount || pos.dammPoolClaimableLamportsUserShare || "0",
      totalClaimableLamports: total,
      isCustomFeeVault: pos.isCustomFeeVault,
      customFeeVaultBps: pos.customFeeVaultBps,
      isMigrated: pos.isMigrated,
    };
  });

  const totalClaimableLamports = positions.reduce((sum, p) => sum + p.totalClaimableLamports, 0);

  return {
    positions,
    totalClaimableLamports,
    totalClaimableSol: lamportsToSol(totalClaimableLamports),
  };
}

/**
 * Generate claim transactions for positions
 */
export async function generateClaimTransactions(
  agentId: string,
  positions: Array<{ baseMint: string; virtualPoolAddress: string }>
): Promise<Array<{ transaction: string; blockhash: string }>> {
  const credentials = await getAgentCredentials(agentId);
  if (!credentials) {
    throw new Error(`Agent ${agentId} not found or credentials expired`);
  }

  const wallet = await getPrimaryWallet(agentId);

  const response = await fetch(`${BAGS_API.PUBLIC_BASE}/token-launch/claim-txs/v2`, {
    method: "POST",
    headers: {
      "x-api-key": credentials.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      wallet,
      positions,
    }),
  });

  const data: BagsApiResponse<{
    transactions: Array<{ transaction: string; blockhash: string }>;
  }> = await response.json();

  if (!data.success || !data.response?.transactions) {
    throw new Error(data.error || "Failed to generate claim transactions");
  }

  return data.response.transactions;
}

/**
 * Claim all available fees for an agent
 */
export async function claimAllFees(
  agentId: string,
  minClaimSol: number = 0.001
): Promise<{
  claimed: boolean;
  totalClaimedSol: number;
  signatures: string[];
  errors: string[];
}> {
  // Get claimable positions
  const { positions, totalClaimableSol } = await getClaimablePositions(agentId);

  // Check if there's enough to claim
  if (positions.length === 0 || totalClaimableSol < minClaimSol) {
    await logAgentAction(
      agentId,
      "claim_fees",
      {
        status: "skipped",
        reason: positions.length === 0 ? "no_positions" : "below_threshold",
        totalClaimableSol,
        minClaimSol,
      },
      true
    );

    return {
      claimed: false,
      totalClaimedSol: 0,
      signatures: [],
      errors: [],
    };
  }

  // Generate claim transactions - filter out positions without virtualPoolAddress
  const positionsToClean = positions
    .filter((p) => p.virtualPoolAddress)
    .map((p) => ({
      baseMint: p.baseMint,
      virtualPoolAddress: p.virtualPoolAddress!,
    }));

  const transactions = await generateClaimTransactions(agentId, positionsToClean);

  const signatures: string[] = [];
  const errors: string[] = [];

  // Sign and submit each transaction
  for (let i = 0; i < transactions.length; i++) {
    try {
      const signature = await signAndSubmitTransaction(
        agentId,
        transactions[i].transaction,
        "claim_fees",
        {
          transactionIndex: i + 1,
          totalTransactions: transactions.length,
          totalClaimableSol,
        }
      );

      // Wait for confirmation
      const { confirmed, error } = await waitForConfirmation(signature, 30000);

      if (confirmed) {
        signatures.push(signature);
      } else {
        errors.push(`Transaction ${i + 1} failed: ${error}`);
      }
    } catch (err) {
      errors.push(`Transaction ${i + 1} error: ${err instanceof Error ? err.message : "Unknown"}`);
    }
  }

  const success = signatures.length > 0;

  // Log final result
  await logAgentAction(
    agentId,
    "claim_fees",
    {
      status: success ? "completed" : "failed",
      totalClaimableSol,
      claimedTransactions: signatures.length,
      failedTransactions: errors.length,
      signatures,
      errors,
    },
    success
  );

  return {
    claimed: success,
    totalClaimedSol: success ? totalClaimableSol : 0,
    signatures,
    errors,
  };
}

/**
 * Check and claim fees if above threshold
 * Designed for periodic/heartbeat use
 */
export async function checkAndClaimFees(
  agentId: string,
  minClaimSol: number = 0.01
): Promise<{
  checked: boolean;
  claimable: number;
  claimed: boolean;
  claimedAmount: number;
  signatures: string[];
}> {
  try {
    // Check claimable
    const { totalClaimableSol, positions } = await getClaimablePositions(agentId);

    // If below threshold, just return status
    if (totalClaimableSol < minClaimSol) {
      return {
        checked: true,
        claimable: totalClaimableSol,
        claimed: false,
        claimedAmount: 0,
        signatures: [],
      };
    }

    // Claim if above threshold
    const result = await claimAllFees(agentId, minClaimSol);

    return {
      checked: true,
      claimable: totalClaimableSol,
      claimed: result.claimed,
      claimedAmount: result.totalClaimedSol,
      signatures: result.signatures,
    };
  } catch (error) {
    console.error(`[AgentFees] Error checking/claiming for ${agentId}:`, error);
    return {
      checked: false,
      claimable: 0,
      claimed: false,
      claimedAmount: 0,
      signatures: [],
    };
  }
}

/**
 * Get lifetime fees for a specific token
 */
export async function getTokenLifetimeFees(agentId: string, tokenMint: string): Promise<number> {
  const credentials = await getAgentCredentials(agentId);
  if (!credentials) {
    throw new Error(`Agent ${agentId} not found or credentials expired`);
  }

  const response = await fetch(
    `${BAGS_API.PUBLIC_BASE}/token-launch/lifetime-fees?tokenMint=${tokenMint}`,
    {
      headers: { "x-api-key": credentials.apiKey },
    }
  );

  const data: BagsApiResponse<{ lifetimeFees: string }> = await response.json();

  if (!data.success || !data.response) {
    return 0;
  }

  return lamportsToSol(parseInt(data.response.lifetimeFees, 10));
}
