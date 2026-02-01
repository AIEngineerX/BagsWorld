# Security Checklist

Mandatory pre-deployment security audit for Solana web applications.

## Critical (Must Pass)

### Private Key Security

- [ ] No private keys anywhere in codebase
- [ ] No seed phrases in codebase
- [ ] No `.env` files committed to git
- [ ] `.gitignore` includes: `.env`, `.env.local`, `*.pem`, `*.key`

### API Key Protection

- [ ] No API keys hardcoded in frontend JavaScript
- [ ] RPC endpoints with API keys are proxied through serverless functions
- [ ] All sensitive keys are in environment variables
- [ ] Netlify env vars are properly configured

### Wallet Security

- [ ] Never auto-sign transactions without user confirmation
- [ ] Always display transaction details before signing
- [ ] Validate recipient addresses before transactions
- [ ] Handle wallet disconnection gracefully

---

## High Priority

### Input Validation

```javascript
// Always validate wallet addresses
const isValidSolanaAddress = (address) => {
  try {
    new PublicKey(address);
    return PublicKey.isOnCurve(address);
  } catch {
    return false;
  }
};

// Validate token amounts
const isValidAmount = (amount, max) => {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0 && num <= max;
};
```

### XSS Prevention

- [ ] All user inputs are sanitized before display
- [ ] Token names/symbols are escaped (can contain malicious content)
- [ ] No `dangerouslySetInnerHTML` without sanitization
- [ ] CSP headers configured

```javascript
// Sanitize displayed text
const sanitize = (str) => {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
};

// Use in React
<span>{sanitize(token.name)}</span>;
```

### Content Security Policy

```toml
# netlify.toml
[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = """
      default-src 'self';
      script-src 'self' 'unsafe-inline' 'unsafe-eval';
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: https:;
      connect-src 'self' https://api.mainnet-beta.solana.com https://api.dexscreener.com wss://pumpportal.fun;
      font-src 'self' data:;
    """
```

---

## Medium Priority

### Rate Limiting

```javascript
// Client-side rate limiter
const createRateLimiter = (maxRequests, windowMs) => {
  const requests = [];

  return async (fn) => {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Remove old requests
    while (requests.length && requests[0] < windowStart) {
      requests.shift();
    }

    if (requests.length >= maxRequests) {
      const waitTime = requests[0] + windowMs - now;
      await new Promise((r) => setTimeout(r, waitTime));
      return createRateLimiter(maxRequests, windowMs)(fn);
    }

    requests.push(now);
    return fn();
  };
};

const rateLimitedFetch = createRateLimiter(10, 1000); // 10 req/sec
```

### Error Handling

- [ ] All async operations have try/catch
- [ ] Errors don't expose sensitive information
- [ ] User-friendly error messages displayed
- [ ] Failed transactions show clear status

```javascript
const safeAsyncCall = async (fn, fallback = null) => {
  try {
    return await fn();
  } catch (err) {
    console.error("Operation failed:", err.message);
    return fallback;
  }
};
```

### HTTPS Enforcement

```toml
# netlify.toml
[[redirects]]
  from = "http://*"
  to = "https://:splat"
  status = 301
  force = true
```

---

## Data Security

### Local Storage

- [ ] No private keys in localStorage
- [ ] No API keys in localStorage
- [ ] Sensitive session data uses sessionStorage (clears on tab close)
- [ ] Consider not storing wallet state (re-check on load)

### URL Parameters

- [ ] No sensitive data in URL parameters
- [ ] Token addresses in URLs are validated before use

### External Data

- [ ] API responses are validated before use
- [ ] Images from external sources use `referrerpolicy="no-referrer"`
- [ ] Untrusted links have `rel="noopener noreferrer"`

```html
<a href="{externalUrl}" target="_blank" rel="noopener noreferrer"> External Link </a>

<img src="{tokenImage}" referrerpolicy="no-referrer" alt="{token.name}" />
```

---

## Deployment Security

### Environment Variables (Netlify)

```bash
# Set via Netlify UI or CLI
netlify env:set BAGS_API_KEY "your-key-here"
netlify env:set RPC_URL "https://your-rpc-endpoint"
```

### Serverless Function for Sensitive APIs

```javascript
// netlify/functions/proxy-rpc.js
export async function handler(event) {
  const { method, params } = JSON.parse(event.body);

  // Validate request
  const allowedMethods = ["getBalance", "getTokenAccountsByOwner"];
  if (!allowedMethods.includes(method)) {
    return { statusCode: 403, body: "Method not allowed" };
  }

  const response = await fetch(process.env.RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });

  return {
    statusCode: 200,
    body: await response.text(),
  };
}
```

### Build Security

- [ ] Dependencies audited (`npm audit`)
- [ ] No known vulnerabilities in production deps
- [ ] Lock file committed (package-lock.json)
- [ ] Build output doesn't include source maps with sensitive code

---

## Pre-Deploy Checklist

Run through before every deployment:

1. [ ] `npm audit` shows no critical vulnerabilities
2. [ ] No console.logs exposing sensitive data
3. [ ] All API keys are in environment variables
4. [ ] Wallet flows tested (connect, sign, error cases)
5. [ ] Error states display user-friendly messages
6. [ ] External links have security attributes
7. [ ] CSP headers configured in netlify.toml
8. [ ] HTTPS redirect configured
9. [ ] Test on mobile/different browsers
10. [ ] Rate limiting in place for API calls

---

## Common Vulnerabilities to Avoid

### ❌ Bad Patterns

```javascript
// Hardcoded keys
const RPC = "https://mainnet.helius-rpc.com/?api-key=abc123";

// Unsanitized display
element.innerHTML = tokenData.name;

// Auto-signing
await wallet.signTransaction(tx); // Without user confirmation

// Trusting URL params
const amount = urlParams.get("amount"); // Use directly
```

### ✅ Good Patterns

```javascript
// Env vars (server-side only)
const RPC = process.env.RPC_URL;

// Sanitized display
element.textContent = tokenData.name;

// Confirm before signing
if (confirm(`Send ${amount} SOL to ${address}?`)) {
  await wallet.signTransaction(tx);
}

// Validate URL params
const amount = parseFloat(urlParams.get("amount"));
if (isNaN(amount) || amount <= 0 || amount > MAX_AMOUNT) {
  throw new Error("Invalid amount");
}
```
