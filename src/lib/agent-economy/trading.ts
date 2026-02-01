// Agent Trading
// Get quotes and execute swaps on Solana via Bags API

import {
  BAGS_API,
  COMMON_TOKENS,
  lamportsToSol,
  solToLamports,
  type BagsApiResponse,
  type TradeQuote,
  type AgentEconomyConfig,
  DEFAULT_AGENT_ECONOMY_CONFIG,
} from "./types";
import { getAgentCredentials, logAgentAction } from "./credentials";
import {
  signAndSubmitTransaction,
  waitForConfirmation,
  getPrimaryWallet,
  hasEnoughBalance,
} from "./wallet";

/**
 * Get a swap quote
 */
export async function getQuote(
  agentId: string,
  inputMint: string,
  outputMint: string,
  amountLamports: number,
  slippageMode: "auto" | "manual" = "auto",
  slippageBps?: number
): Promise<TradeQuote> {
  const credentials = await getAgentCredentials(agentId);
  if (!credentials) {
    throw new Error(`Agent ${agentId} not found or credentials expired`);
  }

  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amountLamports.toString(),
    slippageMode,
  });

  if (slippageMode === "manual" && slippageBps) {
    params.set("slippageBps", slippageBps.toString());
  }

  const response = await fetch(`${BAGS_API.PUBLIC_BASE}/trade/quote?${params}`, {
    headers: { "x-api-key": credentials.apiKey },
  });

  const data: BagsApiResponse<TradeQuote> = await response.json();

  if (!data.success || !data.response) {
    throw new Error(data.error || "Failed to get quote");
  }

  return data.response;
}

/**
 * Get a quote for swapping SOL to a token
 */
export async function getQuoteSolToToken(
  agentId: string,
  tokenMint: string,
  solAmount: number
): Promise<TradeQuote> {
  const amountLamports = solToLamports(solAmount);
  return getQuote(agentId, COMMON_TOKENS.SOL, tokenMint, amountLamports);
}

/**
 * Get a quote for swapping a token to SOL
 */
export async function getQuoteTokenToSol(
  agentId: string,
  tokenMint: string,
  tokenAmount: number // In smallest unit (lamports equivalent)
): Promise<TradeQuote> {
  return getQuote(agentId, tokenMint, COMMON_TOKENS.SOL, tokenAmount);
}

/**
 * Create a swap transaction from a quote
 */
export async function createSwapTransaction(
  agentId: string,
  quote: TradeQuote
): Promise<{
  transaction: string;
  computeUnitLimit: number;
  prioritizationFeeLamports: number;
  lastValidBlockHeight: number;
}> {
  const credentials = await getAgentCredentials(agentId);
  if (!credentials) {
    throw new Error(`Agent ${agentId} not found or credentials expired`);
  }

  const wallet = await getPrimaryWallet(agentId);

  const response = await fetch(`${BAGS_API.PUBLIC_BASE}/trade/swap`, {
    method: "POST",
    headers: {
      "x-api-key": credentials.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: wallet,
    }),
  });

  const data: BagsApiResponse<{
    transaction: string;
    computeUnitLimit: number;
    prioritizationFeeLamports: number;
    lastValidBlockHeight: number;
  }> = await response.json();

  if (!data.success || !data.response?.transaction) {
    throw new Error(data.error || "Failed to create swap transaction");
  }

  return data.response;
}

/**
 * Execute a swap with risk checks
 */
export async function executeSwap(
  agentId: string,
  inputMint: string,
  outputMint: string,
  amountLamports: number,
  config: Partial<AgentEconomyConfig> = {}
): Promise<{
  success: boolean;
  signature?: string;
  quote?: TradeQuote;
  error?: string;
}> {
  const fullConfig = { ...DEFAULT_AGENT_ECONOMY_CONFIG, ...config };

  try {
    // Check balance
    const balanceCheck = await hasEnoughBalance(agentId, amountLamports);
    if (!balanceCheck.hasEnough) {
      return {
        success: false,
        error: `Insufficient balance: have ${lamportsToSol(balanceCheck.currentBalance)} SOL, need ${lamportsToSol(balanceCheck.required)} SOL`,
      };
    }

    // Check position size limit
    const amountSol = lamportsToSol(amountLamports);
    if (amountSol > fullConfig.maxPositionSol) {
      return {
        success: false,
        error: `Position size ${amountSol} SOL exceeds limit ${fullConfig.maxPositionSol} SOL`,
      };
    }

    // Get quote
    const quote = await getQuote(agentId, inputMint, outputMint, amountLamports);

    // Check price impact
    const priceImpact = parseFloat(quote.priceImpactPct);
    if (priceImpact > fullConfig.maxPriceImpactPct) {
      return {
        success: false,
        quote,
        error: `Price impact ${priceImpact}% exceeds limit ${fullConfig.maxPriceImpactPct}%`,
      };
    }

    // Create swap transaction
    const swapTx = await createSwapTransaction(agentId, quote);

    // Sign and submit
    const signature = await signAndSubmitTransaction(agentId, swapTx.transaction, "trade", {
      inputMint,
      outputMint,
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      priceImpact: quote.priceImpactPct,
    });

    // Wait for confirmation
    const { confirmed, error } = await waitForConfirmation(signature, 60000);

    if (!confirmed) {
      return {
        success: false,
        signature,
        quote,
        error: error || "Transaction not confirmed",
      };
    }

    return {
      success: true,
      signature,
      quote,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";

    await logAgentAction(
      agentId,
      "trade",
      {
        inputMint,
        outputMint,
        amountLamports,
        error: errorMsg,
      },
      false,
      undefined,
      errorMsg
    );

    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Buy a token with SOL
 */
export async function buyToken(
  agentId: string,
  tokenMint: string,
  solAmount: number,
  config: Partial<AgentEconomyConfig> = {}
): Promise<{
  success: boolean;
  signature?: string;
  tokensReceived?: string;
  error?: string;
}> {
  const amountLamports = solToLamports(solAmount);

  const result = await executeSwap(agentId, COMMON_TOKENS.SOL, tokenMint, amountLamports, config);

  return {
    success: result.success,
    signature: result.signature,
    tokensReceived: result.quote?.outAmount,
    error: result.error,
  };
}

/**
 * Sell a token for SOL
 */
export async function sellToken(
  agentId: string,
  tokenMint: string,
  tokenAmount: number, // In smallest unit
  config: Partial<AgentEconomyConfig> = {}
): Promise<{
  success: boolean;
  signature?: string;
  solReceived?: string;
  error?: string;
}> {
  const result = await executeSwap(agentId, tokenMint, COMMON_TOKENS.SOL, tokenAmount, config);

  return {
    success: result.success,
    signature: result.signature,
    solReceived: result.quote?.outAmount,
    error: result.error,
  };
}

/**
 * Get quote preview (for UI/decision making, no execution)
 */
export async function previewSwap(
  agentId: string,
  inputMint: string,
  outputMint: string,
  amountLamports: number
): Promise<{
  inAmount: number;
  outAmount: number;
  priceImpact: number;
  route: string[];
  estimatedFee: number;
}> {
  const quote = await getQuote(agentId, inputMint, outputMint, amountLamports);

  return {
    inAmount: parseInt(quote.inAmount, 10),
    outAmount: parseInt(quote.outAmount, 10),
    priceImpact: parseFloat(quote.priceImpactPct),
    route: quote.routePlan.map((r) => r.venue),
    estimatedFee: quote.platformFee ? parseInt(quote.platformFee.amount, 10) : 0,
  };
}
