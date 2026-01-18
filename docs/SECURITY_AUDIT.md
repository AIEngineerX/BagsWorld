# BagsWorld Security Audit Report

**Date:** January 18, 2026
**Auditor:** Claude Code Security Review
**Scope:** Full codebase penetration test

---

## Executive Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 1 | **FIXED** |
| HIGH | 2 | **FIXED** |
| MEDIUM | 4 | Open |
| LOW | 3 | Open |

**Overall Risk Level:** LOW-MEDIUM (after fixes)

The codebase follows many security best practices (no XSS, proper wallet signing, server-side API keys). Critical and high-severity authentication vulnerabilities have been fixed.

---

## CRITICAL Vulnerabilities

### 1. ~~Admin Authentication Bypass via Header Spoofing~~ **FIXED**

**File:** `src/app/api/admin/config/route.ts`

**Original Issue:** Admin authentication relied solely on a client-provided header.

**Fix Applied:**
- Implemented cryptographic wallet signature verification using `src/lib/wallet-auth.ts`
- Challenge/response flow proves wallet ownership
- Session tokens issued after successful signature verification
- AdminConsole now prompts user to sign with wallet before accessing admin functions

**Verification:** The attack vector below no longer works:
```bash
# This now returns 401 Unauthorized
curl -X POST https://bagsworld.netlify.app/api/admin/config \
  -H "Content-Type: application/json" \
  -H "x-admin-wallet: 9Luwe53R7V5ohS8dmconp38w9FoKsUgBjVwEPPU8iFUC" \
  -d '{"action":"update","updates":{"maxBuildings":1}}'
```

~~**Remediation:** Implement cryptographic signature verification:
1. Require admin to sign a challenge message with their wallet~~
2. Verify the signature server-side using `@solana/web3.js`
3. Use short-lived session tokens after verification

---

## HIGH Vulnerabilities

### 2. ~~Agent API Authentication Disabled When Secret Not Set~~ **FIXED**

**File:** `src/app/api/agent/route.ts`

**Original Issue:** If `AGENT_SECRET` not set, agent API was completely open.

**Fix Applied:**
- Changed to fail-closed: rejects all requests in production when AGENT_SECRET not configured
- Only allows unauthenticated access in explicit `NODE_ENV=development`
- Logs security warnings when accessed without proper configuration

### 3. ~~Sensitive Agent Status Exposed Without Authentication~~ **FIXED**

**File:** `src/app/api/agent/route.ts`

**Original Issue:** GET endpoint exposed wallet address and balance without auth.

**Fix Applied:**
- GET endpoint now requires authentication
- Unauthenticated requests receive minimal response: `{ configured: boolean, authenticated: false }`
- Full status (wallet address, balance, agent state) only returned to authenticated requests

---

## MEDIUM Vulnerabilities

### 4. No Rate Limiting on API Endpoints

**Files:** All routes in `src/app/api/`

**Issue:** No rate limiting implemented on any endpoint. APIs can be flooded with requests.

**Impact:**
- Denial of Service attacks
- API cost amplification (Bags API, Anthropic API)
- Brute force attacks on auth flows

**Remediation:** Implement rate limiting using `@upstash/ratelimit` or similar:
```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
});
```

### 5. Prompt Injection Risk in Character Chat

**File:** `src/app/api/character-chat/route.ts:134-138`

```typescript
const messages = chatHistory.slice(-6).map((m) => ({
  role: m.role as "user" | "assistant",
  content: m.content,  // User content passed directly
}));
messages.push({ role: "user", content: userMessage });
```

**Issue:** User messages are passed to Claude without sanitization. While system prompts constrain behavior, sophisticated prompt injection attempts could manipulate responses.

**Impact:** Characters could be manipulated to say inappropriate things or leak system prompt details.

**Remediation:**
- Add input validation/sanitization
- Implement content filtering
- Consider character limits on user messages

### 6. No CSRF Protection on State-Changing Endpoints

**Files:** All POST routes

**Issue:** API endpoints don't validate CSRF tokens. In a browser context, malicious sites could forge requests.

**Impact:** Cross-site request forgery if user is authenticated via cookies.

**Remediation:** Since the app uses header-based auth (wallet signatures), CSRF risk is lower, but consider adding `SameSite` cookie attributes and origin validation.

### 7. Debug Logging Contains Sensitive Data

**Files:** Multiple routes including:
- `src/lib/bags-api.ts:90` - Logs full API responses
- `src/app/api/launch-token/route.ts:171` - Logs fee configuration
- `src/app/api/launch-token/route.ts:209` - Logs launch transaction data

**Issue:** Console.log statements dump request/response data that may contain sensitive information to server logs.

**Impact:** Information leakage through logs, potential compliance issues.

**Remediation:**
- Remove debug logging for production
- Use environment-aware logging (debug only in dev)
- Redact sensitive fields before logging

---

## LOW Vulnerabilities

### 8. Overly Permissive Supabase RLS

**Issue:** Supabase uses anon key exposed to client. Row Level Security policies should be reviewed to ensure proper access control.

**Recommendation:** Audit Supabase RLS policies to ensure:
- Users can only read/write their own data
- Public data is read-only for anonymous users
- Admin operations require service role key

### 9. Error Messages May Leak Internal Details

**File:** Multiple routes

```typescript
return NextResponse.json(
  { error: error instanceof Error ? error.message : "Failed to process request" },
  { status: 500 }
);
```

**Issue:** Raw error messages are returned to clients, potentially exposing internal details.

**Remediation:** Map errors to generic messages in production while logging full details server-side.

### 10. OAuth State Stored in Cookies Without Encryption

**File:** `src/app/api/auth/x/route.ts:40-49`

**Issue:** OAuth state is stored in httpOnly cookies but not encrypted. While httpOnly prevents JS access, the values are readable if cookies are intercepted.

**Recommendation:** Encrypt cookie values and/or use server-side session storage.

---

## Positive Security Findings

### What's Done Well:

1. **No XSS Vulnerabilities** - React's JSX escaping is used properly, no `dangerouslySetInnerHTML`

2. **Proper Wallet Signing** - Transactions are signed client-side, private keys never leave the wallet

3. **Server-Side API Keys** - `BAGS_API_KEY`, `ANTHROPIC_API_KEY` properly kept server-side

4. **OAuth PKCE Flow** - X OAuth uses PKCE with proper state validation for CSRF protection

5. **Input Validation Present** - Required field validation on token launch, fee share limits enforced

6. **HTTP-Only Cookies** - OAuth cookies use httpOnly flag

7. **Connection Security** - Uses HTTPS for all external API calls

8. **No SQL Injection** - Uses Supabase client which parameterizes queries

---

## Remediation Priority

### Immediate (Before Production)
1. Fix admin authentication (cryptographic wallet verification)
2. Change agent auth to fail closed when secret not set
3. Add rate limiting to all endpoints

### Short Term (Within 1 Week)
4. Remove/gate debug logging
5. Add input sanitization to chat endpoints
6. Review and tighten Supabase RLS policies

### Medium Term (Within 1 Month)
7. Implement proper session management
8. Add monitoring and alerting for suspicious activity
9. Consider Web Application Firewall (WAF)

---

## Testing Methodology

- Static code analysis
- API route review
- Authentication flow analysis
- Environment variable exposure check
- Input validation review
- Client-side code inspection

---

## Conclusion

BagsWorld demonstrates good foundational security practices for a Solana dApp. The main concerns are around the admin authentication mechanism and the agent API's fail-open behavior. Addressing the CRITICAL and HIGH findings should be prioritized before any significant production usage.

The codebase is **NOT** recommended for production with real funds until the CRITICAL vulnerability is fixed.
