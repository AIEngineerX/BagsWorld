// HeliusService tests
// Tests getTokenEarlyBuyers, rate limiting, and core trade parsing

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { HeliusService, type EarlyBuyer } from "./HeliusService.js";

describe("HeliusService", () => {
  let service: HeliusService;

  beforeEach(() => {
    // Set env for configured mode
    process.env.HELIUS_API_KEY = "test-api-key";
    service = new HeliusService();
    mockFetch.mockReset();
  });

  afterEach(() => {
    delete process.env.HELIUS_API_KEY;
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("initializes as configured when API key set", () => {
      expect(service.isReady()).toBe(true);
    });

    it("initializes as unconfigured when no API key", () => {
      delete process.env.HELIUS_API_KEY;
      const unconfigured = new HeliusService();
      expect(unconfigured.isReady()).toBe(false);
    });
  });

  describe("getTokenEarlyBuyers", () => {
    it("returns empty array when not configured", async () => {
      delete process.env.HELIUS_API_KEY;
      const unconfigured = new HeliusService();

      const result = await unconfigured.getTokenEarlyBuyers("SomeToken");
      expect(result).toEqual([]);
    });

    it("returns empty array when API returns error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await service.getTokenEarlyBuyers("ErrorToken");
      expect(result).toEqual([]);
    });

    it("returns empty array when no transactions found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const result = await service.getTokenEarlyBuyers("EmptyToken");
      expect(result).toEqual([]);
    });

    it("parses SWAP transactions and extracts early buyers", async () => {
      const tokenMint = "TargetTokenMint123";
      const baseTimestamp = 1700000000; // Unix seconds

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          // Early buy: SOL in, token out (within first hour)
          {
            signature: "sig_buy1",
            timestamp: baseTimestamp + 300, // 5 min after first trade
            type: "SWAP",
            feePayer: "EarlyBuyerWallet1",
            events: {
              swap: {
                nativeInput: { amount: 2_000_000_000 }, // 2 SOL
                tokenOutputs: [
                  {
                    mint: tokenMint,
                    rawTokenAmount: { tokenAmount: "1000000" },
                  },
                ],
              },
            },
          },
          // Another early buy
          {
            signature: "sig_buy2",
            timestamp: baseTimestamp + 600, // 10 min after
            type: "SWAP",
            feePayer: "EarlyBuyerWallet2",
            events: {
              swap: {
                nativeInput: { amount: 500_000_000 }, // 0.5 SOL
                tokenOutputs: [
                  {
                    mint: tokenMint,
                    rawTokenAmount: { tokenAmount: "500000" },
                  },
                ],
              },
            },
          },
          // First transaction (determines the epoch)
          {
            signature: "sig_first",
            timestamp: baseTimestamp,
            type: "SWAP",
            feePayer: "FirstBuyer",
            events: {
              swap: {
                nativeInput: { amount: 1_000_000_000 },
                tokenOutputs: [
                  {
                    mint: tokenMint,
                    rawTokenAmount: { tokenAmount: "2000000" },
                  },
                ],
              },
            },
          },
          // Late buy: after 1 hour window (should be excluded)
          {
            signature: "sig_late",
            timestamp: baseTimestamp + 7200, // 2 hours after
            type: "SWAP",
            feePayer: "LateBuyer",
            events: {
              swap: {
                nativeInput: { amount: 3_000_000_000 },
                tokenOutputs: [
                  {
                    mint: tokenMint,
                    rawTokenAmount: { tokenAmount: "500000" },
                  },
                ],
              },
            },
          },
        ],
      });

      const result = await service.getTokenEarlyBuyers(tokenMint, 3600);

      // Should include 3 early buyers (FirstBuyer, EarlyBuyerWallet1, EarlyBuyerWallet2)
      // but NOT LateBuyer (timestamp > cutoff)
      expect(result.length).toBe(3);

      const wallets = result.map((b: EarlyBuyer) => b.wallet);
      expect(wallets).toContain("FirstBuyer");
      expect(wallets).toContain("EarlyBuyerWallet1");
      expect(wallets).toContain("EarlyBuyerWallet2");
      expect(wallets).not.toContain("LateBuyer");

      // Check SOL amounts converted from lamports
      const buyer1 = result.find((b: EarlyBuyer) => b.wallet === "EarlyBuyerWallet1");
      expect(buyer1?.solAmount).toBe(2.0);
    });

    it("deduplicates wallets (only returns first occurrence)", async () => {
      const tokenMint = "DedupToken";
      const baseTimestamp = 1700000000;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            signature: "sig_dup1",
            timestamp: baseTimestamp,
            type: "SWAP",
            feePayer: "SameWallet",
            events: {
              swap: {
                nativeInput: { amount: 1_000_000_000 },
                tokenOutputs: [{ mint: tokenMint, rawTokenAmount: { tokenAmount: "1000" } }],
              },
            },
          },
          {
            signature: "sig_dup2",
            timestamp: baseTimestamp + 100,
            type: "SWAP",
            feePayer: "SameWallet", // Same wallet, second buy
            events: {
              swap: {
                nativeInput: { amount: 2_000_000_000 },
                tokenOutputs: [{ mint: tokenMint, rawTokenAmount: { tokenAmount: "2000" } }],
              },
            },
          },
        ],
      });

      const result = await service.getTokenEarlyBuyers(tokenMint);

      expect(result.length).toBe(1);
      expect(result[0].wallet).toBe("SameWallet");
    });

    it("ignores sells (nativeOutput only, no nativeInput)", async () => {
      const tokenMint = "SellToken";
      const baseTimestamp = 1700000000;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          // This is a SELL (token in, SOL out) - should be ignored
          {
            signature: "sig_sell",
            timestamp: baseTimestamp,
            type: "SWAP",
            feePayer: "SellerWallet",
            events: {
              swap: {
                nativeOutput: { amount: 1_000_000_000 }, // SOL received
                tokenInputs: [
                  { mint: tokenMint, rawTokenAmount: { tokenAmount: "1000" } },
                ],
                // No nativeInput
              },
            },
          },
        ],
      });

      const result = await service.getTokenEarlyBuyers(tokenMint);
      expect(result).toEqual([]);
    });

    it("ignores swaps for different token mints", async () => {
      const targetMint = "TargetMint";
      const otherMint = "OtherMint";
      const baseTimestamp = 1700000000;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            signature: "sig_wrong_mint",
            timestamp: baseTimestamp,
            type: "SWAP",
            feePayer: "WrongMintBuyer",
            events: {
              swap: {
                nativeInput: { amount: 1_000_000_000 },
                tokenOutputs: [
                  { mint: otherMint, rawTokenAmount: { tokenAmount: "1000" } }, // Wrong mint!
                ],
              },
            },
          },
        ],
      });

      const result = await service.getTokenEarlyBuyers(targetMint);
      expect(result).toEqual([]);
    });

    it("calls the correct Helius endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await service.getTokenEarlyBuyers("MyMint123");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/addresses/MyMint123/transactions")
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("api-key=test-api-key")
      );
    });

    it("handles fetch exceptions gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await service.getTokenEarlyBuyers("NetworkErrorToken");
      expect(result).toEqual([]);
    });
  });

  describe("wallet tracking", () => {
    it("tracks and retrieves wallets", () => {
      service.trackWallet("wallet1", "Alpha Trader");
      service.trackWallet("wallet2", "Beta Trader");

      const tracked = service.getTrackedWallets();
      expect(tracked.length).toBe(2);
      expect(tracked[0]).toEqual({ address: "wallet1", label: "Alpha Trader" });
    });

    it("untracks wallets", () => {
      service.trackWallet("wallet1", "Alpha");
      service.untrackWallet("wallet1");

      expect(service.getTrackedWallets().length).toBe(0);
    });
  });

  describe("trade alerts", () => {
    it("adds and retrieves trade alerts", () => {
      service.addTradeAlert({
        wallet: "w1",
        walletLabel: "Trader",
        trade: {
          signature: "sig1",
          timestamp: Date.now(),
          type: "BUY",
          tokenMint: "mint1",
          tokenAmount: 1000,
          solAmount: 1.5,
          source: "jupiter",
          success: true,
        },
        isSmartMoney: true,
        timestamp: Date.now(),
      });

      const alerts = service.getRecentAlerts();
      expect(alerts.length).toBe(1);
      expect(alerts[0].wallet).toBe("w1");
    });

    it("bounds alerts to MAX_ALERTS", () => {
      for (let i = 0; i < 110; i++) {
        service.addTradeAlert({
          wallet: `w${i}`,
          trade: {
            signature: `sig${i}`,
            timestamp: Date.now(),
            type: "BUY",
            tokenMint: "mint",
            tokenAmount: 100,
            solAmount: 0.1,
            source: "test",
            success: true,
          },
          isSmartMoney: true,
          timestamp: Date.now(),
        });
      }

      // MAX_ALERTS is 100
      expect(service.getRecentAlerts(200).length).toBeLessThanOrEqual(100);
    });
  });

  describe("getWalletTrades", () => {
    it("parses SWAP BUY transactions correctly", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            signature: "sig_swap_buy",
            timestamp: 1700000000,
            type: "SWAP",
            source: "jupiter",
            events: {
              swap: {
                nativeInput: { amount: 1_500_000_000 }, // 1.5 SOL spent
                tokenOutputs: [
                  {
                    mint: "TokenMintABC",
                    rawTokenAmount: { tokenAmount: "50000" },
                  },
                ],
              },
            },
          },
        ],
      });

      const history = await service.getWalletTrades("testWallet");

      expect(history.trades.length).toBe(1);
      expect(history.trades[0].type).toBe("BUY");
      expect(history.trades[0].solAmount).toBe(1.5);
      expect(history.trades[0].tokenMint).toBe("TokenMintABC");
      expect(history.stats.buys).toBe(1);
    });

    it("parses SWAP SELL transactions correctly", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            signature: "sig_swap_sell",
            timestamp: 1700000000,
            type: "SWAP",
            source: "raydium",
            events: {
              swap: {
                nativeOutput: { amount: 3_000_000_000 }, // 3 SOL received
                tokenInputs: [
                  {
                    mint: "TokenMintXYZ",
                    rawTokenAmount: { tokenAmount: "100000" },
                  },
                ],
              },
            },
          },
        ],
      });

      const history = await service.getWalletTrades("testWallet");

      expect(history.trades.length).toBe(1);
      expect(history.trades[0].type).toBe("SELL");
      expect(history.trades[0].solAmount).toBe(3.0);
      expect(history.trades[0].tokenMint).toBe("TokenMintXYZ");
      expect(history.stats.sells).toBe(1);
    });

    it("skips non-SWAP transactions", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            signature: "sig_transfer",
            timestamp: 1700000000,
            type: "TRANSFER",
            source: "system",
            // No swap events
          },
        ],
      });

      const history = await service.getWalletTrades("testWallet");
      expect(history.trades.length).toBe(0);
    });

    it("uses fallback when not configured", async () => {
      delete process.env.HELIUS_API_KEY;
      const unconfigured = new HeliusService();

      // Mock the public RPC fallback
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: [
            {
              signature: "fallback_sig",
              blockTime: 1700000000,
              err: null,
            },
          ],
        }),
      });

      const history = await unconfigured.getWalletTrades("testWallet", 10);

      expect(history.trades.length).toBe(1);
      expect(history.trades[0].type).toBe("UNKNOWN");
      expect(history.trades[0].signature).toBe("fallback_sig");
    });

    it("handles API error and falls back", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: [] }),
        });

      const history = await service.getWalletTrades("testWallet");
      expect(history.trades).toEqual([]);
    });
  });

  describe("pollTrackedWallets", () => {
    it("returns empty when not configured", async () => {
      delete process.env.HELIUS_API_KEY;
      const unconfigured = new HeliusService();

      const alerts = await unconfigured.pollTrackedWallets();
      expect(alerts).toEqual([]);
    });

    it("detects new trades from tracked wallets", async () => {
      service.trackWallet("trackedWallet1", "Trader1");

      const recentTimestamp = Math.floor(Date.now() / 1000); // Within 5-min window

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            signature: "new_trade_sig",
            timestamp: recentTimestamp,
            type: "SWAP",
            source: "jupiter",
            events: {
              swap: {
                nativeInput: { amount: 1_000_000_000 },
                tokenOutputs: [
                  {
                    mint: "NewTokenMint",
                    rawTokenAmount: { tokenAmount: "5000" },
                  },
                ],
              },
            },
          },
        ],
      });

      const alerts = await service.pollTrackedWallets();

      expect(alerts.length).toBe(1);
      expect(alerts[0].wallet).toBe("trackedWallet1");
      expect(alerts[0].trade.type).toBe("BUY");
      expect(alerts[0].isSmartMoney).toBe(true);
    });

    it("deduplicates already-processed signatures", async () => {
      service.trackWallet("trackedWallet2", "Trader2");

      const recentTimestamp = Math.floor(Date.now() / 1000);

      const mockResponse = {
        ok: true,
        json: async () => [
          {
            signature: "dedup_sig_001",
            timestamp: recentTimestamp,
            type: "SWAP",
            source: "jupiter",
            events: {
              swap: {
                nativeInput: { amount: 500_000_000 },
                tokenOutputs: [
                  {
                    mint: "DedupMint",
                    rawTokenAmount: { tokenAmount: "1000" },
                  },
                ],
              },
            },
          },
        ],
      };

      // First poll: should detect the trade
      mockFetch.mockResolvedValueOnce(mockResponse);
      const firstPoll = await service.pollTrackedWallets();
      expect(firstPoll.length).toBe(1);

      // Second poll: same signature should be deduped
      mockFetch.mockResolvedValueOnce(mockResponse);
      const secondPoll = await service.pollTrackedWallets();
      expect(secondPoll.length).toBe(0);
    });
  });
});
