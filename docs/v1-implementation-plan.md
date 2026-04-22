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
| I-0.1.1: `packages/shared` | ✅ Complete | Zod v4 schemas, types, constants, phone E.164 normalization. 58 tests passing. |
| I-0.1.4: Docker Compose | ✅ Complete | PostgreSQL 17 + Redis 7 local dev infrastructure. `docker-compose.yml` at repo root. |
| I-0.1.2: `packages/db` | ✅ Complete | Drizzle ORM client with `prepare: false`, postgres.js driver, Drizzle Kit migrations, seed skeleton. 1 test passing. |
| I-0.1.5: Redis client setup | ✅ Complete | ioredis namespaced connections (sess:, bull:, rl:, cache:, otp:), Fastify plugin, BullMQ connection factory. 35 API tests passing. |
| I-0.1.6: BullMQ queue infrastructure | ✅ Complete | Queue definitions (payment-webhook, email, cleanup, exports, failed-jobs DLQ), worker service skeleton, Fastify plugin. 59 API tests passing. |

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

**Implementation order:** Items are sequenced by dependency — each row depends on the rows above it.

| Order | ID | Feature | Backend | Frontend | Shared | Depends on | Notes |
|-------|----|---------|---------|----------|--------|------------|-------|
| 1 ✅ | I-0.1.1 | `packages/shared` — Shared Zod schemas, types, constants | — | — | ✦ | — | Schemas imported by both `apps/web` and `apps/api`. Phone number normalization to E.164 format defined here. |
| 2 ✅ | I-0.1.4 | Local development infrastructure — Docker Compose for PostgreSQL + Redis | ✦ | — | — | — | `docker-compose.yml` at repo root. Can run in parallel with I-0.1.1. |
| 3  ✅ | I-0.1.2 | `packages/db` — Drizzle ORM schema, migrations, seed, client | ✦ | — | — | I-0.1.1, I-0.1.4 | PostgreSQL 17, `prepare: false` for PgBouncer, Drizzle Kit migrations. Needs shared types + running DB. |
| 4 ✅ | I-0.1.3 | Core database tables — users, roles, sessions, consent_records, audit_log | ✦ | — | — | I-0.1.2 | Foundation tables referenced by every module. All timestamps stored as UTC with IST display in frontend. |
| 5 ✅ | I-0.1.5 | Redis client setup — namespaced connections (sess:, bull:, rl:, cache:, otp:) | ✦ | — | — | I-0.1.4 | `apps/api/src/lib/redis.ts`, `volatile-lru` eviction policy. Needs running Redis from Docker Compose. |
| 6 ✅ | I-0.1.6 | BullMQ queue infrastructure — queue definitions, worker service skeleton, DLQ pattern | ✦ | — | — | I-0.1.5 | Queues: payment-webhook, email, cleanup, exports. Custom failed-jobs queue with alerting via `failed` event handler. Replay tooling for DLQ items. |
| 7 | I-0.1.8 | Object storage client — S3/R2 presigned URL helper, server-side encryption, access logging | ✦ | — | — | I-0.1.3 | Used by KYC upload (Phase 1), event images (Phase 1), roster PDFs (Phase 5). Access log entries written to audit_log table. |
| 8 | I-0.1.7 | Database migration CI pipeline | ✦ | — | — | I-0.1.2, I-0.1.3 | Expand/contract pattern, rollback SQL, lock-risk assessment. CI validates what's already working locally. |
| 9 | I-0.1.9 | CI/CD deployment pipeline — GitHub Actions for build, test, migrate, deploy | ✦ | ✦ | — | All above | Staging auto-deploy from `main`, production manual promote. Rolling/blue-green with health-checked promotion. |

**Deliverables:**
- `packages/shared` with base Zod schemas, types, phone normalization (E.164)
- PostgreSQL + Redis running locally via Docker Compose
- `packages/db` with Drizzle schema, migration tooling, seed scripts
- Core database tables deployed and tested
- Redis client with namespaced connections
- BullMQ queue definitions with DLQ pattern ready for consumers
- Object storage client with presigned URLs and access logging
- Database migration CI pipeline
- CI/CD pipeline deploying to staging

### Module 0.2: Authentication & Identity

*Covers requirements F-0.2.1 through F-0.2.4*

**Implementation order:** Items are sequenced by dependency. Cross-module dependencies noted explicitly.

| Order | ID | Feature | Backend | Frontend | Shared | Depends on | Notes |
|-------|----|---------|---------|----------|--------|------------|-------|
| 1 | I-0.2.12 | Security headers — CSP, X-Frame-Options, X-Content-Type-Options | ✦ | ✦ | — | — | Fastify helmet plugin + TanStack Start response headers. No auth deps, do first. |
| 2 | I-0.2.1 | OTP send (phone → MSG91) with WhatsApp OTP fallback | ✦ | — | ✦ | **I-0.1.1**, **I-0.1.5** | Rate limited: 1/phone/60s. Redis OTP storage with 5-min TTL. WhatsApp OTP delivery as fallback for SMS failures. |
| 3 | I-0.2.2 | OTP verify → session creation | ✦ | — | ✦ | I-0.2.1, **I-0.1.5** | Redis session (sess:), cookie: `eventkart_session`, HttpOnly, Secure, SameSite=Lax, Domain=.eventkart.app, 30-day TTL |
| 4 | I-0.2.3 | Session middleware — decorates `request.session` | ✦ | — | — | I-0.2.2 | Fastify plugin, session from Redis |
| 5 | I-0.2.8 | Logout endpoint — clear session | ✦ | — | — | I-0.2.3 | `POST /api/v1/auth/logout`. Simple, build alongside session middleware. |
| 6 | I-0.2.11 | CSRF protection — anti-CSRF token on state-changing requests | ✦ | ✦ | — | I-0.2.3 | SameSite cookies + CSRF token validation |
| 7 | I-0.2.4 | Role-based access control (public, participant, organizer, admin) | ✦ | — | ✦ | I-0.2.3, **I-0.1.3** | `requireAuth`, `requireRole('organizer')`, `requireRole('admin')` middleware. Needs users table. |
| 8 | I-0.2.10 | Internal API key for server-to-server calls | ✦ | ✦ | — | I-0.2.3 | `X-Internal-Key` header, higher rate limits (1000/min) |
| 9 | I-0.2.6 | Admin IP allowlist middleware | ✦ | — | — | I-0.2.4 | Architecture §6: "Admin: Phone OTP + IP allowlist during pilot." Configurable allowlist via env var. |
| 10 | I-0.2.5 | Organizer email verification | ✦ | ✦ | ✦ | I-0.2.4 | Architecture §6: "Organizer: Phone OTP + email verification." Elevated role assigned after email verification + admin approval. |
| 11 | I-0.2.9 | Session forwarding for SSR — TanStack Start forwards cookie in server-to-server calls | — | ✦ | — | I-0.2.3, **I-0.3.6** | `X-Request-ID` propagation, `INTERNAL_API_URL` for SSR. **Cross-dep on Module 0.3 API client.** |
| 12 | I-0.2.7 | Deferred authentication pattern — browsing unauthenticated, OTP at booking | ✦ | ✦ | — | I-0.2.1, I-0.2.2, **I-0.3.1** | Frontend routing respects auth state; booking flow triggers OTP. **Cross-dep on Module 0.3 layout shell.** |

**Deliverables:**
- Security headers on both Fastify and TanStack Start
- Working OTP send/verify flow via MSG91 (with WhatsApp fallback)
- Redis-backed session management with logout
- CSRF protection on state-changing requests
- RBAC middleware for all three roles
- Admin IP allowlist enforcement
- Organizer email verification flow
- Internal API key for SSR calls
- SSR session forwarding from TanStack Start
- Deferred auth pattern for unauthenticated browsing
- Auth-related Zod schemas in `packages/shared`

### Module 0.3: Design System & App Shell

*Covers requirements F-0.3.1 through F-0.3.4*

**Implementation order:** Steps 1–3 have no cross-module dependencies and can start in parallel with Module 0.2. Step 6 must wait for Module 0.2 RBAC.

| Order | ID | Feature | Backend | Frontend | Shared | Depends on | Notes |
|-------|----|---------|---------|----------|--------|------------|-------|
| 1 | I-0.3.6 | API client setup — hybrid communication (INTERNAL_API_URL for SSR, public for browser) | — | ✦ | — | — | `apps/web/src/lib/api-client.ts`. Foundation for all frontend-API communication. |
| 2 | I-0.3.1 | Mobile-first responsive layout shell | — | ✦ | — | — | `__root.tsx`, `_public` layout (SSR), `_authed` layout (CSR). Can parallel with I-0.3.6. |
| 3 | I-0.3.2 | Core UI component library — buttons, forms, cards, modals, navigation, toasts | — | ✦ | — | — | shadcn/ui v4 components in `apps/web/src/components` and `packages/ui`. Can parallel with I-0.3.1. |
| 4 | I-0.3.4 | Error handling patterns — error boundaries, 404, API error display | — | ✦ | — | I-0.3.1, I-0.3.6 | Consistent error UI across all surfaces |
| 5 | I-0.3.5 | Loading state patterns — skeleton screens, spinners, optimistic UI foundations | — | ✦ | — | I-0.3.1 | Consistent loading UX |
| 6 | I-0.3.3 | Role-based routing and navigation structure | — | ✦ | — | I-0.3.1, **I-0.2.4** | `/` public, `/org/*` organizer, `/admin/*` admin, `/my/*` participant. **Cross-dep on Module 0.2 RBAC middleware.** |

**Deliverables:**
- API client with hybrid SSR/browser communication
- Fully functional app shell with responsive layouts
- Core shadcn/ui components configured and styled
- Error and loading state patterns established
- Role-based routing and navigation (after RBAC is ready)

### Module 0.4: Observability, Metrics & Error Infrastructure

*Covers infrastructure requirements from architecture §4.3, §4.4, §4.5*

**Implementation order:** Steps 1–2 have no cross-module dependencies and can start in parallel with Modules 0.2/0.3. Steps 3–6 require Module 0.1 infrastructure.

| Order | ID | Feature | Backend | Frontend | Shared | Depends on | Notes |
|-------|----|---------|---------|----------|--------|------------|-------|
| 1 | I-0.4.2 | Pino structured logging with request correlation IDs + OpenTelemetry bridge | ✦ | — | — | — | `X-Request-ID` in every log line. Pino + OpenTelemetry bridge for log↔trace correlation. Foundation for all observability. |
| 2 | I-0.4.1 | Sentry integration — separate projects for client-side, SSR server, API server | ✦ | ✦ | — | — | Source maps, error tracking. Can parallel with I-0.4.2. |
| 3 | I-0.4.3 | Health check endpoints — Fastify (`GET /health`, `GET /ready`) + TanStack Start (`GET /health`) | ✦ | ✦ | — | **I-0.1.2**, **I-0.1.5** | Fastify: PostgreSQL + Redis checks. TanStack Start: SSR rendering + Fastify API reachability. |
| 4 | I-0.4.4 | Audit log table and logging utility | ✦ | — | — | **I-0.1.3** | actor_id, action, resource_type, resource_id, metadata JSONB, ip_address, created_at. Needs audit_log table from core tables. |
| 5 | I-0.4.5 | Production metrics emitter — booking RPS, payment latency, webhook ACK latency, queue depth, DB pool wait, Redis usage | ✦ | — | — | I-0.4.2, **I-0.1.5** | Architecture §4.3: track from day one. Include conversion funnel events (page view → OTP → booking → payment). |
| 6 | I-0.4.6 | BullMQ observability — queue depth, oldest job age, retry count, DLQ count per queue | ✦ | — | — | I-0.4.2, **I-0.1.6** | Wire BullMQ v5.71+ native OpenTelemetry support. Needs BullMQ infrastructure from Module 0.1. |

**Deliverables:**
- Structured logging with request correlation and OpenTelemetry bridge
- Sentry error tracking on all three surfaces
- Health/readiness endpoints for Railway auto-scaling (both services)
- Audit log infrastructure ready for all modules
- Production metrics pipeline for day-one observability
- BullMQ queue observability with DLQ alerting

### Phase 0 Execution Strategy — Solo Developer

For a single developer, the recommended execution order groups work into **waves** that respect cross-module dependencies while minimizing context-switching.

**Wave 1 — Foundation (Module 0.1, steps 1–5)**
Purely sequential. Must complete before anything else can meaningfully start.

```
I-0.1.1 shared → I-0.1.4 docker → I-0.1.2 drizzle → I-0.1.3 tables → I-0.1.5 redis
```

**Wave 2 — Auth core + App shell + Observability foundation (Modules 0.2 + 0.3 + 0.4, early steps)**
After Wave 1, three tracks unlock. As a solo dev, work through them sequentially by track, but switch tracks at natural break points.

Recommended sub-order:
1. `I-0.2.12` Security headers *(quick win, independent)*
2. `I-0.4.2` Pino logging *(sets up correlation IDs used everywhere)*
3. `I-0.4.1` Sentry *(error tracking from this point on)*
4. `I-0.3.6` API client *(foundation for all frontend-API calls)*
5. `I-0.3.1` Layout shell *(app skeleton)*
6. `I-0.3.2` UI components *(needed by all frontend features)*
7. `I-0.2.1` → `I-0.2.2` → `I-0.2.3` OTP + session *(core auth chain)*
8. `I-0.2.8` Logout *(trivial, build with session middleware)*
9. `I-0.2.11` CSRF *(needs session middleware)*
10. `I-0.2.4` RBAC *(needs session + users table)*
11. `I-0.2.10` Internal API key *(needs session middleware)*

**Wave 3 — Remaining Module 0.1 + cross-dependent items**
Complete the rest of Module 0.1 and items that have cross-module deps:

1. `I-0.1.6` BullMQ *(needs Redis from Wave 1)*
2. `I-0.1.8` Object storage *(needs audit_log from Wave 1)*
3. `I-0.4.3` Health checks *(needs DB + Redis from Wave 1)*
4. `I-0.4.4` Audit log utility *(needs audit_log table from Wave 1)*
5. `I-0.3.4` Error handling *(needs layout + API client from Wave 2)*
6. `I-0.3.5` Loading states *(needs layout from Wave 2)*
7. `I-0.2.6` Admin IP allowlist *(needs RBAC from Wave 2)*
8. `I-0.2.5` Organizer email verification *(needs RBAC from Wave 2)*

**Wave 4 — Cross-module finishers + CI**
Items that depend on multiple modules being complete:

1. `I-0.3.3` Role-based routing *(needs RBAC from 0.2 + layout from 0.3)*
2. `I-0.2.9` SSR session forwarding *(needs session middleware + API client)*
3. `I-0.2.7` Deferred auth pattern *(needs OTP flow + layout shell)*
4. `I-0.4.5` Production metrics *(needs Pino + Redis)*
5. `I-0.4.6` BullMQ observability *(needs BullMQ + Pino)*
6. `I-0.1.7` Migration CI pipeline *(validates local work)*
7. `I-0.1.9` CI/CD pipeline *(final, validates everything)*

```
Wave 1 (sequential)       Wave 2 (sequential)          Wave 3 (sequential)       Wave 4 (sequential)
─────────────────────     ──────────────────────────    ─────────────────────     ─────────────────────
I-0.1.1 shared            I-0.2.12 security headers    I-0.1.6 BullMQ            I-0.3.3 role routing
I-0.1.4 docker            I-0.4.2 Pino logging         I-0.1.8 object storage    I-0.2.9 SSR forwarding
I-0.1.2 drizzle           I-0.4.1 Sentry               I-0.4.3 health checks     I-0.2.7 deferred auth
I-0.1.3 tables            I-0.3.6 API client            I-0.4.4 audit log util    I-0.4.5 metrics
I-0.1.5 redis             I-0.3.1 layout shell          I-0.3.4 error handling    I-0.4.6 BullMQ obs
                           I-0.3.2 UI components         I-0.3.5 loading states    I-0.1.7 migration CI
                           I-0.2.1 OTP send              I-0.2.6 admin IP          I-0.1.9 CI/CD
                           I-0.2.2 OTP verify            I-0.2.5 email verify
                           I-0.2.3 session middleware
                           I-0.2.8 logout
                           I-0.2.11 CSRF
                           I-0.2.4 RBAC
                           I-0.2.10 internal API key
```

**Validate after each wave:** Run `check-types`, `lint`, and `test` for all affected workspaces before moving to the next wave.

---

## Phase 1: Organizer Onboarding & Event Creation

**Goal:** Enable organizers to sign up, get verified, and create publishable events. This is the supply side — without events, nothing else works.

**Why second:** The entire product depends on having organizers and events in the system. Participants can't book what doesn't exist.

**Prerequisites:** Phase 0 (auth, database, app shell, shared packages).

### Module 1.1: Organizer Signup & Verification

*Covers requirements F-1.1.1 through F-1.1.6*

**Implementation order:** Registration form is the foundation. Document upload and policy acceptance extend it. Admin review and approval actions come last.

| Order | ID | Feature | Backend | Frontend | Shared | Depends on | Notes |
|-------|----|---------|---------|----------|--------|------------|-------|
| 1 | I-1.1.1 | Organizer registration form — business name, contact details, city | ✦ | ✦ | ✦ | **I-0.1.1**, **I-0.1.3**, **I-0.2.4** | `POST /api/v1/organizers`, Zod schema in shared. Creates `organizers` table + migration. |
| 2 | I-1.1.3 | Policy acceptance workflow — platform terms, refund policy framework | ✦ | ✦ | ✦ | I-1.1.1, **I-0.1.3** | Consent versioning, no pre-checked boxes. Uses `consent_records` table from Phase 0. Can parallel with I-1.1.2. |
| 3 | I-1.1.2 | Verification document upload — Aadhaar, PAN, GST certificate, bank proof | ✦ | ✦ | — | I-1.1.1, **I-0.1.8** | Upload to S3/R2 via presigned URLs, server-side encryption at rest, access logged. Can parallel with I-1.1.3. |
| 4 | I-1.1.8 | Organizer profile management — view and edit organizer profile | ✦ | ✦ | ✦ | I-1.1.1, **I-0.3.3** | `/org/profile` route. Business name, description, city. Separate from the public-facing profile (Phase 2). |
| 5 | I-1.1.4 | Verification status tracking — pending → approved/rejected | ✦ | ✦ | ✦ | I-1.1.1, I-1.1.2, I-1.1.3 | Target 2-business-day SLA from complete submission. Status enum in shared package. |
| 6 | I-1.1.5 | Admin verification review interface — approve/reject with notes | ✦ | ✦ | — | I-1.1.4, **I-0.3.3**, **I-0.4.4** | `/admin/verifications` route, logged access to KYC docs. Needs role-based routing + audit log. |
| 7 | I-1.1.6 | Verification badge assignment on approval | ✦ | ✦ | — | I-1.1.5 | Paid-event publishing eligibility gated by verification. Triggered by admin approval action. |
| 8 | I-1.1.7 | Razorpay Route linked-account creation + KYC sync | ✦ | — | — | I-1.1.5 | On admin approval, create Razorpay Route sub-merchant linked account. Persist `razorpay_account_id` on `organizers` table. Gate event publishing (I-1.2.6) on this. **Required for the locked commercial model (product plan §7).** Can parallel with I-1.1.6. |

**Database tables:** `organizers`, `organizer_verifications`, `verification_documents`, `policy_acceptances`

### Module 1.2: Event Creation & Management

*Covers requirements F-1.2.1 through F-1.2.8*

**Implementation order:** Slug generation and event creation are the foundation. Category, pricing, form fields, and policy extend the event. Publish workflow and admin review gate the event for public visibility.

| Order | ID | Feature | Backend | Frontend | Shared | Depends on | Notes |
|-------|----|---------|---------|----------|--------|------------|-------|
| 1 | I-1.2.10 | Slug generation for events — unique, URL-safe, with redirect on edit | ✦ | — | ✦ | **I-0.1.1**, **I-0.1.3** | Uniqueness constraint, slug change creates redirect from old slug. Build slug utility before event creation. |
| 2 | I-1.2.1 | Event creation form — V1-allowed events only (single-day, paid running, Coimbatore) | ✦ | ✦ | ✦ | I-1.2.10, **I-1.1.1**, **I-0.3.3** | `POST /api/v1/events`, structured form with validation. Creates `events` table + migration. Organizer must exist. |
| 3 | I-1.2.2 | Event category & distance configuration — 5K, 10K, half-marathon | ✦ | ✦ | ✦ | I-1.2.1 | Categories stored as structured data on event. Creates `event_categories` table. |
| 4 | I-1.2.3 | Pricing configuration — per category, early-bird support | ✦ | ✦ | ✦ | I-1.2.2 | `{ category, base_price, early_bird_price, early_bird_deadline }`. Server-side price validation at booking time (no client-side price trust). Creates `event_pricing_tiers` table. |
| 5 | I-1.2.4 | Registration form field configuration — standard + fitness-specific fields | ✦ | ✦ | ✦ | I-1.2.1 | JSONB form_schema with version, sensitive fields opt-in by default. Can parallel with I-1.2.3. |
| 6 | I-1.2.5 | Refund & cancellation policy capture per event | ✦ | ✦ | ✦ | I-1.2.1 | Stored alongside event, displayed before booking. Can parallel with I-1.2.3 and I-1.2.4. |
| 7 | I-1.2.9 | Event image upload — hero image, route map | ✦ | ✦ | — | I-1.2.1, **I-0.1.8** | Upload to S3/R2 via presigned URLs. Architecture §3.5 lists event images as required object storage content. Can parallel with I-1.2.3–I-1.2.5. |
| 8 | I-1.2.8 | Event edit & update capabilities (pre-event) | ✦ | ✦ | ✦ | I-1.2.1 through I-1.2.5, I-1.2.9 | CDN cache invalidation on update (Cloudflare API purge). Needs all event fields to exist before edit can cover them. |
| 9 | I-1.2.6 | Event publish workflow — draft → under review → published | ✦ | ✦ | ✦ | I-1.2.1 through I-1.2.5, **I-1.1.6**, **I-1.1.7** | Gated by organizer verification AND Razorpay linked-account for paid events. |
| 10 | I-1.2.7 | Admin event review interface — manual review for first 3 paid events from new organizers | ✦ | ✦ | — | I-1.2.6, **I-0.3.3**, **I-0.4.4** | `/admin/event-reviews` route. Needs role-based routing + audit log. |

**Database tables:** `events`, `event_categories`, `event_pricing_tiers`

**Key schema decisions:**
- JSONB column for organizer-configured form fields with `form_schema_version`
- Early-bird pricing as array of pricing tiers
- Composite indexes: `(event_id, status, created_at)`
- Slug uniqueness constraint with redirect table for changed slugs

### Phase 1 Execution Strategy — Solo Developer

Module 1.1 must largely complete before Module 1.2 can start (events belong to organizers). Work in 3 waves:

**Wave 1 — Organizer registration + extensions**
Build the organizer entity and the three things that extend registration (doc upload, policy, profile).

1. `I-1.1.1` Organizer registration form *(creates `organizers` table, the foundation)*
2. `I-1.1.3` Policy acceptance *(extends registration — consent records)*
3. `I-1.1.2` Verification document upload *(extends registration — needs object storage)*
4. `I-1.1.8` Organizer profile management *(organizer self-service `/org/profile`)*

**Wave 2 — Verification pipeline + event foundation**
Verification status tracking enables the admin review pipeline. Slug generation and event creation can start once organizers exist.

1. `I-1.1.4` Verification status tracking *(needs registration + docs + policy)*
2. `I-1.1.5` Admin verification review *(needs status tracking + audit log)*
3. `I-1.1.6` Verification badge *(triggered by admin approval)*
4. `I-1.1.7` Razorpay linked-account *(triggered by admin approval, parallel with I-1.1.6)*
5. `I-1.2.10` Slug generation *(utility, no 1.1 deps beyond shared/DB — parallel with I-1.1.4+)*

**Wave 3 — Event creation, configuration & publishing**
Build the event form and all its extensions, then the publish/review pipeline.

1. `I-1.2.1` Event creation form *(creates `events` table — needs organizer from Wave 1)*
2. `I-1.2.2` Event category config *(extends events — `event_categories` table)*
3. `I-1.2.3` Pricing config *(extends categories — `event_pricing_tiers` table)*
4. `I-1.2.4` Registration form field config *(extends events — JSONB, parallel with I-1.2.3)*
5. `I-1.2.5` Refund policy capture *(extends events, parallel with I-1.2.3/I-1.2.4)*
6. `I-1.2.9` Event image upload *(extends events — needs object storage, parallel with I-1.2.3-5)*
7. `I-1.2.8` Event edit/update *(needs all event fields to exist)*
8. `I-1.2.6` Event publish workflow *(needs verification badge + Razorpay account from Wave 2)*
9. `I-1.2.7` Admin event review *(needs publish workflow)*

```
Wave 1 (sequential)           Wave 2 (sequential)              Wave 3 (sequential)
──────────────────────────    ──────────────────────────────    ──────────────────────────────
I-1.1.1 organizer reg         I-1.1.4 verification tracking    I-1.2.1 event creation form
I-1.1.3 policy acceptance     I-1.1.5 admin review             I-1.2.2 category config
I-1.1.2 doc upload            I-1.1.6 verification badge       I-1.2.3 pricing config
I-1.1.8 organizer profile     I-1.1.7 razorpay account (∥)     I-1.2.4 form field config (∥)
                               I-1.2.10 slug generation (∥)     I-1.2.5 refund policy (∥)
                                                                 I-1.2.9 image upload (∥)
                                                                 I-1.2.8 event edit
                                                                 I-1.2.6 publish workflow
                                                                 I-1.2.7 admin event review
```

**(∥) = can run in parallel with the item above it for a multi-developer team, but for solo dev, proceed sequentially.*

**Validate after each wave:** Run `check-types`, `lint`, and `test` for all affected workspaces.

---

## Phase 2: Event Discovery & Public Pages

**Goal:** Make published events discoverable and present them professionally. These are the SEO-critical, CDN-cached surfaces that organizers will share and participants will land on.

**Why third:** Events must exist (Phase 1) before they can be displayed. These public pages are what drives participant discovery.

**Prerequisites:** Phase 1 (events must exist in the system).

### Module 2.1: Event Detail Page

*Covers requirements F-2.1.1 through F-2.1.8*

**Implementation order:** The page layout is the foundation. Sections, SEO, and CTA extend it. I-2.1.8 (mobile-first design) is not a separate step — it's a constraint applied while building I-2.1.1.

| Order | ID | Feature | Backend | Frontend | Shared | Depends on | Notes |
|-------|----|---------|---------|----------|--------|------------|-------|
| 1 | I-2.1.1 | Professional event page layout — route, categories, pricing, timing, location, hero image, route map | ✦ | ✦ | — | **I-1.2.1**, **I-1.2.2**, **I-1.2.3**, **I-1.2.9** | SSR with `ssr: true`, CDN `s-maxage` + `stale-while-revalidate`. Route: `/events/:slug`. |
| — | I-2.1.8 | Mobile-first responsive event page design | — | ✦ | — | I-2.1.1 | **Implemented as part of I-2.1.1** — not a separate step. Optimized for mobile browsers. |
| 2 | I-2.1.2 | Organizer info section with verification badge | ✦ | ✦ | — | I-2.1.1, **I-1.1.1**, **I-1.1.6** | Link to organizer profile (wired to I-2.3.1 when built). |
| 3 | I-2.1.3 | Policy display — refund, cancellation policies visible before booking | — | ✦ | — | I-2.1.1, **I-1.2.5** | Trust information alongside organizer identity. Can parallel with I-2.1.2. |
| 4 | I-2.1.4 | Category & pricing breakdown display | — | ✦ | — | I-2.1.1, **I-1.2.3** | Early-bird pricing with deadline display. Can parallel with I-2.1.2/I-2.1.3. |
| 5 | I-2.1.5 | Share-optimized previews — Open Graph meta tags | — | ✦ | — | I-2.1.1 | Social/messaging share optimization. Can parallel with I-2.1.6. |
| 6 | I-2.1.6 | Structured data markup — JSON-LD for search discovery | — | ✦ | — | I-2.1.1 | Schema.org Event markup. Can parallel with I-2.1.5. |
| 7 | I-2.1.7 | "Register Now" CTA linking to booking flow | — | ✦ | — | I-2.1.1 | Prominent, mobile-first call-to-action. Links to Phase 3 booking flow (placeholder until Phase 3). |

### Module 2.2: Event Discovery Surface

*Covers requirements F-2.2.1 through F-2.2.4*

**Implementation order:** Status enum first (shared), then card component, then listing page, then sort/pagination.

| Order | ID | Feature | Backend | Frontend | Shared | Depends on | Notes |
|-------|----|---------|---------|----------|--------|------------|-------|
| 1 | I-2.2.3 | Event status indicators — upcoming, registration open/closed, sold out | ✦ | ✦ | ✦ | **I-0.1.1** | Status enum in shared package. Foundation for cards and listing. |
| 2 | I-2.2.2 | Event cards — name, date, location, price range, categories | — | ✦ | — | I-2.2.3 | Compact card component. Reusable across listing and organizer profile. |
| 3 | I-2.2.1 | Launch-city event listing page (Coimbatore) | ✦ | ✦ | — | I-2.2.2, I-2.2.3, **I-1.2.1** | SSR with `ssr: true`, CDN-cacheable, `/` route. API endpoint for published events. |
| 4 | I-2.2.4 | Sort by date (default: upcoming first) | ✦ | ✦ | — | I-2.2.1 | URL-state pagination and sort in search params. |

### Module 2.3: Organizer Public Profile

*Covers requirements F-2.3.1 through F-2.3.4*

**Implementation order:** Slug generation first (utility), then profile page, then sub-sections.

| Order | ID | Feature | Backend | Frontend | Shared | Depends on | Notes |
|-------|----|---------|---------|----------|--------|------------|-------|
| 1 | I-2.3.5 | Organizer slug generation — unique, URL-safe | ✦ | — | ✦ | **I-0.1.1**, **I-1.1.1** | Uniqueness constraint, redirect on change. Build slug utility before profile page. |
| 2 | I-2.3.1 | Organizer profile page — business name, description, verification badge | ✦ | ✦ | — | I-2.3.5, **I-1.1.1**, **I-1.1.6** | SSR with `ssr: true`, `/organizers/:slug`. |
| 3 | I-2.3.4 | Verification status explanation copy | — | ✦ | — | I-2.3.1 | Describes verification as onboarding check, not quality guarantee. Can parallel with I-2.3.2. |
| 4 | I-2.3.2 | Upcoming events listing on organizer profile | ✦ | ✦ | — | I-2.3.1, **I-1.2.1** | Query events by organizer. Reuses event card component from I-2.2.2 if available. |
| 5 | I-2.3.3 | Past event history on organizer profile | ✦ | ✦ | — | I-2.3.1, **I-1.2.1** | Builds organizer credibility. Can parallel with I-2.3.2. |

### Module 2.4: CDN & Cache Infrastructure

*Covers architecture §1, §4.2 requirements for CDN caching and invalidation*

**Implementation order:** CDN setup first, then invalidation, then stampede prevention. This module should be built after at least one SSR page exists (Module 2.1 or 2.2).

| Order | ID | Feature | Backend | Frontend | Shared | Depends on | Notes |
|-------|----|---------|---------|----------|--------|------------|-------|
| 1 | I-2.4.1 | Cloudflare CDN setup — DNS, SSL, caching rules for SSR pages | — | ✦ | — | **I-2.1.1** or **I-2.2.1** | Cache SSR event pages at edge, static assets, DDoS protection. Needs at least one SSR page to configure and test against. |
| 2 | I-2.4.2 | CDN cache invalidation — Cloudflare API purge on event publish/unpublish, pricing changes, capacity changes, admin moderation | ✦ | — | — | I-2.4.1, **I-1.2.6** | Purge specific cache keys when event data changes. |
| 3 | I-2.4.3 | Cache stampede prevention — single-flight/Redis locking for popular event pages | ✦ | — | — | I-2.4.1, **I-0.1.5** | Architecture §1: prevents origin overload when cache expires on popular events. |

**SSR & Caching:** Event pages use `ssr: true` with CDN caching via `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`. Cache invalidation triggers are explicit and automated.

### Phase 2 Execution Strategy — Solo Developer

Modules 2.1, 2.2, and 2.3 are **independent of each other** — they all read from Phase 1 data but have no cross-dependencies. Module 2.4 (CDN) depends on SSR pages from 2.1/2.2 existing. For a solo dev, work through them sequentially by module.

**Wave 1 — Event status enum + Event detail page**
Start with the shared status enum (used by both 2.1 and 2.2), then build the highest-value page first.

1. `I-2.2.3` Event status indicators *(shared enum — used across all modules)*
2. `I-2.1.1` + `I-2.1.8` Event page layout *(core SSR page, mobile-first)*
3. `I-2.1.2` Organizer info section
4. `I-2.1.3` Policy display
5. `I-2.1.4` Pricing breakdown
6. `I-2.1.5` OG meta tags
7. `I-2.1.6` JSON-LD structured data
8. `I-2.1.7` "Register Now" CTA

**Wave 2 — Discovery listing + Organizer profile**
Build the listing page (reuses event card component) and organizer profile.

1. `I-2.2.2` Event cards *(reusable component)*
2. `I-2.2.1` Event listing page *(uses cards + status enum)*
3. `I-2.2.4` Sort by date
4. `I-2.3.5` Organizer slug generation
5. `I-2.3.1` Organizer profile page
6. `I-2.3.4` Verification explanation
7. `I-2.3.2` Upcoming events listing *(reuses event card from I-2.2.2)*
8. `I-2.3.3` Past event history

**Wave 3 — CDN & Cache**
Infrastructure that requires SSR pages to already exist.

1. `I-2.4.1` Cloudflare CDN setup
2. `I-2.4.2` Cache invalidation
3. `I-2.4.3` Cache stampede prevention

```
Wave 1 (sequential)           Wave 2 (sequential)              Wave 3 (sequential)
──────────────────────────    ──────────────────────────────    ──────────────────────
I-2.2.3 status enum           I-2.2.2 event cards              I-2.4.1 CDN setup
I-2.1.1 event page layout     I-2.2.1 listing page             I-2.4.2 cache invalidation
I-2.1.2 organizer section     I-2.2.4 sort by date             I-2.4.3 stampede prevention
I-2.1.3 policy display        I-2.3.5 organizer slug
I-2.1.4 pricing breakdown     I-2.3.1 organizer profile
I-2.1.5 OG meta tags          I-2.3.4 verification copy
I-2.1.6 JSON-LD               I-2.3.2 upcoming events
I-2.1.7 register CTA          I-2.3.3 past events
```

**Validate after each wave:** Run `check-types`, `lint`, and `test` for all affected workspaces.

---

## Phase 3: Registration, Payment & Booking

**Goal:** The core value proposition — a unified registration + payment flow that eliminates the Google Forms + payment link mismatch.

**Why fourth:** Requires events to exist (Phase 1) and event pages to be live (Phase 2). This is the single most important product flow and the key revenue driver.

**Prerequisites:** Phase 2 (event pages to land on), Phase 0 auth (OTP for identity).

### Module 3.1: Registration Flow

*Covers requirements F-3.1.1 through F-3.1.6*

**Implementation order:** Category selection and validation first (pure frontend), then registration form, then consent and auth integration, then auto-fill (needs participant profile from Module 3.4).

| Order | ID | Feature | Backend | Frontend | Shared | Depends on | Notes |
|-------|----|---------|---------|----------|--------|------------|-------|
| 1 | I-3.1.1 | Category selection step — pick distance/category | — | ✦ | — | **I-1.2.2**, **I-2.1.1** | Dynamic based on event configuration. Entry point to booking flow. |
| 2 | I-3.1.5 | Form validation with clear error messaging | — | ✦ | ✦ | **I-0.1.1** | Shared Zod schema, `zodValidator()` adapter. Build validation layer before form. |
| 3 | I-3.1.2 | Registration form with pre-configured fields | ✦ | ✦ | ✦ | I-3.1.1, I-3.1.5, **I-1.2.4** | TanStack Form + Zod from shared, fitness-specific fields. Core form implementation. |
| 4 | I-3.1.6 | Consent capture at submission — booking terms, data usage, marketing (separate) | ✦ | ✦ | ✦ | I-3.1.2, **I-0.1.3** | Three distinct consent types per architecture §6. booking_terms and data_usage required; marketing optional (separate checkbox, not bundled). Consent versioning, no pre-checked boxes, server-side enforcement. |
| 5 | I-3.1.3 | OTP verification triggered at form submission | ✦ | ✦ | — | I-3.1.2, **I-0.2.1**, **I-0.2.7** | Deferred auth pattern — triggers OTP flow. Wires registration to auth. |
| 6 | I-3.1.4 | Auto-fill from saved participant profile | ✦ | ✦ | — | I-3.1.2, **I-3.4.1** | Pre-fill for returning participants. **Cross-dep on Module 3.4 participant profile.** Build after I-3.4.1. |

**Key pattern:** Registration form uses shared Zod schemas from `packages/shared`. Async phone uniqueness validation (debounced). TanStack Form v1 with `zodValidator()`.

### Module 3.2: Payment Integration

*Covers requirements F-3.2.1 through F-3.2.6*

**Implementation order:** Payment status enum and capacity reservation first (DB foundations), then Razorpay order creation, then client-side checkout, then webhook pipeline, then resilience (reconciliation, backpressure).

| Order | ID | Feature | Backend | Frontend | Shared | Depends on | Notes |
|-------|----|---------|---------|----------|--------|------------|-------|
| 1 | I-3.2.4 | Payment status tracking — initiated, success, failed, refunded | ✦ | ✦ | ✦ | **I-0.1.1** | Immutable payment records table. Status enum in shared. DB foundation for all payment features. |
| 2 | I-3.2.10 | Capacity reservation — atomic DB update with 15-min expiry | ✦ | — | — | **I-0.1.3**, **I-1.2.3** | `UPDATE ... SET spots_remaining = spots_remaining - 1 WHERE spots_remaining > 0`. Expired reservations reclaimed by BullMQ repeatable job. |
| 3 | I-3.2.1 | Razorpay Route integration — payment-time split with organizer-linked settlement | ✦ | ✦ | — | I-3.2.4, I-3.2.10, **I-1.1.7** | Create Razorpay order using organizer's `razorpay_account_id`, return checkout token. Core booking endpoint: `POST /api/v1/bookings`. |
| 4 | I-3.2.3 | Split payout configuration — EventKart fee at payment time | ✦ | — | — | I-3.2.1 | Razorpay Route split, remainder to organizer's linked account. |
| 5 | I-3.2.6 | Free pilot period handling — first 3 events: no platform fee split | ✦ | — | — | I-3.2.3, **I-1.1.1** | Per-organizer event counter. Can parallel with I-3.2.2. |
| 6 | I-3.2.2 | UPI + card payment support | — | ✦ | — | I-3.2.1 | Client-side Razorpay SDK handles checkout UI. Can parallel with I-3.2.3. |
| 7 | I-3.2.5 | Payment failure handling with retry flow | ✦ | ✦ | — | I-3.2.1, I-3.2.2 | Clear retry UX, idempotent backend. |
| 8 | I-3.2.7 | Razorpay webhook handler — signature verification, BullMQ enqueue, 5s ACK | ✦ | — | — | I-3.2.1, **I-0.1.6** | `POST /api/v1/bookings/payment/callback`, HMAC SHA256. ACK immediately, process async. |
| 9 | I-3.2.8 | Webhook idempotency — webhook_events table, unique razorpay_payment_id | ✦ | — | — | I-3.2.7 | Dedup via provider event ID. Process through booking state machine with row-level locking. |
| 10 | I-3.2.9 | Payment reconciliation job — periodic Razorpay API poll for stuck payments | ✦ | — | — | I-3.2.7, I-3.2.8, **I-0.1.6** | BullMQ repeatable job every 5 min, catches lost webhooks. |
| 11 | I-3.2.11 | Booking endpoint backpressure / waiting-room mode | ✦ | ✦ | — | I-3.2.1, **I-0.1.5** | Architecture §1: when Redis queue depth, job age, DB pool wait, or provider error rate cross thresholds, return controlled "registration busy, retry shortly" response. Optional waiting-room mode for burst events. Per-event rate limiting (sliding window counters per event + per IP). |

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

**Implementation order:** Booking status enum and email service first (independent foundations), then booking confirmation (needs webhook worker from 3.2), then QR generation, then confirmation page and email.

| Order | ID | Feature | Backend | Frontend | Shared | Depends on | Notes |
|-------|----|---------|---------|----------|--------|------------|-------|
| 1 | I-3.3.6 | Booking status management — confirmed, cancelled, refunded, checked-in | ✦ | ✦ | ✦ | **I-0.1.1** | Status enum in shared package. Foundation for booking state machine. |
| 2 | I-3.3.1 | Email service integration and template system | ✦ | — | — | **I-0.1.6** | Resend (default) + SES fallback for burst. React Email templates. Batch API for burst confirmations. **No dependency on payment flow — build early.** |
| 3 | I-3.3.2 | Booking record creation on successful payment | ✦ | — | — | I-3.3.6, **I-3.2.7**, **I-3.2.8** | State machine: pending → confirmed (via webhook worker). Wires payment to booking. |
| 4 | I-3.3.4 | QR code generation — HMAC-signed booking token | ✦ | ✦ | — | I-3.3.2 | Token: booking_id, event_id, ticket_version, exp, kid, jti. **Client renders QR on-demand for confirmation page; email worker generates QR image inline (server-side, e.g., `qrcode` npm package) since email clients don't execute JavaScript.** |
| 5 | I-3.3.3 | Booking confirmation page with summary | — | ✦ | — | I-3.3.2, I-3.3.4, **I-2.1.1** | `/book/:eventId/confirmation`. QR rendered client-side from HMAC-signed token. |
| 6 | I-3.3.5 | Booking confirmation email with QR ticket | ✦ | — | — | I-3.3.1, I-3.3.4 | Triggered by payment webhook worker. React Email template with inline QR image. |

### Module 3.4: Participant Profile & Consent Management

*Covers requirements F-3.4.1 through F-3.4.4*

**Implementation order:** Profile save on first booking first (triggered by registration), then profile view/edit, then booking history (needs bookings), then consent withdrawal and deletion request.

| Order | ID | Feature | Backend | Frontend | Shared | Depends on | Notes |
|-------|----|---------|---------|----------|--------|------------|-------|
| 1 | I-3.4.1 | Save participant details on first booking | ✦ | — | ✦ | **I-3.1.2**, **I-0.1.3** | Name, age, gender, city stored in `participant_profiles`. **Sensitive fields (blood group, emergency contact, medical) stored ONLY in `sensitive_participant_data` table with 30-day post-event retention and scoped access.** Triggered by registration form submission. |
| 2 | I-3.4.2 | Profile view and edit for participants | ✦ | ✦ | ✦ | I-3.4.1, **I-0.3.3** | `/my/profile` route. Needs role-based routing for `/my/*`. |
| 3 | I-3.4.3 | Booking history view | ✦ | ✦ | — | I-3.4.1, **I-3.3.2** | `/my/bookings` route. Needs confirmed bookings to display. |
| 4 | I-3.4.5 | Consent withdrawal API | ✦ | ✦ | ✦ | I-3.4.1, **I-3.1.6** | `DELETE /api/v1/my/consent/:type`. Architecture §6: participants can withdraw specific consent types (e.g., marketing) without deleting profile. Withdrawal triggers anonymization of data processed under that consent. |
| 5 | I-3.4.4 | Profile data deletion request | ✦ | ✦ | — | I-3.4.1, **I-0.1.6** | `DELETE /api/v1/my/profile`. Marks profile as deleted, enqueues anonymization job. **Note: The anonymization BullMQ job processor is stubbed here and completed in Phase 7 (I-7.3.5). The endpoint + queue message work now; the worker that processes anonymization is Phase 7 work.** |

### Phase 3 Execution Strategy — Solo Developer

Phase 3 is the most complex phase — the booking pipeline is a linear chain (registration → payment → confirmation), but email service and participant profile branch off independently. Work in 4 waves:

**Wave 1 — Shared enums + DB foundations + Email service**
Build the status enums, payment records table, capacity reservation, and email service. These have no dependencies on each other.

1. `I-3.2.4` Payment status tracking *(shared enum + payment_records table)*
2. `I-3.3.6` Booking status management *(shared enum)*
3. `I-3.2.10` Capacity reservation *(atomic DB pattern)*
4. `I-3.3.1` Email service + templates *(independent of payment flow)*

**Wave 2 — Registration form + Razorpay core**
Build the two entry points to the booking flow: the registration form and the payment integration.

1. `I-3.1.1` Category selection
2. `I-3.1.5` Form validation layer
3. `I-3.1.2` Registration form
4. `I-3.1.6` Consent capture
5. `I-3.1.3` OTP verification at submission
6. `I-3.4.1` Save participant profile *(triggered by first booking)*
7. `I-3.2.1` Razorpay Route — booking endpoint + order creation
8. `I-3.2.3` Split payout configuration
9. `I-3.2.6` Free pilot period handling
10. `I-3.2.2` UPI + card checkout UI

**Wave 3 — Webhook pipeline + Booking confirmation**
The async payment processing pipeline and confirmation flow.

1. `I-3.2.7` Webhook handler
2. `I-3.2.8` Webhook idempotency
3. `I-3.3.2` Booking record confirmation *(webhook worker updates state machine)*
4. `I-3.3.4` QR code generation
5. `I-3.3.3` Confirmation page
6. `I-3.3.5` Confirmation email with QR
7. `I-3.2.5` Payment failure + retry

**Wave 4 — Resilience + Participant self-service**
Reconciliation, backpressure, auto-fill, and participant profile management.

1. `I-3.2.9` Payment reconciliation job
2. `I-3.2.11` Backpressure / waiting-room
3. `I-3.1.4` Auto-fill from saved profile *(needs I-3.4.1 from Wave 2)*
4. `I-3.4.2` Participant profile view/edit
5. `I-3.4.3` Booking history
6. `I-3.4.5` Consent withdrawal API
7. `I-3.4.4` Profile deletion request *(stub worker, completed Phase 7)*

```
Wave 1 (foundations)          Wave 2 (form + payment)          Wave 3 (webhook + confirm)    Wave 4 (resilience + profile)
────────────────────────    ─────────────────────────────    ────────────────────────    ───────────────────────────
I-3.2.4 payment enum          I-3.1.1 category selection       I-3.2.7 webhook handler       I-3.2.9 reconciliation job
I-3.3.6 booking enum          I-3.1.5 form validation          I-3.2.8 webhook idempotency   I-3.2.11 backpressure
I-3.2.10 capacity reservation I-3.1.2 registration form        I-3.3.2 booking confirmation  I-3.1.4 auto-fill
I-3.3.1 email service         I-3.1.6 consent capture          I-3.3.4 QR generation         I-3.4.2 profile view/edit
                               I-3.1.3 OTP at submission        I-3.3.3 confirmation page     I-3.4.3 booking history
                               I-3.4.1 save participant profile I-3.3.5 confirmation email    I-3.4.5 consent withdrawal
                               I-3.2.1 razorpay order           I-3.2.5 payment retry         I-3.4.4 deletion request
                               I-3.2.3 split payout
                               I-3.2.6 free pilot
                               I-3.2.2 checkout UI
```

**Validate after each wave:** Run `check-types`, `lint`, and `test` for all affected workspaces. **End-to-end test after Wave 3:** Complete a full booking flow (register → pay → webhook → confirmation email) before moving to Wave 4.

---

## Phase 4: Organizer Operations Dashboard

**Goal:** Give organizers visibility into registrations, payments, and participant management.

**Why fifth:** Bookings must be flowing (Phase 3) before the dashboard has meaningful data.

**Prerequisites:** Phase 3 (bookings exist).

**Parallel opportunity:** Can start during late Phase 3 — API endpoints can be built before the booking flow is complete.

### Module 4.1: Event Operations View

*Covers requirements F-4.1.1 through F-4.1.5*

**Implementation order:** Count summary first (the dashboard header), then participant list (the core table), then detail view and revenue (extend the page), then export (async job).

| Order | ID | Feature | Backend | Frontend | Shared | Depends on | Notes |
|-------|----|---------|---------|----------|--------|------------|-------|
| 1 | I-4.1.1 | Registered / paid / checked-in count summary per event | ✦ | ✦ | — | **I-3.3.2**, **I-0.3.3** | Aggregate queries, `/org/events/:id`. Dashboard header with key metrics. |
| 2 | I-4.1.2 | Participant list with status filters | ✦ | ✦ | — | I-4.1.1, **I-3.4.1** | Server-side pagination for >100 rows, TanStack Table. **Scoped to organizer's own events only (server-side enforcement from Phase 0).** |
| 3 | I-4.1.3 | Individual participant booking detail view | ✦ | ✦ | — | I-4.1.2 | Scoped to organizer's own events only. **Sensitive fields (blood group, medical) suppressed at API layer unless safety-critical.** Navigate from participant list. Can parallel with I-4.1.4. |
| 4 | I-4.1.4 | Basic revenue view per event — total collected, EventKart fee, net to organizer | ✦ | ✦ | — | I-4.1.1, **I-3.2.4** | Read from payment records. Can parallel with I-4.1.3. |
| 5 | I-4.1.5 | Participant roster export — CSV for offline fallback | ✦ | ✦ | — | I-4.1.2, **I-0.1.6** | BullMQ exports queue, sensitive fields controlled. |

**Key pattern:** Participant tables use TanStack Table + TanStack Virtual for large lists (20K+ rows). Server-side pagination for initial load, client-side virtual scrolling for render.

### Module 4.2: Multi-Event Overview

*Covers requirements F-4.2.1 through F-4.2.3*

**Implementation order:** Organizer home page first (landing page at `/org/events`), then status cards and navigation links. This is the **entry point** — build before Module 4.1 drill-down views.

| Order | ID | Feature | Backend | Frontend | Shared | Depends on | Notes |
|-------|----|---------|---------|----------|--------|------------|-------|
| 1 | I-4.2.1 | Organizer home — all events (upcoming, past) | ✦ | ✦ | — | **I-1.2.1**, **I-0.3.3** | `/org/events` route. Landing page for organizer dashboard. |
| 2 | I-4.2.2 | Event status summary cards — draft, published, completed | — | ✦ | — | I-4.2.1, **I-2.2.3** | Quick status overview. Uses event status enum from shared. |
| 3 | I-4.2.3 | Quick-access links to event operations | — | ✦ | — | I-4.2.1, **I-4.1.1** | Navigation shortcuts to event detail dashboard. **Cross-dep on Module 4.1 routes existing.** |

### Phase 4 Execution Strategy — Solo Developer

Phase 4 is a straightforward two-module phase. Module 4.2 (multi-event overview) is the **landing page**, and Module 4.1 (event operations) is the **drill-down**. Build the landing page first, then the detail views.

**Wave 1 — Organizer landing page**
The entry point organizers see when they log in.

1. `I-4.2.1` Organizer home — event list
2. `I-4.2.2` Event status summary cards

**Wave 2 — Single event operations dashboard**
The detail view organizers drill into per event.

1. `I-4.1.1` Count summary (dashboard header)
2. `I-4.1.2` Participant list with filters
3. `I-4.1.3` Participant booking detail view
4. `I-4.1.4` Revenue view *(can parallel with I-4.1.3)*
5. `I-4.1.5` Participant roster export
6. `I-4.2.3` Quick-access links *(wires landing page to detail views)*

```
Wave 1 (landing page)         Wave 2 (event operations)
────────────────────────    ───────────────────────────────
I-4.2.1 organizer home        I-4.1.1 count summary
I-4.2.2 status cards          I-4.1.2 participant list
                               I-4.1.3 booking detail (∥)
                               I-4.1.4 revenue view (∥)
                               I-4.1.5 roster export
                               I-4.2.3 quick-access links
```

**Validate after each wave:** Run `check-types`, `lint`, and `test` for all affected workspaces.

---

## Phase 5: Event-Day Operations

**Goal:** Enable smooth event-day execution with QR check-in and offline fallback.

**Why sixth:** Requires bookings with QR codes (Phase 3). This is the event-day reliability layer.

**Prerequisites:** Phase 3 (QR codes exist). **Does NOT depend on Phase 4** — check-in is a standalone flow that verifies booking tokens directly.

**Parallel opportunity:** Can be built fully in parallel with Phases 4 and 6 after Phase 3 is complete.

### Module 5.1: QR Check-In

*Covers requirements F-5.1.1 through F-5.1.5*

**Implementation order:** Scanner UI and sensitive field suppression logic first (independent), then scan result + verification API, then check-in action, then duplicate detection.

| Order | ID | Feature | Backend | Frontend | Shared | Depends on | Notes |
|-------|----|---------|---------|----------|--------|------------|-------|
| 1 | I-5.1.1 | QR code scanner interface — camera-based, mobile browser | — | ✦ | — | **I-3.3.4**, **I-0.3.3** | `/org/events/:id/check-in` route, `ssr: false` (uses camera APIs). Needs QR tokens to exist from Phase 3. |
| 2 | I-5.1.5 | Sensitive field suppression — blood group, medical info suppressed by default | ✦ | ✦ | — | **I-1.2.4** | **Server-side enforcement**: API does not return sensitive fields in check-in response unless organizer has marked them safety-critical for this event. Build suppression logic before scan result display. |
| 3 | I-5.1.2 | Scan result display — participant name, category, payment status, check-in status | ✦ | ✦ | — | I-5.1.1, I-5.1.5, **I-3.3.4**, **I-3.3.2** | Server-side verification of HMAC token + booking status. Applies sensitive field suppression. |
| 4 | I-5.1.3 | Check-in confirmation action — mark as checked in | ✦ | ✦ | — | I-5.1.2 | Atomic single-use/first-scan semantics in DB. ticket_version enforcement. **Shared backend used by Module 5.2 manual check-in.** |
| 5 | I-5.1.4 | Duplicate scan detection — already checked-in warning | ✦ | ✦ | — | I-5.1.3 | Returns existing check-in timestamp. |

### Module 5.2: Manual Search Fallback

*Covers requirements F-5.2.1 through F-5.2.3*

**Implementation order:** Search endpoint first, then results display, then manual check-in (reuses I-5.1.3 backend).

| Order | ID | Feature | Backend | Frontend | Shared | Depends on | Notes |
|-------|----|---------|---------|----------|--------|------------|-------|
| 1 | I-5.2.1 | Search participants by name or phone number | ✦ | ✦ | — | **I-3.4.1**, **I-3.3.2** | Scoped to current event. Search API endpoint. |
| 2 | I-5.2.2 | Search results with booking and payment status | ✦ | ✦ | — | I-5.2.1 | Quick identification. Applies same sensitive field suppression as I-5.1.5. |
| 3 | I-5.2.3 | Manual check-in action from search results | ✦ | ✦ | — | I-5.2.2, **I-5.1.3** | **Reuses check-in backend from Module 5.1.** Same atomic single-use semantics. |

### Module 5.3: Offline Roster

*Covers requirements F-5.3.1 through F-5.3.4*

**Implementation order:** Content spec and sensitive field config first, then PDF generation, then footer instruction.

| Order | ID | Feature | Backend | Frontend | Shared | Depends on | Notes |
|-------|----|---------|---------|----------|--------|------------|-------|
| 1 | I-5.3.2 | Roster contents — name, category, payment status, bib (if external) | — | — | — | **I-3.4.1**, **I-3.3.2** | Minimal data by default. Content specification for the roster. |
| 2 | I-5.3.3 | Sensitive fields included only if marked safety-critical by organizer | ✦ | — | — | **I-5.1.5**, **I-1.2.4** | Configurable per event, enforced server-side. **Reuses suppression logic from Module 5.1.** |
| 3 | I-5.3.1 | Downloadable participant roster — PDF or print-friendly format | ✦ | ✦ | — | I-5.3.2, I-5.3.3, **I-0.1.6** | BullMQ exports queue. Async generation job. |
| 4 | I-5.3.4 | Delete-after-event instruction included with export | — | ✦ | — | I-5.3.1 | Data handling guidance in PDF footer. |

### Phase 5 Execution Strategy — Solo Developer

Phase 5 has a clear dependency chain: Module 5.1 (QR check-in) provides the check-in backend that Module 5.2 (manual search) reuses, and the sensitive field suppression logic that Module 5.3 (offline roster) reuses. Build in 2 waves:

**Wave 1 — QR check-in flow**
The core event-day feature. Scanner → verify → check-in → duplicate detection.

1. `I-5.1.1` QR scanner UI
2. `I-5.1.5` Sensitive field suppression logic
3. `I-5.1.2` Scan result display + token verification
4. `I-5.1.3` Check-in confirmation action
5. `I-5.1.4` Duplicate scan detection

**Wave 2 — Manual search + Offline roster**
Fallback flows that reuse the check-in backend and suppression logic from Wave 1.

1. `I-5.2.1` Search participants
2. `I-5.2.2` Search results display
3. `I-5.2.3` Manual check-in *(reuses I-5.1.3 backend)*
4. `I-5.3.2` Roster content spec
5. `I-5.3.3` Sensitive field config *(reuses I-5.1.5 logic)*
6. `I-5.3.1` PDF roster generation
7. `I-5.3.4` Delete-after-event footer

```
Wave 1 (QR check-in)         Wave 2 (fallbacks)
────────────────────────    ───────────────────────────────
I-5.1.1 scanner UI            I-5.2.1 search participants
I-5.1.5 field suppression     I-5.2.2 search results
I-5.1.2 scan result           I-5.2.3 manual check-in
I-5.1.3 check-in action       I-5.3.2 roster content spec
I-5.1.4 duplicate detection   I-5.3.3 sensitive field config
                               I-5.3.1 PDF generation
                               I-5.3.4 delete-after-event footer
```

**Validate after each wave:** Run `check-types`, `lint`, and `test` for all affected workspaces. **End-to-end test after Wave 1:** Scan a real QR code from a Phase 3 booking and complete check-in.

---

## Phase 6: Communications & Retention

**Goal:** Close the loop after booking and after the event. Drive repeat participation.

**Why seventh:** Requires completed bookings (Phase 3) and event completion (Phase 5) to trigger the right messages at the right time.

**Prerequisites:** Phase 3 (bookings + email infrastructure from Module 3.3), Phase 5 (event completion for post-event flows).

**Parallel opportunity:** Post-event features (Module 6.2) can be built in parallel with Phase 5. Module 6.1 (remaining transactional emails) can start as soon as email infra from Module 3.3 is ready.

**Note:** Email service integration (I-3.3.1) and booking confirmation email (I-3.3.5) are now in Phase 3 Module 3.3. This phase covers only reminders and post-event communications.

### Module 6.1: Remaining Transactional Emails

*Covers requirements F-6.1.3, F-6.1.4*

**Implementation order:** Both items are independent. Reminder email first (it has a BullMQ scheduled job), cancellation template second (trigger wired later in Phase 7).

| Order | ID | Feature | Backend | Frontend | Shared | Depends on | Notes |
|-------|----|---------|---------|----------|--------|------------|-------|
| 1 | I-6.1.1 | Event reminder email — 1-2 days before event | ✦ | — | — | **I-3.3.1**, **I-0.1.6**, **I-1.2.1** | BullMQ scheduled job. Uses email infrastructure from Phase 3. Needs event dates to schedule. |
| 2 | I-6.1.2 | Booking cancellation/refund confirmation email | ✦ | — | — | **I-3.3.1** | Triggered by refund workflow (Phase 7). **Template + React Email component built here; trigger wired in Phase 7 (I-7.1.3).** Can parallel with I-6.1.1. |

### Module 6.2: Post-Event & Retention

*Covers requirements F-6.2.1 through F-6.2.4*

**Implementation order:** Organizer content interface first (organizer adds links/content), then follow-up email (includes that content), then email extensions (results, next-event prompt).

| Order | ID | Feature | Backend | Frontend | Shared | Depends on | Notes |
|-------|----|---------|---------|----------|--------|------------|-------|
| 1 | I-6.2.4 | Organizer interface to add post-event content | ✦ | ✦ | — | **I-0.3.3**, **I-1.2.1** | Results link, photos link, next event link. `/org/events/:id/post-event`. **Build before follow-up email so email has content to include.** |
| 2 | I-6.2.1 | Post-event follow-up email to participants | ✦ | — | — | I-6.2.4, **I-3.3.1**, **I-3.1.6** | Triggered after event completion. **Requires valid marketing consent for promotional content.** Includes organizer-provided content from I-6.2.4. |
| 3 | I-6.2.2 | Include organizer-provided wrap-up or external results links | ✦ | — | — | I-6.2.1 | First-party results hosting out of scope. Extends follow-up email template. Can parallel with I-6.2.3. |
| 4 | I-6.2.3 | Next-event prompt for repeat booking in follow-up email | ✦ | — | — | I-6.2.1, **I-1.2.1** | Link to organizer's next event. **Only sent to participants with marketing consent.** Can parallel with I-6.2.2. |

### Phase 6 Execution Strategy — Solo Developer

Phase 6 is small (6 items) and has no complex cross-module dependencies. Modules 6.1 and 6.2 are independent of each other. Work in 2 waves:

**Wave 1 — Transactional emails + Organizer post-event interface**
All three items are independent of each other. The reminder email and cancellation template are backend-only. The organizer interface is a frontend form.

1. `I-6.1.1` Event reminder email *(BullMQ scheduled job)*
2. `I-6.1.2` Cancellation/refund email template *(template only, trigger wired in Phase 7)*
3. `I-6.2.4` Organizer post-event content interface

**Wave 2 — Post-event follow-up email**
The follow-up email and its extensions. Needs organizer content interface from Wave 1.

1. `I-6.2.1` Post-event follow-up email
2. `I-6.2.2` Results/wrap-up links in email
3. `I-6.2.3` Next-event prompt in email

```
Wave 1 (independent items)    Wave 2 (follow-up email)
────────────────────────    ─────────────────────────────
I-6.1.1 reminder email        I-6.2.1 follow-up email
I-6.1.2 cancellation template I-6.2.2 results links (∥)
I-6.2.4 post-event interface  I-6.2.3 next-event prompt (∥)
```

**Validate after each wave:** Run `check-types`, `lint`, and `test` for all affected workspaces.

---

## Phase 7: Refunds, Disputes & Admin Operations

**Goal:** Handle exception paths — refunds, disputes, and platform-level administration. Harden the product for real-world edge cases during the pilot.

**Why eighth:** The happy path must work first (Phases 1–6). This phase handles the inevitable exceptions.

**Prerequisites:** Phase 3 (payment flow working). Can start once Phase 3 payment integration is stable.

**Parallel opportunity:** Can start during Phase 4-5 timeframe since it primarily depends on Phase 3.

### Module 7.1: Refund Workflow

*Covers requirements F-7.1.1 through F-7.1.4*

**Implementation order:** Request initiation first, then gateway processing, then status tracking (wires cancellation email from Phase 6), then settled-funds handling.

| Order | ID | Feature | Backend | Frontend | Shared | Depends on | Notes |
|-------|----|---------|---------|----------|--------|------------|-------|
| 1 | I-7.1.1 | Refund request initiation — participant-side or organizer-initiated | ✦ | ✦ | ✦ | **I-3.3.2**, **I-3.2.4** | Contact/form-based. Creates refund request record. |
| 2 | I-7.1.2 | Refund processing through payment gateway — reverse split | ✦ | — | — | I-7.1.1, **I-3.2.1**, **I-3.2.3** | Razorpay refund API. Reverses the split payout. |
| 3 | I-7.1.3 | Refund status tracking and communication to participant | ✦ | ✦ | ✦ | I-7.1.2, **I-6.1.2** | Status updates via email. **Wires the cancellation email template built in Phase 6.** |
| 4 | I-7.1.4 | Handling for already-settled funds — organizer responsibility, EventKart mediation | ✦ | ✦ | — | I-7.1.1, **I-0.4.4** | Manual admin workflow. Edge case for funds already transferred to organizer. |

### Module 7.2: Dispute & Support

*Covers requirements F-7.2.1 through F-7.2.4*

**Implementation order:** Participant reporting first, then admin queue, then SLA tracking and suspension workflow.

| Order | ID | Feature | Backend | Frontend | Shared | Depends on | Notes |
|-------|----|---------|---------|----------|--------|------------|-------|
| 1 | I-7.2.1 | Participant issue reporting mechanism | ✦ | ✦ | — | **I-3.3.2**, **I-0.3.3** | Contact/form-based reporting. Creates dispute record. |
| 2 | I-7.2.2 | Admin dispute queue and management interface | ✦ | ✦ | — | I-7.2.1, **I-0.3.3**, **I-0.4.4** | `/admin/disputes` route. Admin views and manages disputes. |
| 3 | I-7.2.3 | 2-business-day first-response SLA tracking | ✦ | ✦ | — | I-7.2.2 | SLA timer on dispute records. Alerting on breach. |
| 4 | I-7.2.4 | Organizer suspension workflow for repeated violations | ✦ | ✦ | — | I-7.2.2, **I-1.1.1**, **I-0.4.4** | Admin action, logged in audit. Suspends organizer account and unpublishes events. |

### Module 7.3: Admin Operations Panel & Data Lifecycle

*Covers requirements F-7.3.1 through F-7.3.4 plus data lifecycle from architecture §6*

**Implementation order:** Admin panels first (extend Phase 1 admin interfaces), then data lifecycle workers (anonymization, cleanup jobs), then compliance features (DSAR export, bounce handling). I-7.3.10 must come after I-7.3.5 since inactive accounts feed into the anonymization worker.

| Order | ID | Feature | Backend | Frontend | Shared | Depends on | Notes |
|-------|----|---------|---------|----------|--------|------------|-------|
| 1 | I-7.3.1 | Organizer verification queue — pending applications, approve/reject | ✦ | ✦ | — | **I-1.1.5** | Started in Phase 1, completed here with full queue management (pagination, filters, bulk actions). |
| 2 | I-7.3.2 | Event review queue — new organizer events pending manual review | ✦ | ✦ | — | **I-1.2.7** | Started in Phase 1, completed here with full queue management. Can parallel with I-7.3.1. |
| 3 | I-7.3.4 | Audit log viewer — filter by actor, action, resource, date range | ✦ | ✦ | — | **I-0.4.4** | Queries audit_log table. Can parallel with I-7.3.1/I-7.3.2. |
| 4 | I-7.3.3 | Payout monitoring dashboard — split payout status, exceptions | ✦ | ✦ | — | **I-3.2.4**, **I-3.2.3** | Read from payment records. Can parallel with I-7.3.4. |
| 5 | I-7.3.5 | Anonymization worker — processes profile deletion and consent withdrawal requests | ✦ | — | — | **I-3.4.4**, **I-0.1.6** | BullMQ cleanup queue. Replaces PII with deterministic hashes/placeholders. Preserves financial data. **Completes the stub from I-3.4.4.** |
| 6 | I-7.3.6 | Sensitive field cleanup job — 30 days post-event | ✦ | — | — | **I-3.4.1**, **I-0.1.6** | BullMQ daily repeatable job. Scans and deletes sensitive fields on bookings for completed events. Can parallel with I-7.3.5. |
| 7 | I-7.3.7 | KYC document cleanup job — 1 year after account closure | ✦ | — | — | **I-1.1.2**, **I-0.1.8**, **I-0.1.6** | BullMQ weekly repeatable job. Removes S3/R2 objects and DB metadata. Can parallel with I-7.3.5/I-7.3.6. |
| 8 | I-7.3.8 | DSAR data export — machine-readable export of all participant data | ✦ | ✦ | — | **I-3.4.1**, **I-0.1.6** | `GET /api/v1/my/data-export`. BullMQ exports queue. Required for DPDPA compliance. |
| 9 | I-7.3.9 | Email bounce/complaint handling — deliverability hygiene | ✦ | — | — | **I-3.3.1** | Resend/SES webhook for bounces and complaints. Suppress future sends to bounced addresses. |
| 10 | I-7.3.10 | Inactive account cleanup — 3 years inactivity | ✦ | — | — | **I-7.3.5**, **I-0.1.6** | BullMQ weekly repeatable job. Marks inactive accounts for anonymization. **Must come after I-7.3.5** since it feeds into the anonymization worker. |

### Phase 7 Execution Strategy — Solo Developer

Phase 7 has three largely independent modules. Modules 7.1 (refunds) and 7.2 (disputes) are independent of each other. Module 7.3 is a collection of independent admin panels and background jobs. Work in 3 waves:

**Wave 1 — Refund workflow + Dispute reporting + Admin panels**
The user-facing exception flows and admin queue enhancements. All three tracks are independent.

1. `I-7.1.1` Refund request initiation
2. `I-7.1.2` Refund gateway processing
3. `I-7.1.3` Refund status + email *(wires Phase 6 cancellation template)*
4. `I-7.1.4` Settled-funds handling
5. `I-7.2.1` Participant issue reporting
6. `I-7.2.2` Admin dispute queue
7. `I-7.2.3` SLA tracking
8. `I-7.2.4` Organizer suspension

**Wave 2 — Admin operations panels**
Complete the admin dashboard with full queue management, payout monitoring, and audit viewer.

1. `I-7.3.1` Verification queue *(extends Phase 1 admin interface)*
2. `I-7.3.2` Event review queue *(extends Phase 1 admin interface)*
3. `I-7.3.4` Audit log viewer
4. `I-7.3.3` Payout monitoring dashboard

**Wave 3 — Data lifecycle workers + Compliance**
Background jobs for DPDPA compliance, data hygiene, and deliverability.

1. `I-7.3.5` Anonymization worker *(completes Phase 3 stub)*
2. `I-7.3.6` Sensitive field cleanup job *(30-day post-event)*
3. `I-7.3.7` KYC document cleanup job *(1-year retention)*
4. `I-7.3.8` DSAR data export
5. `I-7.3.9` Email bounce/complaint handling
6. `I-7.3.10` Inactive account cleanup *(feeds into I-7.3.5 anonymization)*

```
Wave 1 (exception flows)      Wave 2 (admin panels)            Wave 3 (data lifecycle)
────────────────────────    ────────────────────────────    ────────────────────────────
I-7.1.1 refund request        I-7.3.1 verification queue       I-7.3.5 anonymization worker
I-7.1.2 gateway processing    I-7.3.2 event review queue (∥)   I-7.3.6 sensitive cleanup (∥)
I-7.1.3 status + email        I-7.3.4 audit log viewer (∥)     I-7.3.7 KYC cleanup (∥)
I-7.1.4 settled funds         I-7.3.3 payout dashboard (∥)     I-7.3.8 DSAR export
I-7.2.1 issue reporting                                         I-7.3.9 bounce handling
I-7.2.2 dispute queue                                           I-7.3.10 inactive cleanup
I-7.2.3 SLA tracking
I-7.2.4 organizer suspension
```

**Validate after each wave:** Run `check-types`, `lint`, and `test` for all affected workspaces.

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
