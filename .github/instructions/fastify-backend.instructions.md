---
applyTo: "**/apps/api/**/*.{ts,tsx}"
---

# Kiran Backend — Project-Specific Patterns

> For generic Fastify patterns (plugins, schemas, hooks, testing, deployment), see the installed skill: `.agents/skills/fastify-best-practices/`
> This file contains ONLY Kiran-specific decisions, module structure, and domain patterns.

---

## Project Structure (Kiran-Specific)

```
apps/api/src/
├── server.ts               # Production entry point (listen on 0.0.0.0:3000)
├── app.ts                  # Application factory (testable, no listen)
├── plugins/                # Infrastructure (use fastify-plugin to share globally)
│   ├── auth.ts             # Session from Redis, decorates request.session
│   ├── cors.ts             # Origin: https://kiran.app, credentials: true
│   ├── rate-limit.ts       # Redis-backed, per-route overrides
│   ├── error-handler.ts    # AppError → structured JSON
│   ├── request-id.ts       # X-Request-ID (forward from TanStack Start or generate)
│   └── db.ts               # Drizzle client (prepare: false for PgBouncer)
├── modules/                # Domain modules (modular monolith boundaries)
│   ├── auth/               # OTP send/verify, sessions, RBAC
│   ├── events/             # Event CRUD, categories, pricing, publishing
│   ├── bookings/           # Registration, payment, booking state machine
│   ├── organizer/          # Signup, verification, dashboard
│   ├── check-in/           # QR scan, manual search, offline roster
│   ├── communications/     # Email (Resend + SES fallback)
│   └── admin/              # Org review, disputes, payouts, audit
├── workers/                # BullMQ processors (SEPARATE Railway service)
│   ├── index.ts
│   ├── payment-webhook.ts
│   ├── email.ts
│   ├── cleanup.ts          # Sensitive field expiry, KYC doc cleanup
│   └── exports.ts
├── middleware/
│   ├── require-auth.ts
│   ├── require-role.ts
│   └── validate-webhook.ts # Razorpay HMAC verification
└── lib/
    ├── redis.ts            # Namespaces: sess:, bull:, rl:, cache:, otp:
    ├── queue.ts            # Queues: payment-webhook, email, cleanup, exports
    ├── logger.ts           # Pino + OpenTelemetry bridge
    └── errors.ts           # AppError, NotFoundError, ConflictError
```

---

## Kiran Module Convention

Each module follows this structure:
```
modules/<domain>/
├── routes.ts       # Route definitions with schemas + preHandlers
├── service.ts      # Business logic (testable without HTTP)
├── schemas.ts      # Zod request/response schemas (import shared from @event-kart/shared)
└── types.ts        # Module-specific types
```

---

## Authentication — Kiran Session Model

- Cookie: `kiran_session`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Domain=.kiran.app`, 30-day TTL
- Session stored in Redis under `sess:<sessionId>`
- Roles: `participant`, `organizer`, `admin`
- Server-to-server calls from TanStack Start identified by `X-Internal-Key` header → higher rate limits

---

## Rate Limiting — Kiran-Specific Rules

| Endpoint | Limit | Key |
|----------|-------|-----|
| `POST /auth/otp/send` | 1/phone/60s | `req.body.phone` |
| `POST /bookings` | 5/user/minute | `session.userId` |
| Payment webhook | No limit | Signature-verified |
| Internal (from TanStack Start) | 1000/min | `X-Internal-Key` |
| Default API | 100/min | IP |

---

## Payment — Razorpay Patterns (Kiran-Specific)

### Webhook Flow (CRITICAL PATH)
1. Verify `X-Razorpay-Signature` (HMAC SHA256) — reject if invalid
2. Record in `webhook_events` table (idempotency key: provider event ID)
3. Enqueue to `payment-webhook` queue (jobId = event_id for dedup)
4. ACK with `200` immediately (Razorpay enforces 5s timeout)
5. Worker processes: row-lock booking → state machine transition → downstream jobs

### Capacity Reservation
```sql
UPDATE events SET spots_remaining = spots_remaining - 1
WHERE id = :eventId AND spots_remaining > 0
RETURNING spots_remaining
```
- 15-minute reservation expiry via BullMQ repeatable job
- Prevents overselling during burst registration

### Reconciliation
- BullMQ repeatable job every 5 minutes polls Razorpay for payments stuck as "pending"
- Catches webhooks lost during Railway outages

---

## BullMQ — Kiran Queue Configuration

| Queue | Concurrency | Retry | Use Case |
|-------|-------------|-------|----------|
| `payment-webhook` | 10 | 3× exponential | Payment state transitions |
| `email` | 5 | 2× exponential | Booking confirmations, reminders |
| `cleanup` | 2 | 1× | Sensitive data expiry (30d post-event) |
| `exports` | 1 | 2× | Roster PDF/CSV generation |

Workers run as a **separate Railway service** — never in the API process.

Custom DLQ: BullMQ has no native DLQ — implement via `failed` event handler with admin alerting.

---

## Database — Kiran-Specific Drizzle Rules

- `prepare: false` — MANDATORY (PgBouncer transaction mode)
- Separate direct connection for migrations (bypasses PgBouncer)
- Expand/contract migration pattern — backward-compatible changes first
- Key indexes: `(event_id, status, created_at)`, `(event_id, payment_status, created_at)`
- GIN index on JSONB form fields only if queried structurally

---

## Validation — Kiran Convention

- Use `@fastify/type-provider-zod` for schema integration
- Import shared schemas from `@event-kart/shared/schemas`
- Response schemas on ALL routes (security + 2–3x serialization boost)
- Internal fields (`razorpayAccountId`, `internalNotes`) NEVER in response schemas

---

## Health Checks

```
GET /health  → { status: 'ok' }           # Liveness (always passes if process is up)
GET /ready   → DB ping + Redis ping        # Readiness (Railway uses for scaling/restart)
```

---

## CORS — Kiran Configuration

```typescript
origin: ['https://kiran.app']
credentials: true
methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Internal-Key']
```

---

## Request Correlation

- Incoming `X-Request-ID` from TanStack Start → reuse it
- No header → generate UUID v4
- Propagate into Pino logs and BullMQ job metadata

---

## Testing — Kiran Conventions

- Use Vitest (not `node:test`) — consistent with frontend
- Always use `app.inject()` — no port binding needed
- Mock Redis/DB via test containers or in-memory stores
- Test auth: pass `cookies: { kiran_session: testSessionId }` in inject options
- Always call `app.close()` in `afterAll`

---

## Key Constraints

- Fastify v5 only (v4 EOL June 2025)
- Node.js v22 LTS+ (v20 EOL April 2026)
- Drizzle ORM v0.45.x — pin exact version (pre-1.0)
- PgBouncer requires `prepare: false`
- Shared Zod schemas in `packages/shared`
- Workers = separate Railway service
- Railway latency ~200–300ms to India — acceptable for pilot
- Redis namespaces: `sess:`, `bull:`, `rl:`, `cache:`, `otp:`
- API versioning: `/api/v1/` prefix on all routes
- `trustProxy: true` — Railway load balancer
