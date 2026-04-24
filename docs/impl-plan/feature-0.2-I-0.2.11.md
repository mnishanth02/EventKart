# Feature I-0.2.11 — CSRF Protection

## Overview

HMAC-signed double-submit cookie pattern for anti-CSRF protection on state-changing requests.

## Design Decisions

1. **HMAC-signed tokens** — Binds token to sessionId, prevents subdomain cookie injection
2. **Token format**: `<random>.<HMAC-SHA256(sessionId:random, CSRF_SECRET)>` (base64url)
3. **Skip unauthenticated**: CSRF only enforced for authenticated requests (session exists)
4. **Origin validation on OTP verify** — Prevents login-CSRF attacks
5. **Route opt-out**: `config: { csrfProtection: false }` for webhooks

## Implementation

### Plugin (`plugins/csrf.ts`)
- `onRequest` hook validates state-changing methods (POST, PUT, DELETE, PATCH)
- Skips: safe methods (GET, HEAD, OPTIONS), unauthenticated, opt-out routes
- Validates: HMAC signature integrity + double-submit (header === cookie)
- Exports: `generateCsrfToken()`, `buildCsrfCookieOptions()`, `buildCsrfClearOptions()`

### Integration Points
- **OTP verify route**: Sets `__csrf` cookie after session creation
- **Logout route**: Clears `__csrf` cookie
- **CORS plugin**: Added `X-CSRF-Token` to `allowedHeaders`
- **OTP send/verify routes**: Marked with `csrfProtection: false`
- **OTP verify route**: Origin header validation for login-CSRF protection

### Config (`lib/config.ts`)
- `CSRF_SECRET` — HMAC signing key (defaults to dev value)

### Constants (`@repo/shared/constants/csrf.ts`)
- `CSRF_COOKIE_NAME = "__csrf"`
- `CSRF_HEADER_NAME = "x-csrf-token"`

### Error Classes (`lib/errors.ts`)
- `ForbiddenError` (403, "FORBIDDEN")
- `CsrfError` (403, "CSRF_VALIDATION_FAILED")

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Add CSRF constants to shared package | ✅ |
| 2 | Add CSRF_SECRET to config | ✅ |
| 3 | Add ForbiddenError + CsrfError classes | ✅ |
| 4 | Create CSRF plugin | ✅ |
| 5 | Update CORS allowedHeaders | ✅ |
| 6 | Set CSRF cookie on OTP verify | ✅ |
| 7 | Add Origin validation on OTP verify | ✅ |
| 8 | Register plugin in app.ts | ✅ |
| 9 | Integration tests (25 tests) | ✅ |

## Test Coverage

25 tests in `test/plugins/csrf.test.ts`:
- Safe methods bypass (GET, HEAD, OPTIONS)
- Unauthenticated bypass
- Valid token passes (POST, PUT, DELETE, PATCH)
- Missing header/cookie → 403
- Tampered/wrong signature → 403
- Header/cookie mismatch → 403
- Malformed tokens → 403
- Wrong session token → 403
- Route opt-out
- Token generation format validation
