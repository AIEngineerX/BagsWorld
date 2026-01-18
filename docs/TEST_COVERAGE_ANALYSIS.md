# Test Coverage Analysis & Improvement Proposal

**Date:** January 18, 2026
**Status:** Zero Test Coverage
**Recommendation:** Implement testing infrastructure and prioritized test suites

---

## Executive Summary

The BagsWorld codebase currently has **no test coverage**:
- 0 test files exist
- No testing framework configured
- No test scripts in package.json
- 64+ source files completely untested

This analysis identifies high-priority modules for testing and provides a phased implementation plan.

---

## Current State

### Source Code Inventory

| Directory | Files | Purpose | Test Priority |
|-----------|-------|---------|---------------|
| `src/lib/` | 15 | Core business logic & utilities | **CRITICAL** |
| `src/components/` | 24 | React UI components | HIGH |
| `src/hooks/` | 2 | Custom React hooks | **CRITICAL** |
| `src/app/api/` | 17 | Next.js API routes | HIGH |
| `src/game/` | 3 | Phaser game scenes | MEDIUM |

### Missing Testing Infrastructure

- No Jest, Vitest, or other test runner
- No `@testing-library/react` for component testing
- No API mocking library (msw)
- No test configuration files
- No CI/CD test integration

---

## Priority 1: Critical Business Logic (`src/lib/`)

### 1.1 `world-calculator.ts` — Highest Priority

This 466-line module is the **core brain** of the game, transforming token data into game entities. It contains 13 exported functions with complex business logic:

| Function | Lines | Complexity | Test Cases Needed |
|----------|-------|------------|-------------------|
| `calculateWorldHealth()` | ~30 | Medium | 8-10 |
| `calculateWeather()` | ~15 | Low | 6 |
| `calculateBuildingLevel()` | ~20 | Medium | 10-12 |
| `calculateBuildingHealth()` | ~25 | High | 12-15 |
| `calculateCharacterMood()` | ~30 | High | 15-18 |
| `generateBuildingPosition()` | ~40 | High | 10-12 |
| `getCachedBuildingPosition()` | ~20 | Medium | 6-8 |
| `cleanupBuildingPositionCache()` | ~15 | Low | 4-5 |
| `transformFeeEarnerToCharacter()` | ~50 | High | 12-15 |
| `transformTokenToBuilding()` | ~60 | High | 15-20 |
| `generateGameEvent()` | ~30 | Medium | 10-12 |
| `buildWorldState()` | ~80 | Very High | 20-25 |
| `getTimeInfo()` | ~15 | Low | 5-6 |

**Estimated tests needed: 120-160 unit tests**

**Key test scenarios:**
```typescript
// Example test cases for calculateBuildingLevel
describe('calculateBuildingLevel', () => {
  it('returns level 1 for market cap < $100K', () => {});
  it('returns level 2 for market cap $100K - $500K', () => {});
  it('returns level 3 for market cap $500K - $2M', () => {});
  it('returns level 4 for market cap $2M - $10M', () => {});
  it('returns level 5 for market cap >= $10M', () => {});
  it('handles zero market cap', () => {});
  it('handles undefined market cap', () => {});
  it('handles boundary values exactly at thresholds', () => {});
});
```

### 1.2 `token-registry.ts` — High Priority

Manages localStorage persistence and Supabase synchronization. Contains 11 functions:

| Function | Risk Area | Test Cases Needed |
|----------|-----------|-------------------|
| `getRegisteredTokens()` | localStorage read | 5-6 |
| `registerToken()` | localStorage write + validation | 8-10 |
| `unregisterToken()` | localStorage delete | 4-5 |
| `isTokenRegistered()` | Boolean logic | 4-5 |
| `clearAllTokens()` | Bulk delete | 3-4 |
| `getTokenMetadata()` | Data retrieval | 5-6 |
| `updateTokenMetadata()` | Data mutation | 6-8 |
| `syncToSupabase()` | External API | 8-10 |
| `fetchGlobalTokens()` | External API | 6-8 |
| `mergeGlobalTokens()` | Data merging | 10-12 |
| `initializeRegistry()` | Initialization | 5-6 |

**Estimated tests needed: 60-80 unit tests**

**Test requirements:**
- Mock `localStorage` API
- Mock `fetch` for Supabase calls
- Test error handling and edge cases
- Test data persistence across sessions

### 1.3 `bags-api.ts` — High Priority

BagsApiClient class with 20+ methods for Bags.fm API interaction:

**Critical methods to test:**
- `getTokenLifetimeFees()` — Fee data retrieval
- `getTokenCreators()` — Creator information
- `getClaimablePositions()` — Claiming logic
- `generateClaimTransactions()` — Transaction building
- `getTradeQuote()` / `createSwapTransaction()` — Trading
- `createFeeShareConfig()` — Complex fee configuration
- `createTokenInfo()` / `createLaunchTransaction()` — Token creation

**Estimated tests needed: 80-100 unit tests**

**Test approach:**
- Mock external HTTP requests
- Test request payload formatting
- Test response parsing
- Test error handling (network errors, API errors, rate limits)

### 1.4 Other `src/lib/` Modules

| Module | Purpose | Test Cases Needed |
|--------|---------|-------------------|
| `store.ts` | Zustand global state | 15-20 |
| `ai-agent.ts` | AI chatbot logic | 20-30 |
| `auto-claim-agent.ts` | Automated claiming | 15-20 |
| `agent-wallet.ts` | Wallet management | 15-20 |
| `dexscreener-api.ts` | DEX API integration | 10-15 |
| `daily-report.ts` | Report generation | 10-15 |
| `config.ts` | Configuration | 5-8 |
| `supabase.ts` | Database client | 10-15 |
| `x-client.ts` | Twitter/X API | 15-20 |
| `x-oauth.ts` | OAuth flows | 15-20 |

---

## Priority 2: Custom Hooks (`src/hooks/`)

### 2.1 `useWorldState.ts` — Critical

This hook orchestrates the entire data flow:
1. Fetches registered tokens from localStorage
2. POSTs to `/api/world-state` every 30 seconds
3. Updates Zustand store with response
4. Listens for `storage` events for cross-tab sync
5. Handles loading/error states

**Test cases needed: 35-45**

**Key scenarios:**
- Initial data fetch on mount
- Polling behavior (30s intervals)
- Token addition triggers refetch
- Error state handling
- Loading state transitions
- Cross-tab synchronization
- Empty token list handling

### 2.2 `useXAuth.ts` — Medium Priority

OAuth flow for Twitter/X integration:
- Login initiation
- Callback handling
- Token storage
- Session persistence

**Test cases needed: 15-20**

---

## Priority 3: API Routes (`src/app/api/`)

### 3.1 Critical Routes

| Route | Complexity | Test Cases Needed |
|-------|------------|-------------------|
| `world-state/route.ts` | Very High | 25-35 |
| `launch-token/route.ts` | High | 20-25 |
| `bags-bot/route.ts` | High | 20-25 |
| `claim-fees/route.ts` | High | 15-20 |
| `trade/route.ts` | High | 15-20 |
| `ai-agent/route.ts` | Medium | 10-15 |

**Test approach:**
- Use Next.js API route testing utilities
- Mock external API calls (Bags SDK, Solana RPC)
- Test request validation
- Test response formatting
- Test error responses (400, 401, 500)

### 3.2 Token Launch Flow

The token launch involves multiple endpoints:
1. `POST /api/launch-token/create-info` — Metadata creation
2. `POST /api/launch-token/configure-fees` — Fee configuration
3. `POST /api/launch-token/create-launch-tx` — Transaction building

**Integration test needed:** Full launch flow from info → fees → transaction

---

## Priority 4: React Components (`src/components/`)

### 4.1 Critical Components

| Component | Complexity | Test Cases Needed |
|-----------|------------|-------------------|
| `LaunchModal.tsx` | Very High (3-step wizard) | 30-40 |
| `GameCanvas.tsx` | High (Phaser integration) | 15-20 |
| `AIChat.tsx` | High (draggable + events) | 20-25 |
| `Providers.tsx` | Medium (context setup) | 8-10 |
| `TradeModal.tsx` | High | 20-25 |
| `TradingTerminal.tsx` | High | 20-25 |

### 4.2 UI Components

| Component | Test Cases Needed |
|-----------|-------------------|
| `EventFeed.tsx` | 10-12 |
| `Leaderboard.tsx` | 10-12 |
| `BuildingDetails.tsx` | 8-10 |
| `CharacterDetails.tsx` | 8-10 |
| `TokenCard.tsx` | 6-8 |
| `WeatherDisplay.tsx` | 5-6 |
| Others (15 components) | 50-70 total |

**Test focus:**
- Rendering with various props
- User interactions (clicks, inputs)
- State changes
- Loading/error states
- Accessibility

---

## Priority 5: Game Engine (`src/game/`)

### 5.1 Phaser Scenes

| Scene | Complexity | Test Approach |
|-------|------------|---------------|
| `WorldScene.ts` | Very High | Mock Phaser, test game logic |
| `BootScene.ts` | Low | Asset loading verification |
| `UIScene.ts` | Low | HUD rendering tests |

**Challenges:**
- Phaser is difficult to unit test
- Consider extracting testable logic into separate modules
- Use integration tests with headless Phaser

---

## Implementation Plan

### Phase 1: Testing Infrastructure (Week 1)

**Install dependencies:**
```bash
npm install -D jest @types/jest ts-jest jest-environment-jsdom \
  @testing-library/react @testing-library/jest-dom @testing-library/user-event \
  msw
```

**Create configuration files:**

`jest.config.js`:
```javascript
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/game/**/*', // Exclude Phaser initially
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
};

module.exports = createJestConfig(customJestConfig);
```

`jest.setup.js`:
```javascript
import '@testing-library/jest-dom';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

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
```

**Update `package.json`:**
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

### Phase 2: Core Business Logic Tests (Weeks 2-3)

1. **`world-calculator.test.ts`** — 120+ tests
2. **`token-registry.test.ts`** — 60+ tests
3. **`bags-api.test.ts`** — 80+ tests

### Phase 3: Hooks & API Routes (Weeks 4-5)

1. **`useWorldState.test.ts`** — 40+ tests
2. **API route tests** — 100+ tests total

### Phase 4: Component Tests (Weeks 6-8)

1. Critical components first
2. Then remaining UI components

### Phase 5: Integration Tests (Week 9+)

1. Token launch flow
2. Trading flow
3. Data pipeline (registry → API → calculator → store → render)

---

## Coverage Goals

| Milestone | Target Coverage | Timeline |
|-----------|-----------------|----------|
| Initial | 0% → 30% | Phase 1-2 |
| Intermediate | 30% → 50% | Phase 3-4 |
| Target | 50% → 70% | Phase 5 |
| Stretch | 70% → 80% | Ongoing |

**Priority targets:**
- `src/lib/`: 80%+ coverage
- `src/hooks/`: 70%+ coverage
- `src/app/api/`: 60%+ coverage
- `src/components/`: 50%+ coverage

---

## Risk Mitigation

### Testing Challenges

| Challenge | Mitigation |
|-----------|------------|
| External APIs (Bags.fm, Solana) | Use MSW for HTTP mocking |
| localStorage/sessionStorage | Jest mocks in setup file |
| Phaser game engine | Extract logic, mock Phaser objects |
| Wallet adapter | Mock wallet provider |
| Real-time polling | Jest fake timers |
| Custom events | Event dispatch/listen testing |

### Recommended Mocking Strategy

```typescript
// MSW handlers for Bags API
import { rest } from 'msw';

export const handlers = [
  rest.get('https://public-api-v2.bags.fm/api/v1/token-launch/lifetime-fees', (req, res, ctx) => {
    return res(ctx.json({ fees: 1000, volume: 50000 }));
  }),
  // ... more handlers
];
```

---

## Appendix: File Inventory

### `src/lib/` (15 files)
- `world-calculator.ts` (466 lines)
- `bags-api.ts` (450+ lines)
- `token-registry.ts` (~200 lines)
- `store.ts` (~100 lines)
- `types.ts` (~150 lines)
- `config.ts` (~50 lines)
- `ai-agent.ts` (~200 lines)
- `auto-claim-agent.ts` (~150 lines)
- `agent-wallet.ts` (~100 lines)
- `bags-sdk.ts` (~80 lines)
- `dexscreener-api.ts` (~100 lines)
- `daily-report.ts` (~100 lines)
- `supabase.ts` (~50 lines)
- `x-client.ts` (~150 lines)
- `x-oauth.ts` (~100 lines)

### `src/components/` (24 files)
- LaunchModal, GameCanvas, AIChat, Providers
- TradeModal, TradingTerminal, EventFeed, Leaderboard
- BuildingDetails, CharacterDetails, TokenCard, WeatherDisplay
- Plus 12 additional UI components

### `src/hooks/` (2 files)
- `useWorldState.ts`
- `useXAuth.ts`

### `src/app/api/` (17 routes)
- world-state, launch-token, bags-bot, claim-fees, trade
- ai-agent, partner-claim, plus 10 additional routes

---

## Conclusion

The BagsWorld codebase requires immediate attention to testing. The recommended approach:

1. **Start with pure functions** — `world-calculator.ts` is ideal for initial testing
2. **Build infrastructure properly** — Jest + Testing Library + MSW
3. **Prioritize by risk** — Business logic > Hooks > API > Components
4. **Automate coverage tracking** — CI/CD integration with coverage gates

Implementing this testing strategy will significantly improve code quality, catch regressions, and enable safer refactoring.
