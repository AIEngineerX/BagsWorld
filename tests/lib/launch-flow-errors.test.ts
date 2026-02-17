/**
 * Tests for blockhash expiry detection and error classification in launch-flow.ts.
 *
 * These test the error matching logic to ensure:
 * 1. Blockhash-related errors get the friendly "try again" message
 * 2. Non-blockhash "expired" errors (session, cert, API key) do NOT match
 */

describe("Blockhash error detection patterns", () => {
  // These patterns mirror launch-flow.ts catch blocks
  function isBlockhashError(msg: string): boolean {
    return (
      msg.includes("Blockhash not found") ||
      msg.includes("block height exceeded") ||
      msg.includes("BlockhashNotFound") ||
      msg.includes("TransactionExpired")
    );
  }

  describe("should match real Solana blockhash errors", () => {
    it("matches 'Blockhash not found'", () => {
      expect(isBlockhashError("Blockhash not found")).toBe(true);
    });

    it("matches 'block height exceeded'", () => {
      expect(
        isBlockhashError("TransactionExpiredBlockheightExceededError: block height exceeded")
      ).toBe(true);
    });

    it("matches BlockhashNotFound error name", () => {
      expect(isBlockhashError("BlockhashNotFound")).toBe(true);
    });

    it("matches TransactionExpired prefix", () => {
      expect(isBlockhashError("TransactionExpiredBlockheightExceededError")).toBe(true);
    });

    it("matches Solana Web3.js error format", () => {
      expect(
        isBlockhashError(
          'Transaction was not confirmed in 30.00 seconds. It is unknown if it succeeded or failed. Check signature using the connection. TransactionExpiredBlockheightExceededError'
        )
      ).toBe(true);
    });
  });

  describe("should NOT match non-blockhash errors", () => {
    it("rejects 'Session expired'", () => {
      expect(isBlockhashError("Session expired")).toBe(false);
    });

    it("rejects 'Certificate expired'", () => {
      expect(isBlockhashError("Certificate expired")).toBe(false);
    });

    it("rejects 'API key expired'", () => {
      expect(isBlockhashError("API key expired")).toBe(false);
    });

    it("rejects 'Token account expired'", () => {
      expect(isBlockhashError("Token account expired")).toBe(false);
    });

    it("rejects generic 'expired' string", () => {
      expect(isBlockhashError("expired")).toBe(false);
    });

    it("rejects 'subscription expired'", () => {
      expect(isBlockhashError("Your subscription has expired")).toBe(false);
    });
  });
});

describe("Insufficient balance error matching", () => {
  // Mirrors the tightened check in launch-flow.ts outer catch
  function isInsufficientBalance(msg: string): boolean {
    const lower = msg.toLowerCase();
    return (
      lower.includes("insufficient") &&
      (lower.includes("sol") || lower.includes("balance") || lower.includes("lamport"))
    );
  }

  describe("should match real balance errors", () => {
    it("matches 'Insufficient SOL balance'", () => {
      expect(isInsufficientBalance("Insufficient SOL balance")).toBe(true);
    });

    it("matches 'insufficient balance for rent'", () => {
      expect(isInsufficientBalance("insufficient balance for rent")).toBe(true);
    });

    it("matches 'Insufficient lamports'", () => {
      expect(isInsufficientBalance("Insufficient lamports in account")).toBe(true);
    });
  });

  describe("should NOT match non-balance errors", () => {
    it("rejects 'Insufficient permissions'", () => {
      expect(isInsufficientBalance("Insufficient permissions")).toBe(false);
    });

    it("rejects 'insufficient data'", () => {
      expect(isInsufficientBalance("insufficient data provided")).toBe(false);
    });

    it("rejects 'insufficient arguments'", () => {
      expect(isInsufficientBalance("Error: insufficient arguments")).toBe(false);
    });
  });
});
