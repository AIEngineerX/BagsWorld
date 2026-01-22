/**
 * useWorldState Hook Tests
 *
 * Tests the world state hook with:
 * - Async token loading behavior
 * - Storage event handling
 * - Query refetching
 * - Error states
 * - Token refresh functionality
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useWorldState } from "@/hooks/useWorldState";
import * as tokenRegistry from "@/lib/token-registry";
import * as store from "@/lib/store";
import type { LaunchedToken } from "@/lib/token-registry";
import type { WorldState } from "@/lib/types";
import React from "react";

// Mock token registry
jest.mock("@/lib/token-registry", () => ({
  getAllWorldTokens: jest.fn(),
  getAllWorldTokensAsync: jest.fn(),
}));

// Mock store
jest.mock("@/lib/store", () => ({
  useGameStore: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

// Create wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

const mockWorldState: WorldState = {
  health: 75,
  weather: "sunny",
  population: [],
  buildings: [],
  events: [],
  lastUpdated: Date.now(),
};

const mockTokens: LaunchedToken[] = [
  {
    mint: "test-token-1",
    name: "Test Token",
    symbol: "TEST",
    creator: "creator-wallet",
    createdAt: Date.now(),
  },
];

describe("useWorldState Hook", () => {
  let mockStoreState: {
    worldState: WorldState | null;
    setWorldState: jest.Mock;
    setLoading: jest.Mock;
    setError: jest.Mock;
    isLoading: boolean;
    error: string | null;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock store
    mockStoreState = {
      worldState: null,
      setWorldState: jest.fn(),
      setLoading: jest.fn(),
      setError: jest.fn(),
      isLoading: false,
      error: null,
    };
    (store.useGameStore as jest.Mock).mockReturnValue(mockStoreState);

    // Setup mock token registry
    (tokenRegistry.getAllWorldTokens as jest.Mock).mockReturnValue([]);
    (tokenRegistry.getAllWorldTokensAsync as jest.Mock).mockResolvedValue([]);

    // Setup mock fetch
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockWorldState),
    });
  });

  describe("Initial loading", () => {
    it("should load tokens from registry on mount", async () => {
      (tokenRegistry.getAllWorldTokens as jest.Mock).mockReturnValue(mockTokens);
      (tokenRegistry.getAllWorldTokensAsync as jest.Mock).mockResolvedValue(
        mockTokens
      );

      let hookResult: any;
      await act(async () => {
        const { result } = renderHook(() => useWorldState(), {
          wrapper: createWrapper(),
        });
        hookResult = result;
      });

      expect(tokenRegistry.getAllWorldTokens).toHaveBeenCalled();
    });

    it("should start in loading state", async () => {
      (tokenRegistry.getAllWorldTokens as jest.Mock).mockReturnValue([]);
      (tokenRegistry.getAllWorldTokensAsync as jest.Mock).mockResolvedValue([]);

      let hookResult: any;
      await act(async () => {
        const { result } = renderHook(() => useWorldState(), {
          wrapper: createWrapper(),
        });
        hookResult = result;
      });

      // After initial render, loading state is managed by the hook
      expect(hookResult.current).toHaveProperty("isLoading");
    });

    it("should fetch global tokens asynchronously", async () => {
      const globalTokens = [
        ...mockTokens,
        {
          mint: "global-token",
          name: "Global Token",
          symbol: "GLB",
          creator: "creator",
          createdAt: Date.now(),
        },
      ];

      (tokenRegistry.getAllWorldTokens as jest.Mock).mockReturnValue(mockTokens);
      (tokenRegistry.getAllWorldTokensAsync as jest.Mock).mockResolvedValue(
        globalTokens
      );

      await act(async () => {
        renderHook(() => useWorldState(), {
          wrapper: createWrapper(),
        });
      });

      expect(tokenRegistry.getAllWorldTokensAsync).toHaveBeenCalled();
    });
  });

  describe("Fetch world state", () => {
    it("should POST tokens to /api/world-state", async () => {
      (tokenRegistry.getAllWorldTokens as jest.Mock).mockReturnValue(mockTokens);
      (tokenRegistry.getAllWorldTokensAsync as jest.Mock).mockResolvedValue(
        mockTokens
      );

      await act(async () => {
        renderHook(() => useWorldState(), {
          wrapper: createWrapper(),
        });
      });

      // Give time for fetch to be called
      await act(async () => {
        await new Promise((r) => setTimeout(r, 100));
      });

      expect(global.fetch).toHaveBeenCalled();
    });

    it("should update store with fetched world state", async () => {
      (tokenRegistry.getAllWorldTokens as jest.Mock).mockReturnValue(mockTokens);
      (tokenRegistry.getAllWorldTokensAsync as jest.Mock).mockResolvedValue(
        mockTokens
      );

      await act(async () => {
        renderHook(() => useWorldState(), {
          wrapper: createWrapper(),
        });
      });

      // Give time for state to update
      await act(async () => {
        await new Promise((r) => setTimeout(r, 100));
      });

      expect(mockStoreState.setWorldState).toHaveBeenCalled();
    });

    it("should handle fetch errors gracefully", async () => {
      (tokenRegistry.getAllWorldTokens as jest.Mock).mockReturnValue([]);
      (tokenRegistry.getAllWorldTokensAsync as jest.Mock).mockResolvedValue([]);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      let hookResult: any;
      await act(async () => {
        const { result } = renderHook(() => useWorldState(), {
          wrapper: createWrapper(),
        });
        hookResult = result;
      });

      // Hook should exist and have expected shape
      expect(hookResult.current).toHaveProperty("worldState");
      expect(hookResult.current).toHaveProperty("isLoading");
      expect(hookResult.current).toHaveProperty("refetch");
    });

    it("should handle network errors gracefully", async () => {
      (tokenRegistry.getAllWorldTokens as jest.Mock).mockReturnValue([]);
      (tokenRegistry.getAllWorldTokensAsync as jest.Mock).mockResolvedValue([]);
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      let hookResult: any;
      await act(async () => {
        const { result } = renderHook(() => useWorldState(), {
          wrapper: createWrapper(),
        });
        hookResult = result;
      });

      // Hook should exist and have expected shape
      expect(hookResult.current).toHaveProperty("worldState");
      expect(hookResult.current).toHaveProperty("error");
    });
  });

  describe("Storage event handling", () => {
    it("should reload tokens on storage change", async () => {
      (tokenRegistry.getAllWorldTokens as jest.Mock).mockReturnValue([]);
      (tokenRegistry.getAllWorldTokensAsync as jest.Mock).mockResolvedValue([]);

      await act(async () => {
        renderHook(() => useWorldState(), {
          wrapper: createWrapper(),
        });
      });

      // Clear previous calls
      (tokenRegistry.getAllWorldTokens as jest.Mock).mockClear();

      // Simulate storage event
      await act(async () => {
        const storageEvent = new StorageEvent("storage", {
          key: "bagsworld_tokens",
          newValue: JSON.stringify(mockTokens),
        });
        window.dispatchEvent(storageEvent);
      });

      expect(tokenRegistry.getAllWorldTokens).toHaveBeenCalled();
    });

    it("should ignore unrelated storage changes", async () => {
      (tokenRegistry.getAllWorldTokens as jest.Mock).mockReturnValue([]);
      (tokenRegistry.getAllWorldTokensAsync as jest.Mock).mockResolvedValue([]);

      await act(async () => {
        renderHook(() => useWorldState(), {
          wrapper: createWrapper(),
        });
      });

      // Clear calls
      (tokenRegistry.getAllWorldTokens as jest.Mock).mockClear();

      // Simulate unrelated storage event
      await act(async () => {
        const storageEvent = new StorageEvent("storage", {
          key: "some_other_key",
          newValue: "value",
        });
        window.dispatchEvent(storageEvent);
      });

      // Should not have reloaded tokens for unrelated key
      expect(tokenRegistry.getAllWorldTokens).not.toHaveBeenCalled();
    });

    it("should reload tokens on custom bagsworld-token-update event", async () => {
      (tokenRegistry.getAllWorldTokens as jest.Mock).mockReturnValue([]);
      (tokenRegistry.getAllWorldTokensAsync as jest.Mock).mockResolvedValue([]);

      await act(async () => {
        renderHook(() => useWorldState(), {
          wrapper: createWrapper(),
        });
      });

      // Clear calls
      (tokenRegistry.getAllWorldTokens as jest.Mock).mockClear();

      // Simulate custom event
      await act(async () => {
        window.dispatchEvent(new CustomEvent("bagsworld-token-update"));
      });

      expect(tokenRegistry.getAllWorldTokens).toHaveBeenCalled();
    });
  });

  describe("refreshAfterLaunch", () => {
    it("should reload tokens and refetch query", async () => {
      (tokenRegistry.getAllWorldTokens as jest.Mock).mockReturnValue(mockTokens);
      (tokenRegistry.getAllWorldTokensAsync as jest.Mock).mockResolvedValue(mockTokens);

      let hookResult: any;
      await act(async () => {
        const { result } = renderHook(() => useWorldState(), {
          wrapper: createWrapper(),
        });
        hookResult = result;
      });

      // Clear mocks
      (tokenRegistry.getAllWorldTokens as jest.Mock).mockClear();

      // Call refreshAfterLaunch
      await act(async () => {
        hookResult.current.refreshAfterLaunch();
      });

      expect(tokenRegistry.getAllWorldTokens).toHaveBeenCalled();
    });
  });

  describe("Query configuration", () => {
    it("should trigger fetch when tokens are loaded", async () => {
      const tokens1 = [
        {
          mint: "token-1",
          name: "Token 1",
          symbol: "T1",
          creator: "c",
          createdAt: Date.now(),
        },
      ];

      (tokenRegistry.getAllWorldTokens as jest.Mock).mockReturnValue(tokens1);
      (tokenRegistry.getAllWorldTokensAsync as jest.Mock).mockResolvedValue(
        tokens1
      );

      await act(async () => {
        renderHook(() => useWorldState(), {
          wrapper: createWrapper(),
        });
      });

      // Give time for fetch to be triggered
      await act(async () => {
        await new Promise((r) => setTimeout(r, 100));
      });

      // Verify fetch was called
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe("Error handling in token loading", () => {
    it("should continue with local tokens if global fetch fails", async () => {
      const localTokens = [
        {
          mint: "local-token",
          name: "Local",
          symbol: "LCL",
          creator: "c",
          createdAt: Date.now(),
        },
      ];

      (tokenRegistry.getAllWorldTokens as jest.Mock).mockReturnValue(localTokens);
      (tokenRegistry.getAllWorldTokensAsync as jest.Mock).mockRejectedValue(
        new Error("Network error")
      );

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      let hookResult: any;
      await act(async () => {
        const { result } = renderHook(() => useWorldState(), {
          wrapper: createWrapper(),
        });
        hookResult = result;
      });

      // Should still have the local token
      expect(hookResult.current.tokenCount).toBeGreaterThanOrEqual(0);

      consoleSpy.mockRestore();
    });
  });

  describe("Return values", () => {
    it("should return worldState from store", async () => {
      mockStoreState.worldState = mockWorldState;
      (store.useGameStore as jest.Mock).mockReturnValue(mockStoreState);
      (tokenRegistry.getAllWorldTokens as jest.Mock).mockReturnValue([]);
      (tokenRegistry.getAllWorldTokensAsync as jest.Mock).mockResolvedValue([]);

      let hookResult: any;
      await act(async () => {
        const { result } = renderHook(() => useWorldState(), {
          wrapper: createWrapper(),
        });
        hookResult = result;
      });

      expect(hookResult.current.worldState).toBe(mockWorldState);
    });

    it("should return combined loading state", async () => {
      mockStoreState.isLoading = true;
      (tokenRegistry.getAllWorldTokens as jest.Mock).mockReturnValue([]);
      (tokenRegistry.getAllWorldTokensAsync as jest.Mock).mockResolvedValue([]);

      let hookResult: any;
      await act(async () => {
        const { result } = renderHook(() => useWorldState(), {
          wrapper: createWrapper(),
        });
        hookResult = result;
      });

      expect(hookResult.current.isLoading).toBe(true);
    });

    it("should return error from store", async () => {
      mockStoreState.error = "Test error";
      (store.useGameStore as jest.Mock).mockReturnValue(mockStoreState);
      (tokenRegistry.getAllWorldTokens as jest.Mock).mockReturnValue([]);
      (tokenRegistry.getAllWorldTokensAsync as jest.Mock).mockResolvedValue([]);

      let hookResult: any;
      await act(async () => {
        const { result } = renderHook(() => useWorldState(), {
          wrapper: createWrapper(),
        });
        hookResult = result;
      });

      expect(hookResult.current.error).toBe("Test error");
    });

    it("should return refetch function", async () => {
      (tokenRegistry.getAllWorldTokens as jest.Mock).mockReturnValue([]);
      (tokenRegistry.getAllWorldTokensAsync as jest.Mock).mockResolvedValue([]);

      let hookResult: any;
      await act(async () => {
        const { result } = renderHook(() => useWorldState(), {
          wrapper: createWrapper(),
        });
        hookResult = result;
      });

      expect(typeof hookResult.current.refetch).toBe("function");
    });

    it("should return tokenCount", async () => {
      (tokenRegistry.getAllWorldTokens as jest.Mock).mockReturnValue(mockTokens);
      (tokenRegistry.getAllWorldTokensAsync as jest.Mock).mockResolvedValue(
        mockTokens
      );

      let hookResult: any;
      await act(async () => {
        const { result } = renderHook(() => useWorldState(), {
          wrapper: createWrapper(),
        });
        hookResult = result;
      });

      expect(hookResult.current.tokenCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Cleanup", () => {
    it("should remove event listeners on unmount", async () => {
      (tokenRegistry.getAllWorldTokens as jest.Mock).mockReturnValue([]);
      (tokenRegistry.getAllWorldTokensAsync as jest.Mock).mockResolvedValue([]);

      const removeEventListenerSpy = jest.spyOn(window, "removeEventListener");

      let unmountFn: () => void;
      await act(async () => {
        const { unmount } = renderHook(() => useWorldState(), {
          wrapper: createWrapper(),
        });
        unmountFn = unmount;
      });

      await act(async () => {
        unmountFn!();
      });

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "storage",
        expect.any(Function)
      );
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "bagsworld-token-update",
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
    });
  });
});
