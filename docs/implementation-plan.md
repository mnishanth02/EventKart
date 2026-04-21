# Kiran V1 — High-Level Implementation Plan (Revised)

> **Revision Notes:** This plan incorporates feedback from reviews by Claude Opus 4.7, Claude Opus 4.6, and GPT 5.4. Key changes: Phase 0 expanded with critical infra (BullMQ worker, object storage, Docker Compose, secrets); admin scaffolding pulled earlier; Phase 6 split into 4 sub-phases; email integration pulled into booking phase; Razorpay spike added; payment hardening (webhook-events table, reconciliation, backpressure) made explicit; refunds/support given a minimal pre-pilot path; testing strategy, analytics instrumentation, and legal compliance added; discovery homepage descoped for pilot.

## Overview

Kiran is a vertical SaaS platform for fitness event organizers in India, starting with single-day paid running events in Coimbatore. This plan breaks implementation into **13 phases** with clear dependency ordering. Each phase produces a usable increment. Phases that can run in parallel are marked.

**Tech Stack:** TanStack Start (React 19) + Fastify v5 + PostgreSQL 17 + Redis + Drizzle ORM + Zod v4 + BullMQ + Razorpay Route
**Architecture:** Modular Monolith (pnpm monorepo with Turborepo v2)
**Hosting:** Railway (V1) + Cloudflare CDN

### Requirements Traceability

| Plan Phase | Requirements Doc Phase | Modules Covered |
|------------|----------------------|-----------------|
| Phase 0 | Req Phase 0 | 0.1 Project Setup, 0.3 Design System (tokens only) |
| Phase 1 | Req Phase 0 | 0.3 Design System (components) |
| Phase 2 | Req Phase 0 | 0.2 Authentication & Identity |
| Phase 2.5 | — (spike) | Payment vendor validation |
| Phase 3 | Req Phase 1 | 1.1 Organizer Signup & Verification |
| Phase 4 | Req Phase 1 | 1.2 Event Creation & Management |
| Phase 5 | Req Phase 2 | 2.1 Event Detail, 2.2 Discovery, 2.3 Organizer Profile |
| Phase 6a–6d | Req Phase 3 | 3.1–3.4 Registration, Payment, Booking, Profile + 6.1 Email infra (confirmation email) |
| Phase 7 | Req Phase 4 | 4.1–4.2 Operations Dashboard |
| Phase 8 | Req Phase 5 | 5.1–5.3 QR Check-in, Manual Search, Offline Roster |
| Phase 9 | Req Phase 6 | 6.1–6.2 Remaining Emails (reminders, post-event) & Retention + Analytics |
| Phase 10 | Req Phase 7 | 7.1–7.3 Refunds, Disputes, Admin Ops |
| Phase 11 | — (hardening) | Pre-Launch Validation |

---

## Phase 0: Foundation & Infrastructure Setup
**Dependencies:** None (this is the root)

### 0.1 — Monorepo & Tooling Setup
- Initialize pnpm monorepo with Turborepo v2 (use `tasks` key, not legacy `pipeline`)
- pnpm `catalog:` protocol for centralized dependency versioning
- Create workspace structure: `apps/web`, `apps/api`, `packages/shared`, `packages/db`, `packages/ui`
- Frontend feature-first module structure: `apps/web/src/features/` with collocated server functions, query options, components, hooks, and types per domain module (events, registration, check-in, etc.) — per architecture §5 and TanStack reference project patterns
- Configure TypeScript (strict mode, path aliases, project references)
- **Pin pre-1.0 dependencies:** Drizzle ORM 0.45.x, TanStack Start 1.154+ (exact version pinning — both are pre-1.0 with breaking-change risk)
- Configure Biome (linting + formatting — single tool replacing ESLint + Prettier)
- Docker Compose for local development (PostgreSQL 17 + Redis + app services)
- Setup environment management (local / staging / production) with `.env` files

### 0.2 — CI/CD Pipeline & DNS
- GitHub Actions: lint (Biome) → type-check → test → build → migrate → deploy
- Branch strategy: auto-deploy to staging from `main`; manual promote to production from staging (or deploy from `release/*` tags) — per architecture §5
- DNS setup: `kiran.app` (frontend) + `api.kiran.app` (backend)
- SPF/DKIM/DMARC records for sending domain (email deliverability prerequisite)
- Axe-core accessibility linting in CI pipeline
- **Resend client setup** (API key, sending domain verified) — needed by Phase 3.5 for verification emails

### 0.3 — Database & Infrastructure
- PostgreSQL 17 on Railway (managed) with automated backups verified
- PgBouncer connection pooling (transaction mode) — **set `prepare: false` in Drizzle config** (prepared statements break under transaction-mode pooling per architecture D-4). Use a **separate direct connection** (bypassing PgBouncer) for migrations. Define pool budgets (max instances × per-instance connections + worker/migration headroom)
- Redis on Railway (sessions, cache, BullMQ, rate limiting)
- Redis namespace isolation: `sess:`, `bull:`, `rl:`, `cache:`, `otp:`
- Drizzle ORM setup with migration tooling (expand/contract pattern)
- Migration playbook: forward/backward migration validation in CI
- Seed script for development data + staging data strategy (anonymized)
- Object storage setup (Cloudflare R2) — bucket layout, server-side encryption keys, presigned-URL pattern, access-logging (R2 chosen: no egress fees, Cloudflare ecosystem alignment)
- Point-in-time recovery (PITR) testing for PostgreSQL backups

### 0.4 — Backend API Shell (Fastify v5)
- Fastify v5 server with TypeScript
- Plugin architecture (auth, CORS, rate-limit, error handling)
- Structured logging with Pino (JSON) + request correlation IDs (`X-Request-ID` header)
- Pino-OpenTelemetry bridge for log↔trace correlation (low-effort, high-value per architecture)
- Railway log drain integration
- Health check endpoint (`/health` + `/ready`)
- API versioning: `/api/v1/` prefix
- CORS config for `kiran.app` ↔ `api.kiran.app`
- Sentry error tracking integration (with source maps upload)
- Request validation middleware (Zod)
- **BullMQ worker service** — separate process for async job processing (webhooks, emails, cleanup jobs, capacity expiry); enable native OpenTelemetry support (BullMQ v5.71+) for distributed tracing
- BullMQ dashboard (Bull Board or similar) for job monitoring

### 0.5 — Frontend App Shell (TanStack Start)
- TanStack Start (pinned version, see 0.1) with Vite
- TanStack Router (file-based, type-safe routing)
- TanStack Query setup (server state management, staleTime 30s)
- **TanStack Query `queryOptions()` factory pattern:** Define query options alongside server functions in feature modules (e.g., `features/events/queries.ts`), import in route loaders for zero-waterfall data loading with cache reuse
- **TanStack Form setup** (v1, type-safe form state management with Zod validation integration)
- **TanStack Table setup** (v8, headless table engine for dashboards and participant lists)
- **TanStack Virtual setup** (v3, virtualization for large participant rosters in organizer dashboard)
- **Hybrid routing pattern:** SSR pages (/, /events/:slug, /organizers/:slug) use server-to-server internal API calls; client app pages (/book/*, /my/*, /org/*, /admin/*) make browser-direct calls to public API — per architecture D-12
- Role-based route guards (public, participant, organizer, admin)
- Error boundaries and loading state patterns
- Sentry frontend error tracking (with source maps)
- Cloudflare CDN configuration (static + SSR caching)

### 0.6 — Shared Package
- Zod v4 validation schemas (shared frontend ↔ backend)
- TypeScript type definitions
- Constants (roles, statuses, enums)
- Utility functions (Indian number formatting, slug generation + uniquification)

### 0.7 — Secret Management & Security Foundation
- Secret store setup (Railway encrypted environment variables at minimum; vault for rotation-sensitive keys)
- HMAC signing key for QR tokens with `kid` (key ID) support for key rotation
- Razorpay webhook secret management
- MSG91 API key management
- KMS/encryption key for KYC document encryption at rest
- Key rotation runbook documented

### 0.8 — Testing Infrastructure
- Test harness setup: Vitest (unit/integration), Playwright (E2E)
- Test database provisioning (isolated per test suite)
- Webhook replay fixtures for Razorpay callback testing
- Factory/fixture strategy for seed data generation
- CI integration: tests run on every PR
- Coverage thresholds configured

**Phase 0 Exit Criteria:**
- Monorepo builds and deploys to staging via CI/CD (Biome lint + type-check pass)
- Turborepo v2 `tasks` config working; pnpm `catalog:` protocol enforced
- Pre-1.0 dependencies pinned: Drizzle 0.45.x, TanStack Start 1.154+
- DB + Redis connected; PgBouncer validated with Drizzle (`prepare: false` confirmed, no prepared-statement failures under pooling); pool budgets defined
- Migrations run via separate direct connection (bypassing PgBouncer)
- BullMQ worker processes jobs (verified with a test job); OpenTelemetry traces visible
- Object storage (Cloudflare R2) presigned upload/download works
- Docker Compose local dev environment runs all services
- Health check passes on staging
- PITR backup restore tested once
- Test suite runs in CI with passing skeleton tests
- Secrets loaded from encrypted config (not committed to repo)
- Resend client verified (sending domain SPF/DKIM/DMARC pass)
- Pino-OTel bridge producing correlated logs+traces

---

## Phase 1: Design System & Core UI Components
**Dependencies:** Phase 0.5 (frontend app shell must exist)
**Can overlap with:** Phase 2 (backend auth work)

### 1.1 — Design Tokens & Theme
- Tailwind CSS v4 configuration (CSS-first)
- OKLch color tokens (primary, accent, neutrals, semantic, category, status)
- Typography setup: Plus Jakarta Sans (headings), Inter (body), JetBrains Mono (mono)
- Fluid type scale (clamp 320px–1440px)
- Spacing scale (4px base, semantic aliases: step/stride/pace/block/section/page)
- Shadow system, border radius scale
- Dark mode ("Pre-Dawn") tokens
- Animation timing system (instant/quick/moderate/celebrate) + easing curves
- CSS custom properties for all tokens

### 1.2 — Foundational Components (shadcn/ui v4 customized)
- Button (all variants: primary, accent, secondary, outline, ghost, destructive, link; all sizes + states including chalk underline hover)
- Input, Textarea, Select, Checkbox, Radio
- Label (always visible, no floating labels V1)
- Form field wrapper (label + input + error + description)
- Badge (status pills, verification badge `🛡 Verified`, category pills with lane-line color)
- Card (base structure with 4px lane-line)
- Dialog/Modal (desktop centered, mobile bottom sheet)
- Toast notification system (bottom-center mobile, bottom-right desktop; duration per severity)
- Loading states (skeleton blocks matching final layout, NProgress top bar, inline spinners)
- Focus ring system (2px ring, 2px offset)

### 1.3 — Layout Components
- Public navigation (glass top nav with scroll-triggered backdrop-blur)
- Dashboard "Cockpit" layout (top bar + tab strip with chalk underline active, no sidebar)
- Admin layout (icon rail sidebar 72px collapsed / 240px expanded)
- Mobile bottom navigation (3 items: Discover, My Events, Profile)
- Responsive grid system (4/8/12 columns per breakpoint, starting at 360px)
- Page container with max-width
- Sticky bottom CTA bar (mobile booking/registration)

### 1.4 — Specialized Form Components (TanStack Form v1)
- All forms built on **TanStack Form (v1)** with Zod validation integration — granular reactive updates, type-safe field inference, async validation with debouncing
- Phone input (+91 permanent prefix, numeric, maxlength=10)
- OTP input (6 cells, 48×48px, auto-advance, pulsing accent border on active)
- File upload (dashed 2px border dropzone, preview + filename + remove)
- Price display (₹ Indian numbering format, tabular figures)

### 1.5 — Data Display Components
- Data table built on **TanStack Table (v8)** — headless engine with sorting, filtering, pagination, column visibility, row selection; styled with shadcn/ui DataTable patterns (sticky header, 1px border-bottom rows, sortable, mobile → stacked cards, numeric right-aligned tabular-nums)
- **TanStack Virtual (v3) integration** for virtualized table rows — required for organizer dashboards displaying 1,000+ participant rosters at 60FPS
- Stat card (label, large tabular number, delta indicator with success/destructive color)
- Empty states (themed messaging: "Quiet at the start line.")
- Error pages (404 "Took a wrong turn", 500 "We tripped", 403 "Off the course")

**Phase 1 Exit Criteria:**
- Component library renders correctly across breakpoints (360px–1440px)
- Dark mode functional
- Accessibility verified: axe-core passes, focus rings visible, touch targets ≥44px, contrast ≥4.5:1
- Visual component catalog (Storybook or equivalent) published as baseline for visual regression
- `prefers-reduced-motion` respected in all animations

---

## Phase 2: Authentication & Identity
**Dependencies:** Phase 0 (full foundation)
**Can overlap with:** Phase 1 (design system)

### 2.1 — OTP Service Integration
- MSG91 integration for SMS OTP delivery (DLT-compliant)
- **WhatsApp OTP fallback:** enable WhatsApp delivery as fallback for SMS delivery failures (per architecture — DLT/SMS deliverability issues are common in India)
- OTP generation, storage in Redis (`otp:` namespace, 5-min TTL)
- Rate limiting: 1 OTP per phone per 60 seconds
- OTP verification endpoint
- Retry/resend logic with cooldown

### 2.2 — Session Management
- Session creation on OTP verification
- Redis session store (`sess:` namespace, 30-day TTL)
- HttpOnly, Secure, SameSite=Lax cookie scoped to `.kiran.app`
- Session validation middleware
- Session refresh/extension logic
- Logout (session destruction)

### 2.3 — Role-Based Access Control (RBAC)
- User roles: `public`, `participant`, `organizer`, `admin`
- Role assignment on first OTP verification (default: participant)
- Organizer role elevation after admin approval
- Admin role with phone OTP + IP allowlist during pilot (per architecture §6; IP allowlist is acceptable for pilot since admin ops are desk-based — reassess for mobile admin usage post-pilot)
- Route-level auth guards (backend middleware)
- Frontend route protection (TanStack Router guards)

### 2.4 — Deferred Authentication Pattern
- Public browsing without any auth wall
- OTP triggered only at booking form submission
- Seamless transition: anonymous → authenticated participant
- Auto-fill saved profile after OTP verification

### 2.5 — CSRF & Security Hardening
- Anti-CSRF tokens (SameSite + token)
- Input validation (Zod on all endpoints)
- CSP headers
- Rate limiting on auth endpoints (`@fastify/rate-limit` + Redis)

**Phase 2 Exit Criteria:**
- User can receive OTP, verify, get session cookie
- Public pages accessible without login
- Auth guards enforce role-based access
- Rate limiting verified: 100 concurrent OTP sends with no session leakage
- Deferred auth flow: anonymous → OTP → authenticated works seamlessly

---

## Phase 2.5: Payment Vendor Spike (Razorpay Route)
**Dependencies:** Phase 0 (API shell, test infra)
**Purpose:** De-risk the highest-risk integration before committing Phase 6

### Spike Objectives
- **Validate Razorpay Route** split payout: create order → pay → auto-split → verify organizer receives settlement
- **Confirm TPS limits** with Razorpay enterprise team (architecture claims ~500 TPS unverified)
- **Test refund-reverse-split:** full refund + partial refund + fee behavior
- **Validate webhook delivery:** signature verification, idempotency, out-of-order handling
- **Test connected-account/beneficiary onboarding flow** for organizers (Route requires linked accounts)
- **Evaluate Cashfree Split** as fallback if Razorpay Route has blocking limitations
- **Document:** API rate limits, settlement timelines, webhook reliability, test-mode behavior

### Spike Deliverables
- Working proof-of-concept: order → pay → split → refund → webhook processing
- Decision document: Razorpay Route confirmed or switch to Cashfree Split
- Webhook replay test fixtures added to test infrastructure
- TPS confirmation from Razorpay enterprise team (written, not assumed)
- **RBI PA-PG legal opinion:** Engage legal counsel to validate Kiran's marketplace split-payout model against the 2025 Master Direction for Payment Aggregators — **this is an existential risk and must be resolved before building organizer payout linking in Phase 3. If the model is non-compliant, the payment architecture must be redesigned before proceeding.**

**Spike Exit Criteria:**
- Payment provider confirmed (Razorpay Route or Cashfree Split)
- Split payout, refund-reverse-split, and webhook idempotency demonstrated in test mode
- TPS limits confirmed in writing from Razorpay enterprise team AND verified that limits support the architecture's 500–1,000 payment/sec target — OR backpressure strategy adjusted to match actual provider limits. If limits cannot be confirmed in writing, conduct a load test at documented TPS to observe actual behavior (throttling vs rejection vs queueing)
- **RBI PA-PG legal validation obtained** (GO/NO-GO decision on split-payout model). This is a launch blocker — do not proceed to Phase 3 organizer payout linking without legal clearance

---

## Phase 3: Organizer Onboarding & Verification
**Dependencies:** Phase 2 (auth must work for organizer signup), Phase 1.3 (admin layout components needed for verification interface)

### 3.1 — Organizer Registration
- Organizer signup form (business name, contact person, phone, email, city)
- Organizer account creation (role: organizer, status: unverified)
- Organizer profile data model + **organizer slug generation** (unique, for `/organizers/:slug` URLs)
- **Razorpay Route connected-account / beneficiary setup** — link organizer's bank account for split settlement (validated in Phase 2.5 spike)

### 3.2 — Verification Document Upload
- Document upload UI (Aadhaar, PAN, GST, bank proof)
- Object storage integration (reusing Phase 0.3 Cloudflare R2 setup)
- Server-side encryption for KYC documents
- Document metadata stored in DB (not the files themselves)
- Upload progress and validation
- Access-controlled: only Kiran ops can retrieve documents, with audit logging

### 3.3 — Policy Acceptance Workflow
- Platform terms and conditions display
- Explicit consent capture (no pre-checked boxes)
- Consent record table in PostgreSQL (`user_id`, consent_type, consent_version, accepted_at, ip_address) — uses `user_id` (not `participant_id`) so it works for both organizer and participant consent. Reused in Phase 6 for booking consent with consent_type differentiation
- Policy acceptance gating (cannot proceed without acceptance)

### 3.4 — Admin Verification Interface (Minimal Admin Shell)
- **Admin layout scaffolding** (icon rail sidebar, admin routes, admin auth guards)
- Verification queue (pending applications list)
- Application detail view (business info + uploaded documents)
- Approve/Reject with reason
- Audit log for document access (who viewed what, when)
- 2-business-day SLA tracking (timestamp-based, visible in queue)
- Verification badge assignment on approval
- **Payout readiness validation:** confirm organizer's Razorpay linked account is active before marking verified

### 3.5 — Verification Status Communication
- Email notification on approval/rejection (using Resend client set up in Phase 0.2, minimal template; full template system comes in Phase 9)
- Status display in organizer dashboard
- Paid-event publishing gated by: verification status AND payout readiness

**Phase 3 Exit Criteria:**
- Organizer can sign up, upload docs, accept policies, and link bank account for payouts
- Admin can review and approve/reject with audit logging
- Verified badge assigned; payout readiness confirmed
- Unverified or payout-unlinked organizers blocked from publishing paid events
- Email notification delivered on approval/rejection

---

## Phase 4: Event Creation & Management
**Dependencies:** Phase 3.1 (organizer must exist; verification required only for publishing — event creation can start while verification is in progress)

### 4.1 — Event Data Model
- Event table (name, slug, date, time, location, description, route info, status)
- **Slug generation and uniquification** (required for `/events/:slug` URLs)
- Event categories/distances (5K, 10K, half-marathon, full-marathon, fun run)
- Pricing per category with early-bird support (tiered pricing array with date cutoffs)
- Registration form schema (JSONB with `form_schema_version`)
- Refund/cancellation policy capture per event
- `spots_remaining` per category (for capacity management)

### 4.2 — Event Creation Form
- Multi-step event creation wizard
- Basic info (name, date, time, location, description)
- **Event image upload** (hero image, route map) — reusing Phase 0.3 object storage, presigned URLs
- Route/course information
- Category and distance configuration
- Pricing configuration (per category, early-bird tiers with date cutoffs)
- Registration form field builder (standard + fitness-specific fields)
- Sensitive field configuration (optional by default, safety-critical override with justification)
- Refund/cancellation policy editor
- Draft save (auto-save to prevent data loss)

### 4.3 — Event Publishing Workflow
- Event status machine: `draft` → `in_review` → `published` / `rejected`
- First 3 paid events from new organizers require manual admin review
- Admin event review queue (extends admin shell from Phase 3.4)
- Publish/reject with reason
- Auto-publish for verified organizers (after first 3 events approved)
- **Publishing gates:** organizer verified AND payout-ready AND (auto-approved OR admin-approved)

### 4.4 — Event Edit & Update
- Pre-event editing capabilities
- Version history awareness (bookings reference schema snapshot)
- Category/pricing changes with impact warnings
- **CDN cache invalidation** on event publish/unpublish, pricing changes, seat-count changes (Cloudflare API purge + single-flight Redis locking to prevent stampede)
- Event cancellation workflow

**Phase 4 Exit Criteria:**
- Organizer can create events with images, categories, pricing, custom fields, and policies
- Slugs are generated and unique
- Events go through draft → review → publish flow with correct gating
- Admin can review and approve first-time organizer events
- CDN invalidation fires on event updates

---

## Phase 5: Event Discovery & Public Pages
**Dependencies:** Phase 4 (events must exist to display them), Phase 1 (design system components)

### 5.1 — Event Detail Page (SSR)
- Server-side rendered for SEO
- Professional layout: hero image (from object storage), title, date/time, location
- Category/pricing breakdown table (early-bird vs regular, slots remaining)
- Route information display (route map image)
- Trust strip: verified organizer badge, refund policy link, payment processor logo, registration count
- Organizer info card with profile link
- Collapsible policies section (progressive disclosure)
- Open Graph meta tags for social sharing
- Structured data markup (JSON-LD for SEO)
- "Register Now" CTA (sticky bottom bar on mobile)
- CDN caching (`s-maxage` + `stale-while-revalidate`) with invalidation from Phase 4.4

### 5.2 — Event Discovery/Listing Surface
- Coimbatore event listing (V1 single city — thin launch-city surface)
- Event cards: name, date, location, price range, categories, verification badge, hero image thumbnail
- Status indicators (upcoming, registration open/closed, sold out)
- Sort by date (default: upcoming first)
- Basic filtering (date, distance/category)
- Responsive grid (1/2/3 columns)

### 5.3 — Organizer Public Profile Page
- Business name, description
- Verification badge with explanation ("verified onboarding check" — NOT safety guarantee)
- Upcoming events list
- Past event history
- SSR for SEO with slug-based URLs (`/organizers/:slug`)

### 5.4 — Discovery Homepage (Minimal for Pilot)
- Simple event listing for Coimbatore (chronological, upcoming first)
- Category filter tabs (Fun Run, 5K, 10K, 21K, 42K)
- Date-based filtering
- **Deferred to post-pilot:** Hero search, curated sections ("This Weekend", "Early Bird Open", "Popular"), horizontal scroll rails

**Phase 5 Exit Criteria:**
- Event pages render with full info including hero images, SEO-optimized (structured data + OG tags)
- Pages socially shareable with rich previews
- Discovery surface lists upcoming events with filtering
- Organizer profiles visible with verification badge
- CDN caching active with invalidation verified

---

## Phase 6a: Booking Engine & Capacity Management
**Dependencies:** Phase 2 (auth/OTP), Phase 4 (events with categories/pricing)
**This is the start of the core value delivery — split into 4 sub-phases for risk management**

### 6a.1 — Booking Data Model
- Booking table (participant, event, category, status, form_data JSONB, schema_snapshot)
- Booking status state machine with row-level locking: `reserved` → `payment_pending` → `confirmed` → `cancelled` / `refunded` / `checked_in`
- **Sensitive participant fields in separate table** (blood group, medical info, emergency contact) — server-side query filtering for organizer access
- Capacity reservation: atomic `UPDATE events SET spots_remaining = spots_remaining - 1 WHERE id = :id AND spots_remaining > 0`
- 15-minute reservation expiry via BullMQ repeatable job (reconcile reservation vs payment outcome to handle races)
- Booking search indexes: composite on `(event_id, status, created_at)`, `(event_id, payment_status, created_at)`, partial indexes for active bookings

### 6a.2 — Registration Flow & Profile Save
- Category selection step
- Dynamic registration form (rendered from event's JSONB schema)
- Standard fields: name, email, phone, age, gender, city
- Fitness fields: blood group, T-shirt size, emergency contact (optional by default)
- OTP verification triggered at form submission (deferred auth from Phase 2.4)
- **Auto-save participant profile on first booking** (name, age, blood group, emergency contact, T-shirt size) — this must be in Phase 6a so returning users get auto-fill
- Auto-fill from saved participant profile for returning users
- Form validation with clear error messaging (Zod, shared schemas)
- Consent capture: data usage + event policies + **separate optional marketing consent** (no pre-checked boxes)
- Capacity check + reservation on form submission

### 6a.3 — Registration Step UI
- 4-step flow: Category → Details → OTP → Payment
- Step indicator (`[●━━━━●━━━━○━━━━○]`)
- Sticky bottom CTA bar with price breakdown
- Mobile-optimized (360px baseline)
- **Payment pending state UI:** clear "processing" state so user knows payment is in flight
- **Booking lookup by phone + event:** if user navigates away, can recover booking status

**Phase 6a Exit Criteria:**
- Registration form renders dynamically from event schema
- Capacity reservation is atomic (verified: concurrent requests don't oversell)
- Expiry job correctly releases reservations and reconciles with any in-flight payments
- Returning users see auto-filled profiles
- Consent captured with separate marketing opt-in

---

## Phase 6b: Payment Integration (Razorpay Route)
**Dependencies:** Phase 6a (booking/reservation must exist), Phase 2.5 (spike validated Razorpay Route)

### 6b.1 — Payment Order & Processing
- Razorpay Route SDK integration (production, building on spike POC)
- Payment order creation linked to booking reservation
- UPI payment option (primary, India-first)
- Card payment option
- Split payout configuration: Kiran fee (pilot fee band: 3–5% on paid registrations) captured at payment time, remainder to organizer's linked account
- Free pilot period: first 3 events per organizer = no platform fee split
- Payment status tracking: `initiated` → `authorized` → `captured` → `failed` → `refunded`
- Payment failure + retry flow
- **Razorpay test-mode wiring for staging environment**

### 6b.2 — Webhook Processing (Hardened)
- Webhook endpoint for Razorpay callbacks
- Webhook signature verification (HMAC SHA256 via `X-Razorpay-Signature`)
- **Webhook-events table:** provider event ID, signature verification result, received timestamp, payload hash, processing status, last error, retry count
- **Fast ACK rule:** respond to Razorpay within 5 seconds, process asynchronously via BullMQ
- **Idempotency:** `razorpay_payment_id` unique constraint + webhook-events dedup by provider event ID
- **Out-of-order webhook handling:** state machine validates transitions, queues out-of-order events for reprocessing
- **Retry + dead-letter queue (DLQ):** failed webhook processing retried 3x with exponential backoff, then moved to DLQ for manual inspection
- **Reconciliation polling job:** BullMQ repeatable job polls Razorpay API periodically to catch lost webhooks (architecture D-23)

### 6b.3 — Backpressure & Burst Protection
- **Registration queue:** Redis-queued booking write path for burst scenarios
- **Backpressure policy:** when Redis queue depth, job age, DB pool wait, or provider error rate crosses thresholds, booking API returns controlled "registration busy, retry shortly" response
- **Waiting-room mode:** graceful degradation for high-demand event drops (20K concurrent scenario)

**Phase 6b Exit Criteria:**
- End-to-end payment: booking → Razorpay order → UPI/card payment → webhook → booking confirmed
- Split payout verified in test mode (Kiran fee + organizer settlement)
- Webhook idempotency: duplicate webhooks don't create duplicate bookings
- Out-of-order webhooks handled correctly
- Reconciliation job catches simulated lost webhooks
- Backpressure: API returns controlled response under simulated load (not uncontrolled failure)
- DLQ populated for simulated failures; manual inspection path works

---

## Phase 6c: Booking Confirmation & Email
**Dependencies:** Phase 6b (payment must complete for confirmation)

### 6c.1 — Booking Confirmation
- Booking record status updated to `confirmed` on successful payment
- QR code generation: HMAC-signed tokens with `ticket_version` and `kid` (key ID for rotation)
- Confirmation page with booking summary (event, category, amount, QR code)
- **Booking recovery:** participant can look up booking by phone + event if they close the browser

### 6c.2 — Email Service Integration (Core)
- Resend integration (primary email provider) — **use Resend batch API (up to 100 emails/request)** for burst booking confirmation sends (default 2 req/s is insufficient for 20K-concurrent drops)
- Amazon SES as **launch-required high-throughput path** for burst scenarios where Resend batch API is insufficient (SES is a hard dependency for burst events, not just a fallback)
- Branded, responsive email template system
- BullMQ job queue for email sending (separate queue from webhook processing)
- Delivery tracking and error handling
- **Booking confirmation email:** event details, QR ticket image, organizer policies, support contact

### 6c.3 — QR Token System
- HMAC-signed token payload: booking ID, event ID, participant ID, category, ticket_version, kid
- Key registry for `kid` management (supports key rotation)
- QR token verification endpoint (server-side, for Phase 8 check-in)
- Re-issue ticket flow (if key rotated or ticket compromised)

**Phase 6c Exit Criteria:**
- Booking confirmation page displays with QR code
- Confirmation email delivered with QR ticket within 60 seconds of payment
- QR token verifies correctly server-side
- Booking lookup by phone + event works
- Email deliverability: not landing in spam (SPF/DKIM/DMARC from Phase 0.2)

---

## Phase 6d: Participant Profile Management & Repeat Booking
**Dependencies:** Phase 6a (profile data saved during registration)
**Can run in parallel with:** Phase 6c, Phase 7, Phase 8, Phase 9
**Note:** Profile *storage* (auto-save on booking) is in Phase 6a.2. This phase covers the *management UI* — view, edit, history, export, deletion.

### 6d.1 — Participant Profile Management UI
- Profile view and edit screen
- Booking history view (past and upcoming)
- Profile data export (`GET /api/v1/my/data-export` — machine-readable, DPDPA)
- Profile data deletion request with confirmation flow
- **Anonymization pipeline:** on deletion, replace PII but preserve financial/booking records

### 6d.2 — Repeat Booking Optimization
- Saved profile auto-fill on subsequent bookings
- One-step repeat booking from booking history
- **Next-event prompt:** after booking, suggest other upcoming events from same organizer

**Phase 6d Exit Criteria:**
- Participant profile saved and editable
- Repeat booking auto-fills all saved fields
- Data export returns complete participant data in JSON
- Deletion request triggers anonymization (PII removed, financial records preserved)
- Booking history accessible

---

## Phase 7: Organizer Operations Dashboard
**Dependencies:** Phase 6b (bookings + payments must exist for dashboard data)
**Can run in parallel with:** Phase 8, Phase 9

### 7.1 — Event Operations View
- Registered/paid/checked-in count summary per event
- Participant list with status filters (all, paid, checked-in, cancelled)
- Individual participant booking detail view
- Revenue view per event (total collected, Kiran fee, net to organizer, payout status)
- Search within participants (name, phone)

### 7.2 — Participant Roster Export
- CSV export of participant list
- PDF/print-friendly roster for event day
- Configurable fields in export
- Sensitive field handling (include only if organizer marked safety-critical)

### 7.3 — Multi-Event Overview
- Organizer home: all events (upcoming + past)
- Event status summary cards (draft, in review, published, completed)
- Quick-access links to event operations
- Event-switcher dropdown in dashboard header

### 7.4 — Dashboard UI (Cockpit Layout)
- Tab strip: Overview, Participants, Revenue, Check-in, Settings
- Stat cards (4-column grid, responsive to stacked on mobile)
- Full-width data table with participant details
- Responsive: stacked on mobile

**Phase 7 Exit Criteria:**
- Organizer can view real-time registrations, payment status, revenue per event
- CSV and PDF roster exports work with correct data
- Multi-event navigation functional
- Dashboard loads within 2 seconds on 3G

---

## Phase 8: Event-Day Operations
**Dependencies:** Phase 6c (QR tokens from bookings)
**Can run in parallel with:** Phase 7, Phase 9

### 8.1 — QR Check-In
- Camera-based QR scanner (mobile browser, no native app)
- HMAC token verification with `kid` lookup (server-side)
- Scan result display: participant name, category, payment status, check-in status
- Check-in confirmation action
- Duplicate scan detection (already checked-in warning, shows original check-in time)
- Sensitive field suppression (blood group, medical info hidden by default — organizer can reveal if safety-critical)
- Success feedback: green flash + checkmark animation + haptic vibration

### 8.2 — Manual Search Fallback
- Search by name or phone number
- Results with booking/payment status
- Manual check-in from search results
- For connectivity issues or QR failures

### 8.3 — Offline Roster
- Downloadable PDF roster (print-friendly format)
- Includes: name, category, payment status, bib number (only if assigned outside Kiran — Kiran does not auto-assign bibs in V1)
- Sensitive fields only if marked safety-critical by organizer
- Delete-after-event instruction included on roster
- Pre-download prompt before event day

### 8.4 — Check-In UI (Outdoor-Optimized)
- High-contrast forced theme variant (white bg, black text for outdoor readability)
- Camera viewport 80% of screen
- QR target frame overlay
- Last scan result display
- Running check-in counter
- Manual entry fallback button
- Min 16px font everywhere, 56×56px touch targets
- Max screen brightness API support

**Phase 8 Exit Criteria:**
- QR check-in works on mobile browsers (Android Chrome, iOS Safari)
- Duplicate scans caught with clear warning
- Manual search fallback operational
- Offline roster downloadable and correct
- UI readable in direct sunlight (high-contrast mode)
- Haptic vibration fires on success (where supported)

---

## Phase 9: Communications & Retention (Extended)
**Dependencies:** Phase 6c (email infra already set up; this phase adds templates + automation)
**Can run in parallel with:** Phase 7, Phase 8

### 9.1 — Transactional Email Templates
- Event reminder email (1–2 days before event) — BullMQ scheduled job
- Booking cancellation/refund confirmation email
- Organizer verification status notification (approved/rejected) — upgrade from Phase 3's basic email

### 9.2 — Post-Event & Retention
- Post-event follow-up email (sent 1 day after event)
- Organizer-provided content: results links, photo links
- Next-event prompt for repeat booking
- Organizer interface to add post-event content (links, message)

### 9.3 — Analytics & Conversion Instrumentation
- **Event funnel tracking:** page view → registration started → OTP verified → payment initiated → booking confirmed
- **Registration completion rate** calculation (paid bookings ÷ started registrations)
- **Repeat participant rate** tracking (participants with 2nd booking)
- **Revenue capture reliability** metric (successful fee capture without manual invoicing)
- **Organizer-facing basic analytics:** registrations over time, conversion funnel per event
- Dashboard widgets for key metrics (integrate into Phase 7 dashboard)
- **Purpose:** Required to prove pilot success metrics from product plan

**Phase 9 Exit Criteria:**
- Event reminders sent automatically 1–2 days before event
- Post-event follow-ups delivered with organizer content
- Repeat-booking nudges included in post-event emails
- Funnel analytics tracking all key conversion steps
- Success metrics from product plan (conversion rate, repeat rate, revenue capture) measurable

---

## Phase 10: Refunds, Disputes & Support (Pre-Pilot Minimum)
**Dependencies:** Phase 6b (payments must exist)
**Note:** This phase was moved earlier in the sequence — a minimal refund/support path is required before pilot launch, not after

### 10.1 — Refund Workflow
- Refund request initiation (by participant or organizer)
- Policy validation (check event's refund policy, display to requester)
- **Full refund processing** via Razorpay (reverse split)
- **Partial refund processing** with clear rules: Kiran fee behavior (refunded proportionally or retained — business decision)
- Handling for already-settled funds (organizer responsibility, Kiran mediation documented)
- Refund status tracking (initiated → processing → completed → failed)
- Refund confirmation email to participant
- **Ledger accounting:** record original payment, refund amount, fee adjustment, net to each party

### 10.2 — Dispute & Support (Minimal)
- **Participant issue reporting:** simple form accessible from booking detail or event page (not a full ticketing system)
- Admin dispute queue with SLA tracking
- 2-business-day first-response SLA (timestamp-based, visible in admin queue)
- Dispute resolution workflow (resolve, escalate, close)
- Organizer notification when dispute filed against their event

### 10.3 — Organizer Suspension
- Suspension workflow for repeated violations
- Suspended organizers: events unpublished, new event creation blocked
- Communication: email notification with reason and appeal process

**Phase 10 Exit Criteria:**
- Full and partial refunds process correctly (verified in test mode)
- Refund ledger correctly records fee adjustments
- Participants can report issues from booking detail page
- Admin can view and respond to disputes within SLA
- Organizer suspension workflow functional

---

## Phase 11: Pre-Launch Hardening & Pilot Readiness
**Dependencies:** Phases 6–10 complete
**This is a validation gate, not a feature-building phase**

### 11.1 — Load Testing
- Burst test scenarios per architecture requirements:
  - Page load (CDN-cached event pages)
  - OTP send/verify (concurrent)
  - Booking submit (concurrent capacity reservation)
  - Payment order creation (Razorpay TPS)
  - Webhook ACK latency (must stay <5s)
  - Redis saturation (session + cache + queue)
  - DB pool exhaustion / deadlock detection
- **Test windows:** 5-min, 15-min, 30-min sustained load
- **Target:** System handles 500–1,000 registration submissions/sec (architecture spec)
- **Provider rate limits validated:** Razorpay TPS, MSG91 OTP TPS — cross-reference Phase 2.5 spike results. If Phase 2.5 used the load-test escape hatch (no written TPS confirmation from Razorpay), this phase MUST re-validate at production scale

### 11.2 — Security Review
- Penetration testing on auth flows (OTP bypass, session hijacking)
- Payment flow security (webhook forgery, replay attacks)
- CSRF validation
- Input validation audit (SQLi, XSS, SSRF)
- Sensitive data exposure review (KYC docs, health fields, payment data)

### 11.3 — Legal & Compliance (Final Audit)
- **RBI PA-PG compliance re-confirmation:** Final audit of production payment flow against the legal opinion obtained in Phase 2.5 (initial GO/NO-GO already cleared)
- DPDPA compliance review: consent flows, data retention automation, deletion/anonymization verified end-to-end
- Terms of service and privacy policy finalized
- Organizer agreement reviewed and signed by pilot organizers

### 11.4 — Data Retention Automation
- BullMQ cron jobs for:
  - Sensitive field cleanup: daily job, removes blood group/medical info 30 days post-event
  - KYC document cleanup: weekly job, removes docs 1 year after account closure
  - Inactive profile cleanup: monthly check for 3-year inactivity
- Anonymization pipeline: replaces PII but preserves financial/booking records
- Audit log retention: 3 years minimum

### 11.5 — Operational Readiness
- **Admin operations panel (enhanced):**
  - Organizer verification queue (from Phase 3, with SLA dashboard)
  - Event review queue (from Phase 4, with status tracking)
  - Payout monitoring (split payout status, exceptions, reconciliation results)
  - Dispute management (from Phase 10, with SLA dashboard)
  - Audit log viewer (verification doc access, sensitive field access, admin actions)
- **Pilot onboarding preparation:**
  - Organizer onboarding checklist/guide
  - Data migration support (help organizers import from Google Forms/Excel if needed)
  - Support runbook for common issues
  - Concierge onboarding workflow for first 5 organizers
- **Monitoring verified:**
  - Sentry alerts configured for critical errors
  - Key metric dashboards operational (booking RPS, payment latency, webhook ACK, queue depth)
  - Uptime monitoring active
  - On-call/escalation process documented
- **Disaster recovery:**
  - Backup restore drill completed
  - Degraded-mode runbook: what happens if Razorpay is down, if Redis is down, if DB is overloaded
  - Feature-flag kill switches for critical paths (booking, payment)

**Phase 11 Exit Criteria (GO/NO-GO for Pilot):**
- Load tests pass at target throughput with zero overselling, zero double-charges
- Security review complete with no critical/high findings open
- RBI PA-PG legal validation obtained
- DPDPA compliance confirmed
- Data retention jobs running on schedule
- Admin panel operational with full visibility
- Support runbook documented
- Monitoring dashboards live
- Backup restore verified
- First 5 organizer accounts created and onboarding checklist complete

---

## Dependency Graph

```
Phase 0: Foundation & Infrastructure
    │
    ├──→ Phase 1: Design System ──────────────────────────────┐
    │    (can overlap with Phase 2)                           │
    │                                                          │ (UI components needed
    ├──→ Phase 2: Auth & Identity                             │  for all UI phases)
    │         │                                                │
    │         ├──→ Phase 2.5: Razorpay Route Spike            │
    │         │                                                │
    │         └──→ Phase 3: Organizer Onboarding ←────────────┘
    │                   │     (needs admin layout from Phase 1.3)
    │                   │
    │                   └──→ Phase 4: Event Creation
    │                             │     (can start while verification is in progress)
    │                             │
    │                             └──→ Phase 5: Event Discovery
    │                                       │
    │                                       └──→ Phase 6a: Booking Engine
    │                                                 │
    │                                                 └──→ Phase 6b: Payment (Razorpay)
    │                                                           │
    │                                                  ┌────────┤
    │                                                  │        │
    │                                          Phase 6d: Profile │
    │                                          (parallel with 6c)│
    │                                                  │        │
    │                                                  │  Phase 6c: Confirmation + Email
    │                                                  │        │
    │                                                  └────────┤
    │                                                           │
    │                                     ┌─────────────────────┤
    │                                     │                     │
    │                              Phase 7: Dashboard    Phase 10: Refunds ─┐
    │                              Phase 8: Event-Day Ops                   │ (PARALLEL)
    │                              Phase 9: Comms + Analytics ──────────────┘
    │                                     │                     │
    │                                     └─────────────────────┤
    │                                                           │
    │                                                    Phase 11: Pre-Launch
    │                                                    Hardening & Pilot Readiness
```

**Critical Path:** Phase 0 → 2 → 2.5 → 3 → 4 → 5 → 6a → 6b → 6c → 10 → 11
**Parallel tracks after Phase 6b:** Phases 6d, 7, 8, 9, 10 can all run simultaneously
**Phase 1** overlaps with Phase 2 (UI vs backend — different concerns)
**Phase 6d** (Profile) can run in parallel with Phase 6c (Confirmation)

---

## Cross-Cutting Concerns (Apply Throughout All Phases)

### Security
- Input validation (Zod) on every endpoint — shared schemas in `packages/shared`
- Parameterized queries (Drizzle ORM) — no raw SQL
- XSS prevention (React default escaping + CSP headers)
- CSRF protection (SameSite cookies + anti-CSRF tokens)
- Rate limiting on sensitive endpoints (`@fastify/rate-limit` + Redis)
- Webhook signature verification (HMAC SHA256)
- Audit logging for sensitive data access (verification docs, health fields, admin actions)
- Secret rotation support (HMAC keys with `kid`, API keys)

### Data Privacy (DPDPA-Aware)
- Data minimization (collect only what's needed per registration)
- Sensitive fields optional by default (organizer must justify safety-critical override)
- Explicit consent (no pre-checked boxes; separate marketing consent)
- Data retention enforced by automated jobs:
  - Participant profiles: 3 years inactivity → cleanup
  - Bookings/payments: 5 years (financial/audit requirement)
  - Sensitive fields: 30 days post-event → deleted
  - KYC docs: 1 year after account closure → deleted
  - Audit logs: 3 years minimum
- Data export: `GET /api/v1/my/data-export` (machine-readable JSON)
- Data deletion: anonymization pipeline (PII removed, financial records preserved)
- **Legal review required:** DPDPA compliance validation before launch

### Performance & Scalability
- Cloudflare CDN for SSR pages and static assets (with invalidation on event updates)
- Redis caching for hot data (event pages, session validation)
- TanStack Query (staleTime 30s) for frontend caching
- PgBouncer connection pooling (transaction mode, validated with Drizzle)
- BullMQ for async processing (emails, webhooks, cleanup, capacity expiry, reconciliation)
- Atomic capacity reservation (prevent overselling)
- Backpressure/waiting-room for burst scenarios
- Lazy loading and code splitting (Vite)
- Save-Data heuristic for low-bandwidth Indian mobile networks

### Testing Strategy
- **Unit tests:** Vitest — business logic, validation schemas, state machine transitions
- **Integration tests:** API endpoint testing with test database
- **E2E tests:** Playwright — critical user flows (registration, payment, check-in)
- **Webhook replay tests:** fixture-based Razorpay webhook simulation
- **Load tests:** burst scenario validation (pre-launch gate)
- **Accessibility tests:** axe-core in CI, manual screen-reader smoke tests
- **Visual regression:** component catalog baseline (Storybook)
- Test coverage thresholds enforced in CI

### Monitoring (From Day One)
- Sentry (frontend + backend error tracking, separate projects, source maps)
- Pino structured logging with request correlation IDs + Railway log drain
- Key metrics tracked:
  - Booking submit RPS / p95 / p99 latency
  - Payment order creation latency
  - Webhook ACK latency (must stay <5s)
  - Queue depth, job age, DLQ count
  - DB pool wait time, deadlocks, slow queries (>100ms)
  - Redis memory, eviction, command latency
  - CDN hit ratio
  - OTP send/verify success rates
  - Email delivery rates
- Uptime monitoring (Better Uptime or Railway built-in)
- Alert configuration for critical thresholds

### Accessibility
- WCAG AA minimum (contrast 4.5:1 body, 3:1 large text); AAA preferred
- Focus management (2px ring with 2px offset, visible on all interactive elements)
- Touch targets (44px min, 48px recommended, 56px outdoor/event-day)
- `prefers-reduced-motion: reduce` respected in all animations
- Semantic HTML, ARIA labels (OTP: `aria-label="6-digit verification code"`)
- Screen reader support for toasts (`role="status"/"alert"`, `aria-live`), stats (`<dl>`)
- Keyboard navigable: all flows completable via keyboard
- Axe-core in CI pipeline

### Mobile-First India Optimization
- 360px baseline (Galaxy A, Redmi Note — most common Indian Android devices)
- UPI as primary payment method (before card)
- Phone OTP as primary identity (no email/password auth)
- Network-aware: skeletons for >200ms fetches, no CLS
- `navigator.connection.saveData` triggers low-DPR images
- Indian number formatting (₹1,49,500)
- `lang="en-IN"`, `dir="ltr"`

---

## V1 Scope Boundaries (Locked)

**IN:** Coimbatore only · single-day paid running events · web-only (mobile-first, no native apps) · email as transactional channel · basic ops dashboard · organizer verification + manual event review · split settlement via Razorpay Route · phone OTP identity · public browsing without login

**OUT:** Native apps · cycling/trekking/multi-day events · results publishing/certificates · participant public profiles · group pricing/team registrations · waitlists/ticket resale · WhatsApp integration · multi-city expansion · GPS tracking/live tracking · race timing chip integration · reviews/ratings · community feed/chat · personalized recommendations · advanced analytics · bib number auto-assignment · white-label · multilingual · gear rental · sponsorship management · hotel/transport booking

---

## Phase Summary

| Phase | Module | Sub-modules | Parallelizable | Risk Level |
|-------|--------|-------------|----------------|------------|
| 0 | Foundation & Infrastructure | 8 | No (root) | Medium (PgBouncer/Drizzle validation) |
| 1 | Design System & Core UI | 5 | Yes (with Phase 2) | Low |
| 2 | Auth & Identity | 5 | Yes (with Phase 1) | Medium (OTP provider integration) |
| 2.5 | Razorpay Route Spike | 1 | Yes (with Phase 1) | **High** (vendor validation) |
| 3 | Organizer Onboarding | 5 | No | Medium (admin shell dependency) |
| 4 | Event Creation | 4 | Partial (can start during Phase 3 verification) | Low |
| 5 | Event Discovery | 4 | No | Low |
| 6a | Booking Engine & Capacity | 3 | No | **High** (capacity race conditions) |
| 6b | Payment Integration | 3 | No | **Critical** (money flow, webhooks) |
| 6c | Confirmation & Email | 3 | No | Medium (email deliverability) |
| 6d | Participant Profile | 2 | Yes (with Phase 6c) | Low |
| 7 | Organizer Dashboard | 4 | Yes (with 8, 9, 10) | Low |
| 8 | Event-Day Operations | 4 | Yes (with 7, 9, 10) | Medium (outdoor QR scanning) |
| 9 | Communications & Analytics | 3 | Yes (with 7, 8, 10) | Low |
| 10 | Refunds & Support | 3 | Yes (with 7, 8, 9) | **High** (partial refund accounting) |
| 11 | Pre-Launch Hardening | 5 | No (validation gate) | **Critical** (legal, load, security) |

**Total: 13 phases (including spike + hardening gate), 62 sub-modules, ~99 features**
**Critical risk phases:** 2.5 (vendor), 6b (payments), 11 (legal/load)
**High risk phases:** 6a (capacity), 10 (refunds)
