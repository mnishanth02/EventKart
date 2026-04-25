# I-0.2.2: OTP Verify → Session Creation

**Status:** ✅ Complete
**Started:** 2026-04-22
**Completed:** 2026-04-22

## Summary

Implements `POST /api/v1/auth/otp/verify` — validates a 6-digit OTP against Redis, upserts the user in PostgreSQL, creates a dual-write session (Redis + DB), and sets an HttpOnly session cookie.

## Key Design Decisions

1. **Atomic OTP verification via Redis Lua script** — prevents race conditions where concurrent requests verify the same OTP
2. **Timing-safe HMAC comparison** — `crypto.timingSafeEqual` on decoded hex buffers
3. **HMAC secret from config** — moved from hardcoded constant to `OTP_HMAC_SECRET` env var
4. **User upsert** — `INSERT ON CONFLICT DO NOTHING` + `SELECT` fallback (safe under concurrency)
5. **Dual-write sessions** — Redis (primary, fast lookup) + DB (audit/revocation metadata), fail-closed with compensation
6. **Cookie**: `kiran_session`, HttpOnly, Secure, SameSite=Lax, configurable domain, 30-day maxAge
7. **@fastify/cookie** plugin for cookie management

## Files Created

| File                                            | Purpose                                      |
| ----------------------------------------------- | -------------------------------------------- |
| `packages/shared/src/constants/session.ts`      | SESSION_TTL_SECONDS, SESSION_COOKIE_NAME     |
| `apps/api/src/lib/session.ts`                   | Session CRUD (Redis), cookie options builder |
| `apps/api/test/lib/session.test.ts`             | 14 session lib unit tests                    |
| `apps/api/test/modules/auth/otp-verify.test.ts` | 15 OTP verify integration tests              |

## Files Modified

| File                                     | Changes                                                   |
| ---------------------------------------- | --------------------------------------------------------- |
| `packages/shared/src/constants/index.ts` | Export session constants                                  |
| `packages/shared/src/schemas/otp.ts`     | Added otpVerifyRequestSchema, otpVerifyDataSchema         |
| `packages/shared/src/schemas/index.ts`   | Export verify schemas                                     |
| `apps/api/src/lib/config.ts`             | Added OTP_HMAC_SECRET, COOKIE_DOMAIN env vars             |
| `apps/api/src/lib/otp.ts`                | Atomic Lua verify, timing-safe compare, secret from param |
| `apps/api/src/lib/errors.ts`             | OtpExpiredError, OtpInvalidError, OtpMaxAttemptsError     |
| `apps/api/src/modules/auth/service.ts`   | verifyOtpAndCreateSession function                        |
| `apps/api/src/modules/auth/schemas.ts`   | otpVerifyBodySchema, otpVerifyResponseSchema              |
| `apps/api/src/modules/auth/routes.ts`    | POST /otp/verify route                                    |
| `apps/api/src/app.ts`                    | Registered @fastify/cookie plugin                         |
| `apps/api/.env.example`                  | COOKIE_DOMAIN documentation                               |
| `apps/api/test/setup.ts`                 | Added eval to MockRedis                                   |
| `apps/api/test/lib/otp.test.ts`          | Updated for secret param, added verifyAndConsumeOtp tests |

## Validation

- ✅ 202 API tests passing (15 test files)
- ✅ 58 shared package tests passing
- ✅ Type check passes across all workspaces
- ✅ Lint passes (pre-existing @repo/ui warnings only)
