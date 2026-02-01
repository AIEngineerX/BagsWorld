# Security Documentation

## Known Dependency Vulnerabilities

Last audited: 2026-01-25

### Summary

```
48 vulnerabilities (30 low, 8 moderate, 10 high)
```

### Accepted Risk: Transitive Dependencies

The following vulnerabilities exist in **transitive dependencies** (dependencies of our dependencies) and are accepted as risk due to the following factors:

| Package              | Severity | Source                | Risk Assessment                                         |
| -------------------- | -------- | --------------------- | ------------------------------------------------------- |
| axios 1.0-1.11       | High     | @bagsfm/bags-sdk      | SDK internal use only, not exposed to user input        |
| bigint-buffer        | High     | @solana/web3.js chain | Buffer overflow requires malicious BigInt input         |
| elliptic             | High     | @solana/\* chain      | Cryptographic lib, exploits require key material access |
| glob 10.2-10.4       | High     | mocha/ts-mocha (dev)  | Dev dependency only, not in production                  |
| diff <4.0.4          | Moderate | ts-mocha (dev)        | Dev dependency only                                     |
| js-yaml 4.0-4.1      | Moderate | mocha (dev)           | Dev dependency only                                     |
| lodash/lodash-es     | Moderate | Various               | Prototype pollution requires untrusted object merge     |
| nanoid <3.3.8        | Moderate | mocha (dev)           | Dev dependency only                                     |
| serialize-javascript | Moderate | webpack chain         | Build-time only                                         |

### Why These Are Accepted

1. **Bags SDK vulnerabilities**: The `@bagsfm/bags-sdk` uses axios internally for API calls. User input is validated before being passed to SDK methods. The SDK is maintained by Bags.fm.

2. **Solana ecosystem vulnerabilities**: The `@solana/web3.js` and related packages have deep dependency trees including cryptographic libraries. These are standard in the Solana ecosystem and are used by all Solana applications.

3. **Dev-only vulnerabilities**: mocha, ts-mocha, and related test dependencies are not included in production builds.

4. **Prototype pollution (lodash)**: Requires `_.merge()` or `_.set()` with untrusted input. Our codebase does not use these functions with user-controlled data.

### Mitigation Measures

1. **Input Validation**: All user input is validated before processing
2. **Rate Limiting**: API endpoints have rate limiting to prevent abuse
3. **Security Headers**: CSP, HSTS, X-Frame-Options configured in netlify.toml
4. **Parameterized Queries**: Database queries use parameterized statements

### Remediation Path

These vulnerabilities will be resolved when:

- `@bagsfm/bags-sdk` releases an update with fixed axios
- `@solana/*` ecosystem packages release updates
- Next major version update (requires testing for breaking changes)

### Monitoring

Run `npm audit` periodically to check for new vulnerabilities.

---

## Rate Limiting

API endpoints implement rate limiting via `src/lib/rate-limit.ts`:

| Tier     | Limit   | Endpoints                                      |
| -------- | ------- | ---------------------------------------------- |
| Strict   | 5/min   | admin-auth, partner-claim, send-transaction    |
| Standard | 30/min  | trade, launch-token, claim-fees, sniper, admin |
| AI       | 10/min  | character-chat                                 |
| Relaxed  | 100/min | Read-only endpoints                            |

## Security Headers

Configured in `netlify.toml`:

- `X-Frame-Options: DENY` - Prevent clickjacking
- `X-Content-Type-Options: nosniff` - Prevent MIME sniffing
- `X-XSS-Protection: 1; mode=block` - XSS protection
- `Strict-Transport-Security` - HTTPS enforcement
- `Content-Security-Policy` - Restrict resource loading

## Reporting Security Issues

Report security vulnerabilities via GitHub Issues (private) or contact the maintainers directly.
