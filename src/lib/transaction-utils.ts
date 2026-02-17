import { Connection, Transaction, VersionedTransaction, SendOptions } from "@solana/web3.js";
import bs58 from "bs58";

/**
 * Pre-simulate a transaction with sigVerify:false so unsigned txs can be
 * validated before the wallet popup. Throws on simulation failure.
 */
export async function preSimulateTransaction(
  connection: Connection,
  transaction: Transaction | VersionedTransaction
): Promise<void> {
  if (transaction instanceof VersionedTransaction) {
    const result = await connection.simulateTransaction(transaction, {
      sigVerify: false,
      commitment: "confirmed",
    });

    if (result.value.err) {
      const logs = result.value.logs?.join("\n") ?? "";
      throw new Error(
        `Transaction simulation failed: ${JSON.stringify(result.value.err)}${logs ? `\nLogs:\n${logs}` : ""}`
      );
    }
  } else {
    // Legacy Transaction — raw RPC call needed for sigVerify:false
    const serialized = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    const encoded = serialized.toString("base64");

    // @ts-expect-error — _rpcRequest is internal but the only way to
    // pass sigVerify:false for legacy transactions.
    const result = await connection._rpcRequest("simulateTransaction", [
      encoded,
      { sigVerify: false, commitment: "confirmed", encoding: "base64" },
    ]);

    const simResult = result?.result?.value;
    if (simResult?.err) {
      const logs = simResult.logs?.join("\n") ?? "";
      throw new Error(
        `Transaction simulation failed: ${JSON.stringify(simResult.err)}${logs ? `\nLogs:\n${logs}` : ""}`
      );
    }
  }
}

/** Deserialize a transaction from base58/base64. Tries Versioned first, then legacy. */
export function deserializeTransaction(
  encoded: string | Record<string, unknown>,
  context: string = "transaction"
): VersionedTransaction | Transaction {
  let txString: string | undefined;

  if (typeof encoded === "object" && encoded !== null) {
    const possibleFields = ["transaction", "tx", "data", "rawTransaction", "serializedTransaction"];
    for (const field of possibleFields) {
      if (typeof encoded[field] === "string") {
        txString = encoded[field] as string;
        break;
      }
    }
    if (!txString) {
      throw new Error(`Invalid ${context}: no transaction string found in object`);
    }
  } else if (typeof encoded === "string") {
    txString = encoded;
  } else {
    throw new Error(`Invalid ${context}: expected string or object`);
  }

  if (!txString || txString.length < 50) {
    throw new Error(`Invalid ${context}: too short`);
  }

  txString = txString.trim().replace(/\s/g, "");
  // Heuristic: Base64 uses +, /, = which are not in Base58. If absent, try Base58 first.
  const isLikelyBase64 = txString.includes("+") || txString.includes("/") || txString.endsWith("=");

  let buffer: Uint8Array;
  try {
    buffer = isLikelyBase64 ? Buffer.from(txString, "base64") : bs58.decode(txString);
    if (buffer.length < 50) throw new Error("Buffer too small");
  } catch {
    try {
      buffer = isLikelyBase64 ? bs58.decode(txString) : Buffer.from(txString, "base64");
    } catch {
      throw new Error(`${context}: decode failed`);
    }
  }

  try {
    return VersionedTransaction.deserialize(buffer);
  } catch {
    try {
      return Transaction.from(buffer);
    } catch {
      throw new Error(`Failed to deserialize ${context}`);
    }
  }
}

/** Check whether a transaction already carries non-zero signatures (pre-signed). */
export function hasExistingSignatures(transaction: Transaction | VersionedTransaction): boolean {
  if (transaction instanceof VersionedTransaction) {
    return transaction.signatures.some((sig) => sig.some((byte) => byte !== 0));
  }
  return transaction.signatures.some(
    (sig) => sig.signature && sig.signature.some((byte) => byte !== 0)
  );
}

/** Send a signed transaction with preflight validation enabled. */
export async function sendSignedTransaction(
  connection: Connection,
  signedTx: Transaction | VersionedTransaction,
  opts?: Partial<SendOptions>
): Promise<string> {
  return connection.sendRawTransaction(signedTx.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
    maxRetries: 3,
    ...opts,
  });
}
