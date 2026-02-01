// Mock Bags.fm API responses for testing

export const mockTokenData = {
  mint: "MockToken111111111111111111111111111111111",
  name: "Mock Token",
  symbol: "MOCK",
  decimals: 9,
  marketCap: 500000,
  volume24h: 50000,
  priceChange24h: 15.5,
  holders: 150,
  imageUrl: "https://example.com/mock-token.png",
};

export const mockCreatorData = {
  walletAddress: "MockCreator11111111111111111111111111111",
  username: "mockcreator",
  totalFeesClaimed: 1.5,
  tokensCreated: 3,
};

export const mockClaimablePosition = {
  mint: mockTokenData.mint,
  virtualPool: "MockVirtualPool111111111111111111111111",
  claimableDisplayAmount: 0.05,
  tokenSymbol: "MOCK",
};

export const mockWorldState = {
  health: 75,
  weather: "sunny",
  population: [
    {
      id: "char1",
      walletAddress: mockCreatorData.walletAddress,
      name: mockCreatorData.username,
      x: 100,
      y: 200,
      direction: "down",
      mood: "happy",
      feesClaimed: 1.5,
    },
  ],
  buildings: [
    {
      id: "building1",
      mint: mockTokenData.mint,
      name: mockTokenData.name,
      symbol: mockTokenData.symbol,
      x: 150,
      y: 180,
      level: 3,
      health: 100,
      glowing: true,
      marketCap: mockTokenData.marketCap,
    },
  ],
  events: [
    {
      id: "event1",
      type: "token_launch",
      timestamp: Date.now() - 60000,
      data: {
        tokenSymbol: "MOCK",
        creatorName: "mockcreator",
      },
    },
  ],
  timeInfo: {
    hour: 14,
    isDay: true,
    timezone: "EST",
  },
};

// Mock API handler factory
export function createMockBagsApi() {
  return {
    getTokenInfo: jest.fn().mockResolvedValue(mockTokenData),
    getCreatorInfo: jest.fn().mockResolvedValue(mockCreatorData),
    getClaimablePositions: jest.fn().mockResolvedValue([mockClaimablePosition]),
    generateClaimTransactions: jest.fn().mockResolvedValue({
      transactions: ["mockBase64Transaction"],
    }),
    getWorldState: jest.fn().mockResolvedValue(mockWorldState),
  };
}

// Mock fetch responses
export function mockFetchResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

// Setup mock for global fetch
export function setupMockFetch(responses: Record<string, unknown>) {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    const path = new URL(url, "http://localhost").pathname;

    if (responses[path]) {
      return mockFetchResponse(responses[path]);
    }

    // Default 404
    return mockFetchResponse({ error: "Not found" }, 404);
  });
}
