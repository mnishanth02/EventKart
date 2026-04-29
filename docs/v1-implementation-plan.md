---
title: EventKart V1 — Comprehensive Implementation Plan
version: 2.2
date_created: 2026-04-21
last_updated: 2026-04-29
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
  - Claude Opus 4.7 high (v2.2 product/impl-plan gap audit)
owner: Engineering / Founding Team
tags: [implementation, roadmap, v1]
---

# EventKart V1 — Comprehensive Implementation Plan

This document translates the product plan, requirements document, and architecture decisions into a sequenced, phase-wise implementation roadmap. It defines **what** to build and **in what order** — not how to implement it.

**Feature ID convention:** This plan uses its own feature IDs (e.g., `I-0.1.1`) that are more granular than the requirements document's feature IDs (e.g., `F-0.1.1`). The requirements document defines 103 features; this plan decomposes them into 181 implementation items (including infrastructure, security, observability, public chrome, transactional emails, admin notifications, and data lifecycle work not in the requirements). A complete cross-reference table mapping every requirements F-ID to implementation I-IDs is provided in [Appendix A](#appendix-a-requirements-to-implementation-id-mapping).

---

## Current State

The following foundation work is already complete or in progress:

| Component                                     | Status      | Notes                                                                                                                                                                                                                                                                                    |
| --------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo (Turborepo + pnpm)                   | ✅ Complete | `apps/web`, `apps/api`, `packages/` structure                                                                                                                                                                                                                                            |
| TanStack Start web app                        | ✅ Complete | Routes, router, components, lib, styles                                                                                                                                                                                                                                                  |
| Fastify API baseline                          | ✅ Complete | `app.ts` factory, `server.ts` entry, plugins, routes, typed config                                                                                                                                                                                                                       |
| shadcn/ui + Tailwind CSS v4                   | ✅ Complete | Design system established, component library configured                                                                                                                                                                                                                                  |
| Biome linting/formatting                      | ✅ Complete | Workspace-wide standardization                                                                                                                                                                                                                                                           |
| TypeScript 6.x                                | ✅ Complete | Stack-aware tsconfig presets                                                                                                                                                                                                                                                             |
| Package script normalization                  | ✅ Complete | Consistent dev/build/lint/test/check-types                                                                                                                                                                                                                                               |
| Turbo task wiring                             | ✅ Complete | Correct outputs, env, caching                                                                                                                                                                                                                                                            |
| Env handling (web + api)                      | ✅ Complete | Split public/server env, validated config plugin                                                                                                                                                                                                                                         |
| Deployment topology                           | ✅ Complete | CI/CD pipeline with staging auto-deploy and production manual promote via Railway                                                                                                                                                                                                        |
| I-0.1.1: `packages/shared`                    | ✅ Complete | Zod v4 schemas, types, constants, phone E.164 normalization. 58 tests passing.                                                                                                                                                                                                           |
| I-0.1.4: Docker Compose                       | ✅ Complete | PostgreSQL 17 + Redis 7 local dev infrastructure. `docker-compose.yml` at repo root.                                                                                                                                                                                                     |
| I-0.1.2: `packages/db`                        | ✅ Complete | Drizzle ORM client with `prepare: false`, postgres.js driver, Drizzle Kit migrations, seed skeleton. 1 test passing.                                                                                                                                                                     |
| I-0.1.5: Redis client setup                   | ✅ Complete | ioredis namespaced connections (sess:, bull:, rl:, cache:, otp:), Fastify plugin, BullMQ connection factory. 35 API tests passing.                                                                                                                                                       |
| I-0.1.6: BullMQ queue infrastructure          | ✅ Complete | Queue definitions (payment-webhook, email, cleanup, exports, failed-jobs DLQ), worker service skeleton, Fastify plugin. 59 API tests passing.                                                                                                                                            |
| I-0.1.7: Database migration CI pipeline       | ✅ Complete | GitHub Actions workflow, lock-risk SQL linter (7 rules), schema drift checker, rollback validator, programmatic migration runner. 22 DB tests passing.                                                                                                                                   |
| I-0.1.8: Object storage client                | ✅ Complete | S3/R2 presigned URL helper, server-side encryption, Fastify plugin. 92 API tests passing.                                                                                                                                                                                                |
| I-0.1.9: CI/CD deployment pipeline            | ✅ Complete | GitHub Actions CI (lint, types, test, build), staging auto-deploy, production manual promote via Railway.                                                                                                                                                                                |
| I-0.2.12: Security headers                    | ✅ Complete | `@fastify/helmet` plugin for API (CSP, X-Frame-Options, HSTS, nosniff). Nitro server middleware for TanStack Start (environment-aware CSP). 98 API tests passing.                                                                                                                        |
| I-0.2.1: OTP send (MSG91 + WhatsApp fallback) | ✅ Complete | POST /api/v1/auth/otp/send. HMAC-SHA256 hashed OTP in Redis, atomic cooldown lock (SET NX EX), @fastify/rate-limit, MSG91 SMS+WhatsApp fallback, dev log mode. 166 API tests passing.                                                                                                    |
| I-0.2.2: OTP verify → session creation        | ✅ Complete | POST /api/v1/auth/otp/verify. Atomic Lua-script OTP verification, user upsert (INSERT ON CONFLICT), dual-write session (Redis + DB, fail-closed), @fastify/cookie with HttpOnly/Secure/SameSite=Lax cookie. 202 API tests passing.                                                       |
| I-0.2.3: Session middleware                   | ✅ Complete | Fastify plugin (plugins/auth.ts) reads `kiran_session` cookie → Redis lookup → decorates `request.session` (SessionInfo \| null). Handles stale cookies, expired sessions, Redis errors (fail-open, no cookie clear). 217 API tests passing.                                             |
| I-0.2.8: Logout endpoint                      | ✅ Complete | POST /api/v1/auth/logout. Deletes session from Redis, sets revokedAt in DB (audit trail, fail-open). Clears session + CSRF cookies. 273 API tests passing.                                                                                                                               |
| I-0.2.11: CSRF protection                     | ✅ Complete | HMAC-signed double-submit cookie plugin (plugins/csrf.ts). Validates X-CSRF-Token header on state-changing authenticated requests. Origin validation on OTP verify for login-CSRF protection. Token bound to sessionId. 273 API tests passing.                                           |
| I-0.2.10: Internal API key                    | ✅ Complete | `X-Internal-Key` header validation plugin (plugins/internal-key.ts). Timing-safe comparison, 401 fail-closed on invalid/unconfigured keys. Higher rate limits (1000/min vs 100/min). CSRF bypass for internal requests. Session coexistence for SSR user context. 293 API tests passing. |
| I-0.3.6: API client setup                     | ✅ Complete | Hybrid SSR/browser API client (`api-client.ts` + `api-client.server.ts`). Browser: `VITE_API_URL`, CSRF auto-attach, `credentials: "include"`. Server: `INTERNAL_API_URL`, `X-Internal-Key`. Shared types/error class in `api-client.shared.ts`. 25 web tests passing.                   |

| I-0.3.1: Mobile-first responsive layout shell | ✅ Complete | Pathless `_public` layout route with PublicHeader (glass top nav, scroll effect), PublicFooter, MobileBottomNav (Discover + Search). Fixed header/bottom nav with safe-area offsets. `_authed` layout deferred to I-0.3.3 (no children yet). |
| I-0.3.2: Core UI component library | ✅ Complete | ThemeProvider (next-themes, attribute="class", defaultTheme="system") and mount-gated ThemeToggle in `packages/ui`. 57 shadcn/ui components already installed. Dark/light mode fully wired with CSS variables. |
| I-0.2.9: SSR session forwarding | ✅ Complete | `getForwardedAuthHeaders()` filters only `kiran_session` cookie + `X-Request-ID` for SSR→API calls. `getCurrentUser` server function returns `AuthSession \| null`. 8 web tests passing. 320 API tests, 57 web tests passing. |
| I-0.2.7: Deferred authentication pattern | ✅ Complete | `GET /api/v1/auth/session` endpoint (Cache-Control: private, no-store). `useAuth()`, `useAuthActions()`, `useRequireAuth()` hooks. OTP login dialog (phone → OTP → verify). Auth query invalidation after login/logout. 320 API tests, 57 web tests passing. |
| I-1.1.1: Organizer registration form | ✅ Complete | `POST /api/v1/organizers` + `GET /api/v1/organizers/me`. Organizers table + migration (cascade FK). Shared Zod schemas for registration + profile. TanStack Form with live validation. `/org/register` route, dashboard profile check. 422 API tests, 75 web tests passing. |
| I-1.1.8: Organizer profile management | ✅ Complete | `PUT /api/v1/organizers/me` partial update endpoint. Shared `organizerUpdateSchema` (all fields optional, min 1 required). `OrganizerProfileForm` with dirty-field detection. `/org/profile` route. Audit logged. 81 organizer tests passing. |
| I-1.1.4: Verification status tracking | ✅ Complete | `GET /api/v1/organizers/verification-status` comprehensive endpoint. 4 new DB columns (submittedForReviewAt, reviewedAt, reviewedBy, rejectionReason). SLA tracking (2-business-day target). Policy+docs check for pending_review transition. VerificationStatusTracker component with 5-step stepper, doc checklist, SLA info. Enhanced org dashboard with status card. 18 verification status tests, 81 total organizer tests passing. |

| I-1.1.5: Admin verification review API (backend) | ✅ Complete | 5 REST endpoints under `/api/v1/admin`: list verifications (paginated), detail, document view URL, approve, reject. Admin service with Drizzle transactions, audit logging. 26 admin tests passing. |
| I-1.1.5: Admin verification review UI (frontend) | ✅ Complete | Admin feature module with server functions, query options. VerificationQueue (paginated table with status filter), VerificationReviewDetail (org info, doc viewer with presigned URLs, policy status, SLA info), ReviewActionDialog (approve/reject with validation). Routes: `/admin/verifications` (queue), `/admin/verifications/$organizerId` (detail). 514 total API tests passing. |
| I-1.1.2: Verification document upload | ✅ Complete | Upload to S3/R2 via presigned URLs, server-side encryption at rest, access logged. Shared document type/size schemas. `POST /api/v1/organizers/{organizerId}/documents/request`, `POST /api/v1/organizers/{organizerId}/documents/{documentId}/confirm`, `DELETE /api/v1/organizers/{organizerId}/documents/{documentId}`. `verification_documents` table + migration. File types: PDF/JPEG/PNG, max 10MB. 15 document tests passing. |
| I-1.1.3: Policy acceptance workflow | ✅ Complete | Consent versioning, no pre-checked boxes. `CURRENT_POLICY_VERSIONS` stamped server-side. Idempotent acceptance. Uses `consent_records` table from Phase 0. Platform terms + refund policy framework. `POST /api/v1/organizers/{organizerId}/policies/accept`, `GET /api/v1/organizers/{organizerId}/policies/status`. Shared `OrganizerPolicyType` enum. 16 policy tests passing. |
| I-1.1.6: Verification badge assignment on approval | ✅ Complete | `VerifiedBadge` component in `packages/ui`. Publishing eligibility gated by `isVerified && razorpayAccountStatus === "active"`. Badge shown in organizer dashboard, profile, admin detail. Verification state from `verification_status` endpoint. Audit logged on approval. (Behavior covered by I-1.1.4/I-1.1.5 tests.) |
| I-1.1.7: Razorpay Route linked-account creation + KYC sync | ✅ Complete | Async BullMQ job triggered on admin approval (I-1.1.5). Razorpay client lib, Fastify plugin. Maps Razorpay API status (created→pending, activated→active, suspended→suspended, etc.) to app status enum. Idempotent: skips if account already exists in non-retryable state. Publishing gate enforced: `canPublishPaidEvents = isVerified && razorpayAccountStatus === "active"`. Admin retry endpoint. 7 razorpay-account tests passing. |
| I-1.2.10: Event slug generation API service | ✅ Complete | Shared slug utilities, database slug fields/redirect table foundation, and API slug service for unique URL-safe event slugs and redirect recording. |
| I-1.2.1: Event creation form | ✅ Complete | Events table expanded with V1 event creation fields, shared Zod schemas/constants, `POST /api/v1/events` with organizer auth + CSRF, and `/org/events/new` TanStack Form UI for draft single-day paid running events in Coimbatore. |
| I-1.2.2: Event category & distance configuration | ✅ Complete | `event_categories` table + migration/rollback, shared 5K/10K/half-marathon defaults and Zod schemas, `GET/PUT /api/v1/events/:eventId/categories`, and `/org/events/$eventId/configure-categories` UI with event creation redirect. 47 event API tests, 12 shared schema tests, 12 DB schema tests, 9 targeted web tests, and web check-types passing. |
| I-1.2.3: Pricing configuration | ✅ Complete | Shared pricing schemas/constants, `event_pricing_tiers` table integration, `GET/PUT /api/v1/events/:eventId/pricing`, and `/org/events/$eventId/configure-pricing` UI for category base prices plus optional early-bird prices/deadlines. |
| I-1.2.9: Event image upload | ✅ Complete | Shared image constants/schemas, `event_images` table + migration/rollback, organizer image presign/confirm/list/delete API, and `/org/events/$eventId/configure-images` UI for hero image and route map uploads to S3/R2. |
| I-1.2.8: Event edit & update capabilities | ✅ Complete | Shared update schema, `GET/PUT /api/v1/events/:eventId`, organizer-owned draft-only updates, slug redirect handling, organizer edit route/form, query invalidation, and navigation to existing configuration surfaces. CDN purge remains a documented follow-up until Cloudflare invalidation integration exists. |
| I-1.2.6: Event publish workflow | ✅ Complete | Shared publish contracts, nullable publish timestamps + rollback migration, organizer readiness/publish/unpublish API with verification/Razorpay/completeness gates, audit logging, admin-review helper stubs, and organizer edit-page publish UI. See [impl-plan](impl-plan/feature-1.2-I-1.2.6.md). |
| I-1.2.4: Registration form field configuration | ✅ Complete | JSONB `form_schema` + version columns, shared registration field catalog/schema, API get/update routes, and organizer UI for standard plus fitness-specific fields. |
| I-1.2.5: Refund & cancellation policy capture | ✅ Complete | Event-level refund/cancellation policy storage, shared policy schema, API get/update routes, organizer UI for policy capture before booking, and publish readiness integration. |

**What remains:** Module 1.2 (Event Creation & Management) is ✅ Complete — all 10 implementation items (I-1.2.1 through I-1.2.10, including I-1.2.4 registration form field configuration) are done. Module 1.1 (Organizer Signup & Verification) is also ✅ Complete — all 8 features (I-1.1.1 through I-1.1.8) are done. Downstream public listing, booking, and participant flows continue in later modules.

**v2.2 known follow-ups (updated 2026-04-29):**

- **Test failures (I-0.2.14, I-0.2.15) — ✅ Fixed (W1.4, 2026-04-29)** — `buildTestAppWithoutKey()` now passes `INTERNAL_API_KEY: ""`. `loadConfig` regression test added at `apps/api/test/lib/config.test.ts`. api 725/725 passing. `0000_*` rollback false alarm confirmed: `validate-rollbacks.ts` lines 14–15 explicitly exempt initial migrations, no work needed.
- **Capacity columns — ✅ Shipped (W1.2, 2026-04-29)** — `event_categories.spots_total` and `spots_remaining` added via multi-step migration 0016 (nullable → backfill 100/100 → NOT NULL → CHECK constraints). Draft-only API surfacing. Atomic decrement deferred to I-3.2.10 (Phase 3).
- **Per-category capacity model** is the V1 commitment — event-level capacity has been removed from the plan (was in the v2.1 Database Table Overview by mistake).

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

| Gate                                                                                                                                                                                                                                          | Owner                  | Blocks                      | Status      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | --------------------------- | ----------- |
| **RBI PA-PG compliance validation** — Validate EventKart's split-payout model against the 2025 Master Direction on Payment Aggregators                                                                                                        | Legal + Razorpay       | Production launch           | Not started |
| **DPDPA legal review** — Validate data handling against India's Digital Personal Data Protection Act: parental/guardian consent for minors, grievance officer designation, processor/sub-processor register, cross-border transfer disclosure | Legal                  | Production launch           | Not started |
| **Razorpay Route TPS confirmation** — Confirm actual TPS limits with Razorpay enterprise team                                                                                                                                                 | Engineering + Razorpay | Burst load testing          | Not started |
| **Email domain setup** — SPF, DKIM, DMARC records for sending domain                                                                                                                                                                          | Engineering            | Transactional email go-live | Not started |
| **Burst load testing** — Validate sustained 20K-concurrent behavior under 5-, 15-, and 30-minute burst windows covering page load, OTP, booking, payment, webhook, Redis, DB pool                                                             | Engineering            | Production launch           | Not started |
| **Incident response runbook** — Regulator/CERT-In notification procedures per product plan §13                                                                                                                                                | Engineering + Legal    | Production launch           | Not started |

---

## Phase 0: Foundation — Shared Infrastructure

**Goal:** Establish the database, authentication, shared packages, and app shell that every subsequent phase depends on.

**Why first:** Nothing can be built without a database, auth system, shared validation schemas, and the UI app shell. This is the invisible foundation that every feature sits on.

**Prerequisites:** Workspace foundation (already complete).

### Module 0.1: Shared Packages & Database Foundation

_Covers requirements F-0.1.1 through F-0.1.4_

**Implementation order:** Items are sequenced by dependency — each row depends on the rows above it.

| Order | ID      | Feature                                                                                    | Backend | Frontend | Shared | Depends on       | Notes                                                                                                                                              |
| ----- | ------- | ------------------------------------------------------------------------------------------ | ------- | -------- | ------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 ✅  | I-0.1.1 | `packages/shared` — Shared Zod schemas, types, constants                                   | —       | —        | ✦      | —                | Schemas imported by both `apps/web` and `apps/api`. Phone number normalization to E.164 format defined here.                                       |
| 2 ✅  | I-0.1.4 | Local development infrastructure — Docker Compose for PostgreSQL + Redis                   | ✦       | —        | —      | —                | `docker-compose.yml` at repo root. Can run in parallel with I-0.1.1.                                                                               |
| 3 ✅  | I-0.1.2 | `packages/db` — Drizzle ORM schema, migrations, seed, client                               | ✦       | —        | —      | I-0.1.1, I-0.1.4 | PostgreSQL 17, `prepare: false` for PgBouncer, Drizzle Kit migrations. Needs shared types + running DB.                                            |
| 4 ✅  | I-0.1.3 | Core database tables — users, roles, sessions, consent_records, audit_log                  | ✦       | —        | —      | I-0.1.2          | Foundation tables referenced by every module. All timestamps stored as UTC with IST display in frontend.                                           |
| 5 ✅  | I-0.1.5 | Redis client setup — namespaced connections (sess:, bull:, rl:, cache:, otp:)              | ✦       | —        | —      | I-0.1.4          | `apps/api/src/lib/redis.ts`, `volatile-lru` eviction policy. Needs running Redis from Docker Compose.                                              |
| 6 ✅  | I-0.1.6 | BullMQ queue infrastructure — queue definitions, worker service skeleton, DLQ pattern      | ✦       | —        | —      | I-0.1.5          | Queues: payment-webhook, email, cleanup, exports. Custom failed-jobs queue with alerting via `failed` event handler. Replay tooling for DLQ items. |
| 7 ✅  | I-0.1.8 | Object storage client — S3/R2 presigned URL helper, server-side encryption, access logging | ✦       | —        | —      | I-0.1.3          | Used by KYC upload (Phase 1), event images (Phase 1), roster PDFs (Phase 5). Access log entries written to audit_log table.                        |
| 8 ✅  | I-0.1.7 | Database migration CI pipeline                                                             | ✦       | —        | —      | I-0.1.2, I-0.1.3 | Expand/contract pattern, rollback SQL, lock-risk assessment. CI validates what's already working locally.                                          |
| 9 ✅  | I-0.1.9 | CI/CD deployment pipeline — GitHub Actions for build, test, migrate, deploy                | ✦       | ✦        | —      | All above        | Staging auto-deploy from `main`, production manual promote. Rolling/blue-green with health-checked promotion.                                      |

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

_Covers requirements F-0.2.1 through F-0.2.4_

**Implementation order:** Items are sequenced by dependency. Cross-module dependencies noted explicitly.

| Order | ID       | Feature                                                                               | Backend | Frontend | Shared | Depends on                    | Notes                                                                                                                                                                                                                                                                                                                                   |
| ----- | -------- | ------------------------------------------------------------------------------------- | ------- | -------- | ------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 ✅  | I-0.2.12 | Security headers — CSP, X-Frame-Options, X-Content-Type-Options                       | ✦       | ✦        | —      | —                             | Fastify helmet plugin + TanStack Start response headers. No auth deps, do first.                                                                                                                                                                                                                                                        |
| 2 ✅  | I-0.2.1  | OTP send (phone → MSG91) with WhatsApp OTP fallback                                   | ✦       | —        | ✦      | **I-0.1.1**, **I-0.1.5**      | Rate limited: 1/phone/60s. Redis OTP storage with 5-min TTL. WhatsApp OTP delivery as fallback for SMS failures.                                                                                                                                                                                                                        |
| 3 ✅  | I-0.2.2  | OTP verify → session creation                                                         | ✦       | —        | ✦      | I-0.2.1, **I-0.1.5**          | Redis session (sess:), cookie: `kiran_session`, HttpOnly, Secure, SameSite=Lax, Domain=.eventkart.app, 30-day TTL                                                                                                                                                                                                                       |
| 4 ✅  | I-0.2.3  | Session middleware — decorates `request.session`                                      | ✦       | —        | —      | I-0.2.2                       | Fastify plugin, session from Redis                                                                                                                                                                                                                                                                                                      |
| 5 ✅  | I-0.2.8  | Logout endpoint — clear session                                                       | ✦       | —        | —      | I-0.2.3                       | `POST /api/v1/auth/logout`. Simple, build alongside session middleware.                                                                                                                                                                                                                                                                 |
| 6 ✅  | I-0.2.11 | CSRF protection — anti-CSRF token on state-changing requests                          | ✦       | ✦        | —      | I-0.2.3                       | SameSite cookies + CSRF token validation                                                                                                                                                                                                                                                                                                |
| 7 ✅  | I-0.2.4  | Role-based access control (public, organizer, admin)                                  | ✦       | —        | ✦      | I-0.2.3, **I-0.1.3**          | `requireAuth`, `requireRole('organizer')`, `requireRole('admin')` middleware. Needs users table. **V1 scope:** persistent roles are public, organizer, admin. "Participant" is OTP-verified per booking, not a persistent user role.                                                                                                    |
| 8 ✅  | I-0.2.10 | Internal API key for server-to-server calls                                           | ✦       | ✦        | —      | I-0.2.3                       | `X-Internal-Key` header, higher rate limits (1000/min)                                                                                                                                                                                                                                                                                  |
| 9 ✅  | I-0.2.6  | Admin IP allowlist middleware                                                         | ✦       | —        | —      | I-0.2.4                       | Architecture §6: "Admin: Phone OTP + IP allowlist during pilot." Configurable allowlist via env var.                                                                                                                                                                                                                                    |
| 10 ✅ | I-0.2.5  | Organizer email verification                                                          | ✦       | ✦        | ✦      | I-0.2.4                       | Architecture §6: "Organizer: Phone OTP + email verification." Elevated role assigned after email verification + admin approval.                                                                                                                                                                                                         |
| 11 ✅ | I-0.2.9  | Session forwarding for SSR — TanStack Start forwards cookie in server-to-server calls | —       | ✦        | —      | I-0.2.3, **I-0.3.6**          | `X-Request-ID` propagation, `INTERNAL_API_URL` for SSR. **Cross-dep on Module 0.3 API client.**                                                                                                                                                                                                                                         |
| 12 ✅ | I-0.2.7  | Deferred authentication pattern — browsing unauthenticated, OTP at booking            | ✦       | ✦        | —      | I-0.2.1, I-0.2.2, **I-0.3.1** | Frontend routing respects auth state; booking flow triggers OTP. **Cross-dep on Module 0.3 layout shell.**                                                                                                                                                                                                                              |
| 13    | I-0.2.13 | Secret rotation runbook + automated reminder                                          | ✦       | —        | —      | I-0.2.2, I-0.2.10             | Architecture §6: rotation procedure for `SESSION_SECRET`, `CSRF_SECRET`, `HMAC_TICKET_SECRET`, `INTERNAL_API_KEY`, `RAZORPAY_WEBHOOK_SECRET`. Runbook in `docs/runbooks/secret-rotation.md` + 90-day BullMQ reminder job that opens an admin notification.                                                                              |
| 14 ✅ | I-0.2.14 | INTERNAL_API_KEY blank-string handling fix (test hotfix)                              | ✦       | —        | —      | I-0.2.10                      | Config validation in `apps/api/src/lib/config.ts` must coerce empty `INTERNAL_API_KEY` to `undefined` before SHA256 hash. Fixes failing test `apps/api/test/app.test.ts > buildApp > treats a blank internal api key as unset`.                                                                                                         |
| 15 ✅ | I-0.2.15 | Internal-key plugin error message differentiation (test hotfix)                       | ✦       | —        | —      | I-0.2.10                      | `apps/api/src/plugins/internal-key.ts` must distinguish "Internal API key not configured" (when key absent) from "Invalid internal API key" (when key wrong). Fixes failing test `apps/api/test/plugins/internal-key.test.ts > internal-key plugin > INTERNAL_API_KEY not configured > returns 401 when X-Internal-Key header is sent`. |

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
- Secret rotation runbook + reminder job (I-0.2.13) and INTERNAL_API_KEY hotfixes (I-0.2.14, I-0.2.15) before V1 launch

### Module 0.3: Design System & App Shell

_Covers requirements F-0.3.1 through F-0.3.4_

**Implementation order:** Steps 1–3 have no cross-module dependencies and can start in parallel with Module 0.2. Step 6 must wait for Module 0.2 RBAC.

| Order | ID      | Feature                                                                                | Backend | Frontend | Shared | Depends on                        | Notes                                                                                                                            |
| ----- | ------- | -------------------------------------------------------------------------------------- | ------- | -------- | ------ | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1 ✅  | I-0.3.6 | API client setup — hybrid communication (INTERNAL_API_URL for SSR, public for browser) | —       | ✦        | —      | —                                 | `apps/web/src/lib/api-client.ts`. Foundation for all frontend-API communication.                                                 |
| 2 ✅  | I-0.3.1 | Mobile-first responsive layout shell                                                   | —       | ✦        | —      | —                                 | `__root.tsx`, `_public` layout (SSR), `_authed` layout (CSR). Can parallel with I-0.3.6.                                         |
| 3 ✅  | I-0.3.2 | Core UI component library — buttons, forms, cards, modals, navigation, toasts          | —       | ✦        | —      | —                                 | shadcn/ui v4 components in `apps/web/src/components` and `packages/ui`. Can parallel with I-0.3.1.                               |
| 4 ✅  | I-0.3.4 | Error handling patterns — error boundaries, 404, API error display                     | —       | ✦        | —      | I-0.3.1, I-0.3.6                  | Consistent error UI across all surfaces                                                                                          |
| 5 ✅  | I-0.3.5 | Loading state patterns — skeleton screens, spinners, optimistic UI foundations         | —       | ✦        | —      | I-0.3.1                           | Consistent loading UX                                                                                                            |
| 6 ✅  | I-0.3.3 | Role-based routing and navigation structure                                            | —       | ✦        | —      | I-0.3.1, **I-0.2.4**              | `/` public, `/org/*` organizer, `/admin/*` admin, `/my/*` participant. **Cross-dep on Module 0.2 RBAC middleware.**              |
| 7 ✅  | I-0.2.9 | Session forwarding for SSR — TanStack Start forwards cookie in server-to-server calls  | —       | ✦        | —      | **I-0.2.3**, I-0.3.6              | `X-Request-ID` propagation, `INTERNAL_API_URL` for SSR. **Deferred from Module 0.2 — depends on I-0.3.6 API client.**            |
| 8 ✅  | I-0.2.7 | Deferred authentication pattern — browsing unauthenticated, OTP at booking             | ✦       | ✦        | —      | **I-0.2.1**, **I-0.2.2**, I-0.3.1 | Frontend routing respects auth state; booking flow triggers OTP. **Deferred from Module 0.2 — depends on I-0.3.1 layout shell.** |

**Deliverables:**

- API client with hybrid SSR/browser communication
- Fully functional app shell with responsive layouts
- Core shadcn/ui components configured and styled
- Error and loading state patterns established
- Role-based routing and navigation (after RBAC is ready)
- SSR session forwarding from TanStack Start (deferred from Module 0.2)
- Deferred auth pattern for unauthenticated browsing (deferred from Module 0.2)

### Module 0.4: Observability, Metrics & Error Infrastructure

_Covers infrastructure requirements from architecture §4.3, §4.4, §4.5_

**Implementation order:** Steps 1–2 have no cross-module dependencies and can start in parallel with Modules 0.2/0.3. Steps 3–6 require Module 0.1 infrastructure.

| Order | ID      | Feature                                                                                                                | Backend | Frontend | Shared | Depends on               | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----- | ------- | ---------------------------------------------------------------------------------------------------------------------- | ------- | -------- | ------ | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 ✅  | I-0.4.2 | Pino structured logging with request correlation IDs + OpenTelemetry bridge                                            | ✦       | —        | —      | —                        | ✅ `X-Request-ID` in every log line. Pino + OpenTelemetry bridge for log↔trace correlation. Foundation for all observability.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2 ✅  | I-0.4.1 | Sentry integration — separate projects for client-side, SSR server, API server                                         | ✦       | ✦        | —      | —                        | ✅ @sentry/node for API (conditional OTEL, PII scrubbing, 5xx capture). @sentry/tanstackstart-react for web (browserTracing, replay, error boundaries). Graceful no-op when DSN unset.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 3 ✅  | I-0.4.3 | Health check endpoints — Fastify (`GET /health`, `GET /ready`) + TanStack Start (`GET /health`, `GET /ready`)          | ✦       | ✦        | —      | **I-0.1.2**, **I-0.1.5** | ✅ Fastify: liveness + readiness with parallel PostgreSQL + Redis checks. TanStack Start: liveness + readiness with API reachability check.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 4 ✅  | I-0.4.4 | Audit log table and logging utility                                                                                    | ✦       | —        | —      | **I-0.1.3**              | ✅ createAuditLogger factory with log()/logBatch(). Fire-and-forget error handling. AUDIT_ACTIONS + AUDIT_RESOURCE_TYPES constants in shared. 382 API tests passing (11 audit).                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 5 ✅  | I-0.4.5 | Production metrics emitter — booking RPS, payment latency, webhook ACK latency, queue depth, DB pool wait, Redis usage | ✦       | —        | —      | I-0.4.2, **I-0.1.5**     | ✅ OTEL MeterProvider + metrics exporter infrastructure. HTTP request metrics (duration histogram, request counter). OTP send/verify metrics. Conversion funnel counters. Redis INFO polling. All future business metric instruments pre-defined.                                                                                                                                                                                                                                                                                                                                                                          |
| 6 ✅  | I-0.4.6 | BullMQ observability — queue depth, oldest job age, retry count, DLQ count per queue                                   | ✦       | —        | —      | I-0.4.2, **I-0.1.6**     | ✅ Queue polling (30s) via getJobCounts()/getJobs(). Per-queue depth, oldest job age, delayed (retry), failed gauges. DLQ total depth. 403 API tests passing.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 7     | I-0.4.7 | Conversion funnel: explicit `started_registrations` event emission + organizer-facing dashboard tile                   | ✦       | ✦        | —      | I-0.4.5, **I-3.1.1**     | Refines I-0.4.5's vague "conversion funnel counters" into a concrete metric. Increment counter when registration form first loads (not on submit). Pair with `paid_bookings` to compute `completion_rate = paid ÷ started`. Surface as a tile on organizer dashboard via I-4.1.6. Supports product-plan §11 success metric "Registration completion rate". **Scheduling:** because emission depends on `I-3.1.1` (registration category-selection page), this item is built in **Phase 3 Wave 2 alongside `I-3.1.1`**, not in any Phase 0 wave. The Phase 0 row exists only to keep the metric/Phase 0 inventory complete. |

**Deliverables:**

- Structured logging with request correlation and OpenTelemetry bridge
- Sentry error tracking on all three surfaces
- Health/readiness endpoints for Railway auto-scaling (both services)
- Audit log infrastructure ready for all modules
- Production metrics pipeline for day-one observability
- BullMQ queue observability with DLQ alerting
- Conversion funnel metric (`started_registrations`) wired to organizer dashboard (I-0.4.7) for product-plan §11 success criteria

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

1. `I-0.2.12` Security headers _(quick win, independent)_
2. `I-0.4.2` Pino logging _(sets up correlation IDs used everywhere)_
3. `I-0.4.1` Sentry _(error tracking from this point on)_
4. `I-0.3.6` API client _(foundation for all frontend-API calls)_
5. `I-0.3.1` Layout shell _(app skeleton)_
6. `I-0.3.2` UI components _(needed by all frontend features)_
7. `I-0.2.1` → `I-0.2.2` → `I-0.2.3` OTP + session _(core auth chain)_
8. `I-0.2.8` Logout _(trivial, build with session middleware)_
9. `I-0.2.11` CSRF _(needs session middleware)_
10. `I-0.2.4` RBAC _(needs session + users table)_
11. `I-0.2.10` Internal API key _(needs session middleware)_

**Wave 3 — Remaining Module 0.1 + cross-dependent items**
Complete the rest of Module 0.1 and items that have cross-module deps:

1. `I-0.1.6` BullMQ _(needs Redis from Wave 1)_
2. `I-0.1.8` Object storage _(needs audit_log from Wave 1)_
3. `I-0.4.3` Health checks _(needs DB + Redis from Wave 1)_
4. `I-0.4.4` Audit log utility _(needs audit_log table from Wave 1)_
5. `I-0.3.4` Error handling _(needs layout + API client from Wave 2)_
6. `I-0.3.5` Loading states _(needs layout from Wave 2)_
7. `I-0.2.6` Admin IP allowlist _(needs RBAC from Wave 2)_
8. `I-0.2.5` Organizer email verification _(needs RBAC from Wave 2)_

**Wave 4 — Cross-module finishers + CI**
Items that depend on multiple modules being complete:

1. `I-0.3.3` Role-based routing _(needs RBAC from 0.2 + layout from 0.3)_
2. `I-0.2.9` SSR session forwarding _(needs session middleware + API client)_
3. `I-0.2.7` Deferred auth pattern _(needs OTP flow + layout shell)_
4. `I-0.4.5` Production metrics _(needs Pino + Redis)_
5. `I-0.4.6` BullMQ observability _(needs BullMQ + Pino)_
6. `I-0.1.7` Migration CI pipeline _(validates local work)_
7. `I-0.1.9` CI/CD pipeline _(final, validates everything)_

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

_Covers requirements F-1.1.1 through F-1.1.6_

**Implementation order:** Registration form is the foundation. Document upload and policy acceptance extend it. Admin review and approval actions come last.

| Order | ID       | Feature                                                                  | Backend | Frontend | Shared | Depends on                            | Notes                                                                                                                                                                                                                                             |
| ----- | -------- | ------------------------------------------------------------------------ | ------- | -------- | ------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 ✅  | I-1.1.1  | Organizer registration form — business name, contact details, city       | ✦       | ✦        | ✦      | **I-0.1.1**, **I-0.1.3**, **I-0.2.4** | `POST /api/v1/organizers`, Zod schema in shared. Creates `organizers` table + migration.                                                                                                                                                          |
| 2 ✅  | I-1.1.3  | Policy acceptance workflow — platform terms, refund policy framework     | ✦       | ✦        | ✦      | I-1.1.1, **I-0.1.3**                  | Consent versioning, no pre-checked boxes. Uses `consent_records` table from Phase 0. Can parallel with I-1.1.2.                                                                                                                                   |
| 3 ✅  | I-1.1.2  | Verification document upload — Aadhaar, PAN, GST certificate, bank proof | ✦       | ✦        | —      | I-1.1.1, **I-0.1.8**                  | Upload to S3/R2 via presigned URLs, server-side encryption at rest, access logged. Can parallel with I-1.1.3.                                                                                                                                     |
| 4 ✅  | I-1.1.8  | Organizer profile management — view and edit organizer profile           | ✦       | ✦        | ✦      | I-1.1.1, **I-0.3.3**                  | `/org/profile` route. Business name, description, city. Separate from the public-facing profile (Phase 2).                                                                                                                                        |
| 5 ✅  | I-1.1.4  | Verification status tracking — pending → approved/rejected               | ✦       | ✦        | ✦      | I-1.1.1, I-1.1.2, I-1.1.3             | Target 2-business-day SLA from complete submission. Status enum in shared package.                                                                                                                                                                |
| 6 ✅  | I-1.1.5  | Admin verification review interface — approve/reject with notes          | ✦       | ✦        | —      | I-1.1.4, **I-0.3.3**, **I-0.4.4**     | Backend: 5 REST endpoints, admin service with Drizzle transactions, audit logging, 26 tests. Frontend: queue + detail pages, doc viewer, approve/reject dialogs.                                                                                  |
| 7 ✅  | I-1.1.6  | Verification badge assignment on approval                                | ✦       | ✦        | —      | I-1.1.5                               | VerifiedBadge component in packages/ui. Publishing eligibility gated by isVerified + razorpayAccountStatus. Badge shown in organizer dashboard, profile, admin detail.                                                                            |
| 8 ✅  | I-1.1.7  | Razorpay Route linked-account creation + KYC sync                        | ✦       | —        | —      | I-1.1.5                               | Razorpay client lib, Fastify plugin, BullMQ async job on approval. Admin retry endpoint. Publishing gate: canPublishPaidEvents = isVerified && razorpayAccountStatus === "active". 528 API tests passing.                                         |
| 9 🟡  | I-1.1.9  | Welcome email on organizer signup                                        | ✦       | —        | —      | I-1.1.1, **I-3.3.1**                  | 🟡 **Stubbed (Phase 3, W2.1, 2026-04-29)** — `emitEmailStub()` helper wired at trigger site (`POST /api/v1/organizers` success). Idempotency key: `organizer-welcome:{organizerId}`. Real Resend template + BullMQ processor deferred to I-3.3.1. |
| 10 🟡 | I-1.1.10 | Verification-approved email                                              | ✦       | —        | —      | I-1.1.5, I-1.1.7, **I-3.3.1**         | 🟡 **Stubbed (Phase 3, W2.1, 2026-04-29)** — `emitEmailStub()` wired at admin approval trigger site. Idempotency key: `verification-approved:{organizerId}`. Real Resend template deferred to I-3.3.1.                                            |
| 11 🟡 | I-1.1.11 | Verification-rejected email                                              | ✦       | —        | —      | I-1.1.5, **I-3.3.1**                  | 🟡 **Stubbed (Phase 3, W2.1, 2026-04-29)** — `emitEmailStub()` wired at admin rejection trigger site. Idempotency key: `verification-rejected:{organizerId}:{timestamp}`. Real Resend template deferred to I-3.3.1.                               |
| 12 🟡 | I-1.1.12 | Razorpay linked-account ready email                                      | ✦       | —        | —      | I-1.1.7, **I-3.3.1**                  | 🟡 **Stubbed (Phase 3, W2.1, 2026-04-29)** — `emitEmailStub()` wired at `razorpay_account_status → active` transition. Idempotency key: `razorpay-ready:{organizerId}`. Real Resend template deferred to I-3.3.1.                                 |

**Database tables:** `organizers` (with `slug` column added in migration 0015 — see W1.1), `organizer_verifications`, `verification_documents`, `policy_acceptances`

**Phase 2 Readiness additions to Module 1.1 (2026-04-29):**

- **W1.1 — Organizer slug** (`organizers.slug`): deterministic slug generation from business name, unaccent-backed collision-safe backfill for existing records, full reserved public-slug list, `NOT NULL` invariant, and redirect-on-businessName-change wired so `organizers.slug` + `slug_redirects` are updated in one transaction. Migration: `0015_organizers_slug.sql`.
- **W2.1 — Email stubs**: `emitEmailStub()` helper in `apps/api/src/lib/email-stub.ts`; `EMAIL_JOB_NAMES` typed enum + idempotency-key builders in `packages/shared/src/constants/email-jobs.ts`. Log-only at all 6 trigger sites for I-1.1.9–12 and I-1.2.11–12. Real email processing blocked on I-3.3.1.

### Module 1.2: Event Creation & Management

_Covers requirements F-1.2.1 through F-1.2.8_

**Implementation order:** Slug generation and event creation are the foundation. Category, pricing, form fields, and policy extend the event. Publish workflow and admin review gate the event for public visibility.

| Order | ID       | Feature                                                                                  | Backend | Frontend | Shared | Depends on                                        | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----- | -------- | ---------------------------------------------------------------------------------------- | ------- | -------- | ------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 ✅  | I-1.2.10 | Slug generation for events — unique, URL-safe, with redirect on edit                     | ✦       | —        | ✦      | **I-0.1.1**, **I-0.1.3**                          | API service foundation complete: unique slug reservation checks active events + historical redirects, deterministic suffixes, and redirect recording on slug change.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2 ✅  | I-1.2.1  | Event creation form — V1-allowed events only (single-day, paid running, Coimbatore)      | ✦       | ✦        | ✦      | I-1.2.10, **I-1.1.1**, **I-0.3.3**                | Complete: events table fields + migration, shared validation/constants, `POST /api/v1/events` with organizer auth + CSRF and slug uniqueness, `/org/events/new` draft form UI.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 3 ✅  | I-1.2.2  | Event category & distance configuration — 5K, 10K, half-marathon                         | ✦       | ✦        | ✦      | I-1.2.1                                           | Complete: shared defaults/schemas, `event_categories` table + migration/rollback, `GET/PUT /api/v1/events/:eventId/categories`, and organizer category configuration UI. **v2.2 amendment — ✅ Shipped (W1.2, migration 0016, 2026-04-29):** `spots_total` (NOT NULL) and `spots_remaining` (NOT NULL, default = `spots_total`) capacity columns added via multi-step migration (nullable → backfill 100/100 → NOT NULL → CHECK constraints); shared schema bounds. Atomic decrement deferred to I-3.2.10 (Phase 3).                                                                                                                                                                                           |
| 4 ✅  | I-1.2.3  | Pricing configuration — per category, early-bird support                                 | ✦       | ✦        | ✦      | I-1.2.2                                           | Complete: `{ category, base_price, early_bird_price, early_bird_deadline }` pricing tiers with API + organizer UI. Server-side helper validates applicable price before booking/payment trust.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 5 ✅  | I-1.2.4  | Registration form field configuration — standard + fitness-specific fields               | ✦       | ✦        | ✦      | I-1.2.1                                           | Complete: JSONB `form_schema` with version, shared schema/catalog and default form, organizer-scoped `GET/PUT /api/v1/events/:eventId/registration-form`, and `/org/events/$eventId/configure-registration-fields` UI.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 6 ✅  | I-1.2.5  | Refund & cancellation policy capture per event                                           | ✦       | ✦        | ✦      | I-1.2.1                                           | Complete: stored alongside event, shared policy schema, API get/update routes, organizer UI, and publish readiness integration.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 7 ✅  | I-1.2.9  | Event image upload — hero image, route map                                               | ✦       | ✦        | ✦      | I-1.2.1, **I-0.1.8**                              | Complete: shared image constants/schemas, `event_images` table + migration/rollback, organizer presigned upload/confirm/list/delete API, and `/org/events/$eventId/configure-images` UI.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 8 ✅  | I-1.2.8  | Event edit & update capabilities (tiered post-publish)                                   | ✦       | ✦        | ✦      | I-1.2.1 through I-1.2.5, I-1.2.9                  | **✅ Fully complete (W1.3, 2026-04-29; GPT 5.5 round-2 fixed).** v2.2 tiered post-publish edits implemented: `publishedEventPatchSchema` is permissive at the route boundary for known event fields, handler-side high-risk detection returns structured 409 `PUBLISHED_EVENT_HIGH_RISK_EDIT_REQUIRES_UNPUBLISH` with `details.requiresUnpublish=true` and `details.highRiskFields`, mixed payloads are rejected atomically, `EVENT_UPDATE_PUBLISHED` audit metadata is constrained to `{organizerId, changedFields, transition}`, and `updateEventPolicies` remains unlocked for published events. CDN purge follow-up pending Cloudflare/I-2.4.2 integration.                                                |
| 9 ✅  | I-1.2.6  | Event publish workflow — draft → published (with first-3-paid admin gate via I-1.2.7)    | ✦       | ✦        | ✦      | I-1.2.1 through I-1.2.5, **I-1.1.6**, **I-1.1.7** | Complete. **v2.2 note clarification:** organizer can self-publish when verification + Razorpay + completeness gates pass; first paid events from a new organizer route through admin review (I-1.2.7) before status flips to `published`. There is no general `under_review` state for established organizers. **W1.5 (2026-04-29; GPT 5.5 round-2 fixed):** `events.first_published_at` column added (migration 0017) with partial paid-event index `events_organizer_first_published_paid_idx`; set once in `publishEvent` + `adminApproveEvent`, never cleared on unpublish; regression covers publish-3 → unpublish-1 → next paid event review routing. See [impl-plan](impl-plan/feature-1.2-I-1.2.6.md). |
| 10 ✅ | I-1.2.7  | Admin event review interface — manual review for first 3 paid events from new organizers | ✦       | ✦        | ✦      | I-1.2.6, **I-0.3.3**, **I-0.4.4**                 | Complete: publish-time first-3 paid event policy, admin event-review shared contracts, `/api/v1/admin/event-reviews` list/detail/approve/reject endpoints with audit logging, and `/admin/event-reviews` queue/detail UI. See [impl-plan](impl-plan/feature-1.2-I-1.2.7.md).                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 11 🟡 | I-1.2.11 | Event submitted-for-review email (organizer ack)                                         | ✦       | —        | —      | I-1.2.6, **I-3.3.1**                              | 🟡 **Stubbed (Phase 3, W2.1, 2026-04-29)** — `emitEmailStub()` wired at submit-for-review trigger site. Idempotency key: `event-review-submitted:{eventId}`. Real Resend template + BullMQ processor deferred to I-3.3.1. Transactional.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 12 🟡 | I-1.2.12 | Event approved / event rejected emails                                                   | ✦       | —        | —      | I-1.2.7, **I-3.3.1**                              | 🟡 **Stubbed (Phase 3, W2.1, 2026-04-29)** — `emitEmailStub()` wired at `/approve` and `/reject` admin action trigger sites. Idempotency keys: `event-approved:{eventId}` / `event-rejected:{eventId}:{timestamp}`. Real Resend templates deferred to I-3.3.1. Transactional.                                                                                                                                                                                                                                                                                                                                                                                                                                  |

**Database tables:** `events` (with `first_published_at` column added in migration 0017 — see W1.5), `event_categories` (with `spots_total` + `spots_remaining` capacity columns added in migration 0016 — see W1.2), `event_pricing_tiers`, `event_images`

**Phase 2 Readiness additions to Module 1.2 (2026-04-29):**

- **W1.2 — Capacity columns** (`event_categories.spots_total`, `spots_remaining`): multi-step migration 0016. Draft-only API surfacing; atomic decrement deferred to I-3.2.10.
- **W1.3 — Tiered post-publish edits**: permissive `publishedEventPatchSchema`, handler-side high-risk detection, structured 409 `PUBLISHED_EVENT_HIGH_RISK_EDIT_REQUIRES_UNPUBLISH` with `requiresUnpublish` + `highRiskFields`, atomic mixed-payload rejection, and `EVENT_UPDATE_PUBLISHED` audit metadata constrained to `{organizerId, changedFields, transition}`.
- **W1.5 — first_published_at** (`events.first_published_at`): migration 0017 plus partial paid-event index. Set once on first publish/admin-approve; never cleared. Closes the unpublish→republish bypass of the first-paid admin-review gate (security/policy fix), with regression coverage.
- **W2.3 — Presigned upload hardening**: `getUploadUrl()` uses `createPresignedPost` with `content-length-range` + content-type equality + SSE conditions; response `{ url, method: "POST", fields, key, expiresAt }`; web upload consumers use FormData POST.

**Key schema decisions:**

- JSONB column for organizer-configured form fields with `form_schema_version`
- Early-bird pricing as array of pricing tiers
- Composite indexes: `(event_id, status, created_at)`
- Slug uniqueness constraint with redirect table for changed slugs

### Phase 1 Execution Strategy — Solo Developer

Module 1.1 must largely complete before Module 1.2 can start (events belong to organizers). Work in 3 waves:

**Wave 1 — Organizer registration + extensions**
Build the organizer entity and the three things that extend registration (doc upload, policy, profile).

1. `I-1.1.1` Organizer registration form _(creates `organizers` table, the foundation)_
2. `I-1.1.3` Policy acceptance _(extends registration — consent records)_
3. `I-1.1.2` Verification document upload _(extends registration — needs object storage)_
4. `I-1.1.8` Organizer profile management _(organizer self-service `/org/profile`)_
5. `I-1.1.9` Welcome email on signup _(transactional, fires after I-1.1.1)_

**Wave 2 — Verification pipeline + event foundation**
Verification status tracking enables the admin review pipeline. Slug generation and event creation can start once organizers exist.

1. `I-1.1.4` Verification status tracking _(needs registration + docs + policy)_
2. `I-1.1.5` Admin verification review _(needs status tracking + audit log)_
3. `I-1.1.6` Verification badge _(triggered by admin approval)_
4. `I-1.1.7` Razorpay linked-account _(triggered by admin approval, parallel with I-1.1.6)_
5. `I-1.1.10` Verification-approved email _(triggered by I-1.1.5 approve action)_
6. `I-1.1.11` Verification-rejected email _(triggered by I-1.1.5 reject action)_
7. `I-1.1.12` Razorpay linked-account ready email _(triggered by I-1.1.7 status transition to active)_
8. `I-1.2.10` Slug generation _(utility, no 1.1 deps beyond shared/DB — parallel with I-1.1.4+)_

**Wave 3 — Event creation, configuration & publishing**
Build the event form and all its extensions, then the publish/review pipeline.

1. `I-1.2.1` Event creation form _(creates `events` table — needs organizer from Wave 1)_
2. `I-1.2.2` Event category config _(extends events — `event_categories` table with capacity columns)_
3. `I-1.2.3` Pricing config _(extends categories — `event_pricing_tiers` table)_
4. `I-1.2.4` Registration form field config _(extends events — JSONB, parallel with I-1.2.3)_
5. `I-1.2.5` Refund policy capture _(extends events, parallel with I-1.2.3/I-1.2.4)_
6. `I-1.2.9` Event image upload _(extends events — needs object storage, parallel with I-1.2.3-5)_
7. `I-1.2.8` Event edit/update _(needs all event fields to exist; tiered post-publish edits)_
8. `I-1.2.6` Event publish workflow _(needs verification badge + Razorpay account from Wave 2)_
9. `I-1.2.7` Admin event review _(first-3-paid gate; needs publish workflow)_
10. `I-1.2.11` Event submitted-for-review email _(triggered by I-1.2.6 → admin queue)_
11. `I-1.2.12` Event approved/rejected emails _(triggered by I-1.2.7 actions)_

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

\*_(∥) = can run in parallel with the item above it for a multi-developer team, but for solo dev, proceed sequentially._

**Validate after each wave:** Run `check-types`, `lint`, and `test` for all affected workspaces.

---

## Phase 2: Event Discovery & Public Pages

**Goal:** Make published events discoverable and present them professionally. These are the SEO-critical, CDN-cached surfaces that organizers will share and participants will land on.

**Why third:** Events must exist (Phase 1) before they can be displayed. These public pages are what drives participant discovery.

**Prerequisites:** Phase 1 (events must exist in the system).

### Module 2.1: Event Detail Page

_Covers requirements F-2.1.1 through F-2.1.8_

**Implementation order:** The page layout is the foundation. Sections, SEO, and CTA extend it. I-2.1.8 (mobile-first design) is not a separate step — it's a constraint applied while building I-2.1.1.

| Order | ID       | Feature                                                                                              | Backend | Frontend | Shared | Depends on                                         | Notes                                                                                                                                                                                                                                                                                                                |
| ----- | -------- | ---------------------------------------------------------------------------------------------------- | ------- | -------- | ------ | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 ✅  | I-2.1.1  | Professional event page layout — route, categories, pricing, timing, location, hero image, route map | ✦       | ✦        | —      | **I-1.2.1**, **I-1.2.2**, **I-1.2.3**, **I-1.2.9** | SSR with `ssr: true`, CDN `s-maxage=60` + `stale-while-revalidate=300`, no `Vary: Cookie`. `GET /api/v1/events/by-slug/:slug` returns discriminated union; legacy slugs emit web-side 301; status-gated, loop-safe; presigned image URLs (TTL 3600s).                                                                |
| ✅    | I-2.1.8  | Mobile-first responsive event page design                                                            | —       | ✦        | —      | I-2.1.1                                            | **Implemented as part of I-2.1.1** (2026-04-30) — not a separate step. Optimized for mobile browsers.                                                                                                                                                                                                                |
| 2 ✅  | I-2.1.2  | Organizer info section with verification badge                                                       | ✦       | ✦        | —      | I-2.1.1, **I-1.1.1**, **I-1.1.6**                  | Link to organizer profile (wired to I-2.3.1 when built). Completed 2026-04-30.                                                                                                                                                                                                                                                             |
| 3 ✅  | I-2.1.3  | Policy display — refund, cancellation policies visible before booking                                | —       | ✦        | —      | I-2.1.1, **I-1.2.5**                               | **Complete (2026-04-30)** — `PublicEventPolicySection` renders refund + cancellation as stacked SSR-safe subsections (no Tabs/JS-gated mounting) with `#policies`/`#refund-policy`/`#cancellation-policy` anchors, organizer-named trust copy, explicit fallback when both are missing, sidebar CTA policy link. Mobile bottom-bar policy link deferred to I-2.1.7. GPT-5.5 plan + code review (no findings). |
| 4 ✅  | I-2.1.4  | Category & pricing breakdown display                                                                 | —       | ✦        | —      | I-2.1.1, **I-1.2.3**                               | **Complete (2026-04-29)** — combined category & pricing breakdown card replaces I-2.1.1 stub tables; client-only `Active`/`Expired` badges + "From ₹X" CTA via `useNow()` keep CDN-cached HTML truthful; centralized `hasValidEarlyBirdOffer` legacy-guard type-predicate keeps breakdown column and CTA in sync. Two GPT-5.5 reviews (all findings adopted).                                                                                                                                                                                                                                                                                                                                                                          |
| 5     | I-2.1.5  | Share-optimized previews — Open Graph meta tags                                                      | —       | ✦        | —      | I-2.1.1                                            | Social/messaging share optimization. Can parallel with I-2.1.6.                                                                                                                                                                                                                                                      |
| 6     | I-2.1.6  | Structured data markup — JSON-LD for search discovery                                                | —       | ✦        | —      | I-2.1.1                                            | Schema.org Event markup. Can parallel with I-2.1.5.                                                                                                                                                                                                                                                                  |
| 7     | I-2.1.7  | "Register Now" CTA linking to booking flow                                                           | —       | ✦        | —      | I-2.1.1                                            | Prominent, mobile-first call-to-action. Links to Phase 3 booking flow (placeholder until Phase 3).                                                                                                                                                                                                                   |
| 8     | I-2.1.9  | Spots-remaining badge — real-data only                                                               | ✦       | ✦        | —      | I-2.1.1, **I-1.2.2**, **I-3.2.10**                 | Optional per-category "X spots remaining" badge wired to `event_categories.spots_remaining`. Hidden when capacity is unset (organizer chose unlimited). Updates via SSR + revalidation; no speculative or placeholder values. Product-plan §6 Tier 1.2 ("social proof and urgency only where real and supportable"). |
| 9     | I-2.1.10 | Early-bird countdown timer — real-data only                                                          | —       | ✦        | —      | I-2.1.1, **I-1.2.3**                               | Optional countdown rendered when an event has an active early-bird tier with a future `early_bird_deadline`. Format: "Early-bird closes in 2d 3h". Refreshes client-side every minute. Hidden when no early-bird tier is configured.                                                                                 |

### Module 2.2: Event Discovery Surface

_Covers requirements F-2.2.1 through F-2.2.4_

**Implementation order:** Status enum first (shared), then card component, then listing page, then sort/pagination.

| Order | ID      | Feature                                                                | Backend | Frontend | Shared | Depends on                    | Notes                                                                              |
| ----- | ------- | ---------------------------------------------------------------------- | ------- | -------- | ------ | ----------------------------- | ---------------------------------------------------------------------------------- |
| 1     | I-2.2.3 | Event status indicators — upcoming, registration open/closed, sold out | ✦       | ✦        | ✦      | **I-0.1.1**                   | Status enum in shared package. Foundation for cards and listing.                   |
| 2     | I-2.2.2 | Event cards — name, date, location, price range, categories            | —       | ✦        | —      | I-2.2.3                       | Compact card component. Reusable across listing and organizer profile.             |
| 3     | I-2.2.1 | Launch-city event listing page (Coimbatore)                            | ✦       | ✦        | —      | I-2.2.2, I-2.2.3, **I-1.2.1** | SSR with `ssr: true`, CDN-cacheable, `/` route. API endpoint for published events. |
| 4     | I-2.2.4 | Sort by date (default: upcoming first)                                 | ✦       | ✦        | —      | I-2.2.1                       | URL-state pagination and sort in search params.                                    |

### Module 2.3: Organizer Public Profile

_Covers requirements F-2.3.1 through F-2.3.4_

**Implementation order:** Slug generation first (utility), then profile page, then sub-sections.

| Order | ID      | Feature                                                                 | Backend | Frontend | Shared | Depends on                        | Notes                                                                                                                                                                                                                                                                                                                                                                 |
| ----- | ------- | ----------------------------------------------------------------------- | ------- | -------- | ------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | I-2.3.5 | Organizer slug generation — unique, URL-safe                            | ✦       | —        | ✦      | **I-0.1.1**, **I-1.1.1**          | Uniqueness constraint, redirect on change. Build slug utility before profile page.                                                                                                                                                                                                                                                                                    |
| 2     | I-2.3.1 | Organizer profile page — business name, description, verification badge | ✦       | ✦        | —      | I-2.3.5, **I-1.1.1**, **I-1.1.6** | SSR with `ssr: true`, `/organizers/:slug`.                                                                                                                                                                                                                                                                                                                            |
| 3     | I-2.3.4 | Verification status explanation copy                                    | —       | ✦        | —      | I-2.3.1                           | Describes verification as onboarding check, not quality guarantee. Can parallel with I-2.3.2.                                                                                                                                                                                                                                                                         |
| 4     | I-2.3.2 | Upcoming events listing on organizer profile                            | ✦       | ✦        | —      | I-2.3.1, **I-1.2.1**              | Query events by organizer. Reuses event card component from I-2.2.2 if available.                                                                                                                                                                                                                                                                                     |
| 5     | I-2.3.3 | Past event history on organizer profile                                 | ✦       | ✦        | —      | I-2.3.1, **I-1.2.1**              | Builds organizer credibility. Can parallel with I-2.3.2.                                                                                                                                                                                                                                                                                                              |
| 6     | I-2.3.6 | Next-event lookup API — same-organizer only                             | ✦       | —        | ✦      | I-2.3.1, **I-1.2.1**, **I-1.2.6** | `GET /api/v1/organizers/{organizerId}/next-event` returns the organizer's immediate next published event (or null). Used by I-6.2.3 to populate the post-event next-event prompt. **V1 scope: same-organizer only.** Cross-organizer next-event discovery is deferred to product-plan §8 Layer 5 post-V1 (after Coimbatore density target of 15+ organizers per §10). |

### Module 2.4: CDN & Cache Infrastructure

_Covers architecture §1, §4.2 requirements for CDN caching and invalidation_

**Implementation order:** CDN setup first, then invalidation, then stampede prevention. This module should be built after at least one SSR page exists (Module 2.1 or 2.2).

| Order | ID      | Feature                                                                                                                       | Backend | Frontend | Shared | Depends on                 | Notes                                                                                                                                                                                                                  |
| ----- | ------- | ----------------------------------------------------------------------------------------------------------------------------- | ------- | -------- | ------ | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | I-2.4.1 | Cloudflare CDN setup — DNS, SSL, caching rules for SSR pages                                                                  | —       | ✦        | —      | **I-2.1.1** or **I-2.2.1** | Cache SSR event pages at edge, static assets, DDoS protection. Needs at least one SSR page to configure and test against.                                                                                              |
| 2     | I-2.4.2 | CDN cache invalidation — Cloudflare API purge on event publish/unpublish, pricing changes, capacity changes, admin moderation | ✦       | —        | —      | I-2.4.1, **I-1.2.6**       | Purge specific cache keys when event data changes.                                                                                                                                                                     |
| 3     | I-2.4.3 | Cache stampede prevention — single-flight/Redis locking for popular event pages                                               | ✦       | —        | —      | I-2.4.1, **I-0.1.5**       | Architecture §1: prevents origin overload when cache expires on popular events.                                                                                                                                        |
| 4     | I-2.4.4 | `sitemap.xml` generation + serving                                                                                            | ✦       | ✦        | —      | I-2.4.1, **I-1.2.6**       | Auto-generated from published events + organizer profiles. Cached at edge with 1-hour TTL. Submitted to Google Search Console + Bing Webmaster. Regenerated daily via BullMQ + invalidated on event publish/unpublish. |
| 5     | I-2.4.5 | `robots.txt` + crawl directives                                                                                               | —       | ✦        | —      | I-2.4.1                    | Allow public surfaces (`/`, `/events/*`, `/organizers/*`, `/privacy`, `/terms`, `/contact`, `/about`, `/faq`). Disallow `/org/*`, `/admin/*`, `/my/*`, `/book/*`, `/api/*`. References `sitemap.xml`.                  |
| 6     | I-2.4.6 | 301 redirect handler for slug changes                                                                                         | ✦       | ✦        | —      | I-2.4.1, **I-1.2.10**      | Reads `slug_redirects` table (already created in I-1.2.10 / I-2.3.5). On request to legacy slug, returns HTTP 301 to current slug. Preserves SEO equity when organizers rename events or themselves.                   |
| 7     | I-2.4.7 | Canonical URL + alternate language tags                                                                                       | —       | ✦        | —      | I-2.4.1                    | `<link rel="canonical" href="...">` on `/events/:slug` and `/organizers/:slug` pages. Single English-only locale in V1 (alternate-lang tags noted as V2 readiness).                                                    |
| 8     | I-2.4.8 | Breadcrumb JSON-LD on event detail                                                                                            | —       | ✦        | —      | I-2.4.1, **I-2.1.6**       | Schema.org BreadcrumbList markup: Home → Events → Event Title. Pairs with existing Event JSON-LD (I-2.1.6) for richer search snippets.                                                                                 |

**SSR & Caching:** Event pages use `ssr: true` with CDN caching via `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`. Cache invalidation triggers are explicit and automated.

### Module 2.5: Public Chrome & Legal Pages

_Covers cross-cutting product-plan §9 (trust posture) and DPDPA pre-launch gates that no other module owns._

**Implementation order:** Static templates first (privacy/terms/about/faq), then contact (which embeds the public dispute reporting form from I-7.2.5), then linked from PublicFooter.

| Order | ID      | Feature                                      | Backend | Frontend | Shared | Depends on  | Notes                                                                                                                                                                                                                                                                                                        |
| ----- | ------- | -------------------------------------------- | ------- | -------- | ------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | I-2.5.1 | `/privacy` page — DPDPA-aware privacy notice | —       | ✦        | —      | **I-0.3.1** | Lists data categories collected (per product-plan §13), retention windows, contact for data subject requests (DSAR I-7.3.8 link). Static MDX/React page. Versioned to align with `consent_records.consent_version`.                                                                                          |
| 2     | I-2.5.2 | `/terms` page — platform terms of service    | —       | ✦        | —      | **I-0.3.1** | Versioned. Aligns with `consent_records.consent_version` for booking_terms. Includes refund/cancellation framework reference.                                                                                                                                                                                |
| 3     | I-2.5.4 | `/about` page                                | —       | ✦        | —      | **I-0.3.1** | Coimbatore pilot positioning, mission statement, founder note. SEO-relevant.                                                                                                                                                                                                                                 |
| 4     | I-2.5.5 | `/faq` page                                  | —       | ✦        | —      | **I-0.3.1** | Participant-facing questions: how booking works, how to view a past booking, refund process summary, what happens on event day.                                                                                                                                                                              |
| 5     | I-2.5.3 | `/contact` page                              | —       | ✦        | —      | **I-0.3.1** | Support email + phone number, discoverable via PublicFooter. **V1 sequencing:** ship the contact-email/phone fallback in Phase 2; the embedded public dispute form is added in Phase 7 by I-7.2.5 (which itself depends on this page existing). Do NOT block Phase 2 launch on the dispute form being ready. |

**Frontend route additions:** `/privacy`, `/terms`, `/contact`, `/about`, `/faq` — all SSR (`ssr: true`), CDN-cacheable with long TTL.

**PublicFooter update:** All five pages must be linked from `PublicFooter` and from `robots.txt` allow-list (I-2.4.5).

### Phase 2 Execution Strategy — Solo Developer

Modules 2.1, 2.2, and 2.3 are **independent of each other** — they all read from Phase 1 data but have no cross-dependencies. Module 2.4 (CDN + SEO infra) depends on SSR pages from 2.1/2.2 existing. Module 2.5 (public chrome) is independent and can run any time after Module 0.3 layout shell. For a solo dev, work through them sequentially by module.

**Wave 1 — Event status enum + Event detail page**
Start with the shared status enum (used by both 2.1 and 2.2), then build the highest-value page first.

1. `I-2.2.3` Event status indicators _(shared enum — used across all modules)_
2. `I-2.1.1` + `I-2.1.8` Event page layout _(core SSR page, mobile-first)_
3. `I-2.1.2` Organizer info section
4. `I-2.1.3` Policy display
5. `I-2.1.4` Pricing breakdown
6. `I-2.1.5` OG meta tags
7. `I-2.1.6` JSON-LD structured data
8. `I-2.1.7` "Register Now" CTA
9. `I-2.1.9` Spots-remaining badge _(needs I-1.2.2 capacity columns + I-3.2.10 decrement; build behind feature flag if Phase 3 not ready)_
10. `I-2.1.10` Early-bird countdown _(needs I-1.2.3)_

**Wave 2 — Discovery listing + Organizer profile + Public chrome**
Build the listing page, organizer profile, and the legal/public pages.

1. `I-2.2.2` Event cards _(reusable component)_
2. `I-2.2.1` Event listing page _(uses cards + status enum)_
3. `I-2.2.4` Sort by date
4. `I-2.3.5` Organizer slug generation
5. `I-2.3.1` Organizer profile page
6. `I-2.3.4` Verification explanation
7. `I-2.3.2` Upcoming events listing _(reuses event card from I-2.2.2)_
8. `I-2.3.3` Past event history
9. `I-2.3.6` Next-event lookup API _(used by Phase 6 Layer 4 emails — can defer if Phase 6 not in this iteration)_
10. `I-2.5.1` Privacy page
11. `I-2.5.2` Terms page
12. `I-2.5.4` About page
13. `I-2.5.5` FAQ page
14. `I-2.5.3` Contact page _(ships email/phone-only in Phase 2; dispute-form embed added in Phase 7 by I-7.2.5)_

**Wave 3 — CDN + SEO infrastructure**
Infrastructure that requires SSR pages to already exist.

1. `I-2.4.1` Cloudflare CDN setup
2. `I-2.4.2` Cache invalidation
3. `I-2.4.3` Cache stampede prevention
4. `I-2.4.4` Sitemap generation
5. `I-2.4.5` Robots.txt
6. `I-2.4.6` Slug 301 redirect handler
7. `I-2.4.7` Canonical URL tags
8. `I-2.4.8` Breadcrumb JSON-LD

```
Wave 1 (sequential)             Wave 2 (sequential)              Wave 3 (sequential)
──────────────────────────      ──────────────────────────────    ──────────────────────────
I-2.2.3 status enum             I-2.2.2 event cards              I-2.4.1 CDN setup
I-2.1.1 event page layout       I-2.2.1 listing page             I-2.4.2 cache invalidation
I-2.1.2 organizer section       I-2.2.4 sort by date             I-2.4.3 stampede prevention
I-2.1.3 policy display          I-2.3.5 organizer slug           I-2.4.4 sitemap.xml
I-2.1.4 pricing breakdown       I-2.3.1 organizer profile        I-2.4.5 robots.txt
I-2.1.5 OG meta tags            I-2.3.4 verification copy        I-2.4.6 slug 301 redirects
I-2.1.6 JSON-LD                 I-2.3.2 upcoming events          I-2.4.7 canonical URLs
I-2.1.7 register CTA            I-2.3.3 past events              I-2.4.8 breadcrumb JSON-LD
I-2.1.9 spots-remaining badge   I-2.3.6 next-event API
I-2.1.10 early-bird countdown   I-2.5.1 /privacy
                                I-2.5.2 /terms
                                I-2.5.4 /about
                                I-2.5.5 /faq
                                I-2.5.3 /contact
```

**Validate after each wave:** Run `check-types`, `lint`, and `test` for all affected workspaces.

---

## Phase 3: Registration, Payment & Booking

**Goal:** The core value proposition — a unified registration + payment flow that eliminates the Google Forms + payment link mismatch.

**Why fourth:** Requires events to exist (Phase 1) and event pages to be live (Phase 2). This is the single most important product flow and the key revenue driver.

**Prerequisites:** Phase 2 (event pages to land on), Phase 0 auth (OTP for identity).

### Module 3.1: Registration Flow

_Covers requirements F-3.1.1 through F-3.1.6_

**Implementation order:** Category selection and validation first (pure frontend), then registration form, then consent and auth integration, then auto-fill (needs participant profile from Module 3.4).

| Order | ID      | Feature                                                                         | Backend | Frontend | Shared | Depends on                        | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----- | ------- | ------------------------------------------------------------------------------- | ------- | -------- | ------ | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | I-3.1.1 | Category selection step — pick distance/category                                | —       | ✦        | —      | **I-1.2.2**, **I-2.1.1**          | Dynamic based on event configuration. Entry point to booking flow.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2     | I-3.1.5 | Form validation with clear error messaging                                      | —       | ✦        | ✦      | **I-0.1.1**                       | Shared Zod schema, `zodValidator()` adapter. Build validation layer before form.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 3     | I-3.1.2 | Registration form with pre-configured fields                                    | ✦       | ✦        | ✦      | I-3.1.1, I-3.1.5, **I-1.2.4**     | TanStack Form + Zod from shared, fitness-specific fields. Core form implementation.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 4     | I-3.1.6 | Consent capture at submission — booking terms, data usage, marketing (separate) | ✦       | ✦        | ✦      | I-3.1.2, **I-0.1.3**              | Three distinct consent types per architecture §6. booking_terms and data_usage required; marketing optional (separate checkbox, not bundled). Consent versioning, no pre-checked boxes, server-side enforcement.                                                                                                                                                                                                                                                                                                                   |
| 5     | I-3.1.3 | OTP verification triggered at form submission                                   | ✦       | ✦        | —      | I-3.1.2, **I-0.2.1**, **I-0.2.7** | Deferred auth pattern — triggers OTP flow. Wires registration to auth.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 6     | I-3.1.4 | Auto-fill from saved participant profile                                        | ✦       | ✦        | —      | I-3.1.2, **I-3.4.1**              | Pre-fill for returning participants. **Cross-dep on Module 3.4 participant profile.** Build after I-3.4.1. **Privacy scope (v2.2):** sensitive fields (blood group, emergency contact, medical conditions) are NEVER auto-filled — they live in `sensitive_participant_data` (30-day TTL) and are re-collected each booking. Auto-fill covers non-sensitive fields only (name, age, gender, city, T-shirt size, phone). UX surfaces a one-line note explaining why ("For your safety, we re-ask emergency details every booking"). |
| 7     | I-3.1.7 | Parental consent for minor participants — DPDPA pre-launch gate                 | ✦       | ✦        | ✦      | I-3.1.2, I-3.1.6, **I-0.1.3**     | When `participant.age < 18`, registration form requires parent/guardian name + parent/guardian email + parental consent checkbox before submission. Stored as a fourth consent type (`parental`) in `consent_records` (alongside `booking_terms`, `data_usage`, `marketing`). Confirmation email also CC'd to guardian. Server-side enforcement; cannot be bypassed client-side. Architecture §6 + DPDPA pre-launch gate.                                                                                                          |

**Key pattern:** Registration form uses shared Zod schemas from `packages/shared`. Async phone uniqueness validation (debounced). TanStack Form v1 with `zodValidator()`.

### Module 3.2: Payment Integration

_Covers requirements F-3.2.1 through F-3.2.6_

**Implementation order:** Payment status enum and capacity reservation first (DB foundations), then Razorpay order creation, then client-side checkout, then webhook pipeline, then resilience (reconciliation, backpressure).

| Order | ID       | Feature                                                                          | Backend | Frontend | Shared | Depends on                            | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----- | -------- | -------------------------------------------------------------------------------- | ------- | -------- | ------ | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | I-3.2.4  | Payment status tracking — initiated, success, failed, refunded                   | ✦       | ✦        | ✦      | **I-0.1.1**                           | Immutable payment records table. Status enum in shared. DB foundation for all payment features.                                                                                                                                                                                                                                                                                                                                                                                         |
| 2     | I-3.2.10 | Capacity reservation — atomic per-category DB update with 15-min expiry          | ✦       | —        | —      | **I-0.1.3**, **I-1.2.2**, **I-1.2.3** | **v2.2 amendment — per-category capacity model.** `UPDATE event_categories SET spots_remaining = spots_remaining - 1 WHERE id = $1 AND spots_remaining > 0` (returns 1 row on success, 0 if sold out). Single distance can sell out while others remain available. Reservation rows stored with `expires_at`; expired reservations reclaimed by BullMQ repeatable job (15-min TTL). v2.1 event-level capacity is removed.                                                               |
| 3     | I-3.2.1  | Razorpay Route integration — payment-time split with organizer-linked settlement | ✦       | ✦        | —      | I-3.2.4, I-3.2.10, **I-1.1.7**        | Create Razorpay order using organizer's `razorpay_account_id`, return checkout token. Core booking endpoint: `POST /api/v1/bookings`.                                                                                                                                                                                                                                                                                                                                                   |
| 4     | I-3.2.3  | Split payout configuration — EventKart fee at payment time                       | ✦       | —        | —      | I-3.2.1                               | Razorpay Route split, remainder to organizer's linked account.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 5     | I-3.2.6  | Free pilot period handling — first 3 events: no platform fee split               | ✦       | —        | —      | I-3.2.3, **I-1.1.1**                  | Per-organizer event counter. Can parallel with I-3.2.2.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 6     | I-3.2.2  | UPI + card payment support                                                       | —       | ✦        | —      | I-3.2.1                               | Client-side Razorpay SDK handles checkout UI. Can parallel with I-3.2.3.                                                                                                                                                                                                                                                                                                                                                                                                                |
| 7     | I-3.2.5  | Payment failure handling with retry flow                                         | ✦       | ✦        | —      | I-3.2.1, I-3.2.2                      | Clear retry UX, idempotent backend.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 8     | I-3.2.7  | Razorpay webhook handler — signature verification, BullMQ enqueue, 5s ACK        | ✦       | —        | —      | I-3.2.1, **I-0.1.6**                  | `POST /api/v1/bookings/payment/callback`, HMAC SHA256. ACK immediately, process async.                                                                                                                                                                                                                                                                                                                                                                                                  |
| 9     | I-3.2.8  | Webhook idempotency — webhook_events table, unique razorpay_payment_id           | ✦       | —        | —      | I-3.2.7                               | Dedup via provider event ID. Process through booking state machine with row-level locking.                                                                                                                                                                                                                                                                                                                                                                                              |
| 10    | I-3.2.9  | Payment reconciliation job — periodic Razorpay API poll for stuck payments       | ✦       | —        | —      | I-3.2.7, I-3.2.8, **I-0.1.6**         | BullMQ repeatable job every 5 min, catches lost webhooks.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 11    | I-3.2.11 | Booking endpoint backpressure / waiting-room mode                                | ✦       | ✦        | —      | I-3.2.1, **I-0.1.5**                  | Architecture §1: when Redis queue depth, job age, DB pool wait, or provider error rate cross thresholds, return controlled "registration busy, retry shortly" response. Optional waiting-room mode for burst events. **Per-event rate limiting is now its own item — see I-3.2.12.**                                                                                                                                                                                                    |
| 12    | I-3.2.12 | Per-event sliding-window rate limiting on `POST /bookings`                       | ✦       | —        | —      | I-3.2.1, **I-0.1.5**                  | Architecture §7 step 8. Sliding-window counters in Redis per `event_id` and per `(event_id, ip)` applied to `POST /api/v1/bookings` (the registration + capacity-reserve + Razorpay-order entry point). Defaults: 600 req/min/event, 30 req/min/IP/event (overridable per event for known burst sales). Returns HTTP 429 with `Retry-After` when exceeded. Distinct from global `@fastify/rate-limit` and from I-3.2.11 (which is for systemic backpressure, not per-event throttling). |

**Database tables:** `bookings`, `payment_records`, `webhook_events`

**Booking lifecycle (explicit state machine per architecture §7):**

1. `POST /api/v1/bookings` → Create booking record (status: `pending`) + reserve capacity (I-3.2.10) + create Razorpay order → return checkout token
2. Client-side Razorpay SDK processes payment (UPI/card)
3. Razorpay webhook → verify signature → enqueue to `payment-webhook` queue (I-3.2.7)
4. Worker processes: row-lock booking → state machine transition (`pending` → `confirmed`) → queue QR email
5. Reconciliation job (I-3.2.9) catches payments stuck as `pending` where webhook was lost
6. Capacity expiry job releases unpaid reservations after 15 minutes

### Module 3.3: Booking Confirmation & Email Foundation

_Covers requirements F-3.3.1 through F-3.3.5 AND F-6.1.1, F-6.1.2 (moved here from Phase 6)_

**Implementation order:** Booking status enum and email service first (independent foundations), then booking confirmation (needs webhook worker from 3.2), then QR generation, then confirmation page and email.

| Order | ID      | Feature                                                                | Backend | Frontend | Shared | Depends on                        | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----- | ------- | ---------------------------------------------------------------------- | ------- | -------- | ------ | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | I-3.3.6 | Booking status management — confirmed, cancelled, refunded, checked-in | ✦       | ✦        | ✦      | **I-0.1.1**                       | Status enum in shared package. Foundation for booking state machine.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2     | I-3.3.1 | Email service integration and template system                          | ✦       | —        | —      | **I-0.1.6**                       | Resend (default) + SES fallback for burst. React Email templates. Batch API for burst confirmations. **No dependency on payment flow — build early.** **Sender helper consults `email_suppressions` before every send: transactional emails skip recipients with `reason IN ('bounce','complaint')`; promotional emails additionally skip `reason='manual'`. Class is set per template (transactional default; promotional opt-in).**                                                              |
| 3     | I-3.3.2 | Booking record creation on successful payment                          | ✦       | —        | —      | I-3.3.6, **I-3.2.7**, **I-3.2.8** | State machine: pending → confirmed (via webhook worker). Wires payment to booking.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 4     | I-3.3.4 | QR code generation — HMAC-signed booking token                         | ✦       | ✦        | —      | I-3.3.2                           | Token: booking_id, event_id, ticket_version, exp, kid, jti. **Client renders QR on-demand for confirmation page; email worker generates QR image inline (server-side, e.g., `qrcode` npm package) since email clients don't execute JavaScript.**                                                                                                                                                                                                                                                  |
| 5     | I-3.3.3 | Booking confirmation page with summary                                 | —       | ✦        | —      | I-3.3.2, I-3.3.4, **I-2.1.1**     | `/book/:eventId/confirmation`. QR rendered client-side from HMAC-signed token.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 6     | I-3.3.5 | Booking confirmation email with QR ticket                              | ✦       | —        | —      | I-3.3.1, I-3.3.4                  | Triggered by payment webhook worker. React Email template with inline QR image. **Transactional class (skips suppression only for `bounce`/`complaint`).**                                                                                                                                                                                                                                                                                                                                         |
| 7     | I-3.3.7 | Magic-link booking re-access email                                     | ✦       | ✦        | —      | I-3.3.5, **I-0.2.1**              | Confirmation email includes a one-tap signed magic link (`/my/bookings/:bookingId?token=...`, HMAC-signed, 90-day expiry, **scoped to a single booking only — token does not grant access to other bookings even under the same event**). Token row in `booking_access_tokens` (token_hash, expires_at, revoked_at). Endpoint validates: token signature → token row exists → `booking_id` matches the URL parameter → `expires_at > now()` → `revoked_at IS NULL`. Revocable on `revokeAt` event. |
| 8     | I-3.3.8 | Booking lookup by phone + booking-id (for lost magic link)             | ✦       | ✦        | —      | I-3.3.7, **I-0.2.1**              | `POST /api/v1/bookings/lookup` accepts phone + booking reference → triggers OTP → returns booking details on verify. Public form discoverable from `/contact` (I-2.5.3). Rate-limited (1/phone/60s).                                                                                                                                                                                                                                                                                               |

### Module 3.4: Participant Profile & Consent Management

_Covers requirements F-3.4.1 through F-3.4.4_

**Implementation order:** Profile save on first booking first (triggered by registration), then profile view/edit, then booking history (needs bookings), then consent withdrawal and deletion request.

| Order | ID      | Feature                                   | Backend | Frontend | Shared | Depends on               | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----- | ------- | ----------------------------------------- | ------- | -------- | ------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | I-3.4.1 | Save participant details on first booking | ✦       | —        | ✦      | **I-3.1.2**, **I-0.1.3** | Name, age, gender, city, T-shirt size, phone stored in `participant_profiles` (long-lived). **Sensitive fields (blood group, emergency contact, medical) stored ONLY in `sensitive_participant_data` table with 30-day post-event retention and scoped access.** **v2.2 design decision (DEC-1):** sensitive fields are NEVER auto-filled on repeat booking — privacy-first per DPDPA §13. "Fast repeat booking" via I-3.1.4 covers only non-sensitive fields (~40-50% form friction reduction). UX copy in I-3.1.4 explains the tradeoff. Triggered by registration form submission. |
| 2     | I-3.4.2 | Profile view and edit for participants    | ✦       | ✦        | ✦      | I-3.4.1, **I-0.3.3**     | `/my/profile` route. Needs role-based routing for `/my/*`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 3     | I-3.4.3 | Booking history view                      | ✦       | ✦        | —      | I-3.4.1, **I-3.3.2**     | `/my/bookings` route. Needs confirmed bookings to display.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 4     | I-3.4.5 | Consent withdrawal API                    | ✦       | ✦        | ✦      | I-3.4.1, **I-3.1.6**     | `DELETE /api/v1/my/consent/:type`. Architecture §6: participants can withdraw specific consent types (e.g., marketing) without deleting profile. Withdrawal triggers anonymization of data processed under that consent.                                                                                                                                                                                                                                                                                                                                                              |
| 5     | I-3.4.4 | Profile data deletion request             | ✦       | ✦        | —      | I-3.4.1, **I-0.1.6**     | `DELETE /api/v1/my/profile`. Marks profile as deleted, enqueues anonymization job. **Note: The anonymization BullMQ job processor is stubbed here and completed in Phase 7 (I-7.3.5). The endpoint + queue message work now; the worker that processes anonymization is Phase 7 work.**                                                                                                                                                                                                                                                                                               |

### Phase 3 Execution Strategy — Solo Developer

Phase 3 is the most complex phase — the booking pipeline is a linear chain (registration → payment → confirmation), but email service and participant profile branch off independently. Work in 4 waves:

**Wave 1 — Shared enums + DB foundations + Email service**
Build the status enums, payment records table, capacity reservation, and email service. These have no dependencies on each other.

1. `I-3.2.4` Payment status tracking _(shared enum + payment_records table)_
2. `I-3.3.6` Booking status management _(shared enum)_
3. `I-3.2.10` Capacity reservation _(atomic DB pattern)_
4. `I-3.3.1` Email service + templates _(independent of payment flow)_

**Wave 2 — Registration form + Razorpay core**
Build the two entry points to the booking flow: the registration form and the payment integration.

1. `I-3.1.1` Category selection
2. `I-0.4.7` Conversion-funnel `started_registrations` emission _(wired into the I-3.1.1 form-load event so it ships with the form; consumed later by Phase 4 I-4.1.6)_
3. `I-3.1.5` Form validation layer
4. `I-3.1.2` Registration form
5. `I-3.1.6` Consent capture
6. `I-3.1.7` Parental consent for minors _(server-side gate when age < 18)_
7. `I-3.1.3` OTP verification at submission
8. `I-3.4.1` Save participant profile _(triggered by first booking)_
9. `I-3.2.1` Razorpay Route — booking endpoint + order creation
10. `I-3.2.12` Per-event sliding-window rate limiting _(applies to POST /bookings)_
11. `I-3.2.3` Split payout configuration
12. `I-3.2.6` Free pilot period handling
13. `I-3.2.2` UPI + card checkout UI

**Wave 3 — Webhook pipeline + Booking confirmation**
The async payment processing pipeline and confirmation flow.

1. `I-3.2.7` Webhook handler
2. `I-3.2.8` Webhook idempotency
3. `I-3.3.2` Booking record confirmation _(webhook worker updates state machine)_
4. `I-3.3.4` QR code generation
5. `I-3.3.3` Confirmation page
6. `I-3.3.5` Confirmation email with QR
7. `I-3.3.7` Magic-link booking re-access in confirmation email
8. `I-3.2.5` Payment failure + retry

**Wave 4 — Resilience + Participant self-service**
Reconciliation, backpressure, auto-fill, and participant profile management.

1. `I-3.2.9` Payment reconciliation job
2. `I-3.2.11` Backpressure / waiting-room
3. `I-3.1.4` Auto-fill from saved profile _(needs I-3.4.1 from Wave 2; non-sensitive fields only per DEC-1)_
4. `I-3.3.8` Booking lookup by phone + booking-id _(public form for lost magic links)_
5. `I-3.4.2` Participant profile view/edit
6. `I-3.4.3` Booking history
7. `I-3.4.5` Consent withdrawal API
8. `I-3.4.4` Profile deletion request _(stub worker, completed Phase 7)_

```
Wave 1 (foundations)          Wave 2 (form + payment)          Wave 3 (webhook + confirm)        Wave 4 (resilience + profile)
────────────────────────      ─────────────────────────────    ──────────────────────────────    ───────────────────────────
I-3.2.4 payment enum          I-3.1.1 category selection       I-3.2.7 webhook handler           I-3.2.9 reconciliation job
I-3.3.6 booking enum          I-0.4.7 funnel emission          I-3.2.8 webhook idempotency       I-3.2.11 backpressure
I-3.2.10 capacity (per-cat)   I-3.1.5 form validation          I-3.3.2 booking confirmation      I-3.1.4 auto-fill (non-sensitive)
I-3.3.1 email service         I-3.1.2 registration form        I-3.3.4 QR generation             I-3.3.8 booking lookup
                              I-3.1.6 consent capture          I-3.3.3 confirmation page         I-3.4.2 profile view/edit
                              I-3.1.7 parental consent          I-3.3.5 confirmation email        I-3.4.3 booking history
                              I-3.1.3 OTP at submission         I-3.3.7 magic-link in email       I-3.4.5 consent withdrawal
                              I-3.4.1 save participant profile  I-3.2.5 payment retry             I-3.4.4 deletion request
                              I-3.2.1 razorpay order
                              I-3.2.12 per-event rate limit
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

_Covers requirements F-4.1.1 through F-4.1.5_

**Implementation order:** Count summary first (the dashboard header), then participant list (the core table), then detail view and revenue (extend the page), then export (async job).

| Order | ID      | Feature                                                                         | Backend | Frontend | Shared | Depends on               | Notes                                                                                                                                                                                                      |
| ----- | ------- | ------------------------------------------------------------------------------- | ------- | -------- | ------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | I-4.1.1 | Registered / paid / checked-in count summary per event                          | ✦       | ✦        | —      | **I-3.3.2**, **I-0.3.3** | Aggregate queries, `/org/events/:id`. Dashboard header with key metrics.                                                                                                                                   |
| 2     | I-4.1.2 | Participant list with status filters                                            | ✦       | ✦        | —      | I-4.1.1, **I-3.4.1**     | Server-side pagination for >100 rows, TanStack Table. **Scoped to organizer's own events only (server-side enforcement from Phase 0).**                                                                    |
| 3     | I-4.1.3 | Individual participant booking detail view                                      | ✦       | ✦        | —      | I-4.1.2                  | Scoped to organizer's own events only. **Sensitive fields (blood group, medical) suppressed at API layer unless safety-critical.** Navigate from participant list. Can parallel with I-4.1.4.              |
| 4     | I-4.1.4 | Basic revenue view per event — total collected, EventKart fee, net to organizer | ✦       | ✦        | —      | I-4.1.1, **I-3.2.4**     | Read from payment records. Can parallel with I-4.1.3.                                                                                                                                                      |
| 5     | I-4.1.5 | Participant roster export — CSV for offline fallback                            | ✦       | ✦        | —      | I-4.1.2, **I-0.1.6**     | BullMQ exports queue, sensitive fields controlled.                                                                                                                                                         |
| 6     | I-4.1.6 | Conversion-rate tile (started → paid) per event                                 | ✦       | ✦        | —      | I-4.1.1, **I-0.4.7**     | Reads `started_registrations` counter (I-0.4.7) vs paid bookings to render funnel tile + comparison to organizer's prior events. Powers product-plan §11 "Conversion proof" success metric for organizers. |

**Key pattern:** Participant tables use TanStack Table + TanStack Virtual for large lists (20K+ rows). Server-side pagination for initial load, client-side virtual scrolling for render.

### Module 4.2: Multi-Event Overview

_Covers requirements F-4.2.1 through F-4.2.3_

**Implementation order:** Organizer home page first (landing page at `/org/events`), then status cards and navigation links. This is the **entry point** — build before Module 4.1 drill-down views.

| Order | ID      | Feature                                                  | Backend | Frontend | Shared | Depends on               | Notes                                                                                        |
| ----- | ------- | -------------------------------------------------------- | ------- | -------- | ------ | ------------------------ | -------------------------------------------------------------------------------------------- |
| 1     | I-4.2.1 | Organizer home — all events (upcoming, past)             | ✦       | ✦        | —      | **I-1.2.1**, **I-0.3.3** | `/org/events` route. Landing page for organizer dashboard.                                   |
| 2     | I-4.2.2 | Event status summary cards — draft, published, completed | —       | ✦        | —      | I-4.2.1, **I-2.2.3**     | Quick status overview. Uses event status enum from shared.                                   |
| 3     | I-4.2.3 | Quick-access links to event operations                   | —       | ✦        | —      | I-4.2.1, **I-4.1.1**     | Navigation shortcuts to event detail dashboard. **Cross-dep on Module 4.1 routes existing.** |

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
4. `I-4.1.4` Revenue view _(can parallel with I-4.1.3)_
5. `I-4.1.5` Participant roster export
6. `I-4.1.6` Conversion-rate tile _(consumes the `started_registrations` counter shipped with `I-0.4.7` in Phase 3 Wave 2)_
7. `I-4.2.3` Quick-access links _(wires landing page to detail views)_

```
Wave 1 (landing page)         Wave 2 (event operations)
────────────────────────    ───────────────────────────────
I-4.2.1 organizer home        I-4.1.1 count summary
I-4.2.2 status cards          I-4.1.2 participant list
                               I-4.1.3 booking detail (∥)
                               I-4.1.4 revenue view (∥)
                               I-4.1.5 roster export
                               I-4.1.6 conversion tile
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

_Covers requirements F-5.1.1 through F-5.1.5_

**Implementation order:** Scanner UI and sensitive field suppression logic first (independent), then scan result + verification API, then check-in action, then duplicate detection.

| Order | ID      | Feature                                                                           | Backend | Frontend | Shared | Depends on                                              | Notes                                                                                                                                                                                                                                  |
| ----- | ------- | --------------------------------------------------------------------------------- | ------- | -------- | ------ | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | I-5.1.1 | QR code scanner interface — camera-based, mobile browser                          | —       | ✦        | —      | **I-3.3.4**, **I-0.3.3**                                | `/org/events/:id/check-in` route, `ssr: false` (uses camera APIs). Needs QR tokens to exist from Phase 3.                                                                                                                              |
| 2     | I-5.1.5 | Sensitive field suppression — blood group, medical info suppressed by default     | ✦       | ✦        | —      | **I-1.2.4**                                             | **Server-side enforcement**: API does not return sensitive fields in check-in response unless organizer has marked them safety-critical for this event. Build suppression logic before scan result display.                            |
| 3     | I-5.1.2 | Scan result display — participant name, category, payment status, check-in status | ✦       | ✦        | —      | I-5.1.1, I-5.1.5, **I-3.3.4**, **I-3.3.2**, **I-0.4.4** | Server-side verification of HMAC token + booking status. Applies sensitive field suppression. **Audit-log entry written for every read that returns sensitive fields (uses I-0.4.4 audit logger; see product-plan §9 trust posture).** |
| 4     | I-5.1.3 | Check-in confirmation action — mark as checked in                                 | ✦       | ✦        | —      | I-5.1.2                                                 | Atomic single-use/first-scan semantics in DB. ticket_version enforcement. **Shared backend used by Module 5.2 manual check-in.**                                                                                                       |
| 5     | I-5.1.4 | Duplicate scan detection — already checked-in warning                             | ✦       | ✦        | —      | I-5.1.3                                                 | Returns existing check-in timestamp.                                                                                                                                                                                                   |

### Module 5.2: Manual Search Fallback

_Covers requirements F-5.2.1 through F-5.2.3_

**Implementation order:** Search endpoint first, then results display, then manual check-in (reuses I-5.1.3 backend).

| Order | ID      | Feature                                        | Backend | Frontend | Shared | Depends on               | Notes                                                                                                                                                                            |
| ----- | ------- | ---------------------------------------------- | ------- | -------- | ------ | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | I-5.2.1 | Search participants by name or phone number    | ✦       | ✦        | —      | **I-3.4.1**, **I-3.3.2** | Scoped to current event. Search API endpoint.                                                                                                                                    |
| 2     | I-5.2.2 | Search results with booking and payment status | ✦       | ✦        | —      | I-5.2.1, **I-0.4.4**     | Quick identification. Applies same sensitive field suppression as I-5.1.5. **Audit-log entry written for every read that returns sensitive fields (uses I-0.4.4 audit logger).** |
| 3     | I-5.2.3 | Manual check-in action from search results     | ✦       | ✦        | —      | I-5.2.2, **I-5.1.3**     | **Reuses check-in backend from Module 5.1.** Same atomic single-use semantics.                                                                                                   |

### Module 5.3: Offline Roster

_Covers requirements F-5.3.1 through F-5.3.4_

**Implementation order:** Content spec and sensitive field config first, then PDF generation, then footer instruction.

| Order | ID      | Feature                                                               | Backend | Frontend | Shared | Depends on                                 | Notes                                                                                                                                                                                                          |
| ----- | ------- | --------------------------------------------------------------------- | ------- | -------- | ------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | I-5.3.2 | Roster contents — name, category, payment status, bib (if external)   | —       | —        | —      | **I-3.4.1**, **I-3.3.2**                   | Minimal data by default. Content specification for the roster.                                                                                                                                                 |
| 2     | I-5.3.3 | Sensitive fields included only if marked safety-critical by organizer | ✦       | —        | —      | **I-5.1.5**, **I-1.2.4**                   | Configurable per event, enforced server-side. **Reuses suppression logic from Module 5.1.**                                                                                                                    |
| 3     | I-5.3.1 | Downloadable participant roster — PDF or print-friendly format        | ✦       | ✦        | —      | I-5.3.2, I-5.3.3, **I-0.1.6**, **I-0.4.4** | BullMQ exports queue. Async generation job. **Audit-log entry written when an export includes sensitive (safety-critical) fields, capturing organizer_id + event_id + field set (uses I-0.4.4 audit logger).** |
| 4     | I-5.3.4 | Delete-after-event instruction included with export                   | —       | ✦        | —      | I-5.3.1                                    | Data handling guidance in PDF footer.                                                                                                                                                                          |

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
3. `I-5.2.3` Manual check-in _(reuses I-5.1.3 backend)_
4. `I-5.3.2` Roster content spec
5. `I-5.3.3` Sensitive field config _(reuses I-5.1.5 logic)_
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

_Covers requirements F-6.1.3, F-6.1.4_

**Implementation order:** Both items are independent. Reminder email first (it has a BullMQ scheduled job), cancellation template second (trigger wired later in Phase 7).

| Order | ID      | Feature                                        | Backend | Frontend | Shared | Depends on                            | Notes                                                                                                                                                                                                                                                     |
| ----- | ------- | ---------------------------------------------- | ------- | -------- | ------ | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | I-6.1.1 | Event reminder email — 1-2 days before event   | ✦       | —        | —      | **I-3.3.1**, **I-0.1.6**, **I-1.2.1** | BullMQ scheduled job. Uses email infrastructure from Phase 3. Needs event dates to schedule. **Transactional class (sender consults `email_suppressions` for `bounce`/`complaint` reasons only — not `manual` opt-outs).**                                |
| 2     | I-6.1.2 | Booking cancellation/refund confirmation email | ✦       | —        | —      | **I-3.3.1**                           | Triggered by refund workflow (Phase 7). **Template + React Email component built here; trigger wired in Phase 7 (I-7.1.3). Transactional class (sender consults `email_suppressions` for `bounce`/`complaint` reasons only).** Can parallel with I-6.1.1. |

### Module 6.2: Post-Event & Retention

_Covers requirements F-6.2.1 through F-6.2.4_

**Implementation order:** Organizer content interface first (organizer adds links/content), then follow-up email (includes that content), then email extensions (results, next-event prompt). The marketing-consent gate is enforced as a distinct check (I-6.2.5) so it can be unit-tested independently.

| Order | ID      | Feature                                                      | Backend | Frontend | Shared | Depends on                        | Notes                                                                                                                                                                                                                                                           |
| ----- | ------- | ------------------------------------------------------------ | ------- | -------- | ------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | I-6.2.4 | Organizer interface to add post-event content                | ✦       | ✦        | —      | **I-0.3.3**, **I-1.2.1**          | Results link, photos link, next event link. `/org/events/:id/post-event`. **Build before follow-up email so email has content to include.**                                                                                                                     |
| 2     | I-6.2.1 | Post-event follow-up email to participants                   | ✦       | —        | —      | I-6.2.4, **I-3.3.1**, **I-3.1.6** | Triggered after event completion. **Promotional class — requires valid marketing consent AND that the recipient is not present in `email_suppressions` for any reason (`bounce`, `complaint`, OR `manual`).** Includes organizer-provided content from I-6.2.4. |
| 3     | I-6.2.2 | Include organizer-provided wrap-up or external results links | ✦       | —        | —      | I-6.2.1                           | First-party results hosting out of scope. Extends follow-up email template. Can parallel with I-6.2.3.                                                                                                                                                          |
| 4     | I-6.2.3 | Next-event prompt for repeat booking in follow-up email      | ✦       | —        | —      | I-6.2.1, **I-1.2.1**, **I-2.3.6** | Link to organizer's next event (uses I-2.3.6 same-organizer next-event endpoint). **Per DEC-5: same-organizer scope only in V1.** **Marketing-consent enforcement is in I-6.2.5.** Can parallel with I-6.2.2.                                                   |
| 5     | I-6.2.5 | Marketing-consent enforcement in next-event prompt section   | ✦       | —        | —      | I-6.2.3, **I-3.1.6**              | Server-side check before rendering the next-event prompt: only include the prompt block when `consent_records.consent_type='marketing'` is present and not withdrawn. Email body conditionally renders the section. Tested independently of I-6.2.3 logic.      |

### Phase 6 Execution Strategy — Solo Developer

Phase 6 is small (6 items) and has no complex cross-module dependencies. Modules 6.1 and 6.2 are independent of each other. Work in 2 waves:

**Wave 1 — Transactional emails + Organizer post-event interface**
All three items are independent of each other. The reminder email and cancellation template are backend-only. The organizer interface is a frontend form.

1. `I-6.1.1` Event reminder email _(BullMQ scheduled job)_
2. `I-6.1.2` Cancellation/refund email template _(template only, trigger wired in Phase 7)_
3. `I-6.2.4` Organizer post-event content interface

**Wave 2 — Post-event follow-up email**
The follow-up email and its extensions. Needs organizer content interface from Wave 1.

1. `I-6.2.1` Post-event follow-up email
2. `I-6.2.2` Results/wrap-up links in email
3. `I-6.2.3` Next-event prompt in email _(same-organizer scope; uses I-2.3.6)_
4. `I-6.2.5` Marketing-consent enforcement on next-event section

```
Wave 1 (independent items)    Wave 2 (follow-up email)
────────────────────────      ─────────────────────────────
I-6.1.1 reminder email        I-6.2.1 follow-up email
I-6.1.2 cancellation template I-6.2.2 results links (∥)
I-6.2.4 post-event interface  I-6.2.3 next-event prompt (∥)
                              I-6.2.5 marketing-consent gate
```

**Validate after each wave:** Run `check-types`, `lint`, and `test` for all affected workspaces.

---

## Phase 7: Refunds, Disputes & Admin Operations

**Goal:** Handle exception paths — refunds, disputes, and platform-level administration. Harden the product for real-world edge cases during the pilot.

**Why eighth:** The happy path must work first (Phases 1–6). This phase handles the inevitable exceptions.

**Prerequisites:** Phase 3 (payment flow working). Can start once Phase 3 payment integration is stable.

**Parallel opportunity:** Can start during Phase 4-5 timeframe since it primarily depends on Phase 3.

### Module 7.1: Refund Workflow

_Covers requirements F-7.1.1 through F-7.1.4_

**Implementation order:** Request initiation first, then gateway processing, then status tracking (wires cancellation email from Phase 6), then settled-funds handling.

| Order | ID      | Feature                                                                            | Backend | Frontend | Shared | Depends on                        | Notes                                                                                 |
| ----- | ------- | ---------------------------------------------------------------------------------- | ------- | -------- | ------ | --------------------------------- | ------------------------------------------------------------------------------------- |
| 1     | I-7.1.1 | Refund request initiation — participant-side or organizer-initiated                | ✦       | ✦        | ✦      | **I-3.3.2**, **I-3.2.4**          | Contact/form-based. Creates refund request record.                                    |
| 2     | I-7.1.2 | Refund processing through payment gateway — reverse split                          | ✦       | —        | —      | I-7.1.1, **I-3.2.1**, **I-3.2.3** | Razorpay refund API. Reverses the split payout.                                       |
| 3     | I-7.1.3 | Refund status tracking and communication to participant                            | ✦       | ✦        | ✦      | I-7.1.2, **I-6.1.2**              | Status updates via email. **Wires the cancellation email template built in Phase 6.** |
| 4     | I-7.1.4 | Handling for already-settled funds — organizer responsibility, EventKart mediation | ✦       | ✦        | —      | I-7.1.1, **I-0.4.4**              | Manual admin workflow. Edge case for funds already transferred to organizer.          |

### Module 7.2: Dispute & Support

_Covers requirements F-7.2.1 through F-7.2.4_

**Implementation order:** Participant reporting first, then admin queue, then SLA tracking and suspension workflow.

| Order | ID      | Feature                                               | Backend | Frontend | Shared | Depends on                        | Notes                                                                                                                                                                                                                                                                                                                                                                 |
| ----- | ------- | ----------------------------------------------------- | ------- | -------- | ------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | I-7.2.1 | Participant issue reporting mechanism                 | ✦       | ✦        | —      | **I-3.3.2**, **I-0.3.3**          | Authenticated participant flow. Creates dispute record from `/my/bookings/:id` page. **Public unauthenticated entry point is I-7.2.5.**                                                                                                                                                                                                                               |
| 2     | I-7.2.5 | Public unauthenticated dispute reporting form         | ✦       | ✦        | ✦      | I-7.2.1, **I-2.5.3**              | `POST /api/v1/public/disputes` accepts contact form payload (name, email, phone, booking-ref optional, description). Embedded on `/contact` (I-2.5.3) and linked from event page footer + booking confirmation email. Rate-limited per-IP. Creates dispute record with `source = 'public_form'`. Admin queue (I-7.2.2) handles both authenticated and public reports. |
| 3     | I-7.2.2 | Admin dispute queue and management interface          | ✦       | ✦        | —      | I-7.2.1, **I-0.3.3**, **I-0.4.4** | `/admin/disputes` route. Admin views and manages disputes (auth + public).                                                                                                                                                                                                                                                                                            |
| 4     | I-7.2.3 | 2-business-day first-response SLA tracking            | ✦       | ✦        | —      | I-7.2.2                           | SLA timer on dispute records. Alerting on breach.                                                                                                                                                                                                                                                                                                                     |
| 5     | I-7.2.4 | Organizer suspension workflow for repeated violations | ✦       | ✦        | —      | I-7.2.2, **I-1.1.1**, **I-0.4.4** | Admin action, logged in audit. Suspends organizer account and unpublishes events.                                                                                                                                                                                                                                                                                     |
| 6     | I-7.2.6 | Organizer-suspension email                            | ✦       | —        | —      | I-7.2.4, **I-3.3.1**              | Triggered when admin suspends organizer (I-7.2.4). React Email template with reason, appeal-process link, and expected reactivation timeline.                                                                                                                                                                                                                         |

### Module 7.3: Admin Operations Panel & Data Lifecycle

_Covers requirements F-7.3.1 through F-7.3.4 plus data lifecycle from architecture §6_

**Implementation order:** Admin panels first (extend Phase 1 admin interfaces), then data lifecycle workers (anonymization, cleanup jobs), then compliance features (DSAR export, bounce handling). I-7.3.10 must come after I-7.3.5 since inactive accounts feed into the anonymization worker.

| Order | ID       | Feature                                                                           | Backend | Frontend | Shared | Depends on                            | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----- | -------- | --------------------------------------------------------------------------------- | ------- | -------- | ------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | I-7.3.1  | Organizer verification queue — pending applications, approve/reject               | ✦       | ✦        | —      | **I-1.1.5**                           | Started in Phase 1, completed here with full queue management (pagination, filters, bulk actions).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2     | I-7.3.2  | Event review queue — new organizer events pending manual review                   | ✦       | ✦        | —      | **I-1.2.7**                           | Started in Phase 1, completed here with full queue management. Can parallel with I-7.3.1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 3     | I-7.3.4  | Audit log viewer — filter by actor, action, resource, date range                  | ✦       | ✦        | —      | **I-0.4.4**                           | Queries audit_log table. Can parallel with I-7.3.1/I-7.3.2.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 4     | I-7.3.3  | Payout monitoring dashboard — split payout status, exceptions                     | ✦       | ✦        | —      | **I-3.2.4**, **I-3.2.3**              | Read from payment records. Can parallel with I-7.3.4.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 5     | I-7.3.5  | Anonymization worker — processes profile deletion and consent withdrawal requests | ✦       | —        | —      | **I-3.4.4**, **I-0.1.6**              | BullMQ cleanup queue. Replaces PII with deterministic hashes/placeholders. Preserves financial data. **Completes the stub from I-3.4.4.**                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 6     | I-7.3.6  | Sensitive field cleanup job — 30 days post-event                                  | ✦       | —        | —      | **I-3.4.1**, **I-0.1.6**              | BullMQ daily repeatable job. Scans and deletes sensitive fields on bookings for completed events. Can parallel with I-7.3.5.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 7     | I-7.3.7  | KYC document cleanup job — 1 year after account closure                           | ✦       | —        | —      | **I-1.1.2**, **I-0.1.8**, **I-0.1.6** | BullMQ weekly repeatable job. **Account closure definition (DPDPA, v2.2):** an organizer account is "closed" when `organizers.deleted_at` is set (soft-delete timestamp; populated by an admin closure action introduced under Phase 7 admin tooling, or by an automated inactivity sweep — neither flow ships in V1, so `deleted_at` is admin-set in V1). The cleanup job's eligibility query is `WHERE deleted_at IS NOT NULL AND deleted_at + INTERVAL '365 days' < NOW()`. Removes S3/R2 KYC objects and DB metadata for matching organizers. Can parallel with I-7.3.5/I-7.3.6. |
| 8     | I-7.3.8  | DSAR data export — machine-readable export of all participant data                | ✦       | ✦        | —      | **I-3.4.1**, **I-0.1.6**              | `GET /api/v1/my/data-export`. BullMQ exports queue. Required for DPDPA compliance.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 9     | I-7.3.9  | Email bounce/complaint handling — deliverability hygiene                          | ✦       | —        | —      | **I-3.3.1**                           | Resend/SES webhook for bounces and complaints. Suppress future sends to bounced addresses.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 10    | I-7.3.10 | Inactive account cleanup — 3 years inactivity                                     | ✦       | —        | —      | **I-7.3.5**, **I-0.1.6**              | BullMQ weekly repeatable job. Marks inactive accounts for anonymization. **Must come after I-7.3.5** since it feeds into the anonymization worker.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 11    | I-7.3.11 | SLA compliance dashboard — refund + dispute breach alerts                         | ✦       | ✦        | —      | **I-7.1.3**, **I-7.2.3**, **I-0.4.4** | Admin tile under `/admin/operations`. Aggregates refund SLA status (target per the support SLA defined in the operational playbook — see product-plan §7 "Refund posture"; not hard-locked to a specific business-day count in v2.2) and dispute first-response SLA (2 business days from F-7.2.3). Powers product-plan §11 trust baseline metric. Triggers I-7.4.4 admin email on breach.                                                                                                                                                                                           |

### Module 7.4: Admin Notifications

_New module — covers cross-cutting admin awareness. Currently admin must poll for new organizer/event/dispute submissions; v2.2 closes this gap with targeted email notifications + a daily digest._

**Implementation order:** Per-event notifications first (independent), then daily digest aggregator last (uses same templates).

| Order | ID      | Feature                                                           | Backend | Frontend | Shared | Depends on                            | Notes                                                                                                                                                                  |
| ----- | ------- | ----------------------------------------------------------------- | ------- | -------- | ------ | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | I-7.4.1 | Admin notification email on new organizer verification submission | ✦       | —        | —      | **I-1.1.4**, **I-3.3.1**, **I-0.2.6** | Triggered after I-1.1.4 verification submitted. Sends to `ADMIN_NOTIFY_EMAIL` from config with deep link to admin verification queue (I-7.3.1).                        |
| 2     | I-7.4.2 | Admin notification email on event submitted for review            | ✦       | —        | —      | **I-1.2.7**, **I-3.3.1**, **I-0.2.6** | Triggered after I-1.2.7 event review submission. Sends to `ADMIN_NOTIFY_EMAIL` with deep link to event review queue (I-7.3.2).                                         |
| 3     | I-7.4.3 | Admin notification email on new dispute filed                     | ✦       | —        | —      | **I-7.2.1**, **I-7.2.5**, **I-3.3.1** | Triggered for both authenticated and public disputes. Includes severity heuristic (e.g., contains "fraud", "missing money").                                           |
| 4     | I-7.4.4 | Admin notification email on refund or dispute SLA breach          | ✦       | —        | —      | **I-7.3.11**, **I-3.3.1**             | Triggered by I-7.3.11 SLA dashboard's BullMQ daily breach scan.                                                                                                        |
| 5     | I-7.4.5 | Admin notification email on payment-webhook DLQ entry             | ✦       | —        | —      | **I-3.2.7**, **I-0.4.5**, **I-3.3.1** | Triggered when a webhook job fails irreversibly and lands in dead-letter queue. Critical-severity alert.                                                               |
| 6     | I-7.4.6 | Admin daily digest email                                          | ✦       | —        | —      | **I-7.4.1**, **I-7.4.2**, **I-7.2.2** | BullMQ scheduled daily job. Aggregates: pending verifications count, pending event reviews count, open disputes count, SLA-breach count, DLQ count. Sent at 09:00 IST. |

### Phase 7 Execution Strategy — Solo Developer

Phase 7 has four largely independent modules. Modules 7.1 (refunds) and 7.2 (disputes) are independent of each other. Module 7.3 is a collection of independent admin panels and background jobs. Module 7.4 (admin notifications) is a thin layer over 7.1/7.2/7.3 events. Work in 4 waves:

**Wave 1 — Refund workflow + Dispute reporting**
The user-facing exception flows. All three tracks are independent.

1. `I-7.1.1` Refund request initiation
2. `I-7.1.2` Refund gateway processing
3. `I-7.1.3` Refund status + email _(wires Phase 6 cancellation template)_
4. `I-7.1.4` Settled-funds handling
5. `I-7.2.1` Participant issue reporting (authenticated)
6. `I-7.2.5` Public unauthenticated dispute form _(needs I-2.5.3 contact page)_
7. `I-7.2.2` Admin dispute queue
8. `I-7.2.3` SLA tracking
9. `I-7.2.4` Organizer suspension
10. `I-7.2.6` Organizer-suspension email

**Wave 2 — Admin operations panels**
Complete the admin dashboard with full queue management, payout monitoring, and audit viewer.

1. `I-7.3.1` Verification queue _(extends Phase 1 admin interface)_
2. `I-7.3.2` Event review queue _(extends Phase 1 admin interface)_
3. `I-7.3.4` Audit log viewer
4. `I-7.3.3` Payout monitoring dashboard
5. `I-7.3.11` SLA compliance dashboard

**Wave 3 — Data lifecycle workers + Compliance**
Background jobs for DPDPA compliance, data hygiene, and deliverability.

1. `I-7.3.5` Anonymization worker _(completes Phase 3 stub)_
2. `I-7.3.6` Sensitive field cleanup job _(30-day post-event)_
3. `I-7.3.7` KYC document cleanup job _(1-year retention)_
4. `I-7.3.8` DSAR data export
5. `I-7.3.9` Email bounce/complaint handling
6. `I-7.3.10` Inactive account cleanup _(feeds into I-7.3.5 anonymization)_

**Wave 4 — Admin notifications**
Email notifications to admin staff so they no longer need to poll. Depends on the upstream events from Waves 1-3 and on Phase 1 verification/event-review submission flows.

1. `I-7.4.1` Verification submission notification _(needs I-1.1.4)_
2. `I-7.4.2` Event review submission notification _(needs I-1.2.7)_
3. `I-7.4.3` New dispute notification _(needs I-7.2.1, I-7.2.5)_
4. `I-7.4.5` Payment-webhook DLQ notification _(needs I-3.2.7, I-0.4.5)_
5. `I-7.4.4` SLA breach notification _(needs I-7.3.11)_
6. `I-7.4.6` Daily admin digest _(aggregates all of the above)_

```
Wave 1 (exception flows)        Wave 2 (admin panels)              Wave 3 (data lifecycle)            Wave 4 (admin notifications)
────────────────────────────    ────────────────────────────────    ────────────────────────────       ──────────────────────────────
I-7.1.1 refund request          I-7.3.1 verification queue          I-7.3.5 anonymization worker       I-7.4.1 verification notify
I-7.1.2 gateway processing      I-7.3.2 event review queue (∥)      I-7.3.6 sensitive cleanup (∥)      I-7.4.2 event review notify
I-7.1.3 status + email          I-7.3.4 audit log viewer (∥)        I-7.3.7 KYC cleanup (∥)            I-7.4.3 new dispute notify
I-7.1.4 settled funds           I-7.3.3 payout dashboard (∥)        I-7.3.8 DSAR export                I-7.4.5 DLQ notify
I-7.2.1 issue reporting         I-7.3.11 SLA dashboard              I-7.3.9 bounce handling            I-7.4.4 SLA breach notify
I-7.2.5 public dispute form                                          I-7.3.10 inactive cleanup          I-7.4.6 daily digest
I-7.2.2 dispute queue
I-7.2.3 SLA tracking
I-7.2.4 organizer suspension
I-7.2.6 suspension email
```

**Validate after each wave:** Run `check-types`, `lint`, and `test` for all affected workspaces.

---

## Cross-Cutting Concerns (Applied Across All Phases)

These are not separate phases — they are requirements that apply during every phase of implementation.

### Security

| Concern                        | Implementation                                                                                                                      | Applies From |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| CSRF protection                | SameSite cookies + anti-CSRF token on state-changing requests (I-0.2.11)                                                            | Phase 0      |
| Rate limiting                  | Per-route, per-IP via `@fastify/rate-limit` + Redis. **Per-event rate limiting** for burst registration.                            | Phase 0      |
| Input validation               | Zod schemas on every endpoint + response schemas                                                                                    | Phase 0      |
| SQL injection prevention       | Drizzle ORM parameterized queries                                                                                                   | Phase 0      |
| XSS prevention                 | React default escaping + CSP headers (I-0.2.12)                                                                                     | Phase 0      |
| Webhook signature verification | HMAC SHA256 on Razorpay callbacks (I-3.2.7)                                                                                         | Phase 3      |
| Secret management              | Railway env vars, rolling rotation for session/HMAC secrets                                                                         | Phase 0      |
| Scoped organizer access        | **Server-side enforcement from Phase 1 onward.** All organizer API endpoints filter to own resources only. Not deferred to Phase 4. | Phase 1      |
| Admin IP allowlist             | Admin endpoints restricted to known IP ranges (I-0.2.6)                                                                             | Phase 0      |
| Backpressure / waiting-room    | Admission control for burst registration — 503 + Retry-After (I-3.2.11)                                                             | Phase 3      |

### Privacy & Data Handling (DPDPA-Aware)

| Concern                       | Implementation                                                                                                                                                                     | Applies From |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Data minimization             | Collect only registration + event-day data                                                                                                                                         | Phase 3      |
| Sensitive field opt-in        | Blood group, medical fields optional by default                                                                                                                                    | Phase 1      |
| Consent at collection         | Explicit consent, versioned, no pre-checked boxes. **Four separate consent types**: booking_terms, data_usage, marketing (I-3.1.6), parental (I-3.1.7 — when participant age < 18) | Phase 3      |
| Consent withdrawal            | API endpoint to revoke specific consent types (I-3.4.5)                                                                                                                            | Phase 3      |
| Marketing consent separation  | Promotional emails require explicit marketing consent; transactional emails (booking confirmation, reminders) do not. Enforced explicitly in next-event prompt section (I-6.2.5).  | Phase 3      |
| Parental consent for minors   | Server-side gate when `participant.age < 18`: parent/guardian email + consent recorded as a `parental` row in `consent_records`; confirmation email CC'd to guardian (I-3.1.7)     | Phase 3      |
| Sensitive field auto-fill     | **Never auto-filled across bookings (DEC-1, v2.2 privacy-first).** Auto-fill (I-3.1.4) covers non-sensitive fields only.                                                           | Phase 3      |
| Scoped organizer access       | Server-side filtering to own events only — enforced from Phase 1, not Phase 4                                                                                                      | Phase 1      |
| Sensitive data segregation    | `sensitive_participant_data` table — blood_group, medical_conditions, emergency_contact stored separately with 30-day TTL                                                          | Phase 3      |
| Separate KYC storage          | Object storage with presigned URLs, access logged                                                                                                                                  | Phase 1      |
| Public legal surface          | `/privacy`, `/terms`, `/about`, `/faq`, `/contact` (Module 2.5); consent versions align with `consent_records.consent_version`                                                     | Phase 2      |
| Booking re-access             | Magic-link booking re-access (I-3.3.7) + phone+booking-id lookup (I-3.3.8) — no persistent participant session needed                                                              | Phase 3      |
| Deletion/anonymization        | Soft delete, booking anonymization, scheduled cleanup (I-7.3.5)                                                                                                                    | Phase 7      |
| Data export (DSAR)            | `GET /api/v1/my/data-export` machine-readable export (I-7.3.8)                                                                                                                     | Phase 7      |
| Public dispute reporting      | Public unauthenticated dispute form (I-7.2.5) — entry from `/contact` and event page footer                                                                                        | Phase 7      |
| Admin awareness notifications | Email notifications to admin on new verification / event review / dispute / SLA breach / DLQ + daily digest (Module 7.4)                                                           | Phase 7      |

### Data Lifecycle & Retention

| Data Class                   | Retention                                    | Cleanup Mechanism                    |
| ---------------------------- | -------------------------------------------- | ------------------------------------ |
| Participant profile          | Until deletion request or 3 years inactivity | Soft delete + anonymization          |
| Booking & payment records    | 5 years                                      | Anonymize PII, preserve financial    |
| Sensitive participant fields | 30 days post-event                           | BullMQ daily cleanup job             |
| Organizer verification docs  | 1 year after account closure                 | BullMQ weekly cleanup job            |
| Audit logs                   | 3 years minimum                              | Manual review before purge           |
| Consent records              | As long as related data exists               | Never deleted before authorized data |

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

| Module                         | Can Start During | Reason                                                     |
| ------------------------------ | ---------------- | ---------------------------------------------------------- |
| I-1.1.5 Admin verification API | Phase 0          | Needed for organizer onboarding                            |
| I-1.2.7 Admin event review API | Phase 1          | Needed before events can be published                      |
| Module 2.4 CDN & Cache setup   | Phase 1          | Infrastructure can be configured before public pages exist |
| Module 3.4 Participant Profile | Phase 3 (early)  | Save-on-first-booking can be built alongside registration  |
| Module 7.3 Admin operations    | Phase 4          | Admin queue management extends Phase 1 stubs               |

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

| Phase                                          | Modules | Features |
| ---------------------------------------------- | ------- | -------- |
| Phase 0: Foundation                            | 4       | 37       |
| Phase 1: Organizer Onboarding & Event Creation | 2       | 24       |
| Phase 2: Event Discovery & Public Pages        | 5       | 33       |
| Phase 3: Registration, Payment & Booking       | 4       | 32       |
| Phase 4: Organizer Operations Dashboard        | 2       | 9        |
| Phase 5: Event-Day Operations                  | 3       | 12       |
| Phase 6: Communications & Retention            | 2       | 7        |
| Phase 7: Refunds, Disputes & Admin Ops         | 4       | 27       |
| **Total**                                      | **26**  | **181**  |

**Note:** Feature count is higher than the requirements doc (103 F-IDs across 8 phases) because:

- Phase 0 adds infrastructure features (Redis, BullMQ, object storage, CI/CD, security headers, observability, metrics, conversion-funnel counters, secret-rotation runbook, internal-key hotfixes)
- Phase 1 adds Razorpay Route linked-account, event images, slug generation, organizer transactional emails (welcome / verification approve+reject / Razorpay-ready), event review emails
- Phase 2 adds CDN infrastructure module, organizer slug, sitemap/robots/canonical/breadcrumb SEO, slug 301 redirect handler, public chrome (privacy/terms/about/faq/contact)
- Phase 3 adds payment infrastructure (webhook, reconciliation, per-category capacity, backpressure, per-event rate limiting), email foundation (moved from Phase 6), consent withdrawal, parental consent, magic-link booking re-access, booking lookup
- Phase 4 adds the conversion-rate tile
- Phase 6 adds explicit marketing-consent enforcement on next-event prompt
- Phase 7 adds data lifecycle workers (anonymization, sensitive field cleanup, KYC cleanup, DSAR export, email deliverability), public dispute form, suspension email, SLA compliance dashboard, full admin notifications module
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
GET  /organizers/:id/next-event → Next event by same organizer (Layer 4 emails, I-2.3.6)
POST /organizers/verify       → Submit verification documents
```

### Bookings

```
POST /bookings                → Submit registration + initiate payment (per-event rate limited; I-3.2.12)
POST /bookings/payment/callback → Razorpay webhook
GET  /bookings/:id            → Booking detail. Authorization matrix: (a) booking owner via authenticated session, OR (b) valid unexpired magic-link token bound to this exact booking_id (I-3.3.7). Organizer/admin reads use scoped /org/* or /admin/* endpoints — this route does NOT serve organizers, even for their own events.
POST /bookings/lookup         → Phone+booking-id lookup → triggers OTP (I-3.3.8)
```

**V1 cancellation policy:** there is no participant self-service `DELETE /bookings/:id` or `POST /bookings/:id/cancel` route. Participant cancellation is initiated through the refund-request workflow (`POST /refunds`, I-7.1.1). Booking transitions to `cancelled` / `refunded` are driven by the refund worker (I-7.1.3) and the admin dispute queue (I-7.2.2). Direct organizer/admin status changes go through scoped admin routes.

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
GET  /admin/sla                   → SLA compliance dashboard (I-7.3.11)
```

### Public (unauthenticated)

```
POST /public/disputes             → Public unauthenticated dispute reporting (I-7.2.5)
GET  /sitemap.xml                 → Sitemap of public pages (I-2.4.4)
GET  /robots.txt                  → Crawl directives (I-2.4.5)
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
/privacy                      → DPDPA-aware privacy notice (I-2.5.1)
/terms                        → Platform terms of service (I-2.5.2)
/about                        → About / mission / Coimbatore pilot (I-2.5.4)
/faq                          → Participant FAQ (I-2.5.5)
/contact                      → Contact + public dispute form (I-2.5.3)
/sitemap.xml                  → Sitemap (I-2.4.4)
/robots.txt                   → Robots directives (I-2.4.5)
```

### Booking (CSR, `ssr: 'data-only'`)

```
/book/:eventId                → Registration + payment flow
/book/:eventId/confirmation   → Booking confirmation with QR
/my/bookings/:bookingId       → Booking re-access (magic-link or auth, I-3.3.7)
/lookup-booking               → Public lookup form (phone + booking-id, I-3.3.8)
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
/admin/sla                    → SLA compliance dashboard (I-7.3.11)
```

---

## BullMQ Worker Jobs

All workers run as a **separate Railway service** — never in the API process.

**DLQ pattern:** BullMQ has no native DLQ. Implement via `failed` event handler: after max retries exhausted, move job to dead-letter storage + alert admin via webhook/email.

| Queue             | Job                          | Trigger                              | Concurrency | Retry          | Notes                                        |
| ----------------- | ---------------------------- | ------------------------------------ | ----------- | -------------- | -------------------------------------------- |
| `payment-webhook` | Process payment webhook      | Razorpay webhook received            | 10          | 3× exponential | Critical path — booking state machine        |
| `payment-webhook` | Payment reconciliation       | Repeatable (every 5 min)             | 1           | 1×             | Catches missed webhooks                      |
| `payment-webhook` | Capacity reservation expiry  | Repeatable (every 1 min)             | 2           | 1×             | 15-minute reservation timeout (per-category) |
| `email`           | Organizer welcome email      | Organizer signup                     | 5           | 2× exponential | I-1.1.9                                      |
| `email`           | Email-verification link      | Organizer signup                     | 5           | 2× exponential | I-0.2.5                                      |
| `email`           | Verification approved        | Admin approves verification          | 5           | 2× exponential | I-1.1.10                                     |
| `email`           | Verification rejected        | Admin rejects verification           | 5           | 2× exponential | I-1.1.11                                     |
| `email`           | Razorpay account ready       | Razorpay linked-account active       | 5           | 2× exponential | I-1.1.12                                     |
| `email`           | Event submitted for review   | Event submit-for-review              | 5           | 2× exponential | I-1.2.11 (organizer ack)                     |
| `email`           | Event approved/rejected      | Admin reviews event                  | 5           | 2× exponential | I-1.2.12                                     |
| `email`           | Booking confirmation         | Booking confirmed                    | 5           | 2× exponential | Contains QR ticket + magic link              |
| `email`           | Magic-link booking re-access | Booking confirmed                    | 5           | 2× exponential | I-3.3.7 (folded into confirmation)           |
| `email`           | Event reminder               | Scheduled (1-2 days before)          | 5           | 2× exponential | —                                            |
| `email`           | Post-event follow-up         | Event completed                      | 5           | 2× exponential | Requires marketing consent (I-6.2.5)         |
| `email`           | Refund confirmation          | Refund processed                     | 5           | 2× exponential | —                                            |
| `email`           | Organizer suspension         | Admin suspends organizer             | 5           | 2× exponential | I-7.2.6                                      |
| `email`           | Bounce/complaint handler     | Resend/SES webhook                   | 2           | 1×             | Suppress future sends to bounced addresses   |
| `admin-notify`    | New verification submission  | Verification submitted               | 2           | 2× exponential | I-7.4.1                                      |
| `admin-notify`    | Event submitted for review   | Event submitted                      | 2           | 2× exponential | I-7.4.2                                      |
| `admin-notify`    | New dispute filed            | Dispute created                      | 2           | 2× exponential | I-7.4.3 (auth + public)                      |
| `admin-notify`    | SLA breach                   | Daily SLA scan                       | 2           | 2× exponential | I-7.4.4                                      |
| `admin-notify`    | Payment-webhook DLQ entry    | DLQ insert                           | 2           | 2× exponential | I-7.4.5                                      |
| `admin-notify`    | Daily admin digest           | Repeatable daily 09:00 IST           | 1           | 1×             | I-7.4.6                                      |
| `cleanup`         | Sensitive field cleanup      | Repeatable daily                     | 2           | 1×             | 30 days post-event                           |
| `cleanup`         | KYC doc cleanup              | Repeatable weekly                    | 2           | 1×             | 1 year after account closure                 |
| `cleanup`         | Inactive account cleanup     | Repeatable weekly                    | 2           | 1×             | 3 years inactivity (I-7.3.10)                |
| `cleanup`         | Anonymization processor      | Profile deletion request             | 2           | 2× exponential | PII → deterministic hashes                   |
| `seo`             | Sitemap regeneration         | Repeatable hourly + on event publish | 1           | 2×             | I-2.4.4                                      |
| `exports`         | Roster PDF/CSV generation    | Organizer request                    | 1           | 2×             | Sensitive fields controlled                  |
| `exports`         | DSAR data export             | Participant request                  | 1           | 2×             | All personal data, machine-readable          |

---

## Database Table Overview

### Core (Phase 0)

- `users` — id, phone, email, name, role, created_at, deleted_at
- `sessions` — id, user_id, data JSONB, expires_at
- `consent_records` — id, user_id, booking_id (nullable), consent_type (booking_terms/data_usage/marketing/parental), consent_version, granted_at, withdrawn_at, ip_address. Parental rows additionally carry guardian_email + guardian_name (populated by I-3.1.7). Created in Phase 0 (table + booking_terms/data_usage/marketing types); the `parental` consent type and guardian columns are added by Phase 3 migration alongside I-3.1.6 / I-3.1.7. **Single source of truth — do not redefine in later phases.**
- `audit_log` — id, actor_id, actor_role, action, resource_type, resource_id, metadata JSONB, ip_address, created_at

### Organizer (Phase 1)

- `organizers` — id, user_id, business_name, **slug** (added migration 0015), description, city, email, email_verified_at, **razorpay_account_id**, verification_status, events_published_count, **deleted_at** (nullable timestamp; set when an organizer account is closed — powers the 1-year KYC retention clock used by I-7.3.7), created_at
- `organizer_verifications` — id, organizer_id, document_type, storage_key, uploaded_at, reviewed_at, reviewed_by, status, notes
- `policy_acceptances` — id, organizer_id, policy_type, policy_version, accepted_at

### Events (Phase 1)

- `events` — id, organizer_id, slug, name, date, time, location, description, route_details, image_storage_key, status (draft/under_review/published/completed/cancelled), form_schema JSONB, form_schema_version, refund_policy, cancellation_policy, **first_published_at** (added migration 0017 — set once, never cleared; powers first-3-paid gate), created_at, updated_at. **Capacity is NOT on `events`** — see `event_categories` (DEC-3 v2.2).
- `event_categories` — id, event_id, name, distance, sort_order, **spots_total** (NOT NULL, added migration 0016), **spots_remaining** (NOT NULL, default = spots_total, added migration 0016). Per-category capacity model so a single distance can sell out independently. Modified atomically in I-3.2.10.
- `event_pricing_tiers` — id, event_category_id, base_price, early_bird_price, early_bird_deadline
- `slug_redirects` — id, old_slug, new_slug, resource_type (event/organizer), resource_id, created_at. Powers I-2.4.6 301 redirect handler.

### Bookings & Payments (Phase 3)

- `bookings` — id, event_id, user_id, event_category_id, form_data JSONB, form_schema_snapshot JSONB, status (pending/reserved/confirmed/cancelled/refunded/checked_in), razorpay_payment_id (unique), ticket_version, checked_in_at, created_at
- `payment_records` — id, booking_id, razorpay_order_id, amount, platform_fee, organizer_amount, status, created_at (immutable insert-only)
- `webhook_events` — id, provider_event_id (unique), signature_valid, payload_hash, processing_status, last_error, received_at, processed_at

### Participant (Phase 3)

- `participant_profiles` — id, user_id, name, age, gender, city, tshirt_size, **phone**, updated_at. **Note: blood_group, medical_conditions, emergency_contact are NOT stored here — they go in `sensitive_participant_data` only.** Per DEC-1 (v2.2), only fields stored here are auto-fillable on repeat booking; sensitive fields are re-collected each time.
- `sensitive_participant_data` — id, booking_id, blood_group, medical_conditions, emergency_contact, expires_at (30 days post-event)
- _`consent_records` — see Phase 0 above for the canonical schema. The `parental` consent type and guardian columns are added by a Phase 3 migration alongside I-3.1.6 / I-3.1.7._
- `booking_access_tokens` — id, booking_id, token_hash, expires_at, revoked_at. Powers I-3.3.7 magic-link booking re-access.

### Communications (Phase 0 schema, populated in Phases 6–7)

- `email_log` — id, recipient_id, template, status, sent_at, metadata JSONB. Created in Phase 0; populated by every email sender from Phase 3 onward.
- `email_suppressions` — id, email_address (unique), reason (bounce/complaint/manual), provider_event_id, created_at. **Created in Phase 0** so every email sender (I-3.3.1, I-3.3.5, I-6.1.1, I-6.1.2, I-6.2.1) can consult it from day one. **Populated in Phase 7** by I-7.3.9 (Resend/SES bounce/complaint webhook handler).

### Disputes & Refunds (Phase 7)

- `refund_requests` — id, booking_id, requested_by, reason, status, processed_at
- `disputes` — id, booking_id (nullable for public form), reporter_id (nullable), reporter_email, reporter_name, reporter_phone, description, source (authenticated/public_form), status, sla_deadline, sla_first_response_at, resolved_at. Source distinguishes authenticated (I-7.2.1) from public form (I-7.2.5).

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

| Requirements ID | Implementation ID | Feature                                                                         |
| --------------- | ----------------- | ------------------------------------------------------------------------------- |
| F-0.1.1         | I-0.1.1           | Shared packages (expanded from "Initialize project structure")                  |
| F-0.1.2         | I-0.1.2, I-0.1.3  | DB schema foundations (split into Drizzle ORM + core tables)                    |
| F-0.1.3         | I-0.1.9           | CI/CD deployment pipeline                                                       |
| F-0.1.4         | I-0.1.4           | Local dev infrastructure (Docker Compose)                                       |
| — (new)         | I-0.1.5           | Redis client setup (infra)                                                      |
| — (new)         | I-0.1.6           | BullMQ queue infrastructure (infra)                                             |
| — (new)         | I-0.1.7           | Database migration CI pipeline (infra)                                          |
| — (new)         | I-0.1.8           | Object storage client (infra)                                                   |
| F-0.2.1         | I-0.2.1           | Phone OTP authentication (expanded with WhatsApp fallback)                      |
| F-0.2.2         | I-0.2.4           | Role-based access control                                                       |
| F-0.2.3         | I-0.2.2, I-0.2.3  | Session management (split into creation + middleware)                           |
| F-0.2.4         | I-0.2.7           | Deferred authentication pattern                                                 |
| — (new)         | I-0.2.5           | Organizer email verification (architecture §6)                                  |
| — (new)         | I-0.2.6           | Admin IP allowlist (architecture §6)                                            |
| — (new)         | I-0.2.8           | Logout endpoint                                                                 |
| — (new)         | I-0.2.9           | Session forwarding for SSR                                                      |
| — (new)         | I-0.2.10          | Internal API key for server-to-server                                           |
| — (new)         | I-0.2.11          | CSRF protection                                                                 |
| — (new)         | I-0.2.12          | Security headers                                                                |
| F-0.3.1         | I-0.3.1           | Mobile-first responsive layout shell                                            |
| F-0.3.2         | I-0.3.2           | Core UI component library                                                       |
| F-0.3.3         | I-0.3.3           | Role-based routing and navigation                                               |
| F-0.3.4         | I-0.3.4, I-0.3.5  | Error handling + loading state patterns (split into 2)                          |
| — (new)         | I-0.3.6           | API client setup (hybrid SSR/browser)                                           |
| — (new)         | I-0.4.1           | Sentry integration (observability)                                              |
| — (new)         | I-0.4.2           | Pino logging + OpenTelemetry (observability)                                    |
| — (new)         | I-0.4.3           | Health check endpoints (observability)                                          |
| — (new)         | I-0.4.4           | Audit log infrastructure (observability)                                        |
| — (new)         | I-0.4.5           | Production metrics emitter (observability)                                      |
| — (new)         | I-0.4.6           | BullMQ observability (observability)                                            |
| — (new)         | I-0.4.7           | Conversion funnel counters + dashboard tile (product plan §11)                  |
| — (new)         | I-0.2.13          | Secret rotation runbook + automated reminder (architecture §6)                  |
| — (new)         | I-0.2.14          | Hotfix: treat blank `INTERNAL_API_KEY` as unset (test-failure-driven)           |
| — (new)         | I-0.2.15          | Hotfix: differentiate "not configured" vs "invalid" internal-key error messages |

### Phase 1: Organizer Onboarding & Event Creation

| Requirements ID | Implementation ID | Feature                                                  |
| --------------- | ----------------- | -------------------------------------------------------- |
| F-1.1.1         | I-1.1.1           | Organizer registration form                              |
| F-1.1.2         | I-1.1.2           | Verification document upload                             |
| F-1.1.3         | I-1.1.3           | Policy acceptance workflow                               |
| F-1.1.4         | I-1.1.4           | Verification status tracking                             |
| F-1.1.5         | I-1.1.5           | Admin verification review interface                      |
| F-1.1.6         | I-1.1.6           | Verification badge assignment                            |
| — (new)         | I-1.1.7           | Razorpay Route linked-account creation (product plan §7) |
| — (new)         | I-1.1.8           | Organizer profile management                             |
| F-1.2.1         | I-1.2.1           | Event creation form                                      |
| F-1.2.2         | I-1.2.2           | Event category & distance configuration                  |
| F-1.2.3         | I-1.2.3           | Pricing configuration                                    |
| F-1.2.4         | I-1.2.4           | Registration form field configuration                    |
| F-1.2.5         | I-1.2.5           | Refund & cancellation policy capture                     |
| F-1.2.6         | I-1.2.6           | Event publish workflow                                   |
| F-1.2.7         | I-1.2.7           | Admin event review                                       |
| F-1.2.8         | I-1.2.8           | Event edit & update capabilities                         |
| — (new)         | I-1.2.9           | Event image upload (product plan §6)                     |
| — (new)         | I-1.2.10          | Slug generation for events                               |
| — (new)         | I-1.1.9           | Welcome email on organizer signup                        |
| — (new)         | I-1.1.10          | Verification-approved email                              |
| — (new)         | I-1.1.11          | Verification-rejected email                              |
| — (new)         | I-1.1.12          | Razorpay linked-account ready email                      |
| — (new)         | I-1.2.11          | Event submitted-for-review email (organizer ack)         |
| — (new)         | I-1.2.12          | Event approved/rejected email                            |

### Phase 2: Event Discovery & Public Pages

| Requirements ID | Implementation ID | Feature                                      |
| --------------- | ----------------- | -------------------------------------------- |
| F-2.1.1         | I-2.1.1           | Professional event page layout               |
| F-2.1.2         | I-2.1.2           | Organizer info section with badge            |
| F-2.1.3         | I-2.1.3           | Policy display                               |
| F-2.1.4         | I-2.1.4           | Category & pricing breakdown                 |
| F-2.1.5         | I-2.1.5           | Share-optimized previews (OG tags)           |
| F-2.1.6         | I-2.1.6           | Structured data markup (JSON-LD)             |
| F-2.1.7         | I-2.1.7           | "Register Now" CTA                           |
| F-2.1.8         | I-2.1.8           | Mobile-first responsive design               |
| F-2.2.1         | I-2.2.1           | Launch-city event listing                    |
| F-2.2.2         | I-2.2.2           | Event cards                                  |
| F-2.2.3         | I-2.2.3           | Event status indicators                      |
| F-2.2.4         | I-2.2.4           | Sort by date                                 |
| F-2.3.1         | I-2.3.1           | Organizer profile page                       |
| F-2.3.2         | I-2.3.2           | Upcoming events on profile                   |
| F-2.3.3         | I-2.3.3           | Past event history                           |
| F-2.3.4         | I-2.3.4           | Verification status explanation              |
| — (new)         | I-2.3.5           | Organizer slug generation                    |
| — (new)         | I-2.4.1           | Cloudflare CDN setup (architecture §1, §4.2) |
| — (new)         | I-2.4.2           | CDN cache invalidation                       |
| — (new)         | I-2.4.3           | Cache stampede prevention                    |
| — (new)         | I-2.4.4           | sitemap.xml generation                       |
| — (new)         | I-2.4.5           | robots.txt + crawl directives                |
| — (new)         | I-2.4.6           | 301 redirect handler for slug changes        |
| — (new)         | I-2.4.7           | Canonical URL tags                           |
| — (new)         | I-2.4.8           | Breadcrumb JSON-LD on event detail           |
| — (new)         | I-2.1.9           | Spots-remaining badge (per-category)         |
| — (new)         | I-2.1.10          | Early-bird countdown timer                   |
| — (new)         | I-2.3.6           | Same-organizer next-event lookup API         |
| — (new)         | I-2.5.1           | /privacy page                                |
| — (new)         | I-2.5.2           | /terms page                                  |
| — (new)         | I-2.5.3           | /contact page                                |
| — (new)         | I-2.5.4           | /about page                                  |
| — (new)         | I-2.5.5           | /faq page                                    |

### Phase 3: Registration, Payment & Booking

| Requirements ID  | Implementation ID | Feature                                                                                     |
| ---------------- | ----------------- | ------------------------------------------------------------------------------------------- |
| F-3.1.1          | I-3.1.1           | Category selection step                                                                     |
| F-3.1.2          | I-3.1.2           | Registration form                                                                           |
| F-3.1.3          | I-3.1.3           | OTP verification at submission                                                              |
| F-3.1.4          | I-3.1.4           | Auto-fill from saved profile                                                                |
| F-3.1.5          | I-3.1.5           | Form validation                                                                             |
| F-3.1.6          | I-3.1.6           | Consent capture (expanded to 3 types: booking_terms, data_usage, marketing)                 |
| F-3.2.1          | I-3.2.1           | Razorpay Route integration                                                                  |
| F-3.2.2          | I-3.2.2           | UPI + card payment                                                                          |
| F-3.2.3          | I-3.2.3           | Split payout configuration                                                                  |
| F-3.2.4          | I-3.2.4           | Payment status tracking                                                                     |
| F-3.2.5          | I-3.2.5           | Payment failure handling                                                                    |
| F-3.2.6          | I-3.2.6           | Free pilot period handling                                                                  |
| — (new)          | I-3.2.7           | Razorpay webhook handler (architecture §7)                                                  |
| — (new)          | I-3.2.8           | Webhook idempotency                                                                         |
| — (new)          | I-3.2.9           | Payment reconciliation job                                                                  |
| — (new)          | I-3.2.10          | Capacity reservation with expiry                                                            |
| — (new)          | I-3.2.11          | Backpressure / waiting-room mode (architecture §1)                                          |
| F-6.1.1          | I-3.3.1           | Email service integration (**moved from Phase 6** — critical path for booking confirmation) |
| F-3.3.1          | I-3.3.2           | Booking record creation                                                                     |
| F-3.3.2          | I-3.3.3           | Booking confirmation page                                                                   |
| F-3.3.3          | I-3.3.4           | QR code generation                                                                          |
| F-3.3.4, F-6.1.2 | I-3.3.5           | Booking confirmation email with QR (**F-6.1.2 merged** — email + QR are one feature)        |
| F-3.3.5          | I-3.3.6           | Booking status management                                                                   |
| F-3.4.1          | I-3.4.1           | Save participant details on first booking                                                   |
| F-3.4.2          | I-3.4.2           | Profile view and edit                                                                       |
| F-3.4.3          | I-3.4.3           | Booking history view                                                                        |
| F-3.4.4          | I-3.4.4           | Profile data deletion request                                                               |
| — (new)          | I-3.4.5           | Consent withdrawal API (architecture §6)                                                    |
| — (new)          | I-3.1.7           | Parental consent for minor participants (DPDPA + architecture §6)                           |
| — (new)          | I-3.2.12          | Per-event sliding-window rate limiting on checkout (architecture §7 step 8)                 |
| — (new)          | I-3.3.7           | Magic-link booking re-access email                                                          |
| — (new)          | I-3.3.8           | Booking lookup by phone + booking-id                                                        |

### Phase 4: Organizer Operations Dashboard

| Requirements ID | Implementation ID | Feature                               |
| --------------- | ----------------- | ------------------------------------- |
| F-4.1.1         | I-4.1.1           | Registration/payment/check-in summary |
| F-4.1.2         | I-4.1.2           | Participant list with filters         |
| F-4.1.3         | I-4.1.3           | Individual booking detail             |
| F-4.1.4         | I-4.1.4           | Revenue view                          |
| F-4.1.5         | I-4.1.5           | Roster export (CSV)                   |
| — (new)         | I-4.1.6           | Conversion-rate tile (uses I-0.4.7)   |
| F-4.2.1         | I-4.2.1           | Organizer event home                  |
| F-4.2.2         | I-4.2.2           | Event status cards                    |
| F-4.2.3         | I-4.2.3           | Quick-access links                    |

### Phase 5: Event-Day Operations

| Requirements ID | Implementation ID | Feature                                                           |
| --------------- | ----------------- | ----------------------------------------------------------------- |
| F-5.1.1         | I-5.1.1           | QR scanner interface                                              |
| F-5.1.2         | I-5.1.2           | Scan result display                                               |
| F-5.1.3         | I-5.1.3           | Check-in confirmation                                             |
| F-5.1.4         | I-5.1.4           | Duplicate scan detection                                          |
| F-5.1.5         | I-5.1.5           | Sensitive field suppression (upgraded to server-side enforcement) |
| F-5.2.1         | I-5.2.1           | Search by name/phone                                              |
| F-5.2.2         | I-5.2.2           | Search results with status                                        |
| F-5.2.3         | I-5.2.3           | Manual check-in                                                   |
| F-5.3.1         | I-5.3.1           | Downloadable roster                                               |
| F-5.3.2         | I-5.3.2           | Roster contents                                                   |
| F-5.3.3         | I-5.3.3           | Safety-critical field inclusion                                   |
| F-5.3.4         | I-5.3.4           | Delete-after-event instruction                                    |

### Phase 6: Communications & Retention

| Requirements ID | Implementation ID | Feature                                                    |
| --------------- | ----------------- | ---------------------------------------------------------- |
| F-6.1.1         | → I-3.3.1         | **Moved to Phase 3 Module 3.3**                            |
| F-6.1.2         | → I-3.3.5         | **Merged into Phase 3 Module 3.3**                         |
| F-6.1.3         | I-6.1.1           | Event reminder email                                       |
| F-6.1.4         | I-6.1.2           | Cancellation/refund confirmation email                     |
| F-6.2.1         | I-6.2.1           | Post-event follow-up email                                 |
| F-6.2.2         | I-6.2.2           | Organizer wrap-up/results links                            |
| F-6.2.3         | I-6.2.3           | Next-event prompt                                          |
| F-6.2.4         | I-6.2.4           | Organizer post-event content interface                     |
| — (new)         | I-6.2.5           | Marketing-consent enforcement on next-event prompt section |

### Phase 7: Refunds, Disputes & Admin Operations

| Requirements ID | Implementation ID | Feature                                                                |
| --------------- | ----------------- | ---------------------------------------------------------------------- |
| F-7.1.1         | I-7.1.1           | Refund request initiation                                              |
| F-7.1.2         | I-7.1.2           | Refund processing (reverse split)                                      |
| F-7.1.3         | I-7.1.3           | Refund status tracking                                                 |
| F-7.1.4         | I-7.1.4           | Already-settled fund handling                                          |
| F-7.2.1         | I-7.2.1           | Participant issue reporting                                            |
| F-7.2.2         | I-7.2.2           | Admin dispute queue                                                    |
| F-7.2.3         | I-7.2.3           | SLA tracking                                                           |
| F-7.2.4         | I-7.2.4           | Organizer suspension                                                   |
| F-7.3.1         | I-7.3.1           | Organizer verification queue (extends I-1.1.5)                         |
| F-7.3.2         | I-7.3.2           | Event review queue (extends I-1.2.7)                                   |
| F-7.3.3         | I-7.3.3           | Payout monitoring dashboard                                            |
| F-7.3.4         | I-7.3.4           | Audit log viewer                                                       |
| — (new)         | I-7.3.5           | Anonymization worker (DPDPA compliance)                                |
| — (new)         | I-7.3.6           | Sensitive field cleanup (30d post-event)                               |
| — (new)         | I-7.3.7           | KYC document cleanup (1y post-closure)                                 |
| — (new)         | I-7.3.8           | DSAR data export (DPDPA compliance)                                    |
| — (new)         | I-7.3.9           | Email bounce/complaint handling                                        |
| — (new)         | I-7.3.10          | Inactive account cleanup (3y inactivity)                               |
| — (new)         | I-7.3.11          | SLA compliance dashboard (refund + dispute breach alerts)              |
| — (new)         | I-7.2.5           | Public unauthenticated dispute reporting form                          |
| — (new)         | I-7.2.6           | Organizer-suspension email                                             |
| — (new)         | I-7.4.1           | Admin notification: new verification submission                        |
| — (new)         | I-7.4.2           | Admin notification: event submitted for review                         |
| — (new)         | I-7.4.3           | Admin notification: new dispute filed                                  |
| — (new)         | I-7.4.4           | Admin notification: SLA breach (refund/dispute)                        |
| — (new)         | I-7.4.5           | Admin notification: payment-webhook DLQ entry                          |
| — (new)         | I-7.4.6           | Admin daily digest (verifications, reviews, disputes, SLA, DLQ counts) |

### Summary

|           | Requirements (F-IDs) | Implementation (I-IDs) | Δ                                                                                                                                   |
| --------- | -------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0   | 12                   | 37                     | +25 (infrastructure, conversion funnel, secret rotation, hotfixes)                                                                  |
| Phase 1   | 14                   | 24                     | +10 (Razorpay, images, slug, profile, organizer + event emails)                                                                     |
| Phase 2   | 16                   | 33                     | +17 (CDN, organizer slug, full SEO infra, spots/countdown, legal pages)                                                             |
| Phase 3   | 21                   | 32                     | +11 (payment infra, backpressure, consent withdrawal, parental consent, magic-link, lookup, per-event rate limit, email moved here) |
| Phase 4   | 8                    | 9                      | +1 (conversion-rate tile)                                                                                                           |
| Phase 5   | 12                   | 12                     | 0                                                                                                                                   |
| Phase 6   | 8                    | 7                      | −1 (F-6.1.1, F-6.1.2 moved to Phase 3; +1 marketing-consent gate)                                                                   |
| Phase 7   | 12                   | 27                     | +15 (data lifecycle, DSAR, bounce, public dispute, suspension email, SLA dashboard, full admin notifications module)                |
| **Total** | **103**              | **181**                | **+78**                                                                                                                             |

**v2.2 sensitive field decision (DEC-1):** Per-product-plan §6 Tier 1 originally said saved profiles include "blood group, emergency contact" for repeat bookings. The v2.2 design decision is: sensitive fields (blood group, emergency contact, medical conditions) are **never auto-filled across bookings** — they live in `sensitive_participant_data` with 30-day TTL and are re-collected each booking. Auto-fill (I-3.1.4) covers only non-sensitive fields (name, age, gender, city, T-shirt size, phone). UX copy in I-3.1.4 explains the privacy-over-convenience tradeoff. This is a deliberate DPDPA-aligned choice; the operator can revisit by introducing an opt-in toggle in V2 if pilot feedback warrants it.

---

## Appendix B: Review & Revision History

| Version | Date       | Reviewed By                                                                  | Key Changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------- | ---------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1.0    | —          | Initial draft                                                                | 8 phases, 23 modules, 115 features                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| v2.0    | —          | Claude Opus 4.7, Claude Opus 4.6, GPT-5.4, Claude Sonnet 4.6                 | 139 features. Feature ID prefix changed F→I. Email infra moved to Phase 3. Phase 5 prerequisite fixed. Razorpay Route linked-account added. Backpressure/waiting-room added. Sensitive data model fixed. Pre-launch gates added. DSAR export added. Anonymization worker added. CDN module added. Consent model expanded to 3 types.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| v2.1    | —          | Claude Opus 4.6, GPT-5.4 (final review)                                      | 143 features. Appendix A completely rewritten with per-F-ID traceability. Feature count corrected (Phase 2: 20, Phase 3: 28, Phase 7: 18). Added I-7.3.10 (inactive account cleanup). Added slug_redirects table. Added missing API endpoints (email verification, presigned upload, consent, issue reporting, check-in verification). Fixed consent API consistency. Fixed security table cross-reference. Added sensitive field tradeoff note.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| v2.2    | —          | Claude Opus 4.7 (product/requirements vs impl-plan audit)                    | **181 features (+38)**, 26 modules (+2). Product-first audit added: conversion funnel (I-0.4.7) + 4.1 conversion tile, secret rotation runbook (I-0.2.13), 2 internal-key hotfixes (I-0.2.14/15), 6 organizer/event transactional emails (I-1.1.9-12, I-1.2.11-12), per-category capacity model (I-1.2.2 + I-3.2.10 amendment, schema moved spots from `events` to `event_categories`), spots-remaining badge + early-bird countdown (I-2.1.9-10), same-organizer next-event API (I-2.3.6), full SEO infra (sitemap/robots/301-redirect/canonical/breadcrumb — I-2.4.4-8), new Public Chrome & Legal Pages module (Phase 2.5: privacy/terms/contact/about/faq), parental consent for minors (I-3.1.7), per-event sliding-window rate limit (I-3.2.12), magic-link booking re-access + lookup (I-3.3.7-8), marketing-consent enforcement on next-event prompt (I-6.2.5), public unauthenticated dispute form (I-7.2.5), organizer-suspension email (I-7.2.6), SLA compliance dashboard (I-7.3.11), new Admin Notifications module (Phase 7.4: I-7.4.1-6). DEC-1: sensitive fields are never auto-filled (privacy-first). DEC-2: tiered post-publish edit policy. DEC-3: per-category capacity. DEC-5: same-organizer scope for next-event in V1. Drift fixes: 4 missing Current State rows, Database Table Overview spots correction, I-1.2.6 publish-flow clarification, I-0.2.4 participant-OTP clarification.                                                                                                                                                                                                                                                                                                                                                           |
| v2.3    | 2026-04-29 | Phase 2 Readiness Sprint (commits c04b9f1→824549e, branch anvil/impl-wave-b) | **Phase 2 Readiness Sprint — no feature count change, implementation hardening only.** W1.1: `organizers.slug` + deterministic backfill + reserved-slug list + `OrganizerSlugService` + `slug_redirects` writes (migration 0015). W1.2: `event_categories.spots_total`/`spots_remaining` capacity columns shipped via multi-step migration 0016 (resolves v2.2 deferred note). W1.3: tiered post-publish edits fully implemented — `publishedEventPatchSchema`, `EVENT_UPDATE_PUBLISHED` audit constant + constrained metadata, 409 `requiresUnpublish: true`, all update functions audit-classified, `updateEventPolicies` unlocked for published events. W1.4: `buildTestAppWithoutKey()` passes `INTERNAL_API_KEY: ""`; `loadConfig` regression test added (closes I-0.2.14/I-0.2.15; `0000_*` rollback false alarm confirmed exempt by validate-rollbacks.ts). W1.5: `events.first_published_at` (migration 0017), set once on publish/admin-approve, never cleared — closes unpublish→republish bypass of the first-3-paid gate (security/policy fix). W2.1: `emitEmailStub()` defensive helper + `EMAIL_JOB_NAMES` enum + idempotency-key builders; stubs wired at all 6 trigger sites (I-1.1.9–12, I-1.2.11–12); emails marked 🟡 Stubbed (Phase 3). W2.3: `getUploadUrl()` switched to `createPresignedPost` with `content-length-range` + content-type + SSE conditions; response `{ url, method: "POST", fields, key, expiresAt }`; web consumers use FormData POST. Validation: api 725/725, web 163/163, shared 168/168, db 31/31. **Phase-3 deferrals:** real Resend templates (I-3.3.1), parental consent enum (I-3.1.7), conversion-funnel emission (I-0.4.7), atomic capacity decrement (I-3.2.10), secret-rotation runbook (I-0.2.13), pre-launch gates. |
| v2.4    | 2026-04-29 | Fix-loop GPT 5.5 review (round 2)                                            | Addressed 3 critical + 5 important Phase 2 Readiness findings. W1.1 now enforces `organizers.slug NOT NULL`, aligns migration normalization with the shared slug kernel via `unaccent`, expands reserved public slugs, and wires businessName slug regeneration + `slug_redirects` in one transaction. W1.3 now returns the real structured 409 contract for high-risk and mixed published edits instead of generic route validation, with constrained audit metadata verified by tests. W1.5 now has the partial paid-event index and regression coverage for unpublish/next-paid review routing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
