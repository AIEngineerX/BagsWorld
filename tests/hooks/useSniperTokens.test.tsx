/**
 * useSniperTokens and useSnipe Hook Tests
 *
 * Tests the sniper hooks with:
 * - Quote fetching
 * - Snipe execution
 * - Error handling
 * - Loading states
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { useSnipe } from "@/hooks/useSniperTokens";

// Helper to set up mock fetch responses
function setupMockFetch(responses: Record<string, { status?: number; data: unknown }[]>) {
  const callCounts: Record<string, number> = {};

  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    const urlPath = url.replace(/^http:\/\/localhost(:\d+)?/, "");

    // Find matching response
    for (const [path, responseQueue] of Object.entries(responses)) {
      if (urlPath.includes(path)) {
        if (!callCounts[path]) callCounts[path] = 0;
        const responseIndex = Math.min(callCounts[path], responseQueue.length - 1);
        const response = responseQueue[responseIndex];
        callCounts[path]++;

        return Promise.resolve({
          ok: response.status ? response.status >= 200 && response.status < 400 : true,
          status: response.status || 200,
          json: () => Promise.resolve(response.data),
        });
      }
    }

    // Default response
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, tokens: [], total: 0 }),
    });
  });

  return callCounts;
}

describe("useSnipe", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getQuote", () => {
    it("should fetch quote successfully", async () => {
      const mockQuote = {
        inputAmount: 1,
        outputAmount: 1000000,
        minOutputAmount: 950000,
        priceImpact: 0.5,
      };

      setupMockFetch({
        "/api/sniper/quick-snipe": [{ data: { success: true, quote: mockQuote } }],
      });

      const { result } = renderHook(() => useSnipe());

      let quote: typeof mockQuote | null = null;
      await act(async () => {
        quote = await result.current.getQuote("TokenMint123456789012345", 1, 100);
      });

      expect(quote).toEqual(mockQuote);
      expect(result.current.error).toBeNull();
    });

    it("should return null and set error on API failure", async () => {
      const onError = jest.fn();

      setupMockFetch({
        "/api/sniper/quick-snipe": [
          { status: 400, data: { error: "Invalid token mint" } },
        ],
      });

      const { result } = renderHook(() => useSnipe({ onError }));

      let quote: unknown;
      await act(async () => {
        quote = await result.current.getQuote("invalid", 1, 100);
      });

      expect(quote).toBeNull();
      expect(result.current.error).toContain("Invalid token mint");
      expect(onError).toHaveBeenCalledWith("Invalid token mint");
    });

    it("should handle success: false response", async () => {
      setupMockFetch({
        "/api/sniper/quick-snipe": [
          { data: { success: false, error: "No route found" } },
        ],
      });

      const { result } = renderHook(() => useSnipe());

      let quote: unknown;
      await act(async () => {
        quote = await result.current.getQuote("TokenMint123456789012345", 1, 100);
      });

      expect(quote).toBeNull();
      expect(result.current.error).toContain("No route found");
    });

    it("should pass correct parameters to API", async () => {
      setupMockFetch({
        "/api/sniper/quick-snipe": [{ data: { success: true, quote: {} } }],
      });

      const { result } = renderHook(() => useSnipe());

      await act(async () => {
        await result.current.getQuote("MyTokenMint12345678901234567890", 2.5, 150);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/sniper/quick-snipe",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"action":"quote"'),
        })
      );

      const callBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body
      );
      expect(callBody.tokenMint).toBe("MyTokenMint12345678901234567890");
      expect(callBody.amountSol).toBe(2.5);
      expect(callBody.slippageBps).toBe(150);
    });
  });

  describe("executeSnipe", () => {
    it("should create swap transaction", async () => {
      const mockTransaction = "base64EncodedTransaction";

      setupMockFetch({
        "/api/sniper/quick-snipe": [
          { data: { success: true, transaction: mockTransaction } },
        ],
      });

      const { result } = renderHook(() => useSnipe());
      const mockSignTransaction = jest.fn();

      let transaction: string | null = null;
      await act(async () => {
        transaction = await result.current.executeSnipe(
          "TokenMint123456789012345",
          1,
          100,
          mockSignTransaction
        );
      });

      expect(transaction).toBe(mockTransaction);
    });

    it("should handle snipe error and call onError callback", async () => {
      const onError = jest.fn();

      setupMockFetch({
        "/api/sniper/quick-snipe": [
          { status: 500, data: { error: "Transaction failed" } },
        ],
      });

      const { result } = renderHook(() => useSnipe({ onError }));

      let transaction: unknown;
      await act(async () => {
        transaction = await result.current.executeSnipe(
          "TokenMint",
          1,
          100,
          jest.fn()
        );
      });

      expect(transaction).toBeNull();
      expect(result.current.error).toContain("Transaction failed");
      expect(onError).toHaveBeenCalled();
    });

    it("should handle success: false swap response", async () => {
      setupMockFetch({
        "/api/sniper/quick-snipe": [
          { data: { success: false, error: "Insufficient balance" } },
        ],
      });

      const { result } = renderHook(() => useSnipe());

      let transaction: unknown;
      await act(async () => {
        transaction = await result.current.executeSnipe(
          "TokenMint",
          100,
          100,
          jest.fn()
        );
      });

      expect(transaction).toBeNull();
      expect(result.current.error).toBeDefined();
    });

    it("should send swap action to API", async () => {
      setupMockFetch({
        "/api/sniper/quick-snipe": [
          { data: { success: true, transaction: "tx123" } },
        ],
      });

      const { result } = renderHook(() => useSnipe());

      await act(async () => {
        await result.current.executeSnipe(
          "TestMint123456789012345678901234",
          5,
          200,
          jest.fn()
        );
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/sniper/quick-snipe",
        expect.objectContaining({
          body: expect.stringContaining('"action":"swap"'),
        })
      );
    });
  });

  describe("Loading States", () => {
    it("should start with isQuoting false", () => {
      setupMockFetch({
        "/api/sniper/quick-snipe": [{ data: { success: true, quote: {} } }],
      });

      const { result } = renderHook(() => useSnipe());

      expect(result.current.isQuoting).toBe(false);
    });

    it("should start with isSniping false", () => {
      setupMockFetch({
        "/api/sniper/quick-snipe": [{ data: { success: true, transaction: "tx" } }],
      });

      const { result } = renderHook(() => useSnipe());

      expect(result.current.isSniping).toBe(false);
    });

    it("should reset isQuoting to false after quote completes", async () => {
      setupMockFetch({
        "/api/sniper/quick-snipe": [{ data: { success: true, quote: {} } }],
      });

      const { result } = renderHook(() => useSnipe());

      await act(async () => {
        await result.current.getQuote("TokenMint", 1, 100);
      });

      expect(result.current.isQuoting).toBe(false);
    });

    it("should reset isSniping to false after snipe completes", async () => {
      setupMockFetch({
        "/api/sniper/quick-snipe": [{ data: { success: true, transaction: "tx" } }],
      });

      const { result } = renderHook(() => useSnipe());

      await act(async () => {
        await result.current.executeSnipe("TokenMint", 1, 100, jest.fn());
      });

      expect(result.current.isSniping).toBe(false);
    });

    it("should reset isQuoting to false on error", async () => {
      setupMockFetch({
        "/api/sniper/quick-snipe": [{ status: 500, data: { error: "Error" } }],
      });

      const { result } = renderHook(() => useSnipe());

      await act(async () => {
        await result.current.getQuote("TokenMint", 1, 100);
      });

      expect(result.current.isQuoting).toBe(false);
    });

    it("should reset isSniping to false on error", async () => {
      setupMockFetch({
        "/api/sniper/quick-snipe": [{ status: 500, data: { error: "Error" } }],
      });

      const { result } = renderHook(() => useSnipe());

      await act(async () => {
        await result.current.executeSnipe("TokenMint", 1, 100, jest.fn());
      });

      expect(result.current.isSniping).toBe(false);
    });
  });

  describe("Error State", () => {
    it("should start with null error", () => {
      const { result } = renderHook(() => useSnipe());
      expect(result.current.error).toBeNull();
    });

    it("should clear error on successful quote", async () => {
      setupMockFetch({
        "/api/sniper/quick-snipe": [
          { status: 400, data: { error: "First error" } },
          { data: { success: true, quote: {} } },
        ],
      });

      const { result } = renderHook(() => useSnipe());

      // First call fails
      await act(async () => {
        await result.current.getQuote("Token", 1, 100);
      });
      expect(result.current.error).toBeDefined();

      // Second call succeeds and should clear error
      await act(async () => {
        await result.current.getQuote("Token", 1, 100);
      });
      expect(result.current.error).toBeNull();
    });
  });

  describe("Callback Options", () => {
    it("should not call onError when quote succeeds", async () => {
      const onError = jest.fn();

      setupMockFetch({
        "/api/sniper/quick-snipe": [{ data: { success: true, quote: {} } }],
      });

      const { result } = renderHook(() => useSnipe({ onError }));

      await act(async () => {
        await result.current.getQuote("Token", 1, 100);
      });

      expect(onError).not.toHaveBeenCalled();
    });

    it("should call onError with error message on failure", async () => {
      const onError = jest.fn();
      const errorMessage = "Custom error message";

      setupMockFetch({
        "/api/sniper/quick-snipe": [{ data: { success: false, error: errorMessage } }],
      });

      const { result } = renderHook(() => useSnipe({ onError }));

      await act(async () => {
        await result.current.getQuote("Token", 1, 100);
      });

      expect(onError).toHaveBeenCalledWith(errorMessage);
    });
  });

  describe("Quote Response Format", () => {
    it("should return complete quote object", async () => {
      const mockQuote = {
        inputAmount: 1,
        outputAmount: 1000000,
        minOutputAmount: 950000,
        priceImpact: 0.5,
        route: "Raydium -> Orca",
      };

      setupMockFetch({
        "/api/sniper/quick-snipe": [{ data: { success: true, quote: mockQuote } }],
      });

      const { result } = renderHook(() => useSnipe());

      let quote: typeof mockQuote | null = null;
      await act(async () => {
        quote = await result.current.getQuote("Token", 1, 100);
      });

      expect(quote).toMatchObject({
        inputAmount: 1,
        outputAmount: 1000000,
        minOutputAmount: 950000,
        priceImpact: 0.5,
      });
    });
  });
});
