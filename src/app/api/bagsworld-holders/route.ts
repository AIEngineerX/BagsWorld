import { NextResponse } from "next/server";

// BagsWorld token mint address
const BAGSWORLD_MINT = "9auyeHWESnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS";
const TOKEN_DECIMALS = 6;
const DECIMAL_DIVISOR = 10 ** TOKEN_DECIMALS; // Pre-computed for efficiency

// Addresses to exclude (liquidity pools, burn addresses, etc.)
const EXCLUDED_ADDRESSES = new Set([
  "HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC", // Liquidity pool
  "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1", // Raydium AMM
]);

// Cache for holder data (2 minutes - shorter for faster updates)
const CACHE_TTL = 2 * 60 * 1000;
let cachedHolders: { data: TokenHolder[]; timestamp: number } | null = null;

export interface TokenHolder {
  address: string; // Owner wallet address
  tokenAccount?: string; // Token account address (for reference)
  balance: number; // Human-readable balance
  percentage: number;
  rank: number;
}

// Try Helius DAS API first (more reliable, higher rate limits)
async function fetchHoldersFromHelius(heliusUrl: string): Promise<TokenHolder[]> {
  try {
    console.log("[Holders] Trying Helius DAS API...");

    // Get token accounts using Helius's enhanced RPC
    const response = await fetch(heliusUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenLargestAccounts",
        params: [BAGSWORLD_MINT],
      }),
    });

    if (!response.ok) {
      console.warn("[Holders] Helius request failed:", response.status);
      return [];
    }

    const data = await response.json();
    if (data.error) {
      console.warn("[Holders] Helius RPC error:", data.error.message);
      return [];
    }

    const accounts = data.result?.value || [];
    if (accounts.length === 0) {
      console.warn("[Holders] No accounts from Helius");
      return [];
    }

    // Get total supply
    const supplyResponse = await fetch(heliusUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenSupply",
        params: [BAGSWORLD_MINT],
      }),
    });

    let totalSupply = 0;
    if (supplyResponse.ok) {
      const supplyData = await supplyResponse.json();
      totalSupply = parseFloat(supplyData.result?.value?.amount || "0") / DECIMAL_DIVISOR;
    }

    // Resolve owners for top 10 accounts
    const topAccounts = accounts.slice(0, 10);
    const holders: TokenHolder[] = [];
    let rank = 1;

    for (const account of topAccounts) {
      if (holders.length >= 5) break;

      // Resolve token account to owner
      const ownerResponse = await fetch(heliusUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getAccountInfo",
          params: [account.address, { encoding: "jsonParsed" }],
        }),
      });

      let ownerAddress = account.address;
      if (ownerResponse.ok) {
        const ownerData = await ownerResponse.json();
        ownerAddress = ownerData.result?.value?.data?.parsed?.info?.owner || account.address;
      }

      // Skip excluded addresses
      if (EXCLUDED_ADDRESSES.has(ownerAddress)) {
        console.log(`[Holders] Skipping excluded: ${ownerAddress.substring(0, 8)}...`);
        continue;
      }

      const balance = parseFloat(account.amount) / DECIMAL_DIVISOR || 0;
      const percentage = totalSupply > 0 ? (balance / totalSupply) * 100 : 0;

      holders.push({
        address: ownerAddress,
        tokenAccount: account.address,
        balance,
        percentage: Math.round(percentage * 100) / 100,
        rank: rank++,
      });
    }

    console.log(`[Holders] Got ${holders.length} holders from Helius`);
    return holders;
  } catch (err) {
    console.warn("[Holders] Helius failed:", err);
    return [];
  }
}

// Resolve token account to owner wallet using RPC
async function resolveTokenAccountOwner(
  rpcUrl: string,
  tokenAccount: string
): Promise<string | null> {
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAccountInfo",
        params: [tokenAccount, { encoding: "jsonParsed" }],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const owner = data.result?.value?.data?.parsed?.info?.owner;
      return owner || null;
    }
  } catch (err) {
    console.warn(`[Holders] Failed to resolve owner for ${tokenAccount}:`, err);
  }
  return null;
}

// Get token supply for percentage calculation
async function getTokenSupply(rpcUrl: string): Promise<number> {
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenSupply",
        params: [BAGSWORLD_MINT],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const amount = data.result?.value?.amount;
      if (amount) {
        return parseFloat(amount) / DECIMAL_DIVISOR;
      }
    }
  } catch (err) {
    console.warn("[Holders] Failed to get token supply:", err);
  }
  return 0;
}

export async function GET(): Promise<NextResponse> {
  // Check cache first - but only if it has data (don't cache empty results)
  if (
    cachedHolders &&
    cachedHolders.data.length > 0 &&
    Date.now() - cachedHolders.timestamp < CACHE_TTL
  ) {
    return NextResponse.json({
      holders: cachedHolders.data,
      cached: true,
      cacheAge: Math.round((Date.now() - cachedHolders.timestamp) / 1000),
    });
  }

  // Clear stale empty cache
  if (cachedHolders && cachedHolders.data.length === 0) {
    cachedHolders = null;
  }

  let holders: TokenHolder[] = [];

  // Try Helius first (server-side RPC with better rate limits)
  const heliusUrl = process.env.SOLANA_RPC_URL;
  if (heliusUrl && heliusUrl.includes("helius")) {
    holders = await fetchHoldersFromHelius(heliusUrl);
  }

  // If Helius didn't work, try other RPCs
  if (holders.length === 0) {
    const { getReadRpcUrl } = await import("@/lib/env-utils");
    const rpcUrls = [process.env.SOLANA_RPC_URL, getReadRpcUrl()].filter(Boolean) as string[];

    for (const rpcUrl of rpcUrls) {
      if (holders.length > 0) break;

      try {
        console.log(`[Holders] Trying RPC: ${rpcUrl.substring(0, 40)}...`);

        const rpcResponse = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getTokenLargestAccounts",
            params: [BAGSWORLD_MINT],
          }),
        });

        if (rpcResponse.ok) {
          const rpcData = await rpcResponse.json();

          if (rpcData.error) {
            console.warn(
              `[Holders] RPC error from ${rpcUrl.substring(0, 30)}:`,
              rpcData.error.message
            );
            continue;
          }

          const accounts = rpcData.result?.value || [];
          if (accounts.length === 0) {
            console.warn(`[Holders] No accounts from ${rpcUrl.substring(0, 30)}`);
            continue;
          }

          const totalSupply = await getTokenSupply(rpcUrl);
          const topAccounts = accounts.slice(0, 10);
          const ownerPromises = topAccounts.map((account: { address: string }) =>
            resolveTokenAccountOwner(rpcUrl, account.address)
          );
          const owners = await Promise.all(ownerPromises);

          let rank = 1;
          for (let i = 0; i < topAccounts.length && holders.length < 5; i++) {
            const account = topAccounts[i];
            const ownerAddress = owners[i];
            const resolvedAddress = ownerAddress || account.address;

            if (EXCLUDED_ADDRESSES.has(resolvedAddress)) {
              console.log(`[Holders] Skipping excluded: ${resolvedAddress.substring(0, 8)}...`);
              continue;
            }

            const balance = parseFloat(account.amount) / DECIMAL_DIVISOR || 0;
            const percentage = totalSupply > 0 ? (balance / totalSupply) * 100 : 0;

            holders.push({
              address: resolvedAddress,
              tokenAccount: account.address,
              balance,
              percentage: Math.round(percentage * 100) / 100,
              rank: rank++,
            });
          }

          console.log(`[Holders] Got ${holders.length} holders from ${rpcUrl.substring(0, 30)}`);
        }
      } catch (err) {
        console.warn(`[Holders] RPC failed (${rpcUrl.substring(0, 30)}):`, err);
      }
    }
  }

  // If no real holders found, use placeholder data for development/testing
  if (holders.length === 0) {
    console.log("[BagsWorld Holders] Using placeholder data - API unavailable");
    const placeholderHolders: TokenHolder[] = [
      {
        address: "BaGs1WhaLeHoLderxxxxxxxxxxxxxxxxxxxxxxxxx",
        balance: 12500000,
        percentage: 28.5,
        rank: 1,
      },
      {
        address: "BaGs2BiGHoLderxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        balance: 6200000,
        percentage: 14.2,
        rank: 2,
      },
      {
        address: "BaGs3HoLderxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        balance: 3800000,
        percentage: 8.7,
        rank: 3,
      },
      {
        address: "BaGs4HoLderxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        balance: 2100000,
        percentage: 4.8,
        rank: 4,
      },
      {
        address: "BaGs5HoLderxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        balance: 1400000,
        percentage: 3.2,
        rank: 5,
      },
    ];
    cachedHolders = { data: placeholderHolders, timestamp: Date.now() };
    return NextResponse.json({
      holders: placeholderHolders,
      cached: false,
      mint: BAGSWORLD_MINT,
      count: placeholderHolders.length,
      placeholder: true,
    });
  }

  // Update cache
  cachedHolders = { data: holders, timestamp: Date.now() };

  return NextResponse.json({
    holders,
    cached: false,
    mint: BAGSWORLD_MINT,
    count: holders.length,
  });
}
