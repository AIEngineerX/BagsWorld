import { NextResponse } from "next/server";
import { getServerBagsApiOrNull } from "@/lib/bags-api-server";
import type { SniperQuote } from "@/lib/types";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";

// SOL mint address
const SOL_MINT = "So11111111111111111111111111111111111111112";

interface QuoteRequestBody {
  action: "quote";
  tokenMint: string;
  amountSol: number;
  slippageBps: number;
}

interface SwapRequestBody {
  action: "swap";
  tokenMint: string;
  amountSol: number;
  slippageBps: number;
  userPublicKey: string;
}

type SnipeRequestBody = QuoteRequestBody | SwapRequestBody;

export async function POST(request: Request) {
  // Rate limit: 30 requests per minute for sniper (standard)
  const clientIP = getClientIP(request);
  const rateLimit = checkRateLimit(`sniper:${clientIP}`, RATE_LIMITS.standard);
  if (!rateLimit.success) {
    return NextResponse.json(
      {
        error: "Too many snipe requests. Try again later.",
        retryAfter: Math.ceil(rateLimit.resetIn / 1000),
      },
      { status: 429 }
    );
  }

  const api = getServerBagsApiOrNull();

  if (!api) {
    return NextResponse.json(
      { error: "Bags API not configured. Set BAGS_API_KEY environment variable." },
      { status: 500 }
    );
  }

  const body: SnipeRequestBody = await request.json();
  const { action, tokenMint, amountSol, slippageBps } = body;

  // Validate inputs
  if (!tokenMint || tokenMint.length < 32) {
    return NextResponse.json({ error: "Invalid token mint address" }, { status: 400 });
  }

  if (!amountSol || amountSol <= 0) {
    return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
  }

  if (amountSol > 100) {
    return NextResponse.json({ error: "Maximum snipe amount is 100 SOL" }, { status: 400 });
  }

  if (!slippageBps || slippageBps < 10 || slippageBps > 5000) {
    return NextResponse.json(
      { error: "Slippage must be between 0.1% (10 bps) and 50% (5000 bps)" },
      { status: 400 }
    );
  }

  // Convert SOL to lamports
  const amountLamports = Math.floor(amountSol * 1_000_000_000);

  if (action === "quote") {
    // Get quote for the snipe
    const quote = await api.getTradeQuote(SOL_MINT, tokenMint, amountLamports, slippageBps);

    // Calculate output amounts
    const outputAmount = parseFloat(quote.outAmount);
    const minOutputAmount = parseFloat(quote.minOutAmount);
    const priceImpact = parseFloat(quote.priceImpactPct);

    const sniperQuote: SniperQuote = {
      inputMint: SOL_MINT,
      outputMint: tokenMint,
      inputAmount: amountSol,
      outputAmount: outputAmount / 1_000_000_000, // Assuming 9 decimals, adjust as needed
      minOutputAmount: minOutputAmount / 1_000_000_000,
      priceImpact,
      slippageBps,
      route: quote.routePlan.map((r) => r.venue).join(" -> "),
    };

    return NextResponse.json({
      success: true,
      quote: sniperQuote,
      rawQuote: quote, // Include raw quote for swap
    });
  }

  if (action === "swap") {
    const swapBody = body as SwapRequestBody;

    if (!swapBody.userPublicKey || swapBody.userPublicKey.length < 32) {
      return NextResponse.json({ error: "Invalid user public key" }, { status: 400 });
    }

    // First get the quote
    const quote = await api.getTradeQuote(SOL_MINT, tokenMint, amountLamports, slippageBps);

    // Then create the swap transaction
    const swapResult = await api.createSwapTransaction(quote, swapBody.userPublicKey);

    // Calculate expected output for display
    const outputAmount = parseFloat(quote.outAmount);
    const minOutputAmount = parseFloat(quote.minOutAmount);
    const priceImpact = parseFloat(quote.priceImpactPct);

    return NextResponse.json({
      success: true,
      transaction: swapResult.swapTransaction,
      computeUnitLimit: swapResult.computeUnitLimit,
      lastValidBlockHeight: swapResult.lastValidBlockHeight,
      prioritizationFeeLamports: swapResult.prioritizationFeeLamports,
      quote: {
        inputAmount: amountSol,
        outputAmount: outputAmount / 1_000_000_000,
        minOutputAmount: minOutputAmount / 1_000_000_000,
        priceImpact,
        slippageBps,
      },
    });
  }

  return NextResponse.json({ error: "Invalid action. Use 'quote' or 'swap'" }, { status: 400 });
}

// GET endpoint to check if sniper is available
export async function GET() {
  const api = getServerBagsApiOrNull();
  const hasBitquery = !!process.env.BITQUERY_API_KEY;

  return NextResponse.json({
    available: !!api,
    bitqueryConfigured: hasBitquery,
    solMint: SOL_MINT,
    limits: {
      maxSnipeAmountSol: 100,
      minSlippageBps: 10,
      maxSlippageBps: 5000,
    },
  });
}
