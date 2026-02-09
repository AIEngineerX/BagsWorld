/**
 * Register Token API Tests
 *
 * Tests the POST /api/register-token endpoint with:
 * - Valid token registration
 * - Input validation (Solana addresses, required fields)
 * - Default value fallbacks (name, symbol, creator_wallet)
 * - Field alias support (imageUrl/image_url, feeShares/fee_shares)
 * - Database availability checks
 * - Error handling (save failures, malformed JSON)
 */

// Mock @/lib/neon before any imports
jest.mock("@/lib/neon", () => ({
  isNeonConfigured: jest.fn(),
  saveGlobalToken: jest.fn(),
}));

// Mock @solana/web3.js with realistic PublicKey validation
// Base58 alphabet used by Solana addresses
const BASE58_CHARS = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

jest.mock("@solana/web3.js", () => ({
  PublicKey: jest.fn().mockImplementation((key: string) => {
    // Reject non-strings
    if (typeof key !== "string" || key.length === 0) {
      throw new Error("Invalid public key input");
    }
    // Reject strings with characters outside Base58 alphabet
    for (const ch of key) {
      if (!BASE58_CHARS.includes(ch)) {
        throw new Error("Non-base58 character");
      }
    }
    // Solana public keys are 32-44 base58 characters
    if (key.length < 32 || key.length > 44) {
      throw new Error("Invalid public key length");
    }
    return {
      toString: () => key,
      toBase58: () => key,
    };
  }),
}));

// Mock next/server to provide a working NextResponse.json in jsdom
jest.mock("next/server", () => {
  const originalModule = jest.requireActual("next/server");
  return {
    ...originalModule,
    NextResponse: {
      json: (data: unknown, init?: { status?: number }) => ({
        json: () => Promise.resolve(data),
        status: init?.status || 200,
      }),
    },
  };
});

import { POST } from "@/app/api/register-token/route";
import { isNeonConfigured, saveGlobalToken } from "@/lib/neon";

// A real valid Solana public key (44-char base58, generated from Keypair)
const VALID_MINT = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
const VALID_CREATOR = "7nYBm5mk15cjHiAypFCvfHbJKhTPR4JHPGd2sXYLa2Fk";

// NextRequest-compatible mock using the NextRequest constructor pattern.
// jsdom's native Request has a read-only url property, so we provide a
// minimal class that satisfies the route handler's interface (json()).
function createRequest(body: unknown): any {
  const bodyStr = JSON.stringify(body);
  return new NextRequest("http://localhost/api/register-token", {
    method: "POST",
    body: bodyStr,
    headers: { "Content-Type": "application/json" },
  });
}

// NextRequest mock that works in jsdom test environment
class NextRequest {
  private _body: string;
  url: string;
  method: string;
  headers: Map<string, string>;

  constructor(
    url: string,
    init: { method?: string; body?: string; headers?: Record<string, string> } = {}
  ) {
    this.url = url;
    this.method = init.method || "GET";
    this._body = init.body || "";
    this.headers = new Map(
      Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
    );
  }

  async json() {
    return JSON.parse(this._body);
  }

  async text() {
    return this._body;
  }
}

// Helper to create a request with raw (non-JSON) body for malformed JSON tests
function createRawRequest(rawBody: string): any {
  return new NextRequest("http://localhost/api/register-token", {
    method: "POST",
    body: rawBody,
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/register-token", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: database is configured and save succeeds
    (isNeonConfigured as jest.Mock).mockReturnValue(true);
    (saveGlobalToken as jest.Mock).mockResolvedValue(true);
  });

  // ─── 1. Successful registration ─────────────────────────────────────

  it("should register a valid token with all fields and return 200", async () => {
    const request = createRequest({
      mint: VALID_MINT,
      name: "Test Token",
      symbol: "TEST",
      creator: VALID_CREATOR,
      description: "A test token for unit tests",
      imageUrl: "https://example.com/logo.png",
      feeShares: [{ wallet: VALID_CREATOR, bps: 10000 }],
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toBe("Token TEST registered successfully");
    expect(body.token).toEqual({
      mint: VALID_MINT,
      name: "Test Token",
      symbol: "TEST",
      creator_wallet: VALID_CREATOR,
      description: "A test token for unit tests",
      image_url: "https://example.com/logo.png",
      fee_shares: [{ wallet: VALID_CREATOR, bps: 10000 }],
    });

    // Verify saveGlobalToken was called with the correct token
    expect(saveGlobalToken).toHaveBeenCalledTimes(1);
    expect(saveGlobalToken).toHaveBeenCalledWith(body.token);
  });

  // ─── 2. Missing mint ────────────────────────────────────────────────

  it("should return 400 when mint is missing", async () => {
    const request = createRequest({
      name: "No Mint Token",
      symbol: "NMT",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid or missing mint address");
    expect(saveGlobalToken).not.toHaveBeenCalled();
  });

  it("should return 400 when mint is empty string", async () => {
    const request = createRequest({
      mint: "",
      name: "Empty Mint",
      symbol: "EM",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid or missing mint address");
  });

  it("should return 400 when mint is null", async () => {
    const request = createRequest({
      mint: null,
      name: "Null Mint",
      symbol: "NM",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid or missing mint address");
  });

  // ─── 3. Invalid mint (not base58) ──────────────────────────────────

  it("should return 400 when mint is not a valid base58 address", async () => {
    const request = createRequest({
      mint: "not-a-valid-solana-address!!!",
      name: "Bad Mint",
      symbol: "BAD",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid or missing mint address");
    expect(saveGlobalToken).not.toHaveBeenCalled();
  });

  it("should return 400 when mint contains invalid base58 characters", async () => {
    // '0', 'O', 'I', 'l' are not in the base58 alphabet
    const request = createRequest({
      mint: "0OIl" + "A".repeat(40),
      name: "Invalid Chars",
      symbol: "IC",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid or missing mint address");
  });

  it("should return 400 when mint is too short", async () => {
    const request = createRequest({
      mint: "abc",
      name: "Short Mint",
      symbol: "SM",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid or missing mint address");
  });

  // ─── 4. Database not configured ────────────────────────────────────

  it("should return 503 when isNeonConfigured returns false", async () => {
    (isNeonConfigured as jest.Mock).mockReturnValue(false);

    const request = createRequest({
      mint: VALID_MINT,
      name: "Test",
      symbol: "TST",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("Database not configured");
    expect(saveGlobalToken).not.toHaveBeenCalled();
  });

  // ─── 5. saveGlobalToken returns false ──────────────────────────────

  it("should return 500 when saveGlobalToken returns false", async () => {
    (saveGlobalToken as jest.Mock).mockResolvedValue(false);

    const request = createRequest({
      mint: VALID_MINT,
      name: "Fail Token",
      symbol: "FAIL",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to save token");
  });

  // ─── 6. Malformed JSON ─────────────────────────────────────────────

  it("should return 500 when request body is malformed JSON", async () => {
    const request = createRawRequest("this is { not valid json");

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to register token");
    expect(saveGlobalToken).not.toHaveBeenCalled();
  });

  // ─── 7. Default value fallbacks ────────────────────────────────────

  it("should fall back name to symbol when name is empty string", async () => {
    const request = createRequest({
      mint: VALID_MINT,
      name: "",
      symbol: "SYM",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.token.name).toBe("SYM");
  });

  it("should fall back name to symbol when name is not provided", async () => {
    const request = createRequest({
      mint: VALID_MINT,
      symbol: "NOSYM",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.token.name).toBe("NOSYM");
  });

  it("should fall back name to 'Unknown Token' when both name and symbol are missing", async () => {
    const request = createRequest({
      mint: VALID_MINT,
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.token.name).toBe("Unknown Token");
  });

  it("should default symbol to '???' when symbol is not provided", async () => {
    const request = createRequest({
      mint: VALID_MINT,
      name: "No Symbol Token",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.token.symbol).toBe("???");
  });

  it("should default symbol to '???' when symbol is empty string", async () => {
    const request = createRequest({
      mint: VALID_MINT,
      name: "Empty Symbol",
      symbol: "",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.token.symbol).toBe("???");
  });

  it("should fall back creator_wallet to mint when creator is not provided", async () => {
    const request = createRequest({
      mint: VALID_MINT,
      name: "No Creator",
      symbol: "NC",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.token.creator_wallet).toBe(VALID_MINT);
  });

  it("should fall back creator_wallet to mint when creator is empty string", async () => {
    const request = createRequest({
      mint: VALID_MINT,
      name: "Empty Creator",
      symbol: "EC",
      creator: "",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.token.creator_wallet).toBe(VALID_MINT);
  });

  // ─── 8. Fee shares from both body keys ─────────────────────────────

  it("should accept fee shares from 'feeShares' body key (camelCase)", async () => {
    const feeShares = [
      { wallet: VALID_CREATOR, bps: 5000 },
      { wallet: VALID_MINT, bps: 5000 },
    ];

    const request = createRequest({
      mint: VALID_MINT,
      name: "CamelCase Fees",
      symbol: "CCF",
      feeShares,
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.token.fee_shares).toEqual(feeShares);
  });

  it("should accept fee shares from 'fee_shares' body key (snake_case)", async () => {
    const feeShares = [{ wallet: VALID_CREATOR, bps: 10000 }];

    const request = createRequest({
      mint: VALID_MINT,
      name: "Snake Case Fees",
      symbol: "SCF",
      fee_shares: feeShares,
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.token.fee_shares).toEqual(feeShares);
  });

  it("should prefer 'feeShares' over 'fee_shares' when both are provided", async () => {
    const camelCase = [{ wallet: VALID_CREATOR, bps: 10000 }];
    const snakeCase = [{ wallet: VALID_MINT, bps: 10000 }];

    const request = createRequest({
      mint: VALID_MINT,
      name: "Both Fees",
      symbol: "BF",
      feeShares: camelCase,
      fee_shares: snakeCase,
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.token.fee_shares).toEqual(camelCase);
  });

  it("should default fee_shares to empty array when neither key is provided", async () => {
    const request = createRequest({
      mint: VALID_MINT,
      name: "No Fees",
      symbol: "NF",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.token.fee_shares).toEqual([]);
  });

  // ─── 9. Image URL from both body keys ──────────────────────────────

  it("should accept image URL from 'imageUrl' body key (camelCase)", async () => {
    const request = createRequest({
      mint: VALID_MINT,
      name: "CamelCase Image",
      symbol: "CCI",
      imageUrl: "https://example.com/camel.png",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.token.image_url).toBe("https://example.com/camel.png");
  });

  it("should accept image URL from 'image_url' body key (snake_case)", async () => {
    const request = createRequest({
      mint: VALID_MINT,
      name: "Snake Case Image",
      symbol: "SCI",
      image_url: "https://example.com/snake.png",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.token.image_url).toBe("https://example.com/snake.png");
  });

  it("should prefer 'imageUrl' over 'image_url' when both are provided", async () => {
    const request = createRequest({
      mint: VALID_MINT,
      name: "Both Images",
      symbol: "BI",
      imageUrl: "https://example.com/preferred.png",
      image_url: "https://example.com/fallback.png",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.token.image_url).toBe("https://example.com/preferred.png");
  });

  it("should set image_url to undefined when neither key is provided", async () => {
    const request = createRequest({
      mint: VALID_MINT,
      name: "No Image",
      symbol: "NI",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.token.image_url).toBeUndefined();
  });

  // ─── Additional edge cases ─────────────────────────────────────────

  it("should pass description through to the token record", async () => {
    const request = createRequest({
      mint: VALID_MINT,
      name: "Described Token",
      symbol: "DESC",
      description: "A thoroughly described token",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.token.description).toBe("A thoroughly described token");
  });

  it("should set description to undefined when not provided", async () => {
    const request = createRequest({
      mint: VALID_MINT,
      name: "No Desc",
      symbol: "ND",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.token.description).toBeUndefined();
  });

  it("should use the provided creator when it is a valid address", async () => {
    const request = createRequest({
      mint: VALID_MINT,
      name: "Custom Creator",
      symbol: "CC",
      creator: VALID_CREATOR,
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.token.creator_wallet).toBe(VALID_CREATOR);
  });

  it("should handle saveGlobalToken throwing an error", async () => {
    (saveGlobalToken as jest.Mock).mockRejectedValue(new Error("DB connection lost"));

    const request = createRequest({
      mint: VALID_MINT,
      name: "Error Token",
      symbol: "ERR",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to register token");
  });

  it("should include the correct success message with the token symbol", async () => {
    const request = createRequest({
      mint: VALID_MINT,
      name: "Message Check",
      symbol: "MSG",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe("Token MSG registered successfully");
  });

  it("should use default symbol in success message when symbol is not provided", async () => {
    const request = createRequest({
      mint: VALID_MINT,
      name: "No Symbol Msg",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe("Token ??? registered successfully");
  });
});
