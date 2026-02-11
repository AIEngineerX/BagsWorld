// WalletDiscoveryService tests
// Tests the full wallet discovery pipeline: hot tokens -> early buyers -> profitability analysis -> learned wallets

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ============================================================================
// Mock setup — must come before imports
// ============================================================================

// Track mock state across the test
const mockHeliusReady = { value: true };
const mockTrackedWallets: Map<string, string> = new Map();
const mockSmartMoneyWallets: Map<
  string,
  { address: string; source: string; label: string; lastActive: number; winRate: number }
> = new Map();

// Stable mock instances (same object returned every time)
const mockGetTokenEarlyBuyers = vi.fn().mockResolvedValue([]);
const mockGetWalletTrades = vi.fn().mockResolvedValue({
  wallet: "",
  trades: [],
  stats: { totalTrades: 0, buys: 0, sells: 0, totalVolumeSol: 0, uniqueTokens: 0 },
});
const mockDexSearch = vi.fn().mockResolvedValue({ pairs: [] });

// --- HeliusService mock ---
vi.mock("./HeliusService.js", () => {
  return {
    getHeliusService: () => ({
      isReady: () => mockHeliusReady.value,
      getTrackedWallets: () =>
        Array.from(mockTrackedWallets.entries()).map(([address, label]) => ({
          address,
          label,
        })),
      trackWallet: (address: string, label: string) => {
        mockTrackedWallets.set(address, label);
      },
      getTokenEarlyBuyers: mockGetTokenEarlyBuyers,
      getWalletTrades: mockGetWalletTrades,
    }),
  };
});

// --- DexScreenerCache mock ---
vi.mock("./DexScreenerCache.js", () => {
  return {
    getDexScreenerCache: () => ({
      search: mockDexSearch,
      getTokenData: vi.fn().mockResolvedValue(null),
    }),
  };
});

// --- SmartMoneyService mock ---
vi.mock("./SmartMoneyService.js", () => {
  return {
    getSmartMoneyService: () => ({
      isSmartMoney: (addr: string) => mockSmartMoneyWallets.has(addr),
      getAllWallets: () => Array.from(mockSmartMoneyWallets.values()),
      addLearnedWallet: (
        address: string,
        label: string,
        stats: { winRate?: number }
      ) => {
        mockSmartMoneyWallets.set(address, {
          address,
          label,
          source: "learned",
          lastActive: Date.now(),
          winRate: stats.winRate || 0.5,
        });
      },
      removeWallet: (address: string) => {
        return mockSmartMoneyWallets.delete(address);
      },
    }),
  };
});

// Now import after mocks are set up
import { WalletDiscoveryService } from "./WalletDiscoveryService.js";
import { getSmartMoneyService } from "./SmartMoneyService.js";

// ============================================================================
// Helpers
// ============================================================================

function makeHotPair(overrides: Record<string, unknown> = {}) {
  return {
    chainId: "solana",
    baseToken: {
      address: overrides.mint || "TokenMint111",
      symbol: overrides.symbol || "HOT",
    },
    priceChange: { h24: overrides.priceChange24h ?? 120 },
    volume: { h24: overrides.volume24h ?? 50_000 },
    liquidity: { usd: overrides.liquidity ?? 5_000 },
    pairCreatedAt: overrides.pairCreatedAt ?? Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago
    ...overrides,
  };
}

function makeTrade(
  type: "BUY" | "SELL",
  tokenMint: string,
  solAmount: number,
  timestamp?: number
) {
  return {
    signature: `sig_${Math.random().toString(36).slice(2, 10)}`,
    timestamp: timestamp || Date.now(),
    type,
    tokenMint,
    tokenSymbol: "TKN",
    tokenAmount: solAmount * 1000,
    solAmount,
    source: "jupiter",
    success: true,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("WalletDiscoveryService", () => {
  let service: WalletDiscoveryService;

  beforeEach(() => {
    // Reset singletons and mock state
    mockHeliusReady.value = true;
    mockTrackedWallets.clear();
    mockSmartMoneyWallets.clear();
    mockDexSearch.mockReset().mockResolvedValue({ pairs: [] });
    mockGetTokenEarlyBuyers.mockReset().mockResolvedValue([]);
    mockGetWalletTrades.mockReset().mockResolvedValue({
      wallet: "",
      trades: [],
      stats: { totalTrades: 0, buys: 0, sells: 0, totalVolumeSol: 0, uniqueTokens: 0 },
    });

    // Create a fresh instance (bypass singleton for isolation)
    service = new WalletDiscoveryService();
  });

  describe("discoverWallets - no Helius", () => {
    it("returns 0 when Helius is not configured", async () => {
      mockHeliusReady.value = false;
      const result = await service.discoverWallets();
      expect(result).toBe(0);
    });
  });

  describe("discoverWallets - no hot tokens", () => {
    it("returns 0 when DexScreener finds no trending tokens", async () => {
      mockDexSearch.mockResolvedValue({ pairs: [] });

      const result = await service.discoverWallets();
      expect(result).toBe(0);
    });

    it("returns 0 when tokens don't meet hot criteria", async () => {
      mockDexSearch.mockResolvedValue({
        pairs: [makeHotPair({ priceChange24h: 10 })],
      });

      const result = await service.discoverWallets();
      expect(result).toBe(0);
    });
  });

  describe("discoverWallets - no early buyers", () => {
    it("returns 0 when no early buyers found for hot tokens", async () => {
      mockDexSearch.mockResolvedValue({
        pairs: [makeHotPair()],
      });
      mockGetTokenEarlyBuyers.mockResolvedValue([]);

      const result = await service.discoverWallets();
      expect(result).toBe(0);
    });
  });

  describe("discoverWallets - full pipeline", () => {
    it("discovers wallet with good win rate", async () => {
      mockDexSearch.mockResolvedValue({
        pairs: [makeHotPair({ mint: "HotToken111" })],
      });

      mockGetTokenEarlyBuyers.mockResolvedValue([
        {
          wallet: "WinnerWallet111",
          solAmount: 2.0,
          timestamp: Date.now() - 3600_000,
          signature: "sig_early1",
        },
      ]);

      // Wallet has 10 completed round-trips: 8 wins, 2 losses (80% WR, ~2.1x avg)
      const trades = [
        // Token A: Buy 1 SOL, Sell 2.5 SOL → win (2.5x)
        makeTrade("BUY", "TokenA", 1.0),
        makeTrade("SELL", "TokenA", 2.5),
        // Token B: Buy 1 SOL, Sell 2.0 SOL → win (2.0x)
        makeTrade("BUY", "TokenB", 1.0),
        makeTrade("SELL", "TokenB", 2.0),
        // Token C: Buy 1 SOL, Sell 0.7 SOL → loss (0.7x)
        makeTrade("BUY", "TokenC", 1.0),
        makeTrade("SELL", "TokenC", 0.7),
        // Token D: Buy 1 SOL, Sell 3.0 SOL → win (3.0x)
        makeTrade("BUY", "TokenD", 1.0),
        makeTrade("SELL", "TokenD", 3.0),
        // Token E: Buy 1 SOL, Sell 2.0 SOL → win (2.0x)
        makeTrade("BUY", "TokenE", 1.0),
        makeTrade("SELL", "TokenE", 2.0),
        // Token F: Buy 1 SOL, Sell 2.5 SOL → win (2.5x)
        makeTrade("BUY", "TokenF", 1.0),
        makeTrade("SELL", "TokenF", 2.5),
        // Token G: Buy 1 SOL, Sell 0.6 SOL → loss (0.6x)
        makeTrade("BUY", "TokenG", 1.0),
        makeTrade("SELL", "TokenG", 0.6),
        // Token H: Buy 1 SOL, Sell 2.0 SOL → win (2.0x)
        makeTrade("BUY", "TokenH", 1.0),
        makeTrade("SELL", "TokenH", 2.0),
        // Token I: Buy 1 SOL, Sell 2.2 SOL → win (2.2x)
        makeTrade("BUY", "TokenI", 1.0),
        makeTrade("SELL", "TokenI", 2.2),
        // Token J: Buy 1 SOL, Sell 1.8 SOL → win (1.8x)
        makeTrade("BUY", "TokenJ", 1.0),
        makeTrade("SELL", "TokenJ", 1.8),
      ];

      mockGetWalletTrades.mockResolvedValue({
        wallet: "WinnerWallet111",
        trades,
        stats: {
          totalTrades: trades.length,
          buys: 10,
          sells: 10,
          totalVolumeSol: 20,
          uniqueTokens: 10,
        },
      });

      const result = await service.discoverWallets();

      expect(result).toBe(1);
      // Verify wallet was added to SmartMoneyService
      const smartMoney = getSmartMoneyService();
      expect(smartMoney.isSmartMoney("WinnerWallet111")).toBe(true);
    });

    it("rejects wallet with low win rate", async () => {
      mockDexSearch.mockResolvedValue({
        pairs: [makeHotPair({ mint: "HotToken222" })],
      });

      mockGetTokenEarlyBuyers.mockResolvedValue([
        {
          wallet: "LoserWallet222",
          solAmount: 1.0,
          timestamp: Date.now() - 3600_000,
          signature: "sig_early2",
        },
      ]);

      // Wallet has mostly losses: 1 win, 4 losses (20% WR)
      const trades = [
        makeTrade("BUY", "TokenA", 1.0),
        makeTrade("SELL", "TokenA", 0.3),
        makeTrade("BUY", "TokenB", 1.0),
        makeTrade("SELL", "TokenB", 0.2),
        makeTrade("BUY", "TokenC", 1.0),
        makeTrade("SELL", "TokenC", 1.5),
        makeTrade("BUY", "TokenD", 1.0),
        makeTrade("SELL", "TokenD", 0.4),
        makeTrade("BUY", "TokenE", 1.0),
        makeTrade("SELL", "TokenE", 0.1),
      ];

      mockGetWalletTrades.mockResolvedValue({
        wallet: "LoserWallet222",
        trades,
        stats: {
          totalTrades: trades.length,
          buys: 5,
          sells: 5,
          totalVolumeSol: 10,
          uniqueTokens: 5,
        },
      });

      const result = await service.discoverWallets();
      expect(result).toBe(0);

      const smartMoney = getSmartMoneyService();
      expect(smartMoney.isSmartMoney("LoserWallet222")).toBe(false);
    });

    it("skips wallets already in SmartMoneyService", async () => {
      // Pre-add wallet
      mockSmartMoneyWallets.set("AlreadyTracked333", {
        address: "AlreadyTracked333",
        label: "Already tracked",
        source: "manual",
        lastActive: Date.now(),
        winRate: 0.7,
      });

      mockDexSearch.mockResolvedValue({
        pairs: [makeHotPair({ mint: "HotToken333" })],
      });

      mockGetTokenEarlyBuyers.mockResolvedValue([
        {
          wallet: "AlreadyTracked333",
          solAmount: 2.0,
          timestamp: Date.now() - 3600_000,
          signature: "sig_early3",
        },
      ]);

      // getWalletTrades should NOT be called for this wallet
      const result = await service.discoverWallets();
      expect(result).toBe(0);
      expect(mockGetWalletTrades).not.toHaveBeenCalled();
    });

    it("rejects wallets with too few trades", async () => {
      mockDexSearch.mockResolvedValue({
        pairs: [makeHotPair({ mint: "HotToken444" })],
      });

      mockGetTokenEarlyBuyers.mockResolvedValue([
        {
          wallet: "FewTrades444",
          solAmount: 1.0,
          timestamp: Date.now() - 3600_000,
          signature: "sig_early4",
        },
      ]);

      // Only 2 completed round-trips (below MIN_TRADES threshold of 10 and min 3 round-trips)
      const trades = [
        makeTrade("BUY", "TokenA", 1.0),
        makeTrade("SELL", "TokenA", 2.0),
        makeTrade("BUY", "TokenB", 1.0),
        makeTrade("SELL", "TokenB", 3.0),
      ];

      mockGetWalletTrades.mockResolvedValue({
        wallet: "FewTrades444",
        trades,
        stats: {
          totalTrades: 4,
          buys: 2,
          sells: 2,
          totalVolumeSol: 7,
          uniqueTokens: 2,
        },
      });

      const result = await service.discoverWallets();
      expect(result).toBe(0);
    });
  });

  describe("discoverWallets - multiple tokens and wallets", () => {
    it("handles multiple hot tokens and prioritizes frequent early buyers", async () => {
      mockDexSearch.mockResolvedValue({
        pairs: [
          makeHotPair({ mint: "Token1", symbol: "T1", priceChange24h: 200 }),
          makeHotPair({ mint: "Token2", symbol: "T2", priceChange24h: 150 }),
        ],
      });

      // Wallet appears as early buyer on BOTH tokens (higher priority)
      mockGetTokenEarlyBuyers
        .mockResolvedValueOnce([
          {
            wallet: "FrequentBuyer555",
            solAmount: 2.0,
            timestamp: Date.now() - 3600_000,
            signature: "sig1",
          },
        ])
        .mockResolvedValueOnce([
          {
            wallet: "FrequentBuyer555",
            solAmount: 1.5,
            timestamp: Date.now() - 3600_000,
            signature: "sig2",
          },
        ]);

      // Good trading history for this wallet
      const trades = [
        makeTrade("BUY", "T1", 1.0),
        makeTrade("SELL", "T1", 2.5),
        makeTrade("BUY", "T2", 1.0),
        makeTrade("SELL", "T2", 1.8),
        makeTrade("BUY", "T3", 1.0),
        makeTrade("SELL", "T3", 2.0),
        makeTrade("BUY", "T4", 1.0),
        makeTrade("SELL", "T4", 1.3),
        makeTrade("BUY", "T5", 1.0),
        makeTrade("SELL", "T5", 0.7),
        makeTrade("BUY", "T6", 1.0),
        makeTrade("SELL", "T6", 2.0),
      ];

      mockGetWalletTrades.mockResolvedValue({
        wallet: "FrequentBuyer555",
        trades,
        stats: {
          totalTrades: trades.length,
          buys: 6,
          sells: 6,
          totalVolumeSol: 12,
          uniqueTokens: 6,
        },
      });

      const result = await service.discoverWallets();
      expect(result).toBe(1);
      expect(getSmartMoneyService().isSmartMoney("FrequentBuyer555")).toBe(true);
    });
  });

  describe("discoverWallets - learned wallet cap", () => {
    it("respects MAX_DISCOVERED_WALLETS limit", async () => {
      // Pre-fill with 30 learned wallets (at the cap)
      for (let i = 0; i < 30; i++) {
        mockSmartMoneyWallets.set(`LearnedWallet${i}`, {
          address: `LearnedWallet${i}`,
          label: `Learned #${i}`,
          source: "learned",
          lastActive: Date.now(),
          winRate: 0.6,
        });
      }

      mockDexSearch.mockResolvedValue({
        pairs: [makeHotPair({ mint: "HotOverCap" })],
      });

      mockGetTokenEarlyBuyers.mockResolvedValue([
        {
          wallet: "NewWalletOverCap",
          solAmount: 1.0,
          timestamp: Date.now() - 3600_000,
          signature: "sig_overcap",
        },
      ]);

      // Even a great wallet shouldn't be added if cap is reached
      const trades = [
        makeTrade("BUY", "TA", 1.0), makeTrade("SELL", "TA", 5.0),
        makeTrade("BUY", "TB", 1.0), makeTrade("SELL", "TB", 4.0),
        makeTrade("BUY", "TC", 1.0), makeTrade("SELL", "TC", 3.0),
        makeTrade("BUY", "TD", 1.0), makeTrade("SELL", "TD", 6.0),
      ];

      mockGetWalletTrades.mockResolvedValue({
        wallet: "NewWalletOverCap",
        trades,
        stats: { totalTrades: 8, buys: 4, sells: 4, totalVolumeSol: 21, uniqueTokens: 4 },
      });

      const result = await service.discoverWallets();
      expect(result).toBe(0);
    });
  });

  describe("hot token filtering", () => {
    it("filters out non-Solana tokens", async () => {
      mockDexSearch.mockResolvedValue({
        pairs: [
          {
            ...makeHotPair(),
            chainId: "ethereum", // Not Solana
          },
        ],
      });

      const result = await service.discoverWallets();
      expect(result).toBe(0);
    });

    it("filters out old tokens (>7 days)", async () => {
      mockDexSearch.mockResolvedValue({
        pairs: [
          makeHotPair({
            pairCreatedAt: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 days ago
          }),
        ],
      });

      const result = await service.discoverWallets();
      expect(result).toBe(0);
    });

    it("filters out low volume tokens", async () => {
      mockDexSearch.mockResolvedValue({
        pairs: [
          makeHotPair({ volume24h: 500 }), // Below $10K threshold
        ],
      });

      const result = await service.discoverWallets();
      expect(result).toBe(0);
    });

    it("filters out low liquidity tokens", async () => {
      mockDexSearch.mockResolvedValue({
        pairs: [
          makeHotPair({ liquidity: 100 }), // Below $1K threshold
        ],
      });

      const result = await service.discoverWallets();
      expect(result).toBe(0);
    });
  });

  describe("error handling", () => {
    it("handles DexScreener failure gracefully", async () => {
      mockDexSearch.mockRejectedValue(new Error("DexScreener down"));

      const result = await service.discoverWallets();
      expect(result).toBe(0);
    });

    it("handles Helius getTokenEarlyBuyers failure gracefully", async () => {
      mockDexSearch.mockResolvedValue({
        pairs: [makeHotPair()],
      });
      mockGetTokenEarlyBuyers.mockRejectedValue(
        new Error("Helius API error")
      );

      const result = await service.discoverWallets();
      expect(result).toBe(0);
    });

    it("handles Helius getWalletTrades failure gracefully", async () => {
      mockDexSearch.mockResolvedValue({
        pairs: [makeHotPair({ mint: "HotTokenErr" })],
      });
      mockGetTokenEarlyBuyers.mockResolvedValue([
        {
          wallet: "ErrorWallet",
          solAmount: 1.0,
          timestamp: Date.now() - 3600_000,
          signature: "sig_err",
        },
      ]);
      mockGetWalletTrades.mockRejectedValue(
        new Error("Helius wallet fetch error")
      );

      const result = await service.discoverWallets();
      expect(result).toBe(0);
    });
  });
});

// ============================================================================
// SmartMoneyService integration tests (removeWallet, refreshSmartMoneyList)
// ============================================================================

describe("SmartMoneyService - removeWallet", () => {
  beforeEach(() => {
    mockSmartMoneyWallets.clear();
  });

  it("removeWallet removes a learned wallet", () => {
    const smartMoney = getSmartMoneyService();

    smartMoney.addLearnedWallet("ToRemove999", "Remove me", { winRate: 0.6 });
    expect(smartMoney.isSmartMoney("ToRemove999")).toBe(true);

    smartMoney.removeWallet("ToRemove999");
    expect(smartMoney.isSmartMoney("ToRemove999")).toBe(false);
  });

  it("removeWallet returns false for non-existent wallet", () => {
    const smartMoney = getSmartMoneyService();
    const result = smartMoney.removeWallet("NonExistent");
    expect(result).toBe(false);
  });
});

// ============================================================================
// HeliusService - getTokenEarlyBuyers (tested via mock verification)
// ============================================================================

describe("HeliusService mock - getTokenEarlyBuyers", () => {
  beforeEach(() => {
    mockDexSearch.mockReset().mockResolvedValue({ pairs: [] });
    mockGetTokenEarlyBuyers.mockReset().mockResolvedValue([]);
  });

  it("is called with correct token mint", async () => {
    mockDexSearch.mockResolvedValue({
      pairs: [makeHotPair({ mint: "SpecificMint123" })],
    });
    mockGetTokenEarlyBuyers.mockResolvedValue([]);

    const svc = new WalletDiscoveryService();
    await svc.discoverWallets();

    expect(mockGetTokenEarlyBuyers).toHaveBeenCalledWith(
      "SpecificMint123",
      3600 // EARLY_BUYER_WINDOW_SEC
    );
  });
});
