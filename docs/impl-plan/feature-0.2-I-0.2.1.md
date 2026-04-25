# Feature I-0.2.1: OTP Send (Phone → MSG91) with WhatsApp Fallback

**Module:** 0.2 — Authentication & Identity
**Status:** ✅ Complete
**Dependencies:** I-0.1.1 (shared package) ✅, I-0.1.5 (Redis) ✅
**Affected workspaces:** `packages/shared`, `apps/api`

---

## Requirements

### Functional

- **POST `/api/v1/auth/otp/send`** — Accepts a phone number, generates a 6-digit OTP, stores in Redis (5-min TTL), sends via MSG91 SMS.
- **WhatsApp OTP fallback** — If SMS delivery fails, retry delivery via MSG91 WhatsApp OTP channel.
- **Rate limit** — 1 request per phone per 60 seconds.
- **Phone validation** — Indian mobile numbers (10 digits starting with 6–9), normalized to E.164 (`+91XXXXXXXXXX`).
- **Dev mode bypass** — When `MSG91_AUTH_KEY` is not configured, skip external API call and log OTP to console for local development.

### Security (OWASP)

- OTP generated using `crypto.randomInt()` (cryptographically secure).
- OTP stored in Redis with TTL — auto-expires, no manual cleanup needed.
- Rate limiting prevents brute force on the send endpoint.
- Phone number validated server-side via Zod schema (reuse from `@repo/shared`).
- Error responses never leak whether the phone number exists in the system.
- No sensitive data (OTP value) in API responses — response only confirms OTP was sent.

### Performance

- API p95 < 200ms (excluding MSG91 latency).
- MSG91 API call is fire-and-forget from the user's perspective — the endpoint responds once the OTP is stored, with MSG91 delivery happening in the same request cycle but errors are caught and logged.

---

## Decisions Made (user unavailable)

| Decision         | Choice                       | Rationale                                                              |
| ---------------- | ---------------------------- | ---------------------------------------------------------------------- |
| OTP length       | 6 digits                     | Industry standard, more secure than 4                                  |
| Rate limiting    | `@fastify/rate-limit`        | Standard Fastify plugin, Redis-backed, architecture doc specifies this |
| HTTP client      | Native `fetch()`             | Node 22 built-in, zero new dependencies                                |
| Dev bypass       | Yes                          | Static OTP when MSG91 unconfigured, essential for local dev            |
| MSG91 API        | OTP API (`/api/v2/sendobtp`) | Simpler, purpose-built for OTP flows                                   |
| Max OTP attempts | 5 per phone per OTP          | Stored in Redis alongside OTP, prevents brute-force verify             |

---

## Implementation Steps

### Layer 1: Shared Schemas & Constants (`packages/shared`)

#### Task 1.1: OTP constants [new] — S

**File:** `packages/shared/src/constants/otp.ts`

- `OTP_LENGTH = 6`
- `OTP_TTL_SECONDS = 300` (5 minutes)
- `OTP_MAX_ATTEMPTS = 5`
- `OTP_RATE_LIMIT_WINDOW_SECONDS = 60`
- Export from `constants/index.ts`

#### Task 1.2: OTP schemas [new] — S

**File:** `packages/shared/src/schemas/otp.ts`

- `otpSendRequestSchema` — `{ phone: phoneSchema }` (reuses existing `phoneSchema`)
- `otpSendResponseSchema` — `{ success: true, data: { message: string, expiresInSeconds: number } }`
- `otpSendErrorSchema` — uses existing `errorResponseSchema`
- Export from `schemas/index.ts`

### Layer 2: Backend — Infrastructure (`apps/api`)

#### Task 2.1: MSG91 config vars [modify] — S

**File:** `apps/api/src/lib/config.ts`

- Add `MSG91_AUTH_KEY` (optional string) — when absent, enables dev mode
- Add `MSG91_OTP_TEMPLATE_ID` (optional string) — MSG91 template ID for OTP SMS
- Update `normalizeConfigData` for empty-string handling
- Update `.env.example` with new vars

#### Task 2.2: Error handling [new] — M

**File:** `apps/api/src/lib/errors.ts`

- `AppError` base class extending `Error` (statusCode, code, details)
- `RateLimitError` (429)
- `ValidationError` (400)
- `OtpSendError` (502) — for MSG91 failures
- Fastify error handler plugin to convert `AppError` to JSON response

#### Task 2.3: Rate limiting plugin [new] — M

**File:** `apps/api/src/plugins/rate-limit.ts`

- Install `@fastify/rate-limit`
- Register with Redis store (`fastify.redis.rateLimit`)
- Global default: 100/min per IP
- Per-route override capability via route `config` option
- Register in `app.ts`

#### Task 2.4: MSG91 client [new] — M

**File:** `apps/api/src/lib/msg91.ts`

- `sendOtp(phone, otp, authKey, templateId)` — sends SMS OTP via MSG91 API
- `sendOtpWhatsApp(phone, otp, authKey, templateId)` — sends WhatsApp OTP as fallback
- `sendOtpWithFallback(phone, otp, config)` — tries SMS first, falls back to WhatsApp on failure
- Uses native `fetch()` — no new HTTP dependency
- Returns structured result: `{ success: boolean, channel: 'sms' | 'whatsapp', error?: string }`
- Timeouts: 10s per request

#### Task 2.5: OTP service [new] — M

**File:** `apps/api/src/lib/otp.ts`

- `generateOtp(length)` — uses `crypto.randomInt()` for secure generation
- `storeOtp(redis, phone, otp, ttlSeconds)` — stores `otp:<phone>` in Redis with TTL, stores attempt counter
- `getStoredOtp(redis, phone)` — retrieves OTP + remaining attempts
- `isOtpRateLimited(redis, phone)` — checks if a send was done in the last 60s
- `markOtpSent(redis, phone)` — sets rate-limit key with 60s TTL

### Layer 3: Backend — Module (`apps/api`)

#### Task 3.1: Auth module structure [new] — S

**Files:**

- `apps/api/src/modules/auth/schemas.ts` — route-level Zod schemas
- `apps/api/src/modules/auth/service.ts` — OTP send business logic
- `apps/api/src/modules/auth/routes.ts` — route definitions

#### Task 3.2: Auth service — OTP send [new] — M

**File:** `apps/api/src/modules/auth/service.ts`

- `sendOtp(deps: { redis, config, log }, phone)` — orchestrates:
  1. Check rate limit (1/phone/60s)
  2. Generate 6-digit OTP
  3. Store in Redis with 5-min TTL + max 5 attempts
  4. Send via MSG91 (or log in dev mode)
  5. Mark rate-limit key
  6. Return result

#### Task 3.3: Auth routes — OTP send endpoint [new] — M

**File:** `apps/api/src/modules/auth/routes.ts`

- `POST /api/v1/auth/otp/send`
- Request body: `{ phone: string }` (validated via shared phoneSchema)
- Response 200: `{ success: true, data: { message: "OTP sent", expiresInSeconds: 300 } }`
- Response 429: `{ success: false, error: { code: "OTP_RATE_LIMITED", message: "..." } }`
- Response 400: Zod validation error
- Response 502: MSG91 delivery failure (after both SMS + WhatsApp fail)
- Registered as Fastify plugin under `/api/v1/auth` prefix

#### Task 3.4: Register auth routes in app.ts [modify] — S

**File:** `apps/api/src/app.ts`

- Import and register auth routes plugin
- Ensure it's registered after all infrastructure plugins

### Layer 4: Tests (`apps/api`)

#### Task 4.1: OTP library tests [new] — M

**File:** `apps/api/test/lib/otp.test.ts`

- OTP generation: correct length, numeric, secure random
- Redis storage: store/retrieve/TTL
- Rate limiting: check/mark

#### Task 4.2: MSG91 client tests [new] — M

**File:** `apps/api/test/lib/msg91.test.ts`

- SMS send success/failure
- WhatsApp fallback on SMS failure
- Timeout handling
- Dev mode skip

#### Task 4.3: Auth route tests [new] — L

**File:** `apps/api/test/modules/auth/otp-send.test.ts`

- Happy path: send OTP for valid phone
- Invalid phone: 400 validation error
- Rate limited: 429 on second request within 60s
- Dev mode: OTP logged but not sent externally
- MSG91 failure with WhatsApp fallback success
- Both channels fail: 502 error

---

## API Endpoint Detail

### POST `/api/v1/auth/otp/send`

| Aspect     | Value                                               |
| ---------- | --------------------------------------------------- |
| Method     | POST                                                |
| Path       | `/api/v1/auth/otp/send`                             |
| Auth       | None (public endpoint)                              |
| Rate limit | 1/phone/60s (custom OTP-specific) + global IP limit |

**Request body:**

```json
{ "phone": "9876543210" }
```

**Success response (200):**

```json
{
  "success": true,
  "data": {
    "message": "OTP sent successfully",
    "expiresInSeconds": 300
  }
}
```

**Rate limited (429):**

```json
{
  "success": false,
  "error": {
    "code": "OTP_RATE_LIMITED",
    "message": "Please wait before requesting another OTP",
    "details": { "retryAfterSeconds": 45 }
  }
}
```

**Validation error (400):**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid Indian mobile number"
  }
}
```

**Delivery failure (502):**

```json
{
  "success": false,
  "error": {
    "code": "OTP_DELIVERY_FAILED",
    "message": "Unable to send OTP. Please try again later."
  }
}
```

---

## Redis Key Design

| Key Pattern      | Value                              | TTL  | Purpose                               |
| ---------------- | ---------------------------------- | ---- | ------------------------------------- |
| `otp:<phone>`    | JSON: `{ otp, attempts, channel }` | 300s | OTP storage + verify attempt tracking |
| `otp:rl:<phone>` | `1`                                | 60s  | Rate limit — 1 send per phone per 60s |

Note: The `otp:` prefix is applied by the Redis client's `keyPrefix`, so actual stored keys are just `<phone>` and `rl:<phone>`.

---

## Files Summary

### packages/shared

| File                     | Action                          |
| ------------------------ | ------------------------------- |
| `src/constants/otp.ts`   | [new]                           |
| `src/constants/index.ts` | [modify] — export OTP constants |
| `src/schemas/otp.ts`     | [new]                           |
| `src/schemas/index.ts`   | [modify] — export OTP schemas   |

### apps/api

| File                                 | Action                                       |
| ------------------------------------ | -------------------------------------------- |
| `src/lib/config.ts`                  | [modify] — add MSG91 env vars                |
| `src/lib/errors.ts`                  | [new]                                        |
| `src/lib/msg91.ts`                   | [new]                                        |
| `src/lib/otp.ts`                     | [new]                                        |
| `src/plugins/rate-limit.ts`          | [new]                                        |
| `src/modules/auth/schemas.ts`        | [new]                                        |
| `src/modules/auth/service.ts`        | [new]                                        |
| `src/modules/auth/routes.ts`         | [new]                                        |
| `src/app.ts`                         | [modify] — register rate-limit + auth routes |
| `.env.example`                       | [modify] — add MSG91 vars                    |
| `test/lib/otp.test.ts`               | [new]                                        |
| `test/lib/msg91.test.ts`             | [new]                                        |
| `test/modules/auth/otp-send.test.ts` | [new]                                        |

### New dependency

| Package               | Workspace  | Version |
| --------------------- | ---------- | ------- |
| `@fastify/rate-limit` | `apps/api` | latest  |
