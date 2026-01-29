# Error Handling Reference

Production-grade error handling patterns for elizaOS agents.

## Core Principles

1. **Never crash the agent** — catch and recover
2. **Log everything** — errors are debugging gold
3. **Degrade gracefully** — partial functionality beats none
4. **Inform the user** — don't leave them hanging
5. **Retry intelligently** — exponential backoff for transient failures

---

## Retry Patterns

### Basic Retry with Exponential Backoff
```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: Error) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    shouldRetry = () => true,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (!shouldRetry(lastError) || attempt === maxRetries - 1) {
        throw lastError;
      }

      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelay
      );

      console.log(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms: ${lastError.message}`);
      await sleep(delay);
    }
  }

  throw lastError!;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Usage in Actions
```typescript
const swapAction: Action = {
  name: 'SWAP_TOKENS',

  handler: async (runtime, message, state, options, callback) => {
    try {
      const result = await withRetry(
        () => executeSwap(runtime, message),
        {
          maxRetries: 3,
          baseDelay: 2000,
          shouldRetry: (error) => {
            // Only retry on transient errors
            return error.message.includes('timeout') ||
                   error.message.includes('rate limit') ||
                   error.message.includes('network');
          }
        }
      );

      callback(`Swap complete! Tx: ${result.signature}`);
      return result.signature;
    } catch (error) {
      callback(`Swap failed after retries: ${error.message}`);
      return 'failed';
    }
  }
};
```

---

## Circuit Breaker Pattern

Prevents cascading failures by stopping calls to failing services.

```typescript
type CircuitState = 'closed' | 'open' | 'half-open';

class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(
    private readonly options: {
      failureThreshold: number;      // Failures before opening
      resetTimeout: number;          // Time before trying again (ms)
      halfOpenSuccesses: number;     // Successes needed to close
    } = {
      failureThreshold: 5,
      resetTimeout: 60000,
      halfOpenSuccesses: 3,
    }
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit should transition from open to half-open
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.options.resetTimeout) {
        this.state = 'half-open';
        this.successCount = 0;
        console.log('Circuit breaker: transitioning to half-open');
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= this.options.halfOpenSuccesses) {
        this.state = 'closed';
        this.failures = 0;
        console.log('Circuit breaker: closed (recovered)');
      }
    } else {
      this.failures = 0;
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.options.failureThreshold) {
      this.state = 'open';
      console.log(`Circuit breaker: opened after ${this.failures} failures`);
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successCount = 0;
  }
}
```

### Using Circuit Breaker
```typescript
// Create breakers for different services
const dexScreenerBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 30000,
  halfOpenSuccesses: 2,
});

const jupiterBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60000,
  halfOpenSuccesses: 3,
});

// Use in provider
const priceProvider: Provider = {
  name: 'tokenPrices',

  get: async (runtime, message, state) => {
    try {
      const prices = await dexScreenerBreaker.execute(() =>
        fetchDexScreenerPrices(message.content.text)
      );
      return { text: formatPrices(prices), data: { prices } };
    } catch (error) {
      if (error.message === 'Circuit breaker is open') {
        return { text: 'Price service temporarily unavailable', data: {} };
      }
      return { text: '', data: {} };
    }
  }
};
```

---

## Fallback Patterns

### Primary/Secondary Fallback
```typescript
async function withFallback<T>(
  primary: () => Promise<T>,
  fallbacks: Array<() => Promise<T>>,
  defaultValue: T
): Promise<T> {
  try {
    return await primary();
  } catch (primaryError) {
    console.log(`Primary failed: ${primaryError.message}, trying fallbacks`);

    for (let i = 0; i < fallbacks.length; i++) {
      try {
        return await fallbacks[i]();
      } catch (fallbackError) {
        console.log(`Fallback ${i + 1} failed: ${fallbackError.message}`);
      }
    }

    console.log('All fallbacks failed, using default');
    return defaultValue;
  }
}
```

### Usage Example
```typescript
const priceProvider: Provider = {
  name: 'tokenPrices',

  get: async (runtime, message, state) => {
    const token = extractToken(message.content.text);
    if (!token) return { text: '', data: {} };

    const price = await withFallback(
      // Primary: DexScreener
      () => fetchDexScreener(token),
      [
        // Fallback 1: Jupiter
        () => fetchJupiterPrice(token),
        // Fallback 2: Birdeye
        () => fetchBirdeyePrice(token),
        // Fallback 3: Cached value
        () => getCachedPrice(token),
      ],
      // Default
      { price: 0, source: 'unavailable' }
    );

    return {
      text: price.price > 0 ? `${token}: $${price.price}` : 'Price unavailable',
      data: { price }
    };
  }
};
```

---

## Error Categories

### Categorizing Errors
```typescript
enum ErrorCategory {
  TRANSIENT = 'transient',      // Retry
  RATE_LIMIT = 'rate_limit',    // Wait and retry
  AUTH = 'auth',                // Re-authenticate
  VALIDATION = 'validation',    // User error, don't retry
  PERMANENT = 'permanent',      // Give up
}

function categorizeError(error: Error): ErrorCategory {
  const message = error.message.toLowerCase();

  if (message.includes('rate limit') || message.includes('429')) {
    return ErrorCategory.RATE_LIMIT;
  }
  if (message.includes('timeout') || message.includes('network') || message.includes('ECONNRESET')) {
    return ErrorCategory.TRANSIENT;
  }
  if (message.includes('unauthorized') || message.includes('401') || message.includes('403')) {
    return ErrorCategory.AUTH;
  }
  if (message.includes('invalid') || message.includes('validation') || message.includes('400')) {
    return ErrorCategory.VALIDATION;
  }
  return ErrorCategory.PERMANENT;
}
```

### Category-Aware Retry
```typescript
async function smartRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const category = categorizeError(lastError);

      switch (category) {
        case ErrorCategory.VALIDATION:
        case ErrorCategory.PERMANENT:
          throw lastError;  // Don't retry

        case ErrorCategory.RATE_LIMIT:
          await sleep(30000 * (attempt + 1));  // Long wait
          break;

        case ErrorCategory.AUTH:
          await refreshAuth();  // Try to re-auth
          break;

        case ErrorCategory.TRANSIENT:
        default:
          await sleep(1000 * Math.pow(2, attempt));
          break;
      }
    }
  }

  throw lastError!;
}
```

---

## Action Error Handling

### Comprehensive Action Error Handling
```typescript
const tradeAction: Action = {
  name: 'EXECUTE_TRADE',

  handler: async (runtime, message, state, options, callback) => {
    const tradeParams = parseTradeRequest(message.content.text);

    // Validation errors - inform user
    if (!tradeParams.valid) {
      callback(`I couldn't understand that trade request. ${tradeParams.error}`);
      return 'validation_error';
    }

    // Amount validation
    if (tradeParams.amount > MAX_TRADE_AMOUNT) {
      callback(`Trade amount exceeds maximum (${MAX_TRADE_AMOUNT} SOL). Please use a smaller amount.`);
      return 'limit_exceeded';
    }

    try {
      // Attempt trade with retry
      const result = await withRetry(
        () => executeTrade(runtime, tradeParams),
        {
          maxRetries: 2,
          shouldRetry: (error) => {
            const category = categorizeError(error);
            return category === ErrorCategory.TRANSIENT;
          }
        }
      );

      callback(`Trade executed! Tx: ${result.signature}`);
      return result.signature;

    } catch (error) {
      const category = categorizeError(error);

      switch (category) {
        case ErrorCategory.RATE_LIMIT:
          callback('Trading service is busy. Please try again in a few minutes.');
          break;
        case ErrorCategory.AUTH:
          callback('Wallet authentication failed. Please reconnect your wallet.');
          break;
        case ErrorCategory.TRANSIENT:
          callback('Network error occurred. Please try again.');
          break;
        default:
          callback(`Trade failed: ${error.message}`);
      }

      // Log for debugging
      console.error('Trade error:', {
        category,
        error: error.message,
        params: tradeParams,
      });

      return 'error';
    }
  }
};
```

---

## Provider Error Handling

### Graceful Provider Degradation
```typescript
const walletProvider: Provider = {
  name: 'walletBalance',

  get: async (runtime, message, state) => {
    const wallet = runtime.getSetting('SOLANA_PUBLIC_KEY');
    if (!wallet) {
      return { text: 'Wallet not configured', data: { configured: false } };
    }

    try {
      const balances = await withRetry(
        () => fetchWalletBalances(wallet),
        { maxRetries: 2 }
      );

      return {
        text: formatBalances(balances),
        data: { balances, source: 'live' }
      };

    } catch (error) {
      // Try cache
      const cached = await getCachedBalances(wallet);
      if (cached) {
        return {
          text: `${formatBalances(cached.balances)} (cached ${cached.age}m ago)`,
          data: { balances: cached.balances, source: 'cache' }
        };
      }

      // Complete failure
      console.error('Wallet provider error:', error);
      return {
        text: 'Unable to fetch wallet balances',
        data: { error: error.message }
      };
    }
  }
};
```

---

## Service Error Handling

### Resilient Service
```typescript
class PriceMonitorService extends Service {
  static serviceType = 'PRICE_MONITOR';
  private interval?: NodeJS.Timer;
  private consecutiveFailures = 0;
  private readonly maxFailures = 5;

  async start(): Promise<void> {
    this.status = 'running';
    this.consecutiveFailures = 0;

    this.interval = setInterval(() => this.tick(), 60000);
    console.log('Price monitor started');
  }

  private async tick(): Promise<void> {
    try {
      await this.checkPrices();
      this.consecutiveFailures = 0;  // Reset on success
    } catch (error) {
      this.consecutiveFailures++;
      console.error(`Price check failed (${this.consecutiveFailures}/${this.maxFailures}):`, error);

      if (this.consecutiveFailures >= this.maxFailures) {
        console.error('Too many failures, pausing price monitor');
        this.pause();

        // Attempt recovery after delay
        setTimeout(() => this.attemptRecovery(), 5 * 60 * 1000);
      }
    }
  }

  private pause(): void {
    this.status = 'paused';
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  private async attemptRecovery(): Promise<void> {
    console.log('Attempting price monitor recovery');
    try {
      await this.checkPrices();  // Test call
      this.consecutiveFailures = 0;
      await this.start();
      console.log('Price monitor recovered');
    } catch (error) {
      console.error('Recovery failed, will retry in 10 minutes');
      setTimeout(() => this.attemptRecovery(), 10 * 60 * 1000);
    }
  }

  async stop(): Promise<void> {
    this.pause();
    this.status = 'stopped';
    console.log('Price monitor stopped');
  }
}
```

---

## Logging Best Practices

### Structured Logging
```typescript
interface LogContext {
  action?: string;
  provider?: string;
  service?: string;
  userId?: string;
  roomId?: string;
  error?: string;
  duration?: number;
  [key: string]: any;
}

function log(level: 'info' | 'warn' | 'error', message: string, context: LogContext = {}): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };
  console[level](JSON.stringify(entry));
}

// Usage
log('error', 'Trade execution failed', {
  action: 'EXECUTE_TRADE',
  userId: message.entityId,
  error: error.message,
  duration: Date.now() - startTime,
});
```

---

## User-Friendly Error Messages

### Error Message Mapping
```typescript
const USER_FRIENDLY_ERRORS: Record<string, string> = {
  'insufficient balance': "You don't have enough balance for this transaction.",
  'slippage exceeded': 'Price moved too much. Try again or increase slippage tolerance.',
  'rate limit': 'Service is busy. Please wait a moment and try again.',
  'network error': 'Network issue. Please check your connection and try again.',
  'unauthorized': 'Authentication failed. Please reconnect your wallet.',
  'invalid address': 'The wallet address appears to be invalid. Please check and try again.',
};

function getUserFriendlyError(error: Error): string {
  const message = error.message.toLowerCase();

  for (const [key, friendly] of Object.entries(USER_FRIENDLY_ERRORS)) {
    if (message.includes(key)) {
      return friendly;
    }
  }

  return 'Something went wrong. Please try again later.';
}
```

---

## Summary

| Pattern | When to Use |
|---------|-------------|
| **Retry + Backoff** | Transient failures (network, timeout) |
| **Circuit Breaker** | External service protection |
| **Fallback** | Multiple data sources available |
| **Error Categories** | Different handling per error type |
| **Graceful Degradation** | Partial functionality is acceptable |
| **Structured Logging** | Production debugging |
| **User-Friendly Messages** | End-user communication |
