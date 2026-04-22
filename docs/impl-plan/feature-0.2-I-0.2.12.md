# Feature I-0.2.12: Security Headers

**Module:** 0.2 — Authentication & Identity
**Status:** ✅ Complete (2026-04-22)
**Dependencies:** None (first item in Module 0.2, independent)
**Complexity:** S (small — plugin + middleware + tests)

---

## Requirements

### Feature Spec (from v1-implementation-plan.md)
> Security headers — CSP, X-Frame-Options, X-Content-Type-Options. Fastify helmet plugin + TanStack Start response headers. No auth deps, do first.

### Acceptance Criteria
1. **API (Fastify):** All responses include CSP, X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy, X-DNS-Prefetch-Control, X-Download-Options, X-Permitted-Cross-Domain-Policies headers.
2. **Frontend (TanStack Start):** All SSR HTML and server function responses include CSP, X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy, Permissions-Policy headers.
3. **CSP is environment-aware:** Development mode relaxes restrictions for Vite HMR; production mode is strict.
4. **No regressions:** Existing tests continue to pass. CORS headers still work alongside security headers.

### Security Requirements (OWASP)
- **A5 Security Misconfiguration:** CSP, X-Frame-Options, X-Content-Type-Options prevent XSS amplification and clickjacking.
- **A7 XSS:** CSP acts as defense-in-depth alongside React's default escaping.

### Performance Targets
- Negligible overhead — header injection is O(1) per response.

---

## CSP Policy Design

### API (Fastify) — JSON-only responses
```
default-src 'none'
frame-ancestors 'none'
```
Minimal CSP since the API only serves JSON. Helmet provides additional headers (X-Frame-Options, HSTS, etc.) by default.

### Frontend (TanStack Start) — HTML pages

**Production:**
```
default-src 'self'
script-src 'self'
style-src 'self' 'unsafe-inline'          ← Tailwind CSS injects inline styles
img-src 'self' data: blob:
font-src 'self'
connect-src 'self' {POSTHOG_HOST}          ← PostHog analytics (if configured)
frame-src 'none'
frame-ancestors 'none'
object-src 'none'
base-uri 'self'
form-action 'self'
upgrade-insecure-requests
```

**Development additions (on top of production):**
```
script-src: add 'unsafe-eval'              ← Vite HMR source maps
connect-src: add ws:                       ← Vite HMR WebSocket
```
Remove `upgrade-insecure-requests` in dev (localhost is HTTP).

### Future Considerations
- **Razorpay SDK (Phase 3):** Will need `frame-src` and `script-src` additions for Razorpay checkout.
- **CDN/image hosting:** May need `img-src` additions when object storage (S3) is configured.

---

## Implementation Steps

### Task 1: Install @fastify/helmet [S]
- **File:** `apps/api/package.json` [modify]
- **Action:** `pnpm --filter api add @fastify/helmet`
- **Dependencies:** None

### Task 2: Create security-headers plugin [S]
- **File:** `apps/api/src/plugins/security-headers.ts` [new]
- **What:** Fastify plugin wrapping `@fastify/helmet` with EventKart-specific CSP config.
- **Key details:**
  - Register helmet with custom CSP directives (API-minimal: `default-src 'none'`)
  - Disable CSP `reportOnly` (enforce immediately)
  - Use `frameguard: { action: 'deny' }` for X-Frame-Options
  - HSTS: `maxAge: 31536000, includeSubDomains: true, preload: true`
  - Export as `fastify-plugin` with dependency on `config`
- **Dependencies:** Task 1

### Task 3: Register plugin in app.ts [S]
- **File:** `apps/api/src/app.ts` [modify]
- **What:** Import and register `securityHeadersPlugin` after `configPlugin`, before `corsPlugin`.
- **Ordering rationale:** Security headers must be registered before CORS so they're applied to all responses including CORS preflight.
- **Dependencies:** Task 2

### Task 4: Create Nitro server middleware for frontend [S]
- **File:** `apps/web/server/middleware/security-headers.ts` [new]
- **What:** Nitro event handler that sets security headers on every response.
- **Key details:**
  - Sets CSP, X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, Referrer-Policy, Permissions-Policy, X-DNS-Prefetch-Control
  - Environment-aware: checks `process.env.NODE_ENV` for dev relaxations
  - Reads `process.env.VITE_POSTHOG_HOST` for CSP connect-src (optional)
  - Uses Nitro's `defineEventHandler` / `setResponseHeaders` API
- **Dependencies:** None

### Task 5: Write API security-headers tests [S]
- **File:** `apps/api/test/plugins/security-headers.test.ts` [new]
- **What:** Vitest tests using `buildTestApp()` + `app.inject()`.
- **Test cases:**
  1. All expected security headers present on GET /health response
  2. CSP header contains `default-src 'none'` for API responses
  3. X-Frame-Options is `DENY`
  4. X-Content-Type-Options is `nosniff`
  5. Strict-Transport-Security is present with correct max-age
  6. Security headers coexist with CORS headers (no conflict)
- **Dependencies:** Tasks 2, 3

### Task 6: Validate all checks pass [S]
- **Action:** Run `pnpm --filter api check-types && pnpm --filter api lint && pnpm --filter api test`
- **Dependencies:** Tasks 1–5

---

## Database Schema
N/A — No database changes required.

## API Endpoints
N/A — No new endpoints. Security headers are applied globally via plugin/middleware.

## Frontend Routes & Components
N/A — No new routes. Security headers applied via Nitro server middleware.

---

## Files Summary

### apps/api (Backend)
| File | Status |
|------|--------|
| `package.json` | [modify] — add `@fastify/helmet` dependency |
| `src/plugins/security-headers.ts` | [new] — helmet plugin wrapper |
| `src/app.ts` | [modify] — register security-headers plugin |
| `test/plugins/security-headers.test.ts` | [new] — header verification tests |

### apps/web (Frontend)
| File | Status |
|------|--------|
| `server/middleware/security-headers.ts` | [new] — Nitro middleware for response headers |

---

## Completion Checklist
- [x] `@fastify/helmet` installed
- [x] Security-headers plugin created and registered
- [x] Nitro middleware created for frontend
- [x] API tests pass (6 test cases)
- [x] `check-types` passes for both workspaces
- [x] `lint` passes for both workspaces
- [x] `test` passes for both workspaces (98/98)
- [x] Existing health route tests still pass with new headers
