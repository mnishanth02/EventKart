---
title: EventKart V1 — Architecture & Tech Stack
version: 1.3
date_created: 2026-04-19
last_updated: 2026-04-20
derived_from: docs/requirements.md (v1.1), docs/product-plan.md (v2.1)
owner: Engineering / Founding Team
---

# EventKart V1 — Architecture & Tech Stack

This document defines the system architecture, tech stack, and infrastructure decisions for EventKart V1. It is informed by the product plan and requirements document, and designed to support the stated scale target of **20,000 concurrent registrations per event**.

---

## 1. Load Profile and Scaling Targets

### Peak scenario: Popular event registration opens

| Metric                            | Estimate               | Constraint                                                                                                 |
| --------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| Concurrent users on event page    | ~20,000                | CDN/SSR handles read load                                                                                  |
| Registration form submissions/sec | 500–1,000/sec          | Backend burst capacity                                                                                     |
| Payment initiations/sec           | 200–500/sec            | Razorpay Route rate limit (~500 TPS — **unverified; confirm with Razorpay enterprise team before launch**) |
| OTP sends/sec                     | 200–500/sec            | OTP provider rate limit                                                                                    |
| QR check-ins (event day)          | 5–10/sec per organizer | Not a scaling concern                                                                                      |
| Browsing (non-peak)               | 100–500 concurrent     | Served mostly from cache/CDN                                                                               |

### Key insight

The real throughput bottleneck is external: payment gateway and OTP provider rate limits. The backend must handle burst traffic gracefully (queue + back-pressure), but it does not need to process 20K payment transactions per second.

> **⚠️ Validation requirement:** Before any high-profile event launch, run burst tests covering page load, OTP send/verify, booking submit, order creation, webhook ACK, Redis saturation, and DB pool exhaustion. Model p50/p95/p99 arrival curves. The 20K-concurrent target is accepted only after load tests validate sustained behavior under 5-, 15-, and 30-minute burst windows.

### Scaling strategy

1. **Read path (event pages, discovery):** SSR with caching + CDN. Event pages are mostly static per-event. Caching is achieved via `Cache-Control` headers with `s-maxage` + `stale-while-revalidate`, served through Cloudflare CDN (TanStack Start does not provide built-in ISR — this is CDN-level caching). This absorbs 90%+ of concurrent load. **Cache invalidation:** Event publish/unpublish, pricing changes, seat-count changes, and admin moderation must purge or revalidate affected CDN cache keys. Use single-flight/Redis locking to prevent cache stampede on popular events.
2. **Write path (registration + payment):** Horizontally scaled stateless backend instances. Registration submissions enter a Redis-backed queue, draining at the payment gateway's rate limit. **Backpressure policy:** When Redis queue depth, job age, DB pool wait, or provider error rate crosses thresholds, the booking API returns a controlled "registration busy, retry shortly" response or enters a waiting-room mode.
3. **Database:** PostgreSQL with connection pooling. Read replicas for listing/browsing queries if needed. Write path (bookings, payments) hits primary.
4. **Session state:** Redis. Backend instances remain stateless.

---

## 2. Architecture: Modular Monolith

### Why not microservices

| Factor                               | Microservices                                               | Modular Monolith                                |
| ------------------------------------ | ----------------------------------------------------------- | ----------------------------------------------- |
| Team size (small founding team)      | High overhead                                               | Right-sized                                     |
| Speed to V1                          | Slow (infra complexity)                                     | Fast                                            |
| 20K concurrent                       | Achievable                                                  | Achievable with horizontal scaling              |
| Operational cost                     | High (orchestration, networking, observability per service) | Low                                             |
| Data consistency (payment + booking) | Distributed transactions                                    | Single DB transaction                           |
| Future extraction                    | N/A                                                         | Extract when a module needs independent scaling |

### Module boundaries

The application is a single deployable unit with clear internal module boundaries. Each module owns its domain logic, routes, database tables, and validation schemas. Modules communicate through explicit internal interfaces — not by reaching into each other's database tables.

```
┌────────────────────────────────────────────────────────────────┐
│                         Frontend (SSR)                          │
│               TanStack Start (@tanstack/react-start)             │
│        React 19 · Vite · TanStack Router · TanStack Query        │
└──────────────────────────────┬─────────────────────────────────┘
                               │ Server functions + API routes
┌──────────────────────────────▼─────────────────────────────────┐
│                      Backend (Fastify)                          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐    │
│  │    Auth &     │  │   Event &    │  │    Booking &      │    │
│  │   Identity    │  │  Discovery   │  │    Payment        │    │
│  │              │  │              │  │                   │    │
│  │ • OTP send/  │  │ • Event CRUD │  │ • Registration    │    │
│  │   verify     │  │ • Categories │  │ • Razorpay Route  │    │
│  │ • Sessions   │  │ • Pricing    │  │ • Split payout    │    │
│  │ • RBAC       │  │ • Publishing │  │ • QR generation   │    │
│  │ • Deferred   │  │ • Search &   │  │ • Booking state   │    │
│  │   auth       │  │   listing    │  │ • Payment retry   │    │
│  └──────────────┘  └──────────────┘  └───────────────────┘    │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐    │
│  │  Organizer   │  │   Check-in   │  │   Communications  │    │
│  │   Module     │  │   Module     │  │   Module          │    │
│  │              │  │              │  │                   │    │
│  │ • Signup &   │  │ • QR scan    │  │ • Email templates │    │
│  │   verify     │  │ • Manual     │  │ • Booking confirm │    │
│  │ • Dashboard  │  │   search     │  │ • Reminders       │    │
│  │ • Profile    │  │ • Offline    │  │ • Post-event      │    │
│  │ • Roster     │  │   roster     │  │ • Retention       │    │
│  │   export     │  │              │  │   nudges          │    │
│  └──────────────┘  └──────────────┘  └───────────────────┘    │
│                                                                 │
│  ┌──────────────┐  ┌────────────────────────────────────┐     │
│  │    Admin      │  │          Shared Kernel              │     │
│  │   Module      │  │                                    │     │
│  │              │  │ • DB connection + migrations        │     │
│  │ • Org review │  │ • Redis client                      │     │
│  │ • Event      │  │ • Auth middleware                   │     │
│  │   review     │  │ • Error handling                    │     │
│  │ • Disputes   │  │ • Validation (Zod schemas)         │     │
│  │ • Payouts    │  │ • Logging & audit                  │     │
│  │ • Audit log  │  │ • Rate limiting                    │     │
│  └──────────────┘  └────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────┘
        │              │              │
   ┌────▼────┐    ┌───▼────┐    ┌───▼────────┐
   │PostgreSQL│    │ Redis  │    │  Object    │
   │          │    │        │    │  Storage   │
   │ Primary  │    │ Cache  │    │  (S3/R2)   │
   │ + pooler │    │ Queue  │    │            │
   │          │    │ Session│    │ KYC docs   │
   │          │    │ Rate   │    │ Event imgs │
   │          │    │ limit  │    │ Roster PDFs│
   └──────────┘    └────────┘    └────────────┘

External Services:
├── Razorpay Route — payments + split settlement
├── MSG91 — OTP delivery
└── Resend / SES — transactional email
```

### Module extraction criteria

A module should be extracted into its own service only when:

- It needs to scale independently (e.g., check-in service during event day)
- It has a fundamentally different deployment cadence
- A team is dedicated to it

For V1, extraction is not expected. The boundaries exist in code to make future extraction straightforward.

### Routing & service communication

The frontend (TanStack Start) and backend (Fastify) are separate deployable services that use a **hybrid communication pattern**:

| Route type          | Examples                                  | Rendering                              | API communication                                                                                                          |
| ------------------- | ----------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Public SSR pages    | `/`, `/events/:slug`, `/organizers/:slug` | Server-side rendered by TanStack Start | TanStack Start server functions call Fastify **server-to-server** over Railway's internal network (no public internet hop) |
| Client-rendered app | `/book/*`, `/my/*`, `/org/*`, `/admin/*`  | Client-side React                      | Browser calls Fastify API **directly** over public endpoint                                                                |

**Why hybrid:**

- SSR pages get server-to-server latency (~1–5ms internal) instead of public round-trip latency, which matters for SEO-critical pages
- Client-rendered pages avoid an unnecessary proxy hop through the frontend server, reducing latency for interactive flows like registration and dashboards
- Auth is handled consistently via a shared session cookie on the parent domain

**Auth across services:**

- Both services share a parent domain: `eventkart.app` (frontend) and `api.eventkart.app` (backend)
- Fastify issues an `HttpOnly`, `Secure`, `SameSite=Lax` session cookie scoped to `.eventkart.app`
- For SSR routes, TanStack Start reads the session cookie from the incoming request and forwards it in server-to-server calls to Fastify
- For client-rendered routes, the browser sends the cookie directly to `api.eventkart.app`
- `SameSite=Lax` is used instead of `Strict` to allow the cookie to be sent on top-level navigations from external links (e.g., shared event page URLs)

**CORS configuration:**

- Fastify enables CORS for the frontend origin (`https://eventkart.app`) with `credentials: true`
- Server-to-server calls from TanStack Start bypass CORS (internal network, not browser-initiated)

**Rate limiting scope:**

- Browser-direct calls to Fastify: standard per-IP rate limits apply
- Server-to-server calls from TanStack Start: identified by internal network origin or a shared request-signing secret, allowed higher rate limits since they are already one-per-user-request

---

## 3. Tech Stack

### 3.1 Frontend

| Component              | Choice                                    | Rationale                                                                                                                                                                                                                                                                             |
| ---------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | TanStack Start (`@tanstack/react-start`)  | SSR for SEO (event pages, OG tags), server functions, type-safe routing, deep TanStack ecosystem integration. **Note:** TanStack Start is currently RC (v1.154+, not GA). API is stable and production-ready; pin exact version and include upgrade validation in release checklists. |
| **UI library**         | React                                     | Mature ecosystem, largest hiring pool in India                                                                                                                                                                                                                                        |
| **Routing**            | TanStack Router                           | Type-safe, file-based routing built into TanStack Start                                                                                                                                                                                                                               |
| **Server state**       | TanStack Query                            | Caching, background refetching, optimistic updates                                                                                                                                                                                                                                    |
| **Styling**            | Tailwind CSS v4                           | Utility-first, mobile-first, fast iteration. CSS-first config (no `tailwind.config.js`).                                                                                                                                                                                              |
| **Component library**  | shadcn/ui (v4, requires Tailwind v4)      | Accessible, copy-paste components, full code ownership                                                                                                                                                                                                                                |
| **Form handling**      | TanStack Form (v1) + Zod                  | Type-safe, headless, granular reactivity. v1 is now GA with first-class TypeScript inference. Validation shared with backend via Zod schemas.                                                                                                                                         |
| **Tables & datagrids** | TanStack Table (v8)                       | Headless, framework-agnostic table engine. Sorting, filtering, pagination, grouping, row selection, column resizing. 27K+ stars, 179K+ dependents. Used by shadcn/ui's DataTable.                                                                                                     |
| **Virtualization**     | TanStack Virtual (v3)                     | Headless virtualization for large lists/grids. 60FPS performance for participant rosters (20K+ rows). Composes with TanStack Table for virtualized tables.                                                                                                                            |
| **Build**              | Vite (via `@tanstack/react-start` plugin) | Fast HMR, optimized builds. Vinxi was removed from TanStack Start in v1.121.0 (June 2025); Vite is now the sole build tool. Config via `vite.config.ts`.                                                                                                                              |

#### Frontend route structure

```
/                         → Public event discovery (SSR, cached)
/events/:slug             → Event detail page (SSR with CDN `s-maxage` + `stale-while-revalidate` — SEO critical)
/organizers/:slug         → Organizer public profile (SSR)
/book/:eventId            → Registration + payment flow (CSR with `ssr: 'data-only'`, auth-gated at submit)
/my/*                     → Participant profile, booking history (CSR, auth required)
/org/*                    → Organizer dashboard (CSR, auth required)
/admin/*                  → EventKart ops panel (CSR, auth required)
```

SSR pages (/, /events/_, /organizers/_) are the public-facing, SEO-critical surfaces. Dashboard and booking flows are client-rendered.

### 3.2 Backend

| Component         | Choice                      | Rationale                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Runtime**       | Node.js (v22 LTS+)          | Same language as frontend, shared Zod schemas, smaller team surface. Note: Node.js v20 reached EOL April 2026.                                                                                                                                                                                                                                                                                                    |
| **Framework**     | Fastify v5                  | 2–3x faster than Express, built-in validation (Ajv), plugin system, TypeScript-first. Note: Fastify v4 reached EOL June 2025.                                                                                                                                                                                                                                                                                     |
| **Language**      | TypeScript                  | Type safety, shared types with frontend                                                                                                                                                                                                                                                                                                                                                                           |
| **ORM**           | Drizzle ORM                 | Lightweight, SQL-like syntax, excellent TypeScript types, fast, minimal abstraction. **Note:** Pre-1.0 (v0.45.x); pin exact version.                                                                                                                                                                                                                                                                              |
| **Validation**    | Zod v4                      | Shared schemas between frontend and backend. v4 offers 6–14x performance gains over v3. Consider `zod-mini` for frontend bundle optimization.                                                                                                                                                                                                                                                                     |
| **Auth**          | Custom (OTP + session)      | Simple enough for custom implementation; no need for Auth0/Clerk overhead                                                                                                                                                                                                                                                                                                                                         |
| **Queue**         | BullMQ (Redis-backed)       | Job queue for payment processing, email sending, async tasks. Use **separate queues**: `payment-webhook`, `email`, `cleanup`, `exports`. Configure per-queue concurrency, rate limits, and retry budgets. BullMQ has no native DLQ — implement custom failed-jobs queue with alerting and replay tooling. Use `upsertJobScheduler` API for cron/repeatable jobs. Native OpenTelemetry support available (v5.71+). |
| **Rate limiting** | @fastify/rate-limit + Redis | Per-route and per-event rate limiting                                                                                                                                                                                                                                                                                                                                                                             |

#### API structure

All API routes are prefixed with `/api/v1/` to future-proof the API for post-V1 evolution.

```
POST /api/v1/auth/otp/send        → Send OTP
POST /api/v1/auth/otp/verify      → Verify OTP, issue session
POST /api/v1/auth/logout           → Clear session

GET  /api/v1/events                → List events (public)
GET  /api/v1/events/:id            → Event detail (public)
POST /api/v1/events                → Create event (organizer)
PUT  /api/v1/events/:id            → Update event (organizer)

POST /api/v1/bookings              → Submit registration + initiate payment
POST /api/v1/bookings/payment/callback → Razorpay webhook
GET  /api/v1/bookings/:id          → Booking detail

GET  /api/v1/org/events            → Organizer's events
GET  /api/v1/org/events/:id/participants → Participant list
POST /api/v1/org/checkin/:bookingId → Check in participant

GET  /api/v1/admin/verifications   → Pending organizer verifications
POST /api/v1/admin/verifications/:id/approve
POST /api/v1/admin/verifications/:id/reject
GET  /api/v1/admin/event-reviews   → Events pending review
```

### 3.3 Database

| Component              | Choice                               | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Database**           | PostgreSQL 17                        | ACID transactions, JSONB for flexible form fields, mature, battle-tested. v17 adds JSON_TABLE and improved vacuum performance.                                                                                                                                                                                                                                                                                                                |
| **Migrations**         | Drizzle Kit                          | Integrated with Drizzle ORM, generates SQL migrations. Use **expand/contract migration strategy**: backward-compatible schema changes first, deploy app code second, cleanup migrations later. Every migration must include rollback SQL and lock-risk assessment.                                                                                                                                                                            |
| **Connection pooling** | PgBouncer (transaction pooling mode) | Handles connection burst from scaled backend instances. **Critical:** When using Drizzle ORM through PgBouncer, set `prepare: false` in the PostgreSQL driver options to avoid prepared-statement failures. Use a separate direct connection for migrations. Define pool budgets: max app instances × per-instance connections must stay below PgBouncer and Postgres limits, with reserved headroom for workers, admin jobs, and migrations. |

#### Key schema design decisions

- **Registration form fields:** JSONB column on event table for organizer-configured form fields. Each event stores a `form_schema_version` alongside the JSONB field config. Booking table stores submitted values as JSONB along with a snapshot of the form schema at submission time. This ensures historical bookings remain interpretable even after the organizer changes form fields on future events. **Indexing strategy:** Add GIN index on form-definition JSONB only if queried structurally. Use generated columns or normalized side tables for searchable participant attributes. Add composite indexes `(event_id, status, created_at)` and `(event_id, payment_status, created_at)`. Use partial indexes for active/pending bookings. Analytics/export queries should read from denormalized reporting tables or materialized views, not hot OLTP JSONB scans.
- **Early-bird pricing:** Event pricing stored as an array of pricing tiers in the event table: `{ category, base_price, early_bird_price, early_bird_deadline }`. Backend validates the applicable price at booking time by checking `early_bird_deadline` against the current timestamp. No client-side price trust — price is always validated server-side.
- **Organizer verification docs:** Stored in object storage (S3/R2). Database holds metadata + access log only.
- **Sensitive participant data:** Separate table with scoped access patterns and audit logging.
- **Payment records:** Immutable insert-only table. Status changes create new records or use a status enum with timestamp.
- **Webhook idempotency:** `razorpay_payment_id` column on bookings table with a unique constraint. Additionally, maintain a **webhook-events table** keyed by provider event ID, storing signature verification result, received timestamp, payload hash, processing status, and last error. Process webhooks through a booking state machine with row-level locking to handle duplicate, delayed, and out-of-order delivery safely.
- **Capacity reservation:** For limited-capacity events, use atomic `UPDATE events SET spots_remaining = spots_remaining - 1 WHERE id = :id AND spots_remaining > 0` with a 15-minute reservation expiry. Expired reservations are reclaimed by a BullMQ repeatable job. This prevents overselling during burst registration.

### 3.4 Cache, Queue & Session

| Component | Choice                  | Rationale                                                                                                                                                                                                                                                  |
| --------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Redis** | Redis (Railway managed) | Session store, BullMQ job queue, rate limiting, caching. **Configuration:** Use `volatile-lru` eviction policy. Isolate namespaces with key prefixes: `sess:`, `bull:`, `rl:`, `cache:`, `otp:` — ensures cache eviction never touches sessions or queues. |

#### Redis usage breakdown

| Use case           | Pattern                                            |
| ------------------ | -------------------------------------------------- |
| Sessions           | Key-value with TTL                                 |
| Registration queue | BullMQ queue — smooths payment burst               |
| Rate limiting      | Sliding window counters per event + per IP         |
| Event page cache   | Key-value with short TTL (60s) for listing queries |
| OTP storage        | Key-value with 5-min TTL                           |

### 3.5 External Services

| Service            | Provider                     | Why                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------ | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Payments**       | Razorpay Route               | Locked in product plan. Best India UPI + card support. Split payout built-in. **⚠️ RBI PA-PG Compliance:** The 2025 Master Direction requires Payment Aggregator authorization. EventKart's marketplace split-payout model must be validated against these regulations before launch — this is a legal prerequisite. Confirm actual TPS limits with Razorpay enterprise team. |
| **OTP**            | MSG91                        | India-first, reliable, good pricing, DLT-compliant. **Fallback:** Enable WhatsApp OTP delivery as fallback for SMS delivery failures.                                                                                                                                                                                                                                         |
| **Email**          | Resend (burst: SES fallback) | Modern API, great DX, React Email for templates. **⚠️ Rate limit:** Resend default is only 2 req/s — use batch API (up to 100 emails/request) for burst booking confirmations, or add Amazon SES as high-throughput fallback. **Deployment prerequisite:** Configure SPF, DKIM, and DMARC records for sending domain before launch.                                           |
| **Object storage** | Cloudflare R2 or AWS S3      | KYC documents, event images (hero, route map), roster PDFs. R2 has no egress fees. **KYC documents must use server-side encryption at rest.** Access logging enabled for audit compliance.                                                                                                                                                                                    |

---

## 4. Infrastructure

### 4.1 Hosting: Railway

| Component                     | Railway Service    | Notes                                                  |
| ----------------------------- | ------------------ | ------------------------------------------------------ |
| **Frontend (TanStack Start)** | Web service        | SSR server, auto-scaled                                |
| **Backend (Fastify)**         | Web service        | API server, auto-scaled                                |
| **PostgreSQL**                | Railway PostgreSQL | Managed, automated backups, connection pooler included |
| **Redis**                     | Railway Redis      | Managed                                                |
| **Worker (BullMQ)**           | Worker service     | Processes async jobs (emails, payment callbacks)       |

#### Why Railway over AWS for V1

| Factor           | Railway                         | AWS                                                     |
| ---------------- | ------------------------------- | ------------------------------------------------------- |
| Deployment speed | `git push` → deployed           | ECS task definitions, ALB config, IAM roles             |
| Ops burden       | Near-zero                       | Significant (even with Fargate)                         |
| Cost at V1 scale | ~$50–150/month (pilot baseline) | ~$200–500/month (comparable compute + managed services) |

**Cost note:** `$50–150/month` is plausible for a low-traffic pilot only, **not for validated 20K-concurrent burst readiness**. Production-like load testing requires multiple web/API instances, dedicated worker(s), managed Postgres with sufficient CPU/IOPS, Redis with headroom, CDN, Sentry, SMS, and email costs. Maintain two cost models: "pilot baseline" and "peak-event ready" with explicit assumptions.
| India region | US regions (acceptable for V1) | Mumbai region (lower latency) |
| Migration path | Dockerized → deploy anywhere | N/A |

**Latency note:** Railway doesn't have an India region yet. For V1 pilot in Coimbatore, US-West latency (~200–300ms) is acceptable for API calls but **compounds in multi-hop flows** (e.g., UPI payment: client → Railway → Razorpay → Railway → client can exceed 1.5s on 3G). Event pages are SSR-cached and can be fronted by Cloudflare CDN for sub-50ms reads. If latency becomes a measurable conversion issue, migrate the backend to AWS Mumbai or Render (Singapore region) — the app is Dockerized, so migration is straightforward.

**Alternative: Render** offers a Singapore region which would give ~50–80ms latency to India. This is worth evaluating if Railway's latency proves problematic during early testing.

### 4.2 CDN & Edge

| Component  | Choice                 | Notes                                                         |
| ---------- | ---------------------- | ------------------------------------------------------------- |
| **CDN**    | Cloudflare (free tier) | Cache SSR event pages at edge, static assets, DDoS protection |
| **Domain** | Cloudflare DNS         | Fast propagation, free SSL                                    |

### 4.3 Monitoring & Observability

| Component          | Choice                                     | Notes                                                                                                                                                     |
| ------------------ | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Error tracking** | Sentry                                     | Frontend + backend error tracking, source maps. **Setup:** Separate Sentry projects (or separate init files) for client-side, SSR server, and API server. |
| **Logging**        | Pino (Fastify default) + Railway log drain | Structured JSON logs with request correlation IDs. Consider Pino + OpenTelemetry bridge for log↔trace correlation.                                        |
| **Uptime**         | Better Uptime or Railway built-in          | Alerts on downtime                                                                                                                                        |
| **APM**            | Minimum V1 metrics (see below)             | BullMQ v5.71+ provides native OpenTelemetry; wire it up for near-free distributed tracing.                                                                |

#### Minimum production metrics for V1

Track these from day one — not deferred to post-V1:

- Booking submit RPS / p95 / p99 latency
- Payment order creation latency and error rate
- Webhook ACK latency (must stay safely under Razorpay's 5s timeout)
- Webhook processing lag (time from ACK to completion)
- Queue depth, oldest job age, retry count, DLQ count per queue
- DB pool wait time, transaction time, deadlocks, slow queries (>100ms)
- Redis memory usage, eviction count, command latency
- CDN hit ratio and origin error rate
- OTP success/failure/rate-limit metrics
- Email provider throttle/failure metrics
- Conversion funnel: page view → OTP sent → OTP verified → booking created → payment confirmed

### 4.4 Health checks

| Service            | Endpoint      | Checks                                   |
| ------------------ | ------------- | ---------------------------------------- |
| **Fastify API**    | `GET /health` | PostgreSQL connection + Redis ping       |
| **TanStack Start** | `GET /health` | SSR rendering + Fastify API reachability |

Railway uses these endpoints for auto-scaling decisions and automatic restarts on failure.

### 4.5 Request correlation

- Fastify plugin generates a `X-Request-ID` header (UUID v4) on every incoming request
- TanStack Start server functions generate a correlation ID for SSR requests and forward it in the `X-Request-ID` header when calling Fastify server-to-server
- Pino logger includes `requestId` in every structured log line
- Enables end-to-end request tracing across the frontend SSR server and backend API

---

## 5. Deployment & CI/CD

### Pipeline

```
GitHub Push → GitHub Actions → Build & Test → Migrate DB → Deploy to Railway
                                    │
                            ┌───────┴───────┐
                            │               │
                        Staging         Production
                     (auto-deploy)    (manual promote)
```

**Database migration step:**

- Runs after build and test, before the app service restarts
- Command: `pnpm --filter @eventkart/db drizzle-kit migrate`
- **Strategy:** Adopt **expand/contract migration pattern** — backward-compatible schema changes first, deploy app code second, cleanup migrations later. Every migration must include: compatibility notes, rollback SQL, data backfill plan, lock-risk assessment, and execution-time estimate.
- **Staging:** Auto-migration on deploy from `main`
- **Production:** Migration runs as a separate Railway job before the app service restarts. Failed migrations block deployment. Production deploys must support rolling or blue/green release with health-checked promotion.
- **Rollback:** Drizzle Kit generates SQL migrations. Each migration includes manually-written rollback SQL. App rollback should be possible without immediate DB rollback (expand/contract ensures this).

### Environments

| Environment    | Purpose             | Deployment                                                  |
| -------------- | ------------------- | ----------------------------------------------------------- |
| **Local**      | Development         | Docker Compose (Postgres + Redis + app)                     |
| **Staging**    | QA, organizer demos | Auto-deploy from `main` branch                              |
| **Production** | Live pilot          | Manual promote from staging or deploy from `release/*` tags |

### Repository structure: Monorepo

```
eventkart/
├── apps/
│   ├── web/                  # TanStack Start frontend
│   │   └── src/
│   │       ├── routes/       # File-based TanStack Router routes
│   │       │   ├── __root.tsx
│   │       │   ├── _public/  # Public layout group (SSR)
│   │       │   └── _authed/  # Auth-required layout group (CSR)
│   │       ├── features/     # Domain feature modules (events, booking, check-in, etc.)
│   │       │   └── events/   # Example: api.ts, queries.ts, components/, hooks.ts, types.ts
│   │       ├── components/   # Shared UI components (shadcn/ui based)
│   │       └── lib/          # Utilities, auth helpers, API client
│   └── api/                  # Fastify backend
├── packages/
│   ├── shared/               # Shared Zod schemas, types, constants
│   ├── db/                   # Drizzle schema, migrations, seed
│   └── ui/                   # Shared UI components (shadcn/ui based)
├── docker-compose.yml        # Local dev: Postgres + Redis
├── pnpm-workspace.yaml       # pnpm workspace config
├── turbo.json                # Turborepo v2 config (uses `tasks` key, not `pipeline`)
├── package.json              # Workspace root
├── .env.example              # Placeholder keys (secrets never committed)
└── docs/
```

**Frontend module organization:** The `apps/web/src/features/` directory uses a **feature-first** pattern (not layer-first). Each feature module (e.g., `events/`, `registration/`, `check-in/`) collocates its server functions (`api.ts`), TanStack Query options (`queries.ts`), components, hooks, and types. This pattern is established by high-quality TanStack reference projects (BearStudio/start-ui-web, mugnavo/tanstarter) and keeps domain logic cohesive while enabling easy extraction.

**Package manager:** pnpm — fast installs, strict dependency resolution, excellent monorepo support via workspaces. Use the `catalog:` protocol for centralized dependency versioning across packages.

**Monorepo tool:** Turborepo v2 — handles build caching, dependency graph, parallel builds across `apps/` and `packages/`. Enable remote caching for 60–80% CI speedup.

---

## 6. Security Considerations

### Authentication

- **Participant:** Phone OTP → session cookie (HttpOnly, Secure, SameSite=Lax, Domain=.eventkart.app). Session stored in Redis with 30-day TTL.
- **Organizer:** Phone OTP + email verification → session cookie. Elevated role assigned after admin verification.
- **Admin:** Phone OTP + IP allowlist during pilot.
- **Cookie domain:** Scoped to `.eventkart.app` so the session cookie is shared between the frontend (`eventkart.app`) and backend (`api.eventkart.app`). `SameSite=Lax` allows the cookie to be sent on top-level navigations from external links.

### Data protection

- **KYC documents:** Stored in object storage with presigned URLs. No public access. Access logged in audit table.
- **Sensitive participant fields:** Separate DB table. Organizer queries filtered server-side to only return their own event participants. Blood group / medical fields suppressed from QR check-in display.
- **Payment data:** Only transaction IDs stored. Full card/UPI details never touch our servers (Razorpay handles PCI).

### API security

- CSRF protection via SameSite cookies + anti-CSRF token on state-changing requests
- Rate limiting per-route and per-IP (stricter on OTP and payment endpoints)
- Input validation via Zod schemas on every endpoint
- SQL injection prevention via Drizzle ORM (parameterized queries)
- XSS prevention via React's default escaping + CSP headers
- Razorpay webhook signature verification via `X-Razorpay-Signature` header (HMAC SHA256). **Webhook handlers must respond within 5 seconds** — ACK immediately, enqueue processing via BullMQ.
- Webhook idempotency via webhook-events table (keyed by provider event ID) + unique constraint on `razorpay_payment_id` in bookings table. Process through booking state machine with row-level locking.
- Failed webhook processing retried 3 times via BullMQ, then routed to custom dead letter queue (BullMQ does not provide native DLQ — implement via `failed` event handler) with admin alert
- **Payment reconciliation job:** BullMQ repeatable job polls Razorpay API periodically to catch payments where webhooks were lost (e.g., during Railway outages). Confirmed payments stuck as "pending" are reconciled automatically.

### Consent & compliance

Driven by requirements §4.4 and the product plan's DPDPA-aware posture.

- **Consent records table** in PostgreSQL: `participant_id`, `consent_type` (booking_terms, data_usage, marketing), `consent_version`, `accepted_at`, `ip_address`
- **Consent versioning:** Each consent text version gets a version string. Booking records reference the consent version accepted at the time of booking.
- **Server-side enforcement:** The booking API requires consent fields to be explicitly set to `true`. No pre-checked boxes — validated server-side, not just in the UI.
- **Purpose limitation:** Consent record captures the specific purpose (e.g., "event registration data processing") aligned with DPDPA requirements.
- **Consent withdrawal:** API endpoint for participants to withdraw consent. Withdrawal triggers anonymization of non-financial data per retention rules.
- **DSAR handling:** Support Data Subject Access Requests — export all participant data in machine-readable format via `GET /api/v1/my/data-export`.
- **Marketing consent:** Separate optional consent for marketing communications, not bundled with booking terms.
- **⚠️ Legal review required:** This section covers the technical implementation. A legal review is required before launch to validate DPDPA compliance, including: parental/guardian consent for minors, grievance officer designation, processor/sub-processor register, and cross-border transfer disclosure.

### Audit logging

Driven by requirements F-7.3.4 and §4.2.

- **Audit log table** in PostgreSQL (not Redis — needs persistence, queryability, and long retention):
  - Columns: `id`, `actor_id`, `actor_role`, `action`, `resource_type`, `resource_id`, `metadata` (JSONB), `ip_address`, `created_at`
- **Logged actions:** KYC document access, sensitive participant data access, admin approve/reject decisions, organizer suspension, data export, data deletion/anonymization, participant roster downloads
- **Retention:** Audit logs retained for 3 years minimum (longer than any data they reference)
- **Admin UI:** The admin panel (F-7.3.4) queries the audit log table with filters by actor, action type, resource, and date range

### Data lifecycle & retention

Driven by requirements §4.3 and product plan §13.

| Data class                                                             | Retention rule                                  | Mechanism                                                                                                     |
| ---------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Participant profile                                                    | Until deletion request or 3 years of inactivity | Soft delete via `deleted_at` column; deletion API marks profile and triggers anonymization of linked bookings |
| Booking & payment records                                              | 5 years (financial/audit)                       | Anonymization replaces participant PII while preserving financial records                                     |
| Sensitive participant fields (blood group, medical, emergency contact) | 30 days post-event                              | BullMQ repeatable cron job scans and deletes sensitive fields on bookings for completed events                |
| Organizer verification docs                                            | 1 year after account closure                    | BullMQ repeatable cron job removes S3/R2 objects and DB metadata                                              |
| Audit logs                                                             | 3 years minimum                                 | No automated deletion; manual review before purge                                                             |
| Consent records                                                        | Retained as long as any related data exists     | Never deleted before the data they authorize                                                                  |

**Implementation:**

- Soft-delete pattern: `deleted_at` timestamp column on participant profiles. Queries exclude soft-deleted records by default.
- Anonymization: Replaces PII fields (`name`, `email`, `phone`) with deterministic hashes or placeholder values. Booking financial data (amount, transaction ID, split details) is preserved.
- Scheduled jobs: BullMQ repeatable jobs running on the worker service handle sensitive field cleanup (daily) and KYC doc cleanup (weekly).
- Participant deletion API: `DELETE /api/v1/my/profile` — marks profile as deleted, enqueues anonymization job for all linked booking records, returns confirmation.

### Secret management

- All secrets (Razorpay keys, MSG91 API key, Resend API key, session secret, HMAC signing secret) stored as Railway environment variables
- `.env.example` in the repo with placeholder keys only — secrets never committed
- Session secret supports an array of valid secrets for rolling rotation (new secret added first, old secret removed after existing sessions expire)
- HMAC signing secret (used for QR code tokens) follows the same rolling rotation pattern

---

## 7. Registration Burst Flow (20K Concurrent)

This is the most critical scaling scenario. Here's the detailed flow:

```
User clicks "Register Now"
        │
        ▼
┌─────────────────────┐
│  Event page (cached) │  ← Served from CDN / SSR cache
│  Load: near-zero     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Registration form   │  ← Client-side React form
│  (client-rendered)   │  ← No backend load until submit
└──────────┬──────────┘
           │ User fills form, clicks Submit
           ▼
┌─────────────────────┐
│  OTP verification    │  ← Rate limited: 1 OTP/phone/60s
│  POST /api/v1/auth/otp│  ← MSG91 handles delivery
└──────────┬──────────┘
           │ OTP verified
           ▼
┌─────────────────────┐
│  Submit registration │  ← POST /api/v1/bookings
│  + initiate payment  │  ← Creates booking record (status: pending)
│                      │  ← Initiates Razorpay order
│                      │  ← Returns Razorpay checkout token
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Razorpay checkout   │  ← Client-side Razorpay SDK
│  (UPI / card)        │  ← Payment processed by Razorpay
│                      │  ← Razorpay rate limits apply here
└──────────┬──────────┘
           │ Payment complete
           ▼
┌─────────────────────┐
│  Razorpay webhook    │  ← POST /api/v1/bookings/payment/callback
│  → BullMQ job        │  ← Verify signature
│                      │  ← Update booking status → confirmed
│                      │  ← Queue: generate QR, send email
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Async workers       │  ← BullMQ processes jobs
│  • Generate QR code  │  ← On-the-fly from HMAC-signed booking token
│    (for email only)  │  ← Client renders QR on-demand, no storage
│  • Send confirm email│
│  • Update split      │
│    payout records     │
└─────────────────────┘
```

### Why this handles 20K concurrent

1. **Event page load** is cached — doesn't hit the backend
2. **Form fill time** (30–120 seconds) naturally staggers submissions
3. **OTP rate limit** (1/phone/60s) prevents duplicate flood
4. **Payment is async** — Razorpay handles the checkout UI and payment processing client-side
5. **Webhook processing** is queued via BullMQ — the backend ACKs the webhook immediately (within 5s timeout) and processes asynchronously. Webhook signature is verified via HMAC SHA256, and idempotency is enforced via webhook-events table + unique `razorpay_payment_id` constraint. A periodic **payment reconciliation job** polls Razorpay to catch any webhooks lost during outages.
6. **Email + QR generation** are fully async and non-blocking. QR codes are generated on-the-fly from an HMAC-signed booking token containing `booking_id`, `event_id`, `ticket_version`, `exp`, `kid`, and a random `jti`. Check-in verifies server-side booking status and enforces atomic single-use/first-scan semantics in the database. Token rotation/reissue is supported by incrementing `ticket_version`.
7. **Capacity reservation** for limited-capacity events uses atomic DB updates (`UPDATE ... WHERE spots_remaining > 0`) with 15-minute reservation expiry, preventing overselling during burst registration.

The backend never needs to process 20K simultaneous transactions. The natural stagger from form fill + OTP + Razorpay checkout spreads the load across minutes, not seconds.

---

## 8. Decision Log

| #    | Decision               | Chosen                                         | Alternatives Considered                  | Rationale                                                                                                                                                                                                                |
| ---- | ---------------------- | ---------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D-1  | Architecture pattern   | Modular monolith                               | Microservices, hybrid                    | Team size, speed to V1, data consistency                                                                                                                                                                                 |
| D-2  | Frontend framework     | TanStack Start (`@tanstack/react-start`)       | Next.js, React + Vite SPA                | SSR for SEO, type-safe routing, avoids Vercel lock-in. **Status:** RC (v1.154+, not GA). Maturity risk accepted — pin exact version, validate on upgrade. Vinxi removed June 2025; Vite is sole build tool.              |
| D-3  | Backend framework      | Fastify v5 (Node.js v22 LTS+)                  | Spring Boot, FastAPI                     | Same language as frontend, fast, TypeScript-first. Fastify v4 EOL June 2025, Node.js v20 EOL April 2026.                                                                                                                 |
| D-4  | ORM                    | Drizzle ORM (v0.45.x)                          | Prisma, raw SQL                          | Lightweight, SQL-like, great TS types. Pre-1.0; pin exact version. **Requires `prepare: false` with PgBouncer.**                                                                                                         |
| D-5  | Database               | PostgreSQL 17                                  | MySQL, MongoDB                           | ACID, JSONB, JSON_TABLE, improved vacuum, industry standard                                                                                                                                                              |
| D-6  | Hosting                | Railway                                        | AWS, GCP, Render, Fly.io                 | Minimal ops, fast deploys, right cost for V1. Latency accepted for dev — evaluate alternatives before production.                                                                                                        |
| D-7  | CDN                    | Cloudflare                                     | CloudFront, Fastly                       | Free tier, global edge, DDoS protection                                                                                                                                                                                  |
| D-8  | Payment gateway        | Razorpay Route                                 | Cashfree Split                           | Locked in product plan, best India support                                                                                                                                                                               |
| D-9  | OTP provider           | MSG91                                          | Twilio, Gupshup                          | India-first, DLT-compliant, good pricing                                                                                                                                                                                 |
| D-10 | Email                  | Resend                                         | SES, SendGrid                            | Modern DX, React Email templates                                                                                                                                                                                         |
| D-11 | Monorepo tool          | Turborepo v2 + pnpm                            | Nx, npm/yarn workspaces                  | Fast, `tasks` config, build caching, remote caching, strict dependency resolution. Use pnpm `catalog:` for centralized versions.                                                                                         |
| D-12 | Routing pattern        | Hybrid (SSR server-to-server + browser-direct) | Full BFF proxy, browser-direct only      | Best performance for SSR pages, simpler than full BFF, consistent auth via shared cookie domain                                                                                                                          |
| D-13 | QR code generation     | On-the-fly HMAC-signed token                   | Store QR images in S3/R2                 | Eliminates storage overhead, QR is deterministic and small, HMAC verification is faster. Token includes `booking_id`, `event_id`, `ticket_version`, `exp`, `kid`, `jti`. Server-side status check enforced at scan time. |
| D-14 | API versioning         | URL prefix `/api/v1/`                          | Header-based, no versioning              | Simple, future-proof, easy to route                                                                                                                                                                                      |
| D-15 | Redis SPOF             | Accepted for V1 dev                            | Redis Sentinel, fallback to DB sessions  | Revisit before production. For dev/pilot, single Redis instance is sufficient.                                                                                                                                           |
| D-16 | Package manager        | pnpm                                           | npm, yarn                                | Fast installs, strict dependency resolution, excellent monorepo support                                                                                                                                                  |
| D-17 | Offline check-in       | Downloadable roster (PDF/CSV) only             | PWA with offline QR scanning             | V1 simplicity. PWA deferred to post-V1 if needed.                                                                                                                                                                        |
| D-18 | Razorpay split config  | Deferred                                       | Implement upfront                        | Integrate Razorpay first. Split payout configuration details addressed during Phase 3 implementation.                                                                                                                    |
| D-19 | Validation library     | Zod v4                                         | Zod v3, ArkType, Valibot                 | 6–14x performance gains over v3. Shared frontend/backend schemas. `zod-mini` for frontend bundle optimization.                                                                                                           |
| D-20 | Styling framework      | Tailwind CSS v4                                | Tailwind v3, CSS Modules                 | CSS-first config, no `tailwind.config.js`. Required by shadcn/ui v4.                                                                                                                                                     |
| D-21 | Capacity management    | Atomic DB reservation + 15-min expiry          | Optimistic booking, Redis-based counters | Prevents overselling with single DB transaction. Simpler than distributed counters.                                                                                                                                      |
| D-22 | Email burst strategy   | Resend (low-vol) + SES fallback (burst)        | Resend only, SES only                    | Resend's 2 req/s default too low for burst. SES handles high-throughput. Resend for DX in templates.                                                                                                                     |
| D-23 | Payment reconciliation | Periodic Razorpay API poll                     | Webhook-only                             | Safety net for lost webhooks during outages. Essential for financial consistency.                                                                                                                                        |
| D-24 | Form library           | TanStack Form (v1)                             | React Hook Form, Formik                  | v1 GA with first-class TypeScript inference, granular reactive updates, headless, Zod integration. Superior DX for type-safe forms.                                                                                      |
| D-25 | Table/datagrid         | TanStack Table (v8)                            | AG Grid (free), MUI DataGrid             | Headless, 27K+ stars, 179K+ dependents. Full control over markup. Composes with TanStack Virtual for 20K+ row participant rosters.                                                                                       |
| D-26 | Virtualization         | TanStack Virtual (v3)                          | react-window, react-virtualized          | Tiny API (single hook), 60FPS, vertical/horizontal/grid support. Essential for organizer dashboards with large participant lists.                                                                                        |

---

## 9. Migration Path (Post-V1)

If the pilot succeeds and scale demands grow beyond Railway's capacity:

1. **Railway → AWS Mumbai**: Dockerized services move to ECS Fargate or EC2. PostgreSQL to RDS. Redis to ElastiCache. Estimated migration: 1–2 weeks.
2. **Monolith → Extract check-in service**: If event-day check-in needs independent scaling or offline support (PWA), extract it. The module boundary already exists.
3. **Monolith → Extract payment service**: If payment processing needs independent scaling or a dedicated security boundary.
4. **Add read replicas**: If listing/browsing queries slow down the primary DB.
5. **Add search**: If event discovery needs full-text search beyond PostgreSQL's built-in capabilities, add Meilisearch or Typesense.

---

## 10. What This Document Does NOT Cover

Deferred to per-module implementation specs:

- Detailed database schema design (table definitions, indexes, constraints)
- API contract definitions (OpenAPI specs)
- UI/UX wireframes
- Testing strategy and quality gates
- Razorpay Route integration specifics (split payout configuration, settlement flow details)
- Email template design
- OTP flow implementation details

Each module will have its own implementation spec when its phase begins per the requirements document.
