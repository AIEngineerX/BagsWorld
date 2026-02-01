# Netlify Deployment

Configuration and deployment patterns for Solana web apps on Netlify.

## Project Setup

### netlify.toml (Static Site)

```toml
[build]
  publish = "."

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Content-Security-Policy = """
      default-src 'self';
      script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net;
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
      font-src 'self' https://fonts.gstatic.com;
      img-src 'self' data: https:;
      connect-src 'self'
        https://api.mainnet-beta.solana.com
        https://api.dexscreener.com
        wss://pumpportal.fun
        https://*.bags.fm;
    """

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### netlify.toml (React/Vite)

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "18"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Content-Security-Policy = """
      default-src 'self';
      script-src 'self' 'unsafe-inline' 'unsafe-eval';
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: https:;
      connect-src 'self'
        https://api.mainnet-beta.solana.com
        https://api.dexscreener.com
        wss://pumpportal.fun;
    """

# SPA routing
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## Environment Variables

### Setting Variables

```bash
# Via Netlify CLI
netlify env:set VITE_TOKEN_ADDRESS "YourTokenMintAddress"
netlify env:set BAGS_API_KEY "your-api-key"

# Or via Netlify Dashboard:
# Site Settings → Environment Variables → Add
```

### Accessing in Code

**Static Site (runtime)**

```javascript
// Environment variables must be injected at build time
// Or use Netlify Functions for sensitive keys
```

**Vite (build time)**

```javascript
// Only VITE_ prefixed vars are exposed to client
const tokenAddress = import.meta.env.VITE_TOKEN_ADDRESS;

// For sensitive keys, use serverless functions
```

### Variable Naming

- `VITE_*` - Exposed to frontend (Vite)
- `REACT_APP_*` - Exposed to frontend (CRA)
- No prefix - Only available in serverless functions

---

## Serverless Functions

### Directory Structure

```
project/
├── netlify/
│   └── functions/
│       ├── get-price.js
│       └── proxy-rpc.js
├── src/
└── netlify.toml
```

### Basic Function

```javascript
// netlify/functions/get-price.js
export async function handler(event) {
  const { tokenAddress } = event.queryStringParameters;

  if (!tokenAddress) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing tokenAddress" }),
    };
  }

  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
    const data = await res.json();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=10",
      },
      body: JSON.stringify(data.pairs?.[0] || null),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to fetch price" }),
    };
  }
}
```

### RPC Proxy (Hide API Keys)

```javascript
// netlify/functions/rpc.js
export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const { method, params } = JSON.parse(event.body);

  // Whitelist allowed methods
  const allowed = ["getBalance", "getTokenAccountsByOwner", "getAccountInfo", "getLatestBlockhash"];

  if (!allowed.includes(method)) {
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
    headers: { "Content-Type": "application/json" },
    body: await response.text(),
  };
}
```

### Calling Functions from Frontend

```javascript
// Call serverless function
const getPrice = async (tokenAddress) => {
  const res = await fetch(`/.netlify/functions/get-price?tokenAddress=${tokenAddress}`);
  return res.json();
};

// Proxied RPC call
const getBalance = async (address) => {
  const res = await fetch("/.netlify/functions/rpc", {
    method: "POST",
    body: JSON.stringify({
      method: "getBalance",
      params: [address],
    }),
  });
  const data = await res.json();
  return data.result?.value;
};
```

---

## Deployment Commands

### Via CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Initialize (first time)
netlify init

# Deploy preview
netlify deploy

# Deploy to production
netlify deploy --prod

# Open site
netlify open
```

### Via Git

1. Push to GitHub/GitLab
2. Connect repo in Netlify Dashboard
3. Configure build settings
4. Auto-deploys on push

---

## Custom Domain

### netlify.toml

```toml
# Redirect www to apex
[[redirects]]
  from = "https://www.yourdomain.com/*"
  to = "https://yourdomain.com/:splat"
  status = 301
  force = true
```

### DNS Configuration

```
# A Record
@  →  75.2.60.5

# CNAME for www
www  →  your-site.netlify.app
```

---

## Performance Optimization

### Caching

```toml
# Cache static assets
[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

# Cache images
[[headers]]
  for = "*.png"
  [headers.values]
    Cache-Control = "public, max-age=86400"

[[headers]]
  for = "*.jpg"
  [headers.values]
    Cache-Control = "public, max-age=86400"
```

### Preloading

```html
<head>
  <!-- Preconnect to APIs -->
  <link rel="preconnect" href="https://api.dexscreener.com" />
  <link rel="preconnect" href="https://api.mainnet-beta.solana.com" />

  <!-- Preload critical assets -->
  <link rel="preload" href="/logo.png" as="image" />
</head>
```

---

## Troubleshooting

### Build Fails

```bash
# Check Node version
node -v  # Should match netlify.toml

# Clear cache and rebuild
netlify build --clear
```

### Functions Not Working

- Check function is in `netlify/functions/`
- Verify function exports `handler`
- Check logs: `netlify functions:log`

### CORS Issues

```javascript
// Add CORS headers to function response
return {
  statusCode: 200,
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  },
  body: JSON.stringify(data),
};
```

### Environment Variables Not Loading

- Vite: Must prefix with `VITE_`
- Redeploy after adding new vars
- Check variable names match exactly
