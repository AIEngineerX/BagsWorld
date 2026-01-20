import { NextResponse } from "next/server";
import { getServerBagsApiOrNull } from "@/lib/bags-api-server";
import type { TradeQuote } from "@/lib/types";

interface TradeRequestBody {
  action: "quote" | "swap";
  data: {
    // For quote
    inputMint?: string;
    outputMint?: string;
    amount?: number;
    slippageBps?: number;
    // For swap
    quoteResponse?: TradeQuote;
    userPublicKey?: string;
  };
}

export async function POST(request: Request) {
  try {
    const body: TradeRequestBody = await request.json();
    const { action, data } = body;
    const api = getServerBagsApiOrNull();

    if (!api) {
      return NextResponse.json(
        { error: "Bags API not configured. Set BAGS_API_KEY environment variable." },
        { status: 500 }
      );
    }

    switch (action) {
      case "quote":
        return handleQuote(api, data);

      case "swap":
        return handleSwap(api, data);

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Trade API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process request" },
      { status: 500 }
    );
  }
}

async function handleQuote(
  api: BagsApiClient,
  data: TradeRequestBody["data"]
): Promise<NextResponse> {
  const { inputMint, outputMint, amount, slippageBps } = data;

  if (!inputMint || !outputMint || !amount) {
    return NextResponse.json(
      { error: "Missing required fields: inputMint, outputMint, amount" },
      { status: 400 }
    );
  }

  try {
    const quote = await api.getTradeQuote(
      inputMint,
      outputMint,
      amount,
      slippageBps || 50 // Default 0.5% slippage
    );

    return NextResponse.json({
      success: true,
      quote,
    });
  } catch (error) {
    console.error("Quote error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get quote" },
      { status: 500 }
    );
  }
}

async function handleSwap(
  api: BagsApiClient,
  data: TradeRequestBody["data"]
): Promise<NextResponse> {
  const { quoteResponse, userPublicKey } = data;

  if (!quoteResponse || !userPublicKey) {
    return NextResponse.json(
      { error: "Missing required fields: quoteResponse, userPublicKey" },
      { status: 400 }
    );
  }

  try {
    const result = await api.createSwapTransaction(quoteResponse, userPublicKey);

    return NextResponse.json({
      success: true,
      transaction: result.swapTransaction,
      computeUnitLimit: result.computeUnitLimit,
      lastValidBlockHeight: result.lastValidBlockHeight,
      prioritizationFeeLamports: result.prioritizationFeeLamports,
    });
  } catch (error) {
    console.error("Swap error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create swap transaction" },
      { status: 500 }
    );
  }
}

// Helper endpoint to get SOL mint
export async function GET() {
  return NextResponse.json({ solMint: SOL_MINT });
}
