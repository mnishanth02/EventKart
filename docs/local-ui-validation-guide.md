---
title: EventKart Local UI Validation Guide
date_created: 2026-04-26
last_updated: 2026-05-01
scope: Phase 0 through Phase 2 completed V1 requirements
---

# EventKart Local UI Validation Guide

Use this guide to validate everything completed from the foundation work through **Phase 2 — Event Discovery & Public Pages**.

## 0. Roadmap coverage snapshot

Based on `docs/v1-implementation-plan.md` as of 2026-05-01:

| Area                                                 | Current status                              | Local UI validation scope                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0 — Foundation, auth, app shell, observability | ✅ Complete                                 | Validate infra, auth/session, role routing, health checks, error/loading shell, CSRF/internal API wiring, and security/header behavior that is visible locally.                                                                                                                                 |
| Module 1.1 — Organizer Signup & Verification         | ✅ Complete, 🟡 organizer emails stubbed    | Validate organizer profile, policy acceptance, document upload, verification tracking, admin verification queue/detail, approval/rejection, badge, Razorpay linked-account readiness. Real email delivery remains log/stubbed locally unless Resend is configured.                              |
| Module 1.2 — Event Creation & Management             | ✅ Complete, 🟡 event review emails stubbed | Validate event create/edit/configure/publish/unpublish, category capacity fields, pricing, registration fields, event policies, event images, and admin first-3-paid event review. Real event-review emails remain log/stubbed locally unless Resend is configured.                             |
| Module 2.1 — Event Detail Page                       | ✅ Complete                                 | Validate SSR public event detail route, mobile layout, organizer card + verification explanation, refund/cancellation policies, category/pricing, Open Graph/canonical metadata, Event + Breadcrumb JSON-LD, Register Now placeholder CTA, spots badge flag behavior, and early-bird countdown. |
| Module 2.2 — Event Discovery Surface                 | ✅ Complete                                 | Validate launch-city discovery on `/`, public event cards, status indicators, sorting, pagination/search params, empty states, and public-only filtering.                                                                                                                                       |
| Module 2.3 — Organizer Public Profile                | ✅ Complete                                 | Validate `/organizers/:slug`, verified badge/explainer copy, upcoming and past event sections, event-detail organizer links, noindex behavior for unverified profiles, organizer slug redirects, and the internal next-event lookup API.                                                        |
| Module 2.4 — CDN & Cache Infrastructure              | ✅ Complete                                 | Validate public cache headers, no cookie-varying cache output, Cloudflare purge no-op/optional real purge, cache-stampede-backed public loaders, sitemap generation, robots.txt directives, slug 301 redirects, canonical/alternate tags, and Breadcrumb JSON-LD.                               |
| Module 2.5 — Public Chrome & Legal Pages             | ✅ Complete                                 | Validate `/privacy`, `/terms`, `/about`, `/faq`, `/contact`, public footer links, legal-page metadata, cache headers, and contact phone fallback behavior.                                                                                                                                      |
| Phases 3–7                                           | Not started or not locally validated here   | Booking/payment, participant profile, organizer operations dashboard, event-day operations, refunds/disputes, full admin ops, public dispute form, and DSAR/deletion flows are outside this guide unless noted as placeholders.                                                                 |

Practical completion snapshot: the manually validated UI surface now covers all completed Phase 0, Phase 1, and Phase 2 workflows. Booking/payment flows are intentionally out of scope until Phase 3, except for the Phase 2 registration placeholder route and CTA state handling.

All commands below use **Bash syntax**. On Windows, run them from Git Bash, WSL, or the VS Code Bash terminal from the repo root.

```bash
cd /c/Users/v-mnmurugan/projects/eventKart
```

## 1. Required local services

You need these installed/running locally:

- Docker Desktop
- Node.js `>=22.12.0`
- pnpm
- PostgreSQL and Redis from this repo's `docker-compose.yml`

Start local infrastructure:

```bash
pnpm docker:up
```

Check containers if needed:

```bash
docker compose ps
```

Reset local infrastructure only if you intentionally want to delete local DB/Redis data:

```bash
pnpm docker:reset
pnpm docker:up
```

## 2. Environment variables

Local env files are package-local:

- API: `apps/api/.env`
- Web: `apps/web/.env.local`

Do not create a root `.env` file.

### API env — `apps/api/.env`

Minimum local values:

```env
NODE_ENV=development
HOST=0.0.0.0
PORT=3001
LOG_LEVEL=info
WEB_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://eventkart:eventkart_dev@localhost:5432/eventkart_dev
REDIS_URL=redis://localhost:6379
OTP_DELIVERY_MODE=log
EMAIL_FROM=EventKart <noreply@eventkart.app>
INTERNAL_API_KEY=replace-with-the-same-local-secret-as-web
PUBLIC_SPOTS_REMAINING_BADGE_ENABLED=false
CLOUDFLARE_PURGE_ENABLED=false
```

Important notes:

- Keep `OTP_DELIVERY_MODE=log` for local validation. OTP codes will appear in the API terminal logs.
- Leave `COOKIE_DOMAIN` unset locally. Do not use `.eventkart.app` on localhost.
- `INTERNAL_API_KEY` should be set locally and must match the web env value. This lets web server functions call the API as internal requests and avoids CSRF failures on organizer/admin mutations.
- Keep `PUBLIC_SPOTS_REMAINING_BADGE_ENABLED=false` unless you intentionally test the Phase 2 spots badge with controlled capacity data. It must match the web flag.
- Keep `CLOUDFLARE_PURGE_ENABLED=false` for normal local validation. Real Cloudflare purge testing requires the full Cloudflare env in section 3.

### Web env — `apps/web/.env.local`

Minimum local values:

```env
VITE_APP_TITLE=eventKart
VITE_API_URL=http://localhost:3001
VITE_POSTHOG_KEY=
VITE_POSTHOG_HOST=https://us.i.posthog.com
INTERNAL_API_URL=http://localhost:3001
SERVER_URL=http://localhost:3000
INTERNAL_API_KEY=replace-with-the-same-local-secret-as-api
VITE_SITE_URL=http://localhost:3000
VITE_PUBLIC_SPOTS_REMAINING_BADGE_ENABLED=false
VITE_PUBLIC_SUPPORT_PHONE=
```

Important notes:

- `VITE_API_URL` is used by browser-side API calls.
- `INTERNAL_API_URL` is used by TanStack Start server functions.
- `INTERNAL_API_KEY` must match `apps/api/.env`.
- `VITE_SITE_URL` is used for canonical and Open Graph URL validation on public event pages. Keep it as `http://localhost:3000` locally.
- `VITE_PUBLIC_SPOTS_REMAINING_BADGE_ENABLED` must match the API flag. Leave both flags `false` unless specifically validating the gated spots-remaining badge.
- `VITE_PUBLIC_SUPPORT_PHONE` is optional. Leave it blank to validate the `/contact` email-only fallback; set it to a support number to validate the phone affordance.

## 3. Optional third-party accounts

Basic local validation does not require third-party accounts. For full validation, use the table below.

| Account                 | Required for local validation? | Needed for                                                                                      |
| ----------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------- |
| Cloudflare R2 or AWS S3 | Yes, for full upload flows     | Organizer document upload, admin document view URLs, event hero image, and route map upload     |
| MSG91                   | No                             | Real SMS/WhatsApp OTP delivery instead of log mode                                              |
| Resend                  | No                             | Real email delivery. Current organizer/event emails are log-only stubs until Phase 3            |
| Razorpay                | Optional                       | Linked-account creation, KYC/payment readiness validation, and paid-event publish readiness     |
| Cloudflare              | Optional                       | Real CDN cache purge validation. Local cache headers, sitemap, and robots checks do not need it |
| Sentry                  | No                             | Error tracking validation                                                                       |
| PostHog                 | No                             | Product analytics validation                                                                    |

### Object storage env for document and event image upload

To validate organizer document upload and event image upload from the UI, configure S3-compatible storage in `apps/api/.env`:

```env
S3_ENDPOINT=https://your-storage-endpoint
S3_REGION=auto
S3_ACCESS_KEY_ID=replace-me
S3_SECRET_ACCESS_KEY=replace-me
S3_BUCKET=eventkart-dev
S3_FORCE_PATH_STYLE=true
```

For Cloudflare R2, configure bucket CORS to allow local browser uploads:

- Origin: `http://localhost:3000`
- Methods: `POST`, `GET`, `HEAD`
- Allowed headers: `Content-Type`, `x-amz-server-side-encryption`, and any presigned form headers/fields required by your provider
- Exposed headers: `ETag`

Uploads use presigned POST form submissions from the browser. Without these storage variables, organizer document upload, admin document viewing, and event image upload are expected to be unavailable.

### MSG91 env for real OTP delivery

Only use this if you want real OTP messages instead of terminal log mode:

```env
OTP_DELIVERY_MODE=msg91
MSG91_AUTH_KEY=replace-me
MSG91_OTP_TEMPLATE_ID=replace-me
```

### Resend env for real email delivery

```env
RESEND_API_KEY=replace-me
EMAIL_FROM=EventKart <noreply@yourdomain.com>
```

### Razorpay env for linked-account validation

```env
RAZORPAY_KEY_ID=rzp_test_replace-me
RAZORPAY_KEY_SECRET=replace-me
```

Note: Admin approval enqueues Razorpay linked-account creation. Before considering Razorpay sync or paid-event publishing fully validated, confirm the Razorpay account worker is running locally.

### Cloudflare env for real CDN purge validation

Normal local validation should keep purge disabled. Only configure this if you intentionally want the API to call Cloudflare:

```env
CLOUDFLARE_PURGE_ENABLED=true
CLOUDFLARE_ZONE_ID=replace-me
CLOUDFLARE_API_TOKEN=replace-me
CDN_BASE_URL=https://eventkart.in
```

When purge is enabled, all four values are required. Never commit a real Cloudflare token.

## 4. Install dependencies

If dependencies are not installed:

```bash
pnpm install
```

## 5. Migrate and seed the database

The DB package requires `DATABASE_URL` in the shell environment when running Drizzle commands. The DB package does not automatically load `apps/api/.env`.

Run migrations:

```bash
export DATABASE_URL="postgresql://eventkart:eventkart_dev@localhost:5432/eventkart_dev"
pnpm --filter @repo/db db:migrate
```

Seed development users:

```bash
export DATABASE_URL="postgresql://eventkart:eventkart_dev@localhost:5432/eventkart_dev"
pnpm --filter @repo/db db:seed
```

Seeded login users:

| Role        | Phone to enter in UI | Stored phone    |
| ----------- | -------------------: | --------------- |
| Admin       |         `9999900001` | `+919999900001` |
| Organizer   |         `9999900002` | `+919999900002` |
| Participant |         `9999900003` | `+919999900003` |

In the UI, enter only the 10-digit number. The UI prepends `+91` automatically.

## 6. Start the apps

Use separate terminals.

Terminal 1 — local infrastructure:

```bash
pnpm docker:up
```

Terminal 2 — API:

```bash
pnpm --filter api dev
```

Terminal 3 — web:

```bash
pnpm --filter web dev
```

Optional Terminal 4 — workers:

```bash
pnpm --filter api start:worker
```

Workers are needed for async flows such as Razorpay linked-account creation and future email processing. Current organizer/event transactional emails are log-only stubs, so real email delivery is not expected yet.

Open the app:

```text
http://localhost:3000
```

Check health endpoints:

```text
http://localhost:3001/health
http://localhost:3001/ready
http://localhost:3000/health
http://localhost:3000/ready
```

## 7. UI validation checklist

### 7.1 Public app shell

Validate:

- Home page loads at `/`.
- Header, footer, and mobile bottom navigation render correctly.
- Footer links for `/privacy`, `/terms`, `/about`, `/faq`, and `/contact` render and navigate.
- Theme toggle works.
- Unknown routes show the 404 UI.
- Protected routes redirect unauthenticated users.
- Public event detail pages load at `/events/:slug` only when a published event exists.
- Public organizer profiles load at `/organizers/:slug` only when a public organizer exists.

Try these routes while logged out:

```text
/org
/admin
/my
```

Expected result:

- User is redirected to `/`.
- A toast/message indicates authentication is required or access is forbidden.

### 7.2 OTP login and session

Use the seeded users.

Organizer login:

```text
9999900002
```

Steps:

1. Open a protected route like `/org`.
2. Enter the phone number.
3. Click send OTP.
4. Read the OTP from the API terminal logs.
5. Enter the OTP in the UI.
6. Confirm that the session is created.
7. Refresh the page and confirm the user stays logged in.
8. Logout and confirm the session is cleared.

Role routing checks:

| Phone        | Expected access                                              |
| ------------ | ------------------------------------------------------------ |
| `9999900001` | Can access `/admin`                                          |
| `9999900002` | Can access `/org`                                            |
| `9999900003` | Can access `/my`; should be blocked from `/org` and `/admin` |

### 7.3 Organizer registration and profile management

Login as organizer:

```text
9999900002
```

Go to:

```text
/org
```

If no organizer profile exists:

1. Click **Create Organizer Profile**.
2. Fill the organizer registration form.
3. Submit the form.

Validate:

- Required field validation works.
- Email and phone validation works.
- Profile creation succeeds.
- `/org/profile` loads existing data.
- Editing profile persists after refresh.
- Only changed fields are submitted where applicable.

### 7.4 Policy acceptance

Go to:

```text
/org/policies
```

Validate:

- Required policy checkboxes are not pre-checked.
- Required policies must be selected before successful submission.
- Optional/marketing consent is separate if displayed.
- Submission succeeds.
- Returning to `/org` no longer blocks the dashboard because of policy status.
- Refresh keeps policy acceptance state.

### 7.5 Verification status tracking

Go to:

```text
/org/verification
```

Validate:

- Initial status is usually `pending_documents`.
- Document checklist is visible.
- Policy acceptance status is reflected.
- Progress updates as documents are uploaded.
- SLA/review information appears when status becomes `pending_review`.

### 7.6 Verification document upload

This requires S3/R2 environment variables.

Go to:

```text
/org/verification
```

Upload the required document types:

- Aadhaar
- PAN
- GST certificate
- Bank proof

Validate:

- PDF, JPEG, and PNG files are accepted.
- Invalid types or oversized files are rejected.
- The UI requests a presigned upload URL.
- The browser uploads directly to object storage.
- Confirming upload marks the document as uploaded.
- The checklist count increments.
- Deleting/replacing documents updates status.
- After all required documents and required policies are complete, organizer status becomes `pending_review`.

Expected result without storage env vars:

- Document upload is unavailable. This is expected, not a UI bug.

### 7.7 Admin verification queue

Login as admin:

```text
9999900001
```

Go to:

```text
/admin/verifications
```

Validate:

- Verification queue loads.
- Pagination UI loads.
- Status filtering works.
- Organizers in `pending_review` appear.
- Detail page opens for each organizer.

### 7.8 Admin verification detail

From the admin queue, open an organizer detail page.

Validate:

- Organizer business information is displayed.
- Document list is displayed.
- Policy status is displayed.
- SLA/review metadata is displayed.
- Document view URL works when storage is configured.
- Without storage env vars, document viewing shows the expected unavailable state/error.

### 7.9 Admin approve/reject

For an organizer in `pending_review`, validate both paths.

Approve path:

1. Click approve.
2. Add optional notes if the UI shows a notes field.
3. Submit.
4. Confirm organizer status becomes `approved`.
5. Confirm verification badge appears where available.
6. Confirm Razorpay account status starts as `not_started` if Razorpay is not fully processed.

Reject path:

1. Use another organizer or reset local DB.
2. Click reject.
3. Confirm rejection reason is required.
4. Submit.
5. Confirm organizer status becomes `rejected`.
6. Confirm rejection reason appears on the organizer verification page.

### 7.10 Razorpay linked-account sync

Only validate this if Razorpay test credentials are configured and worker wiring is confirmed.

Expected flow:

1. Admin approves organizer.
2. API enqueues Razorpay linked-account creation.
3. Worker processes the job.
4. Organizer `razorpayAccountStatus` transitions from `not_started` to one of `pending`, `active`, `needs_action`, or `failed`.
5. Admin retry works for retryable statuses.

### 7.11 Organizer event creation

Login as an approved organizer whose Razorpay account status is ready for paid-event publishing when you want to validate the full publish path. Without Razorpay readiness, validate draft creation/configuration and the expected publish-readiness errors.

Go to:

```text
/org/events/new
```

Validate:

- Event creation form loads.
- Required field validation works.
- V1 constraints are enforced: single-day, paid, running event, launch-city scope.
- Successful submit creates a draft event.
- The UI navigates to the event edit/configuration flow.
- The generated slug is URL-safe and stable after refresh.

### 7.12 Event edit and configuration

Use the draft event created in the previous step.

Validate these routes:

```text
/org/events/{eventId}/edit
/org/events/{eventId}/configure-categories
/org/events/{eventId}/configure-pricing
/org/events/{eventId}/configure-registration-fields
/org/events/{eventId}/configure-policies
/org/events/{eventId}/configure-images
```

Validate:

- Edit form loads existing event data.
- Updating basic draft fields persists after refresh.
- Category defaults such as 5K, 10K, and half-marathon are available.
- Category capacity fields save and reload.
- Pricing saves per category.
- Early-bird price and deadline validation works when configured.
- Registration form fields save and reload, including standard and fitness-specific fields.
- Refund and cancellation policies save and appear in publish readiness.
- Image upload accepts valid hero/route-map files when storage is configured.
- Image upload rejects invalid types or oversized files.
- Without storage env vars, image upload shows the expected unavailable/error state.

### 7.13 Event publish readiness and publish flow

From the event edit page, validate:

- Publish checklist shows missing requirements before the event is complete.
- Completing categories, pricing, registration fields, policies, and images updates readiness.
- Organizer verification and Razorpay readiness gates are enforced server-side.
- Publish action succeeds only when all required gates pass.
- For a new organizer's first paid events, publish sends the event to admin review instead of immediately publishing.
- The UI clearly communicates the submitted-for-review state.

Expected result without Razorpay readiness:

- Paid-event publish is blocked with a clear readiness/gating message. This is expected, not a UI bug.

### 7.14 Admin event review queue

Login as admin:

```text
9999900001
```

Go to:

```text
/admin/event-reviews
```

Validate:

- Event review queue loads.
- Status filtering and pagination load correctly if enough records exist.
- Submitted events from first-paid-event review appear.
- Detail page opens for each event.
- Event details include organizer, category, pricing, policy, and publish-readiness context.

### 7.15 Admin event approve/reject

From the admin event review detail page, validate both paths.

Approve path:

1. Click approve.
2. Add optional notes if the UI shows a notes field.
3. Submit.
4. Confirm event status becomes `published`.
5. Confirm the event can load publicly at `/events/{slug}`.

Reject path:

1. Use another submitted event or reset local DB.
2. Click reject.
3. Confirm rejection reason is required.
4. Submit.
5. Confirm event status becomes rejected or returns to an organizer-actionable state.
6. Confirm the organizer-facing edit page shows the rejection/review state clearly.

### 7.16 Published event edit and unpublish behavior

Use a published event.

Validate:

- Low-risk published edits are accepted and persist.
- High-risk published edits are blocked with a clear “requires unpublish” message.
- Mixed payloads that include high-risk fields are rejected atomically.
- Refund and cancellation policy edits remain allowed for published events.
- Unpublish action moves the event out of public visibility.
- After unpublish, `/events/{slug}` no longer renders as a publicly available event.

### 7.17 Public event detail page

This requires at least one published event.

Go to:

```text
/events/{slug}
```

Validate:

- Page renders server-side without requiring login.
- Response is cacheable for public traffic and does not vary by cookie.
- Public-cache responses do not emit session-creation `Set-Cookie` headers.
- Mobile layout is readable and usable.
- Hero image and route map render when storage is configured.
- Event timing, location, category, and pricing information render.
- Organizer card renders with business name, city, description when present, verification badge, and a working link to `/organizers/{slug}`.
- Verified organizer explanation opens from the event organizer card and uses the approved copy: verification is an onboarding and policy check, not a quality/safety guarantee.
- Refund and cancellation policies render before booking, with anchors for `#policies`, `#refund-policy`, and `#cancellation-policy`.
- Missing refund/cancellation policy data shows explicit fallback copy instead of hiding the section.
- Category/pricing breakdown shows base and early-bird pricing correctly.
- Active/expired early-bird labels are client-only and do not make cached SSR HTML stale.
- Early-bird countdown appears when an eligible early-bird tier is active, rolls to the next eligible tier, and hides when the offer/window expires.
- Register CTA appears in the sidebar and mobile sticky bar.
- Register CTA links to `/events/{slug}/register` when registration is open.
- Register CTA is disabled and out of tab order when registration is not yet open, closed, or the event has ended.
- `/events/{slug}/register` renders the Phase 3 placeholder and is marked `noindex,nofollow`.
- Page title, meta description, canonical URL, alternate language links, Open Graph, and Twitter text metadata are present when `VITE_SITE_URL` is configured.
- Event JSON-LD and Breadcrumb JSON-LD scripts are present and valid JSON.
- Text-only OG behavior is expected; `og:image` is intentionally deferred until a stable image-serving route exists.
- Draft, under-review, rejected, cancelled, or unpublished events do not render as public event pages.

Spots-remaining badge validation:

1. Keep `PUBLIC_SPOTS_REMAINING_BADGE_ENABLED=false` and `VITE_PUBLIC_SPOTS_REMAINING_BADGE_ENABLED=false`; confirm no spots badge is rendered.
2. Set both flags to `true`, restart API and web, and use controlled category capacity data.
3. Confirm `Sold out` appears only when `spotsRemaining` is `0`.
4. Confirm low-stock copy appears only when spots are within the low-availability threshold.
5. Confirm the badge hides for closed registration windows and ended events.

Slug redirect validation:

- Open an old event slug after renaming a draft/published event slug where a redirect exists.
- Confirm the old slug returns a 301 to the current slug.
- Confirm redirect loops, private targets, and missing target rows do not produce a public success page.

### 7.18 Event discovery listing

Go to:

```text
/
```

Validate:

- Launch-city event listing loads without login.
- Only public upcoming events appear by default.
- Draft, under-review, rejected, cancelled, unpublished, and past events do not appear in the default discovery list.
- Event cards show event name, date, location, category summary, price range, and status.
- Card links navigate to `/events/{slug}`.
- Status indicators show the correct state: upcoming, registration open, registration closed, or sold out.
- Status and time-derived labels are client-only and do not cause hydration mismatch after refresh.
- Sort control changes between upcoming-first and latest/date-desc behavior.
- Sort and page are represented in URL search params.
- Changing sort resets the list to page 1.
- Pagination works when enough events exist.
- Out-of-range page deep links redirect or normalize to a valid page.
- Empty state is clear when no public events match.

### 7.19 Organizer public profile

This requires an organizer with a slug and at least one public event for the full event-list validation.

Go to:

```text
/organizers/{slug}
```

Validate:

- Profile renders server-side without requiring login.
- Response is cacheable for public traffic and does not vary by cookie.
- Business name, city, and description render correctly.
- Description preserves intentional line breaks and does not render HTML markup as HTML.
- Verification badge appears for verified organizers.
- Verification explanation appears only for verified organizers and uses the approved copy.
- Unverified organizer profiles include `noindex,nofollow` metadata.
- Event-detail organizer links navigate to this public profile route.
- Upcoming events section lists the organizer's upcoming public events.
- Past events section lists completed/past public events with the most recent first.
- Upcoming and past sections have clear empty states.
- Unknown organizer slug shows the 404 UI.
- Old organizer slug redirects to the current slug when a valid redirect exists.
- Redirect loops or redirects to missing/currently mismatched organizers do not produce a public success page.

Internal next-event API validation:

```text
GET http://localhost:3001/api/v1/organizers/{organizerId}/next-event
```

Validate:

- Request without `x-internal-key` returns unauthorized.
- Request with the matching local `x-internal-key` succeeds.
- Existing organizer with an upcoming public event returns the next event card projection.
- Existing organizer without upcoming public events returns `data: null`.
- Unknown organizer ID returns not found.

### 7.20 Public SEO, cache, sitemap, and robots

Validate public cache headers:

- `/events/{slug}` uses public `s-maxage=60, stale-while-revalidate=300` style caching.
- `/organizers/{slug}` uses the same public cache contract.
- `/privacy`, `/terms`, `/about`, `/faq`, and `/contact` are SSR and CDN-cacheable.
- Authenticated/private routes are not publicly cacheable.
- Stale-session deletion cookies are still preserved when the API needs to clear an invalid session.

Validate sitemap:

```text
http://localhost:3001/api/v1/sitemap.xml
```

- Response is XML with the sitemap content type.
- Published future events are included.
- Draft, private, cancelled, and past events are excluded.
- Organizer profile URLs appear only for publicly visible/approved organizers.
- Sitemap still renders locally when `CDN_BASE_URL` is not configured, using the fallback host behavior.
- Publishing, unpublishing, or approving public content enqueues sitemap regeneration when workers/queues are running.

Validate robots:

```text
http://localhost:3000/robots.txt
```

- `Sitemap: https://eventkart.in/sitemap.xml` is present.
- Public pages and public event/organizer URL spaces are allowed.
- Auth-only namespaces are disallowed with both bare-route and slash-prefix coverage.
- Bare auth routes such as `/org` and `/admin` are blocked separately from public prefixes such as `/organizers/`.

Validate CDN purge behavior:

- With `CLOUDFLARE_PURGE_ENABLED=false`, publish/unpublish and admin moderation flows succeed without calling Cloudflare.
- If Cloudflare env is configured and purge is enabled, publish/unpublish/admin moderation purges event, organizer, and sitemap URLs without logging the API token.
- Cloudflare purge failures are surfaced through queue retries/logs and do not roll back the core event or organizer mutation.

Validate canonical and structured metadata:

- Event pages include canonical and alternate language links.
- Organizer profile pages include canonical and alternate language links.
- Event pages include both Event JSON-LD and Breadcrumb JSON-LD.
- JSON-LD remains valid if event title, venue, description, or organizer text contains special characters.

### 7.21 Public chrome and legal pages

Validate these routes:

```text
/privacy
/terms
/about
/faq
/contact
```

Validate:

- Each route renders without login.
- Each route is SSR and cacheable for public traffic.
- Page title, description, canonical, Open Graph, and Twitter text metadata are present when `VITE_SITE_URL` is configured.
- Public footer links navigate to all five pages.
- `/privacy` lists data categories, retention windows, and contact path for data requests.
- `/terms` aligns with platform terms, consent versioning, and refund/cancellation framework.
- `/about` presents the Coimbatore pilot positioning and mission/founder content.
- `/faq` covers participant-facing questions for booking, past bookings, refunds, and event day expectations.
- `/contact` shows support email.
- `/contact` hides phone UI when `VITE_PUBLIC_SUPPORT_PHONE` is blank.
- `/contact` shows the phone affordance when `VITE_PUBLIC_SUPPORT_PHONE` is configured.
- Public dispute form is not expected yet; it belongs to Phase 7.

## 8. Automated checks

Run these before or after manual UI validation.

Full checks:

```bash
pnpm lint
pnpm test
pnpm check-types
```

Targeted checks:

```bash
pnpm --filter api test
pnpm --filter web test
pnpm --filter @repo/db test
```

Focused API suites:

```bash
pnpm --filter api exec vitest run test/modules/auth
pnpm --filter api exec vitest run test/modules/organizer
pnpm --filter api exec vitest run test/modules/admin
pnpm --filter api exec vitest run test/modules/events
pnpm --filter api exec vitest run test/modules/organizer/public-profile.test.ts
pnpm --filter api exec vitest run test/modules/organizer/next-event.test.ts
pnpm --filter api exec vitest run test/modules/sitemap
pnpm --filter api exec vitest run test/lib/cache-stampede.test.ts
pnpm --filter api exec vitest run test/lib/cdn-invalidation.test.ts
pnpm --filter api exec vitest run test/modules/payment/razorpay-account.test.ts
pnpm --filter api exec vitest run test/plugins
pnpm --filter api exec vitest run test/routes
```

Focused web suite:

```bash
pnpm --filter web test
pnpm --filter web test -- src/features/events
pnpm --filter web test -- src/features/event-detail
pnpm --filter web test -- src/features/events-discovery
pnpm --filter web test -- src/features/organizer-detail
pnpm --filter web test -- src/features/legal-pages
pnpm --filter web test -- src/routes/_public
pnpm --filter web test -- src/lib/robots.test.ts
```

Database validation checks:

```bash
pnpm --filter @repo/db db:check:lock-risk
pnpm --filter @repo/db db:check:rollbacks
```

## 9. Troubleshooting

### Migration command fails with `DATABASE_URL is required`

Run the migration from a Bash shell with `DATABASE_URL` exported in the same terminal:

```bash
export DATABASE_URL="postgresql://eventkart:eventkart_dev@localhost:5432/eventkart_dev"
pnpm --filter @repo/db db:migrate
```

### OTP verify fails with invalid origin

Check API env:

```env
WEB_ORIGIN=http://localhost:3000
```

Then restart the API server.

### Organizer/admin form submission fails with CSRF error

Ensure both env files have the same internal key:

```env
INTERNAL_API_KEY=replace-with-the-same-local-secret
```

Restart both API and web servers after changing env files.

### Document upload is unavailable

Configure S3/R2 env vars in `apps/api/.env`, restart the API, and confirm the bucket CORS allows `http://localhost:3000`.

### Event image upload is unavailable

Use the same S3/R2 env vars as organizer document upload, restart the API, and confirm bucket CORS allows browser `POST` uploads from `http://localhost:3000`.

### Paid-event publishing is blocked

Confirm the organizer is approved and Razorpay linked-account status is ready. If Razorpay credentials/workers are not configured locally, validate the draft configuration flow and the expected publish-readiness error instead.

### Public event detail returns not found or redirects

Confirm the event is actually `published`. Draft, rejected, unpublished, or under-review events must not render publicly. If you changed the event slug, validate that old slugs redirect to the current slug where redirect handling is implemented.

### Public event detail does not show spots remaining

Confirm both flags match and are enabled:

```env
PUBLIC_SPOTS_REMAINING_BADGE_ENABLED=true
VITE_PUBLIC_SPOTS_REMAINING_BADGE_ENABLED=true
```

Restart both API and web after changing the flags. If either flag is false, the badge is intentionally hidden.

### Register CTA is disabled

Check the event's registration open/close times and end time. The CTA is disabled when registration is not yet open, registration is closed, or the event has ended. The Phase 3 booking flow is not implemented yet; the open-state target is a placeholder route.

### Discovery listing is empty

Confirm at least one event is `published`, has `endAt` in the future, and belongs to the launch-city scope. Past events are intentionally shown on organizer profiles, not the default upcoming discovery list.

### Organizer profile returns not found or noindex

Confirm the organizer has a slug and public profile data. Unverified organizer profiles may render with `noindex,nofollow`; missing or stale slugs should 404 or redirect only when a verified redirect target exists.

### Sitemap looks stale

Start the worker if you want to validate async regeneration:

```bash
pnpm --filter api start:worker
```

Without workers, the sitemap route can still render from the API, but publish/unpublish-triggered regeneration may not run.

### Cloudflare purge does not run

By default, local purge is disabled. Set `CLOUDFLARE_PURGE_ENABLED=true` only when `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_API_TOKEN`, and `CDN_BASE_URL` are also configured.

### Contact page does not show a phone number

This is expected when `VITE_PUBLIC_SUPPORT_PHONE` is blank. Set it in `apps/web/.env.local` and restart web to validate the phone affordance.

### Role access looks wrong after login

Use seeded phones and log in again:

```text
Admin: 9999900001
Organizer: 9999900002
Participant: 9999900003
```

If data is stale, reset and reseed local DB:

```bash
pnpm docker:reset
pnpm docker:up
export DATABASE_URL="postgresql://eventkart:eventkart_dev@localhost:5432/eventkart_dev"
pnpm --filter @repo/db db:migrate
pnpm --filter @repo/db db:seed
```

## 10. Minimum pass criteria before Phase 3 booking work

Before starting Phase 3 booking/payment work, confirm:

- Auth and logout work from UI.
- Role redirects work for participant, organizer, and admin.
- Organizer can create and update profile.
- Organizer can accept required policies.
- Verification status page reflects policy/document progress.
- With storage configured, organizer can upload all required documents.
- Completed organizer verification reaches `pending_review`.
- Admin can view queue and detail pages.
- Admin can approve or reject pending organizers.
- Verification badge appears after organizer approval.
- Razorpay readiness is validated, or the local limitation is explicitly noted.
- Organizer can create a draft event.
- Organizer can configure categories, pricing, registration fields, refund/cancellation policies, and images.
- Publish readiness accurately reflects missing event requirements.
- First-paid-event admin review flow works when publish gates are satisfied.
- Admin can approve or reject submitted events.
- Published events render at `/events/{slug}`.
- Public event detail page shows organizer info, verification explainer, policies, category/pricing breakdown, Register CTA state, early-bird countdown, JSON-LD, canonical/alternate links, and text metadata.
- Spots-remaining badge behavior is explicitly validated with both the default-off flag state and an enabled controlled-data state, or the default-off limitation is documented.
- Homepage discovery lists public upcoming events with cards, status, sorting, pagination, and correct public-only filtering.
- Organizer profiles render at `/organizers/{slug}` with verified badge/explainer, upcoming events, past events, cache headers, and redirect/404 behavior.
- Sitemap XML, robots.txt, canonical links, alternate links, event JSON-LD, and breadcrumb JSON-LD validate for public pages.
- Public legal/chrome pages render and are linked from the footer: `/privacy`, `/terms`, `/about`, `/faq`, and `/contact`.
- CDN purge is validated as a local no-op or with real Cloudflare credentials; failures must not roll back core publish/moderation flows.
- Known deferrals are not counted as failures: real email sending, Phase 3 booking/payment implementation, public dispute form, DSAR/deletion flows, participant profile, event-day operations, and refund/dispute workflows.
- Automated API/web/db checks for auth, organizer, admin, events, event-detail, discovery, organizer-detail, legal pages, sitemap, robots, plugins, cache/CDN helpers, and rollbacks pass.
