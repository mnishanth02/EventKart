# I-0.2.3: Session Middleware — decorates `request.session`

**Status:** ✅ Complete
**Started:** 2026-04-22
**Completed:** 2026-04-22

## Summary

Fastify plugin (`plugins/auth.ts`) that runs on every request, reads the `kiran_session` HttpOnly cookie, looks up the session in Redis, and decorates `request.session` with the session info or `null`.

## Key Design Decisions

1. **Fail-open on Redis errors** — transient Redis failures set `request.session = null` but do NOT clear the cookie (avoids mass logout during outages)
2. **Stale cookie cleanup** — if session not found in Redis or expired, the plugin clears the cookie using the same path/domain options
3. **Defense-in-depth expiresAt check** — validates embedded `expiresAt` timestamp even though Redis TTL handles primary expiry
4. **Safe cleanup** — `safeDeleteSession()` catches Redis `del` errors so cleanup failures don't crash requests
5. **SessionInfo type** — `{ userId, role, sessionId }` on `FastifyRequest`, separate from `SessionData` stored in Redis

## Files Created

| File | Purpose |
|------|---------|
| `apps/api/src/plugins/auth.ts` | Auth plugin — cookie → Redis → decorates request.session |
| `apps/api/test/plugins/auth.test.ts` | 15 integration tests |

## Files Modified

| File | Changes |
|------|---------|
| `apps/api/src/types/fastify.d.ts` | Added `SessionInfo` interface, `FastifyRequest.session` declaration |
| `apps/api/src/app.ts` | Registered auth plugin (after cookie + redis, before error handler) |

## Validation

- ✅ 217 API tests passing (16 test files)
- ✅ Type check passes across all workspaces
- ✅ Lint passes (pre-existing @repo/ui warnings only)
