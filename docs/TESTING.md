# BagsWorld Testing Guide

This guide covers how to set up and run tests for the BagsWorld project.

## Quick Start

```bash
# 1. Install dependencies (including test packages)
npm install

# 2. Configure environment
# Edit .env.local with your API keys:
#   - BAGS_API_KEY (required)
#   - ANTHROPIC_API_KEY (optional, for AI chat)

# 3. Start development server
npm run dev

# 4. Run tests
npm test
```

## Environment Setup

### Required Configuration

Create `.env.local` from the template:

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your API keys:

| Variable                   | Required | Description                                       |
| -------------------------- | -------- | ------------------------------------------------- |
| `BAGS_API_KEY`             | Yes      | Bags.fm API key for token data                    |
| `ANTHROPIC_API_KEY`        | No       | Enables Claude AI chat                            |
| `AGENT_SECRET`             | No       | Required for agent API (any string for local dev) |
| `AGENT_WALLET_PRIVATE_KEY` | No       | Required for agent transactions                   |

### Mock Mode

Set `NEXT_PUBLIC_MOCK_MODE=true` in `.env.local` to enable mock mode:

- Disables real API calls
- Uses mock data for all endpoints
- Safe for testing without real transactions

## Test Commands

### Unit Tests (Jest)

```bash
# Run all tests
npm test

# Watch mode (re-runs on file changes)
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run only agent tests
npm run test:agents
```

### Agent Testing (Live)

With the dev server running (`npm run dev`):

```bash
# Check all agent statuses
npm run agent:status

# Trigger auto-claim manually
npm run agent:trigger
```

Or use the test script for more options:

```bash
npx ts-node scripts/test-agents.ts status   # Check status
npx ts-node scripts/test-agents.ts claim    # Trigger claim
npx ts-node scripts/test-agents.ts buyback  # Trigger buyback
npx ts-node scripts/test-agents.ts scout    # Check scout
npx ts-node scripts/test-agents.ts full     # Run all
```

## Test Structure

```
bagsworld/
├── tests/
│   ├── mocks/
│   │   └── bags-api.ts       # Mock API responses
│   ├── agents/
│   │   └── auto-claim-agent.test.ts
│   ├── api/
│   │   └── world-state.test.ts
│   └── components/
│       └── (component tests)
├── scripts/
│   └── test-agents.ts        # Live agent testing utility
├── jest.config.js            # Jest configuration
└── jest.setup.js             # Test setup & mocks
```

## Testing Agents Locally

### Without GitHub Actions

The agents can be tested locally without GitHub Actions:

1. **Start the dev server:**

   ```bash
   npm run dev
   ```

2. **Test via API calls:**

   ```bash
   # Check status
   curl -X POST http://localhost:3000/api/agent \
     -H "Authorization: Bearer local-dev-secret-change-in-production" \
     -H "Content-Type: application/json" \
     -d '{"action":"status"}'
   ```

3. **Test claim trigger:**
   ```bash
   curl -X POST http://localhost:3000/api/agent \
     -H "Authorization: Bearer local-dev-secret-change-in-production" \
     -H "Content-Type: application/json" \
     -d '{"action":"trigger"}'
   ```

### Agent API Actions

| Action            | Method | Description                 |
| ----------------- | ------ | --------------------------- |
| `status`          | POST   | Get auto-claim agent status |
| `start`           | POST   | Start auto-claim agent      |
| `stop`            | POST   | Stop auto-claim agent       |
| `trigger`         | POST   | Manually trigger claim      |
| `config`          | POST   | Get/update config           |
| `buyback-status`  | POST   | Get buyback agent status    |
| `buyback-trigger` | POST   | Manually trigger buyback    |
| `scout-status`    | POST   | Get scout agent status      |
| `scout-launches`  | POST   | Get recent token launches   |

### With a Test Wallet

For testing actual transactions (devnet recommended):

1. **Generate a test wallet:**

   ```bash
   solana-keygen new --no-bip39-passphrase -o test-wallet.json
   ```

2. **Convert to base58:**

   ```bash
   cat test-wallet.json | node -e "
     const bs58 = require('bs58');
     const key = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
     console.log(bs58.encode(Buffer.from(key)));
   "
   ```

3. **Add to `.env.local`:**

   ```
   AGENT_WALLET_PRIVATE_KEY=<your-base58-key>
   ```

4. **Fund the wallet** (for devnet):
   ```bash
   solana airdrop 2 <wallet-address> --url devnet
   ```

## Writing Tests

### Mock API Responses

Use the mock helpers in `tests/mocks/bags-api.ts`:

```typescript
import { mockWorldState, setupMockFetch } from "../mocks/bags-api";

describe("MyComponent", () => {
  beforeEach(() => {
    setupMockFetch({
      "/api/world-state": mockWorldState,
    });
  });

  it("should fetch world state", async () => {
    const response = await fetch("/api/world-state");
    const data = await response.json();
    expect(data.health).toBeDefined();
  });
});
```

### Testing Components

```typescript
import { render, screen } from '@testing-library/react';
import { MyComponent } from '@/components/MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

## CI/CD Integration

### GitHub Actions

Tests run automatically on:

- Pull requests to `main`
- Pushes to `main`

The workflow is defined in `.github/workflows/test.yml` (if you want to add it).

### Pre-commit Hooks

Consider adding husky for pre-commit testing:

```bash
npm install -D husky
npx husky init
echo "npm test" > .husky/pre-commit
```

## Troubleshooting

### Tests Failing?

1. **Clear Jest cache:**

   ```bash
   npx jest --clearCache
   ```

2. **Check Node version:**

   ```bash
   node --version  # Should be 18+
   ```

3. **Reinstall dependencies:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

### Agent API Returns 401?

Check that `AGENT_SECRET` in your request matches `.env.local`.

### Mock Mode Not Working?

Ensure `NEXT_PUBLIC_MOCK_MODE=true` is set and restart the dev server.

## Coverage Goals

| Area       | Target |
| ---------- | ------ |
| Agents     | 80%+   |
| API Routes | 70%+   |
| Components | 60%+   |
| Utilities  | 90%+   |

Run `npm run test:coverage` to see current coverage.
