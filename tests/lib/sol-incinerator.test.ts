// Comprehensive tests for src/lib/sol-incinerator.ts
// Tests the Sol Incinerator client: singleton factory, all endpoint methods,
// error handling, retry logic, timeout behavior, and edge cases.

const API_BASE = "https://v1.api.sol-incinerator.com";

// Helper: build a mock Response object compatible with the source code's usage.
// The source calls response.ok, response.status, response.statusText,
// response.text(), and response.json().
function mockResponse(
  body: unknown,
  opts: { status?: number; statusText?: string; ok?: boolean } = {}
) {
  const status = opts.status ?? 200;
  const ok = opts.ok ?? (status >= 200 && status < 300);
  const statusText = opts.statusText ?? (ok ? "OK" : "Error");
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body);

  return {
    ok,
    status,
    statusText,
    text: jest.fn().mockResolvedValue(bodyStr),
    json: jest.fn().mockResolvedValue(typeof body === "string" ? JSON.parse(body) : body),
  };
}

// Re-usable test params
const TEST_PUBLIC_KEY = "9Luwe53R7V5ohS8dmconp38w9FoKsUgBjVwEPPU8iFUC";
const TEST_ASSET_ID = "AssetMint111111111111111111111111111111111111";
const TEST_API_KEY = "test-api-key-12345";

const BURN_RESPONSE = {
  assetId: TEST_ASSET_ID,
  serializedTransaction: "base64tx==",
  lamportsReclaimed: 2039280,
  solanaReclaimed: 0.00203928,
  transactionType: "burn",
  isDestructiveAction: true,
};

const BATCH_CLOSE_ALL_RESPONSE = {
  transactions: ["tx1==", "tx2=="],
  accountsClosed: 5,
  totalLamportsReclaimed: 10196400,
  totalSolanaReclaimed: 0.0101964,
  hasDestructiveActions: false,
};

const BURN_PREVIEW_RESPONSE = {
  assetId: TEST_ASSET_ID,
  transactionType: "burn",
  lamportsReclaimed: 2039280,
  solanaReclaimed: 0.00203928,
  isDestructiveAction: true,
  assetInfo: { tokenAccount: "TokenAcct1111" },
  feeBreakdown: { totalFee: 5000, rentReclaimed: { tokenAccount: 2039280 } },
};

const BATCH_CLOSE_ALL_PREVIEW_RESPONSE = {
  accountPreviews: [BURN_PREVIEW_RESPONSE],
  accountsToClose: 1,
  totalLamportsReclaimed: 2039280,
  totalSolanaReclaimed: 0.00203928,
  estimatedTransactions: 1,
  hasDestructiveActions: false,
  summary: {
    standardTokenAccounts: 1,
    token2022Accounts: 0,
    token2022HarvestAccounts: 0,
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Sol Incinerator Client", () => {
  const fetchMock = global.fetch as jest.Mock;

  // We use jest.isolateModules + require() so every test gets a fresh module
  // with a null singleton. This avoids cross-test pollution.
  function loadModule() {
    let mod: typeof import("@/lib/sol-incinerator");
    jest.isolateModules(() => {
      mod = require("@/lib/sol-incinerator");
    });
    return mod!;
  }

  beforeEach(() => {
    fetchMock.mockReset();
    delete process.env.SOL_INCINERATOR_API_KEY;
    jest.restoreAllMocks();
  });

  // ==================== getSolIncinerator() singleton ====================

  describe("getSolIncinerator()", () => {
    it("throws when SOL_INCINERATOR_API_KEY is not set", () => {
      const { getSolIncinerator } = loadModule();
      expect(() => getSolIncinerator()).toThrow("SOL_INCINERATOR_API_KEY not configured");
    });

    it("throws when SOL_INCINERATOR_API_KEY is empty string (falsy)", () => {
      process.env.SOL_INCINERATOR_API_KEY = "";
      const { getSolIncinerator } = loadModule();
      expect(() => getSolIncinerator()).toThrow("SOL_INCINERATOR_API_KEY not configured");
    });

    it("returns a client when key is set", () => {
      process.env.SOL_INCINERATOR_API_KEY = TEST_API_KEY;
      const { getSolIncinerator } = loadModule();
      const client = getSolIncinerator();
      expect(client).toBeDefined();
      expect(typeof client.burn).toBe("function");
      expect(typeof client.close).toBe("function");
      expect(typeof client.status).toBe("function");
    });

    it("returns the same singleton on repeated calls", () => {
      process.env.SOL_INCINERATOR_API_KEY = TEST_API_KEY;
      const { getSolIncinerator } = loadModule();
      const a = getSolIncinerator();
      const b = getSolIncinerator();
      expect(a).toBe(b);
    });

    it("fresh module produces a new instance (singleton reset via isolateModules)", () => {
      process.env.SOL_INCINERATOR_API_KEY = TEST_API_KEY;
      const mod1 = loadModule();
      const mod2 = loadModule();
      const a = mod1.getSolIncinerator();
      const b = mod2.getSolIncinerator();
      // Different module scopes so they are separate singletons
      expect(a).not.toBe(b);
    });
  });

  // ==================== Endpoint methods ====================

  describe("endpoint methods", () => {
    let client: ReturnType<typeof import("@/lib/sol-incinerator").getSolIncinerator>;

    beforeEach(() => {
      process.env.SOL_INCINERATOR_API_KEY = TEST_API_KEY;
      client = loadModule().getSolIncinerator();
    });

    // --- burn ---

    describe("burn()", () => {
      it("sends correct request and returns response", async () => {
        fetchMock.mockResolvedValueOnce(mockResponse(BURN_RESPONSE));

        const result = await client.burn({
          userPublicKey: TEST_PUBLIC_KEY,
          assetId: TEST_ASSET_ID,
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, opts] = fetchMock.mock.calls[0];
        expect(url).toBe(`${API_BASE}/burn`);
        expect(opts.method).toBe("POST");
        expect(opts.headers["Content-Type"]).toBe("application/json");
        expect(opts.headers["x-api-key"]).toBe(TEST_API_KEY);
        expect(JSON.parse(opts.body)).toEqual({
          userPublicKey: TEST_PUBLIC_KEY,
          assetId: TEST_ASSET_ID,
        });
        expect(opts.signal).toBeInstanceOf(AbortSignal);
        expect(result).toEqual(BURN_RESPONSE);
      });
    });

    // --- close ---

    describe("close()", () => {
      it("sends correct request and returns response", async () => {
        fetchMock.mockResolvedValueOnce(mockResponse(BURN_RESPONSE));

        const result = await client.close({
          userPublicKey: TEST_PUBLIC_KEY,
          assetId: TEST_ASSET_ID,
        });

        const [url, opts] = fetchMock.mock.calls[0];
        expect(url).toBe(`${API_BASE}/close`);
        expect(opts.method).toBe("POST");
        expect(opts.headers["x-api-key"]).toBe(TEST_API_KEY);
        expect(JSON.parse(opts.body)).toEqual({
          userPublicKey: TEST_PUBLIC_KEY,
          assetId: TEST_ASSET_ID,
        });
        expect(result).toEqual(BURN_RESPONSE);
      });
    });

    // --- batchCloseAll ---

    describe("batchCloseAll()", () => {
      it("sends correct request and returns response", async () => {
        fetchMock.mockResolvedValueOnce(mockResponse(BATCH_CLOSE_ALL_RESPONSE));

        const result = await client.batchCloseAll({
          userPublicKey: TEST_PUBLIC_KEY,
        });

        const [url, opts] = fetchMock.mock.calls[0];
        expect(url).toBe(`${API_BASE}/batch/close-all`);
        expect(opts.method).toBe("POST");
        expect(JSON.parse(opts.body)).toEqual({ userPublicKey: TEST_PUBLIC_KEY });
        expect(result).toEqual(BATCH_CLOSE_ALL_RESPONSE);
      });
    });

    // --- burnPreview ---

    describe("burnPreview()", () => {
      it("sends correct request and returns response", async () => {
        fetchMock.mockResolvedValueOnce(mockResponse(BURN_PREVIEW_RESPONSE));

        const result = await client.burnPreview({
          userPublicKey: TEST_PUBLIC_KEY,
          assetId: TEST_ASSET_ID,
        });

        const [url, opts] = fetchMock.mock.calls[0];
        expect(url).toBe(`${API_BASE}/burn/preview`);
        expect(opts.method).toBe("POST");
        expect(result).toEqual(BURN_PREVIEW_RESPONSE);
      });
    });

    // --- closePreview ---

    describe("closePreview()", () => {
      it("sends correct request and returns response", async () => {
        fetchMock.mockResolvedValueOnce(mockResponse(BURN_PREVIEW_RESPONSE));

        const result = await client.closePreview({
          userPublicKey: TEST_PUBLIC_KEY,
          assetId: TEST_ASSET_ID,
        });

        const [url, opts] = fetchMock.mock.calls[0];
        expect(url).toBe(`${API_BASE}/close/preview`);
        expect(opts.method).toBe("POST");
        expect(result).toEqual(BURN_PREVIEW_RESPONSE);
      });
    });

    // --- batchCloseAllPreview ---

    describe("batchCloseAllPreview()", () => {
      it("sends correct request and returns response", async () => {
        fetchMock.mockResolvedValueOnce(mockResponse(BATCH_CLOSE_ALL_PREVIEW_RESPONSE));

        const result = await client.batchCloseAllPreview({
          userPublicKey: TEST_PUBLIC_KEY,
        });

        const [url, opts] = fetchMock.mock.calls[0];
        expect(url).toBe(`${API_BASE}/batch/close-all/preview`);
        expect(opts.method).toBe("POST");
        expect(result).toEqual(BATCH_CLOSE_ALL_PREVIEW_RESPONSE);
      });
    });

    // --- status ---

    describe("status()", () => {
      it("returns status object on happy path", async () => {
        fetchMock.mockResolvedValueOnce(mockResponse({ status: "ok" }));

        const result = await client.status();

        expect(result).toEqual({ status: "ok" });
      });

      it("uses GET method (no POST, no body, no x-api-key header)", async () => {
        fetchMock.mockResolvedValueOnce(mockResponse({ status: "ok" }));

        await client.status();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, opts] = fetchMock.mock.calls[0];
        expect(url).toBe(`${API_BASE}/`);
        // status() only passes { signal }, no method/headers/body
        expect(opts.method).toBeUndefined();
        expect(opts.headers).toBeUndefined();
        expect(opts.body).toBeUndefined();
      });

      it("passes an AbortSignal", async () => {
        fetchMock.mockResolvedValueOnce(mockResponse({ status: "ok" }));

        await client.status();

        const [, opts] = fetchMock.mock.calls[0];
        expect(opts.signal).toBeInstanceOf(AbortSignal);
      });
    });
  });

  // ==================== Error handling in fetchApi ====================

  describe("fetchApi error handling", () => {
    let client: ReturnType<typeof import("@/lib/sol-incinerator").getSolIncinerator>;

    beforeEach(() => {
      process.env.SOL_INCINERATOR_API_KEY = TEST_API_KEY;
      client = loadModule().getSolIncinerator();
    });

    it('HTTP 400 with JSON { error: "message" } throws with that message', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse(JSON.stringify({ error: "Invalid asset ID" }), {
          status: 400,
          ok: false,
          statusText: "Bad Request",
        })
      );

      await expect(client.burn({ userPublicKey: TEST_PUBLIC_KEY, assetId: "bad" })).rejects.toThrow(
        "Invalid asset ID"
      );
    });

    it("HTTP 400 with JSON { error: { message: 'nested' } } throws with nested message", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse(JSON.stringify({ error: { message: "nested validation error" } }), {
          status: 400,
          ok: false,
          statusText: "Bad Request",
        })
      );

      await expect(client.burn({ userPublicKey: TEST_PUBLIC_KEY, assetId: "bad" })).rejects.toThrow(
        "nested validation error"
      );
    });

    it("HTTP 500 with non-JSON body appends body to message", async () => {
      const plainText = "Internal Server Error - upstream timeout";
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: jest.fn().mockResolvedValue(plainText),
        json: jest.fn().mockRejectedValue(new Error("not json")),
      });

      await expect(
        client.burn({ userPublicKey: TEST_PUBLIC_KEY, assetId: TEST_ASSET_ID })
      ).rejects.toThrow(`API error: 500 Internal Server Error - ${plainText}`);
    });

    it("HTTP 500 with empty body throws generic API error", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: jest.fn().mockResolvedValue(""),
        json: jest.fn().mockRejectedValue(new Error("not json")),
      });

      await expect(
        client.burn({ userPublicKey: TEST_PUBLIC_KEY, assetId: TEST_ASSET_ID })
      ).rejects.toThrow("API error: 500 Internal Server Error");
    });

    it("200 response with JSON-RPC error containing 'max usage reached' throws and retries", async () => {
      jest.useFakeTimers();
      jest.spyOn(console, "warn").mockImplementation(() => {});

      // Re-create client with fake timers active
      const freshClient = loadModule().getSolIncinerator();

      fetchMock.mockResolvedValueOnce(
        mockResponse({
          error: { message: "max usage reached", code: -32429 },
        })
      );
      // The retry layer sees "max usage reached" and retries. Provide second response.
      fetchMock.mockResolvedValueOnce(mockResponse(BURN_RESPONSE));

      const promise = freshClient.burn({
        userPublicKey: TEST_PUBLIC_KEY,
        assetId: TEST_ASSET_ID,
      });

      // Advance past the 5s retry delay, interleaving microtask flushing
      await jest.advanceTimersByTimeAsync(6_000);

      const result = await promise;
      expect(result).toEqual(BURN_RESPONSE);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    }, 15_000);

    it("200 response with non-rate-limit JSON-RPC error throws with that message", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          error: { message: "Account not found" },
        })
      );

      // "Account not found" does not match rate limit or network, so no retry
      await expect(
        client.burn({ userPublicKey: TEST_PUBLIC_KEY, assetId: TEST_ASSET_ID })
      ).rejects.toThrow("Account not found");
    });

    it("response.text() throwing during error parsing still throws a meaningful error", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: "Bad Gateway",
        text: jest.fn().mockRejectedValue(new Error("stream destroyed")),
        json: jest.fn().mockRejectedValue(new Error("stream destroyed")),
      });

      // When response.text() rejects, the .catch(() => "") in the source
      // produces an empty string, so we get the generic message with no
      // appended text (empty string is falsy so no " - " suffix).
      await expect(
        client.burn({ userPublicKey: TEST_PUBLIC_KEY, assetId: TEST_ASSET_ID })
      ).rejects.toThrow("API error: 502 Bad Gateway");
    });
  });

  // ==================== Retry logic ====================

  describe("retry logic", () => {
    let client: ReturnType<typeof import("@/lib/sol-incinerator").getSolIncinerator>;
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      jest.useFakeTimers();
      warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      process.env.SOL_INCINERATOR_API_KEY = TEST_API_KEY;
      client = loadModule().getSolIncinerator();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("rate limit error retries once and succeeds on retry", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({ error: { message: "max usage reached", code: -32429 } })
      );
      fetchMock.mockResolvedValueOnce(mockResponse(BURN_RESPONSE));

      const promise = client.burn({
        userPublicKey: TEST_PUBLIC_KEY,
        assetId: TEST_ASSET_ID,
      });

      await jest.advanceTimersByTimeAsync(6_000);

      const result = await promise;
      expect(result).toEqual(BURN_RESPONSE);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("max usage reached"));
    }, 15_000);

    it("rate limit on both attempts throws friendly RATE_LIMIT_MSG", async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ error: { message: "max usage reached" } }));
      fetchMock.mockResolvedValueOnce(mockResponse({ error: { message: "max usage reached" } }));

      const promise = client.burn({
        userPublicKey: TEST_PUBLIC_KEY,
        assetId: TEST_ASSET_ID,
      });

      // Attach catch handler before advancing timers so the rejection
      // during timer advancement is not treated as unhandled.
      const resultPromise = promise.catch((err: Error) => err);

      await jest.advanceTimersByTimeAsync(6_000);

      const error = await resultPromise;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(
        "Sol Incinerator's RPC is at capacity. Please try again in ~30 seconds."
      );
      expect(fetchMock).toHaveBeenCalledTimes(2);
    }, 15_000);

    it("-32429 code in message also triggers rate limit detection", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({ error: { message: "error code -32429 rate limited" } })
      );
      fetchMock.mockResolvedValueOnce(mockResponse({ error: { message: "still -32429" } }));

      const promise = client.burn({
        userPublicKey: TEST_PUBLIC_KEY,
        assetId: TEST_ASSET_ID,
      });

      const resultPromise = promise.catch((err: Error) => err);

      await jest.advanceTimersByTimeAsync(6_000);

      const error = await resultPromise;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(
        "Sol Incinerator's RPC is at capacity. Please try again in ~30 seconds."
      );
    }, 15_000);

    it("rate limit on first call, different error on retry throws the retry error", async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ error: { message: "max usage reached" } }));
      fetchMock.mockResolvedValueOnce(
        mockResponse(JSON.stringify({ error: "Server exploded" }), {
          status: 500,
          ok: false,
          statusText: "Internal Server Error",
        })
      );

      const promise = client.burn({
        userPublicKey: TEST_PUBLIC_KEY,
        assetId: TEST_ASSET_ID,
      });

      const resultPromise = promise.catch((err: Error) => err);

      await jest.advanceTimersByTimeAsync(6_000);

      const error = await resultPromise;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Server exploded");
    }, 15_000);

    it('network error (TypeError with "fetch failed") retries once', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
      fetchMock.mockResolvedValueOnce(mockResponse(BURN_RESPONSE));

      const promise = client.burn({
        userPublicKey: TEST_PUBLIC_KEY,
        assetId: TEST_ASSET_ID,
      });

      await jest.advanceTimersByTimeAsync(6_000);

      const result = await promise;
      expect(result).toEqual(BURN_RESPONSE);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("fetch failed"));
    }, 15_000);

    it('error containing "network" retries once', async () => {
      fetchMock.mockRejectedValueOnce(new Error("network error: connection refused"));
      fetchMock.mockResolvedValueOnce(mockResponse(BURN_RESPONSE));

      const promise = client.burn({
        userPublicKey: TEST_PUBLIC_KEY,
        assetId: TEST_ASSET_ID,
      });

      await jest.advanceTimersByTimeAsync(6_000);

      const result = await promise;
      expect(result).toEqual(BURN_RESPONSE);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    }, 15_000);

    it("non-retryable error (400 bad request) throws immediately, no retry", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse(JSON.stringify({ error: "Invalid parameters" }), {
          status: 400,
          ok: false,
          statusText: "Bad Request",
        })
      );

      const promise = client.burn({
        userPublicKey: TEST_PUBLIC_KEY,
        assetId: TEST_ASSET_ID,
      });

      // No timer advancement needed -- should reject immediately
      await expect(promise).rejects.toThrow("Invalid parameters");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("console.warn is called with retry details on retryable error", async () => {
      fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
      fetchMock.mockResolvedValueOnce(mockResponse(BURN_RESPONSE));

      const promise = client.burn({
        userPublicKey: TEST_PUBLIC_KEY,
        assetId: TEST_ASSET_ID,
      });

      await jest.advanceTimersByTimeAsync(6_000);
      await promise;

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith("[Sol Incinerator] fetch failed, retrying in 5000ms");
    }, 15_000);
  });

  // ==================== Timeout behavior ====================

  describe("timeout behavior", () => {
    let client: ReturnType<typeof import("@/lib/sol-incinerator").getSolIncinerator>;

    beforeEach(() => {
      jest.useFakeTimers();
      process.env.SOL_INCINERATOR_API_KEY = TEST_API_KEY;
      client = loadModule().getSolIncinerator();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("passes AbortController signal to fetch for endpoint calls", async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(BURN_RESPONSE));

      await client.burn({
        userPublicKey: TEST_PUBLIC_KEY,
        assetId: TEST_ASSET_ID,
      });

      const [, opts] = fetchMock.mock.calls[0];
      expect(opts.signal).toBeDefined();
      expect(opts.signal).toBeInstanceOf(AbortSignal);
    });

    it("passes AbortController signal to fetch for status()", async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ status: "ok" }));

      await client.status();

      const [, opts] = fetchMock.mock.calls[0];
      expect(opts.signal).toBeDefined();
      expect(opts.signal).toBeInstanceOf(AbortSignal);
    });

    it("aborts fetch that hangs beyond the timeout for endpoint calls", async () => {
      jest.spyOn(console, "warn").mockImplementation(() => {});

      // Capture the signal to verify it gets aborted
      let capturedSignal: AbortSignal | undefined;
      fetchMock.mockImplementation((_url: string, opts: { signal: AbortSignal }) => {
        capturedSignal = opts.signal;
        // Return a promise that never resolves on its own --
        // the abort controller fires after REQUEST_TIMEOUT_MS.
        return new Promise((_resolve, reject) => {
          opts.signal.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        });
      });

      const promise = client.burn({
        userPublicKey: TEST_PUBLIC_KEY,
        assetId: TEST_ASSET_ID,
      });

      // Before timeout, signal should not be aborted
      expect(capturedSignal!.aborted).toBe(false);

      // Attach catch handler before advancing timers so the rejection
      // during timer advancement is not treated as unhandled.
      const resultPromise = promise.catch((err: unknown) => err);

      // Advance past the 30s REQUEST_TIMEOUT_MS using async version
      // to properly interleave microtask flushing.
      await jest.advanceTimersByTimeAsync(31_000);

      const error = await resultPromise;
      expect(error).toBeDefined();
      expect(capturedSignal!.aborted).toBe(true);
    }, 15_000);

    it("aborts fetch that hangs beyond 10s timeout for status()", async () => {
      let capturedSignal: AbortSignal | undefined;
      fetchMock.mockImplementation((_url: string, opts: { signal: AbortSignal }) => {
        capturedSignal = opts.signal;
        return new Promise((_resolve, reject) => {
          opts.signal.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        });
      });

      const promise = client.status();

      expect(capturedSignal!.aborted).toBe(false);

      // Attach catch handler before advancing timers
      const resultPromise = promise.catch((err: unknown) => err);

      // status() uses a 10s timeout
      await jest.advanceTimersByTimeAsync(11_000);

      const error = await resultPromise;
      expect(error).toBeDefined();
      expect(capturedSignal!.aborted).toBe(true);
    }, 15_000);
  });

  // ==================== Additional edge cases ====================

  describe("edge cases", () => {
    it("passes optional parameters through to the API", async () => {
      process.env.SOL_INCINERATOR_API_KEY = TEST_API_KEY;
      const client = loadModule().getSolIncinerator();

      fetchMock.mockResolvedValueOnce(mockResponse(BURN_RESPONSE));

      await client.burn({
        userPublicKey: TEST_PUBLIC_KEY,
        assetId: TEST_ASSET_ID,
        feePayer: "FeePayer111",
        autoCloseTokenAccounts: true,
        priorityFeeMicroLamports: 50000,
        burnAmount: 1,
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body).toEqual({
        userPublicKey: TEST_PUBLIC_KEY,
        assetId: TEST_ASSET_ID,
        feePayer: "FeePayer111",
        autoCloseTokenAccounts: true,
        priorityFeeMicroLamports: 50000,
        burnAmount: 1,
      });
    });

    it("each endpoint hits the correct URL path", async () => {
      process.env.SOL_INCINERATOR_API_KEY = TEST_API_KEY;
      const client = loadModule().getSolIncinerator();

      const endpoints = [
        {
          method: "burn" as const,
          path: "/burn",
          params: { userPublicKey: TEST_PUBLIC_KEY, assetId: TEST_ASSET_ID },
        },
        {
          method: "close" as const,
          path: "/close",
          params: { userPublicKey: TEST_PUBLIC_KEY, assetId: TEST_ASSET_ID },
        },
        {
          method: "batchCloseAll" as const,
          path: "/batch/close-all",
          params: { userPublicKey: TEST_PUBLIC_KEY },
        },
        {
          method: "burnPreview" as const,
          path: "/burn/preview",
          params: { userPublicKey: TEST_PUBLIC_KEY, assetId: TEST_ASSET_ID },
        },
        {
          method: "closePreview" as const,
          path: "/close/preview",
          params: { userPublicKey: TEST_PUBLIC_KEY, assetId: TEST_ASSET_ID },
        },
        {
          method: "batchCloseAllPreview" as const,
          path: "/batch/close-all/preview",
          params: { userPublicKey: TEST_PUBLIC_KEY },
        },
      ];

      for (const ep of endpoints) {
        fetchMock.mockReset();
        fetchMock.mockResolvedValueOnce(mockResponse(BURN_RESPONSE));

        await (client[ep.method] as Function)(ep.params);

        const [url] = fetchMock.mock.calls[0];
        expect(url).toBe(`${API_BASE}${ep.path}`);
      }
    });

    it("non-Error thrown during fetch is treated as non-retryable", async () => {
      process.env.SOL_INCINERATOR_API_KEY = TEST_API_KEY;
      const client = loadModule().getSolIncinerator();

      // Throw a string (not an Error instance)
      fetchMock.mockRejectedValueOnce("something went wrong");

      // The retry logic does: `const msg = err instanceof Error ? err.message : ""`
      // msg = "" which doesn't match any retryable pattern, so it throws immediately
      await expect(
        client.burn({ userPublicKey: TEST_PUBLIC_KEY, assetId: TEST_ASSET_ID })
      ).rejects.toBe("something went wrong");

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("HTTP error with JSON where error is an object but no message field uses error as string", async () => {
      process.env.SOL_INCINERATOR_API_KEY = TEST_API_KEY;
      const client = loadModule().getSolIncinerator();

      // { error: { code: 123 } } -- parsed.error?.message is undefined,
      // parsed.error is { code: 123 } which is truthy. The code does:
      // msg = parsed.error?.message || parsed.error || msg
      // parsed.error?.message = undefined, so parsed.error = { code: 123 }
      // which is truthy. new Error({ code: 123 }) converts to "[object Object]".
      fetchMock.mockResolvedValueOnce(
        mockResponse(JSON.stringify({ error: { code: 123 } }), {
          status: 422,
          ok: false,
          statusText: "Unprocessable Entity",
        })
      );

      await expect(
        client.burn({ userPublicKey: TEST_PUBLIC_KEY, assetId: TEST_ASSET_ID })
      ).rejects.toThrow("[object Object]");
    });

    it("handles API returning completely empty JSON object on 200", async () => {
      process.env.SOL_INCINERATOR_API_KEY = TEST_API_KEY;
      const client = loadModule().getSolIncinerator();

      fetchMock.mockResolvedValueOnce(mockResponse({}));

      // Empty object has no error.message, so it passes through
      const result = await client.burn({
        userPublicKey: TEST_PUBLIC_KEY,
        assetId: TEST_ASSET_ID,
      });
      expect(result).toEqual({});
    });

    it("handles API returning null on 200", async () => {
      process.env.SOL_INCINERATOR_API_KEY = TEST_API_KEY;
      const client = loadModule().getSolIncinerator();

      fetchMock.mockResolvedValueOnce(mockResponse(null));

      // null?.error?.message is undefined, so no throw
      const result = await client.burn({
        userPublicKey: TEST_PUBLIC_KEY,
        assetId: TEST_ASSET_ID,
      });
      expect(result).toBeNull();
    });
  });

  // ==================== isRpcRateLimit logic ====================

  describe("isRpcRateLimit detection (via retry behavior)", () => {
    let client: ReturnType<typeof import("@/lib/sol-incinerator").getSolIncinerator>;

    beforeEach(() => {
      jest.useFakeTimers();
      jest.spyOn(console, "warn").mockImplementation(() => {});
      process.env.SOL_INCINERATOR_API_KEY = TEST_API_KEY;
      client = loadModule().getSolIncinerator();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('"max usage reached" triggers retry', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ error: { message: "max usage reached" } }));
      fetchMock.mockResolvedValueOnce(mockResponse(BURN_RESPONSE));

      const promise = client.burn({
        userPublicKey: TEST_PUBLIC_KEY,
        assetId: TEST_ASSET_ID,
      });

      await jest.advanceTimersByTimeAsync(6_000);

      const result = await promise;
      expect(result).toEqual(BURN_RESPONSE);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    }, 15_000);

    it('"-32429" in message triggers retry', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ error: { message: "Error code -32429" } }));
      fetchMock.mockResolvedValueOnce(mockResponse(BURN_RESPONSE));

      const promise = client.burn({
        userPublicKey: TEST_PUBLIC_KEY,
        assetId: TEST_ASSET_ID,
      });

      await jest.advanceTimersByTimeAsync(6_000);

      const result = await promise;
      expect(result).toEqual(BURN_RESPONSE);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    }, 15_000);

    it("unrelated error message does NOT trigger retry", async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ error: { message: "Unknown mint address" } }));

      await expect(
        client.burn({ userPublicKey: TEST_PUBLIC_KEY, assetId: TEST_ASSET_ID })
      ).rejects.toThrow("Unknown mint address");

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
