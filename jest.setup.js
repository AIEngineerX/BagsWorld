// jest.setup.js
import "@testing-library/jest-dom";
import { TextEncoder, TextDecoder } from "util";

// Polyfill TextEncoder/TextDecoder for @noble/curves and Solana libs
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Polyfill Request/Response/Headers for Next.js route handlers
// Required when testing Next.js API routes directly
if (typeof global.Request === "undefined") {
  // Create minimal polyfills for Request/Response/Headers
  class MockHeaders {
    constructor(init = {}) {
      this._headers = new Map();
      if (init && typeof init === "object") {
        Object.entries(init).forEach(([key, value]) => {
          this._headers.set(key.toLowerCase(), value);
        });
      }
    }
    get(name) {
      return this._headers.get(name.toLowerCase()) || null;
    }
    set(name, value) {
      this._headers.set(name.toLowerCase(), value);
    }
    has(name) {
      return this._headers.has(name.toLowerCase());
    }
    delete(name) {
      this._headers.delete(name.toLowerCase());
    }
    forEach(callback) {
      this._headers.forEach((value, key) => callback(value, key, this));
    }
    entries() {
      return this._headers.entries();
    }
  }

  class MockRequest {
    constructor(input, init = {}) {
      this.url = typeof input === "string" ? input : input.url;
      this.method = init.method || "GET";
      this.headers = new MockHeaders(init.headers);
      this._body = init.body;
    }
    async json() {
      if (typeof this._body === "string") {
        return JSON.parse(this._body);
      }
      return this._body;
    }
    async text() {
      return String(this._body || "");
    }
  }

  class MockResponse {
    constructor(body, init = {}) {
      this._body = body;
      this.status = init.status || 200;
      this.statusText = init.statusText || "";
      this.headers = new MockHeaders(init.headers);
      this.ok = this.status >= 200 && this.status < 300;
    }
    async json() {
      if (typeof this._body === "string") {
        return JSON.parse(this._body);
      }
      return this._body;
    }
    async text() {
      return String(this._body || "");
    }
  }

  global.Request = MockRequest;
  global.Response = MockResponse;
  global.Headers = MockHeaders;
}

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

// Mock Solana wallet adapter
jest.mock("@solana/wallet-adapter-react", () => ({
  useWallet: () => ({
    publicKey: null,
    connected: false,
    connecting: false,
    disconnect: jest.fn(),
    connect: jest.fn(),
    signTransaction: jest.fn(),
    signAllTransactions: jest.fn(),
  }),
  useConnection: () => ({
    connection: {
      getBalance: jest.fn().mockResolvedValue(1000000000),
      getLatestBlockhash: jest.fn().mockResolvedValue({
        blockhash: "mock-blockhash",
        lastValidBlockHeight: 100,
      }),
    },
  }),
}));

// Mock Phaser (heavy library, not needed for unit tests)
jest.mock("phaser", () => ({
  Game: jest.fn(),
  Scene: jest.fn(),
  AUTO: "AUTO",
}));

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Polyfill Response.json static method for NextResponse.json() in API route tests
// jsdom provides Response but lacks the static .json() factory method
if (typeof Response !== "undefined" && typeof Response.json !== "function") {
  Response.json = function (data, init = {}) {
    const body = JSON.stringify(data);
    return new Response(body, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init.headers || {}),
      },
    });
  };
}

// Mock fetch for API tests
global.fetch = jest.fn();

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.getItem.mockReturnValue(null);
});

// Suppress console errors in tests (optional - comment out for debugging)
// console.error = jest.fn();
