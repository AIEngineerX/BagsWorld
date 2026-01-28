# Security Notes

## Known Vulnerabilities

### elliptic (transitive dependency via @elizaos/core)

**Severity:** Low
**Advisory:** GHSA-848j-6mx2-7j84
**Status:** Acknowledged, not exploitable in this context

The `elliptic` library has a known vulnerability related to cryptographic implementation. This package is a transitive dependency:

```
@elizaos/core -> crypto-browserify -> browserify-sign -> elliptic
@elizaos/core -> crypto-browserify -> create-ecdh -> elliptic
```

**Why this doesn't affect us:**
1. This is a server-side Node.js application, not a browser application
2. We use Node's native `crypto.subtle` API for Ed25519 signing (SolanaService.ts)
3. The vulnerable code path (browser-based ECDSA) is not executed in our runtime
4. The `crypto-browserify` polyfill is bundled by @elizaos/core for browser compatibility but unused server-side

**Mitigation:**
- Monitor @elizaos/core releases for updates that address this
- The fix requires upgrading to @elizaos/core@1.5.4 which introduces breaking changes
- We accept this low-severity risk until a compatible fix is available

## Security Best Practices Implemented

1. **No hardcoded secrets** - All credentials via environment variables
2. **Rate limiting** - API endpoints have request limits to prevent abuse
3. **Input validation** - All user input is validated and sanitized
4. **Error handling** - Errors are logged but not exposed to clients
5. **Simulated transactions** - Trading operations fail safely without creating fake positions
6. **Pinned dependencies** - Exact versions in package.json for reproducible builds

## Required Environment Variables

```
ANTHROPIC_API_KEY or OPENAI_API_KEY  # LLM provider
DATABASE_URL                          # PostgreSQL connection
GHOST_WALLET_PRIVATE_KEY              # Only if trading enabled
BAGS_API_KEY                          # Bags.fm API access
```

## Reporting Security Issues

Contact the BagsWorld team via GitHub issues for security concerns.
