/**
 * useAdminCheck Hook Comprehensive Tests
 *
 * Tests admin status checking with:
 * - Wallet connection states
 * - API response handling
 * - Loading states
 * - Error handling
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

// Mock the wallet adapter
jest.mock("@solana/wallet-adapter-react", () => ({
  useWallet: jest.fn(),
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("useAdminCheck", () => {
  const mockPublicKey = {
    toBase58: () => "AdminWallet11111111111111111111111111111111",
  } as PublicKey;

  beforeEach(() => {
    jest.clearAllMocks();
    (useWallet as jest.Mock).mockReturnValue({
      publicKey: null,
      connected: false,
    });
  });

  describe("Wallet Not Connected", () => {
    it("should return isAdmin: false when wallet is not connected", async () => {
      (useWallet as jest.Mock).mockReturnValue({
        publicKey: null,
        connected: false,
      });

      const { result } = renderHook(() => useAdminCheck());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAdmin).toBe(false);
      expect(result.current.isConfigured).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should return isAdmin: false when publicKey is null but connected is true", async () => {
      (useWallet as jest.Mock).mockReturnValue({
        publicKey: null,
        connected: true,
      });

      const { result } = renderHook(() => useAdminCheck());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAdmin).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should return isAdmin: false when connected is false but publicKey exists", async () => {
      (useWallet as jest.Mock).mockReturnValue({
        publicKey: mockPublicKey,
        connected: false,
      });

      const { result } = renderHook(() => useAdminCheck());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAdmin).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("Wallet Connected", () => {
    beforeEach(() => {
      (useWallet as jest.Mock).mockReturnValue({
        publicKey: mockPublicKey,
        connected: true,
      });
    });

    it("should fetch admin status when wallet is connected", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ isAdmin: true, configured: true }),
      });

      const { result } = renderHook(() => useAdminCheck());

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/admin/check?wallet=${mockPublicKey.toBase58()}`
      );
      expect(result.current.isAdmin).toBe(true);
      expect(result.current.isConfigured).toBe(true);
    });

    it("should set isAdmin: false when API returns false", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ isAdmin: false, configured: true }),
      });

      const { result } = renderHook(() => useAdminCheck());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAdmin).toBe(false);
      expect(result.current.isConfigured).toBe(true);
    });

    it("should set isConfigured: false when API returns configured: false", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ isAdmin: false, configured: false }),
      });

      const { result } = renderHook(() => useAdminCheck());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAdmin).toBe(false);
      expect(result.current.isConfigured).toBe(false);
    });

    it("should handle API returning isAdmin: true explicitly", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ isAdmin: true, configured: true }),
      });

      const { result } = renderHook(() => useAdminCheck());

      await waitFor(() => {
        expect(result.current.isAdmin).toBe(true);
      });
    });

    it("should treat truthy non-boolean values correctly", async () => {
      // API might return string "true" or number 1
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ isAdmin: "true", configured: 1 }),
      });

      const { result } = renderHook(() => useAdminCheck());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should be strict boolean comparison
      expect(result.current.isAdmin).toBe(false); // "true" !== true
      expect(result.current.isConfigured).toBe(false); // 1 !== true
    });
  });

  describe("Error Handling", () => {
    beforeEach(() => {
      (useWallet as jest.Mock).mockReturnValue({
        publicKey: mockPublicKey,
        connected: true,
      });
    });

    it("should set isAdmin: false on API error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const { result } = renderHook(() => useAdminCheck());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAdmin).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        "[useAdminCheck] Failed to check admin status:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });

    it("should set isAdmin: false on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("Server error")),
      });

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const { result } = renderHook(() => useAdminCheck());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAdmin).toBe(false);
      consoleSpy.mockRestore();
    });

    it("should set isAdmin: false when JSON parsing fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error("Invalid JSON")),
      });

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const { result } = renderHook(() => useAdminCheck());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAdmin).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe("Loading State", () => {
    it("should start with isLoading: true", async () => {
      (useWallet as jest.Mock).mockReturnValue({
        publicKey: mockPublicKey,
        connected: true,
      });

      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: () => Promise.resolve({ isAdmin: false, configured: true }),
                }),
              100
            )
          )
      );

      const { result } = renderHook(() => useAdminCheck());

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it("should reset isLoading to true when wallet changes", async () => {
      const newPublicKey = {
        toBase58: () => "NewWallet111111111111111111111111111111111",
      } as PublicKey;

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ isAdmin: false, configured: true }),
      });

      (useWallet as jest.Mock).mockReturnValue({
        publicKey: mockPublicKey,
        connected: true,
      });

      const { result, rerender } = renderHook(() => useAdminCheck());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Change wallet
      (useWallet as jest.Mock).mockReturnValue({
        publicKey: newPublicKey,
        connected: true,
      });

      rerender();

      // Should be loading again
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe("Wallet State Changes", () => {
    it("should refetch when publicKey changes", async () => {
      const newPublicKey = {
        toBase58: () => "NewAdmin1111111111111111111111111111111111",
      } as PublicKey;

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ isAdmin: true, configured: true }),
      });

      (useWallet as jest.Mock).mockReturnValue({
        publicKey: mockPublicKey,
        connected: true,
      });

      const { result, rerender } = renderHook(() => useAdminCheck());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Change to new wallet
      (useWallet as jest.Mock).mockReturnValue({
        publicKey: newPublicKey,
        connected: true,
      });

      rerender();

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      expect(mockFetch).toHaveBeenLastCalledWith(
        `/api/admin/check?wallet=${newPublicKey.toBase58()}`
      );
    });

    it("should handle wallet disconnect", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ isAdmin: true, configured: true }),
      });

      (useWallet as jest.Mock).mockReturnValue({
        publicKey: mockPublicKey,
        connected: true,
      });

      const { result, rerender } = renderHook(() => useAdminCheck());

      await waitFor(() => {
        expect(result.current.isAdmin).toBe(true);
      });

      // Disconnect wallet
      (useWallet as jest.Mock).mockReturnValue({
        publicKey: null,
        connected: false,
      });

      rerender();

      await waitFor(() => {
        expect(result.current.isAdmin).toBe(false);
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle undefined response fields", async () => {
      (useWallet as jest.Mock).mockReturnValue({
        publicKey: mockPublicKey,
        connected: true,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}), // Empty object
      });

      const { result } = renderHook(() => useAdminCheck());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAdmin).toBe(false);
      expect(result.current.isConfigured).toBe(false);
    });

    it("should handle null response", async () => {
      (useWallet as jest.Mock).mockReturnValue({
        publicKey: mockPublicKey,
        connected: true,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(null),
      });

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const { result } = renderHook(() => useAdminCheck());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should handle gracefully
      expect(result.current.isAdmin).toBe(false);
      consoleSpy.mockRestore();
    });
  });
});
