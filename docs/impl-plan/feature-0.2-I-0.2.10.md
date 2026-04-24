# I-0.2.10 — Internal API Key for Server-to-Server Calls

**Status:** ✅ Complete
**Feature ID:** I-0.2.10
**Module:** 0.2 — Authentication & Identity
**Depends on:** I-0.2.3 (Session middleware) ✅

---

## Overview

Implements validation of `X-Internal-Key` header for server-to-server calls from TanStack Start SSR to the Fastify API. Internal requests receive higher rate limits (1000/min vs 100/min) and bypass CSRF validation.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Invalid key behavior | 401 reject (fail-closed) | Secure default — never silently ignore bad keys |
| Key unconfigured + header sent | 401 reject | Fail-closed — prevents hidden misconfiguration |
| Session coexistence | Both — session hydrated AND isInternalRequest set | TanStack Start SSR forwards cookies for user context |
| CSRF bypass | Explicit bypass for internal requests | Machine-to-machine calls don't use CSRF tokens |
| Rate limit bucketing | `internal:${request.ip}` per-IP | Prevents noisy-neighbor from one SSR node |
| Plugin order | After cookie, before auth | Reject invalid keys before doing Redis session lookup |
| CORS header | Removed `X-Internal-Key` from allowedHeaders | SSR calls don't go through browser CORS; reduces attack surface |
| Frontend scope | Env setup only | API client deferred to I-0.3.6 |

## Implementation Tasks

| # | Task | Status | Completed |
|---|------|--------|-----------|
| 1 | Add `isInternalRequest: boolean` to FastifyRequest type | ✅ | 2026-04-22 |
| 2 | Create `plugins/internal-key.ts` (timing-safe validation) | ✅ | 2026-04-22 |
| 3 | Update `plugins/csrf.ts` (bypass + dependency) | ✅ | 2026-04-22 |
| 4 | Update `plugins/rate-limit.ts` (dynamic max + key prefix) | ✅ | 2026-04-22 |
| 5 | Update `app.ts` (register plugin in correct order) | ✅ | 2026-04-22 |
| 6 | Remove `X-Internal-Key` from CORS allowedHeaders | ✅ | 2026-04-22 |
| 7 | Add `INTERNAL_API_KEY` to web `serverEnv` + `.env.example` | ✅ | 2026-04-22 |
| 8 | Integration tests (10 tests) | ✅ | 2026-04-22 |
| 9 | Full validation (check-types, lint, test) | ✅ | 2026-04-22 |

## Files Changed

### New files (2)
- `apps/api/src/plugins/internal-key.ts` — Internal key validation plugin
- `apps/api/test/plugins/internal-key.test.ts` — 10 integration tests

### Modified files (7)
- `apps/api/src/types/fastify.d.ts` — Added `isInternalRequest: boolean`
- `apps/api/src/app.ts` — Registered internalKeyPlugin after cookie, before auth
- `apps/api/src/plugins/csrf.ts` — CSRF bypass for internal requests + dependency
- `apps/api/src/plugins/rate-limit.ts` — Dynamic max (1000/100) + per-IP internal key
- `apps/api/src/plugins/cors.ts` — Removed `X-Internal-Key` from allowedHeaders
- `apps/web/src/lib/env/server.ts` — Added `INTERNAL_API_KEY` to serverEnv
- `apps/web/.env.example` — Added `INTERNAL_API_KEY` entry

## Test Results

- 293 API tests passing (10 new internal-key tests)
- check-types clean (api + web)
- lint clean

## Known Limitations

- **No API client yet**: The web app has the env var but no `apiClient` utility to send the header. This will be built as part of I-0.3.6 (API client setup).
- **Single key**: All SSR instances share the same key. For multi-tenant internal auth, consider per-service keys in the future.
