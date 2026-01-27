/**
 * Oracle Prize Pool System Tests
 *
 * Tests the prize distribution algorithm and signature verification.
 */

import { Keypair, PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";

import { calculatePrizeDistribution } from "@/lib/neon";

describe("Prize Distribution Algorithm", () => {
  describe("Basic Distribution", () => {
    it("should return full prize for single winner", () => {
      const prizePool = BigInt(1_000_000_000); // 1 SOL
      const prizes = calculatePrizeDistribution(1, prizePool);

      expect(prizes).toHaveLength(1);
      expect(prizes[0]).toBe(prizePool);
    });

    it("should return empty array for zero winners", () => {
      const prizes = calculatePrizeDistribution(0, BigInt(1_000_000_000));
      expect(prizes).toHaveLength(0);
    });

    it("should distribute more to earlier predictors", () => {
      const prizePool = BigInt(1_000_000_000);
      const prizes = calculatePrizeDistribution(5, prizePool);

      expect(prizes).toHaveLength(5);
      for (let i = 0; i < prizes.length - 1; i++) {
        expect(prizes[i]).toBeGreaterThan(prizes[i + 1]);
      }
    });

    it("should ensure all prizes sum to exactly prize pool", () => {
      const prizePool = BigInt(1_000_000_000);

      for (let winners = 1; winners <= 20; winners++) {
        const prizes = calculatePrizeDistribution(winners, prizePool);
        const total = prizes.reduce((sum, p) => sum + p, BigInt(0));
        expect(total).toBe(prizePool);
      }
    });
  });

  describe("Boundary Conditions", () => {
    it("should handle very small prize pool (0.001 SOL)", () => {
      const prizePool = BigInt(1_000_000);
      const prizes = calculatePrizeDistribution(3, prizePool);

      expect(prizes).toHaveLength(3);
      prizes.forEach((p) => expect(p).toBeGreaterThanOrEqual(BigInt(0)));
      expect(prizes.reduce((sum, p) => sum + p, BigInt(0))).toBe(prizePool);
    });

    it("should handle maximum prize pool (1 SOL)", () => {
      const prizePool = BigInt(1_000_000_000);
      const prizes = calculatePrizeDistribution(10, prizePool);

      expect(prizes).toHaveLength(10);
      expect(prizes.reduce((sum, p) => sum + p, BigInt(0))).toBe(prizePool);
    });

    it("should handle 2 winners correctly", () => {
      const prizePool = BigInt(1_000_000_000);
      const prizes = calculatePrizeDistribution(2, prizePool);

      expect(prizes).toHaveLength(2);
      expect(prizes[0]).toBeGreaterThan(prizes[1]);
      expect(prizes[0] + prizes[1]).toBe(prizePool);
    });

    it("should handle 50 winners", () => {
      const prizePool = BigInt(1_000_000_000);
      const prizes = calculatePrizeDistribution(50, prizePool);

      expect(prizes).toHaveLength(50);
      expect(prizes.reduce((sum, p) => sum + p, BigInt(0))).toBe(prizePool);
      prizes.forEach((p) => expect(p).toBeGreaterThanOrEqual(BigInt(0)));
    });

    it("should handle 100 winners without precision loss", () => {
      const prizePool = BigInt(1_000_000_000);
      const prizes = calculatePrizeDistribution(100, prizePool);

      expect(prizes).toHaveLength(100);
      expect(prizes.reduce((sum, p) => sum + p, BigInt(0))).toBe(prizePool);
    });
  });

  describe("Distribution Fairness", () => {
    it("should give first place significantly more than last place", () => {
      const prizePool = BigInt(1_000_000_000);
      const prizes = calculatePrizeDistribution(10, prizePool);

      const firstPlace = Number(prizes[0]);
      const lastPlace = Number(prizes[9]);

      expect(firstPlace / lastPlace).toBeGreaterThan(3);
    });

    it("should follow power law distribution (1.5 exponent)", () => {
      const prizePool = BigInt(1_000_000_000);
      const winners = 5;
      const prizes = calculatePrizeDistribution(winners, prizePool);

      const weights = [];
      let totalWeight = 0;
      for (let rank = 1; rank <= winners; rank++) {
        const weight = Math.pow(winners - rank + 1, 1.5);
        weights.push(weight);
        totalWeight += weight;
      }

      const tolerance = Number(prizePool) * 0.01;

      for (let i = 0; i < winners - 1; i++) {
        const expectedShare = weights[i] / totalWeight;
        const expectedPrize = Number(prizePool) * expectedShare;
        const actualPrize = Number(prizes[i]);

        expect(Math.abs(actualPrize - expectedPrize)).toBeLessThan(tolerance);
      }
    });

    it("should ensure last place gets positive prize with enough pool", () => {
      const prizePool = BigInt(100_000_000);
      const prizes = calculatePrizeDistribution(10, prizePool);

      expect(prizes[9]).toBeGreaterThan(BigInt(0));
    });
  });

  describe("Edge Cases", () => {
    it("should handle prize pool of exactly 1 lamport", () => {
      const prizes = calculatePrizeDistribution(1, BigInt(1));
      expect(prizes[0]).toBe(BigInt(1));
    });

    it("should handle prize pool of 0", () => {
      const prizes = calculatePrizeDistribution(5, BigInt(0));

      expect(prizes).toHaveLength(5);
      prizes.forEach((p) => expect(p).toBe(BigInt(0)));
    });

    it("should handle very large prize pool", () => {
      const prizePool = BigInt("1000000000000000");
      const prizes = calculatePrizeDistribution(5, prizePool);

      expect(prizes.reduce((sum, p) => sum + p, BigInt(0))).toBe(prizePool);
    });

    it("should not lose lamports due to rounding", () => {
      const prizePool = BigInt(999_999_999);

      for (let winners = 2; winners <= 50; winners++) {
        const prizes = calculatePrizeDistribution(winners, prizePool);
        const total = prizes.reduce((sum, p) => sum + p, BigInt(0));
        expect(total).toBe(prizePool);
      }
    });
  });
});

describe("Claim Signature Verification", () => {
  const CLAIM_MESSAGE = "Sign to claim your Oracle winnings from BagsWorld";

  function signMessage(message: string, keypair: Keypair): string {
    const messageBytes = new Uint8Array(Buffer.from(message, "utf-8"));
    const secretKey = new Uint8Array(keypair.secretKey);
    const signature = nacl.sign.detached(messageBytes, secretKey);
    return bs58.encode(signature);
  }

  function verifySignature(message: string, signatureB58: string, publicKey: PublicKey): boolean {
    const messageBytes = new Uint8Array(Buffer.from(message, "utf-8"));
    const signatureBytes = new Uint8Array(bs58.decode(signatureB58));
    const publicKeyBytes = new Uint8Array(publicKey.toBytes());

    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  }

  describe("Valid Signatures", () => {
    it("should verify correct signature from wallet owner", () => {
      const keypair = Keypair.generate();
      const signature = signMessage(CLAIM_MESSAGE, keypair);

      const isValid = verifySignature(CLAIM_MESSAGE, signature, keypair.publicKey);

      expect(isValid).toBe(true);
    });

    it("should produce 64-byte bs58 encoded signature", () => {
      const keypair = Keypair.generate();
      const signature = signMessage(CLAIM_MESSAGE, keypair);

      expect(() => bs58.decode(signature)).not.toThrow();
      expect(bs58.decode(signature).length).toBe(64);
    });
  });

  describe("Invalid Signatures", () => {
    it("should reject signature from wrong wallet", () => {
      const correctKeypair = Keypair.generate();
      const wrongKeypair = Keypair.generate();

      const signature = signMessage(CLAIM_MESSAGE, wrongKeypair);
      const isValid = verifySignature(CLAIM_MESSAGE, signature, correctKeypair.publicKey);

      expect(isValid).toBe(false);
    });

    it("should reject tampered signature", () => {
      const keypair = Keypair.generate();
      const signature = signMessage(CLAIM_MESSAGE, keypair);

      const tamperedBytes = bs58.decode(signature);
      tamperedBytes[0] = tamperedBytes[0] ^ 0xff;
      const tamperedSignature = bs58.encode(tamperedBytes);

      const isValid = verifySignature(CLAIM_MESSAGE, tamperedSignature, keypair.publicKey);

      expect(isValid).toBe(false);
    });

    it("should reject signature for wrong message", () => {
      const keypair = Keypair.generate();
      const signature = signMessage("Different message", keypair);

      const isValid = verifySignature(CLAIM_MESSAGE, signature, keypair.publicKey);

      expect(isValid).toBe(false);
    });

    it("should throw on invalid base58 signature", () => {
      expect(() => bs58.decode("not-valid-base58!!!")).toThrow();
    });

    it("should throw on empty signature", () => {
      const keypair = Keypair.generate();

      expect(() => {
        const decoded = bs58.decode("");
        const messageBytes = new Uint8Array(Buffer.from(CLAIM_MESSAGE, "utf-8"));
        const signatureBytes = new Uint8Array(decoded);
        const publicKeyBytes = new Uint8Array(keypair.publicKey.toBytes());
        nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
      }).toThrow();
    });

    it("should throw on truncated signature", () => {
      const keypair = Keypair.generate();
      const signature = signMessage(CLAIM_MESSAGE, keypair);
      const truncated = bs58.encode(bs58.decode(signature).slice(0, 32));

      expect(() => {
        const messageBytes = new Uint8Array(Buffer.from(CLAIM_MESSAGE, "utf-8"));
        const signatureBytes = new Uint8Array(bs58.decode(truncated));
        const publicKeyBytes = new Uint8Array(keypair.publicKey.toBytes());
        nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
      }).toThrow();
    });
  });

  describe("Wallet Address Validation", () => {
    it("should validate correct Solana wallet address", () => {
      const keypair = Keypair.generate();
      const wallet = keypair.publicKey.toBase58();

      expect(() => new PublicKey(wallet)).not.toThrow();
      expect(new PublicKey(wallet).toBase58()).toBe(wallet);
    });

    it("should reject invalid wallet addresses", () => {
      const invalidAddresses = [
        "not-a-valid-address",
        "1234567890",
        "",
        "0x1234567890abcdef",
        "too-short",
      ];

      invalidAddresses.forEach((addr) => {
        expect(() => new PublicKey(addr)).toThrow();
      });
    });

    it("should reject wallet with invalid base58 characters", () => {
      const invalidAddress = "0OIl" + "A".repeat(40);
      expect(() => new PublicKey(invalidAddress)).toThrow();
    });
  });
});
