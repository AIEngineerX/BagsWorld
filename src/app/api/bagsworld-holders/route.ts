import { NextResponse } from "next/server";

// BagsWorld token mint address
const BAGSWORLD_MINT = "9auyeHWESnJiH74n4UHP4FYfWMcrbxSuHsSSAaZkBAGS";

// Cache for holder data (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;
let cachedHolders: { data: TokenHolder[]; timestamp: number } | null = null;

export interface TokenHolder {
  address: string;
  balance: number;
  percentage: number;
  rank: number;
}

export async function GET(): Promise<NextResponse> {
  // Check cache first - but only if it has data (don't cache empty results)
  if (cachedHolders && cachedHolders.data.length > 0 && Date.now() - cachedHolders.timestamp < CACHE_TTL) {
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

  // Try SolanaFM API first (most reliable for holder data)
  const solanaFmResponse = await fetch(
    `https://api.solana.fm/v1/tokens/${BAGSWORLD_MINT}/holders?page=1&pageSize=5`,
    {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 }, // Cache for 5 minutes
    }
  );

  if (solanaFmResponse.ok) {
    const data = await solanaFmResponse.json();
    const holderList = data.result || data.data || [];

    let rank = 1;
    for (const holder of holderList.slice(0, 5)) {
      // Get the owner address and balance
      const address = holder.owner || holder.address || "";
      const rawBalance = parseFloat(holder.amount) || parseFloat(holder.balance) || 0;

      // BagsWorld has 6 decimals, convert to human-readable
      const balance = rawBalance / 1_000_000;
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

  // If SolanaFM failed or returned no data, try Helius RPC as backup
  if (holders.length === 0) {
    const rpcUrl = process.env.SOLANA_RPC_URL;
    if (rpcUrl) {
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

        let rank = 1;
        for (const account of accounts.slice(0, 5)) {
          const rawBalance = parseFloat(account.amount) || 0;
          const balance = rawBalance / 1_000_000; // 6 decimals

          holders.push({
            address: account.address,
            balance,
            percentage: 0, // RPC doesn't provide percentage
            rank: rank++,
          });
        }
      }
    }
  }

  // If no real holders found, use mock data for development/testing
  if (holders.length === 0) {
    console.log("[BagsWorld Holders] Using mock data for development");
    const mockHolders: TokenHolder[] = [
      { address: "WHALE1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", balance: 10000000, percentage: 25, rank: 1 },
      { address: "WHALE2xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", balance: 5000000, percentage: 12.5, rank: 2 },
      { address: "WHALE3xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", balance: 3000000, percentage: 7.5, rank: 3 },
      { address: "WHALE4xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", balance: 2000000, percentage: 5, rank: 4 },
      { address: "WHALE5xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", balance: 1000000, percentage: 2.5, rank: 5 },
    ];
    cachedHolders = { data: mockHolders, timestamp: Date.now() };
    return NextResponse.json({
      holders: mockHolders,
      cached: false,
      mint: BAGSWORLD_MINT,
      count: mockHolders.length,
      mock: true,
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
