import { NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";

/**
 * Server-side transaction sending endpoint
 * This keeps the RPC URL secret (no NEXT_PUBLIC_ prefix)
 */

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

export async function POST(request: Request) {
  try {
    const { signedTransaction } = await request.json();

    if (!signedTransaction) {
      return NextResponse.json({ error: "Missing signedTransaction" }, { status: 400 });
    }

    const connection = new Connection(SOLANA_RPC_URL, "confirmed");

    // Decode the base64 signed transaction
    const txBuffer = Buffer.from(signedTransaction, "base64");

    // Send the raw transaction
    const txid = await connection.sendRawTransaction(txBuffer, {
      skipPreflight: false,
      maxRetries: 3,
    });

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(txid, "confirmed");

    if (confirmation.value.err) {
      return NextResponse.json({
        error: "Transaction failed",
        details: confirmation.value.err,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      txid,
    });
  } catch (error) {
    console.error("[send-transaction] Error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Failed to send transaction",
    }, { status: 500 });
  }
}
