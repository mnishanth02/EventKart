# Feature I-0.2.8 — Logout Endpoint

## Overview

`POST /api/v1/auth/logout` — Clears the user's session and related cookies.

## Implementation

### Route (`modules/auth/routes.ts`)
- Checks `request.session` — returns 401 if null
- Calls `logoutSession()` — deletes Redis session + sets `revokedAt` in DB
- Clears `kiran_session` and `__csrf` cookies

### Service (`modules/auth/service.ts`)
- `logoutSession(deps, sessionId)`:
  - Deletes session from Redis (immediate invalidation)
  - Sets `revokedAt = new Date()` in DB sessions table (audit trail)
  - DB failure is fail-open (logged, not thrown) — session already invalidated

### Schemas (`modules/auth/schemas.ts`)
- `logoutResponseSchema` — `{ success: true, data: { message: string } }`
- `logoutErrorResponseSchema` — `{ success: false, error: { code, message } }`

### Error Classes (`lib/errors.ts`)
- `UnauthorizedError` (401, "UNAUTHORIZED")

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Add UnauthorizedError to errors.ts | ✅ |
| 2 | Add logout schemas | ✅ |
| 3 | Add logoutSession service | ✅ |
| 4 | Add POST /auth/logout route | ✅ |
| 5 | Integration tests (15 tests) | ✅ |

## Test Coverage

15 tests in `test/modules/auth/logout.test.ts`:
- Successful logout (200, service args, cookie clearing)
- Unauthenticated (401, stale session)
- CSRF validation (missing/tampered tokens → 403)
- Service errors → 500
- Idempotency
- Role variations (organizer, admin)
