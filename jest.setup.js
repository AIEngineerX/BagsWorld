// jest.setup.js
import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Polyfill TextEncoder/TextDecoder for @noble/curves and Solana libs
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

// Mock Solana wallet adapter
jest.mock('@solana/wallet-adapter-react', () => ({
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
        blockhash: 'mock-blockhash',
        lastValidBlockHeight: 100,
      }),
    },
  }),
}));

// Mock Phaser (heavy library, not needed for unit tests)
jest.mock('phaser', () => ({
  Game: jest.fn(),
  Scene: jest.fn(),
  AUTO: 'AUTO',
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
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
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock fetch for API tests
global.fetch = jest.fn();

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.getItem.mockReturnValue(null);
});

// Suppress console errors in tests (optional - comment out for debugging)
// console.error = jest.fn();
