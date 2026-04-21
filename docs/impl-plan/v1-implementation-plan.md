---
title: EventKart V1 — Comprehensive Implementation Plan
version: 2.1
date_created: 2026-04-21
last_updated: 2026-04-21
derived_from:
  - docs/product-plan.md (v2.1)
  - docs/requirements.md (v1.1)
  - docs/architecture.md (v1.3)
  - docs/design-system.md
reviewed_by:
  - Claude Opus 4.7 (v2.0 review)
  - Claude Opus 4.6 (v2.0 review + v2.1 final review)
  - GPT-5.4 (v2.0 review + v2.1 final review)
  - Claude Sonnet 4.6 (v2.0 review)
owner: Engineering / Founding Team
tags: [implementation, roadmap, v1]
---

# EventKart V1 — Comprehensive Implementation Plan

This document translates the product plan, requirements document, and architecture decisions into a sequenced, phase-wise implementation roadmap. It defines **what** to build and **in what order** — not how to implement it.

**Feature ID convention:** This plan uses its own feature IDs (e.g., `I-0.1.1`) that are more granular than the requirements document's feature IDs (e.g., `F-0.1.1`). The requirements document defines 103 features; this plan decomposes them into 143 implementation items (including infrastructure, security, observability, and data lifecycle work not in the requirements). A complete cross-reference table mapping every requirements F-ID to implementation I-IDs is provided in [Appendix A](#appendix-a-requirements-to-implementation-id-mapping).

---

## Current State

The following foundation work is already complete or in progress:

| Component | Status | Notes |
|-----------|--------|-------|
| Monorepo (Turborepo + pnpm) | ✅ Complete | `apps/web`, `apps/api`, `packages/` structure |
| TanStack Start web app | ✅ Complete | Routes, router, components, lib, styles |
| Fastify API baseline | ✅ Complete | `app.ts` factory, `server.ts` entry, plugins, routes, typed config |
| shadcn/ui + Tailwind CSS v4 | ✅ Complete | Design system established, component library configured |
| Biome linting/formatting | ✅ Complete | Workspace-wide standardization |
| TypeScript 6.x | ✅ Complete | Stack-aware tsconfig presets |
| Package script normalization | ✅ Complete | Consistent dev/build/lint/test/check-types |
| Turbo task wiring | ✅ Complete | Correct outputs, env, caching |
| Env handling (web + api) | ✅ Complete | Split public/server env, validated config plugin |
| Deployment topology | 🔄 In progress | Separate web/api deployment plan exists |

**What remains:** All product feature development (Phases 0–7 from requirements doc).

---

## Implementation Principles

1. **Dependency-first sequencing** — Build what downstream features depend on first
2. **Vertical slices where possible** — Deliver end-to-end functionality per module rather than horizontal layers
3. **Shared infrastructure early** — Database, auth, email, and payment foundations before domain features
4. **Parallel tracks after Phase 2** — Multiple teams/tracks can work simultaneously once core is established
5. **Feature flags for incomplete flows** — Ship partial phases behind flags; never break the deployed product
6. **Shared schemas from day one** — `packages/shared` Zod schemas validate on both frontend and backend
7. **Server-side enforcement always** — Security, access control, and data suppression enforced at the API layer, never only at the UI layer

---

## Pre-Launch Gates

These are non-coding prerequisites that must be satisfied before production launch. They can proceed in parallel with development but **block go-live**.

| Gate | Owner | Blocks | Status |
|------|-------|--------|--------|
| **RBI PA-PG compliance validation** — Validate EventKart's split-payout model against the 2025 Master Direction on Payment Aggregators | Legal + Razorpay | Production launch | Not started |
| **DPDPA legal review** — Validate data handling against India's Digital Personal Data Protection Act: parental/guardian consent for minors, grievance officer designation, processor/sub-processor register, cross-border transfer disclosure | Legal | Production launch | Not started |
| **Razorpay Route TPS confirmation** — Confirm actual TPS limits with Razorpay enterprise team | Engineering + Razorpay | Burst load testing | Not started |
| **Email domain setup** — SPF, DKIM, DMARC records for sending domain | Engineering | Transactional email go-live | Not started |
| **Burst load testing** — Validate sustained 20K-concurrent behavior under 5-, 15-, and 30-minute burst windows covering page load, OTP, booking, payment, webhook, Redis, DB pool | Engineering | Production launch | Not started |
| **Incident response runbook** — Regulator/CERT-In notification procedures per product plan §13 | Engineering + Legal | Production launch | Not started |

---

## Phase 0: Foundation — Shared Infrastructure

**Goal:** Establish the database, authentication, shared packages, and app shell that every subsequent phase depends on.

**Why first:** Nothing can be built without a database, auth system, shared validation schemas, and the UI app shell. This is the invisible foundation that every feature sits on.

**Prerequisites:** Workspace foundation (already complete).

### Module 0.1: Shared Packages & Database Foundation

*Covers requirements F-0.1.1 through F-0.1.4*

| ID | Feature | Backend | Frontend | Shared | Notes |
|----|---------|---------|----------|--------|-------|
| I-0.1.1 | `packages/shared` — Shared Zod schemas, types, constants | — | — | ✦ | Schemas imported by both `apps/web` and `apps/api`. Phone number normalization to E.164 format defined here. |
| I-0.1.2 | `packages/db` — Drizzle ORM schema, migrations, seed, client | ✦ | — | — | PostgreSQL 17, `prepare: false` for PgBouncer, Drizzle Kit migrations |
| I-0.1.3 | Core database tables — users, roles, sessions, consent_records, audit_log | ✦ | — | — | Foundation tables referenced by every module. All timestamps stored as UTC with IST display in frontend. |
| I-0.1.4 | Local development infrastructure — Docker Compose for PostgreSQL + Redis | ✦ | — | — | `docker-compose.yml` at repo root |
| I-0.1.5 | Redis client setup — namespaced connections (sess:, bull:, rl:, cache:, otp:) | ✦ | — | — | `apps/api/src/lib/redis.ts`, `volatile-lru` eviction policy |
| I-0.1.6 | BullMQ queue infrastructure — queue definitions, worker service skeleton, DLQ pattern | ✦ | — | — | Queues: payment-webhook, email, cleanup, exports. Custom failed-jobs queue with alerting via `failed` event handler. Replay tooling for DLQ items. |
| I-0.1.7 | Database migration CI pipeline | ✦ | — | — | Expand/contract pattern, rollback SQL, lock-risk assessment |
| I-0.1.8 | Object storage client — S3/R2 presigned URL helper, server-side encryption, access logging | ✦ | — | — | Used by KYC upload (Phase 1), event images (Phase 1), roster PDFs (Phase 5). Access log entries written to audit_log table. |
| I-0.1.9 | CI/CD deployment pipeline — GitHub Actions for build, test, migrate, deploy | ✦ | ✦ | — | Staging auto-deploy from `main`, production manual promote. Rolling/blue-green with health-checked promotion. |

**Deliverables:**
- `packages/shared` with base Zod schemas, types, phone normalization (E.164)
- `packages/db` with Drizzle schema, migration tooling, seed scripts
- PostgreSQL + Redis running locally via Docker Compose
- Core database tables deployed and tested
- BullMQ queue definitions with DLQ pattern ready for consumers
- Object storage client with presigned URLs and access logging
- CI/CD pipeline deploying to staging

### Module 0.2: Authentication & Identity

*Covers requirements F-0.2.1 through F-0.2.4*

| ID | Feature | Backend | Frontend | Shared | Notes |
|----|---------|---------|----------|--------|-------|
| I-0.2.1 | OTP send (phone → MSG91) with WhatsApp OTP fallback | ✦ | — | ✦ | Rate limited: 1/phone/60s. Redis OTP storage with 5-min TTL. WhatsApp OTP delivery as fallback for SMS failures (architecture §3.5 — delivery mechanism, not product channel). |
| I-0.2.2 | OTP verify → session creation | ✦ | — | ✦ | Redis session (sess:), cookie: `eventkart_session`, HttpOnly, Secure, SameSite=Lax, Domain=.eventkart.app, 30-day TTL |
| I-0.2.3 | Session middleware — decorates `request.session` | ✦ | — | — | Fastify plugin, session from Redis |
| I-0.2.4 | Role-based access control (public, participant, organizer, admin) | ✦ | — | ✦ | `requireAuth`, `requireRole('organizer')`, `requireRole('admin')` middleware |
| I-0.2.5 | Organizer email verification | ✦ | ✦ | ✦ | Architecture §6: "Organizer: Phone OTP + email verification." Elevated role assigned after email verification + admin approval. |
| I-0.2.6 | Admin IP allowlist middleware | ✦ | — | — | Architecture §6: "Admin: Phone OTP + IP allowlist during pilot." Configurable allowlist via env var. |
| I-0.2.7 | Deferred authentication pattern — browsing unauthenticated, OTP at booking | ✦ | ✦ | — | Frontend routing respects auth state; booking flow triggers OTP |
| I-0.2.8 | Logout endpoint — clear session | ✦ | — | — | `POST /api/v1/auth/logout` |
| I-0.2.9 | Session forwarding for SSR — TanStack Start forwards cookie in server-to-server calls | — | ✦ | — | `X-Request-ID` propagation, `INTERNAL_API_URL` for SSR |
| I-0.2.10 | Internal API key for server-to-server calls | ✦ | ✦ | — | `X-Internal-Key` header, higher rate limits (1000/min) |
| I-0.2.11 | CSRF protection — anti-CSRF token on state-changing requests | ✦ | ✦ | — | SameSite cookies + CSRF token validation |
| I-0.2.12 | Security headers — CSP, X-Frame-Options, X-Content-Type-Options | ✦ | ✦ | — | Fastify helmet plugin + TanStack Start response headers |

**Deliverables:**
- Working OTP send/verify flow via MSG91 (with WhatsApp fallback)
- Organizer email verification flow
- Admin IP allowlist enforcement
- Redis-backed session management
- RBAC middleware for all three roles
- CSRF protection and security headers
- SSR session forwarding from TanStack Start
- Auth-related Zod schemas in `packages/shared`

### Module 0.3: Design System & App Shell

*Covers requirements F-0.3.1 through F-0.3.4*

| ID | Feature | Backend | Frontend | Shared | Notes |
|----|---------|---------|----------|--------|-------|
| I-0.3.1 | Mobile-first responsive layout shell | — | ✦ | — | `__root.tsx`, `_public` layout (SSR), `_authed` layout (CSR) |
| I-0.3.2 | Core UI component library — buttons, forms, cards, modals, navigation, toasts | — | ✦ | — | shadcn/ui v4 components in `apps/web/src/components` and `packages/ui` |
| I-0.3.3 | Role-based routing and navigation structure | — | ✦ | — | `/` public, `/org/*` organizer, `/admin/*` admin, `/my/*` participant. Depends on I-0.2.4 (RBAC) for auth-gated routes. |
| I-0.3.4 | Error handling patterns — error boundaries, 404, API error display | — | ✦ | — | Consistent error UI across all surfaces |
| I-0.3.5 | Loading state patterns — skeleton screens, spinners, optimistic UI foundations | — | ✦ | — | Consistent loading UX |
| I-0.3.6 | API client setup — hybrid communication (INTERNAL_API_URL for SSR, public for browser) | — | ✦ | — | `apps/web/src/lib/api-client.ts` |

**Deliverables:**
- Fully functional app shell with role-based layouts
- Core shadcn/ui components configured and styled
- API client with hybrid SSR/browser communication
- Error and loading state patterns established

### Module 0.4: Observability, Metrics & Error Infrastructure

*Covers infrastructure requirements from architecture §4.3, §4.4, §4.5*

| ID | Feature | Backend | Frontend | Shared | Notes |
|----|---------|---------|----------|--------|-------|
| I-0.4.1 | Sentry integration — separate projects for client-side, SSR server, API server | ✦ | ✦ | — | Source maps, error tracking |
| I-0.4.2 | Pino structured logging with request correlation IDs + OpenTelemetry bridge | ✦ | — | — | `X-Request-ID` in every log line. Pino + OpenTelemetry bridge for log↔trace correlation. |
| I-0.4.3 | Health check endpoints — Fastify (`GET /health`, `GET /ready`) + TanStack Start (`GET /health`) | ✦ | ✦ | — | Fastify: PostgreSQL + Redis checks. TanStack Start: SSR rendering + Fastify API reachability. |
| I-0.4.4 | Audit log table and logging utility | ✦ | — | — | actor_id, action, resource_type, resource_id, metadata JSONB, ip_address, created_at |
| I-0.4.5 | Production metrics emitter — booking RPS, payment latency, webhook ACK latency, queue depth, DB pool wait, Redis usage | ✦ | — | — | Architecture §4.3: track from day one. Include conversion funnel events (page view → OTP → booking → payment). |
| I-0.4.6 | BullMQ observability — queue depth, oldest job age, retry count, DLQ count per queue | ✦ | — | — | Wire BullMQ v5.71+ native OpenTelemetry support. |

**Deliverables:**
- Sentry error tracking on all three surfaces
- Structured logging with request correlation and OpenTelemetry bridge
- Health/readiness endpoints for Railway auto-scaling (both services)
- Audit log infrastructure ready for all modules
- Production metrics pipeline for day-one observability
- BullMQ queue observability with DLQ alerting

---

## Phase 1: Organizer Onboarding & Event Creation

**Goal:** Enable organizers to sign up, get verified, and create publishable events. This is the supply side — without events, nothing else works.

**Why second:** The entire product depends on having organizers and events in the system. Participants can't book what doesn't exist.

**Prerequisites:** Phase 0 (auth, database, app shell, shared packages).

### Module 1.1: Organizer Signup & Verification

*Covers requirements F-1.1.1 through F-1.1.6*

| ID | Feature | Backend | Frontend | Shared | Notes |
|----|---------|---------|----------|--------|-------|
| I-1.1.1 | Organizer registration form — business name, contact details, city | ✦ | ✦ | ✦ | `POST /api/v1/organizers`, Zod schema in shared |
| I-1.1.2 | Verification document upload — Aadhaar, PAN, GST certificate, bank proof | ✦ | ✦ | — | Upload to S3/R2 via presigned URLs (I-0.1.8), server-side encryption at rest, access logged |
| I-1.1.3 | Policy acceptance workflow — platform terms, refund policy framework | ✦ | ✦ | ✦ | Consent versioning, no pre-checked boxes |
| I-1.1.4 | Verification status tracking — pending → approved/rejected | ✦ | ✦ | ✦ | Target 2-business-day SLA from complete submission |
| I-1.1.5 | Admin verification review interface — approve/reject with notes | ✦ | ✦ | — | `/admin/verifications` route, logged access to KYC docs |
| I-1.1.6 | Verification badge assignment on approval | ✦ | ✦ | — | Paid-event publishing eligibility gated by verification |
| I-1.1.7 | Razorpay Route linked-account creation + KYC sync | ✦ | — | — | On admin approval, create Razorpay Route sub-merchant linked account. Persist `razorpay_account_id` on `organizers` table. Gate event publishing (I-1.2.6) on this. **Required for the locked commercial model (product plan §7).** |
| I-1.1.8 | Organizer profile management — view and edit organizer profile | ✦ | ✦ | ✦ | `/org/profile` route. Business name, description, city. Separate from the public-facing profile (Phase 2). |

**Database tables:** `organizers`, `organizer_verifications`, `verification_documents`, `policy_acceptances`

**Parallel note:** I-1.1.5 (admin review interface) can start alongside Module 0.3 since it's needed early for organizer onboarding.

### Module 1.2: Event Creation & Management

*Covers requirements F-1.2.1 through F-1.2.8*

| ID | Feature | Backend | Frontend | Shared | Notes |
|----|---------|---------|----------|--------|-------|
| I-1.2.1 | Event creation form — V1-allowed events only (single-day, paid running, Coimbatore) | ✦ | ✦ | ✦ | `POST /api/v1/events`, structured form with validation |
| I-1.2.2 | Event category & distance configuration — 5K, 10K, half-marathon | ✦ | ✦ | ✦ | Categories stored as structured data on event |
| I-1.2.3 | Pricing configuration — per category, early-bird support | ✦ | ✦ | ✦ | `{ category, base_price, early_bird_price, early_bird_deadline }`. Server-side price validation at booking time (no client-side price trust). |
| I-1.2.4 | Registration form field configuration — standard + fitness-specific fields | ✦ | ✦ | ✦ | JSONB form_schema with version, sensitive fields opt-in by default |
| I-1.2.5 | Refund & cancellation policy capture per event | ✦ | ✦ | ✦ | Stored alongside event, displayed before booking |
| I-1.2.6 | Event publish workflow — draft → under review → published | ✦ | ✦ | ✦ | Gated by organizer verification AND Razorpay linked-account (I-1.1.7) for paid events |
| I-1.2.7 | Admin event review interface — manual review for first 3 paid events from new organizers | ✦ | ✦ | — | `/admin/event-reviews` route |
| I-1.2.8 | Event edit & update capabilities (pre-event) | ✦ | ✦ | ✦ | CDN cache invalidation on update (Cloudflare API purge) |
| I-1.2.9 | Event image upload — hero image, route map | ✦ | ✦ | — | Upload to S3/R2 via presigned URLs (I-0.1.8). Architecture §3.5 lists event images as required object storage content. |
| I-1.2.10 | Slug generation for events — unique, URL-safe, with redirect on edit | ✦ | — | ✦ | Uniqueness constraint, slug change creates redirect from old slug |

**Database tables:** `events`, `event_categories`, `event_pricing_tiers`

**Key schema decisions:**
- JSONB column for organizer-configured form fields with `form_schema_version`
- Early-bird pricing as array of pricing tiers
- Composite indexes: `(event_id, status, created_at)`
- Slug uniqueness constraint with redirect table for changed slugs

---

## Phase 2: Event Discovery & Public Pages

**Goal:** Make published events discoverable and present them professionally. These are the SEO-critical, CDN-cached surfaces that organizers will share and participants will land on.

**Why third:** Events must exist (Phase 1) before they can be displayed. These public pages are what drives participant discovery.

**Prerequisites:** Phase 1 (events must exist in the system).

### Module 2.1: Event Detail Page

*Covers requirements F-2.1.1 through F-2.1.8*

| ID | Feature | Backend | Frontend | Shared | Notes |
|----|---------|---------|----------|--------|-------|
| I-2.1.1 | Professional event page layout — route, categories, pricing, timing, location, hero image, route map | ✦ | ✦ | — | SSR with `ssr: true`, CDN `s-maxage` + `stale-while-revalidate`. Includes media uploaded in I-1.2.9. |
| I-2.1.2 | Organizer info section with verification badge | ✦ | ✦ | — | Link to organizer profile |
| I-2.1.3 | Policy display — refund, cancellation policies visible before booking | — | ✦ | — | Trust information alongside organizer identity |
| I-2.1.4 | Category & pricing breakdown display | — | ✦ | — | Early-bird pricing with deadline display |
| I-2.1.5 | Share-optimized previews — Open Graph meta tags | — | ✦ | — | Social/messaging share optimization |
| I-2.1.6 | Structured data markup — JSON-LD for search discovery | — | ✦ | — | Schema.org Event markup |
| I-2.1.7 | "Register Now" CTA linking to booking flow | — | ✦ | — | Prominent, mobile-first call-to-action |
| I-2.1.8 | Mobile-first responsive event page design | — | ✦ | — | Optimized for mobile browsers |

### Module 2.2: Event Discovery Surface

*Covers requirements F-2.2.1 through F-2.2.4*

| ID | Feature | Backend | Frontend | Shared | Notes |
|----|---------|---------|----------|--------|-------|
| I-2.2.1 | Launch-city event listing page (Coimbatore) | ✦ | ✦ | — | SSR with `ssr: true`, CDN-cacheable, `/` route |
| I-2.2.2 | Event cards — name, date, location, price range, categories | — | ✦ | — | Compact card component |
| I-2.2.3 | Event status indicators — upcoming, registration open/closed, sold out | ✦ | ✦ | ✦ | Status enum in shared package |
| I-2.2.4 | Sort by date (default: upcoming first) | ✦ | ✦ | — | URL-state pagination and sort in search params |

### Module 2.3: Organizer Public Profile

*Covers requirements F-2.3.1 through F-2.3.4*

| ID | Feature | Backend | Frontend | Shared | Notes |
|----|---------|---------|----------|--------|-------|
| I-2.3.1 | Organizer profile page — business name, description, verification badge | ✦ | ✦ | — | SSR with `ssr: true`, `/organizers/:slug` |
| I-2.3.2 | Upcoming events listing on organizer profile | ✦ | ✦ | — | Query events by organizer |
| I-2.3.3 | Past event history on organizer profile | ✦ | ✦ | — | Builds organizer credibility |
| I-2.3.4 | Verification status explanation copy | — | ✦ | — | Describes verification as onboarding check, not quality guarantee |
| I-2.3.5 | Organizer slug generation — unique, URL-safe | ✦ | — | ✦ | Uniqueness constraint, redirect on change |

### Module 2.4: CDN & Cache Infrastructure

*Covers architecture §1, §4.2 requirements for CDN caching and invalidation*

| ID | Feature | Backend | Frontend | Shared | Notes |
|----|---------|---------|----------|--------|-------|
| I-2.4.1 | Cloudflare CDN setup — DNS, SSL, caching rules for SSR pages | — | ✦ | — | Cache SSR event pages at edge, static assets, DDoS protection |
| I-2.4.2 | CDN cache invalidation — Cloudflare API purge on event publish/unpublish, pricing changes, capacity changes, admin moderation | ✦ | — | — | Purge specific cache keys when event data changes |
| I-2.4.3 | Cache stampede prevention — single-flight/Redis locking for popular event pages | ✦ | — | — | Architecture §1: prevents origin overload when cache expires on popular events |

**SSR & Caching:** Event pages use `ssr: true` with CDN caching via `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`. Cache invalidation triggers are explicit and automated.

---

## Phase 3: Registration, Payment & Booking

**Goal:** The core value proposition — a unified registration + payment flow that eliminates the Google Forms + payment link mismatch.

**Why fourth:** Requires events to exist (Phase 1) and event pages to be live (Phase 2). This is the single most important product flow and the key revenue driver.

**Prerequisites:** Phase 2 (event pages to land on), Phase 0 auth (OTP for identity).

### Module 3.1: Registration Flow

*Covers requirements F-3.1.1 through F-3.1.6*

| ID | Feature | Backend | Frontend | Shared | Notes |
|----|---------|---------|----------|--------|-------|
| I-3.1.1 | Category selection step — pick distance/category | — | ✦ | — | Dynamic based on event configuration |
| I-3.1.2 | Registration form with pre-configured fields | ✦ | ✦ | ✦ | TanStack Form + Zod from shared, fitness-specific fields |
| I-3.1.3 | OTP verification triggered at form submission | ✦ | ✦ | — | Deferred auth pattern — triggers I-0.2.1 OTP flow |
| I-3.1.4 | Auto-fill from saved participant profile | ✦ | ✦ | — | Pre-fill for returning participants |
| I-3.1.5 | Form validation with clear error messaging | — | ✦ | ✦ | Shared Zod schema, `zodValidator()` adapter |
| I-3.1.6 | Consent capture at submission — booking terms, data usage, marketing (separate) | ✦ | ✦ | ✦ | Three distinct consent types per architecture §6. booking_terms and data_usage required; marketing optional (separate checkbox, not bundled). Consent versioning, no pre-checked boxes, server-side enforcement. |

**Key pattern:** Registration form uses shared Zod schemas from `packages/shared`. Async phone uniqueness validation (debounced). TanStack Form v1 with `zodValidator()`.

### Module 3.2: Payment Integration

*Covers requirements F-3.2.1 through F-3.2.6*

| ID | Feature | Backend | Frontend | Shared | Notes |
|----|---------|---------|----------|--------|-------|
| I-3.2.1 | Razorpay Route integration — payment-time split with organizer-linked settlement | ✦ | ✦ | — | Create Razorpay order using organizer's `razorpay_account_id` (from I-1.1.7), return checkout token |
| I-3.2.2 | UPI + card payment support | — | ✦ | — | Client-side Razorpay SDK handles checkout UI |
| I-3.2.3 | Split payout configuration — EventKart fee at payment time | ✦ | — | — | Razorpay Route split, remainder to organizer's linked account |
| I-3.2.4 | Payment status tracking — initiated, success, failed, refunded | ✦ | ✦ | ✦ | Immutable payment records table |
| I-3.2.5 | Payment failure handling with retry flow | ✦ | ✦ | — | Clear retry UX, idempotent backend |
| I-3.2.6 | Free pilot period handling — first 3 events: no platform fee split | ✦ | — | — | Per-organizer event counter |
| I-3.2.7 | Razorpay webhook handler — signature verification, BullMQ enqueue, 5s ACK | ✦ | — | — | `POST /api/v1/bookings/payment/callback`, HMAC SHA256. ACK immediately, process async. |
| I-3.2.8 | Webhook idempotency — webhook_events table, unique razorpay_payment_id | ✦ | — | — | Dedup via provider event ID. Process through booking state machine with row-level locking. |
| I-3.2.9 | Payment reconciliation job — periodic Razorpay API poll for stuck payments | ✦ | — | — | BullMQ repeatable job every 5 min, catches lost webhooks |
| I-3.2.10 | Capacity reservation — atomic DB update with 15-min expiry | ✦ | — | — | `UPDATE ... SET spots_remaining = spots_remaining - 1 WHERE spots_remaining > 0`. Expired reservations reclaimed by BullMQ repeatable job. |
| I-3.2.11 | Booking endpoint backpressure / waiting-room mode | ✦ | ✦ | — | Architecture §1: when Redis queue depth, job age, DB pool wait, or provider error rate cross thresholds, return controlled "registration busy, retry shortly" response. Optional waiting-room mode for burst events. Per-event rate limiting (sliding window counters per event + per IP). |

**Database tables:** `bookings`, `payment_records`, `webhook_events`

**Booking lifecycle (explicit state machine per architecture §7):**
1. `POST /api/v1/bookings` → Create booking record (status: `pending`) + reserve capacity (I-3.2.10) + create Razorpay order → return checkout token
2. Client-side Razorpay SDK processes payment (UPI/card)
3. Razorpay webhook → verify signature → enqueue to `payment-webhook` queue (I-3.2.7)
4. Worker processes: row-lock booking → state machine transition (`pending` → `confirmed`) → queue QR email
5. Reconciliation job (I-3.2.9) catches payments stuck as `pending` where webhook was lost
6. Capacity expiry job releases unpaid reservations after 15 minutes

### Module 3.3: Booking Confirmation & Email Foundation

*Covers requirements F-3.3.1 through F-3.3.5 AND F-6.1.1, F-6.1.2 (moved here from Phase 6)*

| ID | Feature | Backend | Frontend | Shared | Notes |
|----|---------|---------|----------|--------|-------|
| I-3.3.1 | Email service integration and template system | ✦ | — | — | Resend (default) + SES fallback for burst. React Email templates. Batch API for burst confirmations. **Moved from Phase 6 — this is a Phase 3 critical path dependency.** |
| I-3.3.2 | Booking record creation on successful payment | ✦ | — | — | State machine: pending → confirmed (via webhook worker) |
| I-3.3.3 | Booking confirmation page with summary | — | ✦ | — | `/book/:eventId/confirmation`. QR rendered client-side from HMAC-signed token. |
| I-3.3.4 | QR code generation — HMAC-signed booking token | ✦ | ✦ | — | Token: booking_id, event_id, ticket_version, exp, kid, jti. **Client renders QR on-demand for confirmation page; email worker generates QR image inline (server-side, e.g., `qrcode` npm package) since email clients don't execute JavaScript.** |
| I-3.3.5 | Booking confirmation email with QR ticket | ✦ | — | — | Triggered by payment webhook worker. React Email template with inline QR image. |
| I-3.3.6 | Booking status management — confirmed, cancelled, refunded, checked-in | ✦ | ✦ | ✦ | Status enum in shared package |

### Module 3.4: Participant Profile & Consent Management

*Covers requirements F-3.4.1 through F-3.4.4*

| ID | Feature | Backend | Frontend | Shared | Notes |
|----|---------|---------|----------|--------|-------|
| I-3.4.1 | Save participant details on first booking | ✦ | — | ✦ | Name, age, gender, city stored in `participant_profiles`. **Sensitive fields (blood group, emergency contact, medical) stored ONLY in `sensitive_participant_data` table with 30-day post-event retention and scoped access.** |
| I-3.4.2 | Profile view and edit for participants | ✦ | ✦ | ✦ | `/my/profile` route |
| I-3.4.3 | Booking history view | ✦ | ✦ | — | `/my/bookings` route |
| I-3.4.4 | Profile data deletion request | ✦ | ✦ | — | `DELETE /api/v1/my/profile`. Marks profile as deleted, enqueues anonymization job. **Note: The anonymization BullMQ job processor is stubbed here and completed in Phase 7 (I-7.3.5). The endpoint + queue message work now; the worker that processes anonymization is Phase 7 work.** |
| I-3.4.5 | Consent withdrawal API | ✦ | ✦ | ✦ | `DELETE /api/v1/my/consent/:type`. Architecture §6: participants can withdraw specific consent types (e.g., marketing) without deleting profile. Withdrawal triggers anonymization of data processed under that consent. |

---

## Phase 4: Organizer Operations Dashboard

**Goal:** Give organizers visibility into registrations, payments, and participant management.

**Why fifth:** Bookings must be flowing (Phase 3) before the dashboard has meaningful data.

**Prerequisites:** Phase 3 (bookings exist).

**Parallel opportunity:** Can start during late Phase 3 — API endpoints can be built before the booking flow is complete.

### Module 4.1: Event Operations View

*Covers requirements F-4.1.1 through F-4.1.5*

| ID | Feature | Backend | Frontend | Shared | Notes |
|----|---------|---------|----------|--------|-------|
| I-4.1.1 | Registered / paid / checked-in count summary per event | ✦ | ✦ | — | Aggregate queries, `/org/events/:id` |
| I-4.1.2 | Participant list with status filters | ✦ | ✦ | — | Server-side pagination for >100 rows, TanStack Table. **Scoped to organizer's own events only (server-side enforcement from Phase 0).** |
| I-4.1.3 | Individual participant booking detail view | ✦ | ✦ | — | Scoped to organizer's own events only. **Sensitive fields (blood group, medical) suppressed at API layer unless safety-critical.** |
| I-4.1.4 | Basic revenue view per event — total collected, EventKart fee, net to organizer | ✦ | ✦ | — | Read from payment records |
| I-4.1.5 | Participant roster export — CSV for offline fallback | ✦ | ✦ | — | BullMQ exports queue, sensitive fields controlled |

**Key pattern:** Participant tables use TanStack Table + TanStack Virtual for large lists (20K+ rows). Server-side pagination for initial load, client-side virtual scrolling for render.

### Module 4.2: Multi-Event Overview

*Covers requirements F-4.2.1 through F-4.2.3*

| ID | Feature | Backend | Frontend | Shared | Notes |
|----|---------|---------|----------|--------|-------|
| I-4.2.1 | Organizer home — all events (upcoming, past) | ✦ | ✦ | — | `/org/events` route |
| I-4.2.2 | Event status summary cards — draft, published, completed | — | ✦ | — | Quick status overview |
| I-4.2.3 | Quick-access links to event operations | — | ✦ | — | Navigation shortcuts |

---

## Phase 5: Event-Day Operations

**Goal:** Enable smooth event-day execution with QR check-in and offline fallback.

**Why sixth:** Requires bookings with QR codes (Phase 3). This is the event-day reliability layer.

**Prerequisites:** Phase 3 (QR codes exist). **Does NOT depend on Phase 4** — check-in is a standalone flow that verifies booking tokens directly.

**Parallel opportunity:** Can be built fully in parallel with Phases 4 and 6 after Phase 3 is complete.

### Module 5.1: QR Check-In

*Covers requirements F-5.1.1 through F-5.1.5*

| ID | Feature | Backend | Frontend | Shared | Notes |
|----|---------|---------|----------|--------|-------|
| I-5.1.1 | QR code scanner interface — camera-based, mobile browser | — | ✦ | — | `/org/events/:id/check-in` route, `ssr: false` (uses camera APIs) |
| I-5.1.2 | Scan result display — participant name, category, payment status, check-in status | ✦ | ✦ | — | Server-side verification of HMAC token + booking status. **Sensitive fields (blood group, medical) suppressed at API layer by default, not just UI-level suppression.** |
| I-5.1.3 | Check-in confirmation action — mark as checked in | ✦ | ✦ | — | Atomic single-use/first-scan semantics in DB. ticket_version enforcement. |
| I-5.1.4 | Duplicate scan detection — already checked-in warning | ✦ | ✦ | — | Returns existing check-in timestamp |
| I-5.1.5 | Sensitive field suppression — blood group, medical info suppressed by default | ✦ | ✦ | — | **Server-side enforcement**: API does not return sensitive fields in check-in response unless organizer has marked them safety-critical for this event. |

### Module 5.2: Manual Search Fallback

*Covers requirements F-5.2.1 through F-5.2.3*

| ID | Feature | Backend | Frontend | Shared | Notes |
|----|---------|---------|----------|--------|-------|
| I-5.2.1 | Search participants by name or phone number | ✦ | ✦ | — | Scoped to current event |
| I-5.2.2 | Search results with booking and payment status | ✦ | ✦ | — | Quick identification |
| I-5.2.3 | Manual check-in action from search results | ✦ | ✦ | — | Same backend as QR check-in |

### Module 5.3: Offline Roster

*Covers requirements F-5.3.1 through F-5.3.4*

| ID | Feature | Backend | Frontend | Shared | Notes |
|----|---------|---------|----------|--------|-------|
| I-5.3.1 | Downloadable participant roster — PDF or print-friendly format | ✦ | ✦ | — | BullMQ exports queue |
| I-5.3.2 | Roster contents — name, category, payment status, bib (if external) | — | — | — | Minimal data by default |
| I-5.3.3 | Sensitive fields included only if marked safety-critical by organizer | ✦ | — | — | Configurable per event, enforced server-side |
| I-5.3.4 | Delete-after-event instruction included with export | — | ✦ | — | Data handling guidance in PDF footer |

---

## Phase 6: Communications & Retention

**Goal:** Close the loop after booking and after the event. Drive repeat participation.

**Why seventh:** Requires completed bookings (Phase 3) and event completion (Phase 5) to trigger the right messages at the right time.

**Prerequisites:** Phase 3 (bookings + email infrastructure from Module 3.3), Phase 5 (event completion for post-event flows).

**Parallel opportunity:** Post-event features (Module 6.2) can be built in parallel with Phase 5. Module 6.1 (remaining transactional emails) can start as soon as email infra from Module 3.3 is ready.

**Note:** Email service integration (I-3.3.1) and booking confirmation email (I-3.3.5) are now in Phase 3 Module 3.3. This phase covers only reminders and post-event communications.

### Module 6.1: Remaining Transactional Emails

*Covers requirements F-6.1.3, F-6.1.4*

| ID | Feature | Backend | Frontend | Shared | Notes |
|----|---------|---------|----------|--------|-------|
| I-6.1.1 | Event reminder email — 1-2 days before event | ✦ | — | — | BullMQ scheduled job. Uses email infrastructure from I-3.3.1. |
| I-6.1.2 | Booking cancellation/refund confirmation email | ✦ | — | — | Triggered by refund workflow (Phase 7). Template ready here; trigger wired in Phase 7. |

### Module 6.2: Post-Event & Retention

*Covers requirements F-6.2.1 through F-6.2.4*

| ID | Feature | Backend | Frontend | Shared | Notes |
|----|---------|---------|----------|--------|-------|
| I-6.2.1 | Post-event follow-up email to participants | ✦ | — | — | Triggered after event completion. **Requires valid marketing consent (I-3.1.6) for promotional content.** |
| I-6.2.2 | Include organizer-provided wrap-up or external results links | ✦ | — | — | First-party results hosting out of scope |
| I-6.2.3 | Next-event prompt for repeat booking in follow-up email | ✦ | — | — | Link to organizer's next event. **Only sent to participants with marketing consent.** |
| I-6.2.4 | Organizer interface to add post-event content | ✦ | ✦ | — | Results link, photos link, next event link. `/org/events/:id/post-event` |

---

## Phase 7: Refunds, Disputes & Admin Operations

**Goal:** Handle exception paths — refunds, disputes, and platform-level administration. Harden the product for real-world edge cases during the pilot.

**Why eighth:** The happy path must work first (Phases 1–6). This phase handles the inevitable exceptions.

**Prerequisites:** Phase 3 (payment flow working). Can start once Phase 3 payment integration is stable.

**Parallel opportunity:** Can start during Phase 4-5 timeframe since it primarily depends on Phase 3.

### Module 7.1: Refund Workflow

*Covers requirements F-7.1.1 through F-7.1.4*

| ID | Feature | Backend | Frontend | Shared | Notes |
|----|---------|---------|----------|--------|-------|
| I-7.1.1 | Refund request initiation — participant-side or organizer-initiated | ✦ | ✦ | ✦ | Contact/form-based |
| I-7.1.2 | Refund processing through payment gateway — reverse split | ✦ | — | — | Razorpay refund API |
| I-7.1.3 | Refund status tracking and communication to participant | ✦ | ✦ | ✦ | Status updates via email (I-6.1.2) |
| I-7.1.4 | Handling for already-settled funds — organizer responsibility, EventKart mediation | ✦ | ✦ | — | Manual admin workflow |

### Module 7.2: Dispute & Support

*Covers requirements F-7.2.1 through F-7.2.4*

| ID | Feature | Backend | Frontend | Shared | Notes |
|----|---------|---------|----------|--------|-------|
| I-7.2.1 | Participant issue reporting mechanism | ✦ | ✦ | — | Contact/form-based reporting |
| I-7.2.2 | Admin dispute queue and management interface | ✦ | ✦ | — | `/admin/disputes` route |
| I-7.2.3 | 2-business-day first-response SLA tracking | ✦ | ✦ | — | SLA timer on dispute records |
| I-7.2.4 | Organizer suspension workflow for repeated violations | ✦ | ✦ | — | Admin action, logged in audit |

### Module 7.3: Admin Operations Panel & Data Lifecycle

*Covers requirements F-7.3.1 through F-7.3.4 plus data lifecycle from architecture §6*

| ID | Feature | Backend | Frontend | Shared | Notes |
|----|---------|---------|----------|--------|-------|
| I-7.3.1 | Organizer verification queue — pending applications, approve/reject | ✦ | ✦ | — | Started in Phase 1 (I-1.1.5), completed here with full queue management |
| I-7.3.2 | Event review queue — new organizer events pending manual review | ✦ | ✦ | — | Started in Phase 1 (I-1.2.7), completed here with full queue management |
| I-7.3.3 | Payout monitoring dashboard — split payout status, exceptions | ✦ | ✦ | — | Read from payment records |
| I-7.3.4 | Audit log viewer — filter by actor, action, resource, date range | ✦ | ✦ | — | Queries audit_log table (I-0.4.4) |
| I-7.3.5 | Anonymization worker — processes profile deletion and consent withdrawal requests | ✦ | — | — | BullMQ cleanup queue. Replaces PII with deterministic hashes/placeholders. Preserves financial data. Completes the stub from I-3.4.4. |
| I-7.3.6 | Sensitive field cleanup job — 30 days post-event | ✦ | — | — | BullMQ daily repeatable job. Scans and deletes sensitive fields on bookings for completed events. |
| I-7.3.7 | KYC document cleanup job — 1 year after account closure | ✦ | — | — | BullMQ weekly repeatable job. Removes S3/R2 objects and DB metadata. |
| I-7.3.8 | DSAR data export — machine-readable export of all participant data | ✦ | ✦ | — | `GET /api/v1/my/data-export`. BullMQ exports queue. Required for DPDPA compliance. |
| I-7.3.9 | Email bounce/complaint handling — deliverability hygiene | ✦ | — | — | Resend/SES webhook for bounces and complaints. Suppress future sends to bounced addresses. |
| I-7.3.10 | Inactive account cleanup — 3 years inactivity | ✦ | — | — | BullMQ weekly repeatable job. Marks inactive accounts for anonymization. |

---

## Cross-Cutting Concerns (Applied Across All Phases)

These are not separate phases — they are requirements that apply during every phase of implementation.

### Security

| Concern | Implementation | Applies From |
|---------|---------------|--------------|
| CSRF protection | SameSite cookies + anti-CSRF token on state-changing requests (I-0.2.11) | Phase 0 |
| Rate limiting | Per-route, per-IP via `@fastify/rate-limit` + Redis. **Per-event rate limiting** for burst registration. | Phase 0 |
| Input validation | Zod schemas on every endpoint + response schemas | Phase 0 |
| SQL injection prevention | Drizzle ORM parameterized queries | Phase 0 |
| XSS prevention | React default escaping + CSP headers (I-0.2.12) | Phase 0 |
| Webhook signature verification | HMAC SHA256 on Razorpay callbacks (I-3.2.7) | Phase 3 |
| Secret management | Railway env vars, rolling rotation for session/HMAC secrets | Phase 0 |
| Scoped organizer access | **Server-side enforcement from Phase 1 onward.** All organizer API endpoints filter to own resources only. Not deferred to Phase 4. | Phase 1 |
| Admin IP allowlist | Admin endpoints restricted to known IP ranges (I-0.2.6) | Phase 0 |
| Backpressure / waiting-room | Admission control for burst registration — 503 + Retry-After (I-3.2.11) | Phase 3 |

### Privacy & Data Handling (DPDPA-Aware)

| Concern | Implementation | Applies From |
|---------|---------------|--------------|
| Data minimization | Collect only registration + event-day data | Phase 3 |
| Sensitive field opt-in | Blood group, medical fields optional by default | Phase 1 |
| Consent at collection | Explicit consent, versioned, no pre-checked boxes. **Three separate consent types**: booking_terms, data_usage, marketing (I-3.1.6) | Phase 3 |
| Consent withdrawal | API endpoint to revoke specific consent types (I-3.4.5) | Phase 3 |
| Marketing consent separation | Promotional emails require explicit marketing consent; transactional emails (booking confirmation, reminders) do not | Phase 3 |
| Scoped organizer access | Server-side filtering to own events only — enforced from Phase 1, not Phase 4 | Phase 1 |
| Sensitive data segregation | `sensitive_participant_data` table — blood_group, medical_conditions, emergency_contact stored separately with 30-day TTL | Phase 3 |
| Separate KYC storage | Object storage with presigned URLs, access logged | Phase 1 |
| Deletion/anonymization | Soft delete, booking anonymization, scheduled cleanup (I-7.3.5) | Phase 7 |
| Data export (DSAR) | `GET /api/v1/my/data-export` machine-readable export (I-7.3.8) | Phase 7 |

### Data Lifecycle & Retention

| Data Class | Retention | Cleanup Mechanism |
|-----------|-----------|-------------------|
| Participant profile | Until deletion request or 3 years inactivity | Soft delete + anonymization |
| Booking & payment records | 5 years | Anonymize PII, preserve financial |
| Sensitive participant fields | 30 days post-event | BullMQ daily cleanup job |
| Organizer verification docs | 1 year after account closure | BullMQ weekly cleanup job |
| Audit logs | 3 years minimum | Manual review before purge |
| Consent records | As long as related data exists | Never deleted before authorized data |

---

## Dependency Map & Parallel Execution Strategy

### Sequential Dependencies (Must Complete Before Next)

```
Phase 0 (Foundation)
    └── Phase 1 (Organizer Onboarding & Event Creation)
            └── Phase 2 (Event Discovery & Public Pages)
                    └── Phase 3 (Registration, Payment & Booking)
```

### Parallel Tracks After Phase 3

```
Phase 3 complete
    ├── Track A: Phase 4 (Organizer Dashboard)
    ├── Track B: Phase 5 (Event-Day Operations)
    ├── Track C: Phase 6 (Communications & Retention)
    └── Track D: Phase 7 (Refunds, Disputes & Admin)
```

**Key clarifications:**
- Phase 5 does **NOT** depend on Phase 4 — check-in verifies booking tokens directly without needing the organizer dashboard.
- Phase 6 Module 6.1 (remaining transactional emails) requires email infra from Phase 3 Module 3.3.
- Phase 7 can start once Phase 3 payment integration is stable.
- All four tracks can run simultaneously with independent teams/developers.

### Early-Start Modules (Can Begin Before Their Phase)

| Module | Can Start During | Reason |
|--------|-----------------|--------|
| I-1.1.5 Admin verification API | Phase 0 | Needed for organizer onboarding |
| I-1.2.7 Admin event review API | Phase 1 | Needed before events can be published |
| Module 2.4 CDN & Cache setup | Phase 1 | Infrastructure can be configured before public pages exist |
| Module 3.4 Participant Profile | Phase 3 (early) | Save-on-first-booking can be built alongside registration |
| Module 7.3 Admin operations | Phase 4 | Admin queue management extends Phase 1 stubs |

### Module-Level Execution Order Within Phases

**Phase 0 recommended order:**
1. Module 0.1 (shared packages + DB) — blocks everything
2. Module 0.2 (auth) — depends on 0.1
3. Module 0.3 (app shell) — can parallel with 0.2
4. Module 0.4 (observability) — can parallel with 0.2 and 0.3

**Phase 1 recommended order:**
1. Module 1.1 (organizer signup) — blocks event creation
2. Module 1.2 (event creation) — depends on 1.1

**Phase 2 recommended order:**
1. Module 2.1 (event detail page) — highest priority (what organizers share)
2. Module 2.2 (discovery surface) — can parallel with 2.1
3. Module 2.3 (organizer profile) — can parallel with 2.1 and 2.2
4. Module 2.4 (CDN & cache) — can start early, finalized after 2.1

**Phase 3 recommended order:**
1. Module 3.3 (email foundation) — start email service integration early, unblocks confirmation
2. Module 3.1 (registration form) — start of the user flow
3. Module 3.2 (payment integration) — depends on 3.1
4. Module 3.4 (participant profile + consent) — can parallel with 3.2

---

## Feature Count Summary

| Phase | Modules | Features |
|-------|---------|----------|
| Phase 0: Foundation | 4 | 33 |
| Phase 1: Organizer Onboarding & Event Creation | 2 | 18 |
| Phase 2: Event Discovery & Public Pages | 4 | 20 |
| Phase 3: Registration, Payment & Booking | 4 | 28 |
| Phase 4: Organizer Operations Dashboard | 2 | 8 |
| Phase 5: Event-Day Operations | 3 | 12 |
| Phase 6: Communications & Retention | 2 | 6 |
| Phase 7: Refunds, Disputes & Admin Ops | 3 | 18 |
| **Total** | **24** | **143** |

**Note:** Feature count is higher than the requirements doc (103 F-IDs across 8 phases) because:
- Phase 0 adds infrastructure features (Redis, BullMQ, object storage, CI/CD, security headers, observability, metrics)
- Phase 1 adds Razorpay Route linked-account, event images, slug generation
- Phase 2 adds CDN infrastructure module and organizer slug
- Phase 3 adds payment infrastructure (webhook, reconciliation, capacity, backpressure), email foundation (moved from Phase 6), consent withdrawal
- Phase 7 adds data lifecycle workers (anonymization, sensitive field cleanup, KYC cleanup, DSAR export, email deliverability)
- All implementation IDs use I-prefix (e.g., I-3.2.1) to avoid collision with requirements F-IDs. See Appendix A for the complete mapping.

---

## API Route Summary

All routes prefixed with `/api/v1/`.

### Auth
```
POST /auth/otp/send           → Send OTP (rate: 1/phone/60s)
POST /auth/otp/verify         → Verify OTP, issue session
POST /auth/logout             → Clear session
POST /auth/verify-email       → Initiate organizer email verification
GET  /auth/verify-email/:token → Complete email verification
```

### Uploads
```
POST /uploads/presign          → Get presigned upload URL (KYC docs, event images)
```

### Events (Public)
```
GET  /events                  → List events (paginated, filterable)
GET  /events/:slug            → Event detail (public)
```

### Events (Organizer)
```
POST /events                  → Create event
PUT  /events/:id              → Update event
POST /events/:id/publish      → Submit for review/publish
```

### Organizers
```
POST /organizers              → Organizer signup
GET  /organizers/:slug        → Public organizer profile
POST /organizers/verify       → Submit verification documents
```

### Bookings
```
POST /bookings                → Submit registration + initiate payment
POST /bookings/payment/callback → Razorpay webhook
GET  /bookings/:id            → Booking detail
```

### Consent
```
GET  /my/consent               → View current consent records
DELETE /my/consent/:type       → Withdraw specific consent (marketing, data_usage)
```

### Organizer Dashboard
```
GET  /org/events              → Organizer's events
GET  /org/events/:id/participants → Participant list (paginated)
GET  /org/events/:id/participants/search → Search by name/phone
GET  /org/events/:id/stats    → Event statistics
POST /org/events/:id/checkin/:bookingId → Check in participant
POST /org/events/:id/checkin/verify → Verify QR token (scan result)
GET  /org/events/:id/roster   → Export roster
POST /org/events/:id/post-event → Add post-event content
GET  /org/profile             → Organizer profile
PUT  /org/profile             → Update organizer profile
```

### Participant
```
GET  /my/profile              → View profile
PUT  /my/profile              → Update profile
DELETE /my/profile            → Request deletion
GET  /my/bookings             → Booking history
GET  /my/consent              → View consent records
DELETE /my/consent/:type      → Withdraw specific consent
GET  /my/data-export          → DSAR data export
POST /my/issues               → Report issue (dispute initiation)
```

### Admin
```
GET  /admin/verifications         → Pending organizer verifications
POST /admin/verifications/:id/approve
POST /admin/verifications/:id/reject
GET  /admin/event-reviews         → Events pending review
POST /admin/event-reviews/:id/approve
POST /admin/event-reviews/:id/reject
GET  /admin/disputes              → Dispute queue
POST /admin/disputes/:id/respond  → Respond to dispute
GET  /admin/payouts               → Payout monitoring
POST /admin/organizers/:id/suspend → Suspend organizer
GET  /admin/audit-log             → Audit log viewer
```

### Refunds
```
POST /refunds                 → Initiate refund request
GET  /refunds/:id             → Refund status
```

### System
```
GET  /health                  → Liveness check
GET  /ready                   → Readiness check (DB + Redis)
```

---

## Frontend Route Summary

### Public (SSR, `ssr: true`)
```
/                             → Event discovery (Coimbatore)
/events/:slug                 → Event detail page (CDN-cached)
/organizers/:slug             → Organizer public profile
```

### Booking (CSR, `ssr: 'data-only'`)
```
/book/:eventId                → Registration + payment flow
/book/:eventId/confirmation   → Booking confirmation with QR
```

### Participant (CSR, `ssr: 'data-only'`, auth required)
```
/my/profile                   → View/edit profile
/my/bookings                  → Booking history
/my/consent                   → Manage consent preferences
/my/data-export               → Request DSAR export
```

### Organizer (CSR, `ssr: 'data-only'`, auth required)
```
/org/events                   → All events (upcoming, past)
/org/events/new               → Create event
/org/events/:id               → Event operations
/org/events/:id/participants  → Participant list
/org/events/:id/check-in     → QR check-in scanner (ssr: false — uses camera APIs)
/org/events/:id/post-event   → Post-event content editor
/org/profile                  → Organizer profile management
```

### Admin (CSR, `ssr: 'data-only'`, auth required)
```
/admin/verifications          → Organizer verification queue
/admin/event-reviews          → Event review queue
/admin/disputes               → Dispute management
/admin/payouts                → Payout monitoring
/admin/audit-log              → Audit log viewer
```

---

## BullMQ Worker Jobs

All workers run as a **separate Railway service** — never in the API process.

**DLQ pattern:** BullMQ has no native DLQ. Implement via `failed` event handler: after max retries exhausted, move job to dead-letter storage + alert admin via webhook/email.

| Queue | Job | Trigger | Concurrency | Retry | Notes |
|-------|-----|---------|-------------|-------|-------|
| `payment-webhook` | Process payment webhook | Razorpay webhook received | 10 | 3× exponential | Critical path — booking state machine |
| `payment-webhook` | Payment reconciliation | Repeatable (every 5 min) | 1 | 1× | Catches missed webhooks |
| `payment-webhook` | Capacity reservation expiry | Repeatable (every 1 min) | 2 | 1× | 15-minute reservation timeout |
| `email` | Booking confirmation | Booking confirmed | 5 | 2× exponential | Contains QR ticket |
| `email` | Event reminder | Scheduled (1-2 days before) | 5 | 2× exponential | — |
| `email` | Post-event follow-up | Event completed | 5 | 2× exponential | Requires marketing consent |
| `email` | Refund confirmation | Refund processed | 5 | 2× exponential | — |
| `email` | Bounce/complaint handler | Resend/SES webhook | 2 | 1× | Suppress future sends to bounced addresses |
| `cleanup` | Sensitive field cleanup | Repeatable daily | 2 | 1× | 30 days post-event |
| `cleanup` | KYC doc cleanup | Repeatable weekly | 2 | 1× | 1 year after account closure |
| `cleanup` | Inactive account cleanup | Repeatable weekly | 2 | 1× | 3 years inactivity (I-7.3.10) |
| `cleanup` | Anonymization processor | Profile deletion request | 2 | 2× exponential | PII → deterministic hashes |
| `exports` | Roster PDF/CSV generation | Organizer request | 1 | 2× | Sensitive fields controlled |
| `exports` | DSAR data export | Participant request | 1 | 2× | All personal data, machine-readable |

---

## Database Table Overview

### Core (Phase 0)
- `users` — id, phone, email, name, role, created_at, deleted_at
- `sessions` — id, user_id, data JSONB, expires_at
- `consent_records` — participant_id, consent_type (booking_terms/data_usage/marketing), consent_version, accepted_at, withdrawn_at, ip_address
- `audit_log` — id, actor_id, actor_role, action, resource_type, resource_id, metadata JSONB, ip_address, created_at

### Organizer (Phase 1)
- `organizers` — id, user_id, business_name, slug, description, city, email, email_verified_at, **razorpay_account_id**, verification_status, events_published_count, created_at
- `organizer_verifications` — id, organizer_id, document_type, storage_key, uploaded_at, reviewed_at, reviewed_by, status, notes
- `policy_acceptances` — id, organizer_id, policy_type, policy_version, accepted_at

### Events (Phase 1)
- `events` — id, organizer_id, slug, name, date, time, location, description, route_details, image_storage_key, status (draft/under_review/published/completed/cancelled), form_schema JSONB, form_schema_version, spots_total, spots_remaining, refund_policy, cancellation_policy, created_at, updated_at
- `event_categories` — id, event_id, name, distance, sort_order
- `event_pricing_tiers` — id, event_category_id, base_price, early_bird_price, early_bird_deadline
- `slug_redirects` — id, old_slug, new_slug, resource_type (event/organizer), resource_id, created_at

### Bookings & Payments (Phase 3)
- `bookings` — id, event_id, user_id, event_category_id, form_data JSONB, form_schema_snapshot JSONB, status (pending/reserved/confirmed/cancelled/refunded/checked_in), razorpay_payment_id (unique), ticket_version, checked_in_at, created_at
- `payment_records` — id, booking_id, razorpay_order_id, amount, platform_fee, organizer_amount, status, created_at (immutable insert-only)
- `webhook_events` — id, provider_event_id (unique), signature_valid, payload_hash, processing_status, last_error, received_at, processed_at

### Participant (Phase 3)
- `participant_profiles` — id, user_id, name, age, gender, city, tshirt_size, updated_at. **Note: blood_group, medical_conditions, emergency_contact are NOT stored here — they go in `sensitive_participant_data` only.**
- `sensitive_participant_data` — id, booking_id, blood_group, medical_conditions, emergency_contact, expires_at (30 days post-event)

### Communications (Phase 6)
- `email_log` — id, recipient_id, template, status, sent_at, metadata JSONB
- `email_suppressions` — id, email_address, reason (bounce/complaint), provider_event_id, created_at

### Disputes & Refunds (Phase 7)
- `refund_requests` — id, booking_id, requested_by, reason, status, processed_at
- `disputes` — id, booking_id, reporter_id, description, status, sla_deadline, resolved_at

---

## What This Document Does NOT Cover

This is a high-level implementation plan — not an implementation spec. The following are deferred to per-feature implementation planning:

- Detailed database schema design (column types, constraints, exact indexes)
- API request/response contract definitions (OpenAPI specs)
- UI/UX wireframes and detailed interaction design
- Third-party integration specifics (Razorpay Route configuration, MSG91 templates, Resend setup)
- Performance requirements and SLAs
- Testing strategy per module
- Deployment automation specifics (GitHub Actions workflows)
- Cost modeling and infrastructure sizing

Each feature (e.g., I-3.2.1) will be expanded into a detailed implementation spec when its phase begins.

---

## Appendix A: Requirements-to-Implementation ID Mapping

Implementation plan IDs use an `I-` prefix to avoid collision with requirements document `F-` IDs. This table provides a complete traceability mapping. Features marked "— (new)" are additions from the architecture document, product plan, or review findings that don't have a corresponding requirements F-ID.

### Phase 0: Foundation

| Requirements ID | Implementation ID | Feature |
|----------------|-------------------|---------|
| F-0.1.1 | I-0.1.1 | Shared packages (expanded from "Initialize project structure") |
| F-0.1.2 | I-0.1.2, I-0.1.3 | DB schema foundations (split into Drizzle ORM + core tables) |
| F-0.1.3 | I-0.1.9 | CI/CD deployment pipeline |
| F-0.1.4 | I-0.1.4 | Local dev infrastructure (Docker Compose) |
| — (new) | I-0.1.5 | Redis client setup (infra) |
| — (new) | I-0.1.6 | BullMQ queue infrastructure (infra) |
| — (new) | I-0.1.7 | Database migration CI pipeline (infra) |
| — (new) | I-0.1.8 | Object storage client (infra) |
| F-0.2.1 | I-0.2.1 | Phone OTP authentication (expanded with WhatsApp fallback) |
| F-0.2.2 | I-0.2.4 | Role-based access control |
| F-0.2.3 | I-0.2.2, I-0.2.3 | Session management (split into creation + middleware) |
| F-0.2.4 | I-0.2.7 | Deferred authentication pattern |
| — (new) | I-0.2.5 | Organizer email verification (architecture §6) |
| — (new) | I-0.2.6 | Admin IP allowlist (architecture §6) |
| — (new) | I-0.2.8 | Logout endpoint |
| — (new) | I-0.2.9 | Session forwarding for SSR |
| — (new) | I-0.2.10 | Internal API key for server-to-server |
| — (new) | I-0.2.11 | CSRF protection |
| — (new) | I-0.2.12 | Security headers |
| F-0.3.1 | I-0.3.1 | Mobile-first responsive layout shell |
| F-0.3.2 | I-0.3.2 | Core UI component library |
| F-0.3.3 | I-0.3.3 | Role-based routing and navigation |
| F-0.3.4 | I-0.3.4, I-0.3.5 | Error handling + loading state patterns (split into 2) |
| — (new) | I-0.3.6 | API client setup (hybrid SSR/browser) |
| — (new) | I-0.4.1 | Sentry integration (observability) |
| — (new) | I-0.4.2 | Pino logging + OpenTelemetry (observability) |
| — (new) | I-0.4.3 | Health check endpoints (observability) |
| — (new) | I-0.4.4 | Audit log infrastructure (observability) |
| — (new) | I-0.4.5 | Production metrics emitter (observability) |
| — (new) | I-0.4.6 | BullMQ observability (observability) |

### Phase 1: Organizer Onboarding & Event Creation

| Requirements ID | Implementation ID | Feature |
|----------------|-------------------|---------|
| F-1.1.1 | I-1.1.1 | Organizer registration form |
| F-1.1.2 | I-1.1.2 | Verification document upload |
| F-1.1.3 | I-1.1.3 | Policy acceptance workflow |
| F-1.1.4 | I-1.1.4 | Verification status tracking |
| F-1.1.5 | I-1.1.5 | Admin verification review interface |
| F-1.1.6 | I-1.1.6 | Verification badge assignment |
| — (new) | I-1.1.7 | Razorpay Route linked-account creation (product plan §7) |
| — (new) | I-1.1.8 | Organizer profile management |
| F-1.2.1 | I-1.2.1 | Event creation form |
| F-1.2.2 | I-1.2.2 | Event category & distance configuration |
| F-1.2.3 | I-1.2.3 | Pricing configuration |
| F-1.2.4 | I-1.2.4 | Registration form field configuration |
| F-1.2.5 | I-1.2.5 | Refund & cancellation policy capture |
| F-1.2.6 | I-1.2.6 | Event publish workflow |
| F-1.2.7 | I-1.2.7 | Admin event review |
| F-1.2.8 | I-1.2.8 | Event edit & update capabilities |
| — (new) | I-1.2.9 | Event image upload (product plan §6) |
| — (new) | I-1.2.10 | Slug generation for events |

### Phase 2: Event Discovery & Public Pages

| Requirements ID | Implementation ID | Feature |
|----------------|-------------------|---------|
| F-2.1.1 | I-2.1.1 | Professional event page layout |
| F-2.1.2 | I-2.1.2 | Organizer info section with badge |
| F-2.1.3 | I-2.1.3 | Policy display |
| F-2.1.4 | I-2.1.4 | Category & pricing breakdown |
| F-2.1.5 | I-2.1.5 | Share-optimized previews (OG tags) |
| F-2.1.6 | I-2.1.6 | Structured data markup (JSON-LD) |
| F-2.1.7 | I-2.1.7 | "Register Now" CTA |
| F-2.1.8 | I-2.1.8 | Mobile-first responsive design |
| F-2.2.1 | I-2.2.1 | Launch-city event listing |
| F-2.2.2 | I-2.2.2 | Event cards |
| F-2.2.3 | I-2.2.3 | Event status indicators |
| F-2.2.4 | I-2.2.4 | Sort by date |
| F-2.3.1 | I-2.3.1 | Organizer profile page |
| F-2.3.2 | I-2.3.2 | Upcoming events on profile |
| F-2.3.3 | I-2.3.3 | Past event history |
| F-2.3.4 | I-2.3.4 | Verification status explanation |
| — (new) | I-2.3.5 | Organizer slug generation |
| — (new) | I-2.4.1 | Cloudflare CDN setup (architecture §1, §4.2) |
| — (new) | I-2.4.2 | CDN cache invalidation |
| — (new) | I-2.4.3 | Cache stampede prevention |

### Phase 3: Registration, Payment & Booking

| Requirements ID | Implementation ID | Feature |
|----------------|-------------------|---------|
| F-3.1.1 | I-3.1.1 | Category selection step |
| F-3.1.2 | I-3.1.2 | Registration form |
| F-3.1.3 | I-3.1.3 | OTP verification at submission |
| F-3.1.4 | I-3.1.4 | Auto-fill from saved profile |
| F-3.1.5 | I-3.1.5 | Form validation |
| F-3.1.6 | I-3.1.6 | Consent capture (expanded to 3 types: booking_terms, data_usage, marketing) |
| F-3.2.1 | I-3.2.1 | Razorpay Route integration |
| F-3.2.2 | I-3.2.2 | UPI + card payment |
| F-3.2.3 | I-3.2.3 | Split payout configuration |
| F-3.2.4 | I-3.2.4 | Payment status tracking |
| F-3.2.5 | I-3.2.5 | Payment failure handling |
| F-3.2.6 | I-3.2.6 | Free pilot period handling |
| — (new) | I-3.2.7 | Razorpay webhook handler (architecture §7) |
| — (new) | I-3.2.8 | Webhook idempotency |
| — (new) | I-3.2.9 | Payment reconciliation job |
| — (new) | I-3.2.10 | Capacity reservation with expiry |
| — (new) | I-3.2.11 | Backpressure / waiting-room mode (architecture §1) |
| F-6.1.1 | I-3.3.1 | Email service integration (**moved from Phase 6** — critical path for booking confirmation) |
| F-3.3.1 | I-3.3.2 | Booking record creation |
| F-3.3.2 | I-3.3.3 | Booking confirmation page |
| F-3.3.3 | I-3.3.4 | QR code generation |
| F-3.3.4, F-6.1.2 | I-3.3.5 | Booking confirmation email with QR (**F-6.1.2 merged** — email + QR are one feature) |
| F-3.3.5 | I-3.3.6 | Booking status management |
| F-3.4.1 | I-3.4.1 | Save participant details on first booking |
| F-3.4.2 | I-3.4.2 | Profile view and edit |
| F-3.4.3 | I-3.4.3 | Booking history view |
| F-3.4.4 | I-3.4.4 | Profile data deletion request |
| — (new) | I-3.4.5 | Consent withdrawal API (architecture §6) |

### Phase 4: Organizer Operations Dashboard

| Requirements ID | Implementation ID | Feature |
|----------------|-------------------|---------|
| F-4.1.1 | I-4.1.1 | Registration/payment/check-in summary |
| F-4.1.2 | I-4.1.2 | Participant list with filters |
| F-4.1.3 | I-4.1.3 | Individual booking detail |
| F-4.1.4 | I-4.1.4 | Revenue view |
| F-4.1.5 | I-4.1.5 | Roster export (CSV) |
| F-4.2.1 | I-4.2.1 | Organizer event home |
| F-4.2.2 | I-4.2.2 | Event status cards |
| F-4.2.3 | I-4.2.3 | Quick-access links |

### Phase 5: Event-Day Operations

| Requirements ID | Implementation ID | Feature |
|----------------|-------------------|---------|
| F-5.1.1 | I-5.1.1 | QR scanner interface |
| F-5.1.2 | I-5.1.2 | Scan result display |
| F-5.1.3 | I-5.1.3 | Check-in confirmation |
| F-5.1.4 | I-5.1.4 | Duplicate scan detection |
| F-5.1.5 | I-5.1.5 | Sensitive field suppression (upgraded to server-side enforcement) |
| F-5.2.1 | I-5.2.1 | Search by name/phone |
| F-5.2.2 | I-5.2.2 | Search results with status |
| F-5.2.3 | I-5.2.3 | Manual check-in |
| F-5.3.1 | I-5.3.1 | Downloadable roster |
| F-5.3.2 | I-5.3.2 | Roster contents |
| F-5.3.3 | I-5.3.3 | Safety-critical field inclusion |
| F-5.3.4 | I-5.3.4 | Delete-after-event instruction |

### Phase 6: Communications & Retention

| Requirements ID | Implementation ID | Feature |
|----------------|-------------------|---------|
| F-6.1.1 | → I-3.3.1 | **Moved to Phase 3 Module 3.3** |
| F-6.1.2 | → I-3.3.5 | **Merged into Phase 3 Module 3.3** |
| F-6.1.3 | I-6.1.1 | Event reminder email |
| F-6.1.4 | I-6.1.2 | Cancellation/refund confirmation email |
| F-6.2.1 | I-6.2.1 | Post-event follow-up email |
| F-6.2.2 | I-6.2.2 | Organizer wrap-up/results links |
| F-6.2.3 | I-6.2.3 | Next-event prompt |
| F-6.2.4 | I-6.2.4 | Organizer post-event content interface |

### Phase 7: Refunds, Disputes & Admin Operations

| Requirements ID | Implementation ID | Feature |
|----------------|-------------------|---------|
| F-7.1.1 | I-7.1.1 | Refund request initiation |
| F-7.1.2 | I-7.1.2 | Refund processing (reverse split) |
| F-7.1.3 | I-7.1.3 | Refund status tracking |
| F-7.1.4 | I-7.1.4 | Already-settled fund handling |
| F-7.2.1 | I-7.2.1 | Participant issue reporting |
| F-7.2.2 | I-7.2.2 | Admin dispute queue |
| F-7.2.3 | I-7.2.3 | SLA tracking |
| F-7.2.4 | I-7.2.4 | Organizer suspension |
| F-7.3.1 | I-7.3.1 | Organizer verification queue (extends I-1.1.5) |
| F-7.3.2 | I-7.3.2 | Event review queue (extends I-1.2.7) |
| F-7.3.3 | I-7.3.3 | Payout monitoring dashboard |
| F-7.3.4 | I-7.3.4 | Audit log viewer |
| — (new) | I-7.3.5 | Anonymization worker (DPDPA compliance) |
| — (new) | I-7.3.6 | Sensitive field cleanup (30d post-event) |
| — (new) | I-7.3.7 | KYC document cleanup (1y post-closure) |
| — (new) | I-7.3.8 | DSAR data export (DPDPA compliance) |
| — (new) | I-7.3.9 | Email bounce/complaint handling |
| — (new) | I-7.3.10 | Inactive account cleanup (3y inactivity) |

### Summary

| | Requirements (F-IDs) | Implementation (I-IDs) | Δ |
|-|---------------------|----------------------|---|
| Phase 0 | 12 | 33 | +21 (infrastructure) |
| Phase 1 | 14 | 18 | +4 (Razorpay, images, slug, profile) |
| Phase 2 | 16 | 20 | +4 (CDN, organizer slug) |
| Phase 3 | 21 | 28 | +7 (payment infra, backpressure, consent withdrawal, email moved here) |
| Phase 4 | 8 | 8 | 0 |
| Phase 5 | 12 | 12 | 0 |
| Phase 6 | 8 | 6 | −2 (F-6.1.1, F-6.1.2 moved to Phase 3) |
| Phase 7 | 12 | 18 | +6 (data lifecycle, DSAR, bounce) |
| **Total** | **103** | **143** | **+40** |

**Sensitive field tradeoff note:** Product plan §6 Tier 1 says saved profiles include "blood group, emergency contact" for repeat bookings. The implementation stores these per-booking in `sensitive_participant_data` with 30-day TTL (privacy-first design per DPDPA). This means sensitive fields will **not auto-fill** on repeat bookings — participants re-enter them each time. This is a deliberate privacy-over-convenience tradeoff.

---

## Appendix B: Review & Revision History

| Version | Date | Reviewed By | Key Changes |
|---------|------|-------------|-------------|
| v1.0 | — | Initial draft | 8 phases, 23 modules, 115 features |
| v2.0 | — | Claude Opus 4.7, Claude Opus 4.6, GPT-5.4, Claude Sonnet 4.6 | 139 features. Feature ID prefix changed F→I. Email infra moved to Phase 3. Phase 5 prerequisite fixed. Razorpay Route linked-account added. Backpressure/waiting-room added. Sensitive data model fixed. Pre-launch gates added. DSAR export added. Anonymization worker added. CDN module added. Consent model expanded to 3 types. |
| v2.1 | — | Claude Opus 4.6, GPT-5.4 (final review) | 143 features. Appendix A completely rewritten with per-F-ID traceability. Feature count corrected (Phase 2: 20, Phase 3: 28, Phase 7: 18). Added I-7.3.10 (inactive account cleanup). Added slug_redirects table. Added missing API endpoints (email verification, presigned upload, consent, issue reporting, check-in verification). Fixed consent API consistency. Fixed security table cross-reference. Added sensitive field tradeoff note. |
