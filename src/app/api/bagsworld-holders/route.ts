import { NextResponse } from "next/server";

// BagsWorld token mint address
const BAGSWORLD_MINT = "9auyeHWESnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS";
const TOKEN_DECIMALS = 6;
const DECIMAL_DIVISOR = 10 ** TOKEN_DECIMALS; // Pre-computed for efficiency

// Cache for holder data (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;
let cachedHolders: { data: TokenHolder[]; timestamp: number } | null = null;

export interface TokenHolder {
  address: string; // Owner wallet address
  tokenAccount?: string; // Token account address (for reference)
  balance: number; // Human-readable balance
  percentage: number;
  rank: number;
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

  const holders: TokenHolder[] = [];
  const rpcUrl = process.env.SOLANA_RPC_URL;

  // Try SolanaFM API first (most reliable for holder data with owner addresses)
  try {
    const solanaFmResponse = await fetch(
      `https://api.solana.fm/v1/tokens/${BAGSWORLD_MINT}/holders?page=1&pageSize=5`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 300 },
      }
    );

    if (solanaFmResponse.ok) {
      const data = await solanaFmResponse.json();
      const holderList = data.result || data.data || [];

      let rank = 1;
      for (const holder of holderList.slice(0, 5)) {
        const address = holder.owner || holder.address || "";
        const rawBalance = parseFloat(holder.amount) || parseFloat(holder.balance) || 0;
        const balance = rawBalance / DECIMAL_DIVISOR;
        const percentage = parseFloat(holder.percentage) || 0;

        if (address) {
          holders.push({
            address,
            balance,
            percentage,
            rank: rank++,
          });
        }
      }
    }
  } catch (err) {
    console.warn("[Holders] SolanaFM API failed:", err);
  }

  // If SolanaFM failed, use Helius RPC with owner resolution
  if (holders.length === 0 && rpcUrl) {
    try {
      // Get largest token accounts
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
        const accounts = rpcData.result?.value || [];

        // Get total supply for percentage calculation
        const totalSupply = await getTokenSupply(rpcUrl);

        // Resolve each token account to its owner wallet (in parallel)
        const topAccounts = accounts.slice(0, 5);
        const ownerPromises = topAccounts.map((account: { address: string }) =>
          resolveTokenAccountOwner(rpcUrl, account.address)
        );
        const owners = await Promise.all(ownerPromises);

        let rank = 1;
        for (let i = 0; i < topAccounts.length; i++) {
          const account = topAccounts[i];
          const ownerAddress = owners[i];
          const rawBalance = parseFloat(account.amount) || 0;
          const balance = rawBalance / DECIMAL_DIVISOR;
          const percentage = totalSupply > 0 ? (balance / totalSupply) * 100 : 0;

          holders.push({
            address: ownerAddress || account.address, // Use owner if resolved, fallback to token account
            tokenAccount: account.address,
            balance,
            percentage: Math.round(percentage * 100) / 100, // Round to 2 decimals
            rank: rank++,
          });
        }
      }
    } catch (err) {
      console.warn("[Holders] Helius RPC failed:", err);
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
