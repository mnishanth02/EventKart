# Implementation Plan: I-0.2.5 + I-0.2.6

> **Features:** I-0.2.5 (Organizer email verification) + I-0.2.6 (Admin IP allowlist middleware)
> **Module:** 0.2 — Authentication & Identity
> **Status:** ✅ Complete (2026-04-22)

## Features

### I-0.2.6 — Admin IP Allowlist Middleware

**Requirement:** Architecture §6: "Admin: Phone OTP + IP allowlist during pilot." Configurable allowlist via env var.
**Depends on:** I-0.2.4 (RBAC) ✅

**Implementation:**
- Factory middleware `createIpAllowlistMiddleware(config, logger?)` using `node:net` `BlockList` for IPv4/IPv6/CIDR matching
- Parses `ADMIN_IP_ALLOWLIST` env var once at creation (comma-separated IPs/CIDRs)
- When unset, returns a no-op pass-through (dev bypass) with warning log
- IPv4-mapped IPv6 normalization (`::ffff:x.x.x.x` → `x.x.x.x`)
- Throws `IpNotAllowedError` (403, `IP_NOT_ALLOWED`) when blocked
- Invalid entries logged and skipped at startup

**Files:**
| Action | File |
|--------|------|
| [new] | `apps/api/src/middleware/require-ip-allowlist.ts` |
| [new] | `apps/api/test/middleware/require-ip-allowlist.test.ts` (10 tests) |
| [modify] | `apps/api/src/lib/errors.ts` — `IpNotAllowedError` |
| [modify] | `apps/api/src/lib/config.ts` — `ADMIN_IP_ALLOWLIST` |
| [modify] | `apps/api/.env.example` |

### I-0.2.5 — Organizer Email Verification

**Requirement:** Architecture §6: "Organizer: Phone OTP + email verification." Elevated role assigned after email verification.
**Depends on:** I-0.2.4 (RBAC) ✅

**Design Decisions:**
- Email delivery: Resend API (prod) + console log (dev, when `RESEND_API_KEY` unset)
- Admin approval: deferred to Module 1.1 — email verification alone elevates role
- Frontend: backend only — frontend deferred
- Token security: SHA-256 hashed before DB storage
- Session refresh: Redis session role updated immediately on elevation
- Single-active-token: previous pending tokens invalidated when new one sent
- Rate limiting: per-user via Redis SET NX (1 per 60s)
- CSRF: enabled on both endpoints (not exempt like OTP routes)

**Endpoints:**
| Method | Path | Auth | Rate Limit |
|--------|------|------|------------|
| POST | `/api/v1/auth/email/send-verification` | `requireAuth` | 5/min + 60s per-user |
| POST | `/api/v1/auth/email/verify` | `requireAuth` | default |

**Database:**
- `email_verifications` table: `id`, `user_id` (FK), `email`, `token_hash` (SHA-256, unique), `expires_at`, `verified_at`, `created_at`

**Files:**
| Action | File |
|--------|------|
| [new] | `packages/shared/src/constants/email-verification.ts` |
| [new] | `packages/db/src/schema/email-verifications.ts` |
| [new] | `apps/api/src/lib/email.ts` |
| [new] | `apps/api/src/modules/auth/email-verification-service.ts` |
| [new] | `apps/api/test/modules/auth/email-verification.test.ts` (19 tests) |
| [modify] | `packages/shared/src/constants/index.ts` |
| [modify] | `packages/db/src/schema/index.ts` |
| [modify] | `apps/api/src/lib/config.ts` — `RESEND_API_KEY`, `EMAIL_FROM` |
| [modify] | `apps/api/src/modules/auth/routes.ts` |
| [modify] | `apps/api/src/modules/auth/schemas.ts` |
| [modify] | `apps/api/src/workers/email.ts` |
| [modify] | `apps/api/.env.example` |

## Validation

- ✅ `pnpm --filter api check-types` — passes
- ✅ `pnpm --filter shared check-types` — passes
- ✅ `pnpm --filter db check-types` — passes
- ✅ `pnpm --filter api lint` — passes (pre-existing warnings only)
- ✅ `pnpm --filter api test` — 312/312 tests pass (23 files)
