/**
 * Signature Verification Security Tests
 *
 * Tests cryptographic signature verification for admin authentication with:
 * - Valid signature verification
 * - Invalid signature rejection
 * - Replay attack prevention
 * - Timestamp validation
 * - Wallet address validation
 */

import { verifyAdminSignature, createAdminMessage } from "@/lib/verify-signature";
import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";

describe("Signature Verification Security", () => {
  // Generate a test keypair for signing
  let adminKeypair: Keypair;
  let adminWallet: string;
  let nonAdminKeypair: Keypair;
  let nonAdminWallet: string;

  beforeAll(() => {
    // Create deterministic test keypairs
    adminKeypair = Keypair.generate();
    adminWallet = adminKeypair.publicKey.toBase58();

    nonAdminKeypair = Keypair.generate();
    nonAdminWallet = nonAdminKeypair.publicKey.toBase58();
  });

  // Helper to create a valid signature
  function signMessage(message: string, keypair: Keypair): string {
    // Convert message to Uint8Array (using Buffer for Jest compatibility)
    const messageBytes = new Uint8Array(Buffer.from(message, "utf-8"));
    // Ensure secretKey is a proper Uint8Array (Jest environment compatibility)
    const secretKey = new Uint8Array(keypair.secretKey);
    const signature = nacl.sign.detached(messageBytes, secretKey);
    return Buffer.from(signature).toString("base64");
  }

  describe("createAdminMessage", () => {
    it("should create properly formatted message", () => {
      const timestamp = 1705000000000;
      const message = createAdminMessage("create-raffle", timestamp);

      expect(message).toBe("casino-admin:create-raffle:1705000000000");
    });

    it("should handle different actions", () => {
      const timestamp = Date.now();

      expect(createAdminMessage("draw", timestamp)).toContain("casino-admin:draw:");
      expect(createAdminMessage("toggle", timestamp)).toContain("casino-admin:toggle:");
      expect(createAdminMessage("init", timestamp)).toContain("casino-admin:init:");
    });

    it("should include exact timestamp", () => {
      const timestamp = 1234567890123;
      const message = createAdminMessage("test", timestamp);

      expect(message).toBe("casino-admin:test:1234567890123");
    });
  });

  describe("verifyAdminSignature - valid signatures", () => {
    it("should verify valid signature from admin wallet", () => {
      const timestamp = Date.now();
      const action = "create-raffle";
      const message = createAdminMessage(action, timestamp);
      const signature = signMessage(message, adminKeypair);

      const result = verifyAdminSignature(adminWallet, signature, action, timestamp, adminWallet);

      expect(result.verified).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should verify signature for different actions", () => {
      const timestamp = Date.now();
      const actions = ["create-raffle", "draw", "toggle", "init", "custom-action"];

      actions.forEach((action) => {
        const message = createAdminMessage(action, timestamp);
        const signature = signMessage(message, adminKeypair);

        const result = verifyAdminSignature(adminWallet, signature, action, timestamp, adminWallet);

        expect(result.verified).toBe(true);
      });
    });

    it("should verify signature at timestamp boundary (just within 5 minutes)", () => {
      const now = Date.now();
      // Timestamp 4 minutes 59 seconds ago (just within limit)
      const timestamp = now - 4 * 60 * 1000 - 59 * 1000;
      const message = createAdminMessage("test", timestamp);
      const signature = signMessage(message, adminKeypair);

      const result = verifyAdminSignature(adminWallet, signature, "test", timestamp, adminWallet);

      expect(result.verified).toBe(true);
    });
  });

  describe("verifyAdminSignature - invalid signatures", () => {
    it("should reject signature from non-admin wallet", () => {
      const timestamp = Date.now();
      const action = "create-raffle";
      const message = createAdminMessage(action, timestamp);
      const signature = signMessage(message, nonAdminKeypair);

      const result = verifyAdminSignature(
        nonAdminWallet, // Signing wallet
        signature,
        action,
        timestamp,
        adminWallet // Expected admin wallet is different
      );

      expect(result.verified).toBe(false);
      expect(result.error).toBe("Not admin wallet");
    });

    it("should reject tampered signature", () => {
      const timestamp = Date.now();
      const action = "create-raffle";
      const message = createAdminMessage(action, timestamp);
      const signature = signMessage(message, adminKeypair);

      // Tamper with signature
      const tamperedSignature = signature.slice(0, -4) + "XXXX";

      const result = verifyAdminSignature(
        adminWallet,
        tamperedSignature,
        action,
        timestamp,
        adminWallet
      );

      expect(result.verified).toBe(false);
    });

    it("should reject signature for wrong action", () => {
      const timestamp = Date.now();
      const signedAction = "create-raffle";
      const claimedAction = "draw"; // Different action

      const message = createAdminMessage(signedAction, timestamp);
      const signature = signMessage(message, adminKeypair);

      const result = verifyAdminSignature(
        adminWallet,
        signature,
        claimedAction, // Claiming different action
        timestamp,
        adminWallet
      );

      expect(result.verified).toBe(false);
      expect(result.error).toBe("Invalid signature");
    });

    it("should reject signature for wrong timestamp", () => {
      const signedTimestamp = Date.now();
      const claimedTimestamp = signedTimestamp + 1000; // Different timestamp

      const message = createAdminMessage("test", signedTimestamp);
      const signature = signMessage(message, adminKeypair);

      const result = verifyAdminSignature(
        adminWallet,
        signature,
        "test",
        claimedTimestamp, // Claiming different timestamp
        adminWallet
      );

      expect(result.verified).toBe(false);
      expect(result.error).toBe("Invalid signature");
    });

    it("should reject completely invalid signature", () => {
      const timestamp = Date.now();

      const result = verifyAdminSignature(
        adminWallet,
        "not-a-valid-base64-signature!!!",
        "test",
        timestamp,
        adminWallet
      );

      expect(result.verified).toBe(false);
    });

    it("should reject empty signature", () => {
      const timestamp = Date.now();

      const result = verifyAdminSignature(adminWallet, "", "test", timestamp, adminWallet);

      expect(result.verified).toBe(false);
    });
  });

  describe("verifyAdminSignature - replay attack prevention", () => {
    it("should reject signature with expired timestamp (> 5 minutes old)", () => {
      const now = Date.now();
      // Timestamp 6 minutes ago
      const expiredTimestamp = now - 6 * 60 * 1000;

      const message = createAdminMessage("test", expiredTimestamp);
      const signature = signMessage(message, adminKeypair);

      const result = verifyAdminSignature(
        adminWallet,
        signature,
        "test",
        expiredTimestamp,
        adminWallet
      );

      expect(result.verified).toBe(false);
      expect(result.error).toBe("Signature expired");
    });

    it("should reject signature with future timestamp (> 5 minutes ahead)", () => {
      const now = Date.now();
      // Timestamp 6 minutes in the future
      const futureTimestamp = now + 6 * 60 * 1000;

      const message = createAdminMessage("test", futureTimestamp);
      const signature = signMessage(message, adminKeypair);

      const result = verifyAdminSignature(
        adminWallet,
        signature,
        "test",
        futureTimestamp,
        adminWallet
      );

      expect(result.verified).toBe(false);
      expect(result.error).toBe("Signature expired");
    });

    it("should reject very old timestamp", () => {
      const veryOldTimestamp = Date.now() - 24 * 60 * 60 * 1000; // 1 day ago

      const message = createAdminMessage("test", veryOldTimestamp);
      const signature = signMessage(message, adminKeypair);

      const result = verifyAdminSignature(
        adminWallet,
        signature,
        "test",
        veryOldTimestamp,
        adminWallet
      );

      expect(result.verified).toBe(false);
      expect(result.error).toBe("Signature expired");
    });

    it("should reject reused signature with different timestamp claim", () => {
      const originalTimestamp = Date.now();
      const message = createAdminMessage("test", originalTimestamp);
      const signature = signMessage(message, adminKeypair);

      // First verification passes
      const firstResult = verifyAdminSignature(
        adminWallet,
        signature,
        "test",
        originalTimestamp,
        adminWallet
      );
      expect(firstResult.verified).toBe(true);

      // Attempt to reuse with different claimed timestamp
      const replayTimestamp = Date.now() + 1000;
      const replayResult = verifyAdminSignature(
        adminWallet,
        signature,
        "test",
        replayTimestamp, // Different timestamp
        adminWallet
      );
      expect(replayResult.verified).toBe(false);
    });
  });

  describe("verifyAdminSignature - wallet validation", () => {
    it("should reject invalid wallet address format", () => {
      const timestamp = Date.now();

      const result = verifyAdminSignature(
        "not-a-valid-solana-address",
        "signature",
        "test",
        timestamp,
        "not-a-valid-solana-address"
      );

      expect(result.verified).toBe(false);
      expect(result.error).toBe("Invalid wallet address");
    });

    it("should reject wallet address that's too short", () => {
      const timestamp = Date.now();

      const result = verifyAdminSignature("short", "signature", "test", timestamp, "short");

      expect(result.verified).toBe(false);
    });

    it("should reject wallet address with invalid characters", () => {
      const timestamp = Date.now();
      // Base58 doesn't include 0, O, I, l
      const invalidAddress = "0OIl" + "A".repeat(40);

      const result = verifyAdminSignature(
        invalidAddress,
        "signature",
        "test",
        timestamp,
        invalidAddress
      );

      expect(result.verified).toBe(false);
    });

    it("should handle case-sensitive wallet comparison", () => {
      const timestamp = Date.now();
      const message = createAdminMessage("test", timestamp);
      const signature = signMessage(message, adminKeypair);

      // Admin wallet with different case (Solana addresses are case-sensitive)
      const wrongCaseWallet = adminWallet.toLowerCase();

      const result = verifyAdminSignature(
        adminWallet,
        signature,
        "test",
        timestamp,
        wrongCaseWallet // Wrong case
      );

      expect(result.verified).toBe(false);
    });
  });

  describe("verifyAdminSignature - edge cases", () => {
    it("should handle action with special characters", () => {
      const timestamp = Date.now();
      const action = "test-action_with.special:chars";
      const message = createAdminMessage(action, timestamp);
      const signature = signMessage(message, adminKeypair);

      const result = verifyAdminSignature(adminWallet, signature, action, timestamp, adminWallet);

      expect(result.verified).toBe(true);
    });

    it("should handle empty action", () => {
      const timestamp = Date.now();
      const action = "";
      const message = createAdminMessage(action, timestamp);
      const signature = signMessage(message, adminKeypair);

      const result = verifyAdminSignature(adminWallet, signature, action, timestamp, adminWallet);

      expect(result.verified).toBe(true);
    });

    it("should handle very long action string", () => {
      const timestamp = Date.now();
      const action = "a".repeat(1000);
      const message = createAdminMessage(action, timestamp);
      const signature = signMessage(message, adminKeypair);

      const result = verifyAdminSignature(adminWallet, signature, action, timestamp, adminWallet);

      expect(result.verified).toBe(true);
    });

    it("should handle timestamp at epoch (0)", () => {
      // This should fail due to age check (way more than 5 minutes old)
      const result = verifyAdminSignature(adminWallet, "signature", "test", 0, adminWallet);

      expect(result.verified).toBe(false);
      expect(result.error).toBe("Signature expired");
    });

    it("should handle timestamp at max safe integer", () => {
      const result = verifyAdminSignature(
        adminWallet,
        "signature",
        "test",
        Number.MAX_SAFE_INTEGER,
        adminWallet
      );

      expect(result.verified).toBe(false);
      // Should fail due to future timestamp check
    });

    it("should handle negative timestamp", () => {
      const result = verifyAdminSignature(adminWallet, "signature", "test", -1000, adminWallet);

      expect(result.verified).toBe(false);
    });

    it("should catch and handle unexpected errors gracefully", () => {
      // This tests the try-catch block
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const result = verifyAdminSignature(
        adminWallet,
        null as any, // Force an error
        "test",
        Date.now(),
        adminWallet
      );

      expect(result.verified).toBe(false);
      expect(result.error).toBeDefined();
      consoleSpy.mockRestore();
    });
  });

  describe("verifyAdminSignature - message format security", () => {
    it("should not verify if message format is manipulated", () => {
      const timestamp = Date.now();
      // Sign a manipulated message format
      const manipulatedMessage = `admin-casino:test:${timestamp}`; // Wrong prefix order
      const signature = signMessage(manipulatedMessage, adminKeypair);

      const result = verifyAdminSignature(adminWallet, signature, "test", timestamp, adminWallet);

      expect(result.verified).toBe(false);
    });

    it("should not verify signature for different message structure", () => {
      const timestamp = Date.now();
      // Sign with extra data appended
      const extendedMessage = createAdminMessage("test", timestamp) + ":extra";
      const signature = signMessage(extendedMessage, adminKeypair);

      const result = verifyAdminSignature(adminWallet, signature, "test", timestamp, adminWallet);

      expect(result.verified).toBe(false);
    });

    it("should handle action containing colons", () => {
      const timestamp = Date.now();
      // Action contains colons - could potentially break message parsing
      const action = "test:with:colons";
      const message = createAdminMessage(action, timestamp);
      const signature = signMessage(message, adminKeypair);

      const result = verifyAdminSignature(adminWallet, signature, action, timestamp, adminWallet);

      expect(result.verified).toBe(true);
    });
  });

  describe("Signature verification timing consistency", () => {
    it("should verify quickly (< 100ms)", () => {
      const timestamp = Date.now();
      const message = createAdminMessage("test", timestamp);
      const signature = signMessage(message, adminKeypair);

      const start = performance.now();
      verifyAdminSignature(adminWallet, signature, "test", timestamp, adminWallet);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it("should reject invalid signatures in similar time to valid ones", () => {
      const timestamp = Date.now();
      const message = createAdminMessage("test", timestamp);
      const validSignature = signMessage(message, adminKeypair);
      const invalidSignature = validSignature.slice(0, -4) + "XXXX";

      // Time valid signature
      const validStart = performance.now();
      verifyAdminSignature(adminWallet, validSignature, "test", timestamp, adminWallet);
      const validDuration = performance.now() - validStart;

      // Time invalid signature
      const invalidStart = performance.now();
      verifyAdminSignature(adminWallet, invalidSignature, "test", timestamp, adminWallet);
      const invalidDuration = performance.now() - invalidStart;

      // Timing should be similar (within 50ms) to prevent timing attacks
      expect(Math.abs(validDuration - invalidDuration)).toBeLessThan(50);
    });
  });

  describe("verifyAdminSignature - array admin wallets", () => {
    it("should accept wallet that is in the admin wallet array", () => {
      const timestamp = Date.now();
      const message = createAdminMessage("test", timestamp);
      const signature = signMessage(message, adminKeypair);

      // Pass array with admin wallet included
      const result = verifyAdminSignature(adminWallet, signature, "test", timestamp, [
        nonAdminWallet,
        adminWallet,
        "someOtherWallet",
      ]);
      expect(result.verified).toBe(true);
    });

    it("should reject wallet not in the admin wallet array", () => {
      const timestamp = Date.now();
      const message = createAdminMessage("test", timestamp);
      const signature = signMessage(message, adminKeypair);

      // Pass array WITHOUT admin wallet
      const result = verifyAdminSignature(adminWallet, signature, "test", timestamp, [
        nonAdminWallet,
        "someOtherWallet",
      ]);
      expect(result.verified).toBe(false);
      expect(result.error).toBe("Not admin wallet");
    });

    it("should work with single-element array", () => {
      const timestamp = Date.now();
      const message = createAdminMessage("test", timestamp);
      const signature = signMessage(message, adminKeypair);

      const result = verifyAdminSignature(adminWallet, signature, "test", timestamp, [
        adminWallet,
      ]);
      expect(result.verified).toBe(true);
    });

    it("should reject with empty array", () => {
      const timestamp = Date.now();
      const message = createAdminMessage("test", timestamp);
      const signature = signMessage(message, adminKeypair);

      const result = verifyAdminSignature(adminWallet, signature, "test", timestamp, []);
      expect(result.verified).toBe(false);
      expect(result.error).toBe("Not admin wallet");
    });
  });

  describe("verifyAdminSignature - exact 5-minute boundary", () => {
    it("should accept signature at exactly 5 minutes ago", () => {
      // Use jest.spyOn to mock Date.now for precise boundary testing
      const now = 1700000000000; // Fixed reference point
      const spy = jest.spyOn(Date, "now").mockReturnValue(now);

      const timestamp = now - 5 * 60 * 1000; // Exactly 5 minutes ago
      const message = createAdminMessage("test", timestamp);
      const signature = signMessage(message, adminKeypair);

      const result = verifyAdminSignature(adminWallet, signature, "test", timestamp, adminWallet);
      // Math.abs(now - timestamp) = 300000 = SIGNATURE_MAX_AGE_MS, so NOT > 300000
      expect(result.verified).toBe(true);

      spy.mockRestore();
    });

    it("should reject signature at 5 minutes + 1ms ago", () => {
      const now = 1700000000000;
      const spy = jest.spyOn(Date, "now").mockReturnValue(now);

      const timestamp = now - 5 * 60 * 1000 - 1; // 5 minutes + 1ms ago
      const message = createAdminMessage("test", timestamp);
      const signature = signMessage(message, adminKeypair);

      const result = verifyAdminSignature(adminWallet, signature, "test", timestamp, adminWallet);
      // Math.abs(now - timestamp) = 300001 > 300000
      expect(result.verified).toBe(false);
      expect(result.error).toBe("Signature expired");

      spy.mockRestore();
    });

    it("should accept signature at exactly 5 minutes in future", () => {
      const now = 1700000000000;
      const spy = jest.spyOn(Date, "now").mockReturnValue(now);

      const timestamp = now + 5 * 60 * 1000; // Exactly 5 minutes ahead
      const message = createAdminMessage("test", timestamp);
      const signature = signMessage(message, adminKeypair);

      const result = verifyAdminSignature(adminWallet, signature, "test", timestamp, adminWallet);
      expect(result.verified).toBe(true);

      spy.mockRestore();
    });

    it("should reject signature at 5 minutes + 1ms in future", () => {
      const now = 1700000000000;
      const spy = jest.spyOn(Date, "now").mockReturnValue(now);

      const timestamp = now + 5 * 60 * 1000 + 1;
      const message = createAdminMessage("test", timestamp);
      const signature = signMessage(message, adminKeypair);

      const result = verifyAdminSignature(adminWallet, signature, "test", timestamp, adminWallet);
      expect(result.verified).toBe(false);
      expect(result.error).toBe("Signature expired");

      spy.mockRestore();
    });
  });
});
