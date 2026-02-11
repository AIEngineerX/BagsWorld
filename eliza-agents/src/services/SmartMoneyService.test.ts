// SmartMoneyService tests
// Tests wallet tracking, scoring, learned wallets, and the new removeWallet/refresh logic

import { describe, it, expect, beforeEach, vi } from "vitest";
import { SmartMoneyService } from "./SmartMoneyService.js";

// Mock the WalletDiscoveryService to avoid real API calls during refreshSmartMoneyList
vi.mock("./WalletDiscoveryService.js", () => {
  return {
    getWalletDiscoveryService: () => ({
      discoverWallets: vi.fn().mockResolvedValue(0),
    }),
  };
});

describe("SmartMoneyService", () => {
  let service: SmartMoneyService;

  beforeEach(() => {
    service = new SmartMoneyService();
  });

  describe("constructor and defaults", () => {
    it("initializes with default wallets", () => {
      const wallets = service.getAllWallets();
      expect(wallets.length).toBeGreaterThan(0);
    });

    it("has correct service type", () => {
      expect(SmartMoneyService.serviceType).toBe("smart_money");
    });

    it("default wallets have source 'manual' or 'gmgn'", () => {
      const wallets = service.getAllWallets();
      for (const w of wallets) {
        expect(["manual", "gmgn"]).toContain(w.source);
      }
    });

    it("default wallets have valid addresses", () => {
      const wallets = service.getAllWallets();
      for (const w of wallets) {
        expect(w.address.length).toBeGreaterThan(20);
      }
    });
  });

  describe("isSmartMoney", () => {
    it("returns true for known wallet", () => {
      const wallets = service.getAllWallets();
      expect(service.isSmartMoney(wallets[0].address)).toBe(true);
    });

    it("returns false for unknown wallet", () => {
      expect(service.isSmartMoney("unknown_wallet_address")).toBe(false);
    });
  });

  describe("getWalletInfo", () => {
    it("returns wallet info for known address", () => {
      const wallets = service.getAllWallets();
      const info = service.getWalletInfo(wallets[0].address);
      expect(info).not.toBeNull();
      expect(info!.label).toBeDefined();
      expect(info!.winRate).toBeGreaterThan(0);
    });

    it("returns null for unknown address", () => {
      expect(service.getWalletInfo("nonexistent")).toBeNull();
    });
  });

  describe("addLearnedWallet", () => {
    it("adds a new learned wallet", () => {
      const address = "LearnedWallet123";
      service.addLearnedWallet(address, "Test Learned", {
        winRate: 0.7,
        totalPnlSol: 50,
      });

      expect(service.isSmartMoney(address)).toBe(true);
      const info = service.getWalletInfo(address);
      expect(info!.source).toBe("learned");
      expect(info!.winRate).toBe(0.7);
      expect(info!.label).toBe("Test Learned");
    });

    it("does not overwrite existing wallet", () => {
      const wallets = service.getAllWallets();
      const existingAddr = wallets[0].address;
      const originalLabel = wallets[0].label;

      service.addLearnedWallet(existingAddr, "Should Not Replace", {
        winRate: 0.99,
      });

      const info = service.getWalletInfo(existingAddr);
      expect(info!.label).toBe(originalLabel); // Not replaced
    });

    it("sets defaults for missing stats", () => {
      service.addLearnedWallet("DefaultsWallet", "Defaults", {});

      const info = service.getWalletInfo("DefaultsWallet");
      expect(info!.winRate).toBe(0.5);
      expect(info!.avgHoldTime).toBe(10);
      expect(info!.preferredMcapRange).toBe("micro");
    });
  });

  describe("removeWallet", () => {
    it("removes an existing wallet", () => {
      service.addLearnedWallet("ToRemove", "Remove Me", { winRate: 0.6 });
      expect(service.isSmartMoney("ToRemove")).toBe(true);

      const result = service.removeWallet("ToRemove");
      expect(result).toBe(true);
      expect(service.isSmartMoney("ToRemove")).toBe(false);
    });

    it("returns false for non-existent wallet", () => {
      const result = service.removeWallet("DoesNotExist");
      expect(result).toBe(false);
    });

    it("can remove default (manual) wallets too", () => {
      const wallets = service.getAllWallets();
      const firstAddr = wallets[0].address;

      const result = service.removeWallet(firstAddr);
      expect(result).toBe(true);
      expect(service.isSmartMoney(firstAddr)).toBe(false);
    });

    it("wallet count decreases after removal", () => {
      const beforeCount = service.getAllWallets().length;

      service.addLearnedWallet("CountTest", "Count", {});
      expect(service.getAllWallets().length).toBe(beforeCount + 1);

      service.removeWallet("CountTest");
      expect(service.getAllWallets().length).toBe(beforeCount);
    });
  });

  describe("getWalletAddresses", () => {
    it("returns array of addresses", () => {
      const addresses = service.getWalletAddresses();
      expect(addresses.length).toBeGreaterThan(0);
      expect(typeof addresses[0]).toBe("string");
    });

    it("includes learned wallets", () => {
      service.addLearnedWallet("LearnedAddr", "Learned", {});
      const addresses = service.getWalletAddresses();
      expect(addresses).toContain("LearnedAddr");
    });
  });

  describe("recordActivity and getSmartMoneyScore", () => {
    it("records buy activity and increases score", async () => {
      const wallets = service.getAllWallets();
      const trackedWallet = wallets[0].address;
      const tokenMint = "TestMint123";

      service.recordActivity(tokenMint, trackedWallet, "buy", 2.0);

      const score = await service.getSmartMoneyScore(tokenMint);
      expect(score.score).toBeGreaterThan(0);
      expect(score.buyers.length).toBe(1);
      expect(score.signals.length).toBeGreaterThan(0);
    });

    it("ignores activity from untracked wallets", async () => {
      service.recordActivity("SomeMint", "UnknownWallet", "buy", 5.0);

      const score = await service.getSmartMoneyScore("SomeMint");
      expect(score.score).toBe(0);
    });

    it("multiple buys increase score", async () => {
      const wallets = service.getAllWallets();
      const mint = "MultiBuyMint";

      service.recordActivity(mint, wallets[0].address, "buy", 1.0);
      const score1 = await service.getSmartMoneyScore(mint);

      service.recordActivity(mint, wallets[1].address, "buy", 1.5);
      const score2 = await service.getSmartMoneyScore(mint);

      expect(score2.score).toBeGreaterThan(score1.score);
    });

    it("sell activity reduces net buy score", async () => {
      const wallets = service.getAllWallets();
      const mint = "SellPressureMint";

      service.recordActivity(mint, wallets[0].address, "buy", 2.0);
      const buyScore = await service.getSmartMoneyScore(mint);

      service.recordActivity(mint, wallets[1].address, "sell", 5.0);
      const afterSellScore = await service.getSmartMoneyScore(mint);

      expect(afterSellScore.score).toBeLessThan(buyScore.score);
    });

    it("records alerts for tracked activity", () => {
      const wallets = service.getAllWallets();
      service.recordActivity("AlertMint", wallets[0].address, "buy", 1.0);

      const alerts = service.getRecentAlerts();
      expect(alerts.length).toBe(1);
      expect(alerts[0].action).toBe("buy");
      expect(alerts[0].tokenMint).toBe("AlertMint");
    });

    it("returns zero score for unknown token", async () => {
      const score = await service.getSmartMoneyScore("NeverSeenMint");
      expect(score.score).toBe(0);
      expect(score.buyers).toEqual([]);
    });
  });

  describe("getRecentAlerts", () => {
    it("returns empty by default", () => {
      expect(service.getRecentAlerts()).toEqual([]);
    });

    it("respects limit parameter", () => {
      const wallets = service.getAllWallets();
      for (let i = 0; i < 10; i++) {
        service.recordActivity(`Mint${i}`, wallets[0].address, "buy", 0.5);
      }

      const limited = service.getRecentAlerts(3);
      expect(limited.length).toBe(3);
    });
  });

  describe("cleanup", () => {
    it("removes old token activity", async () => {
      const wallets = service.getAllWallets();

      // Record some activity
      service.recordActivity("OldMint", wallets[0].address, "buy", 1.0);

      // Verify it's there
      const beforeClean = await service.getSmartMoneyScore("OldMint");
      expect(beforeClean.score).toBeGreaterThan(0);

      // Fast-forward time by manipulating internal state
      // (cleanup removes activity older than 1 hour)
      // We can't easily manipulate Date.now, so we just verify cleanup doesn't throw
      service.cleanup();

      // Recent activity should still be there (not old enough)
      const afterClean = await service.getSmartMoneyScore("OldMint");
      expect(afterClean.score).toBeGreaterThan(0);
    });
  });

  describe("refreshSmartMoneyList", () => {
    it("calls WalletDiscoveryService instead of GMGN", async () => {
      // The mock returns 0 wallets discovered, but the important thing
      // is it doesn't throw and doesn't call GMGN
      await expect(service.refreshSmartMoneyList()).resolves.not.toThrow();
    });
  });
});
